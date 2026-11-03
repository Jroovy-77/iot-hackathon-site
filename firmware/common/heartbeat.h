// นัดเวลาส่ง "ยังอยู่" (STATUS) ของกล่องบ้าน — data-contract 4.3
// ครั้งแรกสุ่ม 0–30 นาทีหลังเปิดเครื่อง · ปกติทุก 6 ชม. · ช่วงมีคำเตือนค้างทุก 1 ชม. · ทุกรอบสุ่ม ±10 นาที
// ส่งทันทีเมื่อ น้ำขึ้น/ลง · ถ่านข้ามเกณฑ์ · ได้ WARN ใหม่ (สุ่มหน่วง 0–10 นาที)
#pragma once
#include <stdint.h>

#include "reliable.h"   // RandFn

class Heartbeat {
 public:
  explicit Heartbeat(RandFn rnd) : rnd_(rnd) {}

  void begin(uint32_t nowS) { nextS_ = nowS + rnd_(0, timing::hbFirstMaxS()); }
  bool due(uint32_t nowS) const { return (int32_t)(nowS - nextS_) >= 0; }
  // ส่งแล้ว (หรือเริ่มส่งแล้ว) → นัดรอบถัดไป
  void sent(uint32_t nowS, bool warnActive);
  // ขอให้ส่งเร็วขึ้น ภายใน maxDelayS (ไม่เลื่อนนัดที่เร็วกว่าอยู่แล้วให้ช้าลง)
  void kick(uint32_t nowS, uint32_t maxDelayS = 0);
  uint32_t nextS() const { return nextS_; }

 private:
  RandFn rnd_;
  uint32_t nextS_ = 0;
};
