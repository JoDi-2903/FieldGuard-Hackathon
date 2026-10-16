"""Tests for the blight-night rule, the scorer's rule floor and the /api/light endpoint.

Run from azure/functionapp:  python -m pytest tests
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import blight_rule  # noqa: E402
import scoring  # noqa: E402

UTC = dt.timezone.utc
# 10:00 UTC = noon in Kasungu, the start of a "night" window.
NOW = dt.datetime(2026, 10, 16, 10, 30, tzinfo=UTC)


def make_reading(when, rain, temp=22.0, humidity=95.0, soil=40.0):
    return {
        "deviceTimestamp": when,
        "temperature_c": temp,
        "humidity_pct": humidity,
        "rain": rain,
        "soil_pct": soil,
        "quality": "ok",
    }


def make_night(window_start, wet_hours, temp=22.0, step=dt.timedelta(minutes=15)):
    """Readings for one noon-to-noon window: wet from 20:00 local for `wet_hours`, dry otherwise."""
    readings = []
    wet_from = window_start + dt.timedelta(hours=8)
    wet_until = wet_from + dt.timedelta(hours=wet_hours)
    t = window_start
    while t < window_start + dt.timedelta(days=1):
        is_wet = wet_from <= t < wet_until
        readings.append(make_reading(t, rain=int(is_wet), temp=temp if is_wet else 27.0, humidity=95 if is_wet else 60))
        t += step
    return readings


def window_start(nights_ago):
    return blight_rule.find_window_start(NOW, dt.timedelta(days=1)) - nights_ago * dt.timedelta(days=1)


# --------------------------------------------------------------------------- #
# Wet time from timestamps
# --------------------------------------------------------------------------- #
def test_wet_hours_follow_timestamps_for_5_second_cadence():
    start = NOW - dt.timedelta(minutes=10)
    readings = [make_reading(start + dt.timedelta(seconds=5 * i), rain=1) for i in range(120)]
    timed = blight_rule.pair_readings_with_durations(readings)
    assert abs(sum(h for _, h in timed) - 10 / 60) < 1e-9


def test_long_gap_is_capped_not_counted_as_wet():
    readings = [make_reading(NOW - dt.timedelta(hours=8), rain=1), make_reading(NOW, rain=1)]
    timed = blight_rule.pair_readings_with_durations(readings)
    assert timed[0][1] == 0.5


def test_failed_dht_read_is_ignored_for_temperature():
    assert blight_rule.pick_air_temperature(make_reading(NOW, 1, temp=0, humidity=0)) is None
    assert blight_rule.pick_air_temperature(make_reading(NOW, 1, temp=0, humidity=80)) == 0


# --------------------------------------------------------------------------- #
# Blight nights and colour
# --------------------------------------------------------------------------- #
def test_one_long_warm_wet_night_counts_once():
    result = blight_rule.evaluate_blight_rule(make_night(window_start(1), wet_hours=8), NOW)
    assert result.blight_nights == 1
    assert result.color == "green"


def test_short_wet_night_does_not_count():
    result = blight_rule.evaluate_blight_rule(make_night(window_start(1), wet_hours=4), NOW)
    assert result.blight_nights == 0


def test_cold_wet_night_does_not_count():
    result = blight_rule.evaluate_blight_rule(make_night(window_start(1), wet_hours=10, temp=14.0), NOW)
    assert result.blight_nights == 0


def test_two_nights_yellow_four_nights_red():
    two = [r for n in (1, 2) for r in make_night(window_start(n), wet_hours=8)]
    four = [r for n in (1, 2, 3, 4) for r in make_night(window_start(n), wet_hours=8)]
    assert blight_rule.evaluate_blight_rule(two, NOW).color == "yellow"
    assert blight_rule.evaluate_blight_rule(four, NOW).color == "red"


def test_nights_older_than_lookback_are_ignored():
    old = [r for n in (7, 8, 9, 10) for r in make_night(window_start(n), wet_hours=8)]
    assert blight_rule.evaluate_blight_rule(old, NOW).blight_nights == 0


def test_demo_mode_three_wet_minutes_make_a_blight_night():
    start = blight_rule.find_window_start(NOW, blight_rule.DEMO_SETTINGS.window_length)
    readings = [make_reading(start + dt.timedelta(seconds=5 * i), rain=1) for i in range(40)]  # 200 s
    result = blight_rule.evaluate_blight_rule(readings, start + dt.timedelta(minutes=4), blight_rule.DEMO_SETTINGS)
    assert result.blight_nights == 1
    assert result.color == "yellow"


# --------------------------------------------------------------------------- #
# Scorer: features and rule floor
# --------------------------------------------------------------------------- #
def test_features_carry_blight_rule_and_leaf_wet_hours():
    readings = [r for n in (0, 1) for r in make_night(window_start(n), wet_hours=8)]
    features = scoring.compute_features(readings, now=NOW + dt.timedelta(days=1))
    assert features["blight_rule"]["blight_nights"] == 2
    assert features["leaf_wet_hours"] > 15
    json.dumps(features, default=str)


def test_features_without_readings_still_have_rule():
    features = scoring.compute_features([], now=NOW)
    assert features["blight_rule"]["blight_nights"] == 0


def make_risk(color, score):
    return scoring.RiskScore(
        color=color, score=score, reasoning="LLM view.", recommended_action="Visit.", data_caveats=""
    )


def test_floor_raises_green_to_red():
    features = {"blight_rule": {"rule_color": "red", "blight_nights": 4, "lookback_windows": 7}}
    risk = scoring.apply_blight_rule_floor(make_risk("green", 10), features)
    assert risk.color.value == "red"
    assert risk.score == 70
    assert "4 of the last 7 nights" in risk.reasoning


def test_floor_never_lowers_llm_colour():
    features = {"blight_rule": {"rule_color": "yellow", "blight_nights": 2, "lookback_windows": 7}}
    risk = scoring.apply_blight_rule_floor(make_risk("red", 85), features)
    assert risk.color.value == "red"
    assert risk.score == 85


def test_select_demo_settings_from_field_flag():
    assert scoring.select_blight_rule_settings({"demoMode": True}) is blight_rule.DEMO_SETTINGS
    assert scoring.select_blight_rule_settings({}) is blight_rule.FIELD_SETTINGS


# --------------------------------------------------------------------------- #
# /api/light
# --------------------------------------------------------------------------- #
class FakeTable:
    def __init__(self, rows_by_filter):
        self.rows_by_filter = rows_by_filter

    def query_entities(self, flt, parameters=None, **_):
        return iter(self.rows_by_filter(flt, parameters or {}))


def call_light(monkeypatch, fields, risks, device_id="box-01"):
    import azure.functions as func

    import function_app

    monkeypatch.setattr(
        function_app,
        "fields_table",
        lambda: FakeTable(lambda flt, p: [f for f in fields if f["deviceId"] == p["device"]]),
    )
    monkeypatch.setattr(
        function_app, "risk_table", lambda: FakeTable(lambda flt, p: risks.get(p["pk"], []))
    )
    req = func.HttpRequest("GET", "/api/light", params={"deviceId": device_id}, body=b"")
    return function_app.light(req).get_body().decode()


def test_light_returns_most_urgent_colour_for_device(monkeypatch):
    fields = [
        {"RowKey": "field-a", "deviceId": "box-01"},
        {"RowKey": "field-x", "deviceId": "box-01"},
        {"RowKey": "field-b", "deviceId": "box-02"},
    ]
    risks = {"field-a": [{"color": "yellow"}], "field-x": [{"color": "green"}], "field-b": [{"color": "red"}]}
    assert call_light(monkeypatch, fields, risks) == "yellow"


def test_light_unknown_without_score(monkeypatch):
    assert call_light(monkeypatch, [{"RowKey": "field-a", "deviceId": "box-01"}], {}) == "unknown"


# --------------------------------------------------------------------------- #
# Demo replay script
# --------------------------------------------------------------------------- #
def score_replay(nights):
    import importlib.util

    path = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "replay_blight_nights.py")
    spec = importlib.util.spec_from_file_location("replay_blight_nights", path)
    replay = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(replay)

    rows = replay.build_replay_readings("box-02", NOW, nights)
    readings = [dict(r, deviceTimestamp=dt.datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00"))) for r in rows]
    return scoring.compute_features(readings, now=NOW)["blight_rule"]


def test_replay_four_nights_is_red_two_is_yellow():
    assert score_replay(4)["blight_nights"] == 4
    assert score_replay(4)["rule_color"] == "red"
    assert score_replay(2)["rule_color"] == "yellow"
    assert score_replay(0)["rule_color"] == "green"
