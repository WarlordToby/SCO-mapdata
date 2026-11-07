// Groups the cities of cities.json by the Geofabrik extract(s) that cover them, so each batch job downloads its regional
// extract once. Writes the GitHub Actions matrix: [{ id, cities: "slug slug …" }, …].
// usage: node pipeline/plan.mjs [--only slug,slug] [--per-job 8] > matrix.json
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const { cities, radiusKm } = JSON.parse(fs.readFileSync(new URL('./cities.json', import.meta.url)));
const only = args.only ? new Set(args.only.split(',').map(s => s.trim()).filter(Boolean)) : null;
const PER = +(args['per-job'] || 8);
const r = await fetch('https://download.geofabrik.de/index-v1.json', { headers: { 'User-Agent': 'SCO-mapdata-pipeline/1.0' } });
const feats = (await r.json()).features.filter(f => f.geometry && f.properties.urls?.pbf);
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const polys = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const inGeom = (pt, g) => polys(g).some(p => inRing(pt, p[0]) && !p.slice(1).some(h => inRing(pt, h)));
const area = g => { let x0 = 180, y0 = 90, x1 = -180, y1 = -90; for (const p of polys(g)) for (const [x, y] of p[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return (x1 - x0) * (y1 - y0); };
feats.forEach(f => f.a = area(f.geometry));
const groups = new Map();
for (const c of cities) {
  if (only && !only.has(c.slug)) continue;
  const dLat = radiusKm / 110.574, dLon = radiusKm / (111.32 * Math.cos(c.lat * Math.PI / 180)), ids = new Set();
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    const pt = [c.lon - dLon + 2 * dLon * i / 4, c.lat - dLat + 2 * dLat * j / 4];
    const hit = feats.filter(f => inGeom(pt, f.geometry)).sort((a, b) => a.a - b.a)[0]; if (hit) ids.add(hit.properties.id);
  }
  const key = [...ids].sort().join('+') || 'none';
  (groups.get(key) || groups.set(key, []).get(key)).push(c.slug);
}
const matrix = [];
for (const [key, slugs] of groups) for (let i = 0; i < slugs.length; i += PER) matrix.push({ id: key.replace(/[^a-z0-9+]+/gi, '_') + (i ? '-' + i / PER : ''), cities: slugs.slice(i, i + PER).join(' ') });
process.stdout.write(JSON.stringify(matrix));
console.error(`${matrix.length} jobs for ${[...groups.values()].flat().length} cities`);
