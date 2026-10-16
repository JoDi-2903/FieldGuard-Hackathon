#!/usr/bin/env bash
# Prints the USB port of the connected Arduino UNO R4 WiFi, or fails with a hint.
set -euo pipefail

port="$(arduino-cli board list | awk '/unor4wifi/ {print $1; exit}')"
if [[ -z "$port" ]]; then
  echo "No UNO R4 WiFi found. Is the USB cable plugged in?" >&2
  exit 1
fi
echo "$port"
