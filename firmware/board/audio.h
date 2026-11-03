// เสียงของกล่องบ้าน (ขา AUDIO_PWM → ตัวกรอง → PAM8403)
// รอบนี้ใช้ **เสียงบี๊ป** แทนเสียงพูด (ยังไม่มีไฟล์เสียงพูด — แผนตัดงานข้อ 4) · แต่ละรหัสมีจังหวะไม่ซ้ำกัน
#pragma once
#include <stdint.h>

namespace audio {

void begin();
void play(uint8_t voice);   // รหัสจาก house_logic.h (V_WARN …) · เล่นต่อคิวไม่บล็อก
void loop(uint32_t nowMs);  // เรียกทุกรอบ
bool busy();

}  // namespace audio
