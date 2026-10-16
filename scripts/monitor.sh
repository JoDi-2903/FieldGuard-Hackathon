#!/usr/bin/env bash
# Shows what the Arduino prints over USB (9600 baud). Stop with Ctrl+C.
# Close it before uploading: only one program can use the port at a time.
set -euo pipefail

cd "$(dirname "$0")/.."
port="$(./scripts/find_port.sh)"
arduino-cli monitor --port "$port" --config 9600
