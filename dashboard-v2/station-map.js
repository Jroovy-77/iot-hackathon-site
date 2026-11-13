import {HouseholdMap} from './household-map.js';
import {fetchOfflineMaps, importOfflineMap} from './offline-maps.js';
import {stateInfo, finite} from './protocol.js';
import {statusIcon} from './status-icons.js';

export const hasCoordinates = h => finite(h?.lat) && finite(h?.lng) && h.lat >= -90 && h.lat <= 90 && h.lng >= -180 && h.lng <= 180;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// The old station's six Hat Yai DEMO locations. They are never used in live mode.
const DEMO = [[7.008,100.476],[7.011,100.481],[7.005,100.484],[7.014,100.478],[7.006,100.472],[7.012,100.487]];
export function positionHouses(houses, registry, mode) {
  const byId = new Map(registry.map(h => [String(h.id), h]));
  return houses.map((h, i) => {
    const record = byId.get(String(h.id));
    let location = hasCoordinates(record) ? record : hasCoordinates(h) ? h : null;
    if (!location && mode === 'sim') {
      // A home's demo point must not change when a detail view/filter passes a subset.
      const index = Number.isInteger(Number(h.id)) ? Math.abs(Number(h.id) - 1001) : i;
      const base = DEMO[index % DEMO.length]; location = {lat: base[0] + Math.floor(index / DEMO.length) * .003, lng: base[1], locationSource: 'demo'};
    }
    return {...h, ...(record ? {address: record.address, contact: record.contact, phone: record.phone, notes: record.notes, registryName: record.name} : {}),
      lat: location?.lat ?? null, lng: location?.lng ?? null, locationSource: location?.locationSource ?? null,
      locationVerifiedAt: location?.locationVerifiedAt ?? null, locationVerifiedBy: location?.locationVerifiedBy || '', registryOnly: h.registryOnly === true};
  });
}

// Reuse the original map engine, PMTiles rendering, zoom, picking and lifecycle.
// Override its v1 incident/staleness interpretation with receiver-owned v2 states.
export class ReceiverHouseholdMap extends HouseholdMap {
  homeStatus(home) { return stateInfo(home.state)[1]; }
  icon(home, status) {
    return this.L.divIcon({className: 'house-map-marker', iconSize: [46, 49], iconAnchor: [23, 40], popupAnchor: [0, -40],
      html: `<span class="house-map-pin receiver-pin state-${status}${home.id === this.selectedId ? ' is-selected' : ''}${home.locationVerifiedAt ? '' : ' is-unverified'}"><svg class="pin-shell" viewBox="0 0 32 40" aria-hidden="true"><path class="pin-body" d="M16 39C13 34 2 23 2 15a14 14 0 1 1 28 0c0 8-11 19-14 24Z"/></svg><span class="pin-status-icon">${statusIcon(status)}</span><span class="house-map-pin-label">${escapeHTML(home.id)}</span></span>`});
  }
  popup(home) {
    const root = document.createElement('div'); root.className = 'house-map-popup';
    for (const type of ['name', 'state', 'location', 'contact']) { const node = document.createElement(type === 'name' ? 'strong' : 'p'); node.dataset.field = type; root.append(node); }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'primary'; button.textContent = 'ดูรายละเอียดบ้าน'; button.onclick = () => this.onSelect(home.id); root.append(button);
    this.updatePopup(root, home); return root;
  }
  updatePopup(root, home) {
    const put = (key, value) => { root.querySelector(`[data-field="${key}"]`).textContent = value; };
    put('name', `${home.name || home.registryName || 'บ้าน'} · ${home.id}`);
    put('state', stateInfo(home.state)[0]);
    put('location', `${home.lat.toFixed(6)}, ${home.lng.toFixed(6)} · ${home.locationSource === 'demo' ? 'พิกัดสาธิต' : home.locationVerifiedAt ? 'ยืนยันพิกัดแล้ว' : 'ยังไม่ยืนยันพิกัดหน้างาน'}`);
    put('contact', [home.contact, home.phone, home.address].filter(Boolean).join(' · '));
  }
  updateMarker(item, home, status) {
    item.marker.setLatLng([home.lat, home.lng]); item.marker.setIcon(this.icon(home, status));
    const element = item.marker.getElement();
    if (element) { Object.assign(element.dataset, {homeId: String(home.id), state: status, lat: String(home.lat), lng: String(home.lng)}); element.setAttribute('aria-label', `${home.name || 'บ้าน'} ${home.id} · ${stateInfo(home.state)[0]}`); element.setAttribute('title', `${home.name || home.id} · ${stateInfo(home.state)[0]}`); }
    if (!item.popup) { item.popup = this.popup(home); item.marker.bindPopup(item.popup, {maxWidth: 280, autoPan: false}); }
    else this.updatePopup(item.popup, home);
  }
}

export class StationMap {
  constructor({getData, onSelect, onChanged, onEdit}) {
    Object.assign(this, {getData, onSelect, onChanged, onEdit});
    this.registry = []; this.mode = null; this.available = false; this.maps = []; this.map = null; this.picker = null; this.generation = 0; this.saveTasks = new Map();
    this.el = document.getElementById('geographic-map');
    this.message = document.getElementById('map-source-status');
    const updateFilter = () => { this.update(); if (!this.map) this.onChanged(); };
    document.getElementById('map-search').addEventListener('input', updateFilter);
    document.getElementById('map-filter').addEventListener('change', updateFilter);
    document.getElementById('map-expand').onclick = () => this.expand(!document.querySelector('.map-panel').classList.contains('is-expanded'));
    this.keyHandler = event => {
      const panel = document.querySelector('.map-panel');
      if (!panel.classList.contains('is-expanded')) return;
      if (event.key === 'Escape') { event.preventDefault(); this.expand(false); return; }
      if (event.key !== 'Tab') return;
      const controls = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
        .filter(el => el.getClientRects().length && !el.closest('[inert]'));
      const first = controls[0], last = controls.at(-1), current = document.activeElement;
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (current === first || !panel.contains(current))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (current === last || !panel.contains(current))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', this.keyHandler);
    document.getElementById('map-source').onchange = e => this.useMap(e.target.value);
    document.getElementById('map-import').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try { const meta = await importOfflineMap(file, progress => this.say(`กำลังนำเข้าแผนที่ ${Math.round(progress.percent)}%`)); this.maps.unshift(meta); this.renderSources(); this.useMap(meta.id); }
      catch (error) { this.say(error.message); }
      finally { e.target.value = ''; }
    };
  }
  say(text) { this.message.textContent = text; }
  record(id) { return this.registry.find(h => String(h.id) === String(id)); }
  async load(mode) {
    this.mode = mode; const generation = ++this.generation; this.registry = []; this.available = false;
    try {
      const response = await fetch(`/api/station/registry?mode=${mode}`, {cache: 'no-store'});
      if (!response.ok) throw new Error('ยังอ่านทะเบียนพิกัดในเครื่องไม่ได้');
      const body = await response.json(); if (generation !== this.generation) return;
      this.registry = Array.isArray(body.homes) ? body.homes : []; this.available = body.available === true;
      if (!this.maps.length) {
        const data = await fetchOfflineMaps(); if (generation !== this.generation) return;
        this.maps = data.maps; this.renderSources();
      }
      if (this.maps.length && !this.map) this.createMap();
      if (this.maps.length && this.map?.source !== 'offline') this.useMap(this.maps[0].id);
      if (!this.maps.length) this.say('ยังไม่มีชุดแผนที่ในเครื่อง ใช้ผัง x,y ชั่วคราว หรือนำเข้า PMTiles/MBTiles');
    } catch (error) { if (generation === this.generation) this.say(`${error.message} · แสดงผังชุมชนชั่วคราว`); }
    if (generation === this.generation) { this.onChanged(); this.update(); }
  }
  renderSources() {
    const select = document.getElementById('map-source');
    select.innerHTML = this.maps.map(m => `<option value="${escapeHTML(m.id)}">${escapeHTML(m.name)}</option>`).join('') || '<option value="">ยังไม่มีแผนที่ในเครื่อง</option>';
  }
  createMap() {
    if (!globalThis.L?.map) return;
    this.el.hidden = false; document.getElementById('map').setAttribute('hidden', ''); document.getElementById('map-empty').hidden = true;
    this.map = new ReceiverHouseholdMap(this.el, {onSelect: id => this.onSelect(Number(id))});
    this.el.addEventListener('map-status', () => this.updateMessage());
  }
  useMap(id) {
    const meta = this.maps.find(m => m.id === id); if (!meta) return;
    if (!this.map) this.createMap(); if (!this.map) return;
    this.map.setOffline(meta); this.update(); document.getElementById('map-source').value = id;
  }
  updateMessage() {
    if (!this.map) return;
    const {houses, mode} = this.getData(); const positioned = positionHouses(houses, this.registry, mode);
    const count = positioned.filter(hasCoordinates).length;
    this.say(`${this.map.loading ? 'กำลังวาดแผนที่ออฟไลน์…' : this.map.error || 'แผนที่ออฟไลน์ในเครื่อง'} · ปักได้ ${count}/${houses.length} บ้าน${mode === 'sim' ? ' · พิกัดสาธิต' : count < houses.length ? ' · บ้านที่เหลือต้องผูกพิกัดก่อน' : ''}`);
  }
  update() {
    const {houses, mode, selected} = this.getData();
    if (mode !== this.mode) { this.load(mode); return; }
    document.getElementById('new-registry-home').disabled = !this.available;
    document.getElementById('map-import').disabled = !this.available;
    if (!this.map) return;
    const positioned = this.filteredHouses(positionHouses(houses, this.registry, mode));
    this.map.update(positioned, [], {mode, selectedId: selected}); this.updateMessage();
    document.getElementById('map').setAttribute('hidden', ''); document.getElementById('map-empty').hidden = true;
  }
  filteredHouses(houses) {
    const term = document.getElementById('map-search').value.trim().toLowerCase(), filter = document.getElementById('map-filter').value;
    return houses.filter(h => `${h.name || ''} ${h.id} ${h.address || h.registry?.address || ''}`.toLowerCase().includes(term) &&
      (filter === 'all' || filter === 'sos' && (!!h.req || h.requestIncomplete) || filter === 'bed' && h.bed === true || filter === 'visit' && (h.state === 'silent' || h.state === 'offline' || h.offline === true)));
  }
  reset() {
    document.getElementById('map-search').value = ''; document.getElementById('map-filter').value = 'all'; this.update();
    if (this.map) this.map.fitHomes(); else this.onChanged();
  }
  focus(id) {
    document.getElementById('map-search').value = ''; document.getElementById('map-filter').value = 'all'; this.update();
    if (!this.map) {
      const home = this.getData().houses.find(h => h.id === id);
      if (!finite(home?.x) || !finite(home?.y)) { this.onEdit(id); return; }
      this.onChanged();
      queueMicrotask(() => {
        const marker = document.querySelector(`#map [data-house="${id}"]`);
        marker?.focus({preventScroll: true}); marker?.scrollIntoView({block: 'center', behavior: 'smooth'});
      });
      return;
    }
    if (!this.map?.homes.has(id)) { this.onEdit(id); return; }
    this.map.focusHome(id); this.el.scrollIntoView({block: 'center', behavior: 'smooth'});
  }
  expand(value) {
    const panel = document.querySelector('.map-panel');
    if (panel.classList.contains('is-expanded') === value) return;
    if (value) {
      this.returnFocus = document.activeElement; this.inertBackground = [];
      this.panelAttributes = ['role', 'aria-modal', 'tabindex'].map(name => [name, panel.getAttribute(name)]);
      for (let node = panel; node.parentElement; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling !== node && !sibling.inert) { sibling.inert = true; this.inertBackground.push(sibling); }
        }
        if (node.parentElement === document.body) break;
      }
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('tabindex', '-1');
    }
    panel.classList.toggle('is-expanded', value); document.body.classList.toggle('map-expanded', value);
    document.getElementById('map-expand').textContent = value ? 'ย่อแผนที่' : 'ขยายเต็มจอ'; document.getElementById('map-expand').setAttribute('aria-pressed', String(value));
    this.map?.setExpanded(value);
    if (value) document.getElementById('map-expand').focus({preventScroll: true});
    else {
      for (const el of this.inertBackground || []) el.inert = false;
      for (const [name, old] of this.panelAttributes || []) { if (old === null) panel.removeAttribute(name); else panel.setAttribute(name, old); }
      this.inertBackground = [];
      if (this.returnFocus?.isConnected) this.returnFocus.focus({preventScroll: true});
    }
  }
  openPicker(home = {}) {
    this.picker?.destroy(); this.picker = null;
    const container = document.getElementById('registry-picker');
    if (!this.maps.length || !globalThis.L?.map) { container.hidden = true; return; }
    container.hidden = false;
    this.picker = new ReceiverHouseholdMap(container, {onPick: ({lat, lng}) => {
      document.getElementById('registry-lat').value = lat.toFixed(7); document.getElementById('registry-lng').value = lng.toFixed(7); document.getElementById('registry-source').value = 'map';
      document.getElementById('registry-verified').checked = false;
    }});
    this.picker.setOffline(this.maps[0]);
    if (hasCoordinates(home)) this.picker.setPick({lat: home.lat, lng: home.lng});
    else if (this.map) this.picker.map.setView(this.map.map.getCenter(), this.map.map.getZoom(), {animate: false});
    requestAnimationFrame(() => this.picker?.invalidate());
  }
  async save(id, value) {
    const mode = this.mode, generation = this.generation;
    // Preserve the user's edit order in storage as well as on screen, even after closing an editor.
    const key = `${mode}:${id}`, bodyText = JSON.stringify(value);
    const task = (this.saveTasks.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
      const response = await fetch(`/api/station/homes/${id}?mode=${mode}`, {method: 'PUT', headers: {'Content-Type': 'application/json', 'X-FloodLink-Client': 'dashboard'}, body: bodyText});
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'บันทึกทะเบียนไม่ได้');
      if (mode === this.mode && generation === this.generation) {
        this.registry = [...this.registry.filter(h => String(h.id) !== String(id)), body.home]; this.onChanged(); this.update();
      }
      return body.home;
    });
    this.saveTasks.set(key, task);
    try { return await task; } finally { if (this.saveTasks.get(key) === task) this.saveTasks.delete(key); }
  }
  destroy() { this.expand(false); document.removeEventListener('keydown', this.keyHandler); this.map?.destroy(); this.picker?.destroy(); }
}
