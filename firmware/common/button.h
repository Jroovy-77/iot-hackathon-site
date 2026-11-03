// ปุ่มกดสั้น / กดค้าง 2 วิ (data-contract 4.6) — ไม่ผูกกับบอร์ด ใส่สถานะขากับเวลาเข้ามาเอง
// SHORT = ปล่อยก่อนครบ 2 วิ · LONG = ค้างครบ 2 วิ (ขึ้นทันทีตอนครบ ไม่ต้องรอปล่อย) · STUCK = ค้างเกิน 30 วิ
#pragma once
#include <stdint.h>

#include "timing.h"

class Button {
 public:
  enum Event { NONE = 0, SHORT, LONG, STUCK };

  explicit Button(uint32_t holdMs = timing::HOLD_MS, uint32_t debounceMs = timing::DEBOUNCE_MS,
                  uint32_t stuckMs = timing::STUCK_MS)
      : holdMs_(holdMs), debounceMs_(debounceMs), stuckMs_(stuckMs) {}

  // เรียกบ่อย ๆ (ทุก ~10 ms) · pressed = ขาอ่านได้ว่ากดอยู่
  Event update(bool pressed, uint32_t nowMs);

  bool down() const { return stable_; }           // กดอยู่ (หลังกรองเด้ง)
  uint32_t heldMs(uint32_t nowMs) const { return stable_ ? nowMs - downAt_ : 0; }
  bool stuck() const { return stuckFired_; }

 private:
  uint32_t holdMs_, debounceMs_, stuckMs_;
  bool raw_ = false, stable_ = false;
  bool started_ = false;
  uint32_t rawAt_ = 0, downAt_ = 0;
  bool longFired_ = false, stuckFired_ = false;
};
