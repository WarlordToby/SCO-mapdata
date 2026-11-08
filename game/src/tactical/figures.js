// Draws the people of the tactical layer as animated figures: civilians on foot, police officers beside their
// stopped cars, every soldier of each squad, the humanoid threats, and the fallen. It also turns the sim's
// events into flavour: bites and struggles, the bitten getting back up, severed limbs, gibs and blood,
// wounded soldiers dragged back by a comrade, grenades, undead feeding and civilians cowering.
import * as THREE from 'three';
import { humanGeometry, lycanGeometry, peopleMaterial, Crowd, CLIP, PIVOTS, LOST, GORE_U } from './people.js';
import { FIGURES, Wardrobe } from './outfits.js';
import { Gore } from './gore.js';

const CAP = { civ: 3000, police: 500, soldier: 2400, undead: 3000, vampire: 1500, lycan: 1000, dead: 1800, part: 600, act: 300 };
// where each severable part sits on the figure (rest pose), to lay severed pieces on the ground
const PART_C = { 1: [0.01, 1.63, 0], 2: [0, 1.12, 0.22], 4: [0, 1.12, -0.22], 8: [0, 0.5, 0.1], 16: [0, 0.5, -0.1] };
const pickLimb = (lost = 0) => { const o = [2, 4, 8, 16, 1].filter(b => !(lost & b)); return o.length ? o[Math.floor(Math.random() * o.length)] : 0; };

export class Figures {
  constructor(scene, sim, opts) {
    this.scene = scene; this.sim = sim; this.W = new Wardrobe(opts);
    this.geos = new Map(); this.crowds = new Map(); this.mat = peopleMaterial(PIVOTS.HUMAN); this.matLycan = peopleMaterial(PIVOTS.LYCAN);
    this.corpses = []; this.parts = []; this.acts = []; this.drags = []; this.lastT = sim.t; this.fxi = 0;
    this.humanoid = ['undead', 'vampire', 'lycan'].includes(sim.threat);
    this.playerCc = opts.playerCc; this.nationCc = opts.nationCc;
    this.gore = new Gore(scene); this.setGore(opts.gore ?? 2);
    this._m = new THREE.Matrix4(); this._m2 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  setGore(l) { this.goreLevel = l; GORE_U.value = l; this.gore.level = l; }
  crowd(role, key) {
    const id = role + ':' + key; let c = this.crowds.get(id); if (c) return c;
    let g = this.geos.get(key); if (!g) { g = key === 'lycan' ? lycanGeometry() : humanGeometry(FIGURES[key]); this.geos.set(key, g); }
    c = new Crowd(this.scene, g, key === 'lycan' ? this.matLycan : this.mat, CAP[role] || 1000); this.crowds.set(id, c); return c;
  }
  roleOf(f) { return f.key === 'lycan' ? 'lycan' : 'dead'; }
  motion(o, x, y, dt) {
    const m = o._fm || (o._fm = { x, y, v: 0, h: Math.random() * 6.28 });
    if (dt > 0) { const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy); const v = d / dt; m.v += (Math.min(v, 15) - m.v) * Math.min(1, dt * 6); if (d > 0.02) m.h = Math.atan2(dy, dx); m.x = x; m.y = y; }
    return m;
  }
  addCorpse(x, y, h, fig, seed, o = {}) {
    if (!fig) return null;
    const k = { x, y, h, fig, t: o.t ?? this.sim.t, seed, lost: this.goreLevel >= 2 ? o.lost || 0 : 0, wound: 0.5 + Math.random() * 0.4, riser: o.riser || null };
    this.corpses.push(k); if (this.corpses.length > CAP.dead) this.corpses.shift();
    if (o.blood !== false) { const z = this.hAt(x, y); this.gore.pool(x + Math.cos(h) * 0.6, y + Math.sin(h) * 0.6, z, 0.7 + Math.random() * 0.5 + (k.lost ? 0.5 : 0), 10); }
    return k;
  }
  // a severed piece flies off and lands
  sever(x, y, z, fig, bit, dirx, diry, force = 4) {
    if (this.goreLevel < 2 || !bit || !fig) return;
    if (this.parts.length >= CAP.part) this.parts.shift();
    const a = Math.atan2(diry, dirx) + (Math.random() - 0.5) * 1.2, sp = force * (0.5 + Math.random() * 0.7);
    this.parts.push({ fig, bit, x, y, z: z + PART_C[bit][1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 2 + Math.random() * force * 0.6, yaw: Math.random() * 6.28, spin: (Math.random() - 0.5) * 14, roll: 0, rest: false, t: this.sim.t });
    this.gore.blood(x, y, z + PART_C[bit][1], 14, dirx, diry, 3);
  }

  // ---- sim events ----
  events() {
    const sim = this.sim, F = sim.fx, t = sim.t, W = this.W, th = sim.threat;
    const base = sim.fxBase || 0; // the sim trims old events; keep an absolute index
    for (let i = Math.max(0, this.fxi - base); i < F.length; i++) {
      const e = F[i]; this.fxi = base + i + 1;
      if (e.k === 'hit') {
        const c = e.c; if (!this.humanoid && th !== 'mutant' && th !== 'alien') continue;
        const dx = c.x - e.from[0], dy = c.y - e.from[1], d = Math.hypot(dx, dy) || 1;
        if (Math.random() < (e.by === 'rifle' ? 0.35 : 0.8)) this.gore.blood(c.x, c.y, this.hAt(c.x, c.y) + 1.2, e.by === 'rifle' ? 3 : e.by === 'cannon' ? 16 : 7, dx / d, dy / d, e.by === 'rifle' ? 2.5 : 4);
      } else if (e.k === 'limb') {
        const c = e.c, f = this.creatureFig(c); this.sever(c.x, c.y, this.hAt(c.x, c.y), f, e.bit, Math.random() - .5, Math.random() - .5, e.by === 'blast' ? 7 : 4);
        this.gore.pool(c.x, c.y, this.hAt(c.x, c.y), 0.5, 4);
      } else if (e.k === 'cdie') {
        const c = e.c; if (!this.humanoid) continue; const f = this.creatureFig(c), z = this.hAt(c.x, c.y);
        let lost = c.lost || 0;
        if (e.by === 'cannon' || e.by === 'blast') {
          if (this.goreLevel >= 2 && Math.random() < (e.by === 'blast' ? 0.45 : 0.6)) { this.gore.gib(c.x, c.y, z, 26, e.by === 'blast' ? 8 : 6); this.gore.blood(c.x, c.y, z + 1, 20, 0, 0, 5); for (let i = 0; i < 2; i++) { const b = pickLimb(lost); if (b) { lost |= b; this.sever(c.x, c.y, z, f, b, Math.random() - .5, Math.random() - .5, 7); } } continue; }
          for (let i = 0; i < 1 + (Math.random() < 0.5 ? 1 : 0); i++) { const b = pickLimb(lost); if (b) { lost |= b; this.sever(c.x, c.y, z, f, b, Math.random() - .5, Math.random() - .5, 6); } }
          this.gore.gib(c.x, c.y, z, 8, 5);
        } else if (e.by === 'heavy' && Math.random() < 0.35 || e.by === 'crush' && Math.random() < 0.3) { const b = pickLimb(lost); if (b) { lost |= b; this.sever(c.x, c.y, z, f, b, Math.random() - .5, Math.random() - .5, 4); } }
        else if (e.by === 'rifle' && Math.random() < 0.08 && !(lost & 1)) { lost |= 1; this.sever(c.x, c.y, z, f, 1, Math.random() - .5, Math.random() - .5, 3); } // head shot
        this.addCorpse(c.x, c.y, c._fm?.h ?? 0, f, (c.id * 0.31) % 1, { lost });
      } else if (e.k === 'ped') {
        const p = e.p, f = p._fig || (p._fig = W.civ(p.id)); this.victim(e, f, p.x, p.y, p._fm?.h);
      } else if (e.k === 'man') {
        const u = e.u, cc = u.ai ? this.nationCc : this.playerCc, f = (u._figs || [])[e.i] || W.soldier(this.uSeed(u) + e.i * 0.013, cc);
        { const n = u.men + 1, cols = n > 12 ? 6 : n > 6 ? 4 : 3, h = u._fm?.h ?? Math.atan2(u.hy, u.hx), hx = Math.cos(h), hy = Math.sin(h), ox = -Math.floor(e.i / cols) * 2.4, oy = ((e.i % cols) - (cols - 1) / 2) * 2.4; e.x = u.x + ox * hx - oy * hy; e.y = u.y + ox * hy + oy * hx; if (e.riser) { e.riser.x = e.x; e.riser.y = e.y; } }
        if (e.wounded) { this.drags.push({ u, f, x: e.x, y: e.y, t0: t, dur: 6, done: false }); this.gore.blood(e.x, e.y, this.hAt(e.x, e.y) + 1.1, 6); this.gore.pool(e.x, e.y, this.hAt(e.x, e.y), 0.35, 3); }
        else this.victim(e, f, e.x, e.y, Math.atan2(u.hy, u.hx));
      } else if (e.k === 'police') {
        for (let i = 0; i < 2; i++) { const q = e.pos, sg = i ? -1 : 1, f = e.car._figs?.[i] || W.police(e.car.id + i * 0.31); this.addCorpse(q[0] + q[4] * 2.1 * sg, q[1] - q[3] * 2.1 * sg, Math.random() * 6.28, f, (e.car.id + i) % 1, { riser: e.risers?.[i], lost: th === 'lycan' && Math.random() < 0.5 ? pickLimb() : 0 }); }
      } else if (e.k === 'rise') {
        const k = this.corpses.find(k => k.riser === e.r); const c = e.c;
        if (k) { this.corpses.splice(this.corpses.indexOf(k), 1); c._fig = th === 'undead' ? W.undeadFrom(k.fig, c.id * 0.618) : th === 'lycan' ? W.lycan(c.id * 0.618) : W.undeadFrom(k.fig, c.id * 0.618); c.lost = k.lost & ~1; if (k.lost & 24) c.crawl = true; c._fm = { x: c.x, y: c.y, v: 0, h: k.h }; }
      } else if (e.k === 'boom') {
        this.gore.boom(e.x, e.y, this.hAt(e.x, e.y), e.r);
      } else if (e.k === 'throw') {
        e.u._throw = { i: e.i, t0: t }; this.gore.throwNade(e.u.x, e.u.y, this.hAt(e.u.x, e.u.y) + 1.8, e.to[0], e.to[1], this.hAt(e.to[0], e.to[1]) + 0.1, t, e.t1);
      } else if (e.k === 'runover') {
        const c = e.c; this.gore.blood(c.x, c.y, this.hAt(c.x, c.y) + 0.6, 10, 0, 0, 3); this.gore.pool(c.x, c.y, this.hAt(c.x, c.y), 0.6, 2);
      }
    }
  }
  // someone is killed: bitten (struggle, then down; may rise), clawed, blown apart or run down
  victim(e, f, x, y, h = Math.random() * 6.28) {
    const t = this.sim.t, a = e.a, z = this.hAt(x, y), th = this.sim.threat;
    if (e.by === 'bite' && a) {
      const vamp = th === 'vampire', hh = Math.atan2(a.y - y, a.x - x);
      a._act = { clip: vamp ? CLIP.vampFeed : CLIP.bite, until: t + 2.5, face: Math.atan2(y - a.y, x - a.x) };
      this.acts.push({ f, x, y, z, h: hh, clip: vamp ? CLIP.lifted : CLIP.bitten, t0: t, until: t + 2.3, lift: vamp ? 0.35 : 0, then: { riser: e.riser, x, y, h: hh + Math.PI } });
      this.gore.blood(x, y, z + 1.45, 8, 0, 0, 1.5);
      return;
    }
    let lost = 0;
    if (e.by === 'claw' && th === 'lycan' && Math.random() < 0.5) { lost = pickLimb(); this.sever(x, y, z, f, lost, Math.random() - .5, Math.random() - .5, 4); }
    if (e.by === 'blast') { if (this.goreLevel >= 2 && Math.random() < 0.4) { this.gore.gib(x, y, z, 22, 7); return; } lost = pickLimb(); this.sever(x, y, z, f, lost, Math.random() - .5, Math.random() - .5, 6); }
    if (e.by === 'crush' && Math.random() < 0.25) { lost = pickLimb(); this.sever(x, y, z, f, lost, Math.random() - .5, Math.random() - .5, 3); }
    this.gore.blood(x, y, z + 1.1, 10, 0, 0, 2.5);
    this.addCorpse(x, y, h, f, Math.random(), { riser: e.riser, lost });
  }
  creatureFig(c) { const th = this.sim.threat; return c._fig || (c._fig = th === 'undead' ? this.W.undead(c.id * 0.6180339) : th === 'vampire' ? this.W.vampire(c.id * 0.6180339) : this.W.lycan(c.id * 0.6180339)); }

  update(draw, scale, heightAt, view, dtReal = 0.016) {
    this.hAt = heightAt;
    const [vx, vy, vr] = view || [0, 0, 1e9], vr2 = vr * vr, inView = (x, y) => (x - vx) ** 2 + (y - vy) ** 2 < vr2;
    const sim = this.sim, t = sim.t, dt = Math.max(0, t - this.lastT); this.lastT = t;
    this.events();
    for (const c of this.crowds.values()) c.begin();
    const sc = scale, th = sim.threat;
    // corpses by cell, for undead that feed when idle
    const cgrid = new Map(); if (th === 'undead' || th === 'lycan') for (const k of this.corpses) { const key = (Math.floor(k.x / 8)) * 100003 + Math.floor(k.y / 8); (cgrid.get(key) || cgrid.set(key, []).get(key)).push(k); }
    const corpseNear = (x, y) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = cgrid.get((Math.floor(x / 8) + i) * 100003 + Math.floor(y / 8) + j); if (L) for (const k of L) if ((k.x - x) ** 2 + (k.y - y) ** 2 < 9) return k; } return null; };
    // ---- civilians on foot ----
    for (const p of sim.peds) {
      if (!draw || !inView(p.x, p.y)) { if (p._fm) { p._fm.x = p.x; p._fm.y = p.y; } continue; }
      const f = p._fig || (p._fig = this.W.civ(p.id)), m = this.motion(p, p.x, p.y, dt), z = heightAt(p.x, p.y), run = (p.v || 1.4) > 2.1 || m.v > 2.2;
      let clip = m.v < 0.25 ? CLIP.idle : run ? (sim.creatures.length ? CLIP.panic : CLIP.run) : CLIP.walk, rate = run ? Math.max(1.2, m.v / 2.4) : Math.max(0.6, m.v / 1.45);
      if (clip === CLIP.idle && sim.creatures.length) { // frozen in fear when hostiles are close
        if (p._cowT === undefined || t - p._cowT > 1) { p._cowT = t; p._cow = false; sim.cGrid.near(p.x, p.y, 30, c => { if (!p._cow && !c.inB && (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < 900) p._cow = true; }); }
        if (p._cow) clip = CLIP.cower;
      }
      this.crowd('civ', f.key).put(p.x, p.y, z, m.h, f.scale * sc, f.look, clip, (p.id * 10) % 10, rate, p.id % 1);
      if (p.people >= 4) {
        const f2 = p._fig2 || (p._fig2 = this.W.civ(p.id + 0.37)), ox = Math.cos(m.h + 1.57) * 0.9, oy = Math.sin(m.h + 1.57) * 0.9;
        this.crowd('civ', f2.key).put(p.x + ox, p.y + oy, z, m.h, f2.scale * sc, f2.look, clip, (p.id * 17) % 10, rate * 0.97, (p.id * 3) % 1);
      }
    }
    // ---- police officers beside stopped patrol cars ----
    for (const c of sim.cars) {
      if (c.kind !== 'police') continue;
      const p = sim.carPos(c); const m = this.motion(c, p[0], p[1], dt);
      if (!draw || m.v > 0.6 || !inView(p[0], p[1])) continue;
      const fx = p[3], fy = p[4], side = [fy, -fx], firing = c.fireT !== undefined && t - c.fireT < 1.2;
      for (let i = 0; i < 2; i++) {
        const f = (c._figs || (c._figs = []))[i] || (c._figs[i] = this.W.police(c.id + i * 0.31)), sgn = i ? -1 : 1;
        const x = p[0] + side[0] * 2.1 * sgn + fx * (i ? -0.8 : 0.9), y = p[1] + side[1] * 2.1 * sgn + fy * (i ? -0.8 : 0.9);
        const h = firing && c.aimAt ? Math.atan2(c.aimAt[1] - y, c.aimAt[0] - x) : Math.atan2(fy, fx) + sgn * 0.8;
        this.crowd('police', f.key).put(x, y, p[2], h, f.scale * sc, f.look, firing ? CLIP.pistolFire : CLIP.idle, c.id * 7, 1, (c.id * 13 + i * 0.5) % 1);
      }
    }
    // ---- soldiers: every man of each squad, in a loose formation ----
    const dragging = new Map(); for (const d of this.drags) if (!d.done) dragging.set(d.u, (dragging.get(d.u) || 0) + 1);
    for (const u of sim.units) {
      if (u.kind !== 'squad' || u.riding || u.inB || u.dead) continue;
      const m = this.motion(u, u.x, u.y, dt);
      if (!draw || !inView(u.x, u.y)) continue;
      const n = Math.max(0, u.men - (dragging.get(u) || 0)), cols = n > 12 ? 6 : n > 6 ? 4 : 3, sp = 2.4 * Math.max(1, scale * 0.8), hx = Math.cos(m.h), hy = Math.sin(m.h);
      const firing = u.fireT !== undefined && t - u.fireT < 1.4, moving = m.v > 0.35, cc = u.ai ? this.nationCc : this.playerCc;
      for (let i = 0; i < n; i++) {
        const f = (u._figs || (u._figs = []))[i] || (u._figs[i] = this.W.soldier(this.uSeed(u) + i * 0.013, cc));
        const ox = -Math.floor(i / cols) * sp, oy = ((i % cols) - (cols - 1) / 2) * sp, x = u.x + ox * hx - oy * hy, y = u.y + ox * hy + oy * hx, sd = (i * 0.618 + this.uSeed(u)) % 1;
        let clip = CLIP.rifleIdle, h = m.h, rate = 1, t0 = sd * 10;
        if (u._throw && u._throw.i === i && t - u._throw.t0 < 0.8) { clip = CLIP.throw; t0 = u._throw.t0; if (u.aimAt) h = Math.atan2(u.aimAt[1] - y, u.aimAt[0] - x); }
        else if (moving) { clip = m.v > 2.4 ? CLIP.rifleRun : CLIP.rifleWalk; rate = m.v > 2.4 ? m.v / 2.6 : Math.max(0.7, m.v / 1.5); }
        else if (firing) { clip = ((t * 0.07 + sd) % 1) < 0.1 ? CLIP.reload : i % 2 ? CLIP.kneelFire : CLIP.fire; if (u.aimAt) h = Math.atan2(u.aimAt[1] - y, u.aimAt[0] - x) + (sd - 0.5) * 0.15; }
        this.crowd('soldier', f.key).put(x, y, heightAt(x, y), h, f.scale * sc, f.look, clip, t0, rate, sd);
      }
    }
    // wounded dragged back to the squad by a comrade
    for (const d of this.drags) {
      if (d.done) continue; const k = (t - d.t0) / d.dur;
      if (k >= 1 || d.u.dead || d.u.inB || d.u.riding) { d.done = true; continue; }
      if (k < 0.15) { if (draw && inView(d.x, d.y)) this.crowd('dead', d.f.key).put(d.x, d.y, heightAt(d.x, d.y), 0, d.f.scale * sc, d.f.look, CLIP.dragged, t, 0, 0.3, { wound: 0.6 }); continue; }
      const kk = (k - 0.15) / 0.85, tx = d.u.x - d.u.hx * 6, ty = d.u.y - d.u.hy * 6, x = d.x + (tx - d.x) * kk, y = d.y + (ty - d.y) * kk, dir = Math.atan2(ty - d.y, tx - d.x);
      if (!draw || !inView(x, y)) continue;
      const cf = (d.u._figs || [])[0] || d.f;
      this.crowd('dead', d.f.key).put(x, y, heightAt(x, y), dir + Math.PI, d.f.scale * sc, d.f.look, CLIP.dragged, t, 1, 0.3, { wound: 0.6 });
      this.crowd('soldier', cf.key).put(x + Math.cos(dir) * 1.7, y + Math.sin(dir) * 1.7, heightAt(x, y), dir + Math.PI, cf.scale * sc, cf.look, CLIP.drag, d.t0, 0.9, 0.4);
    }
    if (this.drags.length > 50) this.drags = this.drags.filter(d => !d.done);
    // ---- humanoid threats ----
    if (this.humanoid) {
      for (const c of sim.creatures) {
        if (c.inB) continue;
        const f = this.creatureFig(c), m = this.motion(c, c.x, c.y, dt);
        if (!draw || !c.vis || !inView(c.x, c.y)) continue;
        const atk = c.atk > 0.35, sd = (c.id * 0.6180339) % 1, z0 = heightAt(c.x, c.y);
        let clip, rate = 1, h = m.h, t0 = sd * 10, z = z0;
        const tgt = c.target?.u;
        if (c.riseT !== undefined && t - c.riseT < 1.7) { clip = CLIP.rise; t0 = c.riseT; }
        else if (c._act && t < c._act.until) { clip = c._act.clip; h = c._act.face; }
        else if (c.crawl) { clip = CLIP.crawl; rate = Math.max(0.3, m.v / 0.35); }
        else if (c.hitT !== undefined && t - c.hitT < 0.3 && !atk && c.lastBy !== 'rifle') { clip = CLIP.flinch; t0 = c.hitT; }
        else if (th === 'undead') {
          clip = atk ? CLIP.claw : CLIP.shamble; rate = atk ? 1 : Math.max(0.15, m.v / 0.9);
          if (!atk && m.v < 0.2) { const k = corpseNear(c.x, c.y); if (k) { clip = CLIP.feed; h = Math.atan2(k.y - c.y, k.x - c.x); } }
        } else {
          // lycans and vampires leap the last few metres onto their prey
          if (tgt && !atk && m.v > 2.5) { const d = Math.hypot(tgt.x - c.x, tgt.y - c.y); if (d < 8 && d > 2.5 && t - (c._pounceT ?? -9) > 3) c._pounceT = t; }
          if (c._pounceT !== undefined && t - c._pounceT < 0.6) { clip = CLIP.pounce; z += Math.sin(Math.PI * (t - c._pounceT) / 0.6) * 1.3; }
          else if (th === 'vampire') { clip = atk ? CLIP.claw : m.v > 2.5 ? CLIP.vampRun : m.v > 0.3 ? CLIP.walk : CLIP.prowl; rate = m.v > 2.5 ? m.v / 3.4 : Math.max(0.6, m.v / 1.45); }
          else { clip = atk ? CLIP.claw : m.v > 1.5 ? CLIP.lope : m.v > 0.3 ? CLIP.walk : CLIP.prowl; rate = m.v > 1.5 ? m.v / 4 : Math.max(0.6, m.v / 1.6); if (!atk && m.v < 0.2) { const k = corpseNear(c.x, c.y); if (k) { clip = CLIP.feed; h = Math.atan2(k.y - c.y, k.x - c.x); } } }
        }
        if (atk && tgt && clip === CLIP.claw) h = Math.atan2(tgt.y - c.y, tgt.x - c.x);
        this.crowd(th, f.key).put(c.x, c.y, z, h, f.scale * sc, f.look, clip, t0, rate, sd, { lost: this.goreLevel >= 2 ? c.lost || 0 : 0, wound: c.max ? Math.max(0, 1 - c.hp / c.max) * 0.9 : 0 });
      }
    }
    // ---- paired actions: victims struggling in a bite, then going down ----
    this.acts = this.acts.filter(a => {
      if (t >= a.until) { const k = this.addCorpse(a.then.x, a.then.y, a.then.h, a.f, Math.random(), { riser: a.then.riser }); return false; }
      if (draw && inView(a.x, a.y)) this.crowd('dead', a.f.key).put(a.x, a.y, a.z + a.lift * Math.min(1, (t - a.t0) * 2), a.h, a.f.scale * sc, a.f.look, a.clip, a.t0, 1, 0.5, { wound: Math.min(1, (t - a.t0) / 2) * 0.7 });
      return true;
    });
    // ---- the fallen ----
    this.corpses = this.corpses.filter(k => t - k.t < 300 || k.riser && !k.riser.done);
    if (draw) for (const k of this.corpses) if (inView(k.x, k.y)) {
      // risers twitch shortly before they get up
      const tw = k.riser && !k.riser.destroyed && k.riser.t - t < 4 && k.riser.t > t;
      this.crowd(this.roleOf(k.fig), k.fig.key).put(k.x, k.y, heightAt(k.x, k.y), k.h + (tw ? Math.sin(t * 30) * 0.03 : 0), k.fig.scale * sc, k.fig.look, CLIP.dead, k.t, 1, k.seed, { lost: k.lost, wound: k.wound });
    }
    // ---- severed pieces ----
    const m4 = this._m, m2 = this._m2, q = this._q, v = this._v, s3 = this._s;
    if (this.parts.length && t - this.parts[0].t > 300) this.parts = this.parts.filter(p => t - p.t < 300);
    for (const p of this.parts) {
      if (!p.rest) { p.vz -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.yaw += p.spin * dt; p.roll = Math.min(Math.PI / 2, p.roll + dt * 6); const g = heightAt(p.x, p.y) + 0.08; if (p.z <= g) { p.z = g; if (p.vz < -3) { p.vz *= -0.25; p.vx *= 0.4; p.vy *= 0.4; } else { p.rest = true; p.roll = Math.PI / 2; this.gore.pool(p.x, p.y, g - 0.08, 0.25, 2); } } }
      if (!draw || !inView(p.x, p.y)) continue;
      const C = PART_C[p.bit], k = p.fig.scale * sc;
      v.set(p.x, p.z, -p.y); this._e.set(0, p.yaw, p.roll, 'YXZ'); q.setFromEuler(this._e); s3.setScalar(k); m4.compose(v, q, s3);
      m2.makeTranslation(-C[0], -C[1], -C[2]); m4.multiply(m2);
      this.crowd(this.roleOf(p.fig), p.fig.key).putMatrix(m4, p.fig.look, CLIP.idle, 0, 0, 0.5, { keep: p.bit, wound: 0.6 });
    }
    for (const c of this.crowds.values()) c.end(t);
    this.gore.update(dt, t, heightAt);
  }
  uSeed(u) { return u._seed || (u._seed = ((String(u.ref || u.id).split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0) % 10007) / 10007); }
  dispose() { for (const c of this.crowds.values()) c.dispose(); for (const g of this.geos.values()) g.dispose(); this.mat.dispose(); this.matLycan.dispose(); this.gore.dispose(); }
}
