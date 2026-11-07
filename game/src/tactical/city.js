// City world model built from loaded pack tiles: buildings as entities, road graph, terrain, spatial indices.
import { loadManifest, loadTile, loadBundle, decodeTile } from './pack.js';
import { Barriers } from './barriers.js';

export const FLAG = { oneway: 1, bridge: 2, tunnel: 4, roundabout: 8, private: 16, drive: 32, walk: 64, isolated_f: 128, isolated_b: 256, link: 512, bus: 1024, barrier: 2048 };

export class Grid {
  constructor(c) { this.c = c; this.m = new Map(); }
  k(i, j) { return i * 73856093 ^ j * 19349663; }
  add(x, y, v) { const k = this.k(Math.floor(x / this.c), Math.floor(y / this.c)); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(v); }
  near(x, y, r, fn) { const c = this.c; for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) for (let j = Math.floor((y - r) / c); j <= Math.floor((y + r) / c); j++) { const a = this.m.get(this.k(i, j)); if (a) for (const v of a) fn(v); } }
  clear() { this.m.clear(); }
}

export class City {
  constructor(base, gen = null) { this.base = base; this.gen = gen; this.tiles = new Map(); this.buildings = []; this.edges = new Map(); this.junctions = new Map(); this.bGrid = new Grid(60); this.areas = []; this.lines = []; this.pois = []; this.listeners = []; }
  async init() {
    if (this.gen) { this.m = this.gen.manifest; }
    else if (/\.(bin|json)$/.test(this.base)) { this.bundle = await loadBundle(this.base); this.m = this.bundle.manifest; }
    else this.m = await loadManifest(this.base);
    this.T = this.m.tileSize; this.codes = this.m.codes;
    this.use = Object.fromEntries(this.codes.use.map((u, i) => [u, i]));
    this.districts = this.m.districts.map((d, i) => ({ ...d, id: i, quarantined: false, buildings: [], pop0: 0 }));
    this.zMin = null;
    this.bars = new Barriers(this);
  }
  key(x, y) { return `${Math.floor(x / this.T)}_${Math.floor(y / this.T)}`; }
  hasTile(k) { return this.m.tiles.some(t => t.key === k); }
  async ensureTiles(keys, unlocked) {
    const todo = keys.filter(k => this.hasTile(k) && !this.tiles.has(k));
    const loaded = this.gen ? todo.map(k => this.gen.tiles.get(k) || null) : this.bundle ? todo.map(k => { const raw = this.bundle.tiles[k]; if (!raw) return null; delete this.bundle.tiles[k]; return decodeTile(raw); }) : await Promise.all(todo.map(k => loadTile(this.base, k)));
    loaded.forEach((t, n) => { if (t) this.addTile(t); });
    for (const k of keys) { const t = this.tiles.get(k); if (t && unlocked && !t.unlocked) { t.unlocked = true; t.justUnlocked = true; } }
    return loaded.filter(Boolean).map(t => t.key);
  }
  addTile(t) {
    if (this.zMin === null) { let mn = Infinity; for (const v of t.terrain.data) mn = Math.min(mn, v * t.terrain.scale); this.zMin = mn - 1; }
    const tile = { key: t.key, origin: t.origin, unlocked: false, data: t, bIdx: [] };
    this.tiles.set(t.key, tile);
    for (const b of t.buildings) {
      const i = this.buildings.length; b.idx = i; b.tile = t.key;
      b.z -= this.zMin;
      let cx = 0, cy = 0; for (const p of b.ring) { cx += p[0]; cy += p[1]; } b.c = [cx / b.ring.length, cy / b.ring.length];
      let a = 0; for (let k = 0, j = b.ring.length - 1; k < b.ring.length; j = k++) a += b.ring[j][0] * b.ring[k][1] - b.ring[k][0] * b.ring[j][1]; b.area = Math.abs(a / 2);
      b.pop0 = Math.round(b.res * 0.55 + b.jobs * 0.45); b.occ = b.pop0; b.hp = Math.min(4000, 400 + b.area * b.levels * 0.6); b.hp0 = b.hp;
      b.infest = 0; b.state = 0; b.garrison = []; b.evac = false; b.dead = 0; b.colorDirty = false;
      this.buildings.push(b); tile.bIdx.push(i); this.bGrid.add(b.c[0], b.c[1], i);
      const d = this.districts[b.district]; if (d) { d.buildings.push(i); d.pop0 += b.pop0; }
    }
    this.bars.addTile(tile);
    for (const e of t.edges) { e.z = []; this.edges.set(e.id, e); }
    for (const j of t.junctions) { j.z -= this.zMin; j.out = []; j.in = []; j.green = null; this.junctions.set(j.id, j); }
    this.areas.push(...t.areas.map(a => ({ ...a, tile: t.key })));
    this.lines.push(...t.lines.map(l => ({ ...l, tile: t.key })));
    this.pois.push(...t.pois.map(p => ({ ...p, tile: t.key })));
    this.graphDirty = true; this.jGridDirty = true;
  }
  heightAt(x, y) {
    const t = this.tiles.get(this.key(x, y)); if (!t) return 0;
    const g = t.data.terrain, fx = (x - g.ox) / g.step, fy = (y - g.oy) / g.step, i = Math.max(0, Math.min(g.n - 2, Math.floor(fx))), j = Math.max(0, Math.min(g.n - 2, Math.floor(fy)));
    const tx = fx - i, ty = fy - j, v = (a, b) => g.data[b * g.n + a] * g.scale;
    return v(i, j) * (1 - tx) * (1 - ty) + v(i + 1, j) * tx * (1 - ty) + v(i, j + 1) * (1 - tx) * ty + v(i + 1, j + 1) * tx * ty - this.zMin;
  }
  unlockedAt(x, y) { const t = this.tiles.get(this.key(x, y)); return !!(t && t.unlocked); }

  // Road graph over loaded tiles. Directed "arcs" for driving: (edge, dir).
  buildGraph() {
    for (const j of this.junctions.values()) { j.out = []; j.in = []; j.walk = []; }
    for (const e of this.edges.values()) {
      const A = this.junctions.get(e.a), B = this.junctions.get(e.b);
      e.A = A; e.B = B;
      if (!e.zDone) { e.zs = e.pts.map(p => this.heightAt(p[0], p[1]) + (e.flags & FLAG.bridge ? 5 : 0) + (e.layer > 0 ? e.layer * 5 : 0)); e.zDone = true; e.seg = []; let L = 0; for (let i = 1; i < e.pts.length; i++) { const l = Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]); e.seg.push(l); L += l; } e.L = Math.max(0.5, L); }
      if (e.flags & FLAG.walk) { if (A) A.walk.push(e); if (B) B.walk.push(e); }
      if (!(e.flags & FLAG.drive) || (e.flags & FLAG.private)) continue;
      if (A) A.out.push({ e, dir: 1 }); if (B) B.in.push({ e, dir: 1 });
      if (!(e.flags & FLAG.oneway)) { if (B) B.out.push({ e, dir: -1 }); if (A) A.in.push({ e, dir: -1 }); }
    }
    // connection lookup per junction: "fromEdge:fromDir" -> [{toE,toDir,fromLane,toLane,turn}]
    for (const j of this.junctions.values()) {
      j.cmap = new Map();
      (j.conn || []).forEach((c, ci) => { const k = c[0] + ':' + c[1]; let a = j.cmap.get(k); if (!a) j.cmap.set(k, a = []); a.push({ toE: c[3], toDir: c[4], fromLane: c[2], toLane: c[5], turn: c[6], ci }); });
      if (j.phases) { j.cycle = j.phases.reduce((s, p) => s + p.d + p.y + p.r, 0); j.offset = (j.id * 7.3) % j.cycle; }
    }
    this.graphDirty = false;
  }
  // Point along edge e at distance s in direction dir
  edgePoint(e, dir, s) {
    s = Math.max(0, Math.min(e.L, dir === 1 ? s : e.L - s));
    let acc = 0;
    for (let i = 0; i < e.seg.length; i++) {
      if (acc + e.seg[i] >= s || i === e.seg.length - 1) {
        const t = e.seg[i] ? (s - acc) / e.seg[i] : 0, a = e.pts[i], b = e.pts[i + 1];
        const hx = (b[0] - a[0]) * dir, hy = (b[1] - a[1]) * dir, hl = Math.hypot(hx, hy) || 1;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, e.zs[i] + (e.zs[i + 1] - e.zs[i]) * t, hx / hl, hy / hl];
      }
      acc += e.seg[i];
    }
    return [e.pts[0][0], e.pts[0][1], 0, 1, 0];
  }
  // Dijkstra distance-to-target field over drivable arcs (reverse search). Returns Map junctionId -> {d, next:{e,dir}}
  driveField(targets, blocked) {
    const dist = new Map(), next = new Map(), heap = new Heap();
    for (const id of targets) { dist.set(id, 0); heap.push(0, id); }
    while (heap.size) {
      const [d, id] = heap.pop(); if (d > (dist.get(id) ?? Infinity)) continue;
      const J = this.junctions.get(id); if (!J) continue;
      for (const a of J.in) {
        const from = a.dir === 1 ? a.e.a : a.e.b; if (blocked && blocked(a.e)) continue;
        const w = a.e.L / Math.max(5, a.e.speed / 3.6) * (a.e.flags & (FLAG.isolated_f) ? 50 : 1);
        const nd = d + w; if (nd < (dist.get(from) ?? Infinity)) { dist.set(from, nd); next.set(from, a); heap.push(nd, from); }
      }
    }
    return { dist, next };
  }
  walkField(targets, blocked) {
    const dist = new Map(), next = new Map(), heap = new Heap();
    for (const id of targets) { dist.set(id, 0); heap.push(0, id); }
    while (heap.size) {
      const [d, id] = heap.pop(); if (d > (dist.get(id) ?? Infinity)) continue;
      const J = this.junctions.get(id); if (!J) continue;
      for (const e of J.walk) {
        const other = e.a === id ? e.b : e.a; if (blocked && blocked(e)) continue;
        const nd = d + e.L; if (nd < (dist.get(other) ?? Infinity)) { dist.set(other, nd); next.set(other, { e, dir: e.a === other ? 1 : -1 }); heap.push(nd, other); }
      }
    }
    return { dist, next };
  }
  nearestJunction(x, y, filter, r = 200) {
    let best = null, bd = r * r;
    if (!this.jGrid || this.jGridDirty) { this.jGrid = new Grid(80); for (const j of this.junctions.values()) this.jGrid.add(j.p[0], j.p[1], j); this.jGridDirty = false; }
    this.jGrid.near(x, y, r, j => { if (filter && !filter(j)) return; const d = (j.p[0] - x) ** 2 + (j.p[1] - y) ** 2; if (d < bd) { bd = d; best = j; } });
    return best;
  }
}

export class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(k, v) { const a = this.k, b = this.v; let i = a.length; a.push(k); b.push(v); while (i > 0) { const p = (i - 1) >> 1; if (a[p] <= a[i]) break; [a[p], a[i]] = [a[i], a[p]]; [b[p], b[i]] = [b[i], b[p]]; i = p; } }
  pop() { const a = this.k, b = this.v, top = [a[0], b[0]], lk = a.pop(), lv = b.pop(); if (a.length) { a[0] = lk; b[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l] < a[m]) m = l; if (r < a.length && a[r] < a[m]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; [b[m], b[i]] = [b[i], b[m]]; i = m; } } return top; }
}
