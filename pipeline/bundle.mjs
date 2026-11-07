// Packs a compiled city pack directory (manifest + tiles) into one gzip file the game loads in a single request.
// usage: node pipeline/bundle.mjs packs/<slug> bundles/<slug>.bin
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const [dir, outFile] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const tiles = {};
for (const t of manifest.tiles) tiles[t.key] = JSON.parse(fs.readFileSync(path.join(dir, 'tiles', t.key + '.json'), 'utf8'));
const buf = zlib.gzipSync(JSON.stringify({ format: 'sco-citybundle', version: 1, manifest, tiles }), { level: 9 });
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, buf);
console.log(`${path.basename(outFile)}: ${manifest.tiles.length} tiles, ${(buf.length / 1e6).toFixed(2)} MB`);
