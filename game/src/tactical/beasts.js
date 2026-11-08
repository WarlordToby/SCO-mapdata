// Draws the non-human threats (mutants and the swarm) with their rigged models, plus what they leave and make:
// corpses, ichor and gibs, victims carried or dragged off, spit and gas globs in flight, gas and bile clouds,
// and the hive growing over buildings (resin nodules and spires, egg-nests, cocooned captives).
import * as THREE from 'three';
import { RIGS, LOOKS, GLOW, SL } from './beast-rigs.js';
import { CLIP } from './people.js';

const MAXJ = 28;
const ICHOR = [0x8a8a1a, 0x9aa024, 0x6a7014, 0xb0b040], ACID = [0x6a9a1a, 0x8ab828, 0x4a7a10, 0x9ad040];
const BLOODM = [0x5a0606, 0x6e0a0a, 0x4a0404, 0x7a1010];
const pack = h => (h >> 16 & 255) * 65536 + (h >> 8 & 255) * 256 + (h & 255);
const TIME = { value: 0 };

const VERT_HEAD = /* glsl */`
attribute float aJ; attribute float aSlot; attribute vec4 iA; attribute vec4 iB;
uniform vec4 uJ0[${MAXJ}]; uniform vec4 uJ1[${MAXJ}]; uniform vec4 uJ2[${MAXJ}]; uniform vec4 uJ3[${MAXJ}];
uniform float uTime; uniform vec3 uBeast; uniform vec3 uGlow;
varying vec3 vCol; varying vec3 vEm; varying vec3 vObj; varying float vWound;
vec3 unpackB(float f) { f = floor(f + 0.5); float r = floor(f / 65536.0), g = floor((f - r * 65536.0) / 256.0); return vec3(r, g, f - r * 65536.0 - g * 256.0) / 255.0; }
mat3 rotA(vec3 a, float t) { float c = cos(t), s = sin(t), C = 1. - c;
  return mat3(c + a.x * a.x * C, a.y * a.x * C + a.z * s, a.z * a.x * C - a.y * s,
              a.x * a.y * C - a.z * s, c + a.y * a.y * C, a.z * a.y * C + a.x * s,
              a.x * a.z * C + a.y * s, a.y * a.z * C - a.x * s, c + a.z * a.z * C); }
`;
const VERT_BODY = /* glsl */`
  vec3 transformed = vec3(position); vec3 objectNormal = vec3(normal);
  {
    float ph = iA.x, gait = iA.y, atk = iA.z, dead = clamp(iA.w, 0., 1.);
    int j = int(aJ + 0.5);
    for (int k = 0; k < 7; k++) {
      if (j < 0) break;
      vec4 a0 = uJ0[j], a1 = uJ1[j], a2 = uJ2[j], a3 = uJ3[j];
      float ang = a2.z + gait * a2.x * sin(ph * a1.w + a2.y) + (1. - gait) * (1. - dead) * a3.x * sin(uTime * 1.7 + a2.y * 1.3 + iB.w * 6.283);
      if (atk > 0.) ang += a2.w * sin(clamp(atk - a3.z, 0., 1.) * 3.14159);
      ang = mix(ang, a3.y, dead);
      mat3 R = rotA(a1.xyz, ang);
      transformed = R * (transformed - a0.xyz) + a0.xyz; objectNormal = R * objectNormal;
      j = int(a0.w + 0.5) - 1;
    }
    transformed.y += uBeast.x * gait * abs(sin(ph)) * (1. - dead);
    if (dead > 0.) { mat3 D = rotA(vec3(1., 0., 0.), uBeast.y * dead); transformed = D * transformed; objectNormal = D * objectNormal; transformed.y += uBeast.z * dead; }
  }
  int sl = int(aSlot + 0.5);
  vec3 base = unpackB(iB.x), acc = unpackB(iB.y);
  vCol = sl == 0 ? base : sl == 1 ? acc : sl == 2 ? base * 0.3 + vec3(0.02) : sl == 3 ? uGlow * 0.8 : sl == 4 ? vec3(0.45, 0.08, 0.07) : sl == 5 ? vec3(0.8, 0.76, 0.64) : vec3(0.2, 0.2, 0.22);
  vEm = sl == 3 ? uGlow * (0.45 + 0.2 * sin(uTime * 3. + iB.w * 20.)) * (1. - clamp(iA.w, 0., 1.) * 0.85) : vec3(0.);
  vWound = iB.z; vObj = position;
`;
const FRAG_HEAD = /* glsl */`
varying vec3 vCol; varying vec3 vEm; varying vec3 vObj; varying float vWound; uniform vec3 uWound;
float hB(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nB(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hB(i), hB(i + vec2(1, 0)), f.x), mix(hB(i + vec2(0, 1)), hB(i + vec2(1, 1)), f.x), f.y); }
`;
const FRAG_BODY = /* glsl */`
  vec3 pc = vCol * (0.8 + 0.4 * nB(vObj.xz * 6. + vObj.y * 2.7));
  if (vWound > 0.02) { float g = nB(vObj.xy * 8. + vObj.z * 5. + 2.); if (g > 1. - vWound * 0.6) pc = mix(pc, uWound, 0.8); }
  vec4 diffuseColor = vec4(pc, opacity);
`;

function beastMaterial(geo, glow, wound) {
  const J = geo.userData.joints, U = [0, 1, 2, 3].map(() => Array.from({ length: MAXJ }, () => new THREE.Vector4()));
  J.forEach((j, i) => { if (i >= MAXJ) return; U[0][i].set(j.p[0], j.p[1], j.p[2], j.parent + 1); U[1][i].set(j.axis[0], j.axis[1], j.axis[2], j.freq); U[2][i].set(j.amp, j.off, j.bias, j.atk); U[3][i].set(j.sway, j.dead, j.atkOff, 0); });
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const ud = geo.userData;
  m.userData.u = { uJ0: { value: U[0] }, uJ1: { value: U[1] }, uJ2: { value: U[2] }, uJ3: { value: U[3] }, uTime: TIME, uBeast: { value: new THREE.Vector3(ud.bob || 0, ud.deadRoll || 0, ud.deadDrop || 0) }, uGlow: { value: new THREE.Vector3(...glow) }, uWound: { value: new THREE.Vector3(...wound) } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <beginnormal_vertex>', VERT_BODY).replace('#include <begin_vertex>', '');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', FRAG_BODY).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vEm;');
  };
  m.customProgramCacheKey = () => 'beast-v1';
  return m;
}

class Herd { // instanced copies of one model
  constructor(scene, geo, mat, cap) {
    this.cap = cap; this.n = 0; const g = geo.clone();
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.b = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', this.a); g.setAttribute('iB', this.b);
    this.mesh = new THREE.InstancedMesh(g, mat, cap); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; this.mesh.frustumCulled = false; scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  put(x, y, z, h, s, A, B) {
    if (this.n >= this.cap) return; const i = this.n++;
    this._p.set(x, z, -y); this._q.setFromAxisAngle(this._up, h); this._s.setScalar(s); this._m.compose(this._p, this._q, this._s); this.mesh.setMatrixAt(i, this._m);
    const a = this.a.array, b = this.b.array, o = i * 4; a[o] = A[0]; a[o + 1] = A[1]; a[o + 2] = A[2]; a[o + 3] = A[3]; b[o] = B[0]; b[o + 1] = B[1]; b[o + 2] = B[2]; b[o + 3] = B[3];
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.a.needsUpdate = true; this.b.needsUpdate = true; this.n = 0; }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); }
}
class Props { // simple instanced props with per-instance colour (hive growths, globs, gas puffs)
  constructor(scene, geo, mat, cap) { this.cap = cap; this.n = 0; this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.setColorAt(0, new THREE.Color()); scene.add(this.mesh); this._m = new THREE.Matrix4(); this._c = new THREE.Color(); }
  put(m, col) { if (this.n >= this.cap) return; this.mesh.setMatrixAt(this.n, m); this.mesh.setColorAt(this.n, this._c.setHex(col)); this.n++; }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.n = 0; }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
const lumpy = (r, det, rough, sy = 1) => { const g = new THREE.IcosahedronGeometry(r, det), a = g.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i), k = 1 + rough * (Math.sin(x * 37.1 + y * 17.3 + z * 23.9) * 0.5); a.setXYZ(i, x * k, y * k * sy, z * k); } g.computeVertexNormals(); return g; };

export class Beasts {
  constructor(scene, sim, figs) {
    this.scene = scene; this.sim = sim; this.figs = figs; this.herds = new Map(); this.geos = new Map(); this.mats = new Map();
    this.corpses = []; this.globs = []; this.fxi = 0; this.lastT = sim.t; this.swarm = sim.threat === 'swarm';
    this.pal = this.swarm ? ICHOR : BLOODM;
    const lam = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
    this.resin = new Props(scene, lumpy(1, 1, 0.35), lam(0xffffff), 6000);
    this.spires = new Props(scene, (() => { const g = new THREE.ConeGeometry(0.5, 1, 6, 3); const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const y = a.getY(i), t = y + 0.5; a.setX(i, a.getX(i) + Math.sin(t * 5) * 0.12); a.setZ(i, a.getZ(i) + Math.cos(t * 4) * 0.1); } g.translate(0, 0.5, 0); g.computeVertexNormals(); return g; })(), lam(0xffffff), 1500);
    this.eggs = new Props(scene, lumpy(1, 1, 0.08, 1.35), lam(0xffffff, 0x2a1a04), 1500);
    this.cocoons = new Props(scene, lumpy(1, 1, 0.2, 2.4), lam(0xffffff), 1500);
    this.blobs = new Props(scene, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), 200);
    this.gasP = new Props(scene, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }), 1400);
    this.decorT = -1; this.decor = [];
    this._m = new THREE.Matrix4(); this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._e = new THREE.Euler(); this._up = new THREE.Vector3(0, 1, 0);
  }
  key(c) { return c.kind + (c.M ? 'M' : ''); }
  herd(key) {
    let h = this.herds.get(key); if (h) return h;
    const base = key.replace(/M$/, ''), g = this.geos.get(key) || RIGS[key](); this.geos.set(key, g);
    const glow = GLOW[base] || GLOW[this.swarm ? 'swarm' : 'mutant'], wound = this.swarm ? [0.55, 0.58, 0.12] : [0.36, 0.02, 0.02];
    const m = beastMaterial(g, glow, wound); this.mats.set(key, m);
    h = new Herd(this.scene, g, m, base === 'titan' ? 40 : base === 'crusher' || base === 'boiler' || base === 'warden' ? 300 : 2500); this.herds.set(key, h); return h;
  }
  look(c, base) { // each creature a little different in tone
    const L = LOOKS[base] || [0x888888, 0x666666], k = 0.86 + ((c.id * 0.618) % 1) * 0.26, w = ((c.id * 0.377) % 1 - 0.5) * 0.12;
    const tint = h => { const r = Math.min(255, (h >> 16 & 255) * k * (1 + w)), g = Math.min(255, (h >> 8 & 255) * k), b = Math.min(255, (h & 255) * k * (1 - w)); return (r | 0) * 65536 + (g | 0) * 256 + (b | 0); };
    return [tint(L[0]), c.M ? pack(this.swarm ? 0xd8b24a : L[1]) : tint(L[1])];
  }

  events() {
    const sim = this.sim, F = sim.fx, base = sim.fxBase || 0, G = this.figs.gore, h = (x, y) => this.hAt(x, y);
    for (let i = Math.max(0, this.fxi - base); i < F.length; i++) {
      const e = F[i]; this.fxi = base + i + 1;
      if (e.k === 'hit') { const c = e.c; if (!c.kind) continue; const dx = c.x - e.from[0], dy = c.y - e.from[1], d = Math.hypot(dx, dy) || 1, sz = c.K?.size || 1; if (Math.random() < (e.by === 'rifle' ? 0.4 : 0.85)) G.blood(c.x, c.y, h(c.x, c.y) + sz * 0.6, e.by === 'rifle' ? 3 : e.by === 'cannon' ? 16 : 7, dx / d, dy / d, e.by === 'rifle' ? 2.5 : 4, this.pal); }
      else if (e.k === 'cdie') {
        const c = e.c; if (!c.kind) continue; const z = h(c.x, c.y), sz = c.K?.size || 1;
        if (c.burst) continue; // bloaters leave nothing whole
        if ((e.by === 'cannon' || e.by === 'blast') && sz < 2 && G.level >= 2 && Math.random() < 0.5) { G.gib(c.x, c.y, z, 18 * sz, 7, this.pal); G.blood(c.x, c.y, z + 0.8, 16, 0, 0, 5, this.pal); continue; }
        G.pool(c.x, c.y, z, 0.6 * sz + 0.3, 8, this.pal); G.blood(c.x, c.y, z + sz * 0.5, 8, 0, 0, 2.5, this.pal);
        this.corpses.push({ key: this.key(c), base: c.kind, x: c.x, y: c.y, h: c._bm?.h ?? 0, t: sim.t, look: this.look(c, c.kind), s: c.M ? 1.8 : 1, seed: (c.id * 0.618) % 1, drag: null });
        if (this.corpses.length > 900) this.corpses.shift();
      }
      else if (e.k === 'burst') { const z = h(e.x, e.y); G.boom(e.x, e.y, z, e.r * 0.6); G.gib(e.x, e.y, z, 40, 9, BLOODM); G.blood(e.x, e.y, z + 1, 40, 0, 0, 7, ACID); for (let k = 0; k < 6; k++) G.pool(e.x + (Math.random() - .5) * e.r, e.y + (Math.random() - .5) * e.r, z, 0.5 + Math.random(), 2, ACID); }
      else if (e.k === 'spit') this.globs.push({ x0: e.from[0], y0: e.from[1], x1: e.to[0], y1: e.to[1], t0: sim.t, t1: e.t1, arc: 0.18, col: 0x9ad040, r: 0.18, splat: ACID });
      else if (e.k === 'lob') this.globs.push({ x0: e.from[0], y0: e.from[1], x1: e.to[0], y1: e.to[1], t0: sim.t, t1: e.t1, arc: 0.45, col: 0xc8e04a, r: 0.35, splat: null });
      else if (e.k === 'gasHit') G.boom(e.x, e.y, h(e.x, e.y), 2);
      else if (e.k === 'smash') { const z = h(e.x, e.y); G.boom(e.x, e.y, z, e.small ? 2 : 4); if (!e.small) G.blood(e.x, e.y, z + 1, 14, 0, 0, 4); }
      else if (e.k === 'carSmash') { const z = h(e.x, e.y); G.boom(e.x, e.y, z, 3); G.burn(e.x, e.y, z + 0.8, 60, 0.8); }
      else if (e.k === 'molt') { const c = e.c; this.corpses.push({ key: e.from || c.kind, base: e.from || c.kind, x: c.x - (c.hx || 1) * 0.8, y: c.y - (c.hy || 0) * 0.8, h: c._bm?.h ?? 0, t: sim.t, look: [pack(0xb8a888), pack(0x9a8a6a)], s: 1, seed: 0.3, husk: true }); G.pool(c.x, c.y, h(c.x, c.y), 0.8, 3, ICHOR); }
      else if (e.k === 'hatch') G.pool(e.c.x, e.c.y, h(e.c.x, e.c.y), 0.4, 2, ICHOR);
      else if (e.k === 'hiveBurn') { const b = e.b; G.burn(b.ent[0], b.ent[1], b.z + 1, 40, 1.4); this.decorT = -1; }
      else if (e.k === 'cocoon') this.decorT = -1;
    }
  }

  update({ heightAt, view, far, scale, draw = true }) {
    this.hAt = heightAt; const sim = this.sim, t = sim.t, dt = Math.max(0, t - this.lastT); this.lastT = t; TIME.value = t;
    this.events();
    const [vx, vy, vr] = view, inView = (x, y, p = 0) => (x - vx) ** 2 + (y - vy) ** 2 < (vr + p) ** 2;
    const sc = Math.max(1, scale * 0.85);
    const W = this.figs.W;
    if (draw && !far) {
      for (const c of sim.creatures) {
        if (c.inB || c.hp <= 0) continue;
        const m = c._bm || (c._bm = { x: c.x, y: c.y, v: 0, h: Math.random() * 6.28, ph: Math.random() * 6 });
        if (dt > 0) { const dx = c.x - m.x, dy = c.y - m.y, d = Math.hypot(dx, dy), v = d / dt; m.v += (Math.min(v, 20) - m.v) * Math.min(1, dt * 6); if (d > 0.02) { const th = Math.atan2(dy, dx); let dh = th - m.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); m.h += dh * Math.min(1, dt * (c.kind === 'titan' ? 2 : 8)); } m.x = c.x; m.y = c.y; m.ph += dt * m.v / (c.K?.stride || 1.2) * Math.PI * (c.M ? 0.6 : 1); }
        if (!c.vis || !inView(c.x, c.y, 10)) continue;
        const K = c.K || {}, tg = c.target?.u; let h = m.h;
        if (c.atk > 0.2 && tg) h = Math.atan2(tg.y - c.y, tg.x - c.x);
        const atkP = c.atk > 0 && c.atk <= 1 ? Math.min(1, (1 - c.atk) / 0.6) : 0;
        const gait = c.charge ? 1 : Math.min(1, m.v / Math.max(0.6, (K.speed || 2) * 0.5));
        const ph = c.charge ? m.ph * 1.6 : m.ph;
        const z = heightAt(c.x, c.y), s = (c.M ? 1.8 : 1) * (K.size >= 2 ? 1 : sc);
        this.herd(this.key(c)).put(c.x, c.y, z, h, s, [ph, gait, atkP, 0], [...this.look(c, c.kind), Math.max(0, 1 - c.hp / c.max) * 0.9, (c.id * 0.618) % 1]);
        // victims carried or dragged
        if (c.carry && draw) {
          if (c.carry.drag) { const p = c.carry.drag, f = p._fig || (p._fig = W.civ(p.id)), bx = c.x - Math.cos(h) * 1.6, by = c.y - Math.sin(h) * 1.6; this.figs.crowd('dead', f.key).put(bx, by, heightAt(bx, by), h + Math.PI, f.scale * sc, f.look, CLIP.dragged, t, 1, 0.3, { wound: 0.7 }); }
          else if (c.carry.n) { const n = Math.min(3, c.carry.n), off = c.M ? 1.4 : 0.8; for (let i = 0; i < n; i++) { const f = W.civ(c.carry.seeds[i]), ox = Math.cos(h) * off - Math.sin(h) * (i - (n - 1) / 2) * 0.5, oy = Math.sin(h) * off + Math.cos(h) * (i - (n - 1) / 2) * 0.5; this.figs.crowd('dead', f.key).put(c.x + ox, c.y + oy, z + (c.M ? 0.9 : 0.25), h + Math.PI / 2, f.scale * sc, f.look, CLIP.lifted, t - i, 1, 0.5, { wound: 0.2 }); } }
        }
      }
      // the dead: fold up over a second, then lie
      this.corpses = this.corpses.filter(k => t - k.t < 300);
      for (const k of this.corpses) { if (!inView(k.x, k.y, 10)) continue; const st = Math.min(1, (t - k.t) / 0.9); this.herd(k.key).put(k.x, k.y, heightAt(k.x, k.y), k.h, k.s * ((RIGS[k.base] && (k.base === 'titan' || k.base === 'crusher')) ? 1 : sc), [0, 0, 0, st], [...k.look, k.husk ? 0 : 0.6, k.seed]); }
    }
    for (const hd of this.herds.values()) hd.end();
    this.drawFx(dt, t, heightAt, inView, draw && !far);
    this.drawHive(t, heightAt, inView, draw);
  }

  drawFx(dt, t, heightAt, inView, draw) {
    const m = this._m, v = this._v, q = this._q, s = this._s, G = this.figs.gore;
    // globs in flight
    this.globs = this.globs.filter(g => { if (t >= g.t1) { if (g.splat) G.pool(g.x1, g.y1, heightAt(g.x1, g.y1), 0.5, 1.5, g.splat); return false; } return true; });
    if (draw) for (const g of this.globs) { const k = Math.max(0, (t - g.t0) / Math.max(0.05, g.t1 - g.t0)), x = g.x0 + (g.x1 - g.x0) * k, y = g.y0 + (g.y1 - g.y0) * k, L = Math.hypot(g.x1 - g.x0, g.y1 - g.y0), z = heightAt(x, y) + 1.5 + Math.sin(k * Math.PI) * L * g.arc; v.set(x, z, -y); s.setScalar(g.r); m.compose(v, q.identity(), s); this.blobs.put(m, g.col); }
    this.blobs.end();
    // gas and bile clouds: churning puffs
    if (draw) for (const c of this.sim.gas || []) {
      if (!inView(c.x, c.y, c.r)) continue; const k = Math.min(1, (c.t1 - t) / 4), z = heightAt(c.x, c.y), n = Math.min(14, 5 + Math.round(c.r));
      for (let i = 0; i < n; i++) { const a = i * 2.4 + t * 0.15 * (i % 2 ? 1 : -1), rr = c.r * (0.25 + (i % 5) * 0.16), pz = z + 0.6 + (i % 3) * 0.7 + Math.sin(t * 0.7 + i) * 0.3; v.set(c.x + Math.cos(a) * rr, pz, -(c.y + Math.sin(a) * rr)); s.setScalar((1.4 + (i % 4) * 0.5) * (0.6 + 0.4 * k) * (c.r / 8)); m.compose(v, q.identity(), s); this.gasP.put(m, c.kind === 'bile' ? 0x9ab040 : 0xc8c850); }
    }
    this.gasP.end();
  }

  // resin growths, egg-nests and cocoons, rebuilt when a hive changes (cheap: once a second at most)
  drawHive(t, heightAt, inView, draw) {
    const H = this.sim.hive; if (!H) return;
    if (t - this.decorT > 1) { this.decorT = t; this.decor = [...H.hives].filter(b => !b.destroyed && (b.hive || 0) > 0.05).map(b => this.hiveDecor(b)); }
    if (!draw) { for (const P of [this.resin, this.spires, this.eggs, this.cocoons]) P.end(); return; }
    for (const D of this.decor) { if (!inView(D.x, D.y, 40)) continue; for (const [P, mm, col] of D.items) P.put(mm, col); }
    for (const P of [this.resin, this.spires, this.eggs, this.cocoons]) P.end();
  }
  hiveDecor(b) {
    const items = [], R = b.ring, n = R.length, lvl = Math.min(1, b.hive), z0 = b.z, top = b.z1 ?? (b.z + b.h);
    let seed = (b.idx || 1) * 9301 + 49297; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const mk = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { this._e.set(rx, ry, rz); this._q.setFromEuler(this._e); this._v.set(x, z, -y); this._s.set(sx, sy, sz); return new THREE.Matrix4().compose(this._v, this._q, this._s); };
    const per = []; let L = 0; for (let i = 0; i < n; i++) { const a = R[i], c = R[(i + 1) % n], l = Math.hypot(c[0] - a[0], c[1] - a[1]); per.push([a, c, l, L]); L += l; }
    const at = u => { u = (u % L + L) % L; for (const [a, c, l, s0] of per) if (u <= s0 + l) { const k = (u - s0) / Math.max(1e-3, l); return [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, Math.atan2(c[1] - a[1], c[0] - a[0])]; } return [R[0][0], R[0][1], 0]; };
    // resin creeping up the walls and over the roof edge
    const nN = Math.round(Math.min(60, 6 + L * 0.5) * lvl);
    for (let i = 0; i < nN; i++) { const p = at(rnd() * L), hh = (top - z0) * Math.min(1, rnd() * lvl * 1.3), r = 0.6 + rnd() * 1.4; items.push([this.resin, mk(p[0], p[1], z0 + hh, r, r * (0.7 + rnd() * 0.8), r, rnd(), rnd() * 6, rnd()), rnd() < 0.5 ? 0x5a3e16 : 0x6e4c1c]); }
    if (lvl > 0.5) { const nS = Math.round(Math.min(10, 2 + Math.sqrt(b.area || 100) * 0.25) * (lvl - 0.4)); for (let i = 0; i < nS; i++) { const p = at(rnd() * L), k = rnd(), cx = b.c[0] + (p[0] - b.c[0]) * k, cy = b.c[1] + (p[1] - b.c[1]) * k, hh = 3 + rnd() * 6 * lvl; items.push([this.spires, mk(cx, cy, top - 0.3, 0.8 + rnd() * 0.8, hh, 0.8 + rnd() * 0.8, (rnd() - 0.5) * 0.3, rnd() * 6, (rnd() - 0.5) * 0.3), 0x4a3212]); items.push([this.resin, mk(cx, cy, top, 1.4, 0.7, 1.4, 0, rnd() * 6, 0), 0x5a3e16]); } }
    // egg-nests heaped at the entrance
    for (let k = 0; k < (b.eggs || 0); k++) for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = 0.6 + rnd() * 2.2 + k * 0.8, x = b.ent[0] + Math.cos(a) * r, y = b.ent[1] + Math.sin(a) * r, s = 0.32 + rnd() * 0.14; items.push([this.eggs, mk(x, y, this.hAt(x, y) + s * 1.1, s, s, s, (rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4), 0xd8b25a]); }
    // cocooned captives hanging on the walls
    const nc = Math.min(30, b.cocoons?.length || 0);
    for (let i = 0; i < nc; i++) { const p = at((i * 0.618 * L + 3) % L), hh = Math.min(top - z0 - 1.2, 1.2 + (i % 4) * 2.4), nx = Math.sin(p[2]), ny = -Math.cos(p[2]); items.push([this.cocoons, mk(p[0] + nx * 0.5, p[1] + ny * 0.5, z0 + Math.max(1, hh), 0.42, 0.42, 0.42, 0, rnd() * 6, (rnd() - 0.5) * 0.2), 0xd6ccb0]); }
    return { x: b.c[0], y: b.c[1], items };
  }
  dispose() { for (const h of this.herds.values()) h.dispose(); for (const g of this.geos.values()) g.dispose(); for (const m of this.mats.values()) m.dispose(); for (const P of [this.resin, this.spires, this.eggs, this.cocoons, this.blobs, this.gasP]) P.dispose(); }
}
export { beastMaterial, Herd, TIME };
