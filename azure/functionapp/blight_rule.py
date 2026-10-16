"""Blight-night rule: the deterministic core of the risk score.

Ported from arduino/pi/blight_node.py, so the box no longer needs a Raspberry Pi.

- A "night" is a noon-to-noon window (local time in Kasungu), so one window holds a
  whole night of dew.
- In each window: wet hours = time the leaf plate was wet (rain = 1), and the mean
  air temperature while wet.
- A window is a blight night if it was wet for >= 6 h at a mean temperature of
  18-27 °C while wet (the NCLB rule).
- Count the blight nights in the last 7 windows: 0-1 green, 2-3 yellow, 4+ red.

These are starting values; calibrate them with the field officer's observations.

Wet time comes from the reading timestamps, not from an assumed cadence, so the same
rule works for a box posting every 5 s (demo) or every 15 min (field).
"""

from __future__ import annotations

import datetime as dt
import statistics
from dataclasses import dataclass

BLIGHT_TEMP_MIN_C = 18.0
BLIGHT_TEMP_MAX_C = 27.0

# Windows start at 12:00 in Kasungu (CAT, UTC+2), i.e. 10:00 UTC.
WINDOW_ANCHOR = dt.datetime(2026, 1, 1, 10, 0, tzinfo=dt.timezone.utc)

# A gap between two readings longer than this is missing data, not wet (or dry) time.
MAX_READING_DURATION = dt.timedelta(minutes=30)


@dataclass(frozen=True)
class BlightRuleSettings:
    window_length: dt.timedelta
    min_wet_hours: float
    lookback_windows: int
    yellow_at_blight_nights: int
    red_at_blight_nights: int


FIELD_SETTINGS = BlightRuleSettings(
    window_length=dt.timedelta(days=1),
    min_wet_hours=6.0,
    lookback_windows=7,
    yellow_at_blight_nights=2,
    red_at_blight_nights=4,
)

# Live demo: a "night" lasts 10 minutes and 3 wet minutes make a blight night.
DEMO_SETTINGS = BlightRuleSettings(
    window_length=dt.timedelta(minutes=10),
    min_wet_hours=3 / 60,
    lookback_windows=7,
    yellow_at_blight_nights=1,
    red_at_blight_nights=2,
)


@dataclass(frozen=True)
class NightSummary:
    window_start: dt.datetime
    wet_hours: float
    mean_temp_while_wet_c: float | None
    is_blight_night: bool


@dataclass(frozen=True)
class BlightRuleResult:
    blight_nights: int
    lookback_windows: int
    color: str
    nights: list[NightSummary]

    def as_features(self) -> dict:
        """Compact, JSON-friendly form for the scorer's feature dict and the LLM prompt."""
        return {
            "blight_nights": self.blight_nights,
            "lookback_windows": self.lookback_windows,
            "rule_color": self.color,
            "nights": [
                {
                    "window_start": night.window_start.isoformat(),
                    "wet_hours": round(night.wet_hours, 2),
                    "mean_temp_while_wet_c": (
                        round(night.mean_temp_while_wet_c, 1)
                        if night.mean_temp_while_wet_c is not None
                        else None
                    ),
                    "is_blight_night": night.is_blight_night,
                }
                for night in self.nights
            ],
        }


def evaluate_blight_rule(
    readings: list[dict], now: dt.datetime, settings: BlightRuleSettings = FIELD_SETTINGS
) -> BlightRuleResult:
    """Count blight nights over the lookback windows and pick the rule's traffic-light colour."""
    timed_readings = pair_readings_with_durations(readings)
    nights = [
        summarise_night(readings_in_window(timed_readings, start, start + settings.window_length), start, settings)
        for start in list_lookback_window_starts(now, settings)
    ]
    blight_nights = sum(night.is_blight_night for night in nights)
    return BlightRuleResult(
        blight_nights=blight_nights,
        lookback_windows=settings.lookback_windows,
        color=choose_rule_color(blight_nights, settings),
        nights=nights,
    )


def oldest_window_start(now: dt.datetime, settings: BlightRuleSettings) -> dt.datetime:
    """Start of the oldest window the rule looks at: the earliest reading it needs."""
    return list_lookback_window_starts(now, settings)[-1]


def list_lookback_window_starts(now: dt.datetime, settings: BlightRuleSettings) -> list[dt.datetime]:
    """The current window's start and the previous ones, newest first."""
    current = find_window_start(now, settings.window_length)
    return [current - i * settings.window_length for i in range(settings.lookback_windows)]


def find_window_start(moment: dt.datetime, window_length: dt.timedelta) -> dt.datetime:
    windows_elapsed = (moment - WINDOW_ANCHOR) // window_length
    return WINDOW_ANCHOR + windows_elapsed * window_length


def pair_readings_with_durations(readings: list[dict]) -> list[tuple[dict, float]]:
    """Sort readings oldest-first and pair each with the hours it stands for.

    A reading lasts until the next one (capped at MAX_READING_DURATION). The newest
    reading gets the typical gap, since the next one has not arrived yet.
    """
    ordered = sorted(readings, key=lambda r: r["deviceTimestamp"])
    gaps = [
        min(newer["deviceTimestamp"] - older["deviceTimestamp"], MAX_READING_DURATION)
        for older, newer in zip(ordered, ordered[1:])
    ]
    newest_gap = statistics.median(gaps) if gaps else dt.timedelta(0)
    durations = [gap.total_seconds() / 3600.0 for gap in gaps + [newest_gap]] if ordered else []
    return list(zip(ordered, durations))


def readings_in_window(
    timed_readings: list[tuple[dict, float]], start: dt.datetime, end: dt.datetime
) -> list[tuple[dict, float]]:
    return [(r, hours) for r, hours in timed_readings if start <= r["deviceTimestamp"] < end]


def summarise_night(
    timed_readings: list[tuple[dict, float]], window_start: dt.datetime, settings: BlightRuleSettings
) -> NightSummary:
    wet = [(r, hours) for r, hours in timed_readings if is_leaf_wet(r)]
    wet_hours = sum(hours for _, hours in wet)
    mean_temp = mean_temperature_weighted_by_duration(wet)
    return NightSummary(
        window_start=window_start,
        wet_hours=wet_hours,
        mean_temp_while_wet_c=mean_temp,
        is_blight_night=is_blight_night(wet_hours, mean_temp, settings),
    )


def is_leaf_wet(reading: dict) -> bool:
    return bool(reading.get("rain"))


def pick_air_temperature(reading: dict) -> float | None:
    """DHT11 temperature, or None when the read failed (the box sends a failed read as 0 °C / 0 %)."""
    temp = reading.get("temperature_c")
    if temp is None:
        return None
    if temp == 0 and reading.get("humidity_pct") == 0:
        return None
    return temp


def mean_temperature_weighted_by_duration(timed_readings: list[tuple[dict, float]]) -> float | None:
    weighted = [(pick_air_temperature(r), hours) for r, hours in timed_readings]
    weighted = [(temp, hours) for temp, hours in weighted if temp is not None and hours > 0]
    total_hours = sum(hours for _, hours in weighted)
    if total_hours == 0:
        return None
    return sum(temp * hours for temp, hours in weighted) / total_hours


def is_blight_night(wet_hours: float, mean_temp_while_wet_c: float | None, settings: BlightRuleSettings) -> bool:
    if mean_temp_while_wet_c is None:
        return False
    is_wet_long_enough = wet_hours >= settings.min_wet_hours
    is_temp_favourable = BLIGHT_TEMP_MIN_C <= mean_temp_while_wet_c <= BLIGHT_TEMP_MAX_C
    return is_wet_long_enough and is_temp_favourable


def choose_rule_color(blight_nights: int, settings: BlightRuleSettings) -> str:
    if blight_nights >= settings.red_at_blight_nights:
        return "red"
    if blight_nights >= settings.yellow_at_blight_nights:
        return "yellow"
    return "green"
