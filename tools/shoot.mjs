// ถ่ายภาพหลายหน้า หลายขนาด ในคำสั่งเดียว + รายงาน error และคำขอที่ออกนอกเครื่อง
// ใช้: node tools/shoot.mjs <โฟลเดอร์ผล> ชื่อ=URL [ชื่อ=URL ...]
//   SIZES=w,m (ค่าเริ่มต้น)  w=1280x720  m=390x844 (มือถือ 2x)  hd=1920x1080
// ตัวอย่าง: node tools/shoot.mjs exploded/_shots/r6 s3=http://127.0.0.1:8001/exploded/?at=0.31
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';

const [out, ...pairs] = process.argv.slice(2);
if (!out || !pairs.length) { console.log('ใช้: node tools/shoot.mjs <outDir> name=url [name=url ...]'); process.exit(1); }
const SIZE = { w: [1280, 720, 1, false], m: [390, 844, 2, true], hd: [1920, 1080, 1, false] };
const sizes = (process.env.SIZES || 'w,m').split(',').map((s) => s.trim()).filter((s) => SIZE[s]);
fs.mkdirSync(out, { recursive: true });
const b = await launch();
let bad = 0;
for (const sk of sizes) {
  const [W, H, D, M] = SIZE[sk];
  await b.size(W, H, D, M);
  for (const p of pairs) {
    const i = p.indexOf('=');
    const name = p.slice(0, i); const url = p.slice(i + 1);
    await b.goto(url);
    const file = path.join(out, `${name}-${sk}.png`);
    await b.shot(file);
    const err = b.errors(); const ext = b.external();
    if (err.length || ext.length) bad++;
    console.log(`${name}-${sk}: ok` + (err.length ? ` | error ${err.length}: ${err[0]}` : '') + (ext.length ? ` | ออกนอกเครื่อง ${ext.length}: ${ext[0]}` : ''));
  }
}
await b.close();
console.log(bad ? `เสร็จ: มี ${bad} หน้าที่มี error หรือคำขอออกนอกเครื่อง` : 'เสร็จ: ไม่มี error และไม่มีคำขอออกนอกเครื่อง');
