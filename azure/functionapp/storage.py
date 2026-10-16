"""Table Storage helpers: clients, time<->RowKey conversion, data quality.

All telemetry/field/risk data lives in Azure Table Storage. We reach it with the
storage account connection string (the hackathon subscription cannot grant the
data-plane RBAC role a managed identity would need).

RowKey design: Table Storage sorts rows within a partition ascending by RowKey
(string comparison). We store an *inverted*, zero-padded tick count so the newest
row sorts first and a time window maps to a RowKey range.
"""

from __future__ import annotations

import datetime as dt
import functools
import os

from azure.data.tables import TableClient, TableServiceClient

# .NET DateTime.MaxValue.Ticks — the constant we invert against.
_MAX_TICKS = 3_155_378_975_999_999_999
_EPOCH = dt.datetime(1, 1, 1, tzinfo=dt.timezone.utc)

# Physical plausibility ranges for the four sensors. Values outside => "implausible".
PLAUSIBLE_RANGES = {
    "temperature_c": (-20.0, 60.0),
    "humidity_pct": (0.0, 100.0),
    "soil_pct": (0.0, 100.0),
}
# Fields that must be present for a reading to count as "ok".
REQUIRED_FIELDS = ("temperature_c", "humidity_pct", "soil_pct")


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_iso(value: str) -> dt.datetime:
    """Parse an ISO-8601 timestamp, assuming UTC when no timezone is given."""
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def _ticks(when: dt.datetime) -> int:
    return int((when - _EPOCH).total_seconds() * 10_000_000)


def inverted_rowkey(when: dt.datetime) -> str:
    """19-digit, zero-padded, inverted ticks so newer timestamps sort first."""
    return f"{_MAX_TICKS - _ticks(when):019d}"


def classify_quality(reading: dict) -> str:
    """Return 'missing', 'implausible', or 'ok' for a single reading."""
    if any(reading.get(f) is None for f in REQUIRED_FIELDS):
        return "missing"
    for field, (lo, hi) in PLAUSIBLE_RANGES.items():
        value = reading.get(field)
        if value is not None and not (lo <= value <= hi):
            return "implausible"
    return "ok"


@functools.lru_cache(maxsize=1)
def _service_client() -> TableServiceClient:
    conn = os.environ["TELEMETRY_CONNECTION_STRING"]
    return TableServiceClient.from_connection_string(conn)


@functools.lru_cache(maxsize=8)
def table(name_env: str, default: str) -> TableClient:
    """Return a cached TableClient for the table named by env var `name_env`."""
    table_name = os.environ.get(name_env, default)
    return _service_client().get_table_client(table_name)


def telemetry_table() -> TableClient:
    return table("TELEMETRY_TABLE_NAME", "telemetry")


def fields_table() -> TableClient:
    return table("FIELDS_TABLE_NAME", "fields")


def risk_table() -> TableClient:
    return table("RISK_TABLE_NAME", "riskscores")
