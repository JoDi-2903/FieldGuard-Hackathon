"""FieldGuard Azure Functions (Python v2).

Endpoints:
  POST /api/ingest     - Arduino pushes a batch of sensor readings (X-Ingest-Key).
  GET  /api/readings   - time-series for the dashboard charts.
  GET  /api/risk       - latest risk score per field, ranked (the visit list).
  GET  /api/light      - plain-text colour for one box's traffic light (red/yellow/green/unknown).
  POST /api/score_now  - recompute all risk scores on demand (X-Ingest-Key).
  (timer) score_timer  - recompute all risk scores every ~20 min.

CORS is handled by the platform (Terraform site_config.cors / local Host.CORS),
so handlers never emit Access-Control-* headers themselves.
"""

from __future__ import annotations

import datetime as dt
import hmac
import json
import logging
import os

import azure.functions as func

import scoring
from storage import (
    classify_quality,
    fields_table,
    inverted_rowkey,
    parse_iso,
    risk_table,
    telemetry_table,
    utcnow,
)

app = func.FunctionApp()

logger = logging.getLogger("fieldguard")

# Only the columns the scorer uses, so a week of 5-second readings stays a small download.
SCORING_COLUMNS = ["deviceTimestamp", "temperature_c", "humidity_pct", "rain", "soil_pct", "quality"]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _authorized(req: func.HttpRequest) -> bool:
    """Constant-time check of the X-Ingest-Key header against the shared secret."""
    secret = os.environ.get("INGEST_SHARED_SECRET", "")
    if not secret:  # misconfigured: never accept writes without a configured secret
        logger.error("INGEST_SHARED_SECRET is not set; rejecting write.")
        return False
    return hmac.compare_digest(req.headers.get("X-Ingest-Key", ""), secret)


def _json(payload, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(payload, default=str),
        status_code=status_code,
        mimetype="application/json",
    )


def _entity_to_reading(entity: dict) -> dict:
    return {
        "deviceId": entity["PartitionKey"],
        "deviceTimestamp": entity["deviceTimestamp"].isoformat(),
        "serverTimestamp": entity["serverTimestamp"].isoformat(),
        "temperature_c": entity.get("temperature_c"),
        "humidity_pct": entity.get("humidity_pct"),
        "rain": entity.get("rain"),
        "soil_pct": entity.get("soil_pct"),
        "quality": entity.get("quality"),
    }


def _read_since(device_id: str, start: dt.datetime, now: dt.datetime) -> list[dict]:
    """Return a device's readings between `start` and `now`, newest-first, as raw entities."""
    # Inverted RowKey => newer time is a smaller key, so bounds flip.
    flt = "PartitionKey eq @pk and RowKey ge @lo and RowKey le @hi"
    params = {"pk": device_id, "lo": inverted_rowkey(now), "hi": inverted_rowkey(start)}
    return list(telemetry_table().query_entities(flt, parameters=params, select=SCORING_COLUMNS))


def _latest_risk_entity(field_id: str) -> dict | None:
    return next(
        iter(risk_table().query_entities("PartitionKey eq @pk", parameters={"pk": field_id})),
        None,
    )


def _blight_nights_from(risk_entity: dict) -> int | None:
    features = json.loads(risk_entity.get("features_json") or "{}")
    return (features.get("blight_rule") or {}).get("blight_nights")


def _score_all_fields() -> list[dict]:
    """Recompute and persist a risk score for every configured field."""
    now = utcnow()
    results = []
    for field in fields_table().query_entities("PartitionKey eq 'field'"):
        field_id = field["RowKey"]
        device_id = field.get("deviceId")
        rule_settings = scoring.select_blight_rule_settings(field)
        start = scoring.oldest_reading_needed(now, rule_settings)
        readings = _read_since(device_id, start, now) if device_id else []
        features = scoring.compute_features(readings, now=now, rule_settings=rule_settings)

        risk = scoring.score_field(field, features)
        risk = scoring.apply_blight_rule_floor(risk, features)
        entity = {
            "PartitionKey": field_id,
            "RowKey": inverted_rowkey(now),
            "fieldName": field.get("name"),
            "color": risk.color.value,
            "score": risk.score,
            "reasoning": risk.reasoning,
            "recommended_action": risk.recommended_action,
            "data_caveats": risk.data_caveats,
            "features_json": json.dumps(features, default=str),
            "model": os.environ.get("AZURE_OPENAI_DEPLOYMENT", ""),
            "scoredAt": now,
        }
        risk_table().upsert_entity(entity)
        results.append({"fieldId": field_id, "color": risk.color.value, "score": risk.score})
        logger.info("scored field=%s color=%s score=%s", field_id, risk.color.value, risk.score)
    return results


# --------------------------------------------------------------------------- #
# HTTP endpoints
# --------------------------------------------------------------------------- #
@app.route(route="ingest", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def ingest(req: func.HttpRequest) -> func.HttpResponse:
    if not _authorized(req):
        return func.HttpResponse("forbidden", status_code=403)

    try:
        body = req.get_json()
    except ValueError:
        return _json({"error": "body must be JSON"}, status_code=400)

    batch = body if isinstance(body, list) else [body]
    now = utcnow()
    table = telemetry_table()
    written = 0
    for reading in batch:
        try:
            device_id = reading["deviceId"]
            device_ts = parse_iso(reading["timestamp"])
        except (KeyError, TypeError, ValueError):
            return _json({"error": "each reading needs deviceId and ISO timestamp"}, status_code=400)

        table.upsert_entity(
            {
                "PartitionKey": device_id,
                "RowKey": inverted_rowkey(device_ts),
                "deviceTimestamp": device_ts,
                "serverTimestamp": now,
                "temperature_c": reading.get("temperature_c"),
                "humidity_pct": reading.get("humidity_pct"),
                "rain": int(bool(reading.get("rain", 0))),
                "soil_pct": reading.get("soil_pct"),
                "quality": classify_quality(reading),
            }
        )
        written += 1

    return _json({"written": written})


@app.route(route="readings", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def readings(req: func.HttpRequest) -> func.HttpResponse:
    device_id = req.params.get("deviceId")
    if not device_id:
        return _json({"error": "deviceId query parameter is required"}, status_code=400)
    limit = int(req.params.get("limit", "200"))

    flt = "PartitionKey eq @pk"
    params = {"pk": device_id}
    start = req.params.get("start")
    if start:
        end = req.params.get("end")
        end_dt = parse_iso(end) if end else utcnow()
        flt += " and RowKey ge @lo and RowKey le @hi"
        params["lo"] = inverted_rowkey(end_dt)       # newer bound -> smaller key
        params["hi"] = inverted_rowkey(parse_iso(start))

    rows = []
    for entity in telemetry_table().query_entities(flt, parameters=params):
        rows.append(_entity_to_reading(entity))
        if len(rows) >= limit:
            break
    return _json(rows)


@app.route(route="risk", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def risk(req: func.HttpRequest) -> func.HttpResponse:
    """Latest risk score per field, ranked most-urgent first (the visit list)."""
    out = []
    for field in fields_table().query_entities("PartitionKey eq 'field'"):
        field_id = field["RowKey"]
        latest = _latest_risk_entity(field_id)
        if latest is None:
            continue
        out.append(
            {
                "fieldId": field_id,
                "fieldName": field.get("name"),
                "crop": field.get("crop"),
                "deviceId": field.get("deviceId"),
                "blight_nights": _blight_nights_from(latest),
                "color": latest.get("color"),
                "score": latest.get("score"),
                "reasoning": latest.get("reasoning"),
                "recommended_action": latest.get("recommended_action"),
                "data_caveats": latest.get("data_caveats"),
                "scoredAt": latest.get("scoredAt").isoformat() if latest.get("scoredAt") else None,
            }
        )
    out.sort(key=lambda r: (r.get("score") or 0), reverse=True)
    return _json(out)


@app.route(route="light", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def light(req: func.HttpRequest) -> func.HttpResponse:
    """Colour for one box's LED traffic light, as one plain word so the Arduino needs no JSON parser.

    If a box serves several fields, the most urgent colour wins. No score yet => "unknown".
    """
    device_id = req.params.get("deviceId")
    if not device_id:
        return func.HttpResponse("deviceId query parameter is required", status_code=400)

    colors = []
    flt = "PartitionKey eq 'field' and deviceId eq @device"
    for field in fields_table().query_entities(flt, parameters={"device": device_id}):
        latest = _latest_risk_entity(field["RowKey"])
        if latest is not None and latest.get("color") in scoring.COLOR_RANK:
            colors.append(latest["color"])
    color = max(colors, key=scoring.COLOR_RANK.get) if colors else "unknown"
    return func.HttpResponse(color, mimetype="text/plain")


@app.route(route="score_now", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def score_now(req: func.HttpRequest) -> func.HttpResponse:
    if not _authorized(req):
        return func.HttpResponse("forbidden", status_code=403)
    return _json({"scored": _score_all_fields()})


# --------------------------------------------------------------------------- #
# Timer: recompute scores every ~20 minutes
# --------------------------------------------------------------------------- #
@app.timer_trigger(schedule="0 */20 * * * *", arg_name="timer", run_on_startup=False)
def score_timer(timer: func.TimerRequest) -> None:
    logger.info("scheduled scoring run started")
    _score_all_fields()
