# เสียงพูดของกล่องบ้าน

เสียงพูด 13 ประโยค (รายการใน `phrases.txt`) ฝังในเฟิร์มแวร์เป็น `board/voice_data.cpp` (สร้างอัตโนมัติ ห้ามแก้มือ) · เล่นหลังบี๊ปนำใน `board/audio.cpp`

## สร้างใหม่
1. สร้างเสียงสังเคราะห์ (ต้องมีเน็ต): `python gen_tts.py th-TH-NiwatNeural "-10%"` → `src/niwat/<รหัส>.mp3` (ใช้ `edge-tts`; เสียงผู้หญิง `th-TH-PremwadeeNeural` บางวันบริการไม่ตอบ)
2. หรืออัดเสียงคนจริง ตั้งชื่อ `src/human/<รหัส>.m4a` (รหัสตาม `phrases.txt`)
3. แปลงเป็น PCM 8 บิต 16 kHz ตัดช่วงเงียบหัวท้าย ปรับความดัง (ต้องมี `ffmpeg`) ไปที่ `pcm/<niwat|human>/<รหัส>.u8`:
   `ffmpeg -i IN -af "highpass=f=100,loudnorm=I=-16:TP=-1.5:LRA=11,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" -ar 16000 -ac 1 -acodec pcm_u8 -f u8 OUT.u8`
4. `python gen_c.py niwat 16000` → เขียน `board/voice_data.cpp/.h` (ถ้ามี `pcm/human/<รหัส>.u8` จะใช้เสียงคนแทนประโยคนั้น)
5. `pio run -e house -t upload`

ไฟล์ต้นทาง (`src/`, `pcm/`, ตัวอย่าง mp3/wav) ไม่ได้เก็บใน repo · `board/voice_data.cpp` อาจมีเสียงอัดจริงของผู้ใช้ปนอยู่ ตรวจก่อนขึ้น repo สาธารณะ
