// Generated buildings for built-up land that OpenStreetMap has not mapped yet.
// Where satellite land cover (WorldCover "built-up") shows buildings but the map has few or none, rows of buildings are
// placed along the streets in the local tradition (footprint, setback, gaps, rows behind the street front, storeys).
// They are flagged as estimated. Mapped buildings, roads, water, parks and other open land are never built over.
import { FILL } from './regions.mjs';
import { inRing, bboxOf, ccw } from './geom.mjs';

const OCC = 2; // occupancy raster cell, m
const OPEN_KINDS = new Set(['water', 'wetland', 'forest', 'park', 'cemetery', 'sports', 'parking', 'railway', 'farmland', 'grass', 'beach', 'scrub', 'allotments', 'construction']);
const ROAD_W = [10, 9, 8, 7, 7, 6, 6, 5, 3.5, 3, 4, 1.6, 2, 1.6];
const FRONT = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10]); // classes whose sides get building rows (not motorways, tracks, paths)

export function fillBuildings({ buildings, roads, areas, lc, region, E, seed = 1, max = 90000 }) {
  if (!lc) return { added: [], stats: { reason: 'no land cover' } };
  const F = FILL[region] || FILL['eu-west'];
  let s = seed >>> 0 || 1; const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
  const R = ([a, b]) => a + (b - a) * rnd();
  const n = Math.round(2 * E / OCC), occ = new Uint8Array(n * n);
  const ci = x => Math.floor((x + E) / OCC);
  const fillPoly = (ring, pad = 0) => {
    const [x0, y0, x1, y1] = bboxOf(ring);
    for (let j = Math.max(0, ci(y0 - pad)); j <= Math.min(n - 1, ci(y1 + pad)); j++) {
      const y = -E + (j + 0.5) * OCC, xs = [];
      for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) { const [ax, ay] = ring[m], [bx, by] = ring[k]; if ((ay > y) !== (by > y)) xs.push(ax + (y - ay) * (bx - ax) / (by - ay)); }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, ci(xs[q] - pad)); i <= Math.min(n - 1, ci(xs[q + 1] + pad)); i++) occ[j * n + i] = 1;
    }
  };
  const stampSeg = (a, b, r) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / OCC)); for (let q = 0; q <= k; q++) { const x = a[0] + (b[0] - a[0]) * q / k, y = a[1] + (b[1] - a[1]) * q / k; for (let j = ci(y - r); j <= ci(y + r); j++) for (let i = ci(x - r); i <= ci(x + r); i++) if (i >= 0 && j >= 0 && i < n && j < n && (i * OCC - E - x) ** 2 + (j * OCC - E - y) ** 2 <= r * r) occ[j * n + i] = 1; } };
  for (const b of buildings) fillPoly(b.ring, 1.5);
  for (const a of areas) if (OPEN_KINDS.has(a.kind)) fillPoly(a.ring);
  for (const e of roads.edges) { const w = (e.width || ROAD_W[e.cls] || 3) / 2 + 0.8; for (let i = 1; i < e.pts.length; i++) stampSeg(e.pts[i - 1], e.pts[i], w); }
  // how much of each 50 m cell's built-up land is covered by mapped buildings
  const C = 50, nc = Math.ceil(2 * E / C), mapped = new Float32Array(nc * nc), built = new Float32Array(nc * nc);
  for (const b of buildings) { const i = Math.floor((b.c[0] + E) / C), j = Math.floor((b.c[1] + E) / C); if (i >= 0 && j >= 0 && i < nc && j < nc) mapped[j * nc + i] += b.area; }
  for (let j = 0; j < lc.n; j++) for (let i = 0; i < lc.n; i++) if (lc.g[j * lc.n + i] === 5) { const x = -E + (i + 0.5) * 10, y = -E + (j + 0.5) * 10, a = Math.floor((x + E) / C), b2 = Math.floor((y + E) / C); if (a < nc && b2 < nc) built[b2 * nc + a] += 100; }
  const unmapped = (x, y) => { const i = Math.floor((x + E) / C), j = Math.floor((y + E) / C); if (i < 0 || j < 0 || i >= nc || j >= nc) return false; let m = 0, bl = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b2 = j + dj; if (a < 0 || b2 < 0 || a >= nc || b2 >= nc) continue; m += mapped[b2 * nc + a]; bl += built[b2 * nc + a]; } return bl >= 2500 && m / bl < 0.12; };
  // typical storeys of mapped buildings nearby (when their storeys are tagged), else the regional range
  const lvGrid = new Map(); for (const b of buildings) if (!b.estH && (b.use === 'house' || b.use === 'apartments')) { const k = Math.floor(b.c[0] / 300) + ',' + Math.floor(b.c[1] / 300); (lvGrid.get(k) || lvGrid.set(k, []).get(k)).push(b.levels); }
  const localLevels = (x, y) => { const l = lvGrid.get(Math.floor(x / 300) + ',' + Math.floor(y / 300)); if (!l || l.length < 4) return null; const s2 = l.slice().sort((a, b) => a - b); return s2[Math.floor(s2.length / 2)]; };
  const free = (pts) => { // all occupancy cells under the rectangle are free
    const [x0, y0, x1, y1] = bboxOf(pts);
    for (let j = Math.max(0, ci(y0)); j <= Math.min(n - 1, ci(y1)); j++) for (let i = Math.max(0, ci(x0)); i <= Math.min(n - 1, ci(x1)); i++) { const p = [-E + (i + 0.5) * OCC, -E + (j + 0.5) * OCC]; if (occ[j * n + i] && inRing(p, pts)) return false; }
    return true;
  };
  const builtAt = pts => { let k = 0; for (const p of pts) if (lc.at(p[0], p[1]) === 5) k++; return k; };
  const added = []; let id = 0;
  for (const e of roads.edges) {
    if (added.length >= max) break;
    if (!FRONT.has(e.cls) || (e.flags & (2 | 4))) continue;
    const half = (e.width || ROAD_W[e.cls] || 3) / 2;
    for (let i = 1; i < e.pts.length; i++) {
      const a = e.pts[i - 1], b = e.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6) continue;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      for (const side of [1, -1]) {
        const nx = -uy * side, ny = ux * side;
        let t = R([0, 3]);
        while (t < L - 4) {
          const w = R(F.w), gap = R(F.gap); let off = half + R(F.setback), placedRow = false;
          for (let row = 0; row < F.rows; row++) {
            const d = R(F.d), cx = a[0] + ux * (t + w / 2) + nx * (off + d / 2), cy = a[1] + uy * (t + w / 2) + ny * (off + d / 2);
            if (!unmapped(cx, cy)) break;
            const hw = w / 2, hd = d / 2;
            const pts = [[cx - ux * hw - nx * hd, cy - uy * hw - ny * hd], [cx + ux * hw - nx * hd, cy + uy * hw - ny * hd], [cx + ux * hw + nx * hd, cy + uy * hw + ny * hd], [cx - ux * hw + nx * hd, cy - uy * hw + ny * hd]];
            if (builtAt([...pts, [cx, cy]]) < 3 || !free(pts)) break;
            fillPoly(pts, 0.6);
            const ll = localLevels(cx, cy), levels = Math.max(1, Math.round(ll ? ll + R([-1, 1]) : R(F.levels) * (row === 0 ? 1 : 0.85)));
            const use = levels >= 3 ? 'apartments' : 'house', area = w * d, floor = area * levels;
            added.push({
              id: 'w' + (9e9 + id++), gen: true, tags: {}, ring: ccw(pts), holes: [], area, c: [cx, cy], refs: [], pois: [], use, kinds: [],
              levels, height: Math.round((levels * 3.1 + 1.2) * 10) / 10, estH: true, roof: 0, wallCol: '', roofCol: '', mat: 0, roofMat: 0, roofH: 0,
              res: use === 'house' ? Math.max(1, Math.min(6, Math.round(floor * 0.5 / 45))) : Math.max(2, Math.round(floor * 0.7 / 45)), jobs: use === 'apartments' ? Math.round(floor / 800) : 0,
              name: '', addr: e.name || '', ent: row === 0 ? [cx - nx * hd, cy - ny * hd] : null,
            });
            placedRow = true; off += d + R([1, 3]);
          }
          t += w + gap;
          if (!placedRow) t += 2;
        }
      }
    }
  }
  return { added, stats: { generated: added.length, region } };
}
