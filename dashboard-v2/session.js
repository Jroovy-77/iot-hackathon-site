import {readSnapshot, finite, encodeCommand, ERRORS} from './protocol.js';

export class ReceiverSession {
  constructor({write = async () => {}, changed = () => {}, time = () => Date.now()} = {}) {
    this.write = write; this.changed = changed; this.time = time;
    this.snapshot = null; this.status = 'idle'; this.rid = 0; this.pending = new Map(); this.errors = new Map(); this.results = new Map();
    this.clock = null; this.lastSeen = null; this.lastHello = -Infinity; this.syncFloor = null; this.notice = '';
  }
  get ready() { return this.status === 'connected' && !!this.snapshot; }
  get estimatedNow() {
    if (!this.clock) return null;
    const speed = this.snapshot?.gw.sim === true && finite(this.snapshot.cfg.speedup) ? this.snapshot.cfg.speedup : 1;
    return this.clock.now + (this.ready ? Math.max(0, this.time() - this.clock.wall) / 1000 * speed : 0);
  }
  open() { this.status = 'syncing'; this.lastSeen = this.time(); this.syncFloor = null; this.changed(); this.hello(true); }
  reset() {
    this.failAll('disconnected'); this.snapshot = null; this.clock = null; this.lastSeen = null;
    this.status = 'idle'; this.notice = ''; this.syncFloor = null; this.airPct = undefined; this.errors.clear(); this.results.clear(); this.changed();
  }
  async hello(force = false) {
    if (!force && this.time() - this.lastHello < 1000) return;
    this.lastHello = this.time();
    try { await this.write({cmd: 'hello', rid: ++this.rid}); }
    catch { this.disconnect(); }
  }
  failAll(reason) {
    for (const p of this.pending.values()) { this.errors.set(p.key, ERRORS[reason]); this.results.delete(p.key); }
    this.pending.clear();
  }
  disconnect(reason = '') {
    this.status = 'stale'; this.disconnectedAt ??= this.time(); this.failAll('disconnected');
    if (reason) this.notice = reason;
    this.changed();
  }
  receive(value) {
    if (!value || typeof value !== 'object') return;
    if (value.t === 'res') {
      const p = this.pending.get(value.rid);
      if (!p || typeof value.ok !== 'boolean') return;
      if (!value.ok) { this.pending.delete(value.rid); this.errors.set(p.key, ERRORS[value.err] || `ตัวรับปฏิเสธคำสั่ง (${String(value.err || 'ไม่ทราบสาเหตุ')})`); }
      else if (Number.isSafeInteger(value.rev) && value.rev >= 0) {
        p.ack = value.rev; this.settle();
        if (this.pending.has(value.rid)) this.hello();
      }
      this.changed(); return;
    }
    const snap = readSnapshot(value);
    const hb = value.t === 'hb' && Number.isSafeInteger(value.now) && value.now >= 0 && Number.isSafeInteger(value.rev) && value.rev >= 0;
    if (!snap && !hb) return;
    const rebooted = this.clock && value.now < this.clock.now;
    if (rebooted) {
      this.failAll('reboot'); this.status = 'syncing'; this.syncFloor = value.rev;
      this.notice = 'ตัวรับเพิ่งเริ่มใหม่ ข้อมูลในหน่วยความจำเดิมอาจหาย กรุณาตรวจคำขอทั้งหมด';
      // Old houses cannot be used in the new boot, even if its revision is equal.
      this.snapshot = null;
      this.hello(true);
    }
    this.clock = {now: value.now, wall: this.time()}; this.lastSeen = this.time();
    if (finite(value.air_pct)) this.airPct = value.air_pct;
    else if (snap) this.airPct = finite(snap.gw.air_pct) ? snap.gw.air_pct : undefined;
    if (snap) {
      if (this.snapshot && snap.rev < this.snapshot.rev) { this.hello(); return; }
      if (this.syncFloor !== null && snap.rev < this.syncFloor) { this.hello(); return; }
      for (const h of snap.houses) {
        const previous = this.snapshot?.houses.find(old => old.id === h.id);
        if (h.req && h.req.no !== previous?.req?.no) { this.errors.delete(`house:${h.id}`); this.results.delete(`house:${h.id}`); }
      }
      this.snapshot = snap; this.status = 'connected'; this.syncFloor = null; this.disconnectedAt = null;
      this.settle();
      if (snap.houses.some(h => h.requestIncomplete)) this.hello();
    } else if (!this.snapshot || value.rev !== this.snapshot.rev || this.status === 'stale' || this.status === 'syncing') {
      this.status = 'syncing'; this.syncFloor = value.rev; this.hello();
    }
    if (hb && this.snapshot?.houses.some(h => h.requestIncomplete)) this.hello();
    this.changed();
  }
  settle() {
    for (const [rid, p] of this.pending) {
      if (p.ack !== null && this.snapshot && this.snapshot.rev >= p.ack && (p.matches(this.snapshot) || this.snapshot.rev > p.ack)) {
        this.pending.delete(rid); this.errors.delete(p.key);
        this.results.set(p.key, p.matches(this.snapshot) ? 'ตัวรับยืนยันผลคำสั่งแล้ว' : 'ตัวรับยืนยันคำสั่งแล้ว · ขณะนี้แสดงข้อมูลสถานะล่าสุดที่เปลี่ยนต่อจากนั้น');
      }
    }
  }
  async command(cmd, fields = {}) {
    if (!this.ready) throw new Error(ERRORS.disconnected);
    if (fields.id && this.snapshot.houses.find(h => h.id === fields.id)?.requestIncomplete) throw new Error('ข้อมูลคำขอของบ้านนี้ไม่ครบ ขอข้อมูลล่าสุดก่อนส่งคำสั่ง');
    const key = fields.id ? `house:${fields.id}` : 'warning';
    if ([...this.pending.values()].some(p => p.key === key)) return;
    const wire = {cmd, rid: ++this.rid, ...fields}; encodeCommand(wire);
    const previousWid = this.snapshot.warn?.wid;
    const matches = snap => {
      const h = snap.houses.find(house => house.id === fields.id);
      if (cmd === 'warn') return snap.warn?.active === true && snap.warn.wid !== previousWid && snap.warn.when === fields.when;
      if (cmd === 'warn_stop') return snap.warn?.wid === fields.wid && snap.warn.active === false;
      if (cmd === 'confirm') return h?.req?.confirmed === true;
      if (cmd === 'accept') return h?.state === 'accepted';
      if (cmd === 'done') return h?.state === 'done' && !h.req;
      if (cmd === 'cancel_ok') return h?.state === 'safe' && !h.req;
      return false;
    };
    this.pending.set(wire.rid, {key, cmd, sentAt: this.time(), ack: null, matches}); this.errors.delete(key); this.results.delete(key); this.changed();
    try { await this.write(wire); }
    catch { this.pending.delete(wire.rid); this.errors.set(key, ERRORS.transport); this.changed(); }
  }
  tick() {
    const hbSeconds = this.snapshot?.cfg.link_hb_s;
    const deadline = finite(hbSeconds) && hbSeconds > 0 ? hbSeconds * 3000 : 6000;
    if (this.lastSeen !== null && this.status !== 'idle' && this.status !== 'stale' && this.time() - this.lastSeen >= deadline) this.disconnect();
    for (const [rid, p] of this.pending) {
      if (this.time() - p.sentAt >= 5000) {
        this.pending.delete(rid);
        if (p.ack !== null) this.results.set(p.key, 'ตัวรับตอบรับคำสั่งแล้ว แต่ยังไม่ได้รับข้อมูลสถานะใหม่ กรุณาขอข้อมูลล่าสุด');
        else this.errors.set(p.key, ERRORS.timeout);
        this.changed();
      }
    }
    if (this.status === 'syncing' && this.lastSeen !== null) this.hello();
  }
}
