import {STATES, EVENTS, WHEN, stateInfo, finite, numberText, booleanText, queueHouses, visitHouses, badges, clockTime} from './protocol.js';
import {ReceiverSession} from './session.js';
import {SerialReceiver} from './serial.js';
import {SimulatedReceiver} from './simulator.js';
import {StationMap, hasCoordinates, positionHouses} from './station-map.js';
import {statusIcon, badgeIcon, STATUS_HELP} from './status-icons.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const store = (key, value) => { try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch { return null; } };
const timeFormat = new Intl.DateTimeFormat('th-TH', {hour: '2-digit', minute: '2-digit', hour12: false});
const dateFormat = new Intl.DateTimeFormat('th-TH', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false});
let mode = 'sim', selected = null, view = 'overview', frame = false, demoBox = null, logs = [], armed = null, uiNotice = '';
let registryEdit = 0;
const session = new ReceiverSession({write: value => mode === 'sim' ? sim.send(value) : serial.send(value), changed: scheduleRender});
const serial = new SerialReceiver({
  onValue: value => { if (mode === 'live') session.receive(value); },
  onDisconnect: () => { if (mode === 'live') { session.disconnect(); log('สาย USB ขาดการเชื่อมต่อ'); } },
  onLog: log,
  onReconnect: () => { if (mode === 'live') { uiNotice = ''; session.open(); log('เปิดพอร์ตที่เคยอนุญาตแล้ว รอภาพรวมใหม่'); } }
});
const sim = new SimulatedReceiver(value => { if (mode === 'sim') session.receive(value); }, {onBox: value => { demoBox = value; renderBox(); }});
const geo = new StationMap({getData: () => ({houses: displayHouses(), mode, selected}), onSelect: openHouse, onChanged: scheduleRender, onEdit: editRegistry});
function displayHouses() {
  const houses = (session.snapshot?.houses || []).map(h => { const r = geo.record(h.id); return r ? {...h, name: r.name || h.name, registry: r} : h; });
  if (mode === 'live') {
    const ids = new Set(houses.map(h => String(h.id)));
    for (const r of geo.registry) if (!ids.has(String(r.id)) && /^\d+$/.test(r.id) && Number(r.id) > 0 && Number(r.id) < 65535) houses.push({id: Number(r.id), name: r.name || `บ้าน ${r.id}`, state: 'unknown', req: null, registryOnly: true, registry: r});
  }
  return houses;
}

function scheduleRender() { if (!frame) { frame = true; queueMicrotask(() => { frame = false; render(); }); } }
function log(text) {
  logs.unshift({at: Date.now(), text}); logs = logs.slice(0, 30);
  $('connection-log').innerHTML = logs.map(l => `<li><span class="mono">${esc(timeFormat.format(l.at))}</span> ${esc(l.text)}</li>`).join('');
}
function status(h) {
  const [label, key] = stateInfo(h.state);
  return `<span class="status state-${key}" data-state="${key}"><span class="status-mark" aria-hidden="true">${statusIcon(key)}</span>${esc(label)}</span>`;
}
function tags(h) {
  return `<div class="badges">${badges(h, session.estimatedNow).map(b => `<span class="badge${b.includes('ยกเลิก') || b.includes('ยังไม่') ? ' attention' : ''}">${badgeIcon(b)}${esc(b)}</span>`).join('')}</div>`;
}
function stamp(t, relative = true) {
  if (!finite(t) || !session.clock) return '—';
  const now = session.estimatedNow ?? session.clock.now;
  const date = clockTime(t, now, session.ready ? Date.now() : session.clock.wall);
  if (!date) return '—';
  const seconds = Math.max(0, Math.floor(now - t));
  const age = seconds < 60 ? 'เมื่อสักครู่' : seconds < 3600 ? `${Math.floor(seconds / 60)} นาทีที่แล้ว` : `${Math.floor(seconds / 3600)} ชม.ที่แล้ว`;
  return `<time title="${esc(dateFormat.format(date))}" class="mono">${esc(timeFormat.format(date))}</time>${relative ? ` <span class="age">(${esc(age)})</span>` : ''}`;
}
function empty(title, text = '') { return `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`; }
function houseButton(h, className = 'house-link') { return `<button type="button" class="${className}" data-house="${h.id}">${esc(h.name || `บ้านรหัส ${h.id}`)}</button>`; }
function commandKey(id) { return id ? `house:${id}` : 'warning'; }
function pendingFor(id) { const key = commandKey(id); return [...session.pending.values()].find(p => p.key === key); }
function feedback(id) {
  const p = pendingFor(id), error = session.errors.get(commandKey(id));
  return p ? p.ack === null ? 'กำลังส่ง… รอตัวรับตอบรับ' : 'ตัวรับตอบรับแล้ว รอข้อมูลสถานะยืนยัน…' : error ? `ส่งคำสั่งไม่สำเร็จ ลองใหม่ · ${error}` : session.results.get(commandKey(id)) || '';
}
function commandButton(cmd, h, label, disabled = false, primary = false) {
  const key = `${cmd}:${h?.id ?? 'warning'}`;
  const confirm = armed?.key === key && armed.until > Date.now();
  const busy = pendingFor(h?.id);
  return `<button type="button" data-cmd="${cmd}"${h ? ` data-id="${h.id}"` : ''} class="${primary ? 'primary ' : ''}${confirm ? 'armed' : ''}" ${!session.ready || busy || disabled ? 'disabled' : ''}${disabled ? ' title="ต้องให้ อสม. ยืนยันคำขอแทนก่อน"' : ''}>${confirm ? 'ยืนยัน: ' : ''}${esc(label)}</button>`;
}
function actions(h) {
  if (h.requestIncomplete) return '<p class="command-status" role="alert">ข้อมูลคำขอไม่ครบ ยังสั่งเปลี่ยนสถานะไม่ได้</p><div class="actions"><button type="button" data-resync>ขอข้อมูลล่าสุด</button></div>';
  if (!h.req) return '';
  const confirmNeeded = h.req.kind === 'auto_sos' && h.req.confirmed !== true;
  return `<div class="actions">${confirmNeeded ? commandButton('confirm', h, 'ยืนยันคำขอแทน', false, true) : ''}${h.state !== 'accepted' ? commandButton('accept', h, 'รับเรื่อง', confirmNeeded, !confirmNeeded) : commandButton('done', h, 'ช่วยเสร็จ', false, true)}${finite(h.req.cancel_t) ? commandButton('cancel_ok', h, 'โทรแล้ว ปลอดภัย') : ''}<button class="map-action" type="button" data-locate="${h.id}">ดูบนแผนที่</button></div>${confirmNeeded ? '<p class="help">ให้ อสม. ตรวจบ้านหรือโทรยืนยัน ก่อนรับเรื่อง</p>' : ''}<p class="command-status" role="status">${esc(feedback(h.id))}</p>`;
}

function renderChrome() {
  const ready = session.ready, snap = session.snapshot;
  const stale = mode === 'live' && !ready;
  document.body.classList.toggle('stale-data', stale);
  $('mode-label').textContent = snap?.gw.sim === true || mode === 'sim' ? 'จำลอง' : 'ตัวรับ USB';
  $('connection-text').textContent = mode === 'sim' ? 'ทดลองในเครื่อง · ไม่ส่งออก USB' : ready ? 'เชื่อมต่อตัวรับแล้ว · ข้อมูลล่าสุด' : session.status === 'syncing' ? 'ต่อ USB แล้ว · รอภาพรวมจากตัวรับ' : 'ยังไม่ได้เชื่อมต่อ';
  $('data-time').textContent = session.lastSeen === null ? '' : `รับข้อมูล ${timeFormat.format(session.lastSeen)}`;
  $('connect').hidden = mode === 'live' && serial.connected;
  $('disconnect').hidden = mode !== 'live' || !serial.connected;
  $('use-sim').hidden = mode === 'sim';
  $('connection-banner').hidden = !(mode === 'live' && session.status === 'stale');
  $('connection-banner').textContent = `ขาดการเชื่อมต่อกับตัวรับ ตั้งแต่ ${timeFormat.format(session.disconnectedAt || Date.now())} · ข้อมูลที่เห็นเป็นข้อมูลล่าสุดที่เก็บไว้ ปุ่มคำสั่งใช้ไม่ได้`;
  const incomplete = snap?.houses.filter(h => h.requestIncomplete).length || 0;
  const note = [uiNotice || session.notice, incomplete ? `ข้อมูลคำขอไม่ครบ ${incomplete} บ้าน · คงบ้านไว้ในคิวและรอข้อมูลใหม่จากตัวรับ` : ''].filter(Boolean).join(' · ');
  $('notice').hidden = !note; $('notice').textContent = note;
  $('overview-subtitle').textContent = snap ? `${snap.gw.name || 'ตัวรับไม่ระบุชื่อ'} · ${snap.houses.length} บ้านในทะเบียน` : 'เชื่อมต่อแล้วรอข้อมูลจากตัวรับ';
  $('refresh').disabled = mode === 'live' && !serial.connected;
  $('send-warning').disabled = !ready || !!pendingFor();
  $('send-warning').textContent = armed?.key === 'warn:warning' && armed.until > Date.now() ? 'ยืนยันส่งคำเตือนถึงทุกบ้าน' : 'ส่งคำเตือน';
  $('warning-command-status').textContent = feedback();
  for (const el of document.querySelectorAll('[data-scenario],[data-box],#auto-demo,#demo-house')) el.disabled = mode !== 'sim' || (el.dataset.box === 'wet' && !snap?.houses.find(h => h.id === Number($('demo-house').value))?.bed);
  $('demo-state').textContent = mode !== 'sim' ? 'กำลังใช้ตัวรับจริง กลับโหมดทดลองก่อนใช้เครื่องมือเหล่านี้' : snap?.cfg.speedup > 1 ? `เดโมเร่งเวลา ${snap.cfg.speedup} เท่า · เกณฑ์ในระบบยังเป็นชั่วโมงจริง` : 'เวลาเดินปกติ · เปลี่ยนสถานการณ์ได้จากปุ่มด้านบน';
}
function renderMetrics(houses, known) {
  const req = queueHouses(houses), silent = houses.filter(h => h.state === 'silent'), offline = houses.filter(h => h.offline === true || h.state === 'offline');
  const waiting = req.filter(h => h.state !== 'accepted');
  const values = [
    ['รอทีมรับเรื่อง', waiting.length, 'sos', `${waiting.filter(h => h.req?.kind === 'auto_sos' && h.req.confirmed !== true).length} คำขอแทนรอยืนยัน`],
    ['บ้านเงียบ', silent.length, 'silent', `ติดเตียง ${silent.filter(h => h.bed === true).length} บ้าน`],
    ['ขาดการติดต่อ', offline.length, 'offline', 'ตรวจบ้านที่ต้องไปดู'],
    ['ทีมรับเรื่องแล้ว', req.length - waiting.length, 'accepted', 'รอช่วยเสร็จและปิดคำขอ']
  ];
  $('metrics').innerHTML = values.map(([label, value, state, foot]) => `<div class="metric state-${state}"><div class="metric-label"><span class="status-mark" aria-hidden="true">${statusIcon(state)}</span>${label}</div><div class="metric-value">${known ? value : '—'}<small>บ้าน</small></div><p class="metric-foot">${esc(known ? foot : 'รอข้อมูลจากตัวรับ')}</p></div>`).join('');
  $('nav-count').textContent = known ? String(waiting.length) : '—';
}
function renderQueue(houses) {
  const all = queueHouses(houses), term = $('queue-search').value.trim().toLocaleLowerCase('th'), filter = $('queue-filter').value;
  const list = all.filter(h => `${h.name} ${h.id}`.toLocaleLowerCase('th').includes(term) && (filter === 'all' || (filter === 'accepted') === (h.state === 'accepted')));
  const unavailable = mode === 'live' && !session.ready && (!!session.snapshot || session.status === 'stale');
  const unknown = session.status === 'stale' ? 'ไม่ทราบ (ขาดการเชื่อมต่อ)' : 'ไม่ทราบ (รอข้อมูลล่าสุดจากตัวรับ)';
  const emptyTitle = all.length ? 'ไม่พบคำขอที่ค้นหา' : unavailable ? unknown : session.snapshot ? 'ไม่มีคำขอเปิดอยู่' : 'ยังไม่มีข้อมูลคำขอ';
  const emptyHelp = unavailable ? all.length ? 'ผลค้นหาจากข้อมูลที่เก็บไว้ · คิวปัจจุบันอาจเปลี่ยนแล้ว' : 'คิวอาจเปลี่ยนแล้วระหว่างขาดข้อมูล · รอภาพรวมล่าสุดจากตัวรับ' : all.length ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'คำขอจากกล่องจะขึ้นที่นี่เมื่อตัวรับรายงาน';
  $('queue-count').textContent = session.ready ? String(all.length) : '—';
  $('queue').innerHTML = list.length ? list.map(h => `<li class="queue-item" data-queue-house="${h.id}"><div class="house-heading"><span class="queue-rank">${all.indexOf(h) + 1}</span><div class="house-title">${houseButton(h, '')}<p class="house-meta"><span class="mono">${h.id}</span><span>เปิดคำขอ ${stamp(h.req?.t_open)}</span></p></div>${status(h)}</div>${tags(h)}${actions(h)}</li>`).join('') : `<li>${empty(emptyTitle, emptyHelp)}</li>`;
}
function renderVisits(houses) {
  const list = visitHouses(houses); $('visits-count').textContent = session.snapshot ? String(list.length) : '—';
  $('visits').innerHTML = list.length ? list.map(h => `<article class="visit">${houseButton(h)}${status(h)}${tags(h)}<p>${h.got_warn === true ? 'กล่องรายงานว่าได้รับคำเตือนแล้ว' : h.got_warn === false ? 'ยังไม่มีการยืนยันว่าได้รับคำเตือนปัจจุบัน' : 'ไม่ทราบว่าได้รับคำเตือนหรือยัง'}</p><p>${esc(h.registry?.address || (mode === 'sim' ? 'พิกัดสาธิตบนแผนที่' : hasCoordinates(h.registry) ? 'มีพิกัดในทะเบียน' : 'ยังไม่ผูกพิกัดบ้าน'))}${h.req ? ' · มีคำขอเปิดอยู่ในคิว' : ''}</p><div class="actions"><button type="button" data-locate="${h.id}">ดูบนแผนที่</button></div></article>`).join('') : empty('ยังไม่มีบ้านที่ต้องไปดู', 'รายการนี้รวมบ้านเงียบและบ้านที่ขาดการติดต่อ');
}
function renderMap(houses) {
  geo.update();
  if (geo.map) return;
  const positioned = houses.filter(h => finite(h.x) && finite(h.y)), points = geo.filteredHouses(positioned);
  $('map-empty').hidden = points.length > 0;
  $('map-empty').textContent = positioned.length && !points.length ? 'ไม่พบบ้านที่ตรงกับการค้นหาหรือตัวกรอง' : 'ยังไม่มีพิกัดบ้านจากตัวรับ';
  const minX = Math.min(...points.map(h => h.x)), maxX = Math.max(...points.map(h => h.x));
  const minY = Math.min(...points.map(h => h.y)), maxY = Math.max(...points.map(h => h.y));
  const spanX = Math.max(80, maxX - minX), spanY = Math.max(60, maxY - minY);
  const scale = Math.min(480 / spanX, 250 / spanY);
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  $('map').innerHTML = points.map(h => {
    const x = 300 + (h.x - centerX) * scale, y = 165 + (h.y - centerY) * scale;
    const [, key] = stateInfo(h.state);
    const marker = `<rect class="pin-shape" x="-12" y="-12" width="24" height="24" rx="7"/><g class="map-status-glyph" transform="translate(-8,-8)">${statusIcon(key)}</g>`;
    const label = `<text class="pin-name" text-anchor="middle" y="33">${esc(h.name || h.id)}</text>`;
    const bedLabel = h.bed === true ? '<text class="pin-name" text-anchor="middle" y="47">ติดเตียง</text>' : '';
    return `<g class="map-house state-${key}${selected === h.id ? ' selected' : ''}${points.length > 25 ? ' dense' : ''}" data-state="${key}" data-house="${h.id}" tabindex="0" role="button" transform="translate(${x},${y})" aria-label="${esc(h.name || h.id)} ${esc(stateInfo(h.state)[0])} เปิดรายละเอียด"><title>${esc(h.name || h.id)} · ${esc(stateInfo(h.state)[0])}${h.bed ? ' · ติดเตียง' : ''}</title><rect class="house-outline" x="-19" y="-17" width="38" height="32" rx="2"/>${marker}${label}${bedLabel}</g>`;
  }).join('');
}
function renderHouses(houses) {
  const term = $('house-search').value.trim().toLocaleLowerCase('th'), filter = $('house-filter').value;
  const rows = houses.filter(h => `${h.name} ${h.id}`.toLocaleLowerCase('th').includes(term) && (filter === 'all' || h.state === filter));
  $('houses-count').textContent = session.snapshot ? `${rows.length} / ${houses.length} บ้าน` : houses.length ? `${houses.length} บ้านในทะเบียน · รอข้อมูลสถานะจากตัวรับ` : 'ยังไม่มีข้อมูลตัวรับ';
  $('houses-body').innerHTML = rows.length ? rows.map(h => `<tr><td>${esc(h.name || 'ไม่ระบุชื่อ')}<small class="mono">${h.id}</small><p class="location-note${hasCoordinates(h.registry) || mode === 'sim' ? '' : ' missing'}">${mode === 'sim' ? 'พิกัดสาธิต' : hasCoordinates(h.registry) ? h.registry.locationVerifiedAt ? 'ยืนยันพิกัดแล้ว' : 'มีพิกัด รอตรวจหน้างาน' : 'ยังไม่ผูกพิกัด'}${h.registryOnly ? ' · ยังไม่มีในข้อมูลตัวรับ' : ''}</p></td><td>${status(h)}</td><td>${tags(h)}</td><td>${h.last_seen === null ? 'ยังไม่เคยได้ยิน' : stamp(h.last_seen)}</td><td><button type="button" data-house="${h.id}">ดูรายละเอียด</button>${geo.available ? `<button type="button" data-edit-house="${h.id}">ทะเบียน / พิกัด</button>` : ''}</td></tr>`).join('') : `<tr><td colspan="5">${empty(houses.length ? 'ไม่พบบ้านที่ค้นหา' : 'ยังไม่มีบ้านในข้อมูลตัวรับ', houses.length ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'ตรวจทะเบียนบ้านในตัวรับ แล้วขอข้อมูลใหม่')}</td></tr>`;
}
function facts(entries) { return entries.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${value}</dd>`).join(''); }
function eventList(events) {
  return events.map(e => {
    const h = session.snapshot?.houses.find(h => h.id === e.id);
    return `<li>${stamp(e.t, false)}<span>${e.id === 0 ? 'ทุกบ้าน' : h ? houseButton(h) : `บ้านรหัส ${esc(e.id)}`}</span><span>${esc(EVENTS[e.ev] || 'เหตุการณ์ที่ไม่ทราบชนิด')}</span></li>`;
  }).join('');
}
function renderWarning(snap) {
  const w = snap?.warn, houses = snap?.houses || [];
  const cached = mode === 'live' && !session.ready;
  const context = cached ? session.status === 'stale' ? 'ข้อมูลก่อนขาดการเชื่อมต่อ' : 'ข้อมูลที่เก็บไว้ · รอข้อมูลสดจากตัวรับ' : '';
  const sending = w?.active === true ? 'กำลังส่งซ้ำ' : w?.active === false ? 'หยุดส่งซ้ำแล้ว' : 'ไม่ทราบสถานะการส่งซ้ำ';
  const counts = {
    heard: houses.filter(h => h.state === 'heard' && h.got_warn === true).length,
    received: houses.filter(h => h.got_warn === true).length,
    notReceived: houses.filter(h => h.got_warn === false).length,
    unknown: houses.filter(h => typeof h.got_warn !== 'boolean').length,
    silent: houses.filter(h => h.state === 'silent').length,
    waiting: houses.filter(h => h.state === 'warn').length
  };
  const known = counts.received + counts.notReceived;
  const receipt = !houses.length ? '—' : !known ? `ไม่ทราบ · รอข้อมูล ${counts.unknown} บ้าน` : `${counts.received} / ${houses.length} บ้าน${counts.unknown ? ` · ยังไม่ทราบ ${counts.unknown} บ้าน` : ''}`;
  const progress = houses.length && !counts.unknown ? `<progress class="progress" value="${counts.received}" max="${houses.length}" aria-label="กล่องที่รายงานว่าได้รับคำเตือน"></progress>` : `<p class="help" role="status">${houses.length ? `ข้อมูลผลรับคำเตือนยังไม่ครบ · ไม่ทราบ ${counts.unknown} บ้าน` : 'ยังไม่มีบ้านในข้อมูลตัวรับ จึงยังคำนวณความคืบหน้าไม่ได้'}</p>`;
  $('warning-summary').innerHTML = w ? `<div class="warning-strip"><div><strong>คำเตือน: ${esc(WHEN[w.when] || 'ไม่ทราบเวลา')} · ${esc(context || sending)}</strong><p>${!houses.length ? 'ยังไม่มีบ้านในข้อมูลตัวรับ' : counts.unknown ? `กล่องรายงานว่าได้รับ ${receipt}` : `ได้ยินแล้ว ${counts.heard} / ${houses.length} บ้าน`} · รอคนตอบ ${counts.waiting} · บ้านเงียบ ${counts.silent}</p></div><a href="#warning">ดูคำเตือน</a></div>` : '';
  $('current-warning').innerHTML = !w ? empty('ยังไม่มีคำเตือน', 'เมื่อส่งคำเตือนแล้ว ความคืบหน้าจะแสดงที่นี่') : `${context ? `<p class="help" role="status">${esc(context)} · สถานะการส่งซ้ำและผลตอบรับอาจเปลี่ยนแล้ว กรุณารอข้อมูลล่าสุด</p>` : ''}<dl class="facts">${facts([
    ['รหัสคำเตือน', esc(numberText(w.wid))], ['คาดว่าน้ำเข้าบ้าน', esc(WHEN[w.when] || 'ไม่ทราบ')],
    ['ระดับน้ำคาดการณ์', finite(w.lvl_cm) ? `${esc(w.lvl_cm)} ซม. (ผู้ส่งระบุ)` : 'ไม่ระบุ'],
    ['เริ่มเตือน', stamp(w.t)], ['รอบที่ตัวรับส่ง', esc(numberText(w.tx))], ['การส่งซ้ำ', cached ? 'ไม่ทราบสถานะปัจจุบัน' : sending],
    ['กล่องรายงานว่าได้รับ', receipt], ['กล่องยังไม่ยืนยันว่าได้รับ', !houses.length ? '—' : !known ? 'ไม่ทราบ' : `${counts.notReceived} บ้าน`],
    ['ผลรับคำเตือนที่ยังไม่ทราบ', `${counts.unknown} บ้าน`], ['สถานะได้ยินแล้ว', !houses.length ? '—' : !known ? 'ไม่ทราบ' : `${counts.heard} บ้าน${counts.unknown ? ' (เฉพาะบ้านที่มีข้อมูลรับคำเตือน)' : ''}`],
    ['รอคนตอบ', `${counts.waiting} บ้าน`], ['บ้านเงียบ', `${counts.silent} บ้าน (ติดเตียง ${houses.filter(h => h.state === 'silent' && h.bed === true).length})`],
    ['ขาดการติดต่อ', `${houses.filter(h => h.offline === true || h.state === 'offline').length} บ้าน`]
  ])}</dl>${progress}<p class="help">กล่องได้รับ ≠ คนได้ยิน · จำนวนสถานะได้ยินแล้วไม่นับบ้านที่เปลี่ยนไปเป็นคำขอช่วยเหลือ</p>${w.active ? commandButton('warn_stop', null, 'หยุดส่งซ้ำ') : ''}<p class="command-status" role="status">${esc(feedback())}</p>`;
}
function renderSystem(snap) {
  const gateway = snap?.gw || {}, cfg = snap?.cfg || {};
  $('system-info').innerHTML = facts([
    ['ชื่อตัวรับ', esc(gateway.name)], ['ช่องทาง', esc(gateway.link)], ['รูปข้อมูล', snap ? 'v2 · snap / hb / res' : '—'],
    ['รุ่นข้อมูล (rev)', esc(numberText(snap?.rev))], ['เวลาตัวรับหลังเปิดเครื่อง', finite(session.estimatedNow) ? `${Math.floor(session.estimatedNow)} วินาที` : '—'],
    ['เวลาออกอากาศต่อชั่วโมง', `${esc(numberText(session.airPct ?? gateway.air_pct))}${finite(session.airPct ?? gateway.air_pct) ? ' %' : ''}`],
    ['ข้อมูลล่าสุด', session.lastSeen === null ? '—' : esc(dateFormat.format(session.lastSeen))]
  ]);
  const config = [
    ['silent_h', 'ไม่ตอบคำเตือน', 'ชม.'], ['auto_h', 'น้ำถึงสายวัดก่อนขอแทน', 'ชม.'], ['probe_cm', 'ความสูงติดตั้งสายวัด', 'ซม. (ไม่ใช่ความลึกที่วัดได้)'],
    ['water_s', 'น้ำแตะสายต่อเนื่อง', 'วินาที'], ['repeat_min', 'กล่องพูดเตือนซ้ำ', 'นาที'], ['hold_s', 'กดแดงค้าง', 'วินาที'],
    ['safe_hold_s', 'กดเขียวค้าง', 'วินาที'], ['hb_h', 'กล่องรายงานยังอยู่ปกติ', 'ชม.'], ['offline_h', 'เกณฑ์ขาดการติดต่อปัจจุบัน', 'ชม.'],
    ['low_batt_v', 'เกณฑ์ถ่านอ่อน', 'V'], ['link_hb_s', 'Heartbeat USB', 'วินาที'], ['speedup', 'ความเร็วเวลาในเดโม', 'เท่า']
  ];
  $('config-info').innerHTML = facts(config.filter(([key]) => key !== 'speedup' || finite(cfg[key])).map(([key, label, unit]) => [label, `${esc(numberText(cfg[key]))} ${finite(cfg[key]) ? esc(unit) : ''}`]));
}
function renderDetail() {
  if (!$('house-detail').open) return;
  const h = displayHouses().find(h => h.id === selected);
  if (!h) { $('detail-title').textContent = 'ไม่มีบ้านนี้ในข้อมูลล่าสุด'; $('detail-body').innerHTML = empty('รอข้อมูลจากตัวรับ', 'ตัวรับอาจเริ่มใหม่หรือทะเบียนบ้านเปลี่ยน'); return; }
  $('detail-title').textContent = `${h.name || 'บ้านไม่ระบุชื่อ'} · ${h.id}`;
  const location = positionHouses([h], geo.registry, mode)[0], r = h.registry;
  $('detail-body').innerHTML = `${status(h)}${tags(h)}<div class="actions"><button type="button" data-locate="${h.id}">ดูตำแหน่งบนแผนที่</button>${geo.available ? `<button type="button" data-edit-house="${h.id}">แก้ไขทะเบียน / พิกัด</button>` : ''}</div>${r ? `<div class="detail-contact"><strong>${esc(r.name || h.name)}</strong><p>${esc(r.address || 'ยังไม่ระบุที่อยู่')}</p><p>${esc([r.contact, r.phone].filter(Boolean).join(' · ') || 'ยังไม่มีข้อมูลติดต่อ')}</p>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}</div>` : ''}${finite(h.req?.cancel_t) ? '<p class="detail-explanation">กล่องที่บ้านเป็นไฟเขียวแล้ว แต่คำขอบ้านติดเตียงยังเปิดอยู่ ทีมต้องโทรตรวจสอบก่อนกด “โทรแล้ว ปลอดภัย” หรือดำเนินการช่วยเหลือต่อ</p>' : ''}${actions(h)}
    <dl class="facts">${facts([
      ['สถานะตั้งแต่', stamp(h.t_state)], ['พิกัดชุมชน x, y', `${numberText(h.x)}, ${numberText(h.y)} เมตร`], ['ติดเตียง', booleanText(h.bed)],
      ['พิกัดบนแผนที่', hasCoordinates(location) ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${mode === 'sim' ? ' (สาธิต)' : ''}` : 'ยังไม่ผูกพิกัด'],
      ['ได้รับคำเตือนปัจจุบัน', booleanText(h.got_warn)], ['ได้ยินกล่องล่าสุด', h.last_seen === null ? 'ยังไม่เคยได้ยินกล่องนี้' : stamp(h.last_seen)],
      ['ขาดการติดต่อ', booleanText(h.offline)], ['แรงดันถ่าน', `${numberText(h.batt_v)} ${finite(h.batt_v) ? 'V' : ''}`], ['ถ่านอ่อน', booleanText(h.low_batt)],
      ['น้ำถึงสายวัด', booleanText(h.probe_wet)], ['เริ่มถึงสายวัด', stamp(h.t_wet)],
      ['RSSI (แสดงเพื่อดูสัญญาณ)', `${numberText(h.rssi)} ${finite(h.rssi) ? 'dBm' : ''}`], ['SNR', `${numberText(h.snr)} ${finite(h.snr) ? 'dB' : ''}`], ['ข้อความล่าสุดถึงในครั้งที่', numberText(h.try)]
    ])}</dl>${h.req ? `<h3>คำขอที่เปิดอยู่</h3><dl class="facts">${facts([
      ['เลขคำขอ', esc(numberText(h.req.no))], ['ชนิดคำขอ', h.req.kind === 'auto_sos' ? 'กล่องขอแทน' : h.req.kind === 'sos' ? 'บ้านกดแดง' : 'ไม่ทราบ'],
      ['เปิดเมื่อ', stamp(h.req.t_open)], ['ยืนยันคำขอแทนแล้ว', booleanText(h.req.confirmed)], ['ทีมรับเรื่องเมื่อ', stamp(h.req.t_accept)],
      ['กล่องได้รับคำสั่งรับเรื่อง', booleanText(h.req.delivered)], ['บ้านขอยกเลิกเมื่อ', stamp(h.req.cancel_t)], ['กดขอซ้ำ', `${numberText(h.req.dup)} ครั้ง`]
    ])}</dl>` : `<p class="help">${h.requestIncomplete ? 'ตัวรับรายงานสถานะช่วยเหลือ แต่ข้อมูลคำขอยังไม่ครบ' : 'ไม่มีคำขอเปิดอยู่'}</p>`}<h3>เหตุการณ์ของบ้านนี้</h3><ol class="event-list">${eventList((session.snapshot?.events || []).filter(e => e.id === h.id)) || `<li>${session.snapshot ? 'ไม่มีเหตุการณ์ใน 50 รายการล่าสุด' : 'ยังไม่มีประวัติจากตัวรับ'}</li>`}</ol>`;
}
function renderBox() {
  if (!demoBox) return;
  $('box-light').textContent = `${demoBox.id ? `บ้านรหัส ${demoBox.id} · ไฟ: ` : ''}${demoBox.light}`;
  $('box-voice').textContent = demoBox.voice;
}
function render() {
  const snap = session.snapshot, houses = displayHouses();
  const focused = document.activeElement;
  const focusRoot = focused?.closest('#queue, #visits, #houses-body, #detail-body, #map, #geographic-map');
  const focusAttrs = ['data-cmd', 'data-id', 'data-house', 'data-locate', 'data-resync', 'data-edit-house', 'data-home-id'];
  const focusSelector = focusRoot ? focusAttrs.filter(name => focused.hasAttribute(name)).map(name => `[${name}="${CSS.escape(focused.getAttribute(name))}"]`).join('') : '';
  const focusRow = focused?.closest('[data-queue-house]')?.getAttribute('data-queue-house');
  const scroll = $('queue').scrollTop, detailScroll = $('house-detail').scrollTop;
  renderChrome(); renderMetrics(houses, !!snap); renderQueue(houses); renderVisits(houses); renderMap(houses);
  renderHouses(houses); renderWarning(snap); renderSystem(snap); renderDetail();
  $('events-list').innerHTML = eventList(snap?.events || []) || `<li>${empty('ยังไม่มีเหตุการณ์', 'แสดงเฉพาะเหตุการณ์ล่าสุดที่ตัวรับส่งมา')}</li>`;
  const previous = $('demo-house').value;
  $('demo-house').innerHTML = houses.map(h => `<option value="${h.id}">${esc(h.name || h.id)}${h.bed ? ' (ติดเตียง)' : ''}</option>`).join('');
  if (houses.some(h => String(h.id) === previous)) $('demo-house').value = previous;
  renderChrome();
  $('queue').scrollTop = scroll; $('house-detail').scrollTop = detailScroll;
  if (focusRoot && focusSelector && !document.contains(focused)) {
    const scope = focusRow ? focusRoot.querySelector(`[data-queue-house="${CSS.escape(focusRow)}"]`) : focusRoot;
    const replacement = scope?.querySelector(focusSelector) || (focused.dataset.id ? scope?.querySelector(`[data-house="${CSS.escape(focused.dataset.id)}"]`) : null);
    if (replacement && !replacement.disabled) replacement.focus({preventScroll: true});
    else { focusRoot.setAttribute('tabindex', '-1'); focusRoot.focus({preventScroll: true}); }
  }
}

function setView() {
  geo.expand(false);
  const name = location.hash.slice(1);
  view = ['overview', 'houses', 'warning', 'events', 'system', 'demo'].includes(name) ? name : 'overview';
  $('breadcrumb').textContent = {overview: 'ภาพรวม', houses: 'บ้านทั้งหมด', warning: 'ส่งคำเตือน', events: 'บันทึกเหตุการณ์', system: 'สถานะระบบ', demo: 'เครื่องมือทดลอง'}[view];
  for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== `view-${view}`;
  for (const link of document.querySelectorAll('[data-view]')) {
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  armed = null; scheduleRender();
}
async function sendWithConfirmation(cmd, fields = {}) {
  const key = `${cmd}:${fields.id ?? 'warning'}`;
  if (armed?.key !== key || armed.until <= Date.now()) {
    armed = {key, until: Date.now() + 7000}; scheduleRender(); return;
  }
  armed = null;
  try { await session.command(cmd, fields); }
  catch (e) { session.errors.set(commandKey(fields.id), e.message); scheduleRender(); }
}
function openHouse(id) {
  geo.expand(false);
  selected = id; geo.update(); renderDetail();
  if (!$('house-detail').open) { $('house-detail').showModal(); renderDetail(); }
}
function editRegistry(id = null) {
  if (!geo.available) { uiNotice = 'เปิดด้วย Start-Dashboard.cmd เพื่อบันทึกทะเบียนและใช้แผนที่ในเครื่อง'; scheduleRender(); return; }
  $('house-detail').close(); geo.expand(false);
  const h = displayHouses().find(h => h.id === id), r = geo.record(id) || {};
  registryEdit++; $('save-registry').disabled = false;
  $('registry-form').reset(); $('registry-error').textContent = '';
  $('registry-id').value = id ?? ''; $('registry-id').readOnly = id !== null;
  $('registry-name').value = r.name || h?.name || '';
  for (const field of ['address', 'contact', 'phone', 'notes']) $(`registry-${field}`).value = r[field] || '';
  $('registry-lat').value = finite(r.lat) ? r.lat : ''; $('registry-lng').value = finite(r.lng) ? r.lng : '';
  $('registry-source').value = r.locationSource || 'manual'; $('registry-verified').checked = !!r.locationVerifiedAt; $('registry-verifier').value = r.locationVerifiedBy || '';
  $('registry-dialog').showModal();
  geo.openPicker(r);
}
$('new-registry-home').addEventListener('click', () => editRegistry());
$('close-registry').addEventListener('click', () => $('registry-dialog').close());
$('registry-dialog').addEventListener('close', () => { registryEdit++; geo.picker?.destroy(); geo.picker = null; });
for (const field of ['registry-lat', 'registry-lng']) $(field).addEventListener('input', () => {
  $('registry-source').value = 'manual'; $('registry-verified').checked = false;
  const lat = $('registry-lat').value, lng = $('registry-lng').value;
  if (lat !== '' && lng !== '' && hasCoordinates({lat: Number(lat), lng: Number(lng)})) geo.picker?.setPick({lat: Number(lat), lng: Number(lng), pan: false});
});
$('registry-form').addEventListener('submit', async event => {
  event.preventDefault(); $('save-registry').disabled = true; $('registry-error').textContent = '';
  const edit = registryEdit, generation = geo.generation, saveMode = mode;
  const current = () => edit === registryEdit && generation === geo.generation && saveMode === mode && $('registry-dialog').open;
  const value = {name: $('registry-name').value, address: $('registry-address').value, contact: $('registry-contact').value, phone: $('registry-phone').value, notes: $('registry-notes').value,
    lat: $('registry-lat').value === '' ? null : Number($('registry-lat').value), lng: $('registry-lng').value === '' ? null : Number($('registry-lng').value),
    locationSource: ['manual', 'map', 'gps'].includes($('registry-source').value) ? $('registry-source').value : 'manual',
    locationVerified: $('registry-verified').checked, locationVerifiedBy: $('registry-verifier').value};
  try { await geo.save(Number($('registry-id').value), value); if (current()) { $('registry-dialog').close(); log('บันทึกทะเบียนบ้านและพิกัดในเครื่องแล้ว'); } }
  catch (error) { if (current()) $('registry-error').textContent = error.message; }
  finally { if (current()) $('save-registry').disabled = false; }
});
$('export-registry').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({format: 'floodlink-registry-export-v1', mode, exportedAt: new Date().toISOString(), homes: geo.registry}, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `floodlink-registry-${mode}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('click', event => {
  if (event.target.closest('[data-resync]')) { session.hello(true); return; }
  const edit = event.target.closest('[data-edit-house]'); if (edit) { editRegistry(Number(edit.dataset.editHouse)); return; }
  const locate = event.target.closest('[data-locate]');
  if (locate) { $('house-detail').close(); location.hash = 'overview'; requestAnimationFrame(() => geo.focus(Number(locate.dataset.locate))); return; }
  const house = event.target.closest('[data-house]');
  if (house) { openHouse(Number(house.dataset.house)); return; }
  const action = event.target.closest('[data-cmd]');
  if (action && !action.disabled) {
    const fields = action.dataset.id ? {id: Number(action.dataset.id)} : action.dataset.cmd === 'warn_stop' ? {wid: session.snapshot?.warn?.wid} : {};
    sendWithConfirmation(action.dataset.cmd, fields);
  }
});
$('map').addEventListener('keydown', event => { const h = event.target.closest('[data-house]'); if (h && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openHouse(Number(h.dataset.house)); } });
$('close-detail').addEventListener('click', () => { $('house-detail').close(); armed = null; });
$('house-detail').addEventListener('close', () => { armed = null; });
$('map-reset').addEventListener('click', () => { selected = null; geo.reset(); renderMap(displayHouses()); });
for (const id of ['queue-search', 'queue-filter', 'house-search', 'house-filter']) $(id).addEventListener(id.endsWith('search') ? 'input' : 'change', scheduleRender);
$('warning-form').addEventListener('submit', event => {
  event.preventDefault(); if (!session.ready) return;
  const value = $('warning-level').value.trim();
  sendWithConfirmation('warn', {when: new FormData(event.target).get('when'), lvl_cm: value === '' ? null : Number(value)});
});
function warningVoice() { const when = new FormData($('warning-form')).get('when'); $('warning-voice').textContent = `เตือนภัยน้ำท่วม น้ำจะเข้าบ้านภายใน ${WHEN[when]} ยกของขึ้นที่สูง พาคนป่วยขึ้นชั้นบน ได้ยินแล้วกดปุ่มเขียว`; armed = null; scheduleRender(); }
$('warning-form').addEventListener('input', warningVoice);
$('refresh').addEventListener('click', () => session.hello(true));
$('projector').addEventListener('click', () => { const active = document.body.classList.toggle('projector'); $('projector').setAttribute('aria-pressed', String(active)); });
$('connect').addEventListener('click', async () => {
  if (!navigator.serial) { uiNotice = 'ต่อตัวรับได้เฉพาะ Chrome หรือ Edge บนคอมพิวเตอร์ · ยังใช้โหมดทดลองได้'; scheduleRender(); return; }
  $('connect').disabled = true;
  try {
    if (await serial.connect()) {
      sim.stop(); mode = 'live'; demoBox = null; store('floodlink-v2-mode', 'live'); uiNotice = '';
      session.reset(); session.open(); log('เปิด USB ที่ 115200 แล้ว ส่ง hello ขอข้อมูล v2');
    }
  } catch (e) { uiNotice = e.name === 'NotFoundError' ? 'ยังไม่ได้เลือกพอร์ต กดเชื่อมต่อเมื่อตัวรับพร้อม' : e.message; log(uiNotice); }
  finally { $('connect').disabled = false; scheduleRender(); }
});
$('disconnect').addEventListener('click', async () => { await serial.close(); session.disconnect(); log('ตัดการเชื่อมต่อ USB โดยผู้ใช้'); });
function startSim(scenario = 'overview', count = 12) {
  mode = 'sim'; store('floodlink-v2-mode', 'sim'); uiNotice = ''; armed = null; demoBox = null;
  session.reset(); sim.start(scenario, count); log('ใช้ข้อมูลทดลองในเครื่อง');
}
$('use-sim').addEventListener('click', async () => { await serial.close(); startSim(); });
for (const button of document.querySelectorAll('[data-scenario]')) button.addEventListener('click', () => { if (mode === 'sim') startSim(button.dataset.scenario, button.dataset.scenario === 'stress' ? 60 : 12); });
$('auto-demo').addEventListener('click', () => { if (mode !== 'sim') return; session.reset(); sim.auto((cmd, fields) => session.command(cmd, fields).catch(e => log(e.message))); location.hash = 'overview'; });
$('demo-house').addEventListener('change', () => { const h = session.snapshot?.houses.find(h => h.id === Number($('demo-house').value)); if (h) sim.box(h); renderChrome(); });
for (const button of document.querySelectorAll('[data-box]')) {
  const perform = () => { if (mode === 'sim') sim.press(Number($('demo-house').value), button.dataset.box); };
  if (!button.dataset.hold) { button.addEventListener('click', perform); continue; }
  let timer = null, original = button.textContent, completed = false;
  const stop = () => { clearTimeout(timer); timer = null; button.classList.remove('holding'); button.textContent = original; };
  const begin = () => {
    if (button.disabled || timer) return;
    completed = false; button.classList.add('holding'); button.textContent = 'กดค้างต่อ…';
    timer = setTimeout(() => { if (!completed) { completed = true; perform(); } stop(); }, 2000);
  };
  button.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    try { button.setPointerCapture(e.pointerId); } catch { /* A canceled/synthetic pointer may no longer be active. */ }
    begin();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) button.addEventListener(type, stop);
  button.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) begin(); } });
  button.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop(); } });
  button.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
}

$('house-filter').insertAdjacentHTML('beforeend', Object.entries(STATES).map(([key, [label]]) => `<option value="${key}">${esc(label)}</option>`).join(''));
const navIcons = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  houses: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
  warning: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 3V1"/>',
  events: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  system: '<path d="M12 21V8m0 0-4-4m4 4 4-4M8 4H5V1m11 3h3V1M8 16H4v-4m12 1h4v-3"/><circle cx="12" cy="21" r="1"/>',
  demo: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4m-2-14 5 3-5 3Z"/>'
};
for (const link of document.querySelectorAll('[data-view]')) link.querySelector('span').innerHTML = `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${navIcons[link.dataset.view]}</svg>`;
$('map-legend').innerHTML = Object.keys(STATES).map(key => status({state: key})).join('');
$('state-reference').innerHTML = Object.entries(STATES).map(([key]) => `<div class="state-reference-item">${status({state: key})}<p class="state-code mono">${key}</p><p class="state-help">${esc(STATUS_HELP[key])}</p></div>`).join('');
window.addEventListener('hashchange', setView);
window.addEventListener('pagehide', () => { sim.stop(); serial.destroy(); geo.destroy(); });
setInterval(() => { session.tick(); if (armed && armed.until <= Date.now()) { armed = null; scheduleRender(); } }, 250);
warningVoice(); setView();
const params = new URLSearchParams(location.search);
if (params.get('demo') === 'auto') { startSim('demo'); sim.auto((cmd, fields) => session.command(cmd, fields).catch(e => log(e.message))); }
else if (params.get('mode') === 'live' || store('floodlink-v2-mode') === 'live') {
  mode = 'live'; session.reset();
  if (!navigator.serial) { startSim(); uiNotice = 'ต่อตัวรับได้เฉพาะ Chrome หรือ Edge บนคอมพิวเตอร์'; scheduleRender(); }
  else serial.reconnect().then(connected => { if (!connected) { uiNotice = 'เลือกตัวรับด้วยปุ่มเชื่อมต่อ USB · บอร์ดอาจแสดงชื่อ USB Serial Device (COMx)'; scheduleRender(); } }).catch(e => { uiNotice = e.message; scheduleRender(); });
} else startSim();
