// Calibration helper: reads the rain plate (A0) and the soil fork (A1) once per second.
// Wiring as in steps 3 and 5: rain VCC -> D7, AO -> A0; soil VCC -> D8, AO -> A1.

const uint8_t PIN_RAIN_POWER = 7;
const uint8_t PIN_SOIL_POWER = 8;
const uint8_t PIN_RAIN_ANALOG = A0;
const uint8_t PIN_SOIL_ANALOG = A1;
const unsigned int SENSOR_WARMUP_MS = 200;
const unsigned long READ_INTERVAL_MS = 1000;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_RAIN_POWER, OUTPUT);
  pinMode(PIN_SOIL_POWER, OUTPUT);
  digitalWrite(PIN_RAIN_POWER, LOW);
  digitalWrite(PIN_SOIL_POWER, LOW);
}

void loop() {
  int rainRaw = powerProbeAndRead(PIN_RAIN_POWER, PIN_RAIN_ANALOG);
  int soilRaw = powerProbeAndRead(PIN_SOIL_POWER, PIN_SOIL_ANALOG);
  Serial.print(F("rain_raw: "));
  Serial.print(rainRaw);
  Serial.print(F("   soil_raw: "));
  Serial.println(soilRaw);
  delay(READ_INTERVAL_MS);
}

// Powers the probe only while reading, so it corrodes much more slowly.
int powerProbeAndRead(uint8_t powerPin, uint8_t analogPin) {
  digitalWrite(powerPin, HIGH);
  delay(SENSOR_WARMUP_MS);
  int value = analogRead(analogPin);
  digitalWrite(powerPin, LOW);
  return value;
}
