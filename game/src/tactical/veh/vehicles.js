// Draws every vehicle of the tactical layer with its model: the player's and national forces' vehicles
// (turrets tracking targets, recoil and muzzle flash, wheels and tracks rolling, hull pitching over the
// ground, commander head-out, doors opening as infantry dismount, damage, burning wrecks), helicopters
// (rotors turning, nose down when flying), civilian traffic and the emergency services.
import { NAT } from './nat.js';
import * as THREE from 'three';
import { Fleet } from './kit.js';
import { MIL } from './mil.js';
import { HELI } from './heli.js';
import { CIV, EMERG } from './civ.js';
import { militaryPaint, heliPaint, policeLivery, ambulanceLivery, fireLivery, civilianLook } from './paint.js';
import { CLIP } from '../people.js';

const BUILD = { ...MIL, ...HELI, ...NAT, ...CIV, ...EMERG };
const CAP = m => MIL[m] ? 48 : HELI[m] ? 24 : EMERG[m] ? 300 : 2400;
const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 10007) / 10007; };

export class Vehicles {
  constructor(scene, sim, opts) {
    this.scene = scene; this.sim = sim; this.o = opts; this.fleets = new Map(); this.geos = new Map(); this.parked = []; this.wrecks = new Set(); this.lastT = sim.t;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YZX'); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._v = new THREE.Vector3();
  }
  geo(model) { let g = this.geos.get(model); if (!g) { g = BUILD[model](); this.geos.set(model, g); } return g; }
  fleet(model) { let f = this.fleets.get(model); if (!f) { f = new Fleet(this.scene, this.geo(model), CAP(model)); this.fleets.set(model, f); } return f; }
  // hull pose on the ground: yaw, pitch and roll from the terrain under the vehicle
  pose(x, y, h, meta, hAt, lift = 0, sc = 1, bob = 0) {
    const L = (meta.len || 4) * 0.42 * sc, W = (meta.wid || 2) * 0.4 * sc, cx = Math.cos(h), cy = Math.sin(h);
    const hf = hAt(x + cx * L, y + cy * L), hb = hAt(x - cx * L, y - cy * L), hl = hAt(x - cy * W, y + cx * W), hr = hAt(x + cy * W, y - cx * W);
    const z = (hf + hb + hl + hr) / 4 + lift + bob, pitch = Math.atan2(hf - hb, 2 * L), roll = Math.atan2(hl - hr, 2 * W);
    this._e.set(roll, h, pitch, 'YZX'); this._q.setFromEuler(this._e); this._p.set(x, z, -y); this._s.setScalar(sc);
    return this._m.compose(this._p, this._q, this._s);
  }
  motion(o, x, y, dt) {
    const m = o._vm || (o._vm = { x, y, v: 0, d: 0, h: null });
    if (dt > 0) { const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy); m.d += d; m.v += (Math.min(d / dt, 40) - m.v) * Math.min(1, dt * 4); if (d > 0.03) { const th = Math.atan2(dy, dx); m.h = m.h === null ? th : m.h + Math.atan2(Math.sin(th - m.h), Math.cos(th - m.h)) * Math.min(1, dt * 5); } m.x = x; m.y = y; }
    return m;
  }
  update({ heightAt, figs, gore, view, far, scale, night }) {
    const sim = this.sim, t = sim.t, dt = Math.max(0, t - this.lastT); this.lastT = t;
    const [vx, vy, vr] = view, vr2 = vr * vr, inView = (x, y, pad = 0) => (x - vx) ** 2 + (y - vy) ** 2 < (vr + pad) ** 2;
    for (const f of this.fleets.values()) f.begin();
    const reg = this.o.region, ccLocal = this.o.cc, lights = night ? 2 : 0;
    // ---------- traffic and emergency services ----------
    if (!far) for (const c of sim.cars) {
      const p = sim.carPos(c); if (!inView(p[0], p[1])) { if (c._vm) { c._vm.x = p[0]; c._vm.y = p[1]; } continue; }
      const look = c._look || (c._look = c.kind === 'police' ? policeLivery(ccLocal, reg, hash(c.id)) : c.kind === 'ambulance' ? ambulanceLivery(ccLocal) : c.kind === 'fire' ? fireLivery(ccLocal) : civilianLook(reg, ccLocal, (c.id * 0.6180339) % 1));
      const m = this.motion(c, p[0], p[1], dt), g = this.geo(look.model), h = Math.atan2(p[4], p[3]);
      const emerg = c.kind !== 'civ' && (c.task || c.role === 'patrol' || (c.fireT !== undefined && t - c.fireT < 20)) ? 1 : 0;
      this.fleet(look.model).put(this.pose(p[0], p[1], h, g.userData, heightAt, 0.02), [0, 0, 0, m.d], [0, 0, 0, emerg + lights], look.P, look.M);
    }
    // cars a titan has stamped flat: burnt-out wrecks where they were crushed
    if (!far) for (const w of sim.carWrecks || []) { if (!inView(w.x, w.y)) continue; const c = w.car, look = c._look || (c._look = c.kind === 'police' ? policeLivery(ccLocal, reg, hash(c.id)) : c.kind === 'ambulance' ? ambulanceLivery(ccLocal) : c.kind === 'fire' ? fireLivery(ccLocal) : civilianLook(reg, ccLocal, (c.id * 0.6180339) % 1)); const g = this.geo(look.model); this.fleet(look.model).put(this.pose(w.x, w.y, w.h, g.userData, heightAt, -0.12), [0, 0, 0, 0], [1, 0, 1, 0], look.P, look.M); }
    // ---------- military: player's and national units, carriers of motorised squads, parked carriers ----------
    const vs = Math.min(2.4, Math.max(1, scale));
    for (const u of sim.units) {
      const isVeh = u.kind === 'vehicle' || u.kind === 'heli', riding = u.kind === 'squad' && u.riding && u.carrier;
      if (!isVeh && !riding && !(u.kind === 'squad' && u._park)) continue;
      const model = isVeh ? u.vehicle : u.carrier; if (!BUILD[model]) continue;
      const g = this.geo(model), meta = g.userData, cc = u.ai ? this.o.nationCc : this.o.playerCc;
      const paint = u._paint || (u._paint = meta.heli ? heliPaint(cc, reg) : militaryPaint(cc, reg));
      // a motorised squad's carrier: drives with them, parks where they get out (ramp/doors open), leaves when they mount up
      if (u.kind === 'squad') {
        if (riding) { u._park = null; } else if (u._wasRiding && !u._park) { u._park = { x: u.x, y: u.y, h: u._vm?.h ?? Math.atan2(u.hy, u.hx), t, d: u._vm?.d || 0 }; }
        u._wasRiding = riding;
        if (!riding) { const k = u._park; if (!k || u.dead && t - k.t > 600) { u._park = null; continue; } const door = Math.min(1, (t - k.t) * 0.8); if (inView(k.x, k.y)) this.fleet(model).put(this.pose(k.x, k.y, k.h, meta, heightAt, 0, vs), [0, 0, 0, k.d], [0, door, 0, lights], paint.P, paint.M); continue; }
      }
      const m = this.motion(u, u.x, u.y, dt), h = m.h ?? Math.atan2(u.hy, u.hx);
      // wreck: burns once, keeps its place
      if (u.dead) {
        if (u.kind === 'squad') continue;
        if (!u._wreck) { u._wreck = { x: u.x, y: u.y, h, kind: meta.turret && hash(u.id) > 0.45 ? 2 : 1, t }; const z = heightAt(u.x, u.y); gore.burn(u.x, u.y, z + (meta.deck || 1.5) * 0.8, meta.heli ? 60 : 120, meta.len > 6 ? 1.3 : 0.9); gore.boom(u.x, u.y, z + 1, meta.turret ? 6 : 4); }
        const w = u._wreck; if (!inView(w.x, w.y)) continue;
        if (meta.heli) { this.fleet(model).put(this.pose(w.x, w.y, w.h, meta, heightAt, 0, vs), [0, 0, 0, 0], [1, 0, 1, 0], paint.P, paint.M); continue; }
        this.fleet(model).put(this.pose(w.x, w.y, w.h, meta, heightAt, -0.08, vs), [u._ty || 0, -0.12, 0, m.d], [1, 0, w.kind, 0], paint.P, paint.M);
        continue;
      }
      if (u.inB) continue;
      // turret / weapon station tracks the target, returns to the front when idle
      const firing = u.fireT !== undefined && t - u.fireT < 3;
      if (meta.turret) {
        let want = 0, pitch = 0;
        if (u.fireT !== undefined && t - u.fireT < 6 && u.aimAt) { want = Math.atan2(u.aimAt[1] - u.y, u.aimAt[0] - u.x) - h; const d = Math.hypot(u.aimAt[0] - u.x, u.aimAt[1] - u.y); pitch = Math.max(-0.08, Math.min(0.25, Math.atan2(heightAt(u.aimAt[0], u.aimAt[1]) + 1 - (heightAt(u.x, u.y) + (meta.muzzle?.[1] || 2)), d))); }
        const cur = u._ty || 0, diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), rate = (meta.tracked || meta.len > 6 ? 0.8 : 1.8) * dt;
        u._ty = cur + Math.max(-rate, Math.min(rate, diff)); u._gp = (u._gp || 0) + (pitch - (u._gp || 0)) * Math.min(1, dt * 2);
        // recoil and muzzle flash: main guns fire every few seconds, machine guns each burst
        const big = u.fire >= 63;
        if (u.fireT !== undefined && u.fireT !== u._lastShot) { u._lastShot = u.fireT; if (!big || t - (u._lastBig ?? -9) > 3.5) { u._lastBig = t; u._rec = meta.recoil || 0.05; if (inView(u.x, u.y)) this.flash(u, meta, h, heightAt, gore, vs, big); } }
        u._rec = (u._rec || 0) * Math.exp(-dt * 6);
      }
      if (!inView(u.x, u.y, 100)) continue;
      if (meta.heli) {
        const v = m.v, want = v > 2 ? 45 : 22; u._alt = (u._alt ?? 45) + (want - (u._alt ?? 45)) * Math.min(1, dt * 0.4);
        const mat = this.pose(u.x, u.y, h, meta, () => 0, heightAt(u.x, u.y) + u._alt, vs); const tilt = -Math.min(0.22, v / 50); this._e.set(0, h, tilt, 'YZX'); this._q.setFromEuler(this._e); mat.compose(this._p, this._q, this._s);
        this.fleet(model).put(mat, [0, 0, 0, t * 32], [Math.max(0, 1 - u.hp / u.maxHp), 0, 0, lights], paint.P, paint.M);
        continue;
      }
      const bob = Math.sin(t * 9 + hash(u.id) * 20) * 0.025 * Math.min(1, m.v / 6);
      const mat = this.pose(u.x, u.y, h, meta, heightAt, 0, vs, bob);
      this.fleet(model).put(mat, [u._ty || 0, u._gp || 0, u._rec || 0, m.d], [Math.max(0, 1 - u.hp / u.maxHp), 0, 0, lights], paint.P, paint.M);
      // commander head-out of the hatch when not fighting
      if (meta.cmd && figs && !firing && scale < 1.6 && t - (u.fireT ?? -99) > 8) {
        const c = meta.cmd, piv = meta.piv?.turret || [0, 0, 0], a = meta.cmdHull ? 0 : (u._ty || 0);
        const lx = piv[0] + (c[0] - piv[0]) * Math.cos(a) + (c[2] - piv[2]) * Math.sin(a), lz = piv[2] - (c[0] - piv[0]) * Math.sin(a) + (c[2] - piv[2]) * Math.cos(a);
        this._v.set(lx, c[1] - 1.18, lz).applyMatrix4(mat);
        const f = u._cmdFig || (u._cmdFig = figs.W.soldier(hash(u.id) + 0.5, u.ai ? this.o.nationCc : this.o.playerCc));
        figs.crowd('soldier', f.key).put(this._v.x, -this._v.z, this._v.y, h + a, vs, f.look, CLIP.idle, hash(u.id) * 10, 1, hash(u.id));
      }
    }
    for (const f of this.fleets.values()) f.end(t);
  }
  flash(u, meta, h, heightAt, gore, vs, big) {
    const mz = meta.muzzle; if (!mz) return; const piv = meta.piv?.turret || [0, 0, 0], a = u._ty || 0;
    const lx = piv[0] + (mz[0] - piv[0]) * Math.cos(a) + (mz[2] - piv[2]) * Math.sin(a), lz = piv[2] - (mz[0] - piv[0]) * Math.sin(a) + (mz[2] - piv[2]) * Math.cos(a);
    const c = Math.cos(h), s = Math.sin(h), wx = u.x + (lx * c + lz * s) * vs, wy = u.y + (lx * s - lz * c) * vs;
    gore.muzzle(wx, wy, heightAt(u.x, u.y) + mz[1] * vs, big ? 1.4 : 0.45);
    if (big) gore.smoke.push({ x: wx, y: wy, z: heightAt(u.x, u.y) + mz[1], rate: 25, left: 0.6 });
  }
  footprint(u) { const m = u.kind === 'squad' ? u.carrier : u.vehicle; return BUILD[m] ? (this.geo(m).userData.len || 5) * 0.55 : 3; }
  dispose() { for (const f of this.fleets.values()) f.dispose(); for (const g of this.geos.values()) g.dispose(); }
}
