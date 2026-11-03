// A3: ป้อนบรรทัดจากตัวรับเข้าแดชบอร์ดจริงผ่าน Web Serial จำลอง แล้วเช็กว่าแดชบอร์ดแสดงผลถูก + ถ่ายภาพ
// ตัวรับ = firmware/.pio/build/receiver_host/program.exe (โค้ด common/gateway ตัวเดียวกับบอร์ด + กล่องบ้านจำลอง)
// ใช้: cd firmware && pio run -e receiver_host && node host/dashboard-test.mjs
// ผล: dashboard/_shots/a3-live/*.png · docs/test-logs/a3-dashboard-serial.log
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from '../../tools/cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXE = path.join(ROOT, 'firmware/.pio/build/receiver_host/program.exe');
const SHOTS = path.join(ROOT, 'dashboard/_shots/a3-live');
const LOG = path.join(ROOT, 'docs/test-logs/a3-dashboard-serial.log');
const PORT = 8010;
const URL = `http://127.0.0.1:${PORT}/dashboard/?live=1`;
fs.mkdirSync(SHOTS, { recursive: true });

const transcript = [];
const results = [];
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); console.log(results.at(-1)); };

// ---- เซิร์ฟเวอร์ (ใช้ของเดิมถ้าเปิดอยู่)
let server = null;
try { await fetch(`http://127.0.0.1:${PORT}/`); } catch {
  server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${PORT}/`); break; } catch { await sleep(250); } }
}

// ---- ตัวรับจำลอง
const rx = spawn(EXE, [], { stdio: ['pipe', 'pipe', 'inherit'] });
let rxBuf = '';
const toWeb = [];          // บรรทัดที่รอส่งเข้าหน้าเว็บ
const jsonLines = [];      // ทุกบรรทัด JSON จากตัวรับ
let unplug = false;        // จำลองตัวรับค้าง: ไม่ส่งอะไรเข้าหน้าเว็บ
rx.stdout.on('data', (d) => {
  rxBuf += d.toString('utf8');
  let i;
  while ((i = rxBuf.indexOf('\n')) >= 0) {
    const line = rxBuf.slice(0, i); rxBuf = rxBuf.slice(i + 1);
    transcript.push(`${stamp()}  RX→web  ${line.length > 400 ? line.slice(0, 400) + ' …(' + line.length + ' chars)' : line}`);
    if (line.startsWith('{')) jsonLines.push(line);
    if (!unplug) toWeb.push(line + '\n');
  }
});
const toRx = (line) => { transcript.push(`${stamp()}  test→rx ${line}`); rx.stdin.write(line + '\n'); };

// ---- Web Serial จำลอง (ฉีดก่อน app.js โหลด) — หน้าเว็บเห็นเป็นพอร์ต USB ของ ESP32-C3 ที่เคยอนุญาตแล้ว
const FAKE_SERIAL = `(() => {
  let ctrl; const enc = new TextEncoder(), dec = new TextDecoder();
  window.__txq = [];
  const port = {
    readable: new ReadableStream({ start(c) { ctrl = c; } }),
    writable: new WritableStream({ write(chunk) { window.__txq.push(dec.decode(chunk)); } }),
    async open() {}, async close() {}, getInfo() { return { usbVendorId: 0x303A }; },
  };
  window.__serialPush = (s) => { try { ctrl.enqueue(enc.encode(s)); } catch (e) {} };
  const serial = new EventTarget();
  serial.getPorts = async () => [port];
  serial.requestPort = async () => port;
  Object.defineProperty(Navigator.prototype, 'serial', { get() { return serial; }, configurable: true });
})();`;

const api = await launch({ w: 1280, h: 860 });
await api.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE_SERIAL });

let pumping = true;
const pump = (async () => {
  while (pumping) {
    try {
      const out = await api.ev('window.__txq ? window.__txq.splice(0) : []');
      for (const chunk of out || []) for (const l of chunk.split('\n')) if (l) { transcript.push(`${stamp()}  web→rx  ${l}`); rx.stdin.write(l + '\n'); }
      if (toWeb.length) { const s = toWeb.splice(0).join(''); await api.ev(`window.__serialPush && window.__serialPush(${JSON.stringify(s)})`); }
    } catch { /* หน้ากำลังโหลด */ }
    await sleep(80);
  }
})();

const page = (expr) => api.ev(expr);
// app.js ห่อด้วยฟังก์ชัน (อ่านตัวแปรข้างในไม่ได้) → เช็ก 2 ทาง: บรรทัด snap ล่าสุดที่ตัวรับส่งเข้าสาย + สิ่งที่ขึ้นบนหน้าจอจริง
const lastSnap = () => { for (let i = jsonLines.length - 1; i >= 0; i--) if (jsonLines[i].startsWith('{"t":"snap"')) return JSON.parse(jsonLines[i]); return null; };
const house = () => { const s = lastSnap(); return s ? s.houses.find((h) => h.id === 1001) : null; };
const onScreen = (text) => page(`document.body.innerText.includes(${JSON.stringify(text)})`);
async function waitFor(cond, ms = 15000) {
  for (let t = 0; t < ms; t += 200) { try { if (await cond()) return true; } catch { /* ยังไม่มีข้อมูล */ } await sleep(200); }
  return false;
}
const shot = async (name) => { await api.shot(path.join(SHOTS, name)); transcript.push(`${stamp()}  [ภาพ] ${name}`); };

try {
  await api.goto(URL, 1500);

  // 1) ต่อแล้ว: hello → snap → แดชบอร์ดอยู่โหมดสด เห็นบ้านทดลอง
  check('เปิดพอร์ตแล้วส่ง hello', await waitFor(() => transcript.some((l) => l.includes('web→rx') && l.includes('"cmd":"hello"'))));
  check('ได้ snap แล้วป้ายบนจอเป็น "เชื่อมต่อตัวรับอยู่" (ไม่ใช่จำลอง)', await waitFor(() => page(`document.querySelector('#modePill').dataset.m === 'live'`)) && await onScreen('เชื่อมต่อตัวรับอยู่'));
  check('บ้าน 1001 ขึ้นบนแผนที่ + แผงกล่อง "กล่องที่บ้านทดลอง 1" (ยังไม่เคยได้ยิน: last_seen=null)', await waitFor(() => page(`!!document.querySelector('#h1001')`)) && await waitFor(() => onScreen('กล่องที่บ้านทดลอง 1'), 3000) && house().last_seen === null);
  await shot('01-connected.png');

  // 2) กดแดงค้างที่กล่อง → SOS → คิวคำขอสีแดง
  toRx('box red long');
  check('กล่องกดแดง → ตัวรับส่ง state sos', await waitFor(() => house().state === 'sos'));
  check('จอขึ้นคำขอ "คนในบ้านกดปุ่มแดงขอความช่วยเหลือ" + ปุ่มรับเรื่อง', await waitFor(() => page(`!!document.querySelector('[data-act="accept"][data-id="1001"]')`)) && await onScreen('คนในบ้านกดปุ่มแดงขอความช่วยเหลือ'));
  await shot('02-sos.png');

  // 3) ทีมกด "รับเรื่อง" บนแดชบอร์ด → accept → ACCEPTED ถึงกล่อง → BOX_ACK → delivered
  await api.clickSel('[data-act="accept"][data-id="1001"]');
  check('กดรับเรื่อง → คำสั่ง accept ออกจากเว็บ + ตัวรับตอบ res ok', await waitFor(() => transcript.some((l) => l.includes('"cmd":"accept"')) && jsonLines.some((l) => l.includes('"t":"res","rid":2,"ok":true'))));
  check('กล่องได้ ACCEPTED แล้วตอบ BOX_ACK (delivered=true)', await waitFor(() => house().state === 'accepted' && house().req.delivered === true));
  check('กล่องจำลองเปลี่ยนเป็นสีเหลือง (accepted)', transcript.some((l) => l.includes('# BOX state accepted')));
  check('จอขึ้น "ทีมรับเรื่องแล้ว เรือกำลังไป" + ปุ่มช่วยเสร็จ', await waitFor(() => onScreen('ทีมรับเรื่องแล้ว เรือกำลังไป')) && await page(`!!document.querySelector('[data-act="done"][data-id="1001"]')`));
  await shot('03-accepted.png');

  // 4) ช่วยเสร็จ
  await api.clickSel('[data-act="done"][data-id="1001"]');
  check('กดช่วยเสร็จ → done และคำขอปิด', await waitFor(() => house().state === 'done' && house().req === null));
  check('จอไม่มีปุ่มคำขอของบ้าน 1001 แล้ว', await waitFor(() => page(`!document.querySelector('[data-id="1001"][data-act]')`)));
  check('กล่องจำลองได้ DONE (เขียว)', await waitFor(() => transcript.some((l) => l.includes('# BOX state done'))));
  await shot('04-done.png');

  // 5) ส่งคำเตือนจากหน้า "ส่งคำเตือน" → กล่องได้ WARN → กดเขียว → heard
  await api.clickSel('[data-view="sender"]');
  await sleep(400);
  await api.clickSel('input[name=when][value=tonight]');
  await api.clickSel('#sendWarn');
  check('ส่งคำเตือน → ตัวรับส่ง warn คืนนี้ + บ้านเป็น warn', await waitFor(() => lastSnap().warn && lastSnap().warn.when === 'tonight' && house().state === 'warn'));
  check('กล่องได้ WARN (ไฟส้ม)', await waitFor(() => transcript.some((l) => l.includes('# BOX state warn'))));
  await sleep(600);
  await shot('05-warn-sent.png');
  toRx('box green short');
  check('กล่องกดเขียว → heard + got_warn', await waitFor(() => house().state === 'heard' && house().got_warn === true));
  await api.clickSel('[data-view="map"]');
  check('จอแสดงสถานะ "ได้ยินแล้ว"', await waitFor(() => onScreen('ได้ยินแล้ว')));
  await sleep(600);
  await shot('06-heard.png');

  // 6) ถ่านอ่อน + น้ำขึ้นถึงสายวัด (ต้องแตะน้ำต่อเนื่อง 30 วิ · กล่องอ่านสายทุก 60 วิ)
  toRx('box batt 3.80');
  toRx('box wet 1');
  check('ถ่านอ่อน → low_batt', await waitFor(() => house().low_batt === true, 20000));
  check('น้ำแตะต่อเนื่อง 30 วิ → probe_wet', await waitFor(() => house().probe_wet === true, 100000));
  await sleep(800);
  await shot('07-lowbatt-wet.png');

  // 7) ตัวรับเงียบ (ไม่มี hb) → ~6 วิ แถบขาดการเชื่อมต่อ
  unplug = true;
  check('ไม่มี hb 3 รอบ → แถบ "ขาดการเชื่อมต่อกับตัวรับ"', await waitFor(() => onScreen('ขาดการเชื่อมต่อกับตัวรับ'), 12000));
  await shot('08-link-lost.png');
  unplug = false;
  check('ตัวรับกลับมา → แถบหายเอง', await waitFor(async () => !(await onScreen('ขาดการเชื่อมต่อกับตัวรับ')), 8000));

  // ---- เช็กรูปแบบทุกบรรทัด JSON ตาม data-contract ข้อ 5
  const SNAP_KEYS = ['t', 'v', 'rev', 'now', 'gw', 'cfg', 'warn', 'houses', 'events'];
  const HOUSE_KEYS = ['id', 'name', 'x', 'y', 'bed', 'state', 't_state', 'got_warn', 'last_seen', 'offline', 'rssi', 'snr', 'batt_v', 'low_batt', 'probe_wet', 't_wet', 'try', 'req'];
  const STATES = ['idle', 'warn', 'heard', 'silent', 'sos', 'accepted', 'done', 'auto_sos', 'safe', 'offline'];
  let bad = 0, snaps = 0, hbs = 0, ress = 0;
  for (const l of jsonLines) {
    let j; try { j = JSON.parse(l); } catch { bad++; continue; }
    if (j.t === 'snap') {
      snaps++;
      if (!SNAP_KEYS.every((k) => k in j) || j.v !== 2) bad++;
      for (const h of j.houses) if (!HOUSE_KEYS.every((k) => k in h) || !STATES.includes(h.state)) bad++;
    } else if (j.t === 'hb') { hbs++; if (!('rev' in j && 'now' in j && 'air_pct' in j)) bad++; }
    else if (j.t === 'res') { ress++; if (!('rid' in j && 'ok' in j)) bad++; }
    else bad++;
  }
  check(`ทุกบรรทัด JSON แปลงได้และมีช่องครบตาม contract (snap ${snaps} · hb ${hbs} · res ${ress})`, bad === 0, bad ? `${bad} บรรทัดผิด` : '');
  const errs = api.errors();
  check('console ไม่มี error', errs.length === 0, errs.join(' | '));
  const ext = api.external();
  check('ไม่โหลดอะไรจากนอกเครื่อง', ext.length === 0, ext.join(' '));
} catch (e) {
  check('สคริปต์ทำงานจนจบ', false, String(e && e.stack || e));
} finally {
  pumping = false; await pump;
  await api.close();
  rx.stdin.end(); rx.kill();
  if (server) server.kill();
  const pass = results.every((r) => r.startsWith('PASS'));
  fs.writeFileSync(LOG, [
    `# A3 แดชบอร์ดอ่านบรรทัดจากตัวรับ — ${new Date().toISOString()}`,
    '# ตัวรับ = firmware/host (common/gateway ตัวเดียวกับบอร์ด) + กล่องบ้านจำลอง (common/house_logic) ต่อกันด้วยวิทยุจำลอง',
    '# RSSI/SNR ในบรรทัดเหล่านี้เป็นค่าสมมติ (-70 / 9.0) ไม่ใช่ผลวัด · ภาพอยู่ที่ dashboard/_shots/a3-live/',
    '', '## ผล', ...results, '', `สรุป: ${pass ? 'ผ่านทุกข้อ' : 'มีข้อไม่ผ่าน'} (${results.filter((r) => r.startsWith('PASS')).length}/${results.length})`,
    '', '## บรรทัดที่วิ่งผ่านสาย (เวลา วิ)', ...transcript, '',
  ].join('\n'));
  console.log(pass ? 'ALL PASS' : 'SOME FAILED', '→', LOG);
  process.exit(pass ? 0 : 1);
}
