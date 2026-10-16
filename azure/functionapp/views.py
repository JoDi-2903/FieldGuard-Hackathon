"""Map backend field + telemetry + cached risk into the dashboard's farm-detail shape.

The React dashboard (frontend/src/data/farmDetails.js) renders four sensor tiles
(humidity, temperature, leafWetness, soilMoisture) — each {value, status, note,
history[7]} — plus a disease headline, an alert feed, a farmer-call transcript and
a list of steps. This module assembles exactly that shape from a window of raw
readings and the latest cached risk row, so the Function App can serve it from a
single GET and the frontend overlays it live.

Sensor status is derived here from transparent thresholds (reusing scoring.py's
HIGH_HUMIDITY_PCT). `leafWetness` has no physical sensor: it is the same humidity/
rain proxy scoring.compute_features uses, expressed as wet hours per day.
"""

from __future__ import annotations

import datetime as dt
import json
import statistics

from scoring import HIGH_HUMIDITY_PCT, NOMINAL_INTERVAL_MIN

# status thresholds (transparent "model" layer, aligned with scoring.py)
HUMIDITY_WARN_PCT = 80.0           # 80-90 => warn, >=90 (HIGH_HUMIDITY_PCT) => alert
TEMP_BLIGHT_LO, TEMP_BLIGHT_HI = 18.0, 22.0   # blight-favourable band => warn
TEMP_EXTREME_LO, TEMP_EXTREME_HI = 5.0, 38.0  # outside => alert
LEAF_WET_WARN_H, LEAF_WET_ALERT_H = 6.0, 10.0  # wet hours per day
SOIL_DRY_WARN_PCT, SOIL_DRY_ALERT_PCT = 20.0, 12.0
STALE_AFTER_MIN = 30
HISTORY_DAYS = 7


# --------------------------------------------------------------------------- #
# Daily aggregation
# --------------------------------------------------------------------------- #
def _day_groups(readings: list[dict], now: dt.datetime, days: int = HISTORY_DAYS):
    """Group readings into the last `days` calendar days (UTC), oldest-first."""
    dates = [(now.date() - dt.timedelta(days=days - 1 - i)) for i in range(days)]
    buckets: dict[dt.date, list[dict]] = {d: [] for d in dates}
    for r in readings:
        ts = r.get("deviceTimestamp")
        if ts is None:
            continue
        d = ts.date()
        if d in buckets:
            buckets[d].append(r)
    return [(d, buckets[d]) for d in dates]


def _mean(values: list) -> float | None:
    clean = [v for v in values if v is not None]
    return round(statistics.fmean(clean), 1) if clean else None


def _backfill(series: list[float | None]) -> list[float]:
    """Replace gaps (days with no data) with the nearest known value, default 0."""
    known = [v for v in series if v is not None]
    if not known:
        return [0.0] * len(series)
    out, last = [], known[0]
    for v in series:
        if v is None:
            out.append(last)
        else:
            out.append(v)
            last = v
    return [round(v, 1) for v in out]


def _history(groups, agg) -> list[float]:
    return _backfill([agg(rs) for (_, rs) in groups])


# --------------------------------------------------------------------------- #
# Per-sensor aggregators + status
# --------------------------------------------------------------------------- #
def _leaf_wet_hours(day_readings: list[dict]) -> float | None:
    if not day_readings:
        return None
    wet = sum(
        1
        for r in day_readings
        if (r.get("humidity_pct") is not None and r.get("humidity_pct") >= HIGH_HUMIDITY_PCT)
        or r.get("rain")
    )
    return round(wet * NOMINAL_INTERVAL_MIN / 60.0, 1)


def _humidity_status(value):
    if value is None:
        return "warn", "No recent reading"
    if value >= HIGH_HUMIDITY_PCT:
        return "alert", f"Above {HIGH_HUMIDITY_PCT:.0f} % — leaf-wetness risk"
    if value >= HUMIDITY_WARN_PCT:
        return "warn", "Elevated, watch overnight"
    return "ok", "In range"


def _temperature_status(value):
    if value is None:
        return "warn", "No recent reading"
    if value <= TEMP_EXTREME_LO or value >= TEMP_EXTREME_HI:
        return "alert", "Outside the healthy range"
    if TEMP_BLIGHT_LO <= value <= TEMP_BLIGHT_HI:
        return "warn", f"{TEMP_BLIGHT_LO:.0f}–{TEMP_BLIGHT_HI:.0f} °C favours blight"
    return "ok", "In range"


def _leaf_wetness_status(value):
    if value is None:
        return "warn", "No recent reading"
    if value >= LEAF_WET_ALERT_H:
        return "alert", f"Above {LEAF_WET_ALERT_H:.0f} h/day"
    if value >= LEAF_WET_WARN_H:
        return "warn", "Rising wet hours"
    return "ok", "In range"


def _soil_status(value):
    if value is None:
        return "warn", "No recent reading"
    if value <= SOIL_DRY_ALERT_PCT:
        return "alert", "Very dry root zone"
    if value <= SOIL_DRY_WARN_PCT:
        return "warn", "Getting dry"
    return "ok", "In range"


def _tile(value, history, status_fn):
    status, note = status_fn(value)
    return {
        "value": value if value is not None else (history[-1] if history else 0),
        "status": status,
        "note": note,
        "history": history,
    }


def _staleness_minutes(readings: list[dict], now: dt.datetime) -> float | None:
    if not readings:
        return None
    newest = readings[0].get("deviceTimestamp")
    if newest is None:
        return None
    return round((now - newest).total_seconds() / 60.0, 1)


def _ago(minutes: float | None) -> str:
    if minutes is None:
        return "no data yet"
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{int(minutes)} min ago"
    hours = minutes / 60.0
    if hours < 24:
        return f"{int(round(hours))} h ago"
    return f"{int(round(hours / 24))} d ago"


def _sensors(readings: list[dict], now: dt.datetime):
    """Return (sensors_dict, sensor_note). sensors_dict is None when there is no data."""
    if not readings:
        return None, "No sensor data yet for this field."
    groups = _day_groups(readings, now)
    newest = readings[0]

    hum_hist = _history(groups, lambda rs: _mean([r.get("humidity_pct") for r in rs]))
    temp_hist = _history(groups, lambda rs: _mean([r.get("temperature_c") for r in rs]))
    leaf_hist = _history(groups, _leaf_wet_hours)
    soil_hist = _history(groups, lambda rs: _mean([r.get("soil_pct") for r in rs]))

    sensors = {
        "humidity": _tile(newest.get("humidity_pct"), hum_hist, _humidity_status),
        "temperature": _tile(newest.get("temperature_c"), temp_hist, _temperature_status),
        "leafWetness": _tile(leaf_hist[-1] if leaf_hist else None, leaf_hist, _leaf_wetness_status),
        "soilMoisture": _tile(newest.get("soil_pct"), soil_hist, _soil_status),
    }
    return sensors, None


# --------------------------------------------------------------------------- #
# Field-level derivations
# --------------------------------------------------------------------------- #
def _disease(field: dict, risk_row: dict | None) -> str | None:
    known = (field.get("knownCases") or "").lower()
    if "blight" in known:
        return "late blight"
    if "mosaic" in known:
        return "cassava mosaic"
    color = (risk_row or {}).get("color")
    crop = (field.get("crop") or "").lower()
    if color in ("red", "yellow") and crop in ("potato", "tomato"):
        return "late blight"
    return None


def _stage(field: dict, now: dt.datetime) -> str | None:
    planting = field.get("plantingDate")
    if not planting:
        return None
    try:
        planted = dt.date.fromisoformat(str(planting))
    except ValueError:
        return None
    weeks = max(0, (now.date() - planted).days // 7)
    crop = field.get("crop")
    base = f"Planted {planted.strftime('%d %b')} · {weeks} week{'s' if weeks != 1 else ''}"
    return f"{base} · {crop}" if crop else base


def _loads(value, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return default


def build_farm_detail(field: dict, readings: list[dict], risk_row: dict | None, now: dt.datetime) -> dict:
    """Assemble the farmDetails-shaped payload the dashboard overlays onto a farm."""
    sensors, sensor_note = _sensors(readings, now)
    detail = {
        "fieldId": field.get("RowKey"),
        "crop": field.get("crop"),
        "knownCases": field.get("knownCases"),
        "stage": _stage(field, now),
        "sensorsUpdated": _ago(_staleness_minutes(readings, now)),
        "sensors": sensors,
        "disease": _disease(field, risk_row),
        "risk": {
            "color": (risk_row or {}).get("color"),
            "score": (risk_row or {}).get("score"),
            "reasoning": (risk_row or {}).get("reasoning"),
            "recommended_action": (risk_row or {}).get("recommended_action"),
            "data_caveats": (risk_row or {}).get("data_caveats"),
        }
        if risk_row
        else None,
        "alerts": _loads(risk_row.get("alerts_json") if risk_row else None, []),
        "call": _loads(risk_row.get("call_json") if risk_row else None, None),
        "steps": _loads(risk_row.get("steps_json") if risk_row else None, []),
    }
    if sensor_note:
        detail["sensorNote"] = sensor_note
    return detail
