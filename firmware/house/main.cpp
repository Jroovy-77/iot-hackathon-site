// กล่องบ้าน — รอบ Breadboard (ESP32-C3 Super Mini + SX1276)
// ตรรกะทั้งหมดอยู่ใน common/house_logic (เทสต์บนคอมแล้ว) ไฟล์นี้แค่อ่านขา/วิทยุ แล้วสั่งไฟ เสียง วิทยุ
// รอบนี้ไม่หลับลึก (เสียบ USB-C อยู่) · ต่อเสาก่อนเสียบไฟทุกครั้ง
//
// คำสั่งทาง Serial (ทดสอบตอนยังไม่ได้ต่อปุ่ม — ลำดับต่อข้อ 4 ของ wiring-breadboard.md):
//   r = ปุ่มแดงกดค้าง   g = ปุ่มเขียวกดสั้น   G = ปุ่มเขียวกดค้าง   s = สถานะ
#include <Adafruit_NeoPixel.h>
#include <Arduino.h>
#include <driver/gpio.h>
#include <esp_system.h>

#include "audio.h"
#include "button.h"
#include "house_logic.h"
#include "houses.h"
#include "pins.h"
#include "radio.h"
#include "radio_config.h"
#include "timing.h"

namespace {

const uint8_t BRIGHTNESS = 64;               // ≤ 25% ของ 255 (12 ดวงสว่างเต็ม ≈ 720 mA — wiring-breadboard ข้อ 6)
const uint32_t BATT_PERIOD_MS = 10000;
const uint16_t WATER_MIN_MV = 150, WATER_MAX_MV = 2000;   // data-contract 4.6: < 0.15 V = ปุ่ม · 0.15–2.0 V = น้ำ

uint32_t rnd(uint32_t lo, uint32_t hi) { return hi > lo ? lo + esp_random() % (hi - lo + 1) : lo; }

const HouseInfo* me = findHouse(HOUSE_ID);
HouseBox box(HOUSE_ID, me ? me->bed : false, rnd);
Button red, green;
Adafruit_NeoPixel ring(pins::LED_RING_COUNT, pins::LED_RING, NEO_GRB + NEO_KHZ800);
int16_t radioState = -1;
uint32_t battAt = 0, ringAt = 0, radioRetryAt = 0;
Rgb shown = {1, 1, 1};
uint8_t lastState = 255;

void logMsg(const char* dir, const proto::Msg& m, float rssi, float snr, bool withSignal) {
  Serial.printf("%s %s id=%u seq=%u", dir, proto::typeName(m.type), m.id, m.seq);
  switch (m.type) {
    case proto::WARN: Serial.printf(" wid=%u when=%u", m.wid, m.when); break;
    case proto::ACK: case proto::BOX_ACK: Serial.printf(" ack=%s/%u", proto::typeName(m.ack_type), m.ack_seq); break;
    case proto::ACCEPTED: case proto::DONE: Serial.printf(" req=%u", m.req_no); break;
    case proto::HEARD: Serial.printf(" wid=%u", m.wid); break;
    default:
      if (m.type == proto::SOS || m.type == proto::AUTO_SOS || m.type == proto::STATUS || m.type == proto::SAFE)
        Serial.printf(" try=%u wet=%d low=%d batt=%.2fV", proto::flagTry(m.flags), proto::flagProbeWet(m.flags),
                      proto::flagLowBatt(m.flags), proto::battFromByte(m.batt));
  }
  if (withSignal) Serial.printf(" rssi=%.0f snr=%.1f", rssi, snr);
  Serial.printf(" t=%lus\n", (unsigned long)(millis() / 1000));
}

// สายวัดน้ำ: ดึงสายดำลง 30 ms แล้วอ่านแรงดันที่ขาปุ่มแดง (มีตัวดึงขึ้นในชิป) — ต้องทดสอบกับของจริงใน B3
bool readProbe() {
  pinMode(pins::PROBE_DRIVE, OUTPUT);
  digitalWrite(pins::PROBE_DRIVE, LOW);
  analogSetPinAttenuation(pins::BTN_RED, ADC_11db);
  analogReadMilliVolts(pins::BTN_RED);                 // ผูกขาเข้ากับ ADC ก่อน
  gpio_pullup_en((gpio_num_t)pins::BTN_RED);           // ADC ปิดตัวดึงขึ้น → เปิดคืน
  delay(timing::PROBE_DRIVE_MS);
  const uint32_t mv = analogReadMilliVolts(pins::BTN_RED);
  pinMode(pins::PROBE_DRIVE, INPUT);                   // ปล่อยลอย: น้ำดึงขาปุ่มลงเองไม่ได้
  pinMode(pins::BTN_RED, INPUT_PULLUP);
  const bool wet = mv >= WATER_MIN_MV && mv <= WATER_MAX_MV;
  Serial.printf("PROBE %lumV %s t=%lus\n", (unsigned long)mv, wet ? "wet" : (mv < WATER_MIN_MV ? "button" : "dry"),
                (unsigned long)(millis() / 1000));
  return wet;
}

float readBattery() {
  const uint32_t mv = analogReadMilliVolts(pins::BATT_ADC);
  return mv * pins::BATT_DIVIDER / 1000.0f;
}

// ระหว่างกดค้างยังไม่ครบ 2 วิ: แหวนค่อย ๆ ติดทีละดวงตามเวลาที่กด (แดง = ขอช่วย · เขียว = ปลอดภัย) ครบ 12 ดวงตอนครบ 2 วิ + บี๊ปสั้น
// (ผู้ใช้ขอ 10 พ.ย. 2569 · ตอนมีคำเตือน (ส้ม) ปุ่มเขียวกดสั้นก็ใช้ได้เลย จึงไม่แสดงแถบกดค้าง)
void showRing(uint32_t now) {
  Rgb c = box.light(now);
  int lit = pins::LED_RING_COUNT;
  if (red.down() && red.heldMs(now) < timing::HOLD_MS) {
    c = Rgb{255, 0, 0};
    lit = 1 + (int)(red.heldMs(now) * pins::LED_RING_COUNT / timing::HOLD_MS);
  } else if (green.down() && box.state() != HouseBox::S_WARN && green.heldMs(now) < timing::HOLD_MS) {
    c = Rgb{0, 255, 0};
    lit = 1 + (int)(green.heldMs(now) * pins::LED_RING_COUNT / timing::HOLD_MS);
  }
  if (lit > pins::LED_RING_COUNT) lit = pins::LED_RING_COUNT;
  static int shownLit = -1;
  if (c.r == shown.r && c.g == shown.g && c.b == shown.b && lit == shownLit) return;
  shown = c;
  shownLit = lit;
  for (int i = 0; i < pins::LED_RING_COUNT; i++) ring.setPixelColor(i, i < lit ? ring.Color(c.r, c.g, c.b) : 0);
  ring.show();
}

void serialCommand(uint32_t now) {
  while (Serial.available()) {
    const int ch = Serial.read();
    if (ch == 'r') { Serial.println("CMD red long"); box.onRed(Button::LONG, now); }
    else if (ch == 'g') { Serial.println("CMD green short"); box.onGreen(Button::SHORT, now); }
    else if (ch == 'G') { Serial.println("CMD green long"); box.onGreen(Button::LONG, now); }
    else if (ch == 's') {
      Serial.printf("STATE %s retry=%d open=%d wet=%d low=%d wid=%u radio=%d pins_verified=%d\n",
                    HouseBox::stateName(box.state()), box.retrying(), box.openReq(), box.probeWet(), box.lowBatt(),
                    box.lastWid(), radioState, PINS_VERIFIED);
    }
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);   // ไม่ค้างตอนไม่ได้ต่อคอม (ใช้ถ่าน)
  const uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 1500) delay(10);

  pinMode(pins::BTN_RED, INPUT_PULLUP);
  pinMode(pins::BTN_GREEN, INPUT);       // R2 100 kΩ ดึงขึ้นภายนอก
  pinMode(pins::PROBE_DRIVE, INPUT);
  analogSetPinAttenuation(pins::BATT_ADC, ADC_11db);
  // BTN_RED เป็นขาปุ่มตลอด: ตั้ง ADC เฉพาะตอนอ่านสายวัดน้ำใน readProbe() (ถ้าตั้งที่นี่ ขาอ่านเป็น LOW ตลอด ปุ่มแดงใช้ไม่ได้ — พบ 8 พ.ย. 2569)

  ring.begin();
  ring.setBrightness(BRIGHTNESS);
  ring.clear();
  ring.show();
  audio::begin();

  Serial.printf("\nFloodLink house id=%u bed=%d freq=%.1fMHz sf=%u tx=%ddBm pins_verified=%d\n", HOUSE_ID,
                me ? me->bed : 0, radio_cfg::FREQ_MHZ, radio_cfg::SF, radio_cfg::TX_DBM, PINS_VERIFIED);
  if (!me) Serial.println("WARN: HOUSE_ID not in common/houses.h");
  radioState = radio::begin();
  Serial.printf("RADIO begin=%d %s\n", radioState, radioState == 0 ? "OK" : "FAIL (check SPI/NSS/3V3 wiring)");
  box.begin(millis());
}

void loop() {
  const uint32_t now = millis();
  serialCommand(now);

  if (radioState != 0 && (int32_t)(now - radioRetryAt) >= 0) {   // begin() ไม่ผ่าน: ลองใหม่ทุก 5 วิ พร้อมพิมพ์รหัส
    radioRetryAt = now + 5000;
    radioState = radio::begin();
    Serial.printf("RADIO begin=%d %s\n", radioState, radioState == 0 ? "OK" : "FAIL");
  }

  const Button::Event re = red.update(digitalRead(pins::BTN_RED) == LOW, now);
  const Button::Event ge = green.update(digitalRead(pins::BTN_GREEN) == LOW, now);
  if (re) Serial.printf("BTN red %s\n", re == Button::LONG ? "long" : re == Button::SHORT ? "short" : "stuck");
  if (ge) Serial.printf("BTN green %s\n", ge == Button::LONG ? "long" : ge == Button::SHORT ? "short" : "stuck");
  if (re == Button::LONG) audio::play(audio::V_HOLD);                                   // ครบ 2 วิ: บี๊ปสั้นบอกว่าแถบเต็มแล้ว
  if (ge == Button::LONG && box.state() != HouseBox::S_WARN) audio::play(audio::V_HOLD);
  if (ge == Button::SHORT && box.state() == HouseBox::S_WARN) audio::play(audio::V_HOLD);   // กดเขียวสั้นตอนเตือน: บี๊ปสั้นทันที (เสียง "ทีมรู้แล้ว" ยังรอ ACK) — ผู้ใช้เสนอ 10 พ.ย. 2569
  box.onRed(re, now);
  box.onGreen(ge, now);

  if (box.probeDue(now) && !red.down()) box.onProbe(readProbe(), now);
  if ((int32_t)(now - battAt) >= 0) {
    battAt = now + BATT_PERIOD_MS;
    box.onBattery(readBattery(), now);
  }

  if (radioState == 0) {
    proto::Msg m;
    float rssi = 0, snr = 0;
    int16_t code = 0;
    const radio::RxResult r = radio::receive(m, rssi, snr, code);
    if (r == radio::RX_OK) {
      logMsg("RX", m, rssi, snr, true);
      box.onRadio(m, now);
    } else if (r == radio::RX_BAD) {
      Serial.printf("RX bad code=%d rssi=%.0f snr=%.1f\n", code, rssi, snr);
    }
  }

  box.tick(now);

  proto::Msg out;
  while (radioState == 0 && box.popTx(out, now)) {
    const int16_t st = radio::send(out);
    logMsg(st == 0 ? "TX" : "TX-FAIL", out, 0, 0, false);
  }

  for (uint8_t v; (v = box.popVoice()) != V_NONE;) {
    Serial.printf("VOICE %s\n", voiceName(v));
    audio::play(v, box.when());
  }
  audio::loop(now);

  if (box.state() != lastState) {
    lastState = box.state();
    Serial.printf("STATE %s\n", HouseBox::stateName(lastState));
  }
  if ((int32_t)(now - ringAt) >= 0) {
    ringAt = now + 20;
    showRing(now);
  }
  delay(5);
}
