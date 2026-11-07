// Terrain from Copernicus GLO-30 GeoTIFFs (falls back to flat ground when no tiles are present).
import { fromFile } from 'geotiff';

export async function loadTerrain(files, P) {
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
  const at = (x, y) => (rasters.length ? sampleLL(...P.inv(x, y)) : 0);
  let min = Infinity, max = -Infinity;
  return {
    at,
    info: rasters.length ? { source: 'Copernicus GLO-30', tiles: rasters.length } : { source: 'flat (no DEM tiles)', tiles: 0 },
    tile(ox, oy, size, step) {
      const n = Math.round(size / step) + 1, buf = new Int16Array(n * n), scale = 0.2;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const z = at(ox + i * step, oy + j * step); buf[j * n + i] = Math.round(z / scale); if (z < min) min = z; if (z > max) max = z; }
      return { n, step, scale, b64: Buffer.from(buf.buffer).toString('base64') };
    },
  };
}
