#include "protocol.h"

#include <math.h>
#include <string.h>

namespace proto {

size_t lengthOf(uint8_t type) {
  switch (type) {
    case WARN: return HEADER + 4 + MIC_LEN;                    // 13
    case ACK: case BOX_ACK: return HEADER + 2 + MIC_LEN;       // 11
    case ACCEPTED: case DONE: case HEARD: return HEADER + 1 + MIC_LEN;   // 10
    case SOS: case AUTO_SOS: case SAFE: return HEADER + 2 + MIC_LEN;     // 11
    case STATUS: return HEADER + 3 + MIC_LEN;                  // 12
    case PING: case PONG: return HEADER + 2 + MIC_LEN;         // 11
    default: return 0;
  }
}

size_t encode(const Msg& m, uint8_t* out, size_t cap) {
  const size_t len = lengthOf(m.type);
  if (len == 0 || len > cap) return 0;
  memset(out, 0, len);   // mic = 0 ใน PoC
  out[0] = m.net;
  out[1] = m.type;
  out[2] = m.id & 0xFF;
  out[3] = m.id >> 8;
  out[4] = m.seq;
  uint8_t* p = out + HEADER;
  switch (m.type) {
    case WARN: p[0] = m.wid; p[1] = m.when; p[2] = m.act; p[3] = m.lvl; break;
    case ACK: case BOX_ACK: p[0] = m.ack_type; p[1] = m.ack_seq; break;
    case ACCEPTED: case DONE: p[0] = m.req_no; break;
    case HEARD: p[0] = m.wid; break;
    case SOS: case AUTO_SOS: case SAFE: p[0] = m.flags; p[1] = m.batt; break;
    case STATUS: p[0] = m.flags; p[1] = m.batt; p[2] = m.wid; break;
    case PING: case PONG: p[0] = m.n & 0xFF; p[1] = m.n >> 8; break;
  }
  return len;
}

Result decode(const uint8_t* in, size_t len, uint8_t expectNet, Msg& out) {
  if (len < HEADER + MIC_LEN) return BAD_LENGTH;
  const size_t want = lengthOf(in[1]);
  if (want == 0) return UNKNOWN_TYPE;
  if (len != want) return BAD_LENGTH;
  if (in[0] != expectNet) return WRONG_NET;
  out = Msg();
  out.net = in[0];
  out.type = in[1];
  out.id = in[2] | (in[3] << 8);
  out.seq = in[4];
  const uint8_t* p = in + HEADER;
  switch (out.type) {
    case WARN: out.wid = p[0]; out.when = p[1]; out.act = p[2]; out.lvl = p[3]; break;
    case ACK: case BOX_ACK: out.ack_type = p[0]; out.ack_seq = p[1]; break;
    case ACCEPTED: case DONE: out.req_no = p[0]; break;
    case HEARD: out.wid = p[0]; break;
    case SOS: case AUTO_SOS: case SAFE: out.flags = p[0]; out.batt = p[1]; break;
    case STATUS: out.flags = p[0]; out.batt = p[1]; out.wid = p[2]; break;
    case PING: case PONG: out.n = p[0] | (p[1] << 8); break;
  }
  return OK;
}

const char* typeName(uint8_t type) {
  switch (type) {
    case WARN: return "WARN";
    case ACK: return "ACK";
    case ACCEPTED: return "ACCEPTED";
    case DONE: return "DONE";
    case HEARD: return "HEARD";
    case SOS: return "SOS";
    case AUTO_SOS: return "AUTO_SOS";
    case STATUS: return "STATUS";
    case BOX_ACK: return "BOX_ACK";
    case SAFE: return "SAFE";
    case PING: return "PING";
    case PONG: return "PONG";
    default: return "?";
  }
}

bool isUplink(uint8_t type) { return type >= HEARD && type <= SAFE; }

bool needsAck(uint8_t type) {
  return type == HEARD || type == SOS || type == AUTO_SOS || type == STATUS || type == SAFE;
}

uint8_t makeFlags(bool probeWet, bool bed, bool lowBatt, bool openReq, uint8_t tryNo) {
  uint8_t f = (probeWet ? 0x01 : 0) | (bed ? 0x02 : 0) | (lowBatt ? 0x04 : 0) | (openReq ? 0x08 : 0);
  return withTry(f, tryNo);
}

uint8_t withTry(uint8_t flags, uint8_t tryNo) {
  if (tryNo > 15) tryNo = 15;
  return (flags & 0x0F) | (tryNo << 4);
}

uint8_t battToByte(float volts) {
  if (volts <= 0) return 0;
  const float u = volts / 0.02f + 0.5f;
  return u >= 255 ? 255 : (uint8_t)u;
}

float battFromByte(uint8_t b) { return b * 0.02f; }

float airtimeMs(size_t payloadBytes, uint8_t sf, float bwKhz, uint8_t crDenom, uint16_t preamble) {
  const float tSym = (float)(1u << sf) / bwKhz;               // ms
  const int de = (tSym > 16.0f) ? 1 : 0;                       // low data rate optimize
  const int num = 8 * (int)payloadBytes - 4 * sf + 28 + 16;    // CRC เปิด, header explicit (H = 0)
  const int den = 4 * (sf - 2 * de);
  int blocks = num > 0 ? (num + den - 1) / den : 0;
  const int nPayload = 8 + blocks * crDenom;
  return (preamble + 4.25f + nPayload) * tSym;
}

}  // namespace proto
