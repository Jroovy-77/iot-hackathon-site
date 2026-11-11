// เวลาและเกณฑ์ทั้งหมด — **ค่าออกแบบ จะปรับหลังทดสอบ** (data-contract ข้อ 4.4–4.6 และ cfg ในข้อ 5.2)
// อยากทดสอบเร็ว: ใส่ -D TIME_SCALE=360 ใน build_flags (6 ชม. → 60 วิ) ตัวรับจะบอกแดชบอร์ดว่า "เร่งเวลา" ผ่าน cfg.speedup
#pragma once
#include <stdint.h>

#ifndef TIME_SCALE
#define TIME_SCALE 1
#endif

namespace timing {

const uint32_t SCALE = TIME_SCALE;
inline uint32_t hours(uint32_t h) { return h * 3600u / SCALE; }      // วินาที (หลังเร่งเวลา)
inline uint32_t minutes(uint32_t m) { return m * 60u / SCALE; }      // วินาที (หลังเร่งเวลา)

// ---- ปุ่ม (4.6)
const uint32_t HOLD_MS     = 2000;    // กดค้าง 2 วิ: แดง = SOS · เขียว = ปลอดภัย
const uint32_t DEBOUNCE_MS = 30;
const uint32_t STUCK_MS    = 30000;   // ค้างเกิน 30 วิ = ปุ่มค้าง

// ---- ส่งซ้ำ (4.5) — หน่วย ms
const uint32_t PRE_DELAY_MAX_MS = 3000;      // สุ่มหน่วง 0–3 วิ ก่อนส่งครั้งแรก
const uint32_t ACK_WAIT_MS      = 3000;      // ฟังรอ ACK 3 วิ
const uint32_t RETRY_MIN_MS     = 5000;      // ไม่ได้ ACK → สุ่มรอ 5–15 วิ
const uint32_t RETRY_MAX_MS     = 15000;
const uint8_t  FAST_TRIES       = 5;         // ครบ 5 ครั้ง → ทุก 60 วิ
const uint32_t SLOW_RETRY_MS    = 60000;
const uint32_t SLOW_PHASE_MS    = 3600000;   // จนครบ 1 ชม. → ทุก 5 นาที
const uint32_t SLOWER_RETRY_MS  = 300000;
const uint8_t  STATUS_TRIES     = 3;         // STATUS ลองไม่เกิน 3 ครั้ง
const uint8_t  RETRY_VOICE_AFTER     = 3;          // V_RETRY หลังพลาดครั้งที่ 3
const uint32_t RETRY_VOICE_EARLY_MS  = 600000;     // แล้วทุก 10 นาทีในชั่วโมงแรก
const uint32_t RETRY_VOICE_LATE_MS   = 1800000;    // → ทุก 30 นาที

// ---- "ยังอยู่" (STATUS) — หน่วยวินาที
inline uint32_t hbNormalS()    { return hours(6); }     // ทุก 6 ชม.
inline uint32_t hbWarnS()      { return hours(1); }     // ทุก 1 ชม. ช่วงมีคำเตือนค้าง
inline uint32_t hbJitterS()    { return minutes(10); }  // สุ่ม ±10 นาที
inline uint32_t hbFirstMaxS()  { return minutes(30); }  // ครั้งแรกหลังเปิดเครื่อง สุ่ม 0–30 นาที
inline uint32_t hbWarnKickS()  { return minutes(10); }  // ได้ WARN ใหม่ → ส่งภายใน 0–10 นาที
inline uint32_t warnKeepS()    { return hours(1); }     // ได้ยิน WARN ล่าสุดไม่เกิน 1 ชม. = คำเตือนยังค้าง (ตัวรับส่งซ้ำทุก 15 นาที)

// ---- น้ำ (บ้านติดเตียง)
const uint32_t PROBE_PERIOD_MS  = 60000;   // ปลุกมาวัดทุก 1 นาที
const uint32_t PROBE_FAST_MS    = 5000;    // เจอน้ำ → อ่านซ้ำทุก 5 วิ
const uint32_t WATER_CONFIRM_MS = 30000;   // แตะน้ำต่อเนื่อง 30 วิ = น้ำขึ้น
const uint32_t PROBE_DRIVE_MS   = 30;      // ดึงสายดำลงตอนอ่าน 30 ms
inline uint32_t autoSosS() { return hours(2); }   // น้ำขึ้น + ไม่มีใครกด 2 ชม. = ขอแทน

// ---- เสียง
// พูดเตือนซ้ำ: 10 ครั้งแรกทุก 1 นาที แล้วทุก 5 นาที จนกว่าจะกดเขียว (ค่าออกแบบ 10 พ.ย. 2569 ผู้ใช้เลือก · เดิมทุก 10 นาที)
const uint8_t WARN_VOICE_FAST_REPEATS = 10;
inline uint32_t warnRepeatS(uint8_t repeatsDone) { return repeatsDone < WARN_VOICE_FAST_REPEATS ? minutes(1) : minutes(5); }

// ---- ถ่าน
const float LOW_BATT_V = 3.9f;   // ถ่าน 3 ก้อน < 3.9 V = ถ่านอ่อน
const float NO_BATT_V  = 1.0f;   // ต่ำกว่านี้ = ไม่มีถ่าน (ส่ง batt = 0)

// ---- ตัวรับ
inline uint32_t silentS()  { return hours(6); }    // ไม่กดเขียวใน 6 ชม. = บ้านเงียบ
inline uint32_t offlineS() { return hours(13); }   // ไม่ได้ยินเกิน 13 ชม. (6 × 2 + 1) = ขาดการติดต่อ
inline uint32_t offlineWarnS() { return hours(3); }   // ช่วงมีคำเตือนค้าง: ไม่ได้ยินเกิน 3 ชม. (1 × 2 + 1)
const uint32_t LINK_HB_MS      = 2000;   // hb ถึงแดชบอร์ดทุก 2 วิ
const uint32_t SNAP_MIN_GAP_MS = 500;    // snap ไม่เกิน 2 ครั้ง/วิ
const uint8_t  WARN_FAST_TX    = 3;      // WARN 3 ครั้งห่าง 30 วิ → ทุก 15 นาที จนกดหยุด
const uint32_t WARN_FAST_GAP_S = 30;
inline uint32_t warnSlowGapS() { return minutes(15); }
// ACCEPTED / DONE ส่งซ้ำจนได้ BOX_ACK: เว้น 1, 2, 4, 8 นาที แล้วทุก 10 นาที
inline uint32_t downRetryGapS(uint8_t sent) {
  static const uint8_t gapMin[] = {1, 2, 4, 8};
  return minutes(sent >= 1 && sent <= 4 ? gapMin[sent - 1] : 10);
}

}  // namespace timing
