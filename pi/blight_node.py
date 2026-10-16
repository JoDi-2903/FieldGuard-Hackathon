"""Reads the field node over USB, logs readings to SQLite and drives the blight-risk traffic light."""
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

import serial

SERIAL_PORT = "/dev/ttyACM0"
BAUD_RATE = 9600
DB_PATH = "blight_node.db"

READ_INTERVAL_MINUTES = 1       # must match READ_INTERVAL_MS in the Arduino sketch
WET_THRESHOLD_RAW = 900         # rain_raw below this means the leaf is wet; calibrate (section 6)
BLIGHT_TEMP_MIN_C = 18
BLIGHT_TEMP_MAX_C = 27
LOOKBACK_WINDOWS = 7
YELLOW_AT_BLIGHT_NIGHTS = 2
RED_AT_BLIGHT_NIGHTS = 4

DEMO_MODE = False
if DEMO_MODE:
    WINDOW_LENGTH = timedelta(minutes=10)   # one "night" lasts 10 minutes
    BLIGHT_MIN_WET_HOURS = 3 / 60           # 3 wet minutes count as a blight night
else:
    WINDOW_LENGTH = timedelta(days=1)
    BLIGHT_MIN_WET_HOURS = 6
WINDOW_ANCHOR = datetime(2026, 1, 1, 12, 0)  # windows start at noon


@dataclass
class NightSummary:
    wet_hours: float
    mean_temp_while_wet_c: Optional[float]


def main():
    db = open_database_and_create_table(DB_PATH)
    port = open_serial_port(SERIAL_PORT)
    while True:
        reading = read_next_reading(port)
        if reading is None:
            continue
        store_reading(db, reading)
        blight_nights = count_blight_nights(db, reading["ts"])
        level = choose_risk_level(blight_nights)
        send_risk_level_to_arduino(port, level)
        print_status(reading, blight_nights, level)


def open_database_and_create_table(path):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute(
        """CREATE TABLE IF NOT EXISTS readings (
               ts TEXT PRIMARY KEY,
               rain_raw INTEGER, soil_raw INTEGER,
               dht_temp_c REAL, dht_humidity REAL,
               bmp_temp_c REAL, pressure_pa REAL)"""
    )
    return db


def open_serial_port(name):
    return serial.Serial(name, BAUD_RATE, timeout=5)


def read_next_reading(port):
    line = port.readline().decode("utf-8", errors="ignore").strip()
    if not line.startswith("{"):
        return None
    try:
        reading = json.loads(line)
    except json.JSONDecodeError:
        return None
    reading["ts"] = datetime.now()
    return reading


def store_reading(db, reading):
    db.execute(
        "INSERT OR REPLACE INTO readings VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            reading["ts"].isoformat(timespec="seconds"),
            reading["rain_raw"],
            reading["soil_raw"],
            reading["dht_temp_c"],
            reading["dht_humidity"],
            reading["bmp_temp_c"],
            reading["pressure_pa"],
        ),
    )
    db.commit()


def count_blight_nights(db, now):
    current_window_start = find_window_start(now)
    window_starts = [current_window_start - i * WINDOW_LENGTH for i in range(LOOKBACK_WINDOWS)]
    return sum(
        is_blight_night(summarise_night(load_readings_between(db, start, start + WINDOW_LENGTH)))
        for start in window_starts
    )


def find_window_start(moment):
    windows_elapsed = (moment - WINDOW_ANCHOR) // WINDOW_LENGTH
    return WINDOW_ANCHOR + windows_elapsed * WINDOW_LENGTH


def load_readings_between(db, start, end):
    rows = db.execute(
        "SELECT rain_raw, dht_temp_c, bmp_temp_c FROM readings WHERE ts >= ? AND ts < ?",
        (start.isoformat(timespec="seconds"), end.isoformat(timespec="seconds")),
    )
    return [dict(row) for row in rows]


def summarise_night(readings):
    wet_readings = [r for r in readings if is_leaf_wet(r)]
    wet_hours = len(wet_readings) * READ_INTERVAL_MINUTES / 60
    temps = [t for t in map(pick_air_temperature, wet_readings) if t is not None]
    mean_temp = sum(temps) / len(temps) if temps else None
    return NightSummary(wet_hours, mean_temp)


def is_leaf_wet(reading):
    return reading["rain_raw"] is not None and reading["rain_raw"] < WET_THRESHOLD_RAW


def pick_air_temperature(reading):
    # The BMP180 (about ±1 °C) is more accurate than the DHT11 (±2 °C), which is only the fallback.
    if reading["bmp_temp_c"] is not None:
        return reading["bmp_temp_c"]
    return reading["dht_temp_c"]


def is_blight_night(summary):
    if summary.mean_temp_while_wet_c is None:
        return False
    is_wet_long_enough = summary.wet_hours >= BLIGHT_MIN_WET_HOURS
    is_temp_favourable = BLIGHT_TEMP_MIN_C <= summary.mean_temp_while_wet_c <= BLIGHT_TEMP_MAX_C
    return is_wet_long_enough and is_temp_favourable


def choose_risk_level(blight_nights):
    if blight_nights >= RED_AT_BLIGHT_NIGHTS:
        return "R"
    if blight_nights >= YELLOW_AT_BLIGHT_NIGHTS:
        return "Y"
    return "G"


def send_risk_level_to_arduino(port, level):
    port.write(level.encode())


def print_status(reading, blight_nights, level):
    leaf_state = "WET" if is_leaf_wet(reading) else "dry"
    print(
        f"{reading['ts']:%Y-%m-%d %H:%M}  leaf={leaf_state} (raw {reading['rain_raw']})  "
        f"temp={pick_air_temperature(reading)}  blight nights={blight_nights}/{LOOKBACK_WINDOWS}  light={level}"
    )


if __name__ == "__main__":
    main()
