// หน้า "จุดบัดกรีทั้งหมด" สำหรับช่าง — สร้างจากข้อมูลสายใน breadboard-nets.js (ไฟล์เดียวกับหน้า 3 มิติ) จึงตรงกันเสมอ
// จุดบัดกรี = ปลายสายที่ไม่ได้เสียบรู breadboard (at = null) · หน้าตาขาของแต่ละชิ้นวาดตามรูปของจริงที่ผู้ใช้ส่ง (1 พ.ย.)
import { BB_HOUSE, BB_RX } from './breadboard-nets.js';
import { holeText, bbShort } from './breadboard.js';

const COLOR = { power: ['แดง', '#B4462F'], ground: ['ดำ', '#1F1F1D'], data: ['น้ำเงิน', '#2E6DB4'], audio: ['ม่วง', '#7A4FB0'] };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- รวมปลายสายที่ต้องบัดกรีจากข้อมูลสาย
function solderEnds(board, where) {
  const out = [];
  board.nets.forEach((n) => [0, 1].forEach((k) => {
    if (n.at[k] !== null) return;
    const end = k ? n.to : n.from; const i = end.indexOf('.');
    out.push({ part: end.slice(0, i), pin: end.slice(i + 1), net: n, other: k ? n.from : n.to, otherHole: n.at[1 - k], where });
  }));
  return out;
}
const ALL = [...solderEnds(BB_HOUSE, 'กล่องบ้าน'), ...solderEnds(BB_RX, 'ตัวรับ')];
const entryOf = (parts, pin) => ALL.find((e) => parts.includes(e.part) && e.pin === pin);

// ---- ชิ้นที่ต้องบัดกรี · pads: 'ตัวหนังสือบนชิ้น:ชื่อขาในข้อมูล' (ไม่มี : = ไม่ต้องบัดกรี)
const SECTIONS = [
  { parts: ['sx', 'rx-sx'], title: 'วิทยุ XL1276-P01', qty: '2 ตัว · กล่องบ้าน 1 + ตัวรับ 1 · บัดกรีเหมือนกันทุกจุด',
    view: 'มองด้านที่มีตัวหนังสือ (ด้านหลังโมดูล) วางให้ ANT อยู่มุมขวาบน', shape: 'radio',
    L: ['GND:GND', 'DIO5', 'RES:RESET', 'NSS:NSS', 'SCK:SCK', 'MOSI:MOSI', 'MISO:MISO', 'GND'],
    R: ['ANT:ANT', 'GND', 'DIO3', 'DIO4', 'VCC:3.3V', 'DIO0:DIO0', 'DIO1', 'DIO2'],
    tips: { '3.3V': 'ไฟ 3.3 V เท่านั้น', GND: 'GND มี 3 จุด ต่อถึงกันในโมดูล ใช้จุดนี้จุดเดียว', ANT: 'บัดกรีเป็นจุดสุดท้าย ไม่ใช้สาย' },
    warn: ['ขาห่างกันแค่ประมาณ 2 มม. ระวังตะกั่วเชื่อมข้ามไปจุดข้าง ๆ โดยเฉพาะ VCC กับ DIO4 / DIO0', 'แตะหัวแร้งไม่เกิน 3 วินาทีต่อจุด ชิปวิทยุร้อนเกินจะเสีย', 'บัดกรีเสร็จหยดกาวร้อนยึดสายกับโมดูล กันสายดึงจนแผ่นทองแดงหลุด'] },
  { parts: ['ring'], title: 'แหวนไฟ CJMCU-2812B-12', qty: '1 วง',
    view: 'มองด้านหลัง (ด้านที่ไม่มีไฟ) จุดบัดกรี 4 จุดอยู่ที่ขอบ', shape: 'ring',
    R: ['DI:DIN', '5V:5V', 'GND:GND', 'DO'],
    tips: { DIN: 'สายข้อมูลสี', '5V': 'ไฟ 5 V' },
    warn: ['จุด 5V กับ GND อยู่ติดกัน ถ้าตะกั่วเชื่อมกัน = ลัดวงจร', 'จุดเป็นแผ่นทองแดงเรียบ ชุบตะกั่วที่แผ่นก่อน แล้ววางสายที่ชุบแล้วลงไปให้ละลายติด', 'DO ไม่ต้องบัดกรี (ไว้ต่อแหวนวงถัดไป)'] },
  { parts: ['amp'], title: 'แผ่นขยายเสียง PAM8403 (แผ่นสีแดง)', qty: '1 แผ่น',
    view: 'มองด้านที่มีชิป ขา 11 ขาเรียงที่ขอบซ้าย', shape: 'amp',
    L: ['R+', 'R−', 'L−:L-', 'L+:L+', 'GND:GND', '+5V:+5V', 'SW', 'GND', 'LIN:LIN', 'GND', 'RIN:RIN'],
    tips: { GND: 'ใช้ GND ตัวที่อยู่เหนือ +5V', '+5V': 'อย่าให้ตะกั่วเชื่อมกับ SW ที่อยู่ติดกัน', 'L-': 'ห้ามต่อลง GND', RIN: 'ช่องขวาไม่ใช้ ต่อลง GND กันเสียงซ่า' },
    warn: ['ขา SW, R+, R− และ GND อีก 2 ขา ไม่ต้องบัดกรี', 'L+ / L− ต่อกับสายลำโพงโดยตรง: ตัดปลั๊กเล็กของลำโพงทิ้ง หรือบัดกรีสายต่อแล้วหุ้มท่อหด'] },
  { parts: ['btn-sos'], title: 'ปุ่มแดง 60 มม.', qty: '1 ปุ่ม', shape: 'switch',
    view: 'ไมโครสวิตช์สีฟ้า (BLEE) ข้างปุ่ม · ขาเรียงตามขอบ COM · NO · NC', row: ['COM ①:COM', 'NO ③:NO', 'NC ②'],
    tips: { COM: 'ขาร่วม', NO: 'ขากลาง' },
    warn: ['ใช้ COM ① กับ NO ③ เท่านั้น ไม่ใช้ NC ②', 'ขั้วใหญ่ 2 ขาบนตัวปุ่มเป็นขั้วหลอดไฟ ไม่ต้องต่อ', 'ขาเป็นแบบแบนมีรู สอดสายผ่านรูแล้วบัดกรี หรือใช้หางปลาตัวเมีย 4.8 มม. เสียบแทนบัดกรีก็ได้'] },
  { parts: ['btn-ack'], title: 'ปุ่มเขียว 46 มม.', qty: '1 ปุ่ม', shape: 'switch',
    view: 'ไมโครสวิตช์แบบเดียวกับปุ่มแดง', row: ['COM ①:COM', 'NO ③:NO', 'NC ②'],
    tips: { COM: 'ขาร่วม', NO: 'ขากลาง' }, warn: ['ใช้ COM ① กับ NO ③ เท่านั้น ไม่ใช้ NC ②'] },
];

// ---- ปลายอีกด้านของสาย (ภาษาง่าย)
function destOf(e) {
  if (e.part === 'amp' && /^L[+-]$/.test(e.pin)) return `ต่อตรงกับสาย${e.pin === 'L+' ? 'แดง (+)' : 'ดำ (−)'}ของลำโพง`;
  if (e.pin === 'ANT') return 'เสาสปริงที่แถมมา: บัดกรีขาตรงของเสาลงแผ่นนี้โดยตรง';
  if (!e.otherHole) return bbShort(e.other);
  const o = e.other; const m = /^(?:rx-)?mcu\.GPIO(\d+)$/.exec(o);
  const onBoard = [...BB_HOUSE.parts, ...BB_RX.parts].find((p) => p.id === o.split('.')[0]);   // R / C / D บนแผ่น
  const to = m ? `ขา ${m[1]} ของบอร์ด ESP32` : /^bb\./.test(o) ? bbShort(o).replace('VSYS', '5V') : onBoard ? `${onBoard.id} ${onBoard.value} (บนแผ่น)` : bbShort(o);
  return `หัวเข็มเสียบ breadboard → ${to}`;
}

// ---- รูปขาของชิ้น (SVG) · จุดที่ต้องบัดกรีมีเลขกำกับตามตาราง สีเลข = สีสาย
const padList = (sec) => [...(sec.L || []).map((p) => ['L', p]), ...(sec.R || []).map((p) => ['R', p]), ...(sec.row || []).map((p) => ['T', p])]
  .map(([side, p]) => { const [label, key] = p.split(':'); const e = key ? entryOf(sec.parts, key) : null; return { side, label, key, e }; });

function badge(x, y, n, color) {
  return `<g><circle cx="${x}" cy="${y}" r="11" fill="${color}"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" class="bn">${n}</text></g>`;
}
function svgOf(sec, pads) {
  const used = (p) => !!p.e; let n = 0;
  const num = new Map(pads.filter(used).map((p) => [p, ++n]));
  const col = (p) => (p.e ? (p.key === 'ANT' ? '#8A6D1F' : COLOR[p.e.net.type][1]) : null);
  if (sec.shape === 'switch') {
    const xs = [96, 168, 240]; let s = `<svg viewBox="0 0 340 170" role="img" aria-label="${esc(sec.title)}">`;
    s += '<rect x="56" y="64" width="232" height="78" rx="6" fill="#DCE6F6" stroke="#2A5FB0" stroke-width="2"/>';
    s += '<rect x="288" y="92" width="22" height="16" rx="3" fill="#E0B84A" stroke="#8A6D1F"/><text x="318" y="84" text-anchor="middle" class="sl">ก้านกด</text>';
    s += '<text x="172" y="132" text-anchor="middle" class="sl" fill="#2A5FB0">BLEE</text>';
    pads.forEach((p, i) => {
      const x = xs[i]; const u = used(p);
      s += `<rect x="${x - 14}" y="30" width="28" height="36" rx="2" fill="${u ? '#D9B45A' : '#D6D4CC'}" stroke="${u ? '#8A6D1F' : '#9C9A92'}"/><circle cx="${x}" cy="42" r="4.5" fill="#fff" stroke="${u ? '#8A6D1F' : '#9C9A92'}"/>`;
      s += `<text x="${x}" y="96" text-anchor="middle" class="pl${u ? '' : ' off'}">${esc(p.label)}</text>`;
      if (u) s += badge(x, 14, num.get(p), col(p));
    });
    return s + '</svg>';
  }
  const rows = Math.max(sec.L?.length || 0, sec.R?.length || 0); const pitch = 27; const h = rows * pitch + 46; const w = 380;
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(sec.title)}">`;
  const yOf = (i) => 34 + i * pitch;
  let x0 = 120; let x1 = 260; let silk = '#1F1F1D';
  if (sec.shape === 'radio') s += `<rect x="${x0}" y="12" width="${x1 - x0}" height="${h - 24}" rx="4" fill="#E3EBF7" stroke="#2A5FB0" stroke-width="2"/>`;
  if (sec.shape === 'amp') { x0 = 150; x1 = 300; s += `<rect x="${x0}" y="12" width="${x1 - x0}" height="${h - 24}" rx="4" fill="#F7DEDA" stroke="#C72A1F" stroke-width="2"/><rect x="${x0 + 50}" y="${h / 2 - 60}" width="70" height="26" rx="2" fill="#2A2A2A"/><text x="${x0 + 85}" y="${h / 2 - 43}" text-anchor="middle" class="sl" fill="#bbb">PAM8403</text>`; }
  if (sec.shape === 'ring') {
    const cx = 150; const cy = h / 2 + 30; x1 = 248; silk = '#F3F2EE';   // จุดบัดกรีอยู่ใกล้ขอบนอก ป้ายอยู่บนแถบดำ
    s = `<svg viewBox="0 0 ${w} ${h + 70}" role="img" aria-label="${esc(sec.title)}"><circle cx="${cx}" cy="${cy}" r="${(110 + 62) / 2}" fill="none" stroke="#2B2B2B" stroke-width="48"/><text x="${cx}" y="${cy + 100}" text-anchor="middle" class="sl" fill="#F3F2EE">CJMCU-2812B-12</text>`;
    const pr = sec.R.length; const y0 = cy - ((pr - 1) * 22) / 2;
    pads.forEach((p, i) => {
      const y = y0 + i * 22; const u = used(p);
      s += `<rect x="${x1 - 9}" y="${y - 7}" width="18" height="14" rx="2" fill="${u ? '#D9B45A' : '#9C9A92'}" stroke="${u ? '#8A6D1F' : '#6b6a64'}"/>`;
      s += `<text x="${x1 - 16}" y="${y + 4.5}" text-anchor="end" class="pl ring${u ? '' : ' off'}">${esc(p.label)}</text>`;
      if (u) s += `<line x1="${x1 + 9}" y1="${y}" x2="${x1 + 70}" y2="${y}" stroke="${col(p)}" stroke-width="2"/>` + badge(x1 + 82, y, num.get(p), col(p));
    });
    return s + '</svg>';
  }
  let li = 0; let ri = 0;
  for (const p of pads) {
    const left = p.side === 'L'; const y = yOf(left ? li++ : ri++); const x = left ? x0 : x1; const u = used(p);
    s += `<path d="M${x} ${y - 7} a7 7 0 0 ${left ? 1 : 0} 0 14" fill="${u ? '#D9B45A' : '#D6D4CC'}" stroke="${u ? '#8A6D1F' : '#9C9A92'}" stroke-width="1.5"/>`;
    s += `<text x="${x + (left ? 12 : -12)}" y="${y + 4.5}" text-anchor="${left ? 'start' : 'end'}" class="pl${u ? '' : ' off'}" fill="${silk}">${esc(p.label)}</text>`;
    if (u) { const bx = x + (left ? -60 : 60); s += `<line x1="${x}" y1="${y}" x2="${bx}" y2="${y}" stroke="${col(p)}" stroke-width="2"/>` + badge(bx, y, num.get(p), col(p)); }
  }
  return s + '</svg>';
}

// ---- ตาราง
function tableOf(sec, pads) {
  const rows = pads.filter((p) => p.e).map((p, i) => {
    const e = p.e; const ant = p.key === 'ANT'; const [cname, chex] = ant ? ['ไม่ใช้สาย', '#8A6D1F'] : COLOR[e.net.type];
    const tip = sec.tips?.[p.key] ?? '';
    const hole = e.otherHole && !ant ? `<span class="hole mono">${esc(holeText(e.otherHole))}</span>` : '';
    return `<tr><td class="n"><span class="bdg" style="background:${chex}">${i + 1}</span></td>
      <td><b class="mono">${esc(p.label)}</b></td>
      <td><span class="sw" style="background:${chex}"></span>${cname}</td>
      <td>${esc(destOf(e))}${hole}</td><td class="tip">${esc(tip)}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>#</th><th>จุด (ตัวหนังสือบนชิ้น)</th><th>สีสาย</th><th>ปลายอีกด้าน</th><th>หมายเหตุ</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---- ประกอบหน้า
const main = document.getElementById('parts');
let total = 0; const summary = [];
for (const sec of SECTIONS) {
  const pads = padList(sec); const n = pads.filter((p) => p.e).length;
  const copies = sec.parts.length > 1 ? 2 : 1; total += n * copies; summary.push([sec.title, n, copies]);
  const el = document.createElement('section'); el.className = 'part';
  el.innerHTML = `<header><h2>${esc(sec.title)}</h2><p class="qty">${esc(sec.qty)} · <b>${n} จุด</b>${copies > 1 ? ` ต่อตัว (รวม ${n * copies} จุด)` : ''}</p></header>
    <div class="body"><figure>${svgOf(sec, pads)}<figcaption>${esc(sec.view)}</figcaption></figure>
    <div class="info">${tableOf(sec, pads)}<ul class="warn">${sec.warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div></div>`;
  main.append(el);
}
// สายที่แค่ชุบตะกั่วปลาย (ไม่ได้บัดกรีกับชิ้น)
const tin = ALL.filter((e) => ['battery', 'probe'].includes(e.part));
const tinEl = document.createElement('section'); tinEl.className = 'part';
tinEl.innerHTML = `<header><h2>ชุบตะกั่วปลายสาย (ไม่ต้องบัดกรีกับชิ้น)</h2><p class="qty">${tin.length} ปลาย · ทำให้ปลายสายแข็ง เสียบ breadboard ได้</p></header>
  <div class="info wide"><table><thead><tr><th>สาย</th><th>ปลายอีกด้าน</th><th>ทำอย่างไร</th></tr></thead><tbody>
  ${tin.map((e) => `<tr><td><b>${esc(bbShort(`${e.part}.${e.pin}`))}</b></td><td>${esc(destOf(e))}<span class="hole mono">${esc(holeText(e.otherHole))}</span></td>
  <td>${e.part === 'battery' ? 'ปอกปลายประมาณ 5 มม. บิดเกลียวแล้วชุบตะกั่ว (หรือบัดกรีต่อหัวเข็ม)' : 'ปลายฝั่งบอร์ดชุบตะกั่ว · ปลายที่จุ่มน้ำปอกทองแดงเปลือยไว้ ไม่ต้องชุบ'}</td></tr>`).join('')}
  </tbody></table></div>`;
main.append(tinEl);
document.getElementById('sum').innerHTML = `<b>${total} จุด</b> จาก ${summary.length} ชนิด · ` + summary.map(([t, n, c]) => `${esc(t)} ${n}${c > 1 ? ` × ${c} ตัว` : ''}`).join(' · ')
  + ' · ไม่นับบอร์ด ESP32-C3 (ร้านบัดกรีขาเข็มมาแล้ว)';
