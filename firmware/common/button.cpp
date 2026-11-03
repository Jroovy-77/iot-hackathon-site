#include "button.h"

Button::Event Button::update(bool pressed, uint32_t nowMs) {
  if (!started_) {   // ครั้งแรก: จำสถานะเริ่มต้น ไม่นับเป็นการกด (กันปุ่มค้างตอนเปิดเครื่อง)
    started_ = true;
    raw_ = stable_ = pressed;
    rawAt_ = downAt_ = nowMs;
    longFired_ = stuckFired_ = pressed;
    return NONE;
  }
  if (pressed != raw_) {   // ขาเปลี่ยน: เริ่มนับเวลากรองเด้งใหม่
    raw_ = pressed;
    rawAt_ = nowMs;
  }
  if (raw_ != stable_ && nowMs - rawAt_ >= debounceMs_) {
    stable_ = raw_;
    if (stable_) {   // เริ่มกด (นับเวลาจากตอนขาเปลี่ยนจริง)
      downAt_ = rawAt_;
      longFired_ = stuckFired_ = false;
    } else {         // ปล่อย
      const bool wasLong = longFired_;
      longFired_ = stuckFired_ = false;
      if (!wasLong) return SHORT;
      return NONE;
    }
  }
  if (stable_) {
    const uint32_t held = nowMs - downAt_;
    if (!stuckFired_ && held >= stuckMs_) {
      stuckFired_ = true;
      longFired_ = true;
      return STUCK;
    }
    if (!longFired_ && held >= holdMs_) {
      longFired_ = true;
      return LONG;
    }
  }
  return NONE;
}
