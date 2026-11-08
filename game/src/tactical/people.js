// People: low-poly humanoid figures built in code and animated on the GPU. Every vertex belongs to a body part
// (hips, torso, head, arms, forearms, thighs, shins, rifle, handgun); the vertex shader poses the parts from a
// procedural clip (walk, run, aim, fire, kneel, shamble, claw, lope, fall …) so thousands of instanced figures
// animate for the cost of one draw call per figure type. Colours come per instance (skin, top, bottom, hair,
// accent) and cloth can carry a procedural camouflage pattern.
import * as THREE from 'three';

export const PART = { hips: 0, torso: 1, head: 2, uaL: 3, uaR: 4, faL: 5, faR: 6, thL: 7, thR: 8, shL: 9, shR: 10, rifle: 11, gun: 12 };
export const SLOT = { skin: 0, top: 1, bottom: 2, shoe: 3, hair: 4, acc: 5, metal: 6, gear: 7, fur: 8 };
export const CLIP = { idle: 0, walk: 1, run: 2, aim: 3, fire: 4, kneelAim: 5, kneelFire: 6, rifleWalk: 7, rifleRun: 8, shamble: 9, claw: 10, lope: 11, vampRun: 12, panic: 13, dead: 14, pistolAim: 15, pistolFire: 16, rifleIdle: 17, prowl: 18,
  bite: 19, bitten: 20, crawl: 21, flinch: 22, rise: 23, feed: 24, cower: 25, reload: 26, throw: 27, drag: 28, dragged: 29, pounce: 30, vampFeed: 31, lifted: 32 };
// dismemberment: bits of the per-instance part mask (lost parts), and the joint each one is severed at
export const LOST = { head: 1, armL: 2, armR: 4, legL: 8, legR: 16 };
export const CAMO = { none: 0, woodland: 1, multicam: 2, flecktarn: 3, digital: 4, splinter: 5, desert: 6, vegetato: 7, dpm: 8 };

// joint pivots for an adult (metres, figure faces +X, left side is +Z)
const HUMAN = { waist: [0, 1.0, 0], neck: [0, 1.5, 0], shL: [0, 1.42, 0.2], shR: [0, 1.42, -0.2], elL: [0, 1.14, 0.22], elR: [0, 1.14, -0.22], hipL: [0, 0.93, 0.1], hipR: [0, 0.93, -0.1], knL: [0, 0.5, 0.1], knR: [0, 0.5, -0.1], gun: [0.1, 1.37, -0.12] };
const LYCAN = { waist: [0, 1.05, 0], neck: [0.1, 1.62, 0], shL: [0.04, 1.5, 0.25], shR: [0.04, 1.5, -0.25], elL: [0.04, 1.12, 0.3], elR: [0.04, 1.12, -0.3], hipL: [0, 0.98, 0.13], hipR: [0, 0.98, -0.13], knL: [0.1, 0.58, 0.13], knR: [0.1, 0.58, -0.13], gun: [0.12, 1.3, -0.08] };

// ---------------- geometry ----------------
class Builder {
  constructor() { this.pos = []; this.nor = []; this.part = []; this.slot = []; }
  add(geo, part, slot, m) {
    if (m) geo.applyMatrix4(m);
    const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) { this.part.push(part); this.slot.push(slot); }
  }
  box(part, slot, cx, cy, cz, sx, sy, sz, taper = 1) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    if (taper !== 1) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) if (a.getY(i) > 0) { a.setX(i, a.getX(i) * taper); a.setZ(i, a.getZ(i) * taper); } }
    g.translate(cx, cy, cz); this.add(g, part, slot);
  }
  // vertical tapered prism from y0 (radius r0) to y1 (radius r1)
  limb(part, slot, x, y0, y1, z, r0, r1, sides = 6, dx = 0, cap = false) {
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, sides, 1, !cap); g.translate(0, (y0 + y1) / 2, 0);
    if (dx) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) a.setX(i, a.getX(i) + dx * (a.getY(i) - y0) / (y1 - y0)); }
    g.translate(x, 0, z); this.add(g, part, slot);
  }
  ball(part, slot, cx, cy, cz, r, sx = 1, sy = 1, sz = 1, detail = 1) { const g = detail > 0 ? new THREE.SphereGeometry(r, 7, 5) : new THREE.IcosahedronGeometry(r, 0); g.scale(sx, sy, sz); g.translate(cx, cy, cz); this.add(g, part, slot); }
  // horizontal tube along +X
  tube(part, slot, x0, x1, y, z, r, sides = 5) { const g = new THREE.CylinderGeometry(r, r, x1 - x0, sides, 1); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, y, z); this.add(g, part, slot); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
    g.setAttribute('aSlot', new THREE.Float32BufferAttribute(this.slot, 1));
    g.computeBoundingSphere(); g.boundingSphere.radius = 3;
    return g;
  }
}
const P = PART, S = SLOT;

// a human figure. o: { sex: 'm'|'f', bulk, lower: 'trousers'|'shorts'|'skirt'|'robe'|'longskirt', top: 'shirt'|'jacket'|'coat'|'robe'|'tunic'|'abaya',
//   hair: 'short'|'long'|'bun'|'bald'|'scarf'|'ghutra'|'none', hat: null|'cap'|'kepi'|'helmet'|'beret'|'hood', vest: null|'plate'|'police'|'hivis',
//   pack, rifle, holster, gun, drape }
export function humanGeometry(o = {}) {
  const B = new Builder(), f = o.sex === 'f', k = o.bulk || 1, sw = (f ? 0.17 : 0.19) * k;
  const longLow = o.lower === 'robe' || o.lower === 'longskirt' || o.top === 'abaya' || o.top === 'robe';
  // legs
  for (const [th, sh, z] of [[P.thL, P.shL, 0.1], [P.thR, P.shR, -0.1]]) {
    const lslot = o.lower === 'shorts' ? S.skin : S.bottom;
    B.limb(th, o.lower === 'shorts' ? S.bottom : S.bottom, 0, 0.5, 0.95, z, 0.06 * k, 0.085 * k);
    B.limb(sh, o.lower === 'skirt' || o.lower === 'shorts' ? S.skin : lslot, 0, 0.08, 0.5, z, 0.045 * k, 0.06 * k);
    B.box(sh, S.shoe, 0.05, 0.04, z, 0.25, 0.08, 0.1); // shoe / boot
    if (o.boots) B.limb(sh, S.shoe, 0, 0.08, 0.24, z, 0.058, 0.058, 6, 0, true);
    if (o.kneepads) B.box(sh, S.gear, 0.06, 0.48, z, 0.06, 0.1, 0.1);
  }
  // hips and lower garments
  B.box(P.hips, S.bottom, 0, 0.96, 0, 0.22 * k, 0.16, sw * 2 - 0.02, 1);
  if (o.lower === 'skirt') B.limb(P.hips, S.bottom, 0, 0.55, 1.0, 0, 0.22 * k, 0.16 * k, 8, 0, true);
  if (longLow) {
    // ankle-length robe / abaya / long skirt: hangs from the hips, split so the legs can stride inside it
    const slot = o.top === 'robe' || o.top === 'abaya' ? S.top : S.bottom;
    B.limb(P.thL, slot, 0, 0.5, 0.98, 0.06, 0.13 * k, 0.12 * k, 6);
    B.limb(P.thR, slot, 0, 0.5, 0.98, -0.06, 0.13 * k, 0.12 * k, 6);
    B.limb(P.shL, slot, 0, 0.1, 0.52, 0.07, 0.15 * k, 0.13 * k, 6);
    B.limb(P.shR, slot, 0, 0.1, 0.52, -0.07, 0.15 * k, 0.13 * k, 6);
  }
  // torso
  B.box(P.torso, S.top, 0, 1.24, 0, 0.22 * k, 0.5, sw * 2, f ? 1.08 : 1.12);
  if (f) B.box(P.torso, S.top, 0.08, 1.3, 0, 0.1, 0.14, sw * 1.6);
  if (o.top === 'jacket' || o.top === 'coat') B.box(P.torso, S.top, 0, 1.06, 0, 0.25 * k, 0.16, sw * 2 + 0.04);
  if (o.top === 'coat') { B.limb(P.thL, S.top, 0, 0.62, 1.0, 0.07, 0.13 * k, 0.13 * k, 6); B.limb(P.thR, S.top, 0, 0.62, 1.0, -0.07, 0.13 * k, 0.13 * k, 6); }
  if (o.top === 'tunic') { B.limb(P.thL, S.top, 0, 0.66, 1.0, 0.06, 0.12 * k, 0.12 * k, 6); B.limb(P.thR, S.top, 0, 0.66, 1.0, -0.06, 0.12 * k, 0.12 * k, 6); }
  if (o.drape) B.box(P.torso, S.acc, 0.02, 1.28, 0.05, 0.24 * k, 0.42, 0.14, 1); // sari pallu / shawl over one shoulder
  // vests and kit
  if (o.vest === 'plate') { B.box(P.torso, S.gear, 0.02, 1.25, 0, 0.3 * k, 0.36, sw * 2 + 0.02); B.box(P.torso, S.gear, 0.15, 1.18, 0, 0.06, 0.14, sw * 1.7); }
  if (o.vest === 'police' || o.vest === 'hivis') B.box(P.torso, S.acc, 0.01, 1.25, 0, 0.26 * k, 0.36, sw * 2 + 0.02);
  if (o.belt !== false && (o.vest || o.holster)) B.box(P.hips, S.gear, 0, 1.0, 0, 0.24 * k, 0.05, sw * 2 + 0.01);
  if (o.holster) B.box(P.hips, S.gear, 0, 0.92, -sw - 0.02, 0.1, 0.14, 0.05);
  if (o.pack) { B.box(P.torso, S.gear, -0.17, 1.27, 0, 0.13, 0.32, 0.25); B.box(P.torso, S.gear, -0.15, 1.08, 0, 0.1, 0.08, 0.22); }
  // neck and head
  B.limb(P.torso, S.skin, 0, 1.46, 1.54, 0, 0.05, 0.045, 5);
  B.ball(P.head, S.skin, 0.01, 1.63, 0, 0.105, 1, 1.12, 0.92);
  B.box(P.head, S.skin, 0.1, 1.61, 0, 0.04, 0.04, 0.03); // nose
  const hair = o.hair || 'short';
  if (hair === 'short') B.ball(P.head, S.hair, -0.03, 1.675, 0, 0.11, 1, 0.8, 0.98, 1);
  if (hair === 'long') { B.ball(P.head, S.hair, -0.03, 1.675, 0, 0.114, 1, 0.84, 1.02, 1); B.box(P.head, S.hair, -0.07, 1.5, 0, 0.08, 0.26, 0.2); }
  if (hair === 'bun') { B.ball(P.head, S.hair, -0.03, 1.675, 0, 0.11, 1, 0.8, 0.98, 1); B.ball(P.head, S.hair, -0.1, 1.68, 0, 0.055); }
  if (hair === 'scarf') { B.ball(P.head, S.acc, -0.045, 1.64, 0, 0.128, 1.0, 1.1, 1.04, 1); B.box(P.torso, S.acc, -0.02, 1.47, 0, 0.2, 0.12, 0.3); }
  if (hair === 'ghutra') { B.ball(P.head, S.acc, -0.04, 1.665, 0, 0.124, 1, 0.9, 1.04, 1); B.box(P.head, S.acc, -0.06, 1.48, 0, 0.12, 0.3, 0.26); B.limb(P.head, S.hair, -0.01, 1.73, 1.76, 0, 0.11, 0.11, 10, 0, true); }
  // headwear
  if (o.hat === 'cap' || o.hat === 'kepi') { B.limb(P.head, o.hatSlot ?? S.acc, -0.01, 1.68, o.hat === 'kepi' ? 1.82 : 1.77, 0, 0.115, o.hat === 'kepi' ? 0.1 : 0.125, 10, 0, true); B.box(P.head, S.metal, 0.12, 1.69, 0, 0.1, 0.015, 0.18); }
  if (o.hat === 'beret') B.ball(P.head, S.acc, -0.02, 1.72, 0.02, 0.12, 1.05, 0.38, 1.05, 1);
  if (o.hat === 'helmet') { B.ball(P.head, S.gear, -0.015, 1.665, 0, 0.138, 1.04, 0.86, 1.04, 1); B.box(P.head, S.gear, -0.02, 1.6, 0, 0.2, 0.06, 0.25); B.box(P.head, S.metal, 0.11, 1.7, 0, 0.03, 0.04, 0.05); } // ballistic helmet: low sides, NVG mount
  if (o.hat === 'hood') B.ball(P.head, S.top, -0.03, 1.65, 0, 0.13, 1.05, 1.12, 1.02, 1);
  if (o.hat === 'brim') { B.limb(P.head, S.acc, -0.01, 1.7, 1.79, 0, 0.11, 0.1, 10, 0, true); B.limb(P.head, S.acc, -0.01, 1.7, 1.715, 0, 0.21, 0.21, 12, 0, true); }
  // arms
  for (const [ua, fa, z, s] of [[P.uaL, P.faL, 0.22, 1], [P.uaR, P.faR, -0.22, -1]]) {
    const sl = o.sleeves === 'short' ? S.skin : S.top;
    B.limb(ua, S.top, 0, 1.13, 1.45, z * k, 0.048 * k, 0.062 * k, 6);
    B.limb(fa, sl, 0, 0.88, 1.15, z * k, 0.04 * k, 0.048 * k, 6);
    B.box(fa, S.skin, 0.0, 0.84, z * k, 0.07, 0.09, 0.04); // hand
    if (o.vest === 'plate') B.box(ua, S.gear, 0, 1.38, (z + s * 0.02) * k, 0.12, 0.1, 0.06); // shoulder pad
  }
  // weapons
  if (o.rifle) { // carbine held across the chest; rest pose points forward
    B.box(P.rifle, S.metal, 0.18, 1.35, -0.12, 0.17, 0.07, 0.045); // stock, butt in the shoulder
    B.box(P.rifle, S.metal, 0.37, 1.36, -0.12, 0.22, 0.08, 0.05); // receiver
    B.box(P.rifle, S.metal, 0.42, 1.27, -0.12, 0.05, 0.13, 0.035); // magazine
    B.box(P.rifle, S.metal, 0.3, 1.3, -0.12, 0.04, 0.08, 0.03); // pistol grip
    B.tube(P.rifle, S.metal, 0.46, 0.9, 1.37, -0.12, 0.018); // barrel
    B.box(P.rifle, S.metal, 0.55, 1.36, -0.12, 0.16, 0.05, 0.05); // handguard
  }
  if (o.gun) { B.box(P.gun, S.metal, 0.03, 0.84, -0.22 * k, 0.16, 0.05, 0.035); B.box(P.gun, S.metal, -0.02, 0.8, -0.22 * k, 0.04, 0.08, 0.03); }
  return B.build();
}

// werewolf: big, hunched, digitigrade, clawed, a muzzle and ears; covered in fur (slot fur), torn clothes (slots top/bottom)
export function lycanGeometry() {
  const B = new Builder();
  for (const [th, sh, z] of [[P.thL, P.shL, 0.13], [P.thR, P.shR, -0.13]]) {
    B.limb(th, S.fur, 0, 0.56, 1.02, z, 0.08, 0.13, 6, 0.1);
    B.limb(th, S.bottom, 0, 0.7, 1.02, z, 0.11, 0.14, 6, 0.06); // torn trousers
    B.limb(sh, S.fur, 0.1, 0.12, 0.6, z, 0.045, 0.075, 6, -0.18); // backward-angled shank
    B.box(sh, S.fur, 0.0, 0.05, z, 0.24, 0.08, 0.12); B.box(sh, S.metal, 0.13, 0.03, z, 0.06, 0.04, 0.1); // paw and claws
  }
  B.box(P.hips, S.bottom, 0, 1.02, 0, 0.26, 0.2, 0.32);
  { const g = new THREE.ConeGeometry(0.055, 0.42, 5); g.rotateZ(2.21); g.translate(-0.28, 0.86, 0); B.add(g, P.hips, S.fur); } // tail
  B.box(P.torso, S.fur, 0.05, 1.31, 0, 0.32, 0.42, 0.42, 1.18); // deep chest
  B.ball(P.torso, S.fur, -0.03, 1.47, 0, 0.21, 1.05, 0.78, 1.18); // hunched shoulders
  B.box(P.torso, S.top, 0.04, 1.14, 0, 0.36, 0.2, 0.42); // shirt rags
  B.limb(P.torso, S.fur, 0.08, 1.48, 1.64, 0, 0.11, 0.09, 6, 0.08); // thick neck, thrust forward
  B.ball(P.head, S.fur, 0.14, 1.71, 0, 0.12, 1.1, 0.9, 0.92);
  B.box(P.head, S.fur, 0.3, 1.67, 0, 0.2, 0.09, 0.1, 0.75); // muzzle
  B.box(P.head, S.metal, 0.4, 1.68, 0, 0.035, 0.04, 0.05); // nose
  B.box(P.head, S.metal, 0.29, 1.615, 0, 0.17, 0.02, 0.08); // jaw shadow
  for (const z of [0.06, -0.06]) { const g = new THREE.ConeGeometry(0.04, 0.13, 4); g.rotateZ(0.25); g.translate(0.08, 1.83, z); B.add(g, P.head, S.fur); }
  for (const [ua, fa, z] of [[P.uaL, P.faL, 0.29], [P.uaR, P.faR, -0.29]]) {
    B.limb(ua, S.fur, 0.04, 1.1, 1.53, z, 0.06, 0.085, 6);
    B.limb(fa, S.fur, 0.04, 0.72, 1.14, z, 0.045, 0.06, 6);
    B.box(fa, S.fur, 0.05, 0.66, z, 0.1, 0.12, 0.08);
    for (const dz of [-0.025, 0, 0.025]) B.box(fa, S.metal, 0.11, 0.6, z + dz, 0.08, 0.02, 0.012); // claws
  }
  return B.build();
}

// ---------------- material ----------------
const POSE_GLSL = /* glsl */`
attribute float aPart; attribute float aSlot;
attribute vec4 iAnim; attribute vec4 iC; attribute vec4 iD; attribute vec4 iE;
uniform float uTime; uniform vec3 uPiv[11]; uniform float uLean;
varying vec3 vPCol; varying float vCloth; varying vec4 vCamo; varying vec3 vC2; varying vec3 vC3; varying vec3 vObj; varying float vGrime; varying vec3 vGore;
vec3 unpack(float f) { f = floor(f + 0.5); float r = floor(f / 65536.0), g = floor((f - r * 65536.0) / 256.0); return vec3(r, g, f - r * 65536.0 - g * 256.0) / 255.0; }
mat3 rz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
mat3 rx(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
// angles: 0 thL 1 thR 2 shL 3 shR 4 uaL 5 uaR 6 abL 7 abR 8 faL 9 faR 10 torso lean 11 head 12 rifle 13 bob 14 drop 15 gunVis
void pose(float clip, float ph, float sd, float t0, out float A[18]) {
  for (int i = 0; i < 18; i++) A[i] = 0.;
  float s = sin(ph * 6.2832), c = cos(ph * 6.2832), s2 = sin(ph * 12.566);
  A[12] = 0.; A[15] = 0.;
  if (clip < 0.5) { // idle: breathing, weight shift
    float b = sin(uTime * 1.3 + sd * 20.);
    A[4] = 0.06 * b; A[5] = -0.06 * b; A[8] = 0.15; A[9] = 0.15; A[6] = 0.08; A[7] = 0.08; A[11] = 0.05 * sin(uTime * 0.4 + sd * 9.); A[13] = 0.004 * b;
  } else if (clip < 1.5 || clip > 6.5 && clip < 7.5) { // walk / rifle walk
    A[0] = 0.42 * s; A[1] = -0.42 * s; A[2] = -0.55 * max(0., -s) - 0.08; A[3] = -0.55 * max(0., s) - 0.08;
    A[4] = -0.32 * s; A[5] = 0.32 * s; A[8] = 0.22; A[9] = 0.22; A[6] = 0.06; A[7] = 0.06; A[13] = 0.03 * abs(c) - 0.02; A[10] = 0.04;
    if (clip > 6.5) { A[5] = -0.3; A[9] = 1.85; A[7] = -0.6; A[4] = 0.5; A[8] = 0.55; A[6] = -0.6; A[12] = -0.62; }
  } else if (clip < 2.5 || clip > 7.5 && clip < 8.5 || clip > 12.5 && clip < 13.5) { // run / rifle run / panic
    A[0] = 0.85 * s; A[1] = -0.85 * s; A[2] = -1.25 * max(0., -s) - 0.25; A[3] = -1.25 * max(0., s) - 0.25;
    A[4] = -0.8 * s; A[5] = 0.8 * s; A[8] = 1.3; A[9] = 1.3; A[10] = 0.22; A[13] = 0.07 * abs(c) - 0.04;
    if (clip > 7.5 && clip < 8.5) { A[5] = -0.2; A[9] = 1.85; A[7] = -0.6; A[4] = 0.6; A[8] = 0.5; A[6] = -0.6; A[12] = -0.5; A[10] = 0.3; }
    if (clip > 12.5) { A[4] = 1.6 + 0.5 * s; A[5] = 1.6 - 0.5 * s; A[6] = 0.5; A[7] = 0.5; A[8] = 0.4; A[9] = 0.4; A[10] = 0.12; A[11] = -0.2; }
  } else if (clip < 4.5 || clip > 14.5 && clip < 16.5) { // aim / fire (rifle or pistol)
    bool pistol = clip > 14.5; bool fire = clip > 3.5 && clip < 4.5 || clip > 15.5;
    float k = fire ? max(0., sin(uTime * 37. + sd * 30.)) : 0.;
    A[0] = 0.15; A[1] = -0.12; A[2] = -0.1; A[3] = -0.05; A[10] = 0.06 - k * 0.04; A[11] = 0.08;
    if (pistol) { A[5] = 1.05 + k * 0.12; A[9] = 0.75; A[7] = -0.4; A[4] = 0.95 + k * 0.12; A[8] = 0.8; A[6] = -0.5; A[15] = 1.; }
    else { A[5] = 0.1; A[9] = 1.85; A[7] = -0.6; A[4] = 1.0; A[8] = 0.5; A[6] = -0.6; A[12] = k * 0.05; A[10] -= k * 0.03; }
  } else if (clip < 6.5) { // kneeling aim / fire
    bool fire = clip > 5.5; float k = fire ? max(0., sin(uTime * 37. + sd * 30.)) : 0.;
    A[0] = 1.45; A[2] = -1.45; A[1] = -0.25; A[3] = -1.75; A[13] = -0.42; A[10] = 0.15;
    A[5] = 0.1; A[9] = 1.85; A[7] = -0.6; A[4] = 1.0; A[8] = 0.5; A[6] = -0.6; A[12] = k * 0.05; A[11] = 0.05;
  } else if (clip < 9.5) { // shamble: hunched, arms reaching, dragging one leg
    float s3 = sin(ph * 6.2832 + 0.4);
    A[0] = 0.32 * s; A[1] = -0.18 * s; A[2] = -0.4 * max(0., -s) - 0.15; A[3] = -0.2;
    A[4] = 1.25 + 0.15 * s3 + sd * 0.3; A[5] = 1.05 - 0.15 * s3; A[6] = -0.1; A[7] = 0.05; A[8] = 0.2; A[9] = 0.45;
    A[10] = 0.38 + 0.05 * s; A[11] = -0.35 + 0.25 * sd; A[13] = 0.03 * abs(c) - 0.04;
  } else if (clip < 10.5) { // claw / bite attack
    float k = sin(uTime * 9. + sd * 10.);
    A[0] = 0.35; A[1] = -0.3; A[2] = -0.3; A[3] = -0.4; A[10] = 0.45 + 0.1 * k;
    A[4] = 1.6 + 0.9 * k; A[5] = 1.6 - 0.9 * k; A[8] = 0.6; A[9] = 0.6; A[6] = -0.2; A[7] = -0.2; A[11] = 0.2;
  } else if (clip < 11.5) { // lycan lope: bounding, arms driving like forelegs
    A[0] = 0.95 * s; A[1] = 0.95 * s; A[2] = -1.1 * max(0., c) - 0.3; A[3] = -1.1 * max(0., c) - 0.3;
    A[4] = -0.9 * s + 0.6; A[5] = -0.9 * s + 0.6; A[8] = 0.6; A[9] = 0.6; A[10] = 0.55 + 0.1 * c; A[11] = -0.55; A[13] = 0.12 * abs(c) - 0.08;
  } else if (clip < 12.5) { // vampire sprint: leaning in, arms swept back
    A[0] = 0.95 * s; A[1] = -0.95 * s; A[2] = -1.3 * max(0., -s) - 0.25; A[3] = -1.3 * max(0., s) - 0.25;
    A[4] = -1.1; A[5] = -1.1; A[6] = 0.25; A[7] = 0.25; A[8] = 0.1; A[9] = 0.1; A[10] = 0.55; A[11] = -0.45; A[13] = 0.05 * abs(c) - 0.06;
  } else if (clip < 14.5) { // dead: falls over, then lies
    float f = clamp((uTime - t0) / 0.7, 0., 1.);
    A[4] = 0.6 * f + sd; A[5] = -0.4 * f; A[6] = 0.6 * f; A[7] = 0.9 * f * sd; A[8] = 0.5; A[9] = 0.2; A[0] = 0.3 * f * sd; A[2] = -0.4 * f;
    A[14] = f;
  } else if (clip < 17.5) { // rifle at low ready, standing
    float b = sin(uTime * 1.3 + sd * 20.);
    A[5] = -0.3; A[9] = 1.85; A[7] = -0.6; A[4] = 0.5; A[8] = 0.55; A[6] = -0.6; A[12] = -0.62; A[13] = 0.004 * b; A[11] = 0.04 * sin(uTime * 0.5 + sd * 7.);
  } else if (clip < 18.5) { // prowl: lycan or vampire idling, crouched and swaying
    float b = sin(uTime * 2. + sd * 20.);
    A[0] = 0.5; A[1] = 0.3; A[2] = -0.8; A[3] = -0.6; A[13] = -0.12; A[10] = 0.55 + 0.05 * b; A[4] = 0.7; A[5] = 0.5; A[8] = 0.5; A[9] = 0.6; A[11] = -0.2 + 0.1 * b;
  } else if (clip < 19.5) { // bite: lunging grab, head tearing
    float k = sin(uTime * 7. + sd * 9.);
    A[0] = 0.5; A[1] = -0.35; A[2] = -0.5; A[3] = -0.3; A[10] = 0.5 + 0.06 * k; A[13] = -0.06;
    A[4] = 1.35; A[5] = 1.45; A[6] = -0.35; A[7] = -0.35; A[8] = 0.9; A[9] = 0.9; A[11] = 0.45 + 0.25 * k;
  } else if (clip < 20.5) { // bitten: struggling, pushing the attacker away, buckling
    float k = sin(uTime * 11. + sd * 7.), f = clamp((uTime - t0) / 2.2, 0., 1.);
    A[0] = -0.2 + 0.25 * k; A[1] = 0.3 - 0.25 * k; A[2] = -0.4 - f * 0.8; A[3] = -0.3 - f * 0.9; A[13] = -0.25 * f;
    A[4] = 1.3 + 0.4 * k; A[5] = 1.1 - 0.4 * k; A[6] = -0.2; A[7] = -0.2; A[8] = 0.9; A[9] = 1.1; A[10] = -0.25 + 0.4 * f; A[11] = -0.5 + 0.2 * k;
  } else if (clip < 21.5) { // crawl: prone, dragging itself on its arms
    A[14] = 1.; A[16] = -1.; A[17] = -0.85;
    A[4] = 2.7 + 0.45 * s; A[5] = 2.7 - 0.45 * s; A[8] = 0.6 - 0.5 * s; A[9] = 0.6 + 0.5 * s; A[6] = 0.3; A[7] = 0.3; A[11] = -0.9; A[10] = -0.1;
    A[0] = 0.1 * s; A[1] = -0.1 * s;
  } else if (clip < 22.5) { // flinch: knocked back by a hit
    float k = exp(-(uTime - t0) * 7.);
    A[10] = -0.45 * k; A[11] = -0.5 * k; A[4] = 0.6 * k; A[5] = 0.8 * k; A[6] = 0.4 * k; A[7] = 0.4 * k; A[0] = 0.3 * k; A[3] = -0.4 * k; A[13] = -0.05 * k;
  } else if (clip < 23.5) { // rise: the dead get up, in jerks
    float f = clamp((uTime - t0) / 1.6, 0., 1.), j = f + 0.06 * sin(uTime * 23.) * (1. - f);
    A[14] = 1. - smoothstep(0.15, 1., j); A[16] = 1.; A[4] = 1.2 * (1. - f); A[5] = 0.6 * (1. - f); A[8] = 1.2 * (1. - f); A[9] = 1.4 * (1. - f); A[2] = -1.2 * (1. - f); A[0] = 0.9 * (1. - f); A[11] = -0.6 * (1. - f) + 0.3 * f;
  } else if (clip < 24.5) { // feed: kneeling over a body, tearing at it
    float k = sin(uTime * 5. + sd * 11.);
    A[0] = 1.45; A[2] = -1.6; A[1] = 1.2; A[3] = -1.9; A[13] = -0.55; A[10] = 0.95 + 0.08 * k;
    A[4] = 0.9 + 0.3 * k; A[5] = 1.0 - 0.3 * k; A[8] = 1.0; A[9] = 1.0; A[6] = -0.2; A[7] = -0.2; A[11] = 0.6 + 0.2 * k;
  } else if (clip < 25.5) { // cower: crouched, arms over the head, trembling
    float k = 0.04 * sin(uTime * 19. + sd * 31.);
    A[0] = 1.7; A[1] = 1.6; A[2] = -2.3; A[3] = -2.2; A[13] = -0.5; A[10] = 0.55 + k;
    A[4] = 2.5; A[5] = 2.5; A[6] = 0.45; A[7] = 0.45; A[8] = 2.2; A[9] = 2.2; A[11] = 0.5;
  } else if (clip < 26.5) { // reload: rifle down, support hand to the magazine
    float k = sin(uTime * 6. + sd * 5.);
    A[0] = 0.15; A[1] = -0.12; A[5] = -0.1; A[9] = 1.85; A[7] = -0.6; A[12] = -0.5; A[4] = 0.35 + 0.1 * k; A[8] = 1.55; A[6] = -0.75; A[11] = 0.35; A[10] = 0.08;
  } else if (clip < 27.5) { // throw: wind up and lob
    float f = clamp((uTime - t0) / 0.8, 0., 1.), w = f < 0.45 ? f / 0.45 : 1. - (f - 0.45) / 0.55;
    A[5] = -1.2 * w + 2.6 * (1. - w) * step(0.45, f); A[9] = 0.8; A[7] = 0.2; A[4] = 1.0; A[8] = 0.3; A[6] = -0.3; A[10] = -0.2 * w + 0.35 * step(0.45, f) * (1. - w); A[0] = 0.4; A[1] = -0.3; A[12] = -0.9;
  } else if (clip < 28.5) { // drag: walking backwards, bent, pulling a wounded comrade
    A[0] = -0.35 * s; A[1] = 0.35 * s; A[2] = -0.45 * max(0., s) - 0.15; A[3] = -0.45 * max(0., -s) - 0.15; A[10] = 0.6; A[13] = -0.08;
    A[4] = 1.0; A[5] = 1.0; A[8] = 0.3; A[9] = 0.3; A[6] = -0.15; A[7] = -0.15; A[11] = -0.3; A[12] = -1.2;
  } else if (clip < 29.5) { // dragged: on the back, arms held overhead
    A[14] = 1.; A[16] = 1.; A[4] = 2.9; A[5] = 2.9; A[8] = 0.1; A[9] = 0.1; A[6] = -0.15; A[7] = -0.15; A[0] = 0.2 + 0.1 * s; A[1] = 0.1; A[2] = -0.5; A[11] = -0.3;
  } else if (clip < 30.5) { // pounce: airborne, legs tucked, claws out
    A[0] = 1.2; A[1] = 1.0; A[2] = -1.6; A[3] = -1.5; A[10] = 0.35; A[4] = 2.1; A[5] = 2.1; A[6] = 0.25; A[7] = 0.25; A[8] = 0.2; A[9] = 0.2; A[11] = -0.4;
  } else if (clip < 31.5) { // vampire feeding: holding the victim up, teeth at the throat
    float k = sin(uTime * 3. + sd * 5.);
    A[4] = 1.25; A[5] = 1.25; A[6] = -0.45; A[7] = -0.45; A[8] = 1.35; A[9] = 1.35; A[10] = 0.2; A[11] = 0.6 + 0.08 * k; A[0] = 0.15; A[1] = -0.2;
  } else { // lifted: limp in a vampire's grip
    float k = sin(uTime * 9. + sd * 3.) * 0.15;
    A[4] = 0.2 + k; A[5] = 0.3 - k; A[8] = 0.3; A[9] = 0.3; A[0] = 0.2 + k; A[1] = -0.1 - k; A[2] = -0.4; A[3] = -0.5; A[10] = -0.3; A[11] = -0.7;
  }
}
vec3 piv(int i) { return uPiv[i]; }
`;
const VERT_BODY = /* glsl */`
  vec3 transformed = vec3(position); vec3 objectNormal = vec3(normal);
  {
    float A[18]; pose(iAnim.x, (uTime - iAnim.y) * iAnim.z, iAnim.w, iAnim.y, A);
    int pt = int(aPart + 0.5);
    vObj = position;
    // dismemberment: lost parts vanish; a severed piece (keep-only) shows just its own parts
    int lost = int(iE.x + 0.5), keep = int(iE.y + 0.5);
    int grp = pt == 2 ? 1 : (pt == 3 || pt == 5) ? 2 : (pt == 4 || pt == 6 || pt == 12) ? 4 : (pt == 7 || pt == 9) ? 8 : (pt == 8 || pt == 10) ? 16 : 0;
    if ((grp > 0 && (lost / grp) % 2 == 1) || (keep > 0 && grp != keep) || (pt == 11 && (lost / 4) % 2 == 1 && keep == 0)) transformed *= 0.;
    vGore = vec3(iE.x, iE.y, iE.z);
    // hidden handgun unless drawn
    if (pt == 12 && A[15] < 0.5) transformed *= 0.;
    mat3 M;
    // legs
    if (pt == 9 || pt == 10) { M = rz(pt == 9 ? A[2] : A[3]); vec3 k = piv(pt == 9 ? 8 : 9); transformed = M * (transformed - k) + k; objectNormal = M * objectNormal; }
    if (pt == 7 || pt == 9) { M = rz(A[0]); transformed = M * (transformed - piv(6)) + piv(6); objectNormal = M * objectNormal; }
    if (pt == 8 || pt == 10) { M = rz(A[1]); transformed = M * (transformed - piv(7)) + piv(7); objectNormal = M * objectNormal; }
    // arms
    if (pt == 5 || pt == 6 || pt == 12) { M = rz(pt == 5 ? A[8] : A[9]); vec3 e = piv(pt == 5 ? 4 : 5); transformed = M * (transformed - e) + e; objectNormal = M * objectNormal; }
    if (pt == 3 || pt == 5) { M = rz(A[4]) * rx(-A[6]); transformed = M * (transformed - piv(2)) + piv(2); objectNormal = M * objectNormal; }
    if (pt == 4 || pt == 6 || pt == 12) { M = rz(A[5]) * rx(A[7]); transformed = M * (transformed - piv(3)) + piv(3); objectNormal = M * objectNormal; }
    if (pt == 2) { M = rz(-A[11]); transformed = M * (transformed - piv(1)) + piv(1); objectNormal = M * objectNormal; }
    if (pt == 11) { M = rz(A[12]); transformed = M * (transformed - piv(10)) + piv(10); objectNormal = M * objectNormal; }
    // upper body leans from the waist
    if (pt >= 1 && pt <= 6 || pt >= 11) { M = rz(-(A[10] + uLean)); transformed = M * (transformed - piv(0)) + piv(0); objectNormal = M * objectNormal; }
    transformed.y += A[13];
    // falling: tip over around the feet, forwards or backwards
    if (A[14] > 0.) { float dir = A[16] != 0. ? A[16] : iAnim.w > 0.5 ? -1. : 1.; M = rz(dir * A[14] * 1.5); transformed = M * transformed; objectNormal = M * objectNormal; transformed.y += A[14] * 0.12; transformed.x += A[17] * A[14]; }
  }
  // colour by slot
  int sl = int(aSlot + 0.5);
  vec3 skin = unpack(iC.x), top = unpack(iC.y), bot = unpack(iC.z), hair = unpack(iC.w), acc = unpack(iD.x);
  vPCol = sl == 0 ? skin : sl == 1 ? top : sl == 2 ? bot : sl == 3 ? bot * 0.25 + vec3(0.04) : sl == 4 ? hair : sl == 5 ? acc : sl == 6 ? vec3(0.09, 0.09, 0.1) : sl == 7 ? mix(top, vec3(0.16, 0.16, 0.14), 0.45) : hair;
  vCloth = (sl == 1 || sl == 2 || sl == 7) && iD.y > 0.5 ? 1. : 0.;
  vCamo = vec4(iD.y, iD.w, iD.z, iD.x); vC2 = top; vC3 = bot; vGrime = iD.w;
`;
const FRAG_HEAD = /* glsl */`
varying vec3 vPCol; varying float vCloth; varying vec4 vCamo; varying vec3 vC2; varying vec3 vC3; varying vec3 vObj; varying float vGrime; varying vec3 vGore;
uniform vec3 uPiv[11]; uniform float uGore;
vec3 unpackF(float f) { f = floor(f + 0.5); float r = floor(f / 65536.0), g = floor((f - r * 65536.0) / 256.0); return vec3(r, g, f - r * 65536.0 - g * 256.0) / 255.0; }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// camouflage: c1 = top colour (base), c2 = bottom colour, c3 = accent colour, c4 = extra colour
vec3 camo(float pat, vec3 p, vec3 c1, vec3 c2, vec3 c3, vec3 c4) {
  vec2 q = vec2(p.x + p.z * 0.7, p.y * 1.1 + p.z * 0.4);
  if (pat < 1.5) { float n = vn(q * 9.) * 0.65 + vn(q * 23.) * 0.35; return n < 0.36 ? c1 : n < 0.55 ? c2 : n < 0.7 ? c3 : c4; } // woodland
  if (pat < 2.5) { float n = vn(q * 7. + 3.) * 0.6 + vn(q * 26.) * 0.4, m = vn(q * 40. + 9.); return m > 0.82 ? c4 : n < 0.5 ? c1 : n < 0.63 ? c2 : n < 0.74 ? c3 : c1 * 0.92; } // multi-environment (MultiCam type)
  if (pat < 3.5) { vec2 g = q * 34.; vec2 i = floor(g); float best = 0.; vec3 col = c1; for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) { vec2 cc = i + vec2(dx, dy); vec2 o = vec2(h21(cc), h21(cc + 7.)); float d = length(g - cc - o); float r = 0.35 + 0.35 * h21(cc + 3.); if (d < r && h21(cc + 11.) > best) { best = h21(cc + 11.); float k = h21(cc + 5.); col = k < 0.35 ? c2 : k < 0.65 ? c3 : k < 0.85 ? c4 : c1 * 0.85; } } return col; } // flecktarn dots
  if (pat < 4.5) { vec2 g = floor(q * 55.) / 55.; float n = vn(g * 10.) * 0.6 + vn(g * 31.) * 0.4; return n < 0.42 ? c1 : n < 0.58 ? c2 : n < 0.7 ? c3 : c4; } // digital
  if (pat < 5.5) { float a = q.x * 0.6 - q.y * 0.8, n = vn(vec2(floor(a * 7.), floor((q.x * 0.8 + q.y * 0.6) * 2.5))); float e = fract(a * 7.); return n < 0.4 ? c1 : n < 0.62 ? c2 : n < 0.8 ? c3 : c4; } // splinter
  if (pat < 6.5) { float n = vn(q * 6.) * 0.7 + vn(q * 20.) * 0.3; return n < 0.62 ? c1 : n < 0.78 ? c2 : c3; } // desert
  if (pat < 7.5) { float n = vn(q * vec2(8., 14.)) * 0.6 + vn(q * 30.) * 0.4; return n < 0.4 ? c1 : n < 0.58 ? c2 : n < 0.74 ? c3 : c4; } // vegetato
  float n = vn(q * vec2(7., 16.)) * 0.55 + vn(q * 22.) * 0.45; return n < 0.38 ? c1 : n < 0.56 ? c2 : n < 0.72 ? c3 : c4; // DPM brush strokes
}
`;
const FRAG_BODY = /* glsl */`
  vec3 pc = vPCol;
  if (vCloth > 0.5) pc = camo(vCamo.x, vObj, vC2, vC3, unpackF(vCamo.w), unpackF(vCamo.z));
  // severed joints: raw red stump around the cut with a bone core (on the body and on the severed piece)
  if (uGore > 0.5 && (vGore.x > 0.5 || vGore.y > 0.5)) {
    int L = int(vGore.x + 0.5) | int(vGore.y + 0.5);
    for (int b = 0; b < 5; b++) { int bit = 1 << b; if ((L & bit) == 0) continue; vec3 j = b == 0 ? uPiv[1] : b == 1 ? uPiv[2] : b == 2 ? uPiv[3] : b == 3 ? uPiv[6] : uPiv[7];
      float d = length(vObj - j); if (d < 0.1) { pc = mix(vec3(0.45, 0.02, 0.03), vec3(0.25, 0.01, 0.02), vn(vObj.xy * 60.)); if (d < 0.028 && uGore > 1.5) pc = vec3(0.86, 0.82, 0.72); } }
  }
  // wounds: blood soaking through clothes, torn flesh
  if (uGore > 0.5 && vGore.z > 0.02) { float g = vn(vObj.xy * 11. + vObj.z * 7. + 3.); if (g > 1. - vGore.z * 0.55) pc = mix(pc, vec3(0.36, 0.02, 0.02), 0.85); if (uGore > 1.5 && g > 1. - vGore.z * 0.12) pc = vec3(0.55, 0.12, 0.12); }
  if (vGrime > 0.01) { float g = vn(vObj.xy * 14. + vObj.z * 5.); pc = mix(pc, pc * vec3(0.55, 0.5, 0.45), vGrime * 0.6); if (g > 1. - vGrime * 0.35) pc = mix(pc, vec3(0.32, 0.03, 0.03), 0.8); }
  vec4 diffuseColor = vec4(pc, opacity);
`;

// gore level shared by every people material: 0 off, 1 reduced, 2 full
export const GORE_U = { value: 2 };
export function peopleMaterial(piv = HUMAN, lean = 0) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const order = ['waist', 'neck', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'knL', 'knR', 'gun'];
  m.userData.u = { uTime: { value: 0 }, uPiv: { value: order.map(k => new THREE.Vector3(...piv[k])) }, uLean: { value: lean }, uGore: GORE_U };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = POSE_GLSL + sh.vertexShader.replace('#include <beginnormal_vertex>', VERT_BODY).replace('#include <begin_vertex>', '');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', FRAG_BODY);
  };
  m.customProgramCacheKey = () => 'people-v2';
  return m;
}

// an instanced crowd of one figure type
export class Crowd {
  constructor(scene, geo, mat, cap) {
    this.cap = cap; this.n = 0;
    const g = geo.clone();
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.c = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.d = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.e = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iAnim', this.anim); g.setAttribute('iC', this.c); g.setAttribute('iD', this.d); g.setAttribute('iE', this.e);
    this.mesh = new THREE.InstancedMesh(g, mat, cap); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; this.mesh.frustumCulled = false;
    scene.add(this.mesh); this.mat = mat;
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  begin() { this.n = 0; }
  // look: { c: [skin, top, bottom, hair] packed, d: [acc packed, camo pattern, extra colour packed, grime] }
  // g: optional gore { lost: part mask, keep: show only this part group, wound: 0–1 blood }
  put(x, y, z, heading, scale, look, clip, t0, rate, seed, g) {
    if (this.n >= this.cap) return;
    this._p.set(x, z, -y); this._q.setFromAxisAngle(this._up, heading); this._s.set(scale, scale, scale);
    this._m.compose(this._p, this._q, this._s);
    this.putMatrix(this._m, look, clip, t0, rate, seed, g);
  }
  putMatrix(m, look, clip, t0, rate, seed, g) {
    if (this.n >= this.cap) return;
    const i = this.n++; this.mesh.setMatrixAt(i, m);
    const a = this.anim.array, c = this.c.array, d = this.d.array, e = this.e.array, o = i * 4;
    e[o] = g?.lost || 0; e[o + 1] = g?.keep || 0; e[o + 2] = g?.wound || 0; e[o + 3] = 0;
    a[o] = clip; a[o + 1] = t0; a[o + 2] = rate; a[o + 3] = seed;
    c[o] = look.c[0]; c[o + 1] = look.c[1]; c[o + 2] = look.c[2]; c[o + 3] = look.c[3];
    d[o] = look.d[0]; d[o + 1] = look.d[1]; d[o + 2] = look.d[2]; d[o + 3] = look.d[3];
  }
  end(time) {
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true;
    for (const at of [this.anim, this.c, this.d, this.e]) at.needsUpdate = true;
    this.mat.userData.u.uTime.value = time;
  }
  dispose() { this.mesh.geometry.dispose(); this.mesh.parent?.remove(this.mesh); }
}

export const PIVOTS = { HUMAN, LYCAN };
export const pack = hex => (hex >> 16 & 255) * 65536 + (hex >> 8 & 255) * 256 + (hex & 255);
