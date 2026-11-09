// โมเดล 3 มิติของแท็บ Breadboard (กล่องบ้าน / ตัวรับ) — ข้อมูลสายทั้งหมดมาจาก breadboard-nets.js
// กล่องบ้าน = แผ่น 400 รู 30 คอลัมน์ · ตัวรับ = แผ่นใหญ่ 63 คอลัมน์ (รางขาดกลาง) · แถว a–j + ราง 4 เส้น · ขาทุกขาลงรูจริง ระยะ 2.54 มม.
import { superMini, waterProbe, P } from './parts3d.js';
import { board } from './layout.js';
import { BB_HOUSE, BB_RX, bands5 } from './breadboard-nets.js';
import { stripOf } from './breadboard-check.js';

const ROWS = 'abcdefghij';
const rowZ = (r) => { const k = ROWS.indexOf(r); return (k < 5 ? k - 5.5 : k - 3.5) * P; };   // a = −5.5P … e = −1.5P · f = +1.5P … j = +5.5P
const RAIL_Z = { vsys: -9 * P, gndT: -8 * P, gndB: 8 * P, '3v3': 9 * P };
// รางเป็นกลุ่มละ 5 รู เว้น 1 · แผ่นใหญ่ 3–7, 9–13, … · แผ่น 400 รู 2–6, 8–12, … 26–30 (เลขรางบนแผ่นจริงอาจเหลื่อมกันเล็กน้อย)
const railHole = (c, last) => (last === 30 ? c >= 2 && c <= 30 && (c - 2) % 6 !== 5 : c >= 3 && c <= last && (c - 3) % 6 !== 5);

// ตำแหน่งรู (หน่วย มม. บนผิวแผ่น y = 0)
export function holePos(h, cc = 32) {   // cc = คอลัมน์กลางแผ่น (แผ่นใหญ่ 32 · แผ่น 400 รู 15.5)
  let m = /^m(\d+)([a-j])$/.exec(h); if (m) return { x: (+m[1] - cc) * P, z: rowZ(m[2]) };
  m = /^bb\.(vsys|gndT|gndB|3v3)2?@(\d+)$/.exec(h); if (m) return { x: (+m[2] - cc) * P, z: RAIL_Z[m[1]] };
  return null;
}
const RAIL_NAME = { 'bb.vsys': 'ราง VSYS บน', 'bb.vsys2': 'ราง VSYS บน (ครึ่งขวา)', 'bb.gndT': 'ราง GND บน', 'bb.gndT2': 'ราง GND บน (ครึ่งขวา)',
  'bb.gndB': 'ราง GND ล่าง', 'bb.gndB2': 'ราง GND ล่าง (ครึ่งขวา)', 'bb.3v3': 'ราง 3V3 ล่าง', 'bb.3v32': 'ราง 3V3 ล่าง (ครึ่งขวา)' };
export function holeText(h) {
  let m = /^m(\d+)([a-j])$/.exec(h); if (m) return `รู ${m[1]}${m[2]}`;
  m = /^(bb\.\w+)@(\d+)$/.exec(h); if (m) return `${RAIL_NAME[m[1]]} ตรงคอลัมน์ ${m[2]}`;
  return h;
}

/* ------------------------------------------------------------------ ชิ้นใหม่ */
function breadboardMesh(T, K, cols, w, d, cx, cz, railLast, label) {
  const g = new T.Group(); g.position.set(cx, 0, cz);
  K.box(g, w, 8.5, d, 0xf1efe8, 0, -4.25, 0, { r: 0.85 });
  K.box(g, w - 2, 0.3, 2.6, 0xd9d6cc, 0, 0.0, 0, { r: 0.9 });                                // ร่องกลาง
  const holes = [];
  for (let c = 1; c <= cols; c++) for (const r of ROWS) holes.push([(c - (cols + 1) / 2) * P, rowZ(r)]);
  const railRows = [-9 * P, -8 * P, 8 * P, 9 * P];
  for (const z of railRows) for (let c = 1; c <= cols; c++) if (railHole(c, railLast)) holes.push([(c - (cols + 1) / 2) * P, z]);
  const im = new T.InstancedMesh(new T.BoxGeometry(1.0, 0.12, 1.0), K.M(0x3a3a36, { r: 0.9 }), holes.length);
  const o = new T.Object3D();
  holes.forEach(([x, z], i) => { o.position.set(x, 0.02, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  g.add(im);
  // เส้นรางที่พิมพ์บนแผ่น: แดง = + · น้ำเงิน = − · แผ่นเต็มขาดกลางแผ่น
  const half = (cols + 1) / 2; const split = cols > 40;
  const line = (z, color) => {
    const seg = (c1, c2) => K.box(g, (c2 - c1 + 0.8) * P, 0.1, 0.45, color, ((c1 + c2) / 2 - half) * P, 0.05, z, { r: 0.8 });
    if (split) { seg(2, 31); seg(33, cols - 1); } else seg(2, cols - 1);
  };
  line(-9.75 * P, 0xc0392b); line(-7.25 * P, 0x2e6db4); line(7.25 * P, 0x2e6db4); line(9.75 * P, 0xc0392b);
  for (let c = 5; c <= cols; c += 5) for (const z of [-6.6 * P, 6.6 * P]) K.print(g, String(c), 3.2, 1.6, (c - half) * P, 0.06, z, { color: '#6b6a64' });
  for (const [r, s] of [['a', -1], ['j', 1], ['e', -1], ['f', 1]]) for (const x of [-(half + 0.2) * P, (half + 0.2) * P]) K.print(g, r, 1.6, 1.6, x, 0.06, rowZ(r), { color: '#6b6a64' });
  if (split) for (const z of [-8.5 * P, 8.5 * P]) K.print(g, 'ขาด', 4, 1.6, 0, 0.06, z, { color: '#b4462f', mono: false });
  const lab = K.label(label, { h: 3.6, color: '#5F5E5A', border: null, bg: 'rgba(243,242,238,0.9)', screen: true });
  lab.center.set(0, 0); lab.position.set(cx - w / 2, 1, cz - d / 2 - 2); lab.userData.major = true;
  return { g, lab };
}

// โมดูลวิทยุที่ได้มา = XL1276-P01 (ชิป SX1276) แผ่นฟ้า ~16 × 16 มม. ขาครึ่งรู 8 ขาต่อข้าง ห่าง ~2 มม. (ประมาณจากรูป ไม่ใช่ 2.54 → บัดกรีสาย)
// มองด้านที่มีตัวหนังสือ (ด้านหลัง) วางทิศเดียวกับรูปใกล้ของผู้ใช้ 1 พ.ย. (ANT มุมขวาบน):
// ซ้ายบนลงล่าง GND DIO5 REST NSS SCK MOSI MISO GND · ขวาบนลงล่าง ANT GND DIO3 DIO4 VCC DIO0 DIO1 DIO2
function sx1276(T, K) {
  const g = new T.Group(); const pins = {}; const pinLabels = [];
  K.box(g, 16, 1.0, 16, 0x1f55b0, 0, 0.5, 0, { r: 0.55 });
  K.print(g, 'XL1276-P01', 5.2, 1.1, 0, 1.02, -2.4, { color: '#ffffff' });
  K.print(g, 'SX1276', 3.6, 1.0, 0, 1.02, -0.8, { color: '#d8e4f5' });
  for (const [t, z] of [['433M', 1.6], ['868M', 3.2], ['915M', 4.8]]) K.print(g, t, 3.2, 1.0, 0, 1.02, z, { color: '#d8e4f5' });   // ตารางติ๊กย่าน (ย่อ)
  const L = ['GND', 'DIO5', 'RESET', 'NSS', 'SCK', 'MOSI', 'MISO', 'GND2'];
  const R = ['ANT', 'GND3', 'DIO3', 'DIO4', '3.3V', 'DIO0', 'DIO1', 'DIO2'];
  const SILK = { '3.3V': 'VCC', RESET: 'REST' };
  const TEXT = { '3.3V': 'VCC (3.3V เท่านั้น)', RESET: 'REST (RESET)' };
  const used = new Set(['GND', 'MISO', 'MOSI', 'SCK', 'NSS', 'RESET', 'DIO0', '3.3V', 'ANT']);
  const pad = (n, x, z, anchor) => {
    const u = used.has(n) || /^GND/.test(n);
    K.box(g, 1.6, 1.08, 1.2, u ? 0xd9b45a : 0x9c8a5a, x, 0.55, z, { m: 0.8, r: 0.35 });
    K.print(g, SILK[n] ?? n.replace(/\d$/, (d) => (/^GND/.test(n) ? '' : d)), 3.4, 1.0, x + (anchor === 'r' ? 3.2 : -3.2), 1.02, z, { color: '#ffffff' });
    pins[n] = [x, 1.2, z];
    const name = /^GND/.test(n) ? 'GND' : TEXT[n] ?? n;
    pinLabels.push([used.has(n) || /^GND/.test(n) ? name : `${name} (ไม่ใช้)`, [x + (anchor === 'r' ? -1.6 : 1.6), 1.8, z], anchor]);
  };
  L.forEach((n, i) => pad(n, -7.6, -7 + i * 2, 'r'));
  R.forEach((n, i) => pad(n, 7.6, -7 + i * 2, 'l'));
  return { g, pins, pinLabels, labelY: 8 };
}

// เสาสปริงที่แถมมา (ตามรูป): ขดลวด ~10 รอบ ยาว ~13 มม. Ø ~5 มม. + ขาตรงสั้นสำหรับบัดกรี
function springAnt(T, K) {
  const g = new T.Group();
  const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120; const a = t * 10 * Math.PI * 2; pts.push(new T.Vector3(5 + t * 13, 2.6 + Math.sin(a) * 2.4, Math.cos(a) * 2.4)); }
  g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 480, 0.3, 6), K.M(0xc9a64a, { m: 0.85, r: 0.3 })));
  K.tube(g, [[0, 1.2, 0], [2.5, 2.6, 0], [5, 2.6, 2.4]], 0.3, 0xc9a64a, { m: 0.85, r: 0.3 });
  return { g, pins: { feed: [0, 1.2, 0] }, pinLabels: [], labelY: 8 };
}

// แหวนไฟที่ได้มา = CJMCU-2812B-12 (รูปผู้ใช้ 1 พ.ย.) มองด้านหลัง (ด้านบัดกรี ไฟหันลง)
// จุดบัดกรี 4 จุดเรียงที่ขอบขวา บนลงล่าง DI 5V GND DO · รูยึด 4 รู · ตัวหนังสือ CJMCU-2812B-12 ขอบล่าง
function ring12(T, K) {
  const g = new T.Group();
  const prof = [[11.5, 0], [18.5, 0], [18.5, 1.6], [11.5, 1.6], [11.5, 0]].map(([x, y]) => new T.Vector2(x, y));
  g.add(new T.Mesh(new T.LatheGeometry(prof, 48), K.M(0x1b1b1b, { r: 0.6 })));
  for (const a of [0.75, 2.4, 3.9, 5.5]) K.cyl(g, 'y', 1.0, 1.7, 0x6b6b66, Math.cos(a) * 15.5, 0.85, -Math.sin(a) * 15.5, { m: 0.6, r: 0.4 }, 14);   // รูยึด
  K.print(g, 'CJMCU-2812B-12', 11, 1.6, 0, 1.62, 15, { color: '#e8e8e2' });
  const pins = {}; const pinLabels = [];
  [['DIN', -3.75, 'DI'], ['5V', -1.25, '5V'], ['GND', 1.25, 'GND'], ['DOUT', 3.75, 'DO']].forEach(([n, z, silk]) => {
    K.box(g, 2.6, 0.3, 1.7, n === 'DOUT' ? 0x9a9a94 : 0xc9cbcd, 15.4, 1.75, z, { m: 0.8, r: 0.35 });
    K.print(g, silk, 3, 1.3, 12.2, 1.62, z, { color: '#e8e8e2' });
    pins[n] = [15.4, 2.1, z];
    pinLabels.push([n === 'DOUT' ? 'DO (ไม่ใช้)' : silk, [17.4, 2.6, z], 'l']);
  });
  return { g, pins, pinLabels, labelY: 7 };
}

/* ---- ชิ้นตามของจริงที่ซื้อมา (รูปจากผู้ใช้ 1 พ.ย.) ---- */
// แผ่นทองแดง + ขาหัวเข็ม · ขาที่ใช้ = สีทอง · ขาที่ไม่ใช้ = สีเทา + ป้ายจาง
function padPin(T, K, g, pins, pinLabels, n, x, z, text, anchor, used, y0 = 1.6) {
  K.cyl(g, 'y', 0.95, 0.12, used ? 0xd9b45a : 0x8c8c86, x, y0 + 0.06, z, { m: 0.8, r: 0.35 }, 12);
  K.box(g, 0.64, 2.6, 0.64, used ? 0xc8a24a : 0x9a9a94, x, y0 + 1.3, z, { m: 0.85, r: 0.3 });
  pins[n] = [x, y0 + 3.0, z];
  pinLabels.push([used ? text : `${text} (ไม่ใช้)`, [x + (anchor === 'r' ? -1.8 : 1.8), y0 + 2.2, z], anchor]);
}

// PAM8403 แผ่นแดง ขาเรียงแถวเดียว 11 ขาที่ขอบซ้าย (ลำดับตามตัวหนังสือบนแผ่นจริง บนลงล่าง)
// ~21 × 32 มม. (ประมาณจากรูป: ระยะขา 2.54 มม. เป็นไม้บรรทัด) · SW = ขาปิดเสียง ปล่อยว่าง = ทำงาน
function pamReal(T, K) {
  const g = new T.Group(); const pins = {}; const pinLabels = [];
  K.box(g, 21, 1.6, 32, 0xc72a1f, 0, 0.8, 0, { r: 0.6 });
  K.box(g, 10, 1.6, 4, 0x1d1d1d, 2.2, 2.4, -4.6, { r: 0.45 });
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) K.box(g, 0.45, 0.3, 1.1, 0xc9c9c2, 2.2 - 4.4 + i * 1.27, 1.75, -4.6 + s * 2.5, { m: 0.8, r: 0.3 });
  K.print(g, 'PAM8403', 8.6, 1.4, 2.2, 3.22, -4.6, { color: '#9a9a9a' });
  K.box(g, 5.8, 1.6, 3.4, 0xd8a640, 2, 2.4, -11.6, { r: 0.5 }); K.box(g, 5.8, 1.6, 3.4, 0xd8a640, 2, 2.4, 3.6, { r: 0.5 });   // ตัวเก็บประจุแทนทาลัมสีเหลือง
  for (const z of [-12.8, 12.8]) K.cyl(g, 'y', 1.6, 1.7, 0x2a2a2a, 7.6, 0.85, z, { r: 0.6 }, 16);   // รูยึดสกรู
  const ORDER = [['R+', 'R+'], ['R-', 'R−'], ['L-', 'L− → ลำโพง −'], ['L+', 'L+ → ลำโพง +'], ['GND', 'GND'], ['+5V', '+5V'], ['SW', 'SW'], ['GND2', 'GND'], ['LIN', 'LIN เสียงเข้า'], ['GND3', 'GND'], ['RIN', 'RIN → GND']];
  const USED = new Set(['L-', 'L+', 'GND', '+5V', 'LIN', 'RIN']);
  ORDER.forEach(([n, text], i) => {
    const z = (i - 5) * P;
    padPin(T, K, g, pins, pinLabels, n, -8.6, z, text, 'l', USED.has(n));   // ป้ายอยู่บนแผ่น สายลำโพงออกทางซ้ายไม่ทับป้าย
    K.print(g, n.replace(/\d$/, '').replace('-', '−'), 3.2, 1.3, -5.2, 1.62, z, { color: '#ffffff' });
  });
  return { g, pins, pinLabels, labelY: 10 };
}

// ปุ่มอาร์เคดแบบมีหลอดไฟ (ของจริง: ไมโครสวิตช์ 3 ขา C / NO / NC + ขั้วหลอดไฟ 2 ขาที่ก้นปุ่ม) มองด้านหลัง
function arcadeButton(T, K, kind) {
  // ตามรูปสินค้า Cybertice + รูปผู้ใช้: ฝาโดมสีโปร่งแสง · ขอบดำหนา · บ่าดำ · ตัวเกลียวดำ + น็อตพลาสติก · ฐานดำยึดไมโครสวิตช์ฟ้า + ขั้วหลอดไฟ
  // มองด้านหลัง (ขาสวิตช์หันขึ้น) · โดมสีอยู่ล่างสุด เห็นเป็นขอบสีรอบขอบดำ
  const red = kind === 'sos';
  const g = new T.Group(); const pins = {}; const pinLabels = [];
  const flangeR = red ? 30 : 23; const bodyR = red ? 12 : 11; const bodyH = red ? 16 : 13; const bezelH = red ? 8 : 6.5;
  const mesh = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const capMat = new T.MeshStandardMaterial({ color: red ? 0xd8281e : 0x22b04a, roughness: 0.22, metalness: 0, transparent: true, opacity: 0.88, emissive: red ? 0x5a0a06 : 0x07401a, emissiveIntensity: 0.5 });
  const black = K.M(0x202022, { r: 0.55 });
  mesh(new T.CylinderGeometry(flangeR + 0.4, flangeR - 1.5, 3.2, 48), capMat, 0, 1.6, 0);                          // ฝาโดมสี
  mesh(new T.CylinderGeometry(flangeR - 2.8, flangeR - 0.6, bezelH, 48), black, 0, 3.2 + bezelH / 2, 0);                  // ขอบดำ (ลบมุม)
  let y = 3.2 + bezelH;
  mesh(new T.CylinderGeometry(bodyR + 3.2, bodyR + 3.2, 3, 32), black, 0, y + 1.5, 0); y += 3;                      // บ่า
  mesh(new T.CylinderGeometry(bodyR, bodyR, bodyH, 32), K.M(0x262628, { r: 0.6 }), 0, y + bodyH / 2, 0);          // ตัวเกลียว
  for (let k = 0.8; k < bodyH - 0.4; k += 1.6) mesh(new T.CylinderGeometry(bodyR + 0.45, bodyR + 0.45, 0.7, 32), black, 0, y + k, 0);   // ร่องเกลียว
  mesh(new T.CylinderGeometry(bodyR + 5.5, bodyR + 5.5, 5, 6), K.M(0x1a1a1c, { r: 0.5 }), 0, y + 2.5, 0);       // น็อตพลาสติก
  y += bodyH;
  K.box(g, bodyR * 2 + 2, 3, bodyR * 1.6, 0x1c1c1e, 0, y + 1.5, 0, { r: 0.55 }); y += 3;                          // ฐานยึดสวิตช์
  const top = y;
  // ไมโครสวิตช์ BLEE สีฟ้า (รูปผู้ใช้ 1 พ.ย.) พิมพ์ COM① NC② NO③ · ขาเรียงตามขอบ: COM ปลาย · NO กลาง · NC ปลายฝั่งก้านกด
  K.box(g, 20, 6.5, 10, 0x2a5fb0, -2, top + 3.25, 0, { r: 0.45 });
  K.box(g, 21, 2.2, 10.6, 0x1c1c1e, -2, top + 1.1, 0, { r: 0.55 });                                                // ขาจับสวิตช์ (ดำ)
  K.box(g, 3, 1.6, 2, 0xe0b84a, 9.4, top + 4.5, 0, { r: 0.5 });                                                     // ก้านกดเหลือง
  K.print(g, 'COM   NO   NC', 17, 2, -2, top + 6.52, 3.4, { color: '#e8e8e2' });
  [['COM', -8.5, 'COM ①'], ['NO', -2, 'NO ③'], ['NC', 4.5, 'NC']].forEach(([n, x, text]) => {
    const used = n !== 'NC';
    K.box(g, 3.2, 6, 0.5, used ? 0xd2d2ca : 0x8c8c86, x, top + 9.5, 0, { m: 0.85, r: 0.3 });                         // ขาเสียบแบน (แบบมีรู)
    K.cyl(g, 'z', 0.65, 0.56, 0x3a3a3a, x, top + 10.6, 0, { r: 0.6 }, 12);
    pins[n] = [x, top + 12.6, 0];
    if (n === 'COM') pinLabels.push([text, [x - 2, top + 13.5, 0], 'r']);   // NC ไม่มีป้าย (ขาเทา + ตัวหนังสือบนสวิตช์) ป้ายจะได้ไม่ชนกัน
    if (n === 'NO') pinLabels.push([text, [x, top + 16, -3], 'c']);
  });
  // ขั้วหลอดไฟ (แดง/ฟ้าตามรูป) เสียบก้นปุ่ม — รอบนี้ไม่ต่อ
  const lx = red ? 15 : 13;
  K.cyl(g, 'y', 3.2, 7, red ? 0xc8463c : 0x3a7fc8, lx, top + 0.5, 4, { r: 0.45 }, 16);
  for (const dx of [-1.4, 1.4]) K.box(g, 0.8, 4, 0.5, 0x8c8c86, lx + dx, top + 6, 4, { m: 0.8, r: 0.3 });
  pinLabels.push(['หลอดไฟ 2 ขา (ไม่ต่อ)', [lx - 2, top + 8, 10.5], 'l']);
  return { g, pins, pinLabels, labelY: top + 22 };
}

// ลำโพงที่มีอยู่ (ตามรูป): กรอบพลาสติกเทาสี่เหลี่ยมมุมมน กรวยรี ปลั๊กเล็ก 2 ขาที่ขอบ สายแดง-ดำบิดเกลียว · ขนาด ~30 × 40 มม. (ประมาณจากรูป)
function rectSpeaker(T, K) {
  const g = new T.Group(); const pins = {};
  K.box(g, 30, 4, 40, 0xd4d4d0, 0, 2, 0, { r: 0.6 });
  K.box(g, 25, 0.6, 34, 0x1d1d1d, 0, 4.3, 0, { r: 0.7 });
  const cone = K.cyl(g, 'y', 9, 1.2, 0x2c2c2c, 0, 4.9, 0, { r: 0.8 }, 32); cone.scale.z = 1.5;
  K.box(g, 4.5, 3, 3, 0xf0efe8, 6, 2.5, 21, { r: 0.5 });                                       // ปลั๊ก 2 ขา
  // สายลำโพงสั้น ๆ ลงมาใต้ปลั๊ก แล้วต่อสายจัมเปอร์ไปเสียบ breadboard (ไม่บัดกรีเข้า PAM8403)
  K.tube(g, [[5.4, 2, 22.5], [6, 1.6, 27], [5, 1.6, 31]], 0.55, 0xb4462f);
  K.tube(g, [[6.6, 2, 22.5], [9, 1.6, 27], [11, 1.6, 31]], 0.55, 0x1f1f1d);
  pins['+'] = [5, 2.0, 31.4]; pins['-'] = [11, 2.0, 31.4];
  return { g, pins, pinLabels: [['+ (สายแดง)', [3.4, 3.6, 30], 'r'], ['− (สายดำ)', [12.6, 3.6, 30], 'l']], labelY: 12 };
}

// รางถ่าน AA ×3 แบบไม่มีสวิตช์ สายแดง-ดำออกปลายเดียว (ตามรูป)
function battery3(T, K) {
  const g = new T.Group(); const pins = {};
  K.box(g, 47, 14, 58, 0x1c1c1c, 0, 7, 0, { r: 0.7 });
  for (let i = -1; i <= 1; i++) {
    K.cyl(g, 'z', 7.1, 50, 0x26262a, i * 15, 13, 0, { r: 0.35, m: 0.3 }, 24);                              // ถ่าน AA อัลคาไลน์ (ตัวดำคาดทอง)
    K.cyl(g, 'z', 7.15, 14, 0xc08a3e, i * 15, 13, (i === 0 ? 1 : -1) * 17.5, { r: 0.3, m: 0.6 }, 24);
    K.cyl(g, 'z', 2.2, 1.2, 0xbfc3c7, i * 15, 13, (i === 0 ? 1 : -1) * 25.6, { m: 0.8, r: 0.3 }, 12);
  }
  K.tube(g, [[23.5, 6, -10], [28, 3, -10], [33, 1.6, -9]], 0.7, 0xb4462f);
  K.tube(g, [[23.5, 6, -4], [28, 3, -4], [33, 1.6, -3]], 0.7, 0x1f1f1d);
  pins['+'] = [33.6, 2.2, -9]; pins['-'] = [33.6, 2.2, -3];
  return { g, pins, pinLabels: [['+ (สายแดง)', [36, 4.6, -11.5], 'l'], ['− (สายดำ)', [36, 4.6, -1], 'l']], labelY: 24 };
}

// ชิ้น 2 ขาบนแผ่น: ตัวต้านทาน / ตัวเก็บประจุเซรามิก / อิเล็กโทรไลต์ / ไดโอด · ขาลงรูจริง ตัวชิ้นลอยเหนือแผ่น
function lead2(T, K, kind, value, pa, pb) {
  const g = new T.Group();
  const A = new T.Vector3(pa.x, 0, pa.z); const B = new T.Vector3(pb.x, 0, pb.z);
  const mid = A.clone().add(B).multiplyScalar(0.5); const dir = B.clone().sub(A); const len = dir.length(); dir.normalize();
  const ang = Math.atan2(-dir.z, dir.x);
  const legC = 0xb9bcbf; const legO = { m: 0.85, r: 0.3 };
  let a1; let a2; let topY;
  if (kind === 'R' || kind === 'D') {
    const bl = Math.min(6.3, len - 1.6); const y = 2.4; const body = new T.Group(); body.position.set(mid.x, y, mid.z); body.rotation.y = ang; g.add(body);
    K.cyl(body, 'x', kind === 'D' ? 1.3 : 1.15, bl, kind === 'D' ? 0x1d1d1d : 0x5d93cf, 0, 0, 0, { r: 0.6 });
    if (kind === 'R') for (const s of [-1, 1]) K.cyl(body, 'x', 1.32, 1.3, 0x5d93cf, s * (bl / 2 - 0.65), 0, 0, { r: 0.6 });   // ปลายป่องแบบตัวต้านทานจริง
    if (kind === 'R') bands5(value).forEach(([c], i) => K.cyl(body, 'x', 1.2, 0.45, new T.Color(c).getHex(), i < 4 ? -bl / 2 + 0.8 + i * 0.95 : bl / 2 - 0.8, 0, 0, { r: 0.6 }));
    else K.cyl(body, 'x', 1.34, 0.7, 0xb0b0aa, bl / 2 - 0.9, 0, 0, { r: 0.5 });           // แถบ = ขา K (ฝั่ง B)
    a1 = mid.clone().addScaledVector(dir, -bl / 2).setY(y); a2 = mid.clone().addScaledVector(dir, bl / 2).setY(y); topY = y + 1.4;
  } else if (kind === 'E') {
    const big = /470/.test(value); const r = big ? 4 : /^1 /.test(value) ? 2.1 : 2.5; const h = big ? 9 : 5.5; const y0 = 1.8;
    K.cyl(g, 'y', r, h, 0x1e1e21, mid.x, y0 + h / 2, mid.z, { r: 0.5 }, 24);                   // ตัวดำ (ตามรูป)
    K.cyl(g, 'y', r * 0.9, 0.2, 0xb9bcbf, mid.x, y0 + h + 0.08, mid.z, { m: 0.85, r: 0.3 }, 24);   // ฝาบนโลหะ
    const st = K.box(g, 1.0, h - 0.4, 0.4, 0xa9adb5, 0, y0 + h / 2, 0); st.position.set(mid.x + Math.sin(ang) * 0 + dir.x * r * 0.92, y0 + h / 2, mid.z + dir.z * r * 0.92);   // แถบขาว = ขาลบ (ฝั่ง B)
    a1 = mid.clone().addScaledVector(dir, -0.9).setY(y0); a2 = mid.clone().addScaledVector(dir, 0.9).setY(y0); topY = y0 + h;
  } else {
    const y = 3.4; const body = new T.Group(); body.position.set(mid.x, y, mid.z); body.rotation.y = ang; g.add(body);
    const small = /10 nF/.test(value);   // ตามรูป: 100 nF = ตัวกลมสีส้มอิฐ "104" · 10 nF = ตัวเล็กสีเหลืองส้ม "103"
    K.cyl(body, 'z', small ? 1.7 : 2.2, 1.2, small ? 0xd9a04c : 0xc4643c, 0, 0, 0, { r: 0.6 }, 20);   // แผ่นกลมตั้งขวางแนวขา
    a1 = mid.clone().addScaledVector(dir, -1.0).setY(y - 1.6); a2 = mid.clone().addScaledVector(dir, 1.0).setY(y - 1.6); topY = y + 2;
  }
  const leg = (h, a) => K.tube(g, [[h.x, -0.6, h.z], [h.x, 0.6, h.z], [(h.x + a.x) / 2, Math.max(1, a.y - 0.3), (h.z + a.z) / 2], [a.x, a.y, a.z]], 0.3, legC, legO);
  leg(A, a1); leg(B, a2);
  return { g, topY };
}

/* ------------------------------------------------------------------ ประกอบผัง */
function build(T, K, data, offBoard) {
  const B = board(T, K);
  const problems = B.problems;
  const cols = data.cols ?? 63; const cc = (cols + 1) / 2; const lastRail = cols === 30 ? 30 : 61; const hole = (h) => holePos(h, cc);
  const main = breadboardMesh(T, K, cols, (cols + 1) * P + 3, 21.4 * P, 0, 0, lastRail, data.key === 'bbHouse' ? 'Breadboard 400 รู (กล่องบ้าน)' : 'Breadboard แผ่นใหญ่ (ตัวรับ)');
  B.root.add(main.g); B.partLabels.add(main.lab);

  // ราง: จุดต่อทุกจุดเป็นรู (ใช้กับ "ดูทั้งจุดต่อ" และสีชิป)
  const railDefs = cols === 30 ? [['bb.vsys', 'vsys', 'power', 'VSYS', 2, 30], ['bb.gndT', 'gndT', 'ground', 'GND', 2, 30], ['bb.gndB', 'gndB', 'ground', 'GND', 2, 30], ['bb.3v3', '3v3', 'power', '3V3', 2, 30]] : [['bb.vsys', 'vsys', 'power', 'VSYS', 3, 31], ['bb.vsys2', 'vsys', 'power', null, 33, 61], ['bb.gndT', 'gndT', 'ground', 'GND', 3, 31], ['bb.gndT2', 'gndT', 'ground', null, 33, 61],
    ['bb.gndB', 'gndB', 'ground', 'GND', 3, 31], ['bb.gndB2', 'gndB', 'ground', null, 33, 61], ['bb.3v3', '3v3', 'power', '3V3', 3, 31], ['bb.3v32', '3v3', 'power', null, 33, 61]];
  for (const [name, k, type, text, c1, c2] of railDefs) {
    const holes = []; for (let c = c1; c <= c2; c++) if (railHole(c, lastRail)) holes.push({ i: c, j: 0, x: (c - cc) * P, z: RAIL_Z[k] });
    B.rails[name] = { path: [[(c1 - cc) * P, RAIL_Z[k]], [(c2 - cc) * P, RAIL_Z[k]]], y: 0.3, type, text: RAIL_NAME[name], holes };
    if (text) B.railLabel(text, type, (c1 - cc - 0.6) * P, RAIL_Z[k], true);
  }

  const partOf = {};   // id ชิ้น → { group, labels[], pinLabels[] } ไว้ซ่อน/โชว์ตามขั้น
  const addPart = (id, part, x, z, rot, name, opts = {}) => {
    const nPin = B.pinLabels.children.length; const nLab = B.partLabels.children.length;
    B.add(id, part, x, z, rot, name, { major: true, ...opts });
    partOf[id] = { group: part.g, labels: B.partLabels.children.slice(nLab), pinLabels: B.pinLabels.children.slice(nPin) };
    return part;
  };

  // ESP32-C3: ขาหัวเข็มชี้ลงรู · ยกตัวบอร์ดขึ้นเหนือแผ่น
  const sm = superMini(T, K, { real: true }); const lift = 2.6;
  sm.g.children.forEach((m) => { if (m.material?.color?.getHex() === 0xc8a24a) m.position.y = -1.0; });
  const wrap = new T.Group(); sm.g.position.y = lift; wrap.add(sm.g);
  for (const px of [-7.62, 7.62]) K.box(wrap, 2.5, lift, 20.3, 0x1b1b1b, px, lift / 2, 0, { r: 0.7 });   // ฐานพลาสติกของขาหัวเข็ม
  const mcuPart = { g: wrap, pins: Object.fromEntries(Object.entries(sm.pins).map(([n, p]) => [n, [p[0], p[1] + lift, p[2]]])), pinLabels: sm.pinLabels.map(([t, p, a]) => [t, [p[0], p[1] + lift, p[2]], a]) };
  // ขา 5V (ขาแรกฝั่ง USB ของแถว 5V) ลงรูที่ข้อมูลกำหนด → หาตำแหน่งวาง
  const c5v = +Object.keys(data.mcu.top).find((c) => data.mcu.top[c] === '5V'); const h5 = hole(`m${c5v}${data.mcu.topRow}`);
  const rot = Math.PI / 2; const loc5 = sm.pins['5V'];   // หัว USB ชี้ซ้าย → แถว 5V…GPIO0 อยู่แถวบน (ตามบอร์ดจริง มองด้านชิป)
  const mx = h5.x - (loc5[0] * Math.cos(rot) + loc5[2] * Math.sin(rot)); const mz = h5.z - (-loc5[0] * Math.sin(rot) + loc5[2] * Math.cos(rot));
  addPart(data.mcu.id, mcuPart, mx, mz, rot, 'ESP32-C3 Super Mini', { labelDz: -16 });
  const used = new Map();   // รู → ใครใช้
  const take = (h, who) => {
    if (used.has(h)) problems.push(`รูซ้ำ ${h}: ${used.get(h)} กับ ${who}`); used.set(h, who);
    const r = /^bb\.\w+?(2?)@(\d+)$/.exec(h);
    if (r) { const c = +r[2]; const right = r[1] === '2';
      if (!railHole(c, lastRail)) problems.push(`ไม่มีรูรางที่ ${h} (${who})`);
      if (cols !== 30 && (right ? c < 33 : c > 31)) problems.push(`รูราง ${h} อยู่คนละครึ่งกับชื่อราง (${who})`); }
  };
  for (const [rowName, map] of [[data.mcu.topRow, data.mcu.top], [data.mcu.bottomRow, data.mcu.bottom]]) for (const [c, n] of Object.entries(map)) {
    const want = hole(`m${c}${rowName}`); const got = B.pins.get(`${data.mcu.id}.${n}`);
    if (Math.abs(got.x - want.x) > 0.05 || Math.abs(got.z - want.z) > 0.05) problems.push(`ขาบอร์ด ${n} ไม่ลงรู m${c}${rowName}`);
    take(`m${c}${rowName}`, `${data.mcu.id}.${n}`);
  }

  // ชิ้น 2 ขาบนแผ่น
  for (const p of data.parts) {
    const [ta, tb] = Object.keys(p.pins); const pa = hole(p.pins[ta]); const pb = hole(p.pins[tb]);
    if (!pa || !pb) { problems.push(`ชื่อรูผิด ${p.id}`); continue; }
    const part = lead2(T, K, p.kind, p.value, pa, pb);
    part.pins = { [ta]: [pa.x, 0.3, pa.z], [tb]: [pb.x, 0.3, pb.z] }; part.pinLabels = [];
    addPart(p.id, part, 0, 0, 0, `${p.id} ${p.value}`, { major: false, labelH: 2.4 });
    take(p.pins[ta], `${p.id}.${ta}`); take(p.pins[tb], `${p.id}.${tb}`);
  }
  // ชิ้นนอกแผ่น (บัดกรีสาย)
  for (const [id, part, x, z, r, name, opts] of offBoard(T, K)) addPart(id, part, x, z, r, name, opts);

  // ปลายสาย: รูตามข้อมูล (หรือจุดบัดกรีของชิ้นนอกแผ่น)
  const ends = data.nets.map((n) => n.at.map((h, k) => {
    if (!h) { const p = B.pins.get(k ? n.to : n.from); if (!p) problems.push(`ไม่พบจุดบัดกรี ${k ? n.to : n.from}`); return p ? p.clone() : new T.Vector3(); }
    take(h, `สาย ${n.id}`); const q = hole(h); if (!q) { problems.push(`ชื่อรูผิด ${h}`); return new T.Vector3(); }
    return new T.Vector3(q.x, 0.35, q.z);
  }));
  // ขาที่เสียบรูเดียวกันแถวเดียวกัน = ต่อกัน (ให้ "ดูทั้งจุดต่อ" นับถูก)
  const links = [];
  for (const [h, who] of used) if (!who.startsWith('สาย')) links.push([who, stripOf(h)]);
  data.nets.forEach((n) => n.at.forEach((h, k) => { if (h) links.push([k ? n.to : n.from, stripOf(h)]); }));
  for (const [ps, rail] of Object.entries(data.rails)) links.push([ps, rail]);

  const out = B.done();
  const house = data.key === 'bbHouse';
  return Object.assign(out, {
    key: data.key, title: house ? 'Breadboard กล่องบ้าน' : 'Breadboard ตัวรับ', holes: [],
    extent: house ? { minX: -135, maxX: 110, minZ: -125, maxZ: 100, maxY: 45 } : { minX: -92, maxX: 92, minZ: -34, maxZ: 84, maxY: 12 },
    endpoint: (i, side) => ends[i][side], links, partOf, data,
  });
}

// ชิ้นนอกแผ่นของแต่ละผัง: [id, part, x, z, หมุน, ชื่อ, ตัวเลือก]
function radioSet(T, K, sxId, antId, sxX) {
  const sx = sx1276(T, K); const ant = springAnt(T, K); const sxZ = 68;   // ต่ำกว่าแนวสายวัดน้ำ (z ≈ 52) สายจะได้ไม่พาดทับโมดูล
  const antPad = sx.pins.ANT;
  return [[sxId, sx, sxX, sxZ, 0, 'วิทยุ XL1276-P01 (SX1276) มองด้านตัวหนังสือ', { labelDz: 13 }],
    [antId, ant, sxX + antPad[0] + 1.5, sxZ + antPad[2], 0, 'เสาสปริง (แถมมา)', { labelDz: -6 }]];   // ANT อยู่มุมขวาบน เสายื่นออกขวา
}
export function buildBBHouse(T, K) {
  return build(T, K, BB_HOUSE, () => [
    ...radioSet(T, K, 'sx', 'ant', -26),
    ['btn-sos', arcadeButton(T, K, 'sos'), -80, -75, 0, 'ปุ่มแดง 60 มม. (มองด้านหลัง)'],
    ['btn-ack', arcadeButton(T, K, 'ack'), 8, -96, 0, 'ปุ่มเขียว 46 มม. (มองด้านหลัง)'],
    ['ring', ring12(T, K), -28, -62, 0, 'แหวนไฟ CJMCU-2812B-12 (มองด้านหลัง)', { labelDz: -24 }],
    ['amp', pamReal(T, K), 82, -55, 0, 'PAM8403 (แผ่นแดง 11 ขา)', { labelDz: -22 }],   // ขาอยู่ขวาของรูปลายทาง สายทุกเส้นออกซ้าย ไม่ทับป้ายขา
    ['speaker', rectSpeaker(T, K), 48, -62, 0, 'ลำโพง (สายแดง-ดำ มีปลั๊ก)'],
    ['battery', battery3(T, K), -108, 2, 0, 'รางถ่าน AA ×3 (ไม่มีสวิตช์)'],
    ['probe', waterProbe(T, K), -80, 50, 0, 'สายวัดน้ำ (บ้านติดเตียง)'],
  ]);
}
export function buildBBRx(T, K) {
  return build(T, K, BB_RX, () => radioSet(T, K, 'rx-sx', 'rx-ant', -8));
}

/* ------------------------------------------------------------- ชื่อขาแบบอ่านง่าย */
const PART_NAME = { mcu: 'ESP32-C3', 'rx-mcu': 'ESP32-C3', sx: 'วิทยุ SX1276', 'rx-sx': 'วิทยุ SX1276', ant: 'เสาสปริง', 'rx-ant': 'เสาสปริง',
  'btn-sos': 'ปุ่มแดง', 'btn-ack': 'ปุ่มเขียว', ring: 'แหวนไฟ', amp: 'PAM8403', speaker: 'ลำโพง', battery: 'รางถ่าน', probe: 'สายวัดน้ำ' };
const PIN_TH = { red: 'สายแดง', black: 'สายดำ', feed: 'จุดบัดกรี', '-': '−', 'L-': 'L−', LIN: 'LIN', RIN: 'RIN', COM: 'COM', DIN: 'DI', '3.3V': 'VCC', RESET: 'REST' };
export function bbShort(name) {
  if (RAIL_NAME[name]) return RAIL_NAME[name].replace(' (ครึ่งขวา)', ' ขวา');
  const i = name.indexOf('.'); const id = name.slice(0, i); const pin = name.slice(i + 1);
  if (id === 'mcu' || id === 'rx-mcu') return /^GPIO/.test(pin) ? pin : `บอร์ด ${pin}`;
  if (PART_NAME[id]) return `${PART_NAME[id]} ${PIN_TH[pin] ?? pin}`;
  return `${id} ขา ${PIN_TH[pin] ?? pin}`;
}
export function bbDetail(name, values) {
  if (RAIL_NAME[name]) return { part: RAIL_NAME[name], pin: 'ทุกรูในแนวเส้นสีเดียวกันต่อกัน' };
  const i = name.indexOf('.'); const id = name.slice(0, i); const pin = name.slice(i + 1);
  if (id === 'mcu' || id === 'rx-mcu') return { part: 'ESP32-C3 Super Mini', pin: `ขา ${pin} (เทียบชื่อที่พิมพ์บนบอร์ดจริง)` };
  if (id === 'sx' || id === 'rx-sx') return { part: 'วิทยุ XL1276-P01 (SX1276)', pin: `${{ '3.3V': 'VCC', RESET: 'REST' }[pin] ?? pin} — ตามตัวหนังสือด้านหลังโมดูล` };
  if (PART_NAME[id]) return { part: PART_NAME[id], pin: PIN_TH[pin] ?? pin };
  const v = values[id]; const polar = { '+': 'ขา + (ขายาว)', '-': 'ขา − (ฝั่งแถบ)', A: 'ขา A (ฝั่งไม่มีแถบ)', K: 'ขา K (ฝั่งแถบ)' };
  return { part: `${id}${v ? ' ' + v : ''}`, pin: polar[pin] ?? `ขา ${pin} (ไม่มีขั้ว)` };
}
