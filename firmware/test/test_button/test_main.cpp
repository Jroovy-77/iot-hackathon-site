// ปุ่มกดสั้น / กดค้าง 2 วิ / ปุ่มค้าง 30 วิ / กรองเด้ง
#include <unity.h>

#include "button.h"

void setUp() {}
void tearDown() {}

// กดค้าง from..to (ms) ทีละ 10 ms แล้วนับเหตุการณ์
struct Count { int shortN = 0, longN = 0, stuckN = 0; uint32_t longAt = 0; };
static void feed(Button& b, bool pressed, uint32_t from, uint32_t to, Count& c) {
  for (uint32_t t = from; t < to; t += 10) {
    const Button::Event e = b.update(pressed, t);
    if (e == Button::SHORT) c.shortN++;
    if (e == Button::LONG) { c.longN++; c.longAt = t; }
    if (e == Button::STUCK) c.stuckN++;
  }
}

void test_short_press_fires_on_release() {
  Button b; Count c;
  feed(b, false, 0, 100, c);
  feed(b, true, 100, 600, c);     // กด 0.5 วิ
  TEST_ASSERT_EQUAL_INT(0, c.shortN);
  feed(b, false, 600, 800, c);
  TEST_ASSERT_EQUAL_INT(1, c.shortN);
  TEST_ASSERT_EQUAL_INT(0, c.longN);
}

void test_long_press_fires_once_at_2s_while_held() {
  Button b; Count c;
  feed(b, false, 0, 100, c);
  feed(b, true, 100, 5000, c);    // กดค้าง 4.9 วิ
  TEST_ASSERT_EQUAL_INT(1, c.longN);
  TEST_ASSERT_UINT32_WITHIN(20, 100 + 2000, c.longAt);   // ขึ้นตอนครบ 2 วิ ไม่ต้องรอปล่อย
  feed(b, false, 5000, 5200, c);
  TEST_ASSERT_EQUAL_INT(0, c.shortN);                     // ปล่อยหลังกดค้าง ไม่นับเป็นกดสั้น
}

void test_1_9s_is_still_short() {
  Button b; Count c;
  feed(b, false, 0, 100, c);
  feed(b, true, 100, 2000, c);
  feed(b, false, 2000, 2200, c);
  TEST_ASSERT_EQUAL_INT(1, c.shortN);
  TEST_ASSERT_EQUAL_INT(0, c.longN);
}

void test_bounce_shorter_than_debounce_is_ignored() {
  Button b; Count c;
  feed(b, false, 0, 100, c);
  // เด้ง 20 ms สามครั้ง
  for (int i = 0; i < 3; i++) { b.update(true, 100 + i * 40); b.update(false, 120 + i * 40); }
  feed(b, false, 220, 500, c);
  TEST_ASSERT_EQUAL_INT(0, c.shortN);
  TEST_ASSERT_FALSE(b.down());
}

void test_stuck_button_after_30s() {
  Button b; Count c;
  feed(b, false, 0, 100, c);
  feed(b, true, 100, 31000, c);
  TEST_ASSERT_EQUAL_INT(1, c.longN);
  TEST_ASSERT_EQUAL_INT(1, c.stuckN);
  TEST_ASSERT_TRUE(b.stuck());
}

void test_held_at_power_on_is_not_a_press() {
  Button b; Count c;
  feed(b, true, 0, 3000, c);      // กดค้างตั้งแต่เปิดเครื่อง
  TEST_ASSERT_EQUAL_INT(0, c.longN);
  feed(b, false, 3000, 3200, c);
  TEST_ASSERT_EQUAL_INT(0, c.shortN);
}

void test_millis_wraparound() {
  Button b; Count c;
  const uint32_t t0 = 0xFFFFFF00u;   // millis() ใกล้วนรอบ
  b.update(false, t0);
  for (uint32_t k = 0; k < 2500; k += 10) {
    const Button::Event e = b.update(true, t0 + 100 + k);
    if (e == Button::LONG) c.longN++;
  }
  TEST_ASSERT_EQUAL_INT(1, c.longN);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_short_press_fires_on_release);
  RUN_TEST(test_long_press_fires_once_at_2s_while_held);
  RUN_TEST(test_1_9s_is_still_short);
  RUN_TEST(test_bounce_shorter_than_debounce_is_ignored);
  RUN_TEST(test_stuck_button_after_30s);
  RUN_TEST(test_held_at_power_on_is_not_a_press);
  RUN_TEST(test_millis_wraparound);
  return UNITY_END();
}
