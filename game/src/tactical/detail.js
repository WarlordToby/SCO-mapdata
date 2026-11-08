// Close-up buildings: the blocks near the camera (and any that are selected, occupied or holed) are rebuilt with real
// facades and real interiors in place of their simple box. Facades have window openings with sills, reveals and
// lintels (windows stop well short of the ceiling), glass you can see through (it shatters when shot through),
// balconies on flats, shopfronts on the ground floor, floor bands; inside are the floor slabs, partitions with
// doorways between sections, stairs in the core and, when you look in, furniture. Floors above the action can be cut
// away to look inside. Sections that have been knocked out leave real holes.
import * as THREE from 'three';
import { layout, secAt } from './interior.js';
import { U } from './look.js';

const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
const inPoly = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const INTERIOR = { office: [0x8c9196, 0xd8d6d0], flat: [0x8a6a4c, 0xe2dccf], house: [0x8a6a4c, 0xe2dccf], shop: [0xb4b0a4, 0xe8e6e0], core: [0x6e6e6e, 0xb8b6b0] };

function detailMat() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });
  m.onBeforeCompile = sh => { // the inside faces of the shell read as plaster
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.78, 0.74), 0.75);`);
  };
  m.customProgramCacheKey = () => 'detail-v1'; return m;
}
function glassMat() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = U.uNight;
    sh.vertexShader = 'attribute float aLit; varying float vLit;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLit = aLit;');
    sh.fragmentShader = 'uniform float uNight; varying float vLit;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.8, 0.5) * vLit * uNight * 0.9;').replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity + vLit * uNight * 0.35 );');
  };
  m.customProgramCacheKey = () => 'glass-v1'; return m;
}

class GeoBuf {
  constructor() { this.p = []; this.c = []; this.l = []; }
  tri(a, b, d, col, lit = 0) { for (const q of [a, b, d]) { this.p.push(q[0], q[2], -q[1]); this.c.push(col.r, col.g, col.b); this.l.push(lit); } }
  quad(a, b, d, e, col, lit = 0) { this.tri(a, b, d, col, lit); this.tri(a, d, e, col, lit); }
  // a box from corner points along an edge frame: origin o, along t, out n, up z
  box(o, t, n, t0, t1, n0, n1, z0, z1, col) {
    const P = (tt, nn, zz) => [o[0] + t[0] * tt + n[0] * nn, o[1] + t[1] * tt + n[1] * nn, zz];
    const c = [P(t0, n0, z0), P(t1, n0, z0), P(t1, n1, z0), P(t0, n1, z0), P(t0, n0, z1), P(t1, n0, z1), P(t1, n1, z1), P(t0, n1, z1)];
    const F = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [3, 2, 1, 0]];
    for (const f of F) this.quad(c[f[0]], c[f[1]], c[f[2]], c[f[3]], col);
  }
  build(lit) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); if (lit) g.setAttribute('aLit', new THREE.Float32BufferAttribute(this.l, 1)); g.computeVertexNormals(); g.computeBoundingSphere(); return g; }
}

export class DetailBuildings {
  constructor(scene, city, sim, R) {
    this.scene = scene; this.city = city; this.sim = sim; this.R = R; this.on = new Map(); this.mat = detailMat(); this.glass = glassMat();
    this.cut = new Map(); this.manualCut = new Map(); this.t = 0;
  }
  useOf(b) { return this.city.codes.use[b.use] || ''; }
  // which buildings get the close-up treatment this frame
  wanted(target, dist, selB) {
    const C = this.city, out = new Map(), [tx, ty] = target;
    if (dist < 520) { const rad = Math.max(70, Math.min(240, dist * 0.75)), cand = [];
      C.bGrid.near(tx, ty, rad, i => { const b = C.buildings[i]; if (!b.destroyed && b.mesh && b.ring.length < 260) cand.push([Math.hypot(b.c[0] - tx, b.c[1] - ty), b]); });
      cand.sort((a, b) => a[0] - b[0]); for (const [, b] of cand.slice(0, dist < 200 ? 40 : 24)) out.set(b, 1); }
    if (selB && !selB.destroyed && selB.mesh) out.set(selB, 1);
    // holed buildings stay holed wherever you look from, while they are in view
    for (const b of this.sim.damaged || []) if (b.secHoles && !b.destroyed && b.mesh && out.size < 80 && Math.hypot(b.c[0] - tx, b.c[1] - ty) < Math.max(700, dist * 1.4)) out.set(b, 1);
    return out;
  }
  // floors above the action are cut away: selected buildings, and occupied ones when the camera is close
  cutFor(b, dist, selB) {
    const L = b.L; if (!L) return Infinity;
    if (this.manualCut.has(b)) return this.manualCut.get(b);
    const near = b === selB ? dist < 600 : dist < 160;
    if (!near || !b.inside?.size) return Infinity;
    let top = -1; for (const o of b.inside) if (o.sec && (o.kind ? !o.dead : o.hp > 0)) top = Math.max(top, o.sec.f);
    return top >= 0 ? top + 1 : Infinity;
  }
  stepCut(b, d) { const L = this.sim.layoutOf(b), cur = this.manualCut.get(b) ?? this.cut.get(b) ?? L.floors; const n = Math.max(1, Math.min(L.floors, (cur === Infinity ? L.floors : cur) + d)); if (n >= L.floors) this.manualCut.delete(b); else this.manualCut.set(b, n); }
  update(target, dist, selB, dt) {
    this.t += dt;
    const want = this.wanted(target, dist, selB);
    for (const [b, e] of this.on) if (!want.has(b)) { this.drop(b); }
    let builds = 0;
    for (const b of want.keys()) {
      const L = this.sim.layoutOf(b), cut = Math.min(L.floors, this.cutFor(b, dist, selB)), e = this.on.get(b);
      const focus = b === selB || cut < L.floors;
      if (e && e.ver === L.ver && e.cut === cut && e.focus === focus) continue;
      if (e && this.t - e.t < 0.35 && e.cut === cut) continue; // throttle rebuilds while a fight changes the building
      if (builds >= (e ? 3 : 2)) continue; builds++;
      this.build(b, L, cut, focus);
    }
  }
  has(b) { return this.on.has(b); }
  cutOf(b) { return this.on.get(b)?.cut ?? Infinity; }
  drop(b) { const e = this.on.get(b); if (!e) return; this.scene.remove(e.g); e.solid.geometry.dispose(); e.glass.geometry.dispose(); this.on.delete(b); this.R.hideCoarse(b, false); }
  dispose() { for (const b of [...this.on.keys()]) this.drop(b); this.mat.dispose(); this.glass.dispose(); }

  build(b, L, cut, focus) {
    const old = this.on.get(b); if (old) { this.scene.remove(old.g); old.solid.geometry.dispose(); old.glass.geometry.dispose(); }
    const roofTris = this.R.coarseRoof(b); // the roof shapes from the simple model, kept as they were
    this.R.hideCoarse(b, true);
    const S = new GeoBuf(), G = new GeoBuf(), use = this.useOf(b), col = new THREE.Color(), seed = (Math.abs(b.osm || b.idx || 1) * 2654435761 >>> 0) % 997;
    const wallC = (b.baseCol || new THREE.Color(0xc8c0b0)).clone(), trimC = wallC.clone().multiplyScalar(0.82), darkC = new THREE.Color(0x2a2c30), glassC = new THREE.Color(0x5a6a78), railC = new THREE.Color(0x3a3c40), slabC = wallC.clone().multiplyScalar(0.7);
    const office = /office|commercial|industrial|civic|school|hospital|hotel|government|public|university|college/.test(use), resi = !office && !/religious|industrial|warehouse/.test(use);
    const fh = L.fh, z0 = L.z0, nf = L.floors, fTop = Math.min(nf, cut), cutting = fTop < nf;
    const bay = office ? 3.3 : 2.8, winW = office ? 2.2 : 1.25, sill = office ? 0.85 : 0.9, head = Math.min(fh - 0.55, office ? 2.45 : 2.2);
    const balcony = resi && nf >= 3 && hash(seed, 3) < 0.6, cornice = hash(seed, 5) < 0.5, shopfront = L.sections.some(s => s.f === 0 && s.type === 'shop');
    const secFor = (x, y, f) => { const u = x * L.ux + y * L.uy; let best = null; for (const k of L.kList) { const s = secAt(L, f, k); if (s && u >= s.u0 - 1.2 && u <= s.u1 + 1.2 && (!best || Math.abs((s.u0 + s.u1) / 2 - u) < Math.abs((best.u0 + best.u1) / 2 - u))) best = s; } return best; };
    const [cx, cy] = b.c;
    for (const ring of [b.ring, ...(b.holes || [])]) {
      const inner = ring !== b.ring;
      for (let e = 0; e < ring.length; e++) {
        const a = ring[e], d = ring[(e + 1) % ring.length], l = Math.hypot(d[0] - a[0], d[1] - a[1]); if (l < 0.3) continue;
        const t = [(d[0] - a[0]) / l, (d[1] - a[1]) / l]; let n = [t[1], -t[0]]; const mx = (a[0] + d[0]) / 2, my = (a[1] + d[1]) / 2;
        if (inPoly(mx + n[0] * 0.3, my + n[1] * 0.3, b.ring) !== inner) n = [-n[0], -n[1]]; // outward
        const P = (tt, zz, nn = 0) => [a[0] + t[0] * tt + n[0] * nn, a[1] + t[1] * tt + n[1] * nn, zz];
        const nb = l > 1.6 ? Math.max(1, Math.round(l / bay)) : 0, bw = nb ? l / nb : l;
        for (let f = 0; f < fTop; f++) {
          const zA = z0 + f * fh, zB = zA + fh;
          if (!nb) { const s = secFor(mx, my, f); if (s?.dead) continue; S.quad(P(0, zA), P(l, zA), P(l, zB), P(0, zB), wallC); continue; }
          for (let i = 0; i < nb; i++) {
            const ta = i * bw, tb = ta + bw, tm = (ta + tb) / 2, pc = P(tm, 0), s = secFor(pc[0], pc[1], f);
            if (s?.dead) continue; // knocked out: a hole
            const shop = f === 0 && shopfront && !inner, door = f === 0 && !shop && i === Math.floor(nb / 2) && e === 0;
            const balc = balcony && f >= 1 && !inner && l > 5 && (i % 2 === (seed & 1)) && hash(seed, e, i) < 0.85;
            const ww = shop ? bw * 0.86 : Math.min(winW, bw * 0.62), sl = shop ? 0.35 : door ? 0 : balc ? 0.02 : sill, hd = shop ? Math.min(fh - 0.4, 2.9) : door ? 2.25 : head;
            const wl = tm - ww / 2, wr = tm + ww / 2;
            // wall around the opening: below the sill, above the lintel, the piers either side
            if (sl > 0.01) S.quad(P(ta, zA), P(tb, zA), P(tb, zA + sl), P(ta, zA + sl), wallC);
            S.quad(P(ta, zA + hd), P(tb, zA + hd), P(tb, zB), P(ta, zB), wallC);
            S.quad(P(ta, zA + sl), P(wl, zA + sl), P(wl, zA + hd), P(ta, zA + hd), wallC);
            S.quad(P(wr, zA + sl), P(tb, zA + sl), P(tb, zA + hd), P(wr, zA + hd), wallC);
            // reveals: the opening has depth (wall thickness)
            const dep = -0.28; S.quad(P(wl, zA + sl), P(wl, zA + sl, dep), P(wl, zA + hd, dep), P(wl, zA + hd), trimC); S.quad(P(wr, zA + sl, dep), P(wr, zA + sl), P(wr, zA + hd), P(wr, zA + hd, dep), trimC);
            S.quad(P(wl, zA + hd), P(wr, zA + hd), P(wr, zA + hd, dep), P(wl, zA + hd, dep), trimC);
            if (sl > 0.2) S.box(a, t, n, wl - 0.06, wr + 0.06, -0.05, 0.09, zA + sl - 0.06, zA + sl, trimC); // sill
            // the glass (gone where the windows were shot out)
            const broken = s && hash(seed + f, e, i) > s.glass;
            if (!broken) G.quad(P(wl, zA + sl, -0.18), P(wr, zA + sl, -0.18), P(wr, zA + hd, -0.18), P(wl, zA + hd, -0.18), glassC, office ? (hash(i, f, seed) < 0.45 ? 1 : 0) : (hash(i, f, seed + 1) < 0.3 ? 1 : 0));
            if (!broken && !shop) S.box(a, t, n, tm - 0.025, tm + 0.025, -0.2, -0.16, zA + sl, zA + hd, darkC); // mullion
            if (balc) { // balcony slab with a railing
              const bw2 = ww + 0.7, b0 = tm - bw2 / 2, b1 = tm + bw2 / 2;
              S.box(a, t, n, b0, b1, 0, 1.15, zA - 0.06, zA + 0.1, slabC);
              S.box(a, t, n, b0, b1, 1.1, 1.15, zA + 0.1, zA + 1.05, railC); S.box(a, t, n, b0, b0 + 0.05, 0, 1.15, zA + 0.1, zA + 1.05, railC); S.box(a, t, n, b1 - 0.05, b1, 0, 1.15, zA + 0.1, zA + 1.05, railC);
            }
          }
          if (cornice && f > 0 && !inner) S.box(a, t, n, 0, l, 0, 0.12, zA - 0.12, zA, trimC); // floor band
        }
        // parapet or the cut edge
        if (!cutting) { const top = b.zEave ?? (z0 + nf * fh); if (b.zEave && (b.z1 - b.zEave) < 0.3 && b.area > 150) S.quad(P(0, top), P(l, top), P(l, top + 0.8), P(0, top + 0.8), wallC); }
      }
    }
    // inside: floor slabs, the cut-edge slab, partitions with doorways, stairs, furniture when looked at
    for (const s of L.sections) {
      if (s.f > fTop || s.dead) continue;
      const [floorHex, wallHex] = INTERIOR[s.type] || INTERIOR.flat, fz = s.z + 0.02;
      col.setHex(floorHex).multiplyScalar(0.92 + hash(s.id, seed) * 0.12);
      if (s.f < fTop) triangulate(s.poly, (p0, p1, p2) => S.tri([p0[0], p0[1], fz], [p1[0], p1[1], fz], [p2[0], p2[1], fz], col));

      if (s.f >= fTop) continue;
      // partition at the section's far end, with a doorway in the middle
      const nxt = secAt(L, s.f, L.kList[L.kList.indexOf(s.k) + 1]);
      if (nxt) { const seg = crossLine(b.ring, L.ux, L.uy, s.u1); if (seg) { const [p, q] = seg, len = Math.hypot(q[0] - p[0], q[1] - p[1]), tt = [(q[0] - p[0]) / len, (q[1] - p[1]) / len], m0 = len / 2 - 0.55, m1 = len / 2 + 0.55, Q = (u, z) => [p[0] + tt[0] * u, p[1] + tt[1] * u, z]; col.setHex(wallHex);
        if (!nxt.dead) { S.quad(Q(0, s.z), Q(m0, s.z), Q(m0, s.z + fh - 0.05), Q(0, s.z + fh - 0.05), col); S.quad(Q(m1, s.z), Q(len, s.z), Q(len, s.z + fh - 0.05), Q(m1, s.z + fh - 0.05), col); S.quad(Q(m0, s.z + 2.1), Q(m1, s.z + 2.1), Q(m1, s.z + fh - 0.05), Q(m0, s.z + fh - 0.05), col); } } }
      if (s.type === 'core') { col.setHex(0x8a8884); const o = [s.cx, s.cy], t = [L.ux, L.uy], n = [-L.uy, L.ux]; for (let k = 0; k < 8; k++) S.box(o, t, n, -1.6 + k * 0.4, -1.2 + k * 0.4, -0.6, 0.6, s.z, s.z + (k + 1) * fh / 8, col); }
      if (focus && s.type !== 'core') furnish(S, s, L, seed, col);
    }
    // the roof, unless it has been cut away (and not over sections that are gone)
    if (!cutting && roofTris) { const topDead = L.sections.filter(s => s.f === nf - 1 && s.dead); for (const tr of roofTris) { const mcx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3, mcy = (tr[0][1] + tr[1][1] + tr[2][1]) / 3; if (topDead.some(s => inPoly(mcx, mcy, s.poly))) continue; col.setRGB(tr[3][0], tr[3][1], tr[3][2]); S.tri(tr[0], tr[1], tr[2], col); } }
    const solid = new THREE.Mesh(S.build(false), this.mat), glass = new THREE.Mesh(G.build(true), this.glass);
    solid.castShadow = true; solid.receiveShadow = true; solid.userData.bld = b; glass.renderOrder = 2;
    const g = new THREE.Group(); g.add(solid); g.add(glass); this.scene.add(g);
    this.on.set(b, { g, solid, glass, ver: L.ver, cut, focus, t: this.t });
  }
  pickMeshes() { return [...this.on.values()].map(e => e.solid); }
}
// the line u = k across the footprint: its two crossing points
function crossLine(ring, ux, uy, k) {
  const pts = []; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length], dp = p[0] * ux + p[1] * uy - k, dq = q[0] * ux + q[1] * uy - k; if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } }
  if (pts.length < 2) return null; pts.sort((a, b) => (-a[0] * uy + a[1] * ux) - (-b[0] * uy + b[1] * ux)); return [pts[0], pts[pts.length - 1]];
}
function triangulate(ring, cb) {
  if (ring.length < 3) return; const v = ring.map(p => new THREE.Vector2(p[0], p[1])); let f; try { f = THREE.ShapeUtils.triangulateShape(v, []); } catch { return; }
  for (const t of f) cb(ring[t[0]], ring[t[1]], ring[t[2]]);
}
// a few pieces of furniture so a floor reads as an office, a flat or a shop
function furnish(S, s, L, seed, col) {
  const t = [L.ux, L.uy], n = [-L.uy, L.ux], o = [s.cx, s.cy], z = s.z, w = Math.min(4, Math.sqrt(s.a) * 0.3);
  const items = s.type === 'office' ? 6 : s.type === 'shop' ? 4 : 4;
  for (let i = 0; i < items; i++) {
    const du = (hash(s.id, i, seed) - 0.5) * w * 1.6, dv = (hash(i, s.id, seed + 3) - 0.5) * w * 1.6;
    if (!inPoly(o[0] + t[0] * du + n[0] * dv, o[1] + t[1] * du + n[1] * dv, s.poly)) continue;
    if (s.type === 'office') { col.setHex(0x9a9690); S.box(o, t, n, du - 0.8, du + 0.8, dv - 0.4, dv + 0.4, z + 0.7, z + 0.76, col); col.setHex(0x3a3a3e); S.box(o, t, n, du - 0.05, du + 0.05, dv - 0.05, dv + 0.05, z, z + 0.7, col); col.setHex(0x222428); S.box(o, t, n, du - 0.25, du + 0.25, dv + 0.1, dv + 0.14, z + 0.76, z + 1.1, col); }
    else if (s.type === 'shop') { col.setHex(0xc8c4b8); S.box(o, t, n, du - 1.2, du + 1.2, dv - 0.3, dv + 0.3, z, z + 1.5, col); }
    else { col.setHex(hash(i, seed) < 0.5 ? 0x6a5a7a : 0x7a6a4a); S.box(o, t, n, du - 0.9, du + 0.9, dv - 0.45, dv + 0.45, z, z + 0.45, col); }
  }
}
// where to stand n people in a section (deterministic, inside its outline)
export function spots(s, n, L, salt = 0) {
  const out = [], t = [L.ux, L.uy], nn = [-L.uy, L.ux], w = Math.min(6, Math.sqrt(s.a) * 0.35);
  for (let i = 0, tries = 0; out.length < n && tries < n * 6; tries++, i++) { const du = (hash(s.id, i, salt) - 0.5) * w * 2, dv = (hash(i, s.id, salt + 7) - 0.5) * w * 2, x = s.cx + t[0] * du + nn[0] * dv, y = s.cy + t[1] * du + nn[1] * dv; if (inPoly(x, y, s.poly)) out.push([x, y]); }
  while (out.length < n) out.push([s.cx, s.cy]);
  return out;
}
