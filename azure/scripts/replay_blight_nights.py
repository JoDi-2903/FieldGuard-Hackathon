#!/usr/bin/env python3
"""Demo: replay a week with blight nights for one box, then rescore and show the result.

Posts 15-minute readings to /api/ingest for the last NIGHTS noon-to-noon windows
(Kasungu time): leaf plate wet 20:00-04:00 at about 22 °C, dry and warm otherwise.
4 nights => red under the blight-night rule. Then calls /api/score_now and prints
/api/risk and /api/light for the box.

Standard library only. The key comes from $INGEST_KEY or, if unset, from
arduino/arduino/cloud_node/arduino_secrets.h.

Usage (from the repo root):
    python3 azure/scripts/replay_blight_nights.py                  # box-02, 4 nights
    python3 azure/scripts/replay_blight_nights.py --nights 2       # yellow
    python3 azure/scripts/replay_blight_nights.py --dry-run        # print, send nothing
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.request

BASE = "https://fieldguard-func-32vxg3.azurewebsites.net/api"
SECRETS = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "arduino", "arduino", "cloud_node", "arduino_secrets.h"
)

STEP = dt.timedelta(minutes=15)
BATCH_SIZE = 96  # one day of 15-minute readings per request
WINDOW_ANCHOR = dt.datetime(2026, 1, 1, 10, 0, tzinfo=dt.timezone.utc)  # noon in Kasungu (UTC+2)
WET_FROM = dt.timedelta(hours=8)    # 20:00 local, counted from the window's noon start
WET_FOR = dt.timedelta(hours=8)     # until 04:00 local


def main() -> int:
    args = parse_arguments()
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    readings = build_replay_readings(args.device, now, args.nights)
    print_replay_summary(readings, args)
    if args.dry_run:
        return 0

    key = read_ingest_key()
    post_readings_in_batches(readings, key)
    if not args.no_score:
        print("POST /score_now (calls the LLM for every field, takes a few seconds)")
        print(http_request("POST", "/score_now", key=key))
    print("GET /risk")
    print(json.dumps(json.loads(http_request("GET", "/risk")), indent=2))
    print(f"GET /light?deviceId={args.device}: {http_request('GET', f'/light?deviceId={args.device}')}")
    return 0


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--device", default="box-02", help="deviceId to write (default: box-02, field-b)")
    parser.add_argument("--nights", type=int, default=4, help="blight nights to replay, 0-7 (default: 4 => red)")
    parser.add_argument("--no-score", action="store_true", help="skip /score_now (wait for the 20-min timer)")
    parser.add_argument("--dry-run", action="store_true", help="build and print the readings, send nothing")
    return parser.parse_args()


def build_replay_readings(device_id: str, now: dt.datetime, nights: int) -> list[dict]:
    """15-minute readings from the start of the oldest replayed window until now."""
    current_window = WINDOW_ANCHOR + ((now - WINDOW_ANCHOR) // dt.timedelta(days=1)) * dt.timedelta(days=1)
    wet_windows = [current_window - i * dt.timedelta(days=1) for i in range(1, nights + 1)]
    start = wet_windows[-1] if wet_windows else current_window
    readings = []
    t = start
    while t <= now:
        readings.append(build_reading(device_id, t, is_wet=is_in_wet_night(t, wet_windows)))
        t += STEP
    return readings


def is_in_wet_night(moment: dt.datetime, wet_windows: list[dt.datetime]) -> bool:
    return any(w + WET_FROM <= moment < w + WET_FROM + WET_FOR for w in wet_windows)


def build_reading(device_id: str, moment: dt.datetime, is_wet: bool) -> dict:
    return {
        "deviceId": device_id,
        "timestamp": moment.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "temperature_c": 22.0 if is_wet else 27.0,
        "humidity_pct": 96.0 if is_wet else 62.0,
        "rain": 1 if is_wet else 0,
        "soil_pct": 55.0 if is_wet else 45.0,
    }


def print_replay_summary(readings: list[dict], args: argparse.Namespace) -> None:
    wet = sum(r["rain"] for r in readings)
    print(
        f"{len(readings)} readings for {args.device} from {readings[0]['timestamp']} to "
        f"{readings[-1]['timestamp']}, {wet} wet ({wet * STEP.total_seconds() / 3600:.1f} h), "
        f"{args.nights} blight nights"
    )


def read_ingest_key() -> str:
    key = os.environ.get("INGEST_KEY", "")
    if not key and os.path.exists(SECRETS):
        match = re.search(r'^#define INGEST_KEY "(.*)"', open(SECRETS).read(), re.MULTILINE)
        key = match.group(1) if match else ""
    if not key:
        sys.exit("No ingest key: set INGEST_KEY or fill in arduino_secrets.h")
    return key


def post_readings_in_batches(readings: list[dict], key: str) -> None:
    for i in range(0, len(readings), BATCH_SIZE):
        batch = readings[i : i + BATCH_SIZE]
        print(f"POST /ingest {i + 1}-{i + len(batch)}: {http_request('POST', '/ingest', batch, key)}")


def http_request(method: str, path: str, body: list | None = None, key: str = "") -> str:
    data = json.dumps(body).encode() if body is not None else (b"" if method == "POST" else None)
    request = urllib.request.Request(f"{BASE}{path}", data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if key:
        request.add_header("X-Ingest-Key", key)
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read().decode()


if __name__ == "__main__":
    sys.exit(main())
