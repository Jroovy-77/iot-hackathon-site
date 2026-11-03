/**
 * parts3d.js — ชิ้นส่วน 3 มิติสำหรับหน้า "ผังต่อสาย 3 มิติ" (wiring/)
 * หน่วย = มม. ขนาดจริงโดยประมาณ · แกน: +X ขวา, +Y ขึ้น, +Z เข้าหาคนดู · ทุกชิ้นวางบนพื้น y = 0
 *
 * แหล่งความจริง:
 *  - เส้นสายทุกเส้น: docs/wiring.md ข้อ 3.1 (กล่องบ้าน 96 เส้น) และ 3.2 (ตัวรับ 21 เส้น) — ผ่าน exploded/parts.js (NETS, RX_NETS)
 *  - ค่า R/C/D: docs/wiring.md ตารางสรุป (ค่าออกแบบ จะปรับหลังทดสอบ)
 *  - ESP32-C3 Super Mini: 2 แถว แถวละ 8 ขา ระยะ 2.54 มม. ลำดับ 5V G 3.3 4 3 2 1 0 / 5 6 7 8 9 10 20 21 (components101, lastminuteengineers)
 *    ตรงกับโมเดลในเว็บ 3D (exploded/parts.js MCU_L / MCU_R) · ของจริงให้ยึดชื่อที่พิมพ์บนบอร์ด
 *  - Wio-SX1262: 12 ขา เลขตาม datasheet Seeed (1 RF_SW … 12 DIO1) วางบนแผ่นแปลงขาแบบ DIP (1–6 ซ้ายบนลงล่าง, 7–12 ขวาล่างขึ้นบน)
 *  - AO3401A (SOT-23): 1 G, 2 S, 3 D (AOS datasheet) · S8050 (TO-92): E B C เมื่อหันหน้าแบนเข้าหาตัว
 *
 * holes = ตำแหน่งรูที่ขาเสียบลงแผ่นไข่ปลา (x, z ท้องถิ่น) ทุกระยะเป็นจำนวนเท่าของ 2.54 มม.
 *  ขาที่ของจริงห่างไม่ตรง 2.54 (ตัวเก็บประจุ 2.5/5 มม., TO-92 1.27 มม.) ให้ดัดขาลงรูถัดไป ตามที่ทำกันบนแผ่นไข่ปลา
 */

export const TH_FONT = '"Leelawadee UI","Noto Sans Thai",Tahoma,sans-serif';
export const MONO_FONT = 'Consolas,"Cascadia Mono",monospace';
export const WIRE_COLORS = { power: 0xb4462f, ground: 0x1f1f1d, data: 0x2e6db4, audio: 0x7a4fb0 };

export const P = 2.54; // ระยะขา (ระยะรูแผ่นไข่ปลา)

// ค่า R/C/D จาก docs/wiring.md ตารางสรุป (ค่าออกแบบ)
export const VALUES = {
  R2: '100 kΩ', R3: '1 MΩ', R4: '1 MΩ', R5: '10 kΩ', R6: '10 kΩ', R7: '10 kΩ', R8: '330 Ω', R9: '2.2 kΩ',
  R10: '10 kΩ', R11: '100 kΩ', R12: '100 kΩ', R13: '1 kΩ',
  C1: '100 nF', C2: '100 nF', C4: '10 nF', C5: '1 µF', C6: '470 µF', C7: '10 µF', C8: '100 nF',
  D1: '1N5819', D2: '1N5819',
  // ตัวรับ: wiring.md 3.2 ไม่ระบุค่า — ทำหน้าที่เดียวกับ R5 / C7 / C8 ของกล่องบ้าน (ขาวิทยุเหมือนกล่องบ้าน)
  rxR1: '10 kΩ*', rxC1: '10 µF*', rxC2: '100 nF*',
};

export const RADIO_NUM = { RF_SW: 1, MISO: 2, MOSI: 3, SCK: 4, NRST: 5, NSS: 6, GND7: 7, VCC: 8, ANT: 9, GND10: 10, BUSY: 11, DIO1: 12 };
export const MCU_L = ['5V', 'GND', '3V3', 'GPIO4', 'GPIO3', 'GPIO2', 'GPIO1', 'GPIO0'];
export const MCU_R = ['GPIO5', 'GPIO6', 'GPIO7', 'GPIO8', 'GPIO9', 'GPIO10', 'GPIO20', 'GPIO21'];

/* ------------------------------------------------------------------ helpers */
export function makeKit(T) {
  const mats = new Map();
  const M = (color, o = {}) => {
    const key = `${color}|${o.r ?? 0.6}|${o.m ?? 0}|${o.e ?? 0}`;
    if (!mats.has(key)) mats.set(key, new T.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0, emissive: o.e ? color : 0x000000, emissiveIntensity: o.e ?? 0 }));
    return mats.get(key);
  };
  const box = (g, w, h, d, color, x = 0, y = 0, z = 0, o) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), M(color, o)); m.position.set(x, y, z); g.add(m); return m;
  };
  // ทรงกระบอก ตามแกน 'x' 'y' 'z'
  const cyl = (g, axis, r, len, color, x = 0, y = 0, z = 0, o, seg = 18) => {
    const m = new T.Mesh(new T.CylinderGeometry(r, r, len, seg), M(color, o));
    if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z); g.add(m); return m;
  };
  const tube = (g, pts, r, color, o) => {
    const c = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)), false, 'centripetal');
    const m = new T.Mesh(new T.TubeGeometry(c, Math.max(8, pts.length * 8), r, 8), M(color, o)); g.add(m); return m;
  };
  // ป้ายตัวหนังสือแบบ sprite (หันหาคนดูเสมอ)
  const label = (text, { h = 4, color = '#1F1F1D', bg = 'rgba(255,255,255,0.93)', border = '#9C9A92', mono = false, bold = false, depthTest = false, anchor = 'c', screen = false } = {}) => {
    const px = 56; const padX = 12;
    const c = document.createElement('canvas'); const g2 = c.getContext('2d');
    const font = `${bold ? '600 ' : ''}${px}px ${mono ? MONO_FONT : TH_FONT}`;
    g2.font = font;
    const w = Math.ceil(g2.measureText(text).width) + padX * 2; const hh = Math.ceil(px * 1.5);
    c.width = w; c.height = hh;
    g2.font = font;
    if (bg) { g2.fillStyle = bg; g2.fillRect(0, 0, w, hh); }
    if (border) { g2.strokeStyle = border; g2.lineWidth = 3; g2.strokeRect(1.5, 1.5, w - 3, hh - 3); }
    g2.fillStyle = color; g2.textBaseline = 'middle'; g2.fillText(text, padX, hh / 2 + 2);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest, depthWrite: false, transparent: true, sizeAttenuation: !screen }));
    s.scale.set((h * w) / hh, h, 1);
    if (anchor === 'l') s.center.set(0, 0.5); else if (anchor === 'r') s.center.set(1, 0.5);
    s.renderOrder = depthTest ? 5 : screen ? 30 : 20;
    s.userData.labelText = text; s.userData.aspect = w / hh; s.userData.screen = screen;
    return s;
  };
  // ตัวหนังสือพิมพ์บนผิวชิ้น (silkscreen) แบบแผ่นเรียบ
  const print = (g, text, w, h, x, y, z, { color = '#ffffff', bg = null, rotY = 0, mono = true, px = 48 } = {}) => {
    const c = document.createElement('canvas'); const g2 = c.getContext('2d');
    c.width = Math.max(64, Math.round(px * (w / h) * 1.0)); c.height = px * 1.2;
    if (bg) { g2.fillStyle = bg; g2.fillRect(0, 0, c.width, c.height); }
    g2.fillStyle = color; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.font = `600 ${px}px ${mono ? MONO_FONT : TH_FONT}`;
    g2.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 4);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotY; m.position.set(x, y, z); g.add(m); return m;
  };
  return { M, box, cyl, tube, label, print };
}

// ขาแบบหัวเข็ม (header pin) ตั้งขึ้น คืนตำแหน่งจุดต่อสายบนยอด
function headerPin(T, K, g, x, z, base = 1.6, len = 3.2) {
  K.cyl(g, 'y', 0.95, 0.12, 0xd9b45a, x, base + 0.06, z, { m: 0.8, r: 0.35 }, 12);   // จุดบัดกรีทอง
  K.box(g, 0.64, len, 0.64, 0xc8a24a, x, base + len / 2, z, { m: 0.85, r: 0.3 });
  return [x, base + len + 0.4, z];
}

// ขาที่เสียบลงรู = ตำแหน่ง x, z ของจุดต่อ (ชิ้นที่ใช้ขาหัวเข็ม)
function holesOf(pins) { return Object.fromEntries(Object.entries(pins).map(([n, p]) => [n, [p[0], p[2]]])); }

export function bandColors(value) {
  const map = ['#1b1b1b', '#7a4a2a', '#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2e6db4', '#7a4fb0', '#8a8a8a', '#f5f5f5'];
  const m = /([\d.]+)\s*([kM]?)/.exec(value); if (!m) return [];
  let n = parseFloat(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'M' ? 1e6 : 1);
  let exp = 0; while (n >= 100) { n /= 10; exp++; } while (n < 10) { n *= 10; exp--; }
  const d = Math.round(n); return [map[Math.floor(d / 10)], map[d % 10], map[exp] ?? '#c9a64a', '#c9a64a'];
}

/* -------------------------------------------------------------- part builders
 * ทุกตัวคืน { g: Group, pins: {ชื่อขา: [x,y,z] ท้องถิ่น}, labelY, pinLabels: [[text,[x,y,z],anchor]] }
 */
// real = true: ลำดับขาตามตัวหนังสือใต้บอร์ดจริง (รูปผู้ใช้ 1 พ.ย.): มองด้านชิป หัว USB ขึ้น → แถว 5V…GPIO0 อยู่ขวา แถว GPIO5…21 อยู่ซ้าย
// ค่าเริ่มต้น (false) คงแบบเดิมไว้ให้แท็บรุ่นชาวบ้าน — แบบเดิมกลับข้างจากของจริง ยังไม่ได้แก้
export function superMini(T, K, { real = false } = {}) {
  const g = new T.Group(); const pins = {}; const pinLabels = [];
  K.box(g, 18, 1.6, 22.5, 0x1d1f22, 0, 0.8, 0, { r: 0.7 });
  K.box(g, 9, 3.2, 7.4, 0xbfc3c7, 0, 1.6 + 1.6, -8.6, { m: 0.8, r: 0.3 });             // USB-C (ด้านบน = -Z)
  K.box(g, 7.2, 1.6, 0.3, 0x2b2d30, 0, 3.2, -12.32);                                      // ปากช่อง
  K.box(g, 5, 0.9, 5, 0x2b2b2b, 0, 2.05, 1.6, { r: 0.4 });                                // ชิป ESP32-C3
  K.box(g, 6.4, 1.1, 2.2, 0x8c8c86, 0, 2.15, 9.4, { r: 0.5 });                            // เสาอากาศเซรามิก
  K.box(g, 2.4, 1.0, 1.6, 0xd8d8d0, -4.6, 2.1, -3.6); K.box(g, 2.4, 1.0, 1.6, 0xd8d8d0, 4.6, 2.1, -3.6); // BOOT / RST
  K.print(g, 'ESP32-C3', 9, 1.8, 0, 1.62, 5.2, { color: '#e8e8e2' });
  K.print(g, 'BOOT', 3.6, 1.1, -4.6, 1.62, -1.9, { color: '#e8e8e2' }); K.print(g, 'RST', 3.6, 1.1, 4.6, 1.62, -1.9, { color: '#e8e8e2' });
  const sL = real ? 1 : -1;   // ฝั่งของแถว 5V
  const silk = (n) => (real ? ({ GND: 'G', '3V3': '3.3' }[n] ?? n.replace('GPIO', '')) : n);   // real: ชื่อสั้นแบบที่พิมพ์บนบอร์ด
  MCU_L.forEach((n, i) => {
    const z = -8.89 + i * P; pins[n] = headerPin(T, K, g, sL * 7.62, z);
    pinLabels.push([silk(n), [sL * (real ? 10.4 : 9.6), 3.2, z], real ? 'c' : 'r']);
  });
  MCU_R.forEach((n, i) => {
    const z = -8.89 + i * P; pins[n] = headerPin(T, K, g, -sL * 7.62, z);
    pinLabels.push([silk(n), [-sL * (real ? 10.4 : 9.6), 3.2, z], real ? 'c' : 'l']);
  });
  const holes = holesOf(pins);
  pins['USB-C'] = [0, 3.2, -12.6];
  return { g, pins, holes, pinLabels, labelY: 9 };
}

export function wioAdapter(T, K) {
  const g = new T.Group(); const pins = {}; const pinLabels = [];
  K.box(g, 17.8, 1.6, 17.8, 0x1f5f8b, 0, 0.8, 0, { r: 0.7 });                            // แผ่นแปลงขา
  K.box(g, 11.6, 2.95, 11, 0xc6c9cd, 0, 1.6 + 1.475, 0, { m: 0.75, r: 0.35 });            // โมดูล (ฝาโลหะ)
  K.print(g, 'Wio-SX1262', 9.5, 1.6, 0, 1.6 + 2.97, 0.6, { color: '#2b2b2b' });
  K.cyl(g, 'y', 1.1, 1.3, 0xd9b45a, 3.9, 1.6 + 2.95 + 0.65, -3.8, { m: 0.85, r: 0.3 }, 14); // ช่อง IPEX
  pins.IPEX = [3.9, 1.6 + 2.95 + 1.5, -3.8];
  const L = ['RF_SW', 'MISO', 'MOSI', 'SCK', 'NRST', 'NSS'];
  const R = ['DIO1', 'BUSY', 'GND10', 'ANT', 'VCC', 'GND7'];
  L.forEach((n, i) => { const z = -6.35 + i * P; pins[n] = headerPin(T, K, g, -6.35, z); pinLabels.push([`${RADIO_NUM[n]} ${n}`, [-8.6, 3.2, z], 'r']); });
  R.forEach((n, i) => {
    const z = -6.35 + i * P; pins[n] = headerPin(T, K, g, 6.35, z);
    const nm = n.replace(/\d+$/, (d) => (n.startsWith('GND') ? '' : d)) || n;
    pinLabels.push([`${n.startsWith('GND') ? 'GND' : nm} ${RADIO_NUM[n]}${n === 'ANT' ? ' (ไม่ใช้)' : ''}`, [8.6, 3.2, z], 'l']);
  });
  K.print(g, '1', 1.4, 1.4, -4.6, 1.62, -6.35, { color: '#ffffff' });
  const holes = holesOf(pins); delete holes.IPEX;
  return { g, pins, holes, pinLabels, labelY: 10 };
}

export function pam8403(T, K) {
  const g = new T.Group(); const pins = {}; const pinLabels = [];
  K.box(g, 22, 1.6, 19, 0x1f6b3a, 0, 0.8, 0, { r: 0.7 });
  K.box(g, 4.5, 1.0, 4.5, 0x2b2b2b, 1, 2.1, 0, { r: 0.4 });
  K.box(g, 3, 1.2, 2, 0x6b5a3a, -3, 2.2, 5); K.box(g, 3, 1.2, 2, 0x6b5a3a, 4, 2.2, -5);
  K.print(g, 'PAM8403', 10, 1.8, 1, 1.62, -6.8, { color: '#e8f2e8' });
  const pad = (n, x, z, text, anchor) => {
    K.box(g, 2.2, 0.15, 1.8, 0xd9b45a, x, 1.68, z, { m: 0.8, r: 0.35 });
    K.box(g, 0.64, 2.4, 0.64, 0xc8a24a, x, 2.9, z, { m: 0.85, r: 0.3 });
    pins[n] = [x, 4.4, z];
    pinLabels.push([text, [x + (anchor === 'r' ? -2 : 2), 3, z], anchor]);
  };
  // ขาเข้า + ไฟ อยู่ขอบซ้าย · ขาออกลำโพงอยู่ขอบขวา (ตำแหน่งต่างกันตามรุ่น ยึดชื่อที่พิมพ์บนแผง)
  // แผ่นทองแดงวางบนระยะ 2.54 มม. เพื่อบัดกรีขาหัวเข็มลงแผ่นไข่ปลา
  const X = 3.5 * P; const z = (k) => k * P;
  pad('INL', -X, z(-2.5), 'L (เข้าซ้าย)', 'r'); pad('G_IN', -X, z(-1.5), '⏚ (ไม่ใช้)', 'r'); pad('INR', -X, z(-0.5), 'R (เข้าขวา)', 'r');
  pad('+5V', -X, z(1.5), '+ 5V', 'r'); pad('GND', -X, z(2.5), '− GND', 'r');
  pad('OUTL+', X, z(-2.5), 'L+', 'l'); pad('OUTL-', X, z(-1.5), 'L−', 'l'); pad('OUTR-', X, z(1.5), 'R− (ไม่ใช้)', 'l'); pad('OUTR+', X, z(2.5), 'R+ (ไม่ใช้)', 'l');
  return { g, pins, holes: holesOf(pins), pinLabels, labelY: 10 };
}

// ปุ่มกด มองจากด้านในฝา (ขาสวิตช์หันขึ้น)
export function button(T, K, kind) {
  const red = kind === 'sos';
  const g = new T.Group(); const pins = {}; const pinLabels = [];
  const flangeR = red ? 30 : 23; const bodyR = red ? 14 : 12; const bodyH = red ? 24 : 19;
  K.cyl(g, 'y', flangeR, 3, red ? 0xc8463c : 0x3c8a4c, 0, 1.5, 0, { r: 0.45 }, 40);       // ขอบโดม (สีปุ่มจริง)
  K.cyl(g, 'y', bodyR + 3.5, 3, 0x2b2b2b, 0, 3 + 1.5, 0, { r: 0.7 }, 32);                 // น็อต
  K.cyl(g, 'y', bodyR, bodyH, 0x333333, 0, 3 + bodyH / 2, 0, { r: 0.7 }, 32);             // ตัวเรือนเกลียว
  const swY = 3 + bodyH;
  K.box(g, 20, 10, 11, 0x222222, 0, swY + 5, 0, { r: 0.55 });                              // ไมโครสวิตช์
  K.print(g, 'C   NC   NO', 17, 2.2, 0, swY + 10.02, 3.6, { color: '#d8d8d0' });
  const term = (n, x) => {
    K.box(g, 2.8, 6, 0.6, 0xc9c9c2, x, swY + 13, 0, { m: 0.8, r: 0.3 });
    pins[n] = [x, swY + 16.4, 0];
  };
  term('COM', -6.5); term('NC', 0); term('NO', 6.5);
  pinLabels.push(['COM', [-6.5, swY + 19.5, -3], 'c'], ['NC (ไม่ใช้)', [0, swY + 19.5, -3], 'c'], ['NO', [6.5, swY + 19.5, -3], 'c']);
  return { g, pins, pinLabels, labelY: swY + 26 };
}

// ไฟ WS2812B 1 ชิ้นที่ตัดจากเส้น: ขาเข้า (+5V DIN GND) ที่ -Z, ขาออก (+5V DOUT GND) ที่ +Z
export function ws2812(T, K, n) {
  const g = new T.Group(); const pins = {}; const pinLabels = [];
  K.box(g, 10, 0.4, 16, 0xf0efe9, 0, 0.2, 0, { r: 0.8 });
  K.box(g, 5, 1.5, 5, 0xf7f4ea, 0, 1.15, 0, { r: 0.4 });
  K.box(g, 3.4, 0.2, 3.4, 0xe8e2cf, 0, 1.95, 0, { r: 0.3 });
  K.print(g, '→', 3, 2.6, 3.4, 0.42, 0, { color: '#5F5E5A', rotY: -Math.PI / 2 });          // ลูกศรทิศข้อมูล (เข้า → ออก)
  K.print(g, String(n), 3, 2.6, -3.4, 0.42, 0, { color: '#1F1F1D' });
  const pad = (key, x, z) => { K.box(g, 2.4, 0.18, 2.6, 0xc98f4e, x, 0.5, z, { m: 0.7, r: 0.35 }); pins[key] = [x, 1.4, z]; };
  pad('+5V@in', -3.2, -6.4); pad('DIN', 0, -6.4); pad('GND@in', 3.2, -6.4);
  pad('+5V@out', -3.2, 6.4); pad('DOUT', 0, 6.4); pad('GND@out', 3.2, 6.4);
  K.print(g, '5V  Di  G', 9.4, 1.5, 0, 0.42, -4.4, { color: '#5F5E5A' });
  K.print(g, '5V  Do  G', 9.4, 1.5, 0, 0.42, 4.4, { color: '#5F5E5A' });
  return { g, pins, pinLabels, labelY: 6 };
}

// ตัวต้านทานนอน (ขา 1 = -X, ขา 2 = +X) ระยะขา 10.16 มม.
export function resistor(T, K, value) {
  const g = new T.Group(); const pins = {};
  K.cyl(g, 'x', 1.2, 6.3, 0xe3d3ae, 0, 2.2, 0, { r: 0.6 }, 16);
  bandColors(value).forEach((col, i) => K.cyl(g, 'x', 1.24, 0.55, parseInt(col.slice(1), 16), -2.2 + i * 1.2 + (i === 3 ? 0.7 : 0), 2.2, 0, { r: 0.6 }, 16));
  for (const s of [-1, 1]) {
    K.cyl(g, 'x', 0.28, 2.0, 0xbfc3c7, s * 4.1, 2.2, 0, { m: 0.8, r: 0.3 }, 8);
    K.cyl(g, 'y', 0.28, 2.2, 0xbfc3c7, s * 5.08, 1.1, 0, { m: 0.8, r: 0.3 }, 8);
  }
  pins['1'] = [-5.08, 2.6, 0]; pins['2'] = [5.08, 2.6, 0];
  return { g, pins, holes: holesOf(pins), pinLabels: [], labelY: 6.5 };
}

export function diode(T, K) {
  const g = new T.Group(); const pins = {};
  K.cyl(g, 'x', 1.35, 5.2, 0x1e1e1e, 0, 2.2, 0, { r: 0.5 }, 16);
  K.cyl(g, 'x', 1.38, 0.8, 0xbdbdb6, 1.9, 2.2, 0, { r: 0.5 }, 16);                          // แถบ = ฝั่ง K
  for (const s of [-1, 1]) {
    K.cyl(g, 'x', 0.3, 2.5, 0xbfc3c7, s * 3.85, 2.2, 0, { m: 0.8, r: 0.3 }, 8);
    K.cyl(g, 'y', 0.3, 2.2, 0xbfc3c7, s * 5.08, 1.1, 0, { m: 0.8, r: 0.3 }, 8);
  }
  pins.A = [-5.08, 2.6, 0]; pins.K = [5.08, 2.6, 0];
  return { g, pins, holes: holesOf(pins), pinLabels: [['A', [-5.08, 5, 2.6], 'c'], ['K (แถบ)', [5.08, 5, 2.6], 'c']], labelY: 7.5 };
}

export function ceramicCap(T, K) {
  const g = new T.Group(); const pins = {};
  const d = K.cyl(g, 'z', 2.6, 1.5, 0xa8743a, 0, 5.2, 0, { r: 0.55 }, 20);
  d.scale.set(1, 1, 1);
  for (const s of [-1, 1]) K.cyl(g, 'y', 0.25, 3.2, 0xbfc3c7, s * 1.27, 1.8, 0, { m: 0.8, r: 0.3 }, 8);
  pins['1'] = [-1.27, 1.6, 0.9]; pins['2'] = [1.27, 1.6, 0.9];
  return { g, pins, holes: { 1: [-1.27, 0], 2: [1.27, 0] }, pinLabels: [], labelY: 10.5 };
}

// ตัวเก็บประจุมีขั้ว: ขา + ที่ -X · แถบขาว (ขา −) หันไป +X
export function elecCap(T, K, r, h) {
  const g = new T.Group(); const pins = {};
  const pitch = r >= 4 ? 2 * P : P;   // ของจริง 5 / 2.5 มม. ดัดขาลงรู 5.08 / 2.54
  K.cyl(g, 'y', r, h, 0x2b3d66, 0, 1.2 + h / 2, 0, { r: 0.45 }, 24);
  const stripe = K.box(g, 0.4, h * 0.94, r * 0.9, 0xe6e6df, r - 0.05, 1.2 + h / 2, 0, { r: 0.5 });
  stripe.scale.set(1, 1, 1);
  K.cyl(g, 'y', r * 0.96, 0.4, 0xa9adb1, 0, 1.2 + h + 0.2, 0, { m: 0.7, r: 0.35 }, 24);
  for (const s of [-1, 1]) K.cyl(g, 'y', 0.25, 1.4, 0xbfc3c7, s * pitch / 2, 0.7, 0, { m: 0.8, r: 0.3 }, 8);
  pins['+'] = [-pitch / 2, 1.0, r + 0.8]; pins['-'] = [pitch / 2, 1.0, r + 0.8];
  return { g, pins, holes: { '+': [-pitch / 2, 0], '-': [pitch / 2, 0] }, pinLabels: [['+', [-pitch / 2 - 1.2, 2.5, r + 2.6], 'c'], ['−', [pitch / 2 + 1.2, 2.5, r + 2.6], 'c']], labelY: h + 5 };
}

// ตัวเก็บประจุไม่มีขั้ว แบบกล่อง (C5)
export function filmCap(T, K) {
  const g = new T.Group(); const pins = {};
  K.box(g, 7, 6, 3.5, 0x3a5f8f, 0, 4.2, 0, { r: 0.5 });
  for (const s of [-1, 1]) K.cyl(g, 'y', 0.25, 1.6, 0xbfc3c7, s * 2.54, 0.8, 0, { m: 0.8, r: 0.3 }, 8);
  pins['1'] = [-2.54, 1.2, 2.3]; pins['2'] = [2.54, 1.2, 2.3];
  return { g, pins, holes: { 1: [-2.54, 0], 2: [2.54, 0] }, pinLabels: [], labelY: 10.5 };
}

export function to92(T, K, text) {
  const g = new T.Group(); const pins = {};
  const body = new T.Mesh(new T.CylinderGeometry(2.4, 2.4, 4.8, 20, 1, false, Math.PI / 2, Math.PI), K.M(0x2a2a2a, { r: 0.5 }));
  body.position.set(0, 3 + 2.4, 0); g.add(body);
  K.box(g, 4.8, 4.8, 0.05, 0x2a2a2a, 0, 3 + 2.4, 0.02, { r: 0.5 });                          // หน้าแบน หันเข้าหาคนดู (+Z)
  K.print(g, text, 4.4, 1.3, 0, 3 + 2.4, 0.08, { color: '#d8d8d0' }).rotation.set(0, 0, 0);
  // ขาจริงห่าง 1.27 มม. ดัดขาข้างออกให้ลงรู 2.54 มม.
  const legs = { E: -P, B: 0, C: P }; const holes = {};
  for (const [n, x] of Object.entries(legs)) {
    K.box(g, 0.45, 1.6, 0.45, 0xbfc3c7, x * 0.5, 2.2, -0.6, { m: 0.8, r: 0.3 });
    K.box(g, 0.45, 1.6, 0.45, 0xbfc3c7, x, 0.8, -0.6, { m: 0.8, r: 0.3 });
    if (x) K.box(g, Math.abs(x) * 0.5 + 0.45, 0.45, 0.45, 0xbfc3c7, x * 0.75, 1.5, -0.6, { m: 0.8, r: 0.3 });
    pins[n] = [x, 0.9, 0.5]; holes[n] = [x, -0.6];
  }
  return { g, pins, holes, pinLabels: [['E', [-P, -0.6, 4.2], 'c'], ['B', [0, -0.6, 4.2], 'c'], ['C', [P, -0.6, 4.2], 'c']], labelY: 11 };
}

export function sot23Adapter(T, K) {
  const g = new T.Group(); const pins = {};
  K.box(g, 8.4, 1.2, 8, 0x1f6b3a, 0, 0.6, 0, { r: 0.7 });
  K.box(g, 2.9, 1.1, 1.3, 0x2a2a2a, 0, 1.75, -1.2, { r: 0.45 });
  K.print(g, 'AO3401A', 7.6, 1.3, 0, 1.22, 1.0, { color: '#e8f2e8' });
  const ps = { G: -2.54, S: 0, D: 2.54 };
  for (const [n, x] of Object.entries(ps)) pins[n] = headerPin(T, K, g, x, 2.9, 1.2, 2.6);
  return { g, pins, holes: holesOf(pins), pinLabels: [['1 G', [-2.54, 1.5, 6.2], 'c'], ['2 S', [0, 1.5, 6.2], 'c'], ['3 D', [2.54, 1.5, 6.2], 'c']], labelY: 9 };
}

export function batteryHolder(T, K) {
  const g = new T.Group(); const pins = {};
  K.box(g, 47, 14, 58, 0x1c1c1c, 0, 7, 0, { r: 0.7 });
  for (let i = -1; i <= 1; i++) {
    K.cyl(g, 'z', 7.1, 50, 0x3d6b66, i * 15, 13, 0, { r: 0.45 }, 24);
    K.cyl(g, 'z', 2.2, 1.2, 0xbfc3c7, i * 15, 13, (i === 0 ? 1 : -1) * 25.6, { m: 0.8, r: 0.3 }, 12);
  }
  K.box(g, 6, 3, 9, 0x3a3a3a, 0, 15.5, 31, { r: 0.6 });                                       // สวิตช์ของราง
  K.print(g, 'ON/OFF', 8, 1.6, 0, 14.05, 25.5, { color: '#d8d8d0' });
  K.tube(g, [[23.5, 6, -10], [28, 3, -10], [33, 1.6, -9]], 0.7, 0xb4462f);
  K.tube(g, [[23.5, 6, -4], [28, 3, -4], [33, 1.6, -3]], 0.7, 0x1f1f1d);
  pins['+'] = [33.6, 2.2, -9]; pins['-'] = [33.6, 2.2, -3];
  // ขอบเขตตัวราง (ไม่รวมสายที่ยื่นออก) ใช้หลบสายข้ามชิ้น
  return { g, pins, body: { minX: -23.5, maxX: 23.5, minZ: -29, maxZ: 36, top: 20.5 }, pinLabels: [['+ (แดง หลังสวิตช์)', [36, 4.6, -11.5], 'l'], ['− (ดำ)', [36, 4.6, -1], 'l']], labelY: 24 };
}

export function powerIn(T, K) {
  const g = new T.Group(); const pins = {};
  K.cyl(g, 'x', 1.9, 34, 0x3a3a3a, -17, 1.9, 0, { r: 0.7 }, 14);
  K.box(g, 12, 7, 10, 0x2b2b2b, -38, 3.5, 0, { r: 0.6 });                                    // หัวชาร์จ (ย่อ)
  K.print(g, 'USB-A', 9, 2, -38, 7.02, 0, { color: '#d8d8d0' });
  K.tube(g, [[0, 1.9, -0.6], [3, 1.6, -2], [7, 1.6, -4]], 0.6, 0xb4462f);
  K.tube(g, [[0, 1.9, 0.6], [3, 1.6, 2], [7, 1.6, 4]], 0.6, 0x1f1f1d);
  pins['+5V'] = [7.6, 2.0, -4]; pins.GND = [7.6, 2.0, 4];
  return { g, pins, pinLabels: [['+5V (แดง)', [9.6, 3.6, -6.4], 'l'], ['GND (ดำ)', [9.6, 3.6, 6.4], 'l']], labelY: 12 };
}

export function speaker(T, K) {
  const g = new T.Group(); const pins = {};
  K.cyl(g, 'y', 20, 3, 0x2a2a2a, 0, 12.5, 0, { m: 0.3, r: 0.5 }, 40);
  const cone = new T.Mesh(new T.ConeGeometry(17.5, 9, 40, 1, true), K.M(0x3a3a3a, { r: 0.8 }));
  cone.rotation.x = Math.PI; cone.position.set(0, 9.5, 0); g.add(cone);
  K.cyl(g, 'y', 6, 2, 0x444444, 0, 6.5, 0, { r: 0.6 }, 24);
  K.cyl(g, 'y', 9, 6, 0x6d6d6d, 0, 3, 0, { m: 0.6, r: 0.4 }, 24);                            // แม่เหล็ก
  K.box(g, 3, 1.5, 4, 0xc9c9c2, -21.5, 12, -5, { m: 0.8, r: 0.3 }); K.box(g, 3, 1.5, 4, 0xc9c9c2, -21.5, 12, 5, { m: 0.8, r: 0.3 });
  pins['+'] = [-22, 13.2, -5]; pins['-'] = [-22, 13.2, 5];
  return { g, pins, pinLabels: [['+', [-25, 14, -7.5], 'c'], ['−', [-25, 14, 7.5], 'c']], labelY: 20 };
}

// ลำโพงติดผนังด้านใน (ตาม parts.md แถว speaker และ exploded/parts.js): หน้าลำโพงหันเข้าในกล่อง (-X) ศูนย์กลางสูงประมาณ 22 มม.
// ใช้ speaker() เดิม หมุนรอบแกน Z 90° แล้วยกขึ้น — ค่า 22 มม. เป็นค่าประมาณจากรัศมีลำโพง Ø40
export function speakerWall(T, K) {
  const s = speaker(T, K); const g = new T.Group();
  s.g.rotation.z = Math.PI / 2; s.g.position.y = 22; g.add(s.g);
  const tf = ([x, y, z]) => [-y, x + 22, z];
  const pins = Object.fromEntries(Object.entries(s.pins).map(([k, p]) => [k, tf(p)]));
  const pinLabels = s.pinLabels.map(([t, p, a]) => [t, tf(p), a]);
  return { g, pins, pinLabels, labelY: s.labelY };
}

// เสาอากาศ: แท่งยางตาม +X, จุดต่อ (หัว U.FL ของสายนำสัญญาณ) อยู่ที่โคนเสา -X
export function antenna(T, K, big = false) {
  const g = new T.Group(); const pins = {};
  if (big) {
    // เสา 3 dBi ตั้งขึ้น (ของจริงตั้งบนหลังคา ต่อด้วยสายแปลงขั้ว) · จุดต่อ = หัว U.FL ปลายสายแปลงที่โคนเสา
    K.cyl(g, 'y', 9, 3, 0x9a9a96, 0, 1.5, 0, { m: 0.5, r: 0.4 }, 24);
    K.cyl(g, 'y', 5, 12, 0xb8bcc0, 0, 9, 0, { m: 0.8, r: 0.3 }, 18);
    K.cyl(g, 'y', 5.5, 100, 0x1c1c1c, 0, 65, 0, { r: 0.75 }, 18);
    K.tube(g, [[-5, 6, 0], [-9, 3, 0], [-14, 1.6, 0]], 0.9, 0x2a2a2a);
    pins.cable = [-15, 2.2, 0];
    return { g, pins, body: { minX: -9, maxX: 9, minZ: -9, maxZ: 9, top: 16 }, pinLabels: [['สายแปลงขั้ว → หัว U.FL', [-16, 6, 6], 'r']], labelY: 120 };
  }
  const L = 80; const r = 4;
  K.cyl(g, 'x', r * 1.4, 10, 0xb8bcc0, 5, r * 1.4, 0, { m: 0.8, r: 0.3 }, 18);
  K.cyl(g, 'x', r, L, 0x1c1c1c, 10 + L / 2, r * 1.4, 0, { r: 0.75 }, 18);
  pins.feed = [-1, r * 1.4, 0];
  return { g, pins, pinLabels: [], labelY: r * 3 + 6 };
}

export function waterProbe(T, K) {
  const g = new T.Group(); const pins = {};
  K.tube(g, [[0, 1.4, -2.5], [-20, 1.2, 4], [-46, 1.2, 22], [-60, 1.2, 40]], 0.75, 0xb4462f);
  K.tube(g, [[0, 1.4, 2.5], [-18, 1.2, 9], [-42, 1.2, 26], [-55, 1.2, 44]], 0.75, 0x1f1f1d);
  K.cyl(g, 'x', 0.5, 6, 0xc98f4e, -63, 1.2, 42, { m: 0.8, r: 0.3 }, 8);                       // ปลายทองแดงเปลือย
  K.cyl(g, 'x', 0.5, 6, 0xc98f4e, -58, 1.2, 46, { m: 0.8, r: 0.3 }, 8);
  pins.red = [0.6, 1.8, -2.5]; pins.black = [0.6, 1.8, 2.5];
  return { g, pins, pinLabels: [['สายแดง', [2.4, 3.6, -5], 'l'], ['สายดำ', [2.4, 3.6, 5], 'l'], ['ปลายห้อยที่ 50 ซม. เหนือพื้น', [-62, 4, 52], 'c']], labelY: 10 };
}

export function laptop(T, K) {
  const g = new T.Group(); const pins = {};
  K.box(g, 150, 8, 100, 0x9a9a96, 0, 4, 0, { m: 0.4, r: 0.45 });
  K.box(g, 120, 0.4, 44, 0x6f6f6b, 0, 8.2, -16, { r: 0.6 });
  const scr = new T.Group(); scr.position.set(0, 8, -50); scr.rotation.x = -0.32; g.add(scr);
  K.box(scr, 150, 96, 4, 0x8e8e8a, 0, 48, -2, { m: 0.4, r: 0.45 });
  K.box(scr, 138, 84, 0.4, 0x24323f, 0, 49, 0.2, { r: 0.3 });
  K.box(g, 1.2, 3.2, 9, 0x222222, 75.4, 4, 12, { r: 0.5 });                                  // พอร์ต USB ด้านขวา
  pins.USB = [76.4, 4, 12];
  return { g, pins, pinLabels: [], labelY: 112 };
}

/* ------------------------------------------------------------ แผ่นไข่ปลา + ชั้นกล่อง */
// แผ่นไข่ปลา: ผิวบนอยู่ที่ y = 0 · รูห่าง P · solder = รูที่มีขาเสียบ (วาดเป็นวงตะกั่ว)
export function perfboard(T, { w, d, cols, rows, used = [] }) {
  const g = new T.Group();
  const pxmm = 12; const c = document.createElement('canvas'); c.width = Math.round(w * pxmm); c.height = Math.round(d * pxmm);
  const x = c.getContext('2d');
  x.fillStyle = '#2f6a46'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
  const ox = w / 2 - ((cols - 1) / 2) * P; const oz = d / 2 - ((rows - 1) / 2) * P;
  const usedSet = new Set(used.map(([i, j]) => `${i},${j}`));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const cx = (ox + i * P) * pxmm; const cy = (oz + j * P) * pxmm;
    if (usedSet.has(`${i},${j}`)) {
      x.fillStyle = '#c9ccd0'; x.beginPath(); x.arc(cx, cy, 0.95 * pxmm, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#8d9196'; x.beginPath(); x.arc(cx, cy, 0.45 * pxmm, 0, Math.PI * 2); x.fill();
    } else {
      x.fillStyle = '#c99a52'; x.beginPath(); x.arc(cx, cy, 0.8 * pxmm, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1d2a22'; x.beginPath(); x.arc(cx, cy, 0.45 * pxmm, 0, Math.PI * 2); x.fill();
    }
  }
  // เลขแถว/คอลัมน์ทุก 5 รู ไว้นับรูตอนบัดกรี
  x.fillStyle = 'rgba(255,255,255,0.8)'; x.font = `600 ${Math.round(1.5 * pxmm)}px Consolas, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < cols; i += 5) x.fillText(String(i + 1), (ox + i * P) * pxmm, (oz - 1.15 * P) * pxmm);
  for (let j = 0; j < rows; j += 5) x.fillText(String(j + 1), (ox - 1.2 * P) * pxmm, (oz + j * P) * pxmm);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
  const top = new T.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  const edge = new T.MeshStandardMaterial({ color: 0x24533a, roughness: 0.8 });
  const slab = new T.Mesh(new T.BoxGeometry(w, 1.6, d), [edge, edge, top, edge, edge, edge]);
  slab.position.y = -0.8; g.add(slab);
  return g;
}

// เครื่องหมายรูเจาะ (วงประ + กากบาท) วางราบที่ระดับ y · สีหมึก ไม่ใช้สีสถานะ
export function holeMarker(T, r, { color = 0x1f1f1d, dashed = true } = {}) {
  const g = new T.Group();
  const seg = 48; const pts = [];
  for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2; pts.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const geo = new T.BufferGeometry().setFromPoints(pts);
  const mat = dashed ? new T.LineDashedMaterial({ color, dashSize: 1.6, gapSize: 1.1 }) : new T.LineBasicMaterial({ color });
  const ring = new T.Line(geo, mat); if (dashed) ring.computeLineDistances(); g.add(ring);
  const k = r + 2.5;
  const cross = new T.LineSegments(new T.BufferGeometry().setFromPoints([
    new T.Vector3(-k, 0, 0), new T.Vector3(k, 0, 0), new T.Vector3(0, 0, -k), new T.Vector3(0, 0, k)]), new T.LineBasicMaterial({ color }));
  g.add(cross);
  g.userData.drill = true; // มุม 2D วาดทับชิ้นส่วน ให้เห็นตำแหน่งรูแม้มีปุ่ม/ลำโพงบังอยู่ (app.js setView)
  return g;
}
