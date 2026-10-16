"""Seed the `fields` table with demo fields for the FieldGuard dashboard.

Run locally after `terraform apply`. Uses the storage connection string (the
hackathon subscription cannot grant the data-plane RBAC role).

Usage:
    export TELEMETRY_CONNECTION_STRING="$(terraform output -raw telemetry_connection_string)"
    python seed_fields.py

Each field maps to a sensor `deviceId`. For the hackathon demo, point two example
fields at the real sensor box and leave one without a device to show the
"no data / stale" caveat path.
"""

from __future__ import annotations

import os
import sys

from azure.data.tables import TableServiceClient

DEMO_FIELDS = [
    {
        "RowKey": "field-a",
        "name": "Field A - North plot",
        "crop": "potato",
        "plantingDate": "2026-09-15",
        "deviceId": "box-01",
        "knownCases": "none reported",
    },
    {
        "RowKey": "field-b",
        "name": "Field B - River plot",
        "crop": "potato",
        "plantingDate": "2026-09-20",
        "deviceId": "box-02",
        "knownCases": "late blight confirmed on neighbouring farm",
    },
    {
        "RowKey": "field-c",
        "name": "Field C - Hill plot (no sensor yet)",
        "crop": "tomato",
        "plantingDate": "2026-09-10",
        "deviceId": "",
        "knownCases": "none reported",
    },
]


def main() -> int:
    conn = os.environ.get("TELEMETRY_CONNECTION_STRING")
    if not conn:
        print("Set TELEMETRY_CONNECTION_STRING (see `terraform output -raw telemetry_connection_string`).")
        return 1

    service = TableServiceClient.from_connection_string(conn)
    table = service.get_table_client(os.environ.get("FIELDS_TABLE_NAME", "fields"))

    for field in DEMO_FIELDS:
        table.upsert_entity({"PartitionKey": "field", **field})
        print(f"seeded {field['RowKey']} -> {field['name']}")

    print(f"\nDone. Seeded {len(DEMO_FIELDS)} fields into '{table.table_name}'.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
