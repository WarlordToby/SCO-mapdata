// Streaming reader for osmium's OPL text format.
import fs from 'node:fs';
import readline from 'node:readline';

const unesc = s => s.indexOf('%') < 0 ? s : s.replace(/%([0-9a-fA-F]+)%/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
function parseTags(s) {
  const t = {}; if (!s) return t;
  for (const kv of s.split(',')) { const i = kv.indexOf('='); if (i > 0) t[unesc(kv.slice(0, i))] = unesc(kv.slice(i + 1)); }
  return t;
}

// Node tags we care about (others are dropped to save memory).
const NODE_KEYS = ['highway', 'entrance', 'amenity', 'shop', 'office', 'place', 'emergency', 'craft', 'tourism', 'healthcare', 'railway', 'public_transport', 'crossing', 'direction', 'traffic_signals:direction', 'name', 'addr:housenumber', 'addr:street', 'military', 'man_made', 'power', 'barrier', 'natural', 'leaf_type', 'leaf_cycle', 'height', 'genus', 'species', 'denotation', 'access', 'locked', 'width', 'motor_vehicle', 'fence_type', 'foot', 'name:en', 'int_name', 'name:latin', 'name:fr'];

export async function readOPL(file) {
  const nodes = new Map();     // id -> [lon, lat]
  const tagged = [];           // tagged nodes {id, lon, lat, tags}
  const ways = new Map();      // id -> {id, tags, refs}
  const rels = [];             // {id, tags, members:[{type,ref,role}]}
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const kind = line[0];
    const f = line.split(' ');
    const id = +f[0].slice(1);
    let tags = '', x, y, refs = '', mem = '';
    for (let i = 1; i < f.length; i++) {
      const c = f[i][0], v = f[i].slice(1);
      if (c === 'T') tags = v; else if (c === 'x') x = +v; else if (c === 'y') y = +v; else if (c === 'N') refs = v; else if (c === 'M') mem = v;
    }
    if (kind === 'n') {
      if (!Number.isFinite(x)) continue;
      nodes.set(id, [x, y]);
      if (tags) {
        const t = parseTags(tags), keep = {};
        let any = false; for (const k of NODE_KEYS) if (t[k] !== undefined) { keep[k] = t[k]; any = true; }
        if (any) tagged.push({ id, lon: x, lat: y, tags: keep });
      }
    } else if (kind === 'w') {
      ways.set(id, { id, tags: parseTags(tags), refs: refs ? refs.split(',').map(r => +r.slice(1)) : [] });
    } else if (kind === 'r') {
      const t = parseTags(tags);
      if (!['multipolygon', 'building', 'restriction', 'boundary'].includes(t.type)) continue;
      const members = mem ? mem.split(',').map(m => { const at = m.indexOf('@'); return { type: m[0], ref: +m.slice(1, at), role: unesc(m.slice(at + 1)) }; }) : [];
      rels.push({ id, tags: t, members });
    }
  }
  return { nodes, tagged, ways, rels };
}
