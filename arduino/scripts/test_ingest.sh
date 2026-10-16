#!/usr/bin/env bash
# Sends one test reading to /api/ingest, exactly as cloud_node does, then reads it back.
# The key comes from $INGEST_KEY or, if unset, from arduino/cloud_node/arduino_secrets.h.
# Usage: ./scripts/test_ingest.sh
set -euo pipefail

BASE="https://fieldguard-func-32vxg3.azurewebsites.net/api"
DEVICE_ID="test-box"  # keeps test data away from the dashboard's box-01
SECRETS="$(dirname "$0")/../arduino/cloud_node/arduino_secrets.h"

if [[ -z "${INGEST_KEY:-}" && -f "$SECRETS" ]]; then
  INGEST_KEY="$(sed -n 's/^#define INGEST_KEY "\(.*\)"/\1/p' "$SECRETS")"
fi
INGEST_KEY="${INGEST_KEY:-}"
[[ -n "$INGEST_KEY" ]] || echo "No INGEST_KEY found: expecting 403 forbidden."

timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
body="[{\"deviceId\":\"$DEVICE_ID\",\"timestamp\":\"$timestamp\",\"temperature_c\":24.5,\"humidity_pct\":82.0,\"rain\":0,\"soil_pct\":41.2}]"

echo "POST $BASE/ingest"
echo "$body"
curl -sS -w "\nHTTP %{http_code}\n" -X POST "$BASE/ingest" \
  -H "Content-Type: application/json" \
  -H "X-Ingest-Key: $INGEST_KEY" \
  -d "$body"

echo
echo "GET $BASE/readings?deviceId=$DEVICE_ID&limit=1"
curl -sS -w "\nHTTP %{http_code}\n" "$BASE/readings?deviceId=$DEVICE_ID&limit=1"
