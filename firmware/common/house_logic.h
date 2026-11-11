// ตรรกะของกล่องบ้าน (ไม่ผูกกับบอร์ด) — data-contract ข้อ 3 และ 4.3–4.6
// ฝั่งบอร์ด (house/main.cpp) อ่านปุ่ม/วิทยุ/โพรบ/ถ่าน ใส่เข้ามา แล้วเอาข้อความที่ต้องส่ง เสียง และสีไฟออกไปใช้
#pragma once
#include <stdint.h>

#include "button.h"
#include "heartbeat.h"
#include "protocol.h"
#include "reliable.h"

enum Voice : uint8_t {   // เลขตรงกับ data-contract ข้อ 3 (V_WARN = 1→2/3/4→5)
  V_NONE = 0, V_WARN = 1, V_HEARD = 6, V_SOS_SENT = 7, V_RETRY = 8, V_ACCEPTED = 9,
  V_DONE = 10, V_AUTO_SOS = 11, V_LOW_BATT = 12, V_SAFE = 13,
};
const char* voiceName(uint8_t v);

struct Rgb { uint8_t r, g, b; };

class HouseBox {
 public:
  enum State : uint8_t { S_IDLE, S_WARN, S_HEARD, S_SOS, S_AUTO_SOS, S_ACCEPTED, S_DONE, S_SAFE };

  HouseBox(uint16_t id, bool bed, RandFn rnd);
  void begin(uint32_t nowMs);

  // ---- ใส่เข้า
  void onRed(Button::Event e, uint32_t nowMs);
  void onGreen(Button::Event e, uint32_t nowMs);
  void onRadio(const proto::Msg& m, uint32_t nowMs);
  void onProbe(bool wet, uint32_t nowMs);          // ผลอ่านสายวัดน้ำ 1 ครั้ง
  void onBattery(float volts, uint32_t nowMs);     // แรงดันถ่าน 3 ก้อน (0 = ไม่มีถ่าน)
  void tick(uint32_t nowMs);

  // ---- เอาออก
  bool popTx(proto::Msg& out, uint32_t nowMs);     // ข้อความที่ต้องส่งตอนนี้ (ทีละข้อความ)
  uint8_t popVoice();                              // V_NONE = ไม่มี
  Rgb light(uint32_t nowMs) const;                 // สีของแหวนไฟตอนนี้ (ก่อนลดความสว่าง)
  bool probeDue(uint32_t nowMs) const { return usesProbe() && (int32_t)(nowMs - probeAt_) >= 0; }
  bool usesProbe() const { return bed_; }

  State state() const { return state_; }
  bool retrying() const { return user_.retrying(); }
  bool waitingAck() const { return user_.active(); }
  bool openReq() const { return openReq_; }
  bool probeWet() const { return probeWet_; }
  bool lowBatt() const { return lowBatt_; }
  uint8_t lastWid() const { return lastWid_; }
  uint8_t when() const { return when_; }           // วันนี้/คืนนี้/พรุ่งนี้ ของคำเตือนล่าสุด (ให้ฝั่งเสียงเลือกคำ)
  uint8_t lastVoice() const { return lastVoice_; }
  static const char* stateName(uint8_t s);

 private:
  proto::Msg makeUp(uint8_t type);
  void sendUser(uint8_t type, uint32_t nowMs);
  void say(uint8_t v);
  void pressed(uint32_t nowMs) { lastPressMs_ = nowMs; }
  void boxAck(const proto::Msg& m);

  uint16_t id_;
  bool bed_;
  RandFn rnd_;
  Reliable user_, status_;
  Heartbeat hb_;
  State state_ = S_IDLE;
  uint8_t seq_ = 0;
  bool openReq_ = false;
  uint8_t lastWid_ = 0, when_ = 0;
  uint32_t warnVoiceAtMs_ = 0;
  uint8_t warnVoiceRepeats_ = 0;   // พูดเตือนซ้ำไปแล้วกี่ครั้ง (ไม่นับครั้งแรก) ใช้เลือกช่วงห่าง
  bool warnSeen_ = false;
  uint32_t warnHeardMs_ = 0;
  // สายวัดน้ำ
  uint32_t probeAt_ = 0, wetSinceMs_ = 0, tWetMs_ = 0, lastPressMs_ = 0;
  bool wetSeen_ = false, probeWet_ = false;
  // ถ่าน
  float battV_ = 0;
  bool lowBatt_ = false;
  // ACCEPTED / DONE ที่เคยพูดแล้ว (ข้อความซ้ำตอบ BOX_ACK อย่างเดียว)
  uint8_t heardReqAccepted_ = 0, heardReqDone_ = 0;
  // คำขอใหม่ (กดแดงค้าง / ขอแทน): ล้างเลขที่จำไว้ เพราะตัวรับที่รีเซ็ตจะเริ่มเลขคำขอที่ 1 ใหม่ (พบ 9 พ.ย. 2569)
  void forgetReqNos() { heardReqAccepted_ = heardReqDone_ = 0; }
  // คิว
  proto::Msg boxAcks_[4];
  uint8_t boxAckN_ = 0;
  uint8_t voices_[4];
  uint8_t voiceN_ = 0;
  uint8_t lastVoice_ = V_NONE;
};
