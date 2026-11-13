// Archives stay on the station backend. The browser streams the selected File.
export async function fetchOfflineMaps() {
  const response = await fetch('/api/maps', {cache:'no-store',signal:AbortSignal.timeout(8000)});
  let body;
  try {body = await response.json();} catch {throw new Error('อ่านรายการแผนที่ในเครื่องไม่ได้');}
  if(!response.ok) throw new Error(body.error || 'อ่านรายการแผนที่ในเครื่องไม่ได้');
  if(!Array.isArray(body.maps)) throw new Error('รายการแผนที่ในเครื่องไม่ถูกต้อง');
  return body;
}

export function importOfflineMap(file, onProgress = () => {}) {
  return new Promise((resolve,reject) => {
    if(!(file instanceof Blob) || !/\.(pmtiles|mbtiles)$/i.test(file.name || '')) {
      reject(new Error('เลือกไฟล์ .pmtiles หรือ .mbtiles'));return;
    }
    const request = new XMLHttpRequest();
    request.open('POST','/api/maps/import');
    request.setRequestHeader('Content-Type','application/octet-stream');
    request.setRequestHeader('X-FloodLink-Client','dashboard');
    request.setRequestHeader('X-Map-Filename',encodeURIComponent(file.name));
    request.responseType='json';
    request.upload.onprogress = event => onProgress({loaded:event.loaded,total:event.lengthComputable?event.total:file.size,percent:file.size?Math.min(100,event.loaded/file.size*100):0});
    request.upload.onload = () => onProgress({loaded:file.size,total:file.size,percent:100});
    request.onerror = () => reject(new Error('ติดต่อสถานีไม่ได้ ตรวจว่าโปรแกรมสถานียังเปิดอยู่แล้วนำเข้าใหม่'));
    request.onabort = () => reject(new Error('ยกเลิกการนำเข้าแผนที่แล้ว'));
    request.onload = () => {
      const body=request.response;
      if(request.status<200 || request.status>=300) {reject(new Error(body?.error || 'นำเข้าแผนที่ไม่สำเร็จ'));return;}
      if(!body?.map?.id) {reject(new Error('สถานีส่งผลการนำเข้าแผนที่ไม่ถูกต้อง'));return;}
      resolve(body.map);
    };
    request.send(file);
  });
}
