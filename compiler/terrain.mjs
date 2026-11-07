// Terrain from Copernicus GLO-30 (falls back to flat ground when no tiles are present).
// GLO-30 is a *surface* model: it includes buildings and tree canopy. We derive bare earth from it:
// resample to a 20 m local grid, remove raised objects with a morphological opening (min then max filter,
// ~120 m radius), then smooth. The result is a gentle ground surface that streets and buildings sit on.
import { fromFile } from 'geotiff';

const STEP = 20, OPEN_R = 6, BLUR_R = 4;

export async function loadTerrain(files, P, R) {
  const rasters = [];
  for (const f of files) {
    try {
      const tiff = await fromFile(f), img = await tiff.getImage();
      const [x0, y0, x1, y1] = img.getBoundingBox();
      const w = img.getWidth(), h = img.getHeight();
      const data = (await img.readRasters({ interleave: true }));
      rasters.push({ x0, y0, x1, y1, w, h, data });
    } catch (e) { console.warn('  terrain tile failed:', f, e.message); }
  }
  const sampleLL = (lon, lat) => {
    for (const r of rasters) {
      if (lon < r.x0 || lon > r.x1 || lat < r.y0 || lat > r.y1) continue;
      const fx = (lon - r.x0) / (r.x1 - r.x0) * r.w - 0.5, fy = (r.y1 - lat) / (r.y1 - r.y0) * r.h - 0.5;
      const ix = Math.max(0, Math.min(r.w - 2, Math.floor(fx))), iy = Math.max(0, Math.min(r.h - 2, Math.floor(fy)));
      const tx = Math.min(1, Math.max(0, fx - ix)), ty = Math.min(1, Math.max(0, fy - iy));
      const v = (i, j) => { const d = r.data[j * r.w + i]; return d < -1000 ? 0 : d; };
      return v(ix, iy) * (1 - tx) * (1 - ty) + v(ix + 1, iy) * tx * (1 - ty) + v(ix, iy + 1) * (1 - tx) * ty + v(ix + 1, iy + 1) * tx * ty;
    }
    return 0;
  };
  if (!rasters.length) return { at: () => 0, info: { source: 'flat (no DEM tiles)', tiles: 0 }, tile: flatTile };

  // 1. Resample the surface model onto a local metric grid covering the pack (+ margin for the filters)
  const ext = (R || 7000) + (OPEN_R + BLUR_R * 2 + 4) * STEP, n = Math.ceil(ext * 2 / STEP) + 1, o = -ext;
  let g = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g[j * n + i] = sampleLL(...P.inv(o + i * STEP, o + j * STEP));
  const raw = g.slice();
  // 2. Morphological opening removes buildings and canopy; 3. box blur twice ≈ Gaussian smoothing
  g = filt(g, n, OPEN_R, Math.min);
  g = filt(g, n, OPEN_R, Math.max);
  for (let k = 0; k < 2; k++) g = blur(blur(g, n, BLUR_R, true), n, BLUR_R, false);
  let removed = 0; for (let k = 0; k < g.length; k++) removed = Math.max(removed, raw[k] - g[k]);

  const at = (x, y) => {
    const fx = (x - o) / STEP, fy = (y - o) / STEP, i = Math.max(0, Math.min(n - 2, Math.floor(fx))), j = Math.max(0, Math.min(n - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - i)), ty = Math.min(1, Math.max(0, fy - j)), v = (a, b) => g[b * n + a];
    return v(i, j) * (1 - tx) * (1 - ty) + v(i + 1, j) * tx * (1 - ty) + v(i, j + 1) * (1 - tx) * ty + v(i + 1, j + 1) * tx * ty;
  };
  return {
    at,
    info: { source: 'Copernicus GLO-30, bare-earth filtered', tiles: rasters.length, gridStep: STEP, maxObjectRemoved: Math.round(removed) },
    tile(ox, oy, size, step) {
      const m = Math.round(size / step) + 1, buf = new Int16Array(m * m), scale = 0.2;
      for (let jj = 0; jj < m; jj++) for (let ii = 0; ii < m; ii++) buf[jj * m + ii] = Math.round(at(ox + ii * step, oy + jj * step) / scale);
      return { n: m, step, scale, b64: Buffer.from(buf.buffer).toString('base64') };
    },
  };
}
function flatTile(ox, oy, size, step) { const m = Math.round(size / step) + 1; return { n: m, step, scale: 0.2, b64: Buffer.from(new Int16Array(m * m).buffer).toString('base64') }; }
// Separable min/max filter (applied once per axis by calling twice: rows then columns alternate via transpose trick)
function filt(src, n, r, op) {
  // rows
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let v = src[j * n + i]; for (let k = Math.max(0, i - r); k <= Math.min(n - 1, i + r); k++) v = op(v, src[j * n + k]); tmp[j * n + i] = v; }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let v = tmp[j * n + i]; for (let k = Math.max(0, j - r); k <= Math.min(n - 1, j + r); k++) v = op(v, tmp[k * n + i]); out[j * n + i] = v; }
  return out;
}
function blur(src, n, r, horiz) {
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = -r; k <= r; k++) { const a = horiz ? i + k : i, b = horiz ? j : j + k; if (a < 0 || b < 0 || a >= n || b >= n) continue; s += src[b * n + a]; c++; }
    out[j * n + i] = s / c;
  }
  return out;
}
