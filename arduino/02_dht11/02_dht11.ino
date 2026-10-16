// Step 2: reads temperature and humidity from the DHT11 every 2 seconds.
// Wiring: DATA/S -> D2, + -> 5V, - -> GND.
#include <DHT.h>

const uint8_t PIN_DHT = 2;
const unsigned long READ_INTERVAL_MS = 2000;  // the DHT11 needs at least 1 s between reads

DHT dht(PIN_DHT, DHT11);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float tempC = dht.readTemperature();
  float humidity = dht.readHumidity();
  if (isnan(tempC) || isnan(humidity)) {
    Serial.println(F("DHT11 read failed: check the wiring"));
  } else {
    Serial.print(F("temp C: "));
    Serial.print(tempC);
    Serial.print(F("   humidity %: "));
    Serial.println(humidity);
  }
  delay(READ_INTERVAL_MS);
}
