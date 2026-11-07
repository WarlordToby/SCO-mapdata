// Barriers: fences, walls, hedges and the like, as polylines with a kind and a height.
//  · OSM barrier ways, cut open where a gate or a road/path passes through them.
//  · Property fences from the French cadastre (Etalab parcels): lots holding houses or small apartment buildings are fenced
//    along their boundary. The street side gets a low front fence with a gate opening (or a driveway gap where a mapped
//    driveway crosses), the sides and back a tall fence or hedge. Stretches along building walls, and stretches already
//    covered by an OSM barrier, are left out.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { ccw, inRing, bboxOf, Grid, segDist, signedArea } from './geom.mjs';

export const BARRIER_KINDS = ['fence', 'chain', 'wood', 'railing', 'wire', 'hedge', 'wall', 'muret', 'retaining', 'jersey', 'guard', 'city_wall'];
// h: default height m · brk: what can flatten it (1 any vehicle, 2 medium/heavy armour, 3 nothing)
export const BARRIER_PROPS = {
  fence: { h: 1.8, brk: 1 }, chain: { h: 1.8, brk: 1 }, wood: { h: 1.8, brk: 1 }, railing: { h: 1.1, brk: 1 }, wire: { h: 1.2, brk: 1 }, hedge: { h: 1.6, brk: 1 },
  wall: { h: 2.0, brk: 2 }, muret: { h: 1.2, brk: 2 }, retaining: { h: 1.5, brk: 3 }, jersey: { h: 0.8, brk: 2 }, guard: { h: 0.75, brk: 1 }, city_wall: { h: 5, brk: 3 },
};
const LINE = new Set(['fence', 'wall', 'hedge', 'retaining_wall', 'city_wall', 'jersey_barrier', 'guard_rail', 'wire_fence', 'hedge_bank', 'handrail', 'railing']);
const GATE = new Set(['gate', 'entrance', 'kissing_gate', 'swing_gate', 'lift_gate', 'sliding_gate', 'stile', 'turnstile', 'full-height_turnstile', 'hampshire_gate', 'cattle_grid', 'wicket_gate', 'bump_gate', 'yes']);
const ROAD_W = [10, 9, 8, 7, 7, 6, 6, 5, 3.5, 3, 4, 1.6, 2, 1.6]; // by road class index

const num = v => { if (!v) return 0; const m = String(v).replace(',', '.').match(/[\d.]+/); if (!m) return 0; let x = +m[0]; if (/cm/.test(v)) x /= 100; return x > 0 && x < 30 ? x : 0; };
function osmKind(t) {
  const b = t.barrier, ft = (t.fence_type || '').toLowerCase();
  let k;
  if (b === 'hedge' || b === 'hedge_bank') k = 'hedge';
  else if (b === 'wall') k = 'wall';
  else if (b === 'retaining_wall') k = 'retaining';
  else if (b === 'city_wall') k = 'city_wall';
  else if (b === 'jersey_barrier') k = 'jersey';
  else if (b === 'guard_rail') k = 'guard';
  else if (b === 'handrail' || b === 'railing') k = 'railing';
  else if (b === 'wire_fence') k = 'wire';
  else if (b === 'fence') {
    if (/chain|mesh|metal$|wire_mesh|net/.test(ft)) k = 'chain';
    else if (/wood|board|panel|palisade|bamboo|willow|privacy/.test(ft)) k = 'wood';
    else if (/railing|bars|picket|split_rail|metal_bars|pale|guard/.test(ft)) k = 'railing';
    else if (/wire|barbed|electric|pole|rope|chain$/.test(ft)) k = 'wire';
    else if (/concrete|brick|stone/.test(ft)) k = 'wall';
    else if (/hedge/.test(ft)) k = 'hedge';
    else k = 'fence';
  } else return null;
  let h = num(t.height) || BARRIER_PROPS[k].h;
  if (k === 'railing' && /metal_bars/.test(ft) && !num(t.height)) h = 1.8;
  return { kind: k, h };
}

// split a polyline, removing [s0,s1] distance intervals
function cutPolyline(pts, cuts) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1]; if (L < 0.5) return [];
  const iv = cuts.map(([a, b]) => [Math.max(0, a), Math.min(L, b)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const keep = []; let s = 0;
  for (const [a, b] of iv) { if (a > s) keep.push([s, a]); s = Math.max(s, b); }
  if (s < L) keep.push([s, L]);
  const at = d => { let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; };
  const out = [];
  for (const [a, b] of keep) {
    if (b - a < 0.6) continue;
    const pl = [at(a)]; for (let i = 1; i < pts.length - 1; i++) if (cum[i] > a && cum[i] < b) pl.push(pts[i]); pl.push(at(b));
    out.push(pl);
  }
  return out;
}
function segX(a, b, c, d) { // intersection parameter on ab (or -1)
  const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], den = r0 * s1 - r1 * s0;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den, u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; };
const pick = (r, table) => { let acc = 0; for (const [v, w] of table) { acc += w; if (r < acc) return v; } return table[table.length - 1][0]; };

export function buildBarriers(osm, P, { roads, buildings, landuseAt, cadastreFiles, R, log }) {
  const pieces = [];
  const stats = { osmWays: 0, osmPieces: 0, gates: 0, parcels: 0, fencedLots: 0, propertyPieces: 0, propertyMetres: 0, osmMetres: 0 };
  const nodePt = id => { const n = osm.nodes.get(id); return n ? P.fwd(n[0], n[1]) : null; };
  const barrierNode = new Map(); for (const n of osm.tagged) if (n.tags.barrier) barrierNode.set(n.id, n.tags);
  const roadNodeW = new Map(); for (const e of roads.edges) { const w = e.width || ROAD_W[e.cls] || 3; for (const r of e.refs || []) roadNodeW.set(r, Math.max(roadNodeW.get(r) || 0, w)); }

  // ---- OSM barrier ways ----
  for (const w of osm.ways.values()) {
    const t = w.tags; if (!LINE.has(t.barrier) || t.building) continue;
    const k = osmKind(t); if (!k) continue;
    const pts = [], ids = []; for (const id of w.refs) { const p = nodePt(id); if (p) { pts.push(p); ids.push(id); } }
    if (pts.length < 2) continue;
    if (Math.abs(pts[0][0]) > R * 1.1 && Math.abs(pts[0][1]) > R * 1.1) continue;
    stats.osmWays++;
    const cuts = []; let d = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const bt = barrierNode.get(ids[i]), rw = roadNodeW.get(ids[i]);
      let gw = 0;
      if (bt && GATE.has(bt.barrier) && bt.locked !== 'yes') { gw = num(bt.width) || (/lift|swing|sliding/.test(bt.barrier) || rw >= 3 ? Math.max(3.5, rw || 0) : 1.2); stats.gates++; }
      if (rw) gw = Math.max(gw, rw + 0.4);
      if (gw) cuts.push([d - gw / 2, d + gw / 2]);
    }
    for (const pl of cutPolyline(pts, cuts)) { pieces.push({ kind: k.kind, h: k.h, src: 0, pts: pl }); stats.osmPieces++; }
  }
  const osmSeg = new Grid(25);
  pieces.forEach(pc => { for (let i = 1; i < pc.pts.length; i++) osmSeg.insert(bboxOf([pc.pts[i - 1], pc.pts[i]]), [pc.pts[i - 1], pc.pts[i]]); stats.osmMetres += plen(pc.pts); });

  // ---- Property fences from cadastre parcels ----
  if (cadastreFiles.length) {
    const parcels = [];
    for (const f of cadastreFiles) {
      let gj; try { gj = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')); } catch (e) { log(`  cadastre ${f}: ${e.message}`); continue; }
      for (const ft of gj.features || []) {
        const g = ft.geometry; if (!g) continue;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const poly of polys) {
          const ring = poly[0].slice(0, -1).map(([lo, la]) => P.fwd(lo, la));
          if (ring.length < 3) continue;
          if (!ring.some(([x, y]) => Math.abs(x) < R * 1.02 && Math.abs(y) < R * 1.02)) continue;
          const a = Math.abs(signedArea(ring)); if (a < 20) continue;
          parcels.push({ ring: ccw(ring), area: a, bb: bboxOf(ring), id: ft.id || ft.properties?.id || String(parcels.length) });
        }
      }
    }
    stats.parcels = parcels.length;
    const pGrid = new Grid(80); parcels.forEach((p, i) => pGrid.insert(p.bb, i));
    const parcelAt = (x, y) => { for (const i of pGrid.query(x, y)) { const p = parcels[i]; if (x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && inRing([x, y], p.ring)) return i; } return -1; };
    const bGrid = new Grid(40); buildings.forEach((b, i) => { b.bb = b.bb || bboxOf(b.ring); bGrid.insert(b.bb, i); });
    // fence-worthy lots: a house (or small apartment building) with garden, in a residential setting
    for (const b of buildings) {
      const i = parcelAt(b.c[0], b.c[1]); if (i < 0) continue; const p = parcels[i];
      (p.bl || (p.bl = [])).push(b);
    }
    for (const p of parcels) {
      if (!p.bl || p.area < 120 || p.area > 8000) continue;
      const main = p.bl.filter(b => b.use === 'house' || (b.use === 'apartments' && (b.levels || 2) <= 4 && b.area < 700)).sort((a, b) => b.area - a.area)[0];
      if (!main) continue;
      const cov = p.bl.reduce((s, b) => s + b.area, 0) / p.area; if (cov > 0.8) continue;
      const lu = landuseAt(main.c); if (lu && !['residential', 'farmyard'].includes(lu)) continue;
      p.fenced = true; p.main = main; stats.fencedLots++;
    }
    // streets: in Alsace-Moselle (and in places elsewhere) the carriageway is itself a parcel; a parcel with a road through it and no buildings is street land
    for (const e of roads.edges) { if (e.flags & 4) continue; for (let i = 1; i < e.pts.length; i++) { const a = e.pts[i - 1], b = e.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 8) { const q = parcelAt(a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L); if (q >= 0 && !parcels[q].bl) parcels[q].street = true; } } }
    const nearBuilding = (x, y) => { for (const i of bGrid.query(x, y, 0.7)) { const b = buildings[i]; if (x < b.bb[0] - 0.7 || x > b.bb[2] + 0.7 || y < b.bb[1] - 0.7 || y > b.bb[3] + 0.7) continue; if (inRing([x, y], b.ring)) return true; for (let k = 0; k < b.ring.length; k++) if (segDist([x, y], b.ring[k], b.ring[(k + 1) % b.ring.length]).d < 0.6) return true; } return false; };
    const nearOsm = (x, y) => { for (const [a, b] of osmSeg.query(x, y, 1.3)) if (segDist([x, y], a, b).d < 1.3) return true; return false; };
    const rGrid = new Grid(40); roads.edges.forEach(e => { if (e.flags & 4) return; for (let i = 1; i < e.pts.length; i++) rGrid.insert(bboxOf([e.pts[i - 1], e.pts[i]]), [e, i]); });
    // 1. boundary runs of fenced lots, each tagged with the parcel on the other side (-1 = public land: a street)
    const runs = [];
    parcels.forEach((p, A) => {
      if (!p.fenced) return;
      const r = p.ring;
      for (let k = 0; k < r.length; k++) {
        const a = r[k], b = r[(k + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.4) continue;
        const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L, n = Math.max(1, Math.round(L / 5));
        let cur = null;
        for (let s = 0; s < n; s++) {
          const t0 = s / n, t1 = (s + 1) / n, tm = (t0 + t1) / 2, mx = a[0] + (b[0] - a[0]) * tm, my = a[1] + (b[1] - a[1]) * tm;
          const B = parcelAt(mx + nx * 0.8, my + ny * 0.8);
          if (cur && cur.B === B) cur.t1 = t1; else { cur = { A, B, a, b, t0, t1 }; runs.push(cur); }
        }
      }
    });
    for (const u of runs) { u.p0 = lerp(u.a, u.b, u.t0); u.p1 = lerp(u.a, u.b, u.t1); const Bp = u.B >= 0 ? parcels[u.B] : null; u.front = !Bp || !!Bp.street; u.open = !!Bp && !Bp.street && !Bp.bl && Bp.area < 1500; }
    // 2. openings: mapped driveways/paths crossing the boundary, else a gate facing the house entrance
    const gaps = [];
    const byParcel = new Map(); runs.forEach(u => { for (const q of [u.A, u.B]) if (q >= 0) { let l = byParcel.get(q); if (!l) byParcel.set(q, l = []); l.push(u); } });
    for (const u of runs) {
      const bb = bboxOf([u.p0, u.p1]);
      for (const [e, i] of rGrid.query((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 1)) {
        const t = segX(u.p0, u.p1, e.pts[i - 1], e.pts[i]); if (t < 0) continue;
        const w = (e.width || ROAD_W[e.cls] || 3) + 0.8; gaps.push({ p: lerp(u.p0, u.p1, t), w }); u.hasGap = true;
      }
    }
    parcels.forEach((p, A) => {
      if (!p.fenced) return;
      const mine = byParcel.get(A) || [];
      const front = mine.filter(u => u.front && u.A === A);
      if (front.some(u => u.hasGap)) return;
      const tgt = p.main.ent || p.main.c;
      let best = null, bd = Infinity;
      for (const u of front.length ? front : mine) { const s = segDist(tgt, u.p0, u.p1); if (s.d < bd) { bd = s.d; best = s.q; } }
      if (best) gaps.push({ p: best, w: front.length ? 3.2 : 1.4 });
    });
    const gGrid = new Grid(20); gaps.forEach(g => gGrid.insert([g.p[0] - g.w, g.p[1] - g.w, g.p[0] + g.w, g.p[1] + g.w], g));
    // 3. emit: one fence per shared boundary, style by side, cut at buildings, OSM barriers and openings
    for (const u of runs) {
      const Bp = u.B >= 0 ? parcels[u.B] : null;
      if (Bp && Bp.fenced && u.B < u.A) continue; // the neighbour emits the shared fence
      if (u.open) continue; // small unbuilt neighbour: usually the same household's garden strip or a private lane
      let kind, h;
      if (u.front) { kind = pick(hash('f' + parcels[u.A].id), [['muret', 0.45], ['railing', 0.25], ['hedge', 0.2], ['wood', 0.1]]); h = kind === 'muret' ? 1.2 : kind === 'railing' ? 1.0 : kind === 'hedge' ? 1.5 : 1.8; }
      else { const key = u.B < 0 ? 's' + parcels[u.A].id : 'i' + [parcels[u.A].id, parcels[u.B].id].sort().join('|'); kind = pick(hash(key), [['hedge', 0.3], ['chain', 0.35], ['wood', 0.25], ['wall', 0.1]]); h = kind === 'chain' ? 1.5 : kind === 'hedge' ? 1.8 : kind === 'wall' ? 2.0 : 1.8; }
      h = Math.round((h + (hash(u.p0.join()) - 0.5) * 0.2) * 10) / 10;
      const L = Math.hypot(u.p1[0] - u.p0[0], u.p1[1] - u.p0[1]); if (L < 0.6) continue;
      const cuts = []; let c0 = -1;
      const step = 0.5, ns = Math.ceil(L / step);
      for (let s = 0; s <= ns; s++) {
        const d = Math.min(L, s * step), q = lerp(u.p0, u.p1, d / L);
        const bad = nearBuilding(q[0], q[1]) || nearOsm(q[0], q[1]);
        if (bad && c0 < 0) c0 = d; if (!bad && c0 >= 0) { cuts.push([c0 - step / 2, d - step / 2]); c0 = -1; }
      }
      if (c0 >= 0) cuts.push([c0 - step / 2, L + 1]);
      for (const g of gGrid.query((u.p0[0] + u.p1[0]) / 2, (u.p0[1] + u.p1[1]) / 2, L / 2 + 4)) { const s = segDist(g.p, u.p0, u.p1); if (s.d < 0.3) cuts.push([s.t * L - g.w / 2, s.t * L + g.w / 2]); }
      for (const pl of cutPolyline([u.p0, u.p1], cuts)) { pieces.push({ kind, h, src: 1, pts: pl }); stats.propertyPieces++; stats.propertyMetres += plen(pl); }
    }
  }
  const merged = mergePieces(pieces);
  stats.pieces = merged.length; stats.osmMetres = Math.round(stats.osmMetres); stats.propertyMetres = Math.round(stats.propertyMetres);
  return { pieces: merged, stats };
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const plen = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
// chain pieces of the same kind/height/source that meet end to end at a vertex used by no other piece
function mergePieces(pieces) {
  const key = p => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
  const deg = new Map(); for (const pc of pieces) for (const p of [pc.pts[0], pc.pts[pc.pts.length - 1]]) deg.set(key(p), (deg.get(key(p)) || 0) + 1);
  const byEnd = new Map(); pieces.forEach((pc, i) => { for (const p of [pc.pts[0], pc.pts[pc.pts.length - 1]]) { const k = key(p); let l = byEnd.get(k); if (!l) byEnd.set(k, l = []); l.push(i); } });
  const used = new Uint8Array(pieces.length), out = [];
  for (let i = 0; i < pieces.length; i++) {
    if (used[i]) continue; used[i] = 1; let pts = pieces[i].pts.slice(); const sig = pieces[i].kind + pieces[i].h + pieces[i].src;
    for (const dirEnd of [true, false]) {
      for (let guard = 0; guard < 500; guard++) {
        const end = dirEnd ? pts[pts.length - 1] : pts[0], k = key(end); if (deg.get(k) !== 2) break;
        const j = (byEnd.get(k) || []).find(j => !used[j] && pieces[j].kind + pieces[j].h + pieces[j].src === sig); if (j === undefined) break;
        used[j] = 1; let q = pieces[j].pts; if (key(q[0]) !== k) q = q.slice().reverse();
        pts = dirEnd ? pts.concat(q.slice(1)) : q.slice().reverse().slice(0, -1).concat(pts);
      }
    }
    out.push({ ...pieces[i], pts });
  }
  return out;
}
