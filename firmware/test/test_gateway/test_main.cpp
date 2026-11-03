// ตรรกะตัวรับ: ACK, 1 บ้าน = 1 คำขอ, คำสั่งจากเว็บ, ส่งซ้ำ ACCEPTED/DONE, บ้านเงียบ, ขาดการติดต่อ, hb/snap
#include <string.h>
#include <unity.h>

#include <string>
#include <vector>

#include "gateway.h"
#include "radio_config.h"

using namespace proto;

struct Sink : LineSink {
  std::vector<std::string> lines;
  void line(const std::string& s) override { lines.push_back(s); }
  std::string last(const char* prefix) const {
    for (size_t i = lines.size(); i-- > 0;) if (lines[i].compare(0, strlen(prefix), prefix) == 0) return lines[i];
    return "";
  }
  int count(const char* prefix) const {
    int n = 0;
    for (size_t i = 0; i < lines.size(); i++) if (lines[i].compare(0, strlen(prefix), prefix) == 0) n++;
    return n;
  }
};

static const HouseInfo REG[] = {{1001, "บ้านทดลอง 1", 200, 66, true}, {1002, "บ้าน \"ทดสอบ\" 2", 100, 150, false}};
static Sink* sink;
static Gateway* gw;

void setUp() {
  sink = new Sink();
  gw = new Gateway(REG, 2, "GW-01", *sink);
  gw->begin(0);
}
void tearDown() { delete gw; delete sink; }

static Msg up(uint8_t type, uint16_t id, uint8_t seq, uint8_t flags = 0) {
  Msg m; m.net = radio_cfg::NET_ID; m.type = type; m.id = id; m.seq = seq; m.flags = flags; m.batt = 231;
  return m;
}
static int popAll(uint8_t type, Msg* last = 0) {
  int n = 0; Msg m;
  while (gw->popTx(m)) if (m.type == type) { n++; if (last) *last = m; }
  return n;
}
static bool has(const std::string& s, const char* sub) { return s.find(sub) != std::string::npos; }

void test_hello_sends_snap_with_contract_fields() {
  gw->onLine("{\"cmd\":\"hello\",\"rid\":1}", 1000);
  const std::string s = sink->last("{\"t\":\"snap\"");
  TEST_ASSERT_TRUE(has(s, "\"v\":2"));
  TEST_ASSERT_TRUE(has(s, "\"gw\":{\"name\":\"GW-01\",\"sim\":false,\"link\":\"usb\""));
  TEST_ASSERT_TRUE(has(s, "\"cfg\":{\"silent_h\":6,\"auto_h\":2,\"probe_cm\":50,\"water_s\":30"));
  TEST_ASSERT_TRUE(has(s, "\"offline_h\":13"));
  TEST_ASSERT_TRUE(has(s, "\"warn\":null"));
  TEST_ASSERT_TRUE(has(s, "{\"id\":1001,\"name\":\"บ้านทดลอง 1\",\"x\":200,\"y\":66,\"bed\":true,\"state\":\"idle\""));
  TEST_ASSERT_TRUE(has(s, "\"last_seen\":null"));
  TEST_ASSERT_TRUE(has(s, "\"name\":\"บ้าน \\\"ทดสอบ\\\" 2\""));   // escape เครื่องหมายคำพูด
  TEST_ASSERT_TRUE(has(s, "\"req\":null"));
  TEST_ASSERT_TRUE(has(s, "\"events\":[]}"));
  TEST_ASSERT_EQUAL_INT(0, sink->count("{\"t\":\"res\""));   // hello ไม่มี res
}

void test_sos_opens_one_request_acks_every_copy_and_counts_new_presses_as_dup() {
  gw->onRadio(up(SOS, 1001, 5, makeFlags(false, true, false, true, 1)), -97.0f, 6.5f, 10000);
  Msg a;
  TEST_ASSERT_EQUAL_INT(1, popAll(ACK, &a));
  TEST_ASSERT_EQUAL_UINT8(SOS, a.ack_type);
  TEST_ASSERT_EQUAL_UINT8(5, a.ack_seq);
  TEST_ASSERT_EQUAL_UINT16(1001, a.id);
  const Gateway::House* h = gw->house(1001);
  TEST_ASSERT_TRUE(h->req.open);
  TEST_ASSERT_EQUAL_UINT8(1, h->req.no);
  TEST_ASSERT_EQUAL_STRING("sos", Gateway::stateName(*h));
  // กล่องส่งซ้ำ (ACK หาย) seq เดิม try 2 → ACK อีกครั้ง แต่ไม่นับเป็นคำขอซ้ำ
  gw->onRadio(up(SOS, 1001, 5, makeFlags(false, true, false, true, 2)), -98.0f, 6.0f, 20000);
  TEST_ASSERT_EQUAL_INT(1, popAll(ACK));
  TEST_ASSERT_EQUAL_UINT16(0, h->req.dup);
  // คนกดแดงอีกครั้ง (seq ใหม่) → คำขอเดิม dup +1
  gw->onRadio(up(SOS, 1001, 6, makeFlags(false, true, false, true, 1)), -98.0f, 6.0f, 30000);
  TEST_ASSERT_EQUAL_INT(1, popAll(ACK));
  TEST_ASSERT_EQUAL_UINT16(1, h->req.dup);
  TEST_ASSERT_EQUAL_UINT8(1, h->req.no);
  gw->writeSnap(30000);
  const std::string s = sink->last("{\"t\":\"snap\"");
  TEST_ASSERT_TRUE(has(s, "\"req\":{\"no\":1,\"kind\":\"sos\",\"t_open\":10,\"confirmed\":true,\"t_accept\":null,\"delivered\":false,\"cancel_t\":null,\"dup\":1}"));
  TEST_ASSERT_TRUE(has(s, "\"rssi\":-98,\"snr\":6.0"));
  TEST_ASSERT_TRUE(has(s, "\"batt_v\":4.62"));
}

void test_accept_sends_accepted_until_box_ack_then_delivered() {
  gw->onRadio(up(SOS, 1001, 5), -90, 5, 0);
  popAll(ACK);
  gw->onLine("{\"cmd\":\"accept\",\"rid\":7,\"id\":1001}", 60000);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"rid\":7,\"ok\":true"));
  Msg acc;
  TEST_ASSERT_EQUAL_INT(1, popAll(ACCEPTED, &acc));
  TEST_ASSERT_EQUAL_UINT8(1, acc.req_no);
  TEST_ASSERT_EQUAL_STRING("accepted", Gateway::stateName(*gw->house(1001)));
  // ไม่ได้ BOX_ACK → ส่งซ้ำหลัง 1, 2, 4 นาที (seq เดิม)
  int resent = 0; Msg r;
  for (uint32_t t = 60000; t <= 60000 + 7 * 60000 + 1000; t += 1000) { gw->tick(t); if (popAll(ACCEPTED, &r)) { resent++; TEST_ASSERT_EQUAL_UINT8(acc.seq, r.seq); } }
  TEST_ASSERT_EQUAL_INT(3, resent);   // +1, +3, +7 นาที
  Msg ba = up(BOX_ACK, 1001, 9); ba.ack_type = ACCEPTED; ba.ack_seq = acc.seq;
  gw->onRadio(ba, -90, 5, 9 * 60000);
  TEST_ASSERT_TRUE(gw->house(1001)->req.delivered);
  TEST_ASSERT_EQUAL_INT(0, popAll(ACK));   // BOX_ACK ไม่ต้องตอบ
  for (uint32_t t = 9 * 60000; t <= 30 * 60000; t += 1000) { gw->tick(t); TEST_ASSERT_EQUAL_INT(0, popAll(ACCEPTED)); }
}

void test_done_closes_request_and_sends_done() {
  gw->onRadio(up(SOS, 1002, 1), -90, 5, 0);
  gw->onLine("{\"cmd\":\"accept\",\"rid\":1,\"id\":1002}", 1000);
  gw->onLine("{\"cmd\":\"done\",\"rid\":2,\"id\":1002}", 2000);
  Msg d;
  TEST_ASSERT_EQUAL_INT(1, popAll(DONE, &d));
  TEST_ASSERT_EQUAL_UINT8(1, d.req_no);
  TEST_ASSERT_FALSE(gw->house(1002)->req.open);
  TEST_ASSERT_EQUAL_STRING("done", Gateway::stateName(*gw->house(1002)));
  gw->onLine("{\"cmd\":\"done\",\"rid\":3,\"id\":1002}", 3000);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"rid\":3,\"ok\":false,\"err\":\"no_open_request\""));
}

void test_auto_sos_needs_confirm_before_accept_and_red_press_makes_it_sos() {
  gw->onRadio(up(AUTO_SOS, 1001, 1, makeFlags(true, true, false, true, 1)), -90, 5, 0);
  TEST_ASSERT_EQUAL_STRING("auto_sos", Gateway::stateName(*gw->house(1001)));
  TEST_ASSERT_TRUE(gw->house(1001)->probeWet);
  gw->onLine("{\"cmd\":\"accept\",\"rid\":1,\"id\":1001}", 1000);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"err\":\"need_confirm\""));
  gw->onLine("{\"cmd\":\"confirm\",\"rid\":2,\"id\":1001}", 2000);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"rid\":2,\"ok\":true"));
  gw->onLine("{\"cmd\":\"confirm\",\"rid\":3,\"id\":1002}", 2000);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"err\":\"no_open_request\""));
  gw->onRadio(up(SOS, 1001, 2), -90, 5, 3000);
  const Gateway::House* h = gw->house(1001);
  TEST_ASSERT_FALSE(h->req.autoKind);
  TEST_ASSERT_EQUAL_UINT16(1, h->req.dup);
  TEST_ASSERT_EQUAL_STRING("sos", Gateway::stateName(*h));
}

void test_safe_bed_house_keeps_request_until_cancel_ok_non_bed_closes() {
  gw->onRadio(up(SOS, 1001, 1), -90, 5, 0);
  gw->onRadio(up(SAFE, 1001, 2), -90, 5, 1000);
  const Gateway::House* h = gw->house(1001);
  TEST_ASSERT_TRUE(h->req.open);                  // บ้านติดเตียง: คำขอยังอยู่
  TEST_ASSERT_TRUE(h->req.cancelled);
  gw->writeSnap(1000);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"snap\""), "\"cancel_t\":1"));
  gw->onLine("{\"cmd\":\"cancel_ok\",\"rid\":4,\"id\":1001}", 2000);
  TEST_ASSERT_FALSE(h->req.open);
  TEST_ASSERT_EQUAL_STRING("safe", Gateway::stateName(*h));

  gw->onRadio(up(SOS, 1002, 1), -90, 5, 0);
  gw->onLine("{\"cmd\":\"cancel_ok\",\"rid\":5,\"id\":1002}", 500);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"err\":\"not_cancelled\""));
  gw->onRadio(up(SAFE, 1002, 2), -90, 5, 1000);
  TEST_ASSERT_FALSE(gw->house(1002)->req.open);   // บ้านทั่วไป: ปิดทันที
  TEST_ASSERT_EQUAL_STRING("safe", Gateway::stateName(*gw->house(1002)));
}

void test_warn_broadcasts_heard_and_silent_after_6h() {
  gw->onLine("{\"cmd\":\"warn\",\"rid\":1,\"when\":\"tonight\",\"lvl_cm\":80}", 1000);
  Msg w;
  TEST_ASSERT_EQUAL_INT(1, popAll(WARN, &w));
  TEST_ASSERT_EQUAL_HEX16(ID_ALL, w.id);
  TEST_ASSERT_EQUAL_UINT8(1, w.wid);
  TEST_ASSERT_EQUAL_UINT8(1, w.when);
  TEST_ASSERT_EQUAL_UINT8(8, w.lvl);
  TEST_ASSERT_EQUAL_STRING("warn", Gateway::stateName(*gw->house(1001)));
  Msg hd = up(HEARD, 1002, 3); hd.wid = 1;
  gw->onRadio(hd, -90, 5, 5000);
  TEST_ASSERT_EQUAL_STRING("heard", Gateway::stateName(*gw->house(1002)));
  TEST_ASSERT_TRUE(gw->house(1002)->gotWarn);
  // WARN 3 ครั้งห่าง 30 วิ แล้วทุก 15 นาที
  int tx = 0;
  for (uint32_t t = 5000; t <= 1000 + 31 * 60000; t += 1000) { gw->tick(t); tx += popAll(WARN); }
  TEST_ASSERT_EQUAL_INT(2 + 2, tx);   // +30 วิ, +60 วิ, +15 นาที, +30 นาที
  // 1001 ไม่กดเขียว (กล่องส่ง STATUS มาแล้ว แปลว่าได้รับ) → 6 ชม. = บ้านเงียบ
  Msg st = up(STATUS, 1001, 4); st.wid = 1;
  gw->onRadio(st, -90, 5, 60000);
  TEST_ASSERT_TRUE(gw->house(1001)->gotWarn);
  for (uint8_t k = 1; k <= 5; k++) {   // ช่วงเตือน กล่องส่ง "ยังอยู่" ทุก 1 ชม. (ไม่งั้นเกิน 3 ชม. = ขาดการติดต่อ)
    gw->onRadio(up(STATUS, 1001, 10 + k), -90, 5, k * 3600000u);
    gw->onRadio(up(STATUS, 1002, 10 + k), -90, 5, k * 3600000u);
  }
  gw->tick(1000 + 6 * 3600000u - 1000);
  TEST_ASSERT_EQUAL_STRING("warn", Gateway::stateName(*gw->house(1001)));
  gw->tick(1000 + 6 * 3600000u);
  TEST_ASSERT_EQUAL_STRING("silent", Gateway::stateName(*gw->house(1001)));
  TEST_ASSERT_EQUAL_STRING("heard", Gateway::stateName(*gw->house(1002)));
  gw->onLine("{\"cmd\":\"warn_stop\",\"rid\":2,\"wid\":1}", 1000 + 6 * 3600000u);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"rid\":2,\"ok\":true"));
  gw->onLine("{\"cmd\":\"warn\",\"rid\":3,\"when\":\"someday\"}", 1000);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"err\":\"bad_when\""));
}

void test_offline_after_13h_silence_and_back_online() {
  gw->onRadio(up(STATUS, 1001, 1), -90, 5, 1000);
  gw->tick(1000 + 13 * 3600000u);
  TEST_ASSERT_FALSE(gw->house(1001)->offline);
  gw->tick(1000 + 13 * 3600000u + 1000);
  TEST_ASSERT_TRUE(gw->house(1001)->offline);
  TEST_ASSERT_EQUAL_STRING("offline", Gateway::stateName(*gw->house(1001)));
  TEST_ASSERT_TRUE(gw->house(1002)->offline);     // ไม่เคยได้ยินเลย นับจากเปิดเครื่อง
  gw->onRadio(up(STATUS, 1001, 2), -90, 5, 14 * 3600000u);
  TEST_ASSERT_FALSE(gw->house(1001)->offline);
  TEST_ASSERT_EQUAL_STRING("idle", Gateway::stateName(*gw->house(1001)));
  gw->writeSnap(14 * 3600000u);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"snap\""), "\"ev\":\"online\""));
}

void test_offline_with_open_request_keeps_request_state() {
  gw->onRadio(up(SOS, 1001, 1), -90, 5, 0);
  gw->tick(14 * 3600000u);
  TEST_ASSERT_TRUE(gw->house(1001)->offline);
  TEST_ASSERT_EQUAL_STRING("sos", Gateway::stateName(*gw->house(1001)));   // คงอยู่ในคิวคำขอ + ป้ายขาดการติดต่อ
}

void test_offline_after_3h_during_warn_counted_from_warn_start() {
  gw->onRadio(up(STATUS, 1001, 1), -90, 5, 1000);            // ได้ยินก่อนเตือน 5 ชม.
  gw->onLine("{\"cmd\":\"warn\",\"rid\":1,\"when\":\"tonight\"}", 5 * 3600000u);
  gw->tick(5 * 3600000u + 1000);
  TEST_ASSERT_FALSE(gw->house(1001)->offline);                // เริ่มเตือนแล้วไม่โดนทันที
  gw->onRadio(up(STATUS, 1002, 1), -90, 5, 6 * 3600000u);    // 1002 ส่ง "ยังอยู่" หลังเตือน
  gw->tick(8 * 3600000u);
  TEST_ASSERT_FALSE(gw->house(1001)->offline);
  gw->tick(8 * 3600000u + 1000);                              // เตือนมาแล้วเกิน 3 ชม.
  TEST_ASSERT_TRUE(gw->house(1001)->offline);
  TEST_ASSERT_FALSE(gw->house(1002)->offline);                // ได้ยินล่าสุด 2 ชม. ก่อน
  gw->writeSnap(8 * 3600000u + 1000);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"snap\""), "\"offline_h\":3"));
  gw->onLine("{\"cmd\":\"warn_stop\",\"rid\":2,\"wid\":1}", 9 * 3600000u);
  gw->writeSnap(9 * 3600000u);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"snap\""), "\"offline_h\":13"));
}

void test_hb_every_2s_and_snap_rate_limited() {
  for (uint32_t t = 0; t <= 10000; t += 100) gw->tick(t);
  TEST_ASSERT_EQUAL_INT(5, sink->count("{\"t\":\"hb\""));
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"hb\""), "\"now\":10,"));
  sink->lines.clear();
  // ข้อความเข้ารัว ๆ 10 ข้อความใน 1 วิ → snap ไม่เกิน 2 ครั้ง/วิ
  for (int i = 0; i < 10; i++) { gw->onRadio(up(STATUS, 1001, 10 + i), -90, 5, 20000 + i * 100); gw->tick(20000 + i * 100); }
  gw->tick(21000);
  const int snaps = sink->count("{\"t\":\"snap\"");
  TEST_ASSERT_TRUE(snaps >= 2 && snaps <= 3);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"snap\""), "\"try\":1"));
}

void test_bad_lines_are_ignored_and_unknown_command_fails() {
  const size_t before = sink->lines.size();
  gw->onLine("ESP-ROM:esp32c3-api1-20210207", 0);
  gw->onLine("{not json", 0);
  gw->onLine("", 0);
  TEST_ASSERT_EQUAL_UINT(before, sink->lines.size());
  gw->onLine("{\"cmd\":\"fly\",\"rid\":9}", 0);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"rid\":9,\"ok\":false,\"err\":\"bad_cmd\""));
  gw->onLine("{\"cmd\":\"accept\",\"rid\":10,\"id\":4242}", 0);
  TEST_ASSERT_TRUE(has(sink->last("{\"t\":\"res\""), "\"err\":\"unknown_id\""));
  gw->onRadio(up(SOS, 4242, 1), -90, 5, 0);           // บ้านที่ไม่ได้ลงทะเบียน: ไม่ตอบ ไม่สร้างคำขอ
  TEST_ASSERT_EQUAL_INT(0, popAll(ACK));
  TEST_ASSERT_TRUE(has(sink->lines.back(), "# unknown id 4242"));
}

void test_retry_counter_and_low_batt_event_from_flags() {
  gw->onRadio(up(SOS, 1001, 1, makeFlags(false, true, true, true, 3)), -110, -4.5f, 0);
  const Gateway::House* h = gw->house(1001);
  TEST_ASSERT_EQUAL_UINT8(3, h->tryNo);
  TEST_ASSERT_TRUE(h->lowBatt);
  gw->writeSnap(0);
  const std::string s = sink->last("{\"t\":\"snap\"");
  TEST_ASSERT_TRUE(has(s, "\"ev\":\"retry_rx\""));
  TEST_ASSERT_TRUE(has(s, "\"ev\":\"low_batt\""));
  TEST_ASSERT_TRUE(has(s, "\"low_batt\":true"));
  TEST_ASSERT_TRUE(has(s, "\"snr\":-4.5"));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_hello_sends_snap_with_contract_fields);
  RUN_TEST(test_sos_opens_one_request_acks_every_copy_and_counts_new_presses_as_dup);
  RUN_TEST(test_accept_sends_accepted_until_box_ack_then_delivered);
  RUN_TEST(test_done_closes_request_and_sends_done);
  RUN_TEST(test_auto_sos_needs_confirm_before_accept_and_red_press_makes_it_sos);
  RUN_TEST(test_safe_bed_house_keeps_request_until_cancel_ok_non_bed_closes);
  RUN_TEST(test_warn_broadcasts_heard_and_silent_after_6h);
  RUN_TEST(test_offline_after_13h_silence_and_back_online);
  RUN_TEST(test_offline_after_3h_during_warn_counted_from_warn_start);
  RUN_TEST(test_offline_with_open_request_keeps_request_state);
  RUN_TEST(test_hb_every_2s_and_snap_rate_limited);
  RUN_TEST(test_bad_lines_are_ignored_and_unknown_command_fails);
  RUN_TEST(test_retry_counter_and_low_batt_event_from_flags);
  return UNITY_END();
}
