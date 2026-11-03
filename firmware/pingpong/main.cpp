// ทดสอบวิทยุ B2: บอร์ด A (env:ping) ส่ง PING #n · บอร์ด B (env:pong) ตอบ ACK #n (ข้อความ PONG)
// ใช้ขาและค่าวิทยุชุดเดียวกับกล่องบ้าน/ตัวรับ (common/pins.h, common/radio_config.h)
// เกณฑ์ผ่าน: 50 รอบติดกัน ได้ ACK ≥ 48 รอบ (≥ 96%) ที่ระยะ 1–3 เมตร
//
// ใช้งาน: ต่อเสาทั้งสองบอร์ดก่อน → เปิด Serial ของบอร์ด A → พิมพ์ g แล้ว Enter
// log เป็น CSV: บอร์ด A = PING,n,ok,rtt_ms,rssi,snr (ค่าของ ACK ที่ A ได้รับ) · บอร์ด B = PONG,n,rssi,snr (ค่าของ PING ที่ B ได้รับ)
// บรรทัดท้าย SUMMARY = จำนวนที่ได้ ACK, %, RSSI/SNR เฉลี่ย, PASS/FAIL
#include <Arduino.h>

#include "pins.h"
#include "radio.h"
#include "radio_config.h"

#ifndef PINGPONG_ROLE_PING
#define PINGPONG_ROLE_PING 1
#endif

namespace {
const uint16_t ROUNDS = 50;
const uint16_t PASS_MIN = 48;            // ≥ 96%
const uint32_t WAIT_ACK_MS = 2000;
const uint32_t GAP_MS = 1000;
int16_t radioState = -1;

proto::Msg make(uint8_t type, uint16_t n) {
  proto::Msg m;
  m.net = radio_cfg::NET_ID;
  m.type = type;
  m.id = PINGPONG_ROLE_PING ? 0xA001 : 0xB001;
  m.seq = n & 0xFF;
  m.n = n;
  return m;
}

void header() {
  Serial.printf("\n# FloodLink %s freq=%.1fMHz bw=%.0fkHz sf=%u cr=4/%u sync=0x%02X tx=%ddBm preamble=%u pins_verified=%d\n",
                PINGPONG_ROLE_PING ? "PING (board A)" : "PONG (board B)", radio_cfg::FREQ_MHZ, radio_cfg::BW_KHZ,
                radio_cfg::SF, radio_cfg::CR_DENOM, radio_cfg::SYNC_WORD, radio_cfg::TX_DBM, radio_cfg::PREAMBLE,
                PINS_VERIFIED);
  Serial.printf("# pins SCK=%d MISO=%d MOSI=%d NSS=%d DIO0=%d RESET=%d\n", pins::RADIO_SCK, pins::RADIO_MISO,
                pins::RADIO_MOSI, pins::RADIO_NSS, pins::RADIO_DIO0, pins::RADIO_RESET);
  Serial.printf("# RADIO begin=%d %s\n", radioState, radioState == 0 ? "OK" : "FAIL (check SPI/NSS/3V3 wiring) - stop B2 and report this code");
}

#if PINGPONG_ROLE_PING
void runRounds() {
  Serial.println("# antenna on both boards? starting 50 rounds");
  Serial.println("PING,n,ok,rtt_ms,rssi,snr");
  uint16_t ok = 0;
  float sumRssi = 0, sumSnr = 0;
  for (uint16_t n = 1; n <= ROUNDS; n++) {
    const uint32_t t0 = millis();
    const int16_t st = radio::send(make(proto::PING, n));
    bool got = false;
    float rssi = 0, snr = 0;
    while (st == 0 && millis() - t0 < WAIT_ACK_MS) {
      proto::Msg m;
      int16_t code = 0;
      if (radio::receive(m, rssi, snr, code) == radio::RX_OK && m.type == proto::PONG && m.n == n) {
        got = true;
        break;
      }
      delay(1);
    }
    if (got) {
      ok++;
      sumRssi += rssi;
      sumSnr += snr;
      Serial.printf("PING,%u,1,%lu,%.0f,%.1f\n", n, (unsigned long)(millis() - t0), rssi, snr);
    } else {
      Serial.printf("PING,%u,0,,,%s\n", n, st == 0 ? "" : "tx_fail");
    }
    while (millis() - t0 < WAIT_ACK_MS + GAP_MS) delay(5);
  }
  Serial.printf("SUMMARY,ok=%u,total=%u,pct=%.1f,avg_rssi=%.1f,avg_snr=%.1f,%s\n", ok, ROUNDS, ok * 100.0f / ROUNDS,
                ok ? sumRssi / ok : 0.0f, ok ? sumSnr / ok : 0.0f, ok >= PASS_MIN ? "PASS" : "FAIL");
  Serial.println("# type g + Enter to run again");
}
#endif
}  // namespace

void setup() {
  Serial.begin(115200);
  const uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 3000) delay(10);
  radioState = radio::begin();
  header();
#if PINGPONG_ROLE_PING
  Serial.println("# type g + Enter to start (radio transmits only after this)");
#else
  Serial.println("PONG,n,rssi,snr");
#endif
}

void loop() {
  if (radioState != 0) {   // ไม่ส่งอะไรเลยถ้า begin() ไม่ผ่าน · พิมพ์รหัสซ้ำให้เห็น
    static uint32_t at = 0;
    if (millis() - at > 5000) {
      at = millis();
      radioState = radio::begin();
      Serial.printf("# RADIO begin=%d %s\n", radioState, radioState == 0 ? "OK" : "FAIL");
    }
    return;
  }
#if PINGPONG_ROLE_PING
  while (Serial.available()) {
    if (Serial.read() == 'g') runRounds();
  }
#else
  proto::Msg m;
  float rssi = 0, snr = 0;
  int16_t code = 0;
  const radio::RxResult r = radio::receive(m, rssi, snr, code);
  if (r == radio::RX_OK && m.type == proto::PING) {
    radio::send(make(proto::PONG, m.n));
    Serial.printf("PONG,%u,%.0f,%.1f\n", m.n, rssi, snr);
  } else if (r == radio::RX_BAD) {
    Serial.printf("# RX bad code=%d rssi=%.0f snr=%.1f\n", code, rssi, snr);
  }
#endif
  delay(1);
}
