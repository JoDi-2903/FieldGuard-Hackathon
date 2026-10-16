---
type: build
status: current
project: grow
problem: 1
date: 2026-10-16
---

# grow-sensor-node

Field sensor node for maize leaf blight early warning (BCG Platinion × Welthungerhilfe hackathon, "Grow" case, problem 1).

An **Arduino UNO R4 WiFi** reads leaf wetness, temperature, humidity and soil moisture and posts them straight to the Azure backend over WiFi (`cloud_node`). Azure counts "blight nights" (≥ 6 h leaf wetness at 18–27 °C) and the box shows the result on a 🟢/🟡/🔴 LED traffic light. The Raspberry Pi gateway (`pi/`) is no longer needed; it is kept for an offline setup.

Step-by-step build instructions: `Sensor Node Build Guide` in the vault (`04 Build/`).

## Folders

| Folder | What's in it |
|---|---|
| `arduino/00_blink` … `05_soil_moisture` | One small test sketch per build step. Upload them in order. |
| `arduino/calibrate_analog` | Prints the rain plate and soil fork once per second, for calibration |
| `arduino/sensor_node` | The full sketch: all sensors, JSON output, traffic light |
| `arduino/cloud_node` | Measures every 5 s, posts the readings to the Azure backend over WiFi, shows the risk colour on the LEDs |
| `pi/` | `blight_node.py`: reads the Arduino over USB, logs to SQLite, scores risk |
| `scripts/` | `upload.sh` (compile + upload a sketch), `monitor.sh` (see the Arduino's output), `test_ingest.sh` (one test POST to the backend) |

## Requirements (Mac)

- `brew install arduino-cli`
- `arduino-cli core install arduino:renesas_uno`
- `arduino-cli lib install "DHT sensor library" "Adafruit BMP085 Library" "Adafruit Unified Sensor"`
- Apple Silicon Macs: Rosetta (`sudo softwareupdate --install-rosetta --agree-to-license`), because the R4 compiler is an Intel program

## Use it from VS Code

- **Upload:** `Cmd+Shift+B` → pick a sketch.
- **See output:** `Cmd+Shift+P` → "Tasks: Run Task" → **Open serial monitor**. Stop it with `Ctrl+C` before the next upload.

Or in a terminal: `./scripts/upload.sh 02_dht11`, then `./scripts/monitor.sh`.

## Send to Azure over WiFi (`cloud_node`)

The board posts its readings itself to `POST /api/ingest` (contract: "Arduino HTTP contract" in `azure/README.md`). No Pi needed.

1. `cp arduino/cloud_node/arduino_secrets.h.template arduino/cloud_node/arduino_secrets.h` and fill in WiFi name, password and the ingest key (`INGEST_SHARED_SECRET` of the Function App). The file is gitignored.
2. Check the backend and key: `./scripts/test_ingest.sh` → `HTTP 200` with `{"written": 1}`, then the reading comes back from `/api/readings` (device `test-box`).
3. `./scripts/upload.sh cloud_node`, then `./scripts/monitor.sh`. Every 5 s you should see `POST [...]` and `HTTP 200 {"written": n}`.

How it works:

- Waits for WiFi and network time at start, then sets the built-in RTC (resynced hourly) for the UTC `timestamp`.
- Sends as `deviceId` `box-01`, mapped to the contract fields: DHT11 → `temperature_c`, `humidity_pct`; rain plate below 900 → `rain` = 1; soil fork raw 985 (dry) … 670 (wet) → `soil_pct` 0–100.
- A sensor that is not wired up yet: set its `..._SENSOR_CONNECTED` flag to `false` and it is sent as `0`. A failed DHT read is also sent as `0`, with a warning on the serial monitor.
- If WiFi or the backend is down, readings stay in a backlog (up to 36, about 3 min) and are sent together in one array once it works again.
- Every 30 s it asks `GET /api/light?deviceId=box-01` for its colour and lights red (D9), yellow (D10) or green (D11), same wiring as Step 1. No score yet: all off. Offline: keeps the last colour.
- For the field, set `SAMPLE_INTERVAL_MS` to `900000UL` (15 min). The backend computes wet hours from the timestamps, so no other change is needed.

## Progress

- [x] Step 0: toolchain works, `00_blink` runs on the board
- [x] Step 1: traffic light from 3 LEDs + 1 kΩ resistors (pins 9, 10, 11)
- [x] Step 2: DHT11 temperature + humidity on D2 (room 25.3 °C / 67%, breath test 98%)
- [x] Step 3: rain plate as leaf wetness sensor (dry 999–1002, fridge dew 340–490, threshold 900)
- [ ] Step 4: BMP180 temperature (if available)
- [x] Step 5: soil moisture (dry soil 970–1000, wet about 650–690)
- [x] Step 6: full `sensor_node` sketch sends JSON lines; the Pi/computer can set the light (BMP180 not connected yet)
- [x] Step 7: ~~Raspberry Pi receives data~~ replaced: `cloud_node` posts to Azure over WiFi (HTTP 200 every 5 s) and polls `/api/light` for the LEDs
- [ ] Step 8: `cloud_node` posts readings to Azure over WiFi every 5 s (compiles; not yet run on the board)
