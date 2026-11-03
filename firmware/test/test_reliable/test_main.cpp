// ส่งซ้ำเมื่อไม่ได้ ACK (data-contract 4.5) + นัด "ยังอยู่" (4.3)
#include <unity.h>

#include "heartbeat.h"
#include "reliable.h"

using namespace proto;
using namespace timing;

// สุ่มแบบกำหนดได้: 0 = ค่าต่ำสุดเสมอ, 1 = ค่าสูงสุดเสมอ
static int g_mode = 0;
static uint32_t fakeRand(uint32_t lo, uint32_t hi) { return g_mode ? hi : lo; }

void setUp() { g_mode = 0; }
void tearDown() {}

static Msg sosMsg(uint8_t seq) {
  Msg m; m.net = 1; m.type = SOS; m.id = 1001; m.seq = seq; m.flags = makeFlags(false, true, false, true, 0);
  return m;
}

// เดินเวลาไปทีละ 100 ms ส่งเมื่อถึงเวลา จดเวลาที่ส่ง
static int runUntil(Reliable& r, uint32_t from, uint32_t to, uint32_t* sentAt, int cap, Msg* last = 0) {
  int n = 0;
  for (uint32_t t = from; t <= to; t += 100) {
    r.tick(t);
    if (r.due(t)) {
      Msg m = r.take(t);
      if (last) *last = m;
      if (n < cap) sentAt[n] = t;
      n++;
    }
  }
  return n;
}

void test_first_send_within_0_to_3s() {
  Reliable r(fakeRand);
  g_mode = 1;   // หน่วงมากสุด 3 วิ
  r.start(sosMsg(5), Reliable::USER, 1000);
  TEST_ASSERT_FALSE(r.due(3999));
  TEST_ASSERT_TRUE(r.due(4000));
}

void test_ack_stops_retries_and_wrong_ack_is_ignored() {
  Reliable r(fakeRand);
  r.start(sosMsg(5), Reliable::USER, 0);
  Msg m = r.take(0);
  TEST_ASSERT_EQUAL_UINT8(1, flagTry(m.flags));
  TEST_ASSERT_FALSE(r.onAck(SOS, 6));       // seq ไม่ตรง
  TEST_ASSERT_FALSE(r.onAck(HEARD, 5));     // ชนิดไม่ตรง
  TEST_ASSERT_TRUE(r.active());
  TEST_ASSERT_TRUE(r.onAck(SOS, 5));
  TEST_ASSERT_FALSE(r.active());
  uint32_t at[4];
  TEST_ASSERT_EQUAL_INT(0, runUntil(r, 100, 60000, at, 4));
}

void test_no_ack_retries_after_3s_wait_plus_5_to_15s_same_seq_try_increments() {
  Reliable r(fakeRand);
  g_mode = 0;   // รอสั้นสุด 5 วิ
  r.start(sosMsg(9), Reliable::USER, 0);
  uint32_t at[8]; Msg last;
  const int n = runUntil(r, 0, 40000, at, 8, &last);
  // ส่งที่ 0 → รอ ACK ถึง 3 วิ → +5 วิ = 8 วิ → 16 → 24 → 32 วิ (ครั้งที่ 6 รออีก 60 วิ)
  TEST_ASSERT_EQUAL_INT(5, n);
  TEST_ASSERT_EQUAL_UINT32(0, at[0]);
  TEST_ASSERT_EQUAL_UINT32(8000, at[1]);
  TEST_ASSERT_EQUAL_UINT32(16000, at[2]);
  TEST_ASSERT_EQUAL_UINT8(9, last.seq);            // ส่งซ้ำใช้ seq เดิม
  TEST_ASSERT_EQUAL_UINT8(5, flagTry(last.flags)); // ครั้งที่ 5
  TEST_ASSERT_TRUE(r.retrying());
}

void test_max_wait_is_3_plus_15s() {
  Reliable r(fakeRand);
  g_mode = 1;
  r.start(sosMsg(1), Reliable::USER, 0);
  uint32_t at[3];
  runUntil(r, 0, 40000, at, 3);
  TEST_ASSERT_EQUAL_UINT32(3000, at[0]);            // หน่วง 3 วิ ก่อนส่งครั้งแรก
  TEST_ASSERT_EQUAL_UINT32(3000 + 3000 + 15000, at[1]);
}

void test_after_5_tries_every_60s_then_every_5min_after_1h() {
  Reliable r(fakeRand);
  g_mode = 0;
  r.start(sosMsg(2), Reliable::USER, 0);
  uint32_t at[200];
  const int n = runUntil(r, 0, 2 * 3600000u, at, 200);
  // ครั้งที่ 1–5 ห่าง 8 วิ (0, 8, 16, 24, 32 วิ) แล้วห่าง 60 วิ
  TEST_ASSERT_EQUAL_UINT32(32000, at[4]);
  TEST_ASSERT_EQUAL_UINT32(92000, at[5]);
  TEST_ASSERT_EQUAL_UINT32(152000, at[6]);
  // หลังครบ 1 ชม. ระยะห่างเป็น 5 นาที
  int slow = 0;
  for (int i = 1; i < n && i < 200; i++)
    if (at[i - 1] >= 3600000u) { TEST_ASSERT_EQUAL_UINT32(300000, at[i] - at[i - 1]); slow++; }
  TEST_ASSERT_TRUE(slow >= 10);
  TEST_ASSERT_FALSE(r.gaveUp());                    // ข้อความที่คนกดไม่ยอมแพ้
  TEST_ASSERT_EQUAL_UINT8(15, flagTry(r.take(2 * 3600000u + 1).flags));   // try ค้างที่ 15
}

void test_status_gives_up_after_3_tries() {
  Reliable r(fakeRand);
  Msg st; st.net = 1; st.type = STATUS; st.id = 1001; st.seq = 3;
  r.start(st, Reliable::STATUS_ONLY, 0);
  uint32_t at[10];
  TEST_ASSERT_EQUAL_INT(3, runUntil(r, 0, 600000, at, 10));
  TEST_ASSERT_TRUE(r.gaveUp());
  TEST_ASSERT_FALSE(r.active());
}

void test_retry_voice_after_3rd_miss_then_every_10min_then_30min() {
  Reliable r(fakeRand);
  r.start(sosMsg(4), Reliable::USER, 0);
  uint32_t voices[40]; int nv = 0;
  for (uint32_t t = 0; t <= 3 * 3600000u; t += 100) {
    r.tick(t);
    if (r.due(t)) r.take(t);
    if (r.takeRetryVoice(t) && nv < 40) voices[nv++] = t;
  }
  TEST_ASSERT_TRUE(nv >= 3);
  TEST_ASSERT_EQUAL_UINT32(16000 + 3000, voices[0]);         // พลาดครั้งที่ 3 (ส่งที่ 16 วิ + รอ 3 วิ)
  TEST_ASSERT_EQUAL_UINT32(600000, voices[1] - voices[0]);   // ทุก 10 นาทีในชั่วโมงแรก
  bool late = false;
  for (int i = 1; i < nv; i++) if (voices[i - 1] >= 3600000u) { TEST_ASSERT_EQUAL_UINT32(1800000, voices[i] - voices[i - 1]); late = true; }
  TEST_ASSERT_TRUE(late);
}

void test_late_ack_after_wait_window_still_counts() {
  Reliable r(fakeRand);
  r.start(sosMsg(8), Reliable::USER, 0);
  r.take(0);
  r.tick(3500);   // หมดหน้าต่างรอ ACK แล้ว
  TEST_ASSERT_TRUE(r.onAck(SOS, 8));
  TEST_ASSERT_FALSE(r.active());
}

// ---- heartbeat
void test_heartbeat_first_within_30min_then_6h_plus_minus_10min() {
  Heartbeat hb(fakeRand);
  g_mode = 1;
  hb.begin(100);
  TEST_ASSERT_EQUAL_UINT32(100 + 1800, hb.nextS());
  g_mode = 0;
  hb.sent(5000, false);
  TEST_ASSERT_EQUAL_UINT32(5000 + 6 * 3600 - 600, hb.nextS());
  g_mode = 1;
  hb.sent(5000, false);
  TEST_ASSERT_EQUAL_UINT32(5000 + 6 * 3600 + 600, hb.nextS());
}

void test_heartbeat_every_1h_during_warning() {
  Heartbeat hb(fakeRand);
  g_mode = 0;
  hb.sent(0, true);
  TEST_ASSERT_EQUAL_UINT32(3600 - 600, hb.nextS());
}

void test_heartbeat_kick_only_moves_earlier() {
  Heartbeat hb(fakeRand);
  hb.sent(0, false);                // นัดไว้ ~6 ชม.
  hb.kick(100);                     // น้ำขึ้น → ส่งทันที
  TEST_ASSERT_TRUE(hb.due(100));
  hb.sent(100, false);
  g_mode = 1;
  hb.kick(200, 600);                // WARN ใหม่ → ภายใน 10 นาที
  TEST_ASSERT_EQUAL_UINT32(800, hb.nextS());
  hb.kick(300, 0);
  TEST_ASSERT_EQUAL_UINT32(300, hb.nextS());
  hb.kick(400, 600);                // นัดเดิมเร็วกว่า ไม่เลื่อนให้ช้าลง
  TEST_ASSERT_EQUAL_UINT32(300, hb.nextS());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_first_send_within_0_to_3s);
  RUN_TEST(test_ack_stops_retries_and_wrong_ack_is_ignored);
  RUN_TEST(test_no_ack_retries_after_3s_wait_plus_5_to_15s_same_seq_try_increments);
  RUN_TEST(test_max_wait_is_3_plus_15s);
  RUN_TEST(test_after_5_tries_every_60s_then_every_5min_after_1h);
  RUN_TEST(test_status_gives_up_after_3_tries);
  RUN_TEST(test_retry_voice_after_3rd_miss_then_every_10min_then_30min);
  RUN_TEST(test_late_ack_after_wait_window_still_counts);
  RUN_TEST(test_heartbeat_first_within_30min_then_6h_plus_minus_10min);
  RUN_TEST(test_heartbeat_every_1h_during_warning);
  RUN_TEST(test_heartbeat_kick_only_moves_earlier);
  return UNITY_END();
}
