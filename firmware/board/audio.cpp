#include "audio.h"

#include <Arduino.h>

#include "house_logic.h"
#include "pins.h"

namespace {
struct Note { uint16_t hz, ms; };   // hz = 0 คือเงียบ

// จังหวะบี๊ปต่อรหัส (ค่าออกแบบ — ปรับหลังทดสอบว่าผู้สูงอายุแยกออกไหม)
const Note P_WARN[] = {{800, 400}, {0, 200}, {800, 400}, {0, 200}, {800, 400}, {0, 0}};
const Note P_HEARD[] = {{600, 150}, {900, 250}, {0, 0}};
const Note P_SOS_SENT[] = {{1000, 700}, {0, 0}};
const Note P_RETRY[] = {{400, 120}, {0, 80}, {400, 120}, {0, 80}, {400, 120}, {0, 0}};
const Note P_ACCEPTED[] = {{600, 180}, {800, 180}, {1000, 350}, {0, 0}};
const Note P_DONE[] = {{900, 400}, {0, 150}, {900, 400}, {0, 0}};
const Note P_AUTO_SOS[] = {{1000, 120}, {0, 80}, {1000, 120}, {0, 80}, {1000, 120}, {0, 80}, {1000, 120}, {0, 0}};
const Note P_LOW_BATT[] = {{300, 300}, {0, 150}, {300, 300}, {0, 0}};
const Note P_SAFE[] = {{900, 200}, {600, 300}, {0, 0}};

const Note* pattern(uint8_t v) {
  switch (v) {
    case V_WARN: return P_WARN;
    case V_HEARD: return P_HEARD;
    case V_SOS_SENT: return P_SOS_SENT;
    case V_RETRY: return P_RETRY;
    case V_ACCEPTED: return P_ACCEPTED;
    case V_DONE: return P_DONE;
    case V_AUTO_SOS: return P_AUTO_SOS;
    case V_LOW_BATT: return P_LOW_BATT;
    case V_SAFE: return P_SAFE;
    default: return 0;
  }
}

const uint8_t CH = 0;
uint8_t queue[4];
uint8_t qn = 0;
const Note* cur = 0;
uint32_t noteEnd = 0;

void startNote(uint32_t now) {
  ledcWriteTone(CH, cur->hz);
  noteEnd = now + cur->ms;
}
}  // namespace

namespace audio {

void begin() {
  ledcSetup(CH, 1000, 8);
  ledcAttachPin(pins::AUDIO_PWM, CH);
  ledcWriteTone(CH, 0);
}

void play(uint8_t voice) {
  if (!pattern(voice)) return;
  if (qn == sizeof queue) return;
  queue[qn++] = voice;
}

bool busy() { return cur || qn; }

void loop(uint32_t now) {
  if (cur && (int32_t)(now - noteEnd) >= 0) {
    cur++;
    if (cur->ms == 0) {   // จบรูปแบบ
      ledcWriteTone(CH, 0);
      cur = 0;
      noteEnd = now + 300;   // เว้นระหว่างข้อความ
    } else {
      startNote(now);
    }
  }
  if (!cur && qn && (int32_t)(now - noteEnd) >= 0) {
    cur = pattern(queue[0]);
    for (uint8_t i = 1; i < qn; i++) queue[i - 1] = queue[i];
    qn--;
    startNote(now);
  }
}

}  // namespace audio
