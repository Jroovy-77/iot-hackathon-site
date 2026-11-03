// ตัวเช็กแท็บ Breadboard: เทียบการต่อทางไฟฟ้าใน breadboard-nets.js กับตารางใน docs/wiring-breadboard.md
// และเลขขาใน PINS กับ firmware/common/pins.h · ไม่ใช้ three.js (รันใน Node ได้: node wiring/breadboard-check.js)
//
// วิธีเทียบ: สร้าง "จุดต่อ" (ขาที่ต่อถึงกันทางไฟฟ้า) 2 ชุด
//   ชุดผัง  = สายทุกเส้น + รูที่ขาชิ้นเสียบ (รู 5 รูในคอลัมน์เดียวกันต่อกัน · รางต่อกันทั้งแนว)
//   ชุดเอกสาร = อ่านจากแถวตาราง (ต่อตรง / อนุกรม / ลง GND / ดึงขึ้น 3V3 / คร่อม)
// แล้วเทียบทุกคู่ขา: ต่อกันในเอกสาร ⇔ ต่อกันในผัง · ค่า R/C ต้องตรง · ขั้ว D2 / C6 ต้องตรงตามที่เอกสารระบุ

export function stripOf(hole) {
  const r = /^(bb\.\w+|hb\.\w+)@\d+$/.exec(hole); if (r) return r[1];
  const m = /^([mh])(\d+)([a-j])$/.exec(hole); if (!m) return null;
  return `${m[1]}:${m[2]}:${m[3] <= 'e' ? 'top' : 'bot'}`;
}

function uf() {
  const p = new Map();
  const find = (a) => { if (!p.has(a)) p.set(a, a); let r = a; while (p.get(r) !== r) r = p.get(r); let x = a; while (p.get(x) !== r) { const n = p.get(x); p.set(x, r); x = n; } return r; };
  return { find, union: (a, b) => p.set(find(a), find(b)), keys: () => [...p.keys()] };
}

// ---- ชุดผัง
export function modelOf(board) {
  const u = uf(); const pins = new Set(['VSYS', 'GND', '3V3']); const holes = new Map(); const problems = [];
  const use = (hole, who) => { if (holes.has(hole)) problems.push(`รูซ้ำ ${hole}: ${holes.get(hole)} กับ ${who}`); else holes.set(hole, who); if (!stripOf(hole)) problems.push(`ชื่อรูผิด ${hole} (${who})`); };
  const { mcu } = board;
  for (const [rowName, map] of [[mcu.topRow, mcu.top], [mcu.bottomRow, mcu.bottom]])
    for (const [c, name] of Object.entries(map)) { const pin = `${mcu.id}.${name}`; const h = `m${c}${rowName}`; pins.add(pin); use(h, pin); u.union(pin, stripOf(h)); }
  for (const p of board.parts) for (const [t, h] of Object.entries(p.pins)) { const pin = `${p.id}.${t}`; pins.add(pin); use(h, pin); u.union(pin, stripOf(h)); }
  for (const n of board.nets) {
    for (const [k, end] of [[0, n.from], [1, n.to]]) {
      if (!/^(bb|hb)\./.test(end)) pins.add(end);
      const h = n.at[k];
      if (h) { use(h, `สาย ${n.id}`); u.union(end, stripOf(h)); }
    }
    u.union(n.from, n.to);
  }
  for (const [ps, rail] of Object.entries(board.rails)) u.union(ps, rail);
  return { find: u.find, pins, problems };
}

// ---- อ่านเอกสาร
const clean = (s) => s.replace(/\*\*/g, '').replace(/\([^)]*\)/g, '').replace(/−/g, '-').trim();
function rowsOf(md, from, to) {
  const i = md.indexOf(from); if (i < 0) return [];
  const j = md.indexOf(to, i + from.length); const t = md.slice(i, j < 0 ? undefined : j);
  return t.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((c) => c.length === 4 && c[0] !== 'ชิ้น');
}
const PART_ID = { house: { 'ESP32-C3': 'mcu', 'ถ่าน AA ×3': 'battery', SX1276: 'sx', 'ปุ่มแดง': 'btn-sos', 'สายวัดน้ำ': 'probe', 'ปุ่มเขียว': 'btn-ack', 'แหวน WS2812': 'ring', PAM8403: 'amp', 'ลำโพง': 'speaker' },
  rx: { 'ESP32-C3': 'rx-mcu', SX1276: 'rx-sx' } };
const PIN_ID = { 'สายแดง': 'red', 'สายดำ': 'black', '−': '-' };

export function factsOf(md, which) {
  const rows = which === 'house' ? rowsOf(md, '## 1.', '## 2.') : rowsOf(md, '## 2.', '## 3.');
  const ids = PART_ID[which]; const mcu = ids['ESP32-C3']; const ant = which === 'house' ? 'ant' : 'rx-ant';
  const facts = []; const skipped = [];
  for (const [partTxt, pinTxt, toTxt, viaTxt] of rows) {
    const part = ids[clean(partTxt)];
    if (!part) { skipped.push(partTxt); continue; }
    const pins = clean(pinTxt).split('/').map((s) => s.trim()).map((s) => PIN_ID[s] ?? s);
    if (pins.some((p) => /USB/.test(p))) continue;   // สาย USB-C เข้าบอร์ด ไม่ใช่สายบน Breadboard
    let lastMod = null;
    const targets = toTxt.split('·')[0].split(' / ').map((raw) => {
      let s = raw.replace(/\*\*/g, '').trim(); const t = { series: [] };
      const d = /(D\d)\s*\(([^)]*)\)/.exec(s); if (d) t.series.push({ ref: d[1], toward: /แถบไปทาง\s*(\w+)/.exec(d[2])?.[1] });
      s = clean(s.split('→').pop()).replace(/^ราง\s*/, '');
      if (/^GPIO\d+$/.test(s)) t.node = `${mcu}.${s}`;
      else if (/^(VSYS|GND|3V3)$/.test(s)) t.node = s;
      else if (/เสา/.test(s)) t.node = `${ant}.feed`;
      else { const m = /^(PAM8403\s+)?(\S+)$/.exec(s); if (m && m[1]) lastMod = ids.PAM8403; t.node = m && lastMod ? `${lastMod}.${m[2]}` : null; }
      return t;
    });
    const via = viaTxt.split('·')[0].replace(/\*\*/g, '').trim();
    const refs = [...via.matchAll(/(?:\b([RCD]\d+)\s+)?(\d+(?:\.\d+)?\s*[kMµn]?[ΩF])/g)].map((m) => ({ ref: m[1] || null, value: m[2].replace(/\s+/g, ' ').replace(/(\d)([kMµn]?[ΩF])/, '$1 $2') }));
    const signal = targets.findIndex((t) => /GPIO/.test(t.node || '')); const sigI = signal >= 0 ? signal : 0;
    const rowLinks = pins.map((pin, k) => {
      const t = targets[k] || targets[targets.length - 1];
      return { kind: 'link', a: `${part}.${pin}`, b: t?.node, series: [...(t?.series || [])], row: partTxt };
    });
    facts.push(...rowLinks);
    const f = (k) => rowLinks[k];
    if (via === '—' || !via) continue;
    if (/ \/ /.test(via) && via.split(' / ').length === pins.length) {   // อนุกรมแยกตามขา
      via.split(' / ').forEach((v, k) => { const r = refs[k]; if (r) f(k).series.push(r); });
    } else if (/→/.test(via)) {   // ลำดับต่อกัน เช่น R9 → (C4 ลง GND) → C5 → INL
      const chain = []; let junction = null;
      for (const seg of via.split('→').map((s) => s.trim())) {
        const r = refs.find((x) => seg.includes(x.ref || x.value)); if (!r) continue;
        if (/ลง GND/.test(seg)) junction = { ...r, at: chain.length }; else chain.push(r);
      }
      const endsAtPin = pins.some((p) => via.trim().endsWith(p));
      const target = f(sigI); target.series.push(...(endsAtPin ? chain.slice().reverse() : chain));
      if (junction) target.junction = { ...junction, at: endsAtPin ? chain.length - junction.at : junction.at };
    } else {
      const kwOf = (s) => (/คร่อม/.test(s) ? 'across' : /ชิดขาไฟ/.test(s) ? 'near' : /อนุกรม/.test(s) ? 'series' : /ดึงขึ้น 3V3/.test(s) ? 'pull' : /ลง GND/.test(s) ? 'gnd' : null);   // คร่อมก่อน: "C6 คร่อม VSYS–GND (ขาลบลง GND)"
      for (const part of via.split(/,|\+/).map((s) => s.trim())) {
        const r = refs.find((x) => part.includes(x.ref || x.value)); if (!r) continue;
        const kw = kwOf(part) ?? kwOf(via);   // "C7 10 µF + C8 100 nF ชิดขาไฟ": คำท้ายใช้กับทุกตัว
        const named = /อนุกรมที่\s*(\S+)/.exec(part);
        if (kw === 'series') { const k = named ? pins.indexOf(named[1]) : sigI; f(k >= 0 ? k : sigI).series.push(r); }
        else if (kw === 'gnd') facts.push({ kind: 'shunt', at: f(sigI), to: 'GND', ...r });
        else if (kw === 'pull') facts.push({ kind: 'shunt', at: f(sigI), to: '3V3', ...r });
        else if (kw === 'across') { const m = /คร่อม\s*(\w+)[–-](\w+)/.exec(part); facts.push({ kind: 'across', a: m[1], b: m[2], neg: /ขาลบลง\s*(\w+)/.exec(viaTxt)?.[1], ...r }); }
        else if (kw === 'near') facts.push({ kind: 'across', a: targets[0].node, b: targets[1]?.node, ...r });
        else skipped.push(`${partTxt}: ${part}`);
      }
    }
  }
  if (which === 'rx') facts.push({ kind: 'link', a: `${mcu}.3V3`, b: '3V3', series: [] }, { kind: 'link', a: `${mcu}.GND`, b: 'GND', series: [] });   // ข้อ 2: "3V3 / GND" = ขาของบอร์ดตัวรับ
  return { facts, skipped, rows: rows.length };
}

const TERMS = { R: ['1', '2'], C: ['1', '2'], E: ['+', '-'], D: ['A', 'K'] };
function normVal(v) { return String(v ?? '').replace(/μ/g, 'µ').replace(/\s+/g, ' ').trim(); }

export function checkBoard(board, md, which) {
  const model = modelOf(board); const { facts, rows, skipped } = factsOf(md, which);
  const exp = uf(); const errors = [...model.problems, ...skipped.map((s) => `แถวในเอกสารที่อ่านไม่ออก: ${s}`)]; const used = new Set();
  const partBy = (r) => {
    let p = r.ref ? board.parts.find((x) => x.id === r.ref || x.id === `rx${r.ref}`) : null;
    if (!p) p = board.parts.find((x) => !used.has(x.id) && normVal(x.value) === normVal(r.value));
    if (!p) { errors.push(`ไม่พบชิ้น ${r.ref || ''} ${r.value} ในผัง`); return null; }
    used.add(p.id);
    if (r.value && normVal(p.value) !== normVal(r.value)) errors.push(`${p.id} ค่าไม่ตรง: เอกสาร ${r.value} · ผัง ${p.value}`);
    return p;
  };
  const termTo = (p, node) => { const [t1, t2] = TERMS[p.kind]; return model.find(`${p.id}.${t1}`) === model.find(node) ? [t1, t2] : [t2, t1]; };
  for (const f of facts) {
    if (f.kind !== 'link') continue;
    if (!f.b) { errors.push(`อ่านปลายทางไม่ออก: แถว ${f.row} ขา ${f.a}`); continue; }
    let cur = f.a; let k = 0;
    for (const s of f.series) {
      const p = partBy(s); if (!p) continue;
      let [tin, tout] = termTo(p, cur);
      if (s.toward) { tin = 'A'; tout = 'K'; if (model.find(`${p.id}.K`) !== model.find(s.toward)) errors.push(`${p.id} กลับขั้ว: แถบ (K) ต้องไปทาง ${s.toward}`); }
      exp.union(cur, `${p.id}.${tin}`); cur = `${p.id}.${tout}`; k++;
      if (f.junction && f.junction.at === k) {
        const j = partBy(f.junction); if (j) { const [a, b] = termTo(j, cur); exp.union(cur, `${j.id}.${a}`); exp.union(`${j.id}.${b}`, 'GND'); }
      }
    }
    exp.union(cur, f.b); f.end = cur;
  }
  for (const f of facts) {
    if (f.kind === 'shunt') {
      const p = partBy(f); if (!p) continue;
      const ends = [f.at.a, f.at.end ?? f.at.b];
      const node = ends.find((e) => [0, 1].some((i) => model.find(`${p.id}.${TERMS[p.kind][i]}`) === model.find(e))) ?? ends[0];
      const [a, b] = termTo(p, node); exp.union(node, `${p.id}.${a}`); exp.union(`${p.id}.${b}`, f.to);
    } else if (f.kind === 'across') {
      const p = partBy(f); if (!p) continue;
      let [a, b] = termTo(p, f.a);
      if (f.neg && p.kind === 'E') { b = '-'; a = '+'; if (model.find(`${p.id}.-`) !== model.find(f.neg)) errors.push(`${p.id} กลับขั้ว: ขาลบต้องลง ${f.neg}`); }
      exp.union(`${p.id}.${a}`, f.a); exp.union(`${p.id}.${b}`, f.b);
    }
  }
  for (const p of board.parts) if (!used.has(p.id)) errors.push(`${p.id} อยู่ในผังแต่ไม่มีในเอกสาร`);
  // เทียบทุกคู่ขา
  const all = [...new Set([...model.pins, ...exp.keys().filter((k) => !/^(bb|hb)\./.test(k))])];
  let pairs = 0; let bad = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    pairs++;
    const m = model.find(all[i]) === model.find(all[j]); const e = exp.find(all[i]) === exp.find(all[j]);
    if (m !== e && bad++ < 12) errors.push(m ? `ผังต่อ ${all[i]} กับ ${all[j]} แต่เอกสารไม่ได้ต่อ` : `เอกสารต่อ ${all[i]} กับ ${all[j]} แต่ผังไม่ได้ต่อ`);
  }
  if (bad > 12) errors.push(`… และอีก ${bad - 12} คู่`);
  // ขั้นตอน: ทุกสาย/ทุกชิ้นอยู่ในขั้นตอนครั้งเดียว
  const wireSteps = board.seq.filter((s) => s.kind === 'wire').map((s) => s.net); const partSteps = board.seq.filter((s) => s.kind === 'part').map((s) => s.part);
  for (const n of board.nets) { const c = wireSteps.filter((x) => x === n.id).length; if (c !== 1) errors.push(`สาย ${n.id} อยู่ในขั้นตอน ${c} ครั้ง`); }
  for (const p of [...board.parts.map((x) => x.id), board.mcu.id]) { const c = partSteps.filter((x) => x === p).length; if (c !== 1) errors.push(`ชิ้น ${p} อยู่ในขั้นตอน ${c} ครั้ง`); }
  for (const s of wireSteps) if (!board.nets.some((n) => n.id === s)) errors.push(`ขั้นตอนอ้างสาย ${s} ที่ไม่มี`);
  return { ok: errors.length === 0, errors, rows, facts: facts.length, pairs, wires: board.nets.length, parts: board.parts.length };
}

export function checkPins(PINS, pinsH) {
  const got = Object.fromEntries([...pinsH.matchAll(/const int\s+(\w+)\s*=\s*(\d+)\s*;/g)].map((m) => [m[1], +m[2]]));
  const diffs = Object.entries(PINS).filter(([k, v]) => got[k] !== v).map(([k, v]) => `${k}: เว็บ ${v} · pins.h ${got[k] ?? 'ไม่มี'}`);
  const verified = /#define\s+PINS_VERIFIED\s+1/.test(pinsH);
  return { ok: diffs.length === 0, diffs, verified };
}

// ---- รันใน Node: node wiring/breadboard-check.js
if (typeof process !== 'undefined' && process.argv?.[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const fs = await import('node:fs'); const path = await import('node:path'); const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const md = fs.readFileSync(path.join(root, 'docs/wiring-breadboard.md'), 'utf8');
  const pinsH = fs.readFileSync(path.join(root, 'firmware/common/pins.h'), 'utf8');
  const { BB_HOUSE, BB_RX, PINS } = await import('./breadboard-nets.js');
  const h = checkBoard(BB_HOUSE, md, 'house'); const r = checkBoard(BB_RX, md, 'rx'); const p = checkPins(PINS, pinsH);
  console.log(`กล่องบ้าน: ${h.ok ? 'ตรง' : 'ไม่ตรง'} · สาย ${h.wires} · ชิ้น ${h.parts} · แถวเอกสาร ${h.rows} · คู่ขาที่เทียบ ${h.pairs}`); h.errors.forEach((e) => console.log('  ✗', e));
  console.log(`ตัวรับ: ${r.ok ? 'ตรง' : 'ไม่ตรง'} · สาย ${r.wires} · ชิ้น ${r.parts} · แถวเอกสาร ${r.rows} · คู่ขาที่เทียบ ${r.pairs}`); r.errors.forEach((e) => console.log('  ✗', e));
  console.log(`pins.h: ${p.ok ? 'ตรง' : 'ไม่ตรง'} · PINS_VERIFIED=${p.verified ? 1 : 0}`); p.diffs.forEach((e) => console.log('  ✗', e));
  process.exit(h.ok && r.ok && p.ok ? 0 : 1);
}
