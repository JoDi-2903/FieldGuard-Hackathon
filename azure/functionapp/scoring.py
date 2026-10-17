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

import blight_rule
from storage import utcnow

# --- Tunable, transparent constants (the "model" layer) ---
HIGH_HUMIDITY_PCT = 90.0      # secondary leaf-wetness proxy (DHT11 is unreliable above 90 %)
NOMINAL_INTERVAL_MIN = 5      # assumed cadence to turn reading counts into hours (views.py)
RECENT_WINDOW_HOURS = 48      # window for the descriptive stats; the blight rule looks back further
STALE_AFTER_MIN = 30          # readings older than this => data considered stale
STUCK_STDDEV_EPS = 0.01       # near-zero variance over the window => stuck sensor

# The blight-night rule sets a floor under the LLM: it can raise the colour, never lower it.
COLOR_RANK = {"green": 0, "yellow": 1, "red": 2}
FLOOR_SCORE = {"green": 0, "yellow": 40, "red": 70}


# --- Structured LLM output ---
class RiskColor(str, Enum):
    green = "green"
    yellow = "yellow"
    red = "red"


class Step(BaseModel):
    title: str = Field(description="Very short imperative action, two to four plain words the officer can scan at a glance. No dashes.")
    sub: str = Field(description="At most one short, plain half-sentence of elaboration, no dashes. Prefer an empty string when the title already says enough.")


class RiskScore(BaseModel):
    color: RiskColor = Field(description="Traffic-light risk level for this field.")
    score: int = Field(description="Risk score 0-100 (higher = more urgent). Validated/clamped in code.")
    reasoning: str = Field(description="EXACTLY one plain sentence of AT MOST 10 words naming the single main signal behind the score. Do NOT repeat the raw sensor numbers or units; they are already shown to the officer. No dashes.")
    recommended_action: str = Field(description="The single next action for the field officer. One short, plain sentence. No dashes.")
    data_caveats: str = Field(description="Data-quality caveats (stale/missing/implausible/stuck sensors). Empty string if none.")
    steps: list[Step] = Field(
        description="2-4 concrete, prioritised steps the officer should take on this field, most important first. Keep each one short."
    )


class CallLine(BaseModel):
    t: int = Field(description="Whole second offset into the recording when this line starts (first line is 0).")
    who: str = Field(description="Speaker, exactly 'Farmer' or 'WHH hotline'.")
    text: str = Field(description="One short spoken line, first person, plain language.")


class FarmerCall(BaseModel):
    meta: str = Field(description="Header line, e.g. 'Farmer hotline - 15 Oct, 07:40 - 0:52 - translated'.")
    summary: str = Field(description="One short sentence summarising what the farmer reports.")
    duration: int = Field(description="Call length in seconds; a few seconds after the last line's t.")
    lines: list[CallLine] = Field(description="Chronological transcript, 3-5 short lines, Farmer and WHH hotline alternating.")


class AlertItem(BaseModel):
    who: str = Field(description="Source of the alert, one of 'Sensor', 'System', 'Hotline'.")
    at: str = Field(description="Human-readable timestamp, e.g. '15 Oct, 06:00'.")
    text: str = Field(description="One short sentence describing the alert.")


class AlertFeed(BaseModel):
    alerts: list[AlertItem] = Field(description="0-5 alerts, oldest first. Empty list when nothing noteworthy happened.")


def _mean(values: list[float]) -> float | None:
    return round(statistics.fmean(values), 2) if values else None


def _stats(values: list) -> dict:
    clean = [v for v in values if v is not None]
    if not clean:
        return {"min": None, "mean": None, "max": None}
    return {"min": round(min(clean), 2), "mean": _mean(clean), "max": round(max(clean), 2)}


def select_blight_rule_settings(field: dict) -> blight_rule.BlightRuleSettings:
    """Fields flagged `demoMode` use 10-minute "nights" so a live spray shows up within minutes."""
    return blight_rule.DEMO_SETTINGS if field.get("demoMode") else blight_rule.FIELD_SETTINGS


def oldest_reading_needed(now: dt.datetime, settings: blight_rule.BlightRuleSettings) -> dt.datetime:
    """Earliest timestamp both the blight rule and the recent stats need."""
    recent_start = now - dt.timedelta(hours=RECENT_WINDOW_HOURS)
    return min(blight_rule.oldest_window_start(now, settings), recent_start)


def compute_features(
    readings: list[dict],
    now: dt.datetime | None = None,
    rule_settings: blight_rule.BlightRuleSettings = blight_rule.FIELD_SETTINGS,
) -> dict:
    """Turn telemetry rows (any order) into transparent features plus the blight-night count."""
    now = now or utcnow()
    blight = blight_rule.evaluate_blight_rule(readings, now, rule_settings).as_features()
    recent_start = now - dt.timedelta(hours=RECENT_WINDOW_HOURS)
    readings = sorted(
        (r for r in readings if r["deviceTimestamp"] >= recent_start),
        key=lambda r: r["deviceTimestamp"],
        reverse=True,
    )
    if not readings:
        return {
            "readings_total": 0,
            "staleness_minutes": None,
            "note": "no readings in window",
            "blight_rule": blight,
        }

    temps = [r.get("temperature_c") for r in readings]
    hums = [r.get("humidity_pct") for r in readings]
    soils = [r.get("soil_pct") for r in readings]
    qualities = [r.get("quality") for r in readings]

    newest = readings[0]
    oldest = readings[-1]
    newest_ts = newest["deviceTimestamp"]
    span_hours = max((newest_ts - oldest["deviceTimestamp"]).total_seconds() / 3600.0, 0.0)

    # Wet time from the timestamps (works for any cadence): leaf plate first, humidity second.
    timed_readings = blight_rule.pair_readings_with_durations(readings)
    leaf_wet_hours = round(sum(h for r, h in timed_readings if blight_rule.is_leaf_wet(r)), 2)
    high_humidity_hours = round(
        sum(h for r, h in timed_readings if (r.get("humidity_pct") or 0) >= HIGH_HUMIDITY_PCT), 2
    )

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
        "leaf_wet_hours": leaf_wet_hours,
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
        "blight_rule": blight,
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
    "The strongest signal is blight_rule: a blight night is a noon-to-noon window with >= 6 h of leaf "
    "wetness (leaf plate wet) at a mean 18-27 °C while wet. Its rule_color is a floor applied after you "
    "answer, so explain the blight-night count in your reasoning.\n"
    "Rules:\n"
    "- Base the score on the provided signals and field context only.\n"
    "- NEVER report low risk when data is stale, missing, implausible or a sensor looks stuck. "
    "In that case raise caution, keep the score mid-range at least, and explain the data gap in data_caveats.\n"
    "- A favourable micro-climate indicates CONDITIONS for risk, not a confirmed infection; "
    "recommend an inspection, not a treatment.\n"
    "- `reasoning` must be EXACTLY one plain sentence of AT MOST 10 words that names only the one "
    "main signal behind the score. Do not list every signal and do not restate the raw sensor values "
    "or units, as the officer already sees those on the tiles above. "
    "Keep recommended_action very short, simple and plain too, one idea per short sentence, "
    "so a non-expert can understand them at a glance.\n"
    "- Never use dashes in any text you return (no em dash, no en dash, no hyphen used as a dash). "
    "Use short separate sentences or commas instead.\n"
    "- In `steps`, give 2-4 prioritised actions for the officer (most important first). "
    "Keep each title to a few plain words and each sub to at most one short half-sentence; "
    "leave sub empty when the title is clear on its own. "
    "When risk is low or data is missing, the steps are about inspection and data recovery, not treatment."
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


def apply_blight_rule_floor(risk: RiskScore, features: dict) -> RiskScore:
    """Raise the LLM's colour and score to at least the blight-night rule's colour; never lower them."""
    rule = features.get("blight_rule") or {}
    rule_color = rule.get("rule_color", "green")
    if COLOR_RANK[rule_color] <= COLOR_RANK[risk.color.value]:
        return risk
    return risk.model_copy(
        update={
            "color": RiskColor(rule_color),
            "score": max(risk.score, FLOOR_SCORE[rule_color]),
            "reasoning": (
                f"{risk.reasoning} Blight-night rule: {rule['blight_nights']} of the last "
                f"{rule['lookback_windows']} nights favoured blight, so at least {rule_color}."
            ),
        }
    )


def _field_context(field: dict) -> str:
    return (
        f"  name: {field.get('name')}\n"
        f"  crop: {field.get('crop')}\n"
        f"  plantingDate: {field.get('plantingDate')}\n"
        f"  knownCases: {field.get('knownCases')}\n"
    )


_ALERTS_SYSTEM_PROMPT = (
    "You turn the computed signals for one agricultural field into a short feed of past alerts, "
    "as if a monitoring system had posted them over the last few days. "
    "Each alert is one factual sentence grounded ONLY in the provided signals and risk verdict "
    "(e.g. a humidity/leaf-wetness threshold crossed, an officer visit scheduled, an SMS sent to the farmer). "
    "Do not invent sensors or numbers that are not in the signals. "
    "`who` is 'Sensor' for threshold events, 'System' for automated actions, 'Hotline' for farmer contact. "
    "`at` is a short human timestamp. Oldest first. Return an empty list if the field looks calm."
)


def generate_alerts(field: dict, features: dict, risk: "RiskScore") -> list[dict]:
    """Best-effort LLM alert feed for a field, grounded in the computed signals."""
    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    user_content = (
        f"FIELD CONTEXT:\n{_field_context(field)}\n"
        f"RISK VERDICT: color={risk.color.value} score={risk.score} "
        f"reasoning={risk.reasoning} caveats={risk.data_caveats}\n\n"
        f"COMPUTED SIGNALS:\n{features}"
    )
    completion = _client().beta.chat.completions.parse(
        model=deployment,
        messages=[
            {"role": "system", "content": _ALERTS_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format=AlertFeed,
    )
    feed = completion.choices[0].message.parsed
    return [a.model_dump() for a in feed.alerts]


_CALL_SYSTEM_PROMPT = (
    "You write a realistic, short transcript of a phone call between a smallholder farmer and the "
    "Welthungerhilfe (WHH) farmer hotline, as if recorded shortly before the extension officer's visit. "
    "The farmer describes, in plain first-person language, symptoms consistent with the field's crop, "
    "known cases and risk verdict (what they SEE on the plants); the hotline asks brief clarifying questions "
    "and ends by advising an officer visit. Ground the symptoms in the provided context and signals; "
    "do not quote sensor numbers. Keep it brief: 3-5 short lines, speakers alternating, Farmer first, "
    "and a one-sentence summary. "
    "Timestamps `t` are increasing whole seconds; `duration` is a few seconds after the last line."
)


def generate_call(field: dict, features: dict, risk: "RiskScore") -> dict:
    """Best-effort LLM-generated farmer-call transcript grounded in the field's conditions."""
    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    user_content = (
        f"FIELD CONTEXT:\n{_field_context(field)}\n"
        f"RISK VERDICT: color={risk.color.value} score={risk.score} reasoning={risk.reasoning}\n\n"
        f"COMPUTED SIGNALS:\n{features}"
    )
    completion = _client().beta.chat.completions.parse(
        model=deployment,
        messages=[
            {"role": "system", "content": _CALL_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format=FarmerCall,
    )
    call = completion.choices[0].message.parsed
    out = call.model_dump()
    out["audio"] = None  # real recording is uploaded out-of-band; UI animates a placeholder
    return out
