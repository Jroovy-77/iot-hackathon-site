// ตัวช่วยคุม Edge/Chrome แบบไม่เปิดหน้าต่าง ผ่าน DevTools Protocol (ไม่ต้องลงอะไรเพิ่ม ใช้ Node 22+)
// ใช้ร่วมกันทุกทีม: import { launch } from './cdp.mjs'
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  if (process.env.BROWSER) return process.env.BROWSER;
  const c = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ];
  const hit = c.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('ไม่พบ Edge/Chrome ตั้งค่า BROWSER=<path> ก่อน');
  return hit;
}

export async function launch({ w = 1280, h = 720, dpr = 1, mobile = false, touch = false, reduced = false, extra = [] } = {}) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-prof-'));
  const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', ...extra, 'about:blank'];
  if (process.platform === 'linux') args.unshift('--no-sandbox');
  const browser = spawn(findBrowser(), args, { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 60 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(300); }
  }
  if (!targets) throw new Error('เปิดเบราว์เซอร์ไม่ขึ้น');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map(); const events = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) events.push(m);
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Log.enable');
  const api = {
    send, ev, events, sleep,
    async size(W, H, D = 1, M = false) { await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: D, mobile: M }); },
    // เปิดหน้าแล้วรอ data-ready (ถ้าหน้ามี) ไม่เกิน 20 วินาที
    async goto(url, settle = 1500) {
      events.length = 0;
      await send('Page.navigate', { url });
      for (let i = 0; i < 80; i++) {
        await sleep(250);
        const st = await ev('[document.readyState, document.documentElement.dataset.ready || ""]');
        if (st && st[1]) break;
        if (st && st[0] === 'complete' && i > 12) break;
      }
      await sleep(settle);
    },
    // ถ่ายภาพหลังภาพนิ่งแล้ว (สองภาพติดกันเหมือนกัน) สูงสุด 8 ครั้ง
    async shot(file, tries = 8) {
      let a = (await send('Page.captureScreenshot', { format: 'png' })).result.data;
      for (let i = 0; i < tries; i++) {
        await sleep(900);
        const b = (await send('Page.captureScreenshot', { format: 'png' })).result.data;
        const same = a === b; a = b; if (same) break;
      }
      fs.writeFileSync(file, Buffer.from(a, 'base64'));
    },
    async wheel(x, y, dy) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); },
    async mouseDown(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }); },
    async mouseMove(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 }); },
    async mouseUp(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }); },
    async click(x, y) { await api.mouseDown(x, y); await sleep(60); await api.mouseUp(x, y); },
    async clickSel(sel) {
      const p = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
      if (!p) throw new Error('ไม่พบ ' + sel);
      await api.click(p[0], p[1]);
    },
    async touchDown(x, y) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); },
    async touchMove(x, y) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); },
    async touchUp() { await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    errors() {
      return events.filter((e) => e.method === 'Runtime.exceptionThrown'
        || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
        || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'))
        .map((e) => JSON.stringify(e.params).slice(0, 200));
    },
    // คำขอที่ออกไปนอกเครื่อง (ใช้เช็กว่าหน้าไม่พึ่งเน็ต)
    external() {
      return events.filter((e) => e.method === 'Network.requestWillBeSent').map((e) => e.params.request.url)
        .filter((u) => /^https?:/.test(u) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(u));
    },
    async close() {
      try { ws.close(); } catch {}
      await new Promise((r) => { browser.once('exit', r); browser.kill(); setTimeout(r, 3000); });
      try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} // ลบโปรไฟล์ชั่วคราว กันดิสก์เต็ม
    },
  };
  if (touch) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (reduced) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await api.size(w, h, dpr, mobile);
  return api;
}
