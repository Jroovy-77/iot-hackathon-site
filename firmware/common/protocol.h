// รูปแบบไบต์ของข้อความวิทยุ — ตรงกับ docs/data-contract.md ข้อ 4.2–4.3
// [net][type][id lo][id hi][seq][payload...][mic 4 ไบต์ (PoC ใส่ 0)]
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace proto {

enum Type : uint8_t {
  // ทิศลง (ตัวรับ → กล่อง)
  WARN = 0x01, ACK = 0x02, ACCEPTED = 0x03, DONE = 0x04,
  // ทิศขึ้น (กล่อง → ตัวรับ)
  HEARD = 0x10, SOS = 0x11, AUTO_SOS = 0x12, STATUS = 0x13, BOX_ACK = 0x14, SAFE = 0x15,
  // ทดสอบวิทยุ B2 เท่านั้น (ไม่อยู่ใน data-contract): payload = เลขรอบ uint16
  PING = 0x70, PONG = 0x71,
};

const uint16_t ID_ALL    = 0xFFFF;   // ทุกบ้าน
const size_t   HEADER    = 5;
const size_t   MIC_LEN   = 4;
const size_t   MAX_LEN   = 16;

struct Msg {
  uint8_t  net = 0;
  uint8_t  type = 0;
  uint16_t id = 0;
  uint8_t  seq = 0;
  // payload — ใช้เฉพาะช่องของชนิดนั้น
  uint8_t  wid = 0;        // WARN, HEARD, STATUS
  uint8_t  when = 0;       // WARN: 0 วันนี้ · 1 คืนนี้ · 2 พรุ่งนี้
  uint8_t  act = 0;        // WARN
  uint8_t  lvl = 0xFF;     // WARN: ระดับน้ำ × 10 ซม. · 0xFF = ไม่ระบุ
  uint8_t  ack_type = 0;   // ACK, BOX_ACK
  uint8_t  ack_seq = 0;    // ACK, BOX_ACK
  uint8_t  req_no = 0;     // ACCEPTED, DONE
  uint8_t  flags = 0;      // SOS, AUTO_SOS, STATUS, SAFE
  uint8_t  batt = 0;       // SOS, AUTO_SOS, STATUS, SAFE: แรงดัน × 0.02 V (0 = ไม่มีถ่าน)
  uint16_t n = 0;          // PING, PONG
};

enum Result { OK = 0, BAD_LENGTH, UNKNOWN_TYPE, WRONG_NET };

// ความยาวรวมของชนิดนี้ (0 = ไม่รู้จัก)
size_t lengthOf(uint8_t type);
// คืนความยาวที่เขียน (0 = ชนิดไม่รู้จักหรือที่ไม่พอ)
size_t encode(const Msg& m, uint8_t* out, size_t cap);
Result decode(const uint8_t* in, size_t len, uint8_t expectNet, Msg& out);
const char* typeName(uint8_t type);
bool isUplink(uint8_t type);
bool needsAck(uint8_t type);   // ตัวรับต้องตอบ ACK

// flags (ไบต์เดียว): bit0 probe_wet · bit1 bed · bit2 low_batt · bit3 open_req · bit4–7 try (1–15)
uint8_t makeFlags(bool probeWet, bool bed, bool lowBatt, bool openReq, uint8_t tryNo);
inline bool flagProbeWet(uint8_t f) { return f & 0x01; }
inline bool flagBed(uint8_t f) { return f & 0x02; }
inline bool flagLowBatt(uint8_t f) { return f & 0x04; }
inline bool flagOpenReq(uint8_t f) { return f & 0x08; }
inline uint8_t flagTry(uint8_t f) { return f >> 4; }
uint8_t withTry(uint8_t flags, uint8_t tryNo);   // เปลี่ยนเฉพาะ try (ค้างที่ 15)

uint8_t battToByte(float volts);   // 0.02 V ต่อหน่วย ปัดเศษ จำกัด 0–255
float battFromByte(uint8_t b);

// เวลาออกอากาศ (ms) ตามสูตร Time-on-Air ของ Semtech: CRC เปิด, header explicit — ประมาณการ
float airtimeMs(size_t payloadBytes, uint8_t sf, float bwKhz, uint8_t crDenom, uint16_t preamble);

}  // namespace proto
