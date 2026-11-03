// เว็บเลื่อนแยกชิ้น 3D — ปุ่มเรียกเรือ รุ่น 2 (กล่องคุยสองทาง)
// Three.js วาดกล่อง, Anime.js (createTimeline + onScroll) ผูกจังหวะทั้งหมดเข้ากับการเลื่อน
// จังหวะทุกช่วงตาม exploded/storyboard.md (หน่วยเวลาในไทม์ไลน์: 1% ของการเลื่อน = 100 ms)
// ชิ้นส่วน ขา และสายทุกเส้นมาจาก parts.js (PARTS, NETS = docs/wiring.md ข้อ 3.1) ไม่เพิ่ม ไม่ตัด

const root = document.documentElement;
const query = new URLSearchParams(location.search);
const AT = query.has('at') ? clamp01(parseFloat(query.get('at')) || 0) : null;
const RECORD = query.get('record') === '1';
const REDUCED = root.classList.contains('reduced');
const FORCE_STILL = query.get('still') === '1';
const SHOT = query.get('shot') === '1';   // ใช้สร้างภาพนิ่ง img/v2-*.png: ซ่อนการ์ด จัดโมเดลกลางจอ
const IS_SMALL = matchMedia('(max-width: 720px)').matches;
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
const CALM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

const TOTAL = 10000;              // ความยาวไทม์ไลน์ (ms) = 100%
const SCROLL_SCREENS = 28;        // ความยาวการเลื่อนทั้งหน้า (เท่าของความสูงจอ)
const BOX_W = 200;                // หน่วยระยะกล้อง (มม.) = กล่อง 150 + เผื่อสายที่ห้อยลง ให้กรอบภาพตรงกับที่ storyboard ตั้งใจ (ระยะ = กี่เท่า)
const T = (pct) => pct * 100;     // % การเลื่อน -> เวลาในไทม์ไลน์
const DV = '<span class="dv-tag">ค่าออกแบบ จะปรับหลังทดสอบ</span>';

const steps = [...document.querySelectorAll('.step')].map((el) => ({
  el,
  id: el.dataset.step,
  from: +el.dataset.from / 100,
  to: +el.dataset.to / 100,
  at: +el.dataset.at,
  led: el.dataset.led || null,
  say: el.dataset.say || null,
  sayFrom: el.dataset.sayFrom ? +el.dataset.sayFrom / 100 : null,
  group: el.dataset.group ? +el.dataset.group : 0,
  shows: [...el.querySelectorAll('[data-show]')].map((n) => ({ n, from: +n.dataset.show / 100 })),
}));

function clamp01(v) { return Math.min(1, Math.max(0, v)); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------
// ข้อมูลป้ายชิ้นส่วน (ชื่อ · หน้าที่ · ราคา · งาน) ตาม storyboard ฉาก 3 — ใช้ทั้งป้ายเส้นชี้ 3D และรายการในการ์ด
// ---------------------------------------------------------------------------
const TAG_TH = { w: 'เตือน', s: 'ขอช่วย', a: 'ขอแทน' };
const PART_INFO = {
  'box-lid': { name: 'ฝา', fn: 'หน้ากล่องที่มองเห็นและกดได้ แสงไฟลอดรูรอบปุ่ม', price: 'รวมกับตัวกล่อง' },
  'btn-sos': { name: 'ปุ่มแดง', fn: `กดค้าง 2 วิ ขอความช่วยเหลือ ${DV}`, price: '75 บาท', tags: 's' },
  'btn-ack': { name: 'ปุ่มเขียว', fn: 'กดบอกว่า "ได้ยินแล้ว" กดสั้นฟังซ้ำ กดค้างแจ้งปลอดภัย', price: '60 บาท', tags: 'w' },
  leds: { name: 'ไฟ 8 ดวงรอบปุ่มแดง', fn: 'บอกด้วยสีว่าตอนนี้เป็นอย่างไร', price: '~19 บาท (รวมดวง 9)' },
  pcb: { name: 'แผ่นวงจร', fn: 'บัดกรีแน่น ไม่หลุดเพราะความชื้น', price: '12 บาท' },
  mcu: { name: 'สมอง', fn: 'ตัดสินใจ และเก็บเสียงพูดไว้ในตัว', price: '120 บาท' },
  radio: { name: 'วิทยุ', fn: 'ส่งและรับข้อความ ไม่ต้องใช้เสามือถือ', price: '≈ 145 บาท' },
  antenna: { name: 'เสาอากาศ', fn: 'ส่งสัญญาณถึงตัวรับของทีม', price: '50 บาท' },
  'q-power': { name: 'สวิตช์ตัดไฟ', fn: 'ปิดเสียงกับไฟตอนไม่ใช้ ให้ถ่านอยู่นาน', price: '~5 + 3 บาท' },
  diodes: { name: 'ตัวกันไฟย้อน', fn: 'สลับไฟบ้านกับถ่านเองตอนไฟดับ', price: '~4 บาท' },
  passives: { name: 'ชิ้นเล็กประกอบวงจร', fn: 'ตัวต้านทาน 12 + ตัวเก็บประจุ 7 ชิ้น', price: '~35 บาท' },
  amp: { name: 'ตัวขยายเสียง', fn: 'ทำให้เสียงพูดดังพอได้ยินทั้งบ้าน', price: '20 บาท', tags: 'w' },
  speaker: { name: 'ลำโพง', fn: 'พูดเตือนและบอกว่าเรือกำลังมา', price: '30 บาท', tags: 'ws' },
  led9: { name: 'ไฟดวงที่ 9 หันออกนอกบ้าน', fn: 'กะพริบให้เรือเห็นบ้านที่ขอ', price: 'รวมในไฟ 9 ดวง', tags: 's' },
  battery: { name: 'ถ่านไฟฉาย 3 ก้อน', fn: 'ไฟดับก็ยังทำงาน ซื้อถ่านได้ที่ร้านสะดวกซื้อ', price: '18 บาท' },
  'power-in': { name: 'สายจากหัวชาร์จมือถือ', fn: 'ใช้ไฟบ้านเป็นหลัก', price: 'ยังไม่รวม (ต้องเช็กราคา)' },
  'water-probe': { name: 'สายวัดน้ำ (เฉพาะบ้านติดเตียง)', fn: 'น้ำถึงปลายสาย กล่องรู้ทันที', price: '0 บาท', tags: 'a' },
  'box-body': { name: 'ตัวกล่องกันน้ำ', fn: 'ติดผนังจุดสูงสุดของบ้าน', price: '68 บาท' },
};
function metaHtml(info) {
  const pr = /\d/.test(info.price) ? `<span class="pr">${esc(info.price)}</span> (ประมาณการ)` : esc(info.price);
  const tags = (info.tags || 'wsa').split('').map((t) => `<span class="tg">${TAG_TH[t]}</span>`).join('');
  return `ราคา ${pr} ${tags}`;
}
document.querySelectorAll('[data-parts]').forEach((ul) => {
  ul.innerHTML = ul.dataset.parts.split(' ').map((id) => {
    const i = PART_INFO[id];
    return `<li><b>${esc(i.name)}</b> · ${i.fn}<span class="meta">${metaHtml(i)}</span></li>`;
  }).join('');
});

// ฉาก 4: รายการ 4 สี (คำกำกับต่างกันเสมอ ส้มกับเหลืองต่างทั้งรูปร่างและคำ)
const COLOR_ROWS = [
  ['orange', 'ส้ม', 'เตือน รอคนตอบ (กะพริบ)', 'blink'],
  ['green', 'เขียว', 'ได้ยินแล้ว / ช่วยเสร็จ', ''],
  ['red', 'แดง', 'ขอความช่วยเหลือ', ''],
  ['yellow', 'เหลือง', 'ทีมรับเรื่องแล้ว', 'sq'],
];
const HEX = { orange: '#E0701A', green: '#2F8A3E', red: '#D23B30', yellow: '#E8B400' };
document.querySelectorAll('.colors').forEach((ul) => {
  const cur = ul.dataset.cur;
  const say = ul.closest('.step').dataset.say;
  ul.innerHTML = COLOR_ROWS.map(([k, th, mean, shape]) => `<li${k === cur ? ' aria-current="true"' : ''}><i class="sw ${shape}" style="--c:${HEX[k]}"></i><span><b>${th}</b> · ${mean}</span>${k === cur && say ? `<span class="say">"${esc(say)}"</span>` : ''}</li>`).join('');
});

// ---------------------------------------------------------------------------
// ผังต่อสาย: กลุ่ม 6 กลุ่ม ป้ายขา และชื่อปลายสาย (ข้อความป้ายขาตาม storyboard ฉาก 3b เท่านั้น)
// ---------------------------------------------------------------------------
const GROUPS = [
  { n: 1, name: 'ไฟเลี้ยง', pins: [['mcu.GPIO1', 'GPIO1 → วัดถ่าน'], ['mcu.GPIO4', 'GPIO4 → สวิตช์ตัดไฟ']] },
  { n: 2, name: 'วิทยุ', pins: [['mcu.GPIO6', 'GPIO6 → วิทยุ SCK'], ['mcu.GPIO7', 'GPIO7 → วิทยุ MOSI'], ['mcu.GPIO5', 'GPIO5 ← วิทยุ MISO'], ['mcu.GPIO8', 'GPIO8 → วิทยุ NSS'], ['mcu.GPIO10', 'GPIO10 ← วิทยุ BUSY'], ['mcu.GPIO3', 'GPIO3 ← วิทยุ ปลุกสมอง']] },
  { n: 3, name: 'ปุ่ม + สายวัดน้ำ', pins: [['mcu.GPIO0', 'GPIO0 → ปุ่มแดง + สายวัดน้ำ (แดง)'], ['mcu.GPIO21', 'GPIO21 → สายวัดน้ำ (ดำ)'], ['mcu.GPIO2', 'GPIO2 → ปุ่มเขียว']] },
  { n: 4, name: 'ไฟสถานะ', pins: [['mcu.GPIO9', 'GPIO9 → ไฟ 8 ดวงรอบปุ่มแดง']] },
  { n: 5, name: 'เสียง', pins: [['mcu.GPIO20', 'GPIO20 → เสียง']] },
  { n: 6, name: 'ไฟกะพริบ', pins: [['leds9.DIN', 'ดวง 8 → ดวง 9 (หันออกนอกบ้าน)']] },
];
// ค่า R/C/D จาก docs/wiring.md (สรุปสั้น) — ค่าออกแบบ ยังไม่ได้ลองของจริง
const VAL = {
  R2: '100 kΩ', R3: '1 MΩ', R4: '1 MΩ', R5: '10 kΩ', R6: '10 kΩ', R7: '10 kΩ', R8: '330 Ω', R9: '2.2 kΩ', R10: '10 kΩ', R11: '100 kΩ', R12: '100 kΩ', R13: '1 kΩ',
  C1: '100 nF', C2: '100 nF', C4: '10 nF', C5: '1 µF', C6: '470 µF', C7: '10 µF', C8: '100 nF', D1: '1N5819', D2: '1N5819',
};
const PART_TH = {
  mcu: 'สมอง', radio: 'วิทยุ', 'power-in': 'ไฟบ้าน', battery: 'ถ่าน', 'q-power': 'สวิตช์ตัดไฟ', 'q-drive': 'ตัวขับสวิตช์',
  'btn-sos': 'ปุ่มแดง', 'btn-ack': 'ปุ่มเขียว', 'water-probe': 'สายวัดน้ำ', amp: 'ตัวขยายเสียง', speaker: 'ลำโพง', antenna: 'เสาอากาศ',
};
const isRail = (n) => n === 'gnd' || n.startsWith('rail.');
function nodeName(n) {
  if (n === 'gnd') return 'GND';
  if (n.startsWith('rail.')) return 'ราง ' + n.slice(5);
  const i = n.indexOf('.');
  const p = n.slice(0, i); const pin = n.slice(i + 1);
  if (/^[RCD]\d+$/.test(p)) return `${p} ${VAL[p] || ''} ·${pin}`;
  if (/^leds\d$/.test(p)) return `ไฟดวง ${p.slice(4)} ${pin}`;
  if (p === 'water-probe') return `สายวัดน้ำ (${pin === 'red' ? 'แดง' : 'ดำ'})`;
  if (p === 'antenna') return 'เสาอากาศ';
  return `${PART_TH[p] || p} ${pin}`;
}
function groupOf(net) {
  const s = net.from + ' ' + net.to;
  if (/leds9\./.test(s)) return 6;
  if (/leds\d\.|\bR8\.|GPIO9\b/.test(s)) return 4;
  if (/radio\.|\bC7\.|\bC8\.|\bR5\.|\bR6\.|antenna\./.test(s)) return 2;
  if (/btn-|water-probe|\bR7\.|\bR13\.|\bC1\./.test(s)) return 3;
  if (/amp\.|speaker\.|\bR9\.|\bC4\.|\bC5\.|GPIO20\b/.test(s)) return 5;
  return 1;
}
const TYPE_TH = { power: 'ไฟบวก', ground: 'กราวด์', data: 'ข้อมูล', audio: 'เสียง' };
const TYPE_HEX = { power: '#B4462F', ground: '#1F1F1D', data: '#2E6DB4', audio: '#7A4FB0' };

let NETS = null;   // มาจาก parts.js (โหลดทั้งโหมด 3D และภาพนิ่ง)
function flatGroupHtml(g) {
  const G = GROUPS[g - 1];
  const rows = NETS.filter((n) => groupOf(n) === g);
  return `<p class="fg-h">กลุ่ม ${g}/6 · ${G.name}</p>`
    + `<ul class="fg-pins">${G.pins.map((p) => `<li>${esc(p[1])}</li>`).join('')}</ul>`
    + `<p class="fg-n">สาย ${rows.length} เส้น</p>`
    + `<ol class="frows">${rows.map((n) => `<li class="frow${n.internal ? ' int' : ''}" style="--c:${TYPE_HEX[n.type]}"><span class="a">${esc(nodeName(n.from))}</span><i class="ln" title="${TYPE_TH[n.type]}"></i><span class="b">${esc(nodeName(n.to))}${n.internal ? '<span class="k">สายสั้นในชิ้นไฟ</span>' : ''}</span></li>`).join('')}</ol>`;
}

// ---------------------------------------------------------------------------
// ภาพนิ่ง (เครื่องที่เปิด 3D ไม่ได้)
// ---------------------------------------------------------------------------
async function useStills(reason) {
  clearTimeout(window.__fallbackTimer);
  root.classList.add('no3d');
  root.classList.remove('at', 'record', 'reduced');
  document.querySelectorAll('.still').forEach((img) => {
    img.loading = 'eager';
    img.addEventListener('error', () => img.remove(), { once: true });
    if (img.complete && img.naturalWidth === 0) img.remove();
  });
  if (reason) console.info('[exploded] ใช้ภาพนิ่ง:', reason);
  // ผังต่อสายแบบแบนในการ์ดแต่ละกลุ่ม (ข้อมูลชุดเดียวกับ 3D)
  try {
    if (!NETS) NETS = (await import('./parts.js')).NETS;
    document.querySelectorAll('.step.wire').forEach((el) => { el.querySelector('.flat-slot').innerHTML = flatGroupHtml(+el.dataset.group); });
  } catch (e) { console.warn('[exploded] โหลดตารางสายไม่ได้', e); }
  if (Sim) { Sim.setActive(true); Sim.enable2d(true); }
  // ภาพนิ่งแผนที่สัญญาณ: ต่อท้ายจอ Serial (อ่านเรียงลง: กล่อง → ปุ่ม → จอทีม → Serial → แผนที่)
  const mc = document.querySelector('.finale .mapcard');
  if (mc && Sim) Sim.card.appendChild(mc);
  const ser = document.getElementById('serial');
  if (ser) ser.open = true;
  // ป้าย "จำลอง" ย้ายไปอยู่หัวการ์ดลองใช้ (ที่เดียวของหน้า)
  const bs = document.getElementById('badgeSim');
  if (Sim) { Sim.card.prepend(document.getElementById('badgeFast')); Sim.card.prepend(bs); }
  bs.classList.add('on');
  root.dataset.ready = 'still';
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

// ---------------------------------------------------------------------------
// ฉาก 8 · กล่องเสมือน — ตัวคุมสถานะ ใช้ร่วมกันทั้งกล่อง 3D และกล่อง 2D สำรอง
// สถานะและคำพูดตาม docs/data-contract.md ข้อ 2–3 และตาราง "คำพูดของกล่อง" ใน docs/idea.md (คำต่อคำ)
// ---------------------------------------------------------------------------
const HOLD_MS = 2000;     // กดค้าง 2 วินาที (ค่าออกแบบ จะปรับหลังทดสอบ)
const WARN_RATE = 30;    // เดโมเร่งเวลา: นาทีจำลองต่อ 1 วินาที (6 ชม. = 12 วินาที)
const AUTO_RATE = 20;     // เดโมเร่งเวลา: 2 ชม. = 6 วินาที
const SILENT_MIN = 360;   // ไม่กดใน 6 ชม. = บ้านเงียบ (ค่าออกแบบ)
const AUTO_MIN = 120;     // น้ำถึงสาย + ไม่มีใครตอบ 2 ชม. (ค่าออกแบบ)
const REPEAT_MIN = 10;    // พูดเตือนซ้ำทุก 10 นาที (ค่าออกแบบ)
const PROBE_CM = 50;      // ปลายสายวัดน้ำแขวนที่ 50 ซม. (ค่าออกแบบ)
const SAY = {
  warn: 'เตือนภัยน้ำท่วม น้ำจะเข้าบ้านภายในพรุ่งนี้ ยกของขึ้นที่สูง พาคนป่วยขึ้นชั้นบน ได้ยินแล้วกดปุ่มเขียว',
  heard: 'ขอบคุณ ทีมรู้แล้วว่าบ้านนี้ได้ยิน',
  sos: 'ส่งขอความช่วยเหลือแล้ว รอสักครู่',
  retry: 'ยังส่งไม่ถึง กำลังลองใหม่',
  accepted: 'ทีมรับเรื่องแล้ว เรือกำลังมา อยู่บนที่สูง อย่าลงน้ำ',
  done: 'ทีมช่วยเหลือบ้านนี้เรียบร้อยแล้ว',
  auto: 'น้ำเข้าบ้านแล้ว กล่องขอความช่วยเหลือให้แล้ว',
  safe: 'ยกเลิกคำขอแล้ว ทีมรู้ว่าบ้านนี้ปลอดภัย',
};
// ----- วิทยุ LoRa (docs/data-contract.md ข้อ 4.1, 4.3–4.5) -----
// ระยะของกล่องเราเอง (เมตร) — ยังไม่ได้วัด: "รอผลทดสอบ 25 ต.ค." · ถ้าใส่ตัวเลขที่วัดจริง จะวาดวงที่ 2 "วัดจริง 25 ต.ค." บนแผนที่
const OUR_RANGE_M = null;
const HOUSE = 'บ้าน 7';             // ชื่อบ้านในเรื่อง (ข้อมูลสมมติในเดโม)
const UP_TYPE = { heard: 'HEARD', sos: 'SOS', auto: 'AUTO_SOS', safe: 'SAFE' };
// เวลาออกอากาศ ตามตาราง 4.3 ตรงตัว (ms)
const AIR_MS = { HEARD: 144, SOS: 144, AUTO_SOS: 144, SAFE: 144, ACK: 144, BOX_ACK: 144, WARN: 2180, ACCEPTED: 2160, DONE: 2160 };
const LONG_PRE = new Set(['WARN', 'ACCEPTED', 'DONE']);   // เสียงนำยาว (ต้องปลุกกล่อง) 4.4
const OFFLINE_MIN = 13 * 60;        // cfg.offline_h = 13 ชม. → "ขาดการติดต่อ" (ค่าออกแบบ)
const OFF_RATE = 200;               // เดโมเร่งเวลา: นาทีจำลองต่อ 1 วินาที (13 ชม. ≈ 4 วินาที)
const secTxt = (ms) => (ms / 1000).toFixed(2).replace(/0$/, '') + ' วิ';   // 144 → 0.14 วิ · 2180 → 2.18 วิ
const AIR_NOTE = {
  short: 'ออกอากาศ 0.14 วิ · คลื่นวิทยุถึงแทบทันที (ภาพช้าลงให้เห็น)',
  long: (ms) => `ออกอากาศ ${secTxt(ms)} · ข้อความที่ต้องปลุกกล่องยาว 2.2 วิ เพราะกล่องฟังเป็นช่วง ๆ`,
};
const MSG_TH = { HEARD: 'ได้ยินแล้ว', SOS: 'ขอช่วย', AUTO_SOS: 'ขอแทน', SAFE: 'ปลอดภัย', ACK: 'ได้รับแล้ว', BOX_ACK: 'กล่องได้รับแล้ว', WARN: 'คำเตือน', ACCEPTED: 'รับเรื่อง', DONE: 'ช่วยเสร็จ' };
const LINK_HOW = {
  good: 'ส่งครั้งแรกถึงตัวรับ ได้คำตอบกลับทันที',
  weak: 'ครั้งแรกคลื่นจางหายก่อนถึง กล่องรอฟัง 3 วิ แล้วสุ่มรอ 5–15 วิ ส่งใหม่เอง',
  down: 'ส่งไม่ถึงเลย กล่องลองซ้ำเองไปเรื่อย ๆ ตัวรับไม่รู้ว่ามีการส่ง',
};
// แหล่งที่มาของระยะ (docs/idea.md "กติกาตัวเลขและแหล่งที่มา" — ไม่ใช่ผลของกล่องเรา)
const SRC_CALLEBAUT = 'https://arxiv.org/abs/1909.08300';
const SRC_PETAJ = 'https://www.nokia.com/bell-labs/publications-and-media/publications/on-the-coverage-of-lpwans-range-evaluation-and-channel-attenuation-model-for-lora-technology/';
const MAPINFO_HTML = `<p class="mi-h">ระยะส่งของวิทยุแบบนี้</p>
<p class="mi-r"><i class="mi-ring"></i>ราว 1 กม. · ในเมือง เสาสูงแค่ 1.5 ม. — <a href="${SRC_CALLEBAUT}" target="_blank" rel="noopener">จากงานวิจัย (Callebaut et al. 2019)</a></p>
<p class="mi-r">พื้นที่โล่ง เสาตัวรับสูง: เกิน 15 กม. บนพื้น เกือบ 30 กม. บนผิวน้ำ — <a href="${SRC_PETAJ}" target="_blank" rel="noopener">จากงานวิจัย (Petäjäjärvi et al. 2015, 868 MHz)</a></p>
<p class="mi-r mi-our">${OUR_RANGE_M ? `<i class="mi-ring our"></i>ระยะของกล่องเรา: วัดจริง 25 ต.ค. ${(OUR_RANGE_M / 1000).toFixed(1)} กม.` : 'ระยะของกล่องเรา: <span class="wait-tag">รอผลทดสอบ 25 ต.ค.</span>'}</p>
<p class="mi-r">บ้านในเรื่อง → อบต. ≈ 0.8 กม. (แผนที่จำลอง)</p>
<p class="mi-p mono">923.2 MHz · SF9/BW125 · +14 dBm ${DV}</p>`;
// ตัวรับที่ อบต. (ป้าย ≤ 4 บรรทัด ภาษาง่าย)
const RX_HTML = `<ol><li>ตัวรับอยู่ที่ อบต. ชั้นบนสุด ต่อสาย USB เข้าโน้ตบุ๊กหน้าจอทีมช่วยเหลือ</li><li>เสาตั้งบนหลังคาจุดที่สูงที่สุด มองเห็นหมู่บ้าน เหนือระดับน้ำ</li><li>สายเสาให้สั้นที่สุด สายยาวกินสัญญาณ</li><li>ไฟดับใช้พาวเวอร์แบงก์</li></ol>`;
const RX_HTML_OFF = `<b>จอโน้ตบุ๊กที่ อบต.: ${HOUSE} ขาดการติดต่อ</b><br>ไม่ได้ยินกล่องเกิน 13 ชม. ${DV} ขึ้นบนสุดของรายการ ให้ อสม. ไปดู`;
const FONT_TH = '"Leelawadee UI", "Noto Sans Thai", Tahoma, sans-serif';
const COLOR_OF = { idle: null, warn: 'orange', heard: 'green', sos: 'red', accepted: 'yellow', done: 'green', auto_sos: 'red', safe: 'green' };
const SEND_COLOR = { heard: 'green', sos: 'red', auto: 'red', safe: 'green' };
const HOW = {
  warn: `ทีมกด "ส่งคำเตือน" บนจอทีมช่วยเหลือ กล่องจะไฟส้มและพูดเตือน ได้ยินแล้วกดปุ่มเขียว · ถ้าไม่กดใน <span class="nw">6 ชม.</span> ${DV} บ้านจะขึ้นในรายการบ้านที่ยังเงียบ`,
  sos: `กดปุ่มแดงค้างให้ครบ <span class="nw">2 วินาที</span> ${DV} แล้วดูจอทีมช่วยเหลือ · ปุ่มเขียวกดสั้นฟังซ้ำ กดค้าง <span class="nw">2 วินาที</span> แจ้งปลอดภัย`,
  auto: `บ้านนี้ลงทะเบียนว่ามีผู้ติดเตียง เลื่อนระดับน้ำขึ้น ถ้าน้ำถึงปลายสายแล้วไม่มีใครกดใน <span class="nw">2 ชม.</span> ${DV} กล่องจะขอความช่วยเหลือให้เอง`,
};
const Sim = createSim();

function createSim() {
  const card = document.getElementById('try');
  if (!card) return null;
  const $ = (id) => document.getElementById(id);
  const holdBtn = { red: $('holdRed'), green: $('holdGreen') };
  const how = $('tryHow');
  const tipEl = $('tryTip');
  const scrClock = $('scrClock'); const scrBody = $('scrBody'); const scrAct = $('scrAct'); const scrNote = $('scrNote');
  const muteBtn = $('tryMute');
  const linkBtns = [...card.querySelectorAll('[data-link]')]; const linkHow = $('linkHow');
  const serLog = $('serLog'); const serN = $('serN');
  const waterBox = $('tryWater'); const waterRange = $('waterRange'); const waterVal = $('waterVal');
  const tabs = [...card.querySelectorAll('.tab')];
  const badgeFast = $('badgeFast');
  const now = () => performance.now();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const timers = { tip: 0, tick: 0, note: 0 };
  const subs = [];
  const log = [];
  const note = (what) => { log.push(Math.round(now()) + ' ' + what); if (log.length > 80) log.shift(); };
  const S = {
    scen: 'warn', st: 'idle', send: null, link: 'good', active: false,
    warnSent: false, silent: false, heardN: 0, req: null, safeOnly: false,
    water: 0, wetAt: null, clock: { on: false, m0: 0, t0: 0, rate: 0 },
    last: '', bubble: '', talkUntil: 0, hold: null, lastWhich: 'red', tip: '', note: '',
    colorKey: '', colorT0: 0,
    gen: 0, seq: 11, trips: 0, busy: 0, retry: false, offline: false, offRun: false, fastWait: false, down: null,
  };

  // ----- เสียง: พูดภาษาไทยถ้าเครื่องมีเสียงไทย ไม่มีก็เสียงบี๊บ + ฟองคำพูด -----
  let muted = false;
  try { muted = localStorage.getItem('exploded-try-mute') === '1'; } catch (e) { /* ไม่มีที่เก็บก็ใช้ค่าเริ่ม */ }
  let voice = null;
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const pickVoice = () => { try { voice = synth.getVoices().find((v) => /^th(-|_|$)/i.test(v.lang)) || null; } catch (e) { voice = null; } };
  if (synth) { pickVoice(); try { synth.addEventListener('voiceschanged', pickVoice); } catch (e) { /* เบราว์เซอร์เก่า */ } }
  let ac = null;
  const SND = { ok: [[660, 110], [880, 160]], warn: [[740, 160], [560, 160], [740, 160]], retry: [[440, 140], [330, 200]], short: [[240, 180]], dup: [[520, 140]], replay: [[660, 90], [660, 90]], team: [[660, 110], [880, 110], [1100, 180]] };
  function beep(name) {
    if (muted || !SND[name]) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = ac || new AC();
      if (ac.state === 'suspended') ac.resume();
      let t = ac.currentTime + 0.02;
      for (const [f, ms] of SND[name]) {
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
        o.connect(g).connect(ac.destination);
        o.start(t); o.stop(t + ms / 1000 + 0.03);
        t += ms / 1000 + 0.05;
      }
    } catch (e) { /* เครื่องที่เล่นเสียงไม่ได้ ข้ามไป */ }
  }
  function speak(text, kind) {
    if (kind !== 'retry') S.last = text;
    S.bubble = text;
    S.talkUntil = now() + Math.max(2200, text.length * 90);
    note('say ' + text);
    sync();
    if (muted) return;
    if (synth && voice) {
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH'; u.voice = voice; u.rate = 0.95;
        synth.speak(u);
        return;
      } catch (e) { /* ใช้เสียงบี๊บแทน */ }
    }
    beep(kind || 'ok');
  }
  function setMuted(v) {
    muted = v;
    muteBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', v ? 'เปิดเสียง' : 'ปิดเสียง');
    muteBtn.classList.toggle('muted', v);
    if (v && synth) try { synth.cancel(); } catch (e) { /* ข้าม */ }
    try { localStorage.setItem('exploded-try-mute', v ? '1' : '0'); } catch (e) { /* ข้าม */ }
  }
  setMuted(muted);
  muteBtn.addEventListener('click', () => setMuted(!muted));

  // ----- นาฬิกาเร่งเวลา -----
  const clockMin = () => (S.clock.on ? S.clock.m0 + ((now() - S.clock.t0) / 1000) * S.clock.rate : S.clock.m0);
  function clockStart(rate, from) { S.clock = { on: true, m0: from ?? clockMin(), t0: now(), rate }; loopTick(); }
  function clockStop() { S.clock = { on: false, m0: clockMin(), t0: 0, rate: 0 }; }
  const hm = (m) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  function loopTick() {
    clearTimeout(timers.tick);
    if (!S.clock.on) return;
    const m = clockMin();
    if (S.st === 'warn' && !S.silent && m >= SILENT_MIN) {
      S.silent = true;
      note('silent'); sync();
      if (!S.offRun) { S.clock = { on: false, m0: SILENT_MIN, t0: 0, rate: 0 }; return; }
    }
    if (S.wetAt !== null && !S.send && !reqOpen() && m - S.wetAt >= AUTO_MIN) {
      S.clock = { on: false, m0: S.wetAt + AUTO_MIN, t0: 0, rate: 0 };
      S.wetAt = null;
      send('auto'); return;
    }
    renderClock();
    timers.tick = setTimeout(loopTick, 100);
  }
  function renderClock() {
    let txt = '';
    if (S.offRun || S.offline) {
      const m = Math.min(clockMin(), OFFLINE_MIN);
      txt = `เวลาจำลอง +${hm(m)} ชม. · ตัวรับไม่ได้ยินกล่องเลย · เงียบครบ 13 ชม. = ขาดการติดต่อ ${DV}`;
    } else if (S.clock.on || S.silent || S.wetAt !== null) {
      const m = clockMin();
      if (S.scen === 'warn' || S.st === 'warn') {
        const n = Math.floor(Math.min(m, SILENT_MIN) / REPEAT_MIN);
        txt = `เวลาจำลอง +${hm(Math.min(m, SILENT_MIN))} ชม. · พูดเตือนซ้ำทุก 10 นาที ครั้งที่ ${n}`;
      } else if (S.wetAt !== null) {
        txt = `น้ำถึงสาย · ไม่มีใครตอบมาแล้ว ${hm(Math.max(0, m - S.wetAt))} / 2:00 ชม.`;
      }
    }
    scrClock.hidden = !txt;
    if (scrClock.dataset.k !== txt) { scrClock.dataset.k = txt; scrClock.innerHTML = txt; }
  }

  // ----- วิทยุ: ทุกข้อความเดินผ่าน "ภาพ" (แผนที่สัญญาณใน 3D) ทีละข้อความ -----
  // ภาพตั้งต้น (ไม่มี 3D): ไม่มีแผนที่ เดินตามเวลาอย่างเดียว · ฉาก 3D แทนด้วย Sim.setVisual()
  const plainV = {
    async open() {}, async close() {}, async laptop() {}, abort() {}, rx() {}, text() {}, say() {},
    fly() { return wait(S.fastWait ? 120 : 450); },
  };
  let V = plainV;
  let chain = Promise.resolve();
  const queue = (fn) => { S.busy++; const g = S.gen; chain = chain.then(() => (g === S.gen ? fn(g) : null)).catch((e) => console.error(e)).finally(() => { S.busy = Math.max(0, S.busy - 1); sync(); }); return chain; };
  const clk0 = Date.UTC(2026, 9, 25, 7, 42, 0) - performance.now();   // เวลาบนจอ Serial (สมมติ)
  const serial = [];
  function serialLine(txt) {
    const d = new Date(clk0 + now());
    const ts = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}.${String(d.getUTCMilliseconds()).padStart(3, '0')}`;
    serial.push(ts + '  ' + txt);
    note('serial ' + txt);
    const li = document.createElement('li');
    li.innerHTML = `<time>${ts}</time><span>${esc(txt)}</span>`;
    serLog.appendChild(li);
    while (serLog.children.length > 30) serLog.firstChild.remove();
    li.scrollIntoView && serLog.scrollTo && serLog.scrollTo({ top: serLog.scrollHeight });
    serN.textContent = serial.length + ' บรรทัด';
    if (V.serial) V.serial(ts + '  ' + txt);
    subs.forEach((fn) => fn());
  }
  // ค่าความแรงสัญญาณสมมติ (อยู่ในช่วงของ data-contract 5.2: −140…−20 dBm / −20…+15 dB)
  const sig = (weak) => (weak
    ? { rssi: -118 - Math.round(Math.random() * 3), snr: (-6 - Math.round(Math.random() * 6) / 2).toFixed(1) }
    : { rssi: -103 - Math.round(Math.random() * 3), snr: (5.5 + Math.round(Math.random() * 4) / 2).toFixed(1) });
  const dbm = (v) => String(v).replace('-', '−');
  const airNote = (type) => (LONG_PRE.has(type) ? AIR_NOTE.long(AIR_MS[type]) : AIR_NOTE.short);

  // ข้อความขึ้น (กล่อง → ตัวรับ) ที่คนกด: ส่ง → ฟัง 3 วิ รอ ACK → ไม่ได้ → สุ่มรอ 5–15 วิ ส่งใหม่ seq เดิม (ข้อ 4.5)
  function send(what) {
    S.send = { what, tries: 0 };
    S.retry = false;
    S.seq = (S.seq + 1) & 255;
    const seq = S.seq;
    note('send ' + what);
    sync();
    queue(async (g) => {
      const alive = () => g === S.gen;
      const type = UP_TYPE[what];
      S.trips++;
      await V.open({ dir: 'up', type });
      for (let n = 1; alive(); n++) {
        S.send.tries = n;
        const ok = S.link === 'good' || (S.link === 'weak' && n >= 2);
        V.text(`กล่องส่ง "${MSG_TH[type]}" (${type}) ครั้งที่ ${n}`, airNote(type));
        await V.fly({ dir: 'up', type, ok, n });
        if (!alive()) return;
        if (ok) {
          const r = sig(S.link === 'weak');
          serialLine(`รับ ${type}  ${HOUSE}  seq ${seq}  ครั้งที่ ${n}  RSSI ${dbm(r.rssi)} dBm  SNR ${dbm(r.snr)} dB`);
          V.rx();
          received(what);
          sync();
          if (V !== plainV) await wait((RECORD && window.__recordSkip) ? 0 : 300);
          if (!alive()) return;
          serialLine(`ส่ง ACK → ${HOUSE}  ${secTxt(AIR_MS.ACK)}`);
          V.text(`ตัวรับตอบ "${MSG_TH.ACK}" (ACK) กลับไปที่กล่อง`, AIR_NOTE.short);
          await V.fly({ dir: 'down', type: 'ACK', ok: true });
          break;
        }
        // ไม่ได้ ACK — ตัวรับไม่รู้ว่ามีการส่ง (จอ Serial ไม่มีอะไรเข้า)
        const w = 5 + Math.floor(Math.random() * 11);
        if (S.link === 'down' && n === 3) { S.retry = true; speak(SAY.retry, 'retry'); V.say(SAY.retry); setTip('กล่องกำลังลองส่งใหม่เอง · จอทีมช่วยเหลือไม่รู้ว่ามีการส่ง'); }
        if (S.link === 'down' && n >= 5) {
          V.text('ครบ 5 ครั้ง กล่องยังลองต่อเองทุก 60 วิ แล้วทุก 5 นาที · ตัวรับไม่รู้เลยว่ากล่องส่งมา', `${DV}`);
          S.offRun = true; S.fastWait = true;
          clockStart(OFF_RATE, Math.max(0, clockMin()));
          while (alive() && clockMin() < OFFLINE_MIN) await wait(100);
          if (!alive()) return;
          S.offRun = false; S.fastWait = false;
          S.clock = { on: false, m0: OFFLINE_MIN, t0: 0, rate: 0 };
          S.offline = true;
          note('offline');
          sync();
          await V.laptop();
          break;
        }
        S.fastWait = true; sync();
        V.text(`ไม่ได้คำตอบ · กล่องฟังรอ 3 วิ แล้วสุ่มรอ ${w} วิ ส่งใหม่ (seq เดิม ครั้งที่ ${n + 1})`, 'เดโมเร่งเวลา');
        await wait(V === plainV ? 900 : 1300);
        S.fastWait = false;
        if (!alive()) return;
      }
      if (!alive()) return;
      await V.close();
      if (!alive()) return;
      if (S.offline) { sync(); return; }   // ยังส่งไม่ถึง: กล่องยังลองต่อ (สถานะ retry ที่กล่องเท่านั้น)
      boxGot(what);
    });
  }
  // ตัวรับได้ข้อความ → จอทีมช่วยเหลืออัปเดต
  function received(what) {
    if (what === 'heard') { S.silent = false; S.heardN = 1; clockStop(); }
    else if (what === 'sos') {
      if (reqOpen()) S.req.dup = (S.req.dup || 0) + 1;
      else { S.req = { kind: 'sos', state: 'open' }; S.safeOnly = false; }
    } else if (what === 'auto') { S.req = { kind: 'auto', state: 'open', confirmed: false }; S.safeOnly = false; }
    else if (what === 'safe') {
      if (S.req && (S.req.state === 'open' || S.req.state === 'accepted')) {
        if (S.req.kind === 'auto') S.req.cancel = true;      // บ้านติดเตียง: ไม่ปิดคำขอ ทีมต้องโทรยืนยัน
        else S.req.state = 'safe';
      } else S.safeOnly = true;
      S.wetAt = null; clockStop();
    }
  }
  // กล่องได้ ACK → ไฟเปลี่ยน + พูด
  function boxGot(what) {
    if (S.retry) setTip('');
    S.send = null; S.retry = false;
    S.note = '';
    if (what === 'heard') { S.st = 'heard'; speak(SAY.heard); }
    else if (what === 'sos') { S.st = 'sos'; speak(SAY.sos); }
    else if (what === 'auto') { S.st = 'auto_sos'; speak(SAY.auto); }
    else if (what === 'safe') { S.st = 'safe'; speak(SAY.safe); }
    sync();
  }
  const reqOpen = () => !!S.req && (S.req.state === 'open' || S.req.state === 'accepted') && !S.req.cancel;

  // ข้อความลง (ตัวรับ → กล่อง): WARN / ACCEPTED / DONE ใช้เสียงนำยาว · ACCEPTED/DONE กล่องตอบ BOX_ACK (ข้อ 4.4)
  function sendDown(type, onBox) {
    S.down = type;
    sync();
    queue(async (g) => {
      const alive = () => g === S.gen;
      S.trips++;
      serialLine(`ส่ง ${type} → ${type === 'WARN' ? 'ทุกบ้าน' : HOUSE}  ${secTxt(AIR_MS[type])}`);
      await V.open({ dir: 'down', type });
      const ok = S.link !== 'down';
      V.text(`ตัวรับส่ง "${MSG_TH[type]}" (${type}) ไปที่กล่อง`, airNote(type));
      await V.fly({ dir: 'down', type, ok });
      if (!alive()) return;
      if (ok && type !== 'WARN') {
        const r = sig(S.link === 'weak');
        V.text(`กล่องตอบ "${MSG_TH.BOX_ACK}" (BOX_ACK)`, AIR_NOTE.short);
        await V.fly({ dir: 'up', type: 'BOX_ACK', ok: true });
        if (!alive()) return;
        serialLine(`รับ BOX_ACK  ${HOUSE}  RSSI ${dbm(r.rssi)} dBm  SNR ${dbm(r.snr)} dB`);
        V.rx();
      }
      await V.close();
      if (!alive()) return;
      S.down = null;
      if (ok) onBox();
      else { S.note = 'คำสั่งยังไปไม่ถึงกล่อง ตัวรับจะส่งซ้ำเอง'; sync(); }
    });
  }

  // ----- ทีมช่วยเหลือกดบนจอ (ทิศลง) -----
  function team(action) {
    if (action === 'warn') {
      S.warnSent = true; S.silent = false; S.heardN = 0;
      sendDown('WARN', () => {
        S.st = 'warn';
        clockStart(WARN_RATE, 0);
        speak(SAY.warn, 'warn');
        sync();
      });
    } else if (action === 'confirm' && S.req && S.req.kind === 'auto') {
      S.req.confirmed = true; beep('team');
    } else if (action === 'accept' && reqOpen() && S.req.state === 'open') {
      S.req.state = 'accepted';
      sendDown('ACCEPTED', () => { S.st = 'accepted'; speak(SAY.accepted, 'team'); });
    } else if (action === 'done' && S.req && S.req.state === 'accepted') {
      S.req.state = 'done';
      sendDown('DONE', () => { S.st = 'done'; speak(SAY.done, 'team'); });
    } else if (action === 'cancel_ok' && S.req && S.req.cancel) {
      S.req.state = 'safe'; S.req.cancel = false; beep('team');
    } else return;
    note('team ' + action);
    sync();
  }
  function setLink(v) {
    if (!LINK_HOW[v]) return;
    S.link = v;
    linkBtns.forEach((b) => b.setAttribute('aria-checked', b.dataset.link === v ? 'true' : 'false'));
    linkHow.textContent = LINK_HOW[v];
    note('link ' + v);
    sync();
  }
  linkBtns.forEach((b) => b.addEventListener('click', () => setLink(b.dataset.link)));

  // ----- น้ำ (เรื่องขอแทน) -----
  function setWater(v) {
    S.water = Math.max(0, Math.min(60, v));
    if (+waterRange.value !== Math.round(S.water)) waterRange.value = Math.round(S.water);
    const wet = S.water >= PROBE_CM;
    if (wet && S.wetAt === null && !reqOpen() && !S.send && S.st !== 'safe' && S.st !== 'done') {
      S.wetAt = S.clock.on ? clockMin() : 0;
      if (!S.clock.on) clockStart(AUTO_RATE, 0);
      S.note = 'น้ำถึงปลายสายแล้ว กล่องเริ่มนับเวลา';
      note('wet');
    } else if (!wet && S.wetAt !== null) {
      S.wetAt = null; clockStop();
      S.note = 'น้ำลดต่ำกว่าปลายสาย กล่องหยุดนับ';
    }
    sync();
  }
  waterRange.addEventListener('input', () => setWater(+waterRange.value));

  // ----- เลือกเรื่อง / เริ่มใหม่ -----
  function select(scen) {
    holdEnd(true);
    for (const k in timers) clearTimeout(timers[k]);
    if (synth) try { synth.cancel(); } catch (e) { /* ข้าม */ }
    S.gen++;
    V.abort();
    Object.assign(S, {
      scen, st: 'idle', send: null, warnSent: false, silent: false, heardN: 0, req: null, safeOnly: false,
      water: 0, wetAt: null, clock: { on: false, m0: 0, t0: 0, rate: 0 }, last: '', bubble: '', talkUntil: 0, tip: '', note: '',
      retry: false, offline: false, offRun: false, fastWait: false, down: null,
    });
    waterRange.value = 0;
    card.dataset.scen = scen;
    tabs.forEach((t) => t.setAttribute('aria-selected', t.dataset.scen === scen ? 'true' : 'false'));
    how.innerHTML = HOW[scen];
    waterBox.hidden = scen !== 'auto';
    note('select ' + scen);
    sync();
  }
  tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.scen)));
  $('tryReset').addEventListener('click', () => select(S.scen));

  // ----- จอทีมช่วยเหลือ (จำลอง) -----
  const DOT = { open: 'red', accepted: 'yellow', done: 'green', safe: 'green' };
  function screenHtml() {
    let h = '';
    if (S.offline) h += `<p class="scr-sub">ขาดการติดต่อ (ขึ้นบนสุด)</p><ul class="scr-list"><li><i class="dot silent"></i><span class="nm">${HOUSE}<small>ไม่ได้ยินกล่องเกิน 13 ชม. ${DV} ให้ อสม. ไปดู</small></span><span class="st">ขาดการติดต่อ</span></li></ul>`;
    if (S.warnSent) {
      h += `<div class="scr-count"><div><b>${S.heardN}</b><span>ได้ยินแล้ว</span></div><div><b>${S.silent ? 1 : 0}</b><span>ยังเงียบ</span></div></div>`;
      if (S.silent && !S.offline) h += `<p class="scr-sub">บ้านที่ยังเงียบ</p><ul class="scr-list"><li><i class="dot silent"></i><span class="nm">${HOUSE}<small>ไม่กดใน 6 ชม. ให้ อสม. ไปเคาะประตู</small></span><span class="st">ยังเงียบ</span></li></ul>`;
      else if (S.st === 'warn' && !S.heardN && !S.offline) h += `<ul class="scr-list"><li><i class="dot orange"></i><span class="nm">${HOUSE}<small>เตือนแล้ว รอกดปุ่มเขียว</small></span><span class="st">รอตอบ</span></li></ul>`;
    }
    if (S.req) {
      const r = S.req;
      const word = r.cancel ? 'ยกเลิกโดยบ้าน ควรโทรยืนยัน'
        : r.state === 'open' ? (r.kind === 'auto' ? (r.confirmed ? 'ขอแทน · อสม. ยืนยันแล้ว' : 'ขอแทน · รอ อสม. ยืนยัน') : 'ขอช่วย · รอรับเรื่อง')
          : r.state === 'accepted' ? 'รับเรื่องแล้ว' : r.state === 'done' ? 'ช่วยเสร็จ' : 'ปลอดภัย (บ้านแจ้ง)';
      const me = `<li><span class="no">1</span><i class="dot ${DOT[r.state]}"></i><span class="nm">${HOUSE}${r.kind === 'auto' ? '<small>ผู้ติดเตียง · กล่องขอให้เอง</small>' : ''}</span><span class="st">${word}</span></li>`;
      const other = r.kind === 'auto' ? '<li><span class="no">2</span><i class="dot red"></i><span class="nm">บ้านอื่น<small>ตัวอย่างในจอจำลอง</small></span><span class="st">ขอช่วย · รอรับเรื่อง</span></li>' : '';
      h += `<p class="scr-sub">คำขอความช่วยเหลือ (เรียงตามลำดับ)</p><ul class="scr-list">${me}${other}</ul>`;
    } else if (S.safeOnly) {
      h += `<ul class="scr-list"><li><i class="dot green"></i><span class="nm">${HOUSE}</span><span class="st">ปลอดภัย (บ้านแจ้ง)</span></li></ul>`;
    }
    if (!h) h = `<p class="scr-empty">ยังไม่มีข้อความจาก ${HOUSE}</p>`;
    return h;
  }
  // จอโน้ตบุ๊กที่ อบต. (แดชบอร์ดย่อ 3 แถว) — บ้าน 3 / บ้าน 12 เป็นตัวอย่างในจอจำลอง
  function laptopRows() {
    let me = ['ปกติ', 'idle'];
    const r = S.req;
    if (S.offline) me = ['ขาดการติดต่อ', 'silent'];
    else if (r && r.cancel) me = ['ยกเลิกโดยบ้าน ควรโทรยืนยัน', 'green'];
    else if (r && r.state === 'open') me = [r.kind === 'auto' ? 'ขอแทน · รอยืนยัน' : 'ขอช่วย · รอรับเรื่อง', 'red'];
    else if (r && r.state === 'accepted') me = ['รับเรื่องแล้ว', 'yellow'];
    else if (r && (r.state === 'done' || r.state === 'safe')) me = [r.state === 'done' ? 'ช่วยเสร็จ' : 'ปลอดภัย (บ้านแจ้ง)', 'green'];
    else if (S.safeOnly) me = ['ปลอดภัย (บ้านแจ้ง)', 'green'];
    else if (S.silent) me = ['ยังเงียบ', 'silent'];
    else if (S.heardN) me = ['ได้ยินแล้ว', 'green'];
    else if (S.warnSent) me = ['เตือนแล้ว · รอตอบ', 'orange'];
    return [[HOUSE, ...me], ['บ้าน 3', 'ปกติ', 'idle'], ['บ้าน 12', 'ปกติ', 'idle']];
  }
  function actions() {
    const a = [];
    if (S.scen === 'warn' && S.st !== 'warn' && !reqOpen()) a.push(['warn', S.warnSent ? 'ส่งคำเตือนอีกครั้ง' : 'ส่งคำเตือน']);
    if (S.req && S.req.kind === 'auto' && S.req.state === 'open' && !S.req.confirmed && !S.req.cancel) a.push(['confirm', 'อสม. ยืนยัน']);
    else if (reqOpen() && S.req.state === 'open') a.push(['accept', 'รับเรื่อง']);
    if (S.req && S.req.state === 'accepted' && !S.req.cancel) a.push(['done', 'ช่วยเสร็จ']);
    if (S.req && S.req.cancel) a.push(['cancel_ok', 'โทรยืนยันแล้ว ปิดคำขอ']);
    return a;
  }
  let actKey = '';
  scrAct.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) team(b.dataset.act); });

  function sync() {
    card.dataset.st = S.st;
    const body = screenHtml();
    if (scrBody.innerHTML !== body) scrBody.innerHTML = body;
    const acts = actions();
    const k = acts.map((x) => x[0]).join(',');
    if (k !== actKey) { actKey = k; scrAct.innerHTML = acts.map(([id, txt]) => `<button type="button" class="btn-ink" data-act="${id}">${txt}</button>`).join(''); }
    let n = S.note;
    // จอทีมช่วยเหลือไม่รู้ว่ากล่องกำลังส่ง (ส่งไม่ถึง = รู้ได้แค่ที่กล่อง)
    if (S.down) n = 'กำลังส่งคำสั่งไปที่กล่อง';
    if (scrNote.textContent !== n) scrNote.textContent = n;
    if (tipEl.innerHTML !== S.tip) tipEl.innerHTML = S.tip;
    waterVal.textContent = Math.round(S.water) + ' ซม.';
    renderClock();
    badgeFast.classList.toggle('on', S.active && (S.clock.on || S.silent || S.wetAt !== null || S.fastWait || S.offRun));
    card.classList.toggle('retrying', !!S.retry);
    subs.forEach((fn) => fn());
  }
  function setTip(html, ms) {
    clearTimeout(timers.tip);
    S.tip = html;
    if (ms) timers.tip = setTimeout(() => { S.tip = ''; sync(); }, ms);
    sync();
  }

  // ----- กดค้าง / กดสั้น -----
  function holdStart(which, src) {
    if (!S.active && root.classList.contains('no3d')) { setActive(true); enable2d(true); }
    if (!S.active || S.hold) return false;
    S.hold = { which, src, t0: now(), done: false };
    S.lastWhich = which;
    note('hold ' + which + ' ' + src);
    holdBtn[which].classList.add('holding');
    if (S.tip) setTip('');
    requestAnimationFrame(tick);
    sync();
    return true;
  }
  function holdEnd(silent) {
    const h = S.hold;
    if (!h) return;
    S.hold = null;
    const ms = Math.round(now() - h.t0);
    note('release ' + h.which + ' ' + h.src + ' ' + ms + 'ms' + (h.done ? '' : ' (ไม่ครบ)'));
    holdBtn[h.which].classList.remove('holding');
    holdBtn[h.which].style.setProperty('--p', '0');
    if (!h.done && !silent) {
      if (h.which === 'red') { beep('short'); setTip(`กดค้างให้ครบ 2 วินาที ${DV}`, 2600); }
      else shortGreen();
    }
    sync();
  }
  const progress = () => (S.hold ? Math.min(1, (now() - S.hold.t0) / HOLD_MS) : 0);
  function tick() {
    const h = S.hold;
    if (!h) return;
    const k = progress();
    holdBtn[h.which].style.setProperty('--p', k.toFixed(3));
    if (k >= 1 && !h.done) { h.done = true; complete(h.which); }
    if (!h.done) requestAnimationFrame(tick);
    subs.forEach((fn) => fn());
  }
  // มีคนกดปุ่มระหว่างน้ำถึงสาย = มีคนอยู่ กล่องเริ่มนับ 2 ชม. ใหม่
  function someoneHere() {
    if (S.wetAt === null) return false;
    S.wetAt = clockMin();
    S.note = 'มีคนกดปุ่ม กล่องเริ่มนับ 2 ชม. ใหม่';
    return true;
  }
  function complete(which) {
    if (which === 'red') {
      if (S.wetAt !== null) { S.wetAt = null; clockStop(); }
      const pending = S.send && (S.send.what === 'sos' || S.send.what === 'auto');
      if (reqOpen() || pending) { beep('dup'); S.note = 'กดซ้ำ ไม่เกิดคำขอใหม่ · 1 บ้าน = 1 คำขอ'; note('dup'); sync(); return; }
      send('sos');
    } else {
      someoneHere();
      send(S.st === 'warn' ? 'heard' : 'safe');
    }
  }
  function shortGreen() {
    if (S.st === 'warn') { send('heard'); return; }
    if (someoneHere()) { sync(); }
    if (S.last) speak(S.last, 'replay');
    else setTip('ยังไม่มีข้อความให้ฟังซ้ำ', 2000);
  }
  function reset() { select(S.scen); }
  function setActive(on) {
    if (S.active === on) return;
    S.active = on;
    if (!on) select(S.scen);
  }

  // ปุ่มบนจอ (กดค้างด้วยนิ้ว / เมาส์ / คีย์บอร์ด) ไม่ให้หน้าเลื่อนหรือขึ้นเมนูคลิกขวา
  function bindHold(el, which, src) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ข้าม */ }
      holdStart(which, src);
    });
    const up = () => { if (S.hold && S.hold.src === src && S.hold.which === which) holdEnd(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); holdStart(which, 'key'); }
    });
    el.addEventListener('keyup', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && S.hold && S.hold.src === 'key') { e.preventDefault(); holdEnd(); }
    });
    el.addEventListener('blur', () => { if (S.hold && S.hold.src === 'key') holdEnd(); });
  }
  bindHold(holdBtn.red, 'red', 'ui');
  bindHold(holdBtn.green, 'green', 'ui');

  // ----- ไฟ (ใช้ร่วมกันทั้ง 3D และ 2D) -----
  // คืน { hex, lit: ดวงที่ติดแล้ว 0..8 (ติดทีละดวง), on: ความสว่าง (กะพริบ), l9: ดวงที่ 9 }
  function lamp(t) {
    let c = COLOR_OF[S.st]; let on = 1; let lit = 8; let mode = S.st;
    if (S.hold && !S.hold.done) {
      // ระหว่างกดค้าง: ไฟค่อย ๆ ติดทีละดวงตามเวลาที่กด
      c = S.hold.which === 'red' ? 'red' : 'green';
      return { hex: HEX[c], lit: 8 * progress(), on: 1, l9: l9Of(t), color: c };
    }
    if (S.send) { c = SEND_COLOR[S.send.what]; mode = 'send'; if (!CALM) on = (t % 320) < 170 ? 1 : 0.08; }
    else if (S.st === 'warn' && !CALM) on = (t % 1400) < 900 ? 1 : 0.1;
    const key = (c || '-') + mode;
    if (key !== S.colorKey) { S.colorKey = key; S.colorT0 = t; }
    if (!c) return null;
    if (!CALM) lit = Math.min(8, (t - S.colorT0) / 70);
    return { hex: HEX[c], lit, on, l9: l9Of(t), color: c };
  }
  function l9Of(t) {
    const want = S.st === 'sos' || S.st === 'auto_sos' || S.st === 'accepted' || (S.send && (S.send.what === 'sos' || S.send.what === 'auto'));
    if (!want) return 0;
    return CALM ? 1 : ((t % 1200) < 220 ? 1 : 0.08);
  }
  function key(t) {
    const L = lamp(t);
    return S.st + '|' + (L ? Math.floor(L.lit * 2) + ':' + L.on + ':' + L.l9 + L.hex : '-') + '|' + (S.hold ? progress().toFixed(3) : '') + '|' + Math.round(S.water) + bubble() + talking();
  }
  function bubble() { return S.bubble || null; }
  function talking() { return now() < S.talkUntil; }

  // ----- กล่อง 2D สำรอง -----
  const box2d = $('box2d');
  const b2svg = box2d ? box2d.querySelector('svg') : null;
  const b2 = { leds: [], bubble: $('b2Bubble'), prog: $('b2Prog'), glow: $('b2Glow'), l9: $('b2L9'), water: $('b2Water'), raf: 0, key: '' };
  if (box2d) {
    const g = $('b2Leds');
    for (let i = 0; i < 8; i++) {
      const a = ((112.5 - 45 * i) * Math.PI) / 180;   // ดวง 1 บนซ้าย เรียงตามเข็มนาฬิกา (เหมือน parts.js)
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', (-25 + 40 * Math.cos(a)).toFixed(2));
      c.setAttribute('cy', (-40 * Math.sin(a)).toFixed(2));
      c.setAttribute('r', '4.2');
      g.appendChild(c);
      b2.leds.push(c);
    }
    bindHold($('b2Red'), 'red', 'b2');
    bindHold($('b2Green'), 'green', 'b2');
  }
  let use2d = false;
  function draw2d() {
    b2.raf = 0;
    if (!use2d || !box2d) return;
    const t = now();
    const k = key(t);
    if (k !== b2.key) {
      b2.key = k;
      const L = lamp(t);
      b2.leds.forEach((c, i) => { c.style.fill = L && L.lit > i + 0.5 && L.on > 0.5 ? L.hex : ''; });
      box2d.style.setProperty('--glow', L && L.on > 0.5 ? L.hex : 'transparent');
      box2d.classList.toggle('lit', !!L && L.on > 0.5 && L.lit > 1);
      b2.l9.style.fill = L && L.l9 > 0.5 ? (HEX[L.color] || '') : '';
      const txt = bubble();
      if (b2.bubble.textContent !== (txt || '')) b2.bubble.textContent = txt || '';
      b2.bubble.classList.toggle('on', !!txt);
      const hp = S.hold && !S.hold.done ? progress() : 0;
      b2.prog.style.strokeDashoffset = (100 - hp * 100).toFixed(1);
      b2.prog.classList.toggle('on', hp > 0);
      b2.prog.setAttribute('cx', S.hold && S.hold.which === 'green' ? 47 : -25);
      b2.prog.setAttribute('cy', S.hold && S.hold.which === 'green' ? 10 : 0);
      b2.prog.setAttribute('r', S.hold && S.hold.which === 'green' ? 26 : 33);
      b2.prog.style.transformOrigin = S.hold && S.hold.which === 'green' ? '47px 10px' : '-25px 0px';
      box2d.classList.toggle('press-red', !!S.hold && S.hold.which === 'red');
      box2d.classList.toggle('press-green', !!S.hold && S.hold.which === 'green');
      const wh = S.scen === 'auto' ? S.water * 1.24 : 0;   // 50 ซม. = ปลายสาย (y 118) พื้นที่ y 180
      b2.water.setAttribute('y', (180 - wh).toFixed(1));
      b2.water.setAttribute('height', wh.toFixed(1));
      box2d.classList.toggle('auto', S.scen === 'auto');
      // สายวัดน้ำมีเฉพาะบ้านติดเตียง: เรื่องอื่นตัดภาพเหลือแค่ตัวกล่อง
      b2svg.setAttribute('viewBox', S.scen === 'auto' ? '-100 -100 200 282' : '-100 -84 200 168');
    }
    if (animating()) b2.raf = requestAnimationFrame(draw2d);
  }
  function animating() {
    return !!S.hold || !!S.send || (now() - S.colorT0 < 700) || (!CALM && (S.st === 'warn' || S.st === 'sos' || S.st === 'accepted' || S.st === 'auto_sos')) || talking();
  }
  function enable2d(on) {
    use2d = on;
    if (on && !b2.raf) b2.raf = requestAnimationFrame(draw2d);
  }
  subs.push(() => { if (use2d && !b2.raf) b2.raf = requestAnimationFrame(draw2d); });

  select('warn');
  setLink('good');
  const mi2 = $('mapInfo2d');
  if (mi2) mi2.innerHTML = MAPINFO_HTML;
  if (IS_SMALL) $('serial').open = false;   // มือถือ: จอ Serial พับไว้ก่อน แตะหัวข้อเพื่อเปิด

  // ตัวช่วยทดสอบ (checker): window.__try
  window.__try = {
    mode: '2d',
    get st() { return S.st; },
    get scen() { return S.scen; },
    get screen() { return scrBody.textContent + ' | ' + scrNote.textContent; },
    get bubble() { return S.bubble; },
    get log() { return log.slice(); },
    get clock() { return clockMin(); },
    get link() { return S.link; },
    get serial() { return serial.slice(); },
    get laptop() { return laptopRows().map((r) => r.slice(0, 2).join(' · ')).join(' | '); },
    get busy() { return S.busy > 0; },
    get retry() { return S.retry; },
    get offline() { return S.offline; },
    get tries() { return S.send ? S.send.tries : 0; },
    select, team, setWater, setLink,
    setFail(on) { setLink(on ? 'down' : 'good'); },
    hold(which, ms) {
      return new Promise((res) => {
        holdStart(which || 'red', 'test');
        setTimeout(() => { if (S.hold && S.hold.src === 'test') holdEnd(); res(S.st); }, ms ?? HOLD_MS + 150);
      });
    },
    reset,
  };

  return {
    card, holdBtn,
    get scen() { return S.scen; },
    get st() { return S.st; },
    get hold() { return S.hold; },
    get active() { return S.active; },
    get tip() { return S.tip; },
    get lastWhich() { return S.lastWhich; },
    get water() { return S.water; },
    get fast() { return S.clock.on || S.silent || (S.wetAt !== null); },
    get busy() { return S.busy > 0; },
    get trips() { return S.trips; },
    get offline() { return S.offline; },
    get link() { return S.link; },
    holdStart, holdEnd, progress, team, select, setWater, reset, setActive, setLink,
    lamp, key, bubble, talking, animating, enable2d, laptopRows,
    setVisual(v) { V = v || plainV; },
    idle: async () => { while (S.busy > 0) await wait(100); },
    onChange(fn) { subs.push(fn); },
  };
}

if (FORCE_STILL) useStills('?still=1');
else if (!hasWebGL()) useStills('ไม่มี WebGL');
else start().catch((err) => { console.error(err); useStills('โหลดส่วน 3D ไม่สำเร็จ'); });

// ---------------------------------------------------------------------------
async function start() {
  const [THREE, anime] = await Promise.all([import('three'), import('animejs')]);
  const { createTimeline, onScroll } = anime;

  // ถ้า parts.js โหลดไม่ได้ จะโยน error ออกไป แล้วหน้าเปลี่ยนเป็นภาพนิ่งเอง (ไม่แสดงโมเดลปลอม)
  const mod = await import('./parts.js');
  NETS = mod.NETS;
  const partList = mod.createParts(THREE);

  // ----- three.js -----
  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_SMALL || IS_TOUCH ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 5, 6000);
  // แสงนุ่มแบบภาพเทคนิค ไม่ใช้เงาจริง (ประหยัดมือถือ)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b6ad, 2.0));
  const keyL = new THREE.DirectionalLight(0xffffff, 1.2);
  keyL.position.set(300, 520, 600);
  scene.add(keyL);
  const fillL = new THREE.DirectionalLight(0xffffff, 0.35);
  fillL.position.set(-500, 150, 200);
  scene.add(fillL);

  const model = new THREE.Group();
  scene.add(model);

  // ----- วัสดุสไตล์ภาพเทคนิคขาว-เทา (อ่านชนิดจาก mesh.userData.mat) -----
  const PALETTE = {
    shell: { color: 0xe9e8e3, rough: 0.85 },
    pcb: { color: 0xd3d6cf, rough: 0.8 },
    chip: { color: 0x4f524f, rough: 0.6 },
    metal: { color: 0x9a9c99, rough: 0.35, metal: 0.45 },
    rubber: { color: 0x5e605d, rough: 0.95 },
    screen: { color: 0x1f1f1d, rough: 0.15 },
    led: { color: 0xd9d6b8, rough: 0.5 },
    window: { color: 0xdde3e5, rough: 0.3, opacity: 0.32 },
    'wire-red': { color: 0xb4462f, rough: 0.7 },
    'wire-black': { color: 0x2b2b29, rough: 0.7 },
    wire: { color: 0x2e6db4, rough: 0.7 },
    'plastic-dark': { color: 0x6b6d69, rough: 0.8 },
  };
  // ปุ่มสองปุ่มคงสีจริง (คำบรรยายเรียกด้วยสี)
  const TRUE_COLOR = { 'btn-sos': 0xd23b30, 'btn-ack': 0x2f8a3e };
  const EDGE_TAGS = new Set(['shell', 'pcb', 'screen', 'plastic-dark']);
  const makeMat = (tag, color) => {
    const d = PALETTE[tag] || PALETTE.shell;
    const m = new THREE.MeshStandardMaterial({
      color: color ?? d.color, roughness: d.rough, metalness: d.metal || 0,
      transparent: d.opacity !== undefined, opacity: d.opacity ?? 1, depthWrite: d.opacity === undefined,
    });
    m.userData.tag = tag;
    m.userData.baseOpacity = m.opacity;
    m.userData.baseTransparent = m.transparent;
    m.userData.baseColor = m.color.clone();
    return m;
  };

  // แทนวัสดุทั้งชิ้น + รวมเส้นขอบบาง ๆ ของทั้งชิ้นเป็นเส้นชุดเดียว (วาดครั้งเดียวต่อชิ้น เบาบนมือถือ)
  // ดวงไฟของ leds ไม่แทน (ใช้ ledApi ของ parts.js คุมสี)
  function restyle(obj, id) {
    obj.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    const mats = [];
    const cache = new Map();
    const edgePos = [];
    const old = [];
    obj.traverse((n) => { if (n.isLineSegments || n.isLine) old.push(n); });
    old.forEach((n) => n.parent && n.parent.remove(n));
    const ledMats = new Set((obj.userData.leds && obj.userData.leds.materials) || []);
    // เส้นขอบรวมแยกตามกลุ่มย่อย (ไฟดวง 9, ฝาราง/ถ่าน) ให้เส้นขอบเลื่อนตามชิ้นย่อย
    const subOf = (mesh) => { for (let p = mesh.parent; p && p !== obj; p = p.parent) if (p === obj.userData.led9 || p === obj.userData.cover || p === obj.userData.cells) return p; return obj; };
    const edgeBy = new Map();
    obj.traverse((mesh) => {
      if (!mesh.isMesh) return;
      if (ledMats.has(mesh.material)) return;
      const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (src && src.userData && src.userData.noFade) { mesh.visible = false; return; }
      const tag = mesh.userData.mat || (src && src.userData && src.userData.mat) || 'shell';
      const trueCol = mesh.userData.accent && TRUE_COLOR[id] !== undefined ? TRUE_COLOR[id] : undefined;
      const keyName = tag + (trueCol !== undefined ? ':t' : '');
      let m = cache.get(keyName);
      if (!m) { m = makeMat(tag, trueCol); cache.set(keyName, m); mats.push(m); }
      mesh.material = m;
      if (EDGE_TAGS.has(tag) && mesh.geometry) {
        const host = subOf(mesh);
        const hostInv = host === obj ? inv : new THREE.Matrix4().copy(host.matrixWorld).invert();
        const eg = new THREE.EdgesGeometry(mesh.geometry, 35);
        const rel = new THREE.Matrix4().multiplyMatrices(hostInv, mesh.matrixWorld);
        const arr = eg.attributes.position.array;
        const v = new THREE.Vector3();
        if (!edgeBy.has(host)) edgeBy.set(host, []);
        const out = edgeBy.get(host);
        for (let i = 0; i < arr.length; i += 3) { v.set(arr[i], arr[i + 1], arr[i + 2]).applyMatrix4(rel); out.push(v.x, v.y, v.z); }
        eg.dispose();
      }
    });
    void edgePos;
    if (edgeBy.size) {
      const lm = new THREE.LineBasicMaterial({ color: 0x5f5e5a, transparent: true, opacity: 0.5, depthWrite: false });
      lm.userData.baseOpacity = 0.5; lm.userData.baseTransparent = true; lm.userData.edge = true;
      mats.push(lm);
      for (const [host, pos] of edgeBy) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        host.add(new THREE.LineSegments(g, lm));
      }
    }
    return mats;
  }

  // ----- ชิ้นส่วน -----
  const parts = {};
  for (const p of partList) {
    const obj = p.object;
    const A = vec(THREE, p.assembled);
    const E = vec(THREE, p.exploded || p.assembled);
    obj.position.copy(A);
    model.add(obj);
    const mats = restyle(obj, p.id);
    const sub = {};
    for (const [name, s] of Object.entries(p.sub || {})) {
      const sg = obj.userData[name];
      if (sg) sub[name] = { g: sg, base: sg.position.clone(), rel: vec(THREE, s.offset).sub(E.clone().sub(A)) };
    }
    parts[p.id] = {
      id: p.id, name: p.name, obj, A, E, mats, sub, rY: obj.rotation.y,   // มุมหมุนตอนประกอบ (ลำโพงหมุน 90° ตาม parts.js)
      anchors: (p.anchors || [p.anchor]).map((a) => vec(THREE, a)),
      center: new THREE.Vector3(), opacity: 1,
    };
  }
  model.updateMatrixWorld(true);
  for (const id in parts) {
    const P = parts[id];
    const box = new THREE.Box3().setFromObject(P.obj);
    box.getCenter(P.center).sub(P.obj.position);
    P.localBox = box.clone().translate(P.obj.position.clone().negate());
  }
  const has = (id) => !!parts[id];
  const ids = Object.keys(parts);

  // ขา -> ชิ้น (ชื่อขาตาม parts.js / docs/wiring.md)
  const PIN_PART = {};
  for (const p of mod.PARTS) for (const n of Object.keys(p.pins || {})) PIN_PART[n] = p.id;

  // ----- ไฟ 9 ดวง: สีจาก ledApi ของ parts.js + แสงเรืองทีละดวง (sprite ผสมสีปกติ ให้เห็นบนพื้นสว่าง) -----
  const glowTex = makeGlowTexture(THREE);
  const ledApi = has('leds') ? parts.leds.obj.userData.leds : null;
  const LED_OFF = new THREE.Color(0xd9d6b8);
  const ledSprites = [];
  let halo = null;
  if (ledApi) {
    const ring = parts.leds.obj.userData.ring;
    const side = parts.leds.obj.userData.led9;
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
      const c = ledApi.positions[i];
      if (i < 8) s.position.set(c[0], c[1], c[2] + 12);         // หน้าฝา (แสงลอดรูรอบปุ่ม) ยกพ้นผิวฝา กันแสงถูกฝาตัดตอนมองเฉียง
      else s.position.set(c[0] + 6, c[1], c[2]);                // ดวง 9 หันออกทาง +X
      s.scale.set(i < 8 ? 17 : 26, i < 8 ? 17 : 26, 1);
      s.renderOrder = 10;
      (i < 8 ? ring : side).add(s);
      ledSprites.push(s);
    }
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    halo.position.set(0, 0, 8);
    halo.scale.set(150, 150, 1);
    halo.renderOrder = 9;
    ring.add(halo);
  }
  const ledCol = new THREE.Color();
  let ledKey = '';
  // L = { col: THREE.Color, lit 0..8, on 0..1, l9 0..1 }
  function applyLeds(L) {
    if (!ledApi) return;
    const k = L ? L.col.getHexString() + '|' + L.lit.toFixed(2) + '|' + L.on.toFixed(2) + '|' + L.l9.toFixed(2) : '-';
    if (k === ledKey) return;
    ledKey = k;
    const M = ledApi.materials;
    for (let i = 0; i < 9; i++) {
      const v = !L ? 0 : i < 8 ? clamp01(L.lit - i) * L.on : L.l9;
      if (v > 0.01) {
        ledCol.copy(LED_OFF).lerp(L.col, Math.min(1, v * 1.3));
        M[i].color.copy(ledCol); M[i].emissive.copy(L.col); M[i].emissiveIntensity = 1.6 * v;
      } else { M[i].color.copy(LED_OFF); M[i].emissive.setRGB(0, 0, 0); M[i].emissiveIntensity = 0; }
      const s = ledSprites[i];
      if (L) s.material.color.copy(L.col);
      s.material.opacity = 0.95 * v;
      s.visible = v > 0.01;
    }
    if (halo) {
      const hv = L ? (L.lit / 8) * L.on : 0;
      if (L) halo.material.color.copy(L.col);
      halo.material.opacity = (IS_SMALL ? 0.14 : 0.18) * hv;
      halo.visible = hv > 0.01;
    }
  }

  // ----- ผังต่อสาย: ตำแหน่งชิ้นตอนดูสาย -----
  // เหมือนเปิดฝากล่องจริงแล้ววางคว่ำไว้ข้างกล่อง: ชั้นฝา (ปุ่มสองปุ่ม + ไฟ 8 ดวง) พลิก 180° รอบขอบซ้าย ให้เห็นขาสวิตช์และแผ่นต่อสายของไฟ
  // ไฟดวง 9 ติดผนังขวาของตัวกล่อง จึงอยู่ที่เดิม · ฝากับตัวกล่องซ่อน
  const FLIP = new Set(['btn-sos', 'btn-ack', 'leds']);
  const PIV = [-80, 0, 40];
  const flipV = (v) => [2 * PIV[0] - v[0], v[1], 2 * PIV[2] - v[2]];
  const wpos = (pin) => {
    const w = mod.pinWorld(pin);
    return FLIP.has(PIN_PART[pin]) && !pin.startsWith('leds9.') ? flipV(w) : w;
  };
  const WIRE_HEX = { power: 0xb4462f, ground: 0x1f1f1d, data: 0x2e6db4, audio: 0x7a4fb0 };
  const TUBULAR = 28; const RADIAL = 5;
  const wireRoot = new THREE.Group();
  model.add(wireRoot);
  const wireGroups = [];   // [{ n, mats:{type:Material}, meshes:[], parts:Set }]
  for (let g = 1; g <= 6; g++) wireGroups.push({ n: g, mats: {}, meshes: [], parts: new Set(['mcu']), rc: new Map() });
  for (const net of NETS) {
    const G = wireGroups[groupOf(net) - 1];
    for (const end of [net.from, net.to]) {
      if (isRail(end)) { G.parts.add('pcb'); continue; }
      const pid = PIN_PART[end];
      if (pid) G.parts.add(pid);
      const rc = end.slice(0, end.indexOf('.'));
      if (/^[RCD]\d+$/.test(rc)) { if (!G.rc.has(rc)) G.rc.set(rc, []); G.rc.get(rc).push(end); }
    }
    if (net.internal) continue;   // สายสั้นดวง 1→8 อยู่ในชิ้นไฟแล้ว (นับรวมในกลุ่ม 4)
    const pa = isRail(net.from) ? null : wpos(net.from);
    const pb = isRail(net.to) ? null : wpos(net.to);
    const a = pa || mod.railPoint(net.from, pb || [0, 0, 0]);
    const b = pb || mod.railPoint(net.to, a);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const h = Math.min(16, 3 + d * 0.12);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(a[2], b[2]) + h];
    const curve = new THREE.CatmullRomCurve3([vec(THREE, a), new THREE.Vector3(a[0], a[1], a[2] + Math.min(3, h)), vec(THREE, mid),
      new THREE.Vector3(b[0], b[1], b[2] + Math.min(3, h)), vec(THREE, b)], false, 'centripetal');
    let m = G.mats[net.type];
    if (!m) { m = G.mats[net.type] = new THREE.MeshLambertMaterial({ color: WIRE_HEX[net.type], transparent: true, opacity: 1 }); }
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, TUBULAR, IS_SMALL ? 0.75 : 0.6, RADIAL, false), m);
    mesh.userData.net = net;
    mesh.visible = false;
    wireRoot.add(mesh);
    G.meshes.push(mesh);
  }
  for (const G of wireGroups) G.parts.delete(undefined);
  window.__wires = { total: NETS.length, drawn: wireGroups.reduce((a, G) => a + G.meshes.length, 0), internal: NETS.filter((n) => n.internal).length, perGroup: wireGroups.map((G) => NETS.filter((n) => groupOf(n) === G.n).length) };

  // ----- ระนาบน้ำ (ฉาก 5 ขอแทน + ลองใช้เรื่องขอแทน) -----
  let tipY = -191;
  if (has('water-probe')) tipY = new THREE.Box3().setFromObject(parts['water-probe'].obj).min.y + 1;
  const FLOOR_Y = tipY - 72;                         // ระยะจากพื้นถึงปลายสาย = 50 ซม. (ย่อส่วน)
  const cmToY = (cm) => FLOOR_Y + (cm * (tipY - FLOOR_Y)) / PROBE_CM;
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 240).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x8fb0c8, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
  waterMesh.position.set(0, FLOOR_Y, 20);
  waterMesh.renderOrder = 8;
  const waterEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(420, 240).rotateX(-Math.PI / 2)),
    new THREE.LineBasicMaterial({ color: 0x5f5e5a, transparent: true, opacity: 0.6 }));
  waterMesh.add(waterEdge);
  waterMesh.visible = false;
  model.add(waterMesh);

  // ----- ห้องชั้นบน (ฉาก 8): กล่องติดผนัง — พิกัดเดียวกับกล่องตอนประกอบ (origin = กลางกล่อง) จาก parts.js buildRoom -----
  const ROOM = mod.ROOM || null;
  const room = mod.buildRoom ? mod.buildRoom(THREE) : null;
  const roomMats = [];
  if (room) {
    room.visible = false;
    room.traverse((n) => {
      if (!n.material) return;
      for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
        if (roomMats.includes(m)) continue;
        m.userData.o0 = m.opacity; m.userData.t0 = m.transparent; m.userData.dw0 = m.depthWrite;
        roomMats.push(m);
      }
    });
    model.add(room);
  }
  let roomK = -1;
  function setRoom(k) {
    if (!room || Math.abs(k - roomK) < 0.004) return;
    roomK = k;
    room.visible = k > 0.01;
    for (const m of roomMats) {
      const tr = m.userData.t0 || k < 0.999;
      if (tr !== m.transparent) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = m.userData.o0 * k;
      m.depthWrite = m.userData.dw0 && (m.userData.t0 || k > 0.6);
    }
  }
  // เรื่องขอแทน: น้ำขึ้นที่พื้นชั้นล่าง ปลายสายวัดน้ำ 50 ซม. (ROOM.probeTip) — ภาพเต็มบ้านทั้งสองชั้น
  const roomWater = ROOM ? { y: (cm) => ROOM.waterY(cm), tip: vec(THREE, ROOM.probeTip), floor: ROOM.lowerFloorY } : null;

  // ----- สถานะที่ไทม์ไลน์ควบคุม -----
  // แต่ละการเคลื่อนไหว = ค่า 0→1 หนึ่งตัวใน `drive` (เลื่อนไปข้างหน้า/ย้อนกลับได้ตรงเสมอ)
  const state = {}; const base = {}; const cur = {};
  const def = (name, init) => { base[name] = { ...init }; cur[name] = { ...init }; state[name] = { ...init }; };
  for (const id of ids) { const P = parts[id]; def(id, { x: P.A.x, y: P.A.y, z: P.A.z, ry: P.rY, o: 1, a: 1, ek: 0, se: 0 }); }
  def('cam', { yaw: -40, pitch: 15, dist: 3.0, tx: 0, ty: -20, tz: 0, fov: 40 });
  const c0 = new THREE.Color(HEX.orange);
  def('fx', { model: 0, lr: c0.r, lg: c0.g, lb: c0.b, lit: 0, li: 0, blink: 0, l9: 0, press: 0, water: 0, tryIn: 0, wires: 0 });
  for (let g = 1; g <= 6; g++) def('w' + g, { d: 0, o: 1 });

  const drive = { p: 0 };
  const moves = [];
  let dirty = true;
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOutQuad' }, onUpdate: () => { dirty = true; } });
  tl.add(drive, { p: [0, 1], duration: TOTAL, ease: 'linear' }, 0);
  function to(name, target, a, b, ease) {
    if (!cur[name]) return;
    const deltas = [];
    for (const k in target) {
      const d = target[k] - cur[name][k];
      if (Math.abs(d) < 1e-6) continue;
      deltas.push([k, d]);
      cur[name][k] = target[k];
    }
    if (!deltas.length) return;
    const key = 'm' + moves.length;
    drive[key] = 0;
    moves.push({ key, name, deltas });
    tl.add(drive, { [key]: [0, 1], duration: Math.max(1, T(b) - T(a)), ease: ease || 'inOutQuad' }, T(a));
  }
  const posA = (id) => ({ x: parts[id].A.x, y: parts[id].A.y, z: parts[id].A.z, ry: parts[id].rY });
  const posE = (id) => ({ x: parts[id].E.x, y: parts[id].E.y, z: parts[id].E.z });
  const posW = (id) => {
    const A = parts[id].A;
    if (!FLIP.has(id)) return { x: A.x, y: A.y, z: A.z, ry: parts[id].rY };
    const f = flipV([A.x, A.y, A.z]);
    return { x: f[0], y: f[1], z: f[2], ry: parts[id].rY + Math.PI };
  };
  const fade = (list, o, a, b) => list.forEach((id) => has(id) && to(id, { o }, a, b));
  const others = (keep) => ids.filter((id) => !keep.includes(id));
  // วงไฟ: เปลี่ยนสี = ดับทีละดวงสั้น ๆ แล้วติดใหม่ทีละดวงด้วยสีใหม่
  const ring = (name, a, dur = 0.5) => {
    const c = new THREE.Color(HEX[name]);
    to('fx', { lit: 0 }, a - 0.25, a - 0.02);
    to('fx', { lr: c.r, lg: c.g, lb: c.b, li: 1 }, a - 0.02, a);
    to('fx', { lit: 8 }, a, a + dur, 'linear');
  };
  const ringOff = (a, b) => to('fx', { lit: 0 }, a, b);

  // ---------------- ท่าทางทีละช่วง (ตาม storyboard) ----------------
  // ฉาก 1 (0–11): ไม่มีโมเดล กล้องรอที่มุมฉาก 2
  // ฉาก 2 (11–19): กล่องจางเข้า หมุนจาก −40° มา −25° · ไฟส้มกะพริบเบา ๆ 1 ครั้ง
  to('fx', { model: 1 }, 10.5, 12.5);
  to('cam', { yaw: -25 }, 11, 14, 'outQuad');
  ring('orange', 14.2, 0.5);
  ringOff(15.4, 15.9);

  // ฉาก 3-ก (19–25): ฝายกออกไปทางหน้า ปุ่มตามออกมา ไฟ 8 ดวงลอยเป็นวง
  const showA = ['box-lid', 'btn-sos', 'btn-ack', 'leds'];
  const lidD = parts['box-lid'].E.z - parts['box-lid'].A.z;
  to('box-lid', posE('box-lid'), 19, 20.4);
  for (const id of ['btn-sos', 'btn-ack']) to(id, { z: parts[id].A.z + lidD }, 19, 20.4);
  for (const id of ['btn-sos', 'btn-ack']) to(id, posE(id), 20.2, 21.1);
  to('leds', posE('leds'), 20.4, 21.1);
  to('box-lid', { a: 0.35, ek: 1 }, 20.6, 21.3);   // ฝาโปร่งให้เห็นวงไฟที่ลอยอยู่ข้างหลัง
  fade(others(showA), 0.3, 19, 20.5);
  // มองเฉียงซ้ายเล็กน้อยแทน 0° ตรง (ชั้นที่ซ้อนกันตามแนวสายตาจะบังกันหมด)
  to('cam', { yaw: -32, pitch: 14, dist: 2.3, tx: 0, ty: 0, tz: 105 }, 19, 21.1);

  // ฉาก 3-ข (25–31): แผ่นวงจรยกออก ชิ้นบนแผ่นแยกขึ้นเหนือแผ่น เสาอากาศเลื่อนออกตามขอบ
  const showB = ['pcb', 'mcu', 'radio', 'antenna', 'passives', 'q-drive', 'q-power', 'diodes'];
  for (const id of showB) to(id, posE(id), 25, 27.1);
  fade(showB, 1, 25, 26);
  fade(showA, 0.04, 25, 26.5);   // ชั้นฝาอยู่ใกล้กล้องมาก จางเกือบหมดไม่ให้บังข้างใน
  fade(['box-body', 'battery', 'speaker', 'amp', 'power-in', 'water-probe'], 0.3, 25, 26);
  to('cam', { yaw: 20, pitch: 30, dist: 1.6, tx: -32, ty: 8, tz: -5 }, 25, 27.1);

  // ฉาก 3-ค (31–37): ลำโพง/ตัวขยายเสียงออกทางรูเสียง รางถ่านเลื่อนออก สายยืดลงล่าง ตัวกล่องจางเหลือเส้นขอบ
  // ลำโพงและไฟดวง 9 อยู่ผนังขวา (+X) ตาม parts.js จึงมองจาก +50° (storyboard: "ตามที่ modeler วาง")
  const showC = ['amp', 'speaker', 'battery', 'power-in', 'water-probe', 'box-body'];
  for (const id of showC) to(id, posE(id), 31, 33.1);
  to('leds', { se: 1 }, 31, 33.1);
  to('battery', { se: 1 }, 31.6, 33.1);
  to('box-body', { a: 0.1, ek: 1 }, 31, 33.1);
  fade(showC.concat(['leds']), 1, 31, 32);
  fade(showB, 0.3, 31, 32);
  fade(['box-lid', 'btn-sos', 'btn-ack'], 0.04, 31, 32);
  to('cam', { yaw: 50, pitch: 10, dist: 2.4, tx: 30, ty: -30, tz: 0 }, 31, 33.1);

  // ฉาก 3b ผังต่อสาย (37–55): ทุกชิ้นกลับตำแหน่งดูสาย ฝากับกล่องซ่อน ชิ้นอื่นจาง สายวาดทีละกลุ่ม
  for (const id of ids) to(id, posW(id), 37, 39);
  to('leds', { se: 0 }, 37, 39);
  to('battery', { se: 0 }, 37, 39);
  fade(['box-lid', 'box-body'], 0, 37, 38);
  to('box-body', { a: 1, ek: 0 }, 37.5, 38);
  // ชิ้นที่ไม่อยู่ในกลุ่มสาย: เทาอ่อนทึบ (ไม่ใช้ความโปร่ง ชิ้นที่มีวงเกลียวซ้อนกันจะดูเป็นก้อนมืด)
  fade(others(['box-lid', 'box-body', 'pcb', 'mcu']), 0.3, 37, 38.5);
  fade(['pcb', 'mcu'], 1, 37, 38);
  to('cam', { yaw: 0, pitch: 38, dist: 2.05, tx: -75, ty: -15, tz: 10 }, 37, 39);
  to('fx', { wires: 1 }, 37, 37.2);
  const DRAW_K = 0.25;   // สายวาดเสร็จใน 25% แรกของช่วงกลุ่ม แล้วนิ่งให้อ่าน
  const WIN = [[39, 42], [42, 45], [45, 48], [48, 51], [51, 53], [53, 55]];
  WIN.forEach(([a, b], i) => {
    const G = wireGroups[i];
    const draw = a + (b - a) * DRAW_K;
    to('w' + G.n, { d: 1 }, a, draw, 'linear');
    if (i > 0) to('w' + wireGroups[i - 1].n, { o: 0.3 }, a, a + 0.4);
    // ชิ้นของกลุ่มนี้กลับมาชัด ชิ้นของกลุ่มก่อนจางลง
    const now = [...G.parts].filter(has);
    const prev = i > 0 ? [...wireGroups[i - 1].parts].filter((id) => has(id) && !G.parts.has(id)) : [];
    fade(now, 1, a - 0.3, a + 0.2);
    fade(prev.filter((id) => id !== 'pcb' && id !== 'mcu'), 0.3, a - 0.3, a + 0.2);
  });

  // ฉาก 4 (55–65): ประกอบกลับ (ในสุดก่อน ตามลำดับประกอบใน parts.md) สายจางหาย แล้ววงไฟเปลี่ยนสีทีละสี
  to('fx', { wires: 0 }, 55, 55.6);
  const ORDER = ['pcb', 'mcu', 'radio', 'amp', 'diodes', 'passives', 'q-drive', 'q-power', 'battery', 'speaker', 'antenna', 'power-in', 'water-probe', 'box-body', 'leds', 'btn-sos', 'btn-ack', 'box-lid'];
  const order = ORDER.filter(has).concat(ids.filter((id) => !ORDER.includes(id)));
  order.forEach((id, i) => {
    const a = 55 + (i * 1.1) / Math.max(1, order.length - 1);
    to(id, { ...posA(id), o: 1, a: 1, ek: 0 }, a, a + 0.4);
  });
  to('cam', { yaw: 0, pitch: 10, dist: 1.8, tx: 0, ty: -10, tz: 45 }, 55, 57);
  ring('orange', 56.6, 0.6);
  to('fx', { blink: 1 }, 56.6, 56.65);
  to('fx', { blink: 0 }, 58.55, 58.6);
  ring('green', 58.8);
  ring('red', 60.8);
  ring('yellow', 62.8);

  // ฉาก 5 (65–77): สามหน้าที่ เรื่องสมมติ · กล่องซ้าย การ์ดขวา
  // มองจาก +25° (กระจกของ −25° ใน storyboard) ให้เห็นผนังขวาที่มีไฟดวง 9 และรูเสียง (ตำแหน่งตาม parts.js)
  to('cam', { yaw: 25, pitch: 10, dist: 2.0, tx: 0, ty: -20, tz: 0 }, 65, 66.4);
  ring('orange', 65.6, 0.5);
  to('fx', { blink: 1 }, 65.6, 65.65);
  to('fx', { blink: 0 }, 67.6, 67.65);          // ไม่มีใครกด: กะพริบแล้วค้างส้ม
  to('fx', { press: 1 }, 69.4, 69.9, 'outQuad');  // ยายกดแดงค้าง
  ringOff(69.4, 69.7);
  ring('red', 70.0, 0.5);
  to('fx', { press: 0 }, 70.5, 70.8);
  to('fx', { l9: 1 }, 70.4, 70.6);
  ring('yellow', 71.8);
  ringOff(73, 73.3);
  to('fx', { l9: 0 }, 73, 73.3);
  to('cam', { ty: -70, dist: 2.4 }, 73, 74.5);
  to('fx', { water: 1 }, 73.3, 75.2, 'inOutSine');
  ring('red', 75.6, 0.5);
  to('fx', { l9: 1 }, 75.8, 76);

  // ฉาก 6–7 (77–91): กล่องประกอบเล็กมุมซ้ายบน
  to('fx', { water: 0 }, 77, 78);
  ringOff(77, 77.4);
  to('fx', { l9: 0 }, 77, 77.4);
  to('cam', { yaw: -25, pitch: 15, dist: 3.5, ty: -30 }, 77, 79);

  // ฉาก 8 (91–100): ลองใช้กล่องเสมือน กล่องใหญ่กลางจอ ลากหมุนได้
  to('cam', { yaw: 25, pitch: 15, dist: 2.2, ty: -20 }, 91, 93.5);
  to('fx', { tryIn: 1 }, 91, 93.5);

  // ---------------- DOM ----------------
  const bar = document.getElementById('bar');
  const hint = document.getElementById('hint');
  const badgeSim = document.getElementById('badgeSim');
  const badgesEl = document.getElementById('badges');
  const legend = document.getElementById('legend');
  const legendCount = document.getElementById('legendCount');
  const bubble = document.getElementById('bubble');
  const bubbleTxt = bubble.querySelector('.txt');
  const bubbleBox = bubble.querySelector('.bb');
  const labelsEl = document.getElementById('labels');
  const track = document.getElementById('track');
  const flat = document.getElementById('flat');
  const flatTabs = document.getElementById('flatTabs');
  const flatBody = document.getElementById('flatBody');
  // ป้ายห้อง (ฉาก 8): ตำแหน่งติดตั้ง + ความสูง (ค่าออกแบบ)
  const roomTag = document.createElement('div');
  roomTag.id = 'roomTag';
  roomTag.innerHTML = 'ติดผนังชั้นบน ใกล้หน้าต่างฝั่งที่หันไปทาง อบต. ใกล้ปลั๊ก ผู้สูงอายุกดถึง';
  const heightTag = document.createElement('div');
  heightTag.id = 'heightTag';
  heightTag.innerHTML = `กลางกล่องสูงจากพื้น <span class="nw">1.2–1.4 ม.</span> ${DV}`;
  document.body.append(roomTag, heightTag);
  const probeTag = document.createElement('div');
  probeTag.id = 'probeTag';
  probeTag.innerHTML = `ปลายสายวัดน้ำ · 50 ซม. ${DV}`;
  document.body.appendChild(probeTag);

  // ป้ายเส้นชี้ของชิ้นส่วน
  const SVGNS = 'http://www.w3.org/2000/svg';
  const leaderSvg = document.createElementNS(SVGNS, 'svg');
  leaderSvg.setAttribute('class', 'leaders');
  labelsEl.appendChild(leaderSvg);
  const labelEls = {};
  function makeLabel(key, html, kind) {
    const el = document.createElement('div');
    el.className = 'plabel ' + kind;
    el.innerHTML = html;
    labelsEl.appendChild(el);
    const line = document.createElementNS(SVGNS, 'line');
    const dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('r', '3');
    leaderSvg.append(line, dot);
    labelEls[key] = { el, line, dot, kind, mode: '', size: {}, shown: false };
  }
  for (const id in PART_INFO) {
    const i = PART_INFO[id];
    makeLabel(id, `<b>${esc(i.name)}</b><span class="fn">${i.fn}</span><span class="meta">${metaHtml(i)}</span>`, 'strong');
  }
  GROUPS.forEach((G) => G.pins.forEach(([pin, txt]) => makeLabel('pin:' + pin, esc(txt), 'pin')));
  // ป้ายจิ๋ว R/C และชื่อราง
  const ttags = {};
  const makeTag = (key, txt, cls) => { const el = document.createElement('div'); el.className = 'ttag ' + (cls || ''); el.textContent = txt; labelsEl.appendChild(el); ttags[key] = { el, shown: false }; };
  for (const r of ['VSYS', 'VSW', '3V3', 'GND']) makeTag('rail:' + r, (r === 'GND' ? 'ราง GND' : 'ราง ' + r), 'rail');
  for (const k in VAL) makeTag('rc:' + k, `${k} ${VAL[k]}`);
  const RAIL_PT = {};
  for (const r of ['VSYS', 'VSW', '3V3', 'GND']) RAIL_PT[r] = vec(THREE, mod.railPoint(r === 'GND' ? 'gnd' : 'rail.' + r, [0, 60, 0]));
  const RC_PT = {};
  for (const G of wireGroups) for (const [rc, pins] of G.rc) {
    const pts = [...new Set(pins)].map((p) => mod.pinWorld(p));
    RC_PT[rc] = { g: G.n, p: vec(THREE, pts.reduce((s, q) => [s[0] + q[0] / pts.length, s[1] + q[1] / pts.length, s[2] + q[2] / pts.length], [0, 0, 0])) };
  }
  window.__labelReport = [];

  // ป้ายแต่ละฉาก (from = % ที่ป้ายขึ้น หลังชิ้นนิ่ง)
  const LABEL_PLAN = {
    '3a': { from: 21.3, strong: ['btn-sos', 'btn-ack', 'leds', 'box-lid'] },
    '3b': { from: 27.3, strong: ['mcu', 'radio', 'antenna', 'q-power', 'diodes', 'passives', 'pcb'] },
    '3c': { from: 33.3, strong: ['speaker', 'led9', 'amp', 'battery', 'power-in', 'water-probe', 'box-body'] },
  };

  // ผังแบบแบน
  flatTabs.innerHTML = GROUPS.map((G) => `<button type="button" role="tab" data-g="${G.n}" aria-selected="false">${G.n} ${G.name}</button>`).join('');
  let flatOn = IS_SMALL;   // มือถือ: ผังแบบแบนอ่านง่ายกว่า 3D จึงเปิดเป็นค่าเริ่มต้น
  let flatGroup = 0;
  function showFlatGroup(g) {
    if (flatGroup === g) return;
    flatGroup = g;
    flatBody.innerHTML = flatGroupHtml(g);
    flatTabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', +b.dataset.g === g ? 'true' : 'false'));
  }
  flatTabs.addEventListener('click', (e) => { const b = e.target.closest('button[data-g]'); if (b) showFlatGroup(+b.dataset.g); });
  const flatToggles = [...document.querySelectorAll('.flat-toggle')];
  flatToggles.forEach((b) => b.addEventListener('click', () => { flatOn = !flatOn; lastFlatStep = null; dirty = true; }));
  let lastFlatStep = null;

  // ความสูงของแต่ละช่วงเลื่อน ตามสัดส่วนใน storyboard
  for (const s of steps) s.el.style.height = ((s.to - s.from) * SCROLL_SCREENS * 100) + 'vh';
  track.style.paddingBottom = '100vh';

  // ---------------- วาด ----------------
  let frameNo = 0; let heavy = true; let heavyAnchor = true; let needSettle = false; let lastRenderAt = 0;
  let seeCache = new Set(); let seeCacheStep = null; let lastActive = null;
  const tmp = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const tsec = () => performance.now() / 1000;
  const animated = AT === null && !REDUCED;
  const ringCol = new THREE.Color();

  function compute() {
    for (const name in base) Object.assign(state[name], base[name]);
    for (const m of moves) {
      const k = drive[m.key];
      if (!k) continue;
      const s = state[m.name];
      for (const [prop, d] of m.deltas) s[prop] += d * k;
    }
  }
  function activeStep(p) {
    let a = steps[0];
    for (const s of steps) if (p >= s.from - 1e-6) a = s;
    return a;
  }

  function layout() {
    const w = window.innerWidth; const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const top = 56;
    for (const s of steps) {
      const card = s.el.querySelector('.card');
      let cx = w / 2; let cy = h / 2;
      if (!SHOT && card && !s.el.classList.contains('wide')) {
        const wideScreen = w > 720 && w > h * 0.9;
        if (wideScreen) {
          const l = card.offsetLeft; const r = l + card.offsetWidth;
          if (s.el.classList.contains('wide2')) { cx = Math.max(140, l / 2); cy = Math.min(h * 0.42, (top + card.offsetTop) / 2 + 60); }
          else if (l > w / 2) cx = Math.max(w * 0.3, l / 2);
          else cx = Math.min(w * 0.66, (r + w) / 2);
        } else {
          cy = Math.max(h * 0.24, (top + card.offsetTop) / 2);
          if (s.el.classList.contains('wide2')) cy = Math.max(h * 0.16, (top + card.offsetTop) / 2);
        }
      }
      s.view = { cx, cy };
      s.cardRect = card && !SHOT ? { l: card.offsetLeft, t: card.offsetTop, r: card.offsetLeft + card.offsetWidth, b: card.offsetTop + card.offsetHeight } : null;
    }
    tryLayout();
    for (const k in labelEls) labelEls[k].size = {};
    view.snap = true;
    dirty = true;
  }
  const view = { cx: 0, cy: 0, snap: true };
  function applyView(S) {
    const w = window.innerWidth; const h = window.innerHeight;
    const t = S.view || { cx: w / 2, cy: h / 2 };
    if (view.snap || !animated) { view.cx = t.cx; view.cy = t.cy; view.snap = false; }
    else { view.cx += (t.cx - view.cx) * 0.12; view.cy += (t.cy - view.cy) * 0.12; }
    view.moving = Math.abs(t.cx - view.cx) + Math.abs(t.cy - view.cy) > 0.5;
    camera.setViewOffset(w, h, w / 2 - view.cx, h / 2 - view.cy, w, h);
    camera.updateProjectionMatrix();
  }

  function render(settle) {
    frameNo++;
    const full = !animated || settle === true;
    heavy = full || frameNo % 3 === 0;
    heavyAnchor = full || frameNo % 3 === 1;
    needSettle = !full;
    lastRenderAt = performance.now();
    compute();
    const p = drive.p;
    const t = tsec();
    const S = activeStep(p);
    const fx = state.fx;
    camera.fov = state.cam.fov;
    setTryOn(S.id === '8' && fx.model > 0.5);
    if (try3d) tryStep();
    applyView(S);

    // ชิ้นส่วน
    for (const id of ids) {
      const P = parts[id];
      const s = state[id];
      P.obj.position.set(s.x, s.y, s.z);
      P.obj.rotation.y = s.ry;
      if (id === 'btn-sos' && fx.press) P.obj.position.z -= 6 * fx.press;
      if (tryPress[id]) P.obj.position.z -= TRY_PRESS_MM[id] * tryPress[id];
      for (const k in P.sub) { const sb = P.sub[k]; sb.g.position.copy(sb.base).addScaledVector(sb.rel, s.se); sb.g.rotation.y = 0; }
      // ฝาพลิก: ไฟดวง 9 อยู่บนผนังกล่อง ไม่พลิกตาม (คงตำแหน่งโลกไว้)
      if (id === 'leds' && Math.abs(s.ry - P.rY) > 1e-4 && P.sub.led9) {
        const sb = P.sub.led9;
        const k = s.ry / Math.PI;
        const nx = s.x + sb.base.x + sb.rel.x * s.se; const ny = s.y + sb.base.y + sb.rel.y * s.se; const nz = s.z + sb.base.z + sb.rel.z * s.se;
        const wx = nx + (P.A.x + sb.base.x - nx) * k; const wy = ny + (P.A.y + sb.base.y - ny) * k; const wz = nz + (P.A.z + sb.base.z - nz) * k;
        const dx = wx - s.x; const dy = wy - s.y; const dz = wz - s.z;
        const c = Math.cos(-s.ry); const sn = Math.sin(-s.ry);
        sb.g.position.set(dx * c + dz * sn, dy, -dx * sn + dz * c);
        sb.g.rotation.y = -s.ry;
      }
    }

    // สาย
    const wv = fx.wires;
    wireRoot.visible = wv > 0.01;
    if (wireRoot.visible) {
      wireGroups.forEach((G) => {
        const ws = state['w' + G.n];
        const o = ws.o * wv;
        for (const k in G.mats) { G.mats[k].opacity = o; G.mats[k].depthWrite = o > 0.6; }
        const n = Math.ceil(ws.d * TUBULAR) * RADIAL * 6;
        for (const m of G.meshes) { m.visible = ws.d > 0.001 && o > 0.01; m.geometry.setDrawRange(0, n); }
      });
    }

    // ไฟ
    if (!(tryOn && try3d)) {
      let on = 1;
      if (animated && fx.blink > 0.5) on = (t % 1.4) < 0.9 ? 1 : 0.1;
      let l9 = fx.l9;
      if (animated && l9 > 0.5) l9 = (t % 1.2) < 0.22 ? 1 : 0.08;
      ringCol.setRGB(fx.lr, fx.lg, fx.lb);
      applyLeds(fx.li > 0.01 && (fx.lit > 0.01 || fx.l9 > 0.01) ? { col: ringCol, lit: fx.lit, on, l9 } : null);
    } else tryLeds();

    // น้ำ
    let wy = null;
    if (fx.water > 0.001) wy = FLOOR_Y + (tipY + 4 - FLOOR_Y) * fx.water;
    const inRoom = !!roomWater && tryOn && try3d;
    if (tryOn && try3d && Sim.scen === 'auto') wy = inRoom ? roomWater.y(Sim.water) : cmToY(Sim.water);
    waterMesh.visible = wy !== null && fx.model > 0.5;
    if (inRoom) { waterMesh.position.set(-100, Math.max(roomWater.floor + 2, wy ?? 0), 175); waterMesh.scale.set(1200 / 420, 1, 640 / 240); }
    else { waterMesh.position.set(0, waterMesh.position.y, 20); waterMesh.scale.set(1, 1, 1); if (wy !== null) waterMesh.position.y = Math.max(FLOOR_Y + 0.5, wy); }
    setRoom(S.id === '8' && try3d ? fx.tryIn : 0);

    // กล้อง
    const c = state.cam;
    let yaw = c.yaw; let pitch = c.pitch;
    const narrow = camera.aspect < 1.2 ? Math.pow(1.2 / camera.aspect, 0.85) : 1;
    let d = c.dist * BOX_W * narrow;
    tgt.set(c.tx, c.ty, c.tz);
    if (p >= 0.9 && fx.tryIn > 0 && TV.d) {
      const k = fx.tryIn;
      d += (TV.d - d) * k;
      tgt.lerp(TV.target, k);
    }
    if (TV.yaw || TV.pitch) { yaw += TV.yaw; pitch = Math.max(-10, Math.min(45, pitch + TV.pitch)); }
    // ถอยกล้องออก: เห็นผนัง หน้าต่าง (ขวาของกล่อง) และปลั๊ก ก่อนตัดไปแผนที่
    if (TV.pull > 0) { d *= 1 + 3.2 * TV.pull; yaw -= TV.yaw * TV.pull + 12 * TV.pull; pitch += (6 - TV.pitch) * TV.pull; if (room) tgt.x += 520 * TV.pull; }
    const yr = (yaw * Math.PI) / 180; const pr = (pitch * Math.PI) / 180;
    camera.position.set(tgt.x + d * Math.cos(pr) * Math.sin(yr), tgt.y + d * Math.sin(pr), tgt.z + d * Math.cos(pr) * Math.cos(yr));
    camera.lookAt(tgt);

    // หน้าตาชิ้น: ชิ้นที่ฉากไม่ได้พูดถึงเป็นเทาอ่อน โปร่งเฉพาะตอนบังชิ้นพระเอก
    model.updateMatrixWorld();
    camera.updateMatrixWorld();
    if (heavy || seeCacheStep !== S) { seeCache = seeThroughTargets(S); seeCacheStep = S; }
    let seeMoving = false;
    for (const id of ids) {
      const P = parts[id];
      const target = seeCache.has(id) ? 1 : 0;
      if (!animated || P.see === undefined) P.see = target;
      else P.see += (target - P.see) * 0.25;
      if (Math.abs(target - P.see) < 0.01) P.see = target; else seeMoving = true;
      updateLook(P, state[id].o, state[id].a, P.see, state[id].ek);
    }
    view.seeMoving = seeMoving;

    const mk = MV ? MV.k : 0;
    renderer.domElement.style.opacity = (fx.model * (1 - mk)).toFixed(3);
    if (fx.model > 0.005 && mk < 0.999) renderer.render(scene, camera);
    else if (!render.cleared) renderer.clear();
    render.cleared = fx.model <= 0.005;

    // ----- DOM ตามช่วง -----
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    hint.classList.toggle('hide', p > 0.005);
    if (S !== lastActive) {
      steps.forEach((s) => s.el.classList.toggle('active', s === S));
      lastActive = S;
    }
    for (const s of steps) for (const sh of s.shows) sh.n.classList.toggle('shown', p >= sh.from - 1e-6);

    badgeSim.classList.toggle('on', S.id === '8');

    // ผังต่อสาย: คำอธิบายสี + ผังแบบแบน
    const inWire = S.group > 0 && fx.model > 0.5;
    legend.classList.toggle('on', inWire && !flatOn);
    if (inWire) {
      const G = wireGroups[S.group - 1];
      const n = NETS.filter((x) => groupOf(x) === G.n).length;
      const txt = `กลุ่มนี้ ${n} เส้น · รวม ${NETS.length} เส้นตามผังต่อสาย`;
      if (legendCount.textContent !== txt) legendCount.textContent = txt;
    }
    flat.hidden = !(inWire && flatOn);
    if (inWire && lastFlatStep !== S) { lastFlatStep = S; showFlatGroup(S.group); flatGroup = S.group; }
    flatToggles.forEach((b) => { const t2 = flatOn ? 'กลับไปดูแบบ 3D' : 'ดูผังแบบแบน'; if (b.textContent !== t2) b.textContent = t2; });

    // ฟองคำพูดของกล่อง
    let say = null; let talk = false;
    if (tryOn) { say = MV && MV.k > 0.3 ? null : Sim.bubble(); talk = Sim.talking(); }
    else if (S.say && (S.sayFrom === null || p >= S.sayFrom)) { say = S.say; talk = animated; }
    placeBubble(say, talk);

    // ป้ายปลายสายวัดน้ำ
    const showProbe = (S.id === '5c' && fx.water > 0.3) || (tryOn && Sim.scen === 'auto');
    if (showProbe) {
      if (tryOn && roomWater) tmp.copy(roomWater.tip).project(camera);
      else tmp.set(parts['water-probe'].obj.position.x + 4, tipY, parts['water-probe'].obj.position.z).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * window.innerWidth; const y = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
      const pw = probeTag.offsetWidth || 260;
      const px = x + 14 + pw > window.innerWidth - 8 ? x - 14 - pw : x + 14;
      probeTag.style.transform = `translate(${Math.max(8, px).toFixed(1)}px, ${(y - 10).toFixed(1)}px)`;
    }
    probeTag.classList.toggle('on', !!showProbe);

    // ป้ายห้อง
    const showRoom = !!room && tryOn && try3d && (!MV || MV.k < 0.05) && !SHOT;
    roomTag.classList.toggle('on', showRoom);
    heightTag.classList.toggle('on', showRoom && Sim.scen !== 'auto');
    if (showRoom && TV.rect) {
      const r = TV.rect;
      roomTag.style.maxWidth = Math.max(180, r.r - r.l - 16) + 'px';
      roomTag.style.transform = `translate(${((r.l + r.r) / 2).toFixed(1)}px, ${(r.t + 2).toFixed(1)}px) translateX(-50%)`;
      tmp.fromArray(ROOM.heightLabel).project(camera);
      const hx = (tmp.x * 0.5 + 0.5) * window.innerWidth; const hy = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
      const hw = heightTag.offsetWidth || 220;
      heightTag.style.transform = `translate(${Math.max(r.l + 4, Math.min(r.r - hw - 4, hx - hw)).toFixed(1)}px, ${Math.min(r.b - 30, hy).toFixed(1)}px)`;
    }

    placeLabels(S, p);
    placeTags(S, p);
    if (tryOn || tryHit.style.display !== 'none') tryOverlay();
    dirty = false;
  }

  // ฟองคำพูดข้างวงไฟ (จอกว้าง: ขวาของวงไฟ / จอแคบ: ใต้วงไฟ)
  function placeBubble(text, talk) {
    bubble.classList.toggle('on', !!text);
    bubble.classList.toggle('talk', !!talk);
    if (!text) return;
    if (bubbleTxt.textContent !== text) bubbleTxt.textContent = text;
    const L = parts['box-lid'].obj;   // อ้างขอบฝา: ฟองอยู่ขวาของกล่อง (ไม่ทับปุ่มเขียว) หรือใต้กล่อง
    const W = window.innerWidth; const H = window.innerHeight;
    const bw = bubble.offsetWidth || 260; const bh = bubble.offsetHeight || 60;
    tmp.set(80, 22, 6).applyMatrix4(L.matrixWorld).project(camera);
    let x = (tmp.x * 0.5 + 0.5) * W + 14; let y = (-tmp.y * 0.5 + 0.5) * H - 20;
    const side = !IS_SMALL && x + bw < W - 12;
    // ไม่ทับการ์ด/แผงด้านขวา
    let rightLimit = W - 12;
    const S = lastActive;
    if (S && S.cardRect && S.cardRect.l > W / 2) rightLimit = S.cardRect.l - 12;
    if (tryOn && TV.rect) rightLimit = TV.rect.r;
    bubble.classList.toggle('below', !side || x + bw > rightLimit);
    if (!side || x + bw > rightLimit) {
      tmp.set(-25, -80, 6).applyMatrix4(L.matrixWorld).project(camera);
      x = Math.min(rightLimit - bw, Math.max(12, (tmp.x * 0.5 + 0.5) * W - 40));
      y = (-tmp.y * 0.5 + 0.5) * H + 14;
      if (tryOn && TV.rect) y = Math.min(y, TV.rect.b - bh);
    }
    y = Math.max(96, Math.min(H - bh - 8, y));
    bubble.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  // ---------------- ป้ายเส้นชี้ ----------------
  // ป้ายวางเป็นคอลัมน์ซ้าย/ขวานอกกรอบของโมเดล (จอแคบ: แถวเหนือ/ใต้โมเดล) เส้นลากจากป้ายไปแตะจุดชี้บนผิวชิ้น
  const corner = new THREE.Vector3();
  function rectOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
  }
  function segHitsRect(x1, y1, x2, y2, o) {
    for (let k = 0; k <= 16; k++) {
      const x = x1 + ((x2 - x1) * k) / 16; const y = y1 + ((y2 - y1) * k) / 16;
      if (x > o.l && x < o.r && y > o.t && y < o.b) return true;
    }
    return false;
  }
  function hideLabel(L) {
    if (!L.shown) return;
    L.shown = false;
    L.el.classList.remove('on');
    L.line.setAttribute('class', '');
    L.dot.setAttribute('class', '');
  }
  function layoutRows(items, o) {
    const { W, H, top, obst, gap } = o;
    const { bT, bB } = o;
    const midY = (bT + bB) / 2;
    let upLim = top; let downLim = H - 8;
    for (const ob of obst) {
      if (ob.b < H * 0.45) upLim = Math.max(upLim, ob.b);
      else if (ob.t > H * 0.5) downLim = Math.min(downLim, ob.t);
    }
    const band = { up: [upLim + gap, bT - 8], down: [bB + 8, downLim - gap] };
    const lineH = (list) => Math.max(0, ...list.map((it) => it.h));
    const pack = (list) => {
      const lines = []; let cur2 = []; let wsum = 0;
      for (const it of list.slice().sort((a, b) => a.ax - b.ax)) {
        if (cur2.length && wsum + gap + it.w > W - 16) { lines.push(cur2); cur2 = []; wsum = 0; }
        wsum += (cur2.length ? gap : 0) + it.w; cur2.push(it);
      }
      if (cur2.length) lines.push(cur2);
      return lines;
    };
    const height = (list) => pack(list).reduce((a, ln) => a + lineH(ln) + gap, -gap);
    const fits = (k, list) => !list.length || height(list) <= band[k][1] - band[k][0];
    const sideOf = {};
    for (const it of items) sideOf[it.key] = it.ay < midY ? 'up' : 'down';
    for (let guard = 0; guard < 30; guard++) {
      const lists = { up: items.filter((it) => sideOf[it.key] === 'up'), down: items.filter((it) => sideOf[it.key] === 'down') };
      let changed = false;
      for (const k of ['up', 'down']) {
        if (fits(k, lists[k])) continue;
        const other = k === 'up' ? 'down' : 'up';
        const mv = lists[k].filter((it) => !it.moved).sort((a, b) => Math.abs(a.ay - midY) - Math.abs(b.ay - midY))[0];
        if (mv && fits(other, lists[other].concat([mv]))) { sideOf[mv.key] = other; mv.moved = true; changed = true; break; }
        const drop = lists[k].filter((it) => !it.strong)[0] || lists[k][lists[k].length - 1];
        if (drop && lists[k].length > 1) { items.splice(items.indexOf(drop), 1); changed = true; break; }
      }
      if (!changed) break;
    }
    for (const k of ['up', 'down']) {
      const list = items.filter((it) => sideOf[it.key] === k);
      const lines = pack(list);
      if (!lines.length) continue;
      if (k === 'up') lines.reverse();
      let y = k === 'down' ? band.down[0] : band.up[1];
      for (const ln of lines) {
        const lh = lineH(ln);
        const ly = k === 'down' ? y : Math.max(band.up[0], y - lh);
        if (k === 'down') y += lh + gap; else y = ly - gap;
        let prev = 8 - gap;
        for (const it of ln) { it.x = Math.max(prev + gap, Math.min(W - 8 - it.w, it.ax - it.w / 2)); prev = it.x + it.w; }
        let next = W - 8 + gap;
        for (let i = ln.length - 1; i >= 0; i--) { const it = ln[i]; it.x = Math.min(it.x, next - gap - it.w); next = it.x; }
        for (const it of ln) {
          it.y = ly + (k === 'down' ? 0 : lh - it.h);
          it.hx = Math.min(it.x + it.w - 8, Math.max(it.x + 8, it.ax));
          it.hy = k === 'down' ? it.y - 1 : it.y + it.h + 1;
        }
      }
    }
  }

  // จุดชี้ที่กล้องมองเห็น: ใช้จุดเดิมถ้ายังไม่ถูกชิ้นอื่นบัง ไม่งั้นลองจุดถัดไปของชิ้นนั้น
  const ray = new THREE.Raycaster();
  const meshPart = new Map();
  for (const id of ids) {
    parts[id].obj.traverse((m) => {
      if (!m.isMesh || !m.visible || m.isSprite) return;
      m.geometry.computeBoundingSphere();
      meshPart.set(m, id);
    });
  }
  let occluders = [];
  const wpt = new THREE.Vector3();
  const seePts = new THREE.Vector3();
  function seeThroughTargets(S) {
    const out = new Set();
    if (state.fx.model < 0.05) return out;
    const plan = LABEL_PLAN[S.id];
    if (!plan) return out;
    const heroes = plan.strong.map((id) => (id === 'led9' ? 'leds' : id)).filter((id) => has(id) && state[id].o > 0.9);
    const allMeshes = [];
    for (const [m] of meshPart) if (m.material.userData.tag !== 'window') allMeshes.push(m);
    for (const id of heroes) {
      const P = parts[id];
      for (const a of P.anchors.concat([P.center])) {
        seePts.copy(a).applyMatrix4(P.obj.matrixWorld);
        const dir = seePts.clone().sub(camera.position);
        const dist = dir.length();
        ray.set(camera.position, dir.normalize());
        ray.far = dist - 0.8;
        for (const hit of ray.intersectObjects(allMeshes, false)) {
          const hid = meshPart.get(hit.object);
          if (hid !== id && state[hid].o < 0.999) out.add(hid);
        }
      }
    }
    return out;
  }
  function anchorSeen(obj, a, selfId) {
    wpt.copy(a).applyMatrix4(obj.matrixWorld);
    const dir = wpt.clone().sub(camera.position);
    const dist = dir.length();
    ray.set(camera.position, dir.normalize());
    ray.far = dist - 0.8;
    return !ray.intersectObjects(occluders, false).some((h) => meshPart.get(h.object) !== selfId);
  }
  // ป้ายของชิ้น: led9 = ดวงที่ 9 (กลุ่มย่อยของ leds)
  const LED9_ANCHOR = ledApi ? [vec(THREE, ledApi.positions[8]).add(new THREE.Vector3(1, 0, 0))] : [];
  const labelTarget = (key) => (key === 'led9'
    ? { obj: parts.leds.obj.userData.led9, anchors: LED9_ANCHOR, occ: 'leds', o: state.leds.o }
    : { obj: parts[key].obj, anchors: parts[key].anchors, occ: key, o: state[key].o });
  const pickCache = {};
  function pickAnchor(key, T0) {
    if (!heavyAnchor && pickCache[key] !== undefined) return pickCache[key];
    let res = null;
    const cur0 = T0.pick ?? 0;
    const list = T0.anchors;
    if (anchorSeen(T0.obj, list[cur0], T0.occ)) res = list[cur0];
    else for (let i = 0; i < list.length; i++) if (i !== cur0 && anchorSeen(T0.obj, list[i], T0.occ)) { res = list[i]; break; }
    pickCache[key] = res;
    return res;
  }

  if (query.get('debug') === '1') window.__dbg = { parts, state, camera, wireGroups, drive };

  function placeLabels(S, p) {
    const W = window.innerWidth; const H = window.innerHeight;
    const plan = LABEL_PLAN[S.id];
    const G = S.group ? GROUPS[S.group - 1] : null;
    const wireLabels = G && !flatOn && p >= (WIN[S.group - 1][0] + (WIN[S.group - 1][1] - WIN[S.group - 1][0]) * DRAW_K) / 100 - 1e-6;
    const active = state.fx.model > 0.5 && ((plan && p >= plan.from / 100 - 1e-6) || wireLabels);
    if (!active) { for (const k in labelEls) hideLabel(labelEls[k]); window.__labelReport = null; return; }
    const top = IS_SMALL ? 44 : 52;
    const obst = [];
    if (S.cardRect) obst.push(S.cardRect);
    const rb = rectOf(badgesEl); if (rb) obst.push(rb);
    if (legend.classList.contains('on')) { const r = rectOf(legend); if (r) obst.push(r); }
    if (bubble.classList.contains('on')) { const r = rectOf(bubble); if (r) obst.push({ l: r.l - 6, t: r.t - 6, r: r.r + 6, b: r.b + 6 }); }
    const inObst = (x, y) => obst.some((o) => x >= o.l && x <= o.r && y >= o.t && y <= o.b);

    // กรอบของโมเดลบนจอ (ชิ้นที่ยังเห็นชัด)
    let bL = Infinity; let bR = -Infinity; let bT = Infinity; let bB = -Infinity;
    for (const id of ids) {
      if (state[id].o < 0.25 || state[id].a < 0.25) continue;
      const P = parts[id]; const bx = P.localBox;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? bx.max.x : bx.min.x, i & 2 ? bx.max.y : bx.min.y, i & 4 ? bx.max.z : bx.min.z).add(P.obj.position).project(camera);
        if (corner.z > 1) continue;
        const sx = (corner.x * 0.5 + 0.5) * W; const sy = (-corner.y * 0.5 + 0.5) * H;
        bL = Math.min(bL, sx); bR = Math.max(bR, sx); bT = Math.min(bT, sy); bB = Math.max(bB, sy);
      }
    }
    bL = Math.max(8, bL); bR = Math.min(W - 8, bR); bT = Math.max(top, bT); bB = Math.min(H - 8, bB);
    const cx = (bL + bR) / 2;
    const rowMode = W <= 720;

    occluders = [];
    for (const [m, id] of meshPart) if ((parts[id].alpha ?? 1) >= 0.5 && m.material.userData.tag !== 'window') occluders.push(m);
    const items = [];
    const push = (key, ax, ay, strong) => {
      if (ax < 4 || ax > W - 4 || ay < top || ay > H - 4) return;
      const L = labelEls[key];
      const mode = L.kind === 'pin' ? 'pin' : rowMode ? 'compact' : 'strong';
      if (L.mode !== mode) { L.el.className = 'plabel ' + (L.kind === 'pin' ? 'pin' : 'strong' + (mode === 'compact' ? ' compact' : '')) + (L.shown ? ' on' : ''); L.mode = mode; }
      if (!L.size[mode]) L.size[mode] = { w: L.el.offsetWidth, h: L.el.offsetHeight };
      const { w, h } = L.size[mode];
      items.push({ key, L, strong, ax, ay, w, h, side: ax < cx ? 'L' : 'R' });
    };
    if (plan && p >= plan.from / 100 - 1e-6) {
      for (const key of plan.strong) {
        const T0 = labelTarget(key);
        if (T0.o < 0.15) continue;
        const a = pickAnchor(key, T0) || T0.anchors[0];
        tmp.copy(a).applyMatrix4(T0.obj.matrixWorld).project(camera);
        if (tmp.z > 1) continue;
        push(key, (tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H, true);
      }
    }
    if (wireLabels) {
      for (const [pin] of G.pins) {
        const w = wpos(pin);
        tmp.set(w[0], w[1], w[2]).project(camera);
        push('pin:' + pin, (tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H, true);
      }
      // ขาสมองแถวซ้ายป้ายอยู่ซ้าย แถวขวาป้ายอยู่ขวา (ป้ายไม่ไขว้กัน)
      for (const it of items) if (it.key.startsWith('pin:mcu.')) {
        const loc = mod.PARTS.find((q) => q.id === 'mcu').pins[it.key.slice(4)];
        it.side = loc && loc[0] < 0 ? 'L' : 'R';
      }
    }
    void inObst;
    const gap = IS_SMALL ? 4 : 6;
    const xOf = (it) => (it.side === 'L' ? Math.max(8, Math.min(bL - 18, it.ax - 30) - it.w) : Math.min(W - 8 - it.w, Math.max(bR + 18, it.ax + 30)));
    const freeRange = (col) => {
      let l = Infinity; let r = -Infinity;
      for (const it of col) { const x = xOf(it); l = Math.min(l, x); r = Math.max(r, x + it.w); }
      const blocks = obst.filter((o) => o.r > l && o.l < r).map((o) => [o.t - gap, o.b + gap]).sort((a, b) => a[0] - b[0]);
      const free = []; let y = top;
      for (const [t0, b0] of blocks) { if (t0 > y) free.push([y, t0]); y = Math.max(y, b0); }
      if (H - 8 > y) free.push([y, H - 8]);
      let best = null; let bestScore = -1;
      for (const f of free) {
        const inside = col.filter((it) => it.ay >= f[0] && it.ay <= f[1]).length;
        const score = inside * 10000 + (f[1] - f[0]);
        if (score > bestScore) { bestScore = score; best = f; }
      }
      return best || [top, H - 8];
    };
    const need = (col) => col.reduce((a, it) => a + it.h, 0) + gap * Math.max(0, col.length - 1);
    let cols = { L: [], R: [] };
    if (rowMode) layoutRows(items, { W, H, top, obst, bT, bB, gap });
    else for (let guard = 0; guard < 30; guard++) {
      cols = { L: items.filter((it) => it.side === 'L'), R: items.filter((it) => it.side === 'R') };
      let changed = false;
      for (const k of ['L', 'R']) {
        const col = cols[k];
        if (!col.length) continue;
        const f = freeRange(col);
        col.range = f;
        if (need(col) <= f[1] - f[0]) continue;
        const other = k === 'L' ? 'R' : 'L';
        const mv = col.filter((it) => !it.moved && !it.key.startsWith('pin:mcu.')).sort((a, b) => Math.abs(a.ax - cx) - Math.abs(b.ax - cx))[0];
        if (!mv) continue;
        const trial = cols[other].concat([{ ...mv, side: other }]);
        const f2 = freeRange(trial);
        mv.moved = true;
        if (need(trial) <= f2[1] - f2[0]) { mv.side = other; changed = true; break; }
      }
      if (!changed) break;
    }
    for (const k of rowMode ? [] : ['L', 'R']) {
      const col = cols[k];
      if (!col.length) continue;
      const [y0, y1] = col.range || freeRange(col);
      col.sort((a, b) => a.ay - b.ay);
      let prev = y0 - gap;
      for (const it of col) { it.y = Math.max(it.ay - it.h / 2, prev + gap); prev = it.y + it.h; }
      let next = y1 + gap;
      for (let i = col.length - 1; i >= 0; i--) { const it = col[i]; it.y = Math.min(it.y, next - gap - it.h); next = it.y; }
      prev = y0 - gap;
      for (const it of col) { it.y = Math.max(it.y, prev + gap); prev = it.y + it.h; }
      for (const it of col) {
        it.x = xOf(it);
        it.hy = it.y + Math.min(it.h / 2, 12);
        it.hx = it.side === 'L' ? it.x + it.w + 1 : it.x - 1;
      }
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.x === undefined) { items.splice(i, 1); continue; }
      if (rowMode && obst.some((o) => segHitsRect(it.hx, it.hy, it.ax, it.ay, o) && o === S.cardRect)) items.splice(i, 1);
    }
    const shownKeys = new Set(items.map((it) => it.key));
    for (const k in labelEls) if (!shownKeys.has(k)) hideLabel(labelEls[k]);
    const report = [];
    for (const it of items) {
      const L = it.L;
      L.el.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
      L.line.setAttribute('x1', it.hx.toFixed(1)); L.line.setAttribute('y1', it.hy.toFixed(1));
      L.line.setAttribute('x2', it.ax.toFixed(1)); L.line.setAttribute('y2', it.ay.toFixed(1));
      L.dot.setAttribute('cx', it.ax.toFixed(1)); L.dot.setAttribute('cy', it.ay.toFixed(1));
      if (!L.shown) { L.shown = true; L.el.classList.add('on'); }
      const cls = 'on ' + (L.kind === 'pin' ? 'pin' : 'strong');
      if (L.line.getAttribute('class') !== cls) { L.line.setAttribute('class', cls); L.dot.setAttribute('class', cls); }
      report.push({ key: it.key, x: Math.round(it.x), y: Math.round(it.y), w: it.w, h: it.h, ax: Math.round(it.ax), ay: Math.round(it.ay) });
    }
    window.__labelReport = { obst: obst.map((o) => [o.l, o.t, o.r, o.b].map(Math.round)), labels: report };
  }

  // ป้ายจิ๋ว: ชื่อราง (ทุกกลุ่ม) + R/C ของกลุ่มที่กำลังวาด (จอกว้างเท่านั้น วางไม่ทับกัน)
  function placeTags(S, p) {
    const W = window.innerWidth; const H = window.innerHeight;
    const g = S.group;
    const on = g > 0 && !flatOn && state.fx.model > 0.5 && state.fx.wires > 0.5;
    const placed = [];
    for (const k in labelEls) { const L = labelEls[k]; if (L.shown) { const r = L.el.getBoundingClientRect(); placed.push([r.left, r.top, r.right, r.bottom]); } }
    if (lastActive && lastActive.cardRect) { const c = lastActive.cardRect; placed.push([c.l, c.t, c.r, c.b]); }
    const put = (key, v, want) => {
      const T0 = ttags[key];
      let ok = false;
      if (want) {
        tmp.copy(v).project(camera);
        const x = (tmp.x * 0.5 + 0.5) * W + 4; const y = (-tmp.y * 0.5 + 0.5) * H - 7;
        const w = T0.w || (T0.w = T0.el.offsetWidth || 60); const h = 15;
        const box = [x, y, x + w, y + h];
        ok = tmp.z < 1 && x > 4 && x + w < W - 4 && y > 50 && y + h < H - 4 && !placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]);
        if (ok) { placed.push(box); T0.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; }
      }
      if (ok !== T0.shown) { T0.shown = ok; T0.el.classList.toggle('on', ok); }
    };
    for (const r of ['VSYS', 'VSW', '3V3', 'GND']) put('rail:' + r, RAIL_PT[r], on);
    const drawn = g > 0 && p >= (WIN[g - 1][0] + (WIN[g - 1][1] - WIN[g - 1][0]) * DRAW_K) / 100 - 1e-6;
    for (const rc in RC_PT) put('rc:' + rc, RC_PT[rc].p, on && !IS_SMALL && drawn && RC_PT[rc].g === g);
  }

  // o = ระดับ "เด่น" (1 = เด่น, ~0.3 = ชิ้นที่ฉากไม่ได้พูดถึง → สีเทาอ่อน) · a = ความทึบสูงสุด (ฉากผังสาย)
  // see = 0..1 ส่วนที่ต้องโปร่งเพราะบังชิ้นพระเอก · ek = คงเส้นขอบไว้แม้ผิวจาง (ตัวกล่องฉาก 3-ค)
  const DIM = new THREE.Color(0xf3f2ee);
  const colTmp = new THREE.Color();
  function updateLook(P, o, a, see, ek) {
    const key = o.toFixed(3) + '|' + a.toFixed(3) + '|' + see.toFixed(3) + '|' + ek.toFixed(2);
    if (P.lookKey === key) return;
    P.lookKey = key;
    P.opacity = o;
    P.obj.visible = o > 0.004;
    const dimK = Math.min(1, Math.max(0, (1 - o) / 0.7));
    const al = Math.min(a, 1 - see * (1 - o), o < 0.3 ? o / 0.3 : 1);
    P.alpha = al;
    for (const m of P.mats) {
      if (m.userData.edge) {
        m.opacity = m.userData.baseOpacity * (1 - 0.45 * dimK) * Math.max(al, ek * 0.9 * Math.min(1, o * 3));
        continue;
      }
      if (m.userData.baseColor) m.color.copy(colTmp.copy(m.userData.baseColor).lerp(DIM, dimK * 0.6));
      const want = al < 0.999 || m.userData.baseTransparent;
      if (m.transparent !== want) { m.transparent = want; m.needsUpdate = true; }
      m.opacity = m.userData.baseOpacity * al;
      m.depthWrite = al > 0.6 && !m.userData.baseTransparent;
    }
  }

  function needsContinuous() {
    if (!animated) return false;
    const fx = state.fx;
    const S = lastActive;
    return view.moving || view.seeMoving || (fx.blink > 0.5 && fx.lit > 0.1) || (fx.l9 > 0.5) || (!!S && !!S.say && bubble.classList.contains('talk'));
  }
  function loop() {
    if (dirty || needsContinuous() || tryNeeds()) render();
    else if (needSettle && performance.now() - lastRenderAt > 120) render(true);
    requestAnimationFrame(loop);
  }

  // ---------------- ฉาก 8 · ลองใช้กล่องเสมือน (3D) ----------------
  // ลากบนตัวกล่องเพื่อหมุน (ล้อเมาส์ยังเลื่อนหน้าได้) กดค้างปุ่มแดง / กดปุ่มเขียวบนโมเดลได้จริง (Raycaster)
  // ตั้งค่าลดการเคลื่อนไหว: ไม่ใช้ 3D ในฉากนี้ ใช้กล่อง 2D แทน
  const try3d = !!Sim && !REDUCED;
  const TV = { yaw: 0, pitch: 0, d: 0, ret: null, rect: null, target: new THREE.Vector3(), pull: 0 };   // pull: ถอยกล้องออกให้เห็นห้อง ก่อนตัดไปแผนที่
  const TRY_PRESS_MM = { 'btn-sos': 6, 'btn-ack': 4 };
  const tryPress = {};
  let tryOn = false; let tryKey = ''; let drag = null;
  const modelBox = new THREE.Box3();
  for (const id of ids) modelBox.union(parts[id].localBox.clone().translate(parts[id].A));
  // ขอแทน: ในห้องจริง ปลายสายวัดน้ำอยู่ชั้นล่าง จึงเห็นทั้งสองชั้น (กล่องเล็กลง)
  const autoBox = roomWater
    ? modelBox.clone().expandByPoint(new THREE.Vector3(-100, roomWater.floor, 175)).expandByPoint(roomWater.tip)
    : modelBox.clone().expandByPoint(new THREE.Vector3(0, FLOOR_Y, 0));

  const tryHit = document.createElement('div');
  tryHit.id = 'tryHit';
  tryHit.style.display = 'none';
  document.body.appendChild(tryHit);
  const tryRing = document.createElementNS(SVGNS, 'svg');
  tryRing.id = 'tryRing';
  tryRing.setAttribute('viewBox', '0 0 100 100');
  tryRing.setAttribute('aria-hidden', 'true');
  tryRing.innerHTML = '<circle class="bg" cx="50" cy="50" r="46"/><circle class="arc" cx="50" cy="50" r="46" pathLength="100"/>';
  document.body.appendChild(tryRing);
  const tryArc = tryRing.querySelector('.arc');
  const tryTip = document.createElement('div');
  tryTip.id = 'tryTip3';
  tryTip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tryTip);

  const tryCol = new THREE.Color();
  function tryLeds() {
    const L = Sim.lamp(performance.now());
    if (!L) { applyLeds(null); return; }
    tryCol.set(L.hex);
    applyLeds({ col: tryCol, lit: L.lit, on: L.on, l9: L.l9 });
  }

  function setTryOn(on) {
    if (!Sim || on === tryOn) return;
    tryOn = on;
    Sim.setActive(on);
    root.classList.toggle('trying', on);
    if (!try3d) { Sim.enable2d(on); return; }
    drag = null;
    tryHit.classList.remove('dragging', 'over-btn');
    tryHit.style.display = on ? '' : 'none';
    if (!on) { TV.ret = null; tryRing.classList.remove('on'); tryTip.classList.remove('on'); }
    dirty = true;
  }

  // จุดกลางภาพและระยะกล้องของฉาก 8: ให้กล่องเต็มพื้นที่ว่างระหว่างแผง (จอกว้าง) หรือเหนือแผง (จอแคบ)
  let tryBoxKind = '';
  function tryLayout() {
    TV.d = 0;
    const s8 = steps.find((s) => s.id === '8');
    if (!try3d || !s8) return;
    const W = window.innerWidth; const H = window.innerHeight;
    const card = Sim.card;
    const main = card.querySelector('.try-main');
    const scr = card.querySelector('.side');
    let r;
    if (getComputedStyle(main).position === 'absolute') {
      const cl = card.getBoundingClientRect();
      r = { l: cl.left + main.offsetLeft + main.offsetWidth + 12, r: cl.left + scr.offsetLeft - 12, t: 92, b: H - 20 };
    } else {
      r = { l: 12, r: W - 12, t: IS_SMALL ? 80 : 96, b: card.offsetTop - 8 };
    }
    const box = Sim.scen === 'auto' ? autoBox : modelBox;
    tryBoxKind = Sim.scen === 'auto' ? 'auto' : 'n';
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // เว้นที่ให้ป้ายห้องด้านบน (กล่องไม่อยู่ใต้ป้าย)
    let rt = r.t;
    if (room) { roomTag.style.maxWidth = Math.max(180, r.r - r.l - 16) + 'px'; rt += (roomTag.offsetHeight || 30) + 8; }
    const rw = Math.max(80, r.r - r.l); const rh = Math.max(80, r.b - rt);
    const tanH = Math.tan((40 * Math.PI) / 360);
    const across = Math.hypot(size.x, size.z);
    const pxmm = Math.min(0.86 * rh / size.y, 0.9 * rw / across, 3.4);
    TV.d = H / (2 * tanH * pxmm);
    TV.target.copy(center);
    s8.view = { cx: (r.l + r.r) / 2, cy: (rt + r.b) / 2 };
    TV.rect = r;
  }

  const wrapDeg = (y) => ((((y + 180) % 360) + 360) % 360) - 180;
  function tryStep() {
    const t = performance.now();
    if (tryOn && tryBoxKind !== (Sim.scen === 'auto' ? 'auto' : 'n')) { tryLayout(); view.snap = false; }
    if (TV.ret) {
      const k = Math.min(1, (t - TV.ret.t0) / 450);
      const e = 1 - Math.pow(1 - k, 3);
      TV.yaw = TV.ret.y * (1 - e); TV.pitch = TV.ret.p * (1 - e);
      if (k >= 1) TV.ret = null;
    } else if (!tryOn && (TV.yaw || TV.pitch)) {
      TV.yaw = wrapDeg(TV.yaw) * 0.8; TV.pitch *= 0.8;
      if (Math.abs(TV.yaw) + Math.abs(TV.pitch) < 0.05) TV.yaw = TV.pitch = 0;
    }
    for (const id in TRY_PRESS_MM) {
      const want = tryOn && Sim.hold && Sim.hold.which === (id === 'btn-sos' ? 'red' : 'green') ? 1 : 0;
      const c0 = tryPress[id] || 0;
      const nx = c0 + (want - c0) * 0.35;
      tryPress[id] = Math.abs(want - nx) < 0.01 ? want : nx;
    }
  }
  function front() { if (TV.yaw || TV.pitch) { TV.ret = { t0: performance.now(), y: wrapDeg(TV.yaw), p: TV.pitch }; dirty = true; } }
  function tryNeeds() {
    if (!try3d) return false;
    if (TV.ret || (!tryOn && (TV.yaw || TV.pitch))) return true;
    for (const id in tryPress) if (tryPress[id] > 0 && tryPress[id] < 1) return true;
    if (!tryOn) return false;
    if (Sim.hold) return true;
    const k = Sim.key(performance.now()) + tryBoxKind;
    if (k !== tryKey) { tryKey = k; return true; }
    return false;
  }

  const proj = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const btnC = new THREE.Vector3();
  const btnN = new THREE.Vector3();
  const toScreen = (v) => { proj.copy(v).project(camera); return { x: (proj.x * 0.5 + 0.5) * window.innerWidth, y: (-proj.y * 0.5 + 0.5) * window.innerHeight }; };
  // หน้าโดมปุ่ม (พิกัดท้องถิ่นของชิ้น ตาม parts.js: ปุ่มแดงโดมสูงถึง z=18 ขอบ Ø60 / ปุ่มเขียวถึง z=11 ขอบ Ø46)
  const BTN = { red: { id: 'btn-sos', z: 18, r: 30 }, green: { id: 'btn-ack', z: 11, r: 23 } };
  function btnScreen(which) {
    const b = BTN[which];
    const P = parts[b.id];
    P.obj.updateMatrixWorld();
    btnC.set(0, 0, b.z).applyMatrix4(P.obj.matrixWorld);
    const s = toScreen(btnC);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const e = toScreen(btnC.clone().addScaledVector(camRight, b.r));
    btnN.set(0, 0, 1).transformDirection(P.obj.matrixWorld);
    const facing = btnN.dot(camera.position.clone().sub(btnC)) > 0;
    return { x: s.x, y: s.y, r: Math.hypot(e.x - s.x, e.y - s.y), facing };
  }
  function tryOverlay() {
    if (!tryOn || !try3d) return;
    if (MV && MV.k > 0.05) { tryRing.classList.remove('on'); tryTip.classList.remove('on'); return; }   // กำลังดูแผนที่
    const W = window.innerWidth; const H = window.innerHeight;
    let l = Infinity; let r = -Infinity; let t = Infinity; let b = -Infinity;
    const bx = modelBox;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bx.max.x : bx.min.x, i & 2 ? bx.max.y : bx.min.y, i & 4 ? bx.max.z : bx.min.z);
      const s = toScreen(corner);
      l = Math.min(l, s.x); r = Math.max(r, s.x); t = Math.min(t, s.y); b = Math.max(b, s.y);
    }
    const pad = 6;
    l = Math.max(0, l - pad); t = Math.max(0, t - pad); r = Math.min(W, r + pad); b = Math.min(H, b + pad);
    if (TV.rect) { l = Math.max(l, TV.rect.l - 8); r = Math.min(r, TV.rect.r + 8); b = Math.min(b, TV.rect.b + 4); }
    const hs = tryHit.style;
    hs.left = l.toFixed(0) + 'px'; hs.top = t.toFixed(0) + 'px';
    hs.width = Math.max(0, r - l).toFixed(0) + 'px'; hs.height = Math.max(0, b - t).toFixed(0) + 'px';
    const h = Sim.hold;
    if (h && !h.done) {
      const bs = btnScreen(h.which);
      const R = bs.r + 9;
      const rs = tryRing.style;
      rs.left = (bs.x - R).toFixed(1) + 'px'; rs.top = (bs.y - R).toFixed(1) + 'px';
      rs.width = rs.height = (2 * R).toFixed(1) + 'px';
      tryArc.style.strokeDashoffset = (100 - Sim.progress() * 100).toFixed(2);
      tryRing.classList.add('on');
    } else tryRing.classList.remove('on');
    const tip = Sim.tip;
    if (tip) {
      const bs = btnScreen(Sim.lastWhich || 'red');
      if (tryTip.dataset.k !== tip) { tryTip.dataset.k = tip; tryTip.innerHTML = '<span>' + tip + '</span>'; }
      tryTip.style.transform = `translate(${bs.x.toFixed(1)}px, ${(bs.y + bs.r + 14).toFixed(1)}px)`;
      tryTip.classList.add('on');
    } else tryTip.classList.remove('on');
  }

  // ----- กดปุ่มบนโมเดล / ลากหมุน -----
  const picker = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickMeshes = [];
  for (const [m] of meshPart) if (m.material.userData.tag !== 'window') pickMeshes.push(m);
  function pickButton(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    picker.setFromCamera(ndc, camera);
    const hit = picker.intersectObjects(pickMeshes, false)[0];
    const id = hit ? meshPart.get(hit.object) : null;
    if (id === 'btn-sos') return 'red';
    if (id === 'btn-ack') return 'green';
    if (id === 'box-lid' || id === 'leds') {
      for (const which of ['green', 'red']) {
        const bs = btnScreen(which);
        if (bs.facing && Math.hypot(x - bs.x, y - bs.y) <= bs.r * 1.15) return which;
      }
    }
    return null;
  }
  tryHit.addEventListener('pointerdown', (e) => {
    if (!tryOn || (e.pointerType === 'mouse' && e.button !== 0) || (MV && MV.k > 0.1)) return;
    e.preventDefault();
    try { tryHit.setPointerCapture(e.pointerId); } catch (err) { /* ข้าม */ }
    const which = pickButton(e.clientX, e.clientY);
    if (which && Sim.holdStart(which, '3d')) { drag = { pid: e.pointerId, hold: true }; dirty = true; return; }
    TV.ret = null;
    drag = { pid: e.pointerId, x: e.clientX, y: e.clientY, yaw: TV.yaw, pitch: TV.pitch };
    tryHit.classList.add('dragging');
  });
  let hoverQueued = false;
  tryHit.addEventListener('pointermove', (e) => {
    if (drag && drag.pid === e.pointerId) {
      if (drag.hold) return;
      // กล่องติดผนัง: หมุนได้แค่ด้านหน้า ±50° (storyboard ฉาก 8 รอบ v2-3) — มุมตั้งต้น +25°/+15°
      TV.yaw = Math.max(-75, Math.min(25, drag.yaw - (e.clientX - drag.x) * 0.45));
      TV.pitch = Math.max(-25, Math.min(30, drag.pitch + (e.clientY - drag.y) * 0.35));
      dirty = true;
    } else if (!drag && e.pointerType === 'mouse' && !hoverQueued) {
      hoverQueued = true;
      const x = e.clientX; const y = e.clientY;
      requestAnimationFrame(() => { hoverQueued = false; if (tryOn) tryHit.classList.toggle('over-btn', !!pickButton(x, y)); });
    }
  });
  const endDrag = (e) => {
    if (!drag || drag.pid !== e.pointerId) return;
    if (drag.hold) Sim.holdEnd();
    drag = null;
    tryHit.classList.remove('dragging');
    dirty = true;
  };
  tryHit.addEventListener('pointerup', endDrag);
  tryHit.addEventListener('pointercancel', endDrag);
  tryHit.addEventListener('lostpointercapture', endDrag);
  tryHit.addEventListener('contextmenu', (e) => e.preventDefault());
  if (Sim) {
    document.getElementById('tryFront').addEventListener('click', front);
    Sim.onChange(() => { dirty = true; });
  }
  if (Sim && window.__try) {
    Object.assign(window.__try, {
      mode: try3d ? '3d' : '2d',
      point(which) { const b = btnScreen(which || 'red'); return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.r), facing: b.facing }; },
      rotate(yaw, pitch) { TV.ret = null; TV.yaw = yaw || 0; TV.pitch = pitch || 0; dirty = true; },
      front,
    });
    Object.defineProperty(window.__try, 'on', { get: () => tryOn });
    Object.defineProperty(window.__try, 'view', { get: () => ({ yaw: TV.yaw, pitch: TV.pitch }) });
    Object.defineProperty(window.__try, 'hitRect', { get: () => { const r = tryHit.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; } });
  }

  // ?record=1: พอถึงฉาก 8 เล่นทั้ง 3 เรื่องต่อกัน (เตือน → ขอช่วย → ขอแทน)
  async function tryDemo() {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const tap = async (sel) => { const el = Sim.card.querySelector(sel); if (!el) return; el.classList.add('pressed'); await wait(260); el.classList.remove('pressed'); el.click(); };
    const press = async (which, ms) => { Sim.holdStart(which, 'demo'); await wait(ms); Sim.holdEnd(); };
    const turn = (goal, ms) => new Promise((res) => {
      const from = TV.yaw; const t0 = performance.now();
      const f = (ts) => {
        const k = Math.min(1, Math.max(0, (ts - t0) / ms));
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        TV.yaw = from + (goal - from) * e; dirty = true;
        if (k < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
    const idle = () => Sim.idle();
    const skip = (on) => { window.__recordSkip = on; };
    Sim.setLink('good');
    skip(true);
    await wait(700);
    if (try3d) { await turn(25, 1100); await wait(200); await turn(0, 900); }
    // เตือน (ข้อความวิทยุเล่นแบบย่อ)
    await tap('.tab[data-scen="warn"]'); await wait(900);
    await tap('[data-act="warn"]'); await idle(); await wait(3600);
    await press('green', 350); await idle(); await wait(3000);
    // ขอช่วย: ข้อความขอช่วยครั้งแรกเล่นซูมแผนที่ครบ 1 รอบ (สัญญาณดี)
    await tap('.tab[data-scen="sos"]'); await wait(900);
    skip(false);
    await press('red', HOLD_MS + 250); await idle(); await wait(2200);
    skip(true);
    await tap('[data-act="accept"]'); await idle(); await wait(3800);
    await tap('[data-act="done"]'); await idle(); await wait(2600);
    // ขอแทน
    await tap('.tab[data-scen="auto"]'); await wait(1200);
    await new Promise((res) => {
      const t0 = performance.now();
      const f = (ts) => { const k = Math.min(1, (ts - t0) / 2600); Sim.setWater(Math.round(56 * k)); if (k < 1) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
    for (let i = 0; i < 160 && Sim.st !== 'auto_sos'; i++) await wait(100);
    await wait(3200);
    await tap('[data-act="confirm"]'); await wait(1600);
    await tap('[data-act="accept"]'); await idle(); await wait(3600);
    skip(false);
  }

  // ---------------- ฉาก 8 · แผนที่สัญญาณ (ฉาก/กล้องแยก หน่วยเมตร) + ตัวรับที่ อบต. (หน่วย มม.) ----------------
  const RECORD_SKIP = () => RECORD && !!window.__recordSkip;   // ?record=1: เล่นแผนที่เต็มเฉพาะข้อความขอช่วยครั้งแรก
  const MV = Sim && try3d ? createMapView() : null;
  if (MV) { Sim.setVisual(MV.adapter); window.__map = MV; }

  function createMapView() {
    const $id = (id) => document.getElementById(id);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const stageEl = $id('mapStage');
    const ui = { air: $id('muAir'), say: $id('muSay'), info: $id('mapInfo3d'), rx: $id('muRx'), skip: $id('muSkip'), back: $id('muBack'), tags: $id('mapTags'), btns: document.querySelector('#mapUi .mu-btns') };
    ui.info.innerHTML = MAPINFO_HTML;
    // มือถือ: จอ Serial อยู่ใต้การ์ด จึงโชว์บรรทัดล่าสุดบนแผนที่ด้วย
    ui.ser = document.createElement('p');
    ui.ser.className = 'mu-ser mono';
    ui.air.after(ui.ser);
    $id('mapInfoM').innerHTML = MAPINFO_HTML;
    ui.rx.innerHTML = RX_HTML;
    const st = { k: 0, view: 'map', skip: false, open: false, wave: null, dot: null, blink: 0, sayUntil: 0, raf: 0, user: false };
    let W3 = null;   // สร้างเมื่อเปิดแผนที่ครั้งแรก

    const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    const tween = (ms, fn) => new Promise((res) => {
      if (CALM || ms <= 0) { fn(1); res(); return; }
      const t0 = performance.now();
      const f = (ts) => { const k = Math.min(1, Math.max(0, (ts - t0) / ms)); fn(k); kick(); if (k < 1) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });

    function build() {
      const r2 = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance' });
      r2.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_SMALL || IS_TOUCH ? 1.5 : 2));
      r2.setClearColor(0xf3f2ee, 1);
      stageEl.appendChild(r2.domElement);
      const light = (sc, k) => {
        sc.add(new THREE.HemisphereLight(0xffffff, 0xb9b6ad, 2.0));
        const d = new THREE.DirectionalLight(0xffffff, 1.1); d.position.set(0.4 * k, 1 * k, 0.6 * k); sc.add(d);
      };
      // --- แผนที่ (เมตร) ---
      const mScene = new THREE.Scene(); light(mScene, 1000);
      const MAP = mod.MAP || { distanceM: 800, houseAntenna: [-400, 8, 0], rxAntenna: [400, 14, 0], relayHouse: [0, 5, 60] };
      const mapObj = mod.buildMap ? mod.buildMap(THREE) : fallbackMap(MAP);
      mScene.add(mapObj);
      const H = vec(THREE, MAP.houseAntenna); const R = vec(THREE, MAP.rxAntenna); const Rl = vec(THREE, MAP.relayHouse);
      const ground = (v, y = 2) => new THREE.Vector3(v.x, y, v.z);
      const DATA = 0x2e6db4;
      const circle = (c, r, mat) => {
        const pts = [];
        for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(c.x + r * Math.cos(a), 3, c.z + r * Math.sin(a))); }
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
        if (mat.isLineDashedMaterial) l.computeLineDistances();
        return l;
      };
      const ring1 = circle(R, 1000, new THREE.LineBasicMaterial({ color: DATA, transparent: true, opacity: 0.9 }));
      mScene.add(ring1);
      const ringFill = new THREE.Mesh(new THREE.CircleGeometry(1000, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: DATA, transparent: true, opacity: 0.05, depthWrite: false }));
      ringFill.position.set(R.x, 1.5, R.z);
      mScene.add(ringFill);
      let ourRing = null;
      if (OUR_RANGE_M) { ourRing = circle(R, OUR_RANGE_M, new THREE.LineDashedMaterial({ color: 0x1f1f1d, dashSize: 30, gapSize: 20 })); mScene.add(ourRing); }
      const distLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([ground(H, 4), ground(R, 4)]), new THREE.LineDashedMaterial({ color: 0x1f1f1d, dashSize: 24, gapSize: 16 }));
      distLine.computeLineDistances();
      mScene.add(distLine);
      const relay = new THREE.Line(new THREE.BufferGeometry().setFromPoints([H, Rl, R]), new THREE.LineDashedMaterial({ color: 0x1f1f1d, dashSize: 14, gapSize: 12 }));
      relay.computeLineDistances();
      relay.visible = false;
      mScene.add(relay);
      // คลื่น (วงกลมขยายรอบทิศ) 2 วง + จุดข้อมูล + ไฟตัวรับ
      const waveMat = () => new THREE.MeshBasicMaterial({ color: DATA, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const waves = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 128).rotateX(-Math.PI / 2), waveMat()); m.visible = false; m.renderOrder = 5; mScene.add(m); return m; });
      const dot = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12), new THREE.MeshBasicMaterial({ color: DATA }));
      dot.visible = false; mScene.add(dot);
      const glowT = makeGlowTexture(THREE);
      const dotGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: DATA, transparent: true, depthWrite: false, opacity: 0.6 }));
      dotGlow.scale.set(90, 90, 1); dot.add(dotGlow);
      const blink = (p) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: DATA, transparent: true, depthWrite: false, depthTest: false, opacity: 0 })); s.position.copy(p).add(new THREE.Vector3(0, 6, 0)); s.scale.set(160, 160, 1); s.renderOrder = 9; mScene.add(s); return s; };
      const rxBlink = blink(R); const boxBlink = blink(H);
      const mCam = new THREE.PerspectiveCamera(34, 1, 10, 30000);

      // --- ตัวรับที่ อบต. (มม.) ---
      const rScene = new THREE.Scene(); light(rScene, 1000);
      // ภาพตัดห้องชั้นบนสุดของ อบต.: เสาบนหลังคา สายเสาสั้น ตัวรับ + โน้ตบุ๊กบนโต๊ะ (parts.js buildOfficeCutaway)
      const cut = mod.buildOfficeCutaway ? mod.buildOfficeCutaway(THREE) : null;
      if (cut) rScene.add(cut);
      const rx = cut ? cut.userData.receiver : (mod.buildReceiver ? mod.buildReceiver(THREE) : fallbackBox(160, 40, 90, 0xd3d6cf));
      const laptop = cut ? cut.userData.laptop : (mod.buildLaptop ? mod.buildLaptop(THREE) : fallbackBox(330, 220, 230, 0xe9e8e3));
      if (!cut) { rScene.add(rx); rScene.add(laptop); laptop.position.set(320, 0, 0); }
      const rCam = new THREE.PerspectiveCamera(36, 1, 5, 20000);
      // จอโน้ตบุ๊ก = canvas texture แดชบอร์ดย่อ
      const lc = document.createElement('canvas'); lc.width = 640; lc.height = 400;
      const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace;
      const scr = (laptop.userData && laptop.userData.screen) || null;
      if (scr) { scr.material = new THREE.MeshBasicMaterial({ map: ltex, toneMapped: false }); }
      const rxLed = (rx.userData && rx.userData.statusLed) || null;
      W3 = { r2, mScene, mapObj, MAP, H, R, Rl, ring1, ringFill, ourRing, distLine, relay, waves, dot, rxBlink, boxBlink, mCam, rScene, rx, laptop, rCam, lc, ltex, rxLed, lkey: '' };
      fitMap(); fitRx(); drawLaptop(true);
      return W3;
    }
    function fallbackMap(MAP) {
      const g = new THREE.Group();
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf7f6f2 }));
      g.add(plane);
      for (const p of [MAP.houseAntenna, MAP.rxAntenna, MAP.relayHouse]) { const b = fallbackBox(30, 20, 30, 0xdad8d0); b.position.set(p[0], 10, p[2]); g.add(b); }
      return g;
    }
    function fallbackBox(w, h, d, c) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
      m.position.y = h / 2;
      const g = new THREE.Group(); g.add(m); return g;
    }

    // กรอบภาพ: พื้นที่ว่างระหว่างแผง (เหมือนฉากกล่อง)
    const rect = () => (SHOT ? { l: 0, r: window.innerWidth, t: 0, b: window.innerHeight } : TV.rect || { l: 0, r: window.innerWidth, t: 60, b: window.innerHeight });
    // คำนวณมุมกล้องให้วัตถุรัศมี R (แนวนอน) สูงครึ่งละ h พอดีกรอบ rr
    function aim(cam, target, yawDeg, pitchDeg, R, h, fill, rr) {
      const W = window.innerWidth; const Hh = window.innerHeight; const r = rr || rect();
      const rw = Math.max(80, r.r - r.l); const rh = Math.max(80, r.b - r.t);
      const tanV = Math.tan((cam.fov * Math.PI) / 360);
      const pr = (pitchDeg * Math.PI) / 180; const yr = (yawDeg * Math.PI) / 180;
      const needV = (R * Math.sin(pr) * 1.15 + h * Math.cos(pr)) / (fill * (rh / Hh) * tanV);
      const needH = R / (fill * (rw / W) * tanV * (W / Hh));
      const d = Math.max(needV, needH);
      const p = new THREE.Vector3(target.x + d * Math.cos(pr) * Math.sin(yr), target.y + d * Math.sin(pr), target.z + d * Math.cos(pr) * Math.cos(yr));
      return { p, t: target.clone(), d, cx: (r.l + r.r) / 2, cy: (r.t + r.b) / 2 };
    }
    const lerpV = new THREE.Vector3(); const lerpT = new THREE.Vector3();
    function apply(cam, A, B, k) {
      const W = window.innerWidth; const Hh = window.innerHeight;
      const e = easeIO(Math.min(1, Math.max(0, k)));
      // ระยะเปลี่ยนแบบลอการิทึม (ซูมจากระดับกิโลเมตรถึงระดับห้อง ดูลื่น)
      const dA = A.p.distanceTo(A.t); const dB = B.p.distanceTo(B.t);
      const d = Math.exp(Math.log(dA) + (Math.log(dB) - Math.log(dA)) * e);
      lerpT.lerpVectors(A.t, B.t, e);
      lerpV.lerpVectors(A.p.clone().sub(A.t).normalize(), B.p.clone().sub(B.t).normalize(), e).normalize();
      cam.position.copy(lerpT).addScaledVector(lerpV, d);
      cam.lookAt(lerpT);
      cam.aspect = W / Hh; cam.near = d / 60; cam.far = d * 8;
      const cx = A.cx + (B.cx - A.cx) * e; const cy = A.cy + (B.cy - A.cy) * e;
      cam.setViewOffset(W, Hh, W / 2 - cx, Hh / 2 - cy, W, Hh);
      cam.updateProjectionMatrix();
    }
    const F = {};   // มุมกล้องที่คำนวณไว้: map (ทั้งแผนที่), office (ซูมเข้า อบต.), all (ภาพตัดทั้งห้อง+เสา), desk (โต๊ะ+จอโน้ตบุ๊ก)
    function fitMap() {
      if (!W3) return;
      const { H, R } = W3;
      // บ้านอยู่ซ้าย อบต. อยู่ขวาของภาพ (ทิศจากบ้านไป อบต. = แกนขวาของกล้อง)
      const dx = R.x - H.x; const dz = R.z - H.z; const L = Math.hypot(dx, dz) || 1;
      const yaw = (Math.atan2(-dz / L, dx / L) * 180) / Math.PI;
      const t = new THREE.Vector3(R.x - dx * 0.12, 0, R.z - dz * 0.12);
      // เว้นที่ให้ข้อความเวลาออกอากาศ (บน) และข้อมูลระยะ (ล่าง)
      const r = rect(); const infoH = getComputedStyle(ui.info).display === 'none' ? 0 : ui.info.offsetHeight || 0;
      const mr = { l: r.l, r: r.r, t: r.t + (IS_SMALL ? 58 : 70), b: r.b - (infoH ? infoH + 16 : 8) };
      F.map = aim(W3.mCam, t, yaw, IS_SMALL ? 62 : 52, 1080, 0, 0.94, mr);
      const o = vec(THREE, W3.MAP.office || W3.MAP.rxAntenna).setY(8);
      F.office = aim(W3.mCam, o, yaw - 30, 30, 45, 10, 0.9);
    }
    function fitRx() {
      if (!W3) return;
      const box = new THREE.Box3().setFromObject(W3.rScene);
      const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
      F.all = aim(W3.rCam, c, -22, 14, s.x * 0.52, s.y * 0.5, 0.95);
      const lp = W3.laptop.userData.anchors ? vec(THREE, W3.laptop.userData.anchors.screenCenter) : W3.laptop.position.clone();
      W3.laptop.updateMatrixWorld(true);
      const sc = W3.laptop.localToWorld(lp.clone());
      const rxp = W3.rx.getWorldPosition(new THREE.Vector3());
      const mid = sc.clone().lerp(rxp, 0.45);
      F.desk = aim(W3.rCam, mid, -14, 18, Math.max(300, sc.distanceTo(rxp) * 0.95), 140, 0.92);
    }

    // ----- จอโน้ตบุ๊ก: แดชบอร์ดย่อ (ตัวใหญ่ อ่านออก) -----
    const DOT_HEX = { red: '#D23B30', yellow: '#E8B400', green: '#2F8A3E', orange: '#E0701A', silent: '#888780', idle: '#FFFFFF' };
    function drawLaptop(force) {
      if (!W3) return;
      const rows = Sim.laptopRows();
      const k = JSON.stringify(rows);
      if (!force && k === W3.lkey) return;
      W3.lkey = k;
      const g = W3.lc.getContext('2d'); const w = W3.lc.width; const h = W3.lc.height;
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1F1F1D'; g.font = `700 34px ${FONT_TH}`; g.textBaseline = 'middle';
      g.fillText('จอทีมช่วยเหลือ', 28, 44);
      g.fillStyle = '#5F5E5A'; g.font = `400 22px ${FONT_TH}`; g.fillText('จำลอง', w - 100, 46);
      g.fillStyle = '#DAD8D0'; g.fillRect(0, 80, w, 2);
      rows.forEach(([name, word, col], i) => {
        const y = 128 + i * 92;
        g.beginPath();
        if (col === 'orange') { g.lineWidth = 7; g.strokeStyle = DOT_HEX.orange; g.arc(48, y, 14, 0, Math.PI * 2); g.stroke(); }
        else if (col === 'yellow') { g.fillStyle = DOT_HEX.yellow; g.moveTo(48, y - 18); g.lineTo(66, y); g.lineTo(48, y + 18); g.lineTo(30, y); g.closePath(); g.fill(); }
        else { g.fillStyle = DOT_HEX[col] || '#fff'; g.arc(48, y, 16, 0, Math.PI * 2); g.fill(); g.lineWidth = col === 'silent' ? 5 : 2; g.strokeStyle = col === 'silent' ? DOT_HEX.orange : '#9C9A92'; g.stroke(); }
        g.fillStyle = '#1F1F1D'; g.font = `700 36px ${FONT_TH}`; g.fillText(name, 86, y);
        g.font = `${i === 0 ? 700 : 400} 32px ${FONT_TH}`; g.fillStyle = i === 0 ? '#1F1F1D' : '#5F5E5A';
        const tw = g.measureText(word).width;
        g.fillText(word, w - 28 - tw, y);
        g.fillStyle = '#DAD8D0'; g.fillRect(28, y + 44, w - 56, 2);
      });
      W3.ltex.needsUpdate = true;
    }

    // ----- ป้ายบนแผนที่ (HTML ฉายจากจุด 3D) -----
    const tagEls = {};
    const mkTag = (k, html, cls) => { const el = document.createElement('div'); el.className = 'mtag ' + (cls || ''); el.innerHTML = html; ui.tags.appendChild(el); tagEls[k] = el; return el; };
    mkTag('house', `${HOUSE} · บ้านในเรื่อง`, 'strong');
    mkTag('rx', 'อบต. · ตัวรับ', 'strong');
    mkTag('dist', '≈ 0.8 กม. (แผนที่จำลอง)', 'dist');
    mkTag('ring', 'ราว 1 กม. · ในเมือง เสาสูงแค่ 1.5 ม. — จากงานวิจัย', 'ring');
    if (OUR_RANGE_M) mkTag('our', 'วัดจริง 25 ต.ค.', 'plan');
    mkTag('relay', 'แผนพัฒนา: บ้านข้างเคียงส่งต่อสัญญาณ', 'plan');
    // หมุดตำแหน่งบ้านในเรื่อง / อบต. (บนแผนที่ระดับกิโลเมตร ตัวอาคารเล็กเกินกว่าจะเห็น)
    const pinEls = {};
    for (const k of ['house', 'rx']) { const el = document.createElement('i'); el.className = 'mpin'; ui.tags.appendChild(el); pinEls[k] = el; }
    const pv = new THREE.Vector3();
    // align: 'c' กลางจุด · 'l' ป้ายอยู่ซ้ายของจุด · 'r' ป้ายอยู่ขวาของจุด
    function placeTag(k, p, cam, align = 'c', dy = -16, show = true) {
      const el = tagEls[k]; if (!el) return;
      const pin = pinEls[k];
      el.style.display = show ? '' : 'none';
      if (pin) pin.style.display = show ? '' : 'none';
      if (!show) return;
      pv.copy(p).project(cam);
      const x = (pv.x * 0.5 + 0.5) * window.innerWidth; const y = (-pv.y * 0.5 + 0.5) * window.innerHeight;
      const w = el.offsetWidth; const r = rect();
      const want = align === 'l' ? x - w + 8 : align === 'r' ? x - 8 : x - w / 2;
      const lx = Math.max(r.l + 4, Math.min(r.r - w - 4, want));
      el.style.transform = `translate(${lx.toFixed(1)}px, ${(y + dy - el.offsetHeight).toFixed(1)}px)`;
      if (pin) pin.style.transform = `translate(${(x - 5).toFixed(1)}px, ${(y - 5).toFixed(1)}px)`;
    }
    function placeUi() {
      const r = rect(); const s = (el, l, t) => { el.style.left = l + 'px'; el.style.top = t + 'px'; };
      s(ui.air, r.l + 8, r.t + 4);
      ui.air.style.maxWidth = Math.max(200, r.r - r.l - 16) + 'px';
      s(ui.say, r.l + 8, r.t + 4 + (ui.air.offsetHeight ? ui.air.offsetHeight + 6 : 0));
      const ih = ui.info.offsetHeight;
      s(ui.info, r.l + 8, r.b - ih - 8);
      ui.info.style.maxWidth = Math.min(660, r.r - r.l - 16) + 'px';
      s(ui.rx, r.l + 8, r.t + 4);
      s(ui.ser, r.l + 8, r.b - ui.ser.offsetHeight - 8);
      ui.ser.style.maxWidth = Math.max(200, r.r - r.l - 16) + 'px';
      ui.rx.style.maxWidth = Math.min(380, r.r - r.l - 16) + 'px';
      const bw = ui.btns.offsetWidth;
      const below = getComputedStyle(ui.info).display === 'none' || root.classList.contains('rxview') ? 0 : ih + 6;
      s(ui.btns, r.r - bw - 8, r.b - below - ui.btns.offsetHeight - 8);
    }

    // ----- วาด -----
    function kick() { if (!st.raf) st.raf = requestAnimationFrame(frame); }
    const veil = document.createElement('div');
    veil.className = 'veil';
    stageEl.appendChild(veil);
    function frame() {
      st.raf = 0;
      if (!W3 || st.k <= 0.001) { stageEl.style.opacity = '0'; root.classList.remove('mapview', 'rxview'); return; }
      root.classList.add('mapview');
      stageEl.style.opacity = st.k.toFixed(3);
      veil.style.opacity = (st.veil || 0).toFixed(3);
      const t = performance.now();
      const { r2 } = W3;
      const W = window.innerWidth; const Hh = window.innerHeight;
      if (r2.__w !== W || r2.__h !== Hh) { r2.setSize(W, Hh, false); r2.__w = W; r2.__h = Hh; fitMap(); fitRx(); }
      const inRx = st.view === 'rx';
      root.classList.toggle('rxview', inRx);
      if (inRx) {
        drawLaptop();
        if (W3.rxLed && W3.rxLed.setOn) W3.rxLed.setOn(st.blink > t, 1);
        apply(W3.rCam, F.all, F.desk, st.rz);
        r2.render(W3.rScene, W3.rCam);
        for (const k in tagEls) tagEls[k].style.display = 'none';
      } else {
        apply(W3.mCam, F.map, F.office, st.mz);
        // คลื่น
        const wv = st.wave;
        W3.waves.forEach((m, i) => {
          if (st.freezeWave) { const rr = st.freezeWave * (i ? 0.62 : 1); m.visible = true; m.position.set(W3.H.x, 3 + i * 0.5, W3.H.z); m.scale.set(rr, 1, rr); m.material.opacity = i ? 0.45 : 0.3; return; }
          if (!wv) { m.visible = false; return; }
          const k = (t - wv.t0 - i * wv.gap) / wv.ms;
          if (k < 0 || k > 1 || (i > 0 && !wv.long)) { m.visible = false; return; }
          const rr = 30 + k * wv.reach;
          m.visible = true;
          m.position.set(wv.from.x, 3 + i * 0.5, wv.from.z);
          m.scale.set(rr, 1, rr);
          m.material.opacity = (wv.ok ? 0.6 : 0.6 * Math.max(0, 1 - k / 0.55)) * (1 - k * 0.7);
        });
        const d = st.dot;
        W3.dot.visible = !!d && d.vis > 0.01;
        if (d) {
          W3.dot.position.lerpVectors(d.from, d.to, d.k);
          W3.dot.position.y += Math.sin(d.k * Math.PI) * 40;
          W3.dot.material.transparent = d.vis < 1; W3.dot.material.opacity = d.vis;
          W3.dot.children[0].material.opacity = 0.6 * d.vis;
        }
        const bl = (sp, until) => { const on = until > t; sp.material.opacity = on ? 0.85 * (0.5 + 0.5 * Math.sin(t / 60)) : 0; sp.visible = on; };
        bl(W3.rxBlink, st.blink); bl(W3.boxBlink, st.boxBlink || 0);
        W3.relay.visible = Sim.offline;
        r2.render(W3.mScene, W3.mCam);
        const cam = W3.mCam;
        const far = st.mz < 0.25;
        placeTag('house', W3.H, cam, 'l', -12, far);
        placeTag('rx', W3.R, cam, 'r', -12, st.mz < 0.6);
        placeTag('dist', new THREE.Vector3().lerpVectors(W3.H, W3.R, 0.5).setY(4), cam, 'c', 34, far);
        // ป้ายวง 1 กม.: ที่ขอบวงด้านข้าง (ไม่ทับเส้นบ้าน → อบต.)
        const away = W3.R.clone().sub(W3.H).setY(0).normalize();
        const side = new THREE.Vector3(-away.z, 0, away.x);
        placeTag('ring', W3.R.clone().addScaledVector(side, -1000).setY(3), cam, 'c', -6, far);
        if (OUR_RANGE_M) placeTag('our', W3.R.clone().addScaledVector(side, OUR_RANGE_M).setY(3), cam, 'c', -6, far);
        placeTag('relay', W3.Rl, cam, 'c', 40, far && Sim.offline);
      }
      if (st.sayUntil && t > st.sayUntil) { st.sayUntil = 0; ui.say.textContent = ''; }
      placeUi();
      const live = st.wave || st.dot || st.blink > t || (st.boxBlink || 0) > t || st.sayUntil;
      if (live || st.k < 1) kick();
      if (st.wave && t - st.wave.t0 > st.wave.ms + st.wave.gap + 50) st.wave = null;
    }
    window.addEventListener('resize', () => { if (W3) { fitMap(); fitRx(); kick(); } });

    // ----- ลำดับภาพที่ตัวคุมวิทยุเรียก -----
    const fast = () => st.skip || RECORD_SKIP();
    st.veil = 0; st.veil0 = 0; st.mz = 0; st.rz = 0;
    const veilTo = (v, ms) => {
      const v0 = st.veil;
      return tween(ms, (k) => { st.veil = v0 + (v - v0) * k; }).then(() => { st.veil = v; kick(); });
    };
    // เปลี่ยนภาพแผนที่ ↔ ภาพตัดตัวรับ ผ่านพื้นกระดาษ (ไม่เห็นฉากกล่องแทรก)
    async function switchView(v, prep) {
      if (st.view === v) { if (prep) prep(); kick(); return; }
      if (CALM) { st.view = v; if (prep) prep(); kick(); return; }
      await veilTo(1, 240);
      st.view = v; if (prep) prep(); kick();
      await veilTo(0, 260);
    }
    async function open() {
      st.skip = false;
      if (!W3) build();
      root.classList.toggle('mapskip', Sim.trips >= 2 && !RECORD);
      if (st.open && st.k >= 1) {
        // เปิดอยู่แล้ว (เช่น ผู้ชมกำลังดูตัวรับ): กลับมาที่แผนที่ทั้งหมด
        st.user = false;
        await switchView('map', () => { st.mz = 0; });
        st.mz = 0; return;
      }
      st.open = true; st.view = 'map'; st.mz = 0;
      if (fast()) return;
      fitMap();
      await tween(520, (k) => { TV.pull = easeIO(k); dirty = true; });
      await tween(420, (k) => { st.k = k; dirty = true; });
    }
    async function close() {
      root.classList.remove('mapskip');
      ui.ser.textContent = '';
      ui.air.innerHTML = '';
      if (!st.open) return;
      st.open = false; st.user = false;
      if (st.k > 0 && !fast()) await tween(380, (k) => { st.k = 1 - k; dirty = true; });
      st.k = 0; st.view = 'map'; st.mz = 0; st.rz = 0; st.veil = 0; st.wave = null; st.dot = null; kick();
      if (TV.pull > 0 && !fast()) await tween(480, (k) => { TV.pull = 1 - easeIO(k); dirty = true; });
      TV.pull = 0; dirty = true;
    }
    function abort() {
      ui.ser.textContent = '';
      st.open = false; st.user = false; st.k = 0; st.view = 'map'; st.mz = 0; st.rz = 0; st.veil = 0;
      st.wave = null; st.dot = null; st.skip = false; st.freezeWave = 0;
      TV.pull = 0; ui.air.innerHTML = ''; ui.say.textContent = '';
      root.classList.remove('mapskip', 'rxview');
      dirty = true; kick();
    }
    async function fly({ dir, type, ok }) {
      if (fast() || !W3 || st.k < 0.5) { await wait(fast() ? 120 : 450); return; }
      const long = LONG_PRE.has(type);
      const ms = long ? 1700 : 1000;
      const from = dir === 'up' ? W3.H : W3.R; const to = dir === 'up' ? W3.R : W3.H;
      if (dir === 'up') st.boxBlink = performance.now() + 500;
      st.wave = { from, t0: performance.now(), ms: ms * 1.15, reach: 1250, ok, long, gap: long ? 520 : 0 };
      st.dot = { from, to, k: 0, vis: 1 };
      kick();
      await tween(ms, (k) => {
        if (!st.dot) return;
        st.dot.k = k < 1 ? (long ? k : 1 - Math.pow(1 - k, 2)) : 1;
        if (!ok) { st.dot.k = Math.min(st.dot.k, 0.62); st.dot.vis = Math.max(0, 1 - Math.max(0, k - 0.3) / 0.35); }
      });
      st.dot = null;
      if (ok && dir === 'down') st.boxBlink = performance.now() + 420;
      kick();
    }
    function rx() { st.blink = performance.now() + 650; kick(); }
    function text(main, sub) { ui.air.innerHTML = esc(main) + (sub ? `<small>${sub}</small>` : ''); kick(); }
    function say(t) { ui.say.textContent = 'กล่องพูด: "' + t + '"'; st.sayUntil = performance.now() + 4200; kick(); }
    // ขาดการติดต่อ: ซูมเข้า อบต. → จอโน้ตบุ๊ก → กลับแผนที่
    async function laptop() {
      if (fast() || !W3 || st.k < 0.5) { await wait(300); return; }
      await tween(800, (k) => { st.mz = k; });
      await switchView('rx', () => { st.rz = 1; drawLaptop(true); ui.rx.innerHTML = RX_HTML_OFF; });
      await wait(2800);
      await switchView('map', () => { st.mz = 0; ui.rx.innerHTML = RX_HTML; });
    }
    // ปุ่ม "ดูตัวรับ" (ผู้ชมเปิดเอง): กล่อง → แผนที่ → ซูมเข้า อบต. → ภาพตัดห้องชั้นบนสุด → เลื่อนไปที่โต๊ะ
    async function showRx() {
      if (Sim.busy || st.open) return;
      if (!W3) build();
      st.open = true; st.user = true; st.view = 'map'; st.mz = 0; st.rz = 0;
      fitMap(); fitRx(); drawLaptop(true); ui.rx.innerHTML = RX_HTML;
      if (CALM) { st.view = 'rx'; st.rz = 1; st.k = 1; TV.pull = 1; dirty = true; kick(); return; }
      await tween(520, (k) => { TV.pull = easeIO(k); dirty = true; });
      await tween(380, (k) => { st.k = k; dirty = true; });
      if (!st.user) return;
      await tween(1000, (k) => { st.mz = k; });
      if (!st.user) return;
      await switchView('rx', () => { st.rz = 0; });
      await wait(1100);
      if (!st.user) return;
      await tween(1300, (k) => { st.rz = k; });
    }
    async function hideRx() { st.user = false; await close(); }
    $id('tryRx').addEventListener('click', showRx);
    ui.back.addEventListener('click', hideRx);
    ui.skip.addEventListener('click', () => { st.skip = true; st.wave = null; st.dot = null; root.classList.remove('mapskip'); });
    Sim.onChange(() => { if (st.k > 0) kick(); });
    return {
      adapter: { open, close, abort, fly, rx, text, say, laptop, serial(line) { ui.ser.textContent = 'Serial  ' + line; kick(); } },
      get k() { return st.k; },
      get view() { return st.view; },
      showRx, hideRx, kick,
      // ภาพนิ่ง / ภาพตรวจ: แผนที่ระหว่างคลื่นวิ่ง หรือ ตัวรับที่ อบต. (ไม่มีภาพเคลื่อนไหว)
      freeze(view, k = 0.55) {
        if (!W3) build();
        fitMap(); fitRx();
        st.open = true; st.k = 1; st.view = view || 'map'; TV.pull = 1;
        if (st.view === 'map') {
          st.dot = { from: W3.H, to: W3.R, k, vis: 1 };
          st.freezeWave = 30 + k * 1250;
          if (!SHOT) text(`กล่องส่ง "${MSG_TH.SOS}" (SOS) ครั้งที่ 1`, AIR_NOTE.short);
        } else { st.rz = Math.min(1, k * 2); drawLaptop(true); ui.rx.innerHTML = RX_HTML; }
        dirty = true; kick();
      },
    };
  }

  layout();
  window.addEventListener('resize', layout);
  Sim && Sim.onChange(() => { if (tryOn && tryBoxKind !== (Sim.scen === 'auto' ? 'auto' : 'n')) layout(); });

  // ---------------- โหมด ----------------
  if (AT !== null) {
    // ?at=0.xx : แสดงฉาก ณ ตำแหน่งนั้นทันที สำหรับถ่ายภาพตรวจ
    tl.seek(AT * TOTAL);
    render();
    document.body.style.overflow = 'hidden';
    // ?map=1 / ?map=rx : ภาพตรวจ/ภาพนิ่ง แผนที่ระหว่างคลื่นวิ่ง หรือ ตัวรับที่ อบต. (ใช้คู่กับ ?at=0.97)
    if (MV && query.get('map')) MV.freeze(query.get('map') === 'rx' ? 'rx' : 'map', parseFloat(query.get('k')) || 0.55);
  } else if (REDUCED) {
    // ลดการเคลื่อนไหว: เลื่อนทีละขั้น แสดงภาพนิ่งของขั้นนั้นทันที ไม่มี animation ต่อเนื่อง
    const onScrollReduced = () => {
      const max = track.offsetHeight - window.innerHeight;
      const raw = clamp01((window.scrollY - track.offsetTop) / Math.max(1, max));
      const S = activeStep(raw + 0.002);
      tl.seek(S.at * TOTAL);
      dirty = true;
    };
    window.addEventListener('scroll', onScrollReduced, { passive: true });
    onScrollReduced();
  } else {
    tl.seek(0);
    onScroll({ target: track, enter: 'top top', leave: 'bottom bottom', sync: RECORD ? 1 : 0.7 }).link(tl);
  }
  if (RECORD) autoScroll();

  clearTimeout(window.__fallbackTimer);
  window.__exploded3d = true;
  requestAnimationFrame(loop);
  render();
  root.dataset.ready = '3d';
  root.dataset.viewport = innerWidth + 'x' + innerHeight;

  // ?record=1 : เลื่อนอัตโนมัติด้วยความเร็วคงที่ จบที่ฉากสุดท้าย แล้วเล่นลองใช้ทั้ง 3 เรื่อง
  function autoScroll() {
    const seconds = parseFloat(query.get('seconds')) || 45;
    const delay = 1500;
    window.scrollTo(0, 0);
    let t0 = null;
    const tick = (ts) => {
      if (t0 === null) t0 = ts + delay;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const k = clamp01((ts - t0) / (seconds * 1000));
      window.scrollTo(0, Math.round(max * k));
      if (k < 1) requestAnimationFrame(tick);
      else {
        root.dataset.scrollDone = '1';
        let n = 0;
        const go = () => {
          if (tryOn) tryDemo().then(() => { root.dataset.recordDone = '1'; });
          else if (++n < 120) requestAnimationFrame(go);
          else root.dataset.recordDone = '1';
        };
        go();
      }
    };
    requestAnimationFrame(tick);
  }
}

// ---------------------------------------------------------------------------
function vec(THREE, a) {
  return Array.isArray(a) ? new THREE.Vector3(a[0], a[1], a[2]) : new THREE.Vector3(a.x, a.y, a.z);
}

function makeGlowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
