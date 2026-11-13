import {encodeCommand} from './protocol.js';
export const MAX_LINE_BYTES = 65536;

export class NDJSONDecoder {
  constructor(onValue, onError = () => {}) {
    this.onValue = onValue; this.onError = onError; this.bytes = new Uint8Array(MAX_LINE_BYTES); this.length = 0; this.discard = false;
  }
  push(chunk) {
    for (const byte of chunk) {
      if (byte === 10) {
        if (!this.discard && this.length) {
          try {
            const text = new TextDecoder('utf-8', {fatal: true}).decode(this.bytes.subarray(0, this.length)).trim();
            if (text.startsWith('{')) this.onValue(JSON.parse(text));
          } catch { /* Boot noise, malformed JSON and broken UTF-8 are ignored by contract. */ }
        }
        this.length = 0; this.discard = false;
      } else if (!this.discard) {
        if (this.length === MAX_LINE_BYTES) { this.length = 0; this.discard = true; this.onError('ข้ามข้อมูล USB ที่ยาวเกิน 64 KB'); }
        else this.bytes[this.length++] = byte;
      }
    }
  }
  end() { this.length = 0; this.discard = false; }
}

export class SerialReceiver {
  constructor({serial = globalThis.navigator?.serial, onValue = () => {}, onDisconnect = () => {}, onLog = () => {}, onReconnect = () => {}} = {}) {
    Object.assign(this, {serial, onValue, onDisconnect, onLog, onReconnect});
    this.port = null; this.reader = null; this.writer = null; this.task = null; this.closing = false; this.connecting = false;
    this.tail = Promise.resolve(); this.wanted = false; this.reconnectRequested = false; this.closeTask = null;
    this.connectListener = () => { if (this.wanted) { this.reconnectRequested = true; this.resumeReconnect(); } };
    this.disconnectListener = e => { if (e.target === this.port || e.port === this.port) { this.onDisconnect(); this.close(false); } };
    serial?.addEventListener?.('connect', this.connectListener);
    serial?.addEventListener?.('disconnect', this.disconnectListener);
  }
  get connected() { return !!this.writer && !this.closing; }
  resumeReconnect() {
    if (!this.wanted || !this.reconnectRequested || this.port || this.connecting || this.closeTask) return;
    this.reconnectRequested = false;
    this.reconnect().catch(e => this.onLog(e.message));
  }
  async connect() {
    if (!this.serial) throw new Error('ต่อตัวรับได้เฉพาะ Chrome หรือ Edge บนคอมพิวเตอร์');
    if (this.port || this.connecting) return false;
    // Keep requestPort inside the user's click. Do not await getPorts first.
    const chosen = await this.serial.requestPort();
    this.wanted = true; await this.open(chosen); return true;
  }
  async reconnect() {
    if (!this.serial || this.port || this.connecting || this.closeTask) return false;
    this.wanted = true; this.connecting = true;
    try {
      const ports = await this.serial.getPorts();
      if (!this.wanted) return false;
      // With two indistinguishable ESP32 boards, never guess which one is the receiver.
      const chosen = this.preferred && ports.includes(this.preferred) ? this.preferred : ports.length === 1 ? ports[0] : null;
      if (!chosen) { if (ports.length > 1) this.onLog('มีหลายพอร์ตที่เคยอนุญาต กรุณากดเชื่อมต่อเพื่อเลือกตัวรับ'); return false; }
      await this.open(chosen); this.onReconnect(); return true;
    } finally { this.connecting = false; this.resumeReconnect(); }
  }
  async open(port) {
    this.connecting = true;
    try {
      await port.open({baudRate: 115200, bufferSize: 131072});
      this.port = port; this.preferred = port; this.closing = false;
      if (!port.readable || !port.writable) throw new Error('พอร์ต USB ไม่พร้อมรับส่งข้อมูล');
      this.writer = port.writable.getWriter(); this.reader = port.readable.getReader();
      this.task = this.readLoop();
    } catch (error) {
      await this.close(false);
      throw new Error(error.name === 'NotFoundError' ? 'ยังไม่ได้เลือกพอร์ต' : 'เปิดพอร์ตไม่ได้ พอร์ตอาจถูกโปรแกรมอื่นใช้อยู่ ปิด Serial Monitor แล้วลองใหม่');
    } finally { this.connecting = false; this.resumeReconnect(); }
  }
  async readLoop() {
    const decoder = new NDJSONDecoder(this.onValue, this.onLog);
    try {
      while (!this.closing) {
        const {value, done} = await this.reader.read();
        if (done) break;
        if (value) decoder.push(value);
      }
    } catch (e) { if (!this.closing) this.onLog(`USB ขาดการเชื่อมต่อ: ${e.message}`); }
    finally {
      decoder.end();
      try { this.reader?.releaseLock(); } catch { /* Device removed. */ }
      this.reader = null;
      if (!this.closing) { this.onDisconnect(); await this.release(); }
    }
  }
  send(value) {
    const bytes = encodeCommand(value);
    const next = this.tail.catch(() => {}).then(async () => {
      if (!this.connected) throw new Error('ยังไม่ได้เชื่อมต่อตัวรับ USB');
      await this.writer.write(bytes);
    });
    this.tail = next; return next;
  }
  async release() {
    this.closing = true;
    try { await this.writer?.abort(); } catch { /* Device removed. */ }
    try { this.writer?.releaseLock(); } catch { /* Already unlocked. */ }
    this.writer = null;
    try { await this.port?.close(); } catch { /* Device removed. */ }
    this.port = null;
    this.resumeReconnect();
  }
  async close(manual = true) {
    if (manual) { this.wanted = false; this.reconnectRequested = false; }
    if (this.closeTask) return this.closeTask;
    this.closing = true;
    const closing = (async () => {
      try { await this.reader?.cancel(); } catch { /* Device removed. */ }
      await this.task; this.task = null; await this.release();
    })();
    this.closeTask = closing;
    try { await closing; }
    finally { if (this.closeTask === closing) this.closeTask = null; this.resumeReconnect(); }
  }
  async destroy() {
    await this.close();
    this.serial?.removeEventListener?.('connect', this.connectListener);
    this.serial?.removeEventListener?.('disconnect', this.disconnectListener);
  }
}
