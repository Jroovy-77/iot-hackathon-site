// ขาทั้งหมดของรอบ Breadboard — ไฟล์เดียวที่มีเลขขา (ห้ามเขียนเลขขาที่อื่น)
// ที่มา: docs/wiring-breadboard.md ข้อ 1 (กล่องบ้าน) และ ข้อ 2 (ตัวรับ)
//
// สถานะ: เช็กกับตัวหนังสือบนของจริงแล้ว 1 พ.ย. (วิทยุ XL1276-P01 ด้านหลัง · ใต้บอร์ด ESP32-C3 Super Mini) — ค่า R/C ยังเป็นค่าออกแบบ
// ถ้าแก้เลขขา ต้องแก้ 3 ที่ให้ตรงกัน: ไฟล์นี้ · docs/wiring-breadboard.md · wiring/breadboard-nets.js
// แล้วบันทึกลง docs/handoff.md (หน้า wiring/ เช็กเลขขาในไฟล์นี้เทียบกับผังให้เอง)
#pragma once

#define PINS_VERIFIED 1   // 1 พ.ย.: ชื่อขาบนของจริงตรงทุกขาที่ใช้ (B1 ส่วนเช็กชื่อขา)

namespace pins {

// ---- วิทยุ SX1276 (เหมือนกันทั้งกล่องบ้านและตัวรับ)
const int RADIO_SCK   = 6;
const int RADIO_MISO  = 5;
const int RADIO_MOSI  = 7;
const int RADIO_NSS   = 8;    // strapping + LED บนบอร์ด · R5 10 kΩ ดึงขึ้น 3V3
const int RADIO_DIO0  = 3;    // ส่งเสร็จ / รับได้
const int RADIO_RESET = 10;   // เดิมคือ BUSY ของ SX1262

// ---- กล่องบ้านเท่านั้น
const int BTN_RED     = 0;    // ปุ่มแดง + สายวัดน้ำเส้นแดง (ผ่าน R7 10 kΩ) · ใช้ตัวดึงขึ้นในชิป · อ่าน ADC ได้
const int BATT_ADC    = 1;    // วัดถ่าน ผ่าน R3/R4 1 MΩ + 1 MΩ
const int BTN_GREEN   = 2;    // ปุ่มเขียว · strapping · R2 100 kΩ ดึงขึ้น 3V3
const int SPARE_GPIO4 = 4;    // ว่าง (สวิตช์ตัดไฟของกล่องจริงรุ่นถัดไป)
const int LED_RING    = 9;    // DIN แหวน WS2812 ผ่าน R8 330 Ω · strapping (ต้องเป็น 1 ตอนบูต)
const int AUDIO_PWM   = 20;   // เสียง → R9/C4/C5 → PAM8403 LIN
const int PROBE_DRIVE = 21;   // สายวัดน้ำเส้นดำ ผ่าน R13 1 kΩ · ดึงลงเฉพาะตอนอ่าน

// ---- ค่าฮาร์ดแวร์ที่ผูกกับการต่อสาย
const int   LED_RING_COUNT = 12;     // แหวน WS2812 12 ดวง
const float BATT_DIVIDER   = 2.0f;   // R3 1 MΩ / R4 1 MΩ → แรงดันที่ขา × 2

}  // namespace pins
