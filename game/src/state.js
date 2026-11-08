import { packFor } from './packs.js';
import { ITEM, isVehicle, isHeli, STARTING_STOCK, GARRISON_STOCK, BASE_SIZES, MODULES, TEMPLATES, THREATS, DISTRICTS } from './catalog.js';
import { VERSION, SAVE_FORMAT, migrate } from './version.js';
import { WORLD, byCcn3, territoryOf, citiesOf, distKm, bearing, compass, interp } from './geo.js';
import { G as WG, landAt, ciOfCcn3, countryName } from './world.js';
import { newOutbreak, stepOutbreak, packWorld, unpackWorld, cellInf, PROFILE, threatDirAt } from './outbreak.js';

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
  GEO.ci = ciOfCcn3(S.ccn3);
}
// the city an incident is in: one of your country's cities, or a foreign city you were asked to help
export const cityOf = inc => S.cities.find(c => c.id === inc.cityId) || (S.foreign || []).find(c => c.id === inc.cityId);

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
    nextIncident: Infinity, month: new Date(START_T).getUTCMonth(), fronts: [], foreign: [],
  };
  hydrate();
  const keys = Object.keys(THREATS);
  newOutbreak(S, keys[Math.floor(Math.random() * keys.length)], GEO.ci);
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
  const city = cityOf(incident);
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
    if (km > 450) { // abroad or across a large country: military airlift (load-out, flight, unloading)
      for (const u of us) plans.push({ u, base: b, mode: 'air', km, eta: (mob + 5 + km / 650) * HOUR, carrier: 'Military airlift', dir });
      continue;
    }
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
  const inc = S.incidents.find(i => i.id === incidentId), city = cityOf(inc);
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
function spawnIncidentAt(city, foreign = false) {
  if (!city || S.incidents.some(i => i.cityId === city.id && ['alert', 'responding', 'onscene'].includes(i.phase))) return null;
  const threat = S.world?.threat || Object.keys(THREATS)[0];
  const ds = DISTRICTS[city.name] || ['the city centre', 'the northern districts', 'the old town', 'the station quarter'];
  const district = ds[Math.floor(Math.random() * ds.length)];
  const inc = { id: uid('i'), cityId: city.id, threat, district, t0: S.t, phase: 'alert', infest: 4 + Math.round(cellInf(S, city.lon, city.lat) * 20), units: [], seen: false, handoff: false, foreign };
  S.incidents.push(inc);
  city.status = 'incident'; city.panic = clamp(city.panic + 25, 0, 100);
  log('bad', `EMERGENCY: ${THREATS[threat].name} reached ${city.name}${foreign ? ` (${countryName(WG.country[landAt(city.lon, city.lat)])})` : ''} — ${district}.`);
  return inc;
}
function spawnIncident() { // debug: the outbreak reaches one of your surveyed cities now
  const pool = S.cities.filter(c => c.surveyed && c.status === 'normal');
  const city = pool.length ? pool[Math.floor(Math.random() * pool.length)] : [...S.cities].sort((a, b) => b.pop - a.pop)[0];
  return spawnIncidentAt(city);
}
export const debugSpawn = () => spawnIncident();

function onScenePower(inc) {
  const g = THREATS[inc.threat].gear;
  return inc.units.map(id => S.units.find(u => u.id === id)).filter(u => u && u.status === 'onscene')
    .reduce((a, u) => { const st = unitStats(u); const gearBonus = (u.items[g] || 0) > 0 ? 1.25 : 1; return a + (st.fire + st.prot * 2) * gearBonus; }, 0);
}

export const threatNeed = inc => 20 + inc.infest * THREATS[inc.threat].strength * 6;
export function abstractResolve(incId) {
  const inc = S.incidents.find(i => i.id === incId), city = cityOf(inc), T = THREATS[inc.threat];
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
  worldOutcome(inc, city, success);
  return inc.result;
}
// an emergency's outcome feeds the world map: a held city pushes the threat back in its cell, a lost one falls
function worldOutcome(inc, city, success) {
  if (!S.world || !city) return;
  const k = landAt(city.lon, city.lat); if (k < 0) return;
  if (success) S.world.inf[k] *= 0.3; else { S.world.inf[k] = Math.max(S.world.inf[k], 0.95); }
  if (inc.foreign) {
    const a = S.world.ai.find(x => 'f:' + x.cityId === city.id); if (a) { a.done = true; a.held = success; }
    const rq = S.world.requests.find(r => 'f:' + r.cityId === city.id); if (rq) rq.state = 'resolved';
    S.trust = clamp(S.trust + (success ? 4 : -2), 0, 100);
  }
}

export function resolveTactical(incId, r) {
  const inc = S.incidents.find(i => i.id === incId), city = cityOf(inc), T = THREATS[inc.threat];
  const lost = [];
  for (const ur of r.units) {
    const u = S.units.find(x => x.id === ur.ref); if (!u) continue;
    const back = ur.men + (ur.wounded || 0); // the wounded were evacuated and return to the unit
    if (back <= 0) { lost.push(u.name); S.units = S.units.filter(x => x !== u); S.groups.forEach(g => g.unitIds = g.unitIds.filter(i => i !== u.id)); continue; }
    u.pers = Math.min(u.pers, back);
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
  worldOutcome(inc, city, r.success);
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
        if (u.status === 'transit' && u.frontId) { u.status = 'front'; const f = S.fronts.find(x => x.id === u.frontId); log('info', `${u.name} took up position at ${f ? f.name : 'the front'}.`); }
        else if (u.status === 'transit') { u.status = 'onscene'; const inc = S.incidents.find(i => i.id === u.incidentId); log('info', `${u.name} arrived at the ${u.approach} staging area, ${cityOf(inc).name}.`); if (inc.phase === 'responding' || inc.phase === 'alert') inc.phase = 'onscene'; }
        else { u.status = 'ready'; u.route = null; u.incidentId = null; log('info', `${u.name} returned to base.`); }
      }
    }
  }
  // The global outbreak
  if (S.world) for (const e of stepOutbreak(S, h, GEO.ci)) worldEvent(e, ev);
  for (const c of S.cities) if (c.status !== 'lost') { const x = cellInf(S, c.lon, c.lat); if (x > 0.01) { c.integrity = Math.min(c.integrity, 100 - x * 100); c.panic = clamp(c.panic + h * x * 0.6, 0, 100); } }
  for (const inc of S.incidents.filter(i => ['alert', 'responding', 'onscene'].includes(i.phase))) {
    const city = cityOf(inc), T = THREATS[inc.threat];
    const supp = clamp(onScenePower(inc) / (threatNeed(inc) * 1.25), 0, 1.2);
    inc.infest = clamp(inc.infest + h * T.spread * 0.35 * (1 - supp), 1, 100);
    city.integrity = clamp(city.integrity - h * inc.infest * 0.012, 0, 100);
    city.panic = clamp(city.panic + h * (inc.infest * 0.02 - supp * 0.4), 0, 100);
    for (const c of S.cities) { if (c === city) continue; const d = distKm([c.lon, c.lat], [city.lon, city.lat]); if (d < 250) c.panic = clamp(c.panic + h * inc.infest * 0.004 * (1 - d / 250), 0, 100); }
    S.trust = clamp(S.trust - h * 0.02 * (1 - supp), 0, 100);
    const arrived = inc.units.some(id => S.units.find(x => x.id === id)?.status === 'onscene'); // first unit on scene can take command
    if (arrived && !inc.handoff) { inc.handoff = true; ev.push({ type: 'handoff', inc }); }
    if (city.integrity <= 0) { inc.phase = 'lost'; city.status = 'lost'; S.standing = clamp(S.standing - 20, 0, 100); log('bad', `${city.name} has fallen. Government standing collapses.`); worldOutcome(inc, city, false); }
  }
  // Panic relaxation in calm cities
  for (const c of S.cities) if (c.status === 'normal') { c.panic = clamp(c.panic - h * 0.03, 2, 100); c.integrity = clamp(c.integrity + h * 0.05, 0, 100); }
}

function worldEvent(e, ev) {
  const T = THREATS[S.world.threat], where = ci => countryName(ci);
  if (e.type === 'outbreak') { log('bad', `GLOBAL ALERT: ${T.name} confirmed in ${where(e.ci)} (first reports from ${S.world.origin.name}).`); ev.push({ type: 'world', kind: 'outbreak', ci: e.ci }); }
  else if (e.type === 'countryHit') { if (e.home) { log('bad', `The outbreak has crossed into ${S.nation.name}. National forces are mobilising.`); S.standing = clamp(S.standing - 5, 0, 100); ev.push({ type: 'world', kind: 'home' }); } else log('info', `Outbreak confirmed in ${where(e.ci)}.`); }
  else if (e.type === 'airSuspended') log('info', 'International air traffic suspended. Long-distance spread slows to sea and overland routes.');
  else if (e.type === 'homeCity') { const inc = spawnIncidentAt(e.city); if (inc) ev.push({ type: 'incident', inc }); }
  else if (e.type === 'homeFallen') { S.standing = clamp(S.standing - 8, 0, 100); log('bad', `${e.city.name} has been overrun.`); }
  else if (e.type === 'request') { log('info', `${WG.orgOf[WG.country[landAt(e.rq.lon, e.rq.lat)]]?.short || 'Allied organization'} requests assistance in ${e.rq.name}. (World tab)`); if (packFor(e.rq.cc, e.rq.name)) ev.push({ type: 'world', kind: 'request', rq: e.rq }); }
  else if (e.type === 'frontBattle') { const f = S.fronts.find(x => x.id === e.fid); if (f) { log('bad', `${f.name}: the threat is massing against the line.`); ev.push({ type: 'frontBattle', fid: f.id }); } }
  else if (e.type === 'foreignResult') log(e.held ? 'info' : 'bad', `${e.city.name}: ${e.held ? 'held by local forces' : 'overrun'}.`);
}
// accept a foreign organization's request: the city becomes an emergency you can dispatch to (and command in 3D if surveyed)
export function acceptRequest(rqId) {
  const rq = S.world?.requests.find(r => r.id === rqId); if (!rq || rq.state !== 'open') return null;
  rq.state = 'accepted';
  const id = 'f:' + rq.cityId;
  let city = S.foreign.find(c => c.id === id);
  if (!city) { city = { id, name: rq.name, cc: rq.cc, lon: rq.lon, lat: rq.lat, pop: rq.pop, integrity: 100 - Math.round(cellInf(S, rq.lon, rq.lat) * 100), panic: 40, status: 'normal', foreign: true, surveyed: !!packFor(rq.cc, rq.name) }; S.foreign.push(city); }
  const inc = spawnIncidentAt(city, true);
  if (inc) log('good', `${S.org.acronym || S.org.name} accepted the request from ${rq.name}. Dispatch units from the incident panel.`);
  return inc;
}
// frontlines: units hold a position, adding to the defence of the surrounding cells; they take losses where pressure is high
export function deployFront(lonlat, unitIds, name) {
  const k = landAt(lonlat[0], lonlat[1]); if (k < 0) return 'Pick a point on land.';
  const units = unitIds.map(id => S.units.find(u => u.id === id)).filter(u => u && u.status === 'ready'); if (!units.length) return 'No ready units selected.';
  const f = { id: uid('f'), name: name || 'Front line', lon: lonlat[0], lat: lonlat[1], k, units: [], power: {}, prot: {}, t0: S.t, kia: 0 };
  for (const u of units) {
    const b = S.bases.find(x => x.id === u.baseId), km = distKm([b.lon, b.lat], lonlat), st = unitStats(u);
    const air = km > 450 || (u.vehicle && isHeli(u.vehicle)), eta = (air ? 5 + km / 650 : 2 + km / 60) * HOUR;
    Object.assign(u, { status: 'transit', frontId: f.id, incidentId: null, route: { from: [b.lon, b.lat], to: lonlat, dep: S.t, arr: S.t + eta, mode: air ? 'air' : 'road' } });
    f.units.push(u.id); f.power[u.id] = Math.max(0.5, (st.fire + st.prot * 2) / 10); f.prot[u.id] = st.prot;
  }
  S.fronts.push(f); log('info', `${units.length} unit(s) moving up to ${f.name}.`);
  return f;
}
export function recallFront(fid) {
  const f = S.fronts.find(x => x.id === fid); if (!f) return;
  for (const id of f.units) { const u = S.units.find(x => x.id === id); if (!u) continue; const b = S.bases.find(x => x.id === u.baseId); const km = distKm([u.lon, u.lat], [b.lon, b.lat]); u.route = { from: [u.lon, u.lat], to: [b.lon, b.lat], dep: S.t, arr: S.t + (km > 450 ? 5 + km / 650 : 2 + km / 60) * HOUR, mode: km > 450 ? 'air' : 'road' }; u.status = 'returning'; u.frontId = null; }
  S.units = S.units.filter(u => u.pers > 0);
  S.fronts = S.fronts.filter(x => x !== f); log('info', `${f.name}: units withdrawn${f.kia ? ` (${f.kia} killed while holding the line)` : ''}.`);
}
// ---- countryside battles at a front line ----
const RURAL_WAVES = { undead: 260, mutant: 40, alien: 80, vampire: 70, lycan: 60, swarm: 500 };
export function frontBattle(fid) {
  const f = S.fronts.find(x => x.id === fid); if (!f || !S.world) return null;
  const k = f.k, ci = WG.country[k], x = S.world.inf[k], lc = Array.from(WG.lc.subarray(k * 7, k * 7 + 6)), m = WORLD[ci]?.meta || {};
  const units = f.units.map(id => S.units.find(u => u.id === id)).filter(u => u && u.status === 'front');
  const T = THREATS[S.world.threat];
  return {
    f, units, ci, pressure: x,
    rural: { lon: f.lon, lat: f.lat, cc: WG.ccOf[ci], lc, pop: WG.pop[k], threatDir: threatDirAt(S, k), seed: (parseInt(f.id.replace(/\W/g, ''), 36) ^ Math.floor(S.t / 36e5)) >>> 0, size: 6000, name: f.name,
      duration: 2400, waves: Math.round((RURAL_WAVES[S.world.threat] || 120) * (0.6 + x * 2)), platoons: Math.max(4, Math.min(10, Math.round(4 + (WG.strength[ci] || 1) * 4))), nation: m.demonym || countryName(ci) },
    tac: { threat: S.world.threat, threatName: T.name, threatColor: T.color, cityName: f.name, clock: S.t, supply: 140, forces: units.map(u => ({ id: u.id, name: u.name, tpl: u.tpl, pers: u.pers, items: u.items, vehicle: u.vehicle, approach: 'rear', carrier: null, arriveIn: 0 })) },
  };
}
// apply the outcome of a battle at a front (commanded in 3D, or left to the national forces)
export function resolveFront(fid, r) {
  const f = S.fronts.find(x => x.id === fid); if (!f || !S.world) return null;
  const inf = S.world.inf, k = f.k, lost = []; let kia = 0;
  if (r.units) for (const ur of r.units) {
    const u = S.units.find(x => x.id === ur.ref); if (!u) continue;
    ur.men += ur.wounded || 0;
    if (ur.men <= 0) { kia += u.pers; lost.push(u.name); S.units = S.units.filter(x => x !== u); S.groups.forEach(g => g.unitIds = g.unitIds.filter(i => i !== u.id)); f.units = f.units.filter(i => i !== u.id); continue; }
    kia += Math.max(0, u.pers - ur.men); u.pers = Math.min(u.pers, ur.men);
  } else { // automatic: the line's strength against the pressure decides, and the units bleed for it
    let power = 0; for (const id of f.units) { const u = S.units.find(x => x.id === id); if (u && u.status === 'front') power += f.power?.[id] || 1; }
    const p = clamp(0.3 + power * 0.06 + (WG.def[k] || 0) * 0.12 - inf[k] * 0.9, 0.08, 0.9);
    r.success = Math.random() < p;
    for (const id of [...f.units]) { const u = S.units.find(x => x.id === id); if (!u || u.status !== 'front') continue; const loss = Math.round(u.pers * (r.success ? 0.08 : 0.25) * Math.random() * 2); kia += Math.min(loss, u.pers); u.pers -= Math.min(loss, u.pers); if (u.pers <= 0) { lost.push(u.name); S.units = S.units.filter(x => x !== u); S.groups.forEach(g => g.unitIds = g.unitIds.filter(i => i !== u.id)); f.units = f.units.filter(i => i !== u.id); } }
  }
  f.kia = (f.kia || 0) + kia;
  const boost = r.units ? 1 : 0.6; // a battle you commanded counts for more than one fought without you
  if (r.success) { inf[k] *= 1 - 0.45 * boost; for (let n = 0; n < 8; n++) { const j = WG.nb[k * 8 + n]; if (j >= 0) inf[j] *= 1 - 0.2 * boost; } S.standing = clamp(S.standing + (r.units ? 4 : 1), 0, 100); }
  else { inf[k] = Math.min(1, inf[k] + 0.25); S.standing = clamp(S.standing - (r.units ? 4 : 2), 0, 100); }
  if (r.clock) S.t = Math.max(S.t, r.clock);
  f.battle = null;
  log(r.success ? 'good' : 'bad', `${f.name}: ${r.success ? 'the line held' : 'the line was broken'}${r.units ? '' : ' (national forces)'} — ${kia} of your personnel killed${lost.length ? `, ${lost.length} unit(s) lost` : ''}${r.natKIA ? `, ${r.natKIA} national troops killed` : ''}.`);
  if (!f.units.length) { S.fronts = S.fronts.filter(x => x !== f); log('bad', `${f.name}: no units left on the line.`); }
  return { success: r.success, kia, lost, natKIA: r.natKIA || 0 };
}
export const activeIncident = () => S.incidents.find(i => ['alert', 'responding', 'onscene'].includes(i.phase));
export function nationalStats() {
  const pop = S.cities.reduce((a, c) => a + c.pop, 0) || 1;
  return { panic: S.cities.reduce((a, c) => a + c.panic * c.pop, 0) / pop, integrity: S.cities.reduce((a, c) => a + c.integrity * c.pop, 0) / pop };
}

const KEY = 'sco_save_v1';
export function save() { try { S.gameVersion = VERSION; S.saveFormat = SAVE_FORMAT; localStorage.setItem(KEY, JSON.stringify({ ...S, world: S.world ? packWorld(S.world) : null })); return true; } catch (e) { return false; } }
export function saveInfo() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s ? { version: s.gameVersion || '0.3.0 or older', org: s.org?.name, t: s.t } : null; } catch (e) { return null; } }
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
export function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (!s) return false; if (s.nextIncident === null) s.nextIncident = Infinity; const m = migrate(s); m.s.world = unpackWorld(m.s.world); setS(m.s); for (const c of m.s.cities || []) c.surveyed = !!packFor(m.s.nation.cca2, c.name); if (!S.world) { const keys = Object.keys(THREATS); newOutbreak(S, keys[Math.floor(Math.random() * keys.length)], GEO.ci); S.nextIncident = Infinity; } if (m.migratedFrom) log('info', `Save upgraded to game version ${VERSION}.`); return true; } catch (e) { return false; } }
