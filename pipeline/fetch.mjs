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
fs.mkdirSync(out, { recursive: true });

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
const index = await getJSON('https://download.geofabrik.de/index-v1.json');
const feats = index.features;
const parents = new Set(feats.map(f => f.properties.parent).filter(Boolean));
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const inGeom = (pt, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(p => inRing(pt, p[0]) && !p.slice(1).some(h => inRing(pt, h)));
const samples = [];
for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) samples.push([bbox[0] + (bbox[2] - bbox[0]) * i / 6, bbox[1] + (bbox[3] - bbox[1]) * j / 6]);
const regions = new Map();
for (const pt of samples) {
  const hits = feats.filter(f => f.geometry && f.properties.urls?.pbf && inGeom(pt, f.geometry));
  if (!hits.length) continue;
  const leaf = hits.find(f => !parents.has(f.properties.id)) || hits[hits.length - 1];
  regions.set(leaf.properties.id, leaf.properties);
}
if (!regions.size) throw new Error('No Geofabrik extract covers this area.');
console.log(`Extracts: ${[...regions.keys()].join(', ')}`);

// 3. Download, cut to bbox, merge, convert to OPL text for the compiler
const cut = [];
for (const [id, p] of regions) {
  const pbf = path.join(out, `${id.replace(/\//g, '_')}.osm.pbf`);
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
  const file = path.join(out, name + '.tif');
  if (await download(`https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`, file)) dem.push(path.basename(file));
  else console.log(`  no DEM tile ${name} (sea) — treated as 0 m`);
}

fs.writeFileSync(path.join(out, 'area.json'), JSON.stringify({
  city: args.city, displayName, country: (args.country || '').toUpperCase(), lat, lon, radiusKm: radius, bbox,
  extracts: [...regions.values()].map(p => ({ id: p.id, name: p.name, url: p.urls.pbf })), dem,
  fetchedAt: new Date().toISOString(),
}, null, 2));
console.log('Fetch complete.');
