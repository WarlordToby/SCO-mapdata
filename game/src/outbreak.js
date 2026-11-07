// The campaign's single global outbreak, simulated on the world grid (0.25° land cells).
// Each cell holds how much of it is overrun (0–1). Inside a cell the threat grows with the people it can reach and is
// pushed back by national defence (troops follow population, so big cities hold longer than the countryside). It spreads
// to neighbouring cells through open land faster than through forest, desert or wetland, never over open sea. From big
// infected cities it jumps by air and sea to other big cities until air travel is suspended and borders close.
// Countries detect it, mobilise and close their borders; overrun cells fall. Reaching a city triggers its emergency.
import { G, W, cellOf, cellLonLat, landAt } from './world.js';

export const PROFILE = { // growth/day, spread, long-range jumps, detection threshold, how hard to push back, special
  undead: { growth: 0.46, spread: 0.9, jump: 0.25, detect: 0.04, resist: 1.0, crowd: 1.3 },
  mutant: { growth: 0.32, spread: 0.45, jump: 0.05, detect: 0.03, resist: 0.7, crowd: 0.8 },
  alien: { growth: 0.36, spread: 0.42, jump: 0.02, detect: 0.02, resist: 0.6, crowd: 0.9, sites: 4 },
  vampire: { growth: 0.4, spread: 0.55, jump: 0.45, detect: 0.12, resist: 0.9, crowd: 1.4 },
  lycan: { growth: 0.45, spread: 0.8, jump: 0.1, detect: 0.06, resist: 0.85, crowd: 0.9, woods: true },
  swarm: { growth: 0.62, spread: 1.3, jump: 0.15, detect: 0.03, resist: 1.3, crowd: 1.0 },
};
const FALL = 0.9, STEP_H = 6;

export function newOutbreak(S, threat, homeCi) {
  // origin: a populous place somewhere in the world, away from the player's country
  const cand = G.cities.filter(c => c.pop > 4e5 && G.country[c.k] !== homeCi);
  const o = cand[Math.floor(Math.random() ** 1.6 * Math.min(cand.length, 180))];
  const P = PROFILE[threat], inf = new Float32Array(G.N);
  const origins = [o];
  if (P.sites) for (let i = 1; i < P.sites; i++) origins.push(cand[Math.floor(Math.random() * cand.length)]);
  for (const c of origins) inf[c.k] = 0.02;
  S.world = {
    threat, origin: { name: o.name, cc: o.cc, lon: o.lon, lat: o.lat }, sites: origins.map(c => c.name), t0: S.t, acc: 0,
    inf, countries: {}, air: null, firstDetect: null, reached: {}, requests: [], ai: [], log: [], stats: {},
  };
  S.fronts = S.fronts || [];
  return S.world;
}

// serialisation: overrun share of every land cell as uint16, base64
export function packWorld(w) { const q = new Uint16Array(w.inf.length); for (let k = 0; k < q.length; k++) q[k] = Math.round(w.inf[k] * 65535); let s = ''; const b = new Uint8Array(q.buffer); for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return { ...w, inf: btoa(s), infN: q.length }; }
export function unpackWorld(w) { if (!w || typeof w.inf !== 'string') return w; const s = atob(w.inf), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); const q = new Uint16Array(b.buffer), inf = new Float32Array(G.N); for (let k = 0; k < Math.min(q.length, G.N); k++) inf[k] = q[k] / 65535; return { ...w, inf }; }

export const cellInf = (S, lon, lat) => { const k = landAt(lon, lat); return k >= 0 && S.world ? S.world.inf[k] : 0; };

// front support: player units holding a position add defence to their cell and the ring around it
function frontBonus(S) {
  const fb = new Map();
  for (const f of S.fronts || []) {
    let power = 0; for (const id of f.units) { const u = S.units.find(x => x.id === id); if (u && u.status === 'front') power += f.power?.[id] || 1; }
    if (!power) continue;
    const add = (k, v) => { if (k >= 0) fb.set(k, (fb.get(k) || 0) + v); };
    add(f.k, power * 0.06); for (let n = 0; n < 8; n++) add(G.nb[f.k * 8 + n], power * 0.03);
  }
  return fb;
}

// advance by h hours; returns events for the strategic layer
export function stepOutbreak(S, h, homeCi) {
  const w = S.world; if (!w) return [];
  const ev = []; w.acc += h;
  while (w.acc >= STEP_H) { w.acc -= STEP_H; stepOnce(S, w, STEP_H / 24, homeCi, ev); }
  return ev;
}
function stepOnce(S, w, dt, homeCi, ev) {
  const P = PROFILE[w.threat], inf = w.inf, N = G.N, d = new Float32Array(N), fb = frontBonus(S), t = S.t;
  const global = Object.keys(w.countries).length >= 20;
  const mob = ci => { const c = w.countries[ci]; if (!c || !c.mobilized) return global ? 1.3 : 1; return t >= c.mobilized ? 1.25 + Math.min(1, (t - c.mobilized) / (25 * 864e5)) * 0.95 : 1; }; // mobilisation ramps up over ~25 days
  for (let k = 0; k < N; k++) {
    const x = inf[k]; if (x < 1e-5) continue;
    const ci = G.country[k], crowd = 0.45 + Math.min(1.6, G.pop[k] / 2.5e5) * P.crowd;
    const D = (G.def[k] * mob(ci) + (fb.get(k) || 0)) * P.resist;
    d[k] += dt * (P.growth * crowd * x * (1 - x) - 0.32 * D * x * Math.sqrt(1 - x) / (1 + 4.5 * x));
    if (x > 0.015) { // spread to the eight neighbours
      const s = dt * P.spread * 0.075 * Math.pow(x, 1.15);
      for (let n = 0; n < 8; n++) {
        const j = G.nb[k * 8 + n]; if (j < 0) continue;
        let tf = G.terr[j]; if (P.woods) tf = Math.max(tf, G.lc[j * 7] * 1.2);
        d[j] += s * (n % 2 ? 1 : 0.72) * tf * (1 - inf[j]);
      }
    }
  }
  let infected = 0, fallen = 0, popLost = 0;
  for (let k = 0; k < N; k++) { if (!d[k]) continue; inf[k] = Math.max(0, Math.min(1, inf[k] + d[k])); if (inf[k] < 2e-5) inf[k] = 0; }
  for (let k = 0; k < N; k++) { const x = inf[k]; if (x <= 0.01) continue; infected++; if (x >= FALL) { fallen++; popLost += G.pop[k]; } }
  w.stats = { infected, fallen, popLost: Math.round(popLost) };
  // detection, mobilisation, border closures (per country)
  const seen = new Set();
  for (let k = 0; k < N; k++) if (inf[k] > P.detect) seen.add(G.country[k]);
  for (const ci of seen) {
    let c = w.countries[ci]; if (!c) c = w.countries[ci] = {};
    if (!c.detected) {
      c.detected = t; c.mobilized = t + (2 + Math.random() * 3) * 864e5; c.closed = t + (1 + Math.random() * 4) * 864e5;
      if (!w.firstDetect) { w.firstDetect = t; ev.push({ type: 'outbreak', ci }); }
      ev.push({ type: 'countryHit', ci, home: ci === homeCi });
    }
  }
  if (!w.air && w.firstDetect && (t - w.firstDetect > 9 * 864e5 || Object.keys(w.countries).length >= 4)) { w.air = t; ev.push({ type: 'airSuspended' }); }
  // long-range jumps by air (and, once flights stop, by sea and smuggling)
  if (P.jump) {
    const big = G.cities;
    for (const c of big) {
      if (c.pop < 5e5) break;
      const x = inf[c.k]; if (x < 0.12) continue;
      const p = dt * P.jump * Math.sqrt(c.pop / 1e6) * (w.air ? 0.05 : 1);
      if (Math.random() > p) continue;
      // destination weighted by size and nearness
      let tot = 0; const pick = [];
      for (const dc of big) { if (dc.pop < 5e5) break; if (dc === c) continue; const dci = G.country[dc.k], cl = w.countries[dci]?.closed; const dk = Math.hypot((dc.lon - c.lon) * Math.cos(c.lat * Math.PI / 180), dc.lat - c.lat) + 2; const wt = dc.pop / Math.pow(dk, 1.1) * (cl && t >= cl ? 0.1 : 1); tot += wt; pick.push([wt, dc]); }
      let r = Math.random() * tot; for (const [wt, dc] of pick) { r -= wt; if (r <= 0) { inf[dc.k] = Math.max(inf[dc.k], 0.012); break; } }
    }
  }
  // cities reached: home cities become your emergencies, foreign cities their organizations' (they may ask for help)
  for (const c of S.cities) {
    if (w.reached['h:' + c.id] || c.status === 'lost') continue;
    if (c.k === undefined) Object.defineProperty(c, 'k', { value: landAt(c.lon, c.lat), enumerable: false, writable: true });
    const k = c.k; if (k < 0) continue;
    if (inf[k] >= 0.1 && c.pop >= 2e4) { w.reached['h:' + c.id] = t; ev.push({ type: 'homeCity', city: c, k }); }
    if (inf[k] >= FALL && c.status !== 'lost') { c.status = 'lost'; c.integrity = 0; ev.push({ type: 'homeFallen', city: c }); }
  }
  for (const c of G.cities) {
    if (G.country[c.k] === homeCi || w.reached[c.id]) continue;
    if (inf[c.k] < 0.1) continue;
    w.reached[c.id] = t;
    const res = { cityId: c.id, k: c.k, at: t + (2 + Math.random() * 4) * 864e5 };
    w.ai.push(res);
    if (c.pop >= 1e6 || c.capital) { const rq = { id: 'rq' + Math.random().toString(36).slice(2, 7), cityId: c.id, cc: c.cc, name: c.name, lon: c.lon, lat: c.lat, pop: c.pop, t, until: t + 2 * 864e5, state: 'open' }; w.requests.push(rq); ev.push({ type: 'request', rq }); }
  }
  // foreign organizations deal with their emergencies (unless you took command): city held or lost
  for (const a of w.ai) {
    if (a.done || t < a.at) continue;
    const rq = w.requests.find(r => r.cityId === a.cityId && r.state === 'accepted'); if (rq) continue;
    a.done = true;
    const ci = G.country[a.k], odds = Math.min(0.9, 0.25 + G.strength[ci] * 0.35 - inf[a.k] * 0.4);
    if (Math.random() < odds) { inf[a.k] *= 0.35; a.held = true; } else { inf[a.k] = Math.max(inf[a.k], 0.95); a.held = false; }
    const c = G.cities.find(x => x.id === a.cityId);
    if (c && c.pop >= 1e6) ev.push({ type: 'foreignResult', city: c, held: a.held });
    for (const r of w.requests) if (r.cityId === a.cityId && r.state === 'open') r.state = 'expired';
  }
  for (const r of w.requests) if (r.state === 'open' && t > r.until) r.state = 'expired';
  // front casualties: units holding the line wear down where pressure is high
  for (const f of S.fronts || []) {
    const pr = inf[f.k];
    for (const id of f.units) { const u = S.units.find(x => x.id === id); if (!u || u.status !== 'front') continue; const loss = dt * pr * 0.9 * (1 - Math.min(0.7, (f.prot?.[id] || 0) / 14)); f.wear = (f.wear || {}); f.wear[id] = (f.wear[id] || 0) + loss * u.pers; while (f.wear[id] >= 1 && u.pers > 0) { f.wear[id] -= 1; u.pers--; f.kia = (f.kia || 0) + 1; } }
  }
}

// infestation picture for the world map (equirectangular, 1 px per cell)
export function infImage(S, cv) {
  cv = cv || document.createElement('canvas'); if (cv.width !== W) { cv.width = W; cv.height = 720; }
  const ctx = cv.getContext('2d'), im = ctx.createImageData(W, 720), inf = S.world?.inf; if (!inf) { ctx.clearRect(0, 0, W, 720); return cv; }
  for (let k = 0; k < G.N; k++) {
    const x = inf[k]; if (x < 0.004) continue;
    const o = G.cell[k] * 4, fall = x >= FALL;
    im.data[o] = fall ? 120 : 230; im.data[o + 1] = fall ? 20 : 60 + (1 - x) * 80; im.data[o + 2] = fall ? 30 : 40; im.data[o + 3] = Math.round(255 * Math.min(0.9, 0.18 + x * 0.85));
  }
  ctx.putImageData(im, 0, 0);
  // hotspots: affected cells grouped by country (centre and extent) so the outbreak reads at any zoom
  const hs = new Map();
  for (let k = 0; k < G.N; k++) { const x = inf[k]; if (x < 0.02) continue; const ci = G.country[k], c = G.cell[k], h = hs.get(ci) || { n: 0, sx: 0, sy: 0, f: 0 }; h.n++; h.sx += c % W; h.sy += Math.floor(c / W); if (x >= FALL) h.f++; hs.set(ci, h); }
  cv.hotspots = [...hs.values()].filter(h => h.n >= 2).map(h => ({ lon: -180 + (h.sx / h.n + 0.5) * 0.25, lat: 90 - (h.sy / h.n + 0.5) * 0.25, cells: h.n, fallen: h.f }));
  return cv;
}
export { FALL, cellLonLat };
