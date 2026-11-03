/* ปุ่มเรียกเรือ - แดชบอร์ด (ไม่โหลดอะไรจากเน็ต)
   รูปข้อมูลเดียวกันทั้งโหมดจำลองและโหมดสด: ดู docs/data-contract.md หัวข้อ 5
   Sim.snapshot() กับ Live.snap ผ่าน render() ชุดเดียวกัน */
(function () {
'use strict';

const H = 3600;
const CFG = { silent_h: 6, auto_h: 2, probe_cm: 50, repeat_min: 10, hold_s: 2, offline_h: 13, low_batt_v: 3.9, link_hb_s: 2, speedup: 3600 };
const WHEN_TH = { today: 'วันนี้', tonight: 'คืนนี้', tomorrow: 'พรุ่งนี้' };
const C = { warn: '#E0701A', ok: '#2F8A3E', sos: '#D23B30', acc: '#E8B400', silent: '#888780', ink: '#1F1F1D', line: '#9C9A92' };

/* คำพูดของกล่อง (docs/data-contract.md หัวข้อ 3) */
const V = {
  warnA: 'เตือนภัยน้ำท่วม น้ำจะเข้าบ้านภายใน',
  warnB: 'ยกของขึ้นที่สูง พาคนป่วยขึ้นชั้นบน ได้ยินแล้วกดปุ่มเขียว',
  heard: 'ขอบคุณ ทีมรู้แล้วว่าบ้านนี้ได้ยิน',
  sos: 'ส่งขอความช่วยเหลือแล้ว รอสักครู่',
  accepted: 'ทีมรับเรื่องแล้ว เรือกำลังมา อยู่บนที่สูง อย่าลงน้ำ',
  done: 'ทีมช่วยเหลือบ้านนี้เรียบร้อยแล้ว',
  auto: 'น้ำเข้าบ้านแล้ว กล่องขอความช่วยเหลือให้แล้ว',
  batt: 'ถ่านใกล้หมด กรุณาเปลี่ยนถ่าน',
  safe: 'ยกเลิกคำขอแล้ว ทีมรู้ว่าบ้านนี้ปลอดภัย'
};

/* สถานะ: ชื่อไทย สีไฟบนกล่อง และโหมดไฟ */
const META = {
  idle:     { word: 'ปกติ',                   light: 'ดับ',                 c: null,     mode: 'off' },
  warn:     { word: 'ได้รับคำเตือน รอกดเขียว', light: 'ส้มกะพริบ',           c: C.warn,   mode: 'blink' },
  heard:    { word: 'ได้ยินแล้ว',              light: 'เขียว',               c: C.ok,     mode: 'solid' },
  silent:   { word: 'ยังเงียบ',                light: 'ส้มกะพริบอยู่',       c: C.warn,   mode: 'blink' },
  sos:      { word: 'ขอความช่วยเหลือ',         light: 'แดง',                 c: C.sos,    mode: 'solid' },
  accepted: { word: 'ทีมรับเรื่องแล้ว',        light: 'เหลือง',              c: C.acc,    mode: 'solid' },
  done:     { word: 'ช่วยเสร็จแล้ว',           light: 'เขียว',               c: C.ok,     mode: 'solid' },
  auto_sos: { word: 'กล่องขอแทน',              light: 'แดง',                 c: C.sos,    mode: 'solid' },
  safe:     { word: 'ปลอดภัย (บ้านแจ้ง)',      light: 'เขียว',               c: C.ok,     mode: 'solid' },
  offline:  { word: 'ขาดการติดต่อ',            light: 'ไม่ทราบ กล่องไม่ตอบ', c: null,     mode: 'off' }
};
const UNKNOWN = { word: 'ไม่ทราบ', light: '-', c: null, mode: 'off' };
const meta = s => META[s] || UNKNOWN;

/* ---------------------------------------------------------------- ตัวช่วย */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
function fmtDur(s) {
  s = Math.max(0, Math.round(s));
  if (s < 60) return 'ไม่ถึง 1 นาที';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' นาที';
  const h = Math.floor(m / 60), mm = Math.floor((m % 60) / 10) * 10;
  return mm ? h + ' ชม. ' + mm + ' นาที' : h + ' ชม.';
}
function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

/* ---------------------------------------------------------------- หมุด (รูปร่างต่างกันตามสถานะ) */
function pinShape(state) {
  switch (state) {
    case 'idle': return '<circle r="7" fill="#fff" stroke="#9C9A92" stroke-width="1.4"/>';
    case 'warn': return '<path d="M0 -12.5 L12 8.5 L-12 8.5 Z" fill="#E0701A" stroke="#7A3A08" stroke-width="1" stroke-linejoin="round"/><path d="M0 -4 V2.2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cy="5.4" r="1.3" fill="#fff"/>';
    case 'silent': return '<circle r="9" fill="#888780" stroke="#E0701A" stroke-width="3.6"/><circle cx="-3.8" r="1.4" fill="#fff"/><circle r="1.4" fill="#fff"/><circle cx="3.8" r="1.4" fill="#fff"/>';
    case 'offline': return '<circle r="9" fill="#fff" stroke="#888780" stroke-width="2" stroke-dasharray="3.2 2.6"/><path d="M-4.5 -4.5 L4.5 4.5 M4.5 -4.5 L-4.5 4.5" stroke="#5F5E5A" stroke-width="2" stroke-linecap="round"/>';
    case 'heard': case 'done': case 'safe': return '<circle r="10" fill="#2F8A3E"/><path d="M-5 0.5 L-1.6 4 L5.4 -3.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    case 'sos': return '<circle class="pulse" r="12" fill="none" stroke="#D23B30" stroke-width="2"/><circle r="11" fill="#D23B30"/><path d="M0 -5.5 V1.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cy="5.4" r="1.4" fill="#fff"/>';
    case 'auto_sos': return '<circle class="pulse" r="12" fill="none" stroke="#D23B30" stroke-width="2"/><circle r="16.5" fill="none" stroke="#D23B30" stroke-width="1.6" stroke-dasharray="3 3"/><circle r="11" fill="#D23B30"/><path d="M0 -5.5 V1.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cy="5.4" r="1.4" fill="#fff"/>';
    case 'accepted': return '<path d="M0 -13 L13 0 L0 13 L-13 0 Z" fill="#E8B400" stroke="#6B5300" stroke-width="1.1" stroke-linejoin="round"/><path d="M-4.8 0.4 L-1.6 3.6 L5 -3.4" fill="none" stroke="#1F1F1D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
    default: return '<circle r="9" fill="#DAD8D0" stroke="#888780" stroke-width="1.4"/><text y="4" text-anchor="middle" font-size="12" font-weight="700" fill="#1F1F1D">?</text>';
  }
}
const miniPin = s => '<svg viewBox="-17 -17 34 34" aria-hidden="true">' + pinShape(s) + '</svg>';

/* ---------------------------------------------------------------- ข้อมูลชุมชนสมมติ */
/* x,y เป็นเมตร g = กี่ชั่วโมงหลังคำเตือนที่บ้านนี้กดเขียว (null = ไม่กด) */
const HOUSES = [
  { n: 1, x: 35, y: 28, bed: false, z: 'north', g: 1.2, bv: 4.61 },
  { n: 2, x: 105, y: 28, bed: false, z: 'north', g: 2.0, bv: 4.58 },
  { n: 3, x: 175, y: 28, bed: false, z: 'north', g: 0.8, bv: 4.62 },
  { n: 4, x: 245, y: 28, bed: false, z: 'north', g: 3.1, bv: 4.55 },
  { n: 5, x: 310, y: 28, bed: true, z: 'north', g: 1.7, bv: 4.5 },
  { n: 6, x: 60, y: 105, bed: false, z: 'north', g: 2.6, bv: 4.6 },
  { n: 7, x: 130, y: 105, bed: false, z: 'north', g: 4.0, bv: 4.47 },
  { n: 8, x: 200, y: 105, bed: false, z: 'north', g: null, bv: 4.52 },
  { n: 9, x: 270, y: 105, bed: false, z: 'north', g: 3.4, bv: 4.59 },
  { n: 10, x: 35, y: 150, bed: false, z: 'canal', g: 1.4, bv: 4.63 },
  { n: 11, x: 100, y: 150, bed: false, z: 'canal', g: 2.3, bv: 4.56 },
  { n: 12, x: 165, y: 150, bed: true, z: 'canal', g: null, bv: 4.4 },
  { n: 13, x: 230, y: 150, bed: false, z: 'canal', g: 4.6, bv: 4.53 },
  { n: 14, x: 295, y: 150, bed: false, z: 'canal', g: 2.9, bv: 4.57 }
].map(h => Object.assign(h, { id: 1000 + h.n, name: 'บ้าน ' + h.n }));

/* ---------------------------------------------------------------- จำลอง: สร้างข้อมูลรูปเดียวกับตัวรับ */
class Sim {
  constructor() { this.reset(); }
  reset() {
    this.now = 0; this.rev = 1; this.q = []; this.seq = 0; this.warn = null; this.wid = 0; this.reqNo = 0;
    this.events = []; this.notify = null;
    this.houses = HOUSES.map(h => ({
      id: h.id, name: h.name, x: h.x, y: h.y, bed: h.bed, z: h.z, g: h.g, bv: h.bv, n: h.n,
      state: 'idle', t_state: 0, got_warn: false, wid: 0, last_seen: -H * (1 + h.n % 5),
      low_batt: false, batt_v: h.bv, probe_wet: false, t_wet: null, try: 1, req: null, last_press: -1, off: false, prev: null
    }));
  }
  at(t, fn) { this.q.push({ t, s: this.seq++, fn }); this.q.sort((a, b) => a.t - b.t || a.s - b.s); }
  advance(to) {
    while (this.q.length && this.q[0].t <= to) { const e = this.q.shift(); this.now = Math.max(this.now, e.t); e.fn(); }
    this.now = Math.max(this.now, to);
  }
  get(id) { return this.houses.find(h => h.id === id); }
  ev(id, ev) { this.events.unshift({ t: this.now, id, ev }); if (this.events.length > 50) this.events.pop(); this.rev++; }
  set(h, s, cause) {
    if (h.state !== s) { h.state = s; h.t_state = this.now; }
    this.rev++;
    if (this.notify) this.notify(h, s, cause);
  }
  sendWarn(when, lvl, area) {
    if (!WHEN_TH[when]) return { ok: false, err: 'bad_when' };
    const wid = ++this.wid;
    this.warn = { wid, when, lvl_cm: lvl == null ? null : lvl, t: this.now, tx: 1, active: true };
    this.ev(0, 'warn_sent');
    this.houses.forEach(h => {
      if (area && area !== 'all' && h.z !== area) return;
      if (h.req) return;
      this.set(h, 'warn', 'warn'); h.got_warn = true; h.wid = wid;
      if (h.g != null) this.at(this.now + h.g * H, () => this.pressGreen(h.id));
      this.at(this.now + CFG.silent_h * H, () => { if (h.wid === wid && h.state === 'warn') { this.set(h, 'silent', 'silent'); this.ev(h.id, 'silent'); } });
    });
    return { ok: true, rev: this.rev };
  }
  warnStop() { if (!this.warn) return { ok: false, err: 'no_warn' }; this.warn.active = false; this.rev++; return { ok: true, rev: this.rev }; }
  clearOff(h) { if (h.off) { h.off = false; if (h.state === 'offline') this.set(h, h.prev || 'idle', 'online'); } }
  goOffline(id) {
    const h = this.get(id); if (!h || h.off) return { ok: false };
    h.off = true;
    if (!h.req) { h.prev = h.state; this.set(h, 'offline', 'offline'); }
    this.ev(id, 'offline'); return { ok: true, rev: this.rev };
  }
  pressSafe(id) {
    const h = this.get(id); if (!h) return { ok: false };
    if (h.state === 'warn' || h.state === 'silent') return this.pressGreen(id);
    h.last_press = this.now; h.last_seen = this.now; this.clearOff(h);
    if (h.req && h.bed) { if (h.req.cancel_t == null) { h.req.cancel_t = this.now; this.ev(id, 'cancel'); } }   /* ติดเตียง: ไม่ปิด รอทีมโทร */
    else { h.req = null; this.set(h, 'safe', 'safe'); this.ev(id, 'safe'); }
    return { ok: true, rev: this.rev };
  }
  cancelOk(id) {
    const h = this.get(id); if (!h || !h.req) return { ok: false, err: 'no_open_request' };
    if (h.req.cancel_t == null) return { ok: false, err: 'not_cancelled' };
    h.req = null; this.set(h, 'safe', 'safe'); this.ev(id, 'cancel_ok');
    return { ok: true, rev: this.rev };
  }
  pressGreen(id) {
    const h = this.get(id); if (!h) return { ok: false };
    this.clearOff(h);
    h.last_press = this.now; h.last_seen = this.now;
    if (h.state === 'warn' || h.state === 'silent') { this.set(h, 'heard', 'heard'); this.ev(id, 'heard'); }
    return { ok: true, rev: this.rev };
  }
  pressRed(id) {
    const h = this.get(id); if (!h) return { ok: false };
    h.last_press = this.now; h.last_seen = this.now; this.clearOff(h);
    if (h.req) { h.req.dup++; this.rev++; return { ok: true, rev: this.rev }; }   /* 1 บ้าน 1 คำขอ */
    this.open(h, 'sos'); return { ok: true, rev: this.rev };
  }
  open(h, kind) {
    h.req = { no: ++this.reqNo, kind, t_open: this.now, confirmed: kind === 'sos', t_accept: null, delivered: false, cancel_t: null, dup: 0 };
    this.set(h, kind, kind); this.ev(h.id, kind);
  }
  probeWet(id) {
    const h = this.get(id); if (!h || !h.bed) return { ok: false };
    h.probe_wet = true; h.t_wet = this.now; this.ev(id, 'probe_wet');
    const stamp = this.now;
    const check = () => {
      if (!h.probe_wet || h.t_wet !== stamp || h.req) return;
      if (h.last_press >= stamp) { this.at(h.last_press + CFG.auto_h * H, check); return; }
      this.open(h, 'auto_sos');
    };
    this.at(this.now + CFG.auto_h * H, check);
    return { ok: true, rev: this.rev };
  }
  lowBatt(id) { const h = this.get(id); if (!h) return { ok: false }; h.low_batt = true; h.batt_v = 3.84; this.ev(id, 'low_batt'); return { ok: true, rev: this.rev }; }
  confirm(id) {
    const h = this.get(id); if (!h || !h.req) return { ok: false, err: 'no_open_request' };
    if (h.req.kind !== 'auto_sos') return { ok: false, err: 'not_auto' };
    h.req.confirmed = true; this.ev(id, 'confirm'); return { ok: true, rev: this.rev };
  }
  accept(id) {
    const h = this.get(id); if (!h || !h.req) return { ok: false, err: 'no_open_request' };
    if (h.state === 'accepted') return { ok: true, rev: this.rev };
    if (h.req.kind === 'auto_sos' && !h.req.confirmed) return { ok: false, err: 'need_confirm' };
    h.req.t_accept = this.now; h.req.delivered = true; h.req.cancel_t = null;
    this.set(h, 'accepted', 'accepted'); this.ev(id, 'accept'); this.ev(id, 'delivered');
    return { ok: true, rev: this.rev };
  }
  done(id) {
    const h = this.get(id); if (!h || !h.req) return { ok: false, err: 'no_open_request' };
    h.req = null; this.set(h, 'done', 'done'); this.ev(id, 'done');
    this.at(this.now + 24 * H, () => { if (h.state === 'done') this.set(h, 'idle', 'idle'); });
    return { ok: true, rev: this.rev };
  }
  command(name, b) {
    switch (name) {
      case 'warn': return this.sendWarn(b.when, b.lvl_cm, b.area);
      case 'warn_stop': return this.warnStop();
      case 'confirm': return this.confirm(b.id);
      case 'accept': return this.accept(b.id);
      case 'done': return this.done(b.id);
      case 'cancel_ok': return this.cancelOk(b.id);
    }
    return { ok: false, err: 'unknown' };
  }
  snapshot() {
    const now = this.now;
    const w = this.warn ? Object.assign({}, this.warn) : null;
    if (w) { const e = now - w.t; w.tx = e < 60 ? 1 + Math.floor(e / 30) : 3 + Math.floor((e - 60) / 900); }
    return {
      v: 2, rev: this.rev, now, gw: { name: 'ตัวรับ (ข้อมูลสมมติ)', sim: true, link: 'usb', air_pct: 0.4 },
      cfg: Object.assign({}, CFG, w && w.active ? { offline_h: 3 } : {}), warn: w,   // มีคำเตือนค้าง = 3 ชม. เหมือนตัวรับ
      houses: this.houses.map(h => {
        /* กล่องรายงานทุก 6 ชม. (รอบรายงานตาม contract) */
        const rep = now - (((now - h.n * 900) % (6 * H)) + 6 * H) % (6 * H);
        return {
          id: h.id, name: h.name, x: h.x, y: h.y, bed: h.bed, state: h.state, t_state: h.t_state, got_warn: h.got_warn,
          last_seen: h.off ? h.last_seen : Math.max(h.last_seen, rep), offline: !!h.off, rssi: -(96 + (h.n * 7) % 24), snr: ((h.n * 5) % 14) - 5.5,
          batt_v: h.batt_v, low_batt: h.low_batt, probe_wet: h.probe_wet, t_wet: h.t_wet, try: h.try,
          req: h.req ? Object.assign({}, h.req) : null, zone: h.z
        };
      }),
      events: this.events.slice()
    };
  }
}

/* เดโม 60 วิ (วินาทีจริง = ชั่วโมงในเดโม) */
const SCRIPT = [
  [15, s => s.sendWarn('tomorrow', null, 'all')],
  [32, s => s.pressRed(1003)],
  [33.4, s => s.pressRed(1003)],
  [34.1, s => s.pressRed(1003)],
  [37, s => s.accept(1003)],
  [40.5, s => s.pressRed(1010)],
  [46, s => s.probeWet(1012)]
];
const CAPTIONS = [
  [0, 'ช่วง 0-15 วินาที: ข้อความเตือนภัยเข้ามือถือ แต่มือถือเครื่องนี้ยายสมศรี (เรื่องสมมติ) ไม่ได้ใช้'],
  [15, 'ช่วง 15-30 วินาที: กล่องที่บ้านเตือน บ้านส่วนใหญ่กดเขียว เหลือบ้านที่ยังเงียบให้ อสม. ไปเคาะประตู'],
  [30, 'ช่วง 30-45 วินาที: กดแดง ไฟเปลี่ยนเป็นเหลืองพร้อมเสียง และคำขอมีรายการเดียวต่อบ้าน'],
  [45, 'ช่วง 45-60 วินาที: บ้านติดเตียงที่น้ำถึงสายวัดและไม่มีใครกด 2 ชม. กล่องขอเองและขึ้นเป็นลำดับแรก']
];

/* ---------------------------------------------------------------- โหมดสด (USB + Web Serial ตาม contract หัวข้อ 5-6 ไม่ใช้เน็ต ไม่ถามซ้ำ) */
const Live = {
  status: 'idle',   /* idle | nosupport | noport | opening | busy | ok | lost */
  snap: null, recvAt: 0, frozen: 0, lostSince: null, lastRx: 0, lastHello: 0, firstHello: 0,
  port: null, reader: null, writer: null, gen: 0, rid: 0, pending: new Map(), wd: null,
  get ok() { return this.status === 'ok' && !!this.snap; },
  supported() { return 'serial' in navigator; },
  async start() {
    await this.stop();
    const gen = this.gen;
    if (!this.supported()) { this.status = 'nosupport'; app.dirty = true; return; }
    this.status = 'noport'; app.dirty = true;
    this.wd = setInterval(() => this.watch(), 1000);
    await this.autoOpen(gen);
  },
  async autoOpen(gen) {
    if (this.status === 'opening' || (this.status === 'ok' && !this.lostSince)) return;
    try {
      const ps = await navigator.serial.getPorts();
      if (ps.length && (gen == null || gen === this.gen)) await this.open(ps[0]);
    } catch (e) { /* ไม่มีพอร์ตที่เคยอนุญาต ให้ผู้ใช้กดเลือกเอง */ }
  },
  async connect() {   /* ต้องมาจากการกดปุ่มของผู้ใช้ */
    if (!this.supported()) return;
    try { await this.open(await navigator.serial.requestPort()); }
    catch (e) { /* ผู้ใช้ปิดหน้าต่างเลือกพอร์ต */ }
  },
  async open(port) {
    const gen = ++this.gen;
    this.status = 'opening'; app.dirty = true;
    try { await port.open({ baudRate: 115200 }); }
    catch (e) { if (gen === this.gen) { this.status = 'busy'; app.dirty = true; } return; }
    if (gen !== this.gen) { try { await port.close(); } catch (e) { /* ปิดไม่ได้ก็ข้าม */ } return; }
    this.port = port; this.writer = port.writable.getWriter(); this.lastRx = performance.now();
    this.status = 'ok'; this.firstHello = 0; app.dirty = true;
    this.hello(true);
    this.readLoop(port, gen);
  },
  async readLoop(port, gen) {
    const dec = new TextDecoder(); let buf = '';
    try {
      const reader = port.readable.getReader(); this.reader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) this.onLine(line); }
          if (buf.length > 65536) buf = '';
        }
      } finally { reader.releaseLock(); }
    } catch (e) { /* สายหลุดหรืออ่านไม่ได้ */ }
    if (gen === this.gen) this.lose();
  },
  onLine(line) {
    if (line.charAt(0) !== '{') return;   /* ข้อความบูตของบอร์ด ทิ้งเงียบ ๆ */
    let j; try { j = JSON.parse(line); } catch (e) { return; }
    if (!j || typeof j !== 'object') return;
    this.lastRx = performance.now();
    if (this.lostSince) { this.lostSince = null; this.status = 'ok'; }
    if (j.t === 'snap') { this.snap = normalize(j); this.recvAt = performance.now(); }
    else if (j.t === 'hb') { if (!this.snap || j.rev !== this.snap.rev) this.hello(false); }
    else if (j.t === 'res') {
      const p = this.pending.get(j.rid);
      if (p) { clearTimeout(p.t); this.pending.delete(j.rid); p.res(j.ok ? { ok: true } : { ok: false, err: j.err || 'fail' }); }
    }
    app.dirty = true;
  },
  watch() {   /* ไม่ได้ hb 3 รอบติด = ขาด */
    if (this.status !== 'ok' || this.lostSince) return;
    const lim = 3 * num(this.snap && this.snap.cfg && this.snap.cfg.link_hb_s, 2) * 1000;
    if (performance.now() - this.lastRx > lim) {
      this.lostSince = new Date(Date.now() - (performance.now() - this.lastRx)); this.frozen = performance.now(); app.dirty = true;
    }
    if (!this.snap && performance.now() - this.lastHello > 2000) this.hello(false);
  },
  lose() {
    if (this.status === 'idle') return;
    this.status = 'lost'; if (!this.lostSince) { this.lostSince = new Date(); this.frozen = performance.now(); }
    this.pending.forEach(p => { clearTimeout(p.t); p.res({ ok: false, err: 'net' }); }); this.pending.clear();
    this.release(); app.dirty = true;
  },
  async release() {
    const p = this.port, w = this.writer, r = this.reader; this.port = this.writer = this.reader = null;
    try { if (r) await r.cancel(); } catch (e) { /* ข้าม */ }
    try { if (w) w.releaseLock(); } catch (e) { /* ข้าม */ }
    await new Promise(res => setTimeout(res, 60));
    try { if (p) await p.close(); } catch (e) { /* ข้าม */ }
  },
  async stop() {
    this.gen++; clearInterval(this.wd); this.wd = null;
    this.pending.forEach(p => { clearTimeout(p.t); p.res({ ok: false, err: 'net' }); }); this.pending.clear();
    await this.release();
    this.status = 'idle'; this.snap = null; this.lostSince = null;
  },
  async write(obj) {
    if (!this.writer) return false;
    try { await this.writer.write(new TextEncoder().encode(JSON.stringify(obj) + '\n')); return true; } catch (e) { return false; }
  },
  hello(force) {
    const t = performance.now(); if (!force && t - this.lastHello < 2000) return;
    this.lastHello = t; this.write({ cmd: 'hello', rid: ++this.rid });
  },
  async post(name, body) {
    if (this.status !== 'ok' || this.lostSince || !this.writer) return { ok: false, err: 'net' };
    const rid = ++this.rid;
    const p = new Promise(res => { const t = setTimeout(() => { this.pending.delete(rid); res({ ok: false, err: 'timeout' }); }, 5000); this.pending.set(rid, { res, t }); });
    if (!(await this.write(Object.assign({ cmd: name, rid }, body)))) { const q = this.pending.get(rid); if (q) { clearTimeout(q.t); this.pending.delete(rid); } return { ok: false, err: 'net' }; }
    return p;
  },
  view() {
    if (!this.snap) return null;
    const t = this.lostSince ? this.frozen : performance.now();
    return Object.assign({}, this.snap, { now: this.snap.now + (t - this.recvAt) / 1000 });
  }
};
function normalize(j) {
  const s = Object.assign({ houses: [], events: [], gw: {}, warn: null }, j);
  s.cfg = Object.assign({}, CFG, { speedup: 1 }, j.cfg || {});
  s.gw = j.gw || {};
  s.houses = (Array.isArray(j.houses) ? j.houses : []).map(h => Object.assign({ state: 'unknown', req: null, bed: false, x: null, y: null }, h));
  return s;
}

/* ---------------------------------------------------------------- สถานะแอป */
const app = {
  mode: 'sim', view: 'map', present: false, dirty: true, sel: null, selManual: false,
  playing: false, script: false, sound: false, sim: new Sim(), lastTick: performance.now(), quiet: false,
  lastRev: -1, sig: {}, toastT: 0, m: 1, notice: '', noticeT: 0
};
const sim = app.sim;
const params = new URLSearchParams(location.search);

function current() { return app.mode === 'sim' ? sim.snapshot() : Live.view(); }

/* ---------------------------------------------------------------- เสียง */
let actx = null;
function chime() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.22); g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.22 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.4);
      o.start(t0 + i * 0.22); o.stop(t0 + i * 0.22 + 0.45);
    });
  } catch (e) { /* ไม่มีเสียงก็ใช้ต่อได้ */ }
}
function speak(t) {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'th-TH'; u.rate = 0.85; speechSynthesis.speak(u);
  } catch (e) { /* ไม่มีเสียงพูดก็ใช้ต่อได้ */ }
}
function say(h, snap) {
  const w = snap && snap.warn ? WHEN_TH[snap.warn.when] || '' : '';
  switch (h.state) {
    case 'warn': case 'silent': return V.warnA + ' ' + w + ' ' + V.warnB;
    case 'heard': return V.heard;
    case 'sos': return V.sos;
    case 'accepted': return V.accepted;
    case 'done': return V.done;
    case 'auto_sos': return V.auto;
    case 'safe': return V.safe;
    default: return '';
  }
}
sim.notify = (h, s) => {
  if (app.quiet || !app.sound || app.mode !== 'sim') return;
  if (s === 'accepted') chime();
  if (['sos', 'accepted', 'done', 'auto_sos', 'heard'].includes(s) && (s === 'accepted' || h.id === app.sel)) setTimeout(() => speak(say(h, sim.snapshot())), s === 'accepted' ? 500 : 0);
};

/* ---------------------------------------------------------------- เดโม */
function startScript(sec, play) {
  app.quiet = true;
  sim.reset(); sim.notify = notifyRef;
  SCRIPT.forEach(([t, fn]) => sim.at(t * H, () => fn(sim)));
  sim.advance(sec * H);
  app.quiet = false;
  app.script = true; app.playing = !!play; app.selManual = false; app.sel = null; app.dirty = true;
}
const notifyRef = sim.notify;
function demoSec() { return sim.now / H; }
function stepTick(dt) {
  if (app.mode !== 'sim' || !app.playing) return;
  let to = sim.now + dt * CFG.speedup;
  if (app.script && to >= 60 * H) { to = 60 * H; app.playing = false; app.dirty = true; }
  sim.advance(to);
}

/* ---------------------------------------------------------------- คำสั่ง */
async function cmd(name, body) {
  let r;
  if (app.mode === 'sim') {
    r = sim.command(name, body);
    if (r.ok && name === 'warn') { app.playing = true; app.script = false; }   /* ให้เวลาเดินต่อหลังส่งคำเตือน */
  } else {
    r = await Live.post(name, body);
  }
  app.dirty = true;
  const msg = r.ok ? '' : 'ส่งคำสั่งไม่สำเร็จ ลองใหม่' + (r.err === 'need_confirm' ? ' (ต้องให้ อสม. ยืนยันก่อน)' : '');
  toast(msg);
  return r;
}
function toast(msg) {
  $$('.toast, #cmdMsg').forEach(e => { e.textContent = msg; });
  clearTimeout(app.toastT);
  if (msg) app.toastT = setTimeout(() => toast(''), 4000);
}

/* ---------------------------------------------------------------- แผนที่ */
const NS = 'http://www.w3.org/2000/svg';
const SC = 2.4;   /* px ต่อเมตรในแผนที่ */
function buildMapBase() {
  const svg = $('#map');
  svg.innerHTML =
    '<defs><pattern id="g1" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#E6E4DC" stroke-width="1"/></pattern>' +
    '<pattern id="g2" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M120 0H0V120" fill="none" stroke="#DAD8D0" stroke-width="1"/></pattern>' +
    '<path id="canalp" d="M-10 468 C190 428 400 494 810 438"/></defs>' +
    '<rect width="800" height="480" fill="#fff"/><rect width="800" height="480" fill="url(#g1)"/><rect width="800" height="480" fill="url(#g2)"/>' +
    /* ถนน */
    '<rect x="0" y="162" width="800" height="16" fill="#E9E7E0" stroke="#BDBBB3"/><path d="M0 170H800" stroke="#fff" stroke-width="1.5" stroke-dasharray="10 8"/>' +
    '<rect x="0" y="304" width="800" height="9" fill="#EFEDE7" stroke="#CFCDC5"/>' +
    '<text x="12" y="158" font-size="12" fill="#5F5E5A">ถนนสายหลัก</text>' +
    /* คลอง */
    '<use href="#canalp" fill="none" stroke="#9C9A92" stroke-width="30"/><use href="#canalp" fill="none" stroke="#E4E2DA" stroke-width="27"/>' +
    '<text font-size="12" fill="#5F5E5A" letter-spacing="2"><textPath href="#canalp" startOffset="6%">คลอง</textPath></text>' +
    /* ตัวรับ */
    '<g transform="translate(748 236)"><rect x="-9" y="-9" width="18" height="18" fill="#fff" stroke="#1F1F1D" stroke-width="1.5"/><path d="M0 -9 V-20 M-6 -16 Q0 -23 6 -16" fill="none" stroke="#1F1F1D" stroke-width="1.5"/><text y="24" text-anchor="middle" font-size="12" fill="#1F1F1D" class="lbl">ตัวรับ</text></g>' +
    /* มาตราส่วน + ทิศ */
    '<g transform="translate(18 458)"><path d="M0 0H120M0 -4V4M120 -4V4" stroke="#1F1F1D" stroke-width="1.2"/><text x="60" y="-7" text-anchor="middle" font-size="12" fill="#1F1F1D" class="lbl">50 ม.</text></g>' +
    '<g transform="translate(772 30)"><path d="M0 -14 L6 6 L0 2 L-6 6Z" fill="#1F1F1D"/><text y="20" text-anchor="middle" font-size="12" class="lbl">เหนือ</text></g>' +
    '<g id="houses"></g>';
  const g = $('#houses', svg);
  g.innerHTML = '';
}
function mapScale() {
  const r = $('#map').getBoundingClientRect();
  const s = Math.min(r.width / 800, r.height / 480) || 1;
  return Math.max(1, Math.min(1.9, 0.95 / s)) ;
}
function renderMap(snap) {
  const g = $('#houses');
  const m = app.m;
  const present = new Set();
  (snap.houses || []).forEach(h => {
    if (h.x == null || h.y == null) return;
    present.add('h' + h.id);
    const sel = h.id === app.sel;
    const st = META[h.state] ? h.state : 'unknown';
    const auto = st === 'auto_sos' && h.req && !h.req.confirmed;
    const canc = !!(h.req && h.req.cancel_t != null), offl = st === 'offline' || h.offline === true;
    const sig = [st, h.bed, sel, h.low_batt, m.toFixed(2), auto, h.name, canc, offl].join('|');
    let el = g.querySelector('#h' + h.id);
    if (!el) {
      el = document.createElementNS(NS, 'g'); el.id = 'h' + h.id; el.setAttribute('class', 'house');
      el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); el.dataset.id = h.id;
      g.appendChild(el);
    }
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    const X = h.x * SC, Y = h.y * SC;
    el.setAttribute('transform', 'translate(' + X + ' ' + Y + ')');
    el.setAttribute('aria-label', h.name + (h.bed ? ' ติดเตียง ' : ' ') + meta(h.state).word);
    let lbl = '<text class="lbl b" y="27" text-anchor="middle">' + esc(h.name) + '</text>';
    let ly = 40;
    if (h.bed) { lbl += '<text class="lbl s b" y="' + ly + '" text-anchor="middle">ติดเตียง</text>'; ly += 12; }
    if (auto) lbl += '<text class="lbl s b" y="' + ly + '" text-anchor="middle" style="fill:#9A241B">ขอแทน รอยืนยัน</text>';
    if (canc) { lbl += '<text class="lbl s b" y="' + (ly + (auto ? 12 : 0)) + '" text-anchor="middle">ยกเลิกโดยบ้าน</text>'; }
    if (offl) { lbl += '<text class="lbl s b" y="' + (ly + (auto ? 12 : 0) + (canc ? 12 : 0)) + '" text-anchor="middle">ขาดการติดต่อ</text>'; }
    const batt = h.low_batt ? '<g transform="translate(12 -14)"><rect x="-6" y="-3.5" width="11" height="7" fill="#fff" stroke="#1F1F1D" stroke-width="1.2"/><rect x="5" y="-1.5" width="2" height="3" fill="#1F1F1D"/><rect x="-4.5" y="-2" width="3" height="4" fill="#D23B30"/></g>' : '';
    el.innerHTML =
      '<rect x="-20" y="-15" width="40" height="30" fill="#fff" stroke="#9C9A92" stroke-width="1"/>' +
      '<g transform="scale(' + m.toFixed(3) + ')">' +
      (sel ? '<circle class="sel-ring" r="' + (st === 'auto_sos' ? 21 : 18) + '"/>' : '') +
      '<circle class="hit" r="24"/>' + pinShape(st) + batt + lbl + '</g>';
  });
  $$('.house', g).forEach(e => { if (!present.has(e.id)) e.remove(); });
}

/* ---------------------------------------------------------------- กล่องของบ้านที่เลือก */
function ringSVG(c, mode) {
  let leds = '';
  for (let i = 0; i < 8; i++) {
    const a = (-90 + i * 45) * Math.PI / 180;
    leds += '<circle class="led" cx="' + (62 + 41 * Math.cos(a)).toFixed(1) + '" cy="' + (62 + 41 * Math.sin(a)).toFixed(1) + '" r="5.2"/>';
  }
  return '<svg viewBox="0 0 190 142" role="img" aria-label="ภาพกล่องที่บ้านและสีไฟ"><g class="ring" data-on="' + (c ? 1 : 0) + '" data-mode="' + mode + '" style="--c:' + (c || '#E8E6DF') + '">' + leds + '</g>' +
    '<circle cx="62" cy="62" r="24" fill="#D23B30" stroke="#8A241C" stroke-width="1.5"/><ellipse cx="55" cy="53" rx="9" ry="5" fill="#fff" opacity=".25"/>' +
    '<circle cx="152" cy="62" r="18" fill="#2F8A3E" stroke="#1D5C28" stroke-width="1.5"/><ellipse cx="146" cy="55" rx="7" ry="4" fill="#fff" opacity=".25"/>' +
    '<text x="62" y="124" text-anchor="middle" font-size="12" fill="#5F5E5A">ปุ่มแดง (กดค้างขอช่วย)</text>' +
    '<text x="152" y="124" text-anchor="middle" font-size="12" fill="#5F5E5A">ปุ่มเขียว</text></svg>';
}
function renderBox(snap, h) {
  const el = $('#boxpane');
  if (!h) { const s = 'none'; if (app.sig.box !== s) { app.sig.box = s; el.innerHTML = '<div></div><p class="empty-note">เลือกบ้านบนแผนที่เพื่อดูว่ากล่องที่บ้านนั้นกำลังทำอะไร</p>'; } return; }
  const mt = meta(h.state);
  const sig = [h.id, h.state, h.low_batt, snap.warn && snap.warn.when, h.bed, h.req && h.req.confirmed].join('|');
  if (app.sig.box !== sig) {
    app.sig.box = sig;
    const talk = say(h, snap);
    el.innerHTML = ringSVG(mt.c, mt.mode) +
      '<div><div class="bx-name"><h3>กล่องที่' + esc(h.name) + (h.bed ? ' <span class="tag">ติดเตียง</span>' : '') + '</h3>' +
      '<span class="bx-state">' + esc(mt.word) + '</span></div>' +
      '<div class="bx-light">ไฟรอบปุ่มแดง: ' + esc(mt.light) + '</div>' +
      (talk ? '<span class="say-h">กล่องพูดว่า</span><q class="say">' + esc(talk) + '</q>' : '<span class="say-h">กล่องเงียบ ไม่มีอะไรต้องทำ</span>') +
      (h.low_batt ? '<q class="say">' + V.batt + '</q>' : '') +
      '<div class="bx-meta"><span data-since="' + num(h.last_seen, '') + '" data-pre="ได้ยินกล่องล่าสุด " data-post=" ก่อน"></span> · ถ่าน ' + (h.batt_v ? Number(h.batt_v).toFixed(snap.gw && snap.gw.sim ? 1 : 2) + ' V' : '-') + '</div></div>';
  }
}

/* ---------------------------------------------------------------- คำนวณจากข้อมูลรอบนี้ */
function derive(snap) {
  const hs = snap.houses || [];
  /* silent = คนในบ้านไม่กด · off = กล่องขาดการติดต่อ (สองอย่างนี้ต่างกัน) · list = สองกลุ่มรวมกัน */
  const d = { total: hs.length, warn: 0, heard: 0, silent: [], silentBed: 0, off: [], list: [], queue: [], done: 0 };
  hs.forEach(h => {
    if (h.state === 'warn') d.warn++;
    if (['heard', 'sos', 'accepted', 'done', 'safe'].includes(h.state) && h.got_warn) d.heard++;
    if (h.state === 'done') d.done++;
    if (h.state === 'silent') d.silent.push(h);
    else if (!h.req && (h.state === 'offline' || h.offline === true)) d.off.push(h);
    if (h.req && ['sos', 'auto_sos', 'accepted'].includes(h.state)) d.queue.push(h);
  });
  d.list = d.silent.concat(d.off);
  d.silentBed = d.silent.filter(h => h.bed).length;
  const rank = h => h.state === 'auto_sos' ? 0 : h.state === 'sos' ? (h.bed ? 1 : 2) : 3;
  d.queue.sort((a, b) => rank(a) - rank(b) || num(a.req.t_open, 0) - num(b.req.t_open, 0));
  const kind = h => h.state === 'silent' ? 0 : 1;
  d.list.sort((a, b) => (b.bed - a.bed) || (kind(a) - kind(b)) || (num(a.last_seen, -1e12) - num(b.last_seen, -1e12)) || (a.t_state - b.t_state));
  d.silentFirst = !d.queue.length && (d.list.length > 0 || !!snap.warn);   /* คิวว่าง: รายการบ้านที่ต้องไปดูขึ้นบนสุด */
  return d;
}
function autoSel(snap, d) {
  if (d.queue.length) return d.queue[0].id;
  if (d.list.length) return d.list[0].id;
  const hs = snap.houses || [];
  const act = hs.filter(h => h.state !== 'idle').sort((a, b) => b.t_state - a.t_state)[0];
  if (act) return act.id;
  const bed = hs.find(h => h.bed);
  return bed ? bed.id : hs[0] && hs[0].id;
}

/* ---------------------------------------------------------------- รายการและหัวข้อ */
function renderSit(snap, d) {
  const w = snap.warn;
  let main, sub;
  if (!d.total) { main = 'ยังไม่มีข้อมูลจากตัวรับ'; sub = 'รอตัวรับตอบกลับ'; }
  else if (!w) { main = 'ยังไม่ได้ส่งคำเตือน'; sub = 'บ้านที่ลงทะเบียน ' + d.total + ' หลัง' + (d.off.length ? '' : ' ปกติทั้งหมด'); }
  else if (d.silent.length) {
    main = 'ยังเงียบ<span class="n">' + d.silent.length + '</span>บ้าน' + (d.silentBed ? ' <span class="bed">(ติดเตียง ' + d.silentBed + ')</span>' : '');
  } else if (d.warn) main = 'รอคนกดเขียว<span class="n">' + d.warn + '</span>บ้าน';
  else main = 'ทุกบ้านที่ได้รับคำเตือนตอบแล้ว';
  if (w && d.total) {
    sub = 'ส่งคำเตือน "น้ำเข้า' + (WHEN_TH[w.when] || '') + '" มา <span data-since="' + w.t + '" data-pre="" data-post=""></span> · ได้ยินแล้ว ' + d.heard + ' บ้าน' +
      (d.queue.length ? ' · ขอความช่วยเหลือ ' + d.queue.length + ' รายการ' : '');
  }
  if (d.total && d.off.length) sub = (sub || '') + ' · ขาดการติดต่อกับกล่อง ' + d.off.length + ' บ้าน';
  const design = w && d.silent.length ? '<p class="design">ค่าออกแบบ จะปรับหลังทดสอบ · เงียบ = ไม่กดเขียวภายใน ' + num(snap.cfg && snap.cfg.silent_h, 6) + ' ชม.</p>' : '';
  const html = '<h2 class="sit-main">' + main + '</h2><p class="sit-sub">' + (sub || '') + '</p>' + design;
  document.body.classList.toggle('silent-first', !!d.silentFirst);
  if (app.sig.sit !== html) { app.sig.sit = html; $('#sit').innerHTML = html; }
}
function noteFor(h, snap) {
  const n = [];
  const cfg = snap.cfg || CFG;
  if (h.last_seen == null) n.push('ยังไม่เคยได้ยินกล่องนี้');
  if (h.offline === true || h.state === 'offline') n.push('ขาดการติดต่อ (ไม่ได้ยินกล่องเกิน ' + num(cfg.offline_h, 13) + ' ชม.)');
  if (h.req && h.state === 'accepted' && h.req.delivered === false && snap.now - num(h.req.t_accept, snap.now) > 300) n.push('ไฟที่บ้านยังไม่เปลี่ยน กล่องยังไม่ได้รับ');
  return n.join(' · ');
}
function renderQueue(snap, d) {
  const dis = app.stale ? ' disabled' : '';
  const simMin = !!(snap.gw && snap.gw.sim);   /* เดโม: เวลาของคำขอนับเป็นนาที (ป้าย "จำลอง" บอกอยู่แล้ว) */
  const items = d.queue.map((h, i) => {
    const r = h.req;
    let sub, act;
    if (h.state === 'auto_sos') {
      sub = r.confirmed ? 'กล่องขอแทน อสม. ยืนยันแล้ว รอทีมรับเรื่อง' : 'กล่องขอแทน น้ำถึงสายวัดและไม่มีใครกด รอ อสม. ยืนยัน';
      act = r.confirmed ? ['accept', 'รับเรื่อง'] : ['confirm', 'อสม. ยืนยัน'];
    } else if (h.state === 'sos') { sub = 'คนในบ้านกดปุ่มแดงขอความช่วยเหลือ'; act = ['accept', 'รับเรื่อง']; }
    else { sub = 'ทีมรับเรื่องแล้ว เรือกำลังไป'; act = ['done', 'ช่วยเสร็จ']; }
    const cancelled = r.cancel_t != null;
    if (cancelled) sub += '<b class="cancel-line">ยกเลิกโดยบ้าน ควรโทรยืนยัน</b>';
    const extra = [];
    if (num(r.dup, 0) > 0) extra.push('กดซ้ำ ' + r.dup + ' ครั้ง รวมเป็นรายการเดียว');
    const nt = noteFor(h, snap); if (nt) extra.push(nt);
    return '<li class="req' + (h.id === app.sel ? ' is-sel' : '') + '" data-state="' + h.state + '"><span class="rk">' + (i + 1) + '</span>' +
      '<button class="item-main" data-select="' + h.id + '">' + miniPinInline(h.state) + '<strong>' + esc(h.name) + '</strong>' + (h.bed ? '<span class="tag">ติดเตียง</span>' : '') +
      '<span class="sub">' + sub + '</span></button>' +
      '<div class="act-row' + (cancelled ? ' two' : '') + '">' +
      (cancelled ? '<button class="btn" data-act="cancel_ok" data-id="' + h.id + '"' + dis + '>โทรแล้ว ปลอดภัย</button>' : '') +
      '<button class="btn primary" data-act="' + act[0] + '" data-id="' + h.id + '"' + dis + '>' + act[1] + '</button></div>' +
      '<div class="item-meta">เปิดมาแล้ว <span data-since="' + num(r.t_open, 0) + '"' + (simMin ? ' data-div="60"' : '') + ' data-pre="" data-post=""></span>' + (extra.length ? ' · ' + esc(extra.join(' · ')) : '') + '</div></li>';
  });
  const compact = d.silentFirst;   /* ว่างและมีบ้านต้องไปดู: ยุบเหลือบรรทัดเดียว */
  const body = items.length ? '<ul>' + items.join('') + '</ul>' : compact ? '' : '<p class="empty-note">ยังไม่มีคำขอความช่วยเหลือ เมื่อมีคนกดปุ่มแดง จะขึ้นที่นี่ บ้านละ 1 รายการ</p>';
  const html = '<h2>คำขอความช่วยเหลือ <span class="muted">' + (d.queue.length ? d.queue.length + ' รายการ' : compact ? 'ยังไม่มี' : '') + (d.done ? ' · ช่วยเสร็จแล้ว ' + d.done + ' บ้าน' : '') + '</span></h2>' + body + '<p class="toast" role="status"></p>';
  const sig = html + app.sel + dis;
  if (app.sig.queue !== sig) { app.sig.queue = sig; $('#queue').innerHTML = html; }
}
function miniPinInline(s) { return miniPin(s).replace('<svg ', '<svg class="ip" '); }
function renderSilent(snap, d) {
  const items = d.list.map(h => {
    const off = h.state !== 'silent';
    const nt = noteFor(h, snap);
    const line = off
      ? 'กล่องไม่ตอบ ' + (h.last_seen != null ? 'ได้ยินล่าสุด <span data-since="' + h.last_seen + '" data-pre="" data-post=" ก่อน"></span>' : '') + (nt ? (h.last_seen != null ? ' · ' : '') + esc(nt) : '')
      : 'คนในบ้านยังไม่กด เงียบมา <span data-since="' + (snap.warn ? snap.warn.t : h.t_state) + '" data-pre="" data-post=""></span> หลังส่งคำเตือน' + (nt ? ' · ' + esc(nt) : '');
    return '<li class="sil' + (off ? ' off' : '') + (h.id === app.sel ? ' is-sel' : '') + '"><button class="item-main" data-select="' + h.id + '" style="grid-column:1/-1;display:grid;grid-template-columns:30px 1fr;gap:2px 10px;align-items:center">' +
      miniPin(off ? 'offline' : 'silent') + '<span><strong>' + esc(h.name) + '</strong>' + (h.bed ? '<span class="tag warnish">ติดเตียง</span>' : '') +
      (off ? '<span class="tag off">กล่องขาดการติดต่อ</span>' : '') +
      '<span class="sub">' + line + '</span></span></button></li>';
  });
  const body = items.length ? '<ul>' + items.join('') + '</ul>' : '<p class="empty-note">' + (snap.warn ? 'ไม่มีบ้านที่ต้องไปดู' : 'ยังไม่ได้ส่งคำเตือน') + '</p>';
  const cnt = d.list.length ? '· ' + (d.silent.length ? 'เงียบ ' + d.silent.length : '') + (d.silent.length && d.off.length ? ' · ' : '') + (d.off.length ? 'ขาดการติดต่อ ' + d.off.length : '') + ' บ้าน' : '';
  const html = '<h2>บ้านที่ต้องไปดู <span class="muted">ติดเตียงอยู่บนสุด ' + cnt + '</span></h2>' + body;
  const sig = html + app.sel;
  if (app.sig.silent !== sig) { app.sig.silent = sig; $('#silent').innerHTML = html; }
}

/* ---------------------------------------------------------------- หน้าส่งคำเตือน */
function warnPreviewText() {
  const w = $('input[name=when]:checked').value;
  return V.warnA + ' ' + WHEN_TH[w] + ' ' + V.warnB;
}
function renderSender(snap, d) {
  const w = snap.warn;
  $('#warnPreview').textContent = warnPreviewText();
  $('#stopWarn').disabled = !(w && w.active) || app.stale;
  $('#sendWarn').disabled = app.stale || !d.total;
  const silentN = d.silent.length;
  let html;
  if (!w) html = '<h2>ผลการส่ง</h2><p class="empty-note">ยังไม่ได้ส่งคำเตือน เมื่อส่งแล้ว จะนับที่นี่ว่ากี่บ้านได้ยิน กี่บ้านยังเงียบ</p>';
  else {
    html = '<h2>ผลการส่ง</h2><p class="sr-meta">คำเตือน "น้ำเข้า' + (WHEN_TH[w.when] || '') + '"' + (w.lvl_cm != null ? ' · ระดับน้ำที่คาด ' + w.lvl_cm + ' ซม.' : '') +
      ' · ส่งมา <span data-since="' + w.t + '" data-pre="" data-post=""></span> · ส่งแล้ว ' + num(w.tx, 1) + ' รอบ' + (w.active ? ' (ยังส่งซ้ำอยู่)' : ' (หยุดส่งซ้ำแล้ว)') + '</p>' +
      '<div class="sr-count"><div>ได้ยินแล้ว<b>' + d.heard + '</b></div><div>ยังเงียบ<b>' + silentN + '</b></div><div class="w">รอกดอยู่ (ยังไม่ครบ ' + num(snap.cfg && snap.cfg.silent_h, 6) + ' ชม.)<b>' + d.warn + '</b></div></div>';
  }
  html += '<div class="cells">' + (snap.houses || []).map(h => '<button type="button" class="cell' + (h.id === app.sel ? ' is-sel' : '') + '" data-select="' + h.id + '" data-goto="map">' + miniPin(META[h.state] ? h.state : 'unknown') + '<span>' + esc(h.name) + '</span></button>').join('') + '</div>';
  if (app.sig.sr !== html) { app.sig.sr = html; $('#sendResult').innerHTML = html; }
}

/* ---------------------------------------------------------------- ส่วนหัว ป้ายโหมด แผงพรีเซนต์ */
function renderChrome(snap) {
  const pill = $('#modePill');
  let m, b, s;
  if (app.mode === 'sim') { m = 'sim'; b = 'จำลอง'; s = 'แตะเพื่อใช้ข้อมูลสด'; }
  else if (Live.lostSince) { m = 'lost'; b = 'การเชื่อมต่อหลุด'; s = 'แตะเพื่อกลับไปดูแบบจำลอง'; }
  else if (snap && snap.gw && snap.gw.sim) { m = 'sim'; b = 'จำลอง'; s = 'ตัวรับบอกว่าเป็นข้อมูลจำลอง'; }
  else if (Live.ok) { m = 'live'; b = 'เชื่อมต่อตัวรับอยู่'; s = 'แตะเพื่อกลับไปดูแบบจำลอง'; }
  else { m = 'lost'; b = Live.status === 'noport' ? 'ยังไม่ได้เชื่อมต่อตัวรับ' : Live.status === 'busy' ? 'เปิดพอร์ตไม่ได้' : 'กำลังเชื่อมต่อตัวรับ'; s = 'แตะเพื่อกลับไปดูแบบจำลอง'; }
  const key = m + b + s;
  if (pill.dataset.k !== key) { pill.dataset.k = key; pill.dataset.m = m; pill.innerHTML = '<b>' + b + '</b><small>' + s + '</small>'; }
  $('#speedNote').hidden = !(app.mode === 'sim');
  $('#area').disabled = app.mode === 'live'; $('#areaNote').hidden = app.mode !== 'live';

  const ban = $('#banner');
  const lost = app.mode === 'live' && Live.lostSince;
  ban.hidden = !lost;
  if (lost) ban.textContent = 'ขาดการเชื่อมต่อกับตัวรับ ตั้งแต่ ' + hhmm(Live.lostSince) + ' ข้อมูลที่เห็นเป็นข้อมูลเก่า ปุ่มคำสั่งใช้ไม่ได้ เสียบสาย USB กลับแล้วจะต่อเอง';
  const lb = $('#liveBar'), live = app.mode === 'live';
  const bar = app.notice ? app.notice : live && Live.status === 'noport' ? 'ต่อสาย USB จากตัวรับเข้าคอมพิวเตอร์ แล้วกดเลือกพอร์ต'
    : live && Live.status === 'busy' ? 'พอร์ตถูกโปรแกรมอื่นใช้อยู่ ปิดโปรแกรมนั้นแล้วลองใหม่'
    : live && Live.status === 'lost' ? 'เสียบสายกลับแล้วจะต่อเอง หรือกดเชื่อมต่อใหม่' : '';
  lb.hidden = !bar;
  if (bar) { $('#liveMsg').textContent = bar; $('#connectBtn').hidden = !!app.notice; }
  app.stale = !!lost;
  document.body.classList.toggle('stale', !!lost);

  const pr = $('#presenter');
  pr.hidden = !app.present;
  $('#presentBtn').setAttribute('aria-pressed', app.present ? 'true' : 'false');
  document.body.classList.toggle('present', app.present);
  if (app.present) {
    const sec = demoSec();
    $('#prTime').textContent = app.mode === 'sim' && app.script ? 'วินาทีที่ ' + Math.min(60, Math.floor(sec)) + ' / 60' + (app.playing ? '' : ' (หยุด)') : (app.mode === 'sim' ? (app.playing ? 'เวลาเดิน' : 'เวลาหยุด') : '');
    let cap = '';
    if (app.script) CAPTIONS.forEach(([t, c]) => { if (sec >= t) cap = c; });
    $('#prCap').textContent = cap;
    const simOnly = app.mode !== 'sim';
    $$('#presenter [data-try], #prPlay, #prPause, #presenter [data-jump]').forEach(b => { b.disabled = simOnly; });
    $('#prPause').textContent = app.playing ? 'หยุด' : 'เล่นต่อ';
    const h = (snap.houses || []).find(x => x.id === app.sel);
    $('#prSel').textContent = h ? 'ทดลองกับ' + h.name : 'เลือกบ้านก่อน';
    const noSel = !h || simOnly;
    $$('#presenter [data-try]').forEach(b => { b.disabled = noSel || (b.dataset.try === 'wet' && !h.bed); });
  }
  const sd = $('#speedNote'); if (!sd.hidden) sd.textContent = 'เดโมเร่งเวลา · 1 วิ = ' + Math.round(CFG.speedup / 3600) + ' ชม.';
  $('#cb').hidden = !(app.view === 'map' && app.mode === 'sim' && app.script && demoSec() < 15);

  const map = { 'dv-hold': 'hold_s', 'dv-silent': 'silent_h', 'dv-probe': 'probe_cm', 'dv-auto': 'auto_h', 'dv-repeat': 'repeat_min', 'dv-batt': 'low_batt_v', 'dv-stale': 'offline_h' };
  const cfg = (snap && snap.cfg) || CFG;
  Object.keys(map).forEach(id => { const e = document.getElementById(id); if (e && cfg[map[id]] != null) e.textContent = cfg[map[id]]; });
}

function updateSince(now) {
  $$('[data-since]').forEach(e => {
    const t = e.dataset.since;
    if (t === '' || t == null) { e.textContent = 'ไม่ทราบ'; return; }
    e.textContent = (e.dataset.pre || '') + fmtDur((now - Number(t)) / (Number(e.dataset.div) || 1)) + (e.dataset.post || '');
  });
}

/* ---------------------------------------------------------------- ตัววาดหลัก */
function render() {
  const snap = current();
  const empty = { houses: [], now: 0, warn: null, cfg: CFG, gw: {} };
  const s = snap || empty;
  const unk = app.mode === 'live' && !snap;   /* หลุดแล้วยังมีข้อมูลเก่า: แสดงจาง ไม่ซ่อน */
  if (unk && app.view === 'map') {
    document.body.classList.remove('silent-first');
    const u = '<p class="empty-note"><b>ไม่ทราบ</b> ไม่มีข้อมูลจากตัวรับ</p>';
    const key = 'unk' + app.view;
    if (app.sig.unk !== key) {
      app.sig = { unk: key }; buildMapBase();
      $('#sit').innerHTML = '<h2 class="sit-main">ไม่ทราบ</h2><p class="sit-sub">ไม่มีข้อมูลจากตัวรับ</p>';
      $('#queue').innerHTML = '<h2>คำขอความช่วยเหลือ</h2>' + u;
      $('#silent').innerHTML = '<h2>บ้านที่ต้องไปดู</h2>' + u;
      $('#boxpane').innerHTML = '<div></div>' + u;
    }
  } else if (app.view === 'map' || app.view === 'sender') {
    if (app.sig.unk) app.sig = {};
    const d = derive(s);
    if (!app.selManual || !(s.houses || []).some(h => h.id === app.sel)) app.sel = autoSel(s, d);
    if (app.view === 'map') {
      app.m = mapScale();
      renderMap(s); renderSit(s, d); renderQueue(s, d); renderSilent(s, d);
      renderBox(s, (s.houses || []).find(h => h.id === app.sel));
    } else renderSender(s, d);
  }
  renderChrome(s);
  updateSince(s.now);
  app.dirty = false;
}

function setView(v) {
  app.view = v;
  $$('.view').forEach(e => { e.hidden = e.id !== 'view-' + v; });
  $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
  app.sig = {}; app.dirty = true;
  if (v === 'map') buildMapBase();
  render();
}
function setMode(m) {
  if (m === app.mode) return;
  if (m === 'live' && !Live.supported()) {   /* ตาม contract ข้อ 6: อยู่โหมดจำลองต่อ */
    app.notice = 'ต่อตัวรับได้เฉพาะ Chrome หรือ Edge บนคอมพิวเตอร์ ตอนนี้ใช้ข้อมูลจำลองต่อ';
    clearTimeout(app.noticeT); app.noticeT = setTimeout(() => { app.notice = ''; app.dirty = true; }, 8000);
    app.dirty = true; render(); return;
  }
  app.mode = m; app.sig = {}; app.selManual = false; app.sel = null;
  if (m === 'live') Live.start(); else Live.stop();
  if (app.view === 'map') buildMapBase();
  app.dirty = true; render();
}

/* ---------------------------------------------------------------- เหตุการณ์ */
document.addEventListener('click', e => {
  const t = e.target.closest('button, .house'); if (!t) return;
  if (t.closest('.tabs') && t.dataset.view) { setView(t.dataset.view); return; }
  if (t.id === 'connectBtn') { Live.connect(); return; }
  if (t.id === 'modePill') { setMode(app.mode === 'sim' ? 'live' : 'sim'); return; }
  if (t.id === 'presentBtn') { app.present = !app.present; app.dirty = true; if (app.view === 'map') app.sig = {}; render(); return; }
  if (t.dataset.act) { cmd(t.dataset.act, { id: Number(t.dataset.id) }); return; }
  const id = t.dataset.select || (t.classList.contains('house') ? t.dataset.id : null);
  if (id) { app.sel = Number(id); app.selManual = true; app.dirty = true; if (t.dataset.goto) setView(t.dataset.goto); return; }
  if (t.id === 'prPlay') { startScript(0, true); return; }
  if (t.id === 'prPause') { app.playing = !app.playing; app.dirty = true; return; }
  if (t.dataset.jump != null) { startScript(Number(t.dataset.jump), false); return; }
  if (t.id === 'prSound') {
    app.sound = !app.sound; t.setAttribute('aria-pressed', app.sound ? 'true' : 'false'); t.textContent = 'เสียง: ' + (app.sound ? 'เปิด' : 'ปิด');
    if (app.sound) chime(); return;
  }
  if (t.dataset.try) {
    const id2 = app.sel; if (!id2) return;
    ({ green: () => sim.pressGreen(id2), red: () => sim.pressRed(id2), wet: () => sim.probeWet(id2), batt: () => sim.lowBatt(id2), safe: () => sim.pressSafe(id2), off: () => sim.goOffline(id2) })[t.dataset.try]();
    app.playing = app.playing || false; app.dirty = true;
  }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('house')) {
    e.preventDefault(); app.sel = Number(e.target.dataset.id); app.selManual = true; app.dirty = true;
  }
});
$('#warnForm').addEventListener('submit', e => {
  e.preventDefault();
  const lv = $('#lvl').value.trim();
  const body = { when: $('input[name=when]:checked').value, lvl_cm: lv === '' ? null : Math.max(0, Math.min(2540, Number(lv))) };
  if (app.mode === 'sim') body.area = $('#area').value;
  cmd('warn', body);
});
$('#stopWarn').addEventListener('click', () => { const w = current() && current().warn; if (w) cmd('warn_stop', { wid: w.wid }); });
$$('input[name=when]').forEach(r => r.addEventListener('change', () => { app.dirty = true; app.sig.sr = null; }));
window.addEventListener('resize', () => { app.sig = {}; app.dirty = true; });

/* ---------------------------------------------------------------- เริ่มทำงาน */
function init() {
  const legend = [['warn', 'เตือนแล้ว รอกด'], ['silent', 'ยังเงียบ'], ['heard', 'ได้ยินแล้ว / ช่วยเสร็จ'], ['sos', 'ขอความช่วยเหลือ'], ['accepted', 'ทีมรับเรื่องแล้ว']];
  $('#legend').innerHTML = legend.map(([s, t]) => '<li>' + miniPin(s).replace('<svg ', '<svg ') + t + '</li>').join('');
  $$('#legend .pulse').forEach(e => e.classList.remove('pulse'));
  $('#area').addEventListener('change', () => { app.dirty = true; });

  const at = params.get('at');
  const auto = params.get('demo') === 'auto';
  if (params.get('present') === '1' || auto) app.present = true;
  if (params.get('view')) app.view = params.get('view');
  if (at != null && !isNaN(Number(at))) startScript(Number(at), auto);
  else if (auto) startScript(0, true);
  else startScript(60, false);   /* เปิดมาเห็นภาพสุดท้ายของเดโมก่อน */
  if (params.get('live') === '1') { app.mode = 'sim'; setMode('live'); }
  if (Live.supported()) {   /* เสียบสายกลับ (connect) ต่อเอง · ถอดสาย (disconnect) ขึ้นแถบขาด */
    navigator.serial.addEventListener('connect', () => { if (app.mode === 'live') Live.autoOpen(); });
    navigator.serial.addEventListener('disconnect', e => { if (app.mode === 'live' && e.target === Live.port) Live.lose(); });
  }
  setView(app.view);

  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.5, (now - app.lastTick) / 1000); app.lastTick = now;
    const before = sim.now;
    stepTick(dt);
    if (app.dirty || sim.rev !== app.lastRev || sim.now !== before || app.mode === 'live') {
      app.lastRev = sim.rev;
      render();
    }
  }, 200);
}
init();
window.__app = app;   /* ไว้ให้สคริปต์ทดสอบใช้ */
})();
