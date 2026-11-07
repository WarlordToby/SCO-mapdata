// World grid for the strategic layer: 0.25° cells (1440 × 720) with satellite land-cover shares (ESA WorldCover 2021,
// read from the overview levels of its Cloud-Optimised GeoTIFFs, so only a few hundred KB per 3° tile are transferred)
// and the country each cell belongs to (same country shapes as the game).
// Output: game/src/world.grid (gzip; 16-byte header "SCOWGRD1" + w,h as uint32, then per cell 8 bytes:
// country index (0–254, 255 = none) | tree | grass/shrub/moss | crop | built | bare/snow | water/wetland | land share — 0–255)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fromUrl } from 'geotiff';
import * as d3 from 'd3-geo';
import { feature } from 'topojson-client';

const W = 1440, H = 720, RES = 0.25, CH = 8;
const data = JSON.parse(fs.readFileSync(new URL('../game/src/data.json', import.meta.url)));
const WORLD = feature(data.topo, data.topo.objects.countries).features.filter(f => f.id && f.id !== '010');
// class counts per cell
const cnt = new Float64Array(W * H * 7); // tree, grassy, crop, built, bare, water, total
const GROUP = { 10: 0, 20: 1, 30: 1, 100: 1, 40: 2, 50: 3, 60: 4, 70: 4, 80: 5, 90: 5, 95: 5 };
const tiles = [];
for (let la = -57; la <= 81; la += 3) for (let lo = -180; lo <= 177; lo += 3) tiles.push([lo, la]);
let done = 0, found = 0, bytes = 0;
async function doTile([lo, la]) {
  const ns = (la >= 0 ? 'N' : 'S') + String(Math.abs(la)).padStart(2, '0'), ew = (lo >= 0 ? 'E' : 'W') + String(Math.abs(lo)).padStart(3, '0');
  const url = `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${ns}${ew}_Map.tif`;
  try {
    const head = await fetch(url, { method: 'HEAD' }); if (!head.ok) return;
    const tiff = await fromUrl(url, { allowFullFile: false, cacheSize: 64 });
    const n = await tiff.getImageCount();
    let img = null; for (let i = n - 1; i >= 0; i--) { const im = await tiff.getImage(i); if (im.getWidth() >= 360) { img = im; break; } }
    if (!img) img = await tiff.getImage(0);
    const w = img.getWidth(), h = img.getHeight(), r = (await img.readRasters({ interleave: false }))[0];
    bytes += w * h; found++;
    for (let j = 0; j < h; j++) {
      const lat = la + 3 - (j + 0.5) * 3 / h, cj = Math.floor((90 - lat) / RES);
      for (let i = 0; i < w; i++) {
        const v = r[j * w + i]; if (!v) continue;
        const lon = lo + (i + 0.5) * 3 / w, ci = Math.floor((lon + 180) / RES), k = (cj * W + ci) * 7, g = GROUP[v];
        if (g !== undefined) cnt[k + g]++; cnt[k + 6]++;
      }
    }
  } catch (e) { console.log(`  ${ns}${ew}: ${e.message}`); }
  finally { if (++done % 100 === 0) console.log(`${done}/${tiles.length} tiles, ${found} with land`); }
}
const queue = tiles.slice(), workers = Array.from({ length: 24 }, async () => { while (queue.length) await doTile(queue.shift()); });
await Promise.all(workers);
console.log(`WorldCover: ${found} tiles read (${(bytes / 1e6).toFixed(0)} M overview pixels)`);

// countries: cell centre (or any of 4 sub-points) inside a country
const bb = WORLD.map(f => d3.geoBounds(f));
const countryAt = (lon, lat) => { for (let i = 0; i < WORLD.length; i++) { const b = bb[i]; const inLon = b[0][0] <= b[1][0] ? lon >= b[0][0] && lon <= b[1][0] : lon >= b[0][0] || lon <= b[1][0]; if (!inLon || lat < b[0][1] || lat > b[1][1]) continue; if (d3.geoContains(WORLD[i], [lon, lat])) return i; } return 255; };
const out = Buffer.alloc(16 + W * H * CH);
out.write('SCOWGRD1', 0); out.writeUInt32LE(W, 8); out.writeUInt32LE(H, 12);
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const lon = -180 + (i + 0.5) * RES, lat = 90 - (j + 0.5) * RES, k = (j * W + i) * 7, o = 16 + (j * W + i) * CH, tot = cnt[k + 6];
    let c = countryAt(lon, lat);
    if (c === 255 && tot > 0) for (const [dx, dy] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) { c = countryAt(lon + dx, lat + dy); if (c !== 255) break; }
    out[o] = c;
    if (tot > 0) { for (let g = 0; g < 6; g++) out[o + 1 + g] = Math.round(cnt[k + g] / tot * 255); out[o + 7] = Math.round((1 - cnt[k + 5] / tot) * 255); }
    else if (c !== 255) { out[o + 2] = 255; out[o + 7] = 255; } // land without WorldCover coverage (rare): treat as grassland
  }
  if (j % 90 === 0) console.log(`countries: row ${j}/${H}`);
}
const gz = zlib.gzipSync(out, { level: 9 });
fs.writeFileSync(new URL('../game/src/world.grid', import.meta.url), gz);
console.log(`world.grid: ${(gz.length / 1e6).toFixed(2)} MB (gzip), ${WORLD.length} countries`);
