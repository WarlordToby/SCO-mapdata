// Runs fetch → compile → bundle for several cities sharing one download cache. Failures are logged and skipped.
// usage: node pipeline/batch.mjs --cities "slug slug" --out bundles
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const { cities, radiusKm } = JSON.parse(fs.readFileSync(new URL('./cities.json', import.meta.url)));
const want = args.cities.split(/\s+/).filter(Boolean), out = path.resolve(args.out || 'bundles'), report = [];
fs.mkdirSync(out, { recursive: true });
for (const s of want) {
  const c = cities.find(x => x.slug === s); if (!c) { report.push({ slug: s, ok: false, err: 'not in cities.json' }); continue; }
  const work = path.resolve('work', s), t0 = Date.now();
  try {
    console.log(`\n=== ${c.name} (${c.cc}) ===`);
    execFileSync('node', ['pipeline/fetch.mjs', '--city', c.name, '--country', c.cc, '--lat', String(c.lat), '--lon', String(c.lon), '--radius', String(radiusKm), '--out', work, '--cache', path.resolve('cache')], { stdio: 'inherit' });
    execFileSync('node', ['--max-old-space-size=6000', 'compiler/compile.mjs', '--work', work, '--out', 'packs-out', '--slug', s], { stdio: 'inherit' });
    execFileSync('node', ['pipeline/bundle.mjs', path.join('packs-out', s), path.join(out, s + '.bin')], { stdio: 'inherit' });
    const m = JSON.parse(fs.readFileSync(path.join('packs-out', s, 'manifest.json'), 'utf8'));
    report.push({ slug: s, ok: true, cc: c.cc, name: c.name, bytes: fs.statSync(path.join(out, s + '.bin')).size, buildings: m.stats.buildings, secs: Math.round((Date.now() - t0) / 1000) });
    fs.rmSync(work, { recursive: true, force: true }); fs.rmSync(path.join('packs-out', s), { recursive: true, force: true });
  } catch (e) { console.log(`!! ${s} failed: ${e.message}`); report.push({ slug: s, ok: false, err: String(e.message).slice(0, 300) }); }
}
fs.writeFileSync(path.join(out, `report-${(args.id || want[0]).replace(/[^a-z0-9+_-]/gi, '_')}.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
