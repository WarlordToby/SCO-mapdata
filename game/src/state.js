import { packFor } from './packs.js';
import { ITEM, isVehicle, isHeli, STARTING_STOCK, GARRISON_STOCK, BASE_SIZES, MODULES, TEMPLATES, THREATS, DISTRICTS } from './catalog.js';
import { VERSION, SAVE_FORMAT, migrate } from './version.js';
import { byCcn3, territoryOf, citiesOf, distKm, bearing, compass, interp } from './geo.js';

export const HOUR = 3600e3, DAY = 24 * HOUR;
export const START_T = Date.UTC(2026, 10, 7, 7, 0); // 08:00 CET
let S = null;
export const getS = () => S;
export const setS = s => { S = s; hydrate(); };
const uid = p => p + Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// Derived (non-saved) geography
export const GEO = { country: null, terr: null };
function hydrate() {
  GEO.country = byCcn3(S.ccn3);
  GEO.terr = territoryOf(GEO.country);
}

export function newGame({ ccn3, orgName, acronym, badge }) {
  const country = byCcn3(ccn3), m = country.meta;
  const terr = territoryOf(country);
  const cities = citiesOf(m.cca2, terr).map(c => ({ ...c, integrity: 100, panic: Math.round(rnd(2, 8) + (c.capital ? 3 : 0)), status: 'normal', surveyed: false }));
  // Surveyed cities: a compiled 3D map pack is bundled with the game (buildings, roads, traffic model)
  for (const c of cities) c.surveyed = !!packFor(m.cca2, c.name);
  const grant = clamp((m.gdp || 5e10) * 1.4e-5, 2e6, 120e6);
  S = {
    v: 1, saveFormat: SAVE_FORMAT, gameVersion: VERSION, createdWith: VERSION, ccn3, t: START_T, speed: 0,
    org: { name: orgName, acronym, badge, founded: START_T },
    nation: { name: m.name, cca2: m.cca2, pop: m.pop, gdp: m.gdp, capital: m.capital, flag: m.flag, popYear: m.popYear, gdpYear: m.gdpYear, region: m.sub || m.region },
    funds: grant * 2, grant, standing: 50, trust: 50,
    cities, bases: [], units: [], groups: [], deliveries: [], transfers: [], recruits: [], incidents: [],
    specimens: [], log: [], ledger: [], needsHQ: true, setupLeft: 3,
    nextIncident: START_T + rnd(2.6, 3.6) * DAY, month: new Date(START_T).getUTCMonth(),
  };
  hydrate();
  log('info', `${orgName} chartered by the government of ${m.name}. Place your three charter bases: headquarters first, then two regional garrisons.`);
  return S;
}

export function log(kind, text) { S.log.unshift({ t: S.t, kind, text }); if (S.log.length > 200) S.log.pop(); }

// ---------- Bases ----------
export function baseCaps(b) {
  const n = k => b.modules.filter(m => m.type === k && m.done).length;
  return { pers: 20 + n('barracks') * 160, inf: 60 + n('armory') * 1200, ground: 2 + n('motorpool') * 32, heli: n('helipad') * 4 + n('hangar') * 12, comms: n('comms') > 0, lab: n('lab') > 0 };
}
export function baseUsage(b) {
  const u = { pers: b.personnel, inf: 0, ground: 0, heli: 0 };
  const add = (id, q) => { if (!ITEM[id]) return; if (isHeli(id)) u.heli += q; else if (isVehicle(id)) u.ground += q; else u.inf += q; };
  for (const [id, q] of Object.entries(b.storage)) add(id, q);
  for (const un of S.units.filter(x => x.baseId === b.id)) { u.pers += un.pers; for (const [id, q] of Object.entries(un.items)) add(id, q); }
  for (const d of S.deliveries.filter(x => x.baseId === b.id)) add(d.item, d.qty);
  for (const tr of S.transfers.filter(x => x.to === b.id)) for (const [id, q] of Object.entries(tr.items)) add(id, q);
  u.pers += S.recruits.filter(r => r.baseId === b.id).reduce((a, r) => a + r.n, 0);
  return u;
}
export function spaceFor(b, id, q) {
  const c = baseCaps(b), u = baseUsage(b);
  if (isHeli(id)) return u.heli + q <= c.heli ? null : `Not enough helicopter bays (${u.heli}/${c.heli}). Build a Helipad or Hangar.`;
  if (isVehicle(id)) return u.ground + q <= c.ground ? null : `Not enough vehicle bays (${u.ground}/${c.ground}). Build a Motor Pool.`;
  return u.inf + q <= c.inf ? null : `Not enough storage (${u.inf}/${c.inf}). Build an Armory.`;
}

export function canPlaceBase(lonlat) {
  if (!GEO.terr || !d3contains(GEO.terr, lonlat)) return 'Must be inside national territory.';
  const near = S.bases.find(b => distKm([b.lon, b.lat], lonlat) < 30);
  if (near) return `Too close to ${near.name} (min. 30 km).`;
  return null;
}
import { d3 } from './geo.js';
const d3contains = (f, p) => d3.geoContains(f, p);

export function nearestCity(lonlat) {
  let best = null, bd = 1e9;
  for (const c of S.cities) { const d = distKm([c.lon, c.lat], lonlat); if (d < bd) { bd = d; best = c; } }
  return { city: best, km: bd };
}

export function placeBase(lonlat, size, name) {
  const err = canPlaceBase(lonlat); if (err) return err;
  const setup = S.needsHQ, setupIdx = setup ? 3 - (S.setupLeft ?? 1) : -1, isHQ = setupIdx === 0;
  if (setup && !isHQ) size = 'garrison';
  const spec = BASE_SIZES[isHQ ? 'hq' : size];
  if (!setup && S.funds < spec.cost) return 'Insufficient funds.';
  const { city } = nearestCity(lonlat);
  const b = {
    id: uid('b'), name: name || `${isHQ ? 'HQ' : spec.name} ${city ? city.name : ''}`.trim(), size: isHQ ? 'hq' : size,
    lon: lonlat[0], lat: lonlat[1], personnel: 0, storage: {}, modules: [],
    doneAt: setup ? S.t : S.t + spec.days * DAY, built: setup,
  };
  if (isHQ) {
    b.modules = ['barracks', 'barracks', 'armory', 'motorpool', 'motorpool', 'helipad'].map(type => ({ id: uid('m'), type, done: true }));
    b.personnel = 64; b.storage = { ...STARTING_STOCK };
    S.setupLeft = 2;
    S.bases.push(b);
    const g = { id: uid('g'), name: 'Contingency Group Alpha', unitIds: [] };
    S.groups.push(g);
    // Pre-formed starter units
    const mk = (tpl, name, items, gear) => { const r = formUnit(b.id, tpl, items, gear, name); if (typeof r !== 'string') g.unitIds.push(r.id); };
    mk('rifle', '1st Rifle Squad', { famas: 6, aa52: 1, mas4956: 1 }, { vest: 8 });
    mk('rifle', '2nd Rifle Squad', { famas: 6, aa52: 1, mas4956: 1 }, { vest: 8 });
    mk('response', 'Response Team 1', { mat49: 6 }, { nrbc: 6 });
    mk('vehicle', 'VAB 1', { vab: 1 }, {});
    mk('vehicle', 'VAB 2', { vab: 1 }, {});
    mk('vehicle', 'TRM Transport 1', { trm2000: 1 }, {});
    mk('vehicle', 'Alouette 1', { alouette3: 1 }, {});
    log('good', `Headquarters established near ${city?.name || 'the capital'}. Contingency Group Alpha formed.`);
  } else if (setup) {
    // Two regional garrisons granted with the charter, each with its own contingency group
    const L = ['Bravo', 'Charlie'][setupIdx - 1] || 'Delta';
    b.modules = ['barracks', 'armory', 'motorpool', 'helipad'].map(type => ({ id: uid('m'), type, done: true }));
    b.personnel = 40; b.storage = { ...GARRISON_STOCK };
    S.bases.push(b);
    const g = { id: uid('g'), name: `Contingency Group ${L}`, unitIds: [] };
    S.groups.push(g);
    const mk = (tpl, name, items, gear) => { const r = formUnit(b.id, tpl, items, gear, name); if (typeof r !== 'string') g.unitIds.push(r.id); };
    mk('rifle', `${L} Rifle Squad`, { famas: 6, aa52: 1, mas4956: 1 }, { vest: 8 });
    mk('response', `${L} Response Team`, { mat49: 6 }, { nrbc: 6 });
    mk('vehicle', `${L} VAB`, { vab: 1 }, {});
    mk('vehicle', `${L} TRM Transport`, { trm2000: 1 }, {});
    mk('vehicle', `Alouette ${setupIdx + 1}`, { alouette3: 1 }, {});
    S.setupLeft--; if (S.setupLeft <= 0) { S.needsHQ = false; log('good', 'All three charter bases are operational. Strategic command is live.'); }
    log('good', `${b.name} established near ${city?.name || ''}. Contingency Group ${L} formed.`);
  } else {
    S.funds -= spec.cost; ledger(-spec.cost, `Construction: ${b.name}`);
    S.bases.push(b);
    log('info', `Construction of ${b.name} begun. Ready in ${spec.days} days.`);
  }
  return b;
}

export function buildModule(baseId, type) {
  const b = S.bases.find(x => x.id === baseId), m = MODULES[type];
  if (b.modules.length >= BASE_SIZES[b.size].slots) return 'No free module slots.';
  if (S.funds < m.cost) return 'Insufficient funds.';
  S.funds -= m.cost; ledger(-m.cost, `${m.name} at ${b.name}`);
  const start = Math.max(S.t, b.doneAt);
  b.modules.push({ id: uid('m'), type, done: false, doneAt: start + m.days * DAY });
  log('info', `${m.name} construction started at ${b.name}.`);
  return null;
}

export function recruit(baseId, n) {
  const b = S.bases.find(x => x.id === baseId);
  const c = baseCaps(b), u = baseUsage(b);
  if (u.pers + n > c.pers) return `Barracks full (${u.pers}/${c.pers}).`;
  const cost = n * 8000; if (S.funds < cost) return 'Insufficient funds.';
  S.funds -= cost; ledger(-cost, `Recruitment ×${n} at ${b.name}`);
  S.recruits.push({ baseId, n, at: S.t + 3 * DAY });
  return null;
}

export function order(itemId, qty, baseId) {
  const it = ITEM[itemId], b = S.bases.find(x => x.id === baseId);
  if (S.standing < it.standing) return `Requires government standing ${it.standing}.`;
  const cost = it.cost * qty; if (S.funds < cost) return 'Insufficient funds.';
  const sp = spaceFor(b, itemId, qty); if (sp) return sp;
  S.funds -= cost; ledger(-cost, `Procurement: ${qty}× ${it.name}`);
  S.deliveries.push({ id: uid('d'), item: itemId, qty, baseId, at: S.t + it.lead * DAY });
  log('info', `Ordered ${qty}× ${it.name} for ${b.name}. Delivery in ${it.lead} days.`);
  return null;
}

export function transfer(fromId, toId, items) {
  const a = S.bases.find(x => x.id === fromId), b = S.bases.find(x => x.id === toId);
  for (const [id, q] of Object.entries(items)) { if ((a.storage[id] || 0) < q) return `Not enough ${ITEM[id].name}.`; const sp = spaceFor(b, id, q); if (sp) return sp; }
  for (const [id, q] of Object.entries(items)) { a.storage[id] -= q; if (!a.storage[id]) delete a.storage[id]; }
  const km = distKm([a.lon, a.lat], [b.lon, b.lat]) * 1.3;
  S.transfers.push({ id: uid('t'), from: fromId, to: toId, items, dep: S.t, at: S.t + (4 + km / 60) * HOUR });
  log('info', `Convoy from ${a.name} to ${b.name} departed (${Math.round(km)} km).`);
  return null;
}

// ---------- Units ----------
export function formUnit(baseId, tpl, items, gear, name) {
  const b = S.bases.find(x => x.id === baseId), T = TEMPLATES[tpl];
  const all = { ...items }; for (const [k, v] of Object.entries(gear || {})) all[k] = (all[k] || 0) + v;
  for (const [id, q] of Object.entries(all)) if ((b.storage[id] || 0) < q) return `Not enough ${ITEM[id].name} in storage.`;
  let pers = T.pers;
  if (tpl === 'vehicle') { const vid = Object.keys(items)[0]; if (!vid) return 'Select a vehicle.'; pers = ITEM[vid].crew; }
  if (b.personnel < pers) return `Not enough unassigned personnel (${b.personnel}/${pers}).`;
  for (const [id, q] of Object.entries(all)) { b.storage[id] -= q; if (!b.storage[id]) delete b.storage[id]; }
  b.personnel -= pers;
  const vid = tpl === 'vehicle' ? Object.keys(items)[0] : null;
  const n = S.units.filter(u => u.tpl === tpl).length + 1;
  const u = { id: uid('u'), name: name || (vid ? `${ITEM[vid].name} ${n}` : `${T.name} ${n}`), tpl, baseId, pers, maxPers: pers, items: all, vehicle: vid, status: 'ready', lon: b.lon, lat: b.lat };
  S.units.push(u);
  return u;
}
export function disband(unitId) {
  const u = S.units.find(x => x.id === unitId); if (u.status !== 'ready') return 'Unit is not at base.';
  const b = S.bases.find(x => x.id === u.baseId);
  for (const [id, q] of Object.entries(u.items)) b.storage[id] = (b.storage[id] || 0) + q;
  b.personnel += u.pers;
  S.units = S.units.filter(x => x !== u);
  S.groups.forEach(g => g.unitIds = g.unitIds.filter(i => i !== unitId));
  return null;
}
export function unitStats(u) {
  let fire = 0, prot = 0;
  for (const [id, q] of Object.entries(u.items)) { const it = ITEM[id]; if (!it) continue; fire += (it.power || 0) * q; }
  if (u.vehicle) { const v = ITEM[u.vehicle]; prot = { None: 0, Light: 3, Medium: 6, Heavy: 10 }[v.armor]; }
  else prot = Math.round(((u.items.vest || 0) / Math.max(1, u.pers)) * 5);
  const speed = u.vehicle ? ITEM[u.vehicle].speed : 5;
  return { fire: Math.round(fire * (u.pers / Math.max(1, u.maxPers))), prot, speed };
}

// ---------- Dispatch ----------
export function planDispatch(incident, unitIds, approach) {
  const city = S.cities.find(c => c.id === incident.cityId);
  const units = unitIds.map(id => S.units.find(u => u.id === id)).filter(u => u && u.status === 'ready');
  const plans = [];
  const byBase = {};
  units.forEach(u => (byBase[u.baseId] = byBase[u.baseId] || []).push(u));
  for (const [bid, us] of Object.entries(byBase)) {
    const b = S.bases.find(x => x.id === bid);
    const mob = baseCaps(b).comms ? 1 : 2;
    const km = distKm([b.lon, b.lat], [city.lon, city.lat]);
    const natural = compass(bearing([city.lon, city.lat], [b.lon, b.lat]));
    const dir = approach || natural;
    const detour = dirDiff(natural, dir) * 9; // km of extra driving around the city
    const helis = us.filter(u => u.vehicle && isHeli(u.vehicle)).map(u => ({ u, cap: ITEM[u.vehicle].pax }));
    const ground = us.filter(u => u.vehicle && !isHeli(u.vehicle)).map(u => ({ u, cap: ITEM[u.vehicle].pax }));
    const inf = us.filter(u => !u.vehicle).sort((a, b) => b.pers - a.pers);
    for (const u of us.filter(x => x.vehicle)) {
      const air = isHeli(u.vehicle);
      const d = air ? km : km * 1.3 + detour;
      plans.push({ u, base: b, mode: air ? 'air' : 'road', km: d, eta: (mob + d / (air ? ITEM[u.vehicle].speed : Math.min(80, ITEM[u.vehicle].speed))) * HOUR, carrier: null, dir });
    }
    for (const u of inf) {
      const c = helis.find(h => h.cap >= u.pers) || ground.find(g => g.cap >= u.pers);
      if (c) {
        c.cap -= u.pers; const air = isHeli(c.u.vehicle);
        const d = air ? km : km * 1.3 + detour;
        plans.push({ u, base: b, mode: air ? 'air' : 'road', km: d, eta: (mob + d / (air ? ITEM[c.u.vehicle].speed : Math.min(80, ITEM[c.u.vehicle].speed))) * HOUR, carrier: c.u.name, dir });
      } else {
        const d = km * 1.3 + detour;
        plans.push({ u, base: b, mode: 'coach', km: d, eta: (mob + 2 + d / 70) * HOUR, carrier: 'Requisitioned coach (+2 h)', dir });
      }
    }
  }
  return plans;
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function dirDiff(a, b) { const d = Math.abs(DIRS.indexOf(a) - DIRS.indexOf(b)); return Math.min(d, 8 - d); }
export function stagingPoint(city, dir) {
  const a = DIRS.indexOf(dir) * 45 * Math.PI / 180, r = 0.07;
  return [city.lon + Math.sin(a) * r / Math.cos(city.lat * Math.PI / 180), city.lat + Math.cos(a) * r];
}

export function dispatch(incidentId, unitIds, approach) {
  const inc = S.incidents.find(i => i.id === incidentId), city = S.cities.find(c => c.id === inc.cityId);
  const plans = planDispatch(inc, unitIds, approach);
  for (const p of plans) {
    const to = stagingPoint(city, p.dir);
    Object.assign(p.u, { carrier: p.mode === 'coach' ? 'coach' : (p.carrier || null), status: 'transit', incidentId, route: { from: [p.base.lon, p.base.lat], to, dep: S.t, arr: S.t + p.eta, mode: p.mode }, approach: p.dir });
    if (!inc.units.includes(p.u.id)) inc.units.push(p.u.id);
  }
  if (plans.length) { inc.phase = inc.phase === 'alert' ? 'responding' : inc.phase; log('info', `${plans.length} unit(s) dispatched to ${city.name}.`); }
  return plans;
}

// ---------- Incidents ----------
function spawnIncident() {
  let pool = S.cities.filter(c => c.surveyed && c.status === 'normal');
  // countries without a city map still get outbreaks in their largest cities (resolved on the strategic layer)
  if (!S.cities.some(c => c.surveyed)) pool = [...S.cities].sort((a, b) => b.pop - a.pop).slice(0, 5).filter(c => c.status === 'normal');
  if (!pool.length) return;
  const city = pool[Math.floor(Math.random() * pool.length)];
  const keys = Object.keys(THREATS), threat = keys[Math.floor(Math.random() * keys.length)];
  const ds = DISTRICTS[city.name] || ['the city centre', 'the northern districts', 'the old town', 'the station quarter'];
  const district = ds[Math.floor(Math.random() * ds.length)];
  const inc = { id: uid('i'), cityId: city.id, threat, district, t0: S.t, phase: 'alert', infest: 4, units: [], seen: false, handoff: false };
  S.incidents.push(inc);
  city.status = 'incident'; city.panic = clamp(city.panic + 25, 0, 100);
  log('bad', `EMERGENCY: ${THREATS[threat].name} reported in ${city.name} (${district}).`);
  return inc;
}
export const debugSpawn = () => spawnIncident();

function onScenePower(inc) {
  const g = THREATS[inc.threat].gear;
  return inc.units.map(id => S.units.find(u => u.id === id)).filter(u => u && u.status === 'onscene')
    .reduce((a, u) => { const st = unitStats(u); const gearBonus = (u.items[g] || 0) > 0 ? 1.25 : 1; return a + (st.fire + st.prot * 2) * gearBonus; }, 0);
}

export const threatNeed = inc => 20 + inc.infest * THREATS[inc.threat].strength * 6;
export function abstractResolve(incId) {
  const inc = S.incidents.find(i => i.id === incId), city = S.cities.find(c => c.id === inc.cityId), T = THREATS[inc.threat];
  const power = onScenePower(inc);
  const need = threatNeed(inc);
  const ratio = power / Math.max(1, need);
  const success = ratio > 0.8 + Math.random() * 0.5;
  let kia = 0, lost = [];
  for (const id of inc.units) {
    const u = S.units.find(x => x.id === id); if (!u || (u.status !== 'onscene' && u.status !== 'transit')) continue;
    if (u.status === 'transit') { const b = S.bases.find(x => x.id === u.baseId); const el = S.t - u.route.dep; u.route = { from: [u.lon, u.lat], to: [b.lon, b.lat], dep: S.t, arr: S.t + Math.max(HOUR, el), mode: u.route.mode }; u.status = 'returning'; continue; }
    const prot = unitStats(u).prot;
    const rate = clamp((success ? 0.12 : 0.35) / Math.max(0.6, ratio) * (1 - prot / 14), 0, 0.8);
    const k = Math.min(u.pers, Math.round(u.pers * rate * Math.random() * 1.4));
    u.pers -= k; kia += k;
    if (u.vehicle && Math.random() < rate * 0.6) { lost.push(ITEM[u.vehicle].name); u.pers = 0; }
    // return trip
    const b = S.bases.find(x => x.id === u.baseId);
    u.route = { from: [u.lon, u.lat], to: [b.lon, b.lat], dep: S.t, arr: S.t + (u.route.arr - u.route.dep), mode: u.route.mode };
    u.status = 'returning';
  }
  S.units.filter(u => u.pers <= 0).forEach(u => { S.groups.forEach(g => g.unitIds = g.unitIds.filter(i => i !== u.id)); });
  S.units = S.units.filter(u => u.pers > 0);
  inc.phase = success ? 'resolved' : 'lost';
  inc.result = { success, kia, lost, ratio };
  if (success) {
    city.status = 'normal'; city.integrity = Math.max(city.integrity, 30);
    S.standing = clamp(S.standing + 8, 0, 100); S.trust = clamp(S.trust + 6, 0, 100);
    S.specimens.push({ t: S.t, threat: inc.threat, city: city.name, n: 1 + Math.floor(Math.random() * 3) });
    log('good', `${city.name}: threat neutralised. ${kia} personnel killed in action. Specimens recovered.`);
  } else {
    city.status = 'quarantined';
    S.standing = clamp(S.standing - 12, 0, 100); S.trust = clamp(S.trust - 10, 0, 100);
    log('bad', `${city.name}: containment failed. City placed under military quarantine. ${kia} KIA.`);
  }
  S.nextIncident = S.t + rnd(10, 18) * DAY;
  return inc.result;
}

export function resolveTactical(incId, r) {
  const inc = S.incidents.find(i => i.id === incId), city = S.cities.find(c => c.id === inc.cityId), T = THREATS[inc.threat];
  const lost = [];
  for (const ur of r.units) {
    const u = S.units.find(x => x.id === ur.ref); if (!u) continue;
    if (ur.dead || ur.men <= 0) { lost.push(u.name); S.units = S.units.filter(x => x !== u); S.groups.forEach(g => g.unitIds = g.unitIds.filter(i => i !== u.id)); continue; }
    u.pers = Math.min(u.pers, ur.men);
    const b = S.bases.find(x => x.id === u.baseId);
    u.route = { from: [u.lon, u.lat], to: [b.lon, b.lat], dep: r.clock, arr: r.clock + Math.max(HOUR, (u.route.arr - u.route.dep)), mode: u.route.mode }; u.status = 'returning';
  }
  S.t = Math.max(S.t, r.clock);
  const share = Math.min(1, r.popAffected / Math.max(1, city.pop));
  city.integrity = clamp(Math.min(city.integrity, 100 - (100 - r.integrity) * Math.max(0.35, share)), 0, 100);
  city.panic = clamp(city.panic + r.stats.civDead / 400 - (r.success ? 15 : 0), 0, 100);
  const hvtPenalty = r.stats.hvtLost * 2, civPenalty = Math.min(15, r.stats.civDead / 300);
  if (r.success) { city.status = 'normal'; S.standing = clamp(S.standing + 10 + r.stats.hvtSaved - hvtPenalty - civPenalty, 0, 100); S.trust = clamp(S.trust + 8 - civPenalty, 0, 100); }
  else { city.status = 'quarantined'; S.standing = clamp(S.standing - 12 - hvtPenalty, 0, 100); S.trust = clamp(S.trust - 10 - civPenalty, 0, 100); }
  if (r.stats.specimens) S.specimens.push({ t: S.t, threat: inc.threat, city: city.name, n: r.stats.specimens });
  inc.phase = r.success ? 'resolved' : 'lost';
  inc.result = { success: r.success, kia: r.stats.soldiersKIA, lost, tactical: true, civDead: r.stats.civDead, evacuated: r.stats.evacuated, hvtSaved: r.stats.hvtSaved, hvtLost: r.stats.hvtLost };
  log(r.success ? 'good' : 'bad', `${city.name}: ${r.success ? 'threat eliminated' : 'operation ended without containment'} — ${r.stats.soldiersKIA} KIA, ${r.stats.civDead} civilian casualties, ${r.stats.evacuated} evacuated.`);
  S.nextIncident = S.t + rnd(10, 18) * DAY;
  return inc.result;
}

// ---------- Simulation ----------
export function ledger(amount, text) { S.ledger.unshift({ t: S.t, amount, text }); if (S.ledger.length > 120) S.ledger.pop(); }
export function monthlyUpkeep() {
  let up = 0;
  for (const b of S.bases) { up += BASE_SIZES[b.size].upkeep; for (const m of b.modules) up += MODULES[m.type].upkeep; }
  const pers = S.bases.reduce((a, b) => a + b.personnel, 0) + S.units.reduce((a, u) => a + u.pers, 0);
  up += pers * 3800;
  return { total: up, pers };
}
export const grantNow = () => S.grant * (0.5 + S.standing / 100);

export function tick(dtMs) {
  const events = [];
  const steps = Math.ceil(dtMs / (10 * 60e3)); const step = dtMs / steps;
  for (let i = 0; i < steps; i++) { S.t += step; stepSim(step / HOUR, events); }
  return events;
}

function stepSim(h, ev) {
  const t = S.t;
  // Month rollover
  const mo = new Date(t).getUTCMonth();
  if (mo !== S.month) {
    S.month = mo; const g = grantNow(), up = monthlyUpkeep().total;
    S.funds += g - up; ledger(g, 'Monthly government grant'); ledger(-up, 'Monthly upkeep (bases, modules, salaries)');
    log('info', `New month: grant €${(g / 1e6).toFixed(1)}M received, upkeep €${(up / 1e6).toFixed(1)}M paid.`);
    S.standing = clamp(S.standing + (50 - S.standing) * 0.05, 0, 100);
  }
  for (const b of S.bases) {
    if (!b.built && t >= b.doneAt) { b.built = true; b.personnel += 0; log('good', `${b.name} is operational.`); ev.push({ type: 'base', b }); }
    for (const m of b.modules) if (!m.done && t >= m.doneAt) { m.done = true; log('good', `${MODULES[m.type].name} completed at ${b.name}.`); }
  }
  for (const d of S.deliveries.filter(d => t >= d.at)) {
    const b = S.bases.find(x => x.id === d.baseId); b.storage[d.item] = (b.storage[d.item] || 0) + d.qty;
    log('good', `Delivered: ${d.qty}× ${ITEM[d.item].name} to ${b.name}.`);
  }
  S.deliveries = S.deliveries.filter(d => t < d.at);
  for (const tr of S.transfers.filter(x => t >= x.at)) {
    const b = S.bases.find(x => x.id === tr.to); for (const [id, q] of Object.entries(tr.items)) b.storage[id] = (b.storage[id] || 0) + q;
    log('good', `Convoy arrived at ${b.name}.`);
  }
  S.transfers = S.transfers.filter(x => t < x.at);
  for (const r of S.recruits.filter(r => t >= r.at)) { const b = S.bases.find(x => x.id === r.baseId); b.personnel += r.n; log('good', `${r.n} recruits completed training at ${b.name}.`); }
  S.recruits = S.recruits.filter(r => t < r.at);

  // Units moving
  for (const u of S.units) {
    if (u.route && (u.status === 'transit' || u.status === 'returning')) {
      const f = clamp((t - u.route.dep) / (u.route.arr - u.route.dep), 0, 1);
      [u.lon, u.lat] = interp(u.route.from, u.route.to, f);
      if (f >= 1) {
        if (u.status === 'transit') { u.status = 'onscene'; const inc = S.incidents.find(i => i.id === u.incidentId); log('info', `${u.name} arrived at the ${u.approach} staging area, ${S.cities.find(c => c.id === inc.cityId).name}.`); if (inc.phase === 'responding' || inc.phase === 'alert') inc.phase = 'onscene'; }
        else { u.status = 'ready'; u.route = null; u.incidentId = null; log('info', `${u.name} returned to base.`); }
      }
    }
  }
  // Incidents
  if (t >= S.nextIncident && !S.incidents.some(i => ['alert', 'responding', 'onscene'].includes(i.phase))) {
    const inc = spawnIncident(); S.nextIncident = Infinity; if (inc) ev.push({ type: 'incident', inc });
  }
  for (const inc of S.incidents.filter(i => ['alert', 'responding', 'onscene'].includes(i.phase))) {
    const city = S.cities.find(c => c.id === inc.cityId), T = THREATS[inc.threat];
    const supp = clamp(onScenePower(inc) / (threatNeed(inc) * 1.25), 0, 1.2);
    inc.infest = clamp(inc.infest + h * T.spread * 0.35 * (1 - supp), 1, 100);
    city.integrity = clamp(city.integrity - h * inc.infest * 0.012, 0, 100);
    city.panic = clamp(city.panic + h * (inc.infest * 0.02 - supp * 0.4), 0, 100);
    for (const c of S.cities) { if (c === city) continue; const d = distKm([c.lon, c.lat], [city.lon, city.lat]); if (d < 250) c.panic = clamp(c.panic + h * inc.infest * 0.004 * (1 - d / 250), 0, 100); }
    S.trust = clamp(S.trust - h * 0.02 * (1 - supp), 0, 100);
    const arrived = inc.units.some(id => S.units.find(x => x.id === id)?.status === 'onscene'); // first unit on scene can take command
    if (arrived && !inc.handoff) { inc.handoff = true; ev.push({ type: 'handoff', inc }); }
    if (city.integrity <= 0) { inc.phase = 'lost'; city.status = 'lost'; S.standing = clamp(S.standing - 20, 0, 100); log('bad', `${city.name} has fallen. Government standing collapses.`); S.nextIncident = S.t + rnd(10, 18) * DAY; }
  }
  // Panic relaxation in calm cities
  for (const c of S.cities) if (c.status === 'normal') { c.panic = clamp(c.panic - h * 0.03, 2, 100); c.integrity = clamp(c.integrity + h * 0.05, 0, 100); }
}

export const activeIncident = () => S.incidents.find(i => ['alert', 'responding', 'onscene'].includes(i.phase));
export function nationalStats() {
  const pop = S.cities.reduce((a, c) => a + c.pop, 0) || 1;
  return { panic: S.cities.reduce((a, c) => a + c.panic * c.pop, 0) / pop, integrity: S.cities.reduce((a, c) => a + c.integrity * c.pop, 0) / pop };
}

const KEY = 'sco_save_v1';
export function save() { try { S.gameVersion = VERSION; S.saveFormat = SAVE_FORMAT; localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
export function saveInfo() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s ? { version: s.gameVersion || '0.3.0 or older', org: s.org?.name, t: s.t } : null; } catch (e) { return null; } }
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
export function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (!s) return false; if (s.nextIncident === null) s.nextIncident = Infinity; const m = migrate(s); setS(m.s); for (const c of m.s.cities || []) c.surveyed = !!packFor(m.s.nation.cca2, c.name); if (m.migratedFrom) log('info', `Save upgraded to game version ${VERSION}.`); return true; } catch (e) { return false; } }
