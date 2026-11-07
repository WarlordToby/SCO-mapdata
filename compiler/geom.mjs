// Geometry helpers. All compiled coordinates are local metres: x east, y north from the pack origin.
export function makeProj(lon0, lat0) {
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110574;
  return { fwd: (lon, lat) => [(lon - lon0) * kx, (lat - lat0) * ky], inv: (x, y) => [lon0 + x / kx, lat0 + y / ky], kx, ky };
}
export const area = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; }; // >0 = clockwise... sign normalised below
export const signedArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; }; // >0 counter-clockwise
export const ccw = r => (signedArea(r) < 0 ? r.slice().reverse() : r);
export function inRing(p, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
export function centroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; }
  if (Math.abs(a) < 1e-9) return r[0];
  return [cx / (3 * a), cy / (3 * a)];
}
export function bboxOf(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }

// Douglas–Peucker
export function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
export function simplifyRing(r, tol) { // r without closing point
  if (r.length < 5) return r;
  const s = simplify([...r, r[0]], tol); s.pop(); return s.length >= 3 ? s : r;
}

// Join way segments (arrays of node ids) into closed rings.
export function assembleRings(segs) {
  const rings = [], open = segs.filter(s => s.length > 1).map(s => s.slice());
  while (open.length) {
    let cur = open.pop();
    let guard = 0;
    while (cur[0] !== cur[cur.length - 1] && guard++ < 10000) {
      const end = cur[cur.length - 1];
      const i = open.findIndex(s => s[0] === end || s[s.length - 1] === end);
      if (i < 0) break;
      const s = open.splice(i, 1)[0];
      cur = cur.concat((s[0] === end ? s : s.slice().reverse()).slice(1));
    }
    if (cur[0] === cur[cur.length - 1] && cur.length >= 4) rings.push(cur.slice(0, -1));
  }
  return rings;
}

// Sutherland–Hodgman clip of a ring to an axis-aligned rectangle.
export function clipRing(r, [x0, y0, x1, y1]) {
  const edges = [[p => p[0] >= x0, (a, b) => lerpX(a, b, x0)], [p => p[0] <= x1, (a, b) => lerpX(a, b, x1)], [p => p[1] >= y0, (a, b) => lerpY(a, b, y0)], [p => p[1] <= y1, (a, b) => lerpY(a, b, y1)]];
  let out = r;
  for (const [inside, cut] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[(i + inp.length - 1) % inp.length], b = inp[i];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}
const lerpX = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
const lerpY = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];

export function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  let t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
  const q = [a[0] + dx * t, a[1] + dy * t];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q, t };
}
export const polyLen = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
export const bearingXY = (a, b) => (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360;

// Uniform grid spatial index of bounding boxes.
export class Grid {
  constructor(cell) { this.c = cell; this.m = new Map(); }
  key(i, j) { return i * 100003 + j; }
  insert(bb, v) { const c = this.c; for (let i = Math.floor(bb[0] / c); i <= Math.floor(bb[2] / c); i++) for (let j = Math.floor(bb[1] / c); j <= Math.floor(bb[3] / c); j++) { const k = this.key(i, j); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(v); } }
  query(x, y, r = 0) { const c = this.c, out = new Set(); for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) for (let j = Math.floor((y - r) / c); j <= Math.floor((y + r) / c); j++) { const a = this.m.get(this.key(i, j)); if (a) for (const v of a) out.add(v); } return out; }
}
