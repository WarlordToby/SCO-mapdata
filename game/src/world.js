// World model for the strategic layer: a 0.25° grid of land cells with satellite land cover (ESA WorldCover), country,
// population (cities from the game's city data plus the rest of each country's people spread over farmland and
// built-up land) and the strength of national defence. Also the blocs: groups of small countries that share one
// response organization, and every other country's own organization.
import { WORLD, META, d3 } from './geo.js';
import DATA from './data.json';

export const W = 1440, H = 720, RES = 0.25;
export const G = { ready: false };
export const cellOf = (lon, lat) => { const i = Math.floor((lon + 180) / RES), j = Math.floor((90 - lat) / RES); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
export const cellLonLat = c => [-180 + (c % W + 0.5) * RES, 90 - (Math.floor(c / W) + 0.5) * RES];

// Blocs: neighbouring small countries pooled into one organization (by ISO alpha-2).
export const BLOCS = [
  { id: 'nordic', name: 'Nordic Joint Response Directorate', short: 'NJRD', members: 'SE NO FI DK IS' },
  { id: 'baltic', name: 'Baltic Joint Defence Agency', short: 'BJDA', members: 'EE LV LT' },
  { id: 'benelux', name: 'Benelux Civil Protection Command', short: 'BCPC', members: 'BE NL LU' },
  { id: 'balkans', name: 'Western Balkans Civil Protection Union', short: 'WBCPU', members: 'RS BA ME MK AL XK' },
  { id: 'centam', name: 'Central American Integrated Response Force', short: 'CAIRF', members: 'GT BZ SV HN NI CR PA' },
  { id: 'carib', name: 'Caribbean Disaster Response Agency', short: 'CDRA', members: 'CU DO HT JM BS TT' },
  { id: 'guianas', name: 'Guiana Shield Response Unit', short: 'GSRU', members: 'GY SR' },
  { id: 'gulf', name: 'Gulf Joint Shield Command', short: 'GJSC', members: 'SA AE KW QA BH OM' },
  { id: 'sahel', name: 'Sahel Joint Force', short: 'SJF', members: 'ML BF NE TD MR' },
  { id: 'westafrica', name: 'West African Coastal Command', short: 'WACC', members: 'SN GM GW GN SL LR CI TG BJ' },
  { id: 'centafrica', name: 'Central African Security Pact', short: 'CASP', members: 'CF CG GA GQ' },
  { id: 'eastafrica', name: 'East African Community Response Force', short: 'EACRF', members: 'KE UG RW BI SS' },
  { id: 'horn', name: 'Horn of Africa Command', short: 'HAC', members: 'SO DJ ER' },
  { id: 'southafrica', name: 'Southern African Development Response', short: 'SADR', members: 'BW NA ZW ZM MW MZ LS SZ' },
  { id: 'centasia', name: 'Central Asian Response Agency', short: 'CARA', members: 'UZ KG TJ TM' },
  { id: 'mekong', name: 'Mekong Response Command', short: 'MRC', members: 'KH LA' },
  { id: 'pacific', name: 'Pacific Islands Response Network', short: 'PIRN', members: 'FJ PG SB VU NC' },
];

export async function loadWorld() {
  if (G.ready) return G;
  const r = await fetch('world.json'); if (!r.ok) throw new Error('World grid missing');
  let buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset), w = dv.getUint32(8, true), h = dv.getUint32(12, true), CH = 8;
  if (w !== W || h !== H) throw new Error('Unexpected world grid size');
  // land cells
  const idx = new Int32Array(W * H).fill(-1), cells = [];
  for (let c = 0; c < W * H; c++) { const o = 16 + c * CH; if (buf[o + 7] > 40 && buf[o] !== 255) { idx[c] = cells.length; cells.push(c); } }
  const N = cells.length, cell = Int32Array.from(cells), country = new Uint8Array(N), lc = new Float32Array(N * 7);
  for (let k = 0; k < N; k++) { const o = 16 + cell[k] * CH; country[k] = buf[o]; for (let g = 0; g < 7; g++) lc[k * 7 + g] = buf[o + 1 + g] / 255; }
  // terrain: how easily a threat moves through a cell (woods, desert and wetland slow it; farmland and towns speed it)
  const terr = new Float32Array(N);
  for (let k = 0; k < N; k++) { const t = lc.subarray(k * 7, k * 7 + 7); terr[k] = Math.max(0.15, t[0] * 0.45 + t[1] * 0.9 + t[2] * 1.05 + t[3] * 1.5 + t[4] * 0.45 + t[5] * 0.3) * (0.3 + 0.7 * t[6]); }
  // population: listed cities into their cells; the rest of each country over farmland and built-up land
  const pop = new Float32Array(N), urban = new Float32Array(N), byCountry = WORLD.map(() => []);
  for (let k = 0; k < N; k++) byCountry[country[k]].push(k);
  const nearestLand = c => { if (idx[c] >= 0) return idx[c]; const i0 = c % W, j0 = Math.floor(c / W); for (let r = 1; r <= 2; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = (i0 + di + W) % W, j = j0 + dj; if (j >= 0 && j < H && idx[j * W + i] >= 0) return idx[j * W + i]; } return -1; };
  const ccOf = WORLD.map(f => f.meta.cca2);
  const cities = []; // major world cities (for routes, emergencies and the map)
  for (const [cc, list] of Object.entries(DATA.cities)) for (const [name, lon, lat, p, cap] of list) {
    const k = nearestLand(cellOf(lon, lat)); if (k < 0) continue; urban[k] += p;
    if (p >= 2.5e5 || cap) cities.push({ id: cc + ':' + name, cc, name, lon, lat, pop: p, capital: !!cap, k });
  }
  for (let ci = 0; ci < WORLD.length; ci++) {
    const ks = byCountry[ci], total = WORLD[ci].meta.pop || 0; if (!ks.length) continue;
    let u = 0; for (const k of ks) u += urban[k];
    const rural = Math.max(total * 0.15, total - u);
    let wsum = 0; const wt = ks.map(k => { const t = lc.subarray(k * 7, k * 7 + 7); const x = t[6] * (t[2] * 1 + t[1] * 0.35 + t[3] * 2.5 + t[0] * 0.12 + t[4] * 0.03) + 1e-4; wsum += x; return x; });
    ks.forEach((k, n) => { pop[k] = urban[k] + rural * wt[n] / wsum; });
  }
  // national defence: troops follow people (square root), wealthier states field more per head
  const def = new Float32Array(N), strength = WORLD.map(f => { const m = f.meta, pc = (m.gdp || 1e9) / Math.max(1, m.pop || 1); return Math.max(0.35, Math.min(1.8, 0.4 + 0.45 * Math.log10(Math.max(500, pc) / 500))); });
  for (let k = 0; k < N; k++) def[k] = strength[country[k]] * (0.38 + Math.sqrt(pop[k] / 1e5) * 0.55);
  // organizations: one per bloc, one per remaining country
  const orgOf = new Array(WORLD.length), orgs = [];
  for (const b of BLOCS) { const mem = b.members.split(' '); const ids = WORLD.map((f, i) => mem.includes(f.meta.cca2) ? i : -1).filter(i => i >= 0); if (!ids.length) continue; const o = { ...b, countries: ids }; orgs.push(o); ids.forEach(i => orgOf[i] = o); }
  WORLD.forEach((f, i) => { if (orgOf[i]) return; const m = f.meta; const o = { id: m.cca2 || f.id, name: `${m.demonym || m.name} Containment Authority`, short: (m.cca3 || m.cca2 || '').toUpperCase() + 'CA', countries: [i] }; orgs.push(o); orgOf[i] = o; });
  cities.sort((a, b) => b.pop - a.pop);
  Object.assign(G, { ready: true, N, cell, idx, country, lc, terr, pop, def, strength, byCountry, ccOf, cities, orgs, orgOf });
  G.landImg = landImage(); G.nb = neighbours();
  return G;
}
// 8-neighbourhood in land-index space (wraps around the antimeridian); -1 = sea
function neighbours() {
  const nb = new Int32Array(G.N * 8).fill(-1);
  for (let k = 0; k < G.N; k++) { const c = G.cell[k], i0 = c % W, j0 = Math.floor(c / W); let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const j = j0 + dj; if (j >= 0 && j < H) nb[k * 8 + n] = G.idx[j * W + (i0 + di + W) % W]; n++; } }
  return nb;
}
// equirectangular land-cover picture (1 px per cell) for the world map
function landImage() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'), im = ctx.createImageData(W, H);
  const COL = [[38, 64, 38], [86, 104, 62], [118, 116, 70], [112, 108, 104], [150, 132, 100], [52, 82, 104]];
  for (let k = 0; k < G.N; k++) {
    const t = G.lc.subarray(k * 7, k * 7 + 7); let r = 0, g = 0, b = 0, s = 0;
    for (let q = 0; q < 6; q++) { r += COL[q][0] * t[q]; g += COL[q][1] * t[q]; b += COL[q][2] * t[q]; s += t[q]; }
    if (s > 0) { r /= s; g /= s; b /= s; } else { r = 90; g = 100; b = 70; }
    const o = G.cell[k] * 4, f = 0.62; im.data[o] = r * f; im.data[o + 1] = g * f; im.data[o + 2] = b * f; im.data[o + 3] = Math.round(255 * Math.min(1, 0.35 + t[6]));
  }
  ctx.putImageData(im, 0, 0); return cv;
}
export const countryName = ci => WORLD[ci]?.meta?.name || '';
// land cell at (or next to, for coastal places) a location; -1 if open sea
export function landAt(lon, lat) {
  const c = cellOf(lon, lat); if (c < 0) return -1; if (G.idx[c] >= 0) return G.idx[c];
  const i0 = c % W, j0 = Math.floor(c / W);
  for (let r = 1; r <= 2; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = (i0 + di + W) % W, j = j0 + dj; if (j >= 0 && j < H && G.idx[j * W + i] >= 0) return G.idx[j * W + i]; }
  return -1;
}
export const ciOfCcn3 = id => WORLD.findIndex(f => f.id === id);
export { WORLD, META, d3 };
