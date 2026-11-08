// Building interiors: every building is split into floors, and each floor into a few large sections (an open-plan
// office floor, an apartment corridor, a shop, the stair core). Sections are where people are: civilians, hostiles
// and squads inside a building each stand in one, and fights there are physical: point-blank inside a section,
// medium range into the next one along the floor, and through the windows to and from the street. Stairs in the core
// link the floors. Heavy damage knocks sections out, leaving holes; a section whose support is gone can come down.
import { obb } from './look.js';

const FH = 3.1; // floor-to-floor height
// clip a polygon to a ≤ u ≤ b along axis (ux, uy)
function clipU(ring, ux, uy, a, b) {
  const cut = (pts, k, s) => { const o = []; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], dp = (p[0] * ux + p[1] * uy - k) * s, dq = (q[0] * ux + q[1] * uy - k) * s; if (dp >= 0) o.push(p); if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); o.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } } return o; };
  return cut(cut(ring, a, 1), b, -1);
}
const area = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a / 2); };
const centroid = r => { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x / r.length, y / r.length]; };

// layout of a building (computed once, on demand)
export function layout(b, useName = '') {
  if (b.L) return b.L;
  const o = obb(b.ring) || { c: b.c, ax: [1, 0], ay: [0, 1], len: 10, wid: 10 };
  const z0 = b.z ?? 0, top = b.zEave ?? (z0 + b.h), floors = Math.max(1, Math.min(60, Math.round((top - z0) / FH) || b.levels || 1)), fh = (top - z0) / floors;
  const nk = Math.max(1, Math.min(7, Math.round(o.len / 13))), [ux, uy] = o.ax, uc = o.c[0] * ux + o.c[1] * uy, u0 = uc - o.len / 2;
  const slices = [];
  for (let k = 0; k < nk; k++) { const poly = clipU(b.ring, ux, uy, u0 + o.len * k / nk - (k === 0 ? 1 : 0), u0 + o.len * (k + 1) / nk + (k === nk - 1 ? 1 : 0)); if (poly.length >= 3 && area(poly) > 4) slices.push({ k, poly, a: area(poly), c: centroid(poly), u0: u0 + o.len * k / nk, u1: u0 + o.len * (k + 1) / nk }); }
  if (!slices.length) slices.push({ k: 0, poly: b.ring, a: b.area || area(b.ring), c: b.c, u0, u1: u0 + o.len });
  const core = slices[Math.floor(slices.length / 2)].k;
  const office = /office|commercial|industrial|civic|school|hospital|hotel|government|public|university|college/.test(useName), shop = /retail|commercial|supermarket|kiosk/.test(useName);
  const sections = [], tot = slices.reduce((a, s) => a + s.a, 0) * floors;
  for (let f = 0; f < floors; f++) for (const s of slices) {
    const type = s.k === core ? 'core' : f === 0 && (shop || office && floors > 2) ? 'shop' : office ? 'office' : floors <= 2 && b.area < 250 ? 'house' : 'flat';
    sections.push({ id: sections.length, f, k: s.k, poly: s.poly, cx: s.c[0], cy: s.c[1], u0: s.u0, u1: s.u1, a: s.a, type, share: s.a / tot, occ: 0, hp: Math.min(600, 60 + s.a * 2), dead: false, glass: 1, clear: false, z: z0 + f * fh });
  }
  const L = b.L = { floors, fh, z0, ux, uy, nk: slices.length, kList: slices.map(s => s.k), core, sections, byFK: new Map(sections.map(s => [s.f * 100 + s.k, s])), ver: 0 };
  // occupants spread by floor area
  for (const s of sections) s.occ = (b.occ || 0) * s.share;
  // the ground-floor section nearest the entrance
  let best = null, bd = Infinity; for (const s of sections) if (s.f === 0) { const d = Math.hypot(s.cx - b.ent[0], s.cy - b.ent[1]); if (d < bd) { bd = d; best = s; } }
  L.entry = best;
  return L;
}
export const secAt = (L, f, k) => L.byFK.get(f * 100 + k);
// sections reachable from s in one move: along the floor, or up/down the stairs in the core
export function neighbours(L, s) {
  const o = [], i = L.kList.indexOf(s.k);
  for (const j of [i - 1, i + 1]) { const n = L.kList[j] !== undefined && secAt(L, s.f, L.kList[j]); if (n && !n.dead) o.push(n); }
  if (s.k === L.core) for (const df of [-1, 1]) { const n = secAt(L, s.f + df, s.k); if (n && !n.dead) o.push(n); }
  return o;
}
// next step on the way from a to b (BFS over the section graph); null if cut off
export function stepToward(L, a, b) {
  if (a === b) return a; const prev = new Map([[a, null]]), q = [a];
  while (q.length) { const s = q.shift(); if (s === b) break; for (const n of neighbours(L, s)) if (!prev.has(n)) { prev.set(n, s); q.push(n); } }
  if (!prev.has(b)) return null; let s = b; while (prev.get(s) !== a) s = prev.get(s); return s;
}
// does section s have windows facing point (x, y)? (it touches the facade on that side)
export function facing(L, s, x, y) { const dx = x - s.cx, dy = y - s.cy, u = dx * L.ux + dy * L.uy, v = -dx * L.uy + dy * L.ux; if (s.type === 'core' && Math.abs(v) > Math.abs(u)) return false; return Math.abs(v) > 3 || s.k === L.kList[0] && u < 0 || s.k === L.kList[L.kList.length - 1] && u > 0; }

export function installInterior(Sim) {
  const P = Sim.prototype;
  P.layoutOf = function (b) { return layout(b, this.city.codes.use[b.use] || ''); };
  // keep section occupancy in step with the building total (evacuation drains it)
  P.syncOcc = function (b) {
    const L = this.layoutOf(b); let sum = 0; for (const s of L.sections) sum += s.occ;
    if (Math.abs(sum - b.occ) > 0.5) { const k = sum > 0 ? Math.max(0, b.occ) / sum : 0; for (const s of L.sections) s.occ = sum > 0 ? s.occ * k : Math.max(0, b.occ) * s.share; }
    return L;
  };
  // ---- entering and leaving ----
  P.enterInterior = function (o, b, sec = null) { const L = this.layoutOf(b); o.inside = b; o.sec = sec && !sec.dead ? sec : L.entry && !L.entry.dead ? L.entry : L.sections.find(s => !s.dead); o.secT = 0; o.x = o.sec.cx; o.y = o.sec.cy; (b.inside || (b.inside = new Set())).add(o); this.activeB.add(b); L.ver++; return o.sec; };
  P.leaveInterior = function (o) { const b = o.inside; if (!b) return; b.inside?.delete(o); o.inside = null; o.sec = null; o.x = b.ent[0]; o.y = b.ent[1]; b.L && b.L.ver++; };
  P.moveSec = function (o, to) { if (!to || to === o.sec) return; o.sec = to; o.x = to.cx; o.y = to.cy; o.secT = 0; if (o.inside?.L) o.inside.L.ver++; };

  // ---- one step of everything happening inside buildings ----
  P.stepInteriors = function (dt) {
    for (const b of this.activeB) {
      const L = this.syncOcc(b), who = b.inside ? [...b.inside] : [];
      for (const o of who) if (o.dead || o.hp <= 0 || o.inside !== b) b.inside.delete(o);
      const us = who.filter(o => o.kind && !o.dead && o.inside === b), cs = who.filter(o => !o.kind && o.hp > 0 && o.inside === b);
      if (!us.length && !cs.length) { this.activeB.delete(b); continue; }
      const bySec = new Map(); for (const o of who) if (o.sec) { let a = bySec.get(o.sec); if (!a) bySec.set(o.sec, a = { u: [], c: [] }); (o.kind ? a.u : a.c).push(o); }
      // fights: point-blank in a section, medium range into the next section along the floor
      for (const u of us) {
        if (u.men <= 0 || u.ammo <= 0) continue; u.cool -= dt; if (u.cool > 0) continue;
        const here = bySec.get(u.sec)?.c || [], near = here.length ? here : neighbours(L, u.sec).filter(n => n.f === u.sec.f).flatMap(n => bySec.get(n)?.c || []);
        if (!near.length) continue;
        const c = near[0], close = here.length > 0; u.cool = 0.5; u.fireT = this.t; u.ammo -= 0.25;
        c.hp -= u.fire * u.men * 0.5 * (close ? 1.15 : 0.6) * (c.max > 300 ? 0.6 : 1); c.hitT = this.t; c.lastBy = u.mg > 0.2 && Math.random() < u.mg ? 'heavy' : 'rifle';
        this.fxPush({ k: 'ihit', c, u, b, close });
        if (c.hp <= 0) { u.kills++; this.stats.kills++; }
        // a squad that throws grenades into a packed room
        if (here.length >= 3 && u.nades > 0 && Math.random() < 0.15) { u.nades--; for (const x of here) { x.hp -= 90; x.lastBy = 'blast'; } this.damageSection(b, u.sec, 25); this.fxPush({ k: 'iboom', b, s: u.sec }); }
      }
      for (const c of cs) {
        const K = c.K || this.P; c.atk -= dt * 0; // (c.atk counts down in updateCreatures)
        const here = bySec.get(c.sec)?.u || [];
        if (here.length && c.atk <= 0) { c.atk = 1; const u = here[0]; this.hurtUnit(u, K.dmg * (K.ranged ? 0.6 : 1), c); continue; }
        if (!here.length && K.ranged && c.atk <= 0) { const adj = neighbours(L, c.sec).filter(n => n.f === c.sec.f).flatMap(n => bySec.get(n)?.u || []); if (adj.length) { c.atk = 1.4; this.hurtUnit(adj[0], K.dmg * 0.6, null); continue; } }
        // occupants in this section
        if (!here.length && c.sec.occ > 0.5 && !c.K?.build && !c.K?.capture) { const k = Math.min(c.sec.occ, dt * 1.2); c.sec.occ -= k; b.occ -= k; b.dead += k; this.stats.civDead += k; if (this.hive) this.hive.biomass += k * 0.3; b.convAcc = (b.convAcc || 0) + k * this.P.convert; while (b.convAcc >= 1) { b.convAcc--; const n = this.spawnCreature(b.ent[0], b.ent[1], b); if (n) this.enterInterior(n, b, c.sec); } if (b.dead > 3 && !b.known) { b.known = true; this.dirty(b); this.log(`Emergency calls from ${b.name || b.addr || 'a building'}: attack in progress.`, 'bad'); } }
        // move: toward soldiers inside, else toward people, else roam
        c.secT = (c.secT || 0) + dt; if (c.secT < 2.5 / Math.max(0.5, K.speed / 2)) continue;
        let goal = us.length ? us[0].sec : null;
        if (!goal && c.sec.occ < 0.5) { let bo = 0.5; for (const s of L.sections) if (!s.dead && s.occ > bo) { bo = s.occ; goal = s; } }
        if (goal) { const n = stepToward(L, c.sec, goal); if (n) this.moveSec(c, n); else c.secT = 0; }
        else c.secT = 0;
      }
      // squads clearing: sweep section by section, floor by floor (or go where they were sent)
      for (const u of us) {
        const o = u.order; if (!o || o.b !== b) continue;
        if (bySec.get(u.sec)?.c.length) continue; // fighting here
        if (o.type === 'clear') {
          u.sec.clear = true;
          u.secT = (u.secT || 0) + dt; if (u.secT < 3) continue;
          let goal = null;
          if (o.floor !== undefined) goal = o.hold ? secAt(L, o.floor, L.core) : L.sections.find(s => s.f === o.floor && !s.dead && !s.clear) || secAt(L, o.floor, L.core);
          if (!goal) { const known = cs.find(c => c.sec); goal = known ? known.sec : L.sections.filter(s => !s.dead && !s.clear).sort((a, b2) => (a.f - b2.f) * 100 + Math.abs(a.k - u.sec.k) - Math.abs(b2.k - u.sec.k))[0]; }
          if (!goal) { // swept: building is clear
            if (!cs.length) { b.infest = 0; if (b.hive) this.clearHive(b); b.state = 2; this.infested.delete(b); this.dirty(b); this.stats.specimens += 1; this.log(`${u.name} cleared ${b.name || b.addr || 'a building'} — samples taken.`, 'good'); for (const s of L.sections) s.clear = false; const ex = this.units.filter(x => x.inside === b && x.order?.b === b && x.order.type === 'clear'); for (const x of ex) { this.leaveInterior(x); x.order = this.garrisonMarks.has(b.idx) ? { type: 'garrison', b } : null; } }
            continue;
          }
          if (o.hold && u.sec === goal) continue;
          const n = stepToward(L, u.sec, goal); if (n) this.moveSec(u, n);
        }
      }
    }
  };
  // ---- heavy damage knocks sections out ----
  P.damageSection = function (b, s, d) {
    if (!s || s.dead) return; s.hp -= d; s.glass = Math.max(0, s.glass - d / 60);
    if (s.hp <= 0) this.killSection(b, s);
    else if (b.L) b.L.ver++;
  };
  P.killSection = function (b, s, cause = 'blast') {
    if (s.dead) return; const L = b.L; s.dead = true; s.glass = 0; L.ver++;
    const k = s.occ * 0.7; s.occ -= k; b.occ -= k; b.dead += k; this.stats.civDead += k;
    for (const o of [...(b.inside || [])]) if (o.sec === s) { if (o.kind) this.hurtUnit(o, 400, null); else { o.hp -= 600; o.lastBy = 'blast'; } }
    b.secHoles = (b.secHoles || 0) + 1; this.damaged = this.damaged || new Set(); this.damaged.add(b); this.dirty(b);
    this.fxPush({ k: 'secDie', b, s, cause });
    // what was resting on it may come down
    const above = secAt(L, s.f + 1, s.k); if (above && !above.dead) (this.unstable || (this.unstable = [])).push({ b, s: above, t: this.t + 1.5 + Math.random() * 4 });
    if (L.sections.filter(x => x.dead).length > L.sections.length * 0.6 && !b.destroyed) { b.hp = 0; b.destroyed = true; this.stats.bDestroyed++; for (const u of b.garrison.slice()) this.ungarrison(u); this.log(`Building collapsed: ${b.name || b.addr || 'block'}.`, 'bad'); }
  };
  P.stepCollapse = function () {
    if (!this.unstable?.length) return;
    const now = this.unstable.filter(q => this.t >= q.t); this.unstable = this.unstable.filter(q => this.t < q.t);
    for (const q of now) { const L = q.b.L, below = secAt(L, q.s.f - 1, q.s.k), side = neighbours(L, q.s).filter(n => n.f === q.s.f).length; if (below && below.dead && (side === 0 || Math.random() < 0.35)) this.killSection(q.b, q.s, 'collapse'); }
  };
  // damage at a point in the world (x, y, height z): the section there takes it
  P.hitBuildingAt = function (b, x, y, z, d, r = 0) {
    const L = this.layoutOf(b), f = Math.max(0, Math.min(L.floors - 1, Math.floor((z - L.z0) / L.fh)));
    let best = null, bd = Infinity; for (const s of L.sections) if (s.f === f && !s.dead) { const dd = Math.hypot(s.cx - x, s.cy - y); if (dd < bd) { bd = dd; best = s; } }
    if (best) this.damageSection(b, best, d);
    if (r > 6) for (const s of L.sections) if (s !== best && !s.dead && Math.abs(s.f - f) <= 1 && Math.hypot(s.cx - x, s.cy - y) < r) this.damageSection(b, s, d * 0.5);
    return best;
  };
}
export { FH };
