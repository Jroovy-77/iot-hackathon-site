#include "gateway.h"

#include <stdio.h>
#include <string.h>

#include "jsonlite.h"
#include "radio_config.h"
#include "timing.h"

using namespace proto;
using jsonlite::appendEscaped;
using jsonlite::appendFloat;

namespace {
const char* const STATE_NAMES[] = {"idle", "warn", "heard", "silent", "sos", "accepted", "done", "auto_sos", "safe"};
const char* const WHEN_NAMES[] = {"today", "tonight", "tomorrow"};

void appendU(std::string& s, unsigned long v) {
  char b[16];
  snprintf(b, sizeof b, "%lu", v);
  s += b;
}
void appendL(std::string& s, long v) {
  char b[16];
  snprintf(b, sizeof b, "%ld", v);
  s += b;
}
void appendBool(std::string& s, bool v) { s += v ? "true" : "false"; }
void key(std::string& s, const char* k) {   // ,"k":
  if (!s.empty() && s[s.size() - 1] != '{' && s[s.size() - 1] != '[') s += ',';
  s += '"';
  s += k;
  s += "\":";
}
}  // namespace

Gateway::Gateway(const HouseInfo* houses, size_t n, const char* name, LineSink& out) : name_(name), out_(out) {
  n_ = n > MAX_HOUSES ? MAX_HOUSES : n;
  for (size_t i = 0; i < n_; i++) houses_[i].info = &houses[i];
  for (size_t i = 0; i < 60; i++) {
    airMs_[i] = 0;
    airMin_[i] = 0xFFFFFFFF;
  }
}

void Gateway::begin(uint32_t nowMs) {
  bootS_ = nowMs / 1000;
  lastHbMs_ = nowMs;
  for (size_t i = 0; i < n_; i++) houses_[i].tState = bootS_;
  snapNow_ = true;
}

const char* Gateway::stateName(const House& h) {
  if (h.offline && !h.req.open) return "offline";
  return STATE_NAMES[h.state];
}

Gateway::House* Gateway::find(uint16_t id) {
  for (size_t i = 0; i < n_; i++)
    if (houses_[i].info->id == id) return &houses_[i];
  return 0;
}

const Gateway::House* Gateway::house(uint16_t id) const { return const_cast<Gateway*>(this)->find(id); }

void Gateway::event(uint32_t t, uint16_t id, const char* ev) {
  events_[evHead_] = Event{t, id, ev};
  evHead_ = (evHead_ + 1) % MAX_EVENTS;
  if (evCount_ < MAX_EVENTS) evCount_++;
}

void Gateway::queue(const Msg& m) {
  if (txCount_ == TXQ) {   // คิวเต็ม: ทิ้งอันเก่าสุด (ข้อความสำคัญมีส่งซ้ำอยู่แล้ว)
    txHead_ = (txHead_ + 1) % TXQ;
    txCount_--;
  }
  txq_[(txHead_ + txCount_) % TXQ] = m;
  txCount_++;
}

bool Gateway::popTx(Msg& out) {
  if (!txCount_) return false;
  out = txq_[txHead_];
  txHead_ = (txHead_ + 1) % TXQ;
  txCount_--;
  return true;
}

void Gateway::noteAirtime(float ms, uint32_t nowMs) {
  const uint32_t minute = nowMs / 60000;
  const size_t i = minute % 60;
  if (airMin_[i] != minute) {
    airMin_[i] = minute;
    airMs_[i] = 0;
  }
  airMs_[i] += ms;
}

float Gateway::airPct(uint32_t nowMs) const {
  const uint32_t minute = nowMs / 60000;
  float sum = 0;
  for (size_t i = 0; i < 60; i++)
    if (airMin_[i] != 0xFFFFFFFF && minute - airMin_[i] < 60) sum += airMs_[i];
  return sum / 3600000.0f * 100.0f;
}

void Gateway::sendAck(const Msg& m) {
  Msg a;
  a.net = radio_cfg::NET_ID;
  a.type = ACK;
  a.id = m.id;
  a.seq = ++seq_;
  a.ack_type = m.type;
  a.ack_seq = m.seq;
  queue(a);
}

void Gateway::sendWarn() {
  Msg w;
  w.net = radio_cfg::NET_ID;
  w.type = WARN;
  w.id = ID_ALL;
  w.seq = ++seq_;
  w.wid = warn_.wid;
  w.when = warn_.when;
  w.act = 0;
  w.lvl = warn_.hasLvl ? (uint8_t)(warn_.lvlCm / 10 > 254 ? 254 : warn_.lvlCm / 10) : 0xFF;
  queue(w);
  warn_.tx++;
}

void Gateway::startDown(House& h, uint8_t type, uint32_t nowS) {
  h.down.active = true;
  h.down.type = type;
  h.down.seq = ++seq_;
  h.down.reqNo = h.req.no;
  h.down.sent = 1;
  h.down.nextS = nowS + timing::downRetryGapS(1);
  Msg m;
  m.net = radio_cfg::NET_ID;
  m.type = type;
  m.id = h.info->id;
  m.seq = h.down.seq;
  m.req_no = h.down.reqNo;
  queue(m);
}

void Gateway::setState(House& h, State s, uint32_t nowS) {
  if (h.state != s) h.tState = nowS;
  h.state = s;
}

void Gateway::openReq(House& h, bool autoKind, uint32_t nowS) {
  h.req = Req();
  h.req.open = true;
  h.req.autoKind = autoKind;
  h.req.confirmed = !autoKind;   // คำขอแทนต้องให้ อสม. ยืนยันก่อน
  h.req.no = ++reqNo_ ? reqNo_ : ++reqNo_;
  h.req.tOpen = nowS;
  setState(h, autoKind ? S_AUTO_SOS : S_SOS, nowS);
  event(nowS, h.info->id, autoKind ? "auto_sos" : "sos");
}

void Gateway::closeReq(House& h) { h.req.open = false; }

// ---------------------------------------------------------------- วิทยุเข้า
void Gateway::onRadio(const Msg& m, float rssi, float snr, uint32_t nowMs) {
  const uint32_t now = nowMs / 1000;
  if (!isUplink(m.type)) return;
  House* hp = find(m.id);
  if (!hp) {
    char b[48];
    snprintf(b, sizeof b, "unknown id %u", (unsigned)m.id);
    log(b);
    return;
  }
  House& h = *hp;
  h.hasSignal = true;
  h.rssi = rssi;
  h.snr = snr;
  h.everSeen = true;
  h.lastSeen = now;
  if (h.offline) {
    h.offline = false;
    event(now, h.info->id, "online");
  }
  changed();

  if (needsAck(m.type)) sendAck(m);   // ตอบ ACK ทุกครั้ง แม้ข้อความซ้ำ
  const bool dup = h.hasLast && h.lastType == m.type && h.lastSeq == m.seq;
  if (dup) return;                     // ข้อความเดิมที่กล่องส่งซ้ำ (ACK หาย)
  h.hasLast = true;
  h.lastType = m.type;
  h.lastSeq = m.seq;

  const bool hasFlags = m.type == SOS || m.type == AUTO_SOS || m.type == STATUS || m.type == SAFE;
  if (hasFlags) {
    h.tryNo = flagTry(m.flags) ? flagTry(m.flags) : 1;
    if (h.tryNo > 1) event(now, h.info->id, "retry_rx");
    h.hasBatt = true;
    h.battV = battFromByte(m.batt);
    const bool low = flagLowBatt(m.flags);
    if (low && !h.lowBatt) event(now, h.info->id, "low_batt");
    h.lowBatt = low;
    const bool wet = flagProbeWet(m.flags);
    if (wet && !h.probeWet) {
      h.tWet = now;
      event(now, h.info->id, "probe_wet");
    } else if (!wet && h.probeWet) {
      event(now, h.info->id, "probe_dry");
    }
    h.probeWet = wet;
  } else {
    h.tryNo = 1;
  }

  switch (m.type) {
    case HEARD:
      if (warn_.exists && m.wid == warn_.wid) {
        h.gotWarn = true;
        if (!h.req.open && (h.state == S_WARN || h.state == S_SILENT)) {
          setState(h, S_HEARD, now);
          event(now, h.info->id, "heard");
        }
      }
      break;
    case SOS:
      if (h.req.open) {   // 1 บ้าน = 1 คำขอที่เปิดอยู่
        h.req.dup++;
        if (h.req.autoKind) {   // คำขอแทนแล้วคนกดแดงเอง → เป็นคำขอของคน
          h.req.autoKind = false;
          h.req.confirmed = true;
          if (h.state == S_AUTO_SOS) setState(h, S_SOS, now);
        }
      } else {
        openReq(h, false, now);
      }
      break;
    case AUTO_SOS:
      if (h.req.open) h.req.dup++;
      else openReq(h, true, now);
      break;
    case SAFE:
      if (h.req.open && h.info->bed) {   // บ้านติดเตียง: ไม่ปิดเอง รอทีมโทรยืนยัน
        h.req.cancelled = true;
        h.req.cancelT = now;
        event(now, h.info->id, "cancel");
      } else {
        if (h.req.open) closeReq(h);
        h.down.active = false;
        setState(h, S_SAFE, now);
        event(now, h.info->id, "safe");
      }
      break;
    case STATUS:
      if (warn_.exists && m.wid == warn_.wid) h.gotWarn = true;
      break;
    case BOX_ACK:
      if (h.down.active && m.ack_type == h.down.type && m.ack_seq == h.down.seq) {
        h.down.active = false;
        if (h.down.type == ACCEPTED && h.req.open && h.req.no == h.down.reqNo) h.req.delivered = true;
        event(now, h.info->id, "delivered");
      }
      break;
  }
}

// ---------------------------------------------------------------- คำสั่งจากเว็บ
void Gateway::res(long rid, bool ok, const char* err) {
  std::string s = "{\"t\":\"res\"";
  key(s, "rid");
  appendL(s, rid);
  key(s, "ok");
  appendBool(s, ok);
  if (ok) {
    key(s, "rev");
    appendU(s, rev_);
  } else {
    key(s, "err");
    appendEscaped(s, err);
  }
  s += '}';
  out_.line(s);
}

void Gateway::onLine(const char* line, uint32_t nowMs) {
  const uint32_t now = nowMs / 1000;
  while (*line == ' ' || *line == '\t') line++;
  if (*line != '{') return;
  std::string cmd;
  if (!jsonlite::getStr(line, "cmd", cmd)) return;
  long rid = 0;
  const bool hasRid = jsonlite::getInt(line, "rid", rid);

  if (cmd == "hello") {   // ตอบ snap ไม่มี res
    snapNow_ = true;
    writeSnap(nowMs);
    return;
  }
  if (!hasRid) return;

  if (cmd == "warn") {
    std::string when;
    jsonlite::getStr(line, "when", when);
    int w = -1;
    for (int i = 0; i < 3; i++)
      if (when == WHEN_NAMES[i]) w = i;
    if (w < 0) return res(rid, false, "bad_when");
    long lvl = 0;
    warn_.hasLvl = jsonlite::getInt(line, "lvl_cm", lvl) && lvl >= 0;
    warn_.lvlCm = warn_.hasLvl ? (uint16_t)(lvl > 2540 ? 2540 : lvl) : 0;
    warn_.exists = true;
    warn_.active = true;
    warn_.wid = warn_.wid % 255 + 1;
    warn_.when = (uint8_t)w;
    warn_.t = now;
    warn_.tx = 0;
    sendWarn();
    warn_.nextS = now + timing::WARN_FAST_GAP_S;
    for (size_t i = 0; i < n_; i++) {
      House& h = houses_[i];
      h.gotWarn = false;
      if (!h.req.open) setState(h, S_WARN, now);
    }
    event(now, 0, "warn_sent");
    changed();
    return res(rid, true, 0);
  }
  if (cmd == "warn_stop") {
    long wid = -1;
    jsonlite::getInt(line, "wid", wid);
    if (!warn_.exists || !warn_.active || wid != warn_.wid) return res(rid, false, "no_warn");
    warn_.active = false;
    changed();
    return res(rid, true, 0);
  }

  long id = -1;
  jsonlite::getInt(line, "id", id);
  House* hp = (cmd == "confirm" || cmd == "accept" || cmd == "done" || cmd == "cancel_ok") ? find((uint16_t)id) : 0;
  if (!hp) return res(rid, false, cmd == "confirm" || cmd == "accept" || cmd == "done" || cmd == "cancel_ok" ? "unknown_id" : "bad_cmd");
  House& h = *hp;
  if (!h.req.open) return res(rid, false, "no_open_request");

  if (cmd == "confirm") {
    if (!h.req.autoKind) return res(rid, false, "not_auto");
    h.req.confirmed = true;
    event(now, h.info->id, "confirm");
  } else if (cmd == "accept") {
    if (h.req.autoKind && !h.req.confirmed) return res(rid, false, "need_confirm");
    h.req.accepted = true;
    h.req.tAccept = now;
    h.req.delivered = false;
    setState(h, S_ACCEPTED, now);
    startDown(h, ACCEPTED, now);
    event(now, h.info->id, "accept");
  } else if (cmd == "done") {
    setState(h, S_DONE, now);
    startDown(h, DONE, now);
    closeReq(h);
    event(now, h.info->id, "done");
  } else {   // cancel_ok: ทีมโทรแล้ว ปลอดภัยจริง · ไม่ส่งอะไรถึงกล่อง (กล่องเขียวอยู่แล้ว)
    if (!h.req.cancelled) return res(rid, false, "not_cancelled");
    closeReq(h);
    h.down.active = false;
    setState(h, S_SAFE, now);
    event(now, h.info->id, "cancel_ok");
  }
  changed();
  res(rid, true, 0);
}

// ---------------------------------------------------------------- ตามเวลา
void Gateway::tick(uint32_t nowMs) {
  const uint32_t now = nowMs / 1000;

  if (warn_.active && (int32_t)(now - warn_.nextS) >= 0) {   // WARN 3 ครั้งห่าง 30 วิ → ทุก 15 นาที
    sendWarn();
    warn_.nextS = now + (warn_.tx < timing::WARN_FAST_TX ? timing::WARN_FAST_GAP_S : timing::warnSlowGapS());
    changed();
  }

  for (size_t i = 0; i < n_; i++) {
    House& h = houses_[i];
    if (h.state == S_WARN && warn_.exists && (int32_t)(now - warn_.t) >= (int32_t)timing::silentS()) {   // ไม่กดเขียวใน 6 ชม.
      setState(h, S_SILENT, now);
      event(now, h.info->id, "silent");
      changed();
    }
    const uint32_t ref = h.everSeen ? h.lastSeen : bootS_;
    bool lost = (int32_t)(now - ref) > (int32_t)timing::offlineS();   // ไม่ได้ยินเกิน 13 ชม.
    if (warn_.active) {   // มีคำเตือนค้าง กล่องส่งทุก 1 ชม. → เกิน 3 ชม. นับจากที่ได้ยินล่าสุดหรือตอนเริ่มเตือน
      const uint32_t wref = (int32_t)(warn_.t - ref) > 0 ? warn_.t : ref;
      lost = lost || (int32_t)(now - wref) > (int32_t)timing::offlineWarnS();
    }
    if (!h.offline && lost) {
      h.offline = true;
      h.tOffline = now;
      event(now, h.info->id, "offline");
      changed();
    }
    if (h.down.active && (int32_t)(now - h.down.nextS) >= 0) {   // ACCEPTED/DONE ส่งซ้ำจนได้ BOX_ACK
      Msg m;
      m.net = radio_cfg::NET_ID;
      m.type = h.down.type;
      m.id = h.info->id;
      m.seq = h.down.seq;
      m.req_no = h.down.reqNo;
      queue(m);
      if (h.down.sent < 255) h.down.sent++;
      h.down.nextS = now + timing::downRetryGapS(h.down.sent);
    }
  }

  if (nowMs - lastHbMs_ >= timing::LINK_HB_MS) writeHb(nowMs);
  if ((snapNow_ || rev_ != snapRev_) && nowMs - lastSnapMs_ >= timing::SNAP_MIN_GAP_MS) writeSnap(nowMs);
}

void Gateway::writeHb(uint32_t nowMs) {
  lastHbMs_ = nowMs;
  std::string s = "{\"t\":\"hb\"";
  key(s, "rev");
  appendU(s, rev_);
  key(s, "now");
  appendU(s, nowMs / 1000);
  key(s, "air_pct");
  appendFloat(s, airPct(nowMs), 2);
  s += '}';
  out_.line(s);
}

void Gateway::writeSnap(uint32_t nowMs) {
  const uint32_t now = nowMs / 1000;
  snapNow_ = false;
  snapRev_ = rev_;
  lastSnapMs_ = nowMs;
  std::string s;
  s.reserve(1024);
  s = "{\"t\":\"snap\"";
  key(s, "v"); s += '2';
  key(s, "rev"); appendU(s, rev_);
  key(s, "now"); appendU(s, now);
  key(s, "gw"); s += '{';
  key(s, "name"); appendEscaped(s, name_);
  key(s, "sim"); appendBool(s, false);
  key(s, "link"); s += "\"usb\"";
  key(s, "air_pct"); appendFloat(s, airPct(nowMs), 2);
  s += '}';
  key(s, "cfg"); s += '{';   // ค่าออกแบบในหน่วยจริง (ไม่หารด้วยการเร่งเวลา)
  key(s, "silent_h"); s += '6';
  key(s, "auto_h"); s += '2';
  key(s, "probe_cm"); s += "50";
  key(s, "water_s"); appendU(s, timing::WATER_CONFIRM_MS / 1000);
  key(s, "repeat_min"); s += "10";
  key(s, "hold_s"); appendU(s, timing::HOLD_MS / 1000);
  key(s, "safe_hold_s"); appendU(s, timing::HOLD_MS / 1000);
  key(s, "hb_h"); s += '6';
  key(s, "offline_h"); s += warn_.active ? "3" : "13";
  key(s, "low_batt_v"); appendFloat(s, timing::LOW_BATT_V, 1);
  key(s, "link_hb_s"); appendU(s, timing::LINK_HB_MS / 1000);
  if (timing::SCALE > 1) { key(s, "speedup"); appendU(s, timing::SCALE); }
  s += '}';

  key(s, "warn");
  if (!warn_.exists) {
    s += "null";
  } else {
    s += '{';
    key(s, "wid"); appendU(s, warn_.wid);
    key(s, "when"); appendEscaped(s, WHEN_NAMES[warn_.when]);
    key(s, "lvl_cm"); if (warn_.hasLvl) appendU(s, warn_.lvlCm); else s += "null";
    key(s, "t"); appendU(s, warn_.t);
    key(s, "tx"); appendU(s, warn_.tx);
    key(s, "active"); appendBool(s, warn_.active);
    s += '}';
  }

  key(s, "houses"); s += '[';
  for (size_t i = 0; i < n_; i++) {
    const House& h = houses_[i];
    if (i) s += ',';
    s += '{';
    key(s, "id"); appendU(s, h.info->id);
    key(s, "name"); appendEscaped(s, h.info->name);
    key(s, "x"); appendL(s, h.info->x);
    key(s, "y"); appendL(s, h.info->y);
    key(s, "bed"); appendBool(s, h.info->bed);
    key(s, "state"); appendEscaped(s, stateName(h));
    key(s, "t_state"); appendU(s, h.offline && !h.req.open ? h.tOffline : h.tState);
    key(s, "got_warn"); appendBool(s, h.gotWarn);
    key(s, "last_seen"); if (h.everSeen) appendU(s, h.lastSeen); else s += "null";
    key(s, "offline"); appendBool(s, h.offline);
    key(s, "rssi"); if (h.hasSignal) appendFloat(s, h.rssi, 0); else s += "null";
    key(s, "snr"); if (h.hasSignal) appendFloat(s, h.snr, 1); else s += "null";
    key(s, "batt_v"); if (h.hasBatt) appendFloat(s, h.battV, 2); else s += "null";
    key(s, "low_batt"); appendBool(s, h.lowBatt);
    key(s, "probe_wet"); appendBool(s, h.probeWet);
    key(s, "t_wet"); if (h.probeWet) appendU(s, h.tWet); else s += "null";
    key(s, "try"); appendU(s, h.tryNo);
    key(s, "req");
    if (!h.req.open) {
      s += "null";
    } else {
      const Req& r = h.req;
      s += '{';
      key(s, "no"); appendU(s, r.no);
      key(s, "kind"); s += r.autoKind ? "\"auto_sos\"" : "\"sos\"";
      key(s, "t_open"); appendU(s, r.tOpen);
      key(s, "confirmed"); appendBool(s, r.confirmed);
      key(s, "t_accept"); if (r.accepted) appendU(s, r.tAccept); else s += "null";
      key(s, "delivered"); appendBool(s, r.delivered);
      key(s, "cancel_t"); if (r.cancelled) appendU(s, r.cancelT); else s += "null";
      key(s, "dup"); appendU(s, r.dup);
      s += '}';
    }
    s += '}';
  }
  s += ']';

  key(s, "events"); s += '[';   // ใหม่สุดก่อน
  for (size_t k = 0; k < evCount_; k++) {
    const Event& e = events_[(evHead_ + MAX_EVENTS - 1 - k) % MAX_EVENTS];
    if (k) s += ',';
    s += '{';
    key(s, "t"); appendU(s, e.t);
    key(s, "id"); appendU(s, e.id);
    key(s, "ev"); appendEscaped(s, e.ev);
    s += '}';
  }
  s += "]}";
  (void)now;
  out_.line(s);
}
