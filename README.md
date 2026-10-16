---
type: build
status: current
project: grow
problem: 1
date: 2026-10-16
---

# grow-sensor-node

Field sensor node for maize leaf blight early warning (BCG Platinion × Welthungerhilfe hackathon, "Grow" case, problem 1).

An **Arduino UNO R4 WiFi** reads leaf wetness, temperature, humidity and soil moisture and sends one JSON line over USB. A **Raspberry Pi** stores the readings, counts "blight nights" (≥ 6 h leaf wetness at 18–27 °C) and sets a 🟢/🟡/🔴 traffic light.

Step-by-step build instructions: `Sensor Node Build Guide` in the vault (`04 Build/`).

## Folders

| Folder | What's in it |
|---|---|
| `arduino/00_blink` … `05_soil_moisture` | One small test sketch per build step. Upload them in order. |
| `arduino/sensor_node` | The full sketch: all sensors, JSON output, traffic light |
| `pi/` | `blight_node.py`: reads the Arduino over USB, logs to SQLite, scores risk |
| `scripts/` | `upload.sh` (compile + upload a sketch), `monitor.sh` (see the Arduino's output) |

## Requirements (Mac)

- `brew install arduino-cli`
- `arduino-cli core install arduino:renesas_uno`
- `arduino-cli lib install "DHT sensor library" "Adafruit BMP085 Library" "Adafruit Unified Sensor"`
- Apple Silicon Macs: Rosetta (`sudo softwareupdate --install-rosetta --agree-to-license`), because the R4 compiler is an Intel program

## Use it from VS Code

- **Upload:** `Cmd+Shift+B` → pick a sketch.
- **See output:** `Cmd+Shift+P` → "Tasks: Run Task" → **Open serial monitor**. Stop it with `Ctrl+C` before the next upload.

Or in a terminal: `./scripts/upload.sh 02_dht11`, then `./scripts/monitor.sh`.

## Progress

- [x] Step 0: toolchain works, `00_blink` runs on the board
- [x] Step 1: traffic light from 3 LEDs + 1 kΩ resistors (pins 9, 10, 11)
- [ ] Step 2: DHT11 temperature + humidity
- [ ] Step 3: rain plate as leaf wetness sensor + calibration
- [ ] Step 4: BMP180 temperature (if available)
- [ ] Step 5: soil moisture
- [ ] Step 6: full `sensor_node` sketch, JSON lines
- [ ] Step 7: Raspberry Pi receives data
