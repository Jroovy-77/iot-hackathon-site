# tools/ — สคริปต์ทดสอบที่ใช้ร่วมกัน (ใช้ก่อนเขียนใหม่)

ต้องมี Node 22+ และ Edge (หาเองอัตโนมัติ หรือตั้ง `BROWSER=<path>`) เปิด server ก่อน:
`python -m http.server 8010 --bind 127.0.0.1` (ทีม 1) หรือ `8001` (ทีม 2) ที่ root ของ repo

| งาน | คำสั่ง |
|---|---|
| ถ่ายภาพหลายหน้า หลายขนาด + เช็ก error / คำขอออกนอกเครื่อง | `node tools/shoot.mjs <outDir> ชื่อ=URL ...` (ขนาด: `SIZES=w,m` ค่าเริ่มต้น, `hd` = 1920×1080) |
| เทียบภาพก่อน/หลัง (เหมือนทุกไบต์ = same) | `node tools/pixdiff.mjs <โฟลเดอร์ก่อน> <โฟลเดอร์หลัง>` |
| สคริปต์ทดสอบเฉพาะงาน (กด ลาก แตะ เลื่อน) | `import { launch } from '../../tools/cdp.mjs'` มี `goto`, `shot`, `click`, `clickSel`, `mouseDown/Move/Up`, `touch*`, `wheel`, `ev`, `errors()`, `external()` |

ตัวตรวจหน้าตาอัตโนมัติ (ไม่ใช้ AI ไม่กินโทเค้น) — รันใน Git Bash ที่ root ของ repo ขณะ server เปิดอยู่:

```bash
bash .claude/skills/impeccable/scripts/impeccable detect --no-advisory http://127.0.0.1:8010/dashboard/ 2>&1 | head -60
```

- ภาพเก็บใน `<โฟลเดอร์งาน>/_shots/<รอบ>/` เท่านั้น
- เปิดดูภาพด้วยตาเฉพาะภาพที่ pixdiff บอกว่าต่าง หรือภาพสำคัญ ไม่เกิน 6 ภาพต่อรอบ
- ตัวตรวจอัตโนมัติ: ครั้งแรกจะดาวน์โหลดตัวตรวจ (~20MB) ผลที่เจอเป็น "หลักฐาน" ไม่ใช่คำตัดสิน เช่น แสงเรืองของไฟ LED ที่แทนไฟจริงไม่นับเป็นข้อผิด
