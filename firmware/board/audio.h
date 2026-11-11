// เสียงของกล่องบ้าน (ขา AUDIO_PWM → ตัวกรอง → PAM8403)
// แต่ละรหัส = บี๊ปนำ (จังหวะไม่ซ้ำกัน) แล้วตามด้วยเสียงพูดสังเคราะห์จาก board/voice_data.cpp (10 พ.ย. 2569)
#pragma once
#include <stdint.h>

namespace audio {

const uint8_t V_HOLD = 0xF0;   // บี๊ปสั้นตอนกดค้างครบ 2 วิ / กดเขียวสั้นตอนเตือน (ไม่มีเสียงพูด · ไม่ใช่รหัสของ house_logic)

void begin();
void play(uint8_t voice, uint8_t when = 0);   // รหัสจาก house_logic.h (V_WARN …) · when = 0 วันนี้ / 1 คืนนี้ / 2 พรุ่งนี้ (ใช้กับ V_WARN) · เล่นต่อคิวไม่บล็อก
void loop(uint32_t nowMs);                    // เรียกทุกรอบ
bool busy();

}  // namespace audio
