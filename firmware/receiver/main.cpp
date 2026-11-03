// ตัวรับ — รอบ Breadboard (ESP32-C3 Super Mini + SX1276) ต่อโน้ตบุ๊กด้วยสาย USB-C เส้นเดียว
// ทาง Serial ออก: JSON บรรทัดละก้อน (snap / hb / res) ตาม data-contract ข้อ 5 ให้แดชบอร์ดอ่านผ่าน Web Serial
//                บรรทัดที่ขึ้นต้นด้วย # = log วิทยุให้คนอ่าน (แดชบอร์ดทิ้งเอง) ใช้เป็นหลักฐานผลทดสอบได้
// ทาง Serial เข้า: คำสั่งจากแดชบอร์ด {"cmd":"hello"} {"cmd":"accept","rid":5,"id":1001} …
// ตรรกะทั้งหมดอยู่ใน common/gateway (เทสต์บนคอมแล้ว)
#include <Arduino.h>

#include "gateway.h"
#include "houses.h"
#include "pins.h"
#include "radio.h"
#include "radio_config.h"

namespace {

struct SerialSink : LineSink {
  void line(const std::string& s) override {
    Serial.write((const uint8_t*)s.data(), s.size());
    Serial.write('\n');
  }
};

SerialSink sink;
Gateway gw(HOUSES, HOUSE_COUNT, "GW-01", sink);
int16_t radioState = -1;
uint32_t radioRetryAt = 0;
std::string lineBuf;

void logMsg(const char* dir, const proto::Msg& m, float rssi, float snr, bool withSignal) {
  char b[160];
  int n = snprintf(b, sizeof b, "# %s %s id=%u seq=%u", dir, proto::typeName(m.type), m.id, m.seq);
  if (m.type == proto::ACK || m.type == proto::BOX_ACK)
    n += snprintf(b + n, sizeof b - n, " ack=%s/%u", proto::typeName(m.ack_type), m.ack_seq);
  if (m.type == proto::SOS || m.type == proto::AUTO_SOS || m.type == proto::STATUS || m.type == proto::SAFE)
    n += snprintf(b + n, sizeof b - n, " try=%u wet=%d low=%d batt=%.2fV", proto::flagTry(m.flags),
                  proto::flagProbeWet(m.flags), proto::flagLowBatt(m.flags), proto::battFromByte(m.batt));
  if (withSignal) n += snprintf(b + n, sizeof b - n, " rssi=%.0f snr=%.1f", rssi, snr);
  snprintf(b + n, sizeof b - n, " t=%lus", (unsigned long)(millis() / 1000));
  sink.line(b);
}

void readSerial(uint32_t now) {
  while (Serial.available()) {
    const char c = (char)Serial.read();
    if (c == '\n') {
      gw.onLine(lineBuf.c_str(), now);
      lineBuf.clear();
    } else if (c != '\r') {
      if (lineBuf.size() < 1024) lineBuf += c;
    }
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  const uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 1500) delay(10);
  char b[128];
  snprintf(b, sizeof b, "# FloodLink receiver freq=%.1fMHz sf=%u tx=%ddBm houses=%u pins_verified=%d",
           radio_cfg::FREQ_MHZ, radio_cfg::SF, radio_cfg::TX_DBM, (unsigned)HOUSE_COUNT, PINS_VERIFIED);
  sink.line(b);
  radioState = radio::begin();
  snprintf(b, sizeof b, "# RADIO begin=%d %s", radioState, radioState == 0 ? "OK" : "FAIL (check SPI/NSS/3V3 wiring)");
  sink.line(b);
  gw.begin(millis());
}

void loop() {
  const uint32_t now = millis();
  readSerial(now);

  if (radioState != 0 && (int32_t)(now - radioRetryAt) >= 0) {
    radioRetryAt = now + 5000;
    radioState = radio::begin();
    char b[48];
    snprintf(b, sizeof b, "# RADIO begin=%d %s", radioState, radioState == 0 ? "OK" : "FAIL");
    sink.line(b);
  }

  if (radioState == 0) {
    proto::Msg m;
    float rssi = 0, snr = 0;
    int16_t code = 0;
    const radio::RxResult r = radio::receive(m, rssi, snr, code);
    if (r == radio::RX_OK) {
      logMsg("RX", m, rssi, snr, true);
      gw.onRadio(m, rssi, snr, now);
    } else if (r == radio::RX_BAD) {
      char b[64];
      snprintf(b, sizeof b, "# RX bad code=%d rssi=%.0f snr=%.1f", code, rssi, snr);
      sink.line(b);
    }
  }

  gw.tick(now);

  proto::Msg out;
  while (radioState == 0 && gw.popTx(out)) {
    float air = 0;
    const int16_t st = radio::send(out, &air);
    gw.noteAirtime(air, now);
    logMsg(st == 0 ? "TX" : "TX-FAIL", out, 0, 0, false);
  }
  delay(2);
}
