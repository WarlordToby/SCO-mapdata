// Procedural low-poly models for the non-human threats: mutant brutes, slitherers, spitters, bloaters and titans, and
// the swarm's castes (drone, hunter, warrior, crusher, boiler, warden) with their Matriarch forms.
// Every model is built in metres, facing +X with +Y up and +Z to its left, from faceted segments, lumpy blobs,
// spikes and plates. Each vertex belongs to one joint of a small skeleton; joints carry their own walk cycle,
// idle sway, strike and death pose, and the vertex shader in beasts.js poses the chain from the joint to the root.
import * as THREE from 'three';

export const SL = { base: 0, accent: 1, dark: 2, glow: 3, flesh: 4, bone: 5, cloth: 6 };
const PI = Math.PI, v3 = (a, b, c) => new THREE.Vector3(a, b, c);
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

export class Rig {
  constructor() { this.pos = []; this.nor = []; this.jt = []; this.sl = []; this.J = []; }
  // a joint: pivot p, parent joint, rotation axis, motion { amp, off, freq, bias, atk, atkOff, sway, dead }
  joint(p, parent = -1, axis = [0, 0, 1], m = {}) {
    const a = v3(...axis).normalize();
    this.J.push({ p, parent, axis: [a.x, a.y, a.z], amp: m.amp || 0, off: m.off || 0, freq: m.freq ?? 1, bias: m.bias || 0, atk: m.atk || 0, atkOff: m.atkOff || 0, sway: m.sway || 0, dead: m.dead ?? (m.bias || 0) });
    return this.J.length - 1;
  }
  add(geo, j, slot) {
    const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) { this.jt.push(j); this.sl.push(slot); }
    g.dispose(); return this;
  }
  // tapered faceted segment from a to b
  seg(j, slot, a, b, r0, r1 = r0, sides = 5) {
    const A = v3(...a), B = v3(...b), d = B.clone().sub(A), L = d.length(); if (L < 1e-4) return this;
    const g = new THREE.CylinderGeometry(r1, r0, L, sides, 1, false); g.translate(0, L / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d.normalize())); g.translate(A.x, A.y, A.z);
    return this.add(g, j, slot);
  }
  // a lumpy faceted blob
  blob(j, slot, c, r, s = [1, 1, 1], rough = 0.12, det = 1) {
    const g = new THREE.IcosahedronGeometry(r, det), a = g.attributes.position, q = v3(0, 0, 0);
    for (let i = 0; i < a.count; i++) { q.set(a.getX(i), a.getY(i), a.getZ(i)); const k = 1 + rough * (hash3(q.x * 9 + c[0], q.y * 9 + c[1], q.z * 9 + c[2]) - 0.5) * 2; a.setXYZ(i, q.x * k * s[0], q.y * k * s[1], q.z * k * s[2]); }
    g.translate(...c); return this.add(g, j, slot);
  }
  spike(j, slot, a, b, r, sides = 4) {
    const A = v3(...a), B = v3(...b), d = B.clone().sub(A), L = d.length(); if (L < 1e-4) return this;
    const g = new THREE.ConeGeometry(r, L, sides, 1); g.translate(0, L / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d.normalize())); g.translate(A.x, A.y, A.z);
    return this.add(g, j, slot);
  }
  // a flat blade from a to b: width w in the plane of the swing, thickness th
  blade(j, slot, a, b, w, th) {
    const A = v3(...a), B = v3(...b), d = B.clone().sub(A), L = d.length(); if (L < 1e-4) return this;
    const g = new THREE.OctahedronGeometry(1, 0); g.scale(w, L / 2, th); const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) - w * 0.6); // hooked tip
    g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d.normalize())); g.translate(A.x, A.y, A.z);
    return this.add(g, j, slot);
  }
  // a faceted armour plate (flattened octahedron) with an optional tilt
  plate(j, slot, c, s, rot = [0, 0, 0]) {
    const g = new THREE.OctahedronGeometry(1, 0); g.scale(...s); g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); g.translate(...c);
    return this.add(g, j, slot);
  }
  build(meta = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aJ', new THREE.Float32BufferAttribute(this.jt, 1));
    g.setAttribute('aSlot', new THREE.Float32BufferAttribute(this.sl, 1));
    g.computeBoundingSphere(); g.userData = { joints: this.J, tris: this.pos.length / 9, ...meta };
    return g;
  }
}

// ---------- shared limb helpers ----------
// a jointed leg: hip swings about the vertical, the knee lifts; foot on the ground. dir: angle from +X in the ground plane (side: +1 left, -1 right)
function leg(R, parent, at, side, ang, l1, l2, off, o = {}) {
  const dx = Math.cos(ang), dz = Math.sin(ang) * side, rise = o.rise ?? 0.8;
  const hz = Math.sqrt(Math.max(0.05, 1 - rise * rise)); // the femur climbs to a high knee, the shin splays down and out
  const knee = [at[0] + dx * l1 * hz, at[1] + l1 * rise, at[2] + dz * l1 * hz];
  const foot = [knee[0] + dx * l2 * (o.reach ?? 0.55), 0.02, knee[2] + dz * l2 * (o.reach ?? 0.55)];
  const amp = o.amp ?? 0.42, lift = o.lift ?? 0.35;
  const hip = R.joint(at, parent, [0, 1, 0], { amp, off, freq: 1, sway: 0.03, dead: (o.deadHip ?? 0.25) * (ang < 1.5 ? 1 : -1) * side });
  const kAxis = [dz, 0, -dx]; // horizontal, across the leg: positive lifts the shin toward the body
  const kn = R.joint(knee, hip, kAxis, { amp: lift, off: off + PI / 2, bias: lift * 0.6, atk: o.kneeAtk || 0, dead: o.deadKnee ?? 1.1 });
  R.seg(hip, o.s1 ?? SL.base, at, knee, o.r1 ?? 0.04, o.r2 ?? 0.032, o.sides ?? 5);
  R.seg(kn, o.s2 ?? SL.dark, knee, foot, o.r2 ?? 0.032, o.r3 ?? 0.012, o.sides ?? 4);
  if (o.claw) R.spike(kn, SL.dark, foot, [foot[0] + dx * 0.08, 0.0, foot[2] + dz * 0.08], o.r3 ?? 0.012);
  return { hip, kn, knee, foot };
}
// a jointed arm / limb for humanoid mutants (swings about Z = forwards/backwards)
function arm(R, parent, sh, el, wr, r, o = {}) {
  const s = R.joint(sh, parent, [0, 0, 1], { amp: o.amp ?? 0.4, off: o.off || 0, sway: o.sway ?? 0.06, atk: o.atk || 0, atkOff: o.atkOff || 0, bias: o.bias || 0, dead: o.dead ?? 0.4 });
  const e = R.joint(el, s, [0, 0, 1], { amp: o.eAmp ?? 0.15, off: (o.off || 0) + 0.5, bias: o.eBias ?? 0.25, atk: o.eAtk || 0, atkOff: o.atkOff || 0, dead: o.eDead ?? 0.6 });
  R.seg(s, o.slot ?? SL.base, sh, el, r[0], r[1]); R.seg(e, o.slot ?? SL.base, el, wr, r[1], r[2]);
  return { s, e };
}
function humLeg(R, parent, hip, kn, ft, r, off, o = {}) {
  const h = R.joint(hip, parent, [0, 0, 1], { amp: o.amp ?? 0.5, off, sway: 0.02, dead: o.dead ?? -0.2 });
  const k = R.joint(kn, h, [0, 0, 1], { amp: o.kAmp ?? 0.4, off: off - 1.2, bias: -(o.kAmp ?? 0.4), dead: o.kDead ?? 0.3 });
  R.seg(h, o.slot ?? SL.base, hip, kn, r[0], r[1]); R.seg(k, o.slot ?? SL.base, kn, ft, r[1], r[2]);
  R.blob(k, SL.dark, [ft[0] + 0.08 * (o.fs || 1), ft[1] + 0.03, ft[2]], 0.09 * (o.fs || 1), [1.6, 0.55, 1], 0.1, 0);
  return { h, k };
}
// insect head with eyes, mandibles and antennae; returns head joint
function insectHead(R, parent, at, s, o = {}) {
  const h = R.joint(at, parent, [0, 0, 1], { amp: 0.04, off: 1, sway: 0.12, atk: o.headAtk ?? -0.35, dead: 0.3 });
  const c = [at[0] + 0.12 * s, at[1] - 0.02 * s, at[2]];
  R.blob(h, o.slot ?? SL.base, c, 0.13 * s, o.hs || [1.25, 0.85, 1], 0.08, 1);
  for (const z of [1, -1]) {
    R.blob(h, SL.glow, [c[0] + 0.07 * s, c[1] + 0.05 * s, z * 0.075 * s], 0.042 * s, [1, 0.8, 1], 0, 0);
    const mj = R.joint([c[0] + 0.12 * s, c[1] - 0.06 * s, z * 0.05 * s], h, [0, 1, 0], { sway: 0.08, atk: z * 0.55, bias: z * 0.15, dead: z * 0.4 });
    R.spike(mj, SL.dark, [c[0] + 0.1 * s, c[1] - 0.06 * s, z * 0.06 * s], [c[0] + 0.26 * s * (o.mand || 1), c[1] - 0.08 * s, z * 0.015 * s], 0.028 * s, 3);
    if (o.antennae !== false) { const aj = R.joint([c[0] + 0.08 * s, c[1] + 0.09 * s, z * 0.04 * s], h, [0, 0, 1], { sway: 0.25, off: z, dead: 0.5 }); R.seg(aj, SL.dark, [c[0] + 0.08 * s, c[1] + 0.09 * s, z * 0.04 * s], [c[0] + 0.32 * s, c[1] + 0.32 * s, z * 0.17 * s], 0.012 * s, 0.006 * s, 3); }
  }
  if (o.M) for (let i = 0; i < 4; i++) R.spike(h, SL.accent, [c[0] - 0.04 * s + i * 0.02 * s, c[1] + 0.08 * s, (i - 1.5) * 0.05 * s], [c[0] - 0.22 * s, c[1] + (0.35 - Math.abs(i - 1.5) * 0.08) * s, (i - 1.5) * 0.12 * s], 0.035 * s, 3);
  return h;
}
// tripod gait offsets: front/mid/rear on each side
const TRI = (i, side) => ((i + (side > 0 ? 0 : 1)) % 2) * PI;
// matriarch ornament: dorsal spines and ridge plates along the back
function dorsal(R, j, x0, x1, y, n, s, o = {}) { for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / Math.max(1, n - 1), h = (o.h ?? 0.3) * s * (1 - Math.abs(i / (n - 1) - 0.4) * 0.8); R.spike(j, o.slot ?? SL.accent, [x, y, 0], [x - 0.1 * s, y + h, 0], 0.05 * s, 4); } }

// ===================== THE SWARM =====================
function drone(M) {
  const R = new Rig(), s = 1;
  const b = R.joint([0, 0.45, 0], -1, [0, 1, 0], { sway: 0.05, dead: 0 });
  R.blob(b, SL.base, [0.08, 0.45, 0], 0.21, [1.35, 0.85, 1], 0.06);
  R.plate(b, SL.base, [0.06, 0.62, 0], [0.3, 0.06, 0.2], [0, 0, 0.05]);
  const ab = R.joint([-0.14, 0.48, 0], b, [0, 0, 1], { amp: 0.06, off: 0.7, sway: 0.08, bias: -0.06, dead: 0.1 });
  R.blob(ab, SL.accent, [-0.48, 0.5, 0], 0.3, [1.45, 1, 1.12], 0.07);
  R.blob(ab, SL.glow, [-0.5, 0.36, 0], 0.18, [1.5, 0.6, 1], 0.05, 0);
  for (let i = 0; i < 4; i++) R.plate(ab, SL.base, [-0.28 - i * 0.14, 0.72 - i * 0.02, 0], [0.07, 0.04, 0.24 - i * 0.02], [0, 0, 0.25]);
  insectHead(R, b, [0.3, 0.45, 0], 1, { M });
  [[0.24, 0.6], [0.08, 1.45], [-0.08, 2.35]].forEach(([x, a], i) => { for (const sd of [1, -1]) leg(R, b, [x, 0.42, sd * 0.13], sd, a, 0.32, 0.4, TRI(i, sd), { r1: 0.035, r2: 0.028, r3: 0.01 }); });
  if (M) dorsal(R, ab, -0.25, -0.75, 0.78, 4, 1);
  return R.build({ deadRoll: PI, deadDrop: 0.75, bob: 0.02, len: 1.2 });
}
function hunter(M) {
  const R = new Rig();
  const b = R.joint([0, 0.6, 0], -1, [0, 1, 0], { sway: 0.06, dead: 0 });
  R.blob(b, SL.base, [0.1, 0.62, 0], 0.17, [1.9, 0.75, 0.85], 0.06);
  for (let i = 0; i < 3; i++) R.plate(b, SL.accent, [0.3 - i * 0.18, 0.74, 0], [0.09, 0.04, 0.14], [0, 0, 0.2]);
  const ab = R.joint([-0.2, 0.62, 0], b, [0, 0, 1], { amp: 0.05, off: 0.4, sway: 0.1, bias: -0.25, dead: 0.2 });
  R.blob(ab, SL.base, [-0.55, 0.68, 0], 0.17, [2.2, 0.8, 0.85], 0.06);
  R.spike(ab, SL.dark, [-0.9, 0.7, 0], [-1.25, 0.82, 0], 0.06, 4);
  const hd = insectHead(R, b, [0.44, 0.62, 0], 1.05, { M, mand: 1.3, hs: [1.5, 0.75, 0.95] });
  // raptorial graspers held forward (they close on a victim)
  for (const sd of [1, -1]) {
    const sh = R.joint([0.35, 0.58, sd * 0.1], b, [0, 0, 1], { sway: 0.1, bias: 0.2, atk: -1.0, off: sd, dead: 0.8 });
    R.seg(sh, SL.base, [0.35, 0.58, sd * 0.1], [0.62, 0.82, sd * 0.16], 0.04, 0.035);
    const el = R.joint([0.62, 0.82, sd * 0.16], sh, [0, 0, 1], { sway: 0.08, bias: -0.2, atk: 1.2, dead: -1.2 });
    R.seg(el, SL.dark, [0.62, 0.82, sd * 0.16], [0.86, 0.5, sd * 0.14], 0.035, 0.015, 4);
    R.spike(el, SL.bone, [0.86, 0.5, sd * 0.14], [0.8, 0.4, sd * 0.12], 0.015, 3);
  }
  [[0.12, 0.9], [-0.08, 1.7], [-0.26, 2.45]].forEach(([x, a], i) => { for (const sd of [1, -1]) leg(R, b, [x, 0.58, sd * 0.1], sd, a, 0.55, 0.7, TRI(i, sd), { r1: 0.035, r2: 0.026, r3: 0.008, amp: 0.5, lift: 0.45 }); });
  if (M) dorsal(R, b, 0.35, -0.35, 0.78, 4, 1, { h: 0.25 });
  return R.build({ deadRoll: PI, deadDrop: 1.05, bob: 0.04, len: 1.9, carry: [0.75, 0.75] });
}
function mantis(M, s, armour) { // warriors and wardens
  const R = new Rig();
  const b = R.joint([0, 0.62 * s, 0], -1, [0, 1, 0], { sway: 0.04, dead: 0 });
  R.blob(b, SL.base, [-0.05 * s, 0.62 * s, 0], 0.2 * s, [1.5, 0.85, 1], 0.06);
  const ab = R.joint([-0.2 * s, 0.6 * s, 0], b, [0, 0, 1], { amp: 0.04, sway: 0.06, bias: -0.15, dead: 0.2 });
  R.blob(ab, SL.base, [-0.62 * s, 0.6 * s, 0], 0.24 * s, [1.9, 0.9, 1.05], 0.07);
  for (let i = 0; i < 4; i++) R.plate(ab, SL.accent, [-0.38 * s - i * 0.16 * s, (0.8 - i * 0.03) * s, 0], [0.09 * s, 0.05 * s, (0.24 - i * 0.03) * s], [0, 0, 0.3]);
  // upright thorax
  const th = R.joint([0.12 * s, 0.68 * s, 0], b, [0, 0, 1], { amp: 0.05, off: 1, sway: 0.05, atk: -0.35, dead: -0.9 });
  R.seg(th, SL.base, [0.1 * s, 0.66 * s, 0], [0.32 * s, 1.18 * s, 0], 0.13 * s, 0.1 * s, 6);
  R.plate(th, SL.accent, [0.18 * s, 0.95 * s, 0], [0.08 * s, 0.24 * s, 0.13 * s], [0, 0, -0.4]);
  if (armour) { for (const sd of [1, -1]) R.plate(th, SL.accent, [0.24 * s, 1.0 * s, sd * 0.11 * s], [0.06 * s, 0.2 * s, 0.09 * s], [sd * 0.3, 0, -0.4]); for (let i = 0; i < 3; i++) R.spike(th, SL.bone, [0.1 * s + i * 0.07 * s, (0.85 + i * 0.1) * s, 0], [-0.08 * s + i * 0.06 * s, (1.0 + i * 0.12) * s, 0], 0.03 * s, 3); }
  insectHead(R, th, [0.36 * s, 1.22 * s, 0], 1.0 * s, { M, hs: [1.1, 0.9, 1.15], headAtk: -0.25 });
  // scythes: femur up and forward, blade folded down; strike forward
  const pairs = armour ? [[1.12, 1, 0.12], [0.92, 0.65, 0.1]] : [[1.1, 1, 0.12]];
  for (const [y, k, z] of pairs) for (const sd of [1, -1]) {
    const sh = R.joint([0.3 * s, y * s, sd * z * s], th, [0, 0, 1], { sway: 0.08, off: sd * 0.5, bias: 0.25, atk: -1.5 * k, atkOff: sd > 0 ? 0 : 0.15, dead: 0.6 });
    const el = [0.55 * s, (y + 0.22 * k) * s, sd * (z + 0.06) * s];
    R.seg(sh, SL.base, [0.3 * s, y * s, sd * z * s], el, 0.05 * s * k, 0.045 * s * k);
    const ej = R.joint(el, sh, [0, 0, 1], { sway: 0.06, bias: 0.3, atk: 1.1 * k, atkOff: sd > 0 ? 0 : 0.15, dead: 0.9 });
    const tip = [0.66 * s, (y - 0.48 * k) * s, sd * (z + 0.03) * s];
    R.blade(ej, SL.accent, el, tip, 0.07 * s * k, 0.02 * s);
    for (let i = 1; i < 4; i++) { const f = i / 4, p = [el[0] + (tip[0] - el[0]) * f, el[1] + (tip[1] - el[1]) * f, el[2] + (tip[2] - el[2]) * f]; R.spike(ej, SL.bone, p, [p[0] - 0.07 * s, p[1] - 0.02 * s, p[2]], 0.012 * s, 3); }
  }
  [[0.0, 1.0], [-0.22, 2.2]].forEach(([x, a], i) => { for (const sd of [1, -1]) leg(R, b, [x * s, 0.58 * s, sd * 0.12 * s], sd, a, 0.5 * s, 0.68 * s, TRI(i, sd), { r1: 0.04 * s, r2: 0.03 * s, r3: 0.01 * s, amp: 0.45, lift: 0.4 }); });
  if (M) dorsal(R, ab, -0.35 * s, -0.95 * s, 0.86 * s, 5, s, { h: 0.3 });
  return R.build({ deadRoll: PI, deadDrop: 1.15 * s, bob: 0.03 * s, len: 1.6 * s });
}
function crusher(M) {
  const R = new Rig(), s = 1;
  const b = R.joint([0, 1.0, 0], -1, [0, 1, 0], { sway: 0.03, dead: 0 });
  // domed carapace of overlapping plates
  R.blob(b, SL.base, [-0.2, 1.05, 0], 0.75, [1.8, 0.75, 1.15], 0.05);
  for (let i = 0; i < 5; i++) R.plate(b, SL.accent, [0.5 - i * 0.42, 1.55 - Math.abs(i - 1.5) * 0.06, 0], [0.28, 0.12, 0.85 - Math.abs(i - 1.5) * 0.08], [0, 0, 0.18]);
  for (const sd of [1, -1]) for (let i = 0; i < 3; i++) R.plate(b, SL.accent, [0.3 - i * 0.6, 1.1, sd * 0.78], [0.3, 0.25, 0.06], [sd * 0.4, 0, 0]);
  const hd = R.joint([0.95, 0.95, 0], b, [0, 0, 1], { sway: 0.05, amp: 0.03, atk: 0.35, dead: 0.25 });
  R.blob(hd, SL.base, [1.15, 0.85, 0], 0.35, [1.1, 0.8, 1.2], 0.06);
  R.plate(hd, SL.accent, [1.2, 1.15, 0], [0.18, 0.5, 0.7], [0, 0, -0.5]); // head shield
  R.spike(hd, SL.bone, [1.25, 1.05, 0], [1.95, 1.55, 0], 0.13, 5); // horn
  for (const sd of [1, -1]) { R.blob(hd, SL.glow, [1.42, 0.92, sd * 0.24], 0.06, [1, 0.8, 1], 0, 0); R.spike(hd, SL.dark, [1.4, 0.7, sd * 0.2], [1.75, 0.6, sd * 0.06], 0.07, 4); }
  if (M) for (let i = 0; i < 5; i++) R.spike(hd, SL.accent, [1.15, 1.45, (i - 2) * 0.22], [0.85, 2.05 - Math.abs(i - 2) * 0.15, (i - 2) * 0.4], 0.07, 4);
  [[0.6, 0.75], [0.0, 1.5], [-0.65, 2.35]].forEach(([x, a], i) => { for (const sd of [1, -1]) leg(R, b, [x, 0.85, sd * 0.55], sd, a, 0.85, 1.05, TRI(i, sd), { r1: 0.13, r2: 0.1, r3: 0.04, amp: 0.32, lift: 0.28, rise: 0.62, reach: 0.4, sides: 6, claw: true }); });
  if (M) dorsal(R, b, 0.4, -1.3, 1.62, 6, 1.6, { h: 0.35 });
  return R.build({ deadRoll: PI, deadDrop: 2.0, bob: 0.03, len: 3.4 });
}
function boiler(M) {
  const R = new Rig();
  const b = R.joint([0, 0.7, 0], -1, [0, 1, 0], { sway: 0.04, dead: 0 });
  R.blob(b, SL.base, [0.15, 0.7, 0], 0.26, [1.5, 0.8, 1.05], 0.05);
  const sac = R.joint([-0.15, 0.85, 0], b, [0, 0, 1], { amp: 0.04, sway: 0.06, atk: -0.35, dead: 0.2 });
  R.blob(sac, SL.glow, [-0.55, 1.15, 0], 0.55, [1.25, 1, 1], 0.1);
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; R.seg(sac, SL.dark, [-0.55 + Math.cos(a) * 0.15, 1.15 + 0.55, Math.sin(a) * 0.12], [-0.55 + Math.cos(a) * 0.55, 1.15 + Math.sin(a * 2) * 0.2, Math.sin(a) * 0.62], 0.03, 0.02, 3); }
  for (const [x, z] of [[-0.35, 0.18], [-0.55, -0.12], [-0.75, 0.1]]) { R.seg(sac, SL.dark, [x, 1.55, z], [x - 0.25, 2.0, z * 1.4], 0.07, 0.05, 5); R.blob(sac, SL.glow, [x - 0.27, 2.03, z * 1.4], 0.06, [1, 0.6, 1], 0, 0); }
  insectHead(R, b, [0.48, 0.66, 0], 1.0, { M, antennae: true });
  [[0.32, 0.7], [0.08, 1.55], [-0.2, 2.4]].forEach(([x, a], i) => { for (const sd of [1, -1]) leg(R, b, [x, 0.62, sd * 0.18], sd, a, 0.5, 0.65, TRI(i, sd), { r1: 0.05, r2: 0.04, r3: 0.012, amp: 0.38 }); });
  if (M) dorsal(R, sac, -0.2, -0.9, 1.7, 5, 1.2, { h: 0.3 });
  return R.build({ deadRoll: PI, deadDrop: 1.7, bob: 0.03, len: 1.9 });
}

// ===================== MUTANTS =====================
function brute() {
  const R = new Rig();
  const pel = R.joint([0, 1.05, 0], -1, [0, 1, 0], { sway: 0.05, amp: 0.08, dead: 0 });
  const sp = R.joint([0, 1.15, 0], pel, [0, 0, 1], { amp: 0.06, off: 0.4, sway: 0.04, atk: 0.35, dead: 0.2 });
  R.blob(pel, SL.base, [0, 1.05, 0], 0.3, [1, 0.8, 1.2], 0.12);
  R.seg(pel, SL.cloth, [0, 0.98, 0], [0, 1.12, 0], 0.34, 0.33, 7); // belt and torn waistband
  R.blob(sp, SL.base, [0.12, 1.62, -0.04], 0.55, [1, 1.0, 1.25], 0.18);
  R.blob(sp, SL.base, [0.02, 1.98, -0.04], 0.34, [1.1, 0.8, 1.5], 0.15); // hunched trapezius
  R.blob(sp, SL.flesh, [-0.18, 1.82, 0.18], 0.2, [1, 0.8, 1], 0.3, 0);
  R.blob(sp, SL.flesh, [-0.1, 1.5, -0.38], 0.16, [1, 1, 1], 0.3, 0);
  for (const p of [[-0.25, 1.95, -0.1], [-0.28, 1.7, 0.05], [-0.12, 2.05, 0.15]]) R.blob(sp, SL.glow, p, 0.06, [1, 1, 1], 0.2, 0);
  for (const p of [[-0.3, 2.0, -0.2], [-0.35, 1.8, -0.25], [-0.2, 2.1, -0.32]]) R.spike(sp, SL.bone, p, [p[0] - 0.22, p[1] + 0.12, p[2] - 0.1], 0.045, 4);
  const hd = R.joint([0.28, 1.95, 0.02], sp, [0, 0, 1], { sway: 0.1, off: 2, atk: 0.2, dead: 0.4 });
  R.blob(hd, SL.base, [0.38, 1.93, 0.04], 0.16, [1.05, 1, 0.95], 0.15);
  R.blob(hd, SL.flesh, [0.47, 1.84, 0.04], 0.1, [1, 0.6, 1.2], 0.2, 0);
  for (const z of [-0.06, 0, 0.06]) R.spike(hd, SL.bone, [0.5, 1.87, z + 0.04], [0.56, 1.8, z + 0.04], 0.015, 3);
  R.blob(hd, SL.glow, [0.5, 1.98, 0.1], 0.025, [1, 1, 1], 0, 0);
  // the oversized right arm with its bony club, the withered left one
  const ra = arm(R, sp, [0.08, 1.88, -0.48], [0.14, 1.28, -0.56], [0.24, 0.62, -0.58], [0.21, 0.18, 0.26], { amp: 0.35, off: 0, atk: -2.1, eAtk: 0.9, atkOff: 0, eBias: 0.2 });
  R.blob(ra.e, SL.base, [0.28, 0.5, -0.58], 0.3, [1.05, 1.1, 0.95], 0.25);
  for (const p of [[0.2, 1.0, -0.78], [0.26, 0.8, -0.8], [0.12, 0.62, -0.82], [0.35, 0.45, -0.8]]) R.spike(ra.e, SL.bone, p, [p[0] - 0.05, p[1] - 0.05, p[2] - 0.22], 0.05, 4);
  R.blob(ra.s, SL.base, [0.08, 1.92, -0.45], 0.28, [1, 0.9, 1], 0.2);
  const la = arm(R, sp, [0.06, 1.78, 0.36], [0.1, 1.42, 0.4], [0.2, 1.08, 0.4], [0.075, 0.065, 0.05], { amp: 0.45, off: PI, atk: -0.6, eBias: 0.5 });
  R.blob(la.e, SL.base, [0.22, 1.04, 0.4], 0.07, [1, 1, 0.8], 0.2, 0);
  for (const sd of [1, -1]) { const L = humLeg(R, pel, [0, 1.0, sd * 0.2], [0.05, 0.52, sd * 0.23], [0, 0.06, sd * 0.23], [0.18, 0.15, 0.11], sd > 0 ? PI : 0, { fs: 1.3 }); R.seg(L.h, SL.cloth, [0, 1.0, sd * 0.2], [0.04, 0.72, sd * 0.22], 0.2, 0.18, 6); }
  return R.build({ deadRoll: -PI / 2, deadDrop: 0.55, bob: 0.06, len: 1.3 });
}
function slither() {
  const R = new Rig();
  const b = R.joint([0, 0.5, 0], -1, [0, 1, 0], { sway: 0.08, amp: 0.12, dead: 0 });
  const fr = R.joint([0.35, 0.5, 0], b, [0, 1, 0], { amp: 0.3, off: 0, sway: 0.15, atk: 0.2, dead: 0.3 });
  const rr = R.joint([-0.35, 0.48, 0], b, [0, 1, 0], { amp: 0.35, off: PI, sway: 0.15, dead: -0.3 });
  const tl = R.joint([-1.0, 0.4, 0], rr, [0, 1, 0], { amp: 0.5, off: PI + 1.2, sway: 0.3, dead: 0.6 });
  R.blob(b, SL.base, [0, 0.55, 0], 0.5, [1.2, 0.75, 1.15], 0.3);
  R.blob(fr, SL.base, [0.72, 0.55, 0], 0.42, [1.3, 0.8, 1.05], 0.3);
  R.blob(rr, SL.base, [-0.75, 0.45, 0], 0.38, [1.3, 0.72, 1.05], 0.3);
  R.blob(tl, SL.base, [-1.4, 0.32, 0], 0.24, [1.6, 0.7, 1], 0.25);
  for (const p of [[0.3, 0.85, 0.2], [-0.4, 0.75, -0.25], [0.8, 0.8, -0.15], [-0.9, 0.65, 0.18]]) R.blob(p[0] > 0.5 ? fr : p[0] < -0.6 ? rr : b, SL.flesh, p, 0.17, [1, 0.7, 1], 0.35, 0);
  for (const p of [[0.1, 0.9, -0.1], [-0.6, 0.78, 0.1], [0.65, 0.9, 0.2]]) R.blob(p[0] > 0.5 ? fr : p[0] < -0.5 ? rr : b, SL.glow, p, 0.05, [1, 1, 1], 0, 0);
  // the maw, ringed with teeth
  const mw = R.joint([1.05, 0.52, 0], fr, [0, 0, 1], { sway: 0.1, atk: -0.5, dead: 0.3 });
  R.blob(mw, SL.flesh, [1.15, 0.5, 0], 0.2, [0.8, 1, 1.1], 0.2, 0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, y = 0.5 + Math.sin(a) * 0.17, z = Math.cos(a) * 0.19; R.spike(mw, SL.bone, [1.2, y, z], [1.33, y * 0.97 + 0.015, z * 0.7], 0.025, 3); }
  // six human-like arms scuttling along the sides
  [[0.75, 0.7, fr], [0.2, 1.4, b], [-0.55, 2.2, rr]].forEach(([x, a, par], i) => { for (const sd of [1, -1]) {
    const L = leg(R, par, [x, 0.42, sd * 0.35], sd, a, 0.42, 0.55, i * 1.1 + (sd > 0 ? 0 : PI), { s1: SL.base, s2: SL.base, r1: 0.06, r2: 0.05, r3: 0.03, amp: 0.55, lift: 0.5, rise: 0.4, reach: 0.65 });
    R.blob(L.kn, SL.base, [L.foot[0], 0.05, L.foot[2]], 0.06, [1.4, 0.5, 1.1], 0.2, 0);
  } });
  // tentacles: two lash forward, three writhe on the back
  const tent = (par, root, dirs, r, lash, off) => {
    let p = root, j = par;
    dirs.forEach((d, i) => { const q = [p[0] + d[0], p[1] + d[1], p[2] + d[2]]; j = R.joint(p, j, i % 2 ? [0, 1, 0] : [0, 0, 1], { amp: 0.25, off: off + i * 0.9, sway: 0.35, atk: lash * (i === 0 ? -0.8 : 0.5), dead: 0.4 }); R.seg(j, SL.flesh, p, q, r * (1 - i * 0.25), r * (1 - (i + 1) * 0.25), 5); p = q; });
  };
  for (const sd of [1, -1]) tent(fr, [0.9, 0.7, sd * 0.2], [[0.35, 0.25, sd * 0.1], [0.35, 0.05, sd * 0.05], [0.3, -0.12, 0]], 0.07, 1, sd);
  for (const [x, z] of [[0.1, 0.15], [-0.35, -0.2], [-0.7, 0.05]]) tent(x > 0 ? b : rr, [x, 0.85, z], [[-0.05, 0.4, z * 0.5], [-0.2, 0.35, z], [-0.3, 0.1, z]], 0.06, 0, x * 3);
  return R.build({ deadRoll: 0, deadDrop: -0.25, bob: 0.05, len: 2.8 });
}
function spitter() {
  const R = new Rig();
  const pel = R.joint([0, 1.0, 0], -1, [0, 1, 0], { sway: 0.05, amp: 0.06, dead: 0 });
  R.blob(pel, SL.base, [0, 1.0, 0], 0.22, [1, 0.8, 1.1], 0.15);
  const sp = R.joint([0.05, 1.05, 0], pel, [0, 0, 1], { amp: 0.05, sway: 0.04, atk: -0.15, dead: 0.3 });
  R.seg(sp, SL.base, [0, 1.02, 0], [0.62, 1.28, 0], 0.2, 0.25, 7);
  for (let i = 0; i < 5; i++) R.spike(sp, SL.bone, [0.05 + i * 0.13, 1.25 + i * 0.05, 0], [0.0 + i * 0.13, 1.38 + i * 0.05, 0], 0.03, 3); // spine ridge
  R.blob(sp, SL.flesh, [0.35, 1.08, 0.18], 0.1, [1, 1, 1], 0.3, 0);
  const nk = R.joint([0.62, 1.32, 0], sp, [0, 0, 1], { sway: 0.15, off: 1.5, atk: -0.7, atkOff: 0, dead: 0.5 });
  R.seg(nk, SL.base, [0.62, 1.32, 0], [0.98, 1.58, 0], 0.11, 0.09, 6);
  R.blob(nk, SL.glow, [0.84, 1.36, 0], 0.17, [1.25, 1, 1.05], 0.1);
  for (let i = 0; i < 4; i++) R.seg(nk, SL.flesh, [0.72, 1.36 + (i - 1.5) * 0.06, 0.12], [0.95, 1.36 + (i - 1.5) * 0.08, 0.1], 0.012, 0.01, 3);
  const hd = R.joint([0.98, 1.58, 0], nk, [0, 0, 1], { sway: 0.12, atk: -0.4, dead: 0.5 });
  R.blob(hd, SL.base, [1.1, 1.58, 0], 0.13, [1.5, 0.8, 1], 0.12);
  const jw = R.joint([1.04, 1.52, 0], hd, [0, 0, 1], { atk: 0.7, bias: 0.1, sway: 0.08, dead: 0.6 });
  R.seg(jw, SL.flesh, [1.04, 1.5, 0], [1.28, 1.47, 0], 0.07, 0.03, 5);
  for (const z of [0.05, -0.05]) R.blob(hd, SL.glow, [1.2, 1.63, z], 0.02, [1, 1, 1], 0, 0);
  for (const sd of [1, -1]) { const A = arm(R, sp, [0.5, 1.25, sd * 0.2], [0.62, 0.8, sd * 0.25], [0.78, 0.35, sd * 0.24], [0.06, 0.05, 0.035], { amp: 0.3, off: sd > 0 ? PI : 0, eBias: 0.1 }); R.spike(A.e, SL.dark, [0.78, 0.35, sd * 0.24], [0.9, 0.22, sd * 0.24], 0.03, 3); }
  for (const sd of [1, -1]) {
    const off = sd > 0 ? PI : 0;
    const h = R.joint([0, 1.0, sd * 0.15], pel, [0, 0, 1], { amp: 0.55, off, dead: -0.3 });
    const k = R.joint([0.28, 0.6, sd * 0.17], h, [0, 0, 1], { amp: 0.35, off: off - 1, bias: 0.2, dead: 0.7 });
    const a = R.joint([-0.05, 0.25, sd * 0.17], k, [0, 0, 1], { amp: 0.3, off: off - 2, dead: -0.4 });
    R.seg(h, SL.base, [0, 1.0, sd * 0.15], [0.28, 0.6, sd * 0.17], 0.11, 0.08); R.seg(k, SL.base, [0.28, 0.6, sd * 0.17], [-0.05, 0.25, sd * 0.17], 0.08, 0.05); R.seg(a, SL.dark, [-0.05, 0.25, sd * 0.17], [0.16, 0.02, sd * 0.17], 0.05, 0.03);
  }
  return R.build({ deadRoll: PI / 2, deadDrop: 0.3, bob: 0.05, len: 1.4 });
}
function bloater() {
  const R = new Rig();
  const pel = R.joint([0, 0.55, 0], -1, [1, 0, 0], { amp: 0.1, off: 0, freq: 1, sway: 0.03, dead: 0 });
  const tor = R.joint([0, 0.6, 0], pel, [0, 0, 1], { sway: 0.05, amp: 0.04, atk: 0.3, dead: 0 });
  R.blob(tor, SL.base, [0.02, 1.08, 0], 0.76, [1, 1.05, 1.05], 0.12, 2);
  for (let i = 0; i < 14; i++) { const a = i * 2.39996, y = 0.7 + (i % 5) * 0.17, rr = Math.sqrt(Math.max(0.05, 0.6 - (y - 1.08) ** 2)); R.blob(tor, i % 3 ? SL.glow : SL.flesh, [Math.cos(a) * rr * 1.05 + 0.02, y, Math.sin(a) * rr * 1.05], 0.06 + (i % 4) * 0.02, [1, 1, 1], 0.2, 0); }
  for (let i = 0; i < 6; i++) { const a = i * 1.05; R.seg(tor, SL.flesh, [Math.cos(a) * 0.55, 1.5, Math.sin(a) * 0.55], [Math.cos(a + 0.4) * 0.78, 1.0, Math.sin(a + 0.4) * 0.78], 0.018, 0.012, 3); }
  const hd = R.joint([0.3, 1.78, 0], tor, [0, 0, 1], { sway: 0.08, dead: 0.3 });
  R.blob(hd, SL.base, [0.36, 1.86, 0], 0.15, [1, 0.9, 0.95], 0.15);
  R.blob(hd, SL.flesh, [0.48, 1.8, 0], 0.06, [1, 0.7, 1.3], 0, 0);
  for (const sd of [1, -1]) arm(R, tor, [0.2, 1.5, sd * 0.66], [0.32, 1.12, sd * 0.74], [0.42, 0.85, sd * 0.72], [0.1, 0.09, 0.07], { amp: 0.3, off: sd > 0 ? 0 : PI, eBias: 0.4 });
  for (const sd of [1, -1]) humLeg(R, pel, [0, 0.55, sd * 0.32], [0.06, 0.3, sd * 0.34], [0, 0.06, sd * 0.34], [0.2, 0.18, 0.15], sd > 0 ? PI : 0, { amp: 0.4, kAmp: 0.2, fs: 1.4 });
  return R.build({ deadRoll: -PI / 2, deadDrop: 0.8, bob: 0.08, len: 1.6 });
}
function titan() {
  const R = new Rig();
  const pel = R.joint([0, 3.6, 0], -1, [0, 1, 0], { sway: 0.03, amp: 0.06, dead: 0 });
  R.blob(pel, SL.base, [0, 3.5, 0], 0.95, [1.1, 0.85, 1.25], 0.12);
  const sp = R.joint([0.2, 3.9, 0], pel, [0, 0, 1], { amp: 0.04, off: 0.5, sway: 0.03, atk: 0.3, dead: 0.1 });
  R.seg(sp, SL.base, [0.1, 3.8, 0], [1.4, 5.9, 0], 1.0, 1.35, 8);
  R.blob(sp, SL.base, [1.35, 6.05, 0], 1.35, [1.05, 0.85, 1.35], 0.14, 1);
  for (const p of [[0.4, 5.6, 0.7], [0.7, 6.3, -0.6], [0.1, 4.8, -0.8], [1.0, 6.8, 0.3]]) R.blob(sp, SL.flesh, p, 0.5, [1, 0.6, 1], 0.3, 0);
  for (const p of [[0.6, 6.7, 0.5], [0.2, 6.2, -0.5], [-0.1, 5.4, 0.3], [0.9, 7.0, -0.2]]) R.blob(sp, SL.glow, p, 0.18, [1, 1, 1], 0.2, 0);
  for (let i = 0; i < 7; i++) R.spike(sp, SL.bone, [1.4 - i * 0.24, 6.95 - i * 0.45, ((i % 3) - 1) * 0.4], [0.9 - i * 0.3, 7.7 - i * 0.4, ((i % 3) - 1) * 0.6], 0.16, 5);
  const hd = R.joint([2.3, 5.9, 0], sp, [0, 0, 1], { sway: 0.06, off: 2, atk: 0.25, dead: 0.4 });
  R.blob(hd, SL.base, [2.6, 5.8, 0], 0.55, [1.15, 0.9, 1.05], 0.15);
  const jw = R.joint([2.6, 5.55, 0], hd, [0, 0, 1], { atk: 0.5, sway: 0.05, dead: 0.4 });
  R.blob(jw, SL.flesh, [2.95, 5.45, 0], 0.32, [1.3, 0.55, 1.1], 0.2, 0);
  for (const z of [-0.25, -0.08, 0.08, 0.25]) R.spike(jw, SL.bone, [3.2, 5.55, z], [3.35, 5.75, z], 0.05, 3);
  for (const z of [0.22, -0.22]) R.blob(hd, SL.glow, [3.05, 5.95, z], 0.07, [1, 1, 1], 0, 0);
  // long arms reaching the ground on the knuckles
  for (const sd of [1, -1]) {
    const off = sd > 0 ? 0 : PI;
    const A = arm(R, sp, [1.5, 6.0, sd * 1.35], [2.3, 3.4, sd * 1.7], [2.7, 0.9, sd * 1.7], [0.6, 0.5, 0.65], { amp: 0.32, off, atk: -2.0, eAtk: 0.8, eBias: 0.15, eAmp: 0.18 });
    R.blob(A.s, SL.base, [1.5, 6.15, sd * 1.4], 0.85, [1, 0.9, 1], 0.15);
    R.blob(A.e, SL.base, [2.75, 0.62, sd * 1.7], 0.72, [1.15, 0.9, 1], 0.2);
    for (const p of [[2.3, 2.6, sd * 2.25], [2.5, 1.8, sd * 2.25], [2.0, 3.2, sd * 2.1]]) R.spike(A.e, SL.bone, p, [p[0] - 0.3, p[1] + 0.2, p[2] + sd * 0.5], 0.14, 4);
    R.blob(A.e, SL.flesh, [2.45, 2.2, sd * 1.95], 0.3, [1, 1.4, 0.6], 0.2, 0);
  }
  for (const sd of [1, -1]) humLeg(R, pel, [0, 3.4, sd * 0.85], [0.55, 1.85, sd * 0.95], [0, 0.25, sd * 0.95], [0.75, 0.62, 0.5], sd > 0 ? PI : 0, { amp: 0.38, kAmp: 0.3, fs: 4.5 });
  return R.build({ deadRoll: -PI / 2, deadDrop: 1.9, bob: 0.25, len: 4 });
}

export const RIGS = {
  drone: () => drone(false), droneM: () => drone(true),
  hunter: () => hunter(false), hunterM: () => hunter(true),
  warrior: () => mantis(false, 1.0, false), warriorM: () => mantis(true, 1.0, false),
  warden: () => mantis(false, 1.55, true), wardenM: () => mantis(true, 1.55, true),
  crusher: () => crusher(false), crusherM: () => crusher(true),
  boiler: () => boiler(false), boilerM: () => boiler(true),
  brute, slither, spitter, bloater, titan,
};
// colours: [base, accent]; glow per model family
export const LOOKS = {
  drone: [0x6b5a2e, 0xc9a54a], hunter: [0x2f3a2a, 0x6f7f3a], warrior: [0x4a2a22, 0x9a5a3a], crusher: [0x3a3530, 0x7a6a55], boiler: [0x4e5a2a, 0x8a9a3a], warden: [0x2a2230, 0x7a4a6a],
  brute: [0x6e564c, 0x8a3a34], slither: [0x664c48, 0x7a2a2a], spitter: [0x5e5e4a, 0x6a6a3a], bloater: [0x84765e, 0x8a4a3a], titan: [0x5a4a42, 0x7a3a30],
};
export const GLOW = { swarm: [0.95, 0.68, 0.18], boiler: [0.62, 0.92, 0.22], mutant: [0.75, 0.85, 0.25], spitter: [0.55, 0.95, 0.3] };
