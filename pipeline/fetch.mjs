// Downloads everything one city pack needs: OSM data (Geofabrik regional extracts, cut to the pack area
// with osmium) and Copernicus GLO-30 elevation tiles. Runs on a machine with open internet (GitHub Actions).
//
// usage: node pipeline/fetch.mjs --city "Strasbourg" [--country FR] [--lat 48.58 --lon 7.75] [--radius 6] --out work/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const UA = 'SCO-mapdata-pipeline/1.0 (+https://github.com/WarlordToby/sco-mapdata)';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const out = path.resolve(args.out || 'work');
const cache = path.resolve(args.cache || out); // big downloads (regional extracts, DEM tiles) can be shared between cities
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(cache, { recursive: true });

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return true;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (r.status === 404) return false;
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file + '.part'));
  fs.renameSync(file + '.part', file);
  console.log(`  downloaded ${path.basename(file)} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
  return true;
}

// 1. Locate the city
let lat = parseFloat(args.lat), lon = parseFloat(args.lon), displayName = args.city;
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  const q = new URLSearchParams({ q: args.city, format: 'jsonv2', limit: '1', featuretype: 'city' });
  if (args.country) q.set('countrycodes', args.country.toLowerCase());
  const res = await getJSON(`https://nominatim.openstreetmap.org/search?${q}`);
  if (!res.length) throw new Error(`City not found: ${args.city}`);
  lat = +res[0].lat; lon = +res[0].lon; displayName = res[0].display_name;
}
const radius = parseFloat(args.radius || '6');
const dLat = radius / 110.574, dLon = radius / (111.320 * Math.cos(lat * Math.PI / 180));
const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
console.log(`City: ${displayName}\nCentre ${lat.toFixed(5)}, ${lon.toFixed(5)} · radius ${radius} km · bbox ${bbox.map(v => v.toFixed(4)).join(',')}`);

// 2. Pick the smallest Geofabrik extracts that cover the area (a border city can need several, e.g. Strasbourg + Kehl)
const idxFile = path.join(cache, 'geofabrik-index.json');
if (!fs.existsSync(idxFile)) fs.writeFileSync(idxFile, JSON.stringify(await getJSON('https://download.geofabrik.de/index-v1.json')));
const index = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
const feats = index.features;
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const inGeom = (pt, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(p => inRing(pt, p[0]) && !p.slice(1).some(h => inRing(pt, h)));
const areaCache = new WeakMap();
const geomArea = g => { if (areaCache.has(g)) return areaCache.get(g); let x0 = 180, y0 = 90, x1 = -180, y1 = -90; for (const p of (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)) for (const [x, y] of p[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } const a = (x1 - x0) * (y1 - y0); areaCache.set(g, a); return a; };
const samples = [];
for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) samples.push([bbox[0] + (bbox[2] - bbox[0]) * i / 6, bbox[1] + (bbox[3] - bbox[1]) * j / 6]);
const regions = new Map();
for (const pt of samples) {
  const hits = feats.filter(f => f.geometry && f.properties.urls?.pbf && inGeom(pt, f.geometry));
  if (!hits.length) continue;
  // smallest extract wins (e.g. Regierungsbezirk Freiburg rather than the whole DACH region)
  const leaf = hits.sort((a, b) => geomArea(a.geometry) - geomArea(b.geometry))[0];
  regions.set(leaf.properties.id, leaf.properties);
}
if (!regions.size) throw new Error('No Geofabrik extract covers this area.');
console.log(`Extracts: ${[...regions.keys()].join(', ')}`);

// 3. Download, cut to bbox, merge, convert to OPL text for the compiler
const cut = [];
for (const [id, p] of regions) {
  const pbf = path.join(cache, `${id.replace(/\//g, '_')}.osm.pbf`);
  await download(p.urls.pbf, pbf);
  const part = path.join(out, `cut_${id.replace(/\//g, '_')}.osm.pbf`);
  execFileSync('osmium', ['extract', '-b', bbox.join(','), '-s', 'complete_ways', '--overwrite', '-o', part, pbf], { stdio: 'inherit' });
  cut.push(part);
}
const merged = path.join(out, 'area.osm.pbf');
if (cut.length > 1) execFileSync('osmium', ['merge', '--overwrite', '-o', merged, ...cut], { stdio: 'inherit' });
else fs.copyFileSync(cut[0], merged);
execFileSync('osmium', ['cat', '--overwrite', '-f', 'opl', '-o', path.join(out, 'area.opl'), merged], { stdio: 'inherit' });

// 4. Elevation: Copernicus GLO-30 DSM, 1°×1° Cloud-Optimised GeoTIFFs on AWS Open Data
const dem = [];
for (let la = Math.floor(bbox[1]); la <= Math.floor(bbox[3]); la++) for (let lo = Math.floor(bbox[0]); lo <= Math.floor(bbox[2]); lo++) {
  const ns = (la >= 0 ? 'N' : 'S') + String(Math.abs(la)).padStart(2, '0'), ew = (lo >= 0 ? 'E' : 'W') + String(Math.abs(lo)).padStart(3, '0');
  const name = `Copernicus_DSM_COG_10_${ns}_00_${ew}_00_DEM`;
  const file = path.join(cache, name + '.tif');
  if (await download(`https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`, file)) { if (cache !== out && !fs.existsSync(path.join(out, name + '.tif'))) fs.symlinkSync(file, path.join(out, name + '.tif')); dem.push(name + '.tif'); }
  else console.log(`  no DEM tile ${name} (sea) — treated as 0 m`);
}

// 4b. Land cover: ESA WorldCover 2021 v200 (10 m, CC BY 4.0), 3°×3° Cloud-Optimised GeoTIFFs on AWS Open Data.
// A tile that does not exist is open sea (WorldCover only covers land).
const worldcover = [], wcMissing = [];
for (let la = Math.floor(bbox[1] / 3) * 3; la <= Math.floor(bbox[3] / 3) * 3; la += 3) for (let lo = Math.floor(bbox[0] / 3) * 3; lo <= Math.floor(bbox[2] / 3) * 3; lo += 3) {
  const ns = (la >= 0 ? 'N' : 'S') + String(Math.abs(la)).padStart(2, '0'), ew = (lo >= 0 ? 'E' : 'W') + String(Math.abs(lo)).padStart(3, '0');
  const name = `ESA_WorldCover_10m_2021_v200_${ns}${ew}_Map`, file = path.join(cache, name + '.tif');
  try {
    if (await download(`https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/${name}.tif`, file)) {
      if (cache !== out && !fs.existsSync(path.join(out, name + '.tif'))) fs.symlinkSync(file, path.join(out, name + '.tif'));
      worldcover.push(name + '.tif');
    } else wcMissing.push([lo, la, lo + 3, la + 3]);
  } catch (e) { console.log(`  WorldCover ${name} failed: ${e.message}`); }
}

// Crop to the pack area at native resolution (1/12000°) → landcover.json.gz { bbox, w, h, b64 } (class codes; sea = 80)
let landcover = null;
if (worldcover.length || wcMissing.length) {
  const { fromFile } = await import('geotiff');
  const res = 1 / 12000, w = Math.ceil((bbox[2] - bbox[0]) / res), h = Math.ceil((bbox[3] - bbox[1]) / res), grid = new Uint8Array(w * h).fill(80);
  for (const f of worldcover) {
    const img = await (await fromFile(path.join(cache, f))).getImage(), [x0, , , y1] = img.getBoundingBox();
    const px = Math.floor((bbox[0] - x0) / res), py = Math.floor((y1 - bbox[3]) / res);
    const win = [Math.max(0, px), Math.max(0, py), Math.min(img.getWidth(), px + w), Math.min(img.getHeight(), py + h)];
    if (win[2] <= win[0] || win[3] <= win[1]) continue;
    const r = (await img.readRasters({ window: win }))[0], ww = win[2] - win[0];
    for (let j = win[1]; j < win[3]; j++) for (let i = win[0]; i < win[2]; i++) { const v = r[(j - win[1]) * ww + (i - win[0])]; grid[(j - py) * w + (i - px)] = v || 80; }
  }
  const zlib = await import('node:zlib');
  fs.writeFileSync(path.join(out, 'landcover.json.gz'), zlib.gzipSync(JSON.stringify({ bbox, w, h, res, b64: Buffer.from(grid).toString('base64') })));
  landcover = 'landcover.json.gz';
  console.log(`Land cover: ${w}×${h} cells from ${worldcover.length} WorldCover tile(s)`);
}

// 5. Property boundaries. France: Etalab cadastre parcels (open licence), one GeoJSON file per commune.
const cadastre = [];
if ((args.country || '').toUpperCase() === 'FR') {
  const codes = new Set(), pts = [];
  const nx = Math.max(4, Math.ceil(radius * 2 / 0.8));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nx; j++) pts.push([bbox[0] + (bbox[2] - bbox[0]) * i / nx, bbox[1] + (bbox[3] - bbox[1]) * j / nx]);
  for (let k = 0; k < pts.length; k += 8) {
    await Promise.all(pts.slice(k, k + 8).map(async ([x, y]) => {
      try { const r = await getJSON(`https://geo.api.gouv.fr/communes?lat=${y}&lon=${x}&fields=code`); for (const c of r) codes.add(c.code); } catch (e) { console.log(`  commune lookup failed at ${x},${y}: ${e.message}`); }
    }));
  }
  fs.mkdirSync(path.join(out, 'cadastre'), { recursive: true });
  for (const code of [...codes].sort()) {
    const dep = code.startsWith('97') ? code.slice(0, 3) : code.slice(0, 2);
    const file = path.join(out, 'cadastre', `${code}.json.gz`);
    try { if (await download(`https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/communes/${dep}/${code}/cadastre-${code}-parcelles.json.gz`, file)) cadastre.push(`cadastre/${code}.json.gz`); }
    catch (e) { console.log(`  cadastre ${code} failed: ${e.message}`); }
  }
  console.log(`Cadastre: ${cadastre.length}/${codes.size} communes`);
}

fs.writeFileSync(path.join(out, 'area.json'), JSON.stringify({
  city: args.city, displayName, country: (args.country || '').toUpperCase(), lat, lon, radiusKm: radius, bbox,
  extracts: [...regions.values()].map(p => ({ id: p.id, name: p.name, url: p.urls.pbf })), dem, landcover, cadastre,
  fetchedAt: new Date().toISOString(),
}, null, 2));
console.log('Fetch complete.');
