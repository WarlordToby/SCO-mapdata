import { latinName } from './regions.mjs';
import { assembleRings, ccw, signedArea, centroid, simplifyRing, inRing, bboxOf, Grid } from './geom.mjs';

export const ROOFS = ['unknown', 'flat', 'gabled', 'hipped', 'pyramidal', 'skillion', 'half-hipped', 'mansard', 'gambrel', 'dome', 'onion', 'round', 'saltbox', 'cone'];
export const MATERIALS = ['unknown', 'plaster', 'brick', 'stone', 'sandstone', 'concrete', 'glass', 'metal', 'wood', 'timber_framing', 'tiles', 'roof_tiles', 'slate', 'metal_sheet', 'tar_paper', 'gravel', 'grass', 'copper'];
export const USES = ['house', 'apartments', 'retail', 'office', 'industrial', 'warehouse', 'civic', 'school', 'hospital', 'police', 'fire_station', 'religious', 'transport', 'hotel', 'minor', 'military', 'sports', 'unknown', 'farm', 'utility', 'parking', 'university'];
const U = Object.fromEntries(USES.map((u, i) => [u, i]));

const BUILDING_TAG = {
  house: 'house', detached: 'house', semidetached_house: 'house', terrace: 'house', bungalow: 'house', cabin: 'house', residential: 'apartments', apartments: 'apartments', dormitory: 'apartments',
  retail: 'retail', commercial: 'retail', supermarket: 'retail', kiosk: 'retail', office: 'office', industrial: 'industrial', manufacture: 'industrial', warehouse: 'warehouse', storage_tank: 'utility',
  civic: 'civic', public: 'civic', government: 'civic', townhall: 'civic', school: 'school', kindergarten: 'school', college: 'school', university: 'university', hospital: 'hospital', clinic: 'hospital',
  fire_station: 'fire_station', church: 'religious', cathedral: 'religious', chapel: 'religious', mosque: 'religious', synagogue: 'religious', temple: 'religious', religious: 'religious',
  train_station: 'transport', transportation: 'transport', parking: 'parking', hotel: 'hotel', garage: 'minor', garages: 'minor', shed: 'minor', carport: 'minor', hut: 'minor', roof: 'minor', toilets: 'minor',
  military: 'military', bunker: 'military', sports_hall: 'sports', stadium: 'sports', grandstand: 'sports', sports_centre: 'sports', farm: 'farm', barn: 'farm', farm_auxiliary: 'farm', greenhouse: 'farm', stable: 'farm',
  service: 'utility', transformer_tower: 'utility', water_tower: 'utility',
};
const AMENITY = {
  police: 'police', fire_station: 'fire_station', hospital: 'hospital', clinic: 'hospital', doctors: 'hospital', school: 'school', kindergarten: 'school', college: 'school', university: 'university',
  townhall: 'civic', courthouse: 'civic', library: 'civic', post_office: 'civic', place_of_worship: 'religious', parking: 'parking', bus_station: 'transport', restaurant: 'retail', cafe: 'retail', bar: 'retail',
  fast_food: 'retail', pub: 'retail', bank: 'retail', pharmacy: 'retail', fuel: 'retail', cinema: 'retail', theatre: 'civic', marketplace: 'retail', prison: 'civic',
};
// Points of interest the game uses (ambient services, supply, objectives)
export const POI_KINDS = ['police', 'hospital', 'clinic', 'fire_station', 'pharmacy', 'fuel', 'supermarket', 'school', 'townhall', 'prison', 'military', 'train_station', 'bus_station', 'power', 'water', 'radio', 'shelter', 'stadium', 'hardware'];
export function poiKind(t) {
  if (t.amenity === 'police') return 'police';
  if (t.amenity === 'hospital' || t.healthcare === 'hospital') return 'hospital';
  if (t.amenity === 'clinic' || t.amenity === 'doctors') return 'clinic';
  if (t.amenity === 'fire_station') return 'fire_station';
  if (t.amenity === 'pharmacy') return 'pharmacy';
  if (t.amenity === 'fuel') return 'fuel';
  if (t.shop === 'supermarket' || t.shop === 'wholesale') return 'supermarket';
  if (t.shop === 'hardware' || t.shop === 'doityourself') return 'hardware';
  if (['school', 'college', 'university'].includes(t.amenity)) return 'school';
  if (t.amenity === 'townhall') return 'townhall';
  if (t.amenity === 'prison') return 'prison';
  if (t.military || t.landuse === 'military') return 'military';
  if (t.railway === 'station' || t.public_transport === 'station' && t.railway) return 'train_station';
  if (t.amenity === 'bus_station') return 'bus_station';
  if (t.power === 'substation' || t.power === 'plant') return 'power';
  if (t.man_made === 'water_works' || t.man_made === 'water_tower') return 'water';
  if (t.man_made === 'communications_tower' || t.man_made === 'mast' && t['tower:type'] === 'communication') return 'radio';
  if (t.amenity === 'shelter' && t.shelter_type === 'public_shelter' || t.emergency === 'assembly_point') return 'shelter';
  if (t.leisure === 'stadium') return 'stadium';
  return null;
}

const parseNum = v => { if (v == null) return NaN; const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };

export function buildBuildings(osm, P, landuse) {
  const { nodes, ways, rels, tagged } = osm;
  const pt = id => { const n = nodes.get(id); return n ? P.fwd(n[0], n[1]) : null; };
  const ringPts = ids => { const r = []; for (const id of ids) { const p = pt(id); if (!p) return null; r.push(p); } return r; };
  const out = [], usedWays = new Set();
  const isBuilding = t => t.building && t.building !== 'no' && !t['building:part'];

  for (const r of rels) {
    if (!(r.tags.type === 'multipolygon' && isBuilding(r.tags))) continue;
    const outer = assembleRings(r.members.filter(m => m.type === 'w' && m.role !== 'inner' && ways.has(m.ref)).map(m => ways.get(m.ref).refs));
    const inner = assembleRings(r.members.filter(m => m.type === 'w' && m.role === 'inner' && ways.has(m.ref)).map(m => ways.get(m.ref).refs));
    r.members.forEach(m => m.type === 'w' && usedWays.add(m.ref));
    const holes = inner.map(ringPts).filter(Boolean);
    for (const o of outer) { const ring = ringPts(o); if (ring) out.push(mk('r' + r.id, r.tags, ring, holes.filter(h => inRing(h[0], ring)), o)); }
  }
  for (const w of ways.values()) {
    if (!isBuilding(w.tags) || usedWays.has(w.id)) continue;
    const refs = w.refs; if (refs.length < 4 || refs[0] !== refs[refs.length - 1]) continue;
    const ring = ringPts(refs.slice(0, -1)); if (!ring) continue;
    out.push(mk('w' + w.id, w.tags, ring, [], refs));
  }
  function mk(id, tags, ring, holes, refs) {
    ring = simplifyRing(ccw(ring), 0.25);
    holes = holes.map(h => simplifyRing(ccw(h).reverse(), 0.25));
    const a = Math.abs(signedArea(ring)) - holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0);
    return { id, tags, ring, holes, area: a, c: centroid(ring), refs, pois: [] };
  }
  const blds = out.filter(b => b.area >= 6);

  // Attach POI nodes / entrance nodes to the building that contains them
  const g = new Grid(50);
  blds.forEach((b, i) => { b.bb = bboxOf(b.ring); g.insert(b.bb, i); });
  const refSet = new Map(); blds.forEach((b, i) => b.refs.forEach(r => refSet.set(r, i)));
  const freePois = [];
  for (const n of tagged) {
    const p = P.fwd(n.lon, n.lat);
    if (n.tags.entrance && refSet.has(n.id)) { const b = blds[refSet.get(n.id)]; const pri = n.tags.entrance === 'main' ? 2 : 1; if (!b.ent || pri > b.entPri) { b.ent = p; b.entPri = pri; } continue; }
    const k = poiKind(n.tags), interesting = k || n.tags.amenity || n.tags.shop || n.tags.office || n.tags.craft || n.tags.tourism === 'hotel';
    if (!interesting) continue;
    let host = null;
    for (const i of g.query(p[0], p[1])) { const b = blds[i]; if (p[0] < b.bb[0] || p[0] > b.bb[2] || p[1] < b.bb[1] || p[1] > b.bb[3]) continue; if (inRing(p, b.ring)) { host = b; break; } }
    if (host) host.pois.push(n.tags);
    else if (k) freePois.push({ kind: k, p, name: latinName(n.tags) });
  }

  // Local built density (for height estimates of untagged buildings)
  const dens = new Map(), C = 100;
  for (const b of blds) { const k = Math.floor(b.c[0] / C) + ',' + Math.floor(b.c[1] / C); dens.set(k, (dens.get(k) || 0) + b.area); }
  const density = c => { let s = 0; const i0 = Math.floor(c[0] / C), j0 = Math.floor(c[1] / C); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) s += dens.get((i0 + i) + ',' + (j0 + j)) || 0; return s / (9 * C * C); };

  for (const b of blds) {
    const t = b.tags;
    let use = BUILDING_TAG[t.building];
    const tagUse = t.amenity && AMENITY[t.amenity] || t.shop && 'retail' || t.office && 'office' || t.tourism === 'hotel' && 'hotel';
    const poiUse = b.pois.map(p => (p.amenity && AMENITY[p.amenity]) || (p.shop && 'retail') || (p.office && 'office') || (p.tourism === 'hotel' && 'hotel') || null).filter(Boolean);
    const strong = ['police', 'fire_station', 'hospital', 'school', 'university', 'civic', 'religious', 'transport'];
    const strongPoi = poiUse.find(u => strong.includes(u));
    if (strongPoi && (!use || use === 'apartments' || use === 'retail' || use === 'unknown')) use = strongPoi;
    if (!use) use = tagUse || poiUse[0] || null;
    if (!use && landuse) { const lu = landuse(b.c); if (lu) use = { residential: b.area > 260 ? 'apartments' : 'house', commercial: 'office', retail: 'retail', industrial: 'industrial', military: 'military', farmyard: 'farm', railway: 'transport' }[lu] || null; }
    if (!use) use = 'unknown';
    if (use === 'unknown' && b.area < 30) use = 'minor';
    b.use = use;
    b.kinds = [...new Set([poiKind(t), ...b.pois.map(poiKind)].filter(Boolean))];

    // Height
    const d = density(b.c);
    const lv = parseNum(t['building:levels']), rl = parseNum(t['roof:levels']) || 0, h = parseNum(t.height);
    let levels, height, est = false;
    if (Number.isFinite(lv)) levels = Math.max(1, Math.round(lv));
    if (Number.isFinite(h)) height = h;
    if (!levels && height) levels = Math.max(1, Math.round(height / 3.1));
    if (!levels) {
      est = true;
      const byDensity = d > 0.45 ? 5 : d > 0.32 ? 4 : d > 0.2 ? 3 : 2;
      levels = ({ house: Math.min(2, byDensity), apartments: Math.max(4, byDensity + 1), retail: b.area > 2500 ? 1 : Math.min(byDensity + 1, 5), office: Math.max(3, byDensity + 1), industrial: 1, warehouse: 1, school: 3, university: 4, hospital: Math.max(4, byDensity + 1), police: 3, fire_station: 2, civic: 3, religious: 1, transport: 1, hotel: Math.max(4, byDensity), minor: 1, military: 2, sports: 1, farm: 1, utility: 1, parking: 3, unknown: b.area < 80 ? 1 : byDensity })[use] || byDensity;
    }
    if (!height) height = ({ industrial: 9, warehouse: 10, sports: 12, transport: 10, farm: 7, minor: 2.8 })[use] && levels === 1 ? ({ industrial: 9, warehouse: 10, sports: 12, transport: 10, farm: 7, minor: 2.8 })[use]
      : use === 'religious' ? Math.min(45, 12 + Math.sqrt(b.area) * 0.6) : levels * 3.1 + (rl ? rl * 1.6 : 1.2);
    b.levels = levels; b.height = Math.round(height * 10) / 10; b.estH = est;
    // Appearance tags when mapped: roof shape, colours, materials
    const rs = (t['roof:shape'] || '').toLowerCase().replace('_', '-'); b.roof = Math.max(0, ROOFS.indexOf(rs === 'hip' ? 'hipped' : rs));
    const col = v => { if (!v) return ''; const s = String(v).trim().toLowerCase(); return /^#[0-9a-f]{3,6}$/.test(s) || /^[a-z]+$/.test(s) ? s : ''; };
    b.wallCol = col(t['building:colour'] || t['building:color']); b.roofCol = col(t['roof:colour'] || t['roof:color']);
    b.mat = Math.max(0, MATERIALS.indexOf((t['building:material'] || '').toLowerCase())); b.roofMat = Math.max(0, MATERIALS.indexOf((t['roof:material'] || '').toLowerCase()));
    b.roofH = parseNum(t['roof:height']) || 0;

    // Occupancy (night residents / day workers)
    const floor = b.area * levels;
    b.res = use === 'house' ? Math.max(1, Math.min(5, Math.round(floor * 0.5 / 45))) : use === 'apartments' ? Math.max(2, Math.round(floor * 0.7 / 45)) : use === 'unknown' && d > 0.25 ? Math.round(floor * 0.35 / 45) : 0;
    b.jobs = Math.round(floor / ({ retail: 70, office: 35, industrial: 100, warehouse: 200, school: 20, university: 25, hospital: 35, police: 35, fire_station: 60, civic: 50, hotel: 60, transport: 60, military: 50, apartments: 800, house: 1e9, unknown: 400 }[use] || 1e9));
    b.name = latinName(t) || latinName(b.pois.find(p => p.name)) || '';
    const hn = t['addr:housenumber'] || b.pois.find(p => p['addr:housenumber'])?.['addr:housenumber'], st = t['addr:street'] || b.pois.find(p => p['addr:street'])?.['addr:street'];
    b.addr = hn && st ? `${hn} ${st}` : st || '';
  }
  return { buildings: blds, freePois };
}
export { U as USE_CODE };
