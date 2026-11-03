// ค่าวิทยุ LoRa ของทั้งสองฝั่ง — ไฟล์เดียว (กล่องบ้าน ตัวรับ และ ping/pong ใช้ร่วมกัน)
// ที่มา: docs/data-contract.md ข้อ 4.1 · docs/wiring-breadboard.md ข้อ 5 · ทุกค่าเป็น **ค่าออกแบบ** ยังไม่ได้ทดสอบระยะจริง
#pragma once
#include <stdint.h>

namespace radio_cfg {

// ความถี่: ย่าน 920–925 MHz เท่านั้น (ห้าม 915.0 — "915 MHz" คือรุ่นย่านของโมดูล ไม่ใช่ความถี่ที่ส่ง)
const uint32_t FREQ_KHZ = 923200;
const float    FREQ_MHZ = FREQ_KHZ / 1000.0f;

const float   BW_KHZ    = 125.0f;
const uint8_t SF        = 9;      // spreading factor
const uint8_t CR_DENOM  = 5;      // coding rate 4/5 (data-contract 4.1 — เวลาส่งในตาราง 4.3 คิดจากค่านี้)
const uint8_t SYNC_WORD = 0x12;   // private · ทั้งสองฝั่งต้องตรงกัน
const uint16_t PREAMBLE = 8;      // รอบ Breadboard ไม่หลับลึก (เสียบ USB) จึงใช้เสียงนำปกติทุกข้อความ
                                  // SX1276 ต้องตั้งความยาวเสียงนำให้ตรงกันทั้งสองฝั่ง

// กำลังส่ง: รวมกับเสาต้องไม่เกิน EIRP 17 dBm (50 mW)
const int8_t TX_DBM       = 14;
const int8_t ANT_GAIN_DBI = 2;    // เสาสปริง/ลวด ~0–2 dBi (ใช้ค่าสูงไว้ก่อน) · ถ้าเปลี่ยนเป็นเสา 3 dBi ต้องลด TX_DBM
const int8_t EIRP_MAX_DBM = 17;

const uint8_t NET_ID = 0x01;      // รหัสพื้นที่ (ไบต์ 0 ของทุกข้อความ)

static_assert(FREQ_KHZ >= 920000 && FREQ_KHZ <= 925000, "frequency must be 920-925 MHz");
static_assert(TX_DBM + ANT_GAIN_DBI <= EIRP_MAX_DBM, "EIRP must be <= 17 dBm");

}  // namespace radio_cfg
