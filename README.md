# ทีม AI ทำเว็บสำหรับงานแข่ง IoT

โฟลเดอร์นี้เตรียม Claude Code agent teams ไว้ 2 ทีม:

| ทีม | ทำอะไร | teammates | โฟลเดอร์งาน |
|---|---|---|---|
| ทีม 1 Dashboard | หน้าโชว์ค่าเซนเซอร์ มีโหมดข้อมูลสดและข้อมูลจำลอง | `dash-architect`, `dash-builder`, `dash-critic` | `dashboard/` |
| ทีม 2 Exploded | เว็บเลื่อนแล้วอุปกรณ์แยกชิ้น 3D ใช้อัดเป็นคลิปพรีเซนต์ได้ | `exp-director`, `exp-modeler`, `exp-animator`, `exp-checker` | `exploded/` |

ทั้งสองทีมขึ้น GitHub Pages ลิงก์เดียวกัน

## ติดตั้งครั้งแรก

1. **ดับเบิลคลิก `install-team.bat`** ในโฟลเดอร์นี้ (`C:\Users\PC\Documents\iot-hackathon-site`)
   - ไฟล์นี้คัดลอกบทบาททั้ง 7 ตัวจาก `_setup\` ไปไว้ใน `.claude\` ซึ่งเป็นที่ที่ Claude Code อ่าน
   - Claude วางไฟล์ลง `.claude` จากระยะไกลไม่ได้ (เป็นการป้องกันของระบบ) ขั้นนี้จึงต้องกดเอง
   - หน้าต่างจะแสดงชื่อไฟล์ 7 ตัว ถ้าเห็นครบแปลว่าสำเร็จ
2. สร้าง repo ใหม่บน GitHub แล้ว push โฟลเดอร์นี้ขึ้นไป (โฟลเดอร์ `_setup` กับไฟล์ `install-team.bat` จะลบทิ้งหลังติดตั้งก็ได้)
3. ใน repo บน GitHub ไปที่ **Settings → Pages** เลือก Deploy from a branch → `main` → `/ (root)`
4. เปิด PowerShell ในโฟลเดอร์นี้ แล้วพิมพ์ `claude`
   - ถ้า Claude Code ถามว่าเชื่อถือโฟลเดอร์นี้ไหม ให้ตอบเชื่อถือ ไม่อย่างนั้นบทบาทใน `.claude/agents/` จะไม่ถูกใช้เต็มที่
   - ถ้าถามเรื่อง auto mode: แนะนำให้เปิด (Yes) เพราะทีมมี 7 ตัว ถ้าใช้โหมดปกติจะต้องกดอนุญาตบ่อยมาก ระหว่างใช้งานกด Shift+Tab สลับโหมดได้
   - เช็กว่าเห็นบทบาทครบ 7 ตัว โดยพิมพ์ถาม Claude ว่า "มี agent type อะไรบ้างใน .claude/agents" (คำสั่ง `/agents` ถูกเอาออกแล้วในเวอร์ชันใหม่)
5. ไฟล์ `.claude/settings.json` เปิด agent teams ให้เฉพาะโปรเจกต์นี้แล้ว ไม่ต้องตั้งค่าเพิ่ม

## ก่อนเรียกทีม: กรอกข้อมูลกลาง

ทีมจะ **ไม่เริ่มงาน** ถ้าไฟล์เหล่านี้ยังเป็นแม่แบบ:
- `docs/idea.md`: ไอเดียที่เลือก
- `docs/parts.md`: รายการชิ้นส่วนจริง (เอาจากผลประเมินของ Tesla ใน Hermes ได้)
- `docs/rules.md`: กติกาที่อ่านแล้ว (ไม่บังคับ แต่ควรกรอกเมื่อ 22 ต.ค.)

กรอกเสร็จแล้วให้ลบบรรทัด "สถานะ: ยังไม่ได้กรอก" ออก

## รอบทดสอบ (ไอเดียปุ่มเรียกเรือ): ดับเบิลคลิกอย่างเดียว

กรอก `docs/idea.md` กับ `docs/parts.md` ไว้ให้แล้ว
- **ทีม 1:** ดับเบิลคลิก `run-team1-dashboard.bat`
- **ทีม 2:** ดับเบิลคลิก `run-team2-exploded.bat` (แนะนำให้รอทีม 1 จบก่อน ดูเหตุผลในข้อควรรู้)

ไฟล์ .bat จะเปิด Claude Code ในโฟลเดอร์นี้พร้อมคำสั่งใน `prompts/` ทีมจะทำงานจนจบเอง แล้วเขียนรายงานไว้ที่ `docs/test-run-1-team1.md` และ `docs/test-run-1-team2.md` เปิดอ่านด้วย Notepad หรือ VS Code จะอ่านภาษาไทยได้ปกติ

ถ้ามีคำถามขออนุญาตเด้งขึ้นในหน้าต่าง ให้อ่านแล้วตอบเอง (Claude ในแชทกดปุ่มใน terminal แทนคุณไม่ได้)

## เรียกทีม 1 (Dashboard) แบบพิมพ์เอง

เปิด `claude` หนึ่งหน้าต่าง แล้ววาง:

```text
สร้าง agent team สำหรับทำ dashboard โดย spawn 3 teammates:
- ชื่อ architect ใช้ agent type dash-architect
- ชื่อ builder ใช้ agent type dash-builder
- ชื่อ critic ใช้ agent type dash-critic
ให้ทุกคนอ่าน CLAUDE.md และไฟล์ใน docs/ ก่อนเริ่ม
ลำดับงาน: architect เสนอทางส่งข้อมูลให้ฉันเลือกก่อน แล้วทำ data contract
→ builder สร้าง dashboard → critic ทดสอบและรีวิว → builder แก้ข้อที่ต้องแก้
รอทุกคนทำเสร็จก่อน แล้วสรุปให้ฉันเป็นภาษาไทยแบบเข้าใจง่าย
```

## เรียกทีม 2 (Exploded) แบบพิมพ์เอง

เปิด `claude` **อีกหน้าต่างหนึ่ง** (หนึ่ง session มีได้หนึ่งทีม) แล้ววาง:

```text
สร้าง agent team สำหรับทำเว็บเลื่อนแยกชิ้น 3D โดย spawn 4 teammates:
- ชื่อ director ใช้ agent type exp-director
- ชื่อ modeler ใช้ agent type exp-modeler
- ชื่อ animator ใช้ agent type exp-animator
- ชื่อ checker ใช้ agent type exp-checker
ให้ทุกคนอ่าน CLAUDE.md และไฟล์ใน docs/ ก่อนเริ่ม
ลำดับงาน: director เขียน storyboard → modeler กับ animator ตกลงรูปแบบ parts.js
แล้วทำงานคู่กัน → checker ตรวจและเขียนสคริปต์อัดคลิป → แก้ข้อที่ต้องแก้
รอทุกคนทำเสร็จก่อน แล้วสรุปให้ฉันเป็นภาษาไทยแบบเข้าใจง่าย
```

ถ้า Claude ใช้ subagent แทนทีม (สังเกตได้จากที่ teammates ไม่คุยกันเอง) ให้สั่งใหม่โดยพูดชัด ๆ ว่า "agent team"

## ปุ่มที่ใช้ระหว่างทีมทำงาน

- `↑` / `↓` เลือก teammate ในแผงใต้ช่องพิมพ์
- `Enter` เปิดดูงานของคนนั้น และพิมพ์คุยกับเขาโดยตรง
- `Esc` ยกเลิกการเลือก (ถ้ากำลังดูอยู่ จะเป็นการขัดจังหวะคนนั้น)
- `x` หยุด teammate ที่เลือก
- `Ctrl+T` เปิด/ปิด task list
- ปิดทีละคน: พิมพ์ว่า "Ask the critic teammate to shut down"

## ข้อควรรู้

- **ใช้ token เยอะ**: แต่ละ teammate คือ Claude อีกตัว ทีม 2 ใช้มากที่สุด
- **แพ็กเกจ Claude Pro มีโควตาการใช้งาน**: ถ้าเปิดทั้งสองทีมพร้อมกัน (Claude 9 ตัวในคราวเดียว) อาจชนโควตากลางทาง ทีมจะหยุดจนกว่าโควตาจะรีเซ็ต การรันทีละทีมจึงปลอดภัยกว่า
- **permission prompt ของทุกคนเด้งที่หน้าต่าง lead** ถ้าเด้งบ่อย ให้ใช้ `/permissions` อนุญาตคำสั่งที่ใช้ซ้ำ ๆ ไว้ก่อน
- **ถ้า lead ลงมือเองแทนที่จะรอทีม** ให้พิมพ์ "Wait for your teammates to complete their tasks before proceeding"
- **`/resume` ไม่คืน teammate กลับมา** ถ้าปิดหน้าต่างไปแล้ว ให้สั่งสร้างทีมใหม่
- **โค้ดที่เตรียมไว้ก่อนวันแข่ง**: เช็กใน `docs/rules.md` ก่อนว่ากติกาอนุญาตไหม
