#include "reliable.h"

using namespace timing;

void Reliable::start(const proto::Msg& m, Kind kind, uint32_t nowMs) {
  msg_ = m;
  kind_ = kind;
  active_ = true;
  waitingAck_ = false;
  gaveUp_ = false;
  tries_ = misses_ = 0;
  firstAt_ = nowMs;
  voiceArmed_ = false;
  nextAt_ = nowMs + rnd_(0, PRE_DELAY_MAX_MS);   // สุ่มหน่วง 0–3 วิ ก่อนส่ง
}

proto::Msg Reliable::take(uint32_t nowMs) {
  if (tries_ < 255) tries_++;
  if (tries_ == 1) firstAt_ = nowMs;
  sentAt_ = nowMs;
  waitingAck_ = true;
  ackDeadline_ = nowMs + ACK_WAIT_MS;
  proto::Msg out = msg_;
  if (out.type == proto::SOS || out.type == proto::AUTO_SOS || out.type == proto::STATUS || out.type == proto::SAFE)
    out.flags = proto::withTry(out.flags, tries_);
  return out;
}

void Reliable::tick(uint32_t nowMs) {
  if (!active_ || !waitingAck_) return;
  if ((int32_t)(nowMs - ackDeadline_) < 0) return;
  waitingAck_ = false;   // หมดเวลารอ ACK
  if (misses_ < 255) misses_++;
  if (kind_ == STATUS_ONLY && tries_ >= STATUS_TRIES) {
    active_ = false;
    gaveUp_ = true;
    return;
  }
  if (kind_ == USER && misses_ == RETRY_VOICE_AFTER && !voiceArmed_) {
    voiceArmed_ = true;
    voiceAt_ = nowMs;   // พูดทันทีที่พลาดครบ 3 ครั้ง
  }
  scheduleNext(nowMs);
}

void Reliable::scheduleNext(uint32_t nowMs) {
  if (tries_ < FAST_TRIES) {
    nextAt_ = nowMs + rnd_(RETRY_MIN_MS, RETRY_MAX_MS);
  } else if (sentAt_ - firstAt_ < SLOW_PHASE_MS) {
    nextAt_ = sentAt_ + SLOW_RETRY_MS;
  } else {
    nextAt_ = sentAt_ + SLOWER_RETRY_MS;
  }
}

bool Reliable::onAck(uint8_t ackType, uint8_t ackSeq) {
  if (!active_ || ackType != msg_.type || ackSeq != msg_.seq) return false;
  active_ = false;
  waitingAck_ = false;
  return true;
}

bool Reliable::takeRetryVoice(uint32_t nowMs) {
  if (!active_ || !voiceArmed_) return false;
  if ((int32_t)(nowMs - voiceAt_) < 0) return false;
  const uint32_t gap = (nowMs - firstAt_ < SLOW_PHASE_MS) ? RETRY_VOICE_EARLY_MS : RETRY_VOICE_LATE_MS;
  voiceAt_ = nowMs + gap;
  return true;
}
