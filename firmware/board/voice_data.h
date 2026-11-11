// สร้างโดย voice/gen_c.py — ห้ามแก้มือ · เสียงพูดสังเคราะห์ (Microsoft Edge TTS th-TH niwat) PCM 8-bit 16000 Hz
#pragma once
#include <stdint.h>

namespace voice {
const uint32_t SAMPLE_RATE = 16000;
enum Clip : uint8_t { C_WARN_A, C_TODAY, C_TONIGHT, C_TOMORROW, C_WARN_B, C_HEARD, C_SOS_SENT, C_RETRY, C_ACCEPTED, C_DONE, C_AUTO_SOS, C_LOW_BATT, C_SAFE, C_COUNT };
struct ClipData { const uint8_t* data; uint32_t len; };
extern const ClipData CLIPS[C_COUNT];
}  // namespace voice
