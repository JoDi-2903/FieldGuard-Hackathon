"""Risk scoring: deterministic feature extraction + LLM explanation/scoring.

Philosophy (brainstorming.md §3, §12): the transparent, explainable signals are
computed here in plain Python. The LLM receives those signals plus field context
and produces a justified risk score — it does NOT invent agronomic thresholds, and
it must never report low risk when the data is stale or missing.
"""

from __future__ import annotations

import datetime as dt
import functools
import os
import statistics
from enum import Enum

from openai import AzureOpenAI
from pydantic import BaseModel, Field

from storage import utcnow

# --- Tunable, transparent constants (the "model" layer) ---
HIGH_HUMIDITY_PCT = 90.0      # leaf-wetness proxy threshold
NOMINAL_INTERVAL_MIN = 5      # assumed cadence to turn counts into hours
STALE_AFTER_MIN = 30          # readings older than this => data considered stale
STUCK_STDDEV_EPS = 0.01       # near-zero variance over the window => stuck sensor


# --- Structured LLM output ---
class RiskColor(str, Enum):
    green = "green"
    yellow = "yellow"
    red = "red"


class RiskScore(BaseModel):
    color: RiskColor = Field(description="Traffic-light risk level for this field.")
    score: int = Field(description="Risk score 0-100 (higher = more urgent). Validated/clamped in code.")
    reasoning: str = Field(description="Which concrete signals drove the score, in 1-3 sentences.")
    recommended_action: str = Field(description="The single next action for the field officer.")
    data_caveats: str = Field(description="Data-quality caveats (stale/missing/implausible/stuck sensors). Empty string if none.")


def _mean(values: list[float]) -> float | None:
    return round(statistics.fmean(values), 2) if values else None


def _stats(values: list) -> dict:
    clean = [v for v in values if v is not None]
    if not clean:
        return {"min": None, "mean": None, "max": None}
    return {"min": round(min(clean), 2), "mean": _mean(clean), "max": round(max(clean), 2)}


def compute_features(readings: list[dict], now: dt.datetime | None = None) -> dict:
    """Turn a window of telemetry rows (newest-first) into transparent features."""
    now = now or utcnow()
    if not readings:
        return {"readings_total": 0, "staleness_minutes": None, "note": "no readings in window"}

    temps = [r.get("temperature_c") for r in readings]
    hums = [r.get("humidity_pct") for r in readings]
    soils = [r.get("soil_pct") for r in readings]
    qualities = [r.get("quality") for r in readings]

    newest = readings[0]
    oldest = readings[-1]
    newest_ts = newest["deviceTimestamp"]
    span_hours = max((newest_ts - oldest["deviceTimestamp"]).total_seconds() / 3600.0, 0.0)

    # Leaf-wetness proxy: readings above the humidity threshold, expressed as hours.
    high_hum_count = sum(1 for h in hums if h is not None and h >= HIGH_HUMIDITY_PCT)
    high_humidity_hours = round(high_hum_count * NOMINAL_INTERVAL_MIN / 60.0, 1)

    # Rain: current state + how often it was wet in the window.
    wet_count = sum(1 for r in readings if r.get("rain"))
    recently_wet = bool(newest.get("rain"))

    # Soil moisture trend (rate of change per hour, latest vs oldest).
    soil_now = newest.get("soil_pct")
    soil_then = oldest.get("soil_pct")
    soil_trend_per_h = (
        round((soil_now - soil_then) / span_hours, 2)
        if (soil_now is not None and soil_then is not None and span_hours > 0)
        else None
    )

    # Simple anomaly signal: z-score of the latest temp/humidity vs the window.
    def _zscore(latest, series):
        clean = [v for v in series if v is not None]
        if latest is None or len(clean) < 3:
            return None
        sd = statistics.pstdev(clean)
        if sd < STUCK_STDDEV_EPS:
            return 0.0
        return round((latest - statistics.fmean(clean)) / sd, 2)

    # Data quality.
    staleness_minutes = round((now - newest_ts).total_seconds() / 60.0, 1)
    missing_count = sum(1 for q in qualities if q == "missing")
    implausible_count = sum(1 for q in qualities if q == "implausible")

    def _stuck(series):
        clean = [v for v in series if v is not None]
        return len(clean) >= 3 and statistics.pstdev(clean) < STUCK_STDDEV_EPS

    return {
        "window_hours": round(span_hours, 1),
        "readings_total": len(readings),
        "temperature_c": _stats(temps),
        "humidity_pct": _stats(hums),
        "high_humidity_hours": high_humidity_hours,
        "high_humidity_threshold_pct": HIGH_HUMIDITY_PCT,
        "rain_wet_readings": wet_count,
        "recently_wet": recently_wet,
        "soil_pct_now": soil_now,
        "soil_trend_pct_per_hour": soil_trend_per_h,
        "temp_latest_zscore": _zscore(newest.get("temperature_c"), temps),
        "humidity_latest_zscore": _zscore(newest.get("humidity_pct"), hums),
        "staleness_minutes": staleness_minutes,
        "is_stale": staleness_minutes > STALE_AFTER_MIN,
        "missing_readings": missing_count,
        "implausible_readings": implausible_count,
        "stuck_sensors": {
            "temperature": _stuck(temps),
            "humidity": _stuck(hums),
            "soil": _stuck(soils),
        },
    }


@functools.lru_cache(maxsize=1)
def _client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21"),
    )


_SYSTEM_PROMPT = (
    "You are a risk-triage assistant for an agricultural extension officer who must "
    "decide which field to inspect next for a crop-disease risk (e.g. late/leaf blight), "
    "which is favoured by prolonged leaf wetness, high humidity, moderate temperatures and rain. "
    "You are given PRE-COMPUTED, transparent signals for one field; do not invent thresholds "
    "beyond interpreting these signals. Rank urgency so the officer visits the highest-risk field first.\n"
    "Rules:\n"
    "- Base the score on the provided signals and field context only.\n"
    "- NEVER report low risk when data is stale, missing, implausible or a sensor looks stuck. "
    "In that case raise caution, keep the score mid-range at least, and explain the data gap in data_caveats.\n"
    "- A favourable micro-climate indicates CONDITIONS for risk, not a confirmed infection; "
    "recommend an inspection, not a treatment.\n"
    "- Keep reasoning and recommended_action short and concrete."
)


def score_field(field: dict, features: dict) -> RiskScore:
    """Call the LLM to produce a validated RiskScore from field context + features."""
    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    user_content = (
        f"FIELD CONTEXT:\n"
        f"  name: {field.get('name')}\n"
        f"  crop: {field.get('crop')}\n"
        f"  plantingDate: {field.get('plantingDate')}\n"
        f"  knownCases: {field.get('knownCases')}\n\n"
        f"COMPUTED SIGNALS (last window):\n{features}"
    )

    completion = _client().beta.chat.completions.parse(
        model=deployment,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format=RiskScore,
    )
    result = completion.choices[0].message.parsed
    # JSON schema can't enforce numeric bounds — clamp defensively.
    result.score = max(0, min(100, int(result.score)))
    return result
