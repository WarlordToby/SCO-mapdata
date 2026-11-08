// Countryside battle maps, generated in the browser from the world grid cell where the front is: the cell's satellite
// land-cover shares (forest, farmland, grassland, bare ground, water), its rural population and the region's building
// traditions. Fields, woods, a river, roads, farm tracks, villages and farmsteads are laid out to match them; the result
// has the same shape as a decoded city-pack tile set, so the city engine (renderer, simulation, barriers) runs it as is.
import { regionOf, FILL } from '../../../compiler/regions.mjs';

const T = 1000, STEP = 25, LCS = 10;
const CODES = {
  landcover: ['none', 'tree', 'shrub', 'grass', 'crop', 'built', 'bare', 'snow', 'water', 'wetland', 'mangrove', 'moss'],
  barrier: ['fence', 'chain', 'wood', 'railing', 'wire', 'hedge', 'wall', 'muret', 'retaining', 'jersey', 'guard', 'city_wall'],
  barrierProps: { fence: { h: 1.8, brk: 1 }, chain: { h: 1.8, brk: 1 }, wood: { h: 1.8, brk: 1 }, railing: { h: 1.1, brk: 1 }, wire: { h: 1.2, brk: 1 }, hedge: { h: 1.6, brk: 1 }, wall: { h: 2, brk: 2 }, muret: { h: 1.2, brk: 2 }, retaining: { h: 1.5, brk: 3 }, jersey: { h: 0.8, brk: 2 }, guard: { h: 0.75, brk: 1 }, city_wall: { h: 5, brk: 3 } },
  roof: ['unknown', 'flat', 'gabled', 'hipped', 'pyramidal', 'skillion', 'half-hipped', 'mansard', 'gambrel', 'dome', 'onion', 'round', 'saltbox', 'cone'],
  tree: ['broadleaved', 'needleleaved', 'palm'],
  use: ['house', 'apartments', 'retail', 'office', 'industrial', 'warehouse', 'civic', 'school', 'hospital', 'police', 'fire_station', 'religious', 'transport', 'hotel', 'minor', 'military', 'sports', 'unknown', 'farm', 'utility', 'parking', 'university'],
  poi: ['police', 'hospital', 'clinic', 'fire_station', 'pharmacy', 'fuel', 'supermarket', 'school', 'townhall', 'prison', 'military', 'train_station', 'bus_station', 'power', 'water', 'radio', 'shelter', 'stadium', 'hardware'],
  roadClass: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'track', 'pedestrian', 'footway', 'cycleway', 'steps'],
  control: ['none', 'priority', 'right_priority', 'stop', 'yield', 'signal', 'roundabout'], turn: ['through', 'left', 'right', 'uturn'],
  roadFlags: { oneway: 1, bridge: 2, tunnel: 4, roundabout: 8, private: 16, drive: 32, walk: 64, isolated_f: 128, isolated_b: 256, link: 512, bus: 1024, barrier: 2048 },
  area: ['residential', 'commercial', 'retail', 'industrial', 'military', 'railway', 'farmland', 'forest', 'grass', 'park', 'cemetery', 'water', 'wetland', 'sports', 'parking', 'construction', 'allotments', 'farmyard', 'beach', 'scrub'],
  line: ['rail', 'tram', 'light_rail', 'subway', 'river', 'canal', 'stream'],
};
const U = Object.fromEntries(CODES.use.map((u, i) => [u, i])), RC = Object.fromEntries(CODES.roadClass.map((c, i) => [c, i])), BK = Object.fromEntries(CODES.barrier.map((c, i) => [c, i]));
const FIELD = { // typical field size along/across (m) and hedgerows (bocage) by region
  'eu-west': [180, 260, 0.55], 'eu-north': [220, 320, 0.15], 'eu-east': [120, 600, 0.1], 'post-soviet': [500, 900, 0.05], 'mediterranean': [120, 180, 0.2],
  'mena': [80, 140, 0], 'subsaharan': [60, 90, 0.05], 'south-asia': [45, 90, 0], 'east-asia': [60, 110, 0], 'japan': [40, 80, 0], 'southeast-asia': [50, 90, 0],
  'latam': [200, 350, 0.1], 'north-america': [400, 400, 0.08], 'oceania': [500, 600, 0.05],
};
const SYL = { // village name parts by region
  'eu-west': [['Saint-', 'Sainte-', 'Neuf', 'Mont', 'Ville', 'Bourg', 'Beau', 'Font', 'Roche', 'Ober', 'Nieder', 'Wald'], ['ville', 'court', 'heim', 'bach', 'mont', 'champ', 'dorf', 'feld', 'lès-Bois', 'sur-Meuse', 'ac', 'y']],
  'eu-north': [['Nord', 'Sjö', 'Ek', 'Björk', 'Lill', 'Stor', 'Kivi', 'Järvi', 'Halla', 'Sand'], ['by', 'vik', 'berg', 'holm', 'sund', 'la', 'niemi', 'koski', 'torp', 'stad']],
  'eu-east': [['Nowa ', 'Stara ', 'Velk', 'Mal', 'Biel', 'Zelen', 'Gor', 'Dolna ', 'Kras', 'Lip'], ['owo', 'ice', 'any', 'ovo', 'in', 'ka', 'ište', 'ec', 'ówka', 'ava']],
  'post-soviet': [['Novo', 'Staro', 'Krasno', 'Belo', 'Zeleno', 'Vysoko', 'Pokrov', 'Sosnov', 'Ozer', 'Lugov'], ['ka', 'skoye', 'ovka', 'ino', 'yevo', 'nyy', 'sk', 'ivka', 'gorsk', 'polye']],
  'mediterranean': [['San ', 'Santa ', 'Villa', 'Castel', 'Monte', 'Agios ', 'Kara', 'Torre', 'Vall', 'Pozo'], ['nova', 'franca', 'alta', 'del Río', 'oro', 'köy', 'lar', 'ello', 'ona', 'ada']],
  'mena': [['Al-', 'Bir ', 'Deir ', 'Ain ', 'Kafr ', 'Tell ', 'Wadi ', 'Beit ', 'Ras ', 'Qasr '], ['Hamra', 'Nur', 'Salam', 'Khadra', 'Jadid', 'Kabir', 'Sharq', 'Bahr', 'Zaytun', 'Nakhil']],
  'subsaharan': [['Nya', 'Ka', 'Mbo', 'Ojo', 'Kiri', 'Bama', 'Tchi', 'Lui', 'Ndo', 'Ako'], ['nza', 'ngo', 'mbe', 'koro', 'kuru', 'wa', 'bo', 'la', 'nde', 'goma']],
  'south-asia': [['Ram', 'Shiv', 'Chand', 'Kishan', 'Hari', 'Mohan', 'Lal', 'Sultan', 'Bara', 'Chhota '], ['pur', 'nagar', 'gaon', 'garh', 'abad', 'wadi', 'kot', 'pura', 'ganj', 'palli']],
  'east-asia': [['Da', 'Xiao', 'Shang', 'Xia', 'Dong', 'Xi', 'Nan', 'Bei', 'Hwa', 'Song'], ['zhuang', 'cun', 'tun', 'jia', 'li', 'gou', 'ri', 'dong', 'po', 'ying']],
  'japan': [['Kami', 'Shimo', 'Naka', 'Higashi', 'Nishi', 'Ō', 'Ko', 'Matsu', 'Take', 'Sakura'], ['mura', 'zawa', 'kawa', 'yama', 'hara', 'ta', 'no', 'oka', 'shima', 'machi']],
  'southeast-asia': [['Ban ', 'Kampung ', 'Desa ', 'Barangay ', 'Xã ', 'Phum ', 'Muang ', 'Sungai ', 'Bukit ', 'Tanjung '], ['Mai', 'Baru', 'Jaya', 'San Isidro', 'Tân', 'Thong', 'Sari', 'Indah', 'Lama', 'Raya']],
  'latam': [['San ', 'Santa ', 'Villa ', 'El ', 'La ', 'Los ', 'Nueva ', 'Puerto ', 'Agua ', 'Cerro '], ['Esperanza', 'Rosario', 'Pino', 'Laguna', 'Paz', 'Colorado', 'Trinidad', 'Verde', 'Frío', 'Alegre']],
  'north-america': [['Green', 'Oak', 'Maple', 'Cedar', 'Pine', 'Fair', 'Spring', 'Clear', 'Mill', 'Rock'], ['ville', 'field', 'ford', 'wood', 'dale', ' Creek', ' Falls', ' Springs', 'ton', ' Hollow']],
  'oceania': [['Glen', 'Mount ', 'Wattle', 'Kanga', 'Bun', 'Wil', 'Mur', 'Yarra', 'Black', 'Red'], ['ora', 'gong', 'dale', 'bah', 'loo', 'ee', 'ville', ' Creek', 'ton', ' Hill']],
};

export function generateRural(o) {
  // o: { lon, lat, cc, lc: [tree, grass, crop, built, bare, water], pop (people in the 28 km cell), threatDir: [x, y], seed, size }
  const region = regionOf(o.cc), F = FILL[region] || FILL['eu-west'], FD = FIELD[region] || FIELD['eu-west'];
  let s = (o.seed >>> 0) || 1; const R = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
  const rr = (a, b) => a + (b - a) * R();
  const perm = new Uint16Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const hsh = (i, j) => perm[(perm[i & 255] + j) & 255] / 255;
  const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (hsh(i, j) * (1 - u) + hsh(i + 1, j) * u) * (1 - v) + (hsh(i, j + 1) * (1 - u) + hsh(i + 1, j + 1) * u) * v; };
  const fbm = (x, y) => vn(x, y) * 0.55 + vn(x * 2.1 + 5.3, y * 2.1 + 1.7) * 0.3 + vn(x * 4.3 + 9.1, y * 4.3 + 3.3) * 0.15;
  const half = (o.size || 6000) / 2, nT = Math.ceil(half / T);
  const [treeS, grassS, cropS, builtS, bareS, waterS] = o.lc;
  const landS = Math.max(0.05, treeS + grassS + cropS + bareS + builtS);
  const shareTree = treeS / landS, shareCrop = cropS / landS, shareBare = bareS / landS, arid = bareS > (treeS + grassS + cropS) * 0.4;
  // ---- terrain ----
  const relief = 6 + 45 * shareTree + 30 * shareBare + rr(0, 12);
  const height = (x, y) => 100 + relief * (fbm(x / 2200 + 3, y / 2200 + 7) - 0.5) * 2 + 4 * (fbm(x / 500, y / 500) - 0.5);
  // ---- river ----
  const river = [];
  if (waterS > 0.03 || R() < 0.3) {
    const ang = R() * Math.PI, dx = Math.cos(ang), dy = Math.sin(ang), off = rr(-half * 0.6, half * 0.6);
    for (let t = -half * 1.5; t <= half * 1.5; t += 60) { const w = Math.sin(t / 700 + R() * 0.2) * 220 + (fbm(t / 900, 3) - 0.5) * 500; river.push([dx * t - dy * (off + w), dy * t + dx * (off + w)]); }
  }
  const riverW = river.length ? rr(14, 40) : 0;
  const distSeg = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)); return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t); };
  const riverDist = p => { let d = Infinity; for (let i = 1; i < river.length; i++) d = Math.min(d, distSeg(p, river[i - 1], river[i])); return d; };
  // ---- roads: two through roads crossing the map, plus village lanes and farm tracks ----
  const roads = []; // { cls, pts, name }
  const wav = (a, b, amp, sc) => { const pts = [], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 80), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, ph = R() * 10; for (let i = 0; i <= n; i++) { const t = i / n, w = (fbm(t * L / sc + ph, ph) - 0.5) * 2 * amp * Math.sin(Math.PI * t); pts.push([a[0] + (b[0] - a[0]) * t + nx * w, a[1] + (b[1] - a[1]) * t + ny * w]); } return pts; };
  const E = half + 60;
  const a1 = R() * Math.PI, cA = [Math.cos(a1) * E, Math.sin(a1) * E], cross = [rr(-half * 0.25, half * 0.25), rr(-half * 0.25, half * 0.25)];
  roads.push({ cls: RC.secondary, pts: wav([-cA[0] + cross[0], -cA[1] + cross[1]], [cA[0] + cross[0], cA[1] + cross[1]], 260, 1600), name: 'D' + Math.floor(rr(10, 999)) });
  const a2 = a1 + Math.PI / 2 + rr(-0.5, 0.5), cB = [Math.cos(a2) * E, Math.sin(a2) * E];
  roads.push({ cls: RC.tertiary, pts: wav([-cB[0] + cross[0], -cB[1] + cross[1]], [cB[0] + cross[0], cB[1] + cross[1]], 320, 1400), name: 'C' + Math.floor(rr(1, 99)) });
  // villages: the people of the map area (rural share of the cell) in houses of ~2.6, in 1–5 villages
  const people = Math.max(150, Math.min(9000, (o.pop || 2e4) / 770 * (half * 2 / 1000) ** 2 * 0.7));
  let houses = Math.round(people / 2.6), nV = Math.max(1, Math.min(5, Math.round(houses / 220)));
  const syl = SYL[region] || SYL['eu-west'];
  const villages = [];
  const onRoad = (rd, t) => { const p = rd.pts, i = Math.min(p.length - 2, Math.floor(t * (p.length - 1))); return p[i]; };
  villages.push({ c: cross.slice(), n: 0 });
  for (let v = 1; v < nV; v++) { const rd = roads[v % 2], t = rr(0.12, 0.88), p = onRoad(rd, t); if (villages.some(q => Math.hypot(q.c[0] - p[0], q.c[1] - p[1]) < 1200)) continue; villages.push({ c: p.slice(), n: 0 }); }
  const wsum = villages.reduce((a, v, i) => a + (i ? 1 : 1.8), 0);
  villages.forEach((v, i) => { v.n = Math.round(houses * (i ? 1 : 1.8) / wsum); v.r = 90 + Math.sqrt(v.n) * 22; v.name = syl[0][Math.floor(R() * syl[0].length)] + syl[1][Math.floor(R() * syl[1].length)]; });
  for (const v of villages) { // lanes radiating from the village centre, and a loop
    const spokes = Math.max(2, Math.min(5, Math.round(v.n / 60)));
    for (let k = 0; k < spokes; k++) { const a = R() * Math.PI * 2, L = v.r * rr(1.1, 1.6); roads.push({ cls: RC.residential, pts: wav(v.c, [v.c[0] + Math.cos(a) * L, v.c[1] + Math.sin(a) * L], 25, 300), name: '' }); }
    if (v.n > 120) { const ring = [], rr2 = v.r * 0.65; for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 10) ring.push([v.c[0] + Math.cos(a) * rr2 * (0.85 + fbm(a, 2) * 0.3), v.c[1] + Math.sin(a) * rr2 * (0.85 + fbm(a, 5) * 0.3)]); roads.push({ cls: RC.residential, pts: ring, name: '' }); }
  }
  // farm tracks into the fields, with farmsteads at their ends
  const farmsteads = [];
  for (const rd of roads.slice(0, 2)) for (let t = 0.05; t < 0.95; t += rr(0.05, 0.11)) {
    const i = Math.floor(t * (rd.pts.length - 1)), p = rd.pts[i], q = rd.pts[i + 1] || p, L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, side = R() < 0.5 ? 1 : -1, nx = -(q[1] - p[1]) / L * side, ny = (q[0] - p[0]) / L * side, len = rr(250, 700);
    if (villages.some(v => Math.hypot(v.c[0] - p[0], v.c[1] - p[1]) < v.r + 100)) continue;
    const end = [p[0] + nx * len, p[1] + ny * len]; roads.push({ cls: RC.track, pts: wav(p, end, 40, 200), name: '' });
    if (R() < 0.55) farmsteads.push({ c: end, dir: [nx, ny] });
  }
  // ---- road graph: split polylines where they cross ----
  const segs = []; roads.forEach((r, ri) => { for (let i = 1; i < r.pts.length; i++) segs.push({ ri, i, a: r.pts[i - 1], b: r.pts[i] }); });
  const cuts = roads.map(() => []); // [segIndexAlong, t, point]
  const X = (p, q, r2, s2) => { const d = (q[0] - p[0]) * (s2[1] - r2[1]) - (q[1] - p[1]) * (s2[0] - r2[0]); if (Math.abs(d) < 1e-9) return null; const t = ((r2[0] - p[0]) * (s2[1] - r2[1]) - (r2[1] - p[1]) * (s2[0] - r2[0])) / d, u = ((r2[0] - p[0]) * (q[1] - p[1]) - (r2[1] - p[1]) * (q[0] - p[0])) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null; };
  const grid = new Map(), gk = (x, y) => Math.floor(x / 200) + ',' + Math.floor(y / 200);
  segs.forEach((sg, n) => { for (const k of new Set([gk(...sg.a), gk(...sg.b)])) (grid.get(k) || grid.set(k, []).get(k)).push(n); });
  segs.forEach((sg, n) => {
    const seen = new Set();
    for (const k of new Set([gk(...sg.a), gk(...sg.b)])) for (const m of grid.get(k) || []) {
      if (m <= n || seen.has(m)) continue; seen.add(m); const o2 = segs[m]; if (o2.ri === sg.ri && Math.abs(o2.i - sg.i) <= 1) continue;
      const r = X(sg.a, sg.b, o2.a, o2.b); if (!r) continue; const p = [sg.a[0] + (sg.b[0] - sg.a[0]) * r[0], sg.a[1] + (sg.b[1] - sg.a[1]) * r[0]];
      cuts[sg.ri].push([sg.i + r[0], p]); cuts[o2.ri].push([o2.i + r[1], p]);
    }
  });
  const nodes = [], nodeAt = p => { for (let i = 0; i < nodes.length; i++) if (Math.abs(nodes[i][0] - p[0]) < 1.5 && Math.abs(nodes[i][1] - p[1]) < 1.5) return i; nodes.push(p); return nodes.length - 1; };
  const edges = [];
  roads.forEach((r, ri) => {
    const cs = cuts[ri].sort((a, b) => a[0] - b[0]);
    // clip to the map (plus margin) and split at crossings
    let cur = [r.pts[0]], start = nodeAt(r.pts[0]), ci = 0;
    for (let i = 1; i < r.pts.length; i++) {
      while (ci < cs.length && cs[ci][0] <= i) { cur.push(cs[ci][1]); const nd = nodeAt(cs[ci][1]); if (cur.length > 1) edges.push({ ri, a: start, b: nd, pts: cur }); cur = [cs[ci][1]]; start = nd; ci++; }
      cur.push(r.pts[i]);
    }
    const nd = nodeAt(r.pts[r.pts.length - 1]); if (cur.length > 1) edges.push({ ri, a: start, b: nd, pts: cur });
  });
  const inMap = p => Math.abs(p[0]) < half + 40 && Math.abs(p[1]) < half + 40;
  const E2 = [];
  for (const e of edges) {
    const pts = e.pts.filter((p, i) => i === 0 || Math.hypot(p[0] - e.pts[i - 1][0], p[1] - e.pts[i - 1][1]) > 0.5);
    if (pts.length < 2 || !pts.some(inMap)) continue;
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const rd = roads[e.ri], bridge = river.length && pts.some(p => riverDist(p) < riverW / 2 + 4);
    E2.push({ id: E2.length, a: e.a, b: e.b, cls: rd.cls, lf: 1, lb: 1, speed: rd.cls === RC.secondary ? 80 : rd.cls === RC.tertiary ? 70 : rd.cls === RC.track ? 25 : 40, flags: 32 | 64 | (bridge ? 2 : 0), layer: 0, len: L, name: rd.name, turnF: '', turnB: '', pts });
  }
  // junction approaches, priorities (through roads have priority) and lane connections
  const J = new Map();
  const head = (e, dir, atEnd) => { const p = e.pts, a = atEnd ? p[p.length - 2] : p[1], b = atEnd ? p[p.length - 1] : p[0]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  for (const e of E2) for (const [nd, atEnd] of [[e.a, false], [e.b, true]]) { let j = J.get(nd); if (!j) J.set(nd, j = { id: nd, p: nodes[nd], arr: [] }); j.arr.push({ e, atEnd }); }
  const junctions = [];
  for (const j of J.values()) {
    const inc = [], conn = [], yld = [];
    const ins = j.arr.map(({ e, atEnd }) => ({ e, dir: atEnd ? 1 : -1, h: atEnd ? head(e, 1, true) : head(e, -1, false) + Math.PI }));
    const outs = j.arr.map(({ e, atEnd }) => ({ e, dir: atEnd ? -1 : 1, h: atEnd ? Math.atan2(e.pts[e.pts.length - 2][1] - e.pts[e.pts.length - 1][1], e.pts[e.pts.length - 2][0] - e.pts[e.pts.length - 1][0]) : Math.atan2(e.pts[1][1] - e.pts[0][1], e.pts[1][0] - e.pts[0][0]) }));
    const top = Math.min(...ins.map(i => i.e.cls));
    for (const i of ins) {
      inc.push([i.e.id, i.dir]); yld.push(ins.length > 2 && i.e.cls > top ? 1 : 0);
      for (const o2 of outs) { if (o2.e === i.e && ins.length > 1) continue; let d = o2.h - i.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const turn = Math.abs(d) < 0.5 ? 0 : d > 0 ? 1 : 2; conn.push([i.e.id, i.dir, 0, o2.e.id, o2.dir, 0, o2.e === i.e ? 3 : turn]); }
    }
    junctions.push({ id: j.id, p: j.p, z: height(...j.p), ctrl: ins.length > 2 ? 1 : 0, inc, yield: yld, conn, phases: null });
  }
  // ---- buildings ----
  const buildings = [], occ = [];
  const hit = (cx, cy, r) => occ.some(q => Math.abs(q[0] - cx) < r + q[2] && Math.abs(q[1] - cy) < r + q[2]);
  const nearRoad = (p, w) => E2.some(e => { for (let i = 1; i < e.pts.length; i++) if (distSeg(p, e.pts[i - 1], e.pts[i]) < w) return true; return false; });
  const addB = (cx, cy, ux, uy, w, d, use, levels, district, name) => {
    const nx = -uy, ny = ux, hw = w / 2, hd = d / 2;
    const ring = [[cx - ux * hw - nx * hd, cy - uy * hw - ny * hd], [cx + ux * hw - nx * hd, cy + uy * hw - ny * hd], [cx + ux * hw + nx * hd, cy + uy * hw + ny * hd], [cx - ux * hw + nx * hd, cy - uy * hw + ny * hd]];
    const area = w * d, floor = area * levels;
    buildings.push({ osm: 9.5e9 + buildings.length, use: U[use], levels, h: levels * 3.1 + (use === 'farm' ? 3 : 1.2), z: height(cx, cy), district, res: use === 'house' ? Math.max(1, Math.min(6, Math.round(floor * 0.5 / 45))) : 0, jobs: use === 'farm' ? 2 : use === 'civic' || use === 'religious' ? 4 : 0, est: true, gen: true, ent: [cx - nx * hd, cy - ny * hd], name: name || '', addr: '', kinds: [], ring, holes: [] });
    occ.push([cx, cy, Math.max(w, d) / 2 + 1]);
  };
  villages.forEach((v, vi) => {
    // church or town hall on the square, then houses along the village lanes and the through roads
    addB(v.c[0] + 26, v.c[1] + 18, 1, 0, 14, 26, region === 'mena' || region === 'south-asia' ? 'civic' : 'religious', 1, vi, v.name + (region === 'eu-west' ? ' church' : ' hall'));
    let left = v.n;
    for (const e of E2) {
      if (left <= 0) break; if (!e.pts.some(p => Math.hypot(p[0] - v.c[0], p[1] - v.c[1]) < v.r * 1.4)) continue;
      const halfW = e.cls === RC.secondary ? 4 : e.cls === RC.track ? 2 : 3;
      for (let i = 1; i < e.pts.length && left > 0; i++) {
        const a = e.pts[i - 1], b = e.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 5) continue; const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
        for (const side of [1, -1]) for (let t = rr(0, 4); t < L - 4 && left > 0;) {
          const w = rr(...F.w), d = rr(...F.d), sb = rr(...F.setback), p = [a[0] + ux * (t + w / 2), a[1] + uy * (t + w / 2)];
          const off = halfW + sb + d / 2, cx = p[0] - uy * side * off, cy = p[1] + ux * side * off;
          if (Math.hypot(cx - v.c[0], cy - v.c[1]) < v.r * 1.25 && !hit(cx, cy, Math.max(w, d) / 2) && !(river.length && riverDist([cx, cy]) < riverW / 2 + 15) && !nearRoad([cx, cy], halfW + 1 + Math.min(w, d) / 2 - 1)) { addB(cx, cy, ux * side, uy * side, w, d, 'house', Math.max(1, Math.round(rr(1, Math.min(3, F.levels[1])))), vi); left--; }
          t += w + rr(...F.gap) + 2;
        }
      }
    }
  });
  for (const f of farmsteads) { // farmhouse, barn and sheds
    const [cx, cy] = f.c, ux = f.dir[1], uy = -f.dir[0];
    if (river.length && riverDist([cx, cy]) < riverW + 30) continue;
    if (!hit(cx, cy, 12)) addB(cx + ux * 14, cy + uy * 14, ux, uy, rr(9, 13), rr(8, 11), 'house', rr(1, 2) > 1.5 ? 2 : 1, 0);
    if (!hit(cx - ux * 18, cy - uy * 18, 16)) addB(cx - ux * 18, cy - uy * 18, ux, uy, rr(18, 30), rr(12, 18), 'farm', 1, 0);
    if (R() < 0.6 && !hit(cx + f.dir[0] * 26, cy + f.dir[1] * 26, 8)) addB(cx + f.dir[0] * 26, cy + f.dir[1] * 26, ux, uy, rr(8, 14), rr(6, 9), 'minor', 1, 0);
  }
  // ---- land cover (10 m cells): woods, fields, grassland, bare ground, built-up village cores, river ----
  const fa = R() * Math.PI, fc = Math.cos(fa), fs = Math.sin(fa);
  const woodT = quantile(p => fbm(p[0] / 900 + 11, p[1] / 900 + 4) + 0.18 * fbm(p[0] / 160, p[1] / 160), 1 - Math.min(0.85, shareTree * 1.05), R, half);
  const field = (x, y) => { const wx = x + (fbm(x / 600, y / 600) - 0.5) * 120, wy = y + (fbm(x / 600 + 9, y / 600 + 9) - 0.5) * 120; const u = wx * fc + wy * fs, v = -wx * fs + wy * fc; const i = Math.floor(u / FD[0]), j = Math.floor(v / FD[1]); return [i, j, u - i * FD[0], v - j * FD[1]]; };
  const lcAt = (x, y) => {
    if (river.length && riverDist([x, y]) < riverW / 2) return 8;
    for (const v of villages) if (Math.hypot(x - v.c[0], y - v.c[1]) < v.r * 0.75) return (fbm(x / 40, y / 40) > 0.62 ? 1 : 5);
    if (fbm(x / 900 + 11, y / 900 + 4) + 0.18 * fbm(x / 160, y / 160) > woodT) return 1;
    const [i, j] = field(x, y), h = hsh(i * 7 + 3, j * 13 + 5);
    if (arid) return h < shareCrop * 1.2 ? 4 : h < 0.85 ? 6 : 2;
    return h < shareCrop / Math.max(0.05, shareCrop + grassS / landS) ? 4 : h < 0.93 ? 3 : 2;
  };
  // hedgerows along some field edges (bocage), clear of roads and villages
  const barriers = [];
  if (FD[2] > 0) {
    const seenE = new Set();
    for (let x = -half; x < half; x += 30) for (let y = -half; y < half; y += 30) {
      const [i, j] = field(x, y), key = i + ',' + j; if (seenE.has(key)) continue; seenE.add(key);
      if (hsh(i * 3 + 1, j * 5 + 2) > FD[2]) continue;
      const u0 = i * FD[0], v0 = j * FD[1], corner = (u, v) => [u * fc - v * fs, u * fs + v * fc];
      const side = hsh(i, j) < 0.5 ? [corner(u0, v0), corner(u0 + FD[0], v0)] : [corner(u0, v0), corner(u0, v0 + FD[1])];
      const mid = [(side[0][0] + side[1][0]) / 2, (side[0][1] + side[1][1]) / 2];
      if (!inMap(mid) || villages.some(v => Math.hypot(mid[0] - v.c[0], mid[1] - v.c[1]) < v.r * 1.3) || nearRoad(mid, 30) || (river.length && riverDist(mid) < 40)) continue;
      // a field gate somewhere along each hedgerow
      const g = 0.15 + hsh(i * 7 + 3, j * 11 + 5) * 0.7, gw = 5 / Math.max(5, Math.hypot(side[1][0] - side[0][0], side[1][1] - side[0][1])), lerp = f => [side[0][0] + (side[1][0] - side[0][0]) * f, side[0][1] + (side[1][1] - side[0][1]) * f], hh = rr(1.6, 2.6);
      barriers.push({ kind: BK.hedge, h: hh, src: 1, pts: [side[0], lerp(g - gw / 2)] }, { kind: BK.hedge, h: hh, src: 1, pts: [lerp(g + gw / 2), side[1]] });
    }
  }
  // ---- tiles ----
  const tiles = new Map(), keyOf = (x, y) => `${Math.floor(x / T)}_${Math.floor(y / T)}`;
  for (let i = -nT; i < nT; i++) for (let j = -nT; j < nT; j++) {
    const ox = i * T, oy = j * T, n = T / STEP + 1, data = new Int16Array(n * n);
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) data[b * n + a] = Math.round(height(ox + a * STEP, oy + b * STEP) * 10);
    const m = T / LCS, lcd = new Uint8Array(m * m);
    for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) lcd[b * m + a] = lcAt(ox + (a + 0.5) * LCS, oy + (b + 0.5) * LCS);
    tiles.set(`${i}_${j}`, { key: `${i}_${j}`, origin: [ox, oy], landcover: { n: m, step: LCS, data: lcd }, buildings: [], edges: [], junctions: [], areas: [], lines: [], pois: [], barriers: [], terrain: { n, step: STEP, scale: 0.1, data, ox, oy }, trees: [], lamps: [] });
  }
  const put = (p, fn) => { const t = tiles.get(keyOf(p[0], p[1])); if (t) fn(t); };
  for (const b of buildings) put(b.ring[0], t => t.buildings.push(b));
  for (const e of E2) put(e.pts[Math.floor(e.pts.length / 2)], t => t.edges.push(e));
  for (const j of junctions) put(j.p, t => t.junctions.push(j));
  for (const b of barriers) put(b.pts[0], t => t.barriers.push(b));
  if (river.length) { // the river as a water area (clipped per tile by the renderer's tile bounds) and a line
    const L = [], Rr = []; for (let i = 0; i < river.length; i++) { const a = river[Math.max(0, i - 1)], b = river[Math.min(river.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * riverW / 2, ny = (b[0] - a[0]) / l * riverW / 2; L.push([river[i][0] + nx, river[i][1] + ny]); Rr.push([river[i][0] - nx, river[i][1] - ny]); }
    const ring = [...L, ...Rr.reverse()];
    for (const t of tiles.values()) { const c = clipRing(ring, [t.origin[0], t.origin[1], t.origin[0] + T, t.origin[1] + T]); if (c.length >= 3) t.areas.push({ kind: CODES.area.indexOf('water'), ring: c, holes: [] }); }
  }
  const districts = villages.map(v => ({ name: v.name, kind: 'village', x: Math.round(v.c[0]), y: Math.round(v.c[1]) }));
  const manifest = { format: 'sco-rural', name: o.name || villages[0].name, country: o.cc, center: { lon: o.lon, lat: o.lat }, region, climate: { arid }, tileSize: T, codes: CODES, districts, tiles: [...tiles.keys()].map(key => ({ key })), stats: { buildings: buildings.length, villages: villages.length, people: Math.round(people) } };
  return { manifest, tiles, villages, threatDir: o.threatDir, half };
}
// threshold such that roughly a share q of the map lies below it (sampled)
function quantile(f, q, R, half) { const v = []; for (let i = 0; i < 1500; i++) v.push(f([(R() - 0.5) * 2 * half, (R() - 0.5) * 2 * half])); v.sort((a, b) => a - b); return v[Math.max(0, Math.min(v.length - 1, Math.floor(q * v.length)))]; }
function clipRing(r, [x0, y0, x1, y1]) {
  const lx = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])], ly = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
  const E = [[p => p[0] >= x0, (a, b) => lx(a, b, x0)], [p => p[0] <= x1, (a, b) => lx(a, b, x1)], [p => p[1] >= y0, (a, b) => ly(a, b, y0)], [p => p[1] <= y1, (a, b) => ly(a, b, y1)]];
  let out = r;
  for (const [inside, cut] of E) { const inp = out; out = []; for (let i = 0; i < inp.length; i++) { const a = inp[(i + inp.length - 1) % inp.length], b = inp[i]; if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b)); } if (!out.length) break; }
  return out;
}
