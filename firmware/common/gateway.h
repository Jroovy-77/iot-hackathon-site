// ตรรกะของตัวรับ (ไม่ผูกกับบอร์ด) — data-contract ข้อ 2, 4.3–4.5, 5
// ฝั่งบอร์ด (receiver/main.cpp) ใส่ข้อความวิทยุและบรรทัดคำสั่งจากเว็บเข้ามา แล้วเอาข้อความวิทยุและบรรทัด JSON ออกไป
// บรรทัดที่ออกทาง Serial: snap / hb / res (JSON บรรทัดละก้อน) · บรรทัดที่ขึ้นต้นด้วย # = log ให้คนอ่าน (แดชบอร์ดทิ้ง)
#pragma once
#include <stddef.h>
#include <stdint.h>

#include <string>

#include "houses.h"
#include "protocol.h"

class LineSink {
 public:
  virtual ~LineSink() {}
  virtual void line(const std::string& s) = 0;   // ไม่รวม \n
};

class Gateway {
 public:
  enum State : uint8_t { S_IDLE, S_WARN, S_HEARD, S_SILENT, S_SOS, S_ACCEPTED, S_DONE, S_AUTO_SOS, S_SAFE };
  static const size_t MAX_HOUSES = 8;
  static const size_t MAX_EVENTS = 50;
  static const size_t TXQ = 8;

  struct Req {
    bool open = false, autoKind = false, confirmed = false, accepted = false, delivered = false, cancelled = false;
    uint8_t no = 0;
    uint16_t dup = 0;
    uint32_t tOpen = 0, tAccept = 0, cancelT = 0;
  };
  struct Down {   // ACCEPTED / DONE ที่ส่งซ้ำจนได้ BOX_ACK
    bool active = false;
    uint8_t type = 0, seq = 0, reqNo = 0, sent = 0;
    uint32_t nextS = 0;
  };
  struct House {
    const HouseInfo* info = 0;
    State state = S_IDLE;
    uint32_t tState = 0;
    bool gotWarn = false;
    bool everSeen = false;
    uint32_t lastSeen = 0;
    bool offline = false;
    uint32_t tOffline = 0;
    bool hasSignal = false;
    float rssi = 0, snr = 0;
    bool hasBatt = false;
    float battV = 0;
    bool lowBatt = false;
    bool probeWet = false;
    uint32_t tWet = 0;
    uint8_t tryNo = 1;
    Req req;
    Down down;
    bool hasLast = false;
    uint8_t lastType = 0, lastSeq = 0;
  };

  Gateway(const HouseInfo* houses, size_t n, const char* name, LineSink& out);
  void begin(uint32_t nowMs);

  void onRadio(const proto::Msg& m, float rssi, float snr, uint32_t nowMs);
  void onLine(const char* line, uint32_t nowMs);    // คำสั่งจากเว็บ 1 บรรทัด
  void tick(uint32_t nowMs);                        // hb, snap, บ้านเงียบ, ขาดการติดต่อ, ส่งซ้ำ

  bool popTx(proto::Msg& out);                      // ข้อความวิทยุที่ต้องส่ง
  void noteAirtime(float ms, uint32_t nowMs);       // ส่งไปแล้วกี่ ms (คิด air_pct)
  float airPct(uint32_t nowMs) const;

  // ให้เทสต์อ่านสถานะ
  const House* house(uint16_t id) const;
  uint32_t rev() const { return rev_; }
  void writeSnap(uint32_t nowMs);
  static const char* stateName(const House& h);

 private:
  struct Event { uint32_t t; uint16_t id; const char* ev; };
  struct Warn { bool exists = false, active = false; uint8_t wid = 0, when = 0, tx = 0; bool hasLvl = false; uint16_t lvlCm = 0; uint32_t t = 0, nextS = 0; };

  House* find(uint16_t id);
  void event(uint32_t t, uint16_t id, const char* ev);
  void changed() { rev_++; }
  void queue(const proto::Msg& m);
  void sendAck(const proto::Msg& m);
  void sendWarn();
  void startDown(House& h, uint8_t type, uint32_t nowS);
  void openReq(House& h, bool autoKind, uint32_t nowS);
  void closeReq(House& h);
  void setState(House& h, State s, uint32_t nowS);
  void res(long rid, bool ok, const char* err);
  void writeHb(uint32_t nowMs);
  void log(const std::string& s) { out_.line("# " + s); }

  House houses_[MAX_HOUSES];
  size_t n_ = 0;
  const char* name_;
  LineSink& out_;
  Warn warn_;
  Event events_[MAX_EVENTS];
  size_t evHead_ = 0, evCount_ = 0;
  proto::Msg txq_[TXQ];
  size_t txHead_ = 0, txCount_ = 0;
  uint8_t seq_ = 0, reqNo_ = 0;
  uint32_t rev_ = 0, snapRev_ = 0xFFFFFFFF, bootS_ = 0, lastHbMs_ = 0, lastSnapMs_ = 0;
  bool snapNow_ = false;
  float airMs_[60];
  uint32_t airMin_[60];
};
