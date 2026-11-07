// City-layer simulation: evacuation & traffic, ambient police/medical, HVTs, threat creatures, player forces,
// combat, supply, quarantine cordons, the AI ground commander and spread-driven map unlocking.
import { FLAG, Grid, Heap } from './city.js';
import { ITEM } from '../catalog.js';

export const TH = { // per-threat creature profiles
  undead: { hp: 110, speed: 1.4, dmg: 9, range: 1.8, aggro: 45, convert: 0.35, bDmg: 0.2, nest: 0, size: 1, sense: 260 },
  mutant: { hp: 520, speed: 3.2, dmg: 45, range: 2.5, aggro: 70, convert: 0, bDmg: 6, nest: 0, size: 2.2, sense: 300 },
  alien: { hp: 180, speed: 2.4, dmg: 14, range: 55, aggro: 120, convert: 0.05, bDmg: 1.5, nest: 0.02, size: 1.3, sense: 400, ranged: true },
  vampire: { hp: 240, speed: 4.2, dmg: 26, range: 2, aggro: 80, convert: 0.12, bDmg: 0.3, nest: 0, size: 1.2, sense: 350, night: true },
  lycan: { hp: 300, speed: 5.5, dmg: 32, range: 2.2, aggro: 90, convert: 0.06, bDmg: 0.8, nest: 0, size: 1.6, sense: 350 },
  swarm: { hp: 18, speed: 3.0, dmg: 4, range: 1.5, aggro: 35, convert: 0, bDmg: 0.4, nest: 0.12, size: 0.55, sense: 220 },
};
const FIRST = ['Claire', 'Julien', 'Nathalie', 'Marc', 'Isabelle', 'Thomas', 'Sophie', 'Laurent', 'Camille', 'Antoine', 'Hélène', 'Pierre', 'Élodie', 'François', 'Amélie', 'Nicolas', 'Inès', 'Yann', 'Léa', 'Karim'];
const LAST = ['Muller', 'Schmitt', 'Meyer', 'Klein', 'Weber', 'Wagner', 'Roth', 'Hoffmann', 'Fischer', 'Bernard', 'Lefèvre', 'Moreau', 'Laurent', 'Girard', 'Fournier', 'Haddad', 'Keller', 'Zimmermann', 'Durand', 'Petit'];

export class Sim {
  constructor(city, opts) {
    this.city = city; this.o = opts; this.t = 0; this.clock = opts.clock; this.threat = opts.threat; this.P = TH[opts.threat];
    this.cars = []; this.peds = []; this.creatures = []; this.units = []; this.sites = []; this.hvts = []; this.tracers = []; this.events = []; this.junctionBusy = new Map();
    this.stats = { evacuated: 0, civDead: 0, soldiersKIA: 0, vehiclesLost: 0, kills: 0, specimens: 0, hvtSaved: 0, hvtLost: 0, bDestroyed: 0, supplyUsed: 0 };
    this.supply = opts.supply ?? 120; this.cmd = { garrisonKey: true, manCheckpoints: true, resupply: true, clear: true };
    this.cid = 0; this.uid = 0; this.cGrid = new Grid(40); this.pedGrid = new Grid(30);
    this.pending = []; this.infested = new Set(); this.intelT = 0; this.zoneT = 0; this.sumT = -1;
    this.evacZones = []; this.quarantine = new Set(); this.checkpoints = []; this.garrisonMarks = new Set(); this.unlockR = opts.unlockR;
  }
  log(text, kind = 'info') { this.events.unshift({ t: this.clock, text, kind }); if (this.events.length > 60) this.events.pop(); }
  hour() { return new Date(this.clock).getUTCHours() + 1; }
  isNight() { const h = (this.hour() + 24) % 24; return h < 7 || h >= 19; }

  // ---------- setup ----------
  start(impactB, forces, stagingDirs) {
    const C = this.city; this.impact = impactB; this.origin = impactB.c;
    impactB.infest = 0.4; impactB.state = 1; impactB.known = true; this.infested.add(impactB);
    const n = Math.round({ undead: 30, mutant: 7, alien: 14, vampire: 10, lycan: 8, swarm: 80 }[this.threat] * (this.o.severity || 1));
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
  stagingPoint(dir) {
    const a = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(dir) * Math.PI / 4;
    const x = this.origin[0] + Math.sin(a) * (this.unlockR - 250), y = this.origin[1] + Math.cos(a) * (this.unlockR - 250);
    const j = this.city.nearestJunction(x, y, j => j.out.length && j.in.length && this.city.unlockedAt(j.p[0], j.p[1]), 600);
    return j ? [j.p[0], j.p[1]] : [x, y];
  }
  pickHVTs() {
    const C = this.city, U = C.use;
    const roles = [[U.civic, ['Préfet', 'Deputy', 'Mayor', 'Councillor'], 'politician'], [U.university, ['Professor', 'Dr.'], 'scientist'], [U.hospital, ['Dr.', 'Chief virologist'], 'scientist'], [U.military, ['General', 'Colonel'], 'military'], [U.office, ['Director', 'CEO'], 'executive'], [U.police, ['Commissaire'], 'police']];
    const have = new Set(this.hvts.map(h => h.b.idx));
    for (const [use, titles, role] of roles) {
      const cands = C.buildings.filter(b => b.use === use && C.unlockedAt(b.c[0], b.c[1]) && !have.has(b.idx) && b.occ > 0).sort(() => Math.random() - .5);
      const k = role === 'executive' ? 3 : role === 'politician' ? 3 : 2;
      for (const b of cands.slice(0, k)) {
        const name = `${titles[Math.floor(Math.random() * titles.length)]} ${FIRST[Math.floor(Math.random() * FIRST.length)]} ${LAST[Math.floor(Math.random() * LAST.length)]}`;
        this.hvts.push({ id: 'h' + this.hvts.length, name, role, b, state: 'inside', danger: 0, unit: null, x: b.ent[0], y: b.ent[1] }); have.add(b.idx); b.hvt = true;
      }
    }
  }
  spawnServices() {
    const C = this.city, police = C.buildings.filter(b => b.use === C.use.police && C.unlockedAt(b.c[0], b.c[1]));
    const hospitals = C.buildings.filter(b => (b.use === C.use.hospital) && C.unlockedAt(b.c[0], b.c[1]) && b.area > 600);
    this.policeStations = police; this.hospitals = hospitals;
    for (const p of police) for (let i = 0; i < 10; i++) this.spawnCar(p.ent, 'police');
    // municipal + national police patrols already on the streets across the area
    const area = Math.PI * this.unlockR * this.unlockR / 1e6, n = Math.round(area * 4);
    const js = [...C.junctions.values()].filter(j => j.out.length && C.unlockedAt(j.p[0], j.p[1]));
    for (let i = 0; i < n && js.length; i++) { const j = js[Math.floor(Math.random() * js.length)]; const c = this.spawnCar(j.p, 'police'); if (c) c.role = i % 2 === 0 ? 'patrol' : null; }
    this.stats.policeLost = 0;
    for (const h of hospitals.slice(0, 6)) for (let i = 0; i < 2; i++) this.spawnCar(h.ent, 'ambulance');
  }

  // ---------- routing fields ----------
  refreshFields() {
    const C = this.city; if (C.graphDirty) C.buildGraph(); C.nearestJunction(0, 0, null, 1);
    // evacuation targets: drivable junctions in loaded-but-locked tiles, or at the edge of the loaded network
    const exitsD = [], exitsW = [];
    for (const j of C.junctions.values()) {
      const locked = !C.unlockedAt(j.p[0], j.p[1]);
      const boundary = (j.inc || []).some(([e]) => { const E = C.edges.get(e); return !E || !C.junctions.has(E.a) || !C.junctions.has(E.b); });
      if ((locked || boundary) && !this.inQuarantineXY(j.p[0], j.p[1])) { if (j.in.length) exitsD.push(j.id); if (j.walk.length) exitsW.push(j.id); }
    }
    for (const z of this.sites) if (z.kind === 'safezone') C.jGrid?.near(z.p[0], z.p[1], z.r + 40, j => { if (j.walk.length && Math.hypot(j.p[0] - z.p[0], j.p[1] - z.p[1]) < z.r + 40) exitsW.push(j.id); });
    this.evacD = C.driveField(exitsD, e => this.edgeBlocked(e));
    this.evacW = C.walkField(exitsW);
    this.fieldCache = new Map();
  }
  edgeBlocked(e) { return false; }
  fieldTo(key, targets, walk) { let f = this.fieldCache.get(key); if (!f) { f = walk ? this.city.walkField(targets) : this.city.driveField(targets); this.fieldCache.set(key, f); } return f; }
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
        const vmax = Math.min(e.speed / 3.6 * (emerg ? 1.25 : 1), emerg ? 22 : 16) * (c.kind === 'civ' && this.zoneB && this.inZoneEdge(e) ? 0.8 : 1);
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
      const opts = J.out.filter(o => !(o.e === c.e && o.dir === -c.dir)); if (!opts.length) return J.out[0] ? { e: J.out[0].e, dir: J.out[0].dir } : null;
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
    const n = c.next; if (n) { const tl = this.laneMap?.get(n.e.id * 4 + (n.dir === 1 ? 0 : 2) + ':' + (n.toLane || 0)); if (tl && tl.length && tl[tl.length - 1].s < 5.5) return false; }
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
    this.creatures.push(c); return c;
  }
  updateCreatures(dt) {
    const C = this.city, P = this.P, night = this.isNight();
    const nightMul = P.night ? (night ? 1.35 : 0.55) : 1;
    this.cGrid.clear();
    for (const c of this.creatures) if (!c.inB) this.cGrid.add(c.x, c.y, c);
    for (const c of this.creatures) {
      if (c.hp <= 0) continue;
      c.think -= dt; c.atk -= dt;
      if (c.inB) { // inside a building: infest it, kill or convert occupants, damage it
        const b = c.inB;
        b.infest = Math.min(1, b.infest + dt * 0.02 * nightMul); b.state = 1; this.dirty(b); if (b.infest > 0.1) this.infested.add(b);
        if (b.occ > 0) {
          const k = Math.min(b.occ, dt * 1.2 * nightMul * (b.garrison.length ? 0.2 : 1));
          b.occ -= k; b.dead += k; this.stats.civDead += k; if (b.dead > 3 && !b.known) { b.known = true; this.dirty(b); this.log(`Emergency calls from ${b.name || b.addr || 'a building'}: attack in progress.`, 'bad'); } b.convAcc = (b.convAcc || 0) + k * P.convert;
          while (b.convAcc >= 1) { b.convAcc--; this.spawnCreature(b.ent[0], b.ent[1], b); }
        }
        if (P.nest && Math.random() < P.nest * dt) this.spawnCreature(b.ent[0], b.ent[1], null);
        if (P.bDmg) this.damageBuilding(b, P.bDmg * dt * 10);
        if (b.garrison.length) { for (const u of b.garrison) this.hurtUnit(u, P.dmg * dt * 0.3); }
        if ((b.occ <= 0.5 && b.infest >= 0.95 && c.think <= 0) || (P.night && !night && false)) { c.inB = null; c.x = b.ent[0]; c.y = b.ent[1]; c.target = null; c.think = 1 + Math.random() * 3; }
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
        let enemy = null, ed = P.aggro * P.aggro;
        for (const u of this.units) { if (u.dead || u.inB || u.kind === 'heli') continue; const d = (u.x - c.x) ** 2 + (u.y - c.y) ** 2; if (d < ed) { ed = d; enemy = u; } }
        if (!enemy && this.policeGrid) this.policeGrid.near(c.x, c.y, P.aggro, pc => { const d = (pc.x - c.x) ** 2 + (pc.y - c.y) ** 2; if (d < ed) { ed = d; enemy = null; c.target = { kind: 'p', p: [pc.x, pc.y] }; c.path = null; } });
        if (enemy) c.target = { kind: 'u', u: enemy };
        else if (!c.target || c.target.kind !== 'b' || c.target.b.occ <= 0.5) {
          let best = null, bd = Infinity;
          C.bGrid.near(c.x, c.y, P.sense, i => { const b = C.buildings[i]; if (b.occ < 1 || !C.unlockedAt(b.c[0], b.c[1]) && Math.random() < 0.7) return; const d = (b.c[0] - c.x) ** 2 + (b.c[1] - c.y) ** 2 - b.occ * 40 + (b.garrison.length ? 1e5 : 0); if (d < bd) { bd = d; best = b; } });
          for (const z of this.sites) if (z.kind === 'safezone' && z.people > 30) { const d = (z.p[0] - c.x) ** 2 + (z.p[1] - c.y) ** 2 - z.people * 60; if (d < bd && d < P.sense * P.sense * 2) { bd = d; best = null; c.target = { kind: 'z', z }; c.path = null; } }
          if (best) { c.target = { kind: 'b', b: best }; c.path = null; }
          else if (!c.target) { const a = Math.random() * Math.PI * 2; c.target = { kind: 'p', p: [c.x + Math.cos(a) * 200, c.y + Math.sin(a) * 200] }; c.path = null; }
        }
      }
      // civilians on foot nearby
      if (Math.random() < dt * 2) this.pedGrid.near(c.x, c.y, 3, p => { if (!p.dead && Math.hypot(p.x - c.x, p.y - c.y) < 2.5) { p.dead = true; this.stats.civDead += p.people * 0.5; this.stats.evacuated -= p.people * 0.5; if (P.convert > 0.2) this.spawnCreature(p.x, p.y); } });
      // move / attack
      const tg = c.target; if (!tg) continue;
      let tx, ty;
      if (tg.kind === 'u') { if (tg.u.dead || tg.u.inB) { c.target = null; continue; } tx = tg.u.x; ty = tg.u.y; }
      else if (tg.kind === 'b') { tx = tg.b.ent[0]; ty = tg.b.ent[1]; }
      else if (tg.kind === 'z') { tx = tg.z.p[0]; ty = tg.z.p[1]; if (Math.hypot(tx - c.x, ty - c.y) < tg.z.r * 0.6) { if (c.atk <= 0 && tg.z.people > 0) { c.atk = 1; const k = Math.min(tg.z.people, P.dmg * 0.15); tg.z.people -= k; this.stats.civDead += k; this.stats.evacuated -= k; if (P.convert > 0.2 && Math.random() < 0.3) this.spawnCreature(c.x, c.y); } if (tg.z.people <= 0) c.target = null; continue; } }
      else { tx = tg.p[0]; ty = tg.p[1]; }
      const d = Math.hypot(tx - c.x, ty - c.y);
      if (tg.kind === 'u' && d <= P.range + 1) {
        if (c.atk <= 0) { c.atk = 1; this.hurtUnit(tg.u, P.dmg * nightMul); if (P.ranged) this.tracers.push({ a: [c.x, c.y, 2], b: [tx, ty, 1.5], t: 0.12, enemy: true }); }
        continue;
      }
      if (tg.kind === 'b' && d < 3) {
        const b = tg.b;
        if (b.garrison.length) { if (c.atk <= 0) { c.atk = 1; this.damageBuilding(b, P.dmg * 2); for (const u of b.garrison) this.hurtUnit(u, P.dmg * 0.25); } continue; }
        c.inB = b; c.target = null; c.path = null; b.state = 1; continue;
      }
      if (tg.kind === 'p' && d < 4) { c.target = null; continue; }
      this.stepAlongPath(c, tx, ty, P.speed * nightMul * dt, true);
    }
    // remove dead
    const before = this.creatures.length;
    this.creatures = this.creatures.filter(c => c.hp > 0);
    // buildings with no creatures inside slowly lose infestation status only when cleared by force (see clearing)
  }
  stepAlongPath(o, tx, ty, step, walk) {
    // follow a cached walk-graph path for longer trips, straight line for the last stretch
    const far = Math.hypot(tx - o.x, ty - o.y) > 60;
    if (far && (!o.path || o.pathT !== tx + ',' + ty)) { o.path = this.walkPath([o.x, o.y], [tx, ty], walk === false || o.kind === 'vehicle'); o.pathT = tx + ',' + ty; }
    let gx = tx, gy = ty;
    if (far && o.path && o.path.length) { gx = o.path[0][0]; gy = o.path[0][1]; if (Math.hypot(gx - o.x, gy - o.y) < Math.max(2, step)) { o.path.shift(); } }
    const dx = gx - o.x, dy = gy - o.y, d = Math.hypot(dx, dy) || 1;
    const s = Math.min(step, d); o.x += dx / d * s; o.y += dy / d * s; o.hx = dx / d; o.hy = dy / d;
  }
  walkPath(a, b, drive = false) {
    const C = this.city;
    const filt = drive ? (j => j.out.length + j.in.length > 0) : (j => j.walk.length > 0);
    const s = C.nearestJunction(a[0], a[1], filt, 400), t = C.nearestJunction(b[0], b[1], filt, 400);
    if (!s || !t || s === t) return [];
    const open = new Heap(), g = new Map([[s.id, 0]]), prev = new Map(); open.push(0, s.id); let n = 0;
    const tp = t.p;
    while (open.size && n++ < 25000) {
      const [, id] = open.pop(); if (id === t.id) break;
      const J = C.junctions.get(id); if (!J) continue;
      const nb = drive ? [...J.out.map(o => o.e), ...J.in.map(o => o.e)] : J.walk;
      for (const e of nb) {
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
    if (b.hp <= 0) return; b.hp -= d; this.dirty(b); (this.damaged || (this.damaged = new Set())).add(b);
    if (b.hp <= 0) { b.hp = 0; b.destroyed = true; this.stats.bDestroyed++; const k = b.occ * 0.6; b.occ -= k; b.dead += k; this.stats.civDead += k; for (const u of b.garrison.slice()) this.ungarrison(u); if (this.stats.bDestroyed % 5 === 1) this.log(`Building collapsed: ${b.name || b.addr || 'block'}.`, 'bad'); }
  }

  // ---------- player forces ----------
  addUnit(f) {
    const it = f.vehicle ? ITEM[f.vehicle] : null, kind = it ? (it.cat === 'heli' ? 'heli' : 'vehicle') : 'squad';
    const base = this.staging[f.approach] || Object.values(this.staging)[0];
    const fire = it ? it.power * 7 : Object.entries(f.items).reduce((s, [id, q]) => s + ((ITEM[id]?.power || 0) * q), 0) * 1.6 / Math.max(1, f.pers);
    const range = it ? (it.power >= 9 ? 400 : it.power >= 4 ? 250 : 0) : Math.min(300, Math.max(120, ...Object.keys(f.items).map(id => ITEM[id]?.range || 0)));
    const vest = (f.items.vest || 0) >= f.pers ? 0.35 : 0;
    const gear = f.items.nrbc ? 'nrbc' : f.items.nvg ? 'nvg' : null;
    const armor = it ? ({ None: 0, Light: 0.5, Medium: 0.7, Heavy: 0.88 })[it.armor] : vest;
    const hp = it ? ({ None: 160, Light: 450, Medium: 800, Heavy: 1600 })[it.armor] : 100;
    const u = {
      id: ++this.uid, ref: f.id, name: f.name, kind, vehicle: f.vehicle || null, pers: f.pers, men: kind === 'squad' ? f.pers : f.pers, hp: kind === 'squad' ? f.pers * 100 : hp, maxHp: kind === 'squad' ? f.pers * 100 : hp,
      fire, range, armor, speed: it ? Math.min(it.speed, 70) / 3.6 * (kind === 'heli' ? 1.6 : 1) : 3.2, motor: !it && !!f.carrier, carrier: f.carrier || null, riding: false, pax: it?.pax || 0, ammo: 100, gear,
      x: base[0] + (Math.random() - .5) * 40, y: base[1] + (Math.random() - .5) * 40, hx: 1, hy: 0, order: null, manual: false, inB: null, path: null, cool: 0, hvt: null, carrying: [], approach: f.approach, kills: 0, dead: false,
    };
    this.units.push(u); return u;
  }
  hurtUnit(u, dmg) {
    if (u.dead) return;
    const gearBonus = u.gear && this.P && ((this.threat === 'undead' || this.threat === 'swarm' || this.threat === 'mutant') && u.gear === 'nrbc' || (this.threat === 'vampire' || this.threat === 'alien') && u.gear === 'nvg') ? 0.75 : 1;
    const d = dmg * (1 - u.armor) * gearBonus * (u.inB ? 0.45 : 1);
    u.hp -= d;
    if (u.kind === 'squad') { const men = Math.ceil(u.hp / 100); if (men < u.men) { this.stats.soldiersKIA += u.men - Math.max(0, men); u.men = Math.max(0, men); } }
    if (u.hp <= 0) {
      u.dead = true; u.men = 0; if (u.kind !== 'squad') { this.stats.vehiclesLost++; this.stats.soldiersKIA += u.pers; }
      if (u.inB) this.ungarrison(u);
      for (const h of u.carrying) { h.state = 'lost'; this.stats.hvtLost++; this.log(`HVT ${h.name} killed with ${u.name}.`, 'bad'); }
      this.log(`${u.name} destroyed.`, 'bad');
    }
  }
  order(u, ord) { u.order = ord; u.path = null; u.manual = !!ord.manual; if (u.inB && ord.type !== 'garrison') this.ungarrison(u); }
  ungarrison(u) { const b = u.inB; if (!b) return; b.garrison = b.garrison.filter(x => x !== u); this.dirty(b); u.inB = null; u.x = b.ent[0] + (Math.random() - .5) * 6; u.y = b.ent[1] + (Math.random() - .5) * 6; }
  updateUnits(dt) {
    const C = this.city;
    for (const u of this.units) {
      if (u.dead) continue;
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
            if (u.kind === 'heli') { const dx = tx - u.x, dy = ty - u.y; const s = Math.min(d, u.speed * dt); u.x += dx / d * s; u.y += dy / d * s; u.hx = dx / d; u.hy = dy / d; }
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
        let best = null, bd = r * r;
        this.cGrid.near(u.x, u.y, r, c => { if (c.hp <= 0 || !c.vis) return; const d = (c.x - u.x) ** 2 + (c.y - u.y) ** 2; if (d < bd) { bd = d; best = c; } });
        if (best) {
          const dps = u.fire * (u.kind === 'squad' ? u.men : 1);
          u.cool = 0.5;
          const dist = Math.sqrt(bd), acc = Math.max(0.35, 1 - dist / (r * 1.6));
          best.hp -= dps * 0.5 * acc * (best.max > 300 && u.kind === 'squad' ? 0.6 : 1);
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
      const b = o.b; const inside = this.creatures.filter(c => c.inB === b);
      const dps = u.fire * (u.kind === 'squad' ? u.men : 1) * 0.5;
      if (u.cool <= 0 && u.ammo > 0) {
        u.cool = 0.5; u.ammo -= 0.35;
        if (inside.length) { const c = inside[0]; c.hp -= dps * 1.2; if (c.hp <= 0) { this.stats.kills++; u.kills++; } this.hurtUnit(u, this.P.dmg * 0.4 * Math.min(4, inside.length)); }
        else { b.infest = Math.max(0, b.infest - 0.06); if (b.infest <= 0) { b.state = 2; this.infested.delete(b); this.dirty(b); this.stats.specimens += 1; this.log(`${u.name} cleared ${b.name || b.addr || 'a building'} — samples taken.`, 'good'); u.order = this.garrisonMarks.has(b.idx) ? { type: 'garrison', b } : null; } }
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
    const idle = this.units.filter(u => !u.dead && !u.manual && !u.inB && (!u.order || u.order.type === 'guard') && u.kind !== 'heli');
    const take = (filter, near) => { let best = null, bd = Infinity; for (const u of idle) { if (u.taken || !filter(u)) continue; const d = Math.hypot(u.x - near[0], u.y - near[1]); if (d < bd) { bd = d; best = u; } } if (best) best.taken = true; return best; };
    idle.forEach(u => u.taken = false);
    // resupply first
    if (this.cmd.resupply) for (const u of this.units) if (!u.dead && !u.manual && u.ammo < 25 && u.order?.type !== 'resupply' && !u.inB) { const s = this.nearestSite(u.x, u.y, s => s.stock > 0); if (s) { this.order(u, { type: 'resupply', site: s }); u.taken = true; } }
    // guard safe zones first: civilians gather there
    for (const z of this.sites) if (z.kind === 'safezone' && z.built) {
      z.guards = (z.guards || []).filter(u => !u.dead && u.order?.type === 'guard' && u.order.zone === z);
      if (!z.guards.length) { const u = take(u => u.kind !== 'heli' && u.ammo > 25 && (u.kind !== 'squad' || u.men >= 2), z.p); if (u) { this.order(u, { type: 'guard', p: z.p, zone: z }); z.guards.push(u); this.log(`${u.name} securing ${z.name}.`); } }
    }
    // helicopters: extract HVTs that can still be reached, otherwise fly reconnaissance over the outbreak
    for (const h of this.units) {
      if (h.dead || h.kind !== 'heli' || h.manual || (h.order && h.order.type !== 'recon')) continue;
      const hv = h.pax > 0 && this.hvts.find(v => v.state === 'inside' && !v.b.infest && !this.units.some(u => !u.dead && u.order?.b === v.b));
      if (hv) { this.order(h, { type: 'extract', b: hv.b }); this.log(`${h.name} flying to extract ${hv.name}.`); }
      else if (!h.order) this.order(h, { type: 'recon', c: this.outbreakCentre(), r: 380, a: Math.random() * 6.28 });
      else h.order.c = this.outbreakCentre();
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
        const u = take(u => (u.kind === 'squad' && u.men >= 3 || u.kind === 'vehicle' && u.fire > 20) && u.ammo > 40, b.c); if (u) this.order(u, { type: 'clear', b });
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
      if (cp.guards.length) continue;
      const u = take(u => u.ammo > 20, cp.p); if (u) { this.order(u, { type: 'guard', p: cp.p, cp }); cp.guards.push(u); }
    }
  }
  updateServices(dt) {
    // police cars head to checkpoints / evacuation perimeter and park; ambulances shuttle casualties
    for (const c of this.cars) {
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
        if (best) { c.cool = 0.8; best.hp -= 7 * (best.max > 300 ? 0.5 : 1); this.tracers.push({ a: [c.x, c.y, 1.3], b: [best.x, best.y, 1.2], t: 0.06, police: true }); if (best.hp <= 0) this.stats.kills++; }
      }
      this.cGrid.near(c.x, c.y, Math.max(4, P.range + 1), k => { if (k.hp > 0 && Math.hypot(k.x - c.x, k.y - c.y) < Math.max(4, P.range + 1)) c.hp -= P.dmg * dt * 0.8; });
      if (c.hp <= 0) { lost.push(c); this.stats.policeLost += 2; }
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
  step(dt) {
    this.t += dt; this.clock += dt * 1000 * 6; // compressed clock: 1 s of action = 6 s on the clock
    while (this.pending.length && this.clock >= this.pending[0].at) { const p = this.pending.shift(); const u = this.addUnit(p.f); this.log(`${u.name} arrived at staging ${p.f.approach}.`, 'good'); }
    this.zoneT -= dt; if (this.zoneT <= 0) { this.zoneT = 1; this.computeZone(); }
    this.updateEvacuation(dt);
    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updateCreatures(dt);
    this.intelT -= dt; if (this.intelT <= 0) { this.intelT = 0.5; this.updateIntel(); }
    this.policeT = (this.policeT || 0) - dt; if (this.policeT <= 0) { this.policeT = 0.2; this.updatePolice(0.2); }
    this.updateUnits(dt);
    this.updateHVTs(dt);
    this.updateSafeZones(dt);
    this.tracers = this.tracers.filter(t => (t.t -= dt) > 0);
    this.cmdT = (this.cmdT || 0) - dt; if (this.cmdT <= 0) { this.cmdT = 2; this.updateCommander(); this.updateServices(dt); }
    // infested buildings without creatures still count until cleared; creatures leaking out of a quarantine at unguarded checkpoints
    if (this.quarantine.size && Math.random() < dt) for (const cp of this.checkpoints) if (!cp.guards.length) this.cGrid.near(cp.p[0], cp.p[1], 25, c => { if (Math.random() < 0.05) { c.x = cp.b[0]; c.y = cp.b[1]; } });
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
