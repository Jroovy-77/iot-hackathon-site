// เสียงของกล่องบ้าน: สัญญาณบี๊ปนำ แล้วตามด้วยเสียงพูดสังเคราะห์ (10 พ.ย. 2569 ผู้ใช้เลือก "มีทั้งสองแบบ")
// ทางเดินสัญญาณ: ขา AUDIO_PWM (sigma-delta 312.5 kHz) → R9/C4 กรอง → C5 → PAM8403
// ตัวอย่างเสียงจาก board/voice_data.cpp (PCM 8-bit, voice::SAMPLE_RATE) ส่งออกด้วย timer ISR ทีละตัวอย่าง
#include "audio.h"

#include <Arduino.h>

#include "house_logic.h"
#include "pins.h"
#include "voice_data.h"

namespace {
struct Note { uint16_t hz, ms; };   // hz = 0 คือเงียบ

// จังหวะบี๊ปนำต่อรหัส (ค่าออกแบบ — ปรับหลังทดสอบว่าผู้สูงอายุแยกออกไหม)
const Note P_WARN[] = {{800, 400}, {0, 200}, {800, 400}, {0, 200}, {800, 400}, {0, 0}};
const Note P_HEARD[] = {{600, 150}, {900, 250}, {0, 0}};
const Note P_SOS_SENT[] = {{1000, 700}, {0, 0}};
const Note P_RETRY[] = {{400, 120}, {0, 80}, {400, 120}, {0, 80}, {400, 120}, {0, 0}};
const Note P_ACCEPTED[] = {{600, 180}, {800, 180}, {1000, 350}, {0, 0}};
const Note P_DONE[] = {{900, 400}, {0, 150}, {900, 400}, {0, 0}};
const Note P_AUTO_SOS[] = {{1000, 120}, {0, 80}, {1000, 120}, {0, 80}, {1000, 120}, {0, 80}, {1000, 120}, {0, 0}};
const Note P_LOW_BATT[] = {{300, 300}, {0, 150}, {300, 300}, {0, 0}};
const Note P_HOLD[] = {{1200, 120}, {0, 0}};
const Note P_SAFE[] = {{900, 200}, {600, 300}, {0, 0}};

// เสียงพูดที่ตามหลังบี๊ปของแต่ละรหัส (V_WARN เลือกคำวัน/คืน/พรุ่งนี้ตอนเล่น)
struct Spec { const Note* tone; int8_t clip; };
Spec spec(uint8_t v) {
  switch (v) {
    case V_WARN: return {P_WARN, voice::C_WARN_A};
    case V_HEARD: return {P_HEARD, voice::C_HEARD};
    case V_SOS_SENT: return {P_SOS_SENT, voice::C_SOS_SENT};
    case V_RETRY: return {P_RETRY, voice::C_RETRY};
    case V_ACCEPTED: return {P_ACCEPTED, voice::C_ACCEPTED};
    case V_DONE: return {P_DONE, voice::C_DONE};
    case V_AUTO_SOS: return {P_AUTO_SOS, voice::C_AUTO_SOS};
    case V_LOW_BATT: return {P_LOW_BATT, voice::C_LOW_BATT};
    case V_SAFE: return {P_SAFE, voice::C_SAFE};
    case audio::V_HOLD: return {P_HOLD, -1};
    default: return {0, -1};
  }
}

// ความดัง: 100 = เต็ม · env:house_quiet ตั้ง AUDIO_VOLUME_PCT ต่ำกว่าไว้ใช้ตอนทดสอบบนโต๊ะ (ตัวเลข dB จริงต้องวัด)
#ifndef AUDIO_VOLUME_PCT
#define AUDIO_VOLUME_PCT 100
#endif
const uint8_t SD_CH = 0;
const uint32_t CLIP_GAP_MS = 150;   // เว้นระหว่างคำในประโยคเตือน (เตือนภัย… / คืนนี้ / ยกของ…)
const uint32_t ITEM_GAP_MS = 300;   // เว้นระหว่างข้อความ

// ---- ส่วนที่ ISR ใช้: loop() ตั้งค่า · ISR อ่าน
volatile const uint8_t* clipData = 0;
volatile uint32_t clipLen = 0, clipPos = 0;
volatile uint32_t toneStep = 0;   // ก้าวเฟสต่อตัวอย่าง (16 บิต = 1 รอบ) · 0 = เงียบ
uint32_t tonePhase = 0;
hw_timer_t* timer = 0;

void IRAM_ATTR onSample() {
  int out = 128;
  if (clipData) {
    if (clipPos < clipLen) {
      out = 128 + ((int)clipData[clipPos++] - 128) * AUDIO_VOLUME_PCT / 100;
    } else {
      clipData = 0;
    }
  } else if (toneStep) {
    tonePhase += toneStep;
    out = (tonePhase & 0x8000) ? 128 + 127 * AUDIO_VOLUME_PCT / 100 : 128 - 127 * AUDIO_VOLUME_PCT / 100;
  }
  sigmaDeltaWrite(SD_CH, (uint8_t)out);
}

// ---- คิวและลำดับการเล่น (ทำงานใน loop)
struct Item { uint8_t voice, when; };
Item queue[4];
uint8_t qn = 0;
enum Phase : uint8_t { IDLE, TONE, CLIP, CLIP_GAP, ITEM_GAP } phase = IDLE;
const Note* cur = 0;
int8_t clips[3];
uint8_t clipN = 0, clipI = 0;
uint32_t phaseEnd = 0;

void setTone(uint16_t hz) { toneStep = hz ? (uint32_t)hz * 65536u / voice::SAMPLE_RATE : 0; }

void startNote(uint32_t now) {
  setTone(cur->hz);
  phaseEnd = now + cur->ms;
}

void startClip(uint8_t c) {
  const voice::ClipData& d = voice::CLIPS[c];
  clipPos = 0;
  clipLen = d.len;
  clipData = d.data;   // ตั้งท้ายสุด: ISR เริ่มเล่นทันทีที่เห็นค่านี้
}

void nextClipOrGap(uint32_t now) {
  if (clipI < clipN) {
    startClip((uint8_t)clips[clipI++]);
    phase = CLIP;
  } else {
    phase = ITEM_GAP;
    phaseEnd = now + ITEM_GAP_MS;
  }
}

void startItem(const Item& it, uint32_t now) {
  const Spec s = spec(it.voice);
  clipN = clipI = 0;
  if (s.clip >= 0) {
    if (it.voice == V_WARN) {
      clips[clipN++] = voice::C_WARN_A;
      clips[clipN++] = it.when == 0 ? voice::C_TODAY : it.when == 1 ? voice::C_TONIGHT : voice::C_TOMORROW;
      clips[clipN++] = voice::C_WARN_B;
    } else {
      clips[clipN++] = s.clip;
    }
  }
  cur = s.tone;
  if (cur && cur->ms) {
    phase = TONE;
    startNote(now);
  } else {
    nextClipOrGap(now);
  }
}
}  // namespace

namespace audio {

void begin() {
  sigmaDeltaSetup(pins::AUDIO_PWM, SD_CH, 312500);
  sigmaDeltaWrite(SD_CH, 128);   // กึ่งกลาง = เงียบ (C5 กั้นไฟตรงก่อนเข้า PAM8403)
  timer = timerBegin(0, 80, true);   // 1 MHz
  timerAttachInterrupt(timer, &onSample, true);
  timerAlarmWrite(timer, 1000000UL / voice::SAMPLE_RATE, true);
  timerAlarmEnable(timer);
}

void play(uint8_t v, uint8_t when) {
  if (!spec(v).tone) return;
  if (qn == sizeof queue / sizeof queue[0]) return;
  queue[qn++] = {v, when};
}

bool busy() { return phase != IDLE || qn; }

void loop(uint32_t now) {
  switch (phase) {
    case TONE:
      if ((int32_t)(now - phaseEnd) >= 0) {
        cur++;
        if (cur->ms == 0) {   // จบบี๊ปนำ
          setTone(0);
          nextClipOrGap(now);
        } else {
          startNote(now);
        }
      }
      break;
    case CLIP:
      if (!clipData) {   // ISR เล่นคลิปจบแล้ว
        phase = CLIP_GAP;
        phaseEnd = now + CLIP_GAP_MS;
      }
      break;
    case CLIP_GAP:
      if ((int32_t)(now - phaseEnd) >= 0) nextClipOrGap(now);
      break;
    case ITEM_GAP:
      if ((int32_t)(now - phaseEnd) >= 0) phase = IDLE;
      break;
    case IDLE:
      if (qn) {
        const Item it = queue[0];
        for (uint8_t i = 1; i < qn; i++) queue[i - 1] = queue[i];
        qn--;
        startItem(it, now);
      }
      break;
  }
}

}  // namespace audio
