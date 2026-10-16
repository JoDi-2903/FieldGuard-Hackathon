// Step 1: cycles the traffic light module green -> yellow -> red.
// Wiring: R -> D9, Y -> D10, G -> D11, GND -> GND.

const uint8_t PIN_LED_RED = 9;
const uint8_t PIN_LED_YELLOW = 10;
const uint8_t PIN_LED_GREEN = 11;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
}

void loop() {
  showOnly(PIN_LED_GREEN, "green");
  showOnly(PIN_LED_YELLOW, "yellow");
  showOnly(PIN_LED_RED, "red");
}

void showOnly(uint8_t ledPin, const char *name) {
  digitalWrite(PIN_LED_RED, ledPin == PIN_LED_RED);
  digitalWrite(PIN_LED_YELLOW, ledPin == PIN_LED_YELLOW);
  digitalWrite(PIN_LED_GREEN, ledPin == PIN_LED_GREEN);
  Serial.println(name);
  delay(1000);
}
