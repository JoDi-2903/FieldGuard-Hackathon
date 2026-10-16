// Step 3: reads the rain plate, used as a leaf wetness sensor. 1023 = dry, lower = wetter.
// Wiring: plate -> comparator board; comparator VCC -> D7, GND -> GND, AO -> A0.

const uint8_t PIN_RAIN_POWER = 7;
const uint8_t PIN_RAIN_ANALOG = A0;
const unsigned int SENSOR_WARMUP_MS = 200;
const unsigned long READ_INTERVAL_MS = 1000;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_RAIN_POWER, OUTPUT);
  digitalWrite(PIN_RAIN_POWER, LOW);
}

void loop() {
  int rainRaw = powerPlateAndRead();
  Serial.print(F("rain_raw: "));
  Serial.println(rainRaw);
  delay(READ_INTERVAL_MS);
}

// Powers the plate only while reading, so it corrodes much more slowly.
int powerPlateAndRead() {
  digitalWrite(PIN_RAIN_POWER, HIGH);
  delay(SENSOR_WARMUP_MS);
  int value = analogRead(PIN_RAIN_ANALOG);
  digitalWrite(PIN_RAIN_POWER, LOW);
  return value;
}
