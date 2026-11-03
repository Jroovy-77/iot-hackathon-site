// ตัวรับจำลองบนคอม (ทดสอบ A3) — ใช้ common/gateway และ common/house_logic ตัวเดียวกับบอร์ด
// ต่อกันด้วย "วิทยุจำลอง" (เข้ารหัสเป็นไบต์แล้วถอดกลับ ผ่าน common/protocol จริง) — ค่า RSSI/SNR เป็นค่าสมมติ ไม่ใช่ผลวัด
//
// stdin : บรรทัด JSON จากแดชบอร์ด (เหมือนที่ Web Serial ส่งเข้าตัวรับจริง)
//         box red long|short · box green short|long · box wet 1|0 · box batt <V> · link loss <0-100>
// stdout: ทุกบรรทัดที่ตัวรับจริงพิมพ์ทาง Serial (snap / hb / res / # log) + "# BOX ..." ของกล่องจำลอง
#include <stdio.h>
#include <stdlib.h>

#include <chrono>
#include <deque>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>

#include "gateway.h"
#include "house_logic.h"
#include "houses.h"
#include "protocol.h"
#include "radio_config.h"

namespace {

struct StdoutSink : LineSink {
  void line(const std::string& s) override {
    fwrite(s.data(), 1, s.size(), stdout);
    fputc('\n', stdout);
    fflush(stdout);
  }
};

uint32_t rnd(uint32_t lo, uint32_t hi) { return hi > lo ? lo + (uint32_t)(rand() % (int)(hi - lo + 1)) : lo; }

const auto T0 = std::chrono::steady_clock::now();
uint32_t millisNow() {
  return (uint32_t)std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - T0).count();
}

std::mutex mu;
std::deque<std::string> inbox;
bool eof = false;

// ส่งผ่านวิทยุจำลอง: เข้ารหัสเป็นไบต์ ถอดกลับ (ทดสอบ protocol ไปด้วย) · ทิ้งตามอัตราที่ตั้ง
int lossPct = 0;
bool air(const proto::Msg& in, proto::Msg& out) {
  uint8_t buf[proto::MAX_LEN];
  const size_t n = proto::encode(in, buf, sizeof buf);
  if (!n || (lossPct && rand() % 100 < lossPct)) return false;
  return proto::decode(buf, n, radio_cfg::NET_ID, out) == proto::OK;
}

}  // namespace

int main() {
  srand((unsigned)time(0));
  StdoutSink sink;
  Gateway gw(HOUSES, HOUSE_COUNT, "GW-01", sink);
  const HouseInfo* me = findHouse(HOUSE_ID);
  HouseBox box(HOUSE_ID, me ? me->bed : false, rnd);
  bool wet = false;
  float batt = 4.62f;
  uint32_t battAt = 0;
  uint8_t lastState = 255;

  std::thread reader([] {
    std::string l;
    while (std::getline(std::cin, l)) {
      if (!l.empty() && l[l.size() - 1] == '\r') l.erase(l.size() - 1);
      std::lock_guard<std::mutex> g(mu);
      inbox.push_back(l);
    }
    std::lock_guard<std::mutex> g(mu);
    eof = true;
  });

  sink.line("# FloodLink receiver (host simulation: gateway + 1 simulated house box, simulated radio)");
  const uint32_t start = millisNow();
  gw.begin(start);
  box.begin(start);

  for (;;) {
    const uint32_t now = millisNow();
    std::deque<std::string> lines;
    bool done;
    {
      std::lock_guard<std::mutex> g(mu);
      lines.swap(inbox);
      done = eof;
    }
    for (size_t i = 0; i < lines.size(); i++) {
      const std::string& l = lines[i];
      if (l.compare(0, 4, "box ") == 0) {
        sink.line("# BOX cmd " + l.substr(4));
        if (l == "box red long") box.onRed(Button::LONG, now);
        else if (l == "box red short") box.onRed(Button::SHORT, now);
        else if (l == "box green short") box.onGreen(Button::SHORT, now);
        else if (l == "box green long") box.onGreen(Button::LONG, now);
        else if (l == "box wet 1") wet = true;
        else if (l == "box wet 0") wet = false;
        else if (l.compare(0, 9, "box batt ") == 0) { batt = (float)atof(l.c_str() + 9); battAt = now; }
      } else if (l.compare(0, 10, "link loss ") == 0) {
        lossPct = atoi(l.c_str() + 10);
        sink.line("# LINK loss=" + l.substr(10) + "%");
      } else {
        gw.onLine(l.c_str(), now);
      }
    }
    if (done) break;

    if (box.probeDue(now)) box.onProbe(wet, now);
    if ((int32_t)(now - battAt) >= 0) {
      battAt = now + 10000;
      box.onBattery(batt, now);
    }
    gw.tick(now);
    box.tick(now);

    proto::Msg m, rx;
    char b[128];
    while (gw.popTx(m)) {
      gw.noteAirtime(proto::airtimeMs(proto::lengthOf(m.type), radio_cfg::SF, radio_cfg::BW_KHZ, radio_cfg::CR_DENOM,
                                      radio_cfg::PREAMBLE), now);
      snprintf(b, sizeof b, "# TX %s id=%u seq=%u", proto::typeName(m.type), m.id, m.seq);
      sink.line(b);
      if (air(m, rx)) box.onRadio(rx, now);
    }
    while (box.popTx(m, now)) {
      if (air(m, rx)) {
        snprintf(b, sizeof b, "# RX %s id=%u seq=%u try=%u rssi=-70 snr=9.0 (simulated)", proto::typeName(rx.type),
                 rx.id, rx.seq, proto::flagTry(rx.flags));
        sink.line(b);
        gw.onRadio(rx, -70.0f, 9.0f, now);
      }
    }
    for (uint8_t v; (v = box.popVoice()) != V_NONE;) sink.line(std::string("# BOX voice ") + voiceName(v));
    if (box.state() != lastState) {
      lastState = box.state();
      sink.line(std::string("# BOX state ") + HouseBox::stateName(lastState));
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(20));
  }
  reader.join();
  return 0;
}
