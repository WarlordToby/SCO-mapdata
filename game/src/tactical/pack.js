// Loads and decodes SCO city packs (format v1) into absolute local-metre geometry.
export async function loadManifest(base) {
  const r = await fetch(base + 'manifest.json'); if (!r.ok) throw new Error('Map pack not found: ' + base);
  return r.json();
}
export async function loadTile(base, key) {
  const r = await fetch(base + 'tiles/' + key + '.json'); if (!r.ok) return null;
  return decodeTile(await r.json());
}
function ringsFrom(pts, starts, ox, oy) {
  const out = [];
  for (let i = 0; i < starts.length; i += 2) out.push(deltaRing(pts, starts[i], starts[i + 1], ox, oy));
  return out;
}
function deltaRing(pts, s, n, ox, oy) {
  const r = new Array(n); let x = 0, y = 0;
  for (let k = 0; k < n; k++) { const i = (s + k) * 2; if (k === 0) { x = pts[i]; y = pts[i + 1]; } else { x += pts[i]; y += pts[i + 1]; } r[k] = [ox + x / 10, oy + y / 10]; }
  return r;
}
const holeRing = (flat, ox, oy) => deltaRing(flat, 0, flat.length / 2, ox, oy);

export function decodeTile(t) {
  const [ox, oy] = t.origin, B = t.buildings, E = t.roads, J = t.junctions;
  const rings = ringsFrom(B.pts, B.rs, ox, oy);
  const buildings = [];
  for (let i = 0; i < B.n; i++) buildings.push({
    osm: B.id[i], use: B.use[i], levels: B.lv[i], h: B.h[i] / 10, z: B.z[i] / 10, district: B.dist[i], res: B.res[i], jobs: B.jobs[i], est: !!B.est[i],
    ent: [ox + B.ent[i * 2] / 10, oy + B.ent[i * 2 + 1] / 10], name: B.name[i] || '', addr: B.addr[i] || '', kinds: B.kinds[i] || [],
    ring: rings[i], holes: (B.holes[i] || []).map(h => holeRing(h, ox, oy)),
  });
  const epts = ringsFrom(E.pts, E.ps, ox, oy);
  const edges = [];
  for (let i = 0; i < E.n; i++) edges.push({ id: E.id[i], a: E.a[i], b: E.b[i], cls: E.cls[i], lf: E.lf[i], lb: E.lb[i], speed: E.spd[i], flags: E.flags[i], layer: E.layer[i], len: E.len[i] / 10, name: E.name[i] || '', turnF: E.turnF[i] || '', turnB: E.turnB[i] || '', pts: epts[i] });
  const junctions = [];
  for (let i = 0; i < J.n; i++) junctions.push({ id: J.id[i], p: [ox + J.x[i] / 10, oy + J.y[i] / 10], z: J.z[i] / 10, ctrl: J.ctrl[i], inc: J.inc[i], yield: J.yield[i], conn: J.conn[i], phases: J.phases[i] || null });
  const A = t.areas, arings = ringsFrom(A.pts, A.rs, ox, oy);
  const areas = A.kind.map((k, i) => ({ kind: k, ring: arings[i], holes: (A.holes[i] || []).map(h => holeRing(h, ox, oy)) }));
  const L = t.lines, lpts = ringsFrom(L.pts, L.ps, ox, oy);
  const lines = L.kind.map((k, i) => ({ kind: k, flags: L.flags[i], pts: lpts[i] }));
  const BR = t.barriers; let barriers = [];
  if (BR) { const bp = ringsFrom(BR.pts, BR.ps, ox, oy); barriers = BR.kind.map((k, i) => ({ kind: k, h: BR.h[i] / 10, src: BR.src[i], pts: bp[i] })); }
  const pois = t.pois.map(([k, x, y, name]) => ({ kind: k, p: [ox + x / 10, oy + y / 10], name }));
  // terrain
  const bin = atob(t.terrain.b64), buf = new Int16Array(bin.length / 2);
  for (let i = 0; i < buf.length; i++) buf[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) << 16 >> 16;
  const terrain = { n: t.terrain.n, step: t.terrain.step, scale: t.terrain.scale, data: buf, ox, oy };
  return { key: t.key, origin: [ox, oy], buildings, edges, junctions, areas, lines, pois, barriers, terrain, trees: t.trees, lamps: t.lamps };
}
