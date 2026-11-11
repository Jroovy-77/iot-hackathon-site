// ตัวตรวจขาปุ่ม (เครื่องมือทดสอบ ไม่ใช่โปรแกรมหลัก) — พิมพ์ระดับไฟของขาปุ่มแดง (GPIO0) และปุ่มเขียว (GPIO2)
// ตั้งค่าขาเหมือนโปรแกรมกล่องบ้านทุกอย่าง (house/main.cpp): แดง = INPUT_PULLUP · เขียว = INPUT (มี R2 ดึงขึ้นภายนอก)
// อ่านค่า: H = สูง (ไม่กด) · L = ต่ำ (กด/ถูกดึงลง) · พิมพ์เมื่อค่าเปลี่ยน และทุก 2 วินาที
#include <Arduino.h>

#include "pins.h"

void setup() {
  Serial.begin(115200);
  const uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 3000) delay(10);
  pinMode(pins::PROBE_DRIVE, INPUT);        // ปล่อยลอย เหมือนกล่องบ้าน
  pinMode(pins::BTN_RED, INPUT_PULLUP);
  pinMode(pins::BTN_GREEN, INPUT);
  Serial.printf("\n# FloodLink PINTEST red=GPIO%d green=GPIO%d (H=high/not pressed, L=low/pressed)\n", pins::BTN_RED,
                pins::BTN_GREEN);
}

// สลับโหมดทุก 8 วินาที: plain = ตั้งขาแบบธรรมดา · adc = เรียก analogSetPinAttenuation ที่ขาปุ่มแดงเหมือน house/main.cpp setup()
void loop() {
  static int lastR = -1, lastG = -1;
  static uint32_t lastPrint = 0;
  static bool adc = false;
  static uint32_t modeAt = 8000;
  if (millis() >= modeAt) {
    modeAt += 8000;
    adc = !adc;
    if (adc) analogSetPinAttenuation(pins::BTN_RED, ADC_11db);
    else pinMode(pins::BTN_RED, INPUT_PULLUP);
    lastR = -1;
    Serial.printf("# MODE %s\n", adc ? "adc" : "plain");
  }
  const int r = digitalRead(pins::BTN_RED);
  const int g = digitalRead(pins::BTN_GREEN);
  if (r != lastR || g != lastG || millis() - lastPrint >= 2000) {
    lastR = r;
    lastG = g;
    lastPrint = millis();
    Serial.printf("PIN red=%c green=%c t=%.1fs\n", r ? 'H' : 'L', g ? 'H' : 'L', millis() / 1000.0f);
  }
  delay(5);
}
