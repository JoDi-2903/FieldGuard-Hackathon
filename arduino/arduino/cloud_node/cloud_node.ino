// Field box that sends its readings straight to the Azure backend over WiFi.
// Every 5 s it measures all sensors and POSTs the unsent readings as one JSON array
// to /api/ingest (see "Arduino HTTP contract" in azure/README.md).
// Copy arduino_secrets.h.template to arduino_secrets.h and fill it in before uploading.

#include <WiFiS3.h>
#include <RTC.h>
#include <DHT.h>
#include <time.h>
#include "arduino_secrets.h"

// --- Backend ---------------------------------------------------------------
const char INGEST_HOST[] = "fieldguard-func-32vxg3.azurewebsites.net";
const char INGEST_PATH[] = "/api/ingest";
const uint16_t HTTPS_PORT = 443;
const char DEVICE_ID[] = "box-01";
const unsigned long HTTP_RESPONSE_TIMEOUT_MS = 15000UL;  // Consumption plan cold start can take seconds

// --- Which sensors are wired up. A sensor set to false is sent as 0. --------
const bool TEMP_HUMIDITY_SENSOR_CONNECTED = true;
const bool RAIN_SENSOR_CONNECTED = true;
const bool SOIL_SENSOR_CONNECTED = true;

// --- Pins (same wiring as sensor_node) ---------------------------------------
const uint8_t PIN_DHT = 2;
const uint8_t PIN_RAIN_POWER = 7;
const uint8_t PIN_SOIL_POWER = 8;
const uint8_t PIN_RAIN_ANALOG = A0;
const uint8_t PIN_SOIL_ANALOG = A1;

// --- Calibration (see arduino/README.md, steps 3 and 5) ----------------------
const int RAIN_WET_THRESHOLD_RAW = 900;  // below this the leaf plate is wet
const int SOIL_RAW_DRY = 985;            // 0 % soil moisture
const int SOIL_RAW_WET = 670;            // 100 % soil moisture

// --- Timing -------------------------------------------------------------------
const unsigned long SAMPLE_INTERVAL_MS = 5000UL;
const unsigned long RTC_RESYNC_INTERVAL_MS = 3600000UL;  // the R4 RTC drifts, so resync hourly
const unsigned long WIFI_CONNECT_WAIT_MS = 10000UL;
const uint8_t TIME_SYNC_ATTEMPTS = 10;
const unsigned long MIN_VALID_EPOCH = 1767225600UL;  // 2026-01-01; anything earlier is not real NTP time
const unsigned int SENSOR_WARMUP_MS = 200;
const uint8_t SAMPLES_PER_READING = 5;
const unsigned int DHT_STARTUP_MS = 2000;  // DHT11 needs ~1-2 s after power-up

// --- Offline backlog: unsent readings, oldest dropped when full --------------
const uint8_t MAX_BACKLOG = 36;  // 3 minutes at one reading every 5 s

struct ContractReading {
  time_t timestamp;
  float temperatureC;
  float humidityPct;
  int rain;
  float soilPct;
};

// Counts the bytes printed to it, so the JSON body length is known before sending.
class ByteCounter : public Print {
public:
  size_t count = 0;
  size_t write(uint8_t) override {
    count++;
    return 1;
  }
};

DHT dht(PIN_DHT, DHT11);
WiFiSSLClient client;
ContractReading backlog[MAX_BACKLOG];
uint8_t backlogStart = 0;
uint8_t backlogCount = 0;
unsigned long lastSampleMs = 0;
unsigned long lastRtcSyncMs = 0;

void setup() {
  Serial.begin(9600);
  configureSensorPins();
  startDhtAndDiscardFirstReading();
  checkWifiModuleAndFirmware();
  connectToWifiAndWait();
  syncRtcFromNetworkTimeAndWait();
  lastSampleMs = millis() - SAMPLE_INTERVAL_MS;  // take the first reading immediately
}

void loop() {
  if (!isTimeToSample()) {
    return;
  }
  lastSampleMs = millis();
  appendToBacklog(readAllSensorsAsContractReading());
  if (!ensureWifiConnected()) {
    Serial.print(F("WiFi down, readings waiting: "));
    Serial.println(backlogCount);
    return;
  }
  resyncRtcIfDue();
  if (postBacklogToIngest()) {
    clearBacklog();
  }
}

// --------------------------------------------------------------------------- //
// Setup
// --------------------------------------------------------------------------- //
void configureSensorPins() {
  pinMode(PIN_RAIN_POWER, OUTPUT);
  pinMode(PIN_SOIL_POWER, OUTPUT);
  digitalWrite(PIN_RAIN_POWER, LOW);
  digitalWrite(PIN_SOIL_POWER, LOW);
}

// The first DHT11 read after power-up returns garbage (seen: 0.9 °C, 0 %), so it is thrown away.
void startDhtAndDiscardFirstReading() {
  dht.begin();
  delay(DHT_STARTUP_MS);
  dht.readTemperature();
  dht.readHumidity();
}

void checkWifiModuleAndFirmware() {
  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println(F("ERROR: WiFi module not found. Stopping."));
    while (true) {}
  }
  if (String(WiFi.firmwareVersion()) < WIFI_FIRMWARE_LATEST_VERSION) {
    Serial.print(F("WARNING: WiFi firmware "));
    Serial.print(WiFi.firmwareVersion());
    Serial.print(F(" is older than "));
    Serial.println(F(WIFI_FIRMWARE_LATEST_VERSION));
  }
}

void connectToWifiAndWait() {
  while (!tryToConnectToWifi()) {
    Serial.println(F("WiFi connect failed, retrying."));
  }
}

// Readings need a real UTC time, so the box does not start measuring until it has one.
void syncRtcFromNetworkTimeAndWait() {
  RTC.begin();
  while (!trySyncRtcFromNetworkTime()) {
    Serial.println(F("Network time not available yet, retrying."));
    delay(1000);
  }
}

// --------------------------------------------------------------------------- //
// WiFi and time
// --------------------------------------------------------------------------- //
bool tryToConnectToWifi() {
  Serial.print(F("Connecting to WiFi "));
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startMs < WIFI_CONNECT_WAIT_MS) {
    delay(250);
  }
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  Serial.print(F("WiFi connected, IP "));
  Serial.println(WiFi.localIP());
  return true;
}

bool ensureWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }
  WiFi.disconnect();
  return tryToConnectToWifi();
}

bool trySyncRtcFromNetworkTime() {
  for (uint8_t attempt = 0; attempt < TIME_SYNC_ATTEMPTS; attempt++) {
    unsigned long epoch = WiFi.getTime();  // 0 until the WiFi module has fetched NTP time
    if (epoch >= MIN_VALID_EPOCH) {
      RTCTime now((time_t)epoch);
      RTC.setTime(now);
      lastRtcSyncMs = millis();
      Serial.print(F("RTC set to "));
      printIsoTimestamp(Serial, (time_t)epoch);
      Serial.println();
      return true;
    }
    delay(1000);
  }
  return false;
}

void resyncRtcIfDue() {
  if (millis() - lastRtcSyncMs >= RTC_RESYNC_INTERVAL_MS) {
    trySyncRtcFromNetworkTime();
  }
}

time_t readRtcUnixTime() {
  RTCTime now;
  RTC.getTime(now);
  return now.getUnixTime();
}

// --------------------------------------------------------------------------- //
// Sensors
// --------------------------------------------------------------------------- //
bool isTimeToSample() {
  return millis() - lastSampleMs >= SAMPLE_INTERVAL_MS;
}

ContractReading readAllSensorsAsContractReading() {
  ContractReading reading;
  reading.timestamp = readRtcUnixTime();
  reading.temperatureC = readTemperatureCOrZero();
  reading.humidityPct = readHumidityPctOrZero();
  reading.rain = readRainAsWetFlagOrZero();
  reading.soilPct = readSoilPctOrZero();
  return reading;
}

float readTemperatureCOrZero() {
  if (!TEMP_HUMIDITY_SENSOR_CONNECTED) {
    return 0;
  }
  return zeroIfNanAndWarn(dht.readTemperature(), "temperature");
}

float readHumidityPctOrZero() {
  if (!TEMP_HUMIDITY_SENSOR_CONNECTED) {
    return 0;
  }
  return zeroIfNanAndWarn(dht.readHumidity(), "humidity");
}

int readRainAsWetFlagOrZero() {
  if (!RAIN_SENSOR_CONNECTED) {
    return 0;
  }
  int raw = powerProbeAndReadAverage(PIN_RAIN_POWER, PIN_RAIN_ANALOG);
  return raw < RAIN_WET_THRESHOLD_RAW ? 1 : 0;
}

float readSoilPctOrZero() {
  if (!SOIL_SENSOR_CONNECTED) {
    return 0;
  }
  int raw = powerProbeAndReadAverage(PIN_SOIL_POWER, PIN_SOIL_ANALOG);
  return convertSoilRawToPct(raw);
}

// A failed DHT read gives NaN; the contract only allows numbers, so it is sent as 0.
float zeroIfNanAndWarn(float value, const char *sensorName) {
  if (!isnan(value)) {
    return value;
  }
  Serial.print(F("WARNING: "));
  Serial.print(sensorName);
  Serial.println(F(" read failed, sending 0"));
  return 0;
}

// Linear between the calibrated dry and wet raw values, clamped to 0-100 %.
float convertSoilRawToPct(int raw) {
  float pct = 100.0f * (SOIL_RAW_DRY - raw) / (SOIL_RAW_DRY - SOIL_RAW_WET);
  return constrain(pct, 0.0f, 100.0f);
}

// Powers the probe only while sampling: these resistive probes corrode fast if left powered.
int powerProbeAndReadAverage(uint8_t powerPin, uint8_t analogPin) {
  digitalWrite(powerPin, HIGH);
  delay(SENSOR_WARMUP_MS);
  long total = 0;
  for (uint8_t i = 0; i < SAMPLES_PER_READING; i++) {
    total += analogRead(analogPin);
    delay(10);
  }
  digitalWrite(powerPin, LOW);
  return total / SAMPLES_PER_READING;
}

// --------------------------------------------------------------------------- //
// Backlog
// --------------------------------------------------------------------------- //
void appendToBacklog(const ContractReading &reading) {
  if (backlogCount == MAX_BACKLOG) {
    backlogStart = (backlogStart + 1) % MAX_BACKLOG;  // drop the oldest
    backlogCount--;
    Serial.println(F("WARNING: backlog full, oldest reading dropped"));
  }
  backlog[(backlogStart + backlogCount) % MAX_BACKLOG] = reading;
  backlogCount++;
}

const ContractReading &backlogAt(uint8_t index) {
  return backlog[(backlogStart + index) % MAX_BACKLOG];
}

void clearBacklog() {
  backlogStart = 0;
  backlogCount = 0;
}

// --------------------------------------------------------------------------- //
// HTTP
// --------------------------------------------------------------------------- //
// Returns true only when the backend answered 200, so unsent readings stay in the backlog.
bool postBacklogToIngest() {
  if (!client.connect(INGEST_HOST, HTTPS_PORT)) {
    Serial.println(F("HTTPS connect to ingest failed"));
    return false;
  }
  sendIngestRequest();
  int status = readStatusCodeAndLogResponse();
  client.stop();
  return status == 200;
}

void sendIngestRequest() {
  ByteCounter counter;
  printBacklogAsJson(counter);

  client.print(F("POST "));
  client.print(INGEST_PATH);
  client.println(F(" HTTP/1.1"));
  client.print(F("Host: "));
  client.println(INGEST_HOST);
  client.println(F("Content-Type: application/json"));
  client.print(F("X-Ingest-Key: "));
  client.println(INGEST_KEY);
  client.print(F("Content-Length: "));
  client.println(counter.count);
  client.println(F("Connection: close"));
  client.println();
  printBacklogAsJson(client);

  Serial.print(F("POST "));
  printBacklogAsJson(Serial);
  Serial.println();
}

int readStatusCodeAndLogResponse() {
  client.setTimeout(HTTP_RESPONSE_TIMEOUT_MS);
  String statusLine = client.readStringUntil('\n');  // e.g. "HTTP/1.1 200 OK"
  int status = statusLine.length() > 12 ? statusLine.substring(9, 12).toInt() : 0;
  skipResponseHeaders();
  String body = extractJsonFromChunkedBody(readResponseBody());
  Serial.print(F("HTTP "));
  Serial.print(status);
  Serial.print(' ');
  Serial.println(body);
  return status;
}

void skipResponseHeaders() {
  while (client.connected() || client.available()) {
    String line = client.readStringUntil('\n');
    if (line == "\r" || line.length() == 0) {
      return;
    }
  }
}

// Reads until the server closes the connection (Connection: close) or the timeout hits.
String readResponseBody() {
  String body;
  unsigned long startMs = millis();
  while ((client.connected() || client.available()) && millis() - startMs < HTTP_RESPONSE_TIMEOUT_MS) {
    while (client.available()) {
      body += (char)client.read();
    }
  }
  return body;
}

// Azure answers with chunked encoding ("e\r\n{...}\r\n0"); keep only the JSON for the log.
String extractJsonFromChunkedBody(const String &body) {
  int start = body.indexOf('{');
  int end = body.lastIndexOf('}');
  if (start < 0 || end < start) {
    String trimmed = body;
    trimmed.trim();
    return trimmed;
  }
  return body.substring(start, end + 1);
}

// --------------------------------------------------------------------------- //
// JSON
// --------------------------------------------------------------------------- //
void printBacklogAsJson(Print &out) {
  out.print('[');
  for (uint8_t i = 0; i < backlogCount; i++) {
    if (i > 0) {
      out.print(',');
    }
    printReadingAsJson(out, backlogAt(i));
  }
  out.print(']');
}

void printReadingAsJson(Print &out, const ContractReading &reading) {
  out.print(F("{\"deviceId\":\""));
  out.print(DEVICE_ID);
  out.print(F("\",\"timestamp\":\""));
  printIsoTimestamp(out, reading.timestamp);
  out.print(F("\",\"temperature_c\":"));
  out.print(reading.temperatureC, 1);
  out.print(F(",\"humidity_pct\":"));
  out.print(reading.humidityPct, 1);
  out.print(F(",\"rain\":"));
  out.print(reading.rain);
  out.print(F(",\"soil_pct\":"));
  out.print(reading.soilPct, 1);
  out.print('}');
}

// ISO-8601 in UTC with a Z suffix, e.g. 2026-10-16T12:00:00Z.
void printIsoTimestamp(Print &out, time_t timestamp) {
  struct tm utc;
  gmtime_r(&timestamp, &utc);
  char text[21];
  strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%SZ", &utc);
  out.print(text);
}
