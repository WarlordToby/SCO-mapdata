// Builds pipeline/cities.json: the cities that get a playable map pack.
// Rule: cities with ≥ MIN_POP inhabitants (city proper, from the game's own city data so names match the strategic map),
// largest first, at most PER per country, skipping any city within SPACING km of one already chosen; plus EXTRA cities.
// usage: node pipeline/citylist.mjs [--min 1000000] [--per 3] [--spacing 150] [--radius 4]
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const MIN = +(args.min || 1e6), PER = +(args.per || 3), SPACING = +(args.spacing || 150), R = +(args.radius || 4);
const EXTRA = [['FR', 'Strasbourg']];
const data = JSON.parse(fs.readFileSync(new URL('../game/src/data.json', import.meta.url)));
const slug = (cc, n) => cc.toLowerCase() + '-' + n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const km = (a, b) => { const kx = 111.32 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180); return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 110.574); };
const all = [];
for (const [cc, list] of Object.entries(data.cities)) for (const [name, lon, lat, pop] of list) {
  const extra = EXTRA.some(([k, n]) => k === cc && n === name);
  if (pop >= MIN || extra) all.push({ cc, name, lon, lat, pop, slug: slug(cc, name), extra });
}
all.sort((a, b) => b.pop - a.pop);
const out = [], per = {};
for (const c of all) {
  if (!c.extra && ((per[c.cc] || 0) >= PER || out.some(k => km(k, c) < SPACING))) continue;
  out.push(c); per[c.cc] = (per[c.cc] || 0) + 1; delete c.extra;
}
out.sort((a, b) => b.pop - a.pop);
fs.writeFileSync(new URL('./cities.json', import.meta.url), JSON.stringify({ minPop: MIN, perCountry: PER, spacingKm: SPACING, radiusKm: R, cities: out }, null, 1));
console.log(`${out.length} cities in ${new Set(out.map(c => c.cc)).size} countries`);
