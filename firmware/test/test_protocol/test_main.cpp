// เข้ารหัส / ถอดรหัสข้อความวิทยุ ตาม data-contract 4.2–4.3
#include <unity.h>

#include "protocol.h"
#include "radio_config.h"

using namespace proto;

void setUp() {}
void tearDown() {}

static Msg roundtrip(const Msg& m, size_t expectLen) {
  uint8_t buf[MAX_LEN];
  const size_t n = encode(m, buf, sizeof buf);
  TEST_ASSERT_EQUAL_UINT(expectLen, n);
  Msg out;
  TEST_ASSERT_EQUAL_INT(OK, decode(buf, n, m.net, out));
  return out;
}

void test_lengths_match_contract_table() {
  TEST_ASSERT_EQUAL_UINT(13, lengthOf(WARN));
  TEST_ASSERT_EQUAL_UINT(11, lengthOf(ACK));
  TEST_ASSERT_EQUAL_UINT(10, lengthOf(ACCEPTED));
  TEST_ASSERT_EQUAL_UINT(10, lengthOf(DONE));
  TEST_ASSERT_EQUAL_UINT(10, lengthOf(HEARD));
  TEST_ASSERT_EQUAL_UINT(11, lengthOf(SOS));
  TEST_ASSERT_EQUAL_UINT(11, lengthOf(AUTO_SOS));
  TEST_ASSERT_EQUAL_UINT(12, lengthOf(STATUS));
  TEST_ASSERT_EQUAL_UINT(11, lengthOf(BOX_ACK));
  TEST_ASSERT_EQUAL_UINT(11, lengthOf(SAFE));
  TEST_ASSERT_EQUAL_UINT(0, lengthOf(0x55));
}

void test_header_bytes_and_little_endian_id_and_zero_mic() {
  Msg m;
  m.net = 0x01; m.type = SOS; m.id = 0x03E9; m.seq = 7; m.flags = 0x23; m.batt = 231;
  uint8_t b[MAX_LEN];
  TEST_ASSERT_EQUAL_UINT(11, encode(m, b, sizeof b));
  const uint8_t want[11] = {0x01, 0x11, 0xE9, 0x03, 7, 0x23, 231, 0, 0, 0, 0};
  TEST_ASSERT_EQUAL_UINT8_ARRAY(want, b, 11);
}

void test_roundtrip_every_type() {
  Msg w; w.net = 1; w.type = WARN; w.id = ID_ALL; w.seq = 200; w.wid = 7; w.when = 1; w.act = 3; w.lvl = 8;
  Msg o = roundtrip(w, 13);
  TEST_ASSERT_EQUAL_HEX16(0xFFFF, o.id); TEST_ASSERT_EQUAL_UINT8(7, o.wid); TEST_ASSERT_EQUAL_UINT8(1, o.when);
  TEST_ASSERT_EQUAL_UINT8(3, o.act); TEST_ASSERT_EQUAL_UINT8(8, o.lvl); TEST_ASSERT_EQUAL_UINT8(200, o.seq);

  Msg a; a.net = 1; a.type = ACK; a.id = 1001; a.seq = 9; a.ack_type = SOS; a.ack_seq = 42;
  o = roundtrip(a, 11);
  TEST_ASSERT_EQUAL_UINT8(SOS, o.ack_type); TEST_ASSERT_EQUAL_UINT8(42, o.ack_seq); TEST_ASSERT_EQUAL_UINT16(1001, o.id);

  Msg acc; acc.net = 1; acc.type = ACCEPTED; acc.id = 1001; acc.req_no = 3;
  TEST_ASSERT_EQUAL_UINT8(3, roundtrip(acc, 10).req_no);
  Msg dn; dn.net = 1; dn.type = DONE; dn.id = 1001; dn.req_no = 4;
  TEST_ASSERT_EQUAL_UINT8(4, roundtrip(dn, 10).req_no);
  Msg hd; hd.net = 1; hd.type = HEARD; hd.id = 1001; hd.wid = 9;
  TEST_ASSERT_EQUAL_UINT8(9, roundtrip(hd, 10).wid);

  const uint8_t flagTypes[] = {SOS, AUTO_SOS, SAFE};
  for (unsigned i = 0; i < 3; i++) {
    Msg s; s.net = 1; s.type = flagTypes[i]; s.id = 1001; s.flags = 0x3A; s.batt = 225;
    o = roundtrip(s, 11);
    TEST_ASSERT_EQUAL_UINT8(0x3A, o.flags); TEST_ASSERT_EQUAL_UINT8(225, o.batt);
  }
  Msg st; st.net = 1; st.type = STATUS; st.id = 1001; st.flags = 0x11; st.batt = 210; st.wid = 5;
  o = roundtrip(st, 12);
  TEST_ASSERT_EQUAL_UINT8(0x11, o.flags); TEST_ASSERT_EQUAL_UINT8(210, o.batt); TEST_ASSERT_EQUAL_UINT8(5, o.wid);
  Msg ba; ba.net = 1; ba.type = BOX_ACK; ba.id = 1001; ba.ack_type = ACCEPTED; ba.ack_seq = 77;
  o = roundtrip(ba, 11);
  TEST_ASSERT_EQUAL_UINT8(ACCEPTED, o.ack_type); TEST_ASSERT_EQUAL_UINT8(77, o.ack_seq);
  Msg pg; pg.net = 1; pg.type = PING; pg.n = 513;
  TEST_ASSERT_EQUAL_UINT16(513, roundtrip(pg, 11).n);
}

void test_decode_rejects_bad_input() {
  Msg m; m.net = 1; m.type = SOS; m.id = 1001;
  uint8_t b[MAX_LEN];
  const size_t n = encode(m, b, sizeof b);
  Msg out;
  TEST_ASSERT_EQUAL_INT(BAD_LENGTH, decode(b, n - 1, 1, out));      // สั้นไป 1 ไบต์
  TEST_ASSERT_EQUAL_INT(BAD_LENGTH, decode(b, 3, 1, out));
  TEST_ASSERT_EQUAL_INT(WRONG_NET, decode(b, n, 2, out));           // คนละพื้นที่
  b[1] = 0x55;
  TEST_ASSERT_EQUAL_INT(UNKNOWN_TYPE, decode(b, n, 1, out));
  TEST_ASSERT_EQUAL_UINT(0, encode(m, b, 5));                        // ที่ไม่พอ
}

void test_flags_pack_and_try_caps_at_15() {
  const uint8_t f = makeFlags(true, true, false, true, 3);
  TEST_ASSERT_TRUE(flagProbeWet(f)); TEST_ASSERT_TRUE(flagBed(f)); TEST_ASSERT_FALSE(flagLowBatt(f)); TEST_ASSERT_TRUE(flagOpenReq(f));
  TEST_ASSERT_EQUAL_UINT8(3, flagTry(f));
  TEST_ASSERT_EQUAL_UINT8(15, flagTry(withTry(f, 40)));
  TEST_ASSERT_EQUAL_UINT8(f & 0x0F, withTry(f, 9) & 0x0F);   // เปลี่ยนเฉพาะ try
}

void test_battery_byte_is_20mV_steps() {
  TEST_ASSERT_EQUAL_UINT8(231, battToByte(4.62f));
  TEST_ASSERT_EQUAL_UINT8(195, battToByte(3.9f));
  TEST_ASSERT_EQUAL_UINT8(0, battToByte(0));
  TEST_ASSERT_EQUAL_UINT8(255, battToByte(6.0f));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.62f, battFromByte(231));
}

void test_airtime_matches_contract_4_3() {
  // data-contract 4.3: 12 ไบต์ = 144.4 ms · 13 ไบต์ = 164.9 ms · เสียงนำ 500 + 12 ไบต์ = 2,159.6 ms
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 144.4f, airtimeMs(12, 9, 125.0f, 5, 8));
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 164.9f, airtimeMs(13, 9, 125.0f, 5, 8));
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 2159.6f, airtimeMs(12, 9, 125.0f, 5, 500));
}

void test_radio_config_is_legal() {
  TEST_ASSERT_TRUE(radio_cfg::FREQ_MHZ >= 920.0f && radio_cfg::FREQ_MHZ <= 925.0f);
  TEST_ASSERT_TRUE(radio_cfg::FREQ_KHZ != 915000);
  TEST_ASSERT_TRUE(radio_cfg::TX_DBM + radio_cfg::ANT_GAIN_DBI <= 17);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_lengths_match_contract_table);
  RUN_TEST(test_header_bytes_and_little_endian_id_and_zero_mic);
  RUN_TEST(test_roundtrip_every_type);
  RUN_TEST(test_decode_rejects_bad_input);
  RUN_TEST(test_flags_pack_and_try_caps_at_15);
  RUN_TEST(test_battery_byte_is_20mV_steps);
  RUN_TEST(test_airtime_matches_contract_4_3);
  RUN_TEST(test_radio_config_is_legal);
  return UNITY_END();
}
