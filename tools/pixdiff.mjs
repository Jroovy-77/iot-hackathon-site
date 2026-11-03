// เทียบภาพก่อน/หลัง: ไฟล์เหมือนกันทุกไบต์ = same, ไม่เหมือน = นับพิกเซลที่ต่าง + กรอบที่ต่าง
// ใช้: node tools/pixdiff.mjs <โฟลเดอร์ก่อน> <โฟลเดอร์หลัง>   (เทียบไฟล์ .png ชื่อเดียวกัน)
//  หรือ node tools/pixdiff.mjs a.png b.png
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launch } from './cdp.mjs';

const [A, B] = process.argv.slice(2);
if (!A || !B) { console.log('ใช้: node tools/pixdiff.mjs <dirA|a.png> <dirB|b.png>'); process.exit(1); }
let pairs;
if (fs.statSync(A).isDirectory()) {
  pairs = fs.readdirSync(A).filter((f) => f.endsWith('.png')).map((f) => [path.join(A, f), path.join(B, f), f]);
} else pairs = [[A, B, path.basename(A)]];
const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const todo = [];
for (const [a, b, n] of pairs) {
  if (!fs.existsSync(b)) { console.log(`${n}: ไม่มีไฟล์คู่`); continue; }
  if (hash(a) === hash(b)) console.log(`${n}: same`); else todo.push([a, b, n]);
}
if (todo.length) {
  const br = await launch({ w: 200, h: 200 });
  const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  for (const [a, b, n] of todo) {
    const r = await br.ev(`(async()=>{const L=async u=>{const bm=await createImageBitmap(await (await fetch(u)).blob());const c=new OffscreenCanvas(bm.width,bm.height);const x=c.getContext('2d');x.drawImage(bm,0,0);return x.getImageData(0,0,bm.width,bm.height)};
      const A=await L(${JSON.stringify(uri(a))}),B=await L(${JSON.stringify(uri(b))});
      if(A.width!==B.width||A.height!==B.height)return 'ขนาดไม่เท่ากัน '+A.width+'x'+A.height+' vs '+B.width+'x'+B.height;
      let n=0,x0=1e9,y0=1e9,x1=-1,y1=-1;
      for(let p=0;p<A.data.length;p+=4){if(A.data[p]!==B.data[p]||A.data[p+1]!==B.data[p+1]||A.data[p+2]!==B.data[p+2]){n++;const px=(p/4)%A.width,py=Math.floor(p/4/A.width);if(px<x0)x0=px;if(py<y0)y0=py;if(px>x1)x1=px;if(py>y1)y1=py}}
      return n?('DIFF '+n+' px ในกรอบ x'+x0+'-'+x1+' y'+y0+'-'+y1):'same (ต่างแค่ข้อมูลไฟล์)'})()`);
    console.log(`${n}: ${r}`);
  }
  await br.close();
}
