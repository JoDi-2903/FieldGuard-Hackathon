"""Seed demo telemetry by POSTing realistic readings to the live /api/ingest endpoint.

A fresh deploy has configured fields but no sensor readings, so the dashboard's
live overlay would be empty. This standalone script generates a few days of 5-min
readings for the demo devices and pushes them through the real ingest pipeline
(so they get quality-classified and are picked up by the next scoring run), then
optionally triggers a scoring run so risk/alerts/call/steps are ready immediately.

  box-01  -> calm, healthy field  (expected green)
  box-02  -> blight-favourable:   high overnight humidity + mild temps + rain
             (expected yellow/red; this is the field-b "late blight" showcase)

Usage:
    export API_BASE_URL="$(terraform output -raw api_base_url)"      # https://<func>/api
    export INGEST_SHARED_SECRET="<the same secret set on the Function App>"
    python seed_telemetry.py            # seeds 3 days, then calls /score_now

Env:
    API_BASE_URL           required, e.g. https://fieldguard-func-xxxx.azurewebsites.net/api
    INGEST_SHARED_SECRET   required, matches the Function App app setting
    SEED_DAYS              optional, default 3
    SKIP_SCORE             optional, set to 1 to skip the final /score_now call
"""

from __future__ import annotations

import datetime as dt
import json
import math
import os
import sys
import urllib.error
import urllib.request

STEP_MIN = 5          # cadence that matches scoring.NOMINAL_INTERVAL_MIN
CHUNK = int(os.environ.get("SEED_CHUNK", "96"))     # readings per POST; small batches finish within the timeout
HTTP_TIMEOUT = int(os.environ.get("SEED_HTTP_TIMEOUT", "180"))


def _iso(when: dt.datetime) -> str:
    return when.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _healthy(hour: float, i: int) -> dict:
    """box-01: comfortable day, humidity never near the leaf-wetness threshold."""
    humidity = 62 + 10 * math.sin((hour - 3) / 24 * 2 * math.pi)   # ~52-72, peaks pre-dawn
    temp = 26 + 3 * math.sin((hour - 15) / 24 * 2 * math.pi)       # ~23-29, peaks mid-afternoon
    soil = 33 + 2 * math.sin(i / 300)                             # drifts gently in range
    return {
        "temperature_c": round(temp, 1),
        "humidity_pct": round(humidity, 1),
        "rain": 0,
        "soil_pct": round(soil, 1),
    }


def _blight(hour: float, i: int) -> dict:
    """box-02: long humid nights (>=90%), mild 18-22C temps, intermittent rain."""
    # Humidity peaks overnight well above 90% for ~10-12h, dips in the afternoon.
    humidity = 86 + 11 * math.sin((hour - 4) / 24 * 2 * math.pi)   # ~75-97
    temp = 20 + 2.5 * math.sin((hour - 15) / 24 * 2 * math.pi)     # ~17.5-22.5 (blight band)
    soil = 41 + 3 * math.sin(i / 250)
    # Rain in the early-morning foggy hours.
    rain = 1 if 2 <= hour <= 7 and (i % 3 != 0) else 0
    return {
        "temperature_c": round(temp, 1),
        "humidity_pct": round(min(99.0, humidity), 1),
        "rain": rain,
        "soil_pct": round(soil, 1),
    }


DEVICES = {"box-01": _healthy, "box-02": _blight}


def _generate(device_id: str, pattern, now: dt.datetime, days: int) -> list[dict]:
    total = days * 24 * 60 // STEP_MIN
    readings = []
    for i in range(total):
        # i=0 is the oldest reading, last is ~now.
        ts = now - dt.timedelta(minutes=STEP_MIN * (total - 1 - i))
        hour = ts.hour + ts.minute / 60.0
        readings.append({"deviceId": device_id, "timestamp": _iso(ts), **pattern(hour, i)})
    return readings


def _post(url: str, payload, headers: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:  # noqa: S310 - trusted operator URL
        return json.loads(resp.read().decode("utf-8") or "{}")


def main() -> int:
    base = os.environ.get("API_BASE_URL", "").rstrip("/")
    secret = os.environ.get("INGEST_SHARED_SECRET", "")
    if not base or not secret:
        print("Set API_BASE_URL (terraform output -raw api_base_url) and INGEST_SHARED_SECRET.")
        return 1

    days = int(os.environ.get("SEED_DAYS", "3"))
    now = dt.datetime.now(dt.timezone.utc)
    headers = {"Content-Type": "application/json", "X-Ingest-Key": secret}

    total_written = 0
    for device_id, pattern in DEVICES.items():
        readings = _generate(device_id, pattern, now, days)
        for start in range(0, len(readings), CHUNK):
            batch = readings[start:start + CHUNK]
            try:
                result = _post(f"{base}/ingest", batch, headers)
            except urllib.error.HTTPError as exc:
                print(f"  ingest failed ({exc.code}): {exc.read().decode('utf-8', 'ignore')}")
                return 1
            total_written += result.get("written", 0)
        print(f"seeded {len(readings)} readings for {device_id}")

    print(f"\nIngested {total_written} readings total over {days} day(s).")

    if os.environ.get("SKIP_SCORE") != "1":
        try:
            scored = _post(f"{base}/score_now", {}, headers)
            print(f"triggered scoring: {scored.get('scored')}")
        except urllib.error.HTTPError as exc:
            print(f"score_now failed ({exc.code}) — run it manually later: {exc.reason}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
