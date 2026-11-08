// Kinds of hostile within a threat, and the behaviour that sets them apart.
// Mutants: brutes (the rank and file), slitherers (fast masses of limbs and tentacles that drag victims away),
//   spitters (corrosive bile at range), bloaters (burst into a caustic cloud) and titans (rare building-height hulks
//   that smash cars, garden walls, buildings and light armour). New mutants keep crawling out of the emergence site.
// The swarm is a caste-based hive: drones grow resin over buildings and turn them into hives with egg-nests and
//   capture chambers; hunters carry people off alive to be cocooned (rescuable until they are digested into biomass);
//   warriors fight, and spend the hive's biomass to evolve into crushers (charge and crush), boilers (gas artillery)
//   and wardens (heavier warriors that guard the hives). Each caste can raise one Matriarch, a much larger and better
//   version; while she lives her caste is stronger, and killing her makes it falter.

export const KINDS = {
  mutant: {
    brute: { name: 'Brute', share: 0.55, hp: 420, speed: 3.0, dmg: 42, range: 2.6, size: 1.5, vault: 1.2, sense: 300, aggro: 70, bDmg: 6, stride: 1.9 },
    slither: { name: 'Slitherer', share: 0.24, hp: 170, speed: 6.2, dmg: 20, range: 2.2, size: 1.0, vault: 0.3, sense: 340, aggro: 90, bDmg: 1, drag: true, stride: 1.6 },
    spitter: { name: 'Spitter', share: 0.12, hp: 220, speed: 2.6, dmg: 20, range: 34, ranged: true, size: 1.3, vault: 1.0, sense: 360, aggro: 110, bDmg: 1, spit: true, stride: 1.5 },
    bloater: { name: 'Bloater', share: 0.07, hp: 320, speed: 1.5, dmg: 10, range: 3.5, size: 1.4, vault: 2.4, sense: 260, aggro: 60, bDmg: 2, burst: { r: 8, dmg: 70, gas: 14, dps: 9 }, stride: 1.0 },
    titan: { name: 'Titan', share: 0.02, hp: 5200, speed: 2.4, dmg: 170, range: 6, size: 3.6, vault: 0, sense: 420, aggro: 150, bDmg: 40, smash: true, max: 1, stride: 5.5 },
  },
  swarm: {
    drone: { name: 'Drone', caste: 'drone', share: 0.25, hp: 30, speed: 2.4, dmg: 3, range: 1.5, size: 0.7, vault: 0.6, sense: 220, aggro: 10, bDmg: 0, build: true, stride: 0.7 },
    hunter: { name: 'Hunter', caste: 'hunter', share: 0.3, hp: 55, speed: 6.4, dmg: 6, range: 1.8, size: 0.9, vault: 0.4, sense: 340, aggro: 22, capture: true, stride: 1.3 },
    warrior: { name: 'Warrior', caste: 'warrior', share: 0.45, hp: 110, speed: 3.8, dmg: 15, range: 2.0, size: 1.0, vault: 0.6, sense: 260, aggro: 90, stride: 1.2 },
    crusher: { name: 'Crusher', caste: 'crusher', evolved: 10, hp: 950, speed: 2.8, dmg: 65, range: 3.2, size: 2.2, vault: 0, sense: 300, aggro: 140, charge: { r: 45, v: 10, dmg: 150, dur: 3 }, stride: 2.2 },
    boiler: { name: 'Boiler', caste: 'boiler', evolved: 8, hp: 260, speed: 2.3, dmg: 6, range: 62, ranged: true, size: 1.6, vault: 0.8, sense: 340, aggro: 160, lob: { r: 8, dur: 12, dps: 7 }, stride: 1.4 },
    warden: { name: 'Warden', caste: 'warden', evolved: 6, hp: 480, speed: 3.6, dmg: 36, range: 2.4, size: 1.6, vault: 0.5, sense: 280, aggro: 110, guard: true, stride: 1.8 },
  },
};
export const CASTES = ['drone', 'hunter', 'warrior', 'crusher', 'boiler', 'warden'];
const M_MUL = { hp: 5, dmg: 2.5, speed: 0.9, size: 1.8, work: 4 };
const DIGEST = 120; // seconds before a cocooned captive is lost

const pickShare = (set, ok = () => true) => { const ks = Object.keys(set).filter(k => set[k].share && ok(k)); let r = Math.random() * ks.reduce((a, k) => a + set[k].share, 0); for (const k of ks) if ((r -= set[k].share) < 0) return k; return ks[0]; };

// profile of a creature: threat base, kind overrides, matriarch multipliers
export function profileOf(base, kind, M) {
  const k = kind ? { ...base, ...kind } : base;
  if (!M) return k;
  return { ...k, hp: k.hp * M_MUL.hp, dmg: k.dmg * M_MUL.dmg, speed: k.speed * M_MUL.speed, size: k.size * M_MUL.size, range: k.ranged ? k.range * 1.2 : k.range * 1.5, M: true };
}

export function installHostiles(Sim) {
  const S = Sim.prototype;

  S.kindSet = function () { return KINDS[this.threat] || null; };
  // give a fresh creature a kind (or a specific one)
  S.assignKind = function (c, kind = null, M = false) {
    const set = this.kindSet(); if (!set) return c;
    if (!kind) kind = this.threat === 'mutant' ? pickShare(set, k => k !== 'titan' || this.countKind('titan') < this.titanCap()) : pickShare(set);
    c.kind = kind; c.M = M; c.K = profileOf(this.P, set[kind], M); c.hp = c.max = c.K.hp; return c;
  };
  S.countKind = function (k, M) { let n = 0; for (const c of this.creatures) if (c.kind === k && c.hp > 0 && (M === undefined || !!c.M === M)) n++; return n; };
  S.titanCap = function () { return 1 + Math.floor(this.t / 900); };
  // work / damage multiplier for a caste: its Matriarch's presence, or her loss
  S.boost = function (c) {
    const H = this.hive; if (!H || !c.K?.caste) return 1;
    const cs = c.K.caste; if (H.matri[cs] && H.matri[cs].hp > 0) return 1.35;
    return this.t < (H.falter[cs] || 0) ? 0.6 : 1;
  };

  // ---------- setup ----------
  S.startHostiles = function (impactB) {
    this.gas = []; this.lobs = []; this.carWrecks = [];
    if (this.threat === 'mutant' && impactB) this.emerge = { b: impactB, next: 40, titanAt: 120 };
    if (this.threat === 'swarm') {
      this.hive = { biomass: 12, matri: {}, falter: {}, block: {}, checkT: 0, evoT: 30, hives: new Set() };
      if (impactB) { this.makeHive(impactB, 1); impactB.eggs = 1; }
    }
  };
  S.initialHostiles = function (impactB, sev) {
    const C = this.city, spawn = (k, n) => { for (let i = 0; i < Math.round(n * sev); i++) { const c = this.spawnCreature(impactB.ent[0] + (Math.random() - .5) * 20, impactB.ent[1] + (Math.random() - .5) * 20); if (c) this.assignKind(c, k); } };
    if (this.threat === 'mutant') { spawn('brute', 6); spawn('slither', 3); spawn('spitter', 2); spawn('bloater', 1); return true; }
    if (this.threat === 'swarm') { spawn('drone', 8); spawn('hunter', 10); spawn('warrior', 18); return true; }
    return false;
  };
  S.makeHive = function (b, lvl) {
    b.hive = Math.max(b.hive || 0, lvl); b.cocoons = b.cocoons || []; b.eggs = b.eggs || 0;
    b.infest = Math.max(b.infest, Math.min(1, 0.2 + b.hive * 0.7)); b.state = 1; b.known = b.known || b.hive > 0.5; this.infested.add(b); this.hive.hives.add(b); this.dirty(b);
  };

  // ---------- per-kind targeting (called when a creature thinks); return true if it chose its own target ----------
  S.kindThink = function (c) {
    const K = c.K; if (!K) return false; const C = this.city;
    // carrying a victim: take it home
    if (c.carry) {
      if (K.capture) { const h = this.nearestHive(c.x, c.y); if (h) { c.target = { kind: 'b', b: h, deposit: true }; c.path = null; return true; } c.carry = null; return false; }
      if (K.drag) { if (!c.target || c.target.kind !== 'b') { const b = this.nearestBuilding(c.x, c.y, 160, b => !b.garrison.length && !b.destroyed); if (b) { c.target = { kind: 'b', b, drag: true }; c.path = null; } else c.carry = null; } return true; }
    }
    if (K.build) { // drones: keep coating the hive, then spread it to the next building
      if (c.target?.kind === 'b' && !c.target.b.destroyed && (c.target.b.hive || 0) < 1 && Math.random() < 0.8) return true;
      const b = this.nextHiveSite(c); if (b) { c.target = { kind: 'b', b, build: true }; c.path = null; return true; }
      return false;
    }
    if (K.capture) { // hunters: people in the street first, then occupied buildings
      let best = null, bd = K.sense * K.sense;
      this.pedGrid.near(c.x, c.y, Math.min(K.sense, 160), p => { if (p.dead || p.captive) return; const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; best = p; } });
      if (best) { c.target = { kind: 'ped', p: best }; c.path = null; return true; }
      return false; // the generic search finds occupied buildings
    }
    if (K.guard) { // wardens stay with the hives and the Matriarchs unless the enemy is close
      if (c.target?.kind === 'u') return false;
      const H = this.hive, m = H && Object.values(H.matri).find(m => m && m.hp > 0 && !m.inB), h = m ? null : this.nearestHive(c.x, c.y);
      const p = m ? [m.x, m.y] : h ? h.ent : null;
      if (p && Math.hypot(p[0] - c.x, p[1] - c.y) > 50) { const a = Math.random() * 6.28; c.target = { kind: 'p', p: [p[0] + Math.cos(a) * 20, p[1] + Math.sin(a) * 20] }; c.path = null; return true; }
    }
    return false;
  };
  S.nearestHive = function (x, y) { let best = null, bd = Infinity; for (const b of this.hive?.hives || []) { if (b.destroyed || (b.hive || 0) < 0.5) continue; const d = (b.ent[0] - x) ** 2 + (b.ent[1] - y) ** 2; if (d < bd) { bd = d; best = b; } } return best; };
  S.nextHiveSite = function (c) {
    const C = this.city, H = this.hive; let best = null, bd = Infinity;
    for (const b of H.hives) { if (b.destroyed || (b.hive || 0) >= 1) continue; const d = (b.ent[0] - c.x) ** 2 + (b.ent[1] - c.y) ** 2; if (d < bd) { bd = d; best = b; } }
    if (best && Math.random() < 0.7) return best;
    // spread street to street: a building close to an existing hive
    const hs = [...H.hives].filter(b => !b.destroyed); if (!hs.length) return best;
    const from = hs[Math.floor(Math.random() * hs.length)]; let cand = null, cd = Infinity;
    C.bGrid.near(from.c[0], from.c[1], 70, i => { const b = C.buildings[i]; if (b.destroyed || b.hive || b.garrison.length || b.state === 2 && Math.random() < 0.6) return; const d = (b.c[0] - from.c[0]) ** 2 + (b.c[1] - from.c[1]) ** 2 + Math.random() * 400; if (d < cd) { cd = d; cand = b; } });
    return cand || best;
  };

  // ---------- inside a building ----------
  // return true if the kind handled the building itself (the generic code then skips killing occupants)
  S.kindInBuilding = function (c, b, dt) {
    const K = c.K; if (!K) return false; const H = this.hive;
    if (K.build) {
      const w = this.boost(c) * (c.M ? M_MUL.work : 1);
      const was = b.hive || 0; this.makeHive(b, Math.min(1, was + dt * 0.03 * w));
      if (was < 1 && b.hive >= 1) this.log(`The swarm has turned ${b.name || b.addr || 'a building'} into a hive.`, 'bad');
      if (b.hive >= 1 && (b.eggs || 0) < (c.M ? 3 : 2) && H.biomass >= (c.M ? 2 : 4) && Math.random() < dt * 0.1 * w) { H.biomass -= c.M ? 2 : 4; b.eggs = (b.eggs || 0) + 1; this.dirty(b); if (b.eggs === 1) this.log(`Egg-nests are growing in ${b.name || b.addr || 'a hive'}.`, 'bad'); }
      if (b.hive >= 1 && c.think <= 0) { this.leaveInterior(c); c.inB = null; c.x = b.ent[0]; c.y = b.ent[1]; c.target = null; c.think = 0.5 + Math.random(); }
      return true;
    }
    if (K.capture) { // take people out alive
      const cap = c.M ? 3 : 1;
      if (!c.carry && b.occ >= 1) { c.capT = (c.capT || 0) + dt * this.boost(c); if (c.capT > 3) { c.capT = 0; const n = Math.min(cap, Math.floor(b.occ)); b.occ -= n; c.carry = { n, seeds: Array.from({ length: n }, () => Math.random() * 1000) }; this.stats.captured = (this.stats.captured || 0) + n; } }
      if (c.carry || b.occ < 1) { this.leaveInterior(c); c.inB = null; c.x = b.ent[0]; c.y = b.ent[1]; c.target = null; c.think = 0; }
      return true;
    }
    if (K.drag && c.carry) { c.carry = null; this.leaveInterior(c); c.inB = null; c.x = b.ent[0]; c.y = b.ent[1]; c.target = null; c.think = 1; return true; }
    return false;
  };

  // ---------- arriving at a target ----------
  S.kindArrive = function (c, tg) {
    if (tg.deposit && c.carry) { // cocoon the captives
      const b = tg.b; b.cocoons = b.cocoons || []; for (let i = 0; i < c.carry.n; i++) b.cocoons.push({ t0: this.t, seed: c.carry.seeds[i] });
      c.carry = null; c.target = null; this.dirty(b); this.fxPush({ k: 'cocoon', b }); return true;
    }
    return false;
  };

  // a hunter or slitherer reaches someone in the street
  S.kindTouchPed = function (c, p) {
    const K = c.K; if (!K) return false;
    if (K.capture) {
      if (c.carry) return true;
      const n = Math.min(c.M ? 3 : 1, p.people); p.people -= n; if (p.people <= 0) { p.dead = true; p.captive = true; }
      c.carry = { n, seeds: Array.from({ length: n }, (_, i) => p.id + i * 0.37) }; this.stats.captured = (this.stats.captured || 0) + n; this.stats.evacuated -= n * 0.5;
      c.biteT = this.t + 0.8; c.target = null; c.think = 0; this.fxPush({ k: 'grab', c, p }); return true;
    }
    if (K.drag && !c.carry) {
      p.dead = true; this.stats.civDead += p.people * 0.5; this.stats.evacuated -= p.people * 0.5;
      c.carry = { drag: p }; c.biteT = this.t + 1; c.target = null; c.think = 0; this.fxPush({ k: 'ped', p, by: 'claw', a: c, drag: true }); return true;
    }
    return !!c.carry;
  };

  // ---------- attacks ----------
  // returns true if the kind made its own attack
  S.kindAttack = function (c, u, d, los) {
    const K = c.K; if (!K) return false; const b = this.boost(c);
    if (K.burst && d <= K.range + 1) { this.burst(c); return true; }
    if (K.lob) { const to = [u.x + (Math.random() - .5) * 6, u.y + (Math.random() - .5) * 6], fly = 1 + d / 40; this.lobs.push({ x: to[0], y: to[1], at: this.t + fly, r: K.lob.r * (c.M ? 1.6 : 1), dur: K.lob.dur, dps: K.lob.dps * b * (c.M ? 1.6 : 1), kind: 'gas' }); this.fxPush({ k: 'lob', from: [c.x, c.y], to, t1: this.t + fly, c }); c.atk = c.M ? 2.2 : 3.2; return true; }
    if (K.spit) { this.hurtUnit(u, K.dmg * b * (los ? los.cover : 1), null); this.fxPush({ k: 'spit', from: [c.x, c.y], to: [u.x, u.y], t1: this.t + d / 28, c }); return true; }
    if (K.smash) { // a titan's blow lands on everything around the target
      for (const w of this.units) { if (w.dead || w.inB || w.kind === 'heli') continue; const dd = Math.hypot(w.x - u.x, w.y - u.y); if (dd < 6) this.hurtUnit(w, K.dmg * (1 - dd / 9), c); }
      this.fxPush({ k: 'smash', x: u.x, y: u.y, c }); return true;
    }
    if (b !== 1) { this.hurtUnit(u, K.dmg * b, c); return true; }
    return false;
  };
  S.burst = function (c) {
    if (c.burst) return; c.burst = true; c.hp = 0; c.lastBy = 'burst';
    const B = c.K.burst, x = c.x, y = c.y;
    for (const u of this.units) { if (u.dead || u.inB || u.kind === 'heli') continue; const d = Math.hypot(u.x - x, u.y - y); if (d < B.r) this.hurtUnit(u, B.dmg * (1 - d / B.r * 0.6), null); }
    this.explode(x, y, B.r, B.dmg * 0.5, null);
    this.gas.push({ x, y, r: B.r * 1.1, t1: this.t + B.gas, dps: B.dps, kind: 'bile' });
    this.fxPush({ k: 'burst', x, y, r: B.r, c });
  };

  // ---------- the crusher's charge ----------
  S.chargeStep = function (c, dt) {
    const K = c.K, ch = c.charge; if (!ch) return false;
    if (this.t > ch.t1) { c.charge = null; c.chargeCD = this.t + 8; return false; }
    const s = K.charge.v * (c.M ? 1.3 : 1) * dt, nx = c.x + ch.dx * s, ny = c.y + ch.dy * s, B = this.city.bars;
    if (B) { B.owKey = (B.owKey || 0) + 1; const hit = B.firstHit(c.x, c.y, nx, ny, nx, ny, true);
      if (hit) { if (hit.s && B.breakable(hit.s, { veh: true, armour: 2 })) B.breakAt(hit.s, nx, ny); else { c.charge = null; c.chargeCD = this.t + 8; c.biteT = this.t + 1.6; if (hit.wall) { this.damageBuilding(hit.wall.b, 300); this.hitBuildingAt(hit.wall.b, nx, ny, (hit.wall.b.z || 0) + 1.5, c.M ? 160 : 90); } this.fxPush({ k: 'smash', x: c.x, y: c.y, c, small: true }); return true; } } }
    c.x = nx; c.y = ny; c.hx = ch.dx; c.hy = ch.dy;
    const dm = K.charge.dmg * this.boost(c) * (c.M ? 1.8 : 1);
    for (const u of this.units) { if (u.dead || u.inB || u.kind === 'heli' || ch.hit.has(u)) continue; if (Math.hypot(u.x - c.x, u.y - c.y) < (c.M ? 4.5 : 3.2)) { ch.hit.add(u); this.hurtUnit(u, dm, c); if (u.kind === 'vehicle') { u.crash = 1.2; ch.t1 = Math.min(ch.t1, this.t + 0.2); } } }
    this.pedGrid.near(c.x, c.y, 3, p => { if (!p.dead && Math.hypot(p.x - c.x, p.y - c.y) < 2.6) { p.dead = true; this.stats.civDead += p.people * 0.5; this.stats.evacuated -= p.people * 0.5; this.fxPush({ k: 'ped', p, by: 'crush' }); } });
    return true;
  };
  S.maybeCharge = function (c, u, d) {
    const K = c.K; if (!K.charge || c.charge || this.t < (c.chargeCD || 0) || d > K.charge.r || d < 8) return false;
    const dx = (u.x - c.x) / d, dy = (u.y - c.y) / d; c.charge = { dx, dy, t1: this.t + Math.min(K.charge.dur, d / K.charge.v + 0.6), hit: new Set() };
    this.fxPush({ k: 'charge', c }); return true;
  };

  // ---------- titans walk through things ----------
  S.titanStep = function (c, dt) {
    // cars in the way are crushed
    for (const car of this.cars) { if (car._smashed) continue; const q = this.carPos(car); if (Math.hypot(q[0] - c.x, q[1] - c.y) < 4.5) { car._smashed = true; this.carWrecks.push({ car, x: q[0], y: q[1], h: Math.atan2(q[4], q[3]), t: this.t }); if (car.kind === 'police') { this.stats.policeLost += 2; this.fxPush({ k: 'police', car, risers: null, pos: q }); } else this.stats.civDead += car.people || 1; this.fxPush({ k: 'carSmash', x: q[0], y: q[1] }); } }
    if (this.cars.some(c => c._smashed)) this.cars = this.cars.filter(c => !c._smashed);
  };

  // ---------- once a step ----------
  S.stepHostiles = function (dt) {
    const t = this.t;
    // gas and bile clouds
    for (const L of this.lobs) if (t >= L.at && !L.done) { L.done = true; this.gas.push({ x: L.x, y: L.y, r: L.r, t1: t + L.dur, dps: L.dps, kind: L.kind }); this.fxPush({ k: 'gasHit', x: L.x, y: L.y, r: L.r }); }
    if (this.lobs.length > 40) this.lobs = this.lobs.filter(L => !L.done);
    this.gas = this.gas.filter(g => t < g.t1);
    for (const g of this.gas) {
      const k = Math.min(1, (g.t1 - t) / 4);
      for (const u of this.units) { if (u.dead || u.inB || u.kind === 'heli') continue; if (Math.hypot(u.x - g.x, u.y - g.y) < g.r) this.hurtUnit(u, g.dps * k * dt * (u.gear === 'nrbc' ? 0.25 : u.kind === 'vehicle' ? 0.05 : 1) * 3, null); }
      if (Math.random() < dt * 2) this.pedGrid.near(g.x, g.y, g.r, p => { if (!p.dead && Math.random() < 0.15 && Math.hypot(p.x - g.x, p.y - g.y) < g.r) { p.dead = true; this.stats.civDead += p.people * 0.5; this.stats.evacuated -= p.people * 0.5; this.fxPush({ k: 'ped', p, by: 'gas' }); } });
    }
    // mutants keep emerging from the site of the accident until it is cleared
    const E = this.emerge;
    if (E && !this.rural) {
      const live = E.b.infest > 0.1 && !E.b.destroyed;
      if (live && t > E.titanAt && this.countKind('titan') < this.titanCap()) { E.titanAt = t + 600 + Math.random() * 300; const c = this.spawnCreature(E.b.ent[0], E.b.ent[1]); if (c) { this.assignKind(c, 'titan'); this.log(`Something enormous is tearing its way out of ${E.b.name || E.b.addr || 'the emergence site'}.`, 'bad'); this.fxPush({ k: 'emerge', c, titan: true }); } }
      if (live && t > E.next) { E.next = t + 30 + Math.random() * 20; if (this.creatures.length < 80) { const c = this.spawnCreature(E.b.ent[0] + (Math.random() - .5) * 8, E.b.ent[1] + (Math.random() - .5) * 8); if (c) { this.assignKind(c); if (c.kind === 'titan') this.assignKind(c, 'brute'); this.fxPush({ k: 'emerge', c }); } } }
    }
    if (this.hive) this.stepHive(dt);
  };

  S.stepHive = function (dt) {
    const H = this.hive, t = this.t;
    for (const b of H.hives) {
      if (b.destroyed) { if (b.cocoons?.length) { this.stats.civDead += b.cocoons.length; this.log(`${b.cocoons.length} cocooned civilians died when ${b.name || b.addr || 'the hive'} collapsed.`, 'bad'); b.cocoons = []; } H.hives.delete(b); continue; }
      // captives are digested into biomass
      if (b.cocoons?.length) { const keep = []; for (const k of b.cocoons) { if (t - k.t0 > DIGEST) { H.biomass += 1.5; this.stats.civDead += 1; this.stats.captured = Math.max(0, (this.stats.captured || 0) - 1); } else keep.push(k); } if (keep.length !== b.cocoons.length) { b.cocoons = keep; this.dirty(b); } }
      // egg-nests hatch new members when there is biomass
      if (b.eggs > 0 && (b.hive || 0) >= 1) { b.eggT = (b.eggT || 0) + dt * b.eggs; if (b.eggT > 18) { b.eggT = 0; if (H.biomass >= 1 && this.creatures.length < 700) { H.biomass -= 1; const c = this.spawnCreature(b.ent[0] + (Math.random() - .5) * 4, b.ent[1] + (Math.random() - .5) * 4); if (c) { this.assignKind(c, this.neededCaste()); c.biteT = t + 2; this.fxPush({ k: 'hatch', c, b }); } } } }
    }
    // evolution and Matriarchs, every few seconds
    H.evoT -= dt; if (H.evoT > 0) return; H.evoT = 4;
    const vehicles = this.units.filter(u => !u.dead && !u.ai && u.kind === 'vehicle').length, squads = this.units.filter(u => !u.dead && u.kind === 'squad').length;
    for (const c of this.creatures) {
      if (c.kind !== 'warrior' || c.M || c.hp <= 0 || c.inB || c.biteT > t) continue;
      const h = this.nearestHive(c.x, c.y); if (!h || Math.hypot(h.ent[0] - c.x, h.ent[1] - c.y) > 150) continue;
      const w = { crusher: 1 + vehicles * 1.2, boiler: 1 + squads * 0.6 + this.countKind('warden') * 0.2, warden: 1.5 + (H.matri.warrior ? 1 : 0) };
      let r = Math.random() * (w.crusher + w.boiler + w.warden), to = 'warden'; for (const k of ['crusher', 'boiler', 'warden']) if ((r -= w[k]) < 0) { to = k; break; }
      const cost = KINDS.swarm[to].evolved; if (H.biomass < cost || Math.random() > 0.25) continue;
      H.biomass -= cost; this.evolve(c, to); break;
    }
    // a caste large enough raises its Matriarch
    for (const cs of CASTES) {
      if (H.matri[cs] && H.matri[cs].hp > 0) continue;
      if (H.matri[cs] && H.matri[cs].hp <= 0) { H.matri[cs] = null; }
      if (t < (H.block[cs] || 0) || H.biomass < 20) continue;
      const pool = this.creatures.filter(c => c.kind === cs && !c.M && c.hp > 0 && !c.inB);
      if (pool.length < (KINDS.swarm[cs].evolved ? 2 : 6)) continue;
      const c = pool[Math.floor(Math.random() * pool.length)]; H.biomass -= 20;
      this.assignKind(c, cs, true); H.matri[cs] = c; c.biteT = t + 6; this.fxPush({ k: 'molt', c, M: true });
      this.log(`A ${KINDS.swarm[cs].name} Matriarch has emerged — her caste grows stronger while she lives.`, 'bad');
    }
  };
  S.neededCaste = function () {
    const n = { drone: 0, hunter: 0, warrior: 0 }; for (const c of this.creatures) if (n[c.kind] !== undefined) n[c.kind]++;
    const tot = n.drone + n.hunter + n.warrior + 1, want = { drone: 0.25, hunter: 0.3, warrior: 0.45 };
    let best = 'warrior', gap = -Infinity; for (const k in want) { const g = want[k] - n[k] / tot; if (g > gap) { gap = g; best = k; } } return best;
  };
  S.evolve = function (c, to) {
    const f = c.hp / c.max; this.fxPush({ k: 'molt', c, from: c.kind }); this.assignKind(c, to); c.hp = c.max * Math.max(0.5, f); c.biteT = this.t + 5;
    if (!this.hive.logged?.[to]) { (this.hive.logged || (this.hive.logged = {}))[to] = true; this.log(`Warriors are moulting into ${KINDS.swarm[to].name.toLowerCase()}s, feeding on what the hive has gathered.`, 'bad'); }
  };
  // a creature dies: bloaters burst, Matriarchs leave their caste faltering, carried captives go free
  S.kindDeath = function (c) {
    if (c.K?.burst && !c.burst) this.burst(c);
    if (c.carry && c.K?.capture) { this.spawnPed([c.x, c.y], c.carry.n); this.stats.captured = Math.max(0, (this.stats.captured || 0) - c.carry.n); this.stats.rescued = (this.stats.rescued || 0) + c.carry.n; c.carry = null; }
    if (c.M && this.hive) { const cs = c.K.caste; this.hive.matri[cs] = null; this.hive.falter[cs] = this.t + 300; this.hive.block[cs] = this.t + 600; this.log(`${KINDS.swarm[cs].name} Matriarch killed — her caste falters.`, 'good'); }
    if (c.kind === 'titan') this.log('A titan is down.', 'good');
  };
  // clearing a hive by force frees anyone still cocooned and burns out the resin and the eggs
  S.clearHive = function (b) {
    if (!b.hive) return;
    const n = b.cocoons?.length || 0;
    if (n) { for (let i = 0; i < n; i += 4) this.spawnPed([b.ent[0] + (Math.random() - .5) * 4, b.ent[1] + (Math.random() - .5) * 4], Math.min(4, n - i)); this.stats.evacuated += n; this.stats.rescued = (this.stats.rescued || 0) + n; this.stats.captured = Math.max(0, (this.stats.captured || 0) - n); this.log(`${n} cocooned civilians cut free from ${b.name || b.addr || 'the hive'}.`, 'good'); }
    b.cocoons = []; b.eggs = 0; b.hive = 0; this.hive?.hives.delete(b); this.fxPush({ k: 'hiveBurn', b }); this.dirty(b);
  };
  S.hiveSummary = function () {
    const H = this.hive; if (!H) return null;
    let hives = 0, cocooned = 0, eggs = 0; for (const b of H.hives) { if (b.destroyed) continue; if ((b.hive || 0) >= 1) hives++; cocooned += b.cocoons?.length || 0; eggs += b.eggs || 0; }
    for (const c of this.creatures) if (c.carry?.n) cocooned += 0;
    return { hives, cocooned, eggs, biomass: Math.round(H.biomass), matriarchs: CASTES.filter(cs => H.matri[cs] && H.matri[cs].hp > 0).map(cs => KINDS.swarm[cs].name) };
  };
}
