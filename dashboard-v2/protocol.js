// FloodLink USB contract v2. This module interprets data; only the receiver owns state.
export const STATES = Object.freeze({
  idle: ['ไม่มีเหตุ', 'idle', '○'], warn: ['รอคนในบ้านตอบคำเตือน', 'warn', '△'],
  heard: ['ได้ยินแล้ว', 'heard', '✓'], silent: ['บ้านเงียบ', 'silent', '!'],
  sos: ['ขอความช่วยเหลือ', 'sos', '!'], auto_sos: ['กล่องขอแทน', 'auto_sos', '!'],
  accepted: ['ทีมรับเรื่องแล้ว', 'accepted', '□'], done: ['ช่วยเสร็จ', 'done', '✓'],
  safe: ['ปลอดภัย (บ้านแจ้ง)', 'safe', '✓'], offline: ['ขาดการติดต่อ', 'offline', '–']
});
export const EVENTS = Object.freeze({
  warn_sent: 'ส่งคำเตือน', heard: 'บ้านตอบว่าได้ยินแล้ว', silent: 'บ้านเงียบ', sos: 'บ้านขอความช่วยเหลือ',
  auto_sos: 'กล่องขอความช่วยเหลือแทน', confirm: 'อสม. ยืนยันคำขอแทน', accept: 'ทีมรับเรื่อง',
  delivered: 'กล่องได้รับคำสั่งแล้ว', done: 'ช่วยเสร็จ', safe: 'บ้านแจ้งปลอดภัย',
  cancel: 'บ้านติดเตียงขอยกเลิก รอโทรยืนยัน', cancel_ok: 'ทีมโทรยืนยันว่าปลอดภัย',
  low_batt: 'ถ่านอ่อน', probe_wet: 'น้ำถึงสายวัด', probe_dry: 'น้ำไม่ถึงสายวัด',
  offline: 'ขาดการติดต่อ', online: 'กลับมาติดต่อได้', retry_rx: 'รับข้อความที่ส่งซ้ำ'
});
export const ERRORS = Object.freeze({
  bad_when: 'เลือกเวลาคำเตือนเป็น วันนี้ คืนนี้ หรือพรุ่งนี้', no_warn: 'ไม่มีคำเตือนนี้ที่กำลังส่งซ้ำ',
  no_open_request: 'บ้านนี้ไม่มีคำขอเปิดอยู่แล้ว', not_auto: 'คำขอนี้ไม่ได้เป็นคำขอแทน',
  need_confirm: 'ต้องให้ อสม. ยืนยันคำขอแทนก่อน', not_cancelled: 'บ้านนี้ยังไม่ได้ขอยกเลิก',
  timeout: 'ยังไม่ได้รับการยืนยันครบจากตัวรับ ตรวจข้อมูลล่าสุดก่อนลองใหม่',
  disconnected: 'ขาดการเชื่อมต่อกับตัวรับ กรุณาเชื่อมต่อใหม่', reboot: 'ตัวรับเริ่มใหม่ กรุณาตรวจข้อมูลใหม่',
  transport: 'ส่งผ่าน USB ไม่สำเร็จ กรุณาตรวจสายและเชื่อมต่อใหม่'
});
export const WHEN = Object.freeze({today: 'วันนี้', tonight: 'คืนนี้', tomorrow: 'พรุ่งนี้'});
export const finite = value => typeof value === 'number' && Number.isFinite(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
export const stateInfo = state => Object.hasOwn(STATES, state) ? STATES[state] : ['ไม่ทราบ', 'unknown', '?'];
export const numberText = value => finite(value) ? String(value) : '—';
export const booleanText = value => value === true ? 'ใช่' : value === false ? 'ไม่ใช่' : 'ไม่ทราบ';

export function readSnapshot(value) {
  if (!value || value.t !== 'snap' || value.v !== 2 || !integer(value.rev) || !integer(value.now) || !Array.isArray(value.houses)) return null;
  const ids = new Set();
  const houses = value.houses.filter(h => h && Number.isInteger(h.id) && h.id > 0 && h.id < 65535 && !ids.has(h.id) && ids.add(h.id))
    .map(h => {
      const req = h.req && typeof h.req === 'object' && !Array.isArray(h.req) ? {...h.req} : null;
      const incompleteFields = req && (!integer(req.no) || !['sos', 'auto_sos'].includes(req.kind) || !integer(req.t_open) || typeof req.confirmed !== 'boolean');
      return {...h, req, requestIncomplete: !!incompleteFields || ['sos', 'auto_sos', 'accepted'].includes(h.state) && !req};
    });
  return {...value, gw: value.gw && typeof value.gw === 'object' ? {...value.gw} : {},
    cfg: value.cfg && typeof value.cfg === 'object' ? {...value.cfg} : {}, houses,
    events: Array.isArray(value.events) ? value.events.filter(e => e && typeof e === 'object').slice(0, 50).map(e => ({...e})) : []};
}

export function queueHouses(houses) {
  const rank = h => h.state === 'accepted' ? 3 : h.req?.kind === 'auto_sos' || h.state === 'auto_sos' ? 0 : h.bed === true ? 1 : 2;
  return houses.filter(h => h.req || h.requestIncomplete).sort((a, b) => rank(a) - rank(b) ||
    (finite(a.req?.t_open) ? a.req.t_open : Infinity) - (finite(b.req?.t_open) ? b.req.t_open : Infinity) || a.id - b.id);
}
export function visitHouses(houses) {
  return houses.filter(h => h.state === 'silent' || h.state === 'offline' || h.offline === true)
    .sort((a, b) => Number(b.bed === true) - Number(a.bed === true) || a.id - b.id);
}
export function badges(h, now) {
  const result = [];
  if (h.requestIncomplete) result.push('ข้อมูลคำขอไม่ครบ ต้องขอข้อมูลใหม่');
  if (h.bed === true) result.push('ติดเตียง');
  if (h.low_batt === true) result.push('ถ่านอ่อน');
  if (h.offline === true && h.state !== 'offline') result.push('ขาดการติดต่อ');
  if (finite(h.req?.cancel_t)) result.push('ยกเลิกโดยบ้าน ควรโทรยืนยัน');
  if (h.req?.kind === 'auto_sos' && h.req.confirmed === false) result.push('ขอแทน รอยืนยัน');
  if (h.state === 'accepted' && h.req?.delivered === false && finite(h.req.t_accept) && finite(now) && now - h.req.t_accept > 300)
    result.push('ไฟที่บ้านยังไม่เปลี่ยน — กล่องยังไม่ได้รับ');
  if (h.probe_wet === true) result.push('น้ำถึงสายวัด');
  if (h.last_seen === null) result.push('ยังไม่เคยได้ยินกล่องนี้');
  if (finite(h.try) && h.try > 1) result.push(`ส่งถึงในครั้งที่ ${h.try}`);
  return result;
}

const commands = new Set(['hello', 'warn', 'warn_stop', 'confirm', 'accept', 'done', 'cancel_ok']);
export function encodeCommand(value) {
  if (!value || !commands.has(value.cmd) || !integer(value.rid)) throw new Error('คำสั่งไม่ถูกต้อง');
  const wire = {cmd: value.cmd, rid: value.rid};
  if (value.cmd === 'warn') {
    if (!Object.hasOwn(WHEN, value.when)) throw new Error(ERRORS.bad_when);
    if (value.lvl_cm !== null && (!Number.isInteger(value.lvl_cm) || value.lvl_cm < 0 || value.lvl_cm > 2540)) throw new Error('ระดับน้ำต้องเป็นจำนวนเต็ม 0–2540 ซม. หรือเว้นว่าง');
    wire.when = value.when; wire.lvl_cm = value.lvl_cm;
  } else if (value.cmd === 'warn_stop') {
    if (!Number.isInteger(value.wid) || value.wid < 1 || value.wid > 255) throw new Error('รหัสคำเตือนไม่ถูกต้อง');
    wire.wid = value.wid;
  } else if (value.cmd !== 'hello') {
    if (!Number.isInteger(value.id) || value.id < 1 || value.id > 65534) throw new Error('รหัสบ้านไม่ถูกต้อง');
    wire.id = value.id;
  }
  return new TextEncoder().encode(JSON.stringify(wire) + '\n');
}

// Timestamps are uptime seconds, anchored to the latest snap/hb, never Unix time.
export function clockTime(t, now, wallMs) {
  if (!finite(t) || !finite(now) || !finite(wallMs) || t < 0 || now < 0 || t > now) return null;
  const date = new Date(wallMs - (now - t) * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}
