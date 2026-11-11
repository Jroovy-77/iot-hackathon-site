"""แปลง voice/pcm/<voice>/*.u8 (PCM 8-bit unsigned, mono) → board/voice_data.cpp / .h สำหรับฝังในเฟิร์มแวร์กล่องบ้าน
usage: python gen_c.py [voice=niwat] [rate=16000]   (ลำดับคลิปตรงกับ enum Clip ใน voice_data.h)"""
import sys, pathlib
voice = sys.argv[1] if len(sys.argv) > 1 else "niwat"
rate = int(sys.argv[2]) if len(sys.argv) > 2 else 16000
ids = ["warn_a", "today", "tonight", "tomorrow", "warn_b", "heard", "sos_sent", "retry", "accepted", "done", "auto_sos", "low_batt", "safe"]
here = pathlib.Path(__file__).parent
board = here.parent / "board"
h = ["// สร้างโดย voice/gen_c.py — ห้ามแก้มือ · เสียงพูดสังเคราะห์ (Microsoft Edge TTS th-TH " + voice + f") PCM 8-bit {rate} Hz",
     "#pragma once", "#include <stdint.h>", "", "namespace voice {", f"const uint32_t SAMPLE_RATE = {rate};",
     "enum Clip : uint8_t { " + ", ".join("C_" + i.upper() for i in ids) + ", C_COUNT };",
     "struct ClipData { const uint8_t* data; uint32_t len; };", "extern const ClipData CLIPS[C_COUNT];", "}  // namespace voice", ""]
(board / "voice_data.h").write_text("\n".join(h), encoding="utf-8")
out = ["// สร้างโดย voice/gen_c.py — ห้ามแก้มือ", '#include "voice_data.h"', "", "namespace voice {", "namespace {"]
total = 0
for i in ids:
    human = here / "pcm" / "human" / f"{i}.u8"   # เสียงคนจริง (ถ้ามี) ใช้แทนเสียงสังเคราะห์ของประโยคนั้น
    data = (human if human.exists() else here / "pcm" / voice / f"{i}.u8").read_bytes()
    print("  ", i, "human" if human.exists() else voice, f"{len(data) / rate:.1f} s")
    total += len(data)
    out.append(f"const uint8_t D_{i.upper()}[{len(data)}] = {{")
    for k in range(0, len(data), 32):
        out.append("  " + ",".join(str(b) for b in data[k:k + 32]) + ",")
    out.append("};")
out.append("}  // namespace")
out.append("const ClipData CLIPS[C_COUNT] = {" + ", ".join(f"{{D_{i.upper()}, sizeof D_{i.upper()}}}" for i in ids) + "};")
out.append("}  // namespace voice")
(board / "voice_data.cpp").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"{voice}: {len(ids)} clips, {total} bytes = {total / rate:.1f} s")
