#include <DHT.h>
#include <Adafruit_BMP085.h>

const uint8_t PIN_DHT = 2;
const uint8_t PIN_RAIN_POWER = 7;
const uint8_t PIN_SOIL_POWER = 8;
const uint8_t PIN_LED_RED = 9;
const uint8_t PIN_LED_YELLOW = 10;
const uint8_t PIN_LED_GREEN = 11;
const uint8_t PIN_RAIN_ANALOG = A0;
const uint8_t PIN_SOIL_ANALOG = A1;

const unsigned long READ_INTERVAL_MS = 60000UL;  // 1 min for testing; use 600000UL (10 min) in the field
const unsigned int SENSOR_WARMUP_MS = 200;
const uint8_t SAMPLES_PER_READING = 5;

struct SensorReading {
  int rainRaw;
  int soilRaw;
  float dhtTempC;
  float dhtHumidity;
  float bmpTempC;
  float pressurePa;
};

DHT dht(PIN_DHT, DHT11);
Adafruit_BMP085 bmp;
bool hasBmp = false;
unsigned long lastReadMs = 0;

void setup() {
  Serial.begin(9600);
  configurePins();
  dht.begin();
  hasBmp = bmp.begin();
  showRiskLevel('G');
  lastReadMs = millis() - READ_INTERVAL_MS;  // take the first reading immediately
}

void loop() {
  showRiskLevelSentByPi();
  if (isTimeToRead()) {
    lastReadMs = millis();
    SensorReading reading = readAllSensors();
    printReadingAsJson(reading);
  }
}

void configurePins() {
  pinMode(PIN_RAIN_POWER, OUTPUT);
  pinMode(PIN_SOIL_POWER, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  digitalWrite(PIN_RAIN_POWER, LOW);
  digitalWrite(PIN_SOIL_POWER, LOW);
}

bool isTimeToRead() {
  return millis() - lastReadMs >= READ_INTERVAL_MS;
}

SensorReading readAllSensors() {
  SensorReading reading;
  reading.rainRaw = powerProbeAndReadAverage(PIN_RAIN_POWER, PIN_RAIN_ANALOG);
  reading.soilRaw = powerProbeAndReadAverage(PIN_SOIL_POWER, PIN_SOIL_ANALOG);
  reading.dhtTempC = dht.readTemperature();
  reading.dhtHumidity = dht.readHumidity();
  reading.bmpTempC = hasBmp ? bmp.readTemperature() : NAN;
  reading.pressurePa = hasBmp ? bmp.readPressure() : NAN;
  return reading;
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

void printReadingAsJson(const SensorReading &reading) {
  Serial.print(F("{\"rain_raw\":"));
  Serial.print(reading.rainRaw);
  Serial.print(F(",\"soil_raw\":"));
  Serial.print(reading.soilRaw);
  printJsonFloatField("dht_temp_c", reading.dhtTempC);
  printJsonFloatField("dht_humidity", reading.dhtHumidity);
  printJsonFloatField("bmp_temp_c", reading.bmpTempC);
  printJsonFloatField("pressure_pa", reading.pressurePa);
  Serial.println('}');
}

// A failed sensor read gives NaN, which is not valid JSON, so it is sent as null.
void printJsonFloatField(const char *key, float value) {
  Serial.print(F(",\""));
  Serial.print(key);
  Serial.print(F("\":"));
  if (isnan(value)) {
    Serial.print(F("null"));
  } else {
    Serial.print(value, 1);
  }
}

void showRiskLevelSentByPi() {
  while (Serial.available() > 0) {
    char level = Serial.read();
    if (level == 'R' || level == 'Y' || level == 'G') {
      showRiskLevel(level);
    }
  }
}

void showRiskLevel(char level) {
  digitalWrite(PIN_LED_RED, level == 'R');
  digitalWrite(PIN_LED_YELLOW, level == 'Y');
  digitalWrite(PIN_LED_GREEN, level == 'G');
}
