// One local SVG family for status chips, overview metrics and both map renderers.
const ARTWORK = Object.freeze({
  idle: '<path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7"/>',
  warn: '<path d="M18 8a6 6 0 0 0-12 0c0 6-2 6-2 8h16c0-2-2-2-2-8M10 20a2 2 0 0 0 4 0M3 5l-1 3m19-3 1 3"/>',
  heard: '<path d="M5 9a6 6 0 0 1 12 0c0 3-2 4-4 6-1 1-1 5-4 5a3 3 0 0 1-3-3m3-7a2 2 0 1 1 4 0c0 2-3 2-3 4"/><path d="m16 17 2 2 4-5"/>',
  silent: '<path d="m3 10 8-7 8 7M5 9v11h5M9 10h4"/><circle cx="17" cy="17" r="5"/><path d="M17 14v3l2 1"/>',
  sos: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6m5.6 5.6 3.6 3.6m0-12.8-3.6 3.6m-5.6 5.6-3.6 3.6"/>',
  auto_sos: '<path d="m2 11 8-7 8 7M4 10v11h12V10M10 12v4m0 2v.1M15 3c3 0 6 3 6 6m-6-2c1 0 2 1 2 2"/>',
  accepted: '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m8.5 13 2.5 2.5 4.5-5"/>',
  done: '<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',
  safe: '<path d="m3 10 9-7 9 7M5 9v11h14V9m-10 5 2 2 4-4"/>',
  offline: '<path d="M3 3 21 21M2 8a16 16 0 0 1 3-2m4-1a16 16 0 0 1 13 3M5 12a11 11 0 0 1 4-2m5 0a11 11 0 0 1 5 2m-11 4a6 6 0 0 1 4-1m0 5v.1"/>',
  unknown: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 4v.1"/>',
  battery: '<rect x="2" y="6" width="17" height="12" rx="2"/><path d="M22 10v4M6 9v6"/>',
  bed: '<path d="M3 5v15m18-10v10M3 16h18M3 10h5a3 3 0 0 1 3 3v3m0-7h7a3 3 0 0 1 3 3v4"/><circle cx="6.5" cy="8.5" r="1.5"/>',
  water: '<path d="M12 3s-6 6-6 10a6 6 0 0 0 12 0c0-4-6-10-6-10M9 14a3 3 0 0 0 3 3"/>',
  phone: '<path d="M6 3H3v3c0 8 7 15 15 15h3v-3l-5-3-2 2a15 15 0 0 1-7-7l2-2-3-5Z"/>',
  delivery: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 3h8M8 10h8m-4 3v3m0 3v.1"/>',
  retry: '<path d="M3 11a9 9 0 0 1 15-6l3 3M21 3v5h-5m5 5a9 9 0 0 1-15 6l-3-3m5 0H3v5"/>'
});

export const STATUS_HELP = Object.freeze({
  idle: 'ยังไม่มีเหตุที่ต้องดำเนินการ', warn: 'รอคนในบ้านกดตอบรับ', heard: 'บ้านตอบรับคำเตือนแล้ว',
  silent: 'ให้อสม.ตรวจสอบบ้าน', sos: 'รับเรื่องและประสานทีม', auto_sos: 'อสม.ยืนยันก่อนรับเรื่อง',
  accepted: 'ติดตามจนช่วยเหลือเสร็จ', done: 'ทีมปิดคำขอช่วยเหลือแล้ว', safe: 'บ้านแจ้งว่าปลอดภัย', offline: 'ตรวจการติดต่อและไปดูบ้าน'
});

export function statusIcon(name) {
  const key = Object.hasOwn(ARTWORK, name) ? name : 'unknown';
  return `<svg class="status-svg" data-state-icon="${key}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ARTWORK[key]}</svg>`;
}

export function badgeIcon(label) {
  const icons = {'ติดเตียง': 'bed', 'ถ่านอ่อน': 'battery', 'ขาดการติดต่อ': 'offline', 'ยกเลิกโดยบ้าน ควรโทรยืนยัน': 'phone', 'ขอแทน รอยืนยัน': 'auto_sos',
    'ไฟที่บ้านยังไม่เปลี่ยน — กล่องยังไม่ได้รับ': 'delivery', 'น้ำถึงสายวัด': 'water', 'ยังไม่เคยได้ยินกล่องนี้': 'offline', 'ข้อมูลคำขอไม่ครบ ต้องขอข้อมูลใหม่': 'delivery'};
  const key = icons[label] || (label.startsWith('ส่งถึงในครั้งที่ ') ? 'retry' : null);
  return key ? statusIcon(key) : '';
}
