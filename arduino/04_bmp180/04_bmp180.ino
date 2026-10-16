// Step 4: reads temperature and air pressure from the GY-68 BMP180 over I2C.
// Wiring: VIN -> 5V, GND -> GND, SDA -> A4, SCL -> A5.
#include <Adafruit_BMP085.h>

const unsigned long READ_INTERVAL_MS = 2000;

Adafruit_BMP085 bmp;

void setup() {
  Serial.begin(9600);
  if (!bmp.begin()) {
    Serial.println(F("BMP180 not found: check SDA/SCL and power"));
    while (true) {}
  }
}

void loop() {
  Serial.print(F("temp C: "));
  Serial.print(bmp.readTemperature());
  Serial.print(F("   pressure hPa: "));
  Serial.println(bmp.readPressure() / 100.0);
  delay(READ_INTERVAL_MS);
}
