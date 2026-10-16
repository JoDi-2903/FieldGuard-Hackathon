#!/usr/bin/env bash
# Compiles one sketch from arduino/ and uploads it to the connected UNO R4 WiFi.
# Usage: ./scripts/upload.sh 01_traffic_light
set -euo pipefail

FQBN="arduino:renesas_uno:unor4wifi"
cd "$(dirname "$0")/.."

sketch="${1:?Usage: ./scripts/upload.sh <sketch folder in arduino/, e.g. 01_traffic_light>}"
port="$(./scripts/find_port.sh)"

arduino-cli compile --fqbn "$FQBN" "arduino/$sketch"
arduino-cli upload --fqbn "$FQBN" --port "$port" "arduino/$sketch"
echo "Uploaded $sketch. Open the serial monitor to see its output."
