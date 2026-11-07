// Compiles an OSM area (OPL) + elevation into an SCO city map pack.
// usage: node compiler/compile.mjs --work work/ --out packs/ [--slug strasbourg] [--tile 1000]
import fs from 'node:fs';
import path from 'node:path';
import { readOPL } from './opl.mjs';
import { makeProj, assembleRings, ccw, simplifyRing, simplify, clipRing, inRing, bboxOf, Grid, segDist, signedArea } from './geom.mjs';
import { buildBuildings, USES, POI_KINDS, ROOFS, MATERIALS } from './buildings.mjs';
import { buildRoads, CLASSES, CTRL, TURN, FLAG } from './roads.mjs';
import { loadTerrain } from './terrain.mjs';
import { buildBarriers, BARRIER_KINDS, BARRIER_PROPS } from './barriers.mjs';

export const PACK_VERSION = 1;
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const work = path.resolve(args.work || 'work');
const area = JSON.parse(fs.readFileSync(path.join(work, 'area.json'), 'utf8'));
const slug = args.slug || area.city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const TILE = +(args.tile || 1000);
const outDir = path.resolve(args.out || 'packs', slug);
const t0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const P = makeProj(area.lon, area.lat);
const R = area.radiusKm * 1000;
log(`Reading OSM data for ${area.city}…`);
const osm = await readOPL(path.join(work, 'area.opl'));
log(`  ${osm.nodes.size} nodes, ${osm.ways.size} ways, ${osm.rels.length} relations`);

// ---------- Areas (land use, water, parks) ----------
const AREA_KINDS = ['residential', 'commercial', 'retail', 'industrial', 'military', 'railway', 'farmland', 'forest', 'grass', 'park', 'cemetery', 'water', 'wetland', 'sports', 'parking', 'construction', 'allotments', 'farmyard', 'beach', 'scrub'];
function areaKind(t) {
  if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin' || t.water) return 'water';
  if (t.natural === 'wetland') return 'wetland';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'forest';
  if (t.natural === 'scrub' || t.natural === 'heath') return 'scrub';
  if (t.natural === 'beach' || t.natural === 'sand') return 'beach';
  if (t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'nature_reserve') return 'park';
  if (['pitch', 'stadium', 'sports_centre', 'track', 'playground', 'golf_course'].includes(t.leisure)) return 'sports';
  if (t.amenity === 'parking' && t.parking !== 'underground' && t.parking !== 'multi-storey') return 'parking';
  if (t.landuse === 'cemetery' || t.amenity === 'grave_yard') return 'cemetery';
  const lu = { residential: 'residential', commercial: 'commercial', retail: 'retail', industrial: 'industrial', military: 'military', railway: 'railway', farmland: 'farmland', meadow: 'grass', grass: 'grass', village_green: 'grass', recreation_ground: 'park', orchard: 'farmland', vineyard: 'farmland', construction: 'construction', brownfield: 'construction', allotments: 'allotments', farmyard: 'farmyard', greenfield: 'grass', plant_nursery: 'farmland', religious: 'residential', education: 'commercial', institutional: 'commercial' }[t.landuse];
  if (lu) return lu;
  if (t.natural === 'grassland') return 'grass';
  return null;
}
const areas = [];
const nodePt = id => { const n = osm.nodes.get(id); return n ? P.fwd(n[0], n[1]) : null; };
const ringOf = ids => { const r = []; for (const id of ids) { const p = nodePt(id); if (!p) return null; r.push(p); } return r; };
for (const r of osm.rels) {
  if (r.tags.type !== 'multipolygon') continue; const k = areaKind(r.tags); if (!k) continue;
  const outer = assembleRings(r.members.filter(m => m.type === 'w' && m.role !== 'inner' && osm.ways.has(m.ref)).map(m => osm.ways.get(m.ref).refs));
  const inner = assembleRings(r.members.filter(m => m.type === 'w' && m.role === 'inner' && osm.ways.has(m.ref)).map(m => osm.ways.get(m.ref).refs)).map(ringOf).filter(Boolean);
  for (const o of outer) { const ring = ringOf(o); if (ring) areas.push({ kind: k, ring: ccw(ring), holes: inner.filter(h => inRing(h[0], ring)) }); }
}
for (const w of osm.ways.values()) {
  const k = areaKind(w.tags); if (!k || w.tags.building) continue;
  if (w.refs.length < 4 || w.refs[0] !== w.refs[w.refs.length - 1]) continue;
  const ring = ringOf(w.refs.slice(0, -1)); if (ring) areas.push({ kind: k, ring: ccw(ring), holes: [] });
}
log(`  ${areas.length} land-use / water areas`);
const luGrid = new Grid(200);
const luAreas = areas.filter(a => ['residential', 'commercial', 'retail', 'industrial', 'military', 'farmyard', 'railway'].includes(a.kind));
luAreas.forEach((a, i) => { a.bb = bboxOf(a.ring); luGrid.insert(a.bb, i); });
const landuseAt = p => { for (const i of luGrid.query(p[0], p[1])) { const a = luAreas[i]; if (p[0] >= a.bb[0] && p[0] <= a.bb[2] && p[1] >= a.bb[1] && p[1] <= a.bb[3] && inRing(p, a.ring)) return a.kind; } return null; };

// ---------- Buildings ----------
log('Compiling buildings…');
const { buildings, freePois } = buildBuildings(osm, P, landuseAt);
log(`  ${buildings.length} buildings, ${freePois.length} stand-alone service points`);

// ---------- Roads ----------
log('Compiling road network…');
const roads = buildRoads(osm, P);
log(`  ${JSON.stringify(roads.stats)}`);

// ---------- Rail, tram, waterway lines ----------
const LINE_KINDS = ['rail', 'tram', 'light_rail', 'subway', 'river', 'canal', 'stream'];
const lines = [];
for (const w of osm.ways.values()) {
  const t = w.tags; let k = null;
  if (['rail', 'tram', 'light_rail', 'subway'].includes(t.railway) && t.service !== 'yard') k = t.railway;
  else if (['river', 'canal', 'stream'].includes(t.waterway)) k = t.waterway;
  if (!k) continue;
  const pts = ringOf(w.refs); if (!pts || pts.length < 2) continue;
  lines.push({ kind: k, pts, tunnel: t.tunnel && t.tunnel !== 'no', bridge: t.bridge && t.bridge !== 'no', name: t.name || '' });
}

// ---------- Districts ----------
const districts = osm.tagged.filter(n => ['suburb', 'quarter', 'neighbourhood', 'borough', 'village', 'town', 'hamlet'].includes(n.tags.place) && n.tags.name)
  .map(n => { const p = P.fwd(n.lon, n.lat); return { name: n.tags.name, kind: n.tags.place, x: Math.round(p[0]), y: Math.round(p[1]) }; })
  .filter(d => Math.abs(d.x) < R * 1.1 && Math.abs(d.y) < R * 1.1);
// Prefer quarters/suburbs over tiny neighbourhoods when both exist nearby
const rank = { borough: 0, suburb: 1, town: 1, quarter: 2, village: 2, neighbourhood: 3, hamlet: 3 };
districts.sort((a, b) => rank[a.kind] - rank[b.kind]);
const dKeep = [];
for (const d of districts) if (!dKeep.some(k => rank[k.kind] < rank[d.kind] && Math.hypot(k.x - d.x, k.y - d.y) < 350)) dKeep.push(d);
// Administrative sub-divisions (quarters/wards) are preferred when mapped; place nodes are the fallback.
const bounds = [];
for (const r of osm.rels) {
  if (r.tags.type !== 'boundary' && !(r.tags.type === 'multipolygon' && r.tags.boundary)) continue;
  if (r.tags.boundary !== 'administrative' || !r.tags.name) continue;
  const lvl = +r.tags.admin_level; if (!(lvl >= 9)) continue;
  const rings = assembleRings(r.members.filter(m => m.type === 'w' && m.role !== 'inner' && osm.ways.has(m.ref)).map(m => osm.ways.get(m.ref).refs)).map(ringOf).filter(Boolean);
  if (rings.length) bounds.push({ name: r.tags.name, lvl, rings });
}
const byLvl = {}; bounds.forEach(b => (byLvl[b.lvl] = byLvl[b.lvl] || []).push(b));
const lvlPick = Object.keys(byLvl).map(Number).sort((a, b) => a - b).find(l => byLvl[l].filter(b => b.rings.some(r => Math.abs(signedArea(r)) > 2e4 && inRing([0, 0], r) || b.rings.some(rr => rr.some(([x, y]) => Math.abs(x) < R && Math.abs(y) < R)))).length >= 4);
let adminD = null;
if (lvlPick) {
  adminD = byLvl[lvlPick].filter(b => b.rings.some(r => r.some(([x, y]) => Math.abs(x) < R * 1.2 && Math.abs(y) < R * 1.2)));
  adminD.forEach(b => { b.bb = b.rings.map(bboxOf); let big = b.rings.reduce((a, r) => (Math.abs(signedArea(r)) > Math.abs(signedArea(a)) ? r : a)); const c = centroidOf(big); b.x = Math.round(c[0]); b.y = Math.round(c[1]); });
  const places = dKeep.splice(0).filter(d => !adminD.some(b => b.rings.some(r => inRing([d.x, d.y], r))));
  adminD.forEach(b => dKeep.push({ name: b.name, kind: 'admin_level_' + lvlPick, x: b.x, y: b.y }));
  places.forEach(d => dKeep.push({ ...d, fromPlace: true }));
}
function centroidOf(r) { let x = 0, y = 0; r.forEach(p => { x += p[0]; y += p[1]; }); return [x / r.length, y / r.length]; }
const nearestDistrict = p => {
  if (adminD) for (let i = 0; i < adminD.length; i++) { const b = adminD[i]; for (let k = 0; k < b.rings.length; k++) { const bb = b.bb[k]; if (p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3] && inRing(p, b.rings[k])) return i; } }
  return nearestPlace(p);
};
const nearestPlace = p => { const off = adminD ? adminD.length : 0; let b = -1, bd = Infinity; for (let i = off; i < dKeep.length; i++) { const d = dKeep[i], dd = (d.x - p[0]) ** 2 + (d.y - p[1]) ** 2; if (dd < bd) { bd = dd; b = i; } } return b >= 0 ? b : nearestPlace0(p); };
const nearestPlace0 = p => { let b = -1, bd = Infinity; dKeep.forEach((d, i) => { const dd = (d.x - p[0]) ** 2 + (d.y - p[1]) ** 2; if (dd < bd) { bd = dd; b = i; } }); return b; };
log(`  ${dKeep.length} named districts (${adminD ? 'admin_level ' + lvlPick : 'place names'})`);

// ---------- Entrances: buildings without mapped entrances face their nearest street ----------
const rg = new Grid(60);
roads.edges.forEach(e => { for (let i = 1; i < e.pts.length; i++) rg.insert(bboxOf([e.pts[i - 1], e.pts[i]]), [e.id, i]); });
for (const b of buildings) {
  b.district = nearestDistrict(b.c);
  if (b.ent) continue;
  let best = null, bd = 80;
  for (const [eid, i] of rg.query(b.c[0], b.c[1], 80)) { const e = roads.edges[eid]; if (e.cls >= 11 && !(e.flags & FLAG.walk)) continue; const s = segDist(b.c, e.pts[i - 1], e.pts[i]); if (s.d < bd) { bd = s.d; best = s.q; } }
  if (!best) { b.ent = b.ring[0]; continue; }
  // point on footprint closest to the street
  let pb = null, pd = Infinity;
  for (let i = 0; i < b.ring.length; i++) { const s = segDist(best, b.ring[i], b.ring[(i + 1) % b.ring.length]); if (s.d < pd) { pd = s.d; pb = s.q; } }
  b.ent = pb; b.entStreet = Math.round(bd);
}

// ---------- Barriers (fences, walls, hedges; property fences from the cadastre) ----------
log('Compiling barriers…');
const barriers = buildBarriers(osm, P, { roads, buildings, landuseAt, cadastreFiles: (area.cadastre || []).map(f => path.join(work, f)), R, log });
log(`  ${JSON.stringify(barriers.stats)}`);

// ---------- Terrain ----------
log('Sampling terrain…');
const terrain = await loadTerrain(area.dem.map(f => path.join(work, f)), P, R);
for (const b of buildings) b.z = terrain.at(b.c[0], b.c[1]);
for (const j of roads.junctions) j.z = j.p ? terrain.at(j.p[0], j.p[1]) : 0;

// ---------- Tiling ----------
const nT = Math.ceil(R / TILE);
const tiles = new Map();
const tileKey = (x, y) => `${Math.floor(x / TILE)}_${Math.floor(y / TILE)}`;
const tile = k => { let t = tiles.get(k); if (!t) { const [i, j] = k.split('_').map(Number); t = { i, j, b: [], e: [], jn: [], a: [], l: [], p: [], tr: [], lm: [], br: [] }; tiles.set(k, t); } return t; };
const inside = (x, y) => Math.abs(x) <= nT * TILE && Math.abs(y) <= nT * TILE;
buildings.forEach(b => { if (inside(b.c[0], b.c[1])) tile(tileKey(b.c[0], b.c[1])).b.push(b); });
roads.edges.forEach(e => { const m = e.pts[Math.floor(e.pts.length / 2)]; if (inside(m[0], m[1])) tile(tileKey(m[0], m[1])).e.push(e); });
roads.junctions.forEach((j, id) => { j.id = id; if (j.p && inside(j.p[0], j.p[1])) tile(tileKey(j.p[0], j.p[1])).jn.push(j); });
for (const a of areas) {
  const [x0, y0, x1, y1] = bboxOf(a.ring);
  for (let i = Math.floor(x0 / TILE); i <= Math.floor(x1 / TILE); i++) for (let j = Math.floor(y0 / TILE); j <= Math.floor(y1 / TILE); j++) {
    if (Math.abs(i + .5) * TILE > nT * TILE || Math.abs(j + .5) * TILE > nT * TILE) continue;
    const rect = [i * TILE, j * TILE, (i + 1) * TILE, (j + 1) * TILE];
    const c = clipRing(a.ring, rect); if (c.length < 3 || Math.abs(signedArea(c)) < 20) continue;
    tile(`${i}_${j}`).a.push({ kind: a.kind, ring: simplifyRing(c, 0.8), holes: a.holes.map(h => clipRing(h, rect)).filter(h => h.length >= 3) });
  }
}
for (const ln of lines) for (let s = 1; s < ln.pts.length; s++) {
  const a = ln.pts[s - 1], b = ln.pts[s], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (!inside(m[0], m[1])) continue;
  const t = tile(tileKey(m[0], m[1])); const last = t.l[t.l.length - 1];
  if (last && last.src === ln && last.pts[last.pts.length - 1] === a) last.pts.push(b); else t.l.push({ src: ln, kind: ln.kind, pts: [a, b], tunnel: ln.tunnel, bridge: ln.bridge, name: ln.name });
}
for (const p of freePois) if (inside(p.p[0], p.p[1])) tile(tileKey(p.p[0], p.p[1])).p.push(p);
for (const pc of barriers.pieces) { const m = [(pc.pts[0][0] + pc.pts[1][0]) / 2, (pc.pts[0][1] + pc.pts[1][1]) / 2]; if (inside(m[0], m[1])) tile(tileKey(m[0], m[1])).br.push(pc); }
// Trees (individually mapped trees and tree rows) and street lamps
const TREE_KINDS = ['broadleaved', 'needleleaved', 'palm'];
const treeKind = t => t.leaf_type === 'needleleaved' ? 1 : t.leaf_type === 'palm' ? 2 : 0;
let nTrees = 0, nLamps = 0;
for (const n of osm.tagged) {
  if (n.tags.natural === 'tree') { const p = P.fwd(n.lon, n.lat); if (inside(p[0], p[1])) { tile(tileKey(p[0], p[1])).tr.push({ p, kind: treeKind(n.tags), h: parseFloat(n.tags.height) || 0 }); nTrees++; } }
  else if (n.tags.highway === 'street_lamp') { const p = P.fwd(n.lon, n.lat); if (inside(p[0], p[1])) { tile(tileKey(p[0], p[1])).lm.push(p); nLamps++; } }
}
for (const w of osm.ways.values()) {
  if (w.tags.natural !== 'tree_row') continue; const pts = ringOf(w.refs); if (!pts) continue;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < L; s += 9) { const p = [a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L]; if (inside(p[0], p[1])) { tile(tileKey(p[0], p[1])).tr.push({ p, kind: treeKind(w.tags), h: 0 }); nTrees++; } } }
}
log(`  ${nTrees} trees, ${nLamps} street lamps`);

// ---------- Write ----------
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'tiles'), { recursive: true });
const dm = v => Math.round(v * 10);
// Rings/lines are delta-encoded: first vertex relative to tile origin, then differences to the previous vertex.
const delta = flat => { const o = flat.slice(); for (let i = flat.length - 2; i >= 2; i -= 2) { o[i] = flat[i] - flat[i - 2]; o[i + 1] = flat[i + 1] - flat[i - 1]; } return o; };
const osmId = s => (s[0] === 'w' ? +s.slice(1) : -s.slice(1));
const USE = Object.fromEntries(USES.map((u, i) => [u, i])), AK = Object.fromEntries(AREA_KINDS.map((k, i) => [k, i])), LK = Object.fromEntries(LINE_KINDS.map((k, i) => [k, i]));
const tileMeta = []; let totalBytes = 0;
for (const [k, t] of [...tiles].sort()) {
  const ox = t.i * TILE, oy = t.j * TILE;
  const rel = p => [dm(p[0] - ox), dm(p[1] - oy)];
  const B = { n: t.b.length, id: [], use: [], lv: [], h: [], z: [], dist: [], res: [], jobs: [], est: [], ent: [], name: {}, addr: {}, kinds: {}, holes: {}, roof: [], col: {}, rcol: {}, mat: {}, rmat: {}, rh: {}, rs: [], pts: [] };
  t.b.forEach((b, i) => {
    B.id.push(osmId(b.id)); B.use.push(USE[b.use]); B.lv.push(b.levels); B.h.push(dm(b.height)); B.z.push(dm(b.z)); B.dist.push(b.district); B.res.push(b.res); B.jobs.push(b.jobs); B.est.push(b.estH ? 1 : 0);
    B.roof.push(b.roof); if (b.wallCol) B.col[i] = b.wallCol; if (b.roofCol) B.rcol[i] = b.roofCol; if (b.mat) B.mat[i] = b.mat; if (b.roofMat) B.rmat[i] = b.roofMat; if (b.roofH) B.rh[i] = dm(b.roofH);
    B.ent.push(...rel(b.ent)); if (b.name) B.name[i] = b.name; if (b.addr) B.addr[i] = b.addr; if (b.kinds.length) B.kinds[i] = b.kinds.map(x => POI_KINDS.indexOf(x));
    if (b.holes.length) B.holes[i] = b.holes.map(h => delta(h.flatMap(rel)));
    B.rs.push(B.pts.length / 2, b.ring.length); B.pts.push(...delta(b.ring.flatMap(rel)));
  });
  const E = { n: t.e.length, id: [], a: [], b: [], cls: [], lf: [], lb: [], spd: [], flags: [], layer: [], len: [], name: {}, turnF: {}, turnB: {}, ps: [], pts: [] };
  t.e.forEach((e, i) => {
    E.id.push(e.id); E.a.push(e.a); E.b.push(e.b); E.cls.push(e.cls); E.lf.push(e.lf); E.lb.push(e.lb); E.spd.push(e.speed); E.flags.push(e.flags); E.layer.push(e.layer); E.len.push(dm(e.len));
    if (e.name) E.name[i] = e.name; if (e.turnF) E.turnF[i] = e.turnF; if (e.turnB) E.turnB[i] = e.turnB;
    const pts = simplify(e.pts, 0.3); E.ps.push(E.pts.length / 2, pts.length); E.pts.push(...delta(pts.flatMap(rel)));
  });
  const J = { n: t.jn.length, id: [], x: [], y: [], z: [], ctrl: [], inc: [], yield: [], conn: [], phases: {} };
  t.jn.forEach((j, i) => {
    J.id.push(j.id); const r = rel(j.p); J.x.push(r[0]); J.y.push(r[1]); J.z.push(dm(j.z)); J.ctrl.push(j.ctrl);
    J.inc.push(j.inc.map(a => [a.e, a.dir])); J.yield.push(j.yieldTo || []);
    J.conn.push((j.conn || []).map(ci => roads.conn[ci]));
    if (j.phases) J.phases[i] = j.phases.map(p => ({ g: p.green.map(ci => j.conn.indexOf(ci)), d: p.dur, y: p.yellow, r: p.allRed }));
  });
  const A = { kind: [], holes: {}, rs: [], pts: [] };
  t.a.forEach((a, i) => { A.kind.push(AK[a.kind]); A.rs.push(A.pts.length / 2, a.ring.length); A.pts.push(...delta(a.ring.flatMap(rel))); if (a.holes.length) A.holes[i] = a.holes.map(h => delta(h.flatMap(rel))); });
  const L = { kind: [], flags: [], name: {}, ps: [], pts: [] };
  t.l.forEach((l, i) => { L.kind.push(LK[l.kind]); L.flags.push((l.tunnel ? 1 : 0) | (l.bridge ? 2 : 0)); if (l.name) L.name[i] = l.name; L.ps.push(L.pts.length / 2, l.pts.length); L.pts.push(...delta(l.pts.flatMap(rel))); });
  const BK = Object.fromEntries(BARRIER_KINDS.map((k, i) => [k, i]));
  const BR = { kind: [], h: [], src: [], ps: [], pts: [] };
  t.br.forEach(pc => { BR.kind.push(BK[pc.kind]); BR.h.push(dm(pc.h)); BR.src.push(pc.src); BR.ps.push(BR.pts.length / 2, pc.pts.length); BR.pts.push(...delta(pc.pts.flatMap(rel))); });
  const POI = t.p.map(p => [POI_KINDS.indexOf(p.kind), ...rel(p.p), p.name]);
  const TREES = t.tr.flatMap(tr => [...rel(tr.p), tr.kind, dm(tr.h)]), LAMPS = t.lm.flatMap(l => rel(l));
  const terr = terrain.tile(ox, oy, TILE, 25);
  const json = JSON.stringify({ v: PACK_VERSION, key: k, origin: [ox, oy], buildings: B, roads: E, junctions: J, areas: A, lines: L, pois: POI, trees: TREES, lamps: LAMPS, barriers: BR, terrain: terr });
  fs.writeFileSync(path.join(outDir, 'tiles', k + '.json'), json);
  totalBytes += json.length;
  const svc = {}; t.b.forEach(b => b.kinds.forEach(x => svc[x] = (svc[x] || 0) + 1)); t.p.forEach(p => svc[p.kind] = (svc[p.kind] || 0) + 1);
  tileMeta.push({ key: k, i: t.i, j: t.j, buildings: t.b.length, edges: t.e.length, residents: t.b.reduce((s, b) => s + b.res, 0), jobs: t.b.reduce((s, b) => s + b.jobs, 0), services: svc, bytes: json.length });
}
const packB = [...tiles.values()].flatMap(t => t.b), packE = [...tiles.values()].reduce((a, t) => a + t.e.length, 0), packJ = [...tiles.values()].reduce((a, t) => a + t.jn.length, 0);
const manifest = {
  format: 'sco-citypack', version: PACK_VERSION, slug, name: area.city, displayName: area.displayName, country: area.country,
  center: { lon: area.lon, lat: area.lat }, radiusKm: area.radiusKm, tileSize: TILE, grid: { min: -nT, max: nT - 1 },
  projection: { type: 'local-equirectangular', origin: [area.lon, area.lat], metresPerDegLon: P.kx, metresPerDegLat: P.ky, units: 'Geometry in tiles is integer decimetres relative to each tile origin (origin itself in metres). x east, y north. Every ring/polyline in pts/holes is delta-encoded: first vertex absolute, each next vertex as difference from the previous.' },
  formatMinor: 2, codes: { barrier: BARRIER_KINDS, barrierProps: BARRIER_PROPS, roof: ROOFS, material: MATERIALS, tree: ['broadleaved', 'needleleaved', 'palm'], use: USES, poi: POI_KINDS, roadClass: CLASSES, control: CTRL, turn: TURN, roadFlags: FLAG, area: AREA_KINDS, line: LINE_KINDS },
  schema: {
    buildings: 'columnar; id = OSM way id (negative = relation id); rs = [start,len] pairs into pts (x,y dm); ent = entrance x,y; h/z in dm; res = night residents, jobs = day occupants; est=1 when height was estimated',
    roads: 'columnar edges between global junction ids a→b; lf/lb lanes forward/backward; flags = roadFlags bitmask; ps = [start,len] into pts',
    junctions: 'inc = approaches [edge,dir]; yield aligned with inc (1 = must yield); conn = [fromEdge,fromDir,fromLane,toEdge,toDir,toLane,turn], lane 0 = rightmost; phases[i] = [{g: indices into conn, d: green s, y: amber s, r: all-red s}]',
    barriers: 'columnar polylines: kind = codes.barrier, h = height dm, src 0 = OpenStreetMap, 1 = generated from cadastre parcel boundaries; ps = [start,len] into pts. Openings (gates, crossings) are gaps between polylines. barrierProps.brk: 1 any vehicle can flatten, 2 medium/heavy armour only, 3 unbreakable',
    trees: 'flat [x, y, kind, heightDm] per tree (height 0 = unknown)', lamps: 'flat [x, y] per street lamp', appearance: 'buildings.roof = roof shape code (0 unknown); col/rcol = mapped building/roof colour; mat/rmat = material codes; rh = roof height dm',
    terrain: 'n×n int16 samples (base64, little-endian) every step metres from tile origin, value×scale = metres',
  },
  districts: dKeep, tiles: tileMeta,
  stats: { buildings: packB.length, buildingsWithEstimatedHeight: packB.filter(b => b.estH).length, residents: packB.reduce((s, b) => s + b.res, 0), jobs: packB.reduce((s, b) => s + b.jobs, 0), edges: packE, junctions: packJ, signals: roads.stats.signals, connections: roads.stats.connections, restrictions: roads.stats.restrictions, areas: areas.length, lines: lines.length, terrain: terrain.info, barriers: barriers.stats, bytes: totalBytes },
  sources: { osm: area.extracts, dem: area.dem, attribution: '© OpenStreetMap contributors (ODbL 1.0). Elevation: Copernicus DEM GLO-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA.' + ((area.cadastre || []).length ? ' Property boundaries: Plan cadastral © DGFiP / Etalab, Licence Ouverte 2.0.' : '') },
  fetchedAt: area.fetchedAt, compiledAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
// Pack index
const idxFile = path.join(path.dirname(outDir), 'index.json');
let idx = []; try { idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')); } catch { }
idx = idx.filter(p => p.slug !== slug);
idx.push({ slug, name: area.city, country: area.country, lat: area.lat, lon: area.lon, radiusKm: area.radiusKm, tiles: tileMeta.length, buildings: packB.length, residents: manifest.stats.residents, bytes: totalBytes, compiledAt: manifest.compiledAt });
fs.writeFileSync(idxFile, JSON.stringify(idx.sort((a, b) => a.slug.localeCompare(b.slug)), null, 1));
log(`Wrote ${tileMeta.length} tiles, ${(totalBytes / 1e6).toFixed(1)} MB → ${outDir}`);
log(JSON.stringify(manifest.stats));
