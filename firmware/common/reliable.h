// ส่งซ้ำเมื่อไม่ได้ ACK (data-contract 4.5) — ใช้ที่กล่องบ้าน
// ข้อความที่คนกด (HEARD SOS AUTO_SOS SAFE): ส่ง → ฟัง 3 วิ → ไม่ได้ ACK → สุ่มรอ 5–15 วิ ส่งใหม่ seq เดิม (try +1)
//   ครบ 5 ครั้ง → ทุก 60 วิ จนครบ 1 ชม. → ทุก 5 นาที (ไม่ยอมแพ้)
// STATUS: ลองไม่เกิน 3 ครั้ง แล้วรอรอบถัดไป
#pragma once
#include <stdint.h>

#include "protocol.h"
#include "timing.h"

typedef uint32_t (*RandFn)(uint32_t lo, uint32_t hi);   // สุ่มในช่วง [lo, hi]

class Reliable {
 public:
  enum Kind { USER, STATUS_ONLY };

  explicit Reliable(RandFn rnd) : rnd_(rnd) {}

  // เริ่มส่งข้อความใหม่ (แทนของเดิมถ้ามี) · seq ของ m ต้องเป็นเลขใหม่
  void start(const proto::Msg& m, Kind kind, uint32_t nowMs);
  // ถึงเวลาส่งไหม (ถ้าใช่ เรียก take() แล้วส่งทันที)
  bool due(uint32_t nowMs) const { return active_ && !waitingAck_ && (int32_t)(nowMs - nextAt_) >= 0; }
  // ข้อความที่ต้องส่งรอบนี้ (ใส่ try ใน flags ให้แล้ว) และเริ่มนับรอ ACK
  proto::Msg take(uint32_t nowMs);
  // เรียกทุกรอบ loop: หมดเวลารอ ACK → นัดส่งครั้งถัดไป
  void tick(uint32_t nowMs);
  // ได้ ACK — คืน true ถ้าตรงกับข้อความที่รออยู่
  bool onAck(uint8_t ackType, uint8_t ackSeq);
  void cancel() { active_ = false; waitingAck_ = false; }

  bool active() const { return active_; }
  bool waitingAck() const { return waitingAck_; }
  bool gaveUp() const { return gaveUp_; }
  uint8_t tries() const { return tries_; }
  uint8_t misses() const { return misses_; }
  bool retrying() const { return active_ && misses_ > 0; }   // ป้าย "ส่งไม่ถึง" (มีเฉพาะที่กล่อง)
  const proto::Msg& msg() const { return msg_; }
  uint32_t nextAt() const { return nextAt_; }
  // ถึงเวลาพูด V_RETRY ไหม (หลังพลาดครั้งที่ 3 แล้วทุก 10 นาทีในชั่วโมงแรก → ทุก 30 นาที) · คืน true ครั้งเดียวต่อรอบ
  bool takeRetryVoice(uint32_t nowMs);

 private:
  void scheduleNext(uint32_t nowMs);

  RandFn rnd_;
  proto::Msg msg_;
  Kind kind_ = USER;
  bool active_ = false, waitingAck_ = false, gaveUp_ = false;
  uint8_t tries_ = 0, misses_ = 0;
  uint32_t firstAt_ = 0, sentAt_ = 0, nextAt_ = 0, ackDeadline_ = 0;
  bool voiceArmed_ = false;
  uint32_t voiceAt_ = 0;
};
