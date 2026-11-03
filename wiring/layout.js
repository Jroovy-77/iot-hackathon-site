/**
 * layout.js — ตำแหน่งวางชิ้นส่วน (มม.) ของกล่องบ้านและตัวรับ
 *
 * กล่องบ้าน = ขนาดจริง: แผ่นไข่ปลา 70 × 90 มม. รูห่าง 2.54 มม. ทุกขาของชิ้นบนแผ่นลงรูจริง
 *   รางไฟ/กราวด์ = เส้นลวดวิ่งตามแถวรู · ชิ้นนอกแผ่น (ถ่าน เสา สาย USB) วางในกรอบกล่อง
 *   ฝากล่องเปิดวางข้างกล่อง มองจากด้านใน (ปุ่ม 2 ปุ่ม + ไฟ 8 ดวง ติดอยู่ที่ฝา)
 *   ลำโพง + ไฟดวง 9 ติดผนังขวาด้านใน (parts.md ข้อ 9 · 24 ต.ค.) ฝาไม่มีรูเสียง
 * ตัวรับ = ผังกางแบบเดิม (ไม่มีแผ่นไข่ปลา)
 * ชิ้นที่มีป้ายชื่อขา (บอร์ด, วิทยุ, PAM8403) ไม่หมุน เพื่อให้อ่านชื่อขาตรงกับของจริง
 */
import {
  VALUES, superMini, wioAdapter, pam8403, button, ws2812, resistor, diode, ceramicCap, elecCap, filmCap,
  to92, sot23Adapter, batteryHolder, powerIn, speakerWall, antenna, waterProbe, laptop, WIRE_COLORS, P, perfboard, holeMarker,
} from './parts3d.js';

/* ============================================================================
 * กล่องจริง — กล่องพลาสติกกันน้ำ Leetech 6×6 นิ้ว (สมบูรณ์การไฟฟ้า)
 * ผู้ใช้ยังไม่ได้ซื้อกล่อง (ถามแล้ว 24 ต.ค. 2569) · 24 ต.ค. ผู้ใช้ส่งภาพสินค้าของร้าน: ภายนอก 15 × 15 × 8 ซม.
 * TODO: รอวัดกล่องจริง — ขนาดด้านใน ความหนาผนัง มุมโค้ง และตำแหน่งสกรู ยังไม่ได้วัด
 * ซื้อแล้ว: วัดของจริง แก้ตัวเลขในก้อนนี้ที่เดียว แล้วตั้ง measured: true (ป้ายบนหน้าจะเปลี่ยนเอง)
 * ========================================================================== */
export const BOX = {
  measured: false,              // TODO: เปลี่ยนเป็น true เมื่อวัดกล่องจริงแล้ว
  outerW: 150, outerD: 150,     // ภาพสินค้าร้าน (ผู้ใช้ส่ง 24 ต.ค.) "15 cm. × 15 cm." = หน้าฝา
  outerH: 80,                   // ภาพสินค้าร้าน "8 cm." (ความลึกรวมฝา)
  innerW: 142, innerD: 142,     // TODO: รอวัด · parts.md "พื้นด้านใน ~142 × 142" (ค่าประมาณจากแชท)
  innerDepth: 70,               // TODO: รอวัด · parts.md "ความลึกด้านใน ~70"
  // ค่าด้านล่างใช้วาดภาพให้หน้าตาเหมือนกล่องในภาพร้านเท่านั้น ไม่ใช่ขนาดที่วัด — TODO: รอวัดกล่องจริง
  lookCornerR: 9,               // มุมโค้ง (ภาพร้านเห็นมุมโค้ง ไม่มีตัวเลข)
  lookScrewInset: 9,            // สกรูฝา 4 มุม (ภาพร้านเห็นสกรูที่มุมฝา ไม่มีตัวเลข)
};
// ระยะห่างระหว่างกล่องกับฝาที่เปิดวางข้าง — ใช้จัดภาพบนจอเท่านั้น ไม่ใช่ขนาดของจริง
const LID_GAP = 12;

/* ตำแหน่งชิ้นบนฝา (มม. จากกลางฝา มองด้านใน) — TODO: ตำแหน่งชั่วคราว รอวัดกล่องจริง
 * เอกสารบอกแค่ "ปุ่มแดง + วงไฟรัศมี ~40 อยู่ซีกหนึ่ง ปุ่มเขียวอีกซีก" (parts.md) ไม่มีพิกัด · รูเสียงอยู่ผนังขวา ไม่ใช่ฝา */
export const LID_PLACE = {
  sos: [-26, -20],      // TODO
  ack: [47, -20],       // TODO
  ledRingR: 40,         // parts.md "วงรัศมี ~40"
};

/* รูที่ต้องเจาะ — ค่าประมาณทั้งหมด (ผู้ใช้ตกลงใช้ค่าประมาณไปก่อน 24 ต.ค.) ตำแหน่งมาจากที่วางชิ้นในผัง
 * dia: ขนาดรูโดยประมาณ (มีที่มา) · null = ต้องวัดของจริงก่อนเจาะ
 * TODO: รอวัดกล่องและชิ้นส่วนจริง */
export const HOLES = [
  { id: 'h-sos', on: 'ฝา', parts: ['btn-sos'], name: 'รูปุ่มแดง', dia: null, note: '' },
  { id: 'h-ack', on: 'ฝา', parts: ['btn-ack'], name: 'รูปุ่มเขียว', dia: null, note: '' },
  // LED 5050 = ตัว 5 × 5 มม. (parts.md "LED 5050")
  { id: 'h-led', on: 'ฝา', parts: ['leds1', 'leds2', 'leds3', 'leds4', 'leds5', 'leds6', 'leds7', 'leds8'], name: 'รูไฟ 8 รู (อุดใส)', dia: 5, note: 'เท่าตัว LED 5050' },
  // ลำโพง Ø40 (parts.md) → เจาะรูเล็กหลายรูในวงนี้
  { id: 'h-spk', on: 'ผนังขวา', parts: ['speaker'], name: 'รูเสียง', dia: 40, note: 'ติดผนังขวาด้านใน หันออกทางรูเสียง · เจาะรูเล็กหลายรูในวงเท่าลำโพง' },
  { id: 'h-led9', on: 'ผนังขวา', parts: ['leds9'], name: 'รูไฟดวง 9 (อุดใส)', dia: 5, note: 'เท่าตัว LED 5050 หันออกให้เรือเห็น' },
  { id: 'h-seal', on: 'ผนังล่าง', parts: ['power-in', 'water-probe'], name: 'ซีลร้อยสาย USB + สายวัดน้ำ', dia: 15, note: 'ขนาดซีลจาก parts.md' },
];
// ไม่ต้องเจาะ: เสาอากาศอยู่ในกล่อง (parts.md "ลวดเสาอากาศอยู่ในกล่องพลาสติกได้ ... ไม่ต้องเจาะรูเพิ่ม")

/* แผ่นไข่ปลา — parts.md pcb "PCB ไข่ปลา 7×9 ซม." 70 × 90 × 1.6 รูห่าง 2.54
 * TODO: นับจำนวนรูบนแผ่นที่ซื้อจริง (ตอนนี้ใช้ 24 × 30 รู ยังไม่ได้นับของจริง) */
export const PCB = { w: 70, d: 90, cols: 24, rows: 30, cx: -32, cz: -12 };

/* ============================================================================
 * กล่องตัวรับ — ตาม "แบบเจาะกล่องตัวรับ อบต. 1:1" (rx-box-template-1to1.pdf ผู้ใช้ส่ง 24 ต.ค.) + ภาพกล่องที่ผู้ใช้ส่ง
 * กล่องพลาสติกสี่เหลี่ยมผืนผ้า มีหูยึดผนังสองข้าง · ด้านนอก 105 × 75 · ด้านในประมาณ 101 × 71 (จากแบบ)
 * ทิศในผัง: ขอบบนของภาพ = ผนังหลัง (ฝั่งที่มีสาย) ตรงกับภาพ "มุมบน เปิดฝา" ในแบบ
 * TODO: ความสูงกล่องไม่มีในแบบ — รอวัดของจริง
 * ========================================================================== */
export const RX_BOX = {
  measured: false,              // แบบบอกด้านในว่า "ประมาณ"
  outerW: 105, outerD: 75,      // แบบ: "ด้านนอก 105 × 75"
  outerH: null,                 // TODO: แบบไม่ระบุความสูง
  innerW: 101, innerD: 71,      // แบบ: "ด้านใน ประมาณ 101 × 71"
  // ค่าด้านล่างใช้วาดหน้าตาให้เหมือนภาพกล่องเท่านั้น ไม่ใช่ขนาดที่วัด (แบบไม่ระบุ)
  lookCornerR: 5, lookScrewInset: 6, lookEar: 14,
};
/* แผ่นไข่ปลาตัวรับ 56 × 62 (แบบ: "แผ่น 56" × "แผ่น 62") วางชิดมุมซ้าย-หลัง ตามภาพมุมบนในแบบ
 * ตำแหน่งวัดจากภาพในแบบ: ขอบซ้ายแผ่นห่างขอบนอกกล่อง ~4 มม. · ขอบหลังห่าง ~2.5 มม.
 * TODO: นับจำนวนรูบนแผ่นที่ซื้อจริง (ตอนนี้ใช้ 21 × 23 รู) */
export const RX_PCB = { w: 56, d: 62, cols: 21, rows: 23, cx: -52.5 + 4.2 + 28, cz: -37.5 + 2.5 + 31 };
// รูที่ต้องเจาะ — ตัวเลขทั้งหมดจากแบบ (x วัดจากเส้นกลางกล่อง มองจากด้านบน: + = ขวา)
export const RX_HOLES = [
  { id: 'rx-usb', on: 'ผนังหลัง', name: 'ช่อง USB-C', dia: null, sizeNote: 'ช่อง 13 × 8 มม.', x: -20, up: 13, note: 'หัว USB-C ของบอร์ดชี้ออกช่องนี้ เสียบสายไปโน้ตบุ๊ก' },
  { id: 'rx-sma', on: 'ผนังหลัง', name: 'รู SMA', dia: 6.5, x: 30, up: 16, note: 'ยึดหัว SMA ของสายแปลงขั้ว 15 ซม. ข้างในเสียบ IPEX ที่วิทยุ ข้างนอกต่อเสา 3 dBi' },
  { id: 'rx-led', on: 'ฝา', name: 'รูไฟสถานะ', dia: 3, fromLeft: 37.3, fromBack: 21.5, note: 'ตรงไฟบนบอร์ด ESP32-C3 ให้เห็นไฟกะพริบตอนรับ/ส่ง' },
];

const UP = -Math.PI / 2; // หมุนตัวต้านทานให้ขา 1 อยู่ด้านบน (-Z)
// ชิ้นหลัก: ป้ายชื่อขนาดคงที่บนจอ อ่านได้ตอนมองภาพรวม · ชิ้นเล็ก (R C D ไฟ) ป้ายโผล่เมื่อซูมเข้า
const MAJOR = new Set(['power-in', 'battery', 'mcu', 'radio', 'antenna', 'btn-sos', 'btn-ack', 'water-probe', 'amp', 'speaker',
  'laptop', 'rx-mcu', 'rx-radio', 'rx-antenna']);

export function board(T, K) {   // ใช้ร่วมกับ breadboard.js
  const root = new T.Group(); const partLabels = new T.Group(); const pinLabels = new T.Group(); const refLayer = new T.Group();
  refLayer.name = 'ref'; root.add(partLabels, pinLabels, refLayer);
  const pins = new Map(); const obstacles = []; const parts = {}; const rails = {};
  const problems = [];
  let grid = null;                       // { x0, z0, cols, rows, holes: Map('i,j' → ชื่อขา), boardPins }
  const holeKey = (i, j) => `${i},${j}`;
  const B = {
    root, partLabels, pinLabels, refLayer, pins, obstacles, parts, rails, problems,
    add(id, part, x, z, rot, name, { labelDz = 0, labelDx = 0, major = MAJOR.has(id), scale = 1, labelH = 4.4 } = {}) {
      part.g.position.set(x, 0, z); part.g.rotation.y = rot; part.g.scale.setScalar(scale); root.add(part.g); part.g.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(part.g);
      if (part.body) {
        const bb = part.body; const ob = new T.Box3();
        for (const x of [bb.minX, bb.maxX]) for (const z of [bb.minZ, bb.maxZ]) ob.expandByPoint(part.g.localToWorld(new T.Vector3(x, bb.top, z)));
        obstacles.push({ id, minX: ob.min.x, maxX: ob.max.x, minZ: ob.min.z, maxZ: ob.max.z, top: ob.max.y });
      } else obstacles.push({ id, minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, top: box.max.y });
      for (const [n, p] of Object.entries(part.pins)) pins.set(`${id}.${n}`, part.g.localToWorld(new T.Vector3(...p)));
      const cx = (box.min.x + box.max.x) / 2 + labelDx; const cz = (box.min.z + box.max.z) / 2 + labelDz;
      const s = K.label(name, { h: labelH, bold: true, screen: major });
      s.position.set(cx, box.max.y + 5, cz); s.userData.partId = id; s.userData.major = major; partLabels.add(s);
      for (const [text, p, anchor] of part.pinLabels) {
        const ls = K.label(text, { h: 2.3, mono: true, anchor, bg: 'rgba(255,255,255,0.88)', border: null, depthTest: true });
        ls.position.copy(part.g.localToWorld(new T.Vector3(...p))); pinLabels.add(ls);
      }
      parts[id] = { id, name, group: part.g, box, center: new T.Vector3(cx, box.max.y, cz) };
      return part;
    },

    /* ---- แผ่นไข่ปลา ---- */
    pcb({ w, d, cols, rows, cx, cz }) {
      grid = { w, d, cols, rows, cx, cz, x0: cx - ((cols - 1) / 2) * P, z0: cz - ((rows - 1) / 2) * P, holes: new Map(), railHoles: new Map(), boardPins: {} };
      return grid;
    },
    hole(i, j) { return [grid.x0 + i * P, grid.z0 + j * P]; },
    // วางชิ้นบนแผ่น: (ci, cj) = กลางชิ้นโดยประมาณ หน่วยเป็นรู แล้วเลื่อนให้ขาแรกลงรูพอดี
    onPcb(id, part, ci, cj, rot, name, opts = {}) {
      const c = Math.cos(rot); const s = Math.sin(rot);
      const world = (hx, hz, x, z) => [x + hx * c + hz * s, z - hx * s + hz * c];
      let x = grid.x0 + ci * P; let z = grid.z0 + cj * P;
      const [h0x, h0z] = Object.values(part.holes)[0];
      const [wx, wz] = world(h0x, h0z, x, z);
      x += grid.x0 + Math.round((wx - grid.x0) / P) * P - wx;
      z += grid.z0 + Math.round((wz - grid.z0) / P) * P - wz;
      B.add(id, part, x, z, rot, name, { major: MAJOR.has(id), labelH: 2.2, ...opts });
      for (const [n, [hx, hz]] of Object.entries(part.holes)) {
        const [px, pz] = world(hx, hz, x, z);
        const fi = (px - grid.x0) / P; const fj = (pz - grid.z0) / P; const i = Math.round(fi); const j = Math.round(fj);
        const pinName = `${id}.${n}`;
        grid.boardPins[pinName] = [px, 0, pz];
        if (Math.abs(fi - i) > 0.01 || Math.abs(fj - j) > 0.01) problems.push(`ขาไม่ลงรู: ${pinName} (${fi.toFixed(2)}, ${fj.toFixed(2)})`);
        if (i < 0 || j < 0 || i >= grid.cols || j >= grid.rows) problems.push(`ขาอยู่นอกแผ่น: ${pinName} (${i}, ${j})`);
        const k = holeKey(i, j);
        if (grid.holes.has(k)) problems.push(`รูซ้ำ: ${pinName} กับ ${grid.holes.get(k)} ที่รู (${i + 1}, ${j + 1})`);
        grid.holes.set(k, pinName);
      }
      parts[id].onPcb = true;
      return part;
    },

    /* ---- ราง ---- */
    railMesh(name, path, type, y, width, height) {
      const col = WIRE_COLORS[type]; const g = new T.Group(); g.name = name;
      for (let i = 0; i < path.length - 1; i++) {
        const [x1, z1] = path[i]; const [x2, z2] = path[i + 1];
        const len = Math.hypot(x2 - x1, z2 - z1);
        const m = new T.Mesh(new T.BoxGeometry(len + width, height, width), K.M(col, { r: 0.5 }));
        m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); g.add(m);
      }
      root.add(g); return g;
    },
    railLabel(text, type, x, z, right) {
      const s = K.label(text, { h: 4.0, bold: true, color: type === 'ground' ? '#1F1F1D' : '#8a2f1d', mono: true, screen: true });
      s.center.set(right ? 1 : 0, 0.5); s.position.set(x, 3, z); s.userData.major = true; s.userData.rail = true; partLabels.add(s);
    },
    rail(name, path, type, text, { labelAt = 0, right = false } = {}) {
      const g = B.railMesh(name, path, type, 0.5, 2.2, 1.0);
      const [lx, lz] = path[labelAt];
      B.railLabel(text, type, lx + (right ? -2 : 2), lz - 2.5, right);
      rails[name] = { path, y: 1.4, type, text, group: g };
    },
    // รางบนแผ่นไข่ปลา: path เป็นพิกัดรู [[i, j], ...] แนวตรง · จุดต่อสายเข้ารางต้องเป็นรู
    pcbRail(name, hpath, type, text, { labelAt = 0, dx = 0, dz = -1.6, right = false } = {}) {
      const path = hpath.map(([i, j]) => B.hole(i, j));
      const g = B.railMesh(name, path, type, 0.35, 1.3, 0.7);
      const holes = [];
      for (let s = 0; s < hpath.length - 1; s++) {
        const [i1, j1] = hpath[s]; const [i2, j2] = hpath[s + 1];
        const n = Math.max(Math.abs(i2 - i1), Math.abs(j2 - j1));
        for (let k = s ? 1 : 0; k <= n; k++) {
          const i = i1 + Math.sign(i2 - i1) * k; const j = j1 + Math.sign(j2 - j1) * k; const key = holeKey(i, j);
          if (grid.railHoles.has(key) && grid.railHoles.get(key) !== name) problems.push(`รางชนกัน: ${name} กับ ${grid.railHoles.get(key)} ที่รู (${i + 1}, ${j + 1})`);
          grid.railHoles.set(key, name); holes.push({ i, j, x: grid.x0 + i * P, z: grid.z0 + j * P });
        }
      }
      const [lx, lz] = B.hole(...hpath[labelAt]);
      B.railLabel(text, type, lx + dx, lz + dz, right);
      rails[name] = { path, y: 0.9, type, text, group: g, holes };
    },

    done() {
      if (grid) {
        // รางห้ามผ่านรูที่มีขาชิ้นอื่น (ใต้แผ่นจะลัดวงจร)
        for (const [k, rn] of grid.railHoles) if (grid.holes.has(k)) problems.push(`รางทับขา: ${rn} ผ่านรูของ ${grid.holes.get(k)}`);
        // ตัวชิ้นบนแผ่นห้ามซ้อนกัน (มองจากด้านบน)
        const on = obstacles.filter((o) => parts[o.id]?.onPcb);
        for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) {
          const A = on[a]; const Bo = on[b];
          if (A.minX < Bo.maxX - 0.3 && Bo.minX < A.maxX - 0.3 && A.minZ < Bo.maxZ - 0.3 && Bo.minZ < A.maxZ - 0.3) problems.push(`ชิ้นซ้อนกัน: ${A.id} กับ ${Bo.id}`);
        }
        for (const o of on) {
          const e = { minX: grid.cx - grid.w / 2, maxX: grid.cx + grid.w / 2, minZ: grid.cz - grid.d / 2, maxZ: grid.cz + grid.d / 2 };
          if (o.minX < e.minX || o.maxX > e.maxX || o.minZ < e.minZ || o.maxZ > e.maxZ) problems.push(`ชิ้นล้นแผ่น: ${o.id}`);
        }
        const used = [...grid.holes.keys()].map((k) => k.split(',').map(Number));
        const pb = perfboard(T, { w: grid.w, d: grid.d, cols: grid.cols, rows: grid.rows, used });
        pb.position.set(grid.cx, 0, grid.cz); root.add(pb);
      }
      return { root, partLabels, pinLabels, refLayer, pins, obstacles, parts, rails, problems, grid };
    },
  };
  return B;
}

const nm = (id) => `${id} ${VALUES[id] ?? ''}`.trim();

/* ---- ชั้นอ้างอิง: กรอบกล่อง ฝา และรูเจาะ (ไม่ใช่ชิ้นที่ต่อสาย ไม่มีผลกับเส้นสาย) */
// วาดกรอบกล่องหรือฝา 1 ชิ้น (มองจากด้านบน) · spec = BOX หรือ RX_BOX · ใช้ร่วมกันทั้งกล่องบ้านและกล่องตัวรับ
function drawShell(T, L, spec, cx, h, lid, y = -1.7) {
  const wallT = (spec.outerW - spec.innerW) / 2; const w = spec.outerW; const d = spec.outerD;
  // พลาสติกขาวเทาแบบในภาพร้าน
  const floorMat = new T.MeshBasicMaterial({ color: 0xe9eae8 });
  const wallMat = new T.MeshStandardMaterial({ color: 0xf1f2f0, roughness: 0.45 });
  const rimMat = new T.MeshStandardMaterial({ color: 0xd6d8d5, roughness: 0.6 });
  const screwMat = new T.MeshStandardMaterial({ color: 0xb8bbbd, roughness: 0.35, metalness: 0.6 });
  const rr = (w, d, r) => { // สี่เหลี่ยมมุมโค้ง (ระนาบ XY ก่อนหมุนลงพื้น)
    const sh = new T.Shape(); const x = -w / 2; const yy = -d / 2;
    sh.moveTo(x + r, yy); sh.lineTo(x + w - r, yy); sh.quadraticCurveTo(x + w, yy, x + w, yy + r);
    sh.lineTo(x + w, yy + d - r); sh.quadraticCurveTo(x + w, yy + d, x + w - r, yy + d);
    sh.lineTo(x + r, yy + d); sh.quadraticCurveTo(x, yy + d, x, yy + d - r);
    sh.lineTo(x, yy + r); sh.quadraticCurveTo(x, yy, x + r, yy); return sh;
  };
  const r = spec.lookCornerR; const ri = Math.max(1, r - wallT);
  const ring = rr(w, d, r); ring.holes.push(rr(w - 2 * wallT, d - 2 * wallT, ri));
  const wall = new T.Mesh(new T.ExtrudeGeometry(ring, { depth: h, bevelEnabled: false, curveSegments: 6 }), wallMat);
  wall.rotation.x = -Math.PI / 2; wall.position.set(cx, y, 0); L.add(wall);
  // ขอบบน (ร่องยางกันน้ำ / ขอบฝา) เส้นเข้มบาง ๆ ให้เห็นขอบกล่องชัด
  const lip = new T.Mesh(new T.ExtrudeGeometry((() => { const o = rr(w - wallT * 0.6, d - wallT * 0.6, r - wallT * 0.3); o.holes.push(rr(w - wallT * 1.4, d - wallT * 1.4, Math.max(1, r - wallT * 0.7))); return o; })(), { depth: 0.3, bevelEnabled: false, curveSegments: 6 }), rimMat);
  lip.rotation.x = -Math.PI / 2; lip.position.set(cx, y + h, 0); L.add(lip);
  const f = new T.Mesh(new T.ShapeGeometry(rr(w - 2 * wallT, d - 2 * wallT, ri), 6), floorMat); f.rotation.x = -Math.PI / 2; f.position.set(cx, y, 0); L.add(f);
  // สกรู 4 มุม (กล่อง = เสารับสกรู · ฝา = หัวสกรู)
  const kx = w / 2 - spec.lookScrewInset; const kz = d / 2 - spec.lookScrewInset;
  for (const [sx, sz] of [[-kx, -kz], [kx, -kz], [-kx, kz], [kx, kz]]) {
    const boss = new T.Mesh(new T.CylinderGeometry(4.2, 4.6, h, 20), wallMat); boss.position.set(cx + sx, y + h / 2, sz); L.add(boss);
    const head = new T.Mesh(new T.CylinderGeometry(2.6, 2.6, 0.6, 20), screwMat); head.position.set(cx + sx, y + h + 0.3, sz); L.add(head);
    const slot = new T.Mesh(new T.BoxGeometry(3.6, 0.3, 0.7), new T.MeshBasicMaterial({ color: 0x55585a })); slot.position.set(cx + sx, y + h + 0.65, sz); slot.rotation.y = lid ? 0 : Math.PI / 4; L.add(slot);
  }
}

function boxLayer(T, K, B, lidCx) {
  const L = B.refLayer; const y = -1.7;
  const wallT = (BOX.outerW - BOX.innerW) / 2;
  drawShell(T, L, BOX, 0, 3, false, y);
  drawShell(T, L, BOX, lidCx, 2, true, y);
  const tag = BOX.measured ? 'วัดแล้ว' : 'ภายนอกตามภาพร้าน · ด้านในประมาณ';
  const t1 = K.label(`กล่อง ${BOX.outerW / 10}×${BOX.outerD / 10}×${BOX.outerH / 10} ซม. (${tag})`, { h: 3.6, color: '#5F5E5A', border: null, bg: 'rgba(243,242,238,0.9)', screen: true });
  t1.center.set(0, 0); t1.position.set(-BOX.outerW / 2, 2, -BOX.outerD / 2 - 3); t1.userData.major = true; t1.userData.ref = true; B.partLabels.add(t1);
  const t2 = K.label('ฝากล่อง เปิดวางข้าง (มองด้านใน · ด้านหน้าซ้าย-ขวากลับกัน)', { h: 3.6, color: '#5F5E5A', border: null, bg: 'rgba(243,242,238,0.9)', screen: true });
  t2.center.set(0, 0); t2.position.set(lidCx - BOX.outerW / 2, 2, -BOX.outerD / 2 - 3); t2.userData.major = true; t2.userData.ref = true; B.partLabels.add(t2);

  // เครื่องหมายรูเจาะ (ตำแหน่งชั่วคราว) — วงประ + กากบาท ขนาดวงเป็นสัญลักษณ์ ยกเว้นซีลที่มีขนาดในเอกสาร
  const out = [];
  const mark = (x, z, r, yy = y + 0.15) => { const m = holeMarker(T, r); m.position.set(x, yy, z); L.add(m); };
  const H = BOX.outerW / 2; const r0 = (v) => Math.round(v);
  // ฝาเปิดวางข้างแบบพลิก → มองจากด้านหน้า ซ้าย-ขวากลับกัน · "บน" = ขอบที่หันขึ้นเมื่อติดผนัง (ผนังล่างคือฝั่งซีลสาย)
  const lidPos = (x, z) => `มองหน้าฝา: ห่างขอบซ้าย ~${r0(H - (x - lidCx))} · ขอบบน ~${r0(H + z)} มม.`;
  for (const h of HOLES) {
    const ps = h.parts.map((id) => B.parts[id]).filter(Boolean);
    let lx; let lz; let where;
    if (h.id === 'h-spk') { const p = ps[0].group.position; lx = BOX.innerW / 2; lz = p.z; mark(BOX.outerW / 2 - wallT / 2, lz, h.dia / 2, y + 3.2); where = `ผนังขวา: ห่างขอบบน ~${r0(H + lz)} มม. กลางความสูงผนัง`; }
    else if (h.id === 'h-led9') {
      const p = ps[0].group.position; lx = BOX.outerW / 2 - wallT / 2; lz = p.z; mark(lx, lz, h.dia / 2 + 1, y + 3.2);
      where = `ผนังขวา: ห่างขอบบน ~${r0(H + lz)} มม. กลางความสูงผนัง`;
    } else if (h.id === 'h-seal') {
      const xs = ps.map((p) => p.group.position.x); lx = (Math.min(...xs) + Math.max(...xs)) / 2; lz = BOX.outerD / 2 - wallT / 2; mark(lx, lz, h.dia / 2, y + 3.2);
      where = `ผนังล่าง: ห่างมุมซ้าย ~${r0(H + lx)} มม. (มองจากหน้ากล่อง) กลางความสูงผนัง`;
    } else {
      for (const p of ps) { const r = h.dia ? h.dia / 2 : 7; mark(p.group.position.x, p.group.position.z, h.id === 'h-led' ? r + 1 : r, y + 0.2); }
      lx = ps[0].group.position.x; lz = ps[0].group.position.z;
      if (h.id === 'h-led') { const c = B.parts['btn-sos'].group.position; where = `วงรอบรูปุ่มแดง รัศมี ~${LID_PLACE.ledRingR} มม. ห่างกันทุก 45° (ดวงแรกอยู่บนสุด)`; lx = c.x; lz = c.z - LID_PLACE.ledRingR; }
      else where = `${lidPos(lx, lz)} (กลางรู)`;
    }
    out.push({ ...h, x: lx, z: lz, where });
  }
  // ป้ายรู (โผล่เมื่อซูมเข้า) — ทุกค่าเป็นค่าประมาณ
  const lab = (text, x, z, anchor = 'c') => { const s = K.label(text, { h: 3.0, color: '#1F1F1D', bg: 'rgba(255,255,255,0.95)', border: '#1F1F1D', anchor }); s.position.set(x, 4, z); s.userData.ref = true; B.partLabels.add(s); };
  const dia = (h) => (h.dia ? `Ø~${h.dia}` : 'Ø วัดเกลียวปุ่ม');
  for (const h of out) {
    if (h.id === 'h-led9') lab(`รูไฟดวง 9 ${dia(h)} (ผนังขวา) · ประมาณ`, h.x - 4, h.z - 7, 'r');
    else if (h.id === 'h-seal') lab(`ซีลร้อยสาย ${dia(h)} (ผนังล่าง) · ประมาณ`, h.x, h.z + 7);
    else if (h.id === 'h-led') lab(`รูไฟ 8 รู ${dia(h)} · ประมาณ`, h.x, h.z - 7);
    else if (h.id === 'h-spk') lab(`รูเสียง วง ${dia(h)} · ประมาณ`, h.x, h.z + 24);
    else lab(`${h.name} ${dia(h)} · ตำแหน่งประมาณ`, h.x, h.z + (h.id === 'h-sos' ? 50 : 30));
  }
  // ตำแหน่งวางชิ้นในกล่อง (วัดจากผนังด้านใน) — ประมาณ
  const IW = BOX.innerW / 2; const ID = BOX.innerD / 2;
  const place = (id, name) => { const p = B.parts[id]; if (!p) return; const bx = p.box; out.push({ id: `p-${id}`, place: true, name, on: 'ในกล่อง', where: `ห่างผนังซ้าย ~${r0(bx.min.x + IW)} · ผนังบน ~${r0(bx.min.z + ID)} มม. (วัดจากผนังด้านใน)` }); };
  out.push({ id: 'p-pcb', place: true, name: 'แผ่นไข่ปลา 70 × 90', on: 'ในกล่อง', where: `ห่างผนังซ้าย ~${r0(PCB.cx - PCB.w / 2 + IW)} · ผนังบน ~${r0(PCB.cz - PCB.d / 2 + ID)} มม. (วัดจากผนังด้านใน)` });
  place('battery', 'รางถ่าน AA ×3');
  return out;
}

/* ======================================================== กล่องบ้าน (96 เส้น) */
export function buildHouse(T, K) {
  const B = board(T, K);
  B.pcb(PCB);

  // รางบนแผ่นไข่ปลา (เส้นลวดตามแถวรู) — พิกัดเป็น [คอลัมน์, แถว] นับจาก 0
  B.pcbRail('gnd', [[23, 0], [0, 0], [0, 29], [23, 29]], 'ground', 'GND', { labelAt: 2, dx: -2.2, dz: 2.6, right: true });
  B.pcbRail('rail.3V3', [[9, 2], [23, 2]], 'power', '3V3', { labelAt: 1, dx: 2.2, dz: 0 });
  B.pcbRail('rail.VSYS', [[1, 14], [12, 14]], 'power', 'VSYS', { labelAt: 0, dx: -2.2, right: true, dz: 0 });
  B.pcbRail('rail.VSW', [[14, 20], [14, 28]], 'power', 'VSW', { labelAt: 0, dx: 0, dz: -2.2 });

  // สมอง + วิทยุ
  B.onPcb('mcu', superMini(T, K), 5, 7.5, 0, 'ESP32-C3 Super Mini', { labelDz: -2 });
  B.onPcb('radio', wioAdapter(T, K), 16.5, 6.5, 0, 'Wio-SX1262', { labelDz: -2 });
  B.onPcb('R6', resistor(T, K, VALUES.R6), 10, 5, UP, nm('R6'));
  B.onPcb('R5', resistor(T, K, VALUES.R5), 11, 5, UP, nm('R5'));
  B.onPcb('C7', elecCap(T, K, 2.5, 11), 21.5, 4, 0, nm('C7'));
  B.onPcb('C8', ceramicCap(T, K), 21.5, 7, 0, nm('C8'));
  B.onPcb('R12', resistor(T, K, VALUES.R12), 12, 12, 0, nm('R12'));
  // ไฟเข้า
  B.onPcb('D1', diode(T, K), 3, 16, 0, nm('D1'));
  B.onPcb('D2', diode(T, K), 3, 18, 0, nm('D2'));
  B.onPcb('C6', elecCap(T, K, 5, 16), 8, 17, 0, nm('C6'));
  // สวิตช์ตัดไฟ
  B.onPcb('q-power', sot23Adapter(T, K), 12, 16.86, 0, 'AO3401A', { labelH: 2.4 });
  B.onPcb('q-drive', to92(T, K, 'S8050'), 11, 21.24, 0, 'S8050', { labelH: 2.4 });
  B.onPcb('R10', resistor(T, K, VALUES.R10), 10, 23, 0, nm('R10'));
  B.onPcb('R11', resistor(T, K, VALUES.R11), 13, 25, UP, nm('R11'));
  // วัดถ่าน · ปุ่ม · สายวัดน้ำ
  B.onPcb('R3', resistor(T, K, VALUES.R3), 3, 20, 0, nm('R3'));
  B.onPcb('C2', ceramicCap(T, K), 7.5, 20, 0, nm('C2'));
  B.onPcb('R4', resistor(T, K, VALUES.R4), 3, 22, 0, nm('R4'));
  B.onPcb('R2', resistor(T, K, VALUES.R2), 3, 24, 0, nm('R2'));
  B.onPcb('C1', ceramicCap(T, K), 7.5, 25, 0, nm('C1'));
  B.onPcb('R7', resistor(T, K, VALUES.R7), 3, 26, 0, nm('R7'));
  B.onPcb('R13', resistor(T, K, VALUES.R13), 3, 28, 0, nm('R13'));
  // ไฟ + เสียง
  B.onPcb('R8', resistor(T, K, VALUES.R8), 17, 15, 0, nm('R8'));
  B.onPcb('R9', resistor(T, K, VALUES.R9), 17, 17, 0, nm('R9'));
  B.onPcb('C4', ceramicCap(T, K), 21.5, 17, 0, nm('C4'));
  B.onPcb('C5', filmCap(T, K), 18, 19, 0, nm('C5'));
  B.onPcb('amp', pam8403(T, K), 19.5, 24.5, 0, 'PAM8403', { labelDz: -1 });

  // ชิ้นนอกแผ่น (ในกล่อง)
  B.add('antenna', antenna(T, K), -25, -64.5, 0, 'เสาอากาศ 915 MHz', { labelDx: 8 });
  B.add('battery', batteryHolder(T, K), 40, -20, Math.PI, 'รางถ่าน AA ×3', { labelDz: -6 });
  B.add('speaker', speakerWall(T, K), BOX.innerW / 2, 30, 0, 'ลำโพง 3W (ผนังขวาด้านใน)', { labelDx: -10 });
  B.add('leds9', ws2812(T, K, 9), 63, 62, 0, 'ไฟ 9 (ผนังขวา หันออก)', { labelDz: 12 });
  B.add('power-in', powerIn(T, K), -36, 56, Math.PI / 2, 'สาย USB ไฟบ้าน', { labelDx: -8, labelDz: 10 });
  B.add('water-probe', waterProbe(T, K), -21, 54, Math.PI / 2, 'สายวัดน้ำ (บ้านติดเตียง)', { labelDx: 12, labelDz: 8 });

  // ฝา (เปิดวางข้างกล่อง มองด้านใน) — ตำแหน่งชั่วคราว ดู LID_PLACE
  const lidCx = BOX.outerW + LID_GAP;
  const [sx, sz] = [lidCx + LID_PLACE.sos[0], LID_PLACE.sos[1]];
  B.add('btn-sos', button(T, K, 'sos'), sx, sz, 0, 'ปุ่มแดง', { labelDz: -4 });
  for (let k = 0; k < 8; k++) {
    const th = -Math.PI / 2 + k * (Math.PI / 4);
    B.add(`leds${k + 1}`, ws2812(T, K, k + 1), sx + LID_PLACE.ledRingR * Math.cos(th), sz + LID_PLACE.ledRingR * Math.sin(th), -th, `ไฟ ${k + 1}`, { labelH: 3 });
  }
  B.add('btn-ack', button(T, K, 'ack'), lidCx + LID_PLACE.ack[0], LID_PLACE.ack[1], 0, 'ปุ่มเขียว');

  const out = B.done();
  const holes = boxLayer(T, K, B, lidCx);
  const half = BOX.outerW / 2;
  return Object.assign(out, {
    key: 'house', title: 'กล่องบ้าน', holes,
    extent: { minX: -half - 4, maxX: lidCx + half + 4, minZ: -half - 8, maxZ: half + 42, maxY: 45 },
  });
}

/* ========================================================== ตัวรับ (21 เส้น) */
export function buildReceiver(T, K) {
  const B = board(T, K);
  B.pcb(RX_PCB);
  // รางบนแผ่นไข่ปลา — [คอลัมน์, แถว] นับจาก 0 · 3V3 คั่นระหว่างบอร์ดกับวิทยุ · GND ขอบหน้าแผ่น
  B.pcbRail('rx.3V3', [[0, 11], [20, 11]], 'power', '3V3', { labelAt: 0, dx: -2.2, dz: 0, right: true });
  B.pcbRail('rx.gnd', [[0, 22], [20, 22]], 'ground', 'GND', { labelAt: 0, dx: -2.2, dz: 0, right: true });
  // ตามภาพมุมบนในแบบ: ESP32-C3 บนสุด หัว USB-C ชี้ไปผนังหลัง · วิทยุอยู่ใต้บอร์ด · C1 ด้านซ้าย
  B.onPcb('rx-mcu', superMini(T, K), 10, 4.5, 0, 'ESP32-C3 Super Mini', { labelDx: 22 });
  B.onPcb('rx-radio', wioAdapter(T, K), 10.5, 17.5, 0, 'Wio-SX1262', { labelDx: 22 });
  B.onPcb('rxC1', elecCap(T, K, 2.5, 11), 3.5, 9, 0, nm('rxC1'));
  B.onPcb('rxC2', ceramicCap(T, K), 16.5, 13, 0, nm('rxC2'));
  B.onPcb('rxR1', resistor(T, K, '10 kΩ'), 5, 17, UP, nm('rxR1'));
  // นอกกล่อง: โน้ตบุ๊กอยู่หลังกล่อง (สาย USB ออกช่องผนังหลัง) · เสา 3 dBi ต่อที่หัว SMA ผนังหลัง
  const back = -RX_BOX.outerD / 2; const sma = RX_HOLES.find((h) => h.id === 'rx-sma');
  B.add('laptop', laptop(T, K), -118, -112, 0, 'โน้ตบุ๊ก (เปิดหน้าจอทีมช่วยเหลือ)', { scale: 0.55 });
  // หมุนเสาให้ปลายสาย (จุด cable) ตกที่หัว SMA บนผนังหลังพอดี
  B.add('rx-antenna', antenna(T, K, true), sma.x, back - 15, Math.PI / 2, 'เสา 3 dBi (ภาคสนามตั้งบนหลังคา)', { labelDx: 34, labelDz: -12 });

  const out = B.done();
  const lidCx = RX_BOX.outerW + 2 * RX_BOX.lookEar + 16;
  const holes = rxBoxLayer(T, K, B, lidCx);
  const H = RX_BOX.outerW / 2;
  return Object.assign(out, {
    key: 'rx', title: 'ตัวรับ', holes,
    extent: { minX: -170, maxX: lidCx + H + 6, minZ: -165, maxZ: RX_BOX.outerD / 2 + 14, maxY: 40 },
  });
}

/* ---- กล่องตัวรับ: กรอบ + หูยึด + ฝาวางข้าง (มองจากด้านบนตอนปิดฝา เหมือนแบบ) + รูเจาะ */
function rxBoxLayer(T, K, B, lidCx) {
  const L = B.refLayer; const y = -1.7; const S = RX_BOX;
  const W = S.outerW / 2; const D = S.outerD / 2; const wallT = (S.outerW - S.innerW) / 2; const r0 = (v) => Math.round(v * 10) / 10;
  drawShell(T, L, S, 0, 3, false, y);
  drawShell(T, L, S, lidCx, 2, true, y);
  // หูยึดผนังสองข้าง (ภาพกล่อง) — ขนาดใช้วาดเท่านั้น แบบไม่ระบุ
  const earMat = new T.MeshStandardMaterial({ color: 0xe4e5e2, roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const e = S.lookEar; const ear = new T.Mesh(new T.BoxGeometry(e, 1.2, S.outerD * 0.92), earMat);
    ear.position.set(sx * (W + e / 2), y + 0.6, 0); L.add(ear);
    for (const sz of [-1, 1]) { const hole = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 1.4, 16), new T.MeshBasicMaterial({ color: 0x9c9a92 })); hole.position.set(sx * (W + e / 2), y + 0.7, sz * S.outerD * 0.3); L.add(hole); }
  }
  const tagTxt = (t, x, z) => { const s = K.label(t, { h: 3.6, color: '#5F5E5A', border: null, bg: 'rgba(243,242,238,0.9)', screen: true }); s.center.set(0, 0); s.position.set(x, 2, z); s.userData.major = true; s.userData.ref = true; B.partLabels.add(s); };
  tagTxt(`กล่องตัวรับ ${S.outerW} × ${S.outerD} มม. (ตามแบบเจาะ)`, -W - S.lookEar, D + 4);
  tagTxt('↑ ผนังหลัง (ฝั่งที่มีสาย)', -W, -D - 4);
  tagTxt('ฝา · มองบนตอนปิดฝา', lidCx - W, D + 4);
  const mark = (x, z, r, yy) => { const m = holeMarker(T, r); m.position.set(x, yy, z); L.add(m); };
  const lab = (text, x, z, anchor = 'c') => { const s = K.label(text, { h: 3.0, color: '#1F1F1D', bg: 'rgba(255,255,255,0.95)', border: '#1F1F1D', anchor }); s.position.set(x, 4, z); s.userData.ref = true; B.partLabels.add(s); };
  // ช่อง USB-C 13 × 8 วาดเป็นกรอบสี่เหลี่ยม (มองบนเห็นเป็นแถบบนผนัง)
  const slot = (x, z, w) => { const g = new T.Group(); g.userData.drill = true; const m = new T.LineBasicMaterial({ color: 0x1f1f1d }); const pts = [[-w / 2, -1.6], [w / 2, -1.6], [w / 2, 1.6], [-w / 2, 1.6], [-w / 2, -1.6]].map(([a, b]) => new T.Vector3(a, 0, b)); g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), m)); g.position.set(x, y + 3.3, z); L.add(g); };
  const out = [];
  for (const h of RX_HOLES) {
    let where;
    if (h.on === 'ผนังหลัง') {
      const z = -D + wallT / 2;
      if (h.id === 'rx-usb') { slot(h.x, z, 13); lab('ช่อง USB-C 13 × 8', h.x, z - 7); }
      else { mark(h.x, z, h.dia / 2, y + 3.2); lab(`รู SMA ⌀${h.dia}`, h.x, z - 7); }
      const side = h.x < 0 ? 'ซ้าย' : 'ขวา';
      where = `มองบน: ${side}เส้นกลางกล่อง ${Math.abs(h.x)} มม. · สูงจากก้นกล่อง ${h.up} มม. (กลางรู) · มองจากข้างนอกซ้าย-ขวาจะกลับกัน`;
      out.push({ ...h, x: h.x, z, where });
    } else {
      const x = lidCx - W + h.fromLeft; const z = -D + h.fromBack;
      mark(x, z, h.dia / 2 + 1, y + 2.4); lab(`รูไฟสถานะ ⌀${h.dia}`, x, z + 8);
      where = `มองบนตอนปิดฝา: ห่างขอบซ้าย ${h.fromLeft} · ขอบหลัง ${h.fromBack} มม.`;
      out.push({ ...h, x, z, where });
    }
  }
  // ป้ายบนฝา (แบบ: "ตัวรับ · อบต. ห้ามดึงสายเสา") — ตำแหน่งประมาณจากภาพในแบบ
  lab('ป้าย: ตัวรับ · อบต. / ห้ามดึงสายเสา', lidCx - W + 76, -D + 54);
  // ไฟสถานะบนบอร์ดต้องตรงรูฝา: เทียบตำแหน่งในกล่องกับรูฝา
  const led = out.find((h) => h.id === 'rx-led');
  const ledIn = { x: -W + led.fromLeft, z: -D + led.fromBack }; mark(ledIn.x, ledIn.z, 2, y + 9);
  lab('ไฟบนบอร์ด (ตรงรูฝา)', ledIn.x + 14, ledIn.z, 'l');
  out.push({ id: 'p-rxpcb', place: true, name: `แผ่นไข่ปลา ${RX_PCB.w} × ${RX_PCB.d}`, on: 'ในกล่อง', where: `ชิดมุมซ้าย-หลัง · ขอบซ้ายแผ่นห่างขอบนอกกล่อง ~${r0(RX_PCB.cx - RX_PCB.w / 2 + W)} · ขอบหลัง ~${r0(RX_PCB.cz - RX_PCB.d / 2 + D)} มม. (วัดจากภาพในแบบ)` });
  out.push({ id: 'p-rxusb', place: true, name: 'ESP32-C3', on: 'ในกล่อง', where: 'หัว USB-C ชี้ไปช่อง USB-C ผนังหลัง · ไฟบนบอร์ดต้องอยู่ใต้รูไฟสถานะของฝา' });
  out.push({ id: 'p-rxcable', place: true, name: 'สายแปลงขั้ว 15 ซม.', on: 'ในกล่อง', where: 'จาก IPEX บนวิทยุ ไปหัว SMA ที่ผนังหลัง (แบบ)' });
  return out;
}
