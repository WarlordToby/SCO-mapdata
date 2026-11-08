// Vehicle modelling kit: builds faceted low-poly vehicles from cross-sections (lofts), extruded side profiles,
// chamfered blocks, lathed wheels, track runs and tubes, each vertex tagged with a moving part (hull, turret,
// gun, rotors, door, wheel axles, track band) and a material slot. One shader poses the parts per instance
// (turret traverse, gun elevation and recoil, rolling wheels, scrolling tracks, spinning rotors, opening doors,
// a turret blown off a wreck) and paints them (national camouflage, markings, police and service liveries,
// damage and burning).
import * as THREE from 'three';

export const VP = { hull: 0, turret: 1, gun: 2, rotor: 3, tail: 4, door: 5, doorR: 6, track: 7, rotor2: 8, axle: 10 };
export const VS = { paint: 0, rubber: 1, metal: 2, glass: 3, light: 4, trim: 5, flag: 6, black: 7, beacon: 8, canvas: 9, hub: 10, chrome: 11, red: 12, interior: 13, livery: 14, amber: 15 };

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class VB {
  constructor() { this.P = []; this.N = []; this.A = []; this.S = []; this.U = []; this.axles = []; this.piv = {}; }
  // one flat-shaded triangle; normal faces away from `out` (a point inside the solid) when given
  tri(a, b, c, part, slot, out, uv) {
    let ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-9) return; n = n.map(x => x / l);
    if (out) { const m = [(a[0] + b[0] + c[0]) / 3 - out[0], (a[1] + b[1] + c[1]) / 3 - out[1], (a[2] + b[2] + c[2]) / 3 - out[2]]; if (m[0] * n[0] + m[1] * n[1] + m[2] * n[2] < 0) { n = n.map(x => -x); [b, c] = [c, b]; uv && ([uv[1], uv[2]] = [uv[2], uv[1]]); } }
    for (const [i, p] of [a, b, c].entries()) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.A.push(part); this.S.push(slot); this.U.push(uv ? uv[i][0] : -1, uv ? uv[i][1] : -1); }
  }
  quad(a, b, c, d, part, slot, out, uv) { this.tri(a, b, c, part, slot, out, uv && [uv[0], uv[1], uv[2]]); this.tri(a, c, d, part, slot, out, uv && [uv[0], uv[2], uv[3]]); }
  // loft: rings of [u, v] points at positions w along an axis ('x' default: u = y, v = z); every ring has the same count.
  // slot: a number or fn(edgeIndex, segmentIndex) -> slot. caps: close the first / last ring.
  loft(part, slot, secs, o = {}) {
    const ax = o.axis || 'x', P = (w, u, v) => ax === 'x' ? [w, u, v] : ax === 'z' ? [u, v, w] : [u, w, v];
    const n = secs[0].ring.length, sl = typeof slot === 'function' ? slot : () => slot;
    for (let s = 0; s < secs.length - 1; s++) {
      const A = secs[s], B = secs[s + 1];
      const cu = (A.ring.reduce((t, p) => t + p[0], 0) + B.ring.reduce((t, p) => t + p[0], 0)) / (2 * n), cv = (A.ring.reduce((t, p) => t + p[1], 0) + B.ring.reduce((t, p) => t + p[1], 0)) / (2 * n);
      const inside = P((A.w + B.w) / 2, cu, cv);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (o.open && j === 0) continue; const k = sl(i, s); if (k < 0) continue;
        this.quad(P(A.w, ...A.ring[i]), P(B.w, ...B.ring[i]), P(B.w, ...B.ring[j]), P(A.w, ...A.ring[j]), part, k, inside); }
    }
    const cap = (S, dir, k) => { const cu = S.ring.reduce((t, p) => t + p[0], 0) / n, cv = S.ring.reduce((t, p) => t + p[1], 0) / n, c = P(S.w, cu, cv), inside = P(S.w - dir, cu, cv);
      for (let i = 0; i < n; i++) this.tri(c, P(S.w, ...S.ring[i]), P(S.w, ...S.ring[(i + 1) % n]), part, k, inside); };
    if (o.capA !== false) cap(secs[0], -1, o.capSlotA ?? (typeof slot === 'number' ? slot : 0));
    if (o.capB !== false) cap(secs[secs.length - 1], 1, o.capSlotB ?? (typeof slot === 'number' ? slot : 0));
    return this;
  }
  // a box with chamfered edges, from x0..x1, y0..y1, z0..z1
  cbox(part, slot, x0, x1, y0, y1, z0, z1, c = 0.04, o = {}) {
    c = Math.min(c, (x1 - x0) / 3, (y1 - y0) / 3, (z1 - z0) / 3);
    const oct = (k) => [[y0 + k, z0], [y0, z0 + k], [y0, z1 - k], [y0 + k, z1], [y1 - k, z1], [y1, z1 - k], [y1, z0 + k], [y1 - k, z0]].map(([y, z]) => [y, z]);
    const inset = (r) => r.map(([y, z]) => [Math.min(Math.max(y, y0 + c), y1 - c), Math.min(Math.max(z, z0 + c), z1 - c)]);
    const R = oct(c);
    return this.loft(part, slot, [{ w: x0, ring: inset(R) }, { w: x0 + c, ring: R }, { w: x1 - c, ring: R }, { w: x1, ring: inset(R) }], o);
  }
  // a half ring (y, z>=0 from bottom centre round to top centre) mirrored into a full ring
  static sym(half) { const r = half.map(p => [p[0], p[1]]); const m = []; for (let i = half.length - 1; i >= 0; i--) { if (half[i][1] === 0) continue; m.push([half[i][0], -half[i][1]]); } return r.concat(m); }
  // a closed side profile [[x, y]] (anticlockwise seen from +z) extruded across z0..z1 with chamfered edges
  extrude(part, slot, prof, z0, z1, c = 0.03, o = {}) {
    const cx = prof.reduce((t, p) => t + p[0], 0) / prof.length, cy = prof.reduce((t, p) => t + p[1], 0) / prof.length;
    const ins = prof.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x - dx / l * c, y - dy / l * c]; });
    const secs = c > 0 ? [{ w: z0, ring: ins }, { w: z0 + c, ring: prof }, { w: z1 - c, ring: prof }, { w: z1, ring: ins }] : [{ w: z0, ring: prof }, { w: z1, ring: prof }];
    return this.loft(part, slot, secs.map(s => ({ w: s.w, ring: s.ring.map(([x, y]) => [x, y]) })), { ...o, axis: 'z' });
  }
  // a tube between two points (any direction)
  tube(part, slot, a, b, r0, r1 = r0, sides = 8, o = {}) {
    const A = v3(...a), B = v3(...b), d = B.clone().sub(A), L = d.length(); d.normalize();
    const up = Math.abs(d.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), e1 = up.clone().cross(d).normalize(), e2 = d.clone().cross(e1);
    const ring = (C, r) => Array.from({ length: sides }, (_, i) => { const t = i / sides * Math.PI * 2 + (o.rot || 0); return C.clone().addScaledVector(e1, Math.cos(t) * r).addScaledVector(e2, Math.sin(t) * r); });
    const RA = ring(A, r0), RB = ring(B, r1), mid = A.clone().add(B).multiplyScalar(0.5);
    for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; this.quad(RA[i].toArray(), RB[i].toArray(), RB[j].toArray(), RA[j].toArray(), part, slot, mid.toArray()); }
    if (o.caps !== false) for (const [R, C, s] of [[RA, A, -1], [RB, B, 1]]) { const ins = C.clone().addScaledVector(d, -s * L * 0.1); for (let i = 0; i < sides; i++) this.tri(C.toArray(), R[i].toArray(), R[(i + 1) % sides].toArray(), part, o.capSlot ?? slot, ins.toArray()); }
    return this;
  }
  // a lathed wheel about a lateral (z) axle: profile [[radius, zOffset, slot]]; registers the axle for rolling
  wheel(x, y, z, r, w, o = {}) {
    const sides = o.sides || 14, part = VP.axle + this.axleIndex(x, y, r), s = Math.sign(z) || 1;
    const prof = o.prof || [[r * 0.6, -w / 2, VS.rubber], [r * 0.9, -w / 2, VS.rubber], [r, -w * 0.32, VS.rubber], [r, w * 0.32, VS.rubber], [r * 0.9, w / 2, VS.rubber], [r * 0.6, w / 2, VS.rubber]];
    const pt = (rr, zz, t) => [x + Math.cos(t) * rr, y + Math.sin(t) * rr, z + zz * s];
    for (let k = 0; k < prof.length - 1; k++) for (let i = 0; i < sides; i++) {
      const t0 = i / sides * Math.PI * 2, t1 = (i + 1) / sides * Math.PI * 2, [ra, za, sl] = prof[k], [rb, zb] = prof[k + 1];
      this.quad(pt(ra, za, t0), pt(rb, zb, t0), pt(rb, zb, t1), pt(ra, za, t1), part, sl, [x, y, z]);
    }
    // hub faces: outer dish with a boss, inner flat
    const hubR = prof[prof.length - 1][0], hz = prof[prof.length - 1][1] * s, hubSlot = o.hub ?? VS.hub, boss = o.boss ?? r * 0.22;
    for (let i = 0; i < sides; i++) { const t0 = i / sides * Math.PI * 2, t1 = (i + 1) / sides * Math.PI * 2;
      const a = [x + Math.cos(t0) * hubR, y + Math.sin(t0) * hubR, z + hz - s * w * 0.12], b = [x + Math.cos(t1) * hubR, y + Math.sin(t1) * hubR, z + hz - s * w * 0.12];
      const a2 = [x + Math.cos(t0) * boss, y + Math.sin(t0) * boss, z + hz + s * w * 0.04], b2 = [x + Math.cos(t1) * boss, y + Math.sin(t1) * boss, z + hz + s * w * 0.04];
      this.quad(a, b, b2, a2, part, hubSlot, [x, y, z - s * w]); this.tri(a2, b2, [x, y, z + hz + s * w * 0.08], part, hubSlot, [x, y, z - s * w]);
      const ia = [x + Math.cos(t0) * hubR, y + Math.sin(t0) * hubR, z - hz], ib = [x + Math.cos(t1) * hubR, y + Math.sin(t1) * hubR, z - hz]; this.tri(ia, ib, [x, y, z - hz], part, hubSlot, [x, y, z + s * w]);
    }
    return this;
  }
  axleIndex(x, y, r) { let i = this.axles.findIndex(a => Math.abs(a[0] - x) < 0.01 && Math.abs(a[1] - y) < 0.01); if (i < 0) { i = this.axles.length; this.axles.push([x, y, r]); } return i; }
  // a track run around sprocket/idler/road wheels on one side: loop of [x, y] (anticlockwise seen from +z), width w at centre z
  track(loop, z, w, t = 0.07) {
    const n = loop.length, cx = loop.reduce((s, p) => s + p[0], 0) / n, cy = loop.reduce((s, p) => s + p[1], 0) / n;
    const inner = loop.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x - dx / l * t, y - dy / l * t]; });
    const z0 = z - w / 2, z1 = z + w / 2;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = loop[i], b = loop[j], ia = inner[i], ib = inner[j];
      this.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], VP.track, VS.rubber, [cx, cy, z]);
      this.quad([ia[0], ia[1], z0], [ib[0], ib[1], z0], [ib[0], ib[1], z1], [ia[0], ia[1], z1], VP.track, VS.rubber, [(a[0] + b[0]) / 2 + (cx - (a[0] + b[0]) / 2) * 3, (a[1] + b[1]) / 2 + (cy - (a[1] + b[1]) / 2) * 3, z]);
      for (const zz of [z0, z1]) this.quad([a[0], a[1], zz], [b[0], b[1], zz], [ib[0], ib[1], zz], [ia[0], ia[1], zz], VP.track, VS.rubber, [(a[0] + ib[0]) / 2, (a[1] + ib[1]) / 2, z + (z - zz)]);
    }
    return this;
  }
  // a thin plate (window, light lens, marking) laid on a surface: 4 points, pushed out along its normal by d
  plate(part, slot, pts, d = 0.01, uv = null) {
    const [a, b, c] = pts, n = v3(...b).sub(v3(...a)).cross(v3(...c).sub(v3(...a))).normalize().multiplyScalar(d);
    const ctr = pts.reduce((t, p) => [t[0] + p[0] / 4, t[1] + p[1] / 4, t[2] + p[2] / 4], [0, 0, 0]);
    // plates sit on the outside: face away from the vehicle's core (or away from a given inside point)
    const C = this.core || [0, 0.9, 0]; if (n.x * (ctr[0] - C[0]) + n.y * (ctr[1] - C[1]) + n.z * (ctr[2] - C[2]) < 0) n.multiplyScalar(-1);
    const q = pts.map(p => [p[0] + n.x, p[1] + n.y, p[2] + n.z]);
    this.quad(q[0], q[1], q[2], q[3], part, slot, [ctr[0] - n.x * 50, ctr[1] - n.y * 50, ctr[2] - n.z * 50], uv || (slot === VS.flag || slot === VS.livery ? [[0, 0], [1, 0], [1, 1], [0, 1]] : null));
    return this;
  }
  // a road-wheel track layout helper: road wheels at xs (radius r), sprocket and idler, returns the track loop
  static trackLoop(xs, r, spr, idl, topY) {
    const L = [], arc = (cx, cy, rr, a0, a1, k = 5) => { for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; L.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } };
    // front idler: from top round the front to the bottom
    arc(idl[0], idl[1], idl[2] + 0.04, Math.PI / 2, Math.PI * 1.25, 4);
    const sorted = xs.slice().sort((a, b) => b - a); for (const x of sorted) L.push([x, 0.02]); // bottom run under the road wheels (front to rear)
    arc(spr[0], spr[1], spr[2] + 0.04, Math.PI * 1.6, Math.PI * 2.5, 5); // rear sprocket round to the top
    L.push([sorted[sorted.length - 1] + 0.1, topY], [sorted[0] - 0.1, topY]);
    return L.reverse();
  }
  build(meta = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.A, 1));
    g.setAttribute('aSlot', new THREE.Float32BufferAttribute(this.S, 1));
    g.setAttribute('aUV', new THREE.Float32BufferAttribute(this.U, 2));
    g.computeBoundingSphere();
    g.userData = { axles: this.axles.slice(0, 14), piv: this.piv, ...meta };
    return g;
  }
}

// ---------------- shader ----------------
const VERT_HEAD = /* glsl */`
attribute float aPart; attribute float aSlot; attribute vec2 aUV;
attribute vec4 iA; attribute vec4 iB; attribute vec4 iP; attribute vec4 iM;
uniform float uTime; uniform vec4 uAx[14]; uniform vec3 uTur; uniform vec3 uGun; uniform vec3 uRot; uniform vec3 uRot2; uniform vec3 uTail; uniform vec4 uDoor;
varying vec3 vObj; varying float vSlot; varying float vPart; varying vec2 vUV; varying vec4 vP; varying vec4 vM; varying vec4 vB; varying float vSpin;
mat3 ry(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
mat3 rx(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
`;
const VERT_BODY = /* glsl */`
  vec3 transformed = vec3(position); vec3 objectNormal = vec3(normal);
  {
    int pt = int(aPart + 0.5); mat3 M;
    vObj = position; vSlot = aSlot; vPart = aPart; vUV = aUV; vP = iP; vM = iM; vB = iB; vSpin = iA.w;
    if (pt >= 10) { vec4 a = uAx[pt - 10]; M = rz(-iA.w / max(a.z, 0.05)); transformed = M * (transformed - vec3(a.x, a.y, 0.)) + vec3(a.x, a.y, 0.); objectNormal = M * objectNormal; }
    if (pt == 3) { M = ry(iA.w); transformed = M * (transformed - uRot) + uRot; objectNormal = M * objectNormal; }
    if (pt == 8) { M = ry(-iA.w); transformed = M * (transformed - uRot2) + uRot2; objectNormal = M * objectNormal; } // second main rotor (tandem / coaxial), counter-rotating
    if (pt == 4) { M = rz(iA.w * 4.7); transformed = M * (transformed - uTail) + uTail; objectNormal = M * objectNormal; }
    if (pt == 5) { float a = iB.y * (uDoor.w < 0.5 ? 1.25 : 1.6); M = uDoor.w < 0.5 ? rz(a) : ry(a); transformed = M * (transformed - uDoor.xyz) + uDoor.xyz; objectNormal = M * objectNormal; }
    if (pt == 6) { float a = iB.y * 1.6; vec3 pv = vec3(uDoor.x, uDoor.y, -uDoor.z); M = ry(-a); transformed = M * (transformed - pv) + pv; objectNormal = M * objectNormal; }
    if (pt == 2) { M = rz(iA.y); transformed = M * (transformed - uGun) + uGun; objectNormal = M * objectNormal; transformed -= M * vec3(iA.z, 0., 0.); }
    if (pt == 1 || pt == 2) {
      M = ry(iA.x); transformed = M * (transformed - uTur) + uTur; objectNormal = M * objectNormal;
      // a wreck that cooked off: the turret is thrown and lands askew beside the hull
      if (iB.z > 1.5) { float s = fract(iM.x * 7.31 + iP.y * 0.0001) > 0.5 ? 1. : -1.; M = rx(0.5 * s) * rz(0.35); transformed = M * (transformed - uTur) + uTur + vec3(-1.2, -0.25, 2.1 * s); objectNormal = M * objectNormal; }
    }
  }
`;
const FRAG_HEAD = /* glsl */`
uniform float uTime;
varying vec3 vObj; varying float vSlot; varying float vPart; varying vec2 vUV; varying vec4 vP; varying vec4 vM; varying vec4 vB; varying float vSpin;
vec3 unpackV(float f) { f = floor(f + 0.5); float r = floor(f / 65536.0), g = floor((f - r * 65536.0) / 256.0); return vec3(r, g, f - r * 65536.0 - g * 256.0) / 255.0; }
float hv(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nv(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hv(i), hv(i + vec2(1, 0)), f.x), mix(hv(i + vec2(0, 1)), hv(i + vec2(1, 1)), f.x), f.y); }
// vehicle camouflage at vehicle scale (patches of 0.5–2 m): 1 two/three-tone disruptive, 2 multi-environment, 3 splinter, 4 digital, 5 desert sparse, 6 tiger stripe
vec3 vcamo(float pat, vec3 p, vec3 c1, vec3 c2, vec3 c3) {
  vec2 q = vec2(p.x + p.z * 0.8, p.y * 1.4 + p.z * 0.5);
  if (pat < 1.5) { float n = nv(q * 1.1) * 0.7 + nv(q * 3.1) * 0.3; return n < 0.45 ? c1 : n < 0.66 ? c2 : c3; }
  if (pat < 2.5) { float n = nv(q * 1.4 + 3.) * 0.6 + nv(q * 4.5) * 0.4; return n < 0.5 ? c1 : n < 0.68 ? c2 : c3; }
  if (pat < 3.5) { float a = q.x * 0.7 - q.y * 0.7; float n = hv(vec2(floor(a * 1.6), floor((q.x * 0.6 + q.y * 0.8) * 0.9))); return n < 0.45 ? c1 : n < 0.75 ? c2 : c3; }
  if (pat < 4.5) { vec2 g = floor(q * 6.) / 6.; float n = nv(g * 1.6) * 0.65 + nv(g * 4.) * 0.35; return n < 0.45 ? c1 : n < 0.64 ? c2 : c3; }
  if (pat < 5.5) { float n = nv(q * 0.9) * 0.7 + nv(q * 2.7) * 0.3; return n < 0.66 ? c1 : n < 0.8 ? c2 : c3; }
  float n = nv(vec2(q.x * 0.6, q.y * 3.)) ; return n < 0.5 ? c1 : n < 0.7 ? c2 : c3;
}
`;
const FRAG_BODY = /* glsl */`
  int sl = int(vSlot + 0.5);
  vec3 c1 = unpackV(vP.y), c2 = unpackV(vP.z), c3 = unpackV(vP.w), m1 = unpackV(vM.y), m2 = unpackV(vM.z), m3 = unpackV(vM.w);
  vec3 paint = vP.x > 0.5 ? vcamo(vP.x, vObj, c1, c2, c3) : c1;
  vec3 pc = paint; vec3 vEm = vec3(0.);
  if (sl == 1) { pc = vec3(0.09); if (vPart > 6.5 && vPart < 7.5) { float k = fract((vObj.x + vObj.y * 0.6) * 6. + vSpin * 6.); pc = k < 0.35 ? vec3(0.05) : vec3(0.14, 0.13, 0.12); } }
  else if (sl == 2) pc = vec3(0.2, 0.21, 0.22);
  else if (sl == 3) pc = mix(vec3(0.08, 0.1, 0.13), vec3(0.32, 0.4, 0.48), clamp(vObj.y * 0.25, 0., 1.) * 0.6);
  else if (sl == 4) { pc = vec3(0.92, 0.9, 0.82); vEm = vec3(0.6, 0.58, 0.5) * step(1.5, vB.w); }
  else if (sl == 5) pc = vM.x > 9.5 ? c2 : paint * 0.82;
  else if (sl == 6) { // national marking on a flag plate (aUV 0..1)
    vec2 u = vUV; float st = vM.x;
    if (st < 1.5) pc = u.x < 0.333 ? m1 : u.x < 0.667 ? m2 : m3; // vertical tricolour
    else if (st < 2.5) pc = u.y > 0.667 ? m1 : u.y > 0.333 ? m2 : m3; // horizontal tricolour
    else if (st < 3.5) pc = (abs(u.y - 0.5) < 0.12 || abs(u.x - 0.36) < 0.09) ? m2 : m1; // Nordic cross
    else if (st < 4.5) pc = length((u - 0.5) * vec2(1.5, 1.)) < 0.27 ? m2 : m1; // disc
    else if (st < 5.5) pc = u.y > 0.5 ? m1 : m2; // bicolour
    else pc = m1;
  }
  else if (sl == 7) pc = vec3(0.04);
  else if (sl == 8) { float on = step(0.5, fract(uTime * 2.3 + step(0., vObj.z) * 0.5)) * mod(vB.w, 2.); vec3 bc = vObj.z > 0. ? vec3(0.1, 0.25, 1.) : (vM.x > 12.5 ? vec3(0.1, 0.25, 1.) : vec3(1., 0.1, 0.1)); pc = mix(bc * 0.35, bc, on); vEm = bc * on * 1.6; }
  else if (sl == 9) pc = mix(paint, vec3(0.5, 0.47, 0.36), 0.45) * 0.92;
  else if (sl == 10) pc = vP.x > 0.5 ? paint * 0.75 : vec3(0.55, 0.56, 0.58);
  else if (sl == 11) pc = vec3(0.7, 0.71, 0.73);
  else if (sl == 12) { pc = vec3(0.6, 0.05, 0.05); vEm = vec3(0.35, 0., 0.) * step(1.5, vB.w); }
  else if (sl == 13) pc = vec3(0.12, 0.12, 0.13);
  else if (sl == 14) { // service livery: 10 band, 11 Battenburg checks, 12 half-and-half, 13 chevrons/reflective stripes
    vec2 u = vUV; float st = vM.x;
    if (st < 10.5) pc = m1;
    else if (st < 11.5) pc = mod(floor(vObj.x * 1.6) + floor(u.y * 2.), 2.) < 0.5 ? m1 : m2;
    else if (st < 12.5) pc = u.y > 0.5 ? m1 : m2;
    else pc = mod(floor((vObj.x + u.y * 0.6) * 2.2), 2.) < 0.5 ? m1 : m2;
  }
  else if (sl == 15) { pc = vec3(0.9, 0.55, 0.1); }
  // damage: scorching and soot creep over the paint; wrecks are burnt out
  float dmg = vB.x, wreck = vB.z;
  if (dmg > 0.02 || wreck > 0.5) { float g = nv(vObj.xy * 2.3 + vObj.z * 1.7) * 0.7 + nv(vObj.xz * 7.) * 0.3; float k = wreck > 0.5 ? 0.9 : dmg * 0.8; if (g < k) pc = mix(pc, vec3(0.05, 0.045, 0.04), wreck > 0.5 ? 0.85 : 0.7); if (wreck > 0.5) pc = mix(pc, vec3(0.16, 0.12, 0.1) * (0.6 + g), 0.55); }
  vec4 diffuseColor = vec4(pc, opacity);
`;

export function vehicleMaterial(geo) {
  const ud = geo.userData, m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const ax = Array.from({ length: 14 }, (_, i) => { const a = ud.axles[i]; return a ? new THREE.Vector4(a[0], a[1], a[2], 0) : new THREE.Vector4(0, 0, 1, 0); });
  const p = ud.piv || {}, V = a => new THREE.Vector3(...(a || [0, 0, 0]));
  m.userData.u = { uTime: { value: 0 }, uAx: { value: ax }, uTur: { value: V(p.turret) }, uGun: { value: V(p.gun) }, uRot: { value: V(p.rotor) }, uRot2: { value: V(p.rotor2) }, uTail: { value: V(p.tail) }, uDoor: { value: new THREE.Vector4(...(p.door || [0, 0, 0, 0])) } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <beginnormal_vertex>', VERT_BODY).replace('#include <begin_vertex>', '');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', FRAG_BODY).replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + vEm;');
  };
  m.customProgramCacheKey = () => 'veh-v1';
  return m;
}

// an instanced fleet of one vehicle model
export class Fleet {
  constructor(scene, geo, cap) {
    this.cap = cap; this.n = 0; this.geo = geo;
    const g = geo.clone(); g.userData = geo.userData;
    const at = () => new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.a = at(); this.b = at(); this.p = at(); this.m = at();
    g.setAttribute('iA', this.a); g.setAttribute('iB', this.b); g.setAttribute('iP', this.p); g.setAttribute('iM', this.m);
    this.mat = vehicleMaterial(geo);
    this.mesh = new THREE.InstancedMesh(g, this.mat, cap); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  // A: [turretYaw, gunPitch, recoil, spin], B: [damage, door, wreck(1 burnt, 2 turret off), lights], P: [pattern, c1, c2, c3], M: [style, m1, m2, m3]
  put(mat4, A, B, P, M) {
    if (this.n >= this.cap) return; const i = this.n++, o = i * 4; this.mesh.setMatrixAt(i, mat4);
    for (const [at, v] of [[this.a, A], [this.b, B], [this.p, P], [this.m, M]]) { const r = at.array; r[o] = v[0]; r[o + 1] = v[1]; r[o + 2] = v[2]; r[o + 3] = v[3]; }
  }
  end(t) { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; for (const at of [this.a, this.b, this.p, this.m]) at.needsUpdate = true; this.mat.userData.u.uTime.value = t; }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
