// ESA WorldCover 2021 land cover (10 m) around the pack: per-tile class grids for ground colouring and tree planting,
// water bodies including the sea (OpenStreetMap maps seas only as coastlines), the local climate (arid or not),
// and the built-up mask used to place generated buildings where buildings exist but are not mapped.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { simplifyRing, inRing, bboxOf, signedArea } from './geom.mjs';

// WorldCover class → compact code: 0 none, 1 tree, 2 shrub, 3 grass, 4 crop, 5 built, 6 bare, 7 snow, 8 water, 9 wetland, 10 mangrove, 11 moss
const CODE = { 10: 1, 20: 2, 30: 3, 40: 4, 50: 5, 60: 6, 70: 7, 80: 8, 90: 9, 95: 10, 100: 11 };
export const LC_CLASSES = ['none', 'tree', 'shrub', 'grass', 'crop', 'built', 'bare', 'snow', 'water', 'wetland', 'mangrove', 'moss'];
export const STEP = 10;

export function loadLandcover(file, P, E) {
  if (!file || !fs.existsSync(file)) return null;
  const lc = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  const src = Buffer.from(lc.b64, 'base64'), [bx0, , , by1] = lc.bbox;
  const sampleLL = (lon, lat) => { const i = Math.floor((lon - bx0) / lc.res), j = Math.floor((by1 - lat) / lc.res); return i < 0 || j < 0 || i >= lc.w || j >= lc.h ? 0 : CODE[src[j * lc.w + i]] || 0; };
  // local metric grid, x east / y north, cell (i,j) centred at (-E + (i+.5)·STEP, -E + (j+.5)·STEP)
  const n = Math.round(2 * E / STEP), g = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g[j * n + i] = sampleLL(...P.inv(-E + (i + 0.5) * STEP, -E + (j + 0.5) * STEP));
  const at = (x, y) => { const i = Math.floor((x + E) / STEP), j = Math.floor((y + E) / STEP); return i < 0 || j < 0 || i >= n || j >= n ? 0 : g[j * n + i]; };
  // climate
  const cnt = new Array(12).fill(0); for (const v of g) cnt[v]++;
  const veg = cnt[1] + cnt[2] + cnt[3] + cnt[4] + cnt[9] + cnt[10], bare = cnt[6], land = n * n - cnt[8] - cnt[0];
  const climate = { arid: bare / Math.max(1, veg + bare) > 0.3, bareShare: +(bare / Math.max(1, land)).toFixed(3), treeShare: +(cnt[1] / Math.max(1, land)).toFixed(3), builtShare: +(cnt[5] / Math.max(1, land)).toFixed(3), waterShare: +(cnt[8] / (n * n)).toFixed(3) };
  return { n, g, E, at, climate, tile: (ox, oy, T) => tileGrid(g, n, E, ox, oy, T), water: () => waterPolygons(g, n, E) };
}
function tileGrid(g, n, E, ox, oy, T) {
  const m = Math.round(T / STEP), out = new Uint8Array(m * m), i0 = Math.round((ox + E) / STEP), j0 = Math.round((oy + E) / STEP);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { const gi = i0 + i, gj = j0 + j; out[j * m + i] = gi < 0 || gj < 0 || gi >= n || gj >= n ? 0 : g[gj * n + gi]; }
  return { n: m, step: STEP, b64: Buffer.from(out).toString('base64') };
}
// Water bodies as polygons with holes: clean speckle, trace cell boundaries (water on the left), simplify.
function waterPolygons(g, n, E) {
  const W = new Uint8Array(n * n); for (let k = 0; k < n * n; k++) W[k] = g[k] === 8 ? 1 : 0;
  // drop water patches under 0.4 ha and land specks under 0.2 ha inside water
  const comp = (val, minCells, setTo) => {
    const seen = new Uint8Array(n * n), st = [];
    for (let s = 0; s < n * n; s++) {
      if (seen[s] || W[s] !== val) continue;
      const cells = []; st.push(s); seen[s] = 1;
      while (st.length) { const c = st.pop(); cells.push(c); const i = c % n, j = (c - i) / n; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n) continue; const q = b * n + a; if (!seen[q] && W[q] === val) { seen[q] = 1; st.push(q); } } }
      if (cells.length < minCells) for (const c of cells) W[c] = setTo;
    }
  };
  comp(1, 40, 0); comp(0, 20, 1);
  const w = (i, j) => i >= 0 && j >= 0 && i < n && j < n && W[j * n + i] === 1;
  // directed boundary edges between grid vertices; key = vertex index (n+1)²
  const N1 = n + 1, out = new Map();
  const add = (a, b) => { let l = out.get(a); if (!l) out.set(a, l = []); l.push(b); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!w(i, j)) continue;
    if (!w(i, j - 1)) add(j * N1 + i, j * N1 + i + 1);
    if (!w(i + 1, j)) add(j * N1 + i + 1, (j + 1) * N1 + i + 1);
    if (!w(i, j + 1)) add((j + 1) * N1 + i + 1, (j + 1) * N1 + i);
    if (!w(i - 1, j)) add((j + 1) * N1 + i, j * N1 + i);
  }
  const rings = [];
  for (const [start] of out) {
    while (out.get(start)?.length) {
      const ring = []; let cur = start, prev = -1, guard = 0;
      do {
        const l = out.get(cur); if (!l || !l.length) break;
        let k = 0;
        if (l.length > 1 && prev >= 0) { // saddle: take the left-most turn so regions stay 4-connected
          const px = prev % N1, py = (prev - px) / N1, cx = cur % N1, cy = (cur - cx) / N1, dx = cx - px, dy = cy - py;
          k = l.findIndex(v => { const vx = v % N1, vy = (v - vx) / N1; return (vx - cx) === -dy && (vy - cy) === dx; }); if (k < 0) k = 0;
        }
        const nx = l.splice(k, 1)[0]; ring.push([-E + (cur % N1) * STEP, -E + Math.floor(cur / N1) * STEP]); prev = cur; cur = nx;
      } while (cur !== start && guard++ < 4e6);
      if (ring.length >= 4) rings.push(ring);
    }
  }
  const outer = [], holes = [];
  for (const r of rings) { const s = simplifyRing(r, 6); if (s.length < 3) continue; (signedArea(s) > 0 ? outer : holes).push(s); }
  const polys = outer.map(r => ({ kind: 'water', ring: r, holes: [], bb: bboxOf(r), sea: true }));
  for (const h of holes) { const p = h[0]; const o = polys.find(o => p[0] >= o.bb[0] && p[0] <= o.bb[2] && p[1] >= o.bb[1] && p[1] <= o.bb[3] && inRing(p, o.ring)); if (o) o.holes.push(h); }
  return polys;
}
