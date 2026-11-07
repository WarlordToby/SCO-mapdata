// Barrier world: fences, walls and hedges from the pack plus building walls, as segments in a spatial hash.
// Ground movement off the road network collides with them. People vault low barriers (≤ VAULT_H) and are stopped by
// tall ones and by buildings; vehicles flatten what their armour allows. A local visibility-graph search routes around.
import { Heap } from './city.js';

export const VAULT_H = 1.3;
export const EYE_H = 1.7; // solid barriers at least this tall block sight for people on the ground
const HARD = new Set(['wall', 'muret', 'retaining', 'jersey', 'city_wall']), SOFT = new Set(['hedge', 'wood']);
const MAX_SEG = 10, CELL = 12;

class SegHash {
  constructor(c) { this.c = c; this.m = new Map(); }
  k(i, j) { return i * 73856093 ^ j * 19349663; }
  add(s) {
    const c = this.c, L = Math.hypot(s.bx - s.ax, s.by - s.ay), n = Math.max(1, Math.ceil(L / (c * 0.5))), seen = new Set();
    for (let q = 0; q <= n; q++) {
      const x = s.ax + (s.bx - s.ax) * q / n, y = s.ay + (s.by - s.ay) * q / n;
      for (const [dx, dy] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) {
        const key = this.k(Math.floor((x + dx) / c), Math.floor((y + dy) / c)); if (seen.has(key)) continue; seen.add(key);
        let a = this.m.get(key); if (!a) this.m.set(key, a = []); a.push(s);
      }
    }
  }
  // visit the cells a segment passes through (DDA), for long sight lines
  line(x0, y0, x1, y1, fn) {
    const c = this.c; let i = Math.floor(x0 / c), j = Math.floor(y0 / c); const i1 = Math.floor(x1 / c), j1 = Math.floor(y1 / c);
    const dx = x1 - x0, dy = y1 - y0, si = Math.sign(dx), sj = Math.sign(dy);
    const tdx = dx ? Math.abs(c / dx) : Infinity, tdy = dy ? Math.abs(c / dy) : Infinity;
    let tx = dx ? ((si > 0 ? (i + 1) * c - x0 : x0 - i * c) / Math.abs(dx)) : Infinity, ty = dy ? ((sj > 0 ? (j + 1) * c - y0 : y0 - j * c) / Math.abs(dy)) : Infinity;
    for (let n = 0; n < 400; n++) {
      const a = this.m.get(this.k(i, j)); if (a) for (const s of a) fn(s);
      if (i === i1 && j === j1) break;
      if (tx < ty) { tx += tdx; i += si; } else { ty += tdy; j += sj; }
    }
  }
  each(x0, y0, x1, y1, fn) {
    const c = this.c;
    for (let i = Math.floor(Math.min(x0, x1) / c); i <= Math.floor(Math.max(x0, x1) / c); i++) for (let j = Math.floor(Math.min(y0, y1) / c); j <= Math.floor(Math.max(y0, y1) / c); j++) {
      const a = this.m.get(this.k(i, j)); if (a) for (const s of a) fn(s);
    }
  }
}
// parameter t∈(0,1] where move p0→p1 crosses segment s, else -1
function crossT(x0, y0, x1, y1, s) {
  const rx = x1 - x0, ry = y1 - y0, sx = s.bx - s.ax, sy = s.by - s.ay, den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return -1;
  const qx = s.ax - x0, qy = s.ay - y0, t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t > 1e-4 && t <= 1 && u >= -1e-4 && u <= 1 + 1e-4 ? t : -1;
}
const segD = (x, y, s) => { const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / L2)); return Math.hypot(x - s.ax - dx * t, y - s.ay - dy * t); };
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

export class Barriers {
  constructor(city) {
    this.city = city; this.segs = []; this.bar = new SegHash(CELL); this.wall = new SegHash(CELL);
    this.kinds = city.codes.barrier || []; this.props = city.codes.barrierProps || {};
    this.dirty = new Set(); this.stamp = 0; this.cache = new Map(); this.broken = 0;
  }
  addTile(tile) {
    const t = tile.data; tile.barSegs = [];
    for (const pc of t.barriers || []) {
      const kind = this.kinds[pc.kind] || 'fence', pr = this.props[kind] || { brk: 1 };
      for (let i = 1; i < pc.pts.length; i++) {
        const a = pc.pts[i - 1], b = pc.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / MAX_SEG));
        for (let q = 0; q < n; q++) this.addSeg(tile, { ax: a[0] + (b[0] - a[0]) * q / n, ay: a[1] + (b[1] - a[1]) * q / n, bx: a[0] + (b[0] - a[0]) * (q + 1) / n, by: a[1] + (b[1] - a[1]) * (q + 1) / n, kind, k: pc.kind, h: pc.h, brk: pr.brk, src: pc.src, down: false });
      }
    }
    for (const bi of tile.bIdx) {
      const b = this.city.buildings[bi], r = b.ring;
      for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; this.wall.add({ ax: p[0], ay: p[1], bx: q[0], by: q[1], b }); }
    }
  }
  addSeg(tile, s) { s.id = this.segs.length; s.tile = tile.key; s.len = Math.hypot(s.bx - s.ax, s.by - s.ay); this.segs.push(s); tile.barSegs.push(s); this.bar.add(s); return s; }

  // who: { veh: false } on foot, or { veh: true, armour: 1 light car | 2 truck/APC/tank }
  static who(o, ITEM) {
    // jeeps and other light cars flatten fences and hedges; trucks, APCs and tanks also push through masonry garden walls
    if (o.kind === 'vehicle' || o.riding) { const it = ITEM[o.vehicle || o.carrier]; return { veh: true, armour: it && it.cat !== 'light' ? 2 : 1 }; }
    return { veh: false };
  }
  breakable(s, w) { return w.veh && (s.brk === 1 || (s.brk === 2 && w.armour >= 2)); }
  blocks(s, w) { return !s.down && !s.dead && (w.veh ? !this.breakable(s, w) : s.h > VAULT_H); }

  // first obstacle on the move p0→p1: {t, s} barrier, or {t, wall}
  // (gx, gy) = where the mover is ultimately heading: walls of the building it is leaving or entering do not block
  firstHit(x0, y0, x1, y1, gx = x1, gy = y1) {
    let best = null, bt = 2; const st = ++this.stamp;
    this.bar.each(x0, y0, x1, y1, s => { if (s.st === st || s.down || s.dead) return; s.st = st; const t = crossT(x0, y0, x1, y1, s); if (t >= 0 && t < bt) { bt = t; best = { t, s }; } });
    this.wall.each(x0, y0, x1, y1, w => { if (w.st === st) return; w.st = st; const t = crossT(x0, y0, x1, y1, w); if (t >= 0 && t < bt && !this.ownWall(w, x0, y0, gx, gy)) { bt = t; best = { t, wall: w }; } });
    return best;
  }
  ownWall(w, sx, sy, gx, gy) { const b = w.b; if (b._ow === this.owKey) return b._owv; b._ow = this.owKey; let near = false; const r = b.ring; for (let i = 0; i < r.length && !near; i++) { const q = r[(i + 1) % r.length]; near = segD(gx, gy, { ax: r[i][0], ay: r[i][1], bx: q[0], by: q[1] }) < 1.0; } return (b._owv = near || inRing(sx, sy, r) || inRing(gx, gy, r)); }
  // Line of sight from a shooter to a target on the ground. Buildings block (except the shooter's own when firing from it);
  // solid barriers at eye height or taller block; lower solid barriers close to the target give it cover (hard: walls,
  // soft: hedges, board fences). See-through fences neither block nor cover. Shooters firing from upper floors (elev) see
  // over garden barriers. Returns { clear, cover } where cover multiplies the damage that gets through.
  sight(x0, y0, x1, y1, elev = false, ownB = null) {
    const st = ++this.stamp; let clear = true, cover = 1; const L = Math.hypot(x1 - x0, y1 - y0) || 1;
    this.wall.line(x0, y0, x1, y1, w => { if (!clear || w.st === st) return; w.st = st; if (w.b === ownB || w.b.destroyed) return; if (crossT(x0, y0, x1, y1, w) >= 0) clear = false; });
    if (!clear || elev) return { clear, cover };
    this.bar.line(x0, y0, x1, y1, s => {
      if (!clear || s.st === st || s.down || s.dead) return; s.st = st;
      const hard = HARD.has(s.kind); if (!hard && !SOFT.has(s.kind)) return;
      const t = crossT(x0, y0, x1, y1, s); if (t < 0) return;
      if (s.h >= EYE_H && s.kind !== 'muret') { clear = false; return; }
      if ((1 - t) * L < 4) cover = Math.min(cover, hard ? 0.45 : 0.7);
    });
    return { clear, cover };
  }
  // flatten a stretch of barrier around the impact point
  breakAt(s, px, py, w = 3.6) {
    if (s.down || s.dead) return;
    const tile = this.city.tiles.get(s.tile); if (!tile) return;
    const dx = s.bx - s.ax, dy = s.by - s.ay, L = s.len || 1, t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / (L * L)));
    let d0 = t * L - w / 2, d1 = t * L + w / 2; if (d0 < 0.5) d0 = 0; if (d1 > L - 0.5) d1 = L;
    const at = d => [s.ax + dx * d / L, s.ay + dy * d / L], base = { kind: s.kind, k: s.k, h: s.h, brk: s.brk, src: s.src };
    s.dead = true;
    const mk = (a, b, down) => this.addSeg(tile, { ...base, ax: a[0], ay: a[1], bx: b[0], by: b[1], down });
    if (d0 > 0) mk([s.ax, s.ay], at(d0), false);
    mk(at(d0), at(d1), true);
    if (d1 < L) mk(at(d1), [s.bx, s.by], false);
    this.dirty.add(s.tile); this.cache.clear(); this.broken++;
  }

  visible(x0, y0, x1, y1, w, local) {
    const st = ++this.stamp;
    let ok = true;
    local.each(x0, y0, x1, y1, s => { if (!ok || s.st === st) return; s.st = st; if (crossT(x0, y0, x1, y1, s) >= 0) ok = false; });
    return ok;
  }
  // Route from S to G around obstacles for this mover. Returns waypoints (ending at G), [] if direct, or null if no way through.
  route(sx, sy, gx, gy, w, wide = 0) { // wide: search radius beyond the start-goal box (open country with long hedgerows)
    const ck = `${wide}|${w.veh ? 'v' + w.armour : 'f'}|${Math.round(sx / 3)},${Math.round(sy / 3)}|${Math.round(gx)},${Math.round(gy)}`;
    const hit = this.cache.get(ck); if (hit && hit.t > performance.now() - 15000) return hit.r;
    const pad = 30 + wide, x0 = Math.min(sx, gx) - pad, y0 = Math.min(sy, gy) - pad, x1 = Math.max(sx, gx) + pad, y1 = Math.max(sy, gy) + pad;
    // local obstacles
    const local = new SegHash(6), obs = [], st = ++this.stamp, bset = new Set();
    this.bar.each(x0, y0, x1, y1, s => { if (s.st === st) return; s.st = st; if (this.blocks(s, w)) { local.add(s); obs.push(s); } });
    this.owKey = (this.owKey || 0) + 1; this.wall.each(x0, y0, x1, y1, s => { if (s.st === st) return; s.st = st; if (this.ownWall(s, sx, sy, gx, gy)) return; local.add(s); bset.add(s.b); });
    if (this.visible(sx, sy, gx, gy, w, local)) { this.cache.set(ck, { t: performance.now(), r: [] }); return []; }
    // candidate corners: wherever obstacle ends/corners leave a reflex opening (> 180°), offset into it
    const off = w.veh ? 2.2 : 0.7, V = new Map(), key = (x, y) => Math.round(x * 5) + ',' + Math.round(y * 5);
    const addDir = (x, y, dx, dy) => { const k = key(x, y); let v = V.get(k); if (!v) V.set(k, v = { x, y, a: [] }); v.a.push(Math.atan2(dy, dx)); };
    for (const s of obs) { addDir(s.ax, s.ay, s.bx - s.ax, s.by - s.ay); addDir(s.bx, s.by, s.ax - s.bx, s.ay - s.by); }
    for (const b of bset) { const r = b.ring, n = r.length; for (let i = 0; i < n; i++) { const p = r[i], a = r[(i + n - 1) % n], c = r[(i + 1) % n]; addDir(p[0], p[1], a[0] - p[0], a[1] - p[1]); addDir(p[0], p[1], c[0] - p[0], c[1] - p[1]); } }
    const nodes = [];
    for (const v of V.values()) {
      if (v.x < x0 || v.x > x1 || v.y < y0 || v.y > y1) continue;
      const a = v.a.sort((p, q) => p - q);
      for (let i = 0; i < a.length; i++) {
        const lo = a[i], hi = i + 1 < a.length ? a[i + 1] : a[0] + Math.PI * 2, gap = hi - lo;
        if (gap <= Math.PI + 0.05) continue;
        const m = (lo + hi) / 2, nx = v.x + Math.cos(m) * off, ny = v.y + Math.sin(m) * off;
        let inside = false; for (const b of bset) if (inRing(nx, ny, b.ring)) { inside = true; break; }
        if (!inside) nodes.push([nx, ny]);
      }
    }
    if (nodes.length > 900) nodes.length = 900;
    // A* over the visibility graph (edges tested lazily)
    const N = nodes.length, G = N, S = N + 1, P = [...nodes, [gx, gy], [sx, sy]];
    const g = new Float64Array(N + 2).fill(Infinity), prev = new Int32Array(N + 2).fill(-1), closed = new Uint8Array(N + 2), open = new Heap();
    const h = i => Math.hypot(P[i][0] - gx, P[i][1] - gy);
    g[S] = 0; open.push(h(S), S); let exp = 0, found = false;
    while (open.size && exp < 350) {
      const [, i] = open.pop(); if (closed[i]) continue; closed[i] = 1; exp++;
      if (i === G) { found = true; break; }
      const [px, py] = P[i];
      if (this.visible(px, py, gx, gy, w, local)) { const ng = g[i] + h(i); if (ng < g[G]) { g[G] = ng; prev[G] = i; open.push(ng, G); } }
      for (let j = 0; j < N; j++) {
        if (closed[j] || j === i) continue; const d = Math.hypot(P[j][0] - px, P[j][1] - py); if (d > 45 + wide * 1.5) continue;
        const ng = g[i] + d; if (ng >= g[j]) continue;
        if (!this.visible(px, py, P[j][0], P[j][1], w, local)) continue;
        g[j] = ng; prev[j] = i; open.push(ng + h(j), j);
      }
    }
    let r = null;
    if (found) { r = []; for (let i = G; i !== S && i >= 0; i = prev[i]) r.push([P[i][0], P[i][1]]); r.reverse(); }
    else if (exp >= 350) r = undefined; // gave up (too complex) rather than proven blocked
    this.cache.set(ck, { t: performance.now(), r });
    return r;
  }
}
