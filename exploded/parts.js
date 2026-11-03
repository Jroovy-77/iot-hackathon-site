/**
 * parts.js (v2) - ชิ้นส่วน 3D ของ "ปุ่มเรียกเรือ รุ่นชาวบ้าน" สร้างจากรูปทรงพื้นฐานทั้งหมด ไม่มีโมเดลดาวน์โหลด
 * ทุก id ใน docs/parts.md (ยกเว้น radio-proto ที่ไม่อยู่ในโมเดล) : 18 ชิ้น
 *
 * มาตราส่วน: 1 หน่วย = 1 มม. (ขนาดจริง 1:1) ทั้งไฟล์ ขนาดเป็นค่าประมาณจากสเปกใน docs/parts.md ยังไม่ได้วัดของจริง
 *
 * แกน (ชุดประกอบแล้ว): +X ขวา, +Y ขึ้น, +Z คือ "หน้ากล่อง" (ฝา ปุ่ม วงไฟ หันมาทางนี้) origin = กลางกล่อง
 *   กล่อง 150 x 150 : ตัวกล่อง z -45..+35 (หลังกล่อง z=-45, ผนังหนา 4, ด้านในลึก 76 : -41..+35)
 *   ฝา z +35..+45 (ฝาแผ่นหนา 5 + ขอบสูง 5) ด้านในใต้แผ่นฝา z=+40
 *   ผนังซ้าย -X, ขวา +X (ผนังขวามีไฟดวงที่ 9 หันออก + รูเสียงลำโพง), ผนังบน +Y, ผนังล่าง -Y (ซีลสายไฟบ้าน + ซีลสายวัดน้ำ)
 *   ปุ่มแดงอยู่ (-25, 0) ปุ่มเขียว (47, -10) วงไฟรัศมี 40 รอบปุ่มแดง
 *   แผ่นไข่ปลา 70 x 90 อยู่ซ้าย (x -70..0) รางถ่านอยู่ล่างขวา ลำโพงติดผนังขวา เสาอากาศวางตามขอบบนในกล่อง
 *
 * ทุกชิ้น: origin = กลางชิ้น (ยกเว้นที่ระบุในช่อง origin ของ PARTS) ; assembled.rot เป็น Euler XYZ (เรเดียน) ส่วนใหญ่ 0
 * ใช้ MeshStandardMaterial ต้องมีแสง (animator ใส่เอง) ; THREE ส่งเข้าได้ทุกฟังก์ชัน ค่าเริ่มต้น import 'three' (ทดสอบกับ r186 ใน vendor/three)
 *
 * ================= สรุป API (สำหรับ animator) =================
 * Export: LAYOUT, ASSUMED, STATE_COLORS, LED_COLORS, MAT_NAMES, PARTS, NETS,
 *         buildPart, buildAll, createParts, explodeAt, setOpacity, outlineGroup, anchorOf,
 *         pinWorld, wirePoint, railPoint, buildWires (= createWires), wireBetween
 * รอบ v2-3 (เพิ่มท้ายไฟล์) : WATER_COLOR, ROOM, buildRoom, RX, RX_DESK, RX_NETS, rxPinWorld, buildReceiver, LAPTOP, buildLaptop, buildRxAntenna,
 *         OFFICE, buildOfficeCutaway, MAP, MAP_MAT_NAMES, buildMap  (ห้อง/ตัวรับ/โน้ตบุ๊ก = มม. ; แผนที่ = เมตร แยก scene) ดูรายละเอียดที่หัวส่วนท้ายไฟล์
 *
 * 1) PARTS[i] = { id, nameTh, optional, order, stage('3a'|'3b'|'3c'), sizeMm:[x,y,z],
 *      assembled:{ pos:[x,y,z], rot:[rx,ry,rz] }, explode:{ offset:[x,y,z] }  (ระยะเลื่อน ณ t=1),
 *      sub: { name: { offset:[x,y,z] } }  (ชิ้นย่อยที่แยกเพิ่มได้ : offset = ระยะรวมในพิกัดโลก ไม่ใช่เทียบชิ้นแม่),
 *      anchor, anchors  (จุดชี้ป้ายบนผิวที่มองเห็น พิกัดท้องถิ่น),
 *      pins: { ชื่อ: [x,y,z] }  (จุดต่อสาย พิกัดท้องถิ่น) }
 *    ชื่อ pin ที่มี '.' (เช่น 'R3.1', 'leds4.DIN', 'D1.K') คือชื่อเต็มตาม docs/wiring.md ; ชื่อไม่มี '.' ('GPIO6') ใช้เป็น '<id>.GPIO6'
 *    pinWorld('mcu.GPIO6') -> [x,y,z] พิกัดโลกตอนประกอบ (รวมการหมุนของชิ้น)
 *    pinWorld(name, t, offsets?) ไม่รองรับ t : ใช้ explodeAt กับสายเอง หรือวาดสายตอนประกอบ (t=0)
 * 2) ราง (rail.VSYS / rail.VSW / rail.3V3 / gnd) เป็นลวดเปลือยบนแผ่นไข่ปลา : railPoint('VSYS', near) คืนจุดบนรางที่ใกล้ near
 *    wirePoint(name, near) = pin หรือราง (รับ 'rail.VSYS', 'gnd') ตัวเดียวใช้ทั้งหมด
 * 3) NETS = ตารางเส้นสายทั้งหมดของ docs/wiring.md ข้อ 3.1 : [{ from, to, type:'power'|'ground'|'data'|'audio', internal? }]
 *    internal:true = สายสั้นที่วาดอยู่ในชิ้น leds เองแล้ว (ดวง 1->8) buildWires ข้ามให้
 *    buildWires(THREE, { separate:true, only?: (net)=>bool }) -> Group 'wires' (พิกัดตอนประกอบ ใส่ระดับเดียวกับชิ้นส่วน)
 *      mesh แต่ละเส้น userData.net = {from,to,type}, userData.mat = wire-red | wire-black | wire (power|ground|data, audio ใช้ 'wire' สีม่วง)
 *      สีตาม docs/design-direction.md : power #B4462F, ground #1F1F1D, data #2E6DB4, audio #7A4FB0
 *    wireBetween(THREE, 'mcu.GPIO6', 'radio.SCK', { type, lift, radius }) -> Mesh เส้นเดียว
 * 4) วัสดุ : ทุก Mesh มี mesh.userData.mat เป็นหนึ่งใน MAT_NAMES (shell | pcb | chip | metal | rubber | screen | led | window |
 *    wire-red | wire-black | wire | plastic-dark) และ userData.accent=true ถ้าควรรับสีเน้น (โดมปุ่ม, ก้อนถ่าน, ไฟ)
 *    mesh วัสดุเดียวกันในชิ้นเดียวถูกรวมเป็น mesh เดียว ยกเว้นตัวปล่อยแสงของ LED (แยกทีละดวง)
 *    'window' = ช่องใสของฝา/ผนัง opacity 0.45 (เก็บ opacity ตั้งต้นใน material.userData.baseOpacity)
 * 5) ไฟ 9 ดวง : leds group มี userData.leds = { count:9, meshes, materials, positions (ท้องถิ่นของ leds),
 *      setColor(i, hex, intensity=1), setAll(hex, intensity), setState(i, 'orange'|'green'|'red'|'yellow'|'off', intensity), reset() }
 *    ดวง i = 0..7 อยู่ในวงรอบปุ่มแดง (ดวง 1 บนซ้าย เรียงตามเข็มนาฬิกา) , i = 8 คือดวงที่ 9 บนผนังขวา
 *    LED_COLORS = { orange:0xE0701A, green:0x2F8A3E, red:0xD23B30, yellow:0xE8B400 } ตาม design-direction.md
 *    ชิ้นย่อย : leds.userData.ring (Group วง 8 ดวง + สายสั้น) , leds.userData.led9 (Group ดวง 9) -> ตั้ง sub.led9 ใน explodeAt
 * 6) ชิ้นย่อยอื่น : battery.userData.cover (ฝาเลื่อน) , battery.userData.cells (ถ่าน 3 ก้อน) -> sub.cover / sub.cells ใน PARTS
 * 7) explodeAt(groups, t) ตั้งตำแหน่งทุกชิ้น (และชิ้นย่อย sub) ที่ t = 0..1 ; setOpacity(group, o) ; outlineGroup(group, THREE, opts)
 *    buildAll(THREE) -> { root, groups(Map id->Group), wires } ; createParts(THREE) -> อาร์เรย์ { id, name, object, assembled, exploded, ... }
 *
 * แหล่งที่มาของขนาด (อ้างในคอมเมนต์ที่ชิ้นนั้น) : docs/parts.md เป็นหลัก ; ค่าที่ parts.md ไม่ระบุอยู่ใน ASSUMED
 */

import * as THREE_DEFAULT from 'three';

const G = 2.54;                                                             // ระยะรูแผ่นไข่ปลา
const PI = Math.PI;

// ---------------------------------------------------------------- ค่าที่ตั้งสมมติ (parts.md / datasheet ไม่ได้ระบุ)
export const ASSUMED = {
  wall: 'ผนังกล่องหนา 4 มม. (ด้านในลึก 76 ซึ่งเกิน ~70 ใน parts.md จึงไม่ย่อชิ้นไหน)',
  lid: 'ฝา = แผ่นหนา 5 + ขอบสูง 5 (รวม 10 ตาม parts.md) ไฟ 8 ดวงติดใต้แผ่นฝา',
  speaker: 'ลำโพงติดผนังขวาด้านใน (ไม่ใช่ฝา) ตาม storyboard 3-ค "ด้านข้างที่มีรูเสียง" ; รูเสียงวาดเป็นจุดมืดบนผนัง (ไม่ได้เจาะจริง)',
  radioPads: 'Wio-SX1262 11.6x11x2.95 (Seeed) ; ตำแหน่ง/ลำดับขา 1-12 และตำแหน่งช่อง IPEX บนโมดูลเป็นค่าสมมติ ต้องเทียบ datasheet แผ่นที่ 5-7',
  radioAdapter: 'แผ่นแปลงขา 16 x 14.5 x 1.0 ขา 2 แถว แถวละ 6 ขา ห่าง 12.7 มม. (สมมติ)',
  superMini: 'ESP32-C3 Super Mini 22.5 x 18 x ~4 ขา 8+8 ห่าง 2.54 แถวห่าง 15.24 (protosupplies / mischianti บอก 22.5x18 หนา 4.5) ; ลำดับขา: ซ้าย 5V GND 3V3 4 3 2 1 0 / ขวา 5 6 7 8 9 10 20 21 (USB-C อยู่ด้านบน)',
  pam8403: 'โมดูล PAM8403 22 x 19 x ~9 (บล็อกขั้วต่อ 2 ช่องสูง 8.2) ขาเข้า 4 ขาเรียงแถวเดียว (สมมติ)',
  sot23Adapter: 'แผ่นแปลง SOT-23 10.2 x 8 x 1.0 (สมมติ) ; AO3401A ขา 1=G 2=S 3=D',
  s8050: 'S8050 ตัวถัง TO-92 4.5 x 3.5 x 4.5 ขา E B C (ดูด้านเรียบ ซ้ายไปขวา)',
  antenna: 'ท่อยาง 81 มม. = 1/4 ความยาวคลื่น 915 MHz (c/f/4 = 82 มม.) Ø4 ; สายสั้นหัว U.FL ตามเส้นทางโค้งไปที่ช่อง IPEX',
  buttons: 'ปุ่มแดง Ø60 : ตัวเรือน Ø44 ลึกใต้แผ่นฝา ~50 ; ปุ่มเขียว Ø46 : ตัวเรือน Ø32 ลึก ~39 ; ไมโครสวิตช์ 20 x 6.4 x 10 ขา COM NC NO',
  battery: 'รางถ่าน AA x3 62 x 48 x 17 ฝาเลื่อน + สวิตช์ ; ถ่าน AA Ø14.5 x 50.5',
  caps: 'ตัวเก็บประจุ 470 uF 50V ใช้ Ø10 x 20 ; 10 uF Ø5 x 11 ; 1 uF Ø4 x 7 ; ที่เหลือเซรามิก Ø5 (ขนาดตามชุดทั่วไป ไม่ได้เช็กรุ่นร้าน)',
  powerIn: 'ซีลสายไฟบ้านแบบ PG9 ; สายยาว 100 ปลายหัว USB-A ย่อสั้นกว่าจริงมาก',
  waterProbe: 'สายวัดน้ำยาวถึงปลายสายเปลือย 110 มม. ย่อจากระยะจริง (ระดับ 50 ซม. เหนือพื้น)',
};

export const LED_COLORS = { orange: 0xe0701a, green: 0x2f8a3e, red: 0xd23b30, yellow: 0xe8b400 };
export const STATE_COLORS = { ...LED_COLORS };

export const MAT_NAMES = ['shell', 'pcb', 'chip', 'metal', 'rubber', 'screen', 'led', 'window',
  'wire-red', 'wire-black', 'wire', 'plastic-dark'];

const WIRE_COLORS = { power: 0xb4462f, ground: 0x1f1f1d, data: 0x2e6db4, audio: 0x7a4fb0 };
const WIRE_MAT = { power: 'wire-red', ground: 'wire-black', data: 'wire', audio: 'wire' };

// สีแต่ละชิ้นเลือกให้แยกกันชัดทั้งพื้นมืดและพื้นสว่าง (animator ทับเป็นสไตล์ขาว-เทาเอง)
const C = {
  body: 0x6d7f86, lid: 0xaeb9be, gasket: 0x1c1c1c, window: 0xe8f4ff,
  pcb: 0x2f8a4a, mcu: 0x16243f, radioMod: 0x1b1b1b, radioAd: 0xb8352e, amp: 0x1f8f7a, qAd: 0xd9a21b,
  btnSos: 0xd23b30, btnAck: 0x2f8a3e, bezel: 0x232323, nut: 0x34383a, thread: 0x2a2e30, sw: 0xb9b49c,
  ledStrip: 0xf1efe8, copper: 0xd9a066, silver: 0xd0d3d6, gold: 0xd4af37, black: 0x161616,
  cell: 0x2f7d4f, holder: 0x24282a, speaker: 0x8a9096, antenna: 0x1b1b1b,
  resistor: 0xe3d3a0, cer: 0xd1a043, electro: 0x1f3a73, tan: 0xe3d5b0,
};

// ---------------------------------------------------------------- เลย์เอาต์ (พิกัดโลกตอนประกอบ)
export const LAYOUT = {
  box: { w: 150, h: 150, wall: 4, backZ: -45, innerBackZ: -41, rimZ: 35, lidUnderZ: 40, lidTopZ: 45 },
  red: [-25, 0],             // ปุ่มแดง Ø60
  green: [47, -10],          // ปุ่มเขียว Ø46
  ringR: 40,                 // รัศมีวงไฟ (กึ่งกลางดวง)
  ledPieceSize: [16, 10],    // ชิ้นไฟ ยาว x กว้าง (ยาวตามเส้นสัมผัสวง)
  pcb: { center: [-35, 0], topZ: -35.4, midZ: -36.2, size: [70, 90, 1.6] },
  battery: [39, -35, -32.5],
  speaker: [71, 32, -17],
  led9: [71, -4, -3],
  glandPower: [-35, -73, -29.5],
  glandWater: [-55, -73, -29.5],
  antennaBase: [-19.5, 66, -32],
};
const PCB_O = [LAYOUT.pcb.center[0], LAYOUT.pcb.center[1], LAYOUT.pcb.midZ];   // origin ของ pcb / passives / diodes
const PCB_TOP = 0.8;                                                           // ผิวบนของแผ่นเทียบ origin ของมัน
const gp = (i, j) => [i * G, j * G];                                           // จุดรูแผ่นไข่ปลา -> มม. (พิกัดท้องถิ่นของ pcb)
const onBoard = (i, j, z = 0) => [PCB_O[0] + i * G, PCB_O[1] + j * G, PCB_O[2] + z];

// ---------------------------------------------------------------- คณิตศาสตร์หมุน (Euler XYZ ตามนิยามของ three: v' = Rx Ry Rz v)
function rotVec(rot, [x, y, z]) {
  const [a, b, c] = rot;
  const x1 = x * Math.cos(c) - y * Math.sin(c), y1 = x * Math.sin(c) + y * Math.cos(c), z1 = z;
  const x2 = x1 * Math.cos(b) + z1 * Math.sin(b), y2 = y1, z2 = -x1 * Math.sin(b) + z1 * Math.cos(b);
  return [x2, y2 * Math.cos(a) - z2 * Math.sin(a), y2 * Math.sin(a) + z2 * Math.cos(a)];
}

// ---------------------------------------------------------------- ตำแหน่งขา (ท้องถิ่นของแต่ละชิ้น) สร้างครั้งเดียว ใช้ทั้งตอนสร้างชิ้นและตอนลากสาย
// --- mcu : ESP32-C3 Super Mini (USB-C ที่ +Y) ขา origin = กลางบอร์ด ผิวบนบอร์ด z=0.6
const MCU_L = ['5V', 'GND', '3V3', 'GPIO4', 'GPIO3', 'GPIO2', 'GPIO1', 'GPIO0'];
const MCU_R = ['GPIO5', 'GPIO6', 'GPIO7', 'GPIO8', 'GPIO9', 'GPIO10', 'GPIO20', 'GPIO21'];
const MCU_PINS = {};
MCU_L.forEach((n, i) => { MCU_PINS[n] = [-7.62, 8.89 - i * G, 1.2]; });
MCU_R.forEach((n, i) => { MCU_PINS[n] = [7.62, 8.89 - i * G, 1.2]; });

// --- radio : Wio-SX1262 บนแผ่นแปลงขา origin = กลางแผ่นแปลง ผิวบน z=0.5
const RADIO_L = ['RF_SW', 'MISO', 'MOSI', 'SCK', 'NRST', 'NSS'];                    // ขา 1-6 บนลงล่าง
const RADIO_R = ['DIO1', 'BUSY', 'GND10', null, 'VCC', 'GND7'];                     // ขา 12,11,10,9,8,7 บนลงล่าง
const IPEX_L = [3.4, 3.6, 2.56];
const RADIO_PINS = { IPEX: IPEX_L };
RADIO_L.forEach((n, i) => { if (n) RADIO_PINS[n] = [-6.35, (2.5 - i) * G, 1.2]; });
RADIO_R.forEach((n, i) => { if (n) RADIO_PINS[n] = [6.35, (2.5 - i) * G, 1.2]; });

// --- amp : PAM8403 origin = กลางบอร์ด ผิวบน z=0.6
const AMP_PINS = {
  '+5V': [-3.81, -8, 1.2], GND: [-1.27, -8, 1.2], INL: [1.27, -8, 1.2], INR: [3.81, -8, 1.2],
  'OUTL+': [-7.9, 9.0, 3.1], 'OUTL-': [-2.9, 9.0, 3.1],
};

// --- q-drive S8050 origin = กลางตัว ขา E B C (บิดเป็น 2.54 ห่าง) ลงรู
const QD_PINS = { E: [-G, 0, -4.7], B: [0, 0, -4.7], C: [G, 0, -4.7] };
// --- q-power AO3401A บนแผ่นแปลง SOT-23 origin = กลางแผ่น ผิวบน z=0.5
const QP_PINS = { G: [-3.81, G, 1.2], S: [-3.81, 0, 1.2], D: [-3.81, -G, 1.2] };

// --- passives (origin = origin ของ pcb) : ขาตัวต้านทาน/ตัวเก็บประจุ/ไดโอด อยู่ที่รูบนผิวแผ่น
const RES = [   // id, ix1, ix2, iy, ค่า
  ['R3', -13, -10, 4, '1M'], ['R4', -13, -10, 2, '1M'], ['R10', -13, -10, 0, '10k'], ['R11', -13, -10, -2, '100k'],
  ['R12', -13, -10, -5, '100k'], ['R7', -13, -10, -12, '10k'], ['R13', -13, -10, -14, '1k'],
  ['R5', 2, 5, 9, '10k'], ['R6', 2, 5, 7, '10k'], ['R2', 2, 5, 5, '100k'], ['R8', -3, 0, 5, '330'], ['R9', 2, 5, -9, '2.2k'],
];
const CAP = [   // id, ชนิด, ix1, ix2, iy, bodyR, bodyH  (disc = เซรามิกแนวตั้ง, el = อิเล็กโทรไลต์)
  ['C1', 'disc', -8, -6, -9], ['C2', 'disc', -8, -6, 4], ['C8', 'disc', 7, 9, 5], ['C4', 'disc', 7, 9, -9],
  ['C5', 'el', -1, 0, -9, 2, 7], ['C6', 'el', 4, 6, -14, 5, 20], ['C7', 'el', 9, 10, 10, 2.5, 11],
];
const DIO = [['D1', -4, 0, -13], ['D2', 9, 13, -15]];                                // id, ix(A), ix(K), iy
const PASSIVE_PINS = {};
const LEAD_Z = PCB_TOP + 0.5;
for (const [id, a, b, j] of RES) { PASSIVE_PINS[`${id}.1`] = [...gp(a, j), LEAD_Z]; PASSIVE_PINS[`${id}.2`] = [...gp(b, j), LEAD_Z]; }
for (const [id, kind, a, b, j] of CAP) {
  const polar = id === 'C6' || id === 'C7';
  PASSIVE_PINS[`${id}.${polar ? '+' : '1'}`] = [...gp(a, j), LEAD_Z];
  PASSIVE_PINS[`${id}.${polar ? '-' : '2'}`] = [...gp(b, j), LEAD_Z];
}
const DIODE_PINS = {};
for (const [id, a, b, j] of DIO) { DIODE_PINS[`${id}.A`] = [...gp(a, j), LEAD_Z]; DIODE_PINS[`${id}.K`] = [...gp(b, j), LEAD_Z]; }

// --- ราง (ลวดเปลือยบนแผ่นไข่ปลา) แนวตั้งตามแกน Y
const RAIL_IX = { VSW: 10, VSYS: 11, '3V3': 12, GND: 13 };
const RAIL_J = [-12, 3];
const RAIL_Z = PCB_TOP + 0.6;
const PCB_PINS = {};
for (const [n, ix] of Object.entries(RAIL_IX)) PCB_PINS[`rail.${n}`] = [ix * G, (RAIL_J[0] + RAIL_J[1]) / 2 * G, RAIL_Z];

// --- ไฟ 9 ดวง : origin ของ leds = กลางวงไฟที่ใต้แผ่นฝา (z=40) ; ผิวหน้า LED (หันหาฝา) คือ z=0 ของแต่ละชิ้น
const LEDS_ORIGIN = [LAYOUT.red[0], LAYOUT.red[1], 40];
const PAD_Y = { '+5V': 3, DATA: 0, GND: -3 };
function ledMatrix(T, k) {                       // k = 0..7 วง , 8 = ดวงที่ 9
  const M = new T.Matrix4();
  if (k < 8) {
    const th = (112.5 - 45 * k) * PI / 180;      // ดวง 1 บนซ้าย เรียงตามเข็มนาฬิกา
    M.makeTranslation(LAYOUT.ringR * Math.cos(th), LAYOUT.ringR * Math.sin(th), 0);
    M.multiply(new T.Matrix4().makeRotationZ(th - PI / 2));
  } else {
    const o = LAYOUT.led9.map((v, i) => v - LEDS_ORIGIN[i]);
    M.makeTranslation(o[0], o[1], o[2]);
    M.multiply(new T.Matrix4().makeRotationY(PI / 2));
  }
  return M;
}
const LED_PINS = {};
const LED_CENTERS = [];
{
  const T = THREE_DEFAULT;
  for (let k = 0; k < 9; k++) {
    const M = ledMatrix(T, k);
    const P = (x, y, z) => { const v = new T.Vector3(x, y, z).applyMatrix4(M); return [v.x, v.y, v.z]; };
    const n = `leds${k + 1}`;
    LED_PINS[`${n}.DIN`] = P(-6.4, PAD_Y.DATA, -1.5);
    LED_PINS[`${n}.DOUT`] = P(6.4, PAD_Y.DATA, -1.5);
    LED_PINS[`${n}.+5V`] = P(-6.4, PAD_Y['+5V'], -1.5);
    LED_PINS[`${n}.GND`] = P(-6.4, PAD_Y.GND, -1.5);
    LED_CENTERS.push(P(0, 0, 0));
  }
}

// --- ปุ่ม : ขาไมโครสวิตช์ (origin = ระนาบผิวบนของฝา ที่แนวกลางปุ่ม)
const SOS_PINS = { COM: [-8, 0, -54], NC: [0, 0, -54], NO: [8, 0, -54] };
const ACK_PINS = { COM: [-8, 0, -44], NC: [0, 0, -44], NO: [8, 0, -44] };
// --- ลำโพง : origin = ผิวติดผนัง ตัวลำโพงยื่นไปทาง -z (ท้องถิ่น) ; ในโลกหมุน Y 90 องศา ให้ -z ชี้เข้ากล่อง
const SPK_PINS = { '+': [3, 21.5, -1.6], '-': [-3, 21.5, -1.6] };
// --- รางถ่าน : ปลายสายแดง/ดำ
const BAT_PINS = { '+': [-49, 14, 8], '-': [-49, -14, 8] };
// --- สายไฟบ้าน / สายวัดน้ำ (origin = กลางผนังล่างที่ซีล ; +Y ท้องถิ่น = เข้ากล่อง)
const PWR_PINS = { '+5V': [-3, 25, 0], GND: [3, 25, 0] };
const WTR_PINS = { red: [-2.5, 25, 0], black: [2.5, 25, 0] };

// ---------------------------------------------------------------- ตาราง PARTS
// offset = ระยะเลื่อนปลายทางที่ t=1 (พิกัดโลก) ; sub.offset = ระยะรวมของชิ้นย่อยในพิกัดโลก
const SPK_ROT = [0, PI / 2, 0];
export const PARTS = [
  { id: 'box-lid', nameTh: 'ฝากล่อง', optional: false, order: 0, stage: '3a', sizeMm: [150, 150, 10],
    assembled: { pos: [0, 0, 40], rot: [0, 0, 0] }, explode: { offset: [0, 0, 120] },
    anchors: [[-60, 62, 5], [60, 62, 5], [75, 0, 0], [-25, -55, 5]], pins: {} },
  { id: 'btn-sos', nameTh: 'ปุ่มแดง', optional: false, order: 1, stage: '3a', sizeMm: [60, 60, 75],
    assembled: { pos: [LAYOUT.red[0], LAYOUT.red[1], 45], rot: [0, 0, 0] }, explode: { offset: [0, 0, 185] },
    anchors: [[0, 0, 18], [19, 0, 12], [-19, 0, 12], [0, 29, 2]], pins: prefixPins('btn-sos', SOS_PINS) },
  { id: 'btn-ack', nameTh: 'ปุ่มเขียว', optional: false, order: 2, stage: '3a', sizeMm: [46, 46, 56],
    assembled: { pos: [LAYOUT.green[0], LAYOUT.green[1], 45], rot: [0, 0, 0] }, explode: { offset: [0, 0, 185] },
    anchors: [[0, 0, 11], [14, 0, 7], [0, 22, 2]], pins: prefixPins('btn-ack', ACK_PINS) },
  { id: 'leds', nameTh: 'ไฟสถานะ 9 ดวง', optional: false, order: 3, stage: '3a', sizeMm: [96, 96, 3],
    assembled: { pos: [...LEDS_ORIGIN], rot: [0, 0, 0] }, explode: { offset: [0, 0, 75] },
    sub: { led9: { offset: [60, 0, 0] } },
    anchors: [[...LED_CENTERS[0]], [...LED_CENTERS[2]], [...LED_CENTERS[5]], [...LED_CENTERS[8]]], pins: { ...LED_PINS } },
  { id: 'pcb', nameTh: 'แผ่นไข่ปลา', optional: false, order: 4, stage: '3b', sizeMm: [70, 90, 6],
    assembled: { pos: [...PCB_O], rot: [0, 0, 0] }, explode: { offset: [0, 0, -15] },
    anchors: [[-30, -40, 0.8], [30, 38, 0.8], [0, -45, -0.8]], pins: { ...PCB_PINS } },
  { id: 'mcu', nameTh: 'สมอง', optional: false, order: 5, stage: '3b', sizeMm: [22.5, 18, 4],
    assembled: { pos: [...onBoard(-6, 12.5, PCB_TOP + 2.5 + 0.6)], rot: [0, 0, 0] }, explode: { offset: [0, 0, 55] },
    anchors: [[0, 8.2, 3.9], [0, -2.5, 1.4], [-7.62, 0, 1.2]], pins: prefixPins('mcu', MCU_PINS) },
  { id: 'radio', nameTh: 'วิทยุ', optional: false, order: 6, stage: '3b', sizeMm: [16, 14.5, 6],
    assembled: { pos: [...onBoard(4.5, 13.5, PCB_TOP + 2.5 + 0.5)], rot: [0, 0, 0] }, explode: { offset: [0, 0, 70] },
    anchors: [[-1.8, -0.8, 3.45], [3.4, 3.6, 2.56], [-6.35, 0, 1.2]], pins: prefixPins('radio', RADIO_PINS) },
  { id: 'antenna', nameTh: 'เสาอากาศ', optional: false, order: 7, stage: '3b', sizeMm: [82, 32, 6],
    assembled: { pos: [...LAYOUT.antennaBase], rot: [0, 0, 0] }, explode: { offset: [0, 40, 60] },
    anchors: [[20, 0, 2], [-20, 0, 2], [40, 0, 2]], pins: {} },        // pins ของเสาเติมด้านล่าง (ขึ้นกับตำแหน่งวิทยุ)
  { id: 'passives', nameTh: 'ตัวต้านทานและตัวเก็บประจุ', optional: false, order: 8, stage: '3b', sizeMm: [66, 84, 22],
    assembled: { pos: [...PCB_O], rot: [0, 0, 0] }, explode: { offset: [0, 0, 35] },
    anchors: [[...gp(-11.5, 0), 3.5], [...gp(5, -14), 21], [...gp(9, 5), 5]], pins: { ...PASSIVE_PINS } },
  { id: 'q-drive', nameTh: 'ตัวขับสวิตช์ตัดไฟ', optional: false, order: 9, stage: '3b', sizeMm: [4.5, 3.5, 4.5],
    assembled: { pos: [...onBoard(-7, 0, PCB_TOP + 5.25)], rot: [0, 0, 0] }, explode: { offset: [0, 0, 48] },
    anchors: [[0, 1.75, 1], [0, 0, 2.25]], pins: prefixPins('q-drive', QD_PINS) },
  { id: 'q-power', nameTh: 'สวิตช์ตัดไฟ', optional: false, order: 10, stage: '3b', sizeMm: [10.2, 8, 4],
    assembled: { pos: [...onBoard(-6.5, -6, PCB_TOP + 2.5 + 0.5)], rot: [0, 0, 0] }, explode: { offset: [0, 0, 48] },
    anchors: [[0, 0, 1.6], [3.8, 0, 0.5]], pins: prefixPins('q-power', QP_PINS) },
  { id: 'diodes', nameTh: 'ไดโอดกันไฟย้อน', optional: false, order: 11, stage: '3b', sizeMm: [66, 84, 6],
    assembled: { pos: [...PCB_O], rot: [0, 0, 0] }, explode: { offset: [0, 0, 35] },
    anchors: [[...gp(-2, -13), 3.4], [...gp(11, -15), 3.4]], pins: { ...DIODE_PINS } },
  { id: 'amp', nameTh: 'ตัวขยายเสียง', optional: false, order: 12, stage: '3c', sizeMm: [22, 19, 9],
    assembled: { pos: [...onBoard(4.5, -6 + 8 / G, PCB_TOP + 2.5 + 0.6)], rot: [0, 0, 0] }, explode: { offset: [0, 0, 45] },
    anchors: [[0, 5.2, 8.8], [0, -3.2, 1.4], [-3, -8, 1]], pins: prefixPins('amp', AMP_PINS) },
  { id: 'speaker', nameTh: 'ลำโพง', optional: false, order: 13, stage: '3c', sizeMm: [15, 40, 40],
    assembled: { pos: [...LAYOUT.speaker], rot: [...SPK_ROT] }, explode: { offset: [75, 0, 0] },
    anchors: [[0, 0, -15], [0, 17, -2], [0, -17, -2]], pins: prefixPins('speaker', SPK_PINS) },
  { id: 'battery', nameTh: 'รางถ่าน AA 3 ก้อน', optional: false, order: 14, stage: '3c', sizeMm: [62, 48, 17],
    assembled: { pos: [...LAYOUT.battery], rot: [0, 0, 0] }, explode: { offset: [55, -45, 0] },
    sub: { cover: { offset: [55, -45, 28] }, cells: { offset: [55, -45, 12] } },
    anchors: [[0, 0, 9], [28, 10, 9], [-31, 0, 0]], pins: prefixPins('battery', BAT_PINS) },
  { id: 'power-in', nameTh: 'สายไฟบ้านและซีล', optional: false, order: 15, stage: '3c', sizeMm: [20, 150, 20],
    assembled: { pos: [...LAYOUT.glandPower], rot: [0, 0, 0] }, explode: { offset: [0, -55, 0] },
    anchors: [[0, -8, 10], [0, -60, 2], [0, -118, 3]], pins: prefixPins('power-in', PWR_PINS) },
  { id: 'water-probe', nameTh: 'สายวัดน้ำ', optional: true, order: 16, stage: '3c', sizeMm: [12, 150, 7],
    assembled: { pos: [...LAYOUT.glandWater], rot: [0, 0, 0] }, explode: { offset: [0, -55, 0] },
    anchors: [[0, -50, 2], [-4, -118, 1], [4, -118, 1]], pins: prefixPins('water-probe', WTR_PINS) },
  { id: 'box-body', nameTh: 'ตัวกล่อง', optional: false, order: 17, stage: '3c', sizeMm: [150, 150, 80],
    assembled: { pos: [0, 0, -5], rot: [0, 0, 0] }, explode: { offset: [0, 0, -130] },
    anchors: [[75, 40, 10], [0, 75, 10], [-75, 0, 10], [0, -75, 10], [-82, 55, -38]], pins: {} },
].map((p) => ({ ...p, anchor: p.anchors[0], sub: p.sub || {} }));

// pin ของเสา : ปลั๊ก U.FL ที่ช่องวิทยุ (พิกัดท้องถิ่นของเสา)
const _antP = PARTS.find((p) => p.id === 'antenna');
const _radP = PARTS.find((p) => p.id === 'radio');
const PLUG_WORLD = [0, 1, 2].map((i) => _radP.assembled.pos[i] + IPEX_L[i] + (i === 2 ? 0.9 : 0));
const PLUG_L = PLUG_WORLD.map((v, i) => v - _antP.assembled.pos[i]);
_antP.pins = { 'antenna.feed': [...PLUG_L] };

function prefixPins(id, pins) {
  const out = {};
  for (const [k, v] of Object.entries(pins)) out[k.includes('.') ? k : `${id}.${k}`] = [...v];
  return out;
}

// ---------------------------------------------------------------- ตัวช่วยสร้างรูปทรง (รวม geometry ที่วัสดุเดียวกันเป็น mesh เดียว)
const S = (name, color, o = {}) => ({ name, color, o });

const MAT_DEFAULT = {
  shell: { rough: 0.6, metal: 0.05 },
  pcb: { rough: 0.5, metal: 0.15 },
  chip: { rough: 0.45, metal: 0.3 },
  metal: { rough: 0.3, metal: 0.85 },
  rubber: { rough: 0.85, metal: 0 },
  screen: { rough: 0.2, metal: 0.1 },
  led: { rough: 0.4, metal: 0 },
  window: { rough: 0.15, metal: 0, opacity: 0.45 },
  'wire-red': { rough: 0.7, metal: 0 },
  'wire-black': { rough: 0.7, metal: 0 },
  wire: { rough: 0.7, metal: 0 },
  'plastic-dark': { rough: 0.6, metal: 0.05 },
};

function mergeGeos(T, geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o);
    nor.set(g.attributes.normal.array, o);
    o += g.attributes.position.count * 3;
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  return out;
}

/** จุดมุมโค้งของสี่เหลี่ยมมน (w x h, รัศมี r) */
function rrectPts(T, w, h, r, seg = 5) {
  const pts = [];
  const cs = [[w / 2 - r, h / 2 - r, 0], [-(w / 2 - r), h / 2 - r, 90], [-(w / 2 - r), -(h / 2 - r), 180], [w / 2 - r, -(h / 2 - r), 270]];
  for (const [cx, cy, a0] of cs) {
    for (let i = 0; i <= seg; i++) {
      const a = (a0 + 90 * i / seg) * PI / 180;
      pts.push(new T.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  }
  return pts;
}

function kit(T, id) {
  const matCache = new Map();
  const buckets = new Map();                                                // material -> { spec, geos }

  const mat = (spec) => {
    const o = { ...(MAT_DEFAULT[spec.name] || {}), ...spec.o };
    const key = [spec.name, spec.color, o.rough, o.metal, o.emissive, o.emissiveIntensity, o.opacity, o.accent ? 1 : 0].join('|');
    let m = matCache.get(key);
    if (!m) {
      const op = o.opacity ?? 1;
      m = new T.MeshStandardMaterial({
        color: spec.color,
        roughness: o.rough ?? 0.55,
        metalness: o.metal ?? 0.1,
        emissive: o.emissive ?? 0x000000,
        emissiveIntensity: o.emissiveIntensity ?? 1,
        transparent: op < 1,
        opacity: op,
        depthWrite: op >= 1,
      });
      m.userData.baseOpacity = op;
      m.userData.mat = spec.name;
      m.userData.accent = !!o.accent;
      matCache.set(key, m);
    }
    return m;
  };

  const add = (geo, spec) => {
    const m = mat(spec);
    if (!buckets.has(m)) buckets.set(m, { spec, geos: [] });
    buckets.get(m).geos.push(geo);
  };

  const box = (w, h, d, x, y, z, spec) => add(new T.BoxGeometry(w, h, d).translate(x, y, z), spec);

  // วางรูปที่สร้างตามแกน +Z (ช่วง 0..len) ให้ไปอยู่ตามแกน axis ที่ช่วง a0.. ศูนย์กลางที่ (p,q)
  const orient = (geo, axis, a0, p, q) => {
    if (axis === 'z') geo.translate(p, q, a0);
    else if (axis === 'x') { geo.rotateY(PI / 2); geo.translate(a0, p, q); }
    else { geo.rotateX(-PI / 2); geo.translate(p, a0, q); }
    return geo;
  };

  // ทรงกระบอก/กรวยตัด ตามแกน 'x'|'y'|'z' ช่วง a0..a1 ; r = ตัวเลข หรือ [rที่a1, rที่a0] ; (p,q) = พิกัดอีกสองแกนตามลำดับ x,y,z
  const cyl = (axis, r, a0, a1, p, q, spec, seg = 16) => {
    const [rTop, rBot] = Array.isArray(r) ? r : [r, r];
    const geo = new T.CylinderGeometry(rTop, rBot, a1 - a0, seg);
    const mid = (a0 + a1) / 2;
    if (axis === 'x') { geo.rotateZ(-PI / 2); geo.translate(mid, p, q); }
    else if (axis === 'z') { geo.rotateX(PI / 2); geo.translate(p, q, mid); }
    else geo.translate(p, mid, q);
    add(geo, spec);
  };

  // แผ่นกลม/วงแหวนที่เจาะรูได้
  const disc = (axis, rOut, rIn, a0, a1, p, q, spec, holes = [], seg = 32) => {
    const s = new T.Shape();
    s.absarc(0, 0, rOut, 0, PI * 2, false);
    if (rIn) { const h = new T.Path(); h.absarc(0, 0, rIn, 0, PI * 2, true); s.holes.push(h); }
    for (const [x, y, r] of holes) { const h = new T.Path(); h.absarc(x, y, r, 0, PI * 2, true); s.holes.push(h); }
    const geo = new T.ExtrudeGeometry(s, { depth: a1 - a0, bevelEnabled: false, curveSegments: seg });
    add(orient(geo, axis, a0, p, q), spec);
  };

  // โดม : ฐานกลม r ที่ตำแหน่ง base ตามแกน สูง h ชี้ไปทาง dir (+1/-1)
  const dome = (axis, r, h, base, dir, p, q, spec, seg = 24) => {
    const geo = new T.SphereGeometry(r, seg, 8, 0, PI * 2, 0, PI / 2);
    geo.scale(1, h / r, 1);
    if (axis === 'z') geo.rotateX(dir > 0 ? PI / 2 : -PI / 2);
    else if (axis === 'x') geo.rotateZ(dir > 0 ? -PI / 2 : PI / 2);
    else if (dir < 0) geo.rotateX(PI);
    if (axis === 'z') geo.translate(p, q, base);
    else if (axis === 'x') geo.translate(base, p, q);
    else geo.translate(p, base, q);
    add(geo, spec);
  };

  const tube = (pts, radius, spec, tubular = 24, radial = 5) => {
    const curve = new T.CatmullRomCurve3(pts.map((v) => new T.Vector3(...v)), false, 'centripetal');
    add(new T.TubeGeometry(curve, tubular, radius, radial, false), spec);
  };

  // แผ่นสี่เหลี่ยมเจาะรูกลม ในระนาบ XY หนา t ศูนย์กลาง z=0
  const panel = (w, h, t, holes, seg = 10) => {
    const s = new T.Shape();
    s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
    for (const [x, y, r] of holes) { const hp = new T.Path(); hp.absarc(x, y, r, 0, PI * 2, true); s.holes.push(hp); }
    const geo = new T.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg });
    geo.translate(0, 0, -t / 2);
    return geo;
  };

  const finish = (g) => {
    for (const [m, b] of buckets) {
      const mesh = new T.Mesh(mergeGeos(T, b.geos), m);
      mesh.name = `${id}:${b.spec.name}`;
      mesh.userData.mat = b.spec.name;
      if (b.spec.o.accent) mesh.userData.accent = true;
      g.add(mesh);
    }
    buckets.clear();
  };

  return { mat, add, box, cyl, disc, dome, tube, panel, orient, finish };
}

// ---------------------------------------------------------------- ตัวสร้างแต่ละชิ้น (origin = กลางชิ้น ทิศถูกแล้ว)
const BUILDERS = {
  // ตัวกล่อง : พลาสติกเทาด้าน มุมโค้ง หูยึดผนัง 4 มุม ร่องยางรอบขอบ (parts.md : Leetech 6x6 นิ้ว ~150x150x80 ยังไม่ได้วัด)
  // origin กลางตัวกล่อง : ท้องถิ่น z -40 (นอกหลัง) .. +40 (ขอบหน้า) ; z โลก = z ท้องถิ่น - 5
  'box-body'(T, g, k) {
    const shell = S('shell', C.body, { rough: 0.75 });
    const seal = S('rubber', C.gasket);
    const dark = S('chip', 0x0c0c0c, { rough: 0.9, metal: 0 });
    const clear = S('window', C.window);
    const outer = rrectPts(T, 150, 150, 8, 6);
    const ring = new T.Shape(outer);
    ring.holes.push(new T.Path(rrectPts(T, 142, 142, 4, 6)));
    k.add(new T.ExtrudeGeometry(ring, { depth: 76, bevelEnabled: false }).translate(0, 0, -36), shell);       // ผนัง 4 ด้าน z -36..40
    k.add(new T.ExtrudeGeometry(new T.Shape(outer), { depth: 4, bevelEnabled: false }).translate(0, 0, -40), shell); // แผ่นหลัง
    // เสาน็อตมุมด้านใน (รับสกรูฝา)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      k.cyl('z', 4.5, -36, 40, sx * 66.5, sy * 66.5, shell, 20);
      k.cyl('z', 1.3, 39.9, 40.02, sx * 66.5, sy * 66.5, dark, 12);
    }
    // หูยึดผนัง 4 มุม (แผ่นหนา 4 มีรู Ø5.2 ยื่นออกด้านข้างที่หลังกล่อง)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      k.add(k.panel(18, 14, 4, [[0, 0, 2.6]]).translate(sx * 81, sy * 55, -38), shell);
    }
    // ร่องยางกันน้ำ : ยางกลมรอบขอบกลางผนัง
    const gk = new T.Shape(rrectPts(T, 147.6, 147.6, 7.5, 6));
    gk.holes.push(new T.Path(rrectPts(T, 144.4, 144.4, 5.5, 6)));
    k.add(new T.ExtrudeGeometry(gk, { depth: 1.6, bevelEnabled: false }).translate(0, 0, 39.4), seal);
    // รูซีลสายที่ผนังล่าง (แผ่นมืดบนผิวนอก/ใน : มองเห็นตอนซีลแยกออก)
    for (const gx of [LAYOUT.glandPower[0], LAYOUT.glandWater[0]]) {
      const r = gx === LAYOUT.glandPower[0] ? 7.5 : 5;
      k.cyl('y', r, -75.04, -75, gx, LAYOUT.glandPower[2] + 5, dark, 24);
      k.cyl('y', r, -71, -70.96, gx, LAYOUT.glandPower[2] + 5, dark, 24);
    }
    // ผนังขวา : รูเสียงลำโพง 19 รู (ลายหกเหลี่ยม) + รูอุดใสของไฟดวงที่ 9
    const sc = [LAYOUT.speaker[1], LAYOUT.speaker[2] + 5];
    const pts = [[0, 0]];
    for (let i = 0; i < 6; i++) pts.push([5.2 * Math.cos(i * PI / 3), 5.2 * Math.sin(i * PI / 3)]);
    for (let i = 0; i < 12; i++) pts.push([10.4 * Math.cos(i * PI / 6 + PI / 12), 10.4 * Math.sin(i * PI / 6 + PI / 12)]);
    for (const [a, b] of pts) k.cyl('x', 1.3, 75, 75.04, sc[0] + a, sc[1] + b, dark, 10);
    k.cyl('x', 2.9, 70.6, 75.1, LAYOUT.led9[1], LAYOUT.led9[2] + 5, clear, 16);
    k.finish(g);
  },

  // ฝากล่อง : แผ่นหนา 5 + ขอบสูง 5 ; รูปุ่ม 2 รู + รูเล็ก 8 รูรอบปุ่มแดง (อุดใส) + สกรู 4 มุม
  // origin ท้องถิ่น z 0 = ผิวใต้แผ่นฝา (โลก z=40) ; แผ่น z 0..5 ; ขอบ z -5..0
  'box-lid'(T, g, k) {
    const lid = S('shell', C.lid, { rough: 0.55 });
    const clear = S('window', C.window);
    const screw = S('metal', C.silver);
    const slot = S('chip', 0x222222);
    const hole = [];
    hole.push([LAYOUT.red[0], LAYOUT.red[1], 22.5], [LAYOUT.green[0], LAYOUT.green[1], 16.5]);
    for (let n = 0; n < 8; n++) hole.push([LED_CENTERS[n][0] + LEDS_ORIGIN[0], LED_CENTERS[n][1] + LEDS_ORIGIN[1], 2.9]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) hole.push([sx * 66.5, sy * 66.5, 2.1]);
    const shape = new T.Shape(rrectPts(T, 150, 150, 8, 6));
    for (const [x, y, r] of hole) { const h = new T.Path(); h.absarc(x, y, r, 0, PI * 2, true); shape.holes.push(h); }
    k.add(new T.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false, curveSegments: 12 }), lid);
    const skirt = new T.Shape(rrectPts(T, 150, 150, 8, 6));
    skirt.holes.push(new T.Path(rrectPts(T, 142, 142, 4, 6)));
    k.add(new T.ExtrudeGeometry(skirt, { depth: 5, bevelEnabled: false }).translate(0, 0, -5), lid);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      k.cyl('z', 4.5, -5, 0, sx * 66.5, sy * 66.5, lid, 16);                      // บอสรับสกรู
      k.cyl('z', 3.4, 5, 6.5, sx * 66.5, sy * 66.5, screw, 20);                   // หัวสกรู
      k.box(5.2, 0.8, 0.3, sx * 66.5, sy * 66.5, 6.6, slot);
      k.box(0.8, 5.2, 0.3, sx * 66.5, sy * 66.5, 6.6, slot);
    }
    for (let n = 0; n < 8; n++) k.cyl('z', 2.9, 0.4, 4.6, LED_CENTERS[n][0] + LEDS_ORIGIN[0], LED_CENTERS[n][1] + LEDS_ORIGIN[1], clear, 16);   // รูอุดใส
    k.finish(g);
  },

  // ปุ่มแดงโดม Ø60 : โดมแดงบนขอบดำ ตัวเรือนเกลียว + น็อตใหญ่ + ไมโครสวิตช์ 3 ขาด้านล่าง ลึกใต้แผ่นฝา ~50
  // origin = ระนาบผิวบนของฝา (โลก z=45) ; โดมขึ้นไป +z ; ตัวเรือนลงไป -z
  'btn-sos'(T, g, k) {
    const dome = S('shell', C.btnSos, { rough: 0.25, accent: true });
    const bez = S('plastic-dark', C.bezel);
    const dark = S('plastic-dark', C.thread);
    const nut = S('plastic-dark', C.nut);
    const sw = S('shell', C.sw);
    const lug = S('metal', C.silver);
    k.disc('z', 30, 26, 0, 4, 0, 0, bez, [], 40);
    k.dome('z', 26, 14, 4, 1, 0, 0, dome, 40);
    k.cyl('z', 22, -40, 0, 0, 0, dark, 36);
    for (let z = -8; z >= -38; z -= 2.4) k.cyl('z', 22.8, z - 0.3, z + 0.3, 0, 0, dark, 36);
    k.cyl('z', 30, -12, -5, 0, 0, nut, 6);                                         // น็อตหกเหลี่ยม ข้ามแฉก 52
    k.box(20, 6.4, 10, 0, 0, -45, sw);                                             // ไมโครสวิตช์
    k.box(14, 0.5, 6, 0, 3.5, -44, lug);                                           // ก้านกด
    for (const x of [-8, 0, 8]) k.box(0.5, 4.8, 6, x, 0, -52, lug);               // ขา COM NC NO
    k.finish(g);
  },

  // ปุ่ม 46 มม. สีเขียว : ขอบพลาสติก ฝาปุ่มเขียวโค้งเตี้ย ตัวเรือนเกลียว น็อต ไมโครสวิตช์ ลึกใต้แผ่นฝา ~39
  'btn-ack'(T, g, k) {
    const cap = S('shell', C.btnAck, { rough: 0.3, accent: true });
    const bez = S('plastic-dark', C.bezel);
    const dark = S('plastic-dark', C.thread);
    const nut = S('plastic-dark', C.nut);
    const sw = S('shell', C.sw);
    const lug = S('metal', C.silver);
    k.disc('z', 23, 20, 0, 3, 0, 0, bez, [], 36);
    k.dome('z', 20, 8, 3, 1, 0, 0, cap, 36);
    k.cyl('z', 16, -30, 0, 0, 0, dark, 28);
    for (let z = -8; z >= -28; z -= 2.4) k.cyl('z', 16.8, z - 0.3, z + 0.3, 0, 0, dark, 28);
    k.cyl('z', 23, -11, -5, 0, 0, nut, 6);
    k.box(20, 6.4, 10, 0, 0, -35, sw);
    k.box(14, 0.5, 6, 0, 3.5, -34, lug);
    for (const x of [-8, 0, 8]) k.box(0.5, 4.8, 6, x, 0, -42, lug);
    k.finish(g);
  },

  // ไฟ 9 ดวง : ชิ้น WS2812B (เส้นสีขาว กว้าง 10 ยาว 16 มี LED 5050 หนึ่งดวง + แผ่นทองแดง 3 จุดสองปลาย) ตัดทีละดวง
  // 8 ดวงวางเป็นวงรอบปุ่มแดงใต้ฝา ต่อกันด้วยสายสั้น 3 เส้น + ดวง 9 ติดผนังขวา หันออก ; ผิวหน้า LED = z 0 ของชิ้น
  leds(T, g, k) {
    const strip = S('shell', C.ledStrip);
    const body = S('shell', 0xe6e4dc);
    const pad = S('metal', C.copper);
    const ring = new T.Group(); ring.name = 'leds-ring';
    const side = new T.Group(); side.name = 'led9';
    const kSide = kit(T, 'led9');
    const meshes = [];
    const mats = [];
    const OFF = 0xd9d6b8;
    const addPiece = (kk, M) => {
      const A = (geo, spec) => kk.add(geo.applyMatrix4(M), spec);
      A(new T.BoxGeometry(16, 10, 0.8).translate(0, 0, -2.0), strip);
      A(new T.BoxGeometry(5, 5, 1.6).translate(0, 0, -0.8), body);
      for (const sx of [-6.4, 6.4]) for (const y of [3, 0, -3]) A(new T.BoxGeometry(1.6, 2.2, 0.12).translate(sx, y, -1.54), pad);
    };
    for (let n = 0; n < 9; n++) {
      const M = ledMatrix(T, n);
      addPiece(n < 8 ? k : kSide, M);
      const m = new T.MeshStandardMaterial({ color: OFF, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.4, metalness: 0 });
      m.userData.mat = 'led'; m.userData.baseOpacity = 1; m.userData.accent = true;
      const em = new T.Mesh(new T.CircleGeometry(1.9, 20).translate(0, 0, 0.03).applyMatrix4(M), m);
      em.name = `leds:led${n + 1}`; em.userData.mat = 'led'; em.userData.accent = true; em.userData.ledIndex = n;
      (n < 8 ? ring : side).add(em);
      meshes.push(em); mats.push(m);
    }
    // สายสั้น 3 เส้นระหว่างดวง 1->2 ... 7->8 (+5V แดงอิฐ, ข้อมูลน้ำเงิน, GND ดำ) ผิวแบนใต้แผ่นฝา โค้งออกด้านข้างเล็กน้อย
    const kinds = [['+5V', 'power', 'wire-red'], ['DATA', 'data', 'wire'], ['GND', 'ground', 'wire-black']];
    for (let n = 0; n < 7; n++) {
      for (const [lbl, type, mn] of kinds) {
        const a = LED_PINS[`leds${n + 1}.${lbl === 'DATA' ? 'DOUT' : lbl}`];
        const outPad = (() => { const M = ledMatrix(T, n); const v = new T.Vector3(6.4, PAD_Y[lbl], -1.5).applyMatrix4(M); return [v.x, v.y, v.z]; })();
        const b = LED_PINS[`leds${n + 2}.${lbl === 'DATA' ? 'DIN' : lbl}`];
        const mid = [(outPad[0] + b[0]) / 2, (outPad[1] + b[1]) / 2, -1.2];
        const dx = mid[0], dy = mid[1], l = Math.hypot(dx, dy) || 1;
        mid[0] += dx / l * 2.2; mid[1] += dy / l * 2.2;                              // โค้งออกนอกวงเล็กน้อย
        void a;
        k.tube([[outPad[0], outPad[1], -1.3], mid, [b[0], b[1], -1.3]], 0.35, S(mn, WIRE_COLORS[type], { rough: 0.7, metal: 0 }), 10, 4);
      }
    }
    k.finish(ring);
    kSide.finish(side);
    g.add(ring); g.add(side);
    const ledApi = {
      count: 9, meshes, materials: mats, positions: LED_CENTERS.map((p) => [...p]),
      setColor(i, hex, intensity = 1) { const m = mats[i]; m.color.set(hex); m.emissive.set(hex); m.emissiveIntensity = intensity; },
      setAll(hex, intensity = 1) { for (let i = 0; i < 9; i++) this.setColor(i, hex, intensity); },
      setState(i, name, intensity = 1) { if (name === 'off') this.setColor(i, OFF, 0), mats[i].emissive.set(0x000000); else this.setColor(i, LED_COLORS[name], intensity); },
      reset() { for (const m of mats) { m.color.set(OFF); m.emissive.set(0x000000); m.emissiveIntensity = 0; } },
    };
    g.userData.leds = ledApi;
    g.userData.ledMat = mats[0];
    g.userData.ring = ring;
    g.userData.led9 = side;
  },

  // แผ่นไข่ปลา 70x90x1.6 : แผ่นเขียว รูถี่ 2.54 ด้านบน (จุดมืด) ด้านล่างจุดบัดกรีเงิน รูยึด 4 มุม + เสารอง + ราง 4 เส้น
  // origin = กลางแผ่น ผิวบน z=+0.8
  pcb(T, g, k) {
    const pcb = S('pcb', C.pcb, { rough: 0.5 });
    const dark = S('chip', 0x10231a, { rough: 0.9, metal: 0 });
    const silver = S('metal', C.silver, { rough: 0.35 });
    const post = S('shell', 0xf0eee6);
    const mh = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) mh.push([sx * 32, sy * 42, 1.6]);
    k.add(k.panel(70, 90, 1.6, mh), pcb);
    for (let i = -13; i <= 13; i++) {
      for (let j = -17; j <= 17; j++) {
        k.add(new T.CircleGeometry(0.55, 4, PI / 4).translate(i * G, j * G, 0.82), dark);
        k.add(new T.CircleGeometry(0.95, 4, PI / 4).rotateX(PI).translate(i * G, j * G, -0.82), silver);
      }
    }
    for (const [x, y] of mh) {
      k.cyl('z', 3, -4.8, -0.8, x, y, post, 12);                                  // เสารองสูง 4
      k.cyl('z', 2.4, 0.8, 1.8, x, y, silver, 12);                                // หัวสกรู
    }
    // ราง (ลวดเปลือย Ø1.1) : VSW VSYS 3V3 GND
    for (const [name, ix] of Object.entries(RAIL_IX)) {
      void name;
      k.cyl('y', 0.55, RAIL_J[0] * G, RAIL_J[1] * G, ix * G, RAIL_Z, silver, 8);
      for (const j of [RAIL_J[0], RAIL_J[1]]) k.cyl('z', 0.95, PCB_TOP, RAIL_Z, ix * G, j * G, silver, 8);
      k.cyl('z', 0.9, PCB_TOP, RAIL_Z, ix * G, (RAIL_J[0] + RAIL_J[1]) / 2 * G, silver, 8);
    }
    k.finish(g);
  },

  // ESP32-C3 Super Mini : แผ่นจิ๋ว พอร์ต USB-C ปลายบน ชิปสี่เหลี่ยม ปุ่ม BOOT/RST เล็ก 2 ปุ่ม เสาเซรามิก ขา 8+8 (ไม่รวมขา 22.5x18)
  mcu(T, g, k) {
    const pcb = S('pcb', C.mcu, { rough: 0.5 });
    const chip = S('chip', 0x111111);
    const metal = S('metal', 0xc8cbce);
    const hdr = S('plastic-dark', 0x222222);
    const tan = S('shell', C.tan);
    const gold = S('metal', C.gold);
    k.box(22.5, 18, 1.2, 0, 0, 0, pcb);
    for (const sx of [-7.62, 7.62]) k.box(G, 20.32, 2.5, sx, 0, -0.6 - 1.25, hdr);            // แถบขาเสียบใต้บอร์ด
    for (const p of Object.values(MCU_PINS)) k.cyl('z', 0.9, 0.6, 1.2, p[0], p[1], gold, 8);   // จุดบัดกรีบนบอร์ด
    k.box(8.94, 7.3, 3.26, 0, 8.2, 0.6 + 1.63, metal);                                        // ช่อง USB-C
    k.box(7.4, 0.12, 2.0, 0, 8.2 + 3.65 + 0.04, 0.6 + 1.63, chip);                            // ปากพอร์ตมืด
    k.box(5, 5, 0.8, 0, -2.5, 1.0, chip);                                                     // ชิป ESP32-C3
    for (const sx of [-2.4, 2.4]) { k.box(3.4, 2.6, 1.4, sx, 1.5, 1.3, metal); k.cyl('z', 0.9, 1.9, 2.4, sx, 1.5, hdr, 10); }
    k.box(5.5, 2, 0.9, -3, -9.2, 1.05, tan);                                                  // เสาเซรามิก
    k.box(1.6, 0.8, 0.5, 4.8, -4.5, 0.85, S('led', 0x2a6fd6));                                // LED บนบอร์ด (GPIO8)
    const smd = [[-5, 3, 0], [5, 3.5, 0], [-4.5, -6, 0], [4.5, -7, 0], [2, 5.5, 0], [-2, -7.5, 0]];
    for (const [x, y] of smd) k.box(1.6, 0.8, 0.5, x, y, 0.85, S('shell', 0xcdbf9a));
    k.finish(g);
  },

  // Wio-SX1262 (Seeed) 11.6 x 11 x 2.95 บนแผ่นแปลงขา : โมดูลสี่เหลี่ยมเล็ก ฝาโลหะ ขาติดผิว ช่อง IPEX (U.FL) ที่มุม
  radio(T, g, k) {
    const ad = S('pcb', C.radioAd, { rough: 0.5 });
    const mod = S('chip', C.radioMod);
    const sh = S('metal', 0xc3c7cb, { rough: 0.32 });
    const pad = S('metal', C.gold);
    const hdr = S('plastic-dark', 0x202020);
    k.box(16, 14.5, 1.0, 0, 0, 0, ad);
    for (const sx of [-6.35, 6.35]) k.box(G, 15.24, 2.5, sx, 0, -0.5 - 1.25, hdr);
    for (const p of Object.values(RADIO_PINS)) if (p !== IPEX_L) k.cyl('z', 0.8, 0.5, 1.2, p[0], p[1], pad, 8);
    k.box(11.6, 11, 0.8, 0, 0, 0.9, mod);
    for (const sx of [-5.45, 5.45]) for (let i = 0; i < 6; i++) k.box(0.6, 1.0, 0.1, sx, (2.5 - i) * 1.8, 1.35, pad);
    k.box(7.2, 7.4, 2.15, -1.8, -0.8, 1.3 + 1.075, sh);                                       // ฝาโลหะ ยอด z = 3.45 (0.5 + 2.95)
    k.box(3, 3, 1.25, IPEX_L[0], IPEX_L[1], 1.3 + 0.625, sh);                                 // ช่อง U.FL
    k.cyl('z', 0.85, IPEX_L[2] - 0.02, IPEX_L[2] + 0.01, IPEX_L[0], IPEX_L[1], S('chip', 0x222222), 10);
    k.finish(g);
  },

  // เสาอากาศ : ท่อยางดำยาว 81 หัวโลหะ + สายสั้นปลายหัว U.FL (origin = กลางท่อ ; ปลายฐานที่ x=-40.5)
  antenna(T, g, k) {
    const rub = S('rubber', C.antenna, { rough: 0.7, accent: true });
    const metal = S('metal', C.silver);
    const cable = S('wire-black', 0x151515, { rough: 0.7, metal: 0 });
    k.cyl('x', 2, -37, 40.5, 0, 0, rub, 14);
    k.dome('x', 2, 2, 40.5, 1, 0, 0, rub, 14);
    k.cyl('x', 2.6, -40.5, -37, 0, 0, metal, 12);
    k.cyl('x', 3, -37, -35, 0, 0, metal, 6);
    const P = PLUG_L;
    k.tube([[-40.5, 0, 0], [-46, -4, 1], [-44, -16, 3], [-30, -24, 5], [-14, -27, 5], [P[0] - 2, P[1] + 1, P[2] + 2], [...P]], 0.6, cable, 40, 5);
    k.box(2.6, 2.6, 1.6, P[0], P[1], P[2] - 0.0, metal);                                      // ปลั๊ก U.FL
    k.finish(g);
  },

  // ตัวต้านทาน 12 ตัว R2, R3-R13 (ตัวครีมคาด 5 แถบ) + ตัวเก็บประจุ 7 ตัว (เซรามิก 4 + อิเล็กโทรไลต์ 3) ตามรูบนแผ่นไข่ปลา ; origin = origin ของ pcb
  passives(T, g, k) {
    const body = S('shell', C.resistor);
    const lead = S('metal', C.silver, { rough: 0.35 });
    const cer = S('shell', C.cer);
    const sleeve = S('plastic-dark', C.electro);
    const strip = S('metal', 0xdddddd);
    const BAND = { 0: 0x111111, 1: 0x6b3a1e, 2: 0xd32f2f, 3: 0xf57c00, 4: 0xfdd835 };
    const CODE = { '1M': [1, 0, 0, 4], '10k': [1, 0, 0, 2], '100k': [1, 0, 0, 3], '1k': [1, 0, 0, 1], '330': [3, 3, 0, 0], '2.2k': [2, 2, 0, 1] };
    const h = PCB_TOP + 1.7;
    for (const [id, a, b, j, val] of RES) {
      const [xa] = gp(a, j), [xb, y] = gp(b, j);
      const cx = (xa + xb) / 2;
      k.cyl('x', 1.15, cx - 3.15, cx + 3.15, y, h, body, 10);
      k.cyl('x', 0.3, xa, xb, y, h, lead, 6);
      for (const x of [xa, xb]) { k.cyl('z', 0.3, PCB_TOP, h, x, y, lead, 6); k.cyl('z', 0.9, PCB_TOP, PCB_TOP + 0.5, x, y, lead, 8); }
      const bands = CODE[val];
      const xs = [-2.4, -1.6, -0.8, 0, 2.1];
      [...bands, 1].forEach((d, n) => k.cyl('x', 1.2, cx + xs[n] - 0.25, cx + xs[n] + 0.25, y, h, S('plastic-dark', BAND[d], { rough: 0.6, metal: 0 }), 10));
      void id;
    }
    for (const [id, kind, a, b, j, r, hh] of CAP) {
      const [xa, y] = gp(a, j), [xb] = gp(b, j);
      const cx = (xa + xb) / 2;
      for (const x of [xa, xb]) k.cyl('z', 0.9, PCB_TOP, PCB_TOP + 0.5, x, y, lead, 8);
      if (kind === 'disc') {
        const zc = PCB_TOP + 5;
        k.cyl('y', 2.5, y - 1.3, y + 1.3, cx, zc, cer, 16);                                   // เซรามิกจาน Ø5 หนา 2.6
        for (const x of [xa, xb]) k.cyl('z', 0.3, PCB_TOP, zc, x, y, lead, 6);
      } else {
        const z0 = PCB_TOP + 0.6;
        k.cyl('z', r, z0, z0 + hh, cx, y, sleeve, 20);                                        // อิเล็กโทรไลต์
        k.cyl('z', r + 0.05, z0 + hh - 0.2, z0 + hh, cx, y, strip, 20);                       // ฝาบนโลหะ
        k.box(0.4, 1.2, hh * 0.8, cx + (xb >= xa ? -r : r), y, z0 + hh / 2, strip);           // แถบขั้วลบ
        for (const x of [xa, xb]) k.cyl('z', 0.3, PCB_TOP, z0, x, y, lead, 6);
        void id;
      }
    }
    k.finish(g);
  },

  // S8050 ตัวถัง TO-92 : ตัวดำครึ่งวงกลม 3 ขา (4.5 x 3.5 x 4.5) ด้านเรียบหันหา -Y
  'q-drive'(T, g, k) {
    const bl = S('chip', 0x141414, { rough: 0.5 });
    const lead = S('metal', C.silver);
    k.box(4.5, 1.25, 4.5, 0, -1.125, 0, bl);
    const geo = new T.CylinderGeometry(2.25, 2.25, 4.5, 14, 1, false, PI / 2, PI).rotateX(PI / 2).translate(0, -0.5, 0);
    k.add(geo, bl);
    for (const x of [-G, 0, G]) {
      const x0 = x / 2;
      k.tube([[x0, 0, -2.25], [x0, 0, -3.3], [x, 0, -4.6], [x, 0, -5.25]], 0.25, lead, 8, 4);
    }
    k.finish(g);
  },

  // AO3401A (SOT-23) บนแผ่นแปลงขา : ตัวดำเล็ก 3 ขา บนแผ่นเหลืองสองแถวขา
  'q-power'(T, g, k) {
    const ad = S('pcb', C.qAd);
    const bl = S('chip', 0x111111);
    const lead = S('metal', C.silver);
    const hdr = S('plastic-dark', 0x202020);
    k.box(10.2, 8, 1.0, 0, 0, 0, ad);
    for (const sx of [-3.81, 3.81]) { k.box(G, 7.62, 2.5, sx, 0, -0.5 - 1.25, hdr); for (const sy of [-G, 0, G]) k.cyl('z', 0.7, 0.5, 1.1, sx, sy, lead, 8); }
    k.box(2.9, 1.3, 1.0, 0, 0, 1.0, bl);
    for (const sy of [-0.95, 0.95]) k.box(0.4, 0.5, 0.2, 1.6 * Math.sign(sy), sy, 0.6, lead);
    k.box(0.4, 0.5, 0.2, -1.6, 0, 0.6, lead);
    k.finish(g);
  },

  // ไดโอด Schottky 1N5819 x2 (DO-41) : ตัวดำทรงกระบอก คาดแถบเทาด้านแคโทด ; origin = origin ของ pcb
  diodes(T, g, k) {
    const bl = S('chip', 0x151515, { rough: 0.5 });
    const band = S('metal', 0xb9bdc2);
    const lead = S('metal', C.silver);
    const h = PCB_TOP + 1.9;
    for (const [id, a, b, j] of DIO) {
      const [xa, y] = gp(a, j), [xb] = gp(b, j);
      const cx = (xa + xb) / 2;
      k.cyl('x', 1.35, cx - 2.6, cx + 2.6, y, h, bl, 12);
      k.cyl('x', 1.4, cx + 1.3, cx + 2.1, y, h, band, 12);
      k.cyl('x', 0.4, xa, xb, y, h, lead, 6);
      for (const x of [xa, xb]) { k.cyl('z', 0.4, PCB_TOP, h, x, y, lead, 6); k.cyl('z', 0.9, PCB_TOP, PCB_TOP + 0.5, x, y, lead, 8); }
      void id;
    }
    k.finish(g);
  },

  // PAM8403 : แผ่นจิ๋ว ชิป 16 ขา ขั้วต่อเสียง 2 ช่อง (บล็อกสีน้ำเงิน) ขาเข้า 4 ขา ; origin = กลางบอร์ด
  amp(T, g, k) {
    const pcb = S('pcb', C.amp);
    const chip = S('chip', 0x121212);
    const lead = S('metal', C.silver);
    const blk = S('shell', 0x2457b3);
    const hdr = S('plastic-dark', 0x202020);
    const dark = S('chip', 0x080808);
    k.box(22, 19, 1.2, 0, 0, 0, pcb);
    k.box(9.9, 3.9, 1.5, 0, -3.2, 1.35, chip);
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) k.box(0.45, 1.0, 0.2, (i - 3.5) * 1.27, -3.2 + s * 2.4, 0.75, lead);
    k.box(10.2, 2.54, 2.5, 0, -8, -0.6 - 1.25, hdr);
    for (const p of [-3.81, -1.27, 1.27, 3.81]) k.cyl('z', 0.8, 0.6, 1.2, p, -8, lead, 8);
    for (const sx of [-5.4, 5.4]) {
      k.box(10.2, 7.6, 8.2, sx, 5.2, 0.6 + 4.1, blk);
      for (const dx of [-2.5, 2.5]) {
        k.cyl('z', 1.8, 8.7, 8.84, sx + dx, 5.2, dark, 12);
        k.box(2.4, 0.12, 2.4, sx + dx, 5.2 + 3.8 + 0.04, 3.1, dark);
      }
    }
    for (const [x, y] of [[-8, -4], [8, -4], [-8, -7], [8, -7]]) k.box(1.6, 0.8, 0.5, x, y, 0.85, S('shell', 0xcdbf9a));
    k.finish(g);
  },

  // ลำโพง 3W Ø40 x 15 : ขอบโลหะ ซี่โครงโครง แม่เหล็กด้านหลัง ; origin = ผิวติดผนัง ตัวยื่นไป -z (ในโลกหมุนให้ชี้เข้ากล่อง)
  speaker(T, g, k) {
    const metal = S('metal', C.speaker, { rough: 0.35 });
    const rub = S('rubber', 0x1c1c1c);
    const cone = S('chip', 0x2b2b2b, { rough: 0.8, metal: 0 });
    const mag = S('chip', 0x3a3a3a, { rough: 0.5, metal: 0.4 });
    const lug = S('metal', C.silver);
    k.disc('z', 20, 17, -2, 0, 0, 0, metal, [], 40);
    k.disc('z', 17, 14.5, -3, -1.5, 0, 0, rub, [], 36);
    k.cyl('z', [14.5, 5.5], -9, -1.5, 0, 0, cone, 30);
    k.cyl('z', 11, -12.5, -10, 0, 0, metal, 24);
    k.cyl('z', 9, -15, -12.5, 0, 0, mag, 24);
    for (let i = 0; i < 6; i++) {
      const a = i * PI / 3 + PI / 6;
      k.tube([[11 * Math.cos(a), 11 * Math.sin(a), -10], [19 * Math.cos(a), 19 * Math.sin(a), -2.5]], 0.9, metal, 2, 5);
    }
    for (const x of [-3, 3]) { k.box(1.8, 3, 0.4, x, 20.5, -1.6, lug); k.cyl('z', 0.8, -1.8, -1.4, x, 21.5, lug, 8); }
    k.finish(g);
  },

  // รางถ่าน AA 3 ก้อน : รางดำ ฝาเลื่อน สวิตช์เปิด-ปิด สายแดง-ดำ ; origin = กลางราง ฐานที่ z=-8.5 ; ฝา (cover) กับถ่าน (cells) เป็นกลุ่มย่อย
  battery(T, g, k) {
    const hold = S('plastic-dark', C.holder);
    const metal = S('metal', C.silver);
    const knob = S('shell', 0xe8e6df);
    const wr = S('wire-red', WIRE_COLORS.power, { rough: 0.7, metal: 0 });
    const wb = S('wire-black', WIRE_COLORS.ground, { rough: 0.7, metal: 0 });
    k.box(62, 48, 1.5, 0, 0, -7.75, hold);
    for (const sy of [-23.4, 23.4]) k.box(62, 1.2, 10, 0, sy, -2, hold);
    for (const sy of [-7.8, 7.8]) k.box(54, 0.8, 6, 0, sy, -4, hold);
    for (const sx of [-29.8, 29.8]) k.box(2.4, 48, 14, sx, 0, 0, hold);
    for (const y of [-15.6, 0, 15.6]) { k.box(0.4, 10, 8, 28.4, y, 0, metal); k.cyl('x', 2.2, -28.6, -26.4, y, 0, metal, 10); }   // แผ่นสัมผัส + สปริง
    k.box(5, 9, 4.5, 28.1, 10, 6.25, hold);                                                   // สวิตช์
    k.box(2.2, 4, 1.2, 28.1, 10, 9.1, knob);
    k.tube([[-31, 12, -1], [-36, 12, -1], [-42, 13, 2], [...BAT_PINS['+']]], 0.9, wr, 14, 5);
    k.tube([[-31, -12, -1], [-36, -12, -1], [-42, -13, 2], [...BAT_PINS['-']]], 0.9, wb, 14, 5);
    for (const p of [BAT_PINS['+'], BAT_PINS['-']]) k.cyl('z', 0.9, p[2] - 1, p[2] + 1, p[0], p[1], metal, 8);
    k.finish(g);
    // ถ่าน 3 ก้อน
    const kc = kit(T, 'battery-cells');
    const cellS = S('shell', C.cell, { accent: true, rough: 0.45 });
    const labS = S('shell', 0xf1efe8);
    [-15.6, 0, 15.6].forEach((y, n) => {
      kc.cyl('x', 7.25, -25.25, 25.25, y, 0.25, cellS, 20);
      kc.cyl('x', 7.3, -9, 9, y, 0.25, labS, 20);
      const plus = n === 1 ? 25.25 : -25.25;
      kc.cyl('x', 2.6, plus - Math.sign(plus) * 0 , plus + Math.sign(plus) * 1, y, 0.25, metal, 10);
    });
    const cells = new T.Group(); cells.name = 'battery-cells'; kc.finish(cells); g.add(cells);
    // ฝาเลื่อน
    const kv = kit(T, 'battery-cover');
    kv.box(50, 47, 0.9, 0, 0, 8.05, hold);
    for (const sy of [-23.2, 23.2]) kv.box(50, 1.2, 3, 0, sy, 6.5, hold);
    for (let x = -16; x <= 16; x += 4) kv.box(0.8, 30, 0.4, x, 0, 8.7, hold);
    const cover = new T.Group(); cover.name = 'battery-cover'; kv.finish(cover); g.add(cover);
    g.userData.cells = cells; g.userData.cover = cover;
  },

  // สายไฟบ้าน + ซีลร้อยสาย PG9 : สายดำเข้าทางซีลด้านล่างกล่อง ปลายนอกหัว USB-A ; origin = กลางผนังล่างที่ซีล ; +Y ท้องถิ่น = เข้ากล่อง
  'power-in'(T, g, k) {
    const gl = S('plastic-dark', 0x1b1b1b);
    const cab = S('rubber', 0x101010);
    const metal = S('metal', C.silver);
    const wr = S('wire-red', WIRE_COLORS.power, { rough: 0.7, metal: 0 });
    const wb = S('wire-black', WIRE_COLORS.ground, { rough: 0.7, metal: 0 });
    const cu = S('metal', C.copper);
    k.cyl('y', 10.5, -4.5, -2, 0, 0, gl, 6);                                                  // หน้าแปลนหกเหลี่ยมนอกผนัง
    k.cyl('y', 7.5, -2, 8, 0, 0, gl, 20);                                                     // เกลียวทะลุผนัง
    k.cyl('y', 10, 2, 5, 0, 0, gl, 6);                                                        // น็อตล็อกด้านใน
    k.cyl('y', [6, 8.5], -14, -4.5, 0, 0, gl, 20);                                            // น็อตอัดยางด้านนอก
    k.cyl('y', 2, -96, -13, 0, 0, cab, 12);
    k.cyl('y', 2, 8, 16, 0, 0, cab, 12);
    k.box(14, 16, 9, 0, -104, 0, gl);                                                         // ตัวครอบหัว USB
    k.box(12, 13, 4.5, 0, -118.5, 0, metal);                                                  // หัว USB-A
    k.tube([[0, 16, 0], [-1.5, 19, 0.2], [PWR_PINS['+5V'][0], 22, 0], [PWR_PINS['+5V'][0], 25, 0]], 0.8, wr, 12, 5);
    k.tube([[0, 16, 0], [1.5, 19, -0.2], [PWR_PINS.GND[0], 22, 0], [PWR_PINS.GND[0], 25, 0]], 0.8, wb, 12, 5);
    for (const p of [PWR_PINS['+5V'], PWR_PINS.GND]) k.box(1.2, 3.5, 1.2, p[0], p[1] + 1.25, p[2], cu);
    k.finish(g);
  },

  // สายวัดน้ำ : สายคู่ แดง-ดำ ร้อยยางกันน้ำที่ผนังล่าง ห้อยลง ปลายทองแดงเปลือย 2 ปลายห่างกัน (แดง GPIO0 ดำ GPIO21) ; +Y ท้องถิ่น = เข้ากล่อง
  'water-probe'(T, g, k) {
    const rub = S('rubber', 0x151515);
    const wr = S('wire-red', 0xd23b30, { rough: 0.7, metal: 0 });
    const wb = S('wire-black', 0x1f1f1d, { rough: 0.7, metal: 0 });
    const cu = S('metal', C.copper);
    k.disc('y', 6, 3.2, -2, 2, 0, 0, rub, [], 24);
    k.tube([[-1.8, -2, 0], [-1.8, -90, 0], [-4, -106, 0], [-4, -112, 0]], 0.9, wr, 20, 5);
    k.tube([[1.8, -2, 0], [1.8, -90, 0], [4, -106, 0], [4, -112, 0]], 0.9, wb, 20, 5);
    k.tube([[-1.8, 2, 0], [-1.8, 20, 0], [WTR_PINS.red[0], 24, 0]], 0.9, wr, 10, 5);
    k.tube([[1.8, 2, 0], [1.8, 20, 0], [WTR_PINS.black[0], 24, 0]], 0.9, wb, 10, 5);
    for (const x of [-4, 4]) k.cyl('y', 0.6, -121, -112, x, 0, cu, 8);                          // ปลายทองแดงเปลือย
    for (const p of [WTR_PINS.red, WTR_PINS.black]) k.cyl('y', 0.6, 24, 27, p[0], 0, cu, 8);
    k.finish(g);
  },
};

// ---------------------------------------------------------------- API : สร้างชิ้น
export function buildPart(id, THREE = THREE_DEFAULT) {
  const build = BUILDERS[id];
  if (!build) throw new Error(`parts.js: ไม่รู้จัก id "${id}"`);
  const g = new THREE.Group();
  g.name = id;
  g.userData.id = id;
  build(THREE, g, kit(THREE, id));
  const meta = PARTS.find((p) => p.id === id);
  g.userData.anchors = meta.anchors.map((a) => [...a]);
  g.userData.anchor = [...meta.anchor];
  g.userData.pins = Object.fromEntries(Object.entries(meta.pins).map(([n, v]) => [n, [...v]]));
  return g;
}

/** จุดชี้ป้ายของชิ้น (พิกัดท้องถิ่น) : anchorOf('btn-sos') -> [[x,y,z], ...] */
export function anchorOf(id) {
  const p = PARTS.find((q) => q.id === id);
  if (!p) throw new Error(`parts.js: ไม่รู้จัก id "${id}"`);
  return p.anchors.map((a) => [...a]);
}

// ---------------------------------------------------------------- ขา / ราง / สาย
const PIN_INDEX = new Map();                                                                // ชื่อเต็ม -> { part, local }
for (const p of PARTS) for (const [n, v] of Object.entries(p.pins)) PIN_INDEX.set(n, { part: p, local: v });

/** ตำแหน่งโลกตอนประกอบของขา : pinWorld('mcu.GPIO6') */
export function pinWorld(name) {
  const e = PIN_INDEX.get(name);
  if (!e) throw new Error(`parts.js: ไม่รู้จักขา "${name}"`);
  const r = rotVec(e.part.assembled.rot, e.local);
  return e.part.assembled.pos.map((v, i) => v + r[i]);
}

/** จุดบนรางที่ใกล้ near : railPoint('VSYS', [x,y,z]) ; รับ 'gnd' / 'GND' / '3V3' / 'VSW' */
export function railPoint(name, near = [0, 0, 0]) {
  const n = name === 'gnd' ? 'GND' : name.replace(/^rail\./, '');
  const ix = RAIL_IX[n];
  if (ix === undefined) throw new Error(`parts.js: ไม่รู้จักราง "${name}"`);
  const y = Math.min(Math.max(near[1], PCB_O[1] + RAIL_J[0] * G), PCB_O[1] + RAIL_J[1] * G);
  return [PCB_O[0] + ix * G, y, PCB_O[2] + RAIL_Z];
}

/** ขา หรือจุดบนราง (ชื่อ 'rail.VSYS' / 'gnd') */
export function wirePoint(name, near) {
  if (name === 'gnd' || name.startsWith('rail.')) return railPoint(name, near);
  return pinWorld(name);
}

// ตารางเส้นสายจาก docs/wiring.md ข้อ 3.1 (23 ต.ค.) : [from, to, type]
const NET_ROWS = `
power-in.+5V D1.A p|D1.K rail.VSYS p|power-in.GND gnd g|battery.+ D2.A p|D2.K rail.VSYS p|battery.- gnd g
rail.VSYS C6.+ p|C6.- gnd g|rail.VSYS mcu.5V p|mcu.GND gnd g|mcu.3V3 rail.3V3 p
battery.+ R3.1 d|R3.2 mcu.GPIO1 d|mcu.GPIO1 R4.1 d|R4.2 gnd g|mcu.GPIO1 C2.1 d|C2.2 gnd g
rail.VSYS q-power.S p|q-power.D rail.VSW p|rail.VSYS R12.1 p|R12.2 q-power.G d|q-drive.C q-power.G d|q-drive.E gnd g
mcu.GPIO4 R10.1 d|R10.2 q-drive.B d|q-drive.B R11.1 d|R11.2 gnd g
rail.3V3 radio.VCC p|radio.GND7 gnd g|radio.GND10 gnd g|rail.3V3 C7.+ p|C7.- gnd g|rail.3V3 C8.1 p|C8.2 gnd g
mcu.GPIO6 radio.SCK d|mcu.GPIO7 radio.MOSI d|radio.MISO mcu.GPIO5 d|mcu.GPIO8 radio.NSS d|rail.3V3 R5.1 p|R5.2 radio.NSS d
radio.BUSY mcu.GPIO10 d|radio.DIO1 mcu.GPIO3 d|rail.3V3 radio.RF_SW p|rail.3V3 R6.1 p|R6.2 radio.NRST d
mcu.GPIO0 C1.1 d|C1.2 gnd g|btn-sos.NO mcu.GPIO0 d|btn-sos.COM gnd g
water-probe.red R7.1 d|R7.2 mcu.GPIO0 d|water-probe.black R13.1 d|R13.2 mcu.GPIO21 d
rail.3V3 R2.1 p|R2.2 mcu.GPIO2 d|btn-ack.NO mcu.GPIO2 d|btn-ack.COM gnd g
mcu.GPIO9 R8.1 d|R8.2 leds1.DIN d|leds1.DOUT leds2.DIN d*|leds2.DOUT leds3.DIN d*|leds3.DOUT leds4.DIN d*|leds4.DOUT leds5.DIN d*
leds5.DOUT leds6.DIN d*|leds6.DOUT leds7.DIN d*|leds7.DOUT leds8.DIN d*|leds8.DOUT leds9.DIN d
rail.VSW leds1.+5V p|leds1.+5V leds2.+5V p*|leds2.+5V leds3.+5V p*|leds3.+5V leds4.+5V p*|leds4.+5V leds5.+5V p*
leds5.+5V leds6.+5V p*|leds6.+5V leds7.+5V p*|leds7.+5V leds8.+5V p*|leds8.+5V leds9.+5V p
leds1.GND gnd g|leds1.GND leds2.GND g*|leds2.GND leds3.GND g*|leds3.GND leds4.GND g*|leds4.GND leds5.GND g*
leds5.GND leds6.GND g*|leds6.GND leds7.GND g*|leds7.GND leds8.GND g*|leds8.GND leds9.GND g
mcu.GPIO20 R9.1 a|R9.2 C4.1 a|C4.2 gnd g|R9.2 C5.1 a|C5.2 amp.INL a|amp.INR gnd g
rail.VSW amp.+5V p|amp.GND gnd g|amp.OUTL+ speaker.+ a|amp.OUTL- speaker.- a|antenna.feed radio.IPEX d
`;
const TYPE = { p: 'power', g: 'ground', d: 'data', a: 'audio' };
export const NETS = NET_ROWS.trim().split(/[|\n]/).filter(Boolean).map((r) => {
  const [from, to, t] = r.trim().split(/\s+/);
  const internal = t.endsWith('*');
  return { from, to, type: TYPE[t[0]], ...(internal ? { internal: true } : {}) };
});

function wireMesh(T, a, b, type, { lift, radius, tubular = 24 } = {}) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const h = lift ?? Math.min(18, 4 + d * 0.15);
  const mid = a.map((v, i) => (v + b[i]) / 2);
  mid[2] += h;
  const curve = new T.CatmullRomCurve3([new T.Vector3(...a), new T.Vector3(a[0], a[1], a[2] + Math.min(3, h)),
    new T.Vector3(...mid), new T.Vector3(b[0], b[1], b[2] + Math.min(3, h)), new T.Vector3(...b)], false, 'centripetal');
  const m = new T.MeshStandardMaterial({ color: WIRE_COLORS[type], roughness: 0.7, metalness: 0 });
  m.userData.mat = WIRE_MAT[type]; m.userData.baseOpacity = 1;
  const mesh = new T.Mesh(new T.TubeGeometry(curve, tubular, radius ?? 0.5, 5, false), m);
  mesh.userData.mat = WIRE_MAT[type];
  return mesh;
}

/** สายเส้นเดียวระหว่างสองจุด (ชื่อขา/ราง) ตอนประกอบ */
export function wireBetween(THREE = THREE_DEFAULT, from, to, opts = {}) {
  const type = opts.type || 'data';
  const a = wirePoint(from, wirePoint(to));
  const b = wirePoint(to, a);
  const mesh = wireMesh(THREE, a, b, type, opts);
  mesh.name = `wire:${from}>${to}`;
  mesh.userData.net = { from, to, type };
  return mesh;
}

/** สายทั้งหมดตาม NETS (ข้ามสายสั้นภายในวงไฟที่อยู่ในชิ้น leds แล้ว) ; ใส่ในระดับเดียวกับชิ้นส่วน ไม่ใช่ลูกของชิ้นใด */
export function buildWires(THREE = THREE_DEFAULT, { only } = {}) {
  const g = new THREE.Group();
  g.name = 'wires';
  for (const net of NETS) {
    if (net.internal) continue;
    if (only && !only(net)) continue;
    const mesh = wireBetween(THREE, net.from, net.to, { type: net.type });
    g.add(mesh);
  }
  g.userData.nets = NETS;
  return g;
}
export const createWires = buildWires;

// ---------------------------------------------------------------- API : ประกอบ / แยก
/** คืน { root, groups, wires } groups เป็น Map<id, Group> ที่ตั้งตำแหน่งตอนประกอบแล้ว */
export function buildAll(THREE = THREE_DEFAULT) {
  const root = new THREE.Group();
  root.name = 'device';
  const groups = new Map();
  for (const p of PARTS) {
    const g = buildPart(p.id, THREE);
    g.position.set(...p.assembled.pos);
    g.rotation.set(...p.assembled.rot);
    g.userData.part = p;
    root.add(g);
    groups.set(p.id, g);
  }
  const wires = buildWires(THREE);
  root.add(wires);
  return { root, groups, wires };
}

const SUB_BASE = new WeakMap();
/** ตั้งตำแหน่งทุกชิ้น (และชิ้นย่อย) ที่ t (0 = ประกอบ, 1 = แยกเต็มที่) */
export function explodeAt(groups, t) {
  for (const p of PARTS) {
    const g = groups.get(p.id);
    if (!g) continue;
    g.position.set(
      p.assembled.pos[0] + p.explode.offset[0] * t,
      p.assembled.pos[1] + p.explode.offset[1] * t,
      p.assembled.pos[2] + p.explode.offset[2] * t,
    );
    for (const [name, s] of Object.entries(p.sub)) {
      const sg = g.userData[name === 'led9' ? 'led9' : name];
      if (!sg) continue;
      if (!SUB_BASE.has(sg)) SUB_BASE.set(sg, sg.position.clone());
      const base = SUB_BASE.get(sg);
      // ระยะรวมของชิ้นย่อยในโลก - ระยะของชิ้นแม่ = ระยะเพิ่มเทียบชิ้นแม่ (ชิ้นแม่ไม่หมุนยกเว้นลำโพงที่ไม่มี sub)
      sg.position.set(
        base.x + (s.offset[0] - p.explode.offset[0]) * t,
        base.y + (s.offset[1] - p.explode.offset[1]) * t,
        base.z + (s.offset[2] - p.explode.offset[2]) * t,
      );
    }
  }
}

/** ทำทั้งชิ้นจางลง (o 0..1) ข้ามวัสดุที่ตั้ง userData.noFade คูณกับ opacity ตั้งต้นของวัสดุ (เช่นช่องใส) */
export function setOpacity(group, o) {
  group.visible = o > 0.001;
  group.traverse((n) => {
    const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
    for (const m of ms) {
      if (m.userData && m.userData.noFade) continue;
      const base = (m.userData && m.userData.baseOpacity) ?? 1;
      const wasTransparent = m.transparent;
      m.transparent = o < 1 || base < 1;
      m.opacity = o * base;
      m.depthWrite = o * base > 0.6;
      if (wasTransparent !== m.transparent) m.needsUpdate = true;
    }
  });
}

/** เพิ่มเส้นขอบบาง ๆ (LineSegments) ให้ทุก Mesh ในกลุ่ม (ข้ามวัสดุช่องใส) */
export function outlineGroup(group, THREE = THREE_DEFAULT, opts = {}) {
  const { color = 0x37474f, opacity = 0.55, angle = 35 } = opts;
  const meshes = [];
  group.traverse((n) => {
    if (n.isMesh && !n.isInstancedMesh && n.userData.mat !== 'window' && !n.userData.isOutline && !n.userData.noOutline) meshes.push(n);
  });
  for (const m of meshes) {
    const lm = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    lm.userData.baseOpacity = opacity;
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, angle), lm);
    line.userData.isOutline = true;
    m.add(line);
  }
  return group;
}

/**
 * อาร์เรย์ { id, name, object, assembled, exploded, assembledRotation, explodedRotation, optional, stage, order, anchor, anchors, pins, sub }
 * exploded = ตำแหน่งสุดท้ายเต็มที่ (assembled + offset) ; object ถูกตั้งตำแหน่ง assembled ให้แล้ว
 */
export function createParts(THREE = THREE_DEFAULT) {
  return PARTS.map((p) => {
    const object = buildPart(p.id, THREE);
    object.position.set(...p.assembled.pos);
    object.rotation.set(...p.assembled.rot);
    return {
      id: p.id,
      name: p.nameTh,
      object,
      assembled: [...p.assembled.pos],
      exploded: p.assembled.pos.map((v, i) => v + p.explode.offset[i]),
      assembledRotation: [...p.assembled.rot],
      explodedRotation: [...p.assembled.rot],
      optional: p.optional,
      stage: p.stage,
      order: p.order,
      anchor: [...p.anchor],
      anchors: p.anchors.map((a) => [...a]),
      pins: p.pins,
      sub: p.sub,
    };
  });
}

// ================================================================================================================
// รอบ v2-3 : ห้องในบ้าน / ตัวรับ / โน้ตบุ๊ก / เสาหลังคา / แผนที่ชุมชน  (เพิ่มท้ายไฟล์ ไม่แตะ PARTS / NETS)
//
// หน่วย : ห้อง ตัวรับ โน้ตบุ๊ก เสาหลังคา ห้อง อบต. = มิลลิเมตร (1 หน่วย = 1 มม. เหมือนกล่อง)
//         แผนที่ (buildMap) = เมตร (1 หน่วย = 1 ม.) แยก scene/กล้อง ห้ามใส่รวมกับโมเดลมม. (ทศนิยมเพี้ยน)
// Export ใหม่ : WATER_COLOR, ROOM, buildRoom, RX, RX_DESK, RX_NETS, rxPinWorld, buildReceiver, LAPTOP, buildLaptop,
//               buildRxAntenna, OFFICE, buildOfficeCutaway, MAP, MAP_MAT_NAMES, buildMap
// ทุก Mesh มี userData.mat เป็นชื่อใน MAT_NAMES (ห้อง/ตัวรับ/โน้ตบุ๊ก) หรือ MAP_MAT_NAMES (แผนที่)
// ================================================================================================================

Object.assign(ASSUMED, {
  room: 'ห้องชั้นบน (ขนาดห้องสมมติ ทั้งหมด) : กล่องสูง 1.3 ม. จากพื้น (กลางกล่อง ค่าออกแบบ 1.2-1.4 ม.) · เพดานสูง 2.7 ม. · พื้นหนา 200 มม. · ชั้นล่างสูง 2.5 ม. · หน้าต่าง 900 x 1200 มม. ขอบล่างสูง 900 มม. อยู่ขวาของกล่อง · ผนังหนา 100 มม.',
  roomOutlet: 'ปลั๊กผนังสูง 1,087 มม. จากพื้น (ใต้กล่อง ~110 มม.) + หัวชาร์จ USB ทรงแบน 28 x 52 x 25 มม. พอร์ต USB-A อยู่ด้านบน (สมมติ ให้หัว USB-A ของสายที่ชี้ลงเสียบพอดี) · สายจริงยาวกว่านี้ (ย่อไว้ตามชิ้น power-in)',
  roomProbe: 'สายวัดน้ำของกล่องเป็นสายสั้นย่อส่วน : ในห้องต่อด้วยตัวต่อสาย (กล่องเล็ก) แล้ววิ่งตามผนังลอดรูพื้นลงชั้นล่าง ปลายทองแดงอยู่สูง 500 มม. จากพื้นชั้นล่าง (parts.md / idea.md) ; ชั้นล่างทำเป็นผนังจาง + พื้นเล็ก + ไม้บรรทัด 50 ซม. เท่านั้น',
  rxBoard: 'แผ่นไข่ปลาตัวรับ 56 x 62 x 1.6 มม. (parts.md ไม่ระบุขนาด) · rxR1 แสดงแถบสีเท่า R5 10k ของกล่อง, rxC1 อิเล็กโทรไลต์ Ø5 x 11, rxC2 เซรามิก Ø5 (wiring.md ไม่ระบุค่า ตัวเลขเป็นแค่ภาพ)',
  rxAntenna: 'เสา 3 dBi ย่าน 920-925 MHz ยาวตัวยาง 160 มม. (= ครึ่งความยาวคลื่น c/f/2 ที่ 923 MHz = 162 มม.) ฐานหัว SMA ; ของจริงในร้านยาวต่างกัน ให้เช็กรุ่นที่ซื้อ ; สายแปลงขั้ว IPEX -> SMA ย่อให้สั้นเท่าที่เห็น',
  rxPower: 'พาวเวอร์แบงก์ 110 x 62 x 22 มม. (สมมติ) ; PoC ใช้ไฟจากโน้ตบุ๊กทางสาย USB ภาคสนามเปลี่ยนเป็นพาวเวอร์แบงก์ (setPower)',
  laptop: 'โน้ตบุ๊ก 14 นิ้ว สมมติ : ตัวเครื่อง 320 x 16 x 220 มม. ฝาจอ 320 x 215 x 6 มม. จอ 300 x 188 มม. เปิด 105 องศา พอร์ต USB-A ด้านซ้าย',
  office: 'อาคาร อบต. สมมติ (ชื่อสมมติ ไม่มีโลโก้) : 3 ชั้น ชั้นละ 3.8 ม. แผ่นหลังคาหนา 0.4 ม. เสาเหล็กบนหลังคาสูง 4.5 ม. ; ห้องตัดชั้นบนสุดสูง 3,000 มม. โต๊ะสูง 750 มม. ; สายเสา (coax) ลงจากหลังคาตรงชั้นบนสุด',
  map: 'แผนที่จำลอง : พื้น 2,400 x 2,400 ม. (ศูนย์กลาง x=+200 เพื่อให้วงรัศมี 1 กม. รอบ อบต. อยู่ในพื้น) · บ้าน 64 หลัง ขนาด/ตำแหน่งสุ่มแบบกำหนดค่าเริ่ม (seed) ไม่ใช่ข้อมูลจริง · ระยะบ้านในเรื่อง -> อบต. = 800 ม. เป็นค่าตั้งของแผนที่จำลอง (ไม่ใช่ระยะที่ทดสอบได้) · แม่น้ำ/โซนน้ำท่วมวาดตามใจ',
});

/** สีน้ำ = สีเดียวกับระนาบน้ำฉาก 5 ใน scroll.js (waterMesh) */
export const WATER_COLOR = 0x8fb0c8;
const INK = 0x1f1f1d;
const TXT2 = 0x5f5e5a;

// ---------------------------------------------------------------- ห้อง (พิกัดเดียวกับกล่องตอนประกอบ : origin = กลางกล่อง ผนังชิดหลังกล่อง z=-45)
const RM = { x0: -1800, x1: 2400, sideX: -1900, wallT: 100, z0: -45, zFront: 1800, floorY: -1300, ceilH: 2700, slabT: 200, lowerH: 2500 };
const RM_CEIL = RM.floorY + RM.ceilH;                       // 1400
const RM_SLAB_BOT = RM.floorY - RM.slabT;                   // -1500
const RM_LOWER = RM_SLAB_BOT - RM.lowerH;                   // -4000 พื้นชั้นล่าง
const RM_WIN = { x0: 550, x1: 1450, y0: RM.floorY + 900, y1: RM.floorY + 2100 };   // หน้าต่าง 900 x 1200
const RM_PROBE_Z = RM.z0 + 2.5;                             // สายวัดน้ำเดินแนบผนัง (ศูนย์กลางสาย)

export const ROOM = {
  unit: 'mm',
  boxCenterHeightMm: 1300,                                  // ค่าออกแบบ 1,200-1,400 : ใช้ 1,300
  floorY: RM.floorY, ceilY: RM_CEIL, wallZ: RM.z0, slabBottomY: RM_SLAB_BOT, lowerFloorY: RM_LOWER,
  probeHeightMm: 500, probeTipY: RM_LOWER + 500,
  /** ระดับน้ำ (ซม. เหนือพื้นชั้นล่าง) -> y ในห้องนี้ (มม.) ; 50 ซม. = ปลายสายวัดน้ำ */
  waterY: (cm) => RM_LOWER + cm * 10,
  window: { x: [RM_WIN.x0, RM_WIN.x1], y: [RM_WIN.y0, RM_WIN.y1], center: [(RM_WIN.x0 + RM_WIN.x1) / 2, (RM_WIN.y0 + RM_WIN.y1) / 2, RM.z0 - RM.wallT / 2], glassZ: RM.z0 - RM.wallT / 2 },
  outward: [0, 0, -1],                                      // ทิศออกนอกหน้าต่าง (ไป อบต.)
  outlet: [-35, -213, RM.z0],
  usbPort: [-35, -187, -29.5],                              // หัว USB-A ของ power-in เสียบที่นี่
  probeJoint: [-55, -192, -29.5], probeHole: [-55, RM.floorY, -40], probeTip: [-55, RM_LOWER + 500, RM_PROBE_Z],
  heightLabel: [-215, -650, RM.z0 + 0.6],
  boxBack: [0, 0, RM.z0],
  view: { width: [RM.x0, RM.x1], depth: [RM.z0, RM.zFront] },
};

export function buildRoom(T = THREE_DEFAULT) {
  const root = new T.Group();
  root.name = 'room';
  root.userData.room = ROOM;
  const k = kit(T, 'room');
  const wallM = S('shell', 0xe7e5dd, { rough: 0.95, metal: 0 });
  const lineM = S('shell', 0xcfcdc4, { rough: 1, metal: 0 });
  const slabM = S('shell', 0xd6d3c9, { rough: 0.95, metal: 0 });
  const skirtM = S('shell', 0xc9c6bc, { rough: 0.8, metal: 0 });
  const trim = S('shell', 0xf3f1ea, { rough: 0.7, metal: 0 });
  const glass = S('window', 0xe8f4ff);
  const dark = S('plastic-dark', 0x2a2a28);
  const screwM = S('metal', 0xb9b7ae, { rough: 0.5 });

  // ผนังหลัง (ชั้นบน) เจาะหน้าต่าง : ผิวหน้าอยู่ z=-45
  {
    const s = new T.Shape();
    s.moveTo(RM.x0, RM.floorY); s.lineTo(RM.x1, RM.floorY); s.lineTo(RM.x1, RM_CEIL); s.lineTo(RM.x0, RM_CEIL); s.closePath();
    const h = new T.Path();
    h.moveTo(RM_WIN.x0, RM_WIN.y0); h.lineTo(RM_WIN.x0, RM_WIN.y1); h.lineTo(RM_WIN.x1, RM_WIN.y1); h.lineTo(RM_WIN.x1, RM_WIN.y0); h.closePath();
    s.holes.push(h);
    k.add(new T.ExtrudeGeometry(s, { depth: RM.wallT, bevelEnabled: false }).translate(0, 0, RM.z0 - RM.wallT), wallM);
  }
  // ผนังซ้าย (ให้เห็นเป็นมุมห้อง)
  k.box(100, RM.ceilH, RM.zFront - (RM.z0 - RM.wallT), RM.sideX + 50, RM.floorY + RM.ceilH / 2, (RM.zFront + RM.z0 - RM.wallT) / 2, wallM);
  // พื้นชั้นบน : แผ่นหนา 200 เจาะรูให้สายวัดน้ำลอด ; ขอบหน้า (z=1800) เห็นเป็นหน้าตัดพื้น
  {
    const s = new T.Shape();
    s.moveTo(RM.sideX, RM.z0 - RM.wallT); s.lineTo(RM.x1, RM.z0 - RM.wallT); s.lineTo(RM.x1, RM.zFront); s.lineTo(RM.sideX, RM.zFront); s.closePath();
    const h = new T.Path();
    h.moveTo(-66, -43); h.lineTo(-66, -36); h.lineTo(-44, -36); h.lineTo(-44, -43); h.closePath();
    s.holes.push(h);
    k.add(new T.ExtrudeGeometry(s, { depth: RM.slabT, bevelEnabled: false }).rotateX(PI / 2).translate(0, RM.floorY, 0), slabM);
  }
  // เส้นปูน : เส้นบางแนวนอนทุก 200 มม. (ข้ามช่องหน้าต่าง)
  for (let n = 1; n <= 13; n++) {
    const y = RM.floorY + 200 * n;
    const inWin = y > RM_WIN.y0 - 1 && y < RM_WIN.y1 + 1;
    const spans = inWin ? [[RM.x0, RM_WIN.x0 - 30], [RM_WIN.x1 + 30, RM.x1]] : [[RM.x0, RM.x1]];
    for (const [a, b] of spans) k.box(b - a, 1.2, 0.6, (a + b) / 2, y, RM.z0 + 0.3, lineM);
  }
  // แนวเชิงผนัง (เว้นช่องสายวัดน้ำ)
  for (const [a, b] of [[RM.x0, -90], [-20, RM.x1]]) k.box(b - a, 100, 12, (a + b) / 2, RM.floorY + 50, RM.z0 + 6, skirtM);

  // หน้าต่าง : วงกรอบ + เสากลาง + กระจก + ธรณีหน้าต่างยื่นเข้าห้อง
  const wx = (RM_WIN.x0 + RM_WIN.x1) / 2, wy = (RM_WIN.y0 + RM_WIN.y1) / 2, wz = RM.z0 - RM.wallT / 2;
  const ww = RM_WIN.x1 - RM_WIN.x0, wh = RM_WIN.y1 - RM_WIN.y0;
  k.box(ww, 40, 60, wx, RM_WIN.y1 - 20, wz, trim);
  k.box(ww, 40, 60, wx, RM_WIN.y0 + 20, wz, trim);
  for (const sx of [-1, 1]) k.box(40, wh - 80, 60, wx + sx * (ww / 2 - 20), wy, wz, trim);
  k.box(30, wh - 80, 40, wx, wy, wz, trim);
  k.box(ww - 80, wh - 80, 4, wx, wy, wz, glass);
  k.box(ww + 60, 25, 70, wx, RM_WIN.y0 - 12.5, RM.z0 + 25, trim);

  // ปลั๊กผนัง + หัวชาร์จ USB (พอร์ตด้านบน : หัว USB-A ของ power-in ชี้ลงเสียบพอดี)
  const [ox, oy] = ROOM.outlet;
  k.box(86, 86, 8, ox, oy, RM.z0 + 4, trim);                                           // แผ่นปลั๊ก
  for (const sy of [-37, 37]) k.cyl('z', 2.6, RM.z0 + 8, RM.z0 + 8.8, ox, oy + sy, screwM, 10);
  const chW = 24, chH = 52, chTop = ROOM.usbPort[1];                                 // ยอดหัวชาร์จ y = -187
  k.box(chW, chH, 25, ox, chTop - chH / 2, RM.z0 + 8 + 12.5, S('shell', 0xf8f7f3, { rough: 0.55, metal: 0 }));   // ตัวหัวชาร์จ z -37..-12
  k.box(13, 0.4, 5.6, ox, chTop + 0.1, ROOM.usbPort[2], dark);                          // ช่อง USB-A ด้านบน (หัวสายเสียบทับ)
  const body = new T.Group();
  body.name = 'room-body';
  k.finish(body);
  body.traverse((n) => { if (n.isMesh && n.material.color.getHex() === 0xcfcdc4) n.userData.noOutline = true; });   // เส้นปูนไม่ต้องมีขอบหมึก (outlineGroup ข้าม)
  root.add(body);

  // ----- เส้นบอกความสูงกล่อง (ซ่อน/แสดงได้ : userData.dim)
  const kd = kit(T, 'room-dim');
  const dm = S('metal', TXT2, { rough: 0.8, metal: 0 });
  const dx = ROOM.heightLabel[0], dz = RM.z0 + 0.6;
  kd.box(2.5, 1300, 1.2, dx, -650, dz, dm);
  kd.box(70, 2.5, 1.2, dx + 25, 0, dz, dm);
  kd.box(70, 2.5, 1.2, dx + 25, RM.floorY + 1.25, dz, dm);
  const dim = new T.Group(); dim.name = 'room-dim'; kd.finish(dim); root.add(dim); root.userData.dim = dim;

  // ----- สายวัดน้ำ : ตัวต่อสายใต้กล่อง -> แนบผนัง -> ลอดรูพื้น -> ปลายเปลือยสูง 50 ซม. จากพื้นชั้นล่าง
  const kp = kit(T, 'room-probe');
  const wr = S('wire-red', WIRE_COLORS.power, { rough: 0.7, metal: 0 });
  const wb = S('wire-black', WIRE_COLORS.ground, { rough: 0.7, metal: 0 });
  const cu = S('metal', C.copper);
  const [jx, jy, jz] = ROOM.probeJoint;
  kp.box(15.6, 18, 11, jx, jy, jz, S('plastic-dark', 0x3a3a38));                          // ตัวต่อสาย ครอบปลายทองแดงเปลือยของชิ้น water-probe
  const tipY = ROOM.probeTipY;
  for (const [sx, mat] of [[-1, wr], [1, wb]]) {
    const x = jx + sx * 1.8;
    kp.tube([[x, jy - 9, jz], [x, jy - 48, jz], [x, jy - 140, RM_PROBE_Z + (jz - RM_PROBE_Z) * 0.35], [x, jy - 230, RM_PROBE_Z], [x, tipY + 20, RM_PROBE_Z],
      [x + sx * 2.2, tipY + 6, RM_PROBE_Z]], 0.9, mat, 160, 5);
    kp.cyl('y', 0.6, tipY, tipY + 14, x + sx * 2.2, RM_PROBE_Z, cu, 8);                  // ปลายทองแดงเปลือย
  }
  const clipM = S('plastic-dark', 0x3a3a38);
  for (let y = -500; y > RM_LOWER + 700; y -= 500) if (y > RM.floorY + 40 || y < RM_SLAB_BOT - 40) kp.box(10, 6, 3, jx, y, RM.z0 + 1.5, clipM);
  const probe = new T.Group(); probe.name = 'room-probe'; kp.finish(probe); root.add(probe); root.userData.probeRun = probe;

  // ----- ชั้นล่าง (ทำแค่พอให้เห็นระยะ) : ผนังจาง + พื้นเล็ก + ไม้บรรทัด 50 ซม.
  const kl = kit(T, 'room-lower');
  kl.box(1200, RM_SLAB_BOT - RM_LOWER, RM.wallT, -100, (RM_SLAB_BOT + RM_LOWER) / 2, RM.z0 - RM.wallT / 2, S('window', 0xe7e5dd, { opacity: 0.32, rough: 0.95, metal: 0 }));
  kl.box(1200, 40, 640, -100, RM_LOWER - 20, RM.z0 - RM.wallT + 320, slabM);
  const rl = S('metal', 0x9c9a92, { rough: 0.8, metal: 0 });
  kl.box(5, 600, 1, -20, RM_LOWER + 300, RM.z0 + 0.5, rl);
  for (let i = 0; i <= 6; i++) kl.box(i === 5 ? 34 : 16, i === 5 ? 3 : 1.5, 1, -20 + (i === 5 ? 14 : 5), RM_LOWER + i * 100, RM.z0 + 0.5, rl);
  const lower = new T.Group(); lower.name = 'room-lower'; kl.finish(lower); root.add(lower); root.userData.lower = lower;

  root.userData.anchors = {
    boxBack: [...ROOM.boxBack], outlet: [...ROOM.outlet], usbPort: [...ROOM.usbPort], window: [...ROOM.window.center],
    probeJoint: [...ROOM.probeJoint], probeHole: [...ROOM.probeHole], probeTip: [...ROOM.probeTip], heightLabel: [...ROOM.heightLabel],
    windowNear: [RM_WIN.x0, ROOM.window.center[1], RM.z0],
  };
  return root;
}

// ---------------------------------------------------------------- เสา 3 dBi (ใช้ทั้งบนโต๊ะตัวรับและบนหลังคา)
const ROD = { nut: 3, collar: 12, body: 160, rBase: 4.8, rTop: 3.2 };
const ROD_LEN = ROD.nut + ROD.collar + ROD.body + ROD.rTop;           // ฐาน -> ปลาย = 178.2 มม.
/** วางเสาตามแกน axis เริ่มที่ a0 ที่ตำแหน่ง (p,q) ; คืนค่า a ของปลายเสา */
function addRod(k, axis, p, q, a0) {
  const rub = S('rubber', 0x1b1b1b, { rough: 0.6, accent: true });
  const met = S('metal', C.silver, { rough: 0.3 });
  k.cyl(axis, 5.5, a0, a0 + ROD.nut, p, q, met, 6);
  k.cyl(axis, 4.2, a0 + ROD.nut, a0 + ROD.nut + ROD.collar, p, q, met, 14);
  const b0 = a0 + ROD.nut + ROD.collar;
  k.cyl(axis, [ROD.rTop, ROD.rBase], b0, b0 + ROD.body, p, q, rub, 16);
  k.dome(axis, ROD.rTop, ROD.rTop, b0 + ROD.body, 1, p, q, rub, 16);
  return a0 + ROD_LEN;
}

/** เสาบนหลังคา (มม., y ขึ้น, origin = ใต้ฐาน) : anchors feed (ท้ายฐาน ต่อสายเสา) tip (ปลายเสา) */
export function buildRxAntenna(T = THREE_DEFAULT) {
  const g = new T.Group();
  g.name = 'rx-antenna-roof';
  const k = kit(T, 'rx-antenna-roof');
  const dk = S('plastic-dark', 0x2b2d2e);
  k.cyl('y', 24, 0, 4, 0, 0, S('metal', 0x8d9296, { rough: 0.4 }), 20);               // แป้นยึดกับเสาเหล็ก
  k.cyl('y', 11, 4, 36, 0, 0, dk, 16);
  const tip = addRod(k, 'y', 0, 0, 36);
  k.cyl('y', 2.2, -24, 0, 0, 0, S('wire-black', 0x151515, { rough: 0.7, metal: 0 }), 10);   // สายเสาโผล่ใต้แป้น
  k.finish(g);
  g.userData.anchors = { feed: [0, -24, 0], base: [0, 0, 0], tip: [0, tip, 0] };
  g.userData.lengthMm = ROD_LEN;
  return g;
}

// ---------------------------------------------------------------- ตัวรับรุ่นชาวบ้าน
const RXB = { w: 56, h: 62, t: 1.6, drop: 4.8 };                       // แผ่นไข่ปลา ; drop = ความสูงขาตั้ง (พื้นโต๊ะอยู่ที่ z = -4.8 ในพิกัดแผ่น)
const RX_MCU_AT = [0, 17, PCB_TOP + 2.5 + 0.6];
const RX_RADIO_AT = [0, -17, PCB_TOP + 2.5 + 0.5];
const RX_RAIL = { '3V3': -9 * G, gnd: -10 * G };
const RX_RAIL_Y = [-24, 24];
const RX_RAIL_Z = PCB_TOP + 0.6;
const RX_R = [['rxR1', -4, -1, -3]];                                   // id, ix1, ix2, iy
const RX_CAP = [['rxC1', 'el', -7, -6, 1, true], ['rxC2', 'disc', -7, -5, -2, false]];
const RX_JACK = [40, -10];                                             // ฐานหัว SMA (x, y) ในพิกัดแผ่น

/** ตำแหน่งโน้ตบุ๊กในพิกัดตัวรับ (y ขึ้น พื้นโต๊ะ y=0) : วางกลุ่ม buildLaptop() ไว้ที่นี่ ; สาย USB ของตัวรับลงที่พอร์ตซ้ายของเครื่องนี้พอดี */
export const RX_DESK = { laptopPos: [300, 0, -40] };

export const RX = {
  unit: 'mm', boardMm: [RXB.w, RXB.h, RXB.t], deskDrop: RXB.drop, antennaLenMm: ROD_LEN,
  desk: RX_DESK,
};

const toRx = ([x, y, z]) => [x, z + RXB.drop, -y];                   // พิกัดแผ่น -> พิกัดตัวรับ (y ขึ้น, หน้า=+z, USB-C ไปด้านหลัง)
const toBoard = ([X, Y, Z]) => [X, -Z, Y - RXB.drop];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const RX_PINS = {};
for (const [n, v] of Object.entries(MCU_PINS)) RX_PINS[`rx-mcu.${n}`] = addv(RX_MCU_AT, v);
RX_PINS['rx-mcu.USB-C'] = addv(RX_MCU_AT, [0, 8.2 + 3.65, 0.6 + 1.63]);
for (const [n, v] of Object.entries(RADIO_PINS)) RX_PINS[`rx-radio.${n}`] = addv(RX_RADIO_AT, v);
RX_PINS['rx-radio.IPEX'] = addv(RX_RADIO_AT, [IPEX_L[0], IPEX_L[1], IPEX_L[2] + 0.9]);
{
  const lz = PCB_TOP + 0.5;
  for (const [id, a, b, j] of RX_R) { RX_PINS[`${id}.1`] = [a * G, j * G, lz]; RX_PINS[`${id}.2`] = [b * G, j * G, lz]; }
  for (const [id, , a, b, j, polar] of RX_CAP) { RX_PINS[`${id}.${polar ? '+' : '1'}`] = [a * G, j * G, lz]; RX_PINS[`${id}.${polar ? '-' : '2'}`] = [b * G, j * G, lz]; }
}
RX_PINS['rx-antenna.cable'] = [RX_JACK[0] - 8, RX_JACK[1], 2];
const RX_LAPTOP_PORT = toBoard([RX_DESK.laptopPos[0] - 160, RX_DESK.laptopPos[1] + 8, RX_DESK.laptopPos[2] - 50]);
RX_PINS['laptop.USB'] = [...RX_LAPTOP_PORT];

// ตารางสายตัวรับ = docs/wiring.md ข้อ 3.2 (21 เส้น) : from to type
const RX_ROWS = `
laptop.USB rx-mcu.USB-C d|rx-mcu.3V3 rx.3V3 p|rx-mcu.GND rx.gnd g|rx.3V3 rx-radio.VCC p|rx-radio.GND7 rx.gnd g|rx-radio.GND10 rx.gnd g
rx.3V3 rxC1.+ p|rxC1.- rx.gnd g|rx.3V3 rxC2.1 p|rxC2.2 rx.gnd g
rx-mcu.GPIO6 rx-radio.SCK d|rx-mcu.GPIO7 rx-radio.MOSI d|rx-radio.MISO rx-mcu.GPIO5 d|rx-mcu.GPIO8 rx-radio.NSS d
rx.3V3 rxR1.1 p|rxR1.2 rx-radio.NSS d|rx-radio.BUSY rx-mcu.GPIO10 d|rx-radio.DIO1 rx-mcu.GPIO3 d|rx-mcu.GPIO4 rx-radio.NRST d
rx.3V3 rx-radio.RF_SW p|rx-antenna.cable rx-radio.IPEX d
`;
export const RX_NETS = RX_ROWS.trim().split(/[|\n]/).filter(Boolean).map((r) => {
  const [from, to, t] = r.trim().split(/\s+/);
  return { from, to, type: TYPE[t[0]] };
});

function rxPoint(name, near) {
  if (name === 'rx.3V3' || name === 'rx.gnd') {
    const x = RX_RAIL[name === 'rx.gnd' ? 'gnd' : '3V3'];
    const y = Math.min(Math.max(near ? near[1] : 0, RX_RAIL_Y[0]), RX_RAIL_Y[1]);
    return [x, y, RX_RAIL_Z];
  }
  const p = RX_PINS[name];
  if (!p) throw new Error(`parts.js: ไม่รู้จักขาตัวรับ "${name}"`);
  return p;
}

/** ตำแหน่งขา/ราง/จุดของตัวรับในพิกัดตัวรับ (y ขึ้น พื้นโต๊ะ y=0) : rxPinWorld('rx-mcu.GPIO6') ; 'rx.3V3' / 'rx.gnd' = จุดกลางราง */
export function rxPinWorld(name) {
  const p = (name === 'rx.3V3' || name === 'rx.gnd') ? rxPoint(name, [0, 0, 0]) : rxPoint(name);
  return toRx(p);
}

function rxBoardGroup(T) {
  const g = new T.Group();
  g.name = 'rx-board';
  const k = kit(T, 'rx-board');
  const pcb = S('pcb', C.pcb, { rough: 0.5 });
  const dark = S('chip', 0x10231a, { rough: 0.9, metal: 0 });
  const silver = S('metal', C.silver, { rough: 0.35 });
  const post = S('shell', 0xf0eee6);
  const mh = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) mh.push([sx * 22, sy * 28.5]);
  k.add(k.panel(RXB.w, RXB.h, RXB.t, mh.map(([x, y]) => [x, y, 1.5])), pcb);
  for (let i = -10; i <= 10; i++) for (let j = -12; j <= 12; j++) {
    if (mh.some(([x, y]) => Math.hypot(i * G - x, j * G - y) < 3.2)) continue;
    k.add(new T.CircleGeometry(0.55, 4, PI / 4).translate(i * G, j * G, 0.82), dark);
  }
  for (const [x, y] of mh) {
    k.cyl('z', 3, -RXB.drop, -0.8, x, y, post, 12);                       // ขาตั้งสูง 4
    k.cyl('z', 2.4, 0.8, 1.8, x, y, silver, 12);
  }
  for (const x of Object.values(RX_RAIL)) {                               // ราง rx.3V3 rx.gnd (ลวดเปลือย)
    k.cyl('y', 0.55, RX_RAIL_Y[0], RX_RAIL_Y[1], x, RX_RAIL_Z, silver, 8);
    for (const y of [RX_RAIL_Y[0], RX_RAIL_Y[1], 0]) k.cyl('z', 0.95, PCB_TOP, RX_RAIL_Z, x, y, silver, 8);
  }
  k.finish(g);
  return g;
}

function rxPassives(T) {
  const g = new T.Group();
  g.name = 'rx-passives';
  const k = kit(T, 'rx-passives');
  const body = S('shell', C.resistor);
  const lead = S('metal', C.silver, { rough: 0.35 });
  const cer = S('shell', C.cer);
  const sleeve = S('plastic-dark', C.electro);
  const strip = S('metal', 0xdddddd);
  const BAND = { 0: 0x111111, 1: 0x6b3a1e, 2: 0xd32f2f, 3: 0xf57c00, 4: 0xfdd835 };
  const h = PCB_TOP + 1.7;
  for (const [, a, b, j] of RX_R) {
    const xa = a * G, xb = b * G, y = j * G, cx = (xa + xb) / 2;
    k.cyl('x', 1.15, cx - 3.15, cx + 3.15, y, h, body, 10);
    k.cyl('x', 0.3, xa, xb, y, h, lead, 6);
    for (const x of [xa, xb]) { k.cyl('z', 0.3, PCB_TOP, h, x, y, lead, 6); k.cyl('z', 0.9, PCB_TOP, PCB_TOP + 0.5, x, y, lead, 8); }
    const xs = [-2.4, -1.6, -0.8, 0, 2.1];
    [1, 0, 0, 2, 1].forEach((d, n) => k.cyl('x', 1.2, cx + xs[n] - 0.25, cx + xs[n] + 0.25, y, h, S('plastic-dark', BAND[d], { rough: 0.6, metal: 0 }), 10));
  }
  for (const [, kind, a, b, j] of RX_CAP) {
    const xa = a * G, xb = b * G, y = j * G, cx = (xa + xb) / 2;
    for (const x of [xa, xb]) k.cyl('z', 0.9, PCB_TOP, PCB_TOP + 0.5, x, y, lead, 8);
    if (kind === 'disc') {
      const zc = PCB_TOP + 5;
      k.cyl('y', 2.5, y - 1.3, y + 1.3, cx, zc, cer, 16);
      for (const x of [xa, xb]) k.cyl('z', 0.3, PCB_TOP, zc, x, y, lead, 6);
    } else {
      const z0 = PCB_TOP + 0.6, r = 2, hh = 11;
      k.cyl('z', r, z0, z0 + hh, cx, y, sleeve, 20);
      k.cyl('z', r + 0.05, z0 + hh - 0.2, z0 + hh, cx, y, strip, 20);
      k.box(0.4, 1.2, hh * 0.8, cx - r, y, z0 + hh / 2, strip);
      for (const x of [xa, xb]) k.cyl('z', 0.3, PCB_TOP, z0, x, y, lead, 6);
    }
  }
  k.finish(g);
  return g;
}

function rxSub(T, id, key, at) {
  const g = new T.Group();
  g.name = id;
  g.userData.id = id;
  BUILDERS[key](T, g, kit(T, id));
  g.position.set(...at);
  return g;
}

/**
 * ตัวรับรุ่นชาวบ้าน (มม., y ขึ้น, พื้นโต๊ะ y=0, หน้า=+z, พอร์ต USB-C หันไปด้านหลัง -z)
 * opts.antenna : 'desk' (ค่าเริ่มต้น เสาตั้งบนโต๊ะ PoC) | 'none' (ไม่มีเสา : สายแปลงขั้วจบที่ userData.anchors.jackFeed ให้ลากสายเสาจากหลังคา)
 * opts.wires   : true (ค่าเริ่มต้น) วาดสาย 21 เส้นตาม wiring.md 3.2 เป็นกลุ่ม 'rx-wires' (ซ่อนได้)
 * userData : anchors, wires, antenna, statusLed {mesh, setOn(on, k)}, setPower('laptop'|'bank'), parts
 */
export function buildReceiver(T = THREE_DEFAULT, opts = {}) {
  const { antenna = 'desk', wires = true } = opts;
  const root = new T.Group();
  root.name = 'receiver';
  const f = new T.Group();                                                // กรอบแผ่น : หมุนให้แผ่นนอนบนโต๊ะ ชิ้นส่วนหันขึ้น
  f.name = 'rx-frame';
  f.rotation.x = -PI / 2;
  f.position.y = RXB.drop;
  root.add(f);

  f.add(rxBoardGroup(T));
  const mcu = rxSub(T, 'rx-mcu', 'mcu', RX_MCU_AT);
  const radio = rxSub(T, 'rx-radio', 'radio', RX_RADIO_AT);
  const pas = rxPassives(T);
  f.add(mcu, radio, pas);

  // ----- สายแปลงขั้ว IPEX -> SMA + ฐานยึดหัว SMA (+ เสา)
  const ant = new T.Group();
  ant.name = 'rx-antenna';
  {
    const k = kit(T, 'rx-antenna');
    const cab = S('wire-black', 0x151515, { rough: 0.7, metal: 0 });
    const metal = S('metal', C.silver);
    const P = RX_PINS['rx-radio.IPEX'];
    const E = RX_PINS['rx-antenna.cable'];
    k.tube([P, [P[0], P[1], P[2] + 5], [12, -12, 13], [26, -10, 12], [E[0] - 2, E[1], 6], [E[0], E[1], E[2]]], 0.6, cab, 40, 5);
    k.box(2.6, 2.6, 1.6, P[0], P[1], P[2] - 0.4, metal);                   // ปลั๊ก U.FL
    k.box(16, 16, RXB.drop + 6, RX_JACK[0], RX_JACK[1], (-RXB.drop + 6) / 2, S('plastic-dark', 0x2b2d2e));   // ฐานยึด
    let tip = 6 + 0;
    if (antenna === 'desk') tip = addRod(k, 'z', RX_JACK[0], RX_JACK[1], 6);
    else k.cyl('z', 3.2, 6, 14, RX_JACK[0], RX_JACK[1], metal, 12);        // หัว SMA เปล่า
    k.finish(ant);
    ant.userData.tip = [RX_JACK[0], RX_JACK[1], tip];
  }
  f.add(ant);

  // ----- สาย USB-C -> โน้ตบุ๊ก (PoC) และพาวเวอร์แบงก์ (ภาคสนาม)
  const usbC = (k, y0) => {
    const metal = S('metal', C.silver, { rough: 0.3 });
    const rub = S('rubber', 0x151515, { rough: 0.8, metal: 0 });
    const m = RX_PINS['rx-mcu.USB-C'];
    k.box(8.4, 16, 2.6, m[0], m[1] + 4, m[2], metal);                       // หัว USB-C (เสียบลึก ~4 มม.)
    k.box(12, 16, 7, m[0], m[1] + 20, m[2], rub);                           // ตัวครอบ
    return [m[0], m[1] + 28, m[2]];
  };
  const usb = new T.Group();
  usb.name = 'rx-usb';
  {
    const k = kit(T, 'rx-usb');
    const rub = S('rubber', 0x151515, { rough: 0.8, metal: 0 });
    const metal = S('metal', C.silver, { rough: 0.3 });
    const s = usbC(k);
    const Lp = RX_LAPTOP_PORT;
    k.tube([s, [0, 72, 2], [22, 88, -2.4], [70, 98, -2.5], [Lp[0] - 40, Lp[1] + 3, -1], [Lp[0] - 22, Lp[1], Lp[2]]], 1.6, rub, 60, 6);
    k.box(10, 14, 6, Lp[0] - 18, Lp[1], Lp[2], rub);                         // ตัวครอบหัว USB-A
    k.box(18, 12, 4.5, Lp[0] - 9, Lp[1], Lp[2], metal);                      // หัว USB-A เสียบพอร์ตซ้ายโน้ตบุ๊ก
    k.finish(usb);
  }
  f.add(usb);

  const bank = new T.Group();
  bank.name = 'rx-bank';
  const bankCable = new T.Group();
  bankCable.name = 'rx-bank-cable';
  bankCable.visible = false;
  {
    const k = kit(T, 'rx-bank');
    const bc = [-90, -10, -RXB.drop + 11];                                   // กลางพาวเวอร์แบงก์ 110 x 62 x 22
    k.box(110, 62, 22, bc[0], bc[1], bc[2], S('shell', 0xd8d6cf, { rough: 0.6, metal: 0 }));
    k.box(110.4, 2, 3, bc[0], bc[1] + 20, bc[2] + 6, S('plastic-dark', 0x2b2d2e));
    for (let i = 0; i < 4; i++) k.box(4, 1.2, 1, bc[0] - 12 + i * 8, bc[1] - 20, bc[2] + 11.05, S('shell', 0xb9b7ae, { rough: 0.5, metal: 0 }));   // ช่องแสดงระดับแบต (ไม่มีสี ไม่ใช่ LED)
    k.box(13, 1, 5.5, bc[0] + 20, bc[1] + 31.05, bc[2], S('plastic-dark', 0x161616));
    k.finish(bank);
    bank.userData.optional = true;
    const kc = kit(T, 'rx-bank-cable');
    const rub = S('rubber', 0x151515, { rough: 0.8, metal: 0 });
    const metal = S('metal', C.silver, { rough: 0.3 });
    const s = usbC(kc);
    const a = [bc[0] + 20, bc[1] + 31, bc[2]];
    kc.box(12, 13, 4.5, a[0], a[1] + 3, a[2], metal);                         // หัว USB-A เสียบพาวเวอร์แบงก์
    kc.box(14, 8, 8, a[0], a[1] + 12, a[2], rub);
    kc.tube([[a[0], a[1] + 16, a[2]], [a[0], a[1] + 28, -1], [-48, 64, -2.4], [-18, 70, -2.4], [-2, 66, 2], s], 1.6, rub, 50, 6);
    kc.finish(bankCable);
  }
  f.add(bank, bankCable);

  // ----- สายไฟตามผัง wiring.md 3.2
  const wg = new T.Group();
  wg.name = 'rx-wires';
  if (wires) {
    for (const net of RX_NETS) {
      if (net.from === 'laptop.USB' || net.from === 'rx-antenna.cable' || net.to === 'rx-antenna.cable') continue;   // สาย USB และสายแปลงขั้วเป็นชิ้นจริงข้างบนแล้ว
      const a = rxPoint(net.from, rxPoint(net.to));
      const b = rxPoint(net.to, a);
      const m = wireMesh(T, a, b, net.type, { radius: 0.45, tubular: 16 });
      m.name = `wire:${net.from}>${net.to}`;
      m.userData.net = { ...net };
      wg.add(m);
    }
  }
  f.add(wg);

  // ----- ไฟสถานะบนบอร์ด (LED ของ Super Mini)
  let ledMesh = null;
  mcu.traverse((n) => { if (n.isMesh && n.userData.mat === 'led') ledMesh = n; });
  const statusLed = {
    mesh: ledMesh,
    setOn(on, kk = 1) {
      if (!ledMesh) return;
      const m = ledMesh.material;
      m.emissive.setHex(0x2e6db4);
      m.emissiveIntensity = on ? 2.2 * kk : 0;
      m.color.setHex(on ? 0x6fa6ee : 0x2a6fd6);
    },
  };
  statusLed.setOn(false);

  const rxA = {};
  const put = (n, p) => { rxA[n] = toRx(p); };
  put('board', [0, 0, 0.8]);
  put('statusLed', addv(RX_MCU_AT, [4.8, -4.5, 1.1]));
  put('usbMouth', RX_PINS['rx-mcu.USB-C']);
  put('jackFeed', RX_PINS['rx-antenna.cable']);
  put('antennaBase', [RX_JACK[0], RX_JACK[1], 6]);
  put('antennaTip', ant.userData.tip);
  put('jackTop', [RX_JACK[0], RX_JACK[1], antenna === 'desk' ? 6 : 14]);
  put('mcu', RX_MCU_AT);
  put('radio', RX_RADIO_AT);
  put('laptopPort', RX_LAPTOP_PORT);
  put('bank', [-90, -10, -RXB.drop + 22]);

  root.userData = {
    ...root.userData, anchors: rxA, wires: wg, antenna: ant, usb, bank, bankCable, statusLed, parts: { mcu, radio, passives: pas },
    setPower(mode) { usb.visible = mode !== 'bank'; bankCable.visible = mode === 'bank'; },
  };
  return root;
}

// ---------------------------------------------------------------- โน้ตบุ๊ก
export const LAPTOP = {
  unit: 'mm', baseMm: [320, 16, 220], lidMm: [320, 215, 6], lidDeg: 105, screenMm: [300, 188], screenAspect: 300 / 188,
  usbPort: [-160, 8, -50],
};

/**
 * โน้ตบุ๊ก (มม.) origin = จุดสัมผัสโต๊ะกลางเครื่อง , +x ขวา , +y ขึ้น , หน้า (ขอบแป้นพิมพ์) = +z , จอหันมาทาง +z
 * userData.screen = Mesh 'laptop-screen' (Plane 300 x 188, MeshBasicMaterial) ใส่ CanvasTexture ที่ .material.map ; userData.anchors
 */
export function buildLaptop(T = THREE_DEFAULT) {
  const g = new T.Group();
  g.name = 'laptop';
  const [bw, bh, bd] = LAPTOP.baseMm;
  const [lw, lh, lt] = LAPTOP.lidMm;
  const k = kit(T, 'laptop');
  const alu = S('metal', 0xc4c8cc, { rough: 0.4, metal: 0.4 });
  const deck = S('plastic-dark', 0x2a2c2e);
  const key = S('plastic-dark', 0x3c4044);
  const pad = S('shell', 0xaeb3b7, { rough: 0.5, metal: 0.1 });
  k.box(bw, bh, bd, 0, bh / 2, 0, alu);
  k.box(284, 0.8, 124, 0, bh + 0.4, -34, deck);                                        // พื้นแป้นพิมพ์
  for (let r = 0; r < 6; r++) for (let c = 0; c < 14; c++) {
    if (r === 5 && c > 2 && c < 11) continue;                                          // แถวล่าง : เว้นไว้ใส่ spacebar
    k.box(15.5, 1.6, r === 0 ? 10 : 15.5, -123.5 + c * 19, bh + 1.4, -86 + r * 19 + (r === 0 ? 2.5 : 0), key);
  }
  k.box(120, 1.6, 15.5, 0, bh + 1.4, -86 + 5 * 19, key);                               // spacebar
  k.box(110, 0.6, 68, 0, bh + 0.3, 62, pad);                                           // แทร็กแพด
  for (const [a0, a1] of [[-130, -50], [50, 130]]) k.cyl('x', 4.5, a0, a1, bh - 1, -bd / 2 + 2, S('plastic-dark', 0x55595c), 12);   // บานพับ
  const [ux, uy, uz] = LAPTOP.usbPort;
  k.box(0.6, 5.8, 13.4, ux - 0.1, uy, uz, S('chip', 0x0c0c0c, { rough: 0.9, metal: 0 }));   // พอร์ต USB-A ด้านซ้าย
  k.finish(g);

  // ฝาจอ : หมุนรอบบานพับ (y=16, z=-110) เปิด 105 องศา
  const lid = new T.Group();
  lid.name = 'laptop-lid';
  lid.position.set(0, bh, -bd / 2);
  lid.rotation.x = -(LAPTOP.lidDeg - 90) * PI / 180;
  const kl = kit(T, 'laptop-lid');
  kl.box(lw, lh, lt, 0, lh / 2, -lt / 2, alu);
  kl.box(lw - 4, lh - 4, 0.6, 0, lh / 2, 0.3, S('chip', 0x111214, { rough: 0.5, metal: 0.1 }));   // ขอบจอดำ
  kl.cyl('z', 1.2, 0.2, 0.8, 0, lh - 6, S('chip', 0x2a2d30), 8);                       // กล้องเว็บแคม
  kl.finish(lid);
  const [sw, sh] = LAPTOP.screenMm;
  const sm = new T.MeshBasicMaterial({ color: 0x14171b, toneMapped: false });
  sm.userData.mat = 'screen';
  sm.userData.baseOpacity = 1;
  const screen = new T.Mesh(new T.PlaneGeometry(sw, sh), sm);
  screen.name = 'laptop-screen';
  screen.userData.mat = 'screen';
  screen.position.set(0, 14 + sh / 2 + 3, 0.7);
  lid.add(screen);
  g.add(lid);

  g.updateMatrixWorld(true);
  const c = new T.Vector3(0, 0, 0);
  screen.getWorldPosition(c);
  g.userData = {
    ...g.userData, screen, lid,
    anchors: { screenCenter: [c.x, c.y, c.z], usbPort: [...LAPTOP.usbPort], base: [0, bh, 0] },
    screenSize: [sw, sh], screenAspect: LAPTOP.screenAspect,
  };
  return g;
}

// ---------------------------------------------------------------- ห้อง อบต. ชั้นบนสุด (ภาพตัด, มม.) : เสาบนหลังคา + สายเสา + โต๊ะ + ตัวรับ + โน้ตบุ๊ก
const OF = { w: 4200, d: 3200, wallT: 150, slabT: 200, ceilH: 3000, mastH: 4500, deskTop: 750 };
const OF_MAST = [-170, -1250];                                         // เสาเหล็กตั้งบนหลังคา (x, z) ใกล้หลังห้อง เหนือโต๊ะตัวรับ → สายเสาสั้น
const OF_RX0 = [-200, OF.deskTop, -1000];                              // origin ตัวรับบนโต๊ะ
export const OFFICE = {
  unit: 'mm', ceilH: OF.ceilH, roofTopY: OF.ceilH + OF.slabT, mastTopY: OF.ceilH + OF.slabT + OF.mastH, mastBase: [OF_MAST[0], OF.ceilH + OF.slabT, OF_MAST[1]],
  deskTopY: OF.deskTop, receiverPos: OF_RX0, laptopPos: [OF_RX0[0] + RX_DESK.laptopPos[0], OF_RX0[1], OF_RX0[2] + RX_DESK.laptopPos[2]],
  view: { x: [-OF.w / 2, OF.w / 2], z: [-OF.d / 2, OF.d / 2] },
};

/**
 * ห้อง อบต. ชั้นบนสุดแบบภาพตัด (มม., y ขึ้น, ผิวพื้นชั้นนี้ y=0, เปิดด้านหน้า +z)
 * userData : anchors{antennaTip, feedTop, feedIn, rxJack, ceiling, desk}, receiver, laptop, mast, feeder (กลุ่มซ่อนได้)
 */
export function buildOfficeCutaway(T = THREE_DEFAULT) {
  const g = new T.Group();
  g.name = 'office-cutaway';
  const k = kit(T, 'office');
  const wallM = S('shell', 0xe7e5dd, { rough: 0.95, metal: 0 });
  const slabM = S('shell', 0xd6d3c9, { rough: 0.95, metal: 0 });
  const woodM = S('shell', 0xcbbf9f, { rough: 0.7, metal: 0 });
  const steel = S('metal', 0x8d9296, { rough: 0.45, metal: 0.5 });
  const dk = S('plastic-dark', 0x2b2d2e);
  const hw = OF.w / 2, hd = OF.d / 2, top = OF.ceilH + OF.slabT;
  k.box(OF.w + OF.wallT * 2, OF.slabT, OF.d + OF.wallT, 0, -OF.slabT / 2, -OF.wallT / 2, slabM);          // พื้น (หน้าตัดซ้าย-ขวา-หน้า)
  k.box(OF.w + OF.wallT * 2, OF.slabT, OF.d + OF.wallT, 0, OF.ceilH + OF.slabT / 2, -OF.wallT / 2, slabM);   // หลังคา
  k.box(OF.w, OF.ceilH, OF.wallT, 0, OF.ceilH / 2, -hd - OF.wallT / 2, wallM);                             // ผนังหลัง
  k.box(OF.wallT, OF.ceilH, OF.d + OF.wallT, -hw - OF.wallT / 2, OF.ceilH / 2, -OF.wallT / 2, wallM);       // ผนังซ้าย
  for (let n = 1; n <= 14; n++) k.box(OF.w, 1.2, 0.6, 0, 200 * n, -hd + 0.3, S('shell', 0xcfcdc4, { rough: 1, metal: 0 }));   // เส้นปูน
  k.box(OF.w + OF.wallT * 2, 90, 90, 0, top + 45, -hd - 20, wallM);                                         // ขอบกันตกหลังคาด้านหลัง
  // โต๊ะ
  const deskW = 1500, deskD = 800, dz = OF_RX0[2] + 150;
  k.box(deskW, 40, deskD, OF_RX0[0] + 250, OF.deskTop - 20, dz, woodM);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(50, OF.deskTop - 40, 50, OF_RX0[0] + 250 + sx * (deskW / 2 - 40), (OF.deskTop - 40) / 2, dz + sz * (deskD / 2 - 40), steel);
  // เสาเหล็กบนหลังคา + แป้นยึด + ฝาร้อยสาย
  k.cyl('y', 70, top, top + 12, OF_MAST[0], OF_MAST[1], steel, 20);
  k.cyl('y', 30, top + 12, top + OF.mastH, OF_MAST[0], OF_MAST[1], steel, 16);
  k.cyl('y', 22, top, top + 60, OF_MAST[0] + 130, OF_MAST[1], dk, 14);                                      // ฝาครอบร้อยสายเสาลงห้อง
  k.finish(g);
  g.traverse((n) => { if (n.isMesh && n.material.color.getHex() === 0xcfcdc4) n.userData.noOutline = true; });   // เส้นปูนไม่ต้องมีขอบหมึก

  const mastTop = top + OF.mastH;
  const ant = buildRxAntenna(T);
  ant.position.set(OF_MAST[0], mastTop, OF_MAST[1]);
  ant.name = 'office-antenna';
  g.add(ant);

  const rx = buildReceiver(T, { antenna: 'none' });
  rx.position.set(...OF_RX0);
  const lap = buildLaptop(T);
  lap.position.set(...OFFICE.laptopPos);
  g.add(rx, lap);

  // สายเสา (coax) : ปลายเสา -> ลงข้างเสา -> ลอดหลังคา -> ลงมาที่หัว SMA ของตัวรับ
  rx.updateMatrixWorld(true);
  const jack = rx.userData.anchors.jackTop;
  const J = [OF_RX0[0] + jack[0], OF_RX0[1] + jack[1], OF_RX0[2] + jack[2]];
  const cx = OF_MAST[0] + 130, cz = OF_MAST[1];
  const fk = kit(T, 'office-feeder');
  const coax = S('wire-black', 0x151515, { rough: 0.7, metal: 0 });
  const feed = [OF_MAST[0], mastTop - 24, OF_MAST[1]];
  fk.tube([feed, [OF_MAST[0] + 10, mastTop - 90, OF_MAST[1] + 40], [OF_MAST[0] + 45, mastTop - 300, OF_MAST[1] + 45], [cx, top + 700, cz + 20],
    [cx, top + 60, cz], [cx, OF.ceilH - 150, cz], [cx - 20, 1700, cz + 60], [J[0] - 120, 1000, J[2] - 60], [J[0] - 30, J[1] + 40, J[2] - 10], J], 2.4, coax, 160, 6);
  fk.box(14, 12, 14, J[0], J[1] - 2, J[2], S('metal', C.silver, { rough: 0.3 }));                         // ขั้ว SMA ปลายสายเสา
  const feeder = new T.Group(); feeder.name = 'office-feeder'; fk.finish(feeder); g.add(feeder);

  g.userData = {
    ...g.userData, receiver: rx, laptop: lap, mast: ant, feeder,
    anchors: {
      antennaTip: [OF_MAST[0], mastTop + ant.userData.anchors.tip[1], OF_MAST[1]],
      feedTop: feed, feedIn: [cx, top, cz], ceiling: [0, OF.ceilH, 0], desk: [OF_RX0[0] + 250, OF.deskTop, dz], rxJack: J,
      receiver: [...OF_RX0], laptop: [...OFFICE.laptopPos],
    },
    feederLengthMm: Math.round((mastTop - 24) - J[1] + Math.abs(cx - J[0]) + Math.abs(cz - J[2])),
  };
  return g;
}

// ---------------------------------------------------------------- แผนที่ชุมชนจำลอง (หน่วย = เมตร ; แยก scene/กล้องจากโมเดลกล่อง)
export const MAP_MAT_NAMES = ['map-ground', 'map-grid', 'map-flood', 'map-river', 'map-road', 'map-house', 'map-tree',
  'map-story', 'map-office', 'map-glass', 'map-ink'];

const MD = {
  bounds: { xMin: -1000, xMax: 1400, zMin: -1200, zMax: 1200 },
  story: { cx: -406, cz: 0, w: 12, h: 7.0, d: 10, upperFloorY: 3.6, boxH: 1.3 },
  office: { cx: 400, cz: 0, w: 26, d: 14, floors: 3, floorH: 3.8, roofT: 0.4, mastH: 4.5 },
  relay: { cx: 0, cz: -45, w: 11, h: 5.5, d: 9, mastH: 2.5 },
};
MD.office.h = MD.office.floors * MD.office.floorH;                       // 11.4
const OFF_ROOF = MD.office.h + MD.office.roofT;                          // 11.8 (ผิวบนแผ่นหลังคา)

export const MAP = {
  unit: 'm',
  distanceM: 800,                                                         // ระยะบ้านในเรื่อง -> อบต. : ค่าตั้งของแผนที่จำลอง (ไม่ใช่ระยะทดสอบ)
  plane: { cx: 200, cz: 0, size: 2400 },
  bounds: MD.bounds,
  houseAntenna: [MD.story.cx + MD.story.w / 2, MD.story.upperFloorY + MD.story.boxH, MD.story.cz],     // กล่องบนผนังตะวันออกของบ้านในเรื่อง
  rxAntenna: [MD.office.cx, +(OFF_ROOF + MD.office.mastH + ROD_LEN / 1000).toFixed(2), MD.office.cz],  // ปลายเสาตัวรับบนหลังคา อบต.
  relayHouse: [MD.relay.cx, MD.relay.h + 0.2 + MD.relay.mastH, MD.relay.cz],                          // ปลายเสาจิ๋วบนหลังบ้านข้างเคียง (แผนพัฒนา)
  relayHouseRoof: [MD.relay.cx, MD.relay.h + 0.2, MD.relay.cz],
  storyHouse: [MD.story.cx, 0, MD.story.cz],
  office: [MD.office.cx, 0, MD.office.cz],
  rxRoom: [MD.office.cx - 2, MD.office.floorH * 2 + 0.2 + 1.5, MD.office.cz],                          // ห้องชั้นบนสุดที่ตัวรับอยู่ (จุดซูมเข้าภาพตัด)
  roomToMapRotY: -PI / 2,                                                 // หมุนรอบ Y ที่พาแกนห้อง (-Z ออกนอกหน้าต่าง) ไปเป็น +X ของแผนที่ (ไป อบต.)
  houseCount: 64,
  names: { house: 'บ้านในเรื่อง', office: 'อบต.ตัวอย่าง (ชื่อสมมติ)', relay: 'บ้านข้างเคียง', river: 'แม่น้ำ (จำลอง)' },
  waterColor: WATER_COLOR,
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROADS = [   // [กว้าง, จุด[x,z]...]
  [10, [[-1000, 60], [-700, 52], [-400, 36], [0, 31], [400, 33], [800, 46], [1100, 62], [1400, 76]]],
  [7, [[-300, -1200], [-312, -500], [-300, 36], [-290, 500], [-318, 1200]]],
  [7, [[470, -1200], [466, -400], [470, 33], [480, 500], [470, 1200]]],
  [7, [[40, -1200], [36, -500], [44, 31], [40, 500], [52, 1200]]],
  [5, [[400, 33], [400, 9]]],
  [5, [[-402, 36], [-403, 7]]],
  [6, [[-310, -420], [-100, -390], [36, -420], [250, -380], [466, -400]]],
  [6, [[-300, 500], [-100, 540], [40, 500], [250, 520], [480, 500]]],
  [6, [[1100, 62], [1090, 500], [900, 900], [700, 1200]]],
  [6, [[800, 46], [820, -500], [700, -1200]]],
];
const RIVER = [[-760, -1200], [-640, -600], [-545, -150], [-565, 150], [-640, 550], [-430, 950], [-150, 1200]];
const RIVER_W = 56, FLOOD_W = 420;

function lineSamples(T, pts, n) {
  const c = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
  const p = c.getPoints(n);
  return p.map((v, i) => {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: v.x, z: v.z, tx: (b.x - a.x) / l, tz: (b.z - a.z) / l };
  });
}

/** แถบเรียบบนพื้น (ถนน/แม่น้ำ) : s = lineSamples ; คืน BufferGeometry (position + normal ชี้ขึ้น) */
function ribbonGeo(T, s, width, y) {
  const pos = [];
  const B = MD.bounds;
  const cl = ([x, z]) => [Math.min(B.xMax, Math.max(B.xMin, x)), Math.min(B.zMax, Math.max(B.zMin, z))];   // ไม่ให้แถบล้นพื้น
  const L = s.map((p) => cl([p.x + p.tz * width / 2, p.z - p.tx * width / 2]));
  const R = s.map((p) => cl([p.x - p.tz * width / 2, p.z + p.tx * width / 2]));
  for (let i = 0; i < s.length - 1; i++) {
    pos.push(L[i][0], y, L[i][1], R[i][0], y, R[i][1], L[i + 1][0], y, L[i + 1][1]);
    pos.push(R[i][0], y, R[i][1], R[i + 1][0], y, R[i + 1][1], L[i + 1][0], y, L[i + 1][1]);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
  return geo;
}

function mapMat(T, name, color, { opacity = 1, layer = 0, rough = 0.95 } = {}) {
  const m = new T.MeshStandardMaterial({ color, roughness: rough, metalness: 0, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  m.userData.mat = name;
  m.userData.baseOpacity = opacity;
  if (layer) { m.polygonOffset = true; m.polygonOffsetFactor = -layer; m.polygonOffsetUnits = -layer; }
  return m;
}
function lineMat(T, name, color, opacity = 1) {
  const m = new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  m.userData.mat = name;
  m.userData.baseOpacity = opacity;
  return m;
}
function tagMesh(m, name, matName) { m.name = name; m.userData.mat = matName; return m; }

/**
 * แผนที่ชุมชนจำลอง (เมตร, y ขึ้น, +x ตะวันออก, +z ใต้) : userData { story, office, relay, ground, grid, flood, river, roads, houses, trees, markers }
 * บ้านเพื่อนบ้านทั้งหมด = InstancedMesh เดียว , ต้นไม้ = InstancedMesh เดียว
 */
export function buildMap(T = THREE_DEFAULT) {
  const root = new T.Group();
  root.name = 'map';
  root.userData.map = MAP;
  const B = MD.bounds;
  const rnd = mulberry32(20261023);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * PI * rnd());

  // พื้นกระดาษ + ตารางกระดาษกราฟ (ย่อยทุก 50 ม., หลักทุก 200 ม.)
  const ground = tagMesh(new T.Mesh(new T.PlaneGeometry(MAP.plane.size, MAP.plane.size).rotateX(-PI / 2), mapMat(T, 'map-ground', 0xf3f2ee)), 'map-ground', 'map-ground');
  ground.position.set(MAP.plane.cx, 0, MAP.plane.cz);
  root.add(ground);
  const minor = [], major = [];
  for (let x = B.xMin; x <= B.xMax; x += 50) (x % 200 === 0 ? major : minor).push(x, 0.12, B.zMin, x, 0.12, B.zMax);
  for (let z = B.zMin; z <= B.zMax; z += 50) (z % 200 === 0 ? major : minor).push(B.xMin, 0.12, z, B.xMax, 0.12, z);
  const grid = new T.Group();
  grid.name = 'map-grid';
  for (const [arr, col, nm] of [[minor, 0xe4e2da, 'map-grid-minor'], [major, 0xc9c7bd, 'map-grid-major']]) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(arr), 3));
    const ls = new T.LineSegments(geo, lineMat(T, 'map-grid', col));
    ls.name = nm; ls.userData.mat = 'map-grid';
    grid.add(ls);
  }
  root.add(grid);

  // แม่น้ำ + โซนน้ำท่วม (สีน้ำเดียวกับระนาบน้ำฉาก 5)
  const river = lineSamples(T, RIVER, 120);
  const flood = tagMesh(new T.Mesh(ribbonGeo(T, river, FLOOD_W, 0.2), mapMat(T, 'map-flood', WATER_COLOR, { opacity: 0.16, layer: 1 })), 'map-flood', 'map-flood');
  const riv = tagMesh(new T.Mesh(ribbonGeo(T, river, RIVER_W, 0.3), mapMat(T, 'map-river', WATER_COLOR, { opacity: 0.85, layer: 2 })), 'map-river', 'map-river');
  flood.renderOrder = 1; riv.renderOrder = 2;
  root.add(flood, riv);

  // ถนน (แถบเทาบาง รวมเป็น mesh เดียว)
  const roadPts = [];
  const roadGeos = [];
  for (const [w, pts] of ROADS) {
    const s = lineSamples(T, pts, Math.max(8, Math.round(pts.length * 22)));
    roadPts.push(...s);
    roadGeos.push(ribbonGeo(T, s, w, 0.45));
  }
  const roads = tagMesh(new T.Mesh(mergeGeos(T, roadGeos), mapMat(T, 'map-road', 0xcdcbc2, { layer: 3 })), 'map-roads', 'map-road');
  roads.renderOrder = 3;
  root.add(roads);

  const near = (arr, x, z) => { let d = Infinity, q = null; for (const p of arr) { const e = Math.hypot(p.x - x, p.z - z); if (e < d) { d = e; q = p; } } return [d, q]; };
  const fixed = [[MD.story.cx, MD.story.cz, 38], [MD.office.cx, MD.office.cz, 48], [MD.relay.cx, MD.relay.cz, 32]];
  const free = (x, z, rr) => fixed.every(([fx, fz, r]) => Math.hypot(fx - x, fz - z) > r + rr);

  // บ้านเพื่อนบ้าน 64 หลัง (กล่องเทา ขนานถนนที่ใกล้ที่สุด)
  const houses = [];
  const clusters = [[-380, 20, 150, 0.46], [420, 25, 120, 0.2], [0, 0, 170, 0.14], [200, 0, 700, 0.2]];
  let guard = 0;
  while (houses.length < MAP.houseCount && guard++ < 20000) {
    let r = rnd(), c = clusters[clusters.length - 1];
    for (const cl of clusters) { if (r < cl[3]) { c = cl; break; } r -= cl[3]; }
    const x = c[0] + gauss() * c[2], z = c[1] + gauss() * c[2];
    if (x < B.xMin + 30 || x > B.xMax - 30 || z < B.zMin + 30 || z > B.zMax - 30) continue;
    const [dr] = near(river, x, z);
    if (dr < RIVER_W / 2 + 20) continue;
    const [dd, rp] = near(roadPts, x, z);
    if (dd < 14 || dd > 90) continue;
    if (!free(x, z, 8)) continue;
    if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 24)) continue;
    houses.push({ x, z, ry: -Math.atan2(rp.tz, rp.tx), w: 9 + rnd() * 6, d: 8 + rnd() * 4, h: 4 + rnd() * 3.5, shade: Math.floor(rnd() * 3) });
  }
  const hMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mapMat(T, 'map-house', 0xffffff), houses.length);
  hMesh.name = 'map-houses'; hMesh.userData.mat = 'map-house'; hMesh.frustumCulled = false;
  const dummy = new T.Object3D();
  const col = new T.Color();
  const SH = [0xbab8b0, 0xafada5, 0xc4c2ba];
  houses.forEach((h, i) => {
    dummy.position.set(h.x, 0.5, h.z); dummy.rotation.set(0, h.ry, 0); dummy.scale.set(h.w, h.h, h.d); dummy.updateMatrix();
    hMesh.setMatrixAt(i, dummy.matrix); hMesh.setColorAt(i, col.setHex(SH[h.shade]));
  });
  hMesh.instanceMatrix.needsUpdate = true;
  if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;
  root.add(hMesh);

  // กลุ่มต้นไม้ (กรวยต่ำ) ตามริมน้ำ + หมู่บ้าน
  const trees = [];
  const treeTry = (x, z) => {
    if (x < B.xMin + 15 || x > B.xMax - 15 || z < B.zMin + 15 || z > B.zMax - 15) return;
    if (near(river, x, z)[0] < RIVER_W / 2 + 6) return;
    if (near(roadPts, x, z)[0] < 9) return;
    if (!free(x, z, -10)) return;
    if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 11)) return;
    trees.push({ x, z, s: 0.8 + rnd() * 0.7 });
  };
  for (let i = 0; i < river.length; i += 4) { const p = river[i]; for (let n = 0; n < 3; n++) { const side = rnd() < 0.5 ? -1 : 1; const off = side * (RIVER_W / 2 + 12 + rnd() * 50); treeTry(p.x + p.tz * off + gauss() * 8, p.z - p.tx * off + gauss() * 8); } }
  for (let g = 0; g < 4000 && trees.length < 230; g++) { const cl = clusters[g % 3]; treeTry(cl[0] + gauss() * cl[2] * 1.3, cl[1] + gauss() * cl[2] * 1.3); }
  const tMesh = new T.InstancedMesh(new T.ConeGeometry(2.6, 7.5, 6).translate(0, 3.75, 0), mapMat(T, 'map-tree', 0xa9b5a0), trees.length);
  tMesh.name = 'map-trees'; tMesh.userData.mat = 'map-tree'; tMesh.frustumCulled = false;
  trees.forEach((t, i) => { dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(t.s, t.s, t.s); dummy.updateMatrix(); tMesh.setMatrixAt(i, dummy.matrix); });
  tMesh.instanceMatrix.needsUpdate = true;
  root.add(tMesh);

  const edges = (geo, color, nm) => { const l = new T.LineSegments(new T.EdgesGeometry(geo), lineMat(T, 'map-ink', color)); l.name = nm; l.userData.mat = 'map-ink'; return l; };
  const ring = (r0, r1, nm) => { const m = new T.Mesh(new T.RingGeometry(r0, r1, 64).rotateX(-PI / 2), mapMat(T, 'map-ink', INK, { layer: 4 })); m.position.y = 0.6; return tagMesh(m, nm, 'map-ink'); };

  // บ้านในเรื่อง : ขาว ขอบหมึกเข้ม วงกลมหมึกที่พื้น ; กล่องติดผนังตะวันออก
  {
    const s = MD.story, gr = new T.Group();
    gr.name = 'house-story';
    gr.position.set(s.cx, 0, s.cz);
    const body = tagMesh(new T.Mesh(new T.BoxGeometry(s.w, s.h, s.d).translate(0, s.h / 2, 0), mapMat(T, 'map-story', 0xfdfcf8)), 'story-body', 'map-story');
    const roof = tagMesh(new T.Mesh(new T.BoxGeometry(s.w + 1.2, 0.3, s.d + 1.2).translate(0, s.h + 0.15, 0), mapMat(T, 'map-story', 0xfdfcf8)), 'story-roof', 'map-story');
    const slab = tagMesh(new T.Mesh(new T.BoxGeometry(s.w + 0.3, 0.25, s.d + 0.3).translate(0, 3.5, 0), mapMat(T, 'map-story', 0xe9e7df)), 'story-floor-line', 'map-story');
    const win = tagMesh(new T.Mesh(new T.BoxGeometry(0.2, 1.2, 0.9).translate(s.w / 2, s.upperFloorY + 1.5, 1.0), mapMat(T, 'map-glass', 0x8e9aa3)), 'story-window', 'map-glass');
    const boxMk = tagMesh(new T.Mesh(new T.BoxGeometry(0.3, 0.3, 0.3).translate(s.w / 2 + 0.1, s.upperFloorY + s.boxH, 0), mapMat(T, 'map-ink', INK)), 'story-box', 'map-ink');
    gr.add(body, roof, slab, win, boxMk, edges(body.geometry, INK, 'story-edges'), edges(roof.geometry, INK, 'story-roof-edges'));
    const rg = ring(17, 19.5, 'story-ring'); rg.position.x = 0; gr.add(rg);
    root.add(gr);
    root.userData.story = gr;
  }

  // บ้านข้างเคียงกึ่งกลางทาง (แผนพัฒนา) : เส้นขอบเทา + เสาจิ๋วบนหลังคา
  {
    const r = MD.relay, gr = new T.Group();
    gr.name = 'house-relay';
    gr.position.set(r.cx, 0, r.cz);
    const body = tagMesh(new T.Mesh(new T.BoxGeometry(r.w, r.h, r.d).translate(0, r.h / 2, 0), mapMat(T, 'map-house', 0xf7f6f1)), 'relay-body', 'map-house');
    const roof = tagMesh(new T.Mesh(new T.BoxGeometry(r.w + 1, 0.2, r.d + 1).translate(0, r.h + 0.1, 0), mapMat(T, 'map-house', 0xf7f6f1)), 'relay-roof', 'map-house');
    const mast = tagMesh(new T.Mesh(new T.CylinderGeometry(0.1, 0.1, r.mastH, 6).translate(0, r.h + 0.2 + r.mastH / 2, 0), mapMat(T, 'map-ink', TXT2)), 'relay-mast', 'map-ink');
    gr.add(body, roof, mast, edges(body.geometry, TXT2, 'relay-edges'));
    root.add(gr);
    root.userData.relay = gr;
  }

  // อาคาร อบต. (ชื่อสมมติ ไม่มีโลโก้) : 3 ชั้น ขอบกันตกหลังคา เสาเหล็ก + เสาอากาศตัวรับ
  {
    const o = MD.office, gr = new T.Group();
    gr.name = 'office';
    gr.position.set(o.cx, 0, o.cz);
    const matO = mapMat(T, 'map-office', 0xece9e0);
    const body = tagMesh(new T.Mesh(new T.BoxGeometry(o.w, o.h, o.d).translate(0, o.h / 2, 0), matO), 'office-body', 'map-office');
    const roof = tagMesh(new T.Mesh(new T.BoxGeometry(o.w + 1.4, o.roofT, o.d + 1.4).translate(0, o.h + o.roofT / 2, 0), matO), 'office-roof', 'map-office');
    gr.add(body, roof, edges(body.geometry, INK, 'office-edges'), edges(roof.geometry, INK, 'office-roof-edges'));
    const ik = new T.Group(); ik.name = 'office-details';
    const glassG = [], lineG = [], inkG = [];
    for (let f = 0; f < o.floors; f++) {
      const y = f * o.floorH + 2.3;
      for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) glassG.push(new T.BoxGeometry(2.2, 1.6, 0.2).translate(-10 + i * 4, y, sz * (o.d / 2 + 0.02)));
      if (f > 0) lineG.push(new T.BoxGeometry(o.w + 0.3, 0.25, o.d + 0.3).translate(0, f * o.floorH, 0));
    }
    glassG.push(new T.BoxGeometry(5, 2.6, 0.2).translate(0, 1.4, o.d / 2 + 0.02));                          // ประตู
    lineG.push(new T.BoxGeometry(7, 0.3, 3).translate(0, 3.0, o.d / 2 + 1.5));                              // หลังคาทางเข้า
    inkG.push(new T.BoxGeometry(o.w + 1.4, 0.9, 0.3).translate(0, OFF_ROOF + 0.45, o.d / 2 + 0.55));
    inkG.push(new T.BoxGeometry(o.w + 1.4, 0.9, 0.3).translate(0, OFF_ROOF + 0.45, -o.d / 2 - 0.55));
    inkG.push(new T.BoxGeometry(0.3, 0.9, o.d + 1.4).translate(o.w / 2 + 0.55, OFF_ROOF + 0.45, 0));
    inkG.push(new T.BoxGeometry(0.3, 0.9, o.d + 1.4).translate(-o.w / 2 - 0.55, OFF_ROOF + 0.45, 0));
    inkG.push(new T.CylinderGeometry(0.12, 0.12, o.mastH, 8).translate(0, OFF_ROOF + o.mastH / 2, 0));       // เสาเหล็ก
    inkG.push(new T.CylinderGeometry(0.05, 0.05, ROD_LEN / 1000, 6).translate(0, OFF_ROOF + o.mastH + ROD_LEN / 2000, 0));   // เสาอากาศ 3 dBi
    ik.add(tagMesh(new T.Mesh(mergeGeos(T, glassG), mapMat(T, 'map-glass', 0x8e9aa3)), 'office-windows', 'map-glass'));
    ik.add(tagMesh(new T.Mesh(mergeGeos(T, lineG), mapMat(T, 'map-office', 0xd6d3c9)), 'office-floor-lines', 'map-office'));
    ik.add(tagMesh(new T.Mesh(mergeGeos(T, inkG), mapMat(T, 'map-ink', INK)), 'office-roof-gear', 'map-ink'));
    gr.add(ik);
    const rg = ring(25, 28, 'office-ring'); gr.add(rg);
    root.add(gr);
    root.userData.office = gr;
  }

  root.userData = {
    ...root.userData, ground, grid, flood, river: riv, roads, houses: hMesh, trees: tMesh,
    counts: { houses: houses.length, trees: trees.length },
  };
  return root;
}
