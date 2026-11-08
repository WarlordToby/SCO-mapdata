// Blood and wreckage: spray from hits, pools that spread under the dead, gibs and bone from heavy weapons and
// blasts, grenade arcs and their bursts. Everything is instanced and capped so a massacre stays cheap.
import * as THREE from 'three';

const BLOOD = [0x5a0606, 0x6e0a0a, 0x4a0404, 0x7a1010];
const GIB = [0x6e0a0a, 0x8a1c1c, 0x4a0404, 0xa04848, 0xd8cfc0, 0x5a1010];

class Pool { // a ring buffer of instanced meshes with per-instance colour
  constructor(scene, geo, mat, cap) { this.cap = cap; this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.setColorAt(0, new THREE.Color()); scene.add(this.mesh); this.items = []; }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

export class Gore {
  constructor(scene) {
    this.scene = scene; this.level = 2;
    const lam = c => new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.spray = new Pool(scene, new THREE.BoxGeometry(0.07, 0.07, 0.07), lam(), 1600);
    this.gibs = new Pool(scene, new THREE.IcosahedronGeometry(0.075, 0), lam(), 900);
    const pm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const pg = new THREE.CircleGeometry(1, 12); pg.rotateX(-Math.PI / 2);
    // irregular puddle: wobble the rim
    { const a = pg.attributes.position; for (let i = 1; i < a.count; i++) { const k = 0.75 + 0.5 * Math.abs(Math.sin(i * 2.7) * Math.cos(i * 1.3)); a.setX(i, a.getX(i) * k); a.setZ(i, a.getZ(i) * k); } }
    this.pools = new Pool(scene, pg, pm, 2400);
    this.flash = new Pool(scene, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 24);
    this.nade = new Pool(scene, new THREE.IcosahedronGeometry(0.07, 0), lam(), 64);
    this.smoke = []; // transient smoke sources handed to the renderer's smoke system
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._e = new THREE.Euler();
  }
  // ---- emitters (positions in game coords: x east, y north, z up) ----
  blood(x, y, z, n, dx = 0, dy = 0, force = 3) {
    if (!this.level) return; n = Math.round(n * (this.level === 1 ? 0.35 : 1));
    const S = this.spray.items;
    for (let i = 0; i < n; i++) { if (S.length >= this.spray.cap) S.shift(); const a = Math.random() * 6.283, sp = force * (0.3 + Math.random()); S.push({ x, y, z, vx: Math.cos(a) * sp * 0.6 + dx * force, vy: Math.sin(a) * sp * 0.6 + dy * force, vz: 1 + Math.random() * force * 0.8, c: BLOOD[i & 3], s: 0.6 + Math.random() * 0.9, t: 0 }); }
  }
  pool(x, y, z, r, grow = 8) {
    if (!this.level) return; if (this.level === 1) r *= 0.6;
    const P = this.pools.items; if (P.length >= this.pools.cap) P.shift();
    P.push({ x, y, z: z + 0.025 + Math.random() * 0.01, r0: r * 0.15, r, grow, t: 0, rot: Math.random() * 6.28, c: BLOOD[Math.floor(Math.random() * 4)] });
  }
  gib(x, y, z, n, force = 6) {
    if (this.level < 2) return;
    const G = this.gibs.items;
    for (let i = 0; i < n; i++) { if (G.length >= this.gibs.cap) G.shift(); const a = Math.random() * 6.283, sp = force * (0.3 + Math.random()); G.push({ x, y, z: z + 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 2 + Math.random() * force, c: GIB[Math.floor(Math.random() * GIB.length)], s: 0.6 + Math.random() * 1.4, rx: Math.random() * 6, ry: Math.random() * 6, w: (Math.random() - 0.5) * 20, t: 0, rest: false }); }
    for (let i = 0; i < Math.min(5, n / 3); i++) this.pool(x + (Math.random() - .5) * 4, y + (Math.random() - .5) * 4, z, 0.4 + Math.random() * 0.6, 2);
  }
  boom(x, y, z, r) {
    const F = this.flash.items; if (F.length >= this.flash.cap) F.shift(); F.push({ x, y, z: z + 0.8, r, t: 0 });
    this.smoke.push({ x, y, z: z + 1, rate: 30, left: 1.2, big: true });
    const P = this.pools.items; if (P.length >= this.pools.cap) P.shift(); P.push({ x, y, z: z + 0.02, r0: r * 0.5, r: r * 0.55, grow: 0.3, t: 0, rot: Math.random() * 6, c: 0x1a1612, scorch: true });
  }
  throwNade(x0, y0, z0, x1, y1, z1, t0, t1) { const N = this.nade.items; if (N.length >= this.nade.cap) N.shift(); N.push({ x0, y0, z0, x1, y1, z1, t0, t1 }); }

  // ---- per frame ----
  update(dt, t, heightAt) {
    const m = this._m, q = this._q, v = this._v, sc = this._s, col = this._c;
    // spray: ballistic droplets that leave a spot where they land
    let n = 0; const S = this.spray.items, keep = [];
    for (const p of S) { p.t += dt; p.vz -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const g = heightAt(p.x, p.y);
      if (p.z <= g + 0.03) { if (Math.random() < 0.25) this.pool(p.x, p.y, g, 0.08 + Math.random() * 0.14, 0.5); continue; }
      if (p.t > 2) continue; keep.push(p);
      v.set(p.x, p.z, -p.y); sc.setScalar(p.s); m.compose(v, q.identity(), sc); this.spray.mesh.setMatrixAt(n, m); this.spray.mesh.setColorAt(n, col.setHex(p.c)); n++; }
    this.spray.items = keep; this.fin(this.spray, n);
    // gibs: tumble, bounce once, then lie
    n = 0;
    for (const p of this.gibs.items) { p.t += dt;
      if (!p.rest) { p.vz -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.w * dt; p.ry += p.w * 0.7 * dt; const g = heightAt(p.x, p.y) + 0.04; if (p.z <= g) { p.z = g; if (Math.abs(p.vz) > 3) { p.vz *= -0.3; p.vx *= 0.4; p.vy *= 0.4; } else { p.rest = true; if (p.c !== 0xd8cfc0) this.pool(p.x, p.y, g - 0.04, 0.1 + Math.random() * 0.12, 1); } } }
      if (p.t > 300) continue;
      v.set(p.x, p.z, -p.y); this._e.set(p.rx, p.ry, 0); q.setFromEuler(this._e); sc.set(p.s, p.s * 0.6, p.s * 0.8); m.compose(v, q, sc); this.gibs.mesh.setMatrixAt(n, m); this.gibs.mesh.setColorAt(n, col.setHex(p.c)); n++; }
    if (this.gibs.items.length > 0 && this.gibs.items[0].t > 300) this.gibs.items = this.gibs.items.filter(p => p.t <= 300);
    this.fin(this.gibs, n);
    // pools spread to full size, then stay (and darken) for a long while
    n = 0;
    for (const p of this.pools.items) { p.t += dt; if (p.t > 420) continue; const r = p.r0 + (p.r - p.r0) * Math.min(1, p.t / Math.max(0.2, p.grow));
      v.set(p.x, p.z, -p.y); q.setFromAxisAngle(this._v2 || (this._v2 = new THREE.Vector3(0, 1, 0)), p.rot); sc.set(r, 1, r * 0.85); m.compose(v, q, sc); this.pools.mesh.setMatrixAt(n, m);
      col.setHex(p.c); if (!p.scorch) col.multiplyScalar(Math.max(0.55, 1 - p.t / 300)); this.pools.mesh.setColorAt(n, col); n++; }
    if (this.pools.items.length && this.pools.items[0].t > 420) this.pools.items = this.pools.items.filter(p => p.t <= 420);
    this.fin(this.pools, n);
    // blast flashes
    n = 0; this.flash.items = this.flash.items.filter(f => (f.t += dt) < 0.35);
    for (const f of this.flash.items) { const k = f.t / 0.35; v.set(f.x, f.z, -f.y); sc.setScalar(f.r * (0.3 + k * 0.6)); m.compose(v, q.identity(), sc); this.flash.mesh.setMatrixAt(n++, m); }
    this.flash.mesh.material.opacity = 0.85; this.fin(this.flash, n);
    // grenades in the air
    n = 0; this.nade.items = this.nade.items.filter(g => t < g.t1);
    for (const g of this.nade.items) { const k = Math.max(0, (t - g.t0) / (g.t1 - g.t0)), x = g.x0 + (g.x1 - g.x0) * k, y = g.y0 + (g.y1 - g.y0) * k, z = g.z0 + (g.z1 - g.z0) * k + Math.sin(k * Math.PI) * Math.max(3, Math.hypot(g.x1 - g.x0, g.y1 - g.y0) * 0.3);
      v.set(x, z, -y); sc.setScalar(1); m.compose(v, q.identity(), sc); this.nade.mesh.setMatrixAt(n, m); this.nade.mesh.setColorAt(n, col.setHex(0x2a3020)); n++; }
    this.fin(this.nade, n);
    this.smoke = this.smoke.filter(s => (s.left -= dt) > 0);
  }
  fin(P, n) { P.mesh.count = n; P.mesh.instanceMatrix.needsUpdate = true; if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true; }
  dispose() { for (const P of [this.spray, this.gibs, this.pools, this.flash, this.nade]) P.dispose(); }
}
