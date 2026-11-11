#include "house_logic.h"

#include "radio_config.h"

using namespace proto;
using namespace timing;

namespace {
bool reached(uint32_t now, uint32_t at) { return (int32_t)(now - at) >= 0; }
uint32_t later(uint32_t a, uint32_t b) { return (int32_t)(a - b) >= 0 ? a : b; }
}  // namespace

const char* voiceName(uint8_t v) {
  switch (v) {
    case V_WARN: return "V_WARN";
    case V_HEARD: return "V_HEARD";
    case V_SOS_SENT: return "V_SOS_SENT";
    case V_RETRY: return "V_RETRY";
    case V_ACCEPTED: return "V_ACCEPTED";
    case V_DONE: return "V_DONE";
    case V_AUTO_SOS: return "V_AUTO_SOS";
    case V_LOW_BATT: return "V_LOW_BATT";
    case V_SAFE: return "V_SAFE";
    default: return "-";
  }
}

const char* HouseBox::stateName(uint8_t s) {
  static const char* const names[] = {"idle", "warn", "heard", "sos", "auto_sos", "accepted", "done", "safe"};
  return s <= S_SAFE ? names[s] : "?";
}

HouseBox::HouseBox(uint16_t id, bool bed, RandFn rnd)
    : id_(id), bed_(bed), rnd_(rnd), user_(rnd), status_(rnd), hb_(rnd) {}

void HouseBox::begin(uint32_t nowMs) {
  hb_.begin(nowMs / 1000);
  probeAt_ = nowMs;
  lastPressMs_ = nowMs;
}

Msg HouseBox::makeUp(uint8_t type) {
  Msg m;
  m.net = radio_cfg::NET_ID;
  m.type = type;
  m.id = id_;
  m.seq = ++seq_;
  m.flags = makeFlags(probeWet_, bed_, lowBatt_, openReq_, 0);
  m.batt = battToByte(battV_);
  m.wid = lastWid_;
  return m;
}

void HouseBox::sendUser(uint8_t type, uint32_t nowMs) { user_.start(makeUp(type), Reliable::USER, nowMs); }

void HouseBox::say(uint8_t v) {
  lastVoice_ = v;
  if (voiceN_ == sizeof(voices_)) {   // คิวเต็ม: ทิ้งอันเก่าสุด
    for (uint8_t i = 1; i < voiceN_; i++) voices_[i - 1] = voices_[i];
    voiceN_--;
  }
  voices_[voiceN_++] = v;
}

void HouseBox::boxAck(const Msg& m) {
  if (boxAckN_ == sizeof(boxAcks_) / sizeof(boxAcks_[0])) return;
  Msg a;
  a.net = radio_cfg::NET_ID;
  a.type = BOX_ACK;
  a.id = id_;
  a.seq = ++seq_;
  a.ack_type = m.type;
  a.ack_seq = m.seq;
  boxAcks_[boxAckN_++] = a;
}

void HouseBox::onRed(Button::Event e, uint32_t nowMs) {
  if (e == Button::NONE || e == Button::STUCK) return;   // ปุ่มค้าง: ไม่ส่งอะไร
  pressed(nowMs);
  if (e != Button::LONG) return;                          // แดงกดสั้น = ไม่ทำอะไร
  forgetReqNos();
  openReq_ = true;
  if (state_ != S_ACCEPTED) state_ = S_SOS;
  sendUser(SOS, nowMs);
}

void HouseBox::onGreen(Button::Event e, uint32_t nowMs) {
  if (e == Button::NONE || e == Button::STUCK) return;
  pressed(nowMs);
  if (state_ == S_WARN) {   // ตอนเตือน กดสั้นหรือค้าง = ได้ยินแล้ว (ทำตามเสียงต้องได้ผลเสมอ)
    state_ = S_HEARD;
    sendUser(HEARD, nowMs);
    return;
  }
  if (e == Button::SHORT) {   // ฟังข้อความล่าสุดซ้ำ ไม่ส่งวิทยุ
    if (lastVoice_ != V_NONE) {
      const uint8_t keep = lastVoice_;
      say(keep);
    }
    return;
  }
  sendUser(SAFE, nowMs);      // กดค้าง = ปลอดภัย (ไฟเขียวเมื่อได้ ACK)
}

void HouseBox::onRadio(const Msg& m, uint32_t nowMs) {
  if (m.type == WARN && (m.id == ID_ALL || m.id == id_)) {
    warnSeen_ = true;
    warnHeardMs_ = nowMs;            // นับทุกครั้งรวมที่ส่งซ้ำ = คำเตือนยังค้าง
    if (m.wid == lastWid_) return;   // คำเตือนเดิมที่ส่งซ้ำ
    lastWid_ = m.wid;
    when_ = m.when;
    if (!openReq_) {
      state_ = S_WARN;
      say(V_WARN);
      warnVoiceRepeats_ = 0;
      warnVoiceAtMs_ = nowMs + warnRepeatS(warnVoiceRepeats_) * 1000;
    }
    hb_.kick(nowMs / 1000, hbWarnKickS());
    return;
  }
  if (m.id != id_) return;
  switch (m.type) {
    case ACK:
      if (user_.onAck(m.ack_type, m.ack_seq)) {
        switch (m.ack_type) {
          case HEARD: say(V_HEARD); break;
          case SOS: say(V_SOS_SENT); break;
          case AUTO_SOS: say(V_AUTO_SOS); break;
          case SAFE: state_ = S_SAFE; openReq_ = false; say(V_SAFE); break;
        }
      }
      status_.onAck(m.ack_type, m.ack_seq);
      break;
    case ACCEPTED:
      boxAck(m);
      if (m.req_no != heardReqAccepted_) {
        heardReqAccepted_ = m.req_no;
        state_ = S_ACCEPTED;
        openReq_ = true;
        if (user_.active() && (user_.msg().type == SOS || user_.msg().type == AUTO_SOS)) user_.cancel();   // ตัวรับได้คำขอแล้ว
        say(V_ACCEPTED);
      }
      break;
    case DONE:
      boxAck(m);
      if (m.req_no != heardReqDone_) {
        heardReqDone_ = m.req_no;
        state_ = S_DONE;
        openReq_ = false;
        if (user_.active() && (user_.msg().type == SOS || user_.msg().type == AUTO_SOS)) user_.cancel();
        say(V_DONE);
      }
      break;
  }
}

void HouseBox::onProbe(bool wet, uint32_t nowMs) {
  if (!usesProbe()) return;
  if (wet) {
    if (!wetSeen_) {
      wetSeen_ = true;
      wetSinceMs_ = nowMs;
    }
    if (!probeWet_ && nowMs - wetSinceMs_ >= WATER_CONFIRM_MS) {   // แตะน้ำต่อเนื่อง 30 วิ = น้ำขึ้น
      probeWet_ = true;
      tWetMs_ = nowMs;
      hb_.kick(nowMs / 1000);
    }
    probeAt_ = nowMs + (probeWet_ ? PROBE_PERIOD_MS : PROBE_FAST_MS);
  } else {
    wetSeen_ = false;
    if (probeWet_) {
      probeWet_ = false;
      hb_.kick(nowMs / 1000);
    }
    probeAt_ = nowMs + PROBE_PERIOD_MS;
  }
}

void HouseBox::onBattery(float volts, uint32_t nowMs) {
  battV_ = volts;
  const float limit = lowBatt_ ? LOW_BATT_V + 0.05f : LOW_BATT_V;   // กันกระพือรอบเกณฑ์
  const bool low = volts > NO_BATT_V && volts < limit;
  if (low == lowBatt_) return;
  lowBatt_ = low;
  hb_.kick(nowMs / 1000);
  if (low) say(V_LOW_BATT);
}

void HouseBox::tick(uint32_t nowMs) {
  user_.tick(nowMs);
  status_.tick(nowMs);
  if (user_.takeRetryVoice(nowMs)) say(V_RETRY);

  if (state_ == S_WARN && reached(nowMs, warnVoiceAtMs_)) {   // พูดเตือนซ้ำ (10 ครั้งแรกทุก 1 นาที แล้วทุก 5 นาที) จนกว่าจะกดเขียว
    say(V_WARN);
    if (warnVoiceRepeats_ < 255) warnVoiceRepeats_++;
    warnVoiceAtMs_ = nowMs + warnRepeatS(warnVoiceRepeats_) * 1000;
  }

  if (bed_ && probeWet_ && !openReq_) {   // ขอแทน: น้ำขึ้น + ไม่มีใครกด 2 ชม.
    const uint32_t from = later(tWetMs_, lastPressMs_);
    if (nowMs - from >= autoSosS() * 1000) {
      forgetReqNos();
      openReq_ = true;
      state_ = S_AUTO_SOS;
      sendUser(AUTO_SOS, nowMs);
    }
  }

  const uint32_t nowS = nowMs / 1000;
  if (hb_.due(nowS)) {
    status_.start(makeUp(STATUS), Reliable::STATUS_ONLY, nowMs);
    const bool warnOn = warnSeen_ && nowMs - warnHeardMs_ < warnKeepS() * 1000;   // กดเขียวแล้วก็ยังส่งทุก 1 ชม.
    hb_.sent(nowS, state_ == S_WARN || warnOn);
  }
}

bool HouseBox::popTx(Msg& out, uint32_t nowMs) {
  if (boxAckN_) {
    out = boxAcks_[0];
    for (uint8_t i = 1; i < boxAckN_; i++) boxAcks_[i - 1] = boxAcks_[i];
    boxAckN_--;
    return true;
  }
  if (user_.due(nowMs)) {
    out = user_.take(nowMs);
    return true;
  }
  if (status_.due(nowMs)) {
    out = status_.take(nowMs);
    return true;
  }
  return false;
}

uint8_t HouseBox::popVoice() {
  if (!voiceN_) return V_NONE;
  const uint8_t v = voices_[0];
  for (uint8_t i = 1; i < voiceN_; i++) voices_[i - 1] = voices_[i];
  voiceN_--;
  return v;
}

Rgb HouseBox::light(uint32_t nowMs) const {
  const Rgb OFF = {0, 0, 0}, ORANGE = {255, 80, 0}, GREEN = {0, 255, 0}, RED = {255, 0, 0}, YELLOW = {255, 170, 0};
  if (user_.active()) {   // รอ ACK: กะพริบเร็วด้วยสีที่กำลังขอ ไม่มีเสียง
    const uint8_t t = user_.msg().type;
    const Rgb c = (t == SOS || t == AUTO_SOS) ? RED : GREEN;
    return (nowMs / 150) % 2 ? c : OFF;
  }
  switch (state_) {
    case S_WARN: return (nowMs / 500) % 2 ? ORANGE : OFF;
    case S_HEARD: case S_DONE: case S_SAFE: return GREEN;
    case S_SOS: case S_AUTO_SOS: return RED;
    case S_ACCEPTED: return YELLOW;
    default: return OFF;
  }
}
