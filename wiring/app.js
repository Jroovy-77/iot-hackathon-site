/**
 * app.js — หน้า "ผังต่อสาย 3 มิติ" : หมุนดูได้ · จิ้มสีเพื่อโฟกัส · จิ้มสายเพื่อดูว่าต่อจากไหนไปไหน · ติ๊กรายการตอนต่อจริง
 * เส้นสาย = docs/wiring.md ข้อ 3.1 / 3.2 ทุกเส้น (ผ่าน exploded/parts.js) — หน้านี้ไม่เพิ่ม ไม่ตัดสาย
 * มุมมอง 2 แบบใช้ฉากเดียวกัน: "3 มิติ" (กล้องมุมเอียง หมุนได้) / "2D" (กล้อง orthographic มองตรงจากด้านบน เลื่อน-ซูมได้)
 */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { NETS, RX_NETS } from '../exploded/parts.js';
import { makeKit, WIRE_COLORS, VALUES, RADIO_NUM, MCU_L, MCU_R } from './parts3d.js';
import { buildHouse, buildReceiver } from './layout.js';
import { buildBBHouse, buildBBRx, holeText, bbShort, bbDetail } from './breadboard.js';
import { BB_HOUSE, BB_RX, PINS } from './breadboard-nets.js';
import { checkBoard, checkPins } from './breadboard-check.js';

const T = THREE;
const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const TYPE_TH = { power: 'ไฟบวก', ground: 'กราวด์', data: 'ข้อมูล', audio: 'เสียง' };
const TYPE_CSS = { power: '#B4462F', ground: '#1F1F1D', data: '#2E6DB4', audio: '#7A4FB0' };

/* ------------------------------------------------------------ ชื่อชิ้น/ขาแบบอ่านง่าย */
const PART_TH = {
  'power-in': 'สาย USB ไฟบ้าน', battery: 'รางถ่าน AA ×3', mcu: 'ESP32-C3 Super Mini', radio: 'Wio-SX1262',
  antenna: 'เสาอากาศ', 'btn-sos': 'ปุ่มแดง', 'btn-ack': 'ปุ่มเขียว', 'water-probe': 'สายวัดน้ำ', amp: 'PAM8403',
  speaker: 'ลำโพง', 'q-power': 'AO3401A', 'q-drive': 'S8050', 'rx-mcu': 'ESP32-C3 Super Mini', 'rx-radio': 'Wio-SX1262',
  'rx-antenna': 'เสา 3 dBi', laptop: 'โน้ตบุ๊ก',
};
const RAIL_TH = { 'rail.VSYS': 'ราง VSYS', 'rail.VSW': 'ราง VSW', 'rail.3V3': 'ราง 3V3', gnd: 'GND', 'rx.3V3': 'ราง 3V3', 'rx.gnd': 'GND',
  // แท็บ Breadboard
  'bb.vsys': 'VSYS บน', 'bb.vsys2': 'VSYS บน ขวา', 'bb.gndT': 'GND บน', 'bb.gndT2': 'GND บน ขวา', 'bb.gndB': 'GND ล่าง', 'bb.gndB2': 'GND ล่าง ขวา',
  'bb.3v3': '3V3 ล่าง', 'bb.3v32': '3V3 ล่าง ขวา', 'hb.vsys': 'VSYS แผ่นครึ่ง', 'hb.gnd': 'GND แผ่นครึ่ง' };
let bbMode = false;   // แท็บที่เปิดอยู่เป็น Breadboard ไหม (ชื่อขาใช้ชุดของ breadboard.js)
const isRail = (n) => n in RAIL_TH;

// GND7 / GND10 แสดงเป็น GND (เลขขาแสดงแยกอยู่แล้ว) · ขาอื่นคงชื่อเดิม เช่น DIO1
const radioName = (pin) => (pin.startsWith('GND') ? 'GND' : pin);
function splitName(name) { const i = name.indexOf('.'); return i < 0 ? [name, ''] : [name.slice(0, i), name.slice(i + 1)]; }

function partTitle(id) {
  if (PART_TH[id]) return PART_TH[id];
  const led = /^leds(\d)$/.exec(id); if (led) return `ไฟ WS2812B ดวง ${led[1]}`;
  return `${id}${VALUES[id] ? ' ' + VALUES[id] : ''}`;
}

// ชื่อสั้นสำหรับรายการ
function shortPin(name) {
  if (bbMode) return bbShort(name);
  if (isRail(name)) return RAIL_TH[name];
  const [id, pin] = splitName(name);
  if (id === 'mcu' || id === 'rx-mcu') return /^GPIO/.test(pin) ? pin : `บอร์ด ${pin}`;
  if (id === 'radio' || id === 'rx-radio') return pin === 'IPEX' ? 'วิทยุ IPEX' : `วิทยุ ${RADIO_NUM[pin]}·${radioName(pin)}`;
  const led = /^leds(\d)$/.exec(id); if (led) return `ไฟ${led[1]} ${pin}`;
  const map = { 'power-in': 'USB', battery: 'ถ่าน', 'btn-sos': 'ปุ่มแดง', 'btn-ack': 'ปุ่มเขียว', 'water-probe': 'สายวัดน้ำ',
    amp: 'PAM', speaker: 'ลำโพง', 'q-power': 'AO3401A', 'q-drive': 'S8050', antenna: 'เสา', 'rx-antenna': 'เสา', laptop: 'โน้ตบุ๊ก' };
  const pinTh = { red: 'แดง', black: 'ดำ', feed: 'U.FL', cable: 'U.FL', INL: 'L', INR: 'R', 'OUTL+': 'L+', 'OUTL-': 'L−', '-': '−' }[pin] ?? pin;
  if (map[id]) return `${map[id]} ${pinTh}`;
  if (/^(R|rxR)\d/.test(id)) return id;
  return `${id} ${pinTh}`;
}

// คำอธิบายเต็มสำหรับการ์ด "สายที่เลือก"
function pinDetail(name) {
  if (bbMode) return bbDetail(name, B().values);
  if (isRail(name)) {
    const d = { 'rail.VSYS': 'รางไฟหลัก ~4.2–4.7 V (ไฟบ้านผ่าน D1 หรือถ่านผ่าน D2)', 'rail.VSW': 'ไฟหลังสวิตช์ตัดไฟ เปิดเฉพาะตอนใช้ (เสียง + ไฟ 9 ดวง)',
      'rail.3V3': 'ไฟ 3.3 V จากขา 3V3 ของบอร์ด', gnd: 'กราวด์รวม ทุก GND ต่อกัน', 'rx.3V3': 'ไฟ 3.3 V จากขา 3V3 ของบอร์ด', 'rx.gnd': 'กราวด์รวม' }[name];
    return { part: RAIL_TH[name], pin: d };
  }
  const [id, pin] = splitName(name);
  const part = partTitle(id);
  if (id === 'mcu' || id === 'rx-mcu') {
    if (pin === 'USB-C') return { part, pin: 'ช่อง USB-C (เสียบสาย)' };
    const li = MCU_L.indexOf(pin); const ri = MCU_R.indexOf(pin);
    const pos = li >= 0 ? `แถวซ้าย ขาที่ ${li + 1}` : `แถวขวา ขาที่ ${ri + 1}`;
    return { part, pin: `${pin} — ${pos} นับจากหัว USB (เทียบชื่อที่พิมพ์บนบอร์ด)` };
  }
  if (id === 'radio' || id === 'rx-radio') {
    if (pin === 'IPEX') return { part, pin: 'ช่อง IPEX บนโมดูล (เสียบหัว U.FL ไม่ต้องบัดกรี)' };
    return { part, pin: `ขา ${RADIO_NUM[pin]} ${radioName(pin)} (เลขขาตาม datasheet บนแผ่นแปลงขา)` };
  }
  const led = /^leds(\d)$/.exec(id);
  if (led) {
    const t = { '+5V': '+5V (แผ่นทองแดงริมซ้าย)', GND: 'GND (แผ่นทองแดงริมขวา)', DIN: 'DIN ขาเข้า (ตรงกลาง ฝั่งต้นลูกศร)', DOUT: 'DOUT ขาออก (ตรงกลาง ฝั่งปลายลูกศร)' }[pin];
    return { part, pin: t ?? pin };
  }
  const R = /^(R|rxR)\d+$/.test(id); const C = /^(C|rxC)\d+$/.test(id); const D = /^D\d$/.test(id);
  if (R) return { part, pin: `ปลาย ${pin} (ตัวต้านทานไม่มีขั้ว ใส่ด้านไหนก็ได้)` };
  if (C) return { part, pin: pin === '+' ? 'ขา + (ขายาว)' : pin === '-' ? 'ขา − (ฝั่งแถบขาว ขาสั้น)' : `ขา ${pin} (ไม่มีขั้ว)` };
  if (D) return { part, pin: pin === 'A' ? 'ขา A (ฝั่งไม่มีแถบ)' : 'ขา K (ฝั่งแถบเทา)' };
  const misc = {
    'q-power.G': '1 G (เกต)', 'q-power.S': '2 S (ซอร์ส)', 'q-power.D': '3 D (เดรน)',
    'q-drive.E': 'E (ซ้าย เมื่อหันหน้าแบนเข้าหาตัว)', 'q-drive.B': 'B (กลาง)', 'q-drive.C': 'C (ขวา)',
    'btn-sos.NO': 'NO (ขาปกติเปิด)', 'btn-sos.COM': 'COM (ขาร่วม)', 'btn-ack.NO': 'NO (ขาปกติเปิด)', 'btn-ack.COM': 'COM (ขาร่วม)',
    'power-in.+5V': 'สายแดง +5V (ตัดหัวสายด้านกล่อง)', 'power-in.GND': 'สายดำ GND', 'battery.+': 'สายแดง + (หลังสวิตช์ของราง)', 'battery.-': 'สายดำ −',
    'water-probe.red': 'สายแดง', 'water-probe.black': 'สายดำ', 'amp.+5V': '+ 5V (ไฟเลี้ยง)', 'amp.GND': '− GND', 'amp.INL': 'L เสียงเข้าซ้าย',
    'amp.INR': 'R เสียงเข้าขวา', 'amp.OUTL+': 'L+ ลำโพงซ้าย', 'amp.OUTL-': 'L− ลำโพงซ้าย (ห้ามต่อกราวด์)', 'speaker.+': '+', 'speaker.-': '−',
    'antenna.feed': 'หัว U.FL ของสายเสา', 'rx-antenna.cable': 'หัว U.FL ของสายแปลงขั้ว', 'laptop.USB': 'พอร์ต USB',
  };
  return { part, pin: misc[name] ?? pin };
}

// กลุ่มในรายการ (เรียงตามขั้นตอนการต่อ)
const HOUSE_GROUPS = [
  ['ไฟเข้าและราง', () => true],
  ['วัดถ่าน', (ids) => ids.some((i) => /^(R3|R4|C2)$/.test(i))],
  ['สวิตช์ตัดไฟ', (ids) => ids.some((i) => /^(q-power|q-drive|R10|R11|R12)$/.test(i))],
  ['วิทยุ + เสา', (ids) => ids.some((i) => /^(radio|antenna|R5|R6|C7|C8)$/.test(i))],
  ['ปุ่มแดง', (ids) => ids.some((i) => /^(btn-sos|C1)$/.test(i))],
  ['สายวัดน้ำ (บ้านติดเตียง)', (ids) => ids.some((i) => /^(water-probe|R7|R13)$/.test(i))],
  ['ปุ่มเขียว', (ids) => ids.some((i) => /^(btn-ack|R2)$/.test(i))],
  ['ไฟ 9 ดวง', (ids) => ids.some((i) => /^(leds\d|R8)$/.test(i))],
  ['เสียง', (ids) => ids.some((i) => /^(amp|speaker|R9|C4|C5)$/.test(i))],
];
const RX_GROUPS = [
  ['USB และไฟ', () => true],
  ['ตัวเก็บประจุ', (ids) => ids.some((i) => /^rxC/.test(i))],
  ['วิทยุ (SPI + ขาควบคุม)', (ids) => ids.some((i) => /^(rx-radio|rxR1)$/.test(i)) && !ids.includes('rx-antenna')],
  ['เสา', (ids) => ids.includes('rx-antenna')],
];
function groupOf(net, groups) {
  const ids = [net.from, net.to].map((n) => splitName(n)[0]);
  for (let g = groups.length - 1; g >= 0; g--) if (groups[g][1](ids)) return g;
  return 0;
}

/* ---------------------------------------------------------------- three setup */
const host = $('#view');
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const cam3 = new T.PerspectiveCamera(38, 1, 2, 4000);
const controls3 = new OrbitControls(cam3, renderer.domElement);
controls3.enableDamping = !reduceMotion; controls3.dampingFactor = 0.12;
controls3.maxPolarAngle = Math.PI * 0.49; controls3.minDistance = 25; controls3.maxDistance = 1200;
controls3.screenSpacePanning = true;

// 2D: กล้อง orthographic มองตรงลงจากด้านบน (ขนาดบนจอไม่ย่อตามระยะ อ่านชื่อขาง่าย) · ลากเพื่อเลื่อน ไม่หมุน
const ORTHO_H = 100;                     // ครึ่งความสูงของกรอบภาพ (หน่วยโลก) ก่อนซูม
const cam2 = new T.OrthographicCamera(-ORTHO_H, ORTHO_H, ORTHO_H, -ORTHO_H, -2000, 4000);
let controls2 = null; let cam2Tall = null;
function makeControls2(tall) {
  // ทิศ "บนจอ" ของมุม 2D: จอนอน = -Z (ผังเหมือนมุม 3 มิติ) · จอตั้ง = -X (กล่องอยู่บน ฝาอยู่ล่าง)
  if (controls2 && cam2Tall === tall) return;
  const prevT = controls2 ? controls2.target.clone() : null; const was = controls2?.enabled;
  controls2?.dispose();
  cam2.up.set(tall ? -1 : 0, 0, tall ? 0 : -1);
  controls2 = new OrbitControls(cam2, renderer.domElement);
  controls2.enableRotate = false; controls2.screenSpacePanning = true; controls2.zoomToCursor = true;
  controls2.enableDamping = !reduceMotion; controls2.dampingFactor = 0.12;
  controls2.minZoom = 0.25; controls2.maxZoom = 40;
  controls2.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
  controls2.touches = { ONE: T.TOUCH.PAN, TWO: T.TOUCH.DOLLY_PAN };
  if (prevT) { controls2.target.copy(prevT); cam2.position.set(prevT.x, 1000, prevT.z); }
  controls2.enabled = !!was; controls2.addEventListener('change', () => requestRender());
  controls2.update(); cam2Tall = tall;
}
let camera = cam3; let controls = controls3;
const is2D = () => camera === cam2;

const scene = new T.Scene();
scene.background = new T.Color(0xf3f2ee);
const hemi = new T.HemisphereLight(0xffffff, 0xd9d6cc, 2.1); scene.add(hemi);
const sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(-160, 420, 260); scene.add(sun);
const fill = new T.DirectionalLight(0xffffff, 0.5); fill.position.set(220, 160, -200); scene.add(fill);

// แท็บ Breadboard: แสงแบบถ่ายรูปสินค้า (ผู้ใช้ขอ 2 พ.ย. "สะอาดแบบรูปตัวอย่าง สมจริงราว 50%")
// ห้องสตูดิโอจำลองในเครื่อง (ไม่โหลดไฟล์จากเน็ต) → โลหะ/ตะกั่ว/พลาสติกมีแสงสะท้อน · ไฟหลักทอดเงานุ่มลงพื้น
const studioEnv = (() => {
  const s = new T.Scene();
  s.add(new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: new T.Color(0.42, 0.42, 0.40), side: T.BackSide })));
  const panel = (w, h, x, y, z, k) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(k, k, k * 0.97), side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(6, 4, 0, 4.9, 0, 3.2); panel(3, 4, -4.9, 2, 1, 1.6); panel(3, 3, 4.9, 1.5, -1, 1.0); panel(4, 2, 0, 1, 4.9, 1.3);
  const pm = new T.PMREMGenerator(renderer); const tex = pm.fromScene(s, 0.04).texture; pm.dispose(); return tex;
})();
Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 200, bottom: -200, near: 100, far: 900 });
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.25; sun.shadow.radius = 4;
// พื้นรับเงา (โปร่งใส เห็นแค่เงา) วางระดับผิว breadboard
const shadowCatch = new T.Mesh(new T.PlaneGeometry(1400, 1000), new T.ShadowMaterial({ opacity: 0.2, depthWrite: false }));
shadowCatch.rotation.x = -Math.PI / 2; shadowCatch.position.y = 0.03; shadowCatch.receiveShadow = true; shadowCatch.visible = false; scene.add(shadowCatch);
function applyLook() {
  const studio = bbMode && camera === cam3;
  scene.environment = studio ? studioEnv : null;
  hemi.intensity = studio ? 0.75 : 2.1; sun.intensity = studio ? 2.1 : 1.6; fill.intensity = studio ? 0.3 : 0.5;
  sun.castShadow = studio; shadowCatch.visible = studio;
  requestRender();
}

// พื้นกระดาษกราฟ
function gridFloor(w, d) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f3f2ee'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(31,31,29,0.10)'; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  g.strokeStyle = 'rgba(31,31,29,0.05)'; g.lineWidth = 1;
  for (let i = 0; i <= 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  const tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(w / 40, d / 40); tex.colorSpace = T.SRGBColorSpace;
  const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2; m.position.y = -2.2; return m; // ต่ำกว่าพื้นกล่อง (y −1.7) ให้เห็นพื้นกล่อง
}
const floor3 = gridFloor(1400, 1000); scene.add(floor3);
// พื้น 2D: สีเข้มมีจุดตาราง แบบโปรแกรมวาดวงจร (ผู้ใช้ขอ 24 ต.ค.) · จุดห่าง 2.54 มม. × 4 = 10.16 มม.
const BG_3D = new T.Color(0xf3f2ee); const BG_2D = new T.Color(0x1c2523);
function dotFloor(w, d) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1c2523'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(214,222,218,0.22)'; g.beginPath(); g.arc(64, 64, 5, 0, Math.PI * 2); g.fill();
  const tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; const cell = 2.54 * 4;
  tex.repeat.set(w / cell, d / cell); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2; m.position.y = -2.2; m.visible = false; return m;
}
const floor2 = dotFloor(1400, 1000); scene.add(floor2);

const K = makeKit(T);

/* -------------------------------------------------------------- wire routing */
function obstacleTop(obs, x, z) {
  let top = 0;
  for (const o of obs) if (x >= o.minX - 1 && x <= o.maxX + 1 && z >= o.minZ - 1 && z <= o.maxZ + 1 && o.top > top) top = o.top;
  return top;
}
function maxAlong(obs, segs, A, B) {
  let m = 0;
  for (const [x1, z1, x2, z2] of segs) {
    const len = Math.hypot(x2 - x1, z2 - z1); const n = Math.max(1, Math.ceil(len / 2));
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n; const z = z1 + ((z2 - z1) * i) / n;
      if (Math.hypot(x - A.x, z - A.z) < 4.5 || Math.hypot(x - B.x, z - B.z) < 4.5) continue;
      m = Math.max(m, obstacleTop(obs, x, z));
    }
  }
  return m;
}
function filletPath(raw, r) {
  // ตัดจุดซ้ำก่อน (สายแนวตรงจะมีมุมซ้อนกัน) ไม่งั้นจุดยกสายหายแล้วสายเฉียงทะลุชิ้น
  const pts = raw.filter((p, i) => i === 0 || p.distanceTo(raw[i - 1]) > 0.01);
  const out = [pts[0].clone()];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1]; const p1 = pts[i]; const p2 = pts[i + 1];
    const a = p0.clone().sub(p1); const b = p2.clone().sub(p1);
    const la = a.length(); const lb = b.length();
    if (la < 1e-3 || lb < 1e-3) continue;
    const rr = Math.min(r, la / 2, lb / 2);
    const s = p1.clone().add(a.normalize().multiplyScalar(rr)); const e = p1.clone().add(b.normalize().multiplyScalar(rr));
    for (let k = 0; k <= 6; k++) {
      const t = k / 6; const u = 1 - t;
      out.push(new T.Vector3().addScaledVector(s, u * u).addScaledVector(p1, 2 * u * t).addScaledVector(e, t * t));
    }
  }
  out.push(pts[pts.length - 1].clone());
  // เติมจุดระหว่างทาง ให้ท่อเรียบ
  const dense = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1]; const b = out[i]; const n = Math.max(1, Math.ceil(a.distanceTo(b) / 6));
    for (let k = 1; k <= n; k++) dense.push(a.clone().lerp(b, k / n));
  }
  return dense.filter((p, i) => i === 0 || p.distanceTo(dense[i - 1]) > 0.05);
}
function route(obs, A, B, lane) {
  const cands = [[B.x, A.z], [A.x, B.z]];
  let best = null;
  for (const [cx, cz] of cands) {
    const h = maxAlong(obs, [[A.x, A.z, cx, cz], [cx, cz, B.x, B.z]], A, B);
    if (!best || h < best.h - 0.5) best = { cx, cz, h };
  }
  const y = Math.max(A.y, B.y, best.h) + 3.2 + lane;
  const pts = [A.clone(), new T.Vector3(A.x, y, A.z), new T.Vector3(best.cx, y, best.cz), new T.Vector3(B.x, y, B.z), B.clone()];
  return filletPath(pts, 3.5);
}
// จุดต่อบนราง: เลือกจุดที่ใกล้ และสายไม่ต้องข้ามชิ้นสูง (เหมือนเดินสายจริงที่อ้อมชิ้นส่วน)
function railPoint(rail, near, obs) {
  if (rail.holes) {
    // รางบนแผ่นไข่ปลา: ต่อสายเข้าที่ "รู" ของราง เลือกรูที่ใกล้ ไม่ต้องข้ามชิ้นสูง และยังไม่มีสายอื่นใช้
    rail.used ??= new Map(); let best = null;
    for (const hp of rail.holes) {
      const p = new T.Vector3(hp.x, rail.y, hp.z);
      const d = Math.hypot(p.x - near.x, p.z - near.z);
      const h = obs ? Math.min(maxAlong(obs, [[near.x, near.z, p.x, near.z], [p.x, near.z, p.x, p.z]], near, p), maxAlong(obs, [[near.x, near.z, near.x, p.z], [near.x, p.z, p.x, p.z]], near, p)) : 0;
      const cost = d + Math.max(0, h - Math.max(near.y, 6)) * 5 + (rail.used.get(`${hp.i},${hp.j}`) || 0) * 12;
      if (!best || cost < best.cost) best = { p, cost, k: `${hp.i},${hp.j}` };
    }
    rail.used.set(best.k, (rail.used.get(best.k) || 0) + 1);
    return best.p;
  }
  let best = null;
  for (let i = 0; i < rail.path.length - 1; i++) {
    const [x1, z1] = rail.path[i]; const [x2, z2] = rail.path[i + 1];
    const dx = x2 - x1; const dz = z2 - z1; const L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((near.x - x1) * dx + (near.z - z1) * dz) / L2));
    const p = new T.Vector3(x1 + dx * t, rail.y, z1 + dz * t);
    const d = Math.hypot(p.x - near.x, p.z - near.z);
    const h = obs ? Math.min(maxAlong(obs, [[near.x, near.z, p.x, near.z], [p.x, near.z, p.x, p.z]], near, p), maxAlong(obs, [[near.x, near.z, near.x, p.z], [near.x, p.z, p.x, p.z]], near, p)) : 0;
    const cost = d + Math.max(0, h - Math.max(near.y, 6)) * 5;
    if (!best || cost < best.cost) best = { p, cost };
  }
  return best.p;
}

/* ------------------------------------------------------------------ boards */
function makeBoard(builder, nets, groups) {
  const B = builder(T, K);
  B.root.visible = false; scene.add(B.root);
  const wireGroup = new T.Group(); B.root.add(wireGroup);
  const tin = K.M(0xb9bcbf, { m: 0.7, r: 0.35 });
  const blobGeo = new T.SphereGeometry(0.85, 10, 8);
  const blobs = new Map();
  const blob = (p) => { const k = `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`; if (blobs.has(k)) return blobs.get(k); const m = new T.Mesh(blobGeo, tin); m.position.copy(p); wireGroup.add(m); blobs.set(k, m); return m; };

  // หาจุดต่อ (รองรับไฟ WS2812B ที่มีแผ่น +5V/GND สองฝั่ง: สายไปดวงถัดไปออกฝั่งขาออก ที่เหลือเข้าฝั่งขาเข้า)
  const resolve = (name, other) => {
    const m = /^leds(\d)\.(\+5V|GND)$/.exec(name);
    if (m) { const k = +m[1]; const om = /^leds(\d)\./.exec(other); const side = om && +om[1] === k + 1 ? 'out' : 'in'; return B.pins.get(`leds${k}.${m[2]}@${side}`); }
    return B.pins.get(name);
  };

  // union-find → จุดต่อทางไฟฟ้า (node)
  const parent = new Map(); const find = (a) => { if (!parent.has(a)) parent.set(a, a); let r = a; while (parent.get(r) !== r) r = parent.get(r); parent.set(a, r); return r; };
  for (const n of nets) parent.set(find(n.from), find(n.to));
  for (const [a, c] of B.links || []) parent.set(find(a), find(c));   // Breadboard: ขาที่เสียบรูแถวเดียวกันต่อกัน

  // Breadboard: ปลายสายที่เสียบรูเป็นหัวสายจัมเปอร์ (พลาสติกดำ + ขาโลหะ) แทนจุดตะกั่ว · ปลายที่บัดกรียังเป็นจุดตะกั่ว
  const plugGeo = new T.BoxGeometry(2.3, 7, 2.3); const collarGeo = new T.CylinderGeometry(0.95, 0.95, 1.2, 10); const pinGeo = new T.BoxGeometry(0.64, 1.2, 0.64);
  const plugs = [];
  const holeEnd = (i, k) => !!B.data?.nets?.[i]?.at?.[k];
  const plug = (p, color) => {
    const g = new T.Group(); g.position.set(p.x, 0, p.z);
    const mat = new T.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.55, transparent: true, opacity: 1 });
    const body = new T.Mesh(plugGeo, mat); body.position.y = 4.2; g.add(body);
    const collar = new T.Mesh(collarGeo, new T.MeshStandardMaterial({ color, roughness: 0.5, transparent: true, opacity: 1 })); collar.position.y = 8.3; g.add(collar);
    const pin = new T.Mesh(pinGeo, tin); pin.position.y = 0.3; g.add(pin);
    wireGroup.add(g); plugs.push(g); return g;
  };
  const wires = nets.map((net, i) => {
    let A = B.endpoint?.(i, 0) ?? (isRail(net.from) ? null : resolve(net.from, net.to));
    let Bp = B.endpoint?.(i, 1) ?? (isRail(net.to) ? null : resolve(net.to, net.from));
    if ((!isRail(net.from) && !A) || (!isRail(net.to) && !Bp)) throw new Error(`ไม่พบขา: ${net.from} → ${net.to}`);
    if (!A) A = railPoint(B.rails[net.from], Bp, B.obstacles); if (!Bp) Bp = railPoint(B.rails[net.to], A, B.obstacles);
    const lane = (i % 9) * 1.15;
    const pts = route(B.obstacles, A, Bp, lane);
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal', 0.2);
    const segs = Math.min(400, Math.max(24, Math.round(pts.length * 1.6)));
    const mat = new T.MeshStandardMaterial({ color: WIRE_COLORS[net.type], roughness: 0.5, metalness: 0.05, transparent: true, opacity: 1 });
    const mesh = new T.Mesh(new T.TubeGeometry(curve, segs, 0.62, 7), mat);
    // ขอบสายสีอ่อน (เฉพาะมุม 2D พื้นเข้ม) ให้สายกราวด์สีดำยังมองเห็น · ไม่เขียน depth จึงไม่บังตัวสาย
    const outline = new T.Mesh(new T.TubeGeometry(curve, segs, 0.98, 7), new T.MeshBasicMaterial({ color: 0xd4d8d3, transparent: true, opacity: 1, depthWrite: false }));
    outline.renderOrder = -1; outline.visible = false; wireGroup.add(outline);
    const hit = new T.Mesh(new T.TubeGeometry(curve, Math.max(12, segs >> 1), 2.6, 5), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    hit.userData.wire = i;
    wireGroup.add(mesh, hit);
    const dots = [A, Bp].map((p, k) => (holeEnd(i, k) ? plug(p, WIRE_COLORS[net.type]) : blob(p)));
    const box = new T.Box3().setFromPoints(pts);
    return { i, ...net, key: `${net.from}>${net.to}`, A, B: Bp, mesh, hit, mat, outline, dots, box, node: find(net.from), group: groupOf(net, groups) };
  });

  if (B.problems?.length) for (const p of B.problems) console.error(`[ผัง ${B.key}] ${p}`);
  const steps = groups.map((_, gi) => gi).filter((gi) => wires.some((w) => w.group === gi));
  if (B.data) B.root.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial) o.castShadow = true; });
  return Object.assign(B, { nets, wires, groups, steps, blobs: [...blobs.values(), ...plugs], hits: wires.map((w) => w.hit), find });
}

/* ---- อ่าน docs/wiring.md สด ๆ: เรียงสายตามลำดับแถวในเอกสาร + เทียบว่าตรงกันทุกเส้น */
async function loadDoc() {
  try {
    const r = await fetch('../docs/wiring.md', { cache: 'no-store' }); if (!r.ok) return null;
    const t = await r.text();
    const sect = (a, b) => { const i = t.indexOf(a); if (i < 0) return ''; const j = t.indexOf(b, i + a.length); return t.slice(i, j < 0 ? undefined : j); };
    const rows = (s) => [...s.matchAll(/^\|\s*([^|\s]+)\s*\|\s*([^|\s]+)\s*\|\s*(power|ground|data|audio)\s*\|/gm)].map((m) => ({ from: m[1], to: m[2], type: m[3] }));
    return { house: rows(sect('### 3.1', '### 3.2')), rx: rows(sect('### 3.2', '\n## ')) };
  } catch { return null; }
}
function orderNets(nets, docRows) {
  if (!docRows || !docRows.length) return { nets, ordered: false, diff: null };
  const pool = nets.slice(); const out = []; let missing = 0;
  for (const d of docRows) { const k = pool.findIndex((n) => n.from === d.from && n.to === d.to && n.type === d.type); if (k >= 0) out.push(pool.splice(k, 1)[0]); else missing++; }
  return { nets: out.concat(pool), ordered: true, diff: missing + pool.length };
}
const docRows = await loadDoc();
const ordH = orderNets(NETS, docRows?.house); const ordR = orderNets(RX_NETS, docRows?.rx);
const boards = {
  house: Object.assign(makeBoard(buildHouse, ordH.nets, HOUSE_GROUPS), { docOrdered: ordH.ordered && ordH.diff === 0, docSec: '3.1' }),
  rx: Object.assign(makeBoard(buildReceiver, ordR.nets, RX_GROUPS), { docOrdered: ordR.ordered && ordR.diff === 0, docSec: '3.2' }),
  bbHouse: bbSetup(makeBoard(buildBBHouse, BB_HOUSE.nets, BB_HOUSE.sections.map((t) => [t, () => false])), BB_HOUSE, '1'),
  bbRx: bbSetup(makeBoard(buildBBRx, BB_RX.nets, BB_RX.sections.map((t) => [t, () => false])), BB_RX, '2'),
};
const TABS = ['house', 'rx', 'bbHouse', 'bbRx'];

/* ---- แท็บ Breadboard: ขั้นตอนทีละสาย/ทีละชิ้น + เทียบกับ docs/wiring-breadboard.md และ pins.h */
function bbSetup(b, data, docSec) {
  b.wires.forEach((w) => { w.group = data.nets[w.i].sec; });
  b.values = Object.fromEntries(data.parts.map((p) => [p.id, p.value]));
  const byNet = new Map(data.nets.map((n, i) => [n.id, i]));
  b.seq = data.seq.map((s) => {
    const it = { ...s };
    if (s.kind === 'wire') { it.wire = byNet.get(s.net); it.sec = data.nets[it.wire].sec; }
    if (s.kind === 'part' && it.sec === undefined) it.sec = data.parts.find((x) => x.id === s.part)?.sec;
    return it;
  });
  b.steps = b.seq.map((_, k) => k);
  b.seq.forEach((s, k) => { if (s.kind === 'wire') b.wires[s.wire].seqPos = k; });
  b.appear = {};   // ชิ้นโผล่ที่ขั้นไหน (โหมดต่อทีละขั้น: ชิ้นที่ยังไม่ถึงคิวซ่อนไว้)
  b.seq.forEach((s, k) => {
    const ids = s.kind === 'wire' ? [data.nets[s.wire].from, data.nets[s.wire].to].map((n) => n.split('.')[0]) : s.part ? [s.part] : [];
    for (const id of ids) if (b.partOf[id] && !(id in b.appear)) b.appear[id] = k;
  });
  b.endText = (i, side) => { const h = data.nets[i].at[side]; return h ? holeText(h) : 'บัดกรีที่ขา/แผ่นของชิ้น'; };
  b.partHoles = (id) => {
    const p = data.parts.find((x) => x.id === id);
    if (p) return Object.entries(p.pins).map(([t, h]) => ({ pin: `${id}.${t}`, hole: h, text: holeText(h) }));
    if (id === data.mcu.id) {
      const top = Object.keys(data.mcu.top); const bot = Object.keys(data.mcu.bottom);
      return [{ pin: `${id}.${data.mcu.top[top.at(-1)]}`, hole: `m${top.at(-1)}${data.mcu.topRow}`, text: `ขาแถวบน ${data.mcu.topRow}${top[0]}–${top.at(-1)}` },
        { pin: `${id}.${data.mcu.bottom[bot.at(-1)]}`, hole: `m${bot.at(-1)}${data.mcu.bottomRow}`, text: `ขาแถวล่าง ${data.mcu.bottomRow}${bot[0]}–${bot.at(-1)}` }];
    }
    return [];
  };
  return Object.assign(b, { bb: true, data, docSec, docOrdered: false });
}
async function loadBBDoc() {
  const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? await r.text() : null; } catch { return null; } };
  const [md, pins] = await Promise.all([get('../docs/wiring-breadboard.md'), get('../firmware/common/pins.h')]);
  const res = { md: !!md, house: md ? checkBoard(BB_HOUSE, md, 'house') : null, rx: md ? checkBoard(BB_RX, md, 'rx') : null, pins: pins ? checkPins(PINS, pins) : null };
  for (const [k, r] of [['กล่องบ้าน', res.house], ['ตัวรับ', res.rx]]) if (r) for (const e of r.errors) console.error(`[Breadboard ${k}] ${e}`);
  if (res.pins) for (const e of res.pins.diffs) console.error(`[Breadboard pins.h] ${e}`);
  for (const [k, b] of Object.entries(boards)) if (b.bb && b.problems.length) for (const e of b.problems) console.error(`[ผัง ${k}] ${e}`);
  return res;
}
const bbCheck = await loadBBDoc();

/* ------------------------------------------------------------------- state */
const state = { tab: 'house', type: null, node: null, sel: null, step: null, view: '3d', ref: true, marks: null, done: { house: new Set(), rx: new Set(), bbHouse: new Set(), bbRx: new Set() } };
const prefs = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ไม่มีที่เก็บ ก็ใช้ต่อได้ */ } },
};
state.ref = prefs.get('wiring-ref') !== '0';
const store = {
  load(k) { try { const v = JSON.parse(localStorage.getItem(`wiring-done-${k}`) || '[]'); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); } },
  save(k, set) { try { localStorage.setItem(`wiring-done-${k}`, JSON.stringify([...set])); } catch { /* ไม่มีที่เก็บ ก็ใช้ต่อได้ */ } },
};
for (const k of Object.keys(state.done)) state.done[k] = store.load(k);
const B = () => boards[state.tab];

/* ----------------------------------------------------------- camera & render */
let dirty = true; function requestRender() { dirty = true; }
controls3.addEventListener('change', requestRender);
let tween = null;
// ระยะกล้อง 3 มิติ ↔ ซูม 2D (ให้เห็นความสูงภาพเท่ากัน)
const visH = (dist) => 2 * dist * Math.tan(T.MathUtils.degToRad(cam3.fov) / 2);
const zoomForDist = (dist) => (2 * ORTHO_H) / visH(dist);
const distForZoom = (z) => (2 * ORTHO_H) / z / (2 * Math.tan(T.MathUtils.degToRad(cam3.fov) / 2));
function flyTo(target, dist, dir) {
  if (is2D()) {
    const t = new T.Vector3(target.x, 0, target.z); const endPos = new T.Vector3(t.x, 1000, t.z);
    const z1 = T.MathUtils.clamp(zoomForDist(dist), controls2.minZoom, controls2.maxZoom);
    if (reduceMotion) { controls.target.copy(t); camera.position.copy(endPos); cam2.zoom = z1; cam2.updateProjectionMatrix(); controls.update(); requestRender(); return; }
    tween = { t0: performance.now(), dur: 650, p0: camera.position.clone(), t0v: controls.target.clone(), p1: endPos, t1v: t, z0: cam2.zoom, z1 };
    return;
  }
  const d = dir ? dir.clone().normalize() : camera.position.clone().sub(controls.target).normalize();
  const endPos = target.clone().addScaledVector(d, dist);
  if (reduceMotion) { controls.target.copy(target); camera.position.copy(endPos); controls.update(); requestRender(); return; }
  tween = { t0: performance.now(), dur: 650, p0: camera.position.clone(), t0v: controls.target.clone(), p1: endPos, t1v: target.clone() };
}
const HOME_DIR = new T.Vector3(0, 1.75, 0.9);
const HOME_DIR_TALL = new T.Vector3(0.9, 1.75, 0);   // จอแนวตั้ง: หมุนผังให้ด้านยาวตามความสูงจอ
const homeDir = () => (cam3.aspect < 0.85 ? HOME_DIR_TALL : HOME_DIR).clone().normalize();
// หาระยะกล้องให้เห็นทั้งผังพอดีจอ (ฉายมุมทั้ง 8 ของกรอบแล้วปรับจนพอดี)
function fitView(b) {
  const e = b.extent; const dir = homeDir();
  const pts = []; for (const x of [e.minX, e.maxX]) for (const z of [e.minZ, e.maxZ]) for (const y of [0, e.maxY ?? 20]) pts.push(new T.Vector3(x, y, z));
  const c = new T.Vector3((e.minX + e.maxX) / 2, 0, (e.minZ + e.maxZ) / 2); let dist = 600;
  const vf = T.MathUtils.degToRad(cam3.fov) / 2; const elev = Math.asin(dir.y);
  const cam = cam3.clone(); const right = new T.Vector3(); const fwd = new T.Vector3();
  for (let it = 0; it < 12; it++) {
    cam.position.copy(c).addScaledVector(dir, dist); cam.lookAt(c); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of pts) { const v = p.clone().project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const span = Math.max((x1 - x0) / 2 / 0.94, (y1 - y0) / 2 / 0.86);
    right.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize(); cam.getWorldDirection(fwd); fwd.setY(0).normalize();
    const halfH = dist * Math.tan(vf);
    c.addScaledVector(fwd, ((y0 + y1) / 2) * halfH / Math.sin(elev) * 0.9);
    c.addScaledVector(right, ((x0 + x1) / 2) * halfH * cam3.aspect * 0.9);
    dist *= span;
  }
  return { c, dist };
}
// 2D: ซูมให้เห็นทั้งผังพอดีจอ
function fit2D(b) {
  const e = b.extent; const tall = cam3.aspect < 0.85;
  const w = e.maxX - e.minX; const d = e.maxZ - e.minZ;
  const sw = tall ? d : w; const sh = tall ? w : d;          // กว้าง/สูงบนจอ
  const z = Math.min((2 * ORTHO_H * cam3.aspect) / (sw * 1.06), (2 * ORTHO_H) / (sh * 1.1));
  return { c: new T.Vector3((e.minX + e.maxX) / 2, 0, (e.minZ + e.maxZ) / 2), zoom: z };
}
function frameBoard(b, instant = false) {
  if (is2D()) {
    const { c, zoom } = fit2D(b);
    if (instant || reduceMotion) { controls.target.copy(c); cam2.position.set(c.x, 1000, c.z); cam2.zoom = zoom; cam2.updateProjectionMatrix(); controls.update(); requestRender(); }
    else flyTo(c, distForZoom(zoom));
    return;
  }
  const { c, dist } = fitView(b);
  if (instant || reduceMotion) { controls.target.copy(c); camera.position.copy(c.clone().addScaledVector(homeDir(), dist)); controls.update(); requestRender(); }
  else flyTo(c, dist, homeDir());
}
// ป้ายชิ้นหลักและราง: สูงคงที่บนจอ (พิกเซล)
function sizeScreenLabels() {
  const rc = host.getBoundingClientRect(); const h = rc.height || 600;
  // 3 มิติ: สเกล × ระยะ = ขนาดโลก · 2D (orthographic): สเกลเป็นหน่วยโลกตรง ๆ ต้องหารด้วยซูม
  const k = is2D() ? (2 * ORTHO_H) / cam2.zoom / h : 2 * Math.tan(T.MathUtils.degToRad(cam3.fov) / 2) / h;
  const small = rc.width < 640;
  for (const b of Object.values(boards)) for (const s of b.partLabels.children) {
    if (!s.userData.screen) continue;
    const px = s.userData.rail ? (small ? 11 : 15) : (small ? 12 : 17); s.scale.set(px * k * s.userData.aspect, px * k, 1);
  }
}
function frameWire(w) {
  const c = new T.Vector3(); w.box.getCenter(c); const s = new T.Vector3(); w.box.getSize(s);
  const small = B().grid || B().bb;
  const dist = Math.max(small ? 90 : 150, Math.max(s.x, s.z) * 1.35 + (small ? 40 : 70));
  flyTo(c, dist, camera.position.clone().sub(controls.target).normalize().lerp(homeDir(), 0.35));
}

function resize() {
  const r = host.getBoundingClientRect();
  const aspect = r.width / Math.max(1, r.height);
  renderer.setSize(r.width, r.height, false); cam3.aspect = aspect; cam3.updateProjectionMatrix();
  cam2.left = -ORTHO_H * aspect; cam2.right = ORTHO_H * aspect; cam2.top = ORTHO_H; cam2.bottom = -ORTHO_H; cam2.updateProjectionMatrix();
  makeControls2(aspect < 0.85);
  sizeScreenLabels(); requestRender();
  // หมุนจอ (แนวตั้ง ↔ แนวนอน) แล้วจัดมุมใหม่ ถ้ายังไม่ได้เลือกสาย
  const tall = aspect < 0.85;
  if (typeof state !== 'undefined' && resize.tall !== undefined && tall !== resize.tall && state.sel === null) frameBoard(B(), true);
  resize.tall = tall;
}
new ResizeObserver(resize).observe(host);

// ป้ายชี้ขาของสายที่เลือก (HTML)
const callA = $('#callA'); const callB = $('#callB');
const markGeo = new T.TorusGeometry(2.4, 0.42, 8, 28); const markMat = new T.MeshBasicMaterial({ color: 0x1f1f1d });
const markA = new T.Mesh(markGeo, markMat); const markB = new T.Mesh(markGeo, markMat);
markA.rotation.x = markB.rotation.x = -Math.PI / 2; markA.visible = markB.visible = false; scene.add(markA, markB);
function placeCallout(el, p) {
  const v = p.clone().project(camera); const r = host.getBoundingClientRect();
  const x = (v.x * 0.5 + 0.5) * r.width; const y = (-v.y * 0.5 + 0.5) * r.height;
  const vis = v.z < 1 && x > -40 && x < r.width + 40 && y > -40 && y < r.height + 40;
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; el.hidden = !vis;
}

const tmpV = new T.Vector3();
function tick(now) {
  if (tween) {
    const t = Math.min(1, (now - tween.t0) / tween.dur); const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0v, tween.t1v, e);
    if (tween.z1 !== undefined) { cam2.zoom = tween.z0 + (tween.z1 - tween.z0) * e; cam2.updateProjectionMatrix(); }
    if (t >= 1) tween = null; dirty = true;
  }
  if (controls.update()) dirty = true;
  if (state.sel !== null || state.marks) { const s = 1 + 0.18 * Math.sin(now / 260); markA.scale.setScalar(s); markB.scale.setScalar(s); dirty = true; }
  if (dirty) {
    dirty = false;
    // ป้ายชื่อขาโผล่เมื่อซูมเข้าใกล้
    const b = B();
    // ป้ายเล็กโผล่เมื่อซูมเข้า · 2D ใช้ "ระยะเทียบเท่า" จากซูม (ทุกจุดห่างกล้องเท่ากัน)
    const flat = is2D() ? distForZoom(cam2.zoom) : null;
    if (flat !== null) sizeScreenLabels();
    const near = b.grid || b.bb ? 0.62 : 1;      // ผังขนาดจริงชิ้นเล็กกว่า ต้องซูมใกล้กว่าป้ายถึงจะโผล่
    const pinD = 300 * near; const partD = 330 * near;
    for (const s of b.pinLabels.children) { if (s.userData.hidden) { s.visible = false; continue; } const d = flat ?? s.getWorldPosition(tmpV).distanceTo(camera.position); s.visible = d < pinD; s.material.opacity = Math.min(1, (pinD - d) / 50); }
    for (const s of b.partLabels.children) {
      if (s.userData.hidden || (s.userData.ref && !state.ref)) { s.visible = false; continue; }
      if (s.userData.major) { s.visible = true; continue; }
      // 2D: ป้ายรูเจาะชัดเต็มเสมอ (ใช้ดูตอนเจาะจริง)
      if (s.userData.ref && is2D()) { s.visible = true; s.material.opacity = 1; continue; }
      const d = flat ?? s.getWorldPosition(tmpV).distanceTo(camera.position); s.visible = d < partD; s.material.opacity = Math.min(1, (partD - d) / 50);
    }
    renderer.render(scene, camera);
    if (state.sel !== null) { const w = b.wires[state.sel]; placeCallout(callA, w.A); placeCallout(callB, w.B); }
    else if (state.marks) { placeCallout(callA, state.marks[0]); placeCallout(callB, state.marks[1]); }
  }
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ visuals */
function applyVisual() {
  const b = B(); const st = state.step;
  const it = b.bb && st !== null ? b.seq[st] : null;   // Breadboard: ขั้นละ 1 สาย / 1 ชิ้น / 1 จุดหยุดทดสอบ
  for (const d of b.blobs) d.visible = false;
  for (const w of b.wires) {
    // โหมดต่อทีละขั้น: ขั้นนี้ = เต็ม · ขั้นที่ผ่านมา = จาง (ต่อไปแล้ว) · ขั้นถัดไป = ซ่อน
    const shown = st === null || (it ? w.seqPos <= st : w.group <= st);
    let on = true;
    if (state.sel !== null) on = w.i === state.sel || (state.node !== null && w.node === state.node);
    else if (state.node !== null) on = w.node === state.node;
    else if (state.type) on = w.type === state.type;
    else if (it) on = it.kind === 'wire' ? w.i === it.wire : it.kind !== 'part';
    else if (st !== null) on = w.group === st;
    const past = st !== null && state.sel === null && (it ? w.seqPos < st : w.group < st);
    const op = on ? 1 : past ? 0.16 : 0.07;
    w.mesh.visible = shown; w.outline.visible = shown && is2D();
    w.mat.opacity = op; w.mat.depthWrite = on; w.mesh.renderOrder = on ? 2 : 0; w.outline.material.opacity = on ? 1 : op * 0.6;
    if (shown) for (const d of w.dots) { d.visible = true; d.traverse?.((o) => { if (o.material?.transparent) { o.material.opacity = op; o.material.depthWrite = on; } }); }
  }
  // แถวในรายการ
  for (const li of document.querySelectorAll('#list .row')) {
    const w = b.wires[+li.dataset.i];
    const match = state.sel !== null ? w.i === state.sel : state.node !== null ? w.node === state.node : state.type ? w.type === state.type
      : it ? (it.kind === 'wire' ? w.i === it.wire : w.group === it.sec) : st !== null ? w.group === st : true;
    li.classList.toggle('dim', !match); li.classList.toggle('sel', state.sel === w.i);
  }
  for (const g of document.querySelectorAll('#list .grp')) g.classList.toggle('cur', st !== null && +g.dataset.g === (it ? it.sec : st));
  if (b.bb) bbStepVisual(b, st, it);
  renderStep();
  for (const c of document.querySelectorAll('.chip[data-type]')) c.setAttribute('aria-pressed', String(state.type === c.dataset.type));
  for (const c of document.querySelectorAll('.chip[data-rail]')) c.setAttribute('aria-pressed', String(state.node !== null && state.sel === null && b.find(c.dataset.rail) === state.node));
  requestRender();
}

// Breadboard: ซ่อนชิ้นที่ยังไม่ถึงคิว + วงกลมชี้รูของขั้นนี้
function bbStepVisual(b, st, it) {
  for (const [id, p] of Object.entries(b.partOf)) {
    const vis = st === null || (b.appear[id] ?? 0) <= st;
    p.group.visible = vis; for (const l of [...p.labels, ...p.pinLabels]) l.userData.hidden = !vis;
  }
  if (state.sel !== null) return;
  state.marks = null; markA.visible = markB.visible = false; callA.hidden = callB.hidden = true;
  if (!it) return;
  let ends = null; let txt = null;
  if (it.kind === 'wire') { const w = b.wires[it.wire]; ends = [w.A, w.B]; txt = [`${shortPin(w.from)} · ${b.endText(w.i, 0)}`, `${shortPin(w.to)} · ${b.endText(w.i, 1)}`]; }
  else if (it.kind === 'part') {
    const hs = b.partHoles(it.part);
    if (hs.length >= 2) { ends = hs.slice(0, 2).map((h) => { const v = b.pins.get(h.pin); return new T.Vector3(v.x, 0.35, v.z); }); txt = hs.slice(0, 2).map((h) => `${shortPin(h.pin)} · ${h.text}`); }
  }
  if (!ends) return;
  state.marks = ends;
  markA.position.copy(ends[0]).setY(ends[0].y + 0.2); markB.position.copy(ends[1]).setY(ends[1].y + 0.2); markA.visible = markB.visible = true;
  callA.querySelector('b').textContent = txt[0]; callB.querySelector('b').textContent = txt[1];
}
const whyHtml = (t) => (t ? `<p class="bb-why"><b>ทำไมต่อแบบนี้</b> ${t}</p>` : '');
function bbStepCard(b, st) {
  const it = b.seq[st]; const sec = b.groups[it.sec][0];
  const head = `<div class="info-head"><span class="mono">ขั้น ${st + 1}/${b.seq.length}</span><span class="tag bb-sec">${sec}</span><span class="src mono">wiring-breadboard.md ข้อ 4</span></div>`;
  if (it.kind === 'wire') {
    const w = b.wires[it.wire]; const a = pinDetail(w.from); const c = pinDetail(w.to); const done = state.done[state.tab].has(w.key);
    const net = b.data.nets[w.i]; const what = net.solder ? 'บัดกรี' : (/^(bb|hb)\./.test(w.from) ? 'เสียบสายจัมเปอร์' : 'เสียบปลายสาย');
    return `${head}<h3 class="bb-title">${it.text || `${what}: ${shortPin(w.from)} → ${shortPin(w.to)}`} <span class="tag" style="--c:${TYPE_CSS[w.type]}"><i></i>${TYPE_TH[w.type]}</span></h3>
      <dl class="ends"><dt>จาก</dt><dd><b>${a.part}</b><span>${a.pin}</span><span class="hole">${b.endText(w.i, 0)}</span></dd>
      <dt>ไป</dt><dd><b>${c.part}</b><span>${c.pin}</span><span class="hole">${b.endText(w.i, 1)}</span></dd></dl>
      ${net.note ? `<p class="bb-note">${net.note}</p>` : ''}${whyHtml(net.why)}
      <div class="info-act"><button type="button" class="btn ${done ? 'on' : ''}" data-act="bbdone" aria-pressed="${done}">${done ? 'ต่อแล้ว ✓' : 'ทำเครื่องหมายว่าต่อแล้ว'}</button></div>`;
  }
  if (it.kind === 'part') {
    const p = b.data.parts.find((x) => x.id === it.part); const hs = b.partHoles(it.part);
    const title = p ? `เสียบ ${p.id} ${p.value}` : 'เสียบ ESP32-C3 Super Mini';
    return `${head}<h3 class="bb-title">${title}</h3>${it.text ? `<p>${it.text}</p>` : ''}
      <dl class="ends">${hs.map((h) => `<dt>${shortPin(h.pin).replace(/^.* ขา /, 'ขา ')}</dt><dd><span class="hole">${h.text}</span></dd>`).join('')}</dl>
      ${p?.note ? `<p class="bb-note">${p.note}</p>` : ''}${whyHtml(p?.why ?? it.why)}`;
  }
  const go = /แท็บ "Breadboard (ตัวรับ|กล่องบ้าน)"/.exec(it.text || '');
  const goBtn = go ? `<div class="info-act"><button type="button" class="btn ghost" data-act="bbgo" data-tab="${go[1] === 'ตัวรับ' ? 'bbRx' : 'bbHouse'}">ไปแท็บ Breadboard ${go[1]}</button></div>` : '';
  return `${head}<h3 class="bb-title${it.kind === 'test' ? ' stop' : ''}">${it.title}</h3><p>${it.text}</p>
    ${it.pass ? `<p class="bb-pass"><b>ผ่าน =</b> ${it.pass}</p>` : ''}${whyHtml(it.why)}${goBtn}`;
}

function select(i, { fly = true, scroll = true } = {}) {
  const b = B();
  if (i === null || i === undefined) {
    state.sel = null; state.node = null; state.marks = null; markA.visible = markB.visible = false; callA.hidden = callB.hidden = true; renderInfo(); applyVisual(); return;
  }
  state.sel = i; state.node = null; state.type = null; state.marks = null;
  const w = b.wires[i];
  markA.position.copy(w.A).setY(w.A.y + 0.2); markB.position.copy(w.B).setY(w.B.y + 0.2); markA.visible = markB.visible = true;
  callA.querySelector('b').textContent = shortPin(w.from) + (b.bb ? ` · ${b.endText(i, 0)}` : ''); callB.querySelector('b').textContent = shortPin(w.to) + (b.bb ? ` · ${b.endText(i, 1)}` : '');
  renderInfo(); applyVisual();
  if (fly) frameWire(w);
  if (scroll) {
    // เลื่อนเฉพาะกล่องรายการ (จอใหญ่) ไม่เลื่อนทั้งหน้า
    const box = $('#listScroll'); const li = document.querySelector(`#list .row[data-i="${i}"]`);
    if (li && box.scrollHeight > box.clientHeight + 4 && getComputedStyle(box).overflowY !== 'visible') {
      const r = li.getBoundingClientRect(); const br = box.getBoundingClientRect();
      if (r.top < br.top + 30 || r.bottom > br.bottom - 10) box.scrollTo({ top: box.scrollTop + (r.top - br.top) - box.clientHeight / 3, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
}

/* ---------------------------------------------------------------------- UI */
// ตำแหน่งรูบนแผ่นไข่ปลา (นับจากมุมซ้ายบน เริ่มที่ 1) ของขาบนแผ่น หรือจุดที่สายเข้าราง
function holeOf(b, name, p) {
  const g = b.grid; if (!g) return '';
  const bp = g.boardPins[name]; const q = bp ? { x: bp[0], z: bp[2] } : isRail(name) ? p : null;
  if (!q) return '';
  const i = Math.round((q.x - g.x0) / 2.54); const j = Math.round((q.z - g.z0) / 2.54);
  return `รู คอลัมน์ ${i + 1} · แถว ${j + 1}`;
}
function renderInfo() {
  const box = $('#info'); const b = B();
  if (b.bb && state.sel === null && state.step !== null) { box.innerHTML = bbStepCard(b, state.step); return; }
  if (state.sel === null) {
    box.innerHTML = `<p class="hint">จิ้มที่สายเส้นไหนก็ได้ หรือกดแถวในรายการด้านล่าง เพื่อดูว่าต่อจากขาไหนไปขาไหน</p>`;
    return;
  }
  const w = b.wires[state.sel]; const a = pinDetail(w.from); const c = pinDetail(w.to);
  const ha = b.bb ? b.endText(w.i, 0) : holeOf(b, w.from, w.A); const hc = b.bb ? b.endText(w.i, 1) : holeOf(b, w.to, w.B);
  const total = b.wires.length; const done = state.done[state.tab].has(w.key);
  const nodeCount = b.wires.filter((x) => x.node === w.node).length;
  box.innerHTML = `
    <div class="info-head"><span class="mono">สาย ${w.i + 1}/${total}</span><span class="tag" style="--c:${TYPE_CSS[w.type]}"><i></i>${TYPE_TH[w.type]}</span>
      ${b.docOrdered ? `<span class="src mono">wiring.md ${b.docSec} แถว ${w.i + 1}</span>` : ''}${b.bb ? `<span class="src mono">wiring-breadboard.md ข้อ ${b.docSec}</span>` : ''}</div>
    ${b.bb && b.data.nets[w.i].note ? `<p class="bb-note">${b.data.nets[w.i].note}</p>` : ''}${b.bb ? whyHtml(b.data.nets[w.i].why) : ''}
    <dl class="ends">
      <dt>จาก</dt><dd><b>${a.part}</b><span>${a.pin}</span>${ha ? `<span class="hole">${ha}</span>` : ''}</dd>
      <dt>ไป</dt><dd><b>${c.part}</b><span>${c.pin}</span>${hc ? `<span class="hole">${hc}</span>` : ''}</dd>
    </dl>
    <div class="info-act">
      <button type="button" class="btn ${done ? 'on' : ''}" data-act="done" aria-pressed="${done}">${done ? 'ต่อแล้ว ✓' : 'ทำเครื่องหมายว่าต่อแล้ว'}</button>
      <button type="button" class="btn ghost" data-act="node" ${nodeCount < 2 ? 'disabled' : ''}>ดูทั้งจุดต่อ (${nodeCount} เส้น)</button>
      <button type="button" class="btn ghost" data-act="prev" aria-label="สายก่อนหน้า">←</button>
      <button type="button" class="btn ghost" data-act="next" aria-label="สายถัดไป">→</button>
    </div>`;
}
$('#info').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'bbdone') { const it = B().seq[state.step]; if (it?.kind === 'wire') { toggleDone(it.wire); renderInfo(); } return; }
  if (act === 'bbgo') { const t = e.target.closest('[data-tab]')?.dataset.tab; if (t) { setTab(t); renderBadge(); } return; }
  if (!act || state.sel === null) return;
  const b = B(); const n = b.wires.length;
  if (act === 'done') toggleDone(state.sel);
  else if (act === 'node') { const w = b.wires[state.sel]; state.node = state.node === w.node ? null : w.node; applyVisual(); }
  else if (act === 'next') select((state.sel + 1) % n);
  else if (act === 'prev') select((state.sel - 1 + n) % n);
});

function toggleDone(i) {
  const set = state.done[state.tab]; const k = B().wires[i].key; set.has(k) ? set.delete(k) : set.add(k); store.save(state.tab, set);
  const li = document.querySelector(`#list .row[data-i="${i}"]`); if (li) li.querySelector('input').checked = set.has(k);
  renderProgress(); renderStep(); if (state.sel === i) renderInfo();
}
function renderProgress() {
  const b = B(); const set = state.done[state.tab]; const n = b.wires.filter((w) => set.has(w.key)).length; const total = b.wires.length;
  $('#prog-n').textContent = `${n}/${total}`; $('#prog-bar').style.width = `${(100 * n) / total}%`;
}

function renderList() {
  const b = B(); const ul = $('#list'); ul.innerHTML = '';
  b.groups.forEach(([title], gi) => {
    const items = b.wires.filter((w) => w.group === gi); if (!items.length) return;
    const sec = document.createElement('li'); sec.className = 'grp'; sec.dataset.g = gi;
    sec.innerHTML = `<h3>${title} <span class="mono">${items.length}</span></h3><ol></ol>`;
    const ol = sec.querySelector('ol');
    for (const w of items) {
      const li = document.createElement('li'); li.className = 'row'; li.dataset.i = w.i;
      li.innerHTML = `<input type="checkbox" aria-label="สาย ${w.i + 1} ต่อแล้ว" ${state.done[state.tab].has(w.key) ? 'checked' : ''}>
        <button type="button" class="go"><span class="num mono">${w.i + 1}</span><i class="dot" style="--c:${TYPE_CSS[w.type]}"></i><span class="txt">${shortPin(w.from)} <span class="arr">→</span> ${shortPin(w.to)}</span></button>`;
      ol.appendChild(li);
    }
    ul.appendChild(sec);
  });
  renderProgress();
}
$('#list').addEventListener('click', (e) => {
  const li = e.target.closest('.row'); if (!li) return;
  const i = +li.dataset.i;
  if (e.target.matches('input')) { toggleDone(i); return; }
  if (e.target.closest('.go')) select(state.sel === i ? null : i);
});

function renderChips() {
  const b = B();
  const counts = {}; for (const w of b.wires) counts[w.type] = (counts[w.type] || 0) + 1;
  $('#chips').innerHTML = Object.keys(TYPE_TH).filter((t) => counts[t]).map((t) =>
    `<button type="button" class="chip" data-type="${t}" aria-pressed="false" style="--c:${TYPE_CSS[t]}"><i></i>${TYPE_TH[t]} <span class="mono">${counts[t]}</span></button>`).join('');
  const seen = new Set();   // Breadboard: รางที่ต่อถึงกัน (สองครึ่ง / สองแผ่น) แสดงชิปเดียว
  const rails = Object.keys(b.rails).filter((r) => !b.bb || (b.wires.some((w) => w.node === b.find(r)) && !seen.has(b.find(r)) && seen.add(b.find(r))));
  $('#rails').innerHTML = rails.map((r) => {
    const node = b.find(r); const n = b.wires.filter((w) => w.node === node).length;
    return `<button type="button" class="chip rail" data-rail="${r}" aria-pressed="false" style="--c:${TYPE_CSS[b.rails[r].type]}"><i></i>${RAIL_TH[r]} <span class="mono">${n}</span></button>`;
  }).join('');
}
$('#legend').addEventListener('click', (e) => {
  const c = e.target.closest('.chip'); if (!c) return;
  const b = B();
  if (c.dataset.type) { const t = c.dataset.type; select(null); state.type = state.type === t ? null : t; state.node = null; }
  else if (c.dataset.rail) { const node = b.find(c.dataset.rail); const was = state.node === node && state.sel === null; select(null); state.type = null; state.node = was ? null : node; }
  applyVisual();
});
$('#reset').addEventListener('click', () => { select(null); state.type = null; state.node = null; applyVisual(); frameBoard(B()); });

const SUBTITLE = { house: 'ปุ่มเรียกเรือ รุ่นชาวบ้าน · ESP32-C3 Super Mini + Wio-SX1262', bb: 'FloodLink รอบ Breadboard · ESP32-C3 + SX1276' };
function setTab(tab, { instant = false } = {}) {
  state.tab = tab; state.sel = null; state.node = null; state.type = null; state.step = null; state.marks = null;
  bbMode = !!boards[tab].bb;
  $('.ttl p').textContent = bbMode ? SUBTITLE.bb : SUBTITLE.house;
  $('#note-bb').hidden = !bbMode; $('#solderLink').hidden = !bbMode; $('#bbWarn').hidden = !(bbMode && !bbCheck.pins?.verified);
  for (const [k, b] of Object.entries(boards)) b.root.visible = k === tab;
  applyLook();
  for (const t of document.querySelectorAll('.tab')) { const on = t.dataset.tab === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }
  markA.visible = markB.visible = false; callA.hidden = callB.hidden = true;
  $('#note-house').hidden = tab !== 'house'; $('#note-rx').hidden = tab !== 'rx';
  $('#refRow').hidden = !boards[tab].holes.length; renderHoles();
  renderChips(); renderList(); renderInfo(); applyVisual(); frameBoard(B(), instant);
  syncURL();
}
function syncURL() {
  const u = new URL(location.href);
  if (state.tab === 'house') u.searchParams.delete('tab'); else u.searchParams.set('tab', state.tab);
  if (state.view === '3d') u.searchParams.delete('view'); else u.searchParams.set('view', state.view);
  if (state.step === null) u.searchParams.delete('step'); else u.searchParams.set('step', String(B().steps.indexOf(state.step) + 1));
  history.replaceState(null, '', u);
}

/* ------------------------------------------------------------ สลับมุมมอง 3 มิติ / 2D */
const HOWTO = {
  '3d': 'ลากเพื่อหมุน · ล้อเมาส์หรือบีบนิ้วเพื่อซูม · คลิกขวาหรือลากสองนิ้วเพื่อเลื่อน · จิ้มที่สาย',
  '2d': 'มองจากด้านบน · ลากเพื่อเลื่อน · ล้อเมาส์หรือบีบนิ้วเพื่อซูม · จิ้มที่สาย',
};
function setView(v, { save = true, keep = true } = {}) {
  v = v === '2d' ? '2d' : '3d';
  const from = camera; state.view = v; tween = null;
  const to = v === '2d' ? cam2 : cam3;
  if (from !== to && keep) {
    // คงจุดที่กำลังดูอยู่ ข้ามไปอีกมุมมองโดยเห็นขนาดใกล้เคียงเดิม
    if (to === cam2) {
      const t = controls3.target; const d = cam3.position.distanceTo(t);
      controls2.target.set(t.x, 0, t.z); cam2.position.set(t.x, 1000, t.z);
      cam2.zoom = T.MathUtils.clamp(zoomForDist(d), controls2.minZoom, controls2.maxZoom); cam2.updateProjectionMatrix();
    } else {
      const t = controls2.target; const d = distForZoom(cam2.zoom);
      controls3.target.set(t.x, 0, t.z); cam3.position.copy(controls3.target).addScaledVector(homeDir(), T.MathUtils.clamp(d, controls3.minDistance, controls3.maxDistance));
    }
  }
  camera = to; controls = v === '2d' ? controls2 : controls3;
  // 2D: ชื่อขาวาดทับสายเสมอ (มองตรงลงมา สายอยู่สูงกว่าป้ายจะบังชื่อขา) · 3 มิติ: ให้ชิ้นที่อยู่หน้าบังตามจริง
  for (const b of Object.values(boards)) for (const sp of b.pinLabels.children) { sp.material.depthTest = v === '3d'; sp.renderOrder = v === '2d' ? 25 : 5; }
  // 2D: เครื่องหมายรูเจาะวาดทับปุ่ม/ลำโพง ให้เห็นว่าต้องเจาะตรงไหน
  for (const b of Object.values(boards)) b.refLayer.traverse((o) => { if (o.material && o.parent?.userData.drill) { o.material.depthTest = v === '3d'; o.renderOrder = v === '2d' ? 20 : 0; } });
  // 2D: พื้นเข้มจุดตาราง + ขอบสายสีอ่อน · 3 มิติ: พื้นกระดาษกราฟเดิม
  scene.background = v === '2d' ? BG_2D : BG_3D; floor2.visible = v === '2d'; floor3.visible = v === '3d';
  document.body.classList.toggle('v2d', v === '2d');
  controls3.enabled = v === '3d'; controls2.enabled = v === '2d'; controls.update();
  for (const b of document.querySelectorAll('#viewToggle [data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  $('#howto').textContent = HOWTO[v];
  $('#reset').textContent = v === '2d' ? 'เห็นทั้งผัง' : 'มุมเริ่มต้น';
  sizeScreenLabels(); if (state.tab) applyVisual(); applyLook();
  if (save) { prefs.set('wiring-view', v); syncURL(); }
}
$('#viewToggle').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });

/* -------------------------------------------------- ชั้นอ้างอิง: กรอบกล่อง + รูเจาะ */
function setRef(on) {
  state.ref = on; prefs.set('wiring-ref', on ? '1' : '0');
  for (const b of Object.values(boards)) b.refLayer.visible = on;
  $('#refBtn').setAttribute('aria-pressed', String(on)); requestRender();
}
$('#refBtn').addEventListener('click', () => setRef(!state.ref));
function renderHoles() {
  const hs = B().holes || []; const ul = $(state.tab === 'rx' ? '#holeListRx' : '#holeList'); if (!ul) return;
  const row = (h) => `<li><b>${h.name}</b> <span class="muted">· ${h.on}${h.place ? '' : ` · ${h.dia ? `Ø~${h.dia} มม.` : (h.sizeNote || 'ขนาด: วัดเกลียวปุ่มก่อนเจาะ')}`}${h.note ? ` · ${h.note}` : ''}</span><br><span class="mono where">${h.where ?? ''}</span></li>`;
  const drill = hs.filter((h) => !h.place); const place = hs.filter((h) => h.place);
  ul.innerHTML = drill.map(row).join('') + (place.length ? `<li class="hole-sub">วางชิ้นในกล่อง</li>${place.map(row).join('')}` : '');
}
for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => { setTab(t.dataset.tab); renderBadge(); });
$('.tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const k = TABS.indexOf(state.tab); const next = TABS[(k + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
  setTab(next); renderBadge(); document.querySelector(`.tab[data-tab="${next}"]`).focus();
});

/* ------------------------------------------------------- ต่อทีละขั้น (ตามกลุ่มในรายการ) */
function renderStep() {
  const b = B(); const on = state.step !== null;
  $('#stepToggle').hidden = on; $('#stepNav').hidden = !on;
  if (!on) return;
  const k = b.steps.indexOf(state.step);
  if (b.bb) {
    const it = b.seq[state.step]; const KIND = { wire: 'สาย', part: 'เสียบชิ้น', info: 'อ่าน', test: 'หยุดทดสอบ' };
    $('#stepTxt').innerHTML = `<span class="mono">ขั้น ${k + 1}/${b.steps.length}</span> <b>${b.groups[it.sec][0]}</b> <span class="mono muted${it.kind === 'test' ? ' stop' : ''}">${KIND[it.kind]}</span>`;
  } else {
    const items = b.wires.filter((w) => w.group === state.step);
    const done = items.filter((w) => state.done[state.tab].has(w.key)).length;
    $('#stepTxt').innerHTML = `<span class="mono">ขั้น ${k + 1}/${b.steps.length}</span> <b>${b.groups[state.step][0]}</b> <span class="mono muted">ต่อแล้ว ${done}/${items.length}</span>`;
  }
  $('#stepPrev').disabled = k <= 0; $('#stepNext').disabled = k >= b.steps.length - 1;
}
function frameStep() {
  const b = B(); const box = new T.Box3();
  if (b.bb) {
    const it = b.seq[state.step];
    if (it.kind === 'wire') box.union(b.wires[it.wire].box);
    else if (it.part && b.parts[it.part]) box.union(b.parts[it.part].box);
    else return;   // อ่าน / หยุดทดสอบ: คงมุมกล้องเดิม
  } else for (const w of b.wires) if (w.group === state.step) box.union(w.box);
  if (box.isEmpty()) return;
  const c = new T.Vector3(); box.getCenter(c); const sz = new T.Vector3(); box.getSize(sz);
  const r = host.getBoundingClientRect(); const aspect = r.width / Math.max(1, r.height);
  const span = Math.max(sz.z, sz.x / Math.max(0.6, aspect));
  flyTo(c.setY(0), Math.max(b.grid || b.bb ? 80 : 150, span * 1.25 + 30), homeDir());
}
function setStep(gi, { fly = true } = {}) {
  select(null); state.type = null; state.node = null; state.step = gi;
  applyVisual(); renderInfo(); syncURL();
  if (gi === null) { if (fly) frameBoard(B()); return; }
  if (fly) frameStep();
  const box = $('#listScroll'); const g = document.querySelector(`#list .grp[data-g="${B().bb ? B().seq[gi].sec : gi}"]`);
  if (g && box.scrollHeight > box.clientHeight + 4 && getComputedStyle(box).overflowY !== 'visible') box.scrollTo({ top: g.offsetTop - box.offsetTop, behavior: reduceMotion ? 'auto' : 'smooth' });
}
$('#stepToggle').addEventListener('click', () => setStep(B().steps[0]));
$('#stepPrev').addEventListener('click', () => { const s = B().steps; const k = s.indexOf(state.step); if (k > 0) setStep(s[k - 1]); });
$('#stepNext').addEventListener('click', () => { const s = B().steps; const k = s.indexOf(state.step); if (k < s.length - 1) setStep(s[k + 1]); });
$('#stepExit').addEventListener('click', () => setStep(null));

/* ---------------------------------------------------------------- picking */
const ray = new T.Raycaster(); const ndc = new T.Vector2();
function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const b = B();
  const cand = state.type ? b.hits.filter((h) => b.wires[h.userData.wire].type === state.type) : state.node !== null && state.sel === null ? b.hits.filter((h) => b.wires[h.userData.wire].node === state.node) : b.hits;
  const hit = ray.intersectObjects(cand.filter((h) => b.wires[h.userData.wire].mesh.visible), false)[0];
  return hit ? hit.object.userData.wire : null;
}
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
  down = null; const i = pick(e);
  if (i !== null) { const keepType = state.type; select(i, { fly: false }); if (keepType && B().wires[i].type !== keepType) state.type = null; }
  else if (state.sel !== null) select(null);
});
const tip = $('#tip'); let hoverRaf = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) { tip.hidden = true; return; }
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0; const i = pick(e);
    renderer.domElement.style.cursor = i !== null ? 'pointer' : 'grab';
    if (i === null) { tip.hidden = true; return; }
    const w = B().wires[i]; const r = host.getBoundingClientRect();
    tip.innerHTML = `<span class="mono">${w.i + 1}</span> ${shortPin(w.from)} → ${shortPin(w.to)}`;
    tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 12}px)`; tip.hidden = false;
  });
});
renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; });
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') select(null);
  else if (state.sel !== null && (e.key === 'n' || e.key === ']')) select((state.sel + 1) % B().wires.length);
  else if (state.sel !== null && (e.key === 'p' || e.key === '[')) select((state.sel - 1 + B().wires.length) % B().wires.length);
});

/* ------------------------------------------------- ป้ายผลเทียบกับ docs/wiring.md */
function renderBadge() {
  const badge = $('#src'); badge.title = '';
  if (bbMode) {
    const c = bbCheck; const n = (r) => (r ? r.errors.length : 0);
    if (!c.md) { badge.className = 'src'; badge.innerHTML = `เส้นสายคัดจาก <span class="mono">docs/wiring-breadboard.md</span> (เปิดผ่าน preview.bat เพื่อให้เช็กได้)`; return; }
    const bad = n(c.house) + n(c.rx) + (c.pins ? c.pins.diffs.length : 1);
    if (!bad) { badge.className = 'src ok'; badge.innerHTML = `ตรงกับ <span class="mono">docs/wiring-breadboard.md</span> ทุกเส้น · กล่องบ้าน ${c.house.wires} · ตัวรับ ${c.rx.wires} · ขาตรง <span class="mono">pins.h</span>`; }
    else { badge.className = 'src warn'; badge.innerHTML = `ต่างจาก <span class="mono">docs/wiring-breadboard.md</span> / <span class="mono">pins.h</span> ${bad} จุด — แจ้งทีมให้ตรวจ`; badge.title = [...(c.house?.errors || []), ...(c.rx?.errors || []), ...(c.pins?.diffs || ['อ่าน pins.h ไม่ได้'])].join('\n'); }
    return;
  }
  if (!docRows) { badge.className = 'src'; badge.innerHTML = `เส้นสายคัดจาก <span class="mono">docs/wiring.md</span> ข้อ 3.1 / 3.2`; return; }
  const d = (ordH.diff || 0) + (ordR.diff || 0);
  if (!d) { badge.className = 'src ok'; badge.innerHTML = `ตรงกับ <span class="mono">docs/wiring.md</span> ทุกเส้น · กล่องบ้าน ${NETS.length} · ตัวรับ ${RX_NETS.length}`; }
  else { badge.className = 'src warn'; badge.innerHTML = `ต่างจาก <span class="mono">docs/wiring.md</span> ${d} จุด — แจ้งทีมให้ตรวจ`; }
}

/* -------------------------------------------------------------------- start */
window.__wiring = {
  boards, select, setTab, setView, setStep, step: () => state.step, view: () => state.view, look: (x, z, dist) => flyTo(new T.Vector3(x, 0, z), dist), doc: { house: ordH.diff, rx: ordR.diff },
  bbCheck, tab: () => state.tab, stepInfo: () => (B().bb && state.step !== null ? { ...B().seq[state.step], n: B().seq.length } : null),
  problems: Object.fromEntries(Object.entries(boards).map(([k, b]) => [k, b.problems || []])),
  grid: Object.fromEntries(Object.entries(boards).filter(([, b]) => b.grid).map(([k, b]) => [k, { x0: b.grid.x0, z0: b.grid.z0, cols: b.grid.cols, rows: b.grid.rows, boardPins: b.grid.boardPins }])),
  dump: () => Object.fromEntries(Object.entries(boards).map(([k, b]) => [k, {
    wires: b.wires.map((w) => ({ i: w.i, from: w.from, to: w.to, type: w.type, A: w.A.toArray(), B: w.B.toArray() })),
    pins: Object.fromEntries([...b.pins].map(([n, v]) => [n, v.toArray()])),
    rails: Object.fromEntries(Object.entries(b.rails).map(([n, r]) => [n, { path: r.path, y: r.y }])),
  }])),
};
resize();
setView(params.get('view') || prefs.get('wiring-view') || '3d', { save: false, keep: false });
setRef(state.ref);
setTab(TABS.includes(params.get('tab')) ? params.get('tab') : 'house', { instant: true });
const wq = parseInt(params.get('w'), 10); if (wq >= 1 && wq <= B().wires.length) select(wq - 1, { fly: true });
const sq = parseInt(params.get('step'), 10); if (sq >= 1 && sq <= B().steps.length && !(wq >= 1)) setStep(B().steps[sq - 1], { fly: false });
const fq = params.get('focus'); if (fq && TYPE_TH[fq]) { state.type = fq; applyVisual(); }
renderBadge();
requestAnimationFrame(tick);
document.body.classList.add('ready');
