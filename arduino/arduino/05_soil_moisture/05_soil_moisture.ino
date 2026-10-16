// Step 5: reads the soil moisture fork. 1023 = dry air, lower = wetter soil.
// Wiring: fork -> comparator board; comparator VCC -> D8, GND -> GND, AO -> A1.

const uint8_t PIN_SOIL_POWER = 8;
const uint8_t PIN_SOIL_ANALOG = A1;
const unsigned int SENSOR_WARMUP_MS = 200;
const unsigned long READ_INTERVAL_MS = 1000;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_SOIL_POWER, OUTPUT);
  digitalWrite(PIN_SOIL_POWER, LOW);
}

void loop() {
  int soilRaw = powerProbeAndRead();
  Serial.print(F("soil_raw: "));
  Serial.println(soilRaw);
  delay(READ_INTERVAL_MS);
}

// Powers the probe only while reading, so it corrodes much more slowly.
int powerProbeAndRead() {
  digitalWrite(PIN_SOIL_POWER, HIGH);
  delay(SENSOR_WARMUP_MS);
  int value = analogRead(PIN_SOIL_ANALOG);
  digitalWrite(PIN_SOIL_POWER, LOW);
  return value;
}
