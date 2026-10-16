// Step 0: proves the toolchain works. Blinks the on-board "L" LED and says hello over USB.

const unsigned long BLINK_INTERVAL_MS = 1000;

void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println(F("Hello from the UNO R4 WiFi: LED on"));
  delay(BLINK_INTERVAL_MS);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println(F("LED off"));
  delay(BLINK_INTERVAL_MS);
}
