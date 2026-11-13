// An in-browser receiver, isolated from USB. It produces the exact v2 wire shape.
import {WHEN} from './protocol.js';
const copy = value => JSON.parse(JSON.stringify(value));
export const DESIGN_CFG = Object.freeze({silent_h: 6, auto_h: 2, probe_cm: 50, water_s: 30,
  repeat_min: 10, hold_s: 2, safe_hold_s: 2, hb_h: 6, offline_h: 13, low_batt_v: 3.9, link_hb_s: 2});
const VOICE = {
  heard: 'ขอบคุณ ทีมรู้แล้วว่าบ้านนี้ได้ยิน', sos: 'ส่งขอความช่วยเหลือแล้ว รอสักครู่',
  auto_sos: 'น้ำเข้าบ้านแล้ว กล่องขอความช่วยเหลือให้แล้ว', accepted: 'ทีมรับเรื่องแล้ว เรือกำลังมา อยู่บนที่สูง อย่าลงน้ำ',
  done: 'ทีมช่วยเหลือบ้านนี้เรียบร้อยแล้ว', safe: 'ยกเลิกคำขอแล้ว ทีมรู้ว่าบ้านนี้ปลอดภัย'
};
export class SimulatedReceiver {
  constructor(onValue, {time = () => Date.now(), onBox = () => {}} = {}) {
    this.emit = onValue; this.time = time; this.onBox = onBox; this.active = false; this.timers = []; this.deliveries = [];
  }
  now() { return Math.floor(100000 + (this.time() - this.started) / 1000 * this.speedup); }
  start(scenario = 'overview', count = 12) {
    this.stop(); this.active = true; this.started = this.time(); this.speedup = scenario === 'demo' ? 720 : 1;
    this.rev = 1; this.nextReq = 0; this.warn = null; this.events = []; this.deliveries = []; this.lastButtons = new Map(); this.beforeOffline = new Map();
    this.houses = Array.from({length: scenario === 'empty' ? 0 : count}, (_, i) => ({
      id: 1001 + i, name: `บ้าน ${i + 1}`, x: 35 + i % 8 * 42, y: 25 + Math.floor(i / 8) * 45,
      bed: i % 4 === 1, state: 'idle', t_state: 100000, got_warn: false, last_seen: 99990,
      offline: false, rssi: -96 - i % 12, snr: 5 - i % 6, batt_v: 4.5, low_batt: false,
      probe_wet: false, t_wet: null, try: 1, req: null
    }));
    if (scenario === 'overview' && this.houses.length >= 10) {
      this.warn = {wid: 1, when: 'tonight', lvl_cm: null, t: 77000, tx: 27, active: true};
      for (const [i, state] of ['sos', 'auto_sos', 'accepted', 'silent', 'heard', 'offline', 'warn', 'done', 'safe', 'idle'].entries()) {
        const h = this.houses[i]; h.state = state; h.t_state = 99600; h.got_warn = !['offline', 'idle'].includes(state);
        if (['sos', 'auto_sos', 'accepted'].includes(state)) h.req = this.newRequest(state === 'auto_sos' ? 'auto_sos' : 'sos', 99000 + i * 100);
        if (state === 'auto_sos') { h.bed = true; h.probe_wet = true; h.t_wet = 91000; h.req.cancel_t = 99800; this.lastButtons.set(h.id, 99800); h.batt_v = 3.82; h.low_batt = true; }
        if (state === 'accepted') { h.req.t_accept = 99600; h.req.delivered = false; }
        if (state === 'offline') { h.offline = true; h.last_seen = 80000; }
      }
    }
    if (scenario === 'stress') for (let i = 0; i < this.houses.length; i++) if (i % 3 === 0) {
      const kind = i % 4 === 0 ? 'auto_sos' : 'sos';
      if (kind === 'auto_sos') this.houses[i].bed = true;
      this.help(this.houses[i], kind);
    }
    this.snap(); this.interval = setInterval(() => this.tick(), 500); this.lastHeartbeat = this.time();
  }
  stop() { this.active = false; clearInterval(this.interval); this.timers.forEach(clearTimeout); this.timers = []; }
  later(ms, fn) { this.timers.push(setTimeout(() => { if (this.active) fn(); }, ms)); }
  newRequest(kind, t = this.now()) { return {no: ++this.nextReq, kind, t_open: t, confirmed: kind === 'sos', t_accept: null, delivered: false, cancel_t: null, dup: 0}; }
  event(id, ev) { this.events.unshift({t: this.now(), id, ev}); this.events.length = Math.min(this.events.length, 50); }
  state(h, state) { h.state = state; h.t_state = this.now(); }
  box(h, state = h.state) {
    const light = {idle: 'ดับ', warn: 'ส้มกะพริบ', silent: 'ส้มกะพริบ', heard: 'เขียว', sos: 'แดง', auto_sos: 'แดง', accepted: 'เหลือง', done: 'เขียว', safe: 'เขียว'}[state] || 'สถานะเดิม';
    const voice = state === 'warn' || state === 'silent' ? `เตือนภัยน้ำท่วม น้ำจะเข้าบ้านภายใน ${WHEN[this.warn?.when] || 'คืนนี้'} ยกของขึ้นที่สูง พาคนป่วยขึ้นชั้นบน ได้ยินแล้วกดปุ่มเขียว` : VOICE[state] || 'พร้อมใช้งาน';
    this.onBox({id: h.id, light, voice});
  }
  help(h, kind) {
    if (h.req) { h.req.dup++; if (kind === 'sos') { h.req.kind = 'sos'; h.req.confirmed = true; if (h.state !== 'accepted') this.state(h, 'sos'); } }
    else { h.req = this.newRequest(kind); this.state(h, kind); }
    this.event(h.id, kind); this.box(h);
  }
  snapshot() {
    return {t: 'snap', v: 2, rev: this.rev, now: this.now(), gw: {name: 'ตัวรับสาธิต', sim: true, link: 'usb', air_pct: 0.4},
      cfg: {...DESIGN_CFG, offline_h: this.warn?.active ? 3 : 13, speedup: this.speedup},
      warn: this.warn, houses: this.houses, events: this.events};
  }
  snap() { if (this.active) this.emit(copy(this.snapshot())); }
  changed() { this.rev++; this.snap(); }
  async send(command) {
    if (!this.active) throw new Error('ปิดโหมดทดลองแล้ว');
    this.later(100, () => {
      if (command.cmd === 'hello') { this.snap(); return; }
      let err = null;
      const h = this.houses.find(h => h.id === command.id);
      if (command.cmd === 'warn') {
        if (!Object.hasOwn(WHEN, command.when)) err = 'bad_when';
        else {
          this.warn = {wid: (this.warn?.wid || 0) % 255 + 1, when: command.when, lvl_cm: command.lvl_cm ?? null, t: this.now(), tx: 1, active: true};
          this.houses.forEach(h => { h.got_warn = false; if (!h.req && !h.offline) { this.state(h, 'warn'); this.box(h); } });
          this.event(0, 'warn_sent');
        }
      } else if (command.cmd === 'warn_stop') {
        if (!this.warn?.active || this.warn.wid !== command.wid) err = 'no_warn'; else this.warn.active = false;
      } else if (!h?.req) err = 'no_open_request';
      else if (command.cmd === 'confirm') {
        if (h.req.kind !== 'auto_sos') err = 'not_auto'; else { h.req.confirmed = true; this.event(h.id, 'confirm'); }
      } else if (command.cmd === 'accept') {
        if (h.req.kind === 'auto_sos' && !h.req.confirmed) err = 'need_confirm';
        else { this.state(h, 'accepted'); h.req.t_accept = this.now(); h.req.delivered = false; this.event(h.id, 'accept'); this.deliveries.push({id: h.id, no: h.req.no, at: this.time() + 1800}); }
      } else if (command.cmd === 'done') {
        h.req = null; this.state(h, 'done'); this.event(h.id, 'done'); this.box(h);
      } else if (command.cmd === 'cancel_ok') {
        if (h.req.cancel_t === null) err = 'not_cancelled';
        else { h.req = null; this.state(h, 'safe'); this.event(h.id, 'cancel_ok'); }
      }
      if (err) this.emit({t: 'res', rid: command.rid, ok: false, err});
      else {
        this.rev++; this.emit({t: 'res', rid: command.rid, ok: true, rev: this.rev});
        this.later(200, () => this.snap());
      }
    });
  }
  press(id, action) {
    if (!this.active) return;
    const h = this.houses.find(h => h.id === id); if (!h) return;
    if (action === 'offline') {
      h.offline = !h.offline;
      if (!h.req) {
        if (h.offline) { this.beforeOffline.set(id, h.state); this.state(h, 'offline'); }
        else { this.state(h, this.beforeOffline.get(id) || 'idle'); h.last_seen = this.now(); }
      }
      this.event(id, h.offline ? 'offline' : 'online');
    }
    else if (action === 'battery') { h.low_batt = !h.low_batt; h.batt_v = h.low_batt ? 3.82 : 4.5; if (h.low_batt) { this.event(id, 'low_batt'); this.onBox({id, light: 'สีเดิม', voice: 'ถ่านใกล้หมด กรุณาเปลี่ยนถ่าน'}); } }
    else if (action === 'wet') { if (!h.bed) return; h.probe_wet = !h.probe_wet; h.t_wet = h.probe_wet ? this.now() : null; this.event(id, h.probe_wet ? 'probe_wet' : 'probe_dry'); }
    else {
      this.lastButtons.set(id, this.now()); h.last_seen = this.now(); h.offline = false;
      if (action === 'red') this.help(h, 'sos');
      else if (h.state === 'warn' || h.state === 'silent') { this.state(h, 'heard'); h.got_warn = true; this.event(id, 'heard'); this.box(h); }
      else if (action === 'safe') {
        if (h.bed && h.req) { h.req.cancel_t = this.now(); this.event(id, 'cancel'); }
        else { h.req = null; this.state(h, 'safe'); this.event(id, 'safe'); }
        this.box(h, 'safe');
      } else this.box(h);
    }
    this.changed();
  }
  tick() {
    const now = this.now(); let dirty = false;
    for (const h of this.houses) {
      if (h.state === 'warn' && now - h.t_state >= DESIGN_CFG.silent_h * 3600) { this.state(h, 'silent'); this.event(h.id, 'silent'); dirty = true; }
      if (h.bed && h.probe_wet && !h.req && !['done', 'safe'].includes(h.state) && now - Math.max(h.t_wet, this.lastButtons.get(h.id) ?? h.t_wet) >= DESIGN_CFG.auto_h * 3600) { this.help(h, 'auto_sos'); dirty = true; }
      const statusSeconds = this.warn?.active ? 3600 : DESIGN_CFG.hb_h * 3600;
      if (!h.offline && now - h.last_seen >= statusSeconds) { h.last_seen = now; if (this.warn) h.got_warn = true; dirty = true; }
    }
    this.deliveries = this.deliveries.filter(d => {
      if (this.time() < d.at) return true;
      const h = this.houses.find(h => h.id === d.id);
      if (h?.req?.no === d.no && h.state === 'accepted' && !h.offline) { h.req.delivered = true; this.event(h.id, 'delivered'); this.box(h); dirty = true; }
      return false;
    });
    if (this.warn?.active) {
      const elapsed = now - this.warn.t;
      const tx = elapsed < 60 ? 1 + Math.floor(elapsed / 30) : 3 + Math.floor((elapsed - 60) / 900);
      if (tx > this.warn.tx) { this.warn.tx = tx; dirty = true; }
    }
    if (dirty) this.changed();
    if (this.time() - this.lastHeartbeat >= 2000) { this.lastHeartbeat = this.time(); this.emit({t: 'hb', rev: this.rev, now, air_pct: 0.4}); }
  }
  auto(command) {
    this.start('demo');
    this.later(300, () => command('warn', {when: 'tonight', lvl_cm: null}));
    this.later(3500, () => this.press(1001, 'red'));
    this.later(7000, () => this.press(1001, 'red'));
    this.later(10000, () => this.press(1002, 'wet'));
    this.later(14000, () => this.press(1003, 'green'));
    this.later(18000, () => command('accept', {id: 1001}));
    this.later(24000, () => command('done', {id: 1001}));
    this.later(28000, () => this.press(1002, 'safe'));
    this.later(32000, () => command('confirm', {id: 1002}));
    this.later(36000, () => command('cancel_ok', {id: 1002}));
    this.later(42000, () => this.press(1004, 'offline'));
    this.later(48000, () => this.press(1001, 'battery'));
    this.later(60000, () => { this.onBox({id: null, light: 'จบเดโม 60 วินาที', voice: 'ทดลองต่อได้จากปุ่มด้านบน หรือเริ่มใหม่'}); });
  }
}
