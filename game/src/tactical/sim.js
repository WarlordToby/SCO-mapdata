// City-layer simulation: evacuation & traffic, ambient police/medical, HVTs, threat creatures, player forces,
// combat, supply, quarantine cordons, the AI ground commander and spread-driven map unlocking.
import { FLAG, Grid, Heap } from './city.js';
import { Barriers } from './barriers.js';
import { ITEM } from '../catalog.js';
import { installHostiles } from './hostiles.js';
import { starterKit } from '../nations.js';
import { installInterior, facing } from './interior.js';
import { installHelis } from './helis.js';

export const TH = { // per-threat creature profiles
  undead: { vault: 2.2, hp: 110, speed: 1.4, dmg: 9, range: 1.8, aggro: 45, convert: 0.35, bDmg: 0.2, nest: 0, size: 1, sense: 260 },
  mutant: { vault: 1.2, hp: 520, speed: 3.2, dmg: 45, range: 2.5, aggro: 70, convert: 0, bDmg: 6, nest: 0, size: 2.2, sense: 300 },
  vampire: { vault: 0.5, hp: 240, speed: 4.2, dmg: 26, range: 2, aggro: 80, convert: 0.12, bDmg: 0.3, nest: 0, size: 1.2, sense: 350, night: true },
  lycan: { vault: 0.5, hp: 300, speed: 5.5, dmg: 32, range: 2.2, aggro: 90, convert: 0.06, bDmg: 0.8, nest: 0, size: 1.6, sense: 350 },
  swarm: { vault: 0.7, hp: 18, speed: 3.0, dmg: 4, range: 1.5, aggro: 35, convert: 0, bDmg: 0.4, nest: 0, size: 0.55, sense: 220 },
};
const NAMES_CC = { // country-specific name pools where a region is too broad
  DE: ['Lukas Anna Jonas Lena Felix Sophie Maximilian Marie Paul Laura Tobias Julia', 'Müller Schmidt Schneider Fischer Weber Becker Wagner Hoffmann Schulz Koch Richter Neumann'],
  AT: ['Lukas Anna Jonas Lena Felix Sophie Maximilian Marie Paul Laura Tobias Julia', 'Gruber Huber Bauer Wagner Pichler Steiner Moser Mayer Hofer Leitner Berger Fuchs'],
  GB: ['Oliver Amelia George Isla Harry Emily Jack Sophie James Grace William Chloe', 'Smith Jones Taylor Brown Williams Wilson Johnson Davies Evans Thomas Roberts Walker'],
  IE: ['Seán Aoife Conor Niamh Liam Ciara Patrick Siobhán Darragh Róisín Cian Orla', 'Murphy Kelly Byrne Ryan O’Brien Walsh O’Sullivan Doyle McCarthy Gallagher Kennedy Lynch'],
  NL: ['Daan Emma Sem Julia Lucas Tess Milan Sophie Levi Anna Finn Lotte', 'de Jong Jansen de Vries van den Berg Bakker Visser Smit Meijer de Boer Mulder Bos Peters'],
  BE: ['Lucas Emma Louis Olivia Noah Marie Arthur Louise Liam Elena Jules Lina', 'Peeters Janssens Maes Jacobs Willems Claes Goossens Wouters De Smet Dubois Lambert Martin'],
  ES: ['Hugo Lucía Martín Sofía Pablo Martina Daniel María Alejandro Paula Mateo Julia', 'García Fernández González Rodríguez López Martínez Sánchez Pérez Gómez Martín Ruiz Díaz'],
};
const NAMES = { // [first names, family names] by region
  'eu-north': ['Erik Anna Lars Sofia Mikko Aino Johan Ingrid Oskar Elina Nils Freja', 'Lindqvist Virtanen Hansen Nilsson Korhonen Berg Johansson Laine Dahl Eriksen Mäkinen Holm'],
  'eu-east': ['Piotr Anna Tomáš Katarzyna Ivan Elena Marek Zsófia Andrei Ioana Milan Petra', 'Kowalski Nowak Horváth Novák Popescu Dvořák Wiśniewska Ionescu Kovač Szabó Petrović Varga'],
  'post-soviet': ['Alexei Olga Dmitri Natalia Sergei Irina Andriy Oksana Nursultan Aigerim Giorgi Tamar', 'Ivanov Petrova Smirnov Kuznetsova Shevchenko Bondarenko Volkov Nazarbayeva Beridze Popov Sokolova Kovalenko'],
  'mediterranean': ['Marco Giulia Javier Lucía Nikos Eleni João Ana Mehmet Ayşe Luca Carmen', 'Rossi García Papadopoulos Silva Yılmaz Fernández Ricci Costa Demir Martínez Bianchi Kaya'],
  'mena': ['Omar Fatima Ahmed Layla Youssef Mariam Karim Nour Hassan Zainab Ali Salma', 'Haddad Al-Sayed Mansour Rahimi Khalil Nasser Farouk Hosseini Aziz Saleh Bakr Tahan'],
  'subsaharan': ['Chinedu Amina Kwame Wanjiru Tunde Fatou Kofi Zawadi Emeka Aisha Jabari Nia', 'Okafor Mensah Kamau Diallo Adeyemi Mwangi Traoré Nkosi Osei Abubakar Otieno Sow'],
  'south-asia': ['Arjun Priya Rahul Ananya Imran Ayesha Vikram Sana Rohan Fatima Sandeep Nadia', 'Sharma Khan Patel Rahman Singh Iqbal Gupta Chowdhury Reddy Malik Das Hussain'],
  'east-asia': ['Wei Li Jun Mei Hao Xin Min-jun Ji-woo Yu Fang Seo-yeon Chen', 'Wang Li Zhang Liu Chen Kim Park Lee Huang Zhao Choi Lin'],
  'japan': ['Haruto Yui Sota Aoi Ren Hina Kenji Yuki Takumi Sakura Daiki Mei', 'Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Nakamura Kobayashi Kato Yoshida Yamada'],
  'southeast-asia': ['Nguyen Siti Arif Mai Somchai Putri Rizal Linh Budi Maria Anh Dewi', 'Tran Santos Wijaya Pham Srisai Reyes Hidayat Le Tanaka Cruz Lim Rahman'],
  'latam': ['José María Juan Camila Luis Valentina Carlos Ana Diego Sofía Pedro Gabriela', 'Silva González Rodríguez Santos Hernández Pérez Oliveira López Gómez Souza Torres Ramírez'],
  'north-america': ['James Emily Michael Sarah David Jessica Daniel Ashley Robert Megan Kevin Lauren', 'Smith Johnson Williams Brown Jones Miller Davis Wilson Anderson Taylor Thomas Martin'],
  'oceania': ['Jack Olivia Liam Charlotte Noah Amelia Thabo Lerato Cooper Isla Riley Zoe', 'Smith Jones Williams Brown Nkosi Wilson Taylor Botha Murphy Walker Ndlovu Kelly'],
};
const FIRST = ['Claire', 'Julien', 'Nathalie', 'Marc', 'Isabelle', 'Thomas', 'Sophie', 'Laurent', 'Camille', 'Antoine', 'Hélène', 'Pierre', 'Élodie', 'François', 'Amélie', 'Nicolas', 'Inès', 'Yann', 'Léa', 'Karim'];
const LAST = ['Muller', 'Schmitt', 'Meyer', 'Klein', 'Weber', 'Wagner', 'Roth', 'Hoffmann', 'Fischer', 'Bernard', 'Lefèvre', 'Moreau', 'Laurent', 'Girard', 'Fournier', 'Haddad', 'Keller', 'Zimmermann', 'Durand', 'Petit'];

export class Sim {
  constructor(city, opts) {
    this.city = city; this.o = opts; this.t = 0; this.clock = opts.clock; this.threat = opts.threat; this.P = TH[opts.threat];
    this.fx = []; this.risers = []; this.nades = []; this.limbable = ['undead', 'vampire', 'lycan'].includes(this.threat);
    this.cars = []; this.peds = []; this.creatures = []; this.units = []; this.sites = []; this.hvts = []; this.tracers = []; this.events = []; this.junctionBusy = new Map();
    this.stats = { evacuated: 0, civDead: 0, soldiersKIA: 0, vehiclesLost: 0, kills: 0, specimens: 0, hvtSaved: 0, hvtLost: 0, bDestroyed: 0, supplyUsed: 0 };
    this.supply = opts.supply ?? 120; this.cmd = { garrisonKey: true, manCheckpoints: true, resupply: true, clear: true };
    this.cid = 0; this.uid = 0; this.cGrid = new Grid(40); this.pedGrid = new Grid(30);
    this.pending = []; this.infested = new Set(); this.intelT = 0; this.zoneT = 0; this.sumT = -1;
    this.activeB = new Set(); this.evacZones = []; this.quarantine = new Set(); this.checkpoints = []; this.garrisonMarks = new Set(); this.unlockR = opts.unlockR;
  }
  log(text, kind = 'info') { this.events.unshift({ t: this.clock, text, kind }); if (this.events.length > 60) this.events.pop(); }
  hour() { return new Date(this.clock).getUTCHours() + 1; }
  isNight() { const h = (this.hour() + 24) % 24; return h < 7 || h >= 19; }

  // ---------- setup ----------
  start(impactB, forces, stagingDirs) {
    const C = this.city; this.impact = impactB; this.origin = impactB.c;
    impactB.infest = 0.4; impactB.state = 1; impactB.known = true; this.infested.add(impactB);
    this.startHostiles(impactB);
    const n = this.initialHostiles(impactB, this.o.severity || 1) ? 0 : Math.round({ undead: 30, mutant: 7, vampire: 10, lycan: 8, swarm: 80 }[this.threat] * (this.o.severity || 1));
    for (let i = 0; i < n; i++) this.spawnCreature(impactB.ent[0] + (Math.random() - .5) * 20, impactB.ent[1] + (Math.random() - .5) * 20);
    this.evacZones.push({ c: impactB.c, r: 450 });
    this.pickHVTs();
    this.refreshFields();
    // staging areas & forces
    this.staging = {};
    for (const dir of new Set(stagingDirs)) this.staging[dir] = this.stagingPoint(dir);
    for (const f of forces) { if (f.arriveIn > 0) this.pending.push({ f, at: this.clock + f.arriveIn }); else this.addUnit(f); }
    this.pending.sort((a, b) => a.at - b.at);
    for (const [dir, p] of Object.entries(this.staging)) this.sites.push({ id: 'stg_' + dir, kind: 'staging', p, r: 90, stock: Infinity, built: 1, name: `Staging ${dir}` });
    this.spawnServices();
    this.log(`${this.o.cityName}: ${this.o.threatName} at ${impactB.name || impactB.addr || 'an unnamed building'}. Police evacuating 450 m radius.`, 'bad');
  }
  // ---------- countryside: hold the line ----------
  // R: { threatDir (unit vector towards the overrun side), half (map half-width), duration (sim s), waves (creatures), platoons, nation, frontName }
  startRural(forces, R) {
    this.startHostiles(null);
    const C = this.city, [dx, dy] = R.threatDir, px = -dy, py = dx, half = R.half;
    this.rural = R; R.goal = -half * 0.35; this.origin = [dx * half * 0.9, dy * half * 0.9]; this.breach = 0; this.breachMax = Math.max(15, Math.round(R.waves * 0.18)); this.waveLeft = R.waves; this.waveAcc = 0;
    this.evacZones.push({ c: [0, 0], r: half * 3 });
    this.refreshFields();
    const rear = [-dx * half * 0.12, -dy * half * 0.12], j = C.nearestJunction(rear[0], rear[1], j => j.out.length > 0, 1500);
    this.staging = { rear: j ? [j.p[0], j.p[1]] : rear };
    for (const f of forces) { f.approach = 'rear'; if (f.arriveIn > 0) this.pending.push({ f, at: this.clock + f.arriveIn }); else this.addUnit(f); }
    this.sites.push({ id: 'stg_rear', kind: 'staging', p: this.staging.rear, r: 90, stock: Infinity, built: 1, name: 'Rear staging' });
    // national troops hold a line across the map, a little forward of the centre
    const n = R.platoons, spacing = half * 1.7 / n;
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * spacing, p = [px * o + dx * half * 0.12, py * o + dy * half * 0.12];
      const apc = i % 3 === 1;
      const K = this._natKit || (this._natKit = starterKit(R.cc || 'FR')), rid = Object.keys(K.squad)[0], mid = Object.keys(K.squad)[1] || rid;
      const u = this.addUnit({ id: 'nat' + i, name: `${R.nation} ${apc ? (ITEM[K.apc]?.name.split(/[ (]/)[0] || 'APC') + ' ' : 'Platoon '}${i + 1}`, vehicle: apc ? K.apc || 'm113' : null, pers: apc ? 3 : 24, items: apc ? {} : { [rid]: 20, [mid]: 4 }, approach: 'rear' });
      u.ai = true; u.x = p[0] + (Math.random() - .5) * 20; u.y = p[1] + (Math.random() - .5) * 20; u.home = [u.x, u.y]; this.order(u, { type: 'guard', p: [u.x, u.y] });
    }
    this.log(`${R.frontName}: the national line is holding ${n} positions. Waves are coming in from the ${['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'][Math.round(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8]}. Hold for ${Math.round(R.duration * 6 / 3600)} hours.`, 'bad');
  }
  marchPoint(c) { const [dx, dy] = this.rural.threatDir, h = this.rural.half; let o = (c.x * -dy + c.y * dx); o = Math.max(-h * 0.9, Math.min(h * 0.9, o)); const g = this.rural.goal - 250; return [dx * g + -dy * o, dy * g + dx * o]; }
  // Open-country marching: one distance field to the far side of the sector over a 4 m grid. Hedgerows, walls and
  // buildings block it; field gates, low fences (vaulted) and the river do not. Every marching creature follows it.
  buildFlow() {
    const R = this.rural, h = R.half, res = 4, n = Math.ceil(2 * h / res), N = n * n, blk = new Uint8Array(N), C = this.city, B = C.bars;
    const mark = (x, y) => { const i = Math.floor((x + h) / res), j = Math.floor((y + h) / res); if (i >= 0 && j >= 0 && i < n && j < n) blk[j * n + i] = 1; };
    for (const sg of B.segs) { if (!B.blocks(sg, { veh: false })) continue; const L = Math.hypot(sg.bx - sg.ax, sg.by - sg.ay), m = Math.max(1, Math.ceil(L / (res * 0.4))); for (let q = 0; q <= m; q++) mark(sg.ax + (sg.bx - sg.ax) * q / m, sg.ay + (sg.by - sg.ay) * q / m); }
    for (const b of C.buildings) { const r = b.ring; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of r) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      for (let y = Math.floor((y0 + h) / res); y <= Math.floor((y1 + h) / res); y++) for (let x = Math.floor((x0 + h) / res); x <= Math.floor((x1 + h) / res); x++) { const cx = x * res - h + res / 2, cy = y * res - h + res / 2; let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], q = r[j]; if ((a[1] > cy) !== (q[1] > cy) && cx < (q[0] - a[0]) * (cy - a[1]) / (q[1] - a[1]) + a[0]) c = !c; } if (c && x >= 0 && y >= 0 && x < n && y < n) blk[y * n + x] = 1; } }
    const dist = new Float32Array(N).fill(Infinity), [dx, dy] = R.threatDir, goal = R.goal;
    // bucket queue (dial's algorithm) on costs scaled to integers: straight 10, diagonal 14
    const bk = []; const push = (k, d) => { const q = d | 0; (bk[q] || (bk[q] = [])).push(k); };
    for (let k = 0; k < N; k++) { if (blk[k]) continue; const x = (k % n) * res - h + res / 2, y = Math.floor(k / n) * res - h + res / 2; if (x * dx + y * dy < goal) { dist[k] = 0; push(k, 0); } }
    const NB = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
    for (let q = 0; q < bk.length; q++) { const L = bk[q]; if (!L) continue; for (const k of L) { if (dist[k] < q) continue; const i = k % n, j = (k - i) / n;
      for (const [di, dj, w] of NB) { const a = i + di, b2 = j + dj; if (a < 0 || b2 < 0 || a >= n || b2 >= n) continue; const kk = b2 * n + a; if (blk[kk] || (di && dj && (blk[j * n + a] || blk[b2 * n + i]))) continue; const nd = q + w; if (nd < dist[kk]) { dist[kk] = nd; push(kk, nd); } } } bk[q] = null; }
    this.flow = { n, res, h, dist, blk, NB };
  }
  flowMove(c, step) {
    const F = this.flow, { n, res, h, dist } = F, i = Math.floor((c.x + h) / res), j = Math.floor((c.y + h) / res);
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    let best = -1, bd = dist[j * n + i];
    for (const [di, dj] of F.NB) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n) continue; const d = dist[b * n + a]; if (d < bd || (best < 0 && !isFinite(bd) && isFinite(d))) { bd = d; best = b * n + a; } }
    if (best < 0) return false; // no way on from here: the caller falls back to local routing
    // aim at a cell a few steps down the field so marching is smooth rather than zig-zag
    let k = best; for (let s = 0; s < 3; s++) { const a = k % n, b = (k - a) / n; let nk = -1, nd = dist[k]; for (const [di, dj] of F.NB) { const x = a + di, y = b + dj; if (x < 0 || y < 0 || x >= n || y >= n) continue; const d = dist[y * n + x]; if (d < nd) { nd = d; nk = y * n + x; } } if (nk < 0) break; k = nk; }
    const tx = (k % n) * res - h + res / 2, ty = Math.floor(k / n) * res - h + res / 2, ddx = tx - c.x, ddy = ty - c.y, d = Math.hypot(ddx, ddy) || 1, m = Math.min(step, d);
    c.x += ddx / d * m; c.y += ddy / d * m; c.hx = ddx / d; c.hy = ddy / d; return true;
  }
  stepRural(dt) {
    if (!this.flow) this.buildFlow();
    const R = this.rural, [dx, dy] = R.threatDir, px = -dy, py = dx, h = R.half;
    // waves over the first three quarters of the hold, in surges
    if (this.waveLeft > 0) {
      const rate = R.waves / (R.duration * 0.75) * (1 + 0.8 * Math.sin(this.t / 90));
      this.waveAcc += rate * dt;
      while (this.waveAcc >= 1 && this.waveLeft > 0) {
        this.waveAcc--; this.waveLeft--;
        if (!R.axes || this.t > R.axesT) { R.axesT = this.t + 500 + Math.random() * 300; const k = 2 + (Math.random() < 0.4 ? 1 : 0); R.axes = Array.from({ length: k }, () => (Math.random() - 0.5) * 2 * h * 0.7); this.log(`Reports: hostiles massing on ${k} axes.`, 'bad'); }
        const gs = (Math.random() + Math.random() + Math.random() - 1.5) * 2 * 260, o = Math.max(-h * 0.9, Math.min(h * 0.9, R.axes[Math.floor(Math.random() * R.axes.length)] + gs)), a = Math.min(h * 0.96, h * 0.12 + this.P.speed * (250 + Math.random() * 300)), x = dx * a + px * o, y = dy * a + py * o;
        const c = this.spawnCreature(x, y); if (c) { c.target = { kind: 'p', p: this.marchPoint(c), march: true }; c.think = 3 + Math.random() * 6; c.vis = true; }
      }
    }
    // national platoons shift along their line toward the pressure (within 250 m of their post)
    R.aiT = (R.aiT || 0) - dt;
    if (R.aiT <= 0) { R.aiT = 2;
      for (const u of this.units) { if (!u.ai || u.dead || !u.home) continue; let sx = 0, sy = 0, n = 0; this.cGrid.near(u.home[0], u.home[1], 650, c => { if (c.hp > 0 && !c.inB) { sx += c.x; sy += c.y; n++; } });
        let tx = u.home[0], ty = u.home[1]; if (n) { const lat = Math.max(-250, Math.min(250, (sx / n - u.home[0]) * px + (sy / n - u.home[1]) * py)); tx += px * lat; ty += py * lat; }
        if (Math.hypot(tx - u.order?.p?.[0], ty - u.order?.p?.[1]) > 30) this.order(u, { type: 'guard', p: [tx, ty] }); }
    }
    // creatures that reach the far side have broken through
    for (const c of this.creatures) if (c.hp > 0 && !c.inB && c.x * dx + c.y * dy < R.goal) { c.hp = 0; c.through = true; this.breach++; if (this.breach % 5 === 1) this.log(`Breakthrough: hostiles got past the line (${this.breach}/${this.breachMax}).`, 'bad'); }
  }
  stagingPoint(dir) {
    const a = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(dir) * Math.PI / 4;
    // a road junction in that direction; on a coast or river, swing round and come closer until there is land with roads
    const ok = j => j.out.length && j.in.length && this.city.unlockedAt(j.p[0], j.p[1]);
    for (const r of [this.unlockR - 250, this.unlockR - 600, this.unlockR - 1000, 700]) for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) {
      const x = this.origin[0] + Math.sin(a + da) * r, y = this.origin[1] + Math.cos(a + da) * r, j = this.city.nearestJunction(x, y, ok, 350);
      if (j) return [j.p[0], j.p[1]];
    }
    const j = this.city.nearestJunction(this.origin[0], this.origin[1], ok, 5000);
    return j ? [j.p[0], j.p[1]] : [this.origin[0], this.origin[1]];
  }
  pickHVTs() {
    const C = this.city, U = C.use;
    const roles = [[U.civic, [C.m.country === 'FR' ? 'Préfet' : 'Governor', 'Deputy', 'Mayor', 'Councillor'], 'politician'], [U.university, ['Professor', 'Dr.'], 'scientist'], [U.hospital, ['Dr.', 'Chief virologist'], 'scientist'], [U.military, ['General', 'Colonel'], 'military'], [U.office, ['Director', 'CEO'], 'executive'], [U.police, ['Commissaire'], 'police']];
    const have = new Set(this.hvts.map(h => h.b.idx));
    for (const [use, titles, role] of roles) {
      const cands = C.buildings.filter(b => b.use === use && C.unlockedAt(b.c[0], b.c[1]) && !have.has(b.idx) && b.occ > 0).sort(() => Math.random() - .5);
      const k = role === 'executive' ? 3 : role === 'politician' ? 3 : 2;
      for (const b of cands.slice(0, k)) {
        const cc = this.city.m.country, nm = NAMES_CC[cc] || (cc !== 'FR' && NAMES[this.city.m.region]), F = nm ? nm[0].split(' ') : FIRST, Ln = nm ? nm[1].split(' ') : LAST;
        const ttl = titles[Math.floor(Math.random() * titles.length)], name = `${cc !== 'FR' && ttl === 'Préfet' ? 'Governor' : cc !== 'FR' && ttl === 'Commissaire' ? 'Commissioner' : ttl} ${F[Math.floor(Math.random() * F.length)]} ${Ln[Math.floor(Math.random() * Ln.length)]}`;
        this.hvts.push({ id: 'h' + this.hvts.length, name, role, b, state: 'inside', danger: 0, unit: null, x: b.ent[0], y: b.ent[1] }); have.add(b.idx); b.hvt = true;
      }
    }
  }
  spawnServices() {
    const C = this.city, police = C.buildings.filter(b => b.use === C.use.police && C.unlockedAt(b.c[0], b.c[1]));
    const hospitals = C.buildings.filter(b => (b.use === C.use.hospital) && C.unlockedAt(b.c[0], b.c[1]) && b.area > 600);
    this.policeStations = police; this.hospitals = hospitals;
    // up to 10 cars a station, but cities with many small posts (Tokyo's kōban) share a realistic total
    const perSt = Math.max(1, Math.min(10, Math.floor(80 / Math.max(1, police.length))));
    for (const [k, p] of police.entries()) if (k * perSt < 120) for (let i = 0; i < perSt; i++) this.spawnCar(p.ent, 'police');
    // municipal + national police patrols already on the streets across the area
    const area = Math.PI * this.unlockR * this.unlockR / 1e6, n = Math.round(area * 4);
    const js = [...C.junctions.values()].filter(j => j.out.length && C.unlockedAt(j.p[0], j.p[1]));
    for (let i = 0; i < n && js.length; i++) { const j = js[Math.floor(Math.random() * js.length)]; const c = this.spawnCar(j.p, 'police'); if (c) c.role = i % 2 === 0 ? 'patrol' : null; }
    this.stats.policeLost = 0;
    for (const h of hospitals.slice(0, 6)) for (let i = 0; i < 2; i++) this.spawnCar(h.ent, 'ambulance');
    const fireSt = C.buildings.filter(b => b.use === C.use.fire_station && C.unlockedAt(b.c[0], b.c[1])); this.fireStations = fireSt;
    for (const f of fireSt.slice(0, 6)) for (let i = 0; i < 2; i++) this.spawnCar(f.ent, 'fire');
  }

  // ---------- routing fields ----------
  refreshFields() {
    const C = this.city; if (C.graphDirty) C.buildGraph(); C.nearestJunction(0, 0, null, 1);
    // evacuation targets: drivable junctions in loaded-but-locked tiles, or at the edge of the loaded network
    const exitsD = [], exitsW = [];
    for (const j of C.junctions.values()) {
      const locked = !C.unlockedAt(j.p[0], j.p[1]);
      const boundary = (j.inc || []).some(([e]) => { const E = C.edges.get(e); return !E || !C.junctions.has(E.a) || !C.junctions.has(E.b); });
      if (this.rural && (j.p[0] * this.rural.threatDir[0] + j.p[1] * this.rural.threatDir[1]) > -this.rural.half * 0.55) continue;
      if ((locked || boundary) && !this.inQuarantineXY(j.p[0], j.p[1])) { if (j.in.length) exitsD.push(j.id); if (j.walk.length) exitsW.push(j.id); }
    }
    for (const z of this.sites) if (z.kind === 'safezone') C.jGrid?.near(z.p[0], z.p[1], z.r + 40, j => { if (j.walk.length && Math.hypot(j.p[0] - z.p[0], j.p[1] - z.p[1]) < z.r + 40) exitsW.push(j.id); });
    this.evacD = C.driveField(exitsD, e => this.edgeBlocked(e));
    this.evacW = C.walkField(exitsW);
    this.fieldCache = new Map();
  }
  edgeBlocked(e) { const C = this.city; return !!C.bars && (e._tb ?? (e._tb = (e.pts || []).some((p, i) => i > 0 && C.bars.hitsWall(e.pts[i - 1][0], e.pts[i - 1][1], p[0], p[1])))); } // passages under buildings
  fieldTo(key, targets, walk) { let f = this.fieldCache.get(key); if (!f) { f = walk ? this.city.walkField(targets) : this.city.driveField(targets, e => this.edgeBlocked(e)); this.fieldCache.set(key, f); } return f; }
  inQuarantineXY(x, y) { if (!this.quarantine.size) return false; const b = this.nearestBuilding(x, y, 120); return b ? this.quarantine.has(b.district) : false; }
  nearestBuilding(x, y, r = 80, filter) { let best = null, bd = r * r; this.city.bGrid.near(x, y, r, i => { const b = this.city.buildings[i]; if (filter && !filter(b)) return; const d = (b.c[0] - x) ** 2 + (b.c[1] - y) ** 2; if (d < bd) { bd = d; best = b; } }); return best; }

  // ---------- civilians ----------
  spawnCar(p, kind = 'civ', people = 0) {
    const C = this.city, j = C.nearestJunction(p[0], p[1], j => j.out.length > 0, 250); if (!j) return null;
    const arc = j.out[Math.floor(Math.random() * j.out.length)];
    const car = { kind, e: arc.e, dir: arc.dir, s: 0, v: 0, lane: 0, people, task: null, wait: 0, id: Math.random() };
    car.lane = Math.floor(Math.random() * this.lanes(arc.e, arc.dir));
    this.cars.push(car); return car;
  }
  lanes(e, dir) { return Math.max(1, dir === 1 ? e.lf : e.lb); }
  spawnPed(p, people) { this.peds.push({ x: p[0], y: p[1], j: null, path: null, people, v: 1.3 + Math.random() * .4, id: Math.random() }); }

  computeZone() { // buildings currently ordered to evacuate (recomputed once a second, not every step)
    const C = this.city, zone = new Set();
    for (const z of this.evacZones) C.bGrid.near(z.c[0], z.c[1], z.r, i => { const b = C.buildings[i]; if ((b.c[0] - z.c[0]) ** 2 + (b.c[1] - z.c[1]) ** 2 < z.r * z.r) zone.add(i); });
    for (const d of this.quarantine) for (const i of C.districts[d].buildings) zone.add(i);
    this.zoneActive = [...zone].filter(i => C.buildings[i].occ > 0);
    if (this.policeGrid) for (const i of this.zoneActive) { const b = C.buildings[i]; let near = false; this.policeGrid.near(b.c[0], b.c[1], 160, () => near = true); b.police = near; }
  }
  updateEvacuation(dt) {
    const C = this.city, zoneB = this.zoneActive || [];
    let budgetCars = Math.max(0, 2600 - this.cars.length), budgetPeds = Math.max(0, 2600 - this.peds.length);
    for (const i of zoneB) {
      const b = C.buildings[i]; if (!b.occ || b.garrison.length || b.infest > 0.5 || !C.unlockedAt(b.c[0], b.c[1])) continue;
      b.evac = true;
      const out = Math.min(b.occ, Math.max(1, b.occ * 0.003 * (b.police ? 2.2 : 1) * dt) * (Math.random() < 0.5 ? 1 : 0));
      if (!out) continue;
      b.evacAcc = (b.evacAcc || 0) + out; b.occ -= out; this.stats.evacuated += out;
      while (b.evacAcc >= 14) {
        b.evacAcc -= 14;
        if (Math.random() < 0.55 && budgetCars > 0) { this.spawnCar(b.ent, 'civ', 14); budgetCars--; }
        else if (budgetPeds > 0) { this.spawnPed(b.ent, 14); budgetPeds--; }
      }
      this.dirty(b);
    }
  }

  // ---------- traffic (lane-level car following on the road graph) ----------
  updateTraffic(dt) {
    const C = this.city, lanes = new Map();
    for (const c of this.cars) { const k = c.e.id * 4 + (c.dir === 1 ? 0 : 2) + 0; const kk = k + ':' + c.lane; let a = lanes.get(kk); if (!a) lanes.set(kk, a = []); a.push(c); }
    for (const a of lanes.values()) a.sort((x, y) => y.s - x.s);
    this.laneMap = lanes;
    const now = this.t;
    const dead = [];
    for (const a of lanes.values()) {
      for (let i = 0; i < a.length; i++) {
        const c = a[i], e = c.e, emerg = c.kind !== 'civ';
        if (c.parked) { c.v = 0; continue; }
        if (c.cp && c.wait > 3) { const q = this.carPos(c); if (Math.hypot(q[0] - c.cp.b[0], q[1] - c.cp.b[1]) < 110) { c.parked = true; c.v = 0; continue; } } // close enough: block the road here
        const vmax = Math.min(c.cp && !c.parked ? Math.max(15, e.speed / 3.6 * 1.8) : e.speed / 3.6 * (emerg ? 1.25 : 1), emerg ? 22 : 16) // cordon cars run on blue lights * (c.kind === 'civ' && this.zoneB && this.inZoneEdge(e) ? 0.8 : 1);
        let gap = Infinity;
        if (i > 0) gap = a[i - 1].s - 5 - c.s;
        const toEnd = e.L - c.s;
        // decide next arc when approaching the end
        if (!c.next && toEnd < 40) c.next = this.chooseNext(c);
        let stopAt = Infinity;
        if (toEnd < 30) {
          const J = c.dir === 1 ? e.B : e.A;
          if (!c.next) { if (c.kind === 'civ' && c.exiting) stopAt = Infinity; else stopAt = toEnd; }
          else if (J && !this.mayEnter(c, J, now, emerg)) stopAt = Math.max(0, toEnd - 1.5);
        }
        const g = Math.min(gap, stopAt);
        const vDes = Math.min(vmax, Math.max(0, (g - 2) * 0.9));
        c.v += Math.max(-7 * dt, Math.min(2.2 * dt, vDes - c.v)); if (c.v < 0) c.v = 0;
        c.s += c.v * dt;
        if (c.v < 0.3) c.wait += dt; else c.wait = 0;
        if (c.s >= e.L) {
          if (!c.next) { if (c.task?.park) { c.parked = true; c.s = e.L - 1; c.v = 0; continue; } dead.push(c); this.carArrived(c); continue; }
          const J = c.dir === 1 ? e.B : e.A; if (J) this.junctionBusy.set(J.id, { t: now, from: e.id * 2 + c.dir });
          const n = c.next; c.s -= e.L; c.e = n.e; c.dir = n.dir; c.lane = Math.min(this.lanes(n.e, n.dir) - 1, n.toLane ?? c.lane); c.next = null;
          if (c.task?.onArc) c.task.onArc(c);
        }
        // gridlock breaker: a long-stuck civilian car is quietly taken off the map (passengers continue on foot)
        if (c.wait > 90 && c.kind === 'civ') { dead.push(c); this.spawnPed(this.carPos(c), c.people); }
      }
    }
    if (dead.length) { const ds = new Set(dead); this.cars = this.cars.filter(c => !ds.has(c)); }
  }
  inZoneEdge(e) { return false; }
  carArrived(c) { if (c.task?.done) c.task.done(c); }
  chooseNext(c) {
    const C = this.city, J = c.dir === 1 ? c.e.B : c.e.A; if (!J) { c.exiting = true; return null; }
    let arc = null;
    if (c.task?.field) { const n = c.task.field.next.get(J.id); if (n) arc = n; else if (c.task.field.dist.has(J.id)) return null; }
    else if (c.kind === 'civ') { const n = this.evacD.next.get(J.id); if (n) arc = n; else if (this.evacD.dist.has(J.id)) return null; }
    if (!arc) { // wander
      const opts = J.out.filter(o => !(o.e === c.e && o.dir === -c.dir) && !this.edgeBlocked(o.e)); if (!opts.length) return J.out[0] ? { e: J.out[0].e, dir: J.out[0].dir } : null;
      arc = opts[Math.floor(Math.random() * opts.length)];
    }
    const cs = J.cmap.get(c.e.id + ':' + c.dir) || [];
    const m = cs.filter(x => x.toE === arc.e.id && x.toDir === arc.dir);
    let toLane = 0;
    if (m.length) { const best = m.reduce((a, b) => (Math.abs(b.fromLane - c.lane) < Math.abs(a.fromLane - c.lane) ? b : a)); if (best.fromLane !== c.lane) this.tryLane(c, best.fromLane); toLane = best.toLane; c.ci = best.ci; }
    else c.ci = -1;
    return { e: arc.e, dir: arc.dir, toLane };
  }
  tryLane(c, lane) {
    const a = this.laneMap?.get(c.e.id * 4 + (c.dir === 1 ? 0 : 2) + ':' + lane) || [];
    if (a.every(o => Math.abs(o.s - c.s) > 7)) c.lane = lane;
  }
  mayEnter(c, J, now, emerg) {
    if (J.phases && J.ctrl === 5 && !emerg) {
      const tt = (now + J.offset) % J.cycle; let acc = 0, green = null;
      for (const p of J.phases) { if (tt < acc + p.d) { green = p.g; break; } acc += p.d + p.y + p.r; }
      J.greenNow = green;
      if (!green) return false;
      if (c.ci >= 0) { const local = (J.conn || []).findIndex((x, i) => i === c.ci); if (!green.includes(c.ci)) return false; }
    }
    const busy = this.junctionBusy.get(J.id);
    if (busy && now - busy.t < (emerg ? 0.4 : 1.1) && busy.from !== c.e.id * 2 + c.dir) {
      if (J.ctrl === 5) return true; // signals already separate conflicting flows
      const k = (J.inc || []).findIndex(([e, d]) => e === c.e.id && d === c.dir);
      if (k >= 0 && J.yield && J.yield[k]) return false;
      if (J.ctrl === 2 || J.ctrl === 1 || J.ctrl === 6) return Math.random() < 0.5;
    }
    const n = c.next; if (n && !(c.cp && c.wait > 6)) { const tl = this.laneMap?.get(n.e.id * 4 + (n.dir === 1 ? 0 : 2) + ':' + (n.toLane || 0)); if (tl && tl.length && tl[tl.length - 1].s < 5.5) return false; }
    return true;
  }
  carPos(c) {
    const p = this.city.edgePoint(c.e, c.dir, c.s); const k = this.lanes(c.e, c.dir), oneway = c.e.flags & FLAG.oneway;
    const off = oneway ? (c.lane - (k - 1) / 2) * 3.1 : (c.lane + 0.5) * 3.1;
    return [p[0] + p[4] * off, p[1] - p[3] * off, p[2], p[3], p[4]];
  }
  updatePeds(dt) {
    const C = this.city, alive = [];
    this.pedGrid.clear();
    for (const p of this.peds) {
      if (p.dead) continue;
      if (!p.path) {
        const j = C.nearestJunction(p.x, p.y, j => j.walk.length > 0, 150);
        if (!j || !this.evacW.dist.has(j.id)) { p.path = []; } else { p.path = [[j.p[0], j.p[1]]]; p.j = j.id; }
      }
      if (!p.path.length) { const z = this.sites.find(z => z.kind === 'safezone' && Math.hypot(z.p[0] - p.x, z.p[1] - p.y) < z.r + 60); if (z) z.people += p.people; continue; } // reached safety (despawn)
      const tgt = p.path[0], dx = tgt[0] - p.x, dy = tgt[1] - p.y, d = Math.hypot(dx, dy), step = p.v * dt;
      if (d <= step) {
        p.x = tgt[0]; p.y = tgt[1]; p.path.shift();
        if (!p.path.length && p.j != null) {
          const n = this.evacW.next.get(p.j);
          if (n) { const e = n.e, pts = n.dir === 1 ? e.pts : e.pts.slice().reverse(); p.path = pts.slice(1).map(q => [q[0], q[1]]); p.j = n.dir === 1 ? e.b : e.a; }
          else p.j = null;
        }
      } else { p.x += dx / d * step; p.y += dy / d * step; }
      alive.push(p); this.pedGrid.add(p.x, p.y, p);
    }
    this.peds = alive;
  }

  // ---------- creatures ----------
  spawnCreature(x, y, inB = null) {
    if (this.creatures.length > 3500) return null;
    const P = this.P, c = { id: ++this.cid, x, y, hp: P.hp, max: P.hp, inB, target: null, path: null, think: Math.random() * 2, atk: 0, hx: 1, hy: 0 };
    if (this.kindSet()) this.assignKind(c);
    this.creatures.push(c); if (inB) this.enterInterior(c, inB); return c;
  }
  updateCreatures(dt) {
    const C = this.city, P = this.P, night = this.isNight();
    const nightMul = P.night ? (night ? 1.35 : 0.55) : 1;
    this.cGrid.clear();
    for (const c of this.creatures) if (!c.inB) this.cGrid.add(c.x, c.y, c);
    for (const c of this.creatures) {
      if (c.hp <= 0) continue;
      c.think -= dt; c.atk -= dt; const Q = c.K || P;
      if (c.inB) { // inside a building: infest it, kill or convert occupants, damage it
        const b = c.inB;
        b.infest = Math.min(1, b.infest + dt * 0.02 * nightMul); b.state = 1; this.dirty(b); if (b.infest > 0.1) this.infested.add(b);
        if (c.K && this.kindInBuilding(c, b, dt)) continue;
        if (!c.inside) this.enterInterior(c, b);
        if (false) {
          const k = Math.min(b.occ, dt * 1.2 * nightMul * (b.garrison.length ? 0.2 : 1));
          b.occ -= k; b.dead += k; this.stats.civDead += k; if (this.hive) this.hive.biomass += k * 0.3; if (b.dead > 3 && !b.known) { b.known = true; this.dirty(b); this.log(`Emergency calls from ${b.name || b.addr || 'a building'}: attack in progress.`, 'bad'); } b.convAcc = (b.convAcc || 0) + k * P.convert;
          while (b.convAcc >= 1) { b.convAcc--; this.spawnCreature(b.ent[0], b.ent[1], b); }
        }
        if (P.nest && Math.random() < P.nest * dt) this.spawnCreature(b.ent[0], b.ent[1], null);
        if (Q.bDmg) this.damageBuilding(b, Q.bDmg * dt * 10);
        if (b.garrison.length) { for (const u of b.garrison) this.hurtUnit(u, Q.dmg * dt * 0.3); }
        if ((b.occ <= 0.5 && b.infest >= 0.95 && c.think <= 0 && !this.units.some(u => u.inside === b)) || (P.night && !night && false)) { this.leaveInterior(c); c.inB = null; c.x = b.ent[0]; c.y = b.ent[1]; c.target = null; c.think = 1 + Math.random() * 3; }
        if (P.night && !night) continue; // nocturnal threats shelter by day
        continue;
      }
      if (P.night && !night && c.think <= 0) { // seek shelter by day
        const b = this.nearestBuilding(c.x, c.y, 120, b => !b.garrison.length);
        if (b) { c.target = { kind: 'b', b }; c.path = null; }
      }
      // pick targets
      if (c.think <= 0) {
        c.think = 1.5 + Math.random() * 2;
        let enemy = null, ed = Q.aggro * Q.aggro, pol = false; const busy = c.K && (c.K.build || c.carry);
        if (!busy) for (const u of this.units) { if (u.dead || u.inB || u.kind === 'heli') continue; const d = (u.x - c.x) ** 2 + (u.y - c.y) ** 2; if (d < ed) { ed = d; enemy = u; } }
        if (!enemy && !busy && this.policeGrid) this.policeGrid.near(c.x, c.y, Q.aggro, pc => { const d = (pc.x - c.x) ** 2 + (pc.y - c.y) ** 2; if (d < ed) { ed = d; enemy = null; pol = true; c.target = { kind: 'p', p: [pc.x, pc.y] }; c.path = null; } });
        if (enemy) c.target = { kind: 'u', u: enemy };
        else if (pol) { /* closing on a police car */ }
        else if (c.K && this.kindThink(c)) { /* the kind chose */ }
        else if (!c.target || c.target.kind !== 'b' || c.target.b.occ <= 0.5) {
          let best = null, bd = Infinity;
          C.bGrid.near(c.x, c.y, Q.sense, i => { const b = C.buildings[i]; if (b === c.noB || b.occ < 1 || !C.unlockedAt(b.c[0], b.c[1]) && Math.random() < 0.7) return; const d = (b.c[0] - c.x) ** 2 + (b.c[1] - c.y) ** 2 - b.occ * 40 + (b.garrison.length ? 1e5 : 0); if (d < bd) { bd = d; best = b; } });
          for (const z of this.sites) if (z.kind === 'safezone' && z.people > 30) { const d = (z.p[0] - c.x) ** 2 + (z.p[1] - c.y) ** 2 - z.people * 60; if (d < bd && d < Q.sense * Q.sense * 2) { bd = d; best = null; c.target = { kind: 'z', z }; c.path = null; } }
          if (best) { c.target = { kind: 'b', b: best }; c.path = null; }
          else if (!c.target && this.rural) { c.target = { kind: 'p', p: this.marchPoint(c), march: true }; c.path = null; }
          else if (!c.target) { const a = Math.random() * Math.PI * 2; c.target = { kind: 'p', p: [c.x + Math.cos(a) * 200, c.y + Math.sin(a) * 200] }; c.path = null; }
        }
      }
      // civilians on foot nearby
      if (c.biteT > this.t) continue; // busy biting, feeding or getting up
      if (c.charge && this.chargeStep(c, dt)) continue;
      if (Math.random() < dt * 2) this.pedGrid.near(c.x, c.y, 3, p => { if (!p.dead && !(c.biteT > this.t) && Math.hypot(p.x - c.x, p.y - c.y) < 2.5) {
        if (c.K && this.kindTouchPed(c, p)) return;
        p.dead = true; this.stats.civDead += p.people * 0.5; this.stats.evacuated -= p.people * 0.5; if (this.hive) this.hive.biomass += p.people * 0.4;
        const by = this.threat === 'lycan' ? 'claw' : P.convert > 0.2 ? 'bite' : 'claw', r = P.convert > 0.2 ? this.addRiser(p.x, p.y, { ped: p }) : null;
        c.biteT = this.t + (by === 'bite' ? 2.6 : 1.2); this.fxPush({ k: 'ped', p, by, a: c, riser: r });
      } });
      // move / attack
      const tg = c.target; if (!tg) continue;
      let tx, ty;
      if (tg.kind === 'u') { if (tg.u.dead || tg.u.inB) { c.target = null; continue; } tx = tg.u.x; ty = tg.u.y; }
      else if (tg.kind === 'b') { tx = tg.b.ent[0]; ty = tg.b.ent[1]; if (tg.b.destroyed) { c.target = null; continue; } }
      else if (tg.kind === 'ped') { const p = tg.p; if (p.dead || p.captive) { c.target = null; c.think = 0; continue; } tx = p.x; ty = p.y; if (Math.hypot(tx - c.x, ty - c.y) < (c.K?.capture ? 5 : 2.2)) { // hunters lunge the last few metres
          if (c.K?.capture) { c.x = p.x - (p.x - c.x) * 0.2; c.y = p.y - (p.y - c.y) * 0.2; }
          if (!this.kindTouchPed(c, p)) c.target = null; continue; } }
      else if (tg.kind === 'z') { tx = tg.z.p[0]; ty = tg.z.p[1]; if (Math.hypot(tx - c.x, ty - c.y) < tg.z.r * 0.6) { if (c.atk <= 0 && tg.z.people > 0) { c.atk = 1; const k = Math.min(tg.z.people, Q.dmg * 0.15); tg.z.people -= k; this.stats.civDead += k; this.stats.evacuated -= k; if (P.convert > 0.2 && Math.random() < 0.3) this.spawnCreature(c.x, c.y); } if (tg.z.people <= 0) c.target = null; continue; } }
      else { tx = tg.p[0]; ty = tg.p[1]; }
      const d = Math.hypot(tx - c.x, ty - c.y);
      let los = null;
      if (tg.kind === 'u' && c.K?.charge && this.maybeCharge(c, tg.u, d)) continue;
      if (tg.kind === 'u' && d <= Q.range + 1 && Q.ranged && d > 4 && tg.u.kind !== 'heli') { los = C.bars.sight(c.x, c.y, tx, ty); if (!los.clear) los = false; }
      if (tg.kind === 'u' && d <= Q.range + 1 && los !== false) {
        if (c.atk <= 0) { c.atk = 1; if (!(c.K && this.kindAttack(c, tg.u, d, los))) { this.hurtUnit(tg.u, Q.dmg * nightMul * (los ? los.cover : 1), Q.ranged ? null : c); if (Q.ranged) this.tracers.push({ a: [c.x, c.y, 2], b: [tx, ty, 1.5], t: 0.12, enemy: true }); } }
        continue;
      }
      if (tg.kind === 'b' && d < 3) {
        const b = tg.b;
        if (tg.deposit && this.kindArrive(c, tg)) continue;
        if (b.garrison.length) { if (c.atk <= 0) { c.atk = 1; this.damageBuilding(b, Q.dmg * 2); for (const u of b.garrison) this.hurtUnit(u, Q.dmg * 0.25); } continue; }
        c.inB = b; c.target = null; c.path = null; b.state = 1; this.enterInterior(c, b); continue;
      }
      if (tg.kind === 'p' && d < 4) { c.target = null; continue; }
      const cs = Q.speed * nightMul * dt * (c.crawl ? 0.22 : 1) * (c.K ? Math.min(1.25, this.boost(c)) : 1);
      if (c.K?.smash) this.titanStep(c, dt);
      if (tg.march && this.flow && this.flowMove(c, cs)) continue;
      this.stepAlongPath(c, tx, ty, cs, true);
    }
    // remove dead
    const before = this.creatures.length;
    for (let pass = 0; pass < 2; pass++) for (const c of this.creatures) if (c.hp <= 0 && !c.through && !c._dn) { c._dn = true; if (c.K) this.kindDeath(c); this.fxPush({ k: 'cdie', c, by: c.lastBy || 'rifle' }); }
    this.creatures = this.creatures.filter(c => c.hp > 0);
    // buildings with no creatures inside slowly lose infestation status only when cleared by force (see clearing)
  }
  stepAlongPath(o, tx, ty, step, walk) {
    // Long trips follow the road/path network. Legs off the network (to the first network node, the last stretch to the
    // target, and detours) collide with fences, walls, hedges and buildings.
    const B = this.city.bars, dt = this.dtNow || 0.1;
    if (o.vault) { o.vault.left -= dt; if (o.vault.left <= 0) { o.x = o.vault.x; o.y = o.vault.y; o.vault = null; } return; }
    if (o.crash > 0) { o.crash -= dt; step *= 0.45; }
    const far = Math.hypot(tx - o.x, ty - o.y) > 60, tk = Math.round(tx / 4) + ',' + Math.round(ty / 4);
    if (far && (!o.path || o.pathT !== tk)) { o.path = this.walkPath([o.x, o.y], [tx, ty], walk === false || o.kind === 'vehicle'); o.pathT = tk; o.pathFresh = true;
      // join the route at the nearest point we can reach in a straight line, not always at its first junction: a unit
      // halfway along a curving street would otherwise cut the corner into the buildings
      if (B && o.path.length > 1) { let bk = -1, bdd = Infinity; B.owKey = (B.owKey || 0) + 1;
        for (let k = 0; k < Math.min(16, o.path.length); k++) { const q = o.path[k], dd = Math.hypot(q[0] - o.x, q[1] - o.y); if (dd < bdd && dd < 150 && !B.firstHit(o.x, o.y, q[0], q[1], q[0], q[1], o.kind === 'vehicle' || o.riding)) { bdd = dd; bk = k; } }
        if (bk > 0) o.path.splice(0, bk); } }
    let gx = tx, gy = ty, offNet = true;
    if (far && o.path && o.path.length) {
      gx = o.path[0][0]; gy = o.path[0][1]; offNet = !!o.pathFresh;
      if (Math.hypot(gx - o.x, gy - o.y) < Math.max(2, step)) { o.path.shift(); o.pathFresh = false; }
    }
    const fx = gx, fy = gy, gk = Math.round(fx) + ',' + Math.round(fy);
    if (offNet && o.detour && o.detourK === gk) {
      while (o.detour.length && Math.hypot(o.detour[0][0] - o.x, o.detour[0][1] - o.y) < Math.max(0.6, step)) o.detour.shift();
      if (o.detour.length) { gx = o.detour[0][0]; gy = o.detour[0][1]; }
    }
    const dx = gx - o.x, dy = gy - o.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const sm = Math.min(step, d); let nx = o.x + ux * sm, ny = o.y + uy * sm;
    if (offNet && B && sm > 0) {
      B.owKey = (B.owKey || 0) + 1; const hit = B.firstHit(o.x, o.y, nx, ny, fx, fy, o.kind === 'vehicle' || !!o.riding || !!o.K?.smash);
      if (hit) {
        const w = Barriers.who(o, ITEM), hx = o.x + ux * sm * hit.t, hy = o.y + uy * sm * hit.t;
        if (hit.s && !B.blocks(hit.s, w)) {
          if (w.veh) { B.breakAt(hit.s, hx, hy); o.crash = 0.8; }
          else { o.x = hx - ux * 0.25; o.y = hy - uy * 0.25; o.hx = ux; o.hy = uy; o.vault = { left: o.kind === 'squad' ? 1.1 : ((o.K || this.P)?.vault ?? 1.5), x: hx + ux * 0.45, y: hy + uy * 0.45 }; return; }
        } else {
          // titans tear through the building in their way
          if (o.K?.smash && hit.wall) { this.damageBuilding(hit.wall.b, 650 * dt); this.hitBuildingAt(hit.wall.b, hx, hy, (hit.wall.b.z || 0) + 1 + Math.random() * 6, 140 * dt); if (Math.random() < dt * 3) this.fxPush({ k: 'smash', x: hx, y: hy, c: o, small: true }); return; }
          // blocked: find a way round (a limited number of searches per tick; others wait a tick)
          if (this.routeBudget <= 0) return;
          this.routeBudget--;
          // far goals (open country with no road leg): find a way round towards a nearer point on the way
          const fd = Math.hypot(fx - o.x, fy - o.y), near = fd > 140, rx = near ? o.x + (fx - o.x) / fd * 110 : fx, ry = near ? o.y + (fy - o.y) / fd * 110 : fy;
          let r = B.route(o.x, o.y, rx, ry, w);
          if (r === null && this.rural) r = B.route(o.x, o.y, rx, ry, w, 260);
          // a unit that has wandered off the network into a pocket (courtyard, service lane) retraces its own tracks out
          if ((r === null || !r.length) && o.trail && o.trail.length > 1 && !o.retrace) { o.detour = o.trail.slice().reverse(); o.detourK = gk; o.retrace = true; o.trail = null; o.stuck = 0; return; }
          if (r === null) { this.onBlocked(o); return; }
          if (!r || !r.length) { o.stuck = (o.stuck || 0) + dt * 4; if (o.stuck > 6) { o.stuck = 0; this.onBlocked(o); } return; }
          o.detour = r.slice(); o.detourK = gk; o.stuck = 0;
          return;
        }
      }
    }
    o.x = nx; o.y = ny; o.hx = ux; o.hy = uy;
    if (o.order !== undefined) { // player units keep a short breadcrumb trail of their off-network legs
      if (!offNet) { o.trail = [[nx, ny]]; o.retrace = false; }
      else if (!o.retrace) { const T = o.trail || (o.trail = [[nx, ny]]), l = T[T.length - 1]; if (Math.hypot(l[0] - nx, l[1] - ny) > 6) { T.push([nx, ny]); if (T.length > 80) T.shift(); } }
    }
  }
  onBlocked(o) {
    o.detour = null; o.path = null;
    if (o.order !== undefined) { // player unit
      if (!o.blockLog || this.t - o.blockLog > 20) { o.blockLog = this.t; this.log(`${o.name} can't get through: the way is fenced or walled off.${o.kind === 'squad' ? ' A vehicle can breach fences.' : ''}`, 'bad'); }
      if (o.order && o.order.type !== 'recon') o.order = null;
    } else { // creature: give up on this target for a while
      if (o.target?.kind === 'b') o.noB = o.target.b;
      o.target = null; o.think = 0.5 + Math.random();
    }
  }
  netComp(drive) { // connected components of the drive / walk graphs, rebuilt when streamed tiles add junctions
    const C = this.city, key = drive ? '_compD' : '_compW', n = C.junctions.size;
    if (this[key] && this[key].n === n) return this[key].m;
    const m = new Map(); let k = 0;
    for (const j0 of C.junctions.values()) { if (m.has(j0.id)) continue; k++; const st = [j0.id]; m.set(j0.id, k);
      while (st.length) { const J = C.junctions.get(st.pop()); if (!J) continue; const nb = drive ? [...J.out.map(o => o.e), ...J.in.map(o => o.e)] : J.walk;
        for (const e of nb) { const o = e.a === J.id ? e.b : e.a; if (!m.has(o)) { m.set(o, k); st.push(o); } } } }
    this[key] = { n, m }; return m;
  }
  walkPath(a, b, drive = false) {
    const C = this.city;
    const filt = drive ? (j => j.out.length + j.in.length > 0) : (j => j.walk.length > 0);
    // start and end on the same connected piece of network, so a unit parked by an isolated service road or courtyard
    // lane still finds a way out instead of pushing straight at the buildings
    const comp = this.netComp(drive), t = C.nearestJunction(b[0], b[1], filt, 400), tc = t && comp.get(t.id);
    const s = t && (C.nearestJunction(a[0], a[1], j => filt(j) && comp.get(j.id) === tc, 400) || C.nearestJunction(a[0], a[1], filt, 400));
    if (!s || !t || s === t) return [];
    const open = new Heap(), g = new Map([[s.id, 0]]), prev = new Map(); open.push(0, s.id); let n = 0;
    const tp = t.p;
    while (open.size && n++ < 25000) {
      const [, id] = open.pop(); if (id === t.id) break;
      const J = C.junctions.get(id); if (!J) continue;
      const nb = drive ? [...J.out.map(o => o.e), ...J.in.map(o => o.e)] : J.walk;
      for (const e of nb) {
        if (drive && this.edgeBlocked(e)) continue; // passages under buildings
        const o = e.a === id ? e.b : e.a, O = C.junctions.get(o); if (!O) continue;
        const ng = g.get(id) + e.L; if (ng < (g.get(o) ?? Infinity)) { g.set(o, ng); prev.set(o, { id, e }); open.push(ng + Math.hypot(O.p[0] - tp[0], O.p[1] - tp[1]), o); }
      }
    }
    if (!prev.has(t.id)) return [[t.p[0], t.p[1]]];
    const out = []; let cur = t.id;
    while (cur !== s.id) { const p = prev.get(cur); const e = p.e; const pts = e.a === p.id ? e.pts : e.pts.slice().reverse(); for (let i = pts.length - 1; i >= 1; i--) out.push([pts[i][0], pts[i][1]]); cur = p.id; }
    out.push([s.p[0], s.p[1]]);
    return out.reverse();
  }
  damageBuilding(b, d) {
    if (b.hp <= 0) return; if (b.hive) d *= 1 - 0.5 * b.hive; b.hp -= d; this.dirty(b); (this.damaged || (this.damaged = new Set())).add(b);
    if (b.hp <= 0) { b.hp = 0; b.destroyed = true; this.stats.bDestroyed++; const k = b.occ * 0.6; b.occ -= k; b.dead += k; this.stats.civDead += k; for (const u of b.garrison.slice()) this.ungarrison(u); if (this.stats.bDestroyed % 5 === 1) this.log(`Building collapsed: ${b.name || b.addr || 'block'}.`, 'bad'); }
  }

  // ---------- player forces ----------
  addUnit(f) {
    const it = f.vehicle ? ITEM[f.vehicle] : null, kind = it ? (it.cat === 'heli' ? 'heli' : 'vehicle') : 'squad';
    const base = this.staging[f.approach] || Object.values(this.staging)[0];
    const fire = it ? it.power * 7 : Object.entries(f.items).reduce((s, [id, q]) => s + ((ITEM[id]?.power || 0) * q), 0) * 1.6 / Math.max(1, f.pers);
    const range = it ? (it.arm && it.arm !== '—' ? (it.power >= 9 ? 400 : it.power >= 4 ? 250 : 180) : 0) : Math.min(300, Math.max(120, ...Object.keys(f.items).map(id => ITEM[id]?.range || 0)));
    const vest = (f.items.vest || 0) >= f.pers ? 0.35 : 0;
    const gear = f.items.nrbc ? 'nrbc' : f.items.nvg ? 'nvg' : null;
    const armor = it ? ({ None: 0, Light: 0.5, Medium: 0.7, Heavy: 0.88 })[it.armor] : vest;
    const hp = it ? ({ None: 160, Light: 450, Medium: 800, Heavy: 1600 })[it.armor] : 100;
    const u = {
      id: ++this.uid, ref: f.id, name: f.name, kind, vehicle: f.vehicle || null, pers: f.pers, men: kind === 'squad' ? f.pers : f.pers, hp: kind === 'squad' ? f.pers * 100 : hp, maxHp: kind === 'squad' ? f.pers * 100 : hp,
      fire, range, armor, speed: it ? Math.min(it.speed, 70) / 3.6 * (kind === 'heli' ? 1.6 : 1) : 3.2, motor: !it && !!f.carrier, carrier: f.carrier || null, riding: false, pax: it?.pax || 0, ammo: 100, gear,
      mg: it ? 0 : Object.entries(f.items).reduce((a, [id, q]) => a + (/mg|lmg|mmg/i.test(id) ? q : 0), 0) / Math.max(1, f.pers), nades: it ? 0 : f.pers, nadeCool: 5 + Math.random() * 10, wounded: 0,
      x: base[0] + (Math.random() - .5) * 40, y: base[1] + (Math.random() - .5) * 40, hx: 1, hy: 0, order: null, manual: false, inB: null, path: null, cool: 0, hvt: null, carrying: [], approach: f.approach, kills: 0, dead: false,
    };
    if (kind === 'heli') { u.alt = 45; u.altMode = 'high'; }
    this.units.push(u); return u;
  }
  hurtUnit(u, dmg, src = null) {
    if (u.dead) return;
    const gearBonus = u.gear && this.P && ((this.threat === 'undead' || this.threat === 'swarm' || this.threat === 'mutant') && u.gear === 'nrbc' || (this.threat === 'vampire' || this.threat === 'alien') && u.gear === 'nvg') ? 0.75 : 1;
    const ap = src?.K?.smash ? 0.35 : src?.K?.charge ? 0.6 : 1, d = dmg * (1 - u.armor * ap) * gearBonus * (u.inB ? 0.45 : 1);
    u.hp -= d;
    if (u.kind === 'heli') { if (u.hp <= 0 && !u.dead) { const below = this.roofsNear(u.x, u.y, 1).find(q => q.d < 0.5 && q.top < u.alt); this.heliCrash(u, below?.b || null); return; } this.heliHit(u); }
    const kk = u.ai ? 'natKIA' : 'soldiersKIA';
    if (u.kind === 'squad') { const men = Math.max(0, Math.ceil(u.hp / 100)); if (men < u.men) { for (let i = u.men - 1; i >= men; i--) this.manDown(u, i, src, kk); u.men = men; } }
    if (u.hp <= 0) {
      u.dead = true; u.men = 0; if (u.kind !== 'squad') { if (!u.ai) this.stats.vehiclesLost++; this.stats[kk] = (this.stats[kk] || 0) + u.pers; }
      if (u.inB) this.ungarrison(u);
      for (const h of u.carrying) { h.state = 'lost'; this.stats.hvtLost++; this.log(`HVT ${h.name} killed with ${u.name}.`, 'bad'); }
      this.log(`${u.name} destroyed.`, 'bad');
    }
  }
  manDown(u, i, src, kk) {
    const bite = !!src && this.P.convert > 0.2 && !u.inB, wounded = !bite && !u.inB && Math.random() < 0.35;
    if (wounded) u.wounded = (u.wounded || 0) + 1; else this.stats[kk] = (this.stats[kk] || 0) + 1;
    const x = u.x + (Math.random() - .5) * 4, y = u.y + (Math.random() - .5) * 4, r = bite ? this.addRiser(x, y, { unit: u, i }) : null;
    if (src) src.biteT = this.t + (bite ? 2.6 : 1);
    this.fxPush({ k: 'man', u, i, x, y, by: bite ? 'bite' : src ? 'claw' : 'gun', wounded, riser: r, a: src });
  }
  fxPush(e) { e.t = this.t; this.fx.push(e); if (this.fx.length > 3000) { this.fx.splice(0, 500); this.fxBase = (this.fxBase || 0) + 500; } }
  addRiser(x, y, src) { const r = { x, y, t: this.t + 16 + Math.random() * 26, src }; this.risers.push(r); return r; }
  loseLimb(c, by) {
    const has = b => !(c.lost & b), opts = [[1, 0.16], [2, 0.21], [4, 0.21], [8, 0.21], [16, 0.21]].filter(([b]) => has(b)); if (!opts.length) return;
    let t = Math.random() * opts.reduce((a, o) => a + o[1], 0), bit = opts[0][0]; for (const [b, w] of opts) if ((t -= w) < 0) { bit = b; break; }
    c.lost = (c.lost || 0) | bit; if (bit & 24) c.crawl = true; if (bit === 1) c.hp = 0;
    this.fxPush({ k: 'limb', c, bit, by });
  }
  // a grenade or shell bursts: hostiles torn apart, nearby civilians and bodies caught in it
  explode(x, y, r, dmg, src) {
    this.cGrid.near(x, y, r, c => { const d = Math.hypot(c.x - x, c.y - y); if (d > r || c.inB) return; c.hp -= dmg * (1 - d / r * 0.7); c.lastBy = 'blast'; c.hitT = this.t; if (c.hp > 0 && this.limbable && Math.random() < 0.6) this.loseLimb(c, 'blast'); });
    this.pedGrid.near(x, y, r * 0.8, p => { if (!p.dead && Math.hypot(p.x - x, p.y - y) < r * 0.8) { p.dead = true; this.stats.civDead += p.people * 0.5; this.fxPush({ k: 'ped', p, by: 'blast' }); } });
    for (const k of this.risers) if (!k.done && Math.hypot(k.x - x, k.y - y) < r) k.destroyed = true;
    // blasts against buildings knock out the sections next to them
    if (r >= 3) this.city.bGrid.near(x, y, r + 10, i => { const b = this.city.buildings[i]; if (b.destroyed) return; const L = this.layoutOf(b); for (const s of L.sections) if (s.f <= 1 && !s.dead && Math.hypot(s.cx - x, s.cy - y) < r + Math.sqrt(s.a) * 0.4) this.damageSection(b, s, dmg * 0.6 * (s.f ? 0.5 : 1)); });
    this.fxPush({ k: 'boom', x, y, r, src });
  }
  order(u, ord) { if (u.inside && ord.b !== u.inside) this.leaveInterior(u); u.order = ord; u.path = null; u.manual = !!ord.manual; if (u.inB && ord.type !== 'garrison') this.ungarrison(u); }
  ungarrison(u) { const b = u.inB; if (!b) return; b.garrison = b.garrison.filter(x => x !== u); this.dirty(b); u.inB = null; u.x = b.ent[0] + (Math.random() - .5) * 6; u.y = b.ent[1] + (Math.random() - .5) * 6; }
  updateUnits(dt) {
    const C = this.city;
    for (const u of this.units) {
      if (u.dead) continue;
      if (u.inside) { if (u.men <= 0) this.leaveInterior(u); continue; } // inside a building: see stepInteriors
      if (u.kind === 'heli' && (this.stepHeli(u, dt) || u.lost)) continue;
      u.cool -= dt;
      const o = u.order;
      // movement
      if (o && !u.inB) {
        let tx, ty, arrive = 3;
        if (o.type === 'move' || o.type === 'build') { tx = o.p[0]; ty = o.p[1]; }
        else if (o.type === 'garrison' || o.type === 'clear' || o.type === 'extract') { tx = o.b.ent[0]; ty = o.b.ent[1]; arrive = 4; }
        else if (o.type === 'resupply') { tx = o.site.p[0]; ty = o.site.p[1]; arrive = o.site.r * 0.6; }
        else if (o.type === 'guard') { tx = o.p[0]; ty = o.p[1]; arrive = 8; }
        else if (o.type === 'recon') { o.a += (u.speed / o.r) * dt * 0.6; tx = o.c[0] + Math.cos(o.a) * o.r; ty = o.c[1] + Math.sin(o.a) * o.r; arrive = 0; }
        if (tx !== undefined) {
          const d = Math.hypot(tx - u.x, ty - u.y);
          if (d > arrive) {
            if (u.kind === 'heli') { const dx = tx - u.x, dy = ty - u.y; const s = Math.min(d, u.speed * dt), nx = u.x + dx / d * s, ny = u.y + dy / d * s; u.hx = dx / d; u.hy = dy / d; if (!this.heliBlocked(u, nx, ny)) { u.x = nx; u.y = ny; } else if (!this.heliBlocked(u, nx, u.y)) u.x = nx; else if (!this.heliBlocked(u, u.x, ny)) u.y = ny; } // pilots don't fly the rotor into a facade
            else {
              // squads ride their transport (assigned at dispatch) on long moves when no hostiles are close
              let ride = false;
              if (u.motor && d > 300) { ride = true; this.cGrid.near(u.x, u.y, 160, c => { if (c.hp > 0) ride = false; }); }
              if (ride !== u.riding) { u.riding = ride; u.path = null; }
              this.stepAlongPath(u, tx, ty, (ride ? 11 : u.speed) * dt * (u.ammo <= 0 ? 0.8 : 1), !ride);
            }
          } else this.arrived(u, o);
        }
      }
      // shooting
      if (u.range > 0 && u.ammo > 0 && u.cool <= 0 && (u.kind !== 'squad' || u.men > 0)) {
        const r = u.range + (u.inB ? 60 : 0);
        // nearest visible threat in clear line of sight (helicopters fire from above)
        const cand = []; this.cGrid.near(u.x, u.y, r, c => { if (c.hp <= 0 || !c.vis) return; const d = (c.x - u.x) ** 2 + (c.y - u.y) ** 2; if (d < r * r) cand.push([d, c]); });
        cand.sort((a, b) => a[0] - b[0]);
        let best = null, bd = 0, cover = 1;
        for (let k = 0; k < Math.min(5, cand.length); k++) {
          const c = cand[k][1], los = u.kind === 'heli' ? (this.heliSight(u, c.x, c.y) ? { clear: true, cover: 1 } : { clear: false }) : C.bars.sight(u.x, u.y, c.x, c.y, !!u.inB, u.inB);
          if (los.clear) { best = c; bd = cand[k][0]; cover = los.cover; break; }
        }
        // nothing in the street: hostiles seen through the windows of nearby buildings
        let inWin = null;
        if (!best) for (const b of this.activeB) {
          if (b === u.inB || (b.c[0] - u.x) ** 2 + (b.c[1] - u.y) ** 2 > (r + 30) ** 2) continue;
          const L = b.L; if (!L) continue;
          for (const c of b.inside) { if (c.kind || c.hp <= 0 || !c.sec || c.sec.dead && false) continue; const s = c.sec; if (s.glass <= 0 && !s.dead && false) continue;
            if (!s.dead && !facing(L, s, u.x, u.y)) continue; const d2 = (s.cx - u.x) ** 2 + (s.cy - u.y) ** 2; if (d2 > r * r) continue;
            const los = u.kind === 'heli' ? { clear: this.heliSight(u, s.cx, s.cy, s.z - C.heightAt(s.cx, s.cy) + 1) } : C.bars.sight(u.x, u.y, s.cx, s.cy, !!u.inB, b); if (!los.clear) continue;
            best = c; bd = d2; cover = s.dead ? 0.8 : 0.5; inWin = { b, s }; break; }
          if (best) break;
        }
        if (best) {
          if (inWin) { inWin.s.glass = Math.max(0, inWin.s.glass - 0.12); this.fxPush({ k: 'glass', b: inWin.b, s: inWin.s, from: [u.x, u.y] }); if (u.fire >= 63) this.damageSection(inWin.b, inWin.s, 25); }
          const dps = u.fire * (u.kind === 'squad' ? u.men : 1);
          u.cool = 0.5; u.fireT = this.t; u.aimAt = [best.x, best.y];
          const dist = Math.sqrt(bd), acc = Math.max(0.35, 1 - dist / (r * 1.6));
          best.hp -= dps * 0.5 * acc * cover * (best.max > 300 && u.kind === 'squad' ? 0.6 : 1);
          const by = u.kind === 'squad' ? (Math.random() < u.mg ? 'heavy' : 'rifle') : u.kind === 'heli' ? 'heavy' : u.fire >= 63 ? 'cannon' : 'heavy';
          best.hitT = this.t; best.lastBy = by; this.fxPush({ k: 'hit', c: best, by, from: [u.x, u.y] });
          if (best.hp > 0 && this.limbable && by !== 'rifle' && Math.random() < (by === 'cannon' ? 0.35 : 0.1)) this.loseLimb(best, by);
          u.ammo -= u.kind === 'squad' ? 0.25 : 0.4; this.stats.supplyUsed += 0.02;
          this.tracers.push({ a: [u.x, u.y, u.inB ? u.inB.z + 6 : u.kind === 'heli' ? 60 : 1.6], b: [best.x, best.y, 1.2], t: 0.08 });
          if (best.hp <= 0) { u.kills++; this.stats.kills++; if (Math.random() < 0.04) { this.stats.specimens++; } }
        }
      }
      // resupply near supply sites
      if (u.ammo < 100) for (const s of this.sites) { if (!s.built || s.stock <= 0) continue; if (Math.hypot(s.p[0] - u.x, s.p[1] - u.y) < s.r) { const take = Math.min(100 - u.ammo, dt * 15); u.ammo += take; if (s.stock !== Infinity) s.stock -= take * 0.05; else this.supply -= take * 0.004; if (u.kind === 'squad' && s.kind === 'camp' && u.hp < u.men * 100) u.hp = Math.min(u.men * 100, u.hp + dt * 3); break; } }
      // HVTs ride along; reaching a staging area or camp evacuates them
      if (u.carrying.length) for (const s of this.sites) if ((s.kind === 'staging' || s.kind === 'camp' || s.kind === 'safezone') && s.built && Math.hypot(s.p[0] - u.x, s.p[1] - u.y) < s.r) { for (const h of u.carrying) { h.state = 'saved'; this.stats.hvtSaved++; this.log(`HVT ${h.name} evacuated.`, 'good'); } u.carrying = []; }
    }
  }
  arrived(u, o) {
    if (o.type === 'move' || o.type === 'guard') { if (o.type === 'move') { u.order = o.then || null; u.manual = false; } return; }
    if (o.type === 'recon') return;
    if (u.kind === 'heli' && o.type === 'extract') { // land, load, fly to the nearest safe zone or staging area
      const b = o.b; o.wait = (o.wait || 0) + 0.1; if (o.wait < 15) return;
      const room = u.pax - u.carrying.length;
      for (const h of this.hvts) if (room > 0 && h.b === b && h.state === 'inside') { h.state = 'escorted'; h.unit = u; u.carrying.push(h); this.log(`${u.name} lifted ${h.name} out.`, 'good'); }
      const st = this.nearestSite(u.x, u.y, s => s.kind === 'staging' || s.kind === 'safezone' || s.kind === 'camp');
      u.order = st ? { type: 'move', p: st.p } : null; return;
    }
    if (o.type === 'garrison' || o.type === 'extract') {
      const b = o.b; if (b.destroyed) { u.order = null; return; }
      if (b.infest > 0.1) { u.order = { type: 'clear', b }; return; }
      const hv = this.hvts.find(h => h.b === b && h.state === 'inside');
      if (hv && u.kind !== 'heli') { hv.state = 'escorted'; hv.unit = u; u.carrying.push(hv); this.log(`${u.name} picked up ${hv.name}.`, 'good'); const st = this.nearestSite(u.x, u.y, s => s.kind === 'staging' || s.kind === 'camp' || s.kind === 'safezone'); if (st) { u.order = { type: 'move', p: st.p }; return; } }
      if (o.type === 'garrison' && u.kind === 'squad') { u.inB = b; b.garrison.push(u); this.dirty(b); u.order = { type: 'garrison', b }; }
      else u.order = null;
      return;
    }
    if (o.type === 'clear') {
      const b = o.b;
      if (u.kind === 'squad') { if (u.men > 0 && !u.inside) { this.enterInterior(u, b); this.log(`${u.name} entering ${b.name || b.addr || 'the building'}.`); } return; } // the squad goes in and clears it floor by floor
      const L = this.layoutOf(b), inside = this.creatures.filter(c => c.inB === b && c.sec && facing(L, c.sec, u.x, u.y)); // vehicles support from the street, firing in through the windows
      const dps = u.fire * (u.kind === 'squad' ? u.men : 1) * 0.5;
      if (u.cool <= 0 && u.ammo > 0) {
        u.cool = 0.5; u.ammo -= 0.35;
        if (inside.length) { const c = inside[0]; c.hp -= dps * 0.8; c.hitT = this.t; c.lastBy = u.fire >= 63 ? 'cannon' : 'heavy'; c.sec.glass = Math.max(0, c.sec.glass - 0.15); if (u.fire >= 63) this.damageSection(b, c.sec, 30); u.fireT = this.t; u.aimAt = [c.sec.cx, c.sec.cy]; this.fxPush({ k: 'glass', b, s: c.sec, from: [u.x, u.y] }); if (c.hp <= 0) { this.stats.kills++; u.kills++; } }
        else if (false) { b.infest = Math.max(0, b.infest - 0.06 * (1 - 0.6 * (b.hive || 0))); if (b.infest <= 0) { if (b.hive) this.clearHive(b); b.state = 2; this.infested.delete(b); this.dirty(b); this.stats.specimens += 1; this.log(`${u.name} cleared ${b.name || b.addr || 'a building'} — samples taken.`, 'good'); u.order = this.garrisonMarks.has(b.idx) ? { type: 'garrison', b } : null; } }
        this.dirty(b);
      }
      return;
    }
    if (o.type === 'resupply') { if (u.ammo >= 99) u.order = null; return; }
    if (o.type === 'build') { const s = o.site; if (!s.built) { s.progress = (s.progress || 0) + 0.5; if (s.progress >= (s.kind === 'camp' ? 40 : 15)) { s.built = 1; s.stock = s.kind === 'camp' ? 60 : 25; this.supply -= s.kind === 'camp' ? 30 : 12; this.log(`${s.name} established.`, 'good'); u.order = null; } } else u.order = null; }
  }
  nearestSite(x, y, f) { let b = null, bd = Infinity; for (const s of this.sites) { if (!s.built || (f && !f(s))) continue; const d = Math.hypot(s.p[0] - x, s.p[1] - y); if (d < bd) { bd = d; b = s; } } return b; }
  placeSite(kind, p) {
    const need = kind === 'camp' ? 30 : 12; if (this.supply < need) return `Not enough supply (${Math.round(this.supply)}/${need}).`;
    const s = { id: 'site' + this.sites.length, kind, p, r: kind === 'camp' ? 120 : 60, stock: 0, built: 0, name: kind === 'camp' ? 'Forward camp' : 'Supply outpost' };
    this.sites.push(s);
    const trucks = this.units.filter(u => !u.dead && (u.kind === 'vehicle' && (ITEM[u.vehicle]?.cat === 'truck') || u.kind === 'heli') && !u.manual);
    const builder = (trucks.length ? trucks : this.units.filter(u => !u.dead && u.kind !== 'heli')).sort((a, b) => Math.hypot(a.x - p[0], a.y - p[1]) - Math.hypot(b.x - p[0], b.y - p[1]))[0];
    if (builder) { this.order(builder, { type: 'build', p, site: s }); this.log(`${builder.name} moving to set up the ${s.name.toLowerCase()}.`); }
    return null;
  }
  toggleQuarantine(d) {
    if (this.quarantine.has(d)) this.quarantine.delete(d); else this.quarantine.add(d);
    this.computeCheckpoints(); this.refreshFields();
    for (const i of this.city.districts[d].buildings) this.dirty(this.city.buildings[i]);
    this.log(`${this.city.districts[d].name}: quarantine ${this.quarantine.has(d) ? 'declared — cordon and evacuation under way' : 'lifted'}.`, this.quarantine.has(d) ? 'warn' : 'info');
  }
  // the police seal off the outbreak: quarantine districts around it, 20–30 patrol cars parked across every road
  // out, their officers holding the line until the SCO has cleared the area. The cordon widens as the outbreak does.
  updateCordon() {
    if (this.rural || !this.impact || this.t < 12) return;
    const C = this.city, ds = new Map([[this.impact.district, 0]]);
    const add = (d, x, y) => { if (d === undefined || d < 0 || !C.districts[d]) return; const dd = Math.hypot(x - this.origin[0], y - this.origin[1]); if (!ds.has(d) || ds.get(d) > dd) ds.set(d, dd); };
    for (const b of this.infested) if (b.known && !b.destroyed) add(b.district, b.c[0], b.c[1]);
    for (const c of this.creatures) if (!c.inB && c.vis && c.hp > 0) { const b = this.nearestBuilding(c.x, c.y, 80); if (b) add(b.district, c.x, c.y); }
    const seal = [...ds.entries()].sort((a, b) => a[1] - b[1]).slice(0, 8).map(e => e[0]), fresh = seal.filter(d => !this.quarantine.has(d));
    if (fresh.length) {
      for (const d of fresh) { this.quarantine.add(d); for (const i of C.districts[d].buildings) this.dirty(C.buildings[i]); }
      this.computeCheckpoints(); this.refreshFields();
      this.log(`Police seal off ${fresh.map(d => C.districts[d].name).join(', ')}: quarantine cordon going up.`, 'warn');
    }
    const cps = this.checkpoints.slice().sort((a, b) => (C.edges.get(a.id)?.cls ?? 9) - (C.edges.get(b.id)?.cls ?? 9)).slice(0, 15);
    const police = this.cars.filter(c => c.kind === 'police'), want = Math.min(30, Math.max(20, cps.length * 2));
    // reinforcements drive in from outside the area until the cordon has its cars
    if (police.length < want + 4) { const js = this._edgeJs || (this._edgeJs = [...C.junctions.values()].filter(j => j.out.length && C.unlockedAt(j.p[0], j.p[1]) && Math.hypot(j.p[0] - this.origin[0], j.p[1] - this.origin[1]) > 700)); for (let i = 0; i < 4 && js.length; i++) { const c = this.spawnCar(js[Math.floor(Math.random() * js.length)].p, 'police'); if (c) c.reinf = true; } if (!this._reinfLog) { this._reinfLog = true; this.log('Police reinforcements are converging on the cordon from across the city.', 'info'); } }
    for (const cp of this.checkpoints) cp.cars = (cp.cars || []).filter(c => this.cars.includes(c));
    for (const cp of cps) {
      if (cp.cars.length === 0 && cp.manned) { cp.manned = false; this.log(`The police post at a cordon checkpoint has been overrun.`, 'bad'); }
      while (cp.cars.length < 2) {
        let best = null, bd = Infinity; for (const c of this.cars) { if (c.kind !== 'police' || c.cp && this.checkpoints.includes(c.cp) || c.hp <= 0) continue; const q = this.carPos(c), d = Math.hypot(q[0] - cp.b[0], q[1] - cp.b[1]) + (c.task && c.parked ? 0 : 50); if (d < bd) { bd = d; best = c; } }
        if (!best) break;
        const j = C.nearestJunction(cp.b[0], cp.b[1], j => j.in.length > 0, 200); if (!j) break;
        best.cp = cp; best.role = null; best.parked = false; best.task = { field: this.fieldTo('j' + j.id, [j.id]), park: true }; cp.cars.push(best); cp.manned = true;
      }
    }
  }
  computeCheckpoints() {
    const C = this.city, out = [];
    const jd = j => { const b = this.nearestBuilding(j.p[0], j.p[1], 120); return b ? b.district : -1; };
    for (const e of C.edges.values()) {
      if (!(e.flags & FLAG.drive) || e.cls > 7 || !e.A || !e.B) continue;
      const da = jd(e.A), db = jd(e.B); if (da === db) continue;
      const qa = this.quarantine.has(da), qb = this.quarantine.has(db); if (qa === qb) continue;
      const inner = qa ? e.A : e.B, outer = qa ? e.B : e.A;
      out.push({ id: e.id, p: [(e.A.p[0] + e.B.p[0]) / 2, (e.A.p[1] + e.B.p[1]) / 2], a: inner.p, b: outer.p, guards: [], police: 0 });
    }
    this.checkpoints = out;
  }

  // ---------- AI ground commander ----------
  updateCommander() {
    const idle = this.units.filter(u => !u.ai && !u.dead && !u.manual && !u.inB && (!u.order || u.order.type === 'guard') && u.kind !== 'heli');
    const take = (filter, near) => { let best = null, bd = Infinity; for (const u of idle) { if (u.taken || !filter(u)) continue; const d = Math.hypot(u.x - near[0], u.y - near[1]); if (d < bd) { bd = d; best = u; } } if (best) best.taken = true; return best; };
    idle.forEach(u => u.taken = false);
    // resupply first
    if (this.cmd.resupply) for (const u of this.units) if (!u.ai && !u.dead && !u.manual && u.ammo < 25 && u.order?.type !== 'resupply' && !u.inB) { const s = this.nearestSite(u.x, u.y, s => s.stock > 0); if (s) { this.order(u, { type: 'resupply', site: s }); u.taken = true; } }
    // guard safe zones first: civilians gather there
    for (const z of this.sites) if (z.kind === 'safezone' && z.built) {
      z.guards = (z.guards || []).filter(u => !u.dead && u.order?.type === 'guard' && u.order.zone === z);
      if (!z.guards.length) { const u = take(u => u.kind !== 'heli' && u.ammo > 25 && (u.kind !== 'squad' || u.men >= 2), z.p); if (u) { this.order(u, { type: 'guard', p: z.p, zone: z }); z.guards.push(u); this.log(`${u.name} securing ${z.name}.`); } }
    }
    // helicopters: containment — patrol tight circles over the hostiles and fire down (HVT lifts only when you order them)
    for (const h of this.units) {
      if (h.dead || h.kind !== 'heli' || h.manual || (h.order && h.order.type !== 'recon')) continue;
      const p = this.containPoint();
      if (!h.order) this.order(h, { type: 'recon', c: p, r: h.fire > 20 ? 90 : 140, a: Math.random() * 6.28 });
      else h.order.c = p;
    }
    // garrison marked & key buildings (HVT locations, hospitals, police stations near the threat)
    if (this.cmd.garrisonKey) {
      const marks = [...this.garrisonMarks].map(i => this.city.buildings[i]);
      for (const h of this.hvts) if (h.state === 'inside' && !marks.includes(h.b)) marks.push(h.b);
      let budget = Math.ceil(idle.filter(u => u.kind === 'squad').length / 2) - this.units.filter(u => !u.dead && (u.inB || u.order?.type === 'garrison' || u.order?.type === 'extract') && !u.manual).length;
      for (const b of marks) {
        if (budget <= 0) break;
        if (b.destroyed || b.garrison.length || this.units.some(u => !u.dead && u.order?.b === b)) continue;
        const u = take(u => u.kind === 'squad' && u.men > 0 && u.ammo > 30, b.c); if (u) budget--; if (u) this.order(u, { type: this.hvts.some(h => h.b === b && h.state === 'inside') ? 'extract' : 'garrison', b });
      }
    }
    // clear infested buildings near units
    if (this.cmd.clear) {
      const inf = [...this.infested].filter(b => b.known && b.infest > 0.1 && !b.destroyed && this.city.unlockedAt(b.c[0], b.c[1]));
      inf.sort((a, b) => Math.hypot(a.c[0] - this.origin[0], a.c[1] - this.origin[1]) - Math.hypot(b.c[0] - this.origin[0], b.c[1] - this.origin[1]));
      for (const b of inf.slice(0, 6)) {
        if (this.units.some(u => !u.dead && u.order?.type === 'clear' && u.order.b === b)) continue;
        const u = take(u => u.kind === 'squad' && u.men >= 3 && u.ammo > 40, b.c); if (u) this.order(u, { type: 'clear', b });
      }
    }
    // hunt visible hostiles with whatever is still idle
    const free = this.creatures.filter(c => !c.inB && c.vis);
    if (free.length) for (const u of idle) {
      if (u.taken || u.kind === 'heli' || u.ammo < 30 || (u.kind === 'squad' && u.men < 2) || (u.kind === 'vehicle' && u.fire < 10)) continue;
      let best = null, bd = 700 * 700; for (const c of free) { const d = (c.x - u.x) ** 2 + (c.y - u.y) ** 2; if (d < bd) { bd = d; best = c; } }
      if (best && Math.sqrt(bd) > u.range * 0.7) { u.taken = true; this.order(u, { type: 'move', p: [best.x, best.y] }); }
    }
    // man quarantine checkpoints
    if (this.cmd.manCheckpoints) for (const cp of this.checkpoints.slice(0, 40)) {
      cp.guards = cp.guards.filter(u => !u.dead && u.order?.type === 'guard' && u.order.cp === cp);
      if (cp.guards.length || (cp.cars || []).length) continue; // the police hold this one
      const u = take(u => u.ammo > 20, cp.p); if (u) { this.order(u, { type: 'guard', p: cp.p, cp }); cp.guards.push(u); }
    }
  }
  updateServices(dt) {
    // police cars head to checkpoints / evacuation perimeter and park; ambulances shuttle casualties
    for (const c of this.cars) {
      if (c.kind === 'police' && c.cp) continue; // on the cordon
      if (c.kind === 'police' && !c.task && c.role === 'patrol') {
        // response car: drive towards the nearest hostile activity and stop short of it
        const tgt = this.nearestThreatTo(this.carPos(c));
        if (tgt) { const a = Math.atan2(c.y - tgt[1], c.x - tgt[0]) || 0; const g = [tgt[0] + Math.cos(a) * 70, tgt[1] + Math.sin(a) * 70]; const j = this.city.nearestJunction(g[0], g[1], j => j.in.length > 0, 200); if (j) { c.task = { field: this.fieldTo('j' + j.id, [j.id]), park: true, respond: true }; continue; } }
      }
      if (c.kind === 'police' && !c.task) {
        const targets = this.checkpoints.length ? this.checkpoints.filter(cp => cp.police < 2) : null;
        let goal;
        if (targets && targets.length) { const cp = targets[Math.floor(Math.random() * targets.length)]; cp.police++; goal = cp.b; }
        else { const z = this.evacZones[0]; const a = Math.random() * Math.PI * 2; goal = [z.c[0] + Math.cos(a) * (z.r + 60), z.c[1] + Math.sin(a) * (z.r + 60)]; }
        const j = this.city.nearestJunction(goal[0], goal[1], j => j.in.length > 0, 200); if (!j) continue;
        c.task = { field: this.fieldTo('j' + j.id, [j.id]), park: true };
      }
      if (c.kind === 'fire' && !c.task) { // fire engines go to burning and badly damaged buildings and stand by
        const b = [...(this.damaged || [])].find(b => !b.destroyed && b.hp < b.hp0 * 0.7 && !b.fireCrew) || [...this.infested].find(b => b.infest > 0.35 && !b.fireCrew && !b.destroyed);
        const goal = b ? b.ent : null; if (!goal) continue; b.fireCrew = true;
        const j = this.city.nearestJunction(goal[0], goal[1], j => j.in.length > 0, 200); if (!j) continue;
        c.task = { field: this.fieldTo('j' + j.id, [j.id]), park: true };
      }
      if (c.kind === 'ambulance' && !c.task) {
        const b = this.city.buildings.find(b => b.dead > 5 && !b.ambulance && this.city.unlockedAt(b.c[0], b.c[1]) && b.infest < 0.5);
        const h = this.hospitals[Math.floor(Math.random() * this.hospitals.length)];
        const goalB = b || h; if (!goalB) continue; if (b) b.ambulance = true;
        const j = this.city.nearestJunction(goalB.ent[0], goalB.ent[1], j => j.in.length > 0, 200); if (!j) continue;
        c.task = { field: this.fieldTo('j' + j.id, [j.id]), done: () => { if (b) { b.dead = 0; b.ambulance = false; } this.spawnCar(goalB.ent, 'ambulance'); } };
      }
    }
  }

  nearestThreatTo(p) {
    let best = null, bd = 1500 * 1500;
    for (const c of this.creatures) { if (c.inB) continue; const d = (c.x - p[0]) ** 2 + (c.y - p[1]) ** 2; if (d < bd) { bd = d; best = [c.x, c.y]; } }
    if (!best) for (const b of this.infested) { if (b.infest < 0.1) continue; const d = (b.c[0] - p[0]) ** 2 + (b.c[1] - p[1]) ** 2; if (d < bd) { bd = d; best = b.c; } }
    return best;
  }
  // Police officers: light small-arms fire at close range, can be overrun; their presence speeds up evacuation.
  updatePolice(dt) {
    const P = this.P, lost = [];
    this.policeGrid = new Grid(80);
    for (const c of this.cars) {
      if (c.kind !== 'police') continue;
      const p = this.carPos(c); c.x = p[0]; c.y = p[1]; this.policeGrid.add(c.x, c.y, c);
      c.hp ??= 140; c.cool = (c.cool || 0) - dt;
      if (c.cool <= 0) {
        let best = null, bd = 75 * 75;
        this.cGrid.near(c.x, c.y, 75, k => { if (k.hp <= 0) return; const d = (k.x - c.x) ** 2 + (k.y - c.y) ** 2; if (d < bd) { bd = d; best = k; } });
        if (best) { c.cool = 0.8; c.fireT = this.t; c.aimAt = [best.x, best.y]; best.hp -= 7 * (best.max > 300 ? 0.5 : 1); this.tracers.push({ a: [c.x, c.y, 1.3], b: [best.x, best.y, 1.2], t: 0.06, police: true }); if (best.hp <= 0) this.stats.kills++; }
      }
      this.cGrid.near(c.x, c.y, 6, k => { const K = k.K || P; if (k.hp > 0 && !K.ranged && Math.hypot(k.x - c.x, k.y - c.y) < Math.max(4, K.range + 1)) c.hp -= K.dmg * dt * 0.8; });
      if (c.hp <= 0) { lost.push(c); this.stats.policeLost += 2; const q = this.carPos(c), rs = this.P.convert > 0.2 ? [this.addRiser(q[0] + q[4] * 2.1, q[1] - q[3] * 2.1, { car: c, i: 0 }), this.addRiser(q[0] - q[4] * 2.1, q[1] + q[3] * 2.1, { car: c, i: 1 })] : null; this.fxPush({ k: 'police', car: c, risers: rs, pos: q }); }
    }
    if (lost.length) { const ls = new Set(lost); this.cars = this.cars.filter(c => !ls.has(c)); if (this.stats.policeLost % 6 === 2) this.log(`Police patrol overrun — ${this.stats.policeLost} officers lost so far.`, 'bad'); }
  }

  // ---------- HVTs ----------
  updateHVTs(dt) {
    for (const h of this.hvts) {
      if (h.state === 'escorted') { h.x = h.unit.x; h.y = h.unit.y; if (h.unit.dead) h.state = 'lost'; continue; }
      if (h.state !== 'inside') continue;
      const b = h.b;
      h.danger = Math.max(h.danger, b.infest);
      if (b.destroyed || b.infest > 0.6 && !b.garrison.length) { h.state = 'lost'; this.stats.hvtLost++; this.log(`HVT ${h.name} (${h.role}) has been killed.`, 'bad'); }
    }
  }

  // ---------- spread & unlock ----------
  checkSpread() {
    const C = this.city; let maxD = 0;
    for (const c of this.creatures) { const d = Math.hypot(c.x - this.origin[0], c.y - this.origin[1]); if (d > maxD) maxD = d; }
    for (const b of this.infested) if (b.infest > 0.1) { const d = Math.hypot(b.c[0] - this.origin[0], b.c[1] - this.origin[1]); if (d > maxD) maxD = d; }
    this.spreadR = maxD;
    return maxD > this.unlockR - 350;
  }

  // ---------- main step ----------
  // bodies that rise, grenades in flight and thrown, people bumping into each other, vehicles running people down
  stepFlavor(dt) {
    const t = this.t, C = this.city;
    for (const r of this.risers) if (!r.done && t >= r.t) {
      r.done = true; if (r.destroyed) continue;
      const c = this.spawnCreature(r.x, r.y); if (!c) continue;
      c.risen = r; c.riseT = t; c.biteT = t + 1.8; c.vis = true; c.think = 2; this.fxPush({ k: 'rise', c, r });
    }
    if (this.risers.length > 400) this.risers = this.risers.filter(r => !r.done);
    // grenades: squads lob one at a pack of hostiles 12–35 m away, every 20–30 s while they have them
    for (const u of this.units) {
      if (u.dead || u.kind !== 'squad' || u.inB || u.riding || u.nades <= 0 || u.men <= 0) continue;
      if ((u.nadeCool -= dt) > 0) continue; u.nadeCool = 1.5;
      let best = null, bn = 3;
      this.cGrid.near(u.x, u.y, 35, c => { if (best && bn > 7 || c.hp <= 0 || c.inB) return; const d = Math.hypot(c.x - u.x, c.y - u.y); if (d < 12 || d > 35) return; let n = 0; this.cGrid.near(c.x, c.y, 6, k => { if (k.hp > 0 && !k.inB && Math.hypot(k.x - c.x, k.y - c.y) < 6) n++; }); if (n > bn) { bn = n; best = c; } });
      if (!best || !C.bars.sight(u.x, u.y, best.x, best.y).clear) continue;
      u.nades--; u.nadeCool = 20 + Math.random() * 10;
      const i = Math.floor(Math.random() * u.men), tx = best.x + (Math.random() - .5) * 3, ty = best.y + (Math.random() - .5) * 3;
      this.nades.push({ x0: u.x, y0: u.y, x: tx, y: ty, t0: t, t1: t + 1.5, u }); this.fxPush({ k: 'throw', u, i, to: [tx, ty], t1: t + 1.5 });
    }
    this.nades = this.nades.filter(g => { if (t < g.t1) return true; this.explode(g.x, g.y, 7, 240, g.u); this.stats.supplyUsed += 0.3; return false; });
    // ---- collisions ----
    const rad = { lycan: 0.55, mutant: 0.8, swarm: 0.25 }[this.threat] || 0.36;
    const push = (o, dx, dy) => { const nx = o.x + dx, ny = o.y + dy; if (Math.abs(dx) + Math.abs(dy) < 1e-4 || C.bars.firstHit(o.x, o.y, nx, ny, nx, ny, true)) return; o.x = nx; o.y = ny; };
    for (const c of this.creatures) {
      if (c.inB || c.hp <= 0) continue;
      this.cGrid.near(c.x, c.y, rad * 2 + 0.1, k => { if (k === c || k.id < c.id || k.inB || k.hp <= 0) return; const dx = k.x - c.x, dy = k.y - c.y, d = Math.hypot(dx, dy), m = rad * 2 - d; if (m <= 0) return; const ux = d > 1e-3 ? dx / d : Math.random() - .5, uy = d > 1e-3 ? dy / d : Math.random() - .5, f = Math.min(m, 0.6) * 0.5; push(c, -ux * f, -uy * f); push(k, ux * f, uy * f); });
    }
    for (const p of this.peds) {
      if (p.dead) continue; const pr = p.people >= 4 ? 0.8 : 0.42;
      this.pedGrid.near(p.x, p.y, 1.7, q => { if (q === p || q.id < p.id || q.dead) return; const qr = q.people >= 4 ? 0.8 : 0.42, dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), m = pr + qr - d; if (m <= 0 || d < 1e-3) return; const f = Math.min(m, 0.4) * 0.5; push(p, -dx / d * f, -dy / d * f); push(q, dx / d * f, dy / d * f); });
    }
    // squads keep their spacing, vehicles shove past each other; hostiles and civilians get out of a vehicle's way or under it
    const live = this.units.filter(u => !u.dead && !u.inB && !u.riding && u.kind !== 'heli');
    for (let a = 0; a < live.length; a++) { const u = live[a], ru = u.kind === 'squad' ? 3.2 : 2.6;
      for (let b = a + 1; b < live.length; b++) { const w = live[b], rw = w.kind === 'squad' ? 3.2 : 2.6, dx = w.x - u.x, dy = w.y - u.y, d = Math.hypot(dx, dy), m = ru + rw - d; if (m <= 0 || d < 1e-3) continue; const f = Math.min(m, 1) * 0.25 * dt * 10; push(u, -dx / d * f, -dy / d * f); push(w, dx / d * f, dy / d * f); }
      const v = u.lx === undefined ? 0 : Math.hypot(u.x - u.lx, u.y - u.ly) / Math.max(dt, 1e-3); u.lx = u.x; u.ly = u.y; u.vel = v;
      if (u.kind !== 'vehicle') continue;
      this.cGrid.near(u.x, u.y, 3.2, c => { if (c.inB || c.hp <= 0) return; const dx = c.x - u.x, dy = c.y - u.y, d = Math.hypot(dx, dy); if (d > 2.9) return;
        if (v > 2.5 && dx * u.hx + dy * u.hy > 0) { c.hp -= 30 + v * 22; c.lastBy = 'crush'; c.hitT = t; if (c.hp > 0 && this.limbable && Math.random() < 0.4) this.loseLimb(c, 'crush'); this.fxPush({ k: 'runover', c, u }); }
        push(c, dx / (d || 1) * (2.9 - d) * 0.6, dy / (d || 1) * (2.9 - d) * 0.6); });
      if (v > 3) this.pedGrid.near(u.x, u.y, 3, p => { if (p.dead || Math.hypot(p.x - u.x, p.y - u.y) > 2.6) return; const dx = p.x - u.x, dy = p.y - u.y, d = Math.hypot(dx, dy) || 1; if (p._dodge === u || v < 5.5 || Math.random() > 0.3) { p._dodge = u; push(p, dx / d * (2.7 - d), dy / d * (2.7 - d)); return; } p.dead = true; this.stats.civDead += p.people * 0.5; this.fxPush({ k: 'ped', p, by: 'crush' }); if (!u.ai && t - (u.runLog || -99) > 30) { u.runLog = t; this.log(`${u.name} ran down civilians.`, 'bad'); } });
    }
    // traffic hits hostiles on the road
    this.trafT = (this.trafT || 0) - dt;
    if (this.trafT <= 0) { this.trafT = 0.25; for (const car of this.cars) { if (car.v < 4 || car.parked) continue; const q = this.carPos(car);
      this.cGrid.near(q[0], q[1], 2.4, c => { if (c.inB || c.hp <= 0 || Math.hypot(c.x - q[0], c.y - q[1]) > 2.2) return; c.hp -= 40 + car.v * 9; c.lastBy = 'crush'; c.hitT = t; if (c.hp > 0 && this.limbable && Math.random() < 0.3) this.loseLimb(c, 'crush'); car.v *= 0.35; this.fxPush({ k: 'runover', c, car }); }); } }
  }
  step(dt) {
    this.dtNow = dt; this.routeBudget = 28;
    this.t += dt; this.clock += dt * 1000 * 6; // compressed clock: 1 s of action = 6 s on the clock
    while (this.pending.length && this.clock >= this.pending[0].at) { const p = this.pending.shift(); const u = this.addUnit(p.f); this.log(`${u.name} arrived at staging ${p.f.approach}.`, 'good'); }
    this.zoneT -= dt; if (this.zoneT <= 0) { this.zoneT = 1; this.computeZone(); }
    this.updateEvacuation(dt);
    this.updateTraffic(dt);
    this.updatePeds(dt);
    if (this.rural) this.stepRural(dt);
    this.updateCreatures(dt);
    if (this.gas) this.stepHostiles(dt);
    this.stepInteriors(dt); this.stepCollapse();
    this.intelT -= dt; if (this.intelT <= 0) { this.intelT = 0.5; this.updateIntel(); }
    this.policeT = (this.policeT || 0) - dt; if (this.policeT <= 0) { this.policeT = 0.2; this.updatePolice(0.2); }
    this.updateUnits(dt);
    this.stepFlavor(dt);
    this.updateHVTs(dt);
    this.updateSafeZones(dt);
    this.tracers = this.tracers.filter(t => (t.t -= dt) > 0);
    this.cmdT = (this.cmdT || 0) - dt; if (this.cmdT <= 0) { this.cmdT = 2; this.updateCordon(); this.updateCommander(); this.updateServices(dt); }
    // infested buildings without creatures still count until cleared; creatures leaking out of a quarantine at unguarded checkpoints
    if (this.quarantine.size && Math.random() < dt) for (const cp of this.checkpoints) if (!cp.guards.length && !(cp.cars || []).some(c => c.parked)) this.cGrid.near(cp.p[0], cp.p[1], 25, c => { if (Math.random() < 0.05) { c.x = cp.b[0]; c.y = cp.b[1]; } });
  }
  dirty(b) { if (!b.colorDirty) { b.colorDirty = true; (this.dirtyB || (this.dirtyB = [])).push(b); } }
  outbreakCentre() {
    let x = 0, y = 0, n = 0;
    for (const c of this.creatures) if (c.vis || c.ghost) { x += c.x; y += c.y; n++; }
    for (const b of this.infested) if (b.known) { x += b.c[0] * 3; y += b.c[1] * 3; n += 3; }
    return n ? [x / n, y / n] : this.origin;
  }
  // Sensors: what the organisation actually knows. Helicopters see furthest; police patrols and civilian calls also report.
  updateIntel() {
    // Complete map view (no fog of war): every hostile and every infested building is visible.
    for (const c of this.creatures) { c.vis = true; c.ghost = false; }
    for (const b of this.infested) if (b.infest > 0.1 && !b.known) { b.known = true; this.dirty(b); }
    return;
    const now = this.t, night = this.isNight();
    const sense = (x, y, r) => {
      this.cGrid.near(x, y, r, c => { if ((c.x - x) ** 2 + (c.y - y) ** 2 < r * r) c.seen = now; });
      const rb = r * 0.45; this.city.bGrid.near(x, y, rb, i => { const b = this.city.buildings[i]; if (b.infest > 0.1 && !b.known && (b.c[0] - x) ** 2 + (b.c[1] - y) ** 2 < rb * rb) { b.known = true; this.dirty(b); } });
    };
    for (const u of this.units) {
      if (u.dead) continue;
      const nv = u.gear === 'nvg' || u.kind !== 'squad';
      const r = (u.kind === 'heli' ? 650 : u.kind === 'vehicle' ? 260 : u.inB ? 240 : 200) * (night && !nv ? 0.6 : 1);
      sense(u.x, u.y, r);
    }
    for (const c of this.cars) if (c.kind === 'police') { const p = this.city.edgePoint(c.e, c.dir, c.s); sense(p[0], p[1], 110); }
    for (const c of this.creatures) { c.vis = c.seen !== undefined && now - c.seen < 0.8; c.ghost = !c.vis && c.seen !== undefined && now - c.seen < 25; }
  }
  // Safe zones: open ground away from the outbreak where civilians on foot gather and HVTs are flown to.
  establishSafeZone(near) {
    const C = this.city, cand = [];
    const kinds = new Set(['park', 'grass', 'sports', 'parking'].map(k => C.codes.area.indexOf(k)));
    for (const a of C.areas) {
      if (!kinds.has(a.kind) || a.ring.length < 3) continue;
      let cx = 0, cy = 0; for (const p of a.ring) { cx += p[0]; cy += p[1]; } cx /= a.ring.length; cy /= a.ring.length;
      if (!C.unlockedAt(cx, cy)) continue;
      let ar = 0; for (let k = 0, j = a.ring.length - 1; k < a.ring.length; j = k++) ar += a.ring[j][0] * a.ring[k][1] - a.ring[k][0] * a.ring[j][1]; ar = Math.abs(ar / 2);
      const d = Math.hypot(cx - this.origin[0], cy - this.origin[1]);
      if (ar < 2500 || d < 480 || d > this.unlockR - 150) continue;
      if (this.sites.some(s => s.kind === 'safezone' && Math.hypot(s.p[0] - cx, s.p[1] - cy) < 500)) continue;
      cand.push({ p: [cx, cy], score: Math.hypot(cx - near[0], cy - near[1]) + Math.abs(d - 700) * 0.6 - Math.min(ar, 40000) * 0.004 });
    }
    cand.sort((a, b) => a.score - b.score);
    let p = cand[0]?.p;
    if (!p) { const dx = near[0] - this.origin[0], dy = near[1] - this.origin[1], l = Math.hypot(dx, dy) || 1; p = [this.origin[0] + dx / l * 700, this.origin[1] + dy / l * 700]; }
    const b = this.nearestBuilding(p[0], p[1], 400), dn = b ? C.districts[b.district]?.name : '';
    const z = { id: 'sz' + this.sites.length, kind: 'safezone', p, r: 85, stock: 0, built: 1, people: 0, name: `Safe zone ${['Alpha', 'Bravo', 'Charlie', 'Delta'][this.sites.filter(s => s.kind === 'safezone').length] || ''}${dn ? ' · ' + dn : ''}` };
    this.sites.push(z); this.refreshFields();
    this.log(`${z.name} designated. Civilians on foot are being directed there.`, 'good');
    return z;
  }
  updateSafeZones(dt) {
    if (!this.sites.some(s => s.kind === 'safezone') && this.units.some(u => !u.dead)) {
      const first = this.units.find(u => !u.dead); this.establishSafeZone([first.x, first.y]);
    }
    // civilians in a safe zone are bussed out over time
    for (const z of this.sites) if (z.kind === 'safezone' && z.people > 0) { const k = Math.min(z.people, dt * 4); z.people -= k; }
  }
  summary() {
    if (this.sumCache && this.t - this.sumT < 0.5) return this.sumCache;
    const C = this.city; if (!this.zoneList || this.zoneList.n !== C.buildings.length + ':' + this.unlockR) { this.zoneList = C.buildings.filter(b => C.unlockedAt(b.c[0], b.c[1])); this.zoneList.n = C.buildings.length + ':' + this.unlockR; }
    const zone = this.zoneList;
    const pop0 = zone.reduce((s, b) => s + b.pop0, 0) || 1, inside = zone.reduce((s, b) => s + b.occ, 0);
    const infested = [...this.infested].filter(b => b.infest > 0.1 && !b.destroyed).length, known = [...this.infested].filter(b => b.known && b.infest > 0.1 && !b.destroyed).length;
    const integrity = Math.max(0, 100 - (this.stats.civDead / pop0) * 400 - (this.stats.bDestroyed / Math.max(1, zone.length)) * 600 - infested / Math.max(1, zone.length) * 300);
    this.sumT = this.t; return (this.sumCache = { pop0, inside, infested, known, creatures: this.creatures.length, tracked: this.creatures.filter(c => c.vis).length, integrity, cars: this.cars.length, peds: this.peds.length });
  }
}
installHostiles(Sim);
installInterior(Sim);
installHelis(Sim);
