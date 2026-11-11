// ตรรกะกล่องบ้าน: ปุ่ม → ข้อความ, ACK → เสียง, ACCEPTED/DONE → BOX_ACK, น้ำขึ้น, ขอแทน, ถ่านอ่อน
#include <unity.h>

#include "house_logic.h"
#include "radio_config.h"

using namespace proto;

static uint32_t minRand(uint32_t lo, uint32_t) { return lo; }

void setUp() {}
void tearDown() {}

static Msg down(uint8_t type, uint16_t id, uint8_t seq) {
  Msg m; m.net = radio_cfg::NET_ID; m.type = type; m.id = id; m.seq = seq;
  return m;
}

// เดินเวลาแล้วเก็บข้อความที่กล่องส่งออกมาตามชนิด (ไม่ตอบ ACK)
static int collect(HouseBox& b, uint32_t from, uint32_t to, uint8_t type, Msg* last = 0) {
  int n = 0; Msg m;
  for (uint32_t t = from; t <= to; t += 100) {
    b.tick(t);
    while (b.popTx(m, t)) if (m.type == type) { n++; if (last) *last = m; }
  }
  return n;
}

static void drainVoices(HouseBox& b) { while (b.popVoice() != V_NONE) {} }

void test_warn_then_green_sends_heard_and_ack_says_thanks() {
  HouseBox b(1001, false, minRand); b.begin(0);
  Msg w = down(WARN, ID_ALL, 1); w.wid = 7; w.when = 2;
  b.onRadio(w, 1000);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_WARN, b.state());
  TEST_ASSERT_EQUAL_UINT8(V_WARN, b.popVoice());
  TEST_ASSERT_EQUAL_UINT8(2, b.when());
  b.onRadio(w, 1500);   // คำเตือนเดิมซ้ำ ไม่พูดซ้ำ
  TEST_ASSERT_EQUAL_UINT8(V_NONE, b.popVoice());

  b.onGreen(Button::SHORT, 2000);   // ตอนเตือน กดสั้นก็ได้ยินแล้ว
  TEST_ASSERT_EQUAL_INT(HouseBox::S_HEARD, b.state());
  Msg h;
  TEST_ASSERT_EQUAL_INT(1, collect(b, 2000, 2100, HEARD, &h));
  TEST_ASSERT_EQUAL_UINT8(7, h.wid);
  TEST_ASSERT_EQUAL_UINT8(V_NONE, b.popVoice());   // รอ ACK ไม่มีเสียง
  Msg a = down(ACK, 1001, 50); a.ack_type = HEARD; a.ack_seq = h.seq;
  b.onRadio(a, 2500);
  TEST_ASSERT_EQUAL_UINT8(V_HEARD, b.popVoice());
  TEST_ASSERT_FALSE(b.waitingAck());
}

void test_red_long_sends_sos_light_blinks_until_ack() {
  HouseBox b(1001, true, minRand); b.begin(0);
  b.onRed(Button::SHORT, 100);                     // แดงกดสั้น = ไม่ทำอะไร
  TEST_ASSERT_EQUAL_INT(HouseBox::S_IDLE, b.state());
  b.onRed(Button::LONG, 1000);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_SOS, b.state());
  Msg s;
  TEST_ASSERT_EQUAL_INT(1, collect(b, 1000, 1000, SOS, &s));
  TEST_ASSERT_TRUE(flagOpenReq(s.flags));
  TEST_ASSERT_TRUE(flagBed(s.flags));
  TEST_ASSERT_EQUAL_UINT8(1, flagTry(s.flags));
  // รอ ACK: ไฟแดงกะพริบเร็ว
  TEST_ASSERT_EQUAL_UINT8(255, b.light(1150).r);
  TEST_ASSERT_EQUAL_UINT8(0, b.light(1000).r + b.light(1000).g);
  Msg a = down(ACK, 1001, 1); a.ack_type = SOS; a.ack_seq = s.seq;
  b.onRadio(a, 1500);
  TEST_ASSERT_EQUAL_UINT8(V_SOS_SENT, b.popVoice());
  const Rgb c = b.light(1500);
  TEST_ASSERT_EQUAL_UINT8(255, c.r); TEST_ASSERT_EQUAL_UINT8(0, c.g);   // แดงนิ่ง
}

void test_sos_without_ack_retries_and_says_retry_after_3_misses() {
  HouseBox b(1001, false, minRand); b.begin(0);
  b.onRed(Button::LONG, 0);
  Msg last;
  int voicesRetry = 0;
  int n = 0; Msg m;
  for (uint32_t t = 0; t <= 30000; t += 100) {
    b.tick(t);
    while (b.popTx(m, t)) if (m.type == SOS) { n++; last = m; }
    for (uint8_t v; (v = b.popVoice()) != V_NONE;) if (v == V_RETRY) voicesRetry++;
  }
  TEST_ASSERT_EQUAL_INT(4, n);                     // 0, 8, 16, 24 วิ
  TEST_ASSERT_EQUAL_UINT8(4, flagTry(last.flags));
  TEST_ASSERT_TRUE(b.retrying());
  TEST_ASSERT_EQUAL_INT(1, voicesRetry);
}

void test_accepted_sends_box_ack_turns_yellow_once() {
  HouseBox b(1001, false, minRand); b.begin(0);
  b.onRed(Button::LONG, 0);
  collect(b, 0, 0, SOS);
  Msg acc = down(ACCEPTED, 1001, 30); acc.req_no = 3;
  b.onRadio(acc, 1000);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_ACCEPTED, b.state());
  TEST_ASSERT_FALSE(b.waitingAck());               // ได้ ACCEPTED แปลว่าตัวรับได้คำขอแล้ว หยุดส่ง SOS
  Msg m;
  TEST_ASSERT_TRUE(b.popTx(m, 1000));
  TEST_ASSERT_EQUAL_UINT8(BOX_ACK, m.type);
  TEST_ASSERT_EQUAL_UINT8(ACCEPTED, m.ack_type);
  TEST_ASSERT_EQUAL_UINT8(30, m.ack_seq);
  TEST_ASSERT_EQUAL_UINT8(V_ACCEPTED, b.popVoice());
  const Rgb y = b.light(1000);
  TEST_ASSERT_EQUAL_UINT8(255, y.r); TEST_ASSERT_TRUE(y.g > 100); TEST_ASSERT_EQUAL_UINT8(0, y.b);
  b.onRadio(acc, 61000);                           // ตัวรับส่งซ้ำ (BOX_ACK หาย) → ตอบอีก ไม่พูดซ้ำ
  TEST_ASSERT_TRUE(b.popTx(m, 61000));
  TEST_ASSERT_EQUAL_UINT8(BOX_ACK, m.type);
  TEST_ASSERT_EQUAL_UINT8(V_NONE, b.popVoice());

  Msg dn = down(DONE, 1001, 31); dn.req_no = 3;
  b.onRadio(dn, 70000);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_DONE, b.state());
  TEST_ASSERT_FALSE(b.openReq());
  TEST_ASSERT_EQUAL_UINT8(V_DONE, b.popVoice());
  TEST_ASSERT_TRUE(b.popTx(m, 70000));
  TEST_ASSERT_EQUAL_UINT8(DONE, m.ack_type);
}

// พบบนของจริง 9 พ.ย. 2569: ตัวรับรีเซ็ต (เปิดพอร์ตใหม่) → เลขคำขอเริ่มที่ 1 ซ้ำกับคำขอเก่า
// กล่องต้องยังรับ ACCEPTED/DONE ของคำขอใหม่ได้ (เปลี่ยนสถานะ + พูด) ไม่เมินเพราะเลขเท่าของเก่า
void test_new_request_accepts_reused_req_no_after_gateway_reset() {
  HouseBox b(1001, false, minRand); b.begin(0);
  Msg m;
  b.onRed(Button::LONG, 0);
  collect(b, 0, 0, SOS);
  Msg acc1 = down(ACCEPTED, 1001, 2); acc1.req_no = 1;
  b.onRadio(acc1, 1000);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_ACCEPTED, b.state());
  Msg dn1 = down(DONE, 1001, 3); dn1.req_no = 1;
  b.onRadio(dn1, 2000);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_DONE, b.state());
  while (b.popTx(m, 2000)) {}
  drainVoices(b);

  // ตัวรับรีเซ็ต แล้วบ้านกดแดงใหม่ → ตัวรับเปิดคำขอเลข 1 อีกครั้ง
  b.onRed(Button::LONG, 100000);
  collect(b, 100000, 100000, SOS);
  drainVoices(b);
  Msg acc2 = down(ACCEPTED, 1001, 3); acc2.req_no = 1;
  b.onRadio(acc2, 101000);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_ACCEPTED, b.state());
  TEST_ASSERT_EQUAL_UINT8(V_ACCEPTED, b.popVoice());
  b.onRadio(acc2, 161000);                         // ส่งซ้ำของคำขอใหม่ → ตอบ BOX_ACK แต่ไม่พูดซ้ำ
  TEST_ASSERT_EQUAL_UINT8(V_NONE, b.popVoice());
  Msg dn2 = down(DONE, 1001, 4); dn2.req_no = 1;
  b.onRadio(dn2, 170000);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_DONE, b.state());
  TEST_ASSERT_EQUAL_UINT8(V_DONE, b.popVoice());
}

void test_messages_for_other_house_are_ignored() {
  HouseBox b(1001, false, minRand); b.begin(0);
  Msg acc = down(ACCEPTED, 1002, 30); acc.req_no = 1;
  b.onRadio(acc, 100);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_IDLE, b.state());
  Msg m;
  TEST_ASSERT_FALSE(b.popTx(m, 100));
}

void test_green_long_sends_safe_and_green_short_replays() {
  HouseBox b(1001, false, minRand); b.begin(0);
  b.onRed(Button::LONG, 0);
  Msg s; collect(b, 0, 0, SOS, &s);
  Msg a = down(ACK, 1001, 1); a.ack_type = SOS; a.ack_seq = s.seq;
  b.onRadio(a, 500);
  drainVoices(b);
  b.onGreen(Button::SHORT, 1000);                  // ฟังซ้ำ ไม่ส่งวิทยุ
  TEST_ASSERT_EQUAL_UINT8(V_SOS_SENT, b.popVoice());
  Msg m;
  TEST_ASSERT_FALSE(b.popTx(m, 1000));
  b.onGreen(Button::LONG, 2000);
  Msg safe;
  TEST_ASSERT_EQUAL_INT(1, collect(b, 2000, 2000, SAFE, &safe));
  TEST_ASSERT_EQUAL_INT(HouseBox::S_SOS, b.state());  // ยังไม่เปลี่ยนจนกว่าจะได้ ACK
  Msg a2 = down(ACK, 1001, 2); a2.ack_type = SAFE; a2.ack_seq = safe.seq;
  b.onRadio(a2, 2500);
  TEST_ASSERT_EQUAL_INT(HouseBox::S_SAFE, b.state());
  TEST_ASSERT_FALSE(b.openReq());
  TEST_ASSERT_EQUAL_UINT8(V_SAFE, b.popVoice());
}

void test_warn_voice_repeats_every_minute_10_times_then_every_5_minutes_until_green() {
  HouseBox b(1001, false, minRand); b.begin(0);
  Msg w = down(WARN, ID_ALL, 1); w.wid = 1;
  b.onRadio(w, 0);
  int warns = 0;
  for (uint32_t t = 0; t <= 25 * 60000u; t += 1000) {
    b.tick(t);
    Msg m; while (b.popTx(m, t)) {}
    for (uint8_t v; (v = b.popVoice()) != V_NONE;) if (v == V_WARN) warns++;
  }
  TEST_ASSERT_EQUAL_INT(14, warns);                // ครั้งแรก + ทุก 1 นาที ×10 (1–10) + ทุก 5 นาที (15, 20, 25)
  b.onGreen(Button::SHORT, 25 * 60000u);
  warns = 0;
  for (uint32_t t = 25 * 60000u; t <= 60 * 60000u; t += 1000) {
    b.tick(t);
    for (uint8_t v; (v = b.popVoice()) != V_NONE;) if (v == V_WARN) warns++;
  }
  TEST_ASSERT_EQUAL_INT(0, warns);
}

void test_probe_needs_30s_continuous_water_then_status() {
  HouseBox b(1001, true, minRand); b.begin(0);
  TEST_ASSERT_TRUE(b.probeDue(0));
  b.onProbe(true, 0);
  b.onProbe(false, 5000);                          // หยดน้ำแตะแป๊บเดียว ไม่นับ
  TEST_ASSERT_FALSE(b.probeWet());
  TEST_ASSERT_FALSE(b.probeDue(10000));            // แห้ง → อ่านอีกทีหลัง 60 วิ
  uint32_t t = 65000;
  for (; t <= 95000; t += 5000) { TEST_ASSERT_TRUE(b.probeDue(t)); b.onProbe(true, t); }
  TEST_ASSERT_TRUE(b.probeWet());
  Msg st;
  TEST_ASSERT_TRUE(collect(b, 95000, 100000, STATUS, &st) >= 1);   // ส่ง STATUS ทันที
  TEST_ASSERT_TRUE(flagProbeWet(st.flags));
}

void test_auto_sos_after_2h_wet_without_press_and_press_restarts_count() {
  HouseBox b(1001, true, minRand); b.begin(0);
  for (uint32_t t = 0; t <= 30000; t += 5000) b.onProbe(true, t);
  TEST_ASSERT_TRUE(b.probeWet());                  // น้ำขึ้นที่ 30 วิ
  Msg m;
  uint32_t t = 30000;
  for (; t < 3600000u; t += 60000) { b.onProbe(true, t); b.tick(t); while (b.popTx(m, t)) {} }
  const uint32_t press = t;
  b.onRed(Button::SHORT, press);                   // ผ่านไป 1 ชม. มีคนกด → เริ่มนับ 2 ชม. ใหม่
  for (; t < press + 7200000u - 60000; t += 60000) { b.onProbe(true, t); b.tick(t); while (b.popTx(m, t)) {} }
  TEST_ASSERT_FALSE(b.openReq());                  // เลย 2 ชม. นับจากน้ำขึ้นแล้ว แต่ยังไม่ครบนับจากที่กด
  Msg as;
  TEST_ASSERT_EQUAL_INT(1, collect(b, press + 7200000u, press + 7200000u + 200, AUTO_SOS, &as));
  TEST_ASSERT_EQUAL_INT(HouseBox::S_AUTO_SOS, b.state());
  TEST_ASSERT_TRUE(flagProbeWet(as.flags));
  TEST_ASSERT_TRUE(flagOpenReq(as.flags));
}

void test_non_bed_box_never_auto_sos() {
  HouseBox b(1001, false, minRand); b.begin(0);
  TEST_ASSERT_FALSE(b.usesProbe());
  b.onProbe(true, 0); b.onProbe(true, 40000);
  TEST_ASSERT_FALSE(b.probeWet());
  TEST_ASSERT_EQUAL_INT(0, collect(b, 0, 3 * 3600000u, AUTO_SOS));
}

void test_low_battery_says_once_and_flags_status() {
  HouseBox b(1001, false, minRand); b.begin(0);
  b.onBattery(4.5f, 0);
  TEST_ASSERT_FALSE(b.lowBatt());
  b.onBattery(3.85f, 1000);
  TEST_ASSERT_TRUE(b.lowBatt());
  TEST_ASSERT_EQUAL_UINT8(V_LOW_BATT, b.popVoice());
  b.onBattery(3.92f, 2000);                        // ยังไม่เกิน 3.95 V → ยังอ่อน ไม่พูดซ้ำ
  TEST_ASSERT_TRUE(b.lowBatt());
  TEST_ASSERT_EQUAL_UINT8(V_NONE, b.popVoice());
  Msg st;
  TEST_ASSERT_TRUE(collect(b, 2000, 6000, STATUS, &st) >= 1);
  TEST_ASSERT_TRUE(flagLowBatt(st.flags));
  TEST_ASSERT_EQUAL_UINT8(196, st.batt);           // 3.92 V
  b.onBattery(0.2f, 7000);                         // ถอดถ่าน = ไม่มีถ่าน ไม่ใช่ถ่านอ่อน
  TEST_ASSERT_FALSE(b.lowBatt());
}

void test_first_status_within_30_minutes() {
  HouseBox b(1001, false, minRand); b.begin(0);
  TEST_ASSERT_TRUE(collect(b, 0, 30 * 60000u + 3000, STATUS) >= 1);
}

void test_status_stays_hourly_while_warn_repeats_even_after_green() {
  HouseBox b(1001, false, minRand); b.begin(0);
  Msg w = down(WARN, ID_ALL, 1); w.wid = 7; w.when = 2;
  b.onRadio(w, 1000);
  b.onGreen(Button::SHORT, 2000);   // ได้ยินแล้ว → ออกจาก S_WARN แต่คำเตือนยังค้าง
  int st = 0; Msg m;
  for (uint32_t t = 2000; t <= 80 * 60000u; t += 100) {
    if (t % (15 * 60000u) == 0) b.onRadio(w, t);   // ตัวรับส่ง WARN ซ้ำทุก 15 นาที
    b.tick(t);
    while (b.popTx(m, t)) if (m.type == STATUS && t > 10 * 60000u) st++;
  }
  TEST_ASSERT_TRUE(st >= 1);   // "ยังอยู่" รอบถัดไปภายใน ~1 ชม. ไม่ใช่ 6 ชม.
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_warn_then_green_sends_heard_and_ack_says_thanks);
  RUN_TEST(test_red_long_sends_sos_light_blinks_until_ack);
  RUN_TEST(test_sos_without_ack_retries_and_says_retry_after_3_misses);
  RUN_TEST(test_accepted_sends_box_ack_turns_yellow_once);
  RUN_TEST(test_new_request_accepts_reused_req_no_after_gateway_reset);
  RUN_TEST(test_messages_for_other_house_are_ignored);
  RUN_TEST(test_green_long_sends_safe_and_green_short_replays);
  RUN_TEST(test_warn_voice_repeats_every_minute_10_times_then_every_5_minutes_until_green);
  RUN_TEST(test_probe_needs_30s_continuous_water_then_status);
  RUN_TEST(test_auto_sos_after_2h_wet_without_press_and_press_restarts_count);
  RUN_TEST(test_non_bed_box_never_auto_sos);
  RUN_TEST(test_low_battery_says_once_and_flags_status);
  RUN_TEST(test_first_status_within_30_minutes);
  RUN_TEST(test_status_stays_hourly_while_warn_repeats_even_after_green);
  return UNITY_END();
}
