// Local Leaflet UI. Only setOnline(true) requests an external basemap.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const vectorLayers = new Set(['earth','water','landcover','landuse','roads','buildings','places','boundaries','transit','pois']);
const localTileError = 'อ่านแผนที่ออฟไลน์ไม่ครบ พื้นที่หรือรายละเอียดนี้อาจไม่มีในไฟล์ที่บันทึก หมุดบ้านยังแสดงตามพิกัดเดิม';

function validateArchive(meta) {
  if(!meta || !/^[a-f0-9]{32,64}$/.test(meta.id) || !['pmtiles','mbtiles'].includes(meta.kind) || !['mvt','png','jpg','webp','avif'].includes(meta.format)) throw new Error('ข้อมูลแผนที่ในเครื่องไม่ถูกต้อง');
  if(!Array.isArray(meta.bounds) || meta.bounds.length!==4 || !meta.bounds.every(Number.isFinite) || meta.bounds[0]>=meta.bounds[2] || meta.bounds[1]>=meta.bounds[3] || meta.bounds[0]<-180 || meta.bounds[2]>180 || meta.bounds[1]<-90 || meta.bounds[3]>90 || !Number.isInteger(meta.minZoom) || !Number.isInteger(meta.maxZoom) || meta.minZoom<0 || meta.maxZoom<meta.minZoom || meta.maxZoom>24) throw new Error('ขอบเขตหรือระดับซูมแผนที่ไม่ถูกต้อง');
  const expected=meta.kind==='pmtiles'?`/api/maps/${meta.id}/archive.pmtiles`:`/api/maps/${meta.id}/tiles/{z}/{x}/{y}.${meta.format}`;
  if((meta.kind==='pmtiles'?meta.archiveUrl:meta.tileUrl)!==expected) throw new Error('แผนที่ออฟไลน์ต้องอ่านจากไฟล์ในสถานีนี้');
  if(meta.kind==='mbtiles' && meta.format==='mvt') throw new Error('แปลงแผนที่เวกเตอร์ MBTiles เป็น Protomaps PMTiles ก่อนนำเข้า');
  if(meta.format==='mvt' && meta.vectorLayers?.length && !meta.vectorLayers.some(id=>vectorLayers.has(id))) throw new Error('ไฟล์เวกเตอร์นี้ใช้โครงสร้างที่ไม่รองรับ กรุณาใช้แผนที่ Protomaps');
}

// Canvas text uses the bundled Thai font; the style never requests glyph servers.
function useLocalFonts(value, seen=new WeakSet()) {
  if(!value || typeof value!=='object' || seen.has(value))return;
  seen.add(value);
  if(typeof value.get==='function' && ('font' in value || 'family' in value)) {
    const get=value.get.bind(value);
    value.get=(...args)=>String(get(...args)).replace(/sans-serif/g,'Anuphan, sans-serif');
  }
  for(const child of Object.values(value))useLocalFonts(child,seen);
}

function rasterArchiveLayer(L,meta,options) {
  if(!globalThis.pmtiles?.PMTiles)throw new Error('เครื่องมืออ่าน PMTiles ไม่พร้อม กรุณาโหลดหน้าเว็บใหม่');
  const archive=new globalThis.pmtiles.PMTiles(meta.archiveUrl);
  const release=tile=>{tile._offlineController?.abort();if(tile._offlineBlob)URL.revokeObjectURL(tile._offlineBlob);tile._offlineBlob=null;};
  return new (L.GridLayer.extend({
    createTile(coords,done) {
      const tile=document.createElement('img');tile.alt='';tile.setAttribute('role','presentation');
      const controller=new AbortController();tile._offlineController=controller;
      archive.getZxy(coords.z,coords.x,coords.y,controller.signal).then(result=>{
        if(controller.signal.aborted)return;
        if(!result?.data)throw new Error(localTileError);
        const type=`image/${meta.format==='jpg'?'jpeg':meta.format}`;
        tile._offlineBlob=URL.createObjectURL(new Blob([result.data],{type}));
        tile.onload=()=>{release(tile);done(null,tile);};
        tile.onerror=()=>{release(tile);done(new Error(localTileError),tile);};
        tile.src=tile._offlineBlob;
      }).catch(error=>{if(error.name!=='AbortError' && !controller.signal.aborted)done(error,tile);});
      return tile;
    },
    onRemove(map) {
      for(const item of Object.values(this._tiles || {}))release(item.el);
      return L.GridLayer.prototype.onRemove.call(this,map);
    },
  }))(options).on('tileunload',event=>release(event.tile));
}
const activeStatuses = new Set(['new', 'accepted', 'dispatched']);
const statusText = {
  new: 'รอรับความช่วยเหลือ', accepted: 'เจ้าหน้าที่รับเรื่องแล้ว', dispatched: 'ทีมกำลังช่วยเหลือ',
  normal: 'ยังไม่มีคำขอที่เปิดอยู่', wet: 'น้ำถึงจุดตรวจ', stale: 'ยังไม่มีข้อมูลติดต่อครั้งล่าสุด',
};
const priority = {new:3, accepted:2, dispatched:1};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const hasPoint = home => typeof home?.lat === 'number' && Number.isFinite(home.lat) && home.lat >= -90 && home.lat <= 90 && typeof home.lng === 'number' && Number.isFinite(home.lng) && home.lng >= -180 && home.lng <= 180;
const hasRadius = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100000;
const pointEqual = (a,b) => !!a && !!b && a.lat === b.lat && a.lng === b.lng;
const pinSVG = '<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M16 39C13 34 2 23 2 15a14 14 0 1 1 28 0c0 8-11 19-14 24Z" fill="currentColor" stroke="white" stroke-width="2"/><circle cx="16" cy="15" r="5" fill="white"/></svg>';

export class HouseholdMap {
  constructor(container, {onSelect = () => {}, onPick = null} = {}) {
    if(!container || container.nodeType !== 1) throw new Error('ไม่พบพื้นที่แสดงแผนที่');
    if(!globalThis.L?.map) throw new Error('เปิดเครื่องมือแผนที่ไม่ได้ กรุณาโหลดหน้าเว็บใหม่');
    this.L = globalThis.L; this.container = container; this.onSelect = onSelect; this.onPick = onPick;
    this.markers = new Map(); this.homes = new Map(); this.online = false; this.tiles = null;
    this.source='none';this.offlineMapId=null;this.offlineMeta=null;
    this.mode = null; this.selectedId = null; this.fitted = false; this.destroyed = false;
    this.compactDetails=false;
    this.pick = null; this.pickMarker = null; this.pickCircle = null; this.selectionCircle = null;
    this.tileErrors = 0; this.loaded = false; this.loading = false; this.error = null;
    this.incidentStatuses=new Map();this.userLocation=null;this.userMarker=null;this.userCircle=null;this.layoutFrame=0;
    container.dataset.domPreserve = ''; container.dataset.lenisPrevent = '';
    container.setAttribute('aria-label', onPick ? 'เลือกพิกัดบ้านบนแผนที่' : 'แผนที่ตำแหน่งบ้านที่ลงทะเบียน');
    this.map = this.L.map(container, {
      center:[13.5,101], zoom:6, minZoom:2, maxZoom:19, zoomControl:false,
      scrollWheelZoom:true, touchZoom:true, dragging:true, doubleClickZoom:true, keyboard:true,
      wheelDebounceTime:40, wheelPxPerZoomLevel:80, bounceAtZoomLimits:false, zoomAnimation:!this.reducedMotion(),
      fadeAnimation:!this.reducedMotion(), markerZoomAnimation:!this.reducedMotion(),
      worldCopyJump:false,
    });
    container.style.touchAction='none';
    this.viewHandler=()=>{this.publishView();if(this.source==='offline')this.emitStatus();};this.map.on('moveend zoomend',this.viewHandler);this.publishView();
    this.L.control.zoom({zoomInTitle:'ขยายแผนที่',zoomOutTitle:'ย่อแผนที่'}).addTo(this.map);
    this.L.control.scale({imperial:false,metric:true,maxWidth:110}).addTo(this.map);
    const owner = this;
    this.statusControl = this.L.control({position:'bottomleft'});
    this.statusControl.onAdd = () => {
      const element = owner.L.DomUtil.create('div','house-map-status');
      element.setAttribute('role','status'); element.setAttribute('aria-live','polite');
      owner.L.DomEvent.disableClickPropagation(element); owner.statusElement = element;
      return element;
    };
    this.statusControl.addTo(this.map);
    this.clickHandler = event => {
      if(!this.onPick) return;
      const picked = {lat:event.latlng.lat,lng:event.latlng.lng};
      this.setPick({...picked,pan:false}); this.onPick(picked);
    };
    this.map.on('click',this.clickHandler);
    this.emitStatus();
    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.invalidate()) : null;
    this.resizeObserver?.observe(container);
  }

  reducedMotion() { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }

  emitStatus() {
    if(this.destroyed) return;
    let text = '';
    if(this.source==='none') text = 'ยังไม่แสดงภาพพื้นแผนที่ · หมุดแสดงตามพิกัดที่บันทึก';
    else if(this.source==='offline') {
      const bounds=this.offlineMeta.bounds,center=this.map.getCenter();
      const outside=center.lng<bounds[0] || center.lng>bounds[2] || center.lat<bounds[1] || center.lat>bounds[3];
      if(outside)text='พื้นที่ที่กำลังดูอยู่นอกขอบเขตแผนที่ในเครื่อง · หมุดบ้านยังแสดงตามพิกัด';
      else if(this.error)text=this.error;
      else if(this.loading)text='กำลังอ่านแผนที่จากเครื่อง…';
      else if(!this.loaded)text=localTileError;
      else text=`แผนที่ออฟไลน์ · ${this.offlineMeta.name || 'ไฟล์ในสถานี'}${this.map.getZoom()>this.offlineMeta.maxZoom?' · ขยายภาพเกินรายละเอียดต้นฉบับ':''}`;
    } else if(this.error) text = this.error;
    else if(this.loading) text = 'กำลังโหลดภาพแผนที่ OpenStreetMap…';
    if(this.statusElement) {this.statusElement.textContent=text;this.statusElement.hidden=!text;}
    this.container.dataset.mapOnline = String(this.online);
    this.container.dataset.mapLoaded = String(this.loaded);
    this.container.dataset.mapError = this.error || '';
    this.container.dataset.mapSource=this.source;
    this.container.dataset.offlineMapId=this.offlineMapId || '';
    this.container.dispatchEvent(new CustomEvent('map-status',{detail:{source:this.source,offlineMapId:this.offlineMapId,online:this.online,loading:this.loading,error:this.error,loaded:this.loaded}}));
  }

  clearSource() {
    if(this.destroyed)return;
    if(this.tiles) {
      const previous=this.tiles;this.tiles=null;
      // GridLayer's remove listener detaches map events; calling off() first
      // would retain stale listeners that fail on the next pan/source switch.
      previous.remove();previous.off();
    }
    this.source='none';this.online=false;this.offlineMapId=null;this.offlineMeta=null;
    this.loaded=false;this.loading=false;this.error=null;this.tileErrors=0;this.emitStatus();
  }

  bindTiles(layer,{vector=false}={}) {
    const current=()=>!this.destroyed && this.tiles===layer;
    layer.on('loading',()=>{if(!current())return;this.loading=true;this.loaded=false;this.tileErrors=0;this.error=null;this.emitStatus();});
    layer.on('tileload',()=>{if(current() && (!vector || layer._offlineValidated))this.loaded=true;});
    layer.on('tileerror',()=>{if(!current())return;this.tileErrors++;this.error=this.source==='offline'?localTileError:'โหลดภาพแผนที่ไม่ครบ กรุณาตรวจอินเทอร์เน็ตแล้วกดลองใหม่ พิกัดบ้านยังคงอยู่';this.emitStatus();});
    layer.on('load',()=>{if(!current())return;this.loading=false;if(!this.tileErrors)this.error=null;if(vector && !this.loaded && !this.error)this.error=localTileError;this.emitStatus();});
  }

  setOffline(meta) {
    if(this.destroyed)return;
    validateArchive(meta);
    if(this.source==='offline' && this.offlineMapId===meta.id)return;
    const attribution=(meta.attribution || 'แผนที่ในเครื่อง').replace(/\bOpenStreetMap\b(?!\s+contributors)/g,'OpenStreetMap contributors');
    const options={minZoom:meta.minZoom,maxZoom:Math.max(19,meta.maxZoom),minNativeZoom:meta.minZoom,maxNativeZoom:meta.maxZoom,
      bounds:[[meta.bounds[1],meta.bounds[0]],[meta.bounds[3],meta.bounds[2]]],noWrap:true,
      updateWhenIdle:true,keepBuffer:1,attribution:escapeHTML(attribution)};
    let layer;
    if(meta.format==='mvt') {
      if(!globalThis.protomapsL?.leafletLayer)throw new Error('เครื่องมือวาดแผนที่ Protomaps ไม่พร้อม กรุณาโหลดหน้าเว็บใหม่');
      const fontReady=document.fonts?.load('12px Anuphan') || Promise.resolve();
      // Vector overzoom redraws geometry/text at the display zoom. Leaflet's
      // raster maxNativeZoom would instead stretch a low-resolution canvas.
      const {minNativeZoom,maxNativeZoom,...vectorOptions}=options;
      layer=globalThis.protomapsL.leafletLayer({...vectorOptions,url:meta.archiveUrl,flavor:'light',lang:'th',maxDataZoom:meta.maxZoom,tasks:[fontReady]});
      useLocalFonts(layer.labelRules);
      // The vendor treats failed reads as empty canvas tiles. Surface those failures
      // and inspect actual decoded layer names before reporting a successful render.
      for(const view of layer.views.values()) {
        const source=view.tileCache.source,get=source.get.bind(source);
        source.get=async(...args)=>{
          try {
            const data=await get(...args);
            const populated=[...data].filter(([,features])=>features.length);
            if(!populated.length)throw new Error(localTileError);
            if(populated.length && !populated.some(([id])=>vectorLayers.has(id)))throw new Error('ไฟล์เวกเตอร์นี้ไม่ใช่โครงสร้าง Protomaps ที่รองรับ');
            if(populated.some(([id])=>vectorLayers.has(id)))layer._offlineValidated=true;
            return data;
          } catch(error) {
            if(error.name!=='AbortError' && this.tiles===layer && !this.destroyed) {this.tileErrors++;this.error=error.message?.includes('โครงสร้าง')?error.message:localTileError;this.emitStatus();}
            throw error;
          }
        };
      }
    } else if(meta.kind==='pmtiles')layer=rasterArchiveLayer(this.L,meta,options);
    else layer=this.L.tileLayer(meta.tileUrl,options);
    this.clearSource();this.source='offline';this.online=false;this.offlineMapId=meta.id;this.offlineMeta=meta;
    this.loading=true;this.tiles=layer;this.bindTiles(layer,{vector:meta.format==='mvt'});
    layer.addTo(this.map);this.loading=layer.isLoading();this.emitStatus();
  }

  setOnline(value) {
    if(this.destroyed) return;
    const enabled = value === true;
    if(!enabled) {this.clearSource();return;}
    if(this.source==='online' && this.tiles && !this.error) return;
    // An explicit second enable retries failed tiles. No automatic tile download loop.
    this.clearSource();this.source='online';this.online=true;this.loaded=false;this.loading=true;this.error=null;this.tileErrors=0;
    this.tiles = this.L.tileLayer(TILE_URL,{
      maxZoom:19, maxNativeZoom:19, subdomains:[], updateWhenIdle:true,
      keepBuffer:0, referrerPolicy:'strict-origin-when-cross-origin',
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });
    this.bindTiles(this.tiles);
    this.tiles.addTo(this.map);this.emitStatus();
  }

  indexIncidents(incidents) {
    const statuses=new Map();
    for(const incident of incidents) {
      if(!activeStatuses.has(incident.status))continue;
      const existing=statuses.get(incident.homeId);
      if(!existing||(priority[incident.status]||0)>(priority[existing]||0))statuses.set(incident.homeId,incident.status);
    }
    return statuses;
  }

  homeStatus(home) {
    const current=this.incidentStatuses.get(home.id);
    if(current)return current;
    if(home.water==='wet')return 'wet';
    const stale=home.stale!==undefined?home.stale===true:!home.lastSeen||Date.now()-Date.parse(home.lastSeen)>180*60000;
    return stale?'stale':'normal';
  }

  publishView() {
    if(this.destroyed)return;
    const center=this.map.getCenter(),zoom=this.map.getZoom();
    Object.assign(this.container.dataset,{zoom:String(zoom),centerLat:String(center.lat),centerLng:String(center.lng)});
    this.container.dispatchEvent(new CustomEvent('map-view',{detail:{zoom,lat:center.lat,lng:center.lng}}));
  }

  icon(home, status) {
    const selected = home.id===this.selectedId ? ' house-map-pin--selected' : '';
    const unverified = home.locationVerifiedAt ? '' : ' house-map-pin--unverified';
    return this.L.divIcon({
      className:'house-map-marker',iconSize:[46,48],iconAnchor:[23,42],popupAnchor:[0,-40],
      html:`<span class="house-map-pin house-map-pin--${status}${selected}${unverified}">${pinSVG}<span class="house-map-pin-label">${escapeHTML(home.id)}</span></span>`,
    });
  }

  popup(home, status) {
    const root=document.createElement('div');root.className='house-map-popup';
    for(const [tag,className] of [['strong','house-map-popup-heading'],['p','house-map-popup-address'],['p','house-map-popup-status'],['p','house-map-popup-coordinates'],['p','house-map-popup-verification'],['p','house-map-popup-accuracy']]) {
      const element=document.createElement(tag);element.className=className;root.append(element);
    }
    const button=document.createElement('button');button.type='button';button.className='small primary';button.textContent='เลือกบ้านหลังนี้';button.addEventListener('click',()=>this.onSelect(home.id));root.append(button);
    this.updatePopup(root,home,status);return root;
  }

  updatePopup(root,home,status) {
    const write=(selector,text)=>{const element=root.querySelector(selector);if(element.textContent!==text)element.textContent=text;};
    write('.house-map-popup-heading',`บ้าน ${home.id} · ${home.name||''}`);
    const address=root.querySelector('.house-map-popup-address');address.hidden=!home.address;write('.house-map-popup-address',home.address||'');
    const statusElement=root.querySelector('.house-map-popup-status');statusElement.className=`house-map-popup-status house-map-popup-status--${status}`;write('.house-map-popup-status',statusText[status]);
    write('.house-map-popup-coordinates',`${home.lat.toFixed(6)}, ${home.lng.toFixed(6)}`);
    write('.house-map-popup-verification',home.locationVerifiedAt?`ยืนยันจุดบ้านแล้ว${home.locationVerifiedBy?` โดย ${home.locationVerifiedBy}`:''}`:'ยังไม่ยืนยันจุดบ้านกับหน้างาน');
    const hasAccuracy=home.locationSource==='gps'&&hasRadius(home.accuracyM);
    root.querySelector('.house-map-popup-accuracy').hidden=!hasAccuracy;
    write('.house-map-popup-accuracy',hasAccuracy?`GPS รายงานความคลาดเคลื่อนประมาณ ${Math.round(home.accuracyM)} เมตร`:'');
  }

  updateMarker(item,home,status) {
    const position=item.marker.getLatLng();
    if(position.lat!==home.lat||position.lng!==home.lng)item.marker.setLatLng([home.lat,home.lng]);
    const element=item.marker.getElement();
    if(element) {
      Object.assign(element.dataset,{homeId:String(home.id),lat:String(home.lat),lng:String(home.lng),status});
      const pin=element.querySelector('.house-map-pin');
      const classes=`house-map-pin house-map-pin--${status}${home.id===this.selectedId?' house-map-pin--selected':''}${home.locationVerifiedAt?'':' house-map-pin--unverified'}`;
      if(pin&&pin.className!==classes)pin.className=classes;
      const label=`บ้าน ${home.id} ${home.name||''} · ${statusText[status]} · ${home.locationVerifiedAt?'ยืนยันพิกัดแล้ว':'ยังไม่ยืนยันพิกัด'}`;
      if(element.getAttribute('aria-label')!==label)element.setAttribute('aria-label',label);
      element.setAttribute('title',`บ้าน ${home.id} · ${statusText[status]}`);element.setAttribute('role','button');
    }
    if(!item.popup) {
      item.popup=this.popup(home,status);if(!this.compactDetails)item.marker.bindPopup(item.popup,{maxWidth:300,autoPan:false});
    } else {this.updatePopup(item.popup,home,status);if(item.marker.isPopupOpen())item.marker.getPopup().update();}
  }

  update(homes = [], incidents = [], {mode = 'live',selectedId = null} = {}) {
    if(this.destroyed) return;
    this.lastIncidents=incidents;this.incidentStatuses=this.indexIncidents(incidents);
    if(this.mode!==mode) {
      for(const item of this.markers.values())item.marker.remove();
      this.markers.clear();this.homes.clear();this.fitted=false;this.clearUserLocation();
      this.selectionCircle?.remove();this.selectionCircle=null;
      this.mode=mode;
    }
    this.selectedId=selectedId;
    const located=homes.filter(hasPoint), ids=new Set(located.map(home=>home.id));
    for(const [id,item] of this.markers)if(!ids.has(id)){item.marker.remove();this.markers.delete(id);}
    this.homes=new Map(located.map(home=>[home.id,home]));
    for(const home of located) {
      const status=this.homeStatus(home);
      const signature=JSON.stringify([home.id,home.name,home.address,home.lat,home.lng,home.locationVerifiedAt,home.locationVerifiedBy,home.locationSource,home.accuracyM,status,home.id===selectedId]);
      let item=this.markers.get(home.id);
      if(!item) {
        const marker=this.L.marker([home.lat,home.lng],{icon:this.icon(home,status),keyboard:true,title:`บ้าน ${home.id} · ${statusText[status]}`,riseOnHover:true});
        marker.on('click',()=>this.onSelect(home.id));marker.addTo(this.map);
        item={marker,signature:null};this.markers.set(home.id,item);
      }
      if(item.signature!==signature) {this.updateMarker(item,home,status);item.signature=signature;}
    }

    this.drawSelectionRadius();
    if(!this.fitted && located.length) {this.fitHomes();this.fitted=true;}
  }

  drawSelectionRadius() {
    const home=this.homes.get(this.selectedId);
    if(home && home.locationSource==='gps' && hasRadius(home.accuracyM)) {
      if(!this.selectionCircle)this.selectionCircle=this.L.circle([home.lat,home.lng],{radius:home.accuracyM,color:'#2465d7',weight:1,fillOpacity:.08,interactive:false}).addTo(this.map);
      else this.selectionCircle.setLatLng([home.lat,home.lng]).setRadius(home.accuracyM);
    }else{this.selectionCircle?.remove();this.selectionCircle=null;}
  }

  fitHomes(ids=null) {
    if(this.destroyed || !this.homes.size)return false;
    const include=ids==null?null:new Set(ids);
    const points=[...this.homes.values()].filter(home=>!include||include.has(home.id)).map(home=>[home.lat,home.lng]);
    if(!points.length)return false;
    this.map.fitBounds(this.L.latLngBounds(points),{padding:[48,48],maxZoom:17,animate:false});return true;
  }

  setCompactDetails(value) {
    const compact=value===true;if(this.destroyed||compact===this.compactDetails)return;
    this.compactDetails=compact;
    for(const item of this.markers.values()) {
      if(compact)item.marker.unbindPopup();
      else if(item.popup)item.marker.bindPopup(item.popup,{maxWidth:300,autoPan:false});
    }
  }

  focusHome(id) {
    const home=this.homes.get(id), item=this.markers.get(id);
    if(this.destroyed || !home || !item)return false;
    this.update([...this.homes.values()],this.lastIncidents || [],{mode:this.mode,selectedId:id});
    this.map.setView([home.lat,home.lng],18,{animate:!this.reducedMotion()});
    if(!this.compactDetails)item.marker.openPopup();this.drawSelectionRadius();return true;
  }

  setPick({lat,lng,accuracyM = null,pan = true} = {}) {
    if(this.destroyed || !this.onPick)return;
    if(!hasPoint({lat,lng})) {
      this.pickMarker?.remove();this.pickCircle?.remove();this.pickMarker=null;this.pickCircle=null;this.pick=null;return;
    }
    const changed=!pointEqual(this.pick,{lat,lng});this.pick={lat,lng,accuracyM};
    if(!this.pickMarker) {
      const pickerIcon=this.L.divIcon({className:'house-map-picker',html:'<span aria-hidden="true"></span>',iconSize:[32,32],iconAnchor:[16,16]});
      this.pickMarker=this.L.marker([lat,lng],{icon:pickerIcon,draggable:true,keyboard:true,title:'จุดบ้านที่เลือก · ลากเพื่อปรับตำแหน่ง'}).addTo(this.map);
      this.pickMarker.on('dragend',()=>{const point=this.pickMarker.getLatLng();this.setPick({lat:point.lat,lng:point.lng,pan:false});this.onPick({lat:point.lat,lng:point.lng});});
    } else this.pickMarker.setLatLng([lat,lng]);
    const element=this.pickMarker.getElement();
    if(element){Object.assign(element.dataset,{lat:String(lat),lng:String(lng)});element.setAttribute('aria-label','จุดบ้านที่เลือก ลากเพื่อปรับตำแหน่ง หรือกรอกพิกัดในช่องตัวเลข');}
    if(hasRadius(accuracyM)) {
      if(!this.pickCircle)this.pickCircle=this.L.circle([lat,lng],{radius:accuracyM,color:'#2465d7',weight:1,fillOpacity:.12,interactive:false}).addTo(this.map);
      else this.pickCircle.setLatLng([lat,lng]).setRadius(accuracyM);
    }else{this.pickCircle?.remove();this.pickCircle=null;}
    if(changed&&pan)this.map.setView([lat,lng],Math.max(17,this.map.getZoom()),{animate:false});
  }

  zoomIn() {if(!this.destroyed)this.map.zoomIn(1,{animate:!this.reducedMotion()});}
  zoomOut() {if(!this.destroyed)this.map.zoomOut(1,{animate:!this.reducedMotion()});}

  setExpanded(expanded) {
    if(this.destroyed)return;
    this.container.dataset.expanded=String(expanded===true);
    cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame=requestAnimationFrame(()=>{this.layoutFrame=requestAnimationFrame(()=>{this.layoutFrame=0;this.invalidate();});});
  }

  showUserLocation({lat,lng,accuracyM=null}={}) {
    if(this.destroyed||!hasPoint({lat,lng}))return false;
    this.userLocation={lat,lng,accuracyM};
    if(!this.userMarker) {
      this.userMarker=this.L.circleMarker([lat,lng],{radius:8,color:'#ffffff',weight:3,fillColor:'#2465d7',fillOpacity:1,className:'house-map-user-location'}).addTo(this.map);
      const popup=document.createElement('div');popup.className='house-map-user-popup';
      const title=document.createElement('strong');title.textContent='ตำแหน่งของคุณ';popup.append(title);
      const note=document.createElement('p');note.textContent='จุดนี้คือตำแหน่งเครื่องที่เปิดเว็บ ไม่ได้เปลี่ยนพิกัดบ้าน';popup.append(note);this.userMarker.bindPopup(popup,{autoPan:false});
    } else this.userMarker.setLatLng([lat,lng]);
    const element=this.userMarker.getElement();if(element){element.dataset.userLocation='true';element.setAttribute('aria-label','ตำแหน่งของคุณ');}
    if(hasRadius(accuracyM)) {
      if(!this.userCircle)this.userCircle=this.L.circle([lat,lng],{radius:accuracyM,color:'#2465d7',weight:1,fillOpacity:.08,interactive:false,className:'house-map-user-accuracy'}).addTo(this.map);
      else this.userCircle.setLatLng([lat,lng]).setRadius(accuracyM);
    }else{this.userCircle?.remove();this.userCircle=null;}
    this.map.setView([lat,lng],Math.max(this.map.getZoom(),16),{animate:!this.reducedMotion()});this.userMarker.openPopup();return true;
  }

  clearUserLocation() {this.userMarker?.remove();this.userCircle?.remove();this.userMarker=null;this.userCircle=null;this.userLocation=null;}
  invalidate() {if(!this.destroyed){this.map.invalidateSize({pan:false,animate:false});this.publishView();}}

  setRescuePlaces(places,visibleTypes=null){
    const active=places.filter(p=>p.active&&(!visibleTypes||visibleTypes.has(p.type)));
    const signature=JSON.stringify(active);if(signature===this.rescueSignature)return;this.rescueSignature=signature;
    this.rescueLayer?.remove();this.rescueLayer=this.L.layerGroup().addTo(this.map);
    const labels={shelter:'ศูนย์พักพิง',boat:'จุดลงเรือ',hospital:'สถานพยาบาล',hazard:'จุดอันตราย',road_closed:'ถนนปิด'},symbols={shelter:'พ',boat:'ร',hospital:'+',hazard:'!',road_closed:'×'};
    for(const p of active){
      const title=`${labels[p.type]||'จุดกู้ภัย'} · ${p.name}`;
      const icon=this.L.divIcon({className:`rescue-place-marker type-${p.type}`,html:`<span>${symbols[p.type]||'•'}</span>`,iconSize:[32,32],iconAnchor:[16,16]});
      const marker=this.L.marker([p.lat,p.lng],{icon,title,keyboard:true}).addTo(this.rescueLayer);
      marker.bindPopup(`<strong>${escapeHTML(title)}</strong><p>${escapeHTML(p.notes||'')}</p><p>รายงานโดย ${escapeHTML(p.reportedBy)}<br>${escapeHTML(new Date(p.updatedAt||p.reportedAt).toLocaleString('th-TH'))}</p>${p.capacity!=null||p.occupancy!=null?`<p>จำนวนคน ${p.occupancy==null?'ยังไม่รายงาน':p.occupancy} · ความจุ ${p.capacity??'ยังไม่ระบุ'}</p>`:''}${['hazard','road_closed'].includes(p.type)?`<p>เขตรายงานรัศมี ${p.radiusM} เมตร</p>`:''}`);
      marker.on('add',()=>{marker.getElement()?.setAttribute('data-rescue-place-id',p.id);});marker.getElement()?.setAttribute('data-rescue-place-id',p.id);
      if(['hazard','road_closed'].includes(p.type))this.L.circle([p.lat,p.lng],{radius:p.radiusM,color:'#c13c49',fillOpacity:0.08,weight:2,dashArray:'5 5',interactive:false}).addTo(this.rescueLayer);
    }
  }
  focusRescuePlace(place){if(place&&Number.isFinite(place.lat)&&Number.isFinite(place.lng))this.map.setView([place.lat,place.lng],Math.max(16,this.map.getZoom()),{animate:!this.reducedMotion()});}
  setRoute(route,{fit=false,stale=false}={}){
    if(route===this.routeResult&&stale===this.routeStale)return;this.routeResult=route;this.routeStale=stale;this.routeLayer?.remove();this.routeLayer=null;
    this.routeSummaryControl?.remove();this.routeSummaryControl=null;
    if(!route)return;
    this.routeLayer=this.L.geoJSON(route,{style:{color:stale?'#8292a4':'#245bd6',weight:6,opacity:stale?0.6:0.85,dashArray:stale?'7 6':null},interactive:false}).addTo(this.map);
    const summary=route.summary||{},node=this.L.DomUtil.create('div',`route-summary-control ${stale?'is-stale':''}`);
    node.textContent=stale?'ข้อมูลถนนปิดเปลี่ยน · คำนวณเส้นทางใหม่':`${summary.profile==='foot'?'เดินเท้า':'รถยนต์'} · ${(Number(summary.distanceM||0)/1000).toFixed(2)} กม. · ประมาณ ${Math.ceil(Number(summary.durationS||0)/60)} นาที`;
    if(Math.max(summary.startSnapM||0,summary.endSnapM||0)>30){const note=document.createElement('small');note.textContent=`จุดถนนห่างพิกัดเริ่ม ${Math.round(summary.startSnapM||0)} ม. / ปลาย ${Math.round(summary.endSnapM||0)} ม.`;node.append(note);}
    const note=document.createElement('small');note.textContent='ต้องตรวจถนนหน้างานก่อนเดินทาง';node.append(note);
    this.routeSummaryControl=this.L.control({position:'topright'});this.routeSummaryControl.onAdd=()=>node;this.routeSummaryControl.addTo(this.map);
    if(fit&&this.routeLayer.getBounds().isValid())this.map.fitBounds(this.routeLayer.getBounds(),{padding:[35,35],maxZoom:17,animate:!this.reducedMotion()});
  }
  destroy() {
    if(this.destroyed)return;
    cancelAnimationFrame(this.layoutFrame);this.clearUserLocation();this.clearSource();
    this.destroyed=true;this.resizeObserver?.disconnect();
    this.map.off('click',this.clickHandler);this.map.off('moveend zoomend',this.viewHandler);this.map.remove();
    this.markers.clear();this.homes.clear();this.incidentStatuses.clear();this.tiles=null;this.pickMarker=null;this.pickCircle=null;this.selectionCircle=null;
  }
}
