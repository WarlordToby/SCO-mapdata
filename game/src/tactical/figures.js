// Draws the people of the tactical layer as animated figures: civilians on foot, police officers beside their
// stopped cars, every soldier of each squad, the humanoid threats, and the fallen.
import { humanGeometry, lycanGeometry, peopleMaterial, Crowd, CLIP, PIVOTS } from './people.js';
import { FIGURES, Wardrobe } from './outfits.js';

const CAP = { civ: 3000, police: 500, soldier: 2400, undead: 3000, vampire: 1500, lycan: 1000, dead: 1600 };

export class Figures {
  constructor(scene, sim, opts) {
    this.scene = scene; this.sim = sim; this.W = new Wardrobe(opts);
    this.geos = new Map(); this.crowds = new Map(); this.mat = peopleMaterial(PIVOTS.HUMAN); this.matLycan = peopleMaterial(PIVOTS.LYCAN);
    this.prevC = new Set(); this.prevP = new Set(); this.prevCars = new Set(); this.corpses = []; this.lastT = sim.t;
    this.humanoid = ['undead', 'vampire', 'lycan'].includes(sim.threat);
    this.playerCc = opts.playerCc; this.nationCc = opts.nationCc;
  }
  crowd(role, key) {
    const id = role + ':' + key; let c = this.crowds.get(id); if (c) return c;
    let g = this.geos.get(key); if (!g) { g = key === 'lycan' ? lycanGeometry() : humanGeometry(FIGURES[key]); this.geos.set(key, g); }
    c = new Crowd(this.scene, g, key === 'lycan' ? this.matLycan : this.mat, CAP[role] || 1000); this.crowds.set(id, c); return c;
  }
  // per-entity motion tracking: speed (m/s of sim time) and heading from position changes
  motion(o, x, y, dt) {
    const m = o._fm || (o._fm = { x, y, v: 0, h: Math.random() * 6.28 });
    if (dt > 0) { const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy); const v = d / dt; m.v += (Math.min(v, 15) - m.v) * Math.min(1, dt * 6); if (d > 0.02) m.h = Math.atan2(dy, dx); m.x = x; m.y = y; }
    return m;
  }
  addCorpse(x, y, h, fig, seed) { if (!fig) return; this.corpses.push({ x, y, h, fig, t: this.sim.t, seed }); if (this.corpses.length > CAP.dead) this.corpses.shift(); }

  update(draw, scale, heightAt, view) {
    const [vx, vy, vr] = view || [0, 0, 1e9], vr2 = vr * vr, inView = (x, y) => (x - vx) ** 2 + (y - vy) ** 2 < vr2;
    const sim = this.sim, t = sim.t, dt = Math.max(0, t - this.lastT); this.lastT = t;
    for (const c of this.crowds.values()) c.begin();
    const sc = scale; // figures grow a little when zoomed out so they stay readable
    // ---- civilians on foot ----
    const curP = new Set();
    for (const p of sim.peds) {
      curP.add(p);
      if (!draw || !inView(p.x, p.y)) { if (p._fm) { p._fm.x = p.x; p._fm.y = p.y; } continue; }
      const f = p._fig || (p._fig = this.W.civ(p.id)), m = this.motion(p, p.x, p.y, dt), z = heightAt(p.x, p.y), run = (p.v || 1.4) > 2.1 || m.v > 2.2;
      const clip = m.v < 0.25 ? CLIP.idle : run ? (sim.creatures.length ? CLIP.panic : CLIP.run) : CLIP.walk, rate = run ? Math.max(1.2, m.v / 2.4) : Math.max(0.6, m.v / 1.45);
      this.crowd('civ', f.key).put(p.x, p.y, z, m.h, f.scale * sc, f.look, clip, (p.id * 10) % 10, rate, p.id % 1);
      if (p.people >= 4) { // a family or group walks together
        const f2 = p._fig2 || (p._fig2 = this.W.civ(p.id + 0.37)), ox = Math.cos(m.h + 1.57) * 0.9, oy = Math.sin(m.h + 1.57) * 0.9;
        this.crowd('civ', f2.key).put(p.x + ox, p.y + oy, z, m.h, f2.scale * sc, f2.look, clip, (p.id * 17) % 10, rate * 0.97, (p.id * 3) % 1);
      }
    }
    for (const p of this.prevP) if (!curP.has(p) && p.dead) this.addCorpse(p.x, p.y, p._fm?.h || 0, p._fig, p.id % 1);
    this.prevP = curP;
    // ---- police officers beside stopped patrol cars ----
    const curCars = new Set();
    for (const c of sim.cars) {
      if (c.kind !== 'police') continue; curCars.add(c);
      const p = sim.carPos(c); c._pp = p; const m = this.motion(c, p[0], p[1], dt);
      if (!draw || m.v > 0.6 || !inView(p[0], p[1])) continue;
      const fx = p[3], fy = p[4], side = [fy, -fx], firing = c.fireT !== undefined && t - c.fireT < 1.2;
      for (let i = 0; i < 2; i++) {
        const f = (c._figs || (c._figs = []))[i] || (c._figs[i] = this.W.police(c.id + i * 0.31)), sgn = i ? -1 : 1;
        const x = p[0] + side[0] * 2.1 * sgn + fx * (i ? -0.8 : 0.9), y = p[1] + side[1] * 2.1 * sgn + fy * (i ? -0.8 : 0.9);
        const h = firing && c.aimAt ? Math.atan2(c.aimAt[1] - y, c.aimAt[0] - x) : Math.atan2(fy, fx) + sgn * 0.8;
        this.crowd('police', f.key).put(x, y, p[2], h, f.scale * sc, f.look, firing ? CLIP.pistolFire : CLIP.idle, c.id * 7, 1, (c.id * 13 + i * 0.5) % 1);
      }
    }
    for (const c of this.prevCars) if (!curCars.has(c) && c.hp <= 0 && c._pp) { const p = c._pp; for (let i = 0; i < 2; i++) this.addCorpse(p[0] + p[4] * 2.1 * (i ? -1 : 1), p[1] - p[3] * 2.1 * (i ? -1 : 1), Math.random() * 6.28, c._figs?.[i] || this.W.police(c.id + i * 0.31), (c.id + i) % 1); }
    this.prevCars = curCars;
    // ---- soldiers: every man of each squad, in a loose formation ----
    for (const u of sim.units) {
      if (u.kind !== 'squad' || u.riding || u.inB) { u._menShown = u.men; continue; }
      const m = this.motion(u, u.x, u.y, dt), z0 = heightAt(u.x, u.y), n = u.dead ? 0 : u.men;
      const cols = n > 12 ? 6 : n > 6 ? 4 : 3, sp = 2.4 * Math.max(1, scale * 0.8), hx = Math.cos(m.h), hy = Math.sin(m.h);
      const firing = u.fireT !== undefined && t - u.fireT < 1.4, moving = m.v > 0.35;
      const cc = u.ai ? this.nationCc : this.playerCc;
      const slot = i => { const ox = -Math.floor(i / cols) * sp, oy = ((i % cols) - (cols - 1) / 2) * sp; return [u.x + ox * hx - oy * hy, u.y + ox * hy + oy * hx]; };
      // fallen men leave bodies where they stood
      if (u._menShown !== undefined && n < u._menShown) for (let i = n; i < u._menShown; i++) { const [x, y] = slot(i); this.addCorpse(x, y, m.h, (u._figs || [])[i] || this.W.soldier(this.uSeed(u) + i * 0.013, cc), (i * 0.37) % 1); }
      u._menShown = n;
      if (!draw || !inView(u.x, u.y)) continue;
      for (let i = 0; i < n; i++) {
        const f = (u._figs || (u._figs = []))[i] || (u._figs[i] = this.W.soldier(this.uSeed(u) + i * 0.013, cc));
        const [x, y] = slot(i), sd = (i * 0.618 + this.uSeed(u)) % 1;
        let clip = CLIP.rifleIdle, h = m.h, rate = 1;
        if (moving) { clip = m.v > 2.4 ? CLIP.rifleRun : CLIP.rifleWalk; rate = m.v > 2.4 ? m.v / 2.6 : Math.max(0.7, m.v / 1.5); }
        else if (firing) { clip = i % 2 ? CLIP.kneelFire : CLIP.fire; if (u.aimAt) h = Math.atan2(u.aimAt[1] - y, u.aimAt[0] - x) + (sd - 0.5) * 0.15; }
        this.crowd('soldier', f.key).put(x, y, heightAt(x, y), h, f.scale * sc, f.look, clip, sd * 10, rate, sd);
      }
      if (u.dead && u._menShown) u._menShown = 0;
    }
    // ---- humanoid threats ----
    if (this.humanoid) {
      const curC = new Set(), th = sim.threat;
      for (const c of sim.creatures) {
        if (c.inB) continue; curC.add(c);
        const f = c._fig || (c._fig = th === 'undead' ? this.W.undead(c.id * 0.6180339) : th === 'vampire' ? this.W.vampire(c.id * 0.6180339) : this.W.lycan(c.id * 0.6180339));
        const m = this.motion(c, c.x, c.y, dt);
        if (!draw || !c.vis || !inView(c.x, c.y)) continue;
        const atk = c.atk > 0.35, sd = (c.id * 0.6180339) % 1;
        let clip, rate = 1;
        if (th === 'undead') { clip = atk ? CLIP.claw : CLIP.shamble; rate = atk ? 1 : Math.max(0.15, m.v / 0.9); }
        else if (th === 'vampire') { clip = atk ? CLIP.claw : m.v > 2.5 ? CLIP.vampRun : m.v > 0.3 ? CLIP.walk : CLIP.prowl; rate = m.v > 2.5 ? m.v / 3.4 : Math.max(0.6, m.v / 1.45); }
        else { clip = atk ? CLIP.claw : m.v > 1.5 ? CLIP.lope : m.v > 0.3 ? CLIP.walk : CLIP.prowl; rate = m.v > 1.5 ? m.v / 4 : Math.max(0.6, m.v / 1.6); }
        const h = atk && c.target?.u ? Math.atan2(c.target.u.y - c.y, c.target.u.x - c.x) : m.h;
        this.crowd(th, f.key).put(c.x, c.y, heightAt(c.x, c.y), h, f.scale * sc * (th === 'lycan' ? 1 : 1), f.look, clip, sd * 10, rate, sd);
      }
      for (const c of this.prevC) if (!curC.has(c) && c.hp <= 0 && !c.through) this.addCorpse(c.x, c.y, c._fm?.h || 0, c._fig, (c.id * 0.31) % 1);
      this.prevC = curC;
    }
    // ---- the fallen ----
    this.corpses = this.corpses.filter(k => t - k.t < 300);
    if (draw) for (const k of this.corpses) if (inView(k.x, k.y)) this.crowd(k.fig.key === 'lycan' ? 'lycan' : 'dead', k.fig.key).put(k.x, k.y, heightAt(k.x, k.y), k.h, k.fig.scale * sc, k.fig.look, CLIP.dead, k.t, 1, k.seed);
    for (const c of this.crowds.values()) c.end(t);
  }
  uSeed(u) { return u._seed || (u._seed = ((String(u.ref || u.id).split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0) % 10007) / 10007); }
  dispose() { for (const c of this.crowds.values()) c.dispose(); for (const g of this.geos.values()) g.dispose(); this.mat.dispose(); this.matLycan.dispose(); }
}
