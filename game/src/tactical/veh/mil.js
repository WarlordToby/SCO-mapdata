// Military ground vehicles, modelled from their real dimensions (x forward, y up, z left; origin at the hull's
// centre on the ground). Each returns a geometry whose userData carries the turret/gun pivots, muzzle,
// commander's hatch, door type and size for the renderer.
import { VB, VP, VS } from './kit.js';
const S = VB.sym, P = VP, V = VS;

// ---------- shared helpers ----------
const hull = (B, part, slot, secs, o) => B.loft(part, slot, secs.map(([x, h]) => ({ w: x, ring: S(h) })), o);
// hull cross-section: belly y/half-width, sponson underside y, sponson half-width, deck y, top chamfer
const hh = (yb, zb, ys, zs, yt, c = 0.08) => [[yb, 0], [yb, zb], [ys, zb], [ys, zs], [yt - c, zs], [yt, zs - c], [yt, 0]];
// simple slab-sided section: bottom y, bottom half-width, waist y/half-width (widest), top y/half-width
const sec = (yb, zb, ym, zm, yt, zt, c = 0.06) => [[yb, 0], [yb, zb], [ym, zm], [yt - c, zt], [yt, zt - c], [yt, 0]];
// turret section: bottom y/half-width, top y/half-width
const tt = (yb, zb, yt, zt, c = 0.07) => [[yb, 0], [yb, zb], [yt - c, zt], [yt, zt - c], [yt, 0]];
const rwProf = (r, w) => [[r * 0.5, -w / 2, V.paint], [r * 0.86, -w / 2, V.rubber], [r, -w * 0.3, V.rubber], [r, w * 0.3, V.rubber], [r * 0.86, w / 2, V.rubber], [r * 0.5, w / 2, V.paint]];
const sprProf = (r, w) => [[r * 0.45, -w / 2, V.metal], [r, -w * 0.2, V.metal], [r, w * 0.2, V.metal], [r * 0.45, w / 2, V.metal]];
function tracked(B, g) {
  for (const sd of [1, -1]) {
    const z = g.z * sd;
    for (const x of g.xs) B.wheel(x, g.r, z, g.r, g.tw * 0.8, { prof: rwProf(g.r, g.tw * 0.8), sides: 12, hub: V.paint });
    B.wheel(g.spr[0], g.spr[1], z, g.spr[2], g.tw * 0.6, { prof: sprProf(g.spr[2], g.tw * 0.6), sides: 12, hub: V.metal });
    B.wheel(g.idl[0], g.idl[1], z, g.idl[2], g.tw * 0.7, { prof: rwProf(g.idl[2], g.tw * 0.7), sides: 12, hub: V.paint });
    for (const x of g.rollers || []) { const rr = g.rr || 0.1; B.wheel(x, g.topY - rr - 0.07, z, rr, g.tw * 0.45, { sides: 8, prof: rwProf(rr, g.tw * 0.45) }); B.axles[B.axleIndex(x, g.topY - rr - 0.07, rr)][2] = -rr; }
    B.track(VB.trackLoop(g.xs, g.r, g.spr, g.idl, g.topY), z, g.tw);
  }
}
// road wheels for wheeled vehicles: both sides at each x
function wheels(B, xs, r, w, z, o = {}) { for (const x of xs) for (const sd of [1, -1]) B.wheel(x, r, z * sd, r, w, { sides: o.sides || 14, hub: o.hub ?? V.hub, boss: r * 0.28 }); }
const smoke = (B, part, x0, x1, n, y, z, s, up = 0.2) => { for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / Math.max(1, n - 1); B.tube(part, V.metal, [x, y, z * s], [x + 0.06, y + up, (Math.abs(z) + 0.14) * s], 0.06, 0.06, 6); } };
const mg = (B, part, x, y, z, len = 0.9, r = 0.02) => { B.cbox(part, V.metal, x - 0.25, x + 0.12, y - 0.05, y + 0.06, z - 0.05, z + 0.05, 0.015); B.tube(part, V.metal, [x + 0.1, y, z], [x + len, y, z], r, r, 6); };
// remote weapon station: base, sensor head, MG
const rws = (B, part, x, y, z, big = false) => { const k = big ? 1.2 : 1; B.tube(part, V.paint, [x, y, z], [x, y + 0.18, z], 0.26 * k, 0.24 * k, 10); B.cbox(part, V.paint, x - 0.32 * k, x + 0.3 * k, y + 0.18, y + 0.5 * k, z - 0.22 * k, z + 0.22 * k, 0.04); B.cbox(part, V.glass, x + 0.1 * k, x + 0.32 * k, y + 0.28, y + 0.44 * k, z + 0.08, z + 0.2 * k, 0.02); mg(B, part, x + 0.05, y + 0.32, z - 0.28 * k, big ? 1.4 : 1.0, big ? 0.03 : 0.022); };
const hatch = (B, part, x, y, z, r = 0.3) => B.tube(part, V.paint, [x, y, z], [x, y + 0.06, z], r, r * 0.95, 10);
const light = (B, x, y, z, s = 0.09) => B.cbox(P.hull, V.light, x - 0.04, x + 0.03, y - s / 2, y + s / 2, z - s / 2, z + s / 2, 0.01);
const flag = (B, part, x0, x1, y0, y1, z, s) => B.plate(part, V.flag, s > 0 ? [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]] : [[x0, y0, -z], [x1, y0, -z], [x1, y1, -z], [x0, y1, -z]], 0.05);
const flags = (B, part, x0, x1, y0, y1, z) => { flag(B, part, x0, x1, y0, y1, z, 1); flag(B, part, x0, x1, y0, y1, z, -1); };
const ant = (B, part, x, y, z, h = 2.2) => B.tube(part, V.black, [x, y, z], [x, y + h, z], 0.012, 0.006, 4, { caps: false });
// armoured window: frame plate + glass
const win = (B, pts, d = 0.015) => B.plate(P.hull, V.glass, pts, d);

// ================= TANKS =================
export function leclerc() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[3.44, hh(0.95, 1.0, 0.98, 1.7, 1.06, 0.03)], [3.1, hh(0.55, 1.1, 0.95, 1.82, 1.25)], [2.2, hh(0.5, 1.1, 0.95, 1.82, 1.55)], [-3.0, hh(0.5, 1.1, 0.95, 1.82, 1.6)], [-3.44, hh(0.72, 1.1, 0.95, 1.82, 1.5)]]);
  for (const s of [1, -1]) { B.cbox(P.hull, V.paint, -3.25, 3.15, 0.6, 1.0, s > 0 ? 1.82 : -1.9, s > 0 ? 1.9 : -1.82, 0.02); B.cbox(P.hull, V.paint, 2.9, 3.3, 0.66, 1.0, s > 0 ? 1.8 : -1.88, s > 0 ? 1.88 : -1.8, 0.02); light(B, 3.35, 1.1, 1.45 * s); }
  B.plate(P.hull, V.black, [[-1.1, 1.6, 0.85], [-1.1, 1.6, -0.85], [-2.8, 1.6, -0.85], [-2.8, 1.6, 0.85]], 0.01); // engine deck grilles
  hatch(B, P.hull, 2.55, 1.45, 0.55, 0.26);
  tracked(B, { xs: [2.45, 1.55, 0.65, -0.25, -1.15, -2.05], r: 0.33, idl: [3.05, 0.6, 0.28], spr: [-3.05, 0.65, 0.32], z: 1.5, tw: 0.63, topY: 0.98 });
  // turret: wide flat front, long autoloader bustle
  hull(B, P.turret, V.paint, [[2.15, tt(1.6, 1.2, 2.25, 1.15, 0.06)], [1.85, tt(1.55, 1.68, 2.38, 1.56)], [-0.9, tt(1.55, 1.72, 2.38, 1.6)], [-2.35, tt(1.62, 1.45, 2.32, 1.38)]]);
  B.cbox(P.turret, V.paint, -2.62, -2.35, 1.75, 2.25, -1.25, 1.25, 0.03);
  B.tube(P.turret, V.paint, [0.55, 2.36, 0.75], [0.55, 2.62, 0.75], 0.2, 0.18, 8); B.cbox(P.turret, V.paint, 0.32, 0.78, 2.62, 2.86, 0.52, 0.98, 0.04); B.plate(P.turret, V.glass, [[0.785, 2.66, 0.6], [0.785, 2.66, 0.9], [0.785, 2.82, 0.9], [0.785, 2.82, 0.6]], 0.008);
  B.cbox(P.turret, V.paint, 1.2, 1.78, 2.36, 2.62, -1.25, -0.85, 0.04); B.plate(P.turret, V.glass, [[1.785, 2.42, -1.2], [1.785, 2.42, -0.9], [1.785, 2.56, -0.9], [1.785, 2.56, -1.2]], 0.008);
  hatch(B, P.turret, -0.05, 2.36, 0.72, 0.32); mg(B, P.turret, -0.1, 2.55, 0.35, 0.8);
  for (const s of [1, -1]) smoke(B, P.turret, -0.5, 0.2, 3, 2.12, 1.6, s);
  ant(B, P.turret, -1.9, 2.36, 1.1); ant(B, P.turret, -1.9, 2.36, -1.1, 1.8);
  flags(B, P.turret, -1.95, -1.5, 1.9, 2.15, 1.665);
  // mantlet and 120 mm gun with thermal sleeve
  B.cbox(P.gun, V.paint, 1.95, 2.38, 1.72, 2.18, -0.33, 0.33, 0.05);
  B.tube(P.gun, V.paint, [2.35, 1.95, 0], [4.6, 1.95, 0], 0.12, 0.11, 10); B.tube(P.gun, V.paint, [4.6, 1.95, 0], [6.43, 1.95, 0], 0.09, 0.085, 10); B.cbox(P.gun, V.metal, 6.2, 6.42, 2.03, 2.1, -0.05, 0.05, 0.01);
  mg(B, P.gun, 2.3, 1.85, -0.25, 0.4);
  B.piv = { turret: [0.2, 1.55, 0], gun: [2.05, 1.95, 0] };
  return B.build({ muzzle: [6.43, 1.95, 0], cmd: [-0.05, 2.36, 0.72], len: 6.9, wid: 3.7, hgt: 2.5, deck: 1.6, eng: [-2.2, 1.6, 0], tracked: true, turret: true, recoil: 0.45 });
}

export function leopard2() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[3.86, hh(0.92, 1.0, 0.98, 1.72, 1.05, 0.03)], [3.45, hh(0.52, 1.12, 0.95, 1.85, 1.3)], [2.35, hh(0.48, 1.12, 0.95, 1.86, 1.58)], [-3.5, hh(0.48, 1.12, 0.95, 1.86, 1.6)], [-3.86, hh(0.7, 1.12, 0.95, 1.86, 1.5)]]);
  for (const s of [1, -1]) {
    B.cbox(P.hull, V.paint, -3.75, 2.7, 0.62, 1.0, s > 0 ? 1.86 : -1.93, s > 0 ? 1.93 : -1.86, 0.02);
    B.extrude(P.hull, V.paint, [[2.7, 0.58], [3.6, 0.7], [3.65, 1.0], [2.7, 1.0]], s > 0 ? 1.85 : -1.93, s > 0 ? 1.93 : -1.85, 0.01); // heavy front skirt section
    light(B, 3.7, 1.12, 1.5 * s);
  }
  B.plate(P.hull, V.black, [[-1.3, 1.6, 0.9], [-1.3, 1.6, -0.9], [-3.2, 1.6, -0.9], [-3.2, 1.6, 0.9]], 0.01);
  hatch(B, P.hull, 2.75, 1.5, -0.55, 0.28);
  tracked(B, { xs: [2.75, 1.9, 1.05, 0.2, -0.65, -1.5, -2.35], r: 0.35, idl: [3.42, 0.62, 0.3], spr: [-3.42, 0.66, 0.33], z: 1.52, tw: 0.635, topY: 1.0, rollers: [2.3, 0.65, -1.0, -2.6], rr: 0.1 });
  // turret: vertical slab sides, flat front, bustle with stowage
  hull(B, P.turret, V.paint, [[2.2, tt(1.6, 1.3, 2.38, 1.3, 0.05)], [2.0, tt(1.58, 1.72, 2.42, 1.66)], [-1.2, tt(1.58, 1.74, 2.42, 1.66)], [-2.5, tt(1.62, 1.55, 2.4, 1.5)]]);
  B.cbox(P.turret, V.paint, -2.8, -2.5, 1.8, 2.3, -1.4, 1.4, 0.03);
  B.cbox(P.turret, V.paint, 0.9, 1.45, 2.42, 2.66, -1.2, -0.8, 0.04); B.plate(P.turret, V.glass, [[1.455, 2.46, -1.15], [1.455, 2.46, -0.85], [1.455, 2.6, -0.85], [1.455, 2.6, -1.15]], 0.008); // gunner's EMES 15
  B.tube(P.turret, V.paint, [0.1, 2.42, 0.85], [0.1, 2.75, 0.85], 0.16, 0.16, 8); B.cbox(P.turret, V.paint, -0.08, 0.3, 2.75, 2.95, 0.68, 1.02, 0.03); // PERI-R17
  hatch(B, P.turret, -0.45, 2.42, 0.8, 0.32); hatch(B, P.turret, -0.45, 2.42, -0.75, 0.32); mg(B, P.turret, -0.5, 2.62, -0.75, 0.8);
  for (const s of [1, -1]) smoke(B, P.turret, -1.3, -0.7, 4, 2.15, 1.66, s, 0.18);
  ant(B, P.turret, -2.1, 2.42, 1.2); ant(B, P.turret, -2.1, 2.42, -1.2, 1.8);
  flags(B, P.turret, -2.3, -1.85, 1.9, 2.18, 1.745);
  B.cbox(P.gun, V.paint, 2.0, 2.45, 1.76, 2.2, -0.35, 0.35, 0.04);
  B.tube(P.gun, V.paint, [2.4, 1.98, 0], [4.8, 1.98, 0], 0.12, 0.11, 10); B.tube(P.gun, V.paint, [4.8, 1.98, 0], [5.81, 1.98, 0], 0.09, 0.088, 10);
  B.piv = { turret: [0.25, 1.58, 0], gun: [2.1, 1.98, 0] };
  return B.build({ muzzle: [5.81, 1.98, 0], cmd: [-0.45, 2.42, 0.8], len: 7.7, wid: 3.75, hgt: 2.5, deck: 1.6, eng: [-2.4, 1.6, 0], tracked: true, turret: true, recoil: 0.45 });
}

export function amx30() {
  const B = new VB();
  // pointed nose, track guards over the tracks
  hull(B, P.hull, V.paint, [[3.3, hh(0.98, 0.9, 1.0, 1.4, 1.04, 0.02)], [2.85, hh(0.55, 1.05, 0.95, 1.55, 1.25)], [2.0, hh(0.52, 1.05, 0.95, 1.55, 1.5)], [-2.95, hh(0.52, 1.05, 0.95, 1.55, 1.55)], [-3.3, hh(0.75, 1.05, 0.95, 1.55, 1.45)]]);
  for (const s of [1, -1]) { B.cbox(P.hull, V.paint, -3.3, 3.25, 0.93, 0.98, s > 0 ? 1.0 : -1.55, s > 0 ? 1.55 : -1.0, 0.01); light(B, 3.1, 1.12, 1.25 * s); B.cbox(P.hull, V.paint, -2.6, 1.8, 0.98, 1.22, s > 0 ? 1.45 : -1.55, s > 0 ? 1.55 : -1.45, 0.02); }
  B.plate(P.hull, V.black, [[-1.0, 1.55, 0.8], [-1.0, 1.55, -0.8], [-2.7, 1.55, -0.8], [-2.7, 1.55, 0.8]], 0.01);
  hatch(B, P.hull, 2.35, 1.4, 0.45, 0.25);
  tracked(B, { xs: [2.3, 1.2, 0.1, -1.0, -2.1], r: 0.43, idl: [2.98, 0.68, 0.3], spr: [-3.0, 0.72, 0.32], z: 1.27, tw: 0.57, topY: 0.92, rollers: [1.75, 0.65, -0.45, -1.55], rr: 0.1 });
  // cast turret: rounded, many facets
  const rt = (yb, zb, yt, zt) => [[yb, 0], [yb, zb], [yb + (yt - yb) * 0.45, zb * 1.03], [yb + (yt - yb) * 0.8, zt + (zb - zt) * 0.45], [yt, zt * 0.6], [yt, 0]];
  hull(B, P.turret, V.paint, [[2.05, rt(1.6, 0.6, 2.05, 0.3)], [1.6, rt(1.55, 1.1, 2.2, 0.75)], [0.6, rt(1.55, 1.3, 2.3, 0.95)], [-0.8, rt(1.55, 1.25, 2.28, 0.9)], [-1.75, rt(1.6, 0.95, 2.15, 0.65)], [-2.05, rt(1.7, 0.6, 2.05, 0.4)]]);
  B.tube(P.turret, V.paint, [0.1, 2.25, 0.55], [0.1, 2.5, 0.55], 0.36, 0.33, 10); hatch(B, P.turret, 0.1, 2.5, 0.55, 0.3); mg(B, P.turret, 0.3, 2.62, 0.55, 0.9, 0.03); // commander's cupola
  hatch(B, P.turret, -0.2, 2.28, -0.55, 0.28);
  B.cbox(P.turret, V.paint, 1.0, 1.35, 2.25, 2.42, -0.75, -0.45, 0.03);
  for (const s of [1, -1]) smoke(B, P.turret, -0.9, -0.5, 2, 2.0, 1.15, s);
  ant(B, P.turret, -1.5, 2.2, 0.8); flags(B, P.turret, -1.5, -1.1, 1.75, 1.98, 1.24);
  B.cbox(P.gun, V.paint, 1.85, 2.2, 1.72, 2.08, -0.3, 0.3, 0.06);
  B.tube(P.gun, V.paint, [2.15, 1.9, 0], [4.2, 1.9, 0], 0.1, 0.095, 10); B.tube(P.gun, V.paint, [4.2, 1.9, 0], [6.18, 1.9, 0], 0.075, 0.075, 10);
  B.piv = { turret: [0.1, 1.55, 0], gun: [1.95, 1.9, 0] };
  return B.build({ muzzle: [6.18, 1.9, 0], cmd: [0.1, 2.5, 0.55], len: 6.6, wid: 3.1, hgt: 2.3, deck: 1.55, eng: [-2.0, 1.55, 0], tracked: true, turret: true, recoil: 0.4 });
}

export function amx10rc() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[3.17, sec(0.95, 0.6, 1.05, 1.15, 1.25, 1.1, 0.04)], [2.6, sec(0.55, 0.9, 1.05, 1.42, 1.55, 1.38)], [1.6, sec(0.5, 1.0, 1.1, 1.47, 1.8, 1.4)], [-2.8, sec(0.5, 1.0, 1.1, 1.47, 1.85, 1.4)], [-3.17, sec(0.7, 0.9, 1.1, 1.42, 1.75, 1.35)]]);
  for (const s of [1, -1]) { light(B, 3.0, 1.3, 1.1 * s); B.cbox(P.hull, V.paint, -2.9, 2.5, 1.05, 1.12, s > 0 ? 1.42 : -1.52, s > 0 ? 1.52 : -1.42, 0.01); }
  win(B, [[2.62, 1.6, 0.25], [2.62, 1.6, -0.25], [2.4, 1.7, -0.22], [2.4, 1.7, 0.22]]);
  wheels(B, [1.95, 0.4, -1.15], 0.58, 0.42, 1.25);
  hull(B, P.turret, V.paint, [[1.4, tt(1.8, 0.9, 2.3, 0.75)], [1.05, tt(1.78, 1.3, 2.55, 1.1)], [-1.1, tt(1.78, 1.35, 2.55, 1.15)], [-1.7, tt(1.82, 1.1, 2.45, 0.95)]]);
  B.cbox(P.turret, V.paint, -0.2, 0.3, 2.55, 2.75, 0.45, 0.85, 0.04); hatch(B, P.turret, -0.6, 2.55, 0.6, 0.27); hatch(B, P.turret, -0.6, 2.55, -0.6, 0.27); mg(B, P.turret, -0.7, 2.75, -0.6, 0.7);
  for (const s of [1, -1]) smoke(B, P.turret, -0.9, -0.5, 2, 2.3, 1.2, s);
  ant(B, P.turret, -1.4, 2.5, 0.8); flags(B, P.turret, -1.3, -0.9, 2.0, 2.25, 1.27);
  B.cbox(P.gun, V.paint, 1.3, 1.6, 1.98, 2.32, -0.28, 0.28, 0.05);
  B.tube(P.gun, V.paint, [1.55, 2.15, 0], [3.4, 2.15, 0], 0.095, 0.09, 10); B.tube(P.gun, V.paint, [3.4, 2.15, 0], [5.98, 2.15, 0], 0.07, 0.07, 10); B.tube(P.gun, V.metal, [5.75, 2.15, 0], [5.98, 2.15, 0], 0.1, 0.1, 8); // muzzle brake
  B.piv = { turret: [-0.2, 1.8, 0], gun: [1.4, 2.15, 0] };
  return B.build({ muzzle: [5.98, 2.15, 0], cmd: [-0.6, 2.55, 0.6], len: 6.35, wid: 2.95, hgt: 2.6, deck: 1.85, eng: [-2.4, 1.85, 0], turret: true, recoil: 0.35 });
}

export function jaguar() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[3.9, sec(1.0, 0.7, 1.15, 1.2, 1.35, 1.15, 0.04)], [3.2, sec(0.55, 0.95, 1.1, 1.45, 1.75, 1.4)], [2.3, sec(0.5, 1.0, 1.15, 1.49, 2.05, 1.38)], [-3.5, sec(0.5, 1.0, 1.15, 1.49, 2.1, 1.38)], [-3.9, sec(0.7, 0.95, 1.15, 1.45, 2.0, 1.34)]]);
  for (const s of [1, -1]) { light(B, 3.7, 1.4, 1.1 * s); B.cbox(P.hull, V.paint, -3.4, 3.0, 1.15, 1.95, s > 0 ? 1.45 : -1.53, s > 0 ? 1.53 : -1.45, 0.03); }
  win(B, [[3.22, 1.85, 0.6], [3.22, 1.85, 0.15], [2.95, 1.98, 0.15], [2.95, 1.98, 0.6]]);
  wheels(B, [2.6, 0.75, -2.45], 0.6, 0.45, 1.25);
  rws(B, P.hull, -2.2, 2.1, 0.7);
  // T40 turret with the 40 mm CTA gun and the MMP missile launcher on the left
  hull(B, P.turret, V.paint, [[1.3, tt(2.05, 0.8, 2.55, 0.65)], [0.95, tt(2.05, 1.15, 2.75, 0.95)], [-1.0, tt(2.05, 1.15, 2.75, 0.95)], [-1.4, tt(2.08, 0.95, 2.65, 0.8)]]);
  B.cbox(P.turret, V.paint, -0.9, 0.55, 2.35, 2.95, 1.18, 1.62, 0.05); B.plate(P.turret, V.black, [[0.56, 2.42, 1.25], [0.56, 2.42, 1.55], [0.56, 2.88, 1.55], [0.56, 2.88, 1.25]], 0.01);
  B.cbox(P.turret, V.paint, 0.2, 0.6, 2.75, 3.0, -0.75, -0.4, 0.04); B.plate(P.turret, V.glass, [[0.605, 2.8, -0.7], [0.605, 2.8, -0.45], [0.605, 2.95, -0.45], [0.605, 2.95, -0.7]], 0.008);
  hatch(B, P.turret, -0.5, 2.75, 0.45, 0.27); flags(B, P.turret, -1.2, -0.85, 2.25, 2.5, 1.06);
  B.cbox(P.gun, V.paint, 1.15, 1.5, 2.2, 2.55, -0.25, 0.25, 0.05); B.tube(P.gun, V.paint, [1.45, 2.38, 0], [3.4, 2.38, 0], 0.08, 0.07, 10); B.tube(P.gun, V.metal, [3.2, 2.38, 0], [3.45, 2.38, 0], 0.085, 0.085, 8);
  B.piv = { turret: [-0.1, 2.05, 0], gun: [1.25, 2.38, 0] };
  return B.build({ muzzle: [3.45, 2.38, 0], cmd: [-0.5, 2.75, 0.45], len: 7.8, wid: 3.0, hgt: 2.95, deck: 2.1, eng: [-2.9, 2.1, 0], turret: true, recoil: 0.18 });
}

// ================= APCs / IFVs =================
export function vab() {
  const B = new VB();
  // boat-shaped hull: sloped nose, slab sides with tumblehome, flat roof
  hull(B, P.hull, V.paint, [[2.99, sec(1.05, 0.7, 1.15, 1.0, 1.3, 0.95, 0.04)], [2.55, sec(0.55, 0.95, 1.2, 1.24, 1.75, 1.12)], [2.1, sec(0.48, 1.0, 1.2, 1.24, 2.06, 1.0)], [-2.85, sec(0.48, 1.0, 1.2, 1.24, 2.06, 1.0)], [-2.99, sec(0.55, 0.95, 1.2, 1.22, 2.02, 0.98)]]);
  for (const s of [1, -1]) {
    win(B, [[2.57, 1.78, 0.75 * s], [2.57, 1.78, 0.1 * s], [2.15, 2.03, 0.1 * s], [2.15, 2.03, 0.72 * s]]);
    B.cbox(P.hull, V.paint, 2.12, 2.6, 1.98, 2.05, s > 0 ? 0.05 : -0.8, s > 0 ? 0.8 : -0.05, 0.01); // armoured shutter (raised)
    light(B, 2.86, 1.3, 0.75 * s); B.cbox(P.hull, V.paint, -2.6, 1.9, 1.17, 1.24, s > 0 ? 1.2 : -1.28, s > 0 ? 1.28 : -1.2, 0.01);
    win(B, [[0.6, 1.5, 1.225 * s], [0.25, 1.5, 1.225 * s], [0.25, 1.68, 1.17 * s], [0.6, 1.68, 1.17 * s]]);
  }
  B.extrude(P.hull, V.paint, [[-0.3, 1.25], [0.2, 1.25], [0.2, 1.95], [-0.3, 1.95]], 1.22, 1.27, 0.01); // side door
  // twin rear doors (hinged at the sides)
  B.cbox(P.door, V.paint, -3.05, -2.99, 0.6, 1.95, 0.02, 0.95, 0.015); B.cbox(P.doorR, V.paint, -3.05, -2.99, 0.6, 1.95, -0.95, -0.02, 0.015);
  win(B, [[-3.06, 1.45, 0.3], [-3.06, 1.45, 0.6], [-3.06, 1.65, 0.6], [-3.06, 1.65, 0.3]]);
  wheels(B, [1.5, -1.5], 0.53, 0.38, 1.0);
  B.tube(P.turret, V.paint, [0.9, 2.06, 0.3], [0.9, 2.18, 0.3], 0.45, 0.45, 12); mg(B, P.turret, 1.0, 2.35, 0.3, 1.3, 0.028); B.cbox(P.turret, V.paint, 1.2, 1.25, 2.18, 2.55, 0.0, 0.6, 0.01); // 12.7 mm on its ring with shield
  ant(B, P.hull, -2.5, 2.06, 0.85); flags(B, P.hull, -2.6, -2.15, 1.55, 1.8, 1.245);
  B.piv = { turret: [0.9, 2.06, 0.3], gun: [1.0, 2.35, 0.3], door: [-3.02, 0, 0.95, 1] };
  return B.build({ muzzle: [2.3, 2.35, 0.3], cmd: [0.9, 2.06, 0.3], len: 6.0, wid: 2.5, hgt: 2.1, deck: 2.06, eng: [2.0, 1.9, 0], turret: true, doors: 2, recoil: 0.05 });
}

export function vbci() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[3.8, sec(1.1, 0.7, 1.2, 1.25, 1.4, 1.2, 0.04)], [3.15, sec(0.55, 1.0, 1.2, 1.49, 1.85, 1.38)], [2.2, sec(0.5, 1.05, 1.2, 1.49, 2.26, 1.3)], [-3.6, sec(0.5, 1.05, 1.2, 1.49, 2.26, 1.3)], [-3.8, sec(0.6, 1.0, 1.2, 1.47, 2.2, 1.28)]]);
  for (const s of [1, -1]) { light(B, 3.6, 1.45, 1.15 * s); B.cbox(P.hull, V.paint, -3.5, 3.0, 1.2, 1.3, s > 0 ? 1.49 : -1.56, s > 0 ? 1.56 : -1.49, 0.01); }
  win(B, [[3.17, 1.95, 0.85], [3.17, 1.95, 0.35], [2.9, 2.08, 0.35], [2.9, 2.08, 0.85]]); hatch(B, P.hull, 2.6, 2.26, 0.6, 0.28);
  B.cbox(P.door, V.paint, -3.85, -3.78, 0.55, 2.1, -0.75, 0.75, 0.02); // rear ramp
  wheels(B, [2.55, 1.1, -0.75, -2.2], 0.6, 0.45, 1.27);
  // DRAGAR one-man turret, 25 mm
  hull(B, P.turret, V.paint, [[0.85, tt(2.26, 0.55, 2.7, 0.45)], [0.55, tt(2.26, 0.8, 2.85, 0.65)], [-0.75, tt(2.26, 0.8, 2.85, 0.65)], [-0.95, tt(2.26, 0.6, 2.75, 0.5)]]);
  B.cbox(P.turret, V.paint, -0.2, 0.25, 2.85, 3.05, 0.15, 0.5, 0.04); B.plate(P.turret, V.glass, [[0.255, 2.9, 0.2], [0.255, 2.9, 0.45], [0.255, 3.0, 0.45], [0.255, 3.0, 0.2]], 0.008);
  for (const s of [1, -1]) smoke(B, P.turret, -0.5, -0.2, 2, 2.6, 0.75, s);
  B.cbox(P.gun, V.paint, 0.75, 1.0, 2.38, 2.65, -0.18, 0.18, 0.04); B.tube(P.gun, V.metal, [0.95, 2.52, 0], [3.15, 2.52, 0], 0.035, 0.03, 8);
  ant(B, P.hull, -3.3, 2.26, 1.1); flags(B, P.hull, -3.3, -2.85, 1.7, 1.95, 1.5);
  B.piv = { turret: [0.0, 2.26, 0], gun: [0.85, 2.52, 0], door: [-3.8, 0.55, 0, 0] };
  return B.build({ muzzle: [3.15, 2.52, 0], cmd: [2.6, 2.26, 0.6], cmdHull: true, len: 7.6, wid: 2.98, hgt: 3.0, deck: 2.26, eng: [2.2, 2.0, -0.6], turret: true, ramp: true, recoil: 0.06 });
}

export function griffon() {
  const B = new VB();
  // tall slab-sided body with a big sloped nose and windscreen
  hull(B, P.hull, V.paint, [[3.9, sec(1.0, 0.7, 1.1, 1.18, 1.45, 1.12, 0.04)], [3.4, sec(0.55, 0.95, 1.15, 1.27, 2.15, 1.18)], [2.55, sec(0.5, 1.0, 1.2, 1.27, 2.9, 1.15)], [-3.7, sec(0.5, 1.0, 1.2, 1.27, 2.9, 1.15)], [-3.9, sec(0.55, 0.95, 1.2, 1.25, 2.85, 1.13)]]);
  for (const s of [1, -1]) { win(B, [[3.42, 2.2, 0.98 * s], [3.42, 2.2, 0.08 * s], [2.6, 2.86, 0.08 * s], [2.6, 2.86, 0.95 * s]]); light(B, 3.75, 1.5, 0.95 * s); B.cbox(P.hull, V.paint, -3.5, 2.3, 1.1, 2.4, s > 0 ? 1.27 : -1.33, s > 0 ? 1.33 : -1.27, 0.03); win(B, [[2.3, 1.9, 1.335 * s], [1.9, 1.9, 1.335 * s], [1.9, 2.3, 1.335 * s], [2.3, 2.3, 1.335 * s]]); }
  B.cbox(P.door, V.paint, -3.96, -3.88, 0.55, 2.6, -0.8, 0.8, 0.02);
  wheels(B, [2.45, -0.85, -2.3], 0.6, 0.45, 1.05);
  rws(B, P.turret, 1.4, 2.9, 0.0, true);
  B.cbox(P.hull, V.paint, -2.5, -1.2, 2.9, 3.05, -0.9, 0.9, 0.03); ant(B, P.hull, -3.4, 2.9, 0.9); flags(B, P.hull, -3.4, -2.95, 2.45, 2.7, 1.16);
  B.piv = { turret: [1.4, 2.9, 0], gun: [1.45, 3.22, -0.34], door: [-3.92, 0.55, 0, 0] };
  return B.build({ muzzle: [2.85, 3.22, -0.34], cmd: [0.5, 2.9, 0.6], cmdHull: true, len: 7.8, wid: 2.55, hgt: 3.4, deck: 2.9, eng: [2.9, 1.9, 0], turret: true, ramp: true, recoil: 0.04 });
}

export function serval() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[3.0, sec(0.95, 0.7, 1.05, 1.15, 1.3, 1.1, 0.04)], [2.55, sec(0.55, 0.95, 1.1, 1.25, 1.65, 1.18)], [1.7, sec(0.5, 1.0, 1.15, 1.25, 2.35, 1.1)], [-2.85, sec(0.5, 1.0, 1.15, 1.25, 2.35, 1.1)], [-3.0, sec(0.55, 0.95, 1.15, 1.23, 2.3, 1.08)]]);
  for (const s of [1, -1]) { win(B, [[2.57, 1.7, 0.95 * s], [2.57, 1.7, 0.08 * s], [1.75, 2.3, 0.08 * s], [1.75, 2.3, 0.92 * s]]); light(B, 2.88, 1.3, 0.9 * s); win(B, [[1.5, 1.7, 1.255 * s], [0.95, 1.7, 1.255 * s], [0.95, 2.1, 1.255 * s], [1.5, 2.1, 1.255 * s]]); B.cbox(P.hull, V.paint, -2.7, 0.8, 1.15, 2.15, s > 0 ? 1.25 : -1.3, s > 0 ? 1.3 : -1.25, 0.02); }
  B.cbox(P.door, V.paint, -3.06, -2.99, 0.6, 2.1, 0.02, 0.9, 0.015); B.cbox(P.doorR, V.paint, -3.06, -2.99, 0.6, 2.1, -0.9, -0.02, 0.015);
  wheels(B, [1.75, -1.6], 0.55, 0.42, 1.03);
  rws(B, P.turret, 0.6, 2.35, 0.0);
  ant(B, P.hull, -2.5, 2.35, 0.8); flags(B, P.hull, -2.6, -2.2, 1.6, 1.85, 1.255);
  B.piv = { turret: [0.6, 2.35, 0], gun: [0.65, 2.67, -0.28], door: [-3.02, 0, 0.9, 1] };
  return B.build({ muzzle: [1.65, 2.67, -0.28], cmd: [-0.4, 2.35, 0.5], cmdHull: true, len: 6.0, wid: 2.5, hgt: 2.6, deck: 2.35, eng: [2.2, 1.6, 0], turret: true, doors: 2, recoil: 0.04 });
}

export function amx10p() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[2.89, hh(0.92, 0.9, 0.95, 1.35, 1.0, 0.03)], [2.4, hh(0.5, 1.05, 0.9, 1.39, 1.45)], [1.6, hh(0.45, 1.05, 0.9, 1.39, 1.85)], [-2.6, hh(0.45, 1.05, 0.9, 1.39, 1.9)], [-2.89, hh(0.55, 1.05, 0.9, 1.39, 1.85)]]);
  for (const s of [1, -1]) light(B, 2.7, 1.05, 1.15 * s);
  hatch(B, P.hull, 1.9, 1.75, 0.6, 0.25); B.plate(P.hull, V.black, [[1.0, 1.86, -0.3], [1.0, 1.86, -1.1], [0.2, 1.87, -1.1], [0.2, 1.87, -0.3]], 0.01);
  B.cbox(P.door, V.paint, -2.95, -2.88, 0.5, 1.8, -0.7, 0.7, 0.02);
  tracked(B, { xs: [1.7, 0.85, 0.0, -0.85, -1.7], r: 0.32, idl: [-2.45, 0.55, 0.26], spr: [2.4, 0.62, 0.3], z: 1.13, tw: 0.43, topY: 0.88, rollers: [1.2, 0.0, -1.2], rr: 0.08 });
  // Toucan II turret with the 20 mm
  hull(B, P.turret, V.paint, [[0.8, tt(1.88, 0.55, 2.3, 0.45)], [0.5, tt(1.88, 0.8, 2.42, 0.65)], [-0.7, tt(1.88, 0.8, 2.42, 0.65)], [-0.9, tt(1.9, 0.6, 2.35, 0.5)]]);
  hatch(B, P.turret, -0.2, 2.42, 0.3, 0.24); for (const s of [1, -1]) smoke(B, P.turret, -0.5, -0.2, 2, 2.2, 0.75, s);
  B.cbox(P.gun, V.paint, 0.7, 0.95, 2.0, 2.25, -0.16, 0.16, 0.04); B.tube(P.gun, V.metal, [0.9, 2.12, 0], [2.5, 2.12, 0], 0.035, 0.03, 8);
  ant(B, P.hull, -2.4, 1.9, 0.9); flags(B, P.hull, -2.4, -2.0, 1.3, 1.55, 1.395);
  B.piv = { turret: [-0.1, 1.88, 0], gun: [0.8, 2.12, 0], door: [-2.9, 0.5, 0, 0] };
  return B.build({ muzzle: [2.5, 2.12, 0], cmd: [-0.2, 2.42, 0.3], len: 5.8, wid: 2.8, hgt: 2.55, deck: 1.9, eng: [2.0, 1.6, -0.6], tracked: true, turret: true, ramp: true, recoil: 0.06 });
}

export function m113() {
  const B = new VB();
  // aluminium box: steep upper glacis over a short nose plate, flat roof, vertical rear with ramp
  hull(B, P.hull, V.paint, [[2.43, sec(0.75, 0.95, 0.8, 1.3, 0.95, 1.3, 0.02)], [2.25, sec(0.42, 1.25, 0.6, 1.33, 1.45, 1.33, 0.03)], [1.55, sec(0.42, 1.25, 0.6, 1.33, 1.85, 1.3)], [-2.43, sec(0.42, 1.25, 0.6, 1.33, 1.85, 1.3)]]);
  B.cbox(P.hull, V.paint, 1.5, 2.45, 0.85, 1.85, -1.33, 1.33, 0.02, { capA: false, capB: false });
  for (const s of [1, -1]) { light(B, 2.35, 1.15, 1.1 * s); B.cbox(P.hull, V.paint, -2.43, 2.3, 0.84, 0.88, s > 0 ? 1.33 : -1.4, s > 0 ? 1.4 : -1.33, 0.01); }
  B.cbox(P.hull, V.paint, 2.0, 2.48, 0.95, 1.4, -1.2, 1.2, 0.02); // trim vane, stowed on the nose
  hatch(B, P.hull, 1.25, 1.85, 0.75, 0.25); B.cbox(P.hull, V.paint, -1.9, -0.6, 1.85, 1.9, -1.0, 0.4, 0.02); // cargo hatch
  B.cbox(P.door, V.paint, -2.49, -2.43, 0.45, 1.75, -0.85, 0.85, 0.02);
  tracked(B, { xs: [1.55, 0.78, 0.0, -0.78, -1.55], r: 0.31, idl: [-2.15, 0.48, 0.26], spr: [2.15, 0.58, 0.28], z: 1.12, tw: 0.38, topY: 0.84 });
  // commander's cupola with the M2 and its shield
  B.tube(P.turret, V.paint, [0.3, 1.85, -0.55], [0.3, 2.05, -0.55], 0.4, 0.37, 10); hatch(B, P.turret, 0.3, 2.05, -0.55, 0.3);
  mg(B, P.turret, 0.5, 2.25, -0.55, 1.4, 0.03); B.cbox(P.turret, V.paint, 0.7, 0.75, 2.05, 2.5, -0.95, -0.15, 0.01);
  ant(B, P.hull, -2.2, 1.85, 1.1); flags(B, P.hull, -2.2, -1.8, 1.35, 1.6, 1.335);
  B.piv = { turret: [0.3, 1.85, -0.55], gun: [0.5, 2.25, -0.55], door: [-2.46, 0.45, 0, 0] };
  return B.build({ muzzle: [1.9, 2.25, -0.55], cmd: [0.3, 2.05, -0.55], len: 4.9, wid: 2.7, hgt: 2.5, deck: 1.85, eng: [1.6, 1.7, 0.5], tracked: true, turret: true, ramp: true, recoil: 0.04 });
}

// ================= TRUCKS =================
// cab-over cab: front at x0, back at x1
function cabOver(B, x0, x1, y0, y1, w, o = {}) {
  hull(B, P.hull, V.paint, [[x0, sec(y0 + 0.05, w - 0.12, y0 + 0.5, w, y1 - 0.06, w - 0.12, 0.04)], [x0 - 0.12, sec(y0, w, y0 + 0.5, w, y1, w - 0.06, 0.06)], [x1, sec(y0, w, y0 + 0.5, w, y1, w - 0.06, 0.06)]]);
  win(B, [[x0 + 0.005, y0 + 0.75, w - 0.12], [x0 + 0.005, y0 + 0.75, -w + 0.12], [x0 - 0.1, y1 - 0.12, -w + 0.15], [x0 - 0.1, y1 - 0.12, w - 0.15]]);
  for (const s of [1, -1]) { win(B, [[x0 - 0.25, y0 + 0.75, (w + 0.006) * s], [x0 - 0.25, y1 - 0.15, (w + 0.006) * s], [x1 + 0.35, y1 - 0.15, (w + 0.006) * s], [x1 + 0.35, y0 + 0.75, (w + 0.006) * s]].map(p => p)); light(B, x0 + 0.02, y0 + 0.25, (w - 0.25) * s, 0.14); B.cbox(P.hull, V.black, x0 - 0.3, x0 + 0.05, y0 - 0.15, y0 + 0.05, s > 0 ? w - 0.35 : -w, s > 0 ? w : -w + 0.35, 0.02); }
  B.cbox(P.hull, V.black, x0 - 0.05, x0 + 0.08, y0 - 0.25, y0 + 0.05, -w, w, 0.02); // bumper
  B.cbox(P.hull, V.black, x0 + 0.005, x0 + 0.02, y0 + 0.15, y0 + 0.55, -w + 0.4, w - 0.4, 0.01); // grille
}
// bonneted cab: grille at x0, windscreen at xw, cab back at x1
function bonnet(B, x0, xw, x1, yb, yh, yr, w, wc, o = {}) {
  hull(B, P.hull, V.paint, [[x0, sec(yb, w * 0.75, yb + 0.3, w * 0.8, yh - 0.04, w * 0.75, 0.03)], [xw + 0.05, sec(yb, w * 0.8, yb + 0.3, w * 0.82, yh, w * 0.78, 0.04)]]);
  B.plate(P.hull, V.black, [[x0 + 0.005, yb + 0.1, w * 0.6], [x0 + 0.005, yb + 0.1, -w * 0.6], [x0 + 0.005, yh - 0.12, -w * 0.6], [x0 + 0.005, yh - 0.12, w * 0.6]], 0.01);
  for (const s of [1, -1]) { light(B, x0 + 0.02, yh - 0.25, w * 0.68 * s, 0.13); B.extrude(P.hull, V.paint, [[x0 + 0.1, yb - 0.15], [xw + 0.5, yb - 0.15], [xw + 0.4, yb + 0.35], [x0 + 0.25, yb + 0.35]], s > 0 ? w * 0.8 : -w, s > 0 ? w : -w * 0.8, 0.02); }
  const soft = o.soft;
  hull(B, P.hull, soft ? V.canvas : V.paint, [[xw, sec(yb, wc, yh, wc, yr - 0.04, wc - 0.05, 0.04)], [x1, sec(yb, wc, yh, wc, yr, wc - 0.05, 0.05)]]);
  win(B, [[xw + 0.005, yh + 0.08, wc - 0.1], [xw + 0.005, yh + 0.08, -wc + 0.1], [xw - 0.06, yr - 0.1, -wc + 0.12], [xw - 0.06, yr - 0.1, wc - 0.12]]);
  for (const s of [1, -1]) win(B, [[xw - 0.15, yh + 0.08, (wc + 0.006) * s], [xw - 0.15, yr - 0.12, (wc + 0.006) * s], [x1 + 0.2, yr - 0.12, (wc + 0.006) * s], [x1 + 0.2, yh + 0.08, (wc + 0.006) * s]]);
  B.cbox(P.hull, V.black, x0 - 0.05, x0 + 0.08, yb - 0.25, yb + 0.05, -w, w, 0.02);
}
// cargo bed with tarp over hoops
function cargo(B, x0, x1, yb, w, h, o = {}) {
  B.cbox(P.hull, V.paint, x1, x0, yb, yb + 0.45, -w, w, 0.03);
  const yt = yb + h; hull(B, P.hull, V.canvas, [[x0, sec(yb + 0.45, w - 0.01, yb + 0.5, w, yt - 0.15, w - 0.08, 0.1)], [x1, sec(yb + 0.45, w - 0.01, yb + 0.5, w, yt - 0.15, w - 0.08, 0.1)]]);
  for (let x = x0 - 0.6; x > x1 + 0.3; x -= 1.0) for (const s of [1, -1]) B.cbox(P.hull, V.canvas, x - 0.03, x + 0.03, yb + 0.5, yt - 0.2, s * w - 0.01, s * w + 0.01, 0.005);
  B.plate(P.hull, V.canvas, [[x1 - 0.01, yb + 0.6, -w + 0.1], [x1 - 0.01, yb + 0.6, w - 0.1], [x1 - 0.01, yt - 0.25, w - 0.1], [x1 - 0.01, yt - 0.25, -w + 0.1]], 0.01);
  for (const s of [1, -1]) B.cbox(P.hull, V.red, x1 - 0.02, x1 + 0.02, yb + 0.15, yb + 0.3, s * (w - 0.3) - 0.1, s * (w - 0.3) + 0.1, 0.01);
}
const chassis = (B, x0, x1, y, w = 0.45) => B.cbox(P.hull, V.black, x1, x0, y, y + 0.25, -w, w, 0.02);

export function trm2000() {
  const B = new VB();
  chassis(B, 2.4, -2.6, 0.6); cabOver(B, 2.65, 1.1, 0.95, 2.6, 1.07); cargo(B, 0.95, -2.7, 0.95, 1.07, 1.6);
  wheels(B, [1.85, -1.4], 0.45, 0.32, 0.86);
  flags(B, P.hull, 1.3, 1.6, 1.15, 1.35, 1.075);
  return B.build({ len: 5.4, wid: 2.15, hgt: 2.6, deck: 2.6, eng: [1.9, 1.3, 0], truck: true });
}
export function trm10000() {
  const B = new VB();
  chassis(B, 4.6, -4.8, 0.75, 0.5); cabOver(B, 4.95, 3.2, 1.1, 3.15, 1.24); cargo(B, 3.0, -4.95, 1.2, 1.24, 1.95);
  wheels(B, [3.6, -2.1, -3.55], 0.6, 0.4, 0.98);
  flags(B, P.hull, 3.4, 3.75, 1.35, 1.55, 1.245);
  return B.build({ len: 9.9, wid: 2.48, hgt: 3.2, deck: 3.15, eng: [3.6, 1.6, 0], truck: true });
}
export function gbc180() {
  const B = new VB();
  chassis(B, 3.2, -3.6, 0.72); bonnet(B, 3.6, 2.0, 1.1, 1.0, 1.75, 2.65, 1.15, 1.1, { soft: true }); cargo(B, 0.95, -3.65, 1.25, 1.2, 1.7);
  wheels(B, [2.75, -1.25, -2.65], 0.55, 0.38, 0.95);
  flags(B, P.hull, 1.3, 1.6, 1.3, 1.5, 1.105);
  return B.build({ len: 7.3, wid: 2.4, hgt: 2.95, deck: 2.65, eng: [2.8, 1.75, 0], truck: true });
}
export function vlra() {
  const B = new VB();
  chassis(B, 2.6, -2.9, 0.68); bonnet(B, 3.0, 1.7, 0.75, 0.95, 1.65, 2.5, 1.1, 1.08, { soft: true }); cargo(B, 0.6, -3.0, 1.1, 1.12, 1.45);
  wheels(B, [2.0, -1.75], 0.52, 0.38, 0.92);
  flags(B, P.hull, 0.95, 1.25, 1.2, 1.4, 1.085);
  return B.build({ len: 6.0, wid: 2.25, hgt: 2.6, deck: 2.5, eng: [2.3, 1.65, 0], truck: true });
}

// ================= LIGHT VEHICLES =================
// a boxy 4x4: bonnet from xf to xw, cabin/body to xr; belt y, roof y
function box4x4(B, xf, xw, xr, yb, yh, yr, w, o = {}) {
  hull(B, P.hull, V.paint, [[xf, sec(yb, w - 0.05, yb + 0.25, w, yh - 0.03, w - 0.05, 0.03)], [xw + 0.04, sec(yb, w - 0.05, yb + 0.25, w, yh, w - 0.05, 0.03)]]);
  B.plate(P.hull, V.black, [[xf + 0.005, yb + 0.1, w * 0.55], [xf + 0.005, yb + 0.1, -w * 0.55], [xf + 0.005, yh - 0.08, -w * 0.55], [xf + 0.005, yh - 0.08, w * 0.55]], 0.01);
  hull(B, P.hull, o.soft ? V.canvas : V.paint, [[xw, sec(yb, w - 0.03, yh, w, yr - 0.03, w - 0.06, 0.03)], [xr, sec(yb, w - 0.03, yh, w, yr, w - 0.06, 0.04)]]);
  win(B, [[xw + 0.005, yh + 0.06, w - 0.08], [xw + 0.005, yh + 0.06, -w + 0.08], [xw - 0.04, yr - 0.07, -w + 0.1], [xw - 0.04, yr - 0.07, w - 0.1]]);
  const wins = o.wins || [[xw - 0.1, o.winTo ?? xr + 0.3]];
  for (const s of [1, -1]) { for (const [wa, wb] of wins) win(B, [[wa, yh + 0.07, (w + 0.005) * s], [wa, yr - 0.08, (w + 0.005) * s], [wb, yr - 0.08, (w + 0.005) * s], [wb, yh + 0.07, (w + 0.005) * s]]); light(B, xf + 0.02, yh - 0.2, w * 0.72 * s, 0.12); B.cbox(P.hull, V.red, xr - 0.02, xr + 0.01, yh - 0.15, yh, s * (w - 0.1) - 0.05, s * (w - 0.1) + 0.05, 0.005); }
  B.cbox(P.hull, V.black, xf - 0.06, xf + 0.06, yb - 0.12, yb + 0.06, -w, w, 0.02);
  if (o.spare) B.tube(P.hull, V.rubber, [xr - 0.02, yh, 0], [xr - 0.24, yh, 0], o.spare, o.spare, 12);
}
export function p4() {
  const B = new VB();
  box4x4(B, 2.1, 1.0, -2.05, 0.55, 1.15, 1.9, 0.85, { soft: true, spare: 0.36, wins: [[0.9, 0.3]] });
  wheels(B, [1.4, -1.0], 0.37, 0.25, 0.72);
  ant(B, P.hull, -1.9, 1.9, 0.75); flags(B, P.hull, 1.2, 1.5, 0.75, 0.95, 0.855);
  return B.build({ len: 4.2, wid: 1.7, hgt: 1.9, deck: 1.9, eng: [1.6, 1.15, 0] });
}
export function vbl() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[1.92, sec(0.6, 0.75, 0.75, 0.95, 0.85, 0.9, 0.03)], [1.3, sec(0.48, 0.9, 0.85, 1.01, 1.2, 0.93)], [0.55, sec(0.48, 0.9, 0.85, 1.01, 1.62, 0.82)], [-1.6, sec(0.48, 0.9, 0.85, 1.01, 1.62, 0.82)], [-1.92, sec(0.55, 0.88, 0.85, 0.98, 1.5, 0.8)]]);
  for (const s of [1, -1]) { win(B, [[1.28, 1.25, 0.8 * s], [1.28, 1.25, 0.1 * s], [0.6, 1.58, 0.1 * s], [0.6, 1.58, 0.75 * s]]); light(B, 1.8, 0.9, 0.7 * s); win(B, [[0.3, 1.2, 0.97 * s], [-0.3, 1.2, 0.97 * s], [-0.3, 1.45, 0.88 * s], [0.3, 1.45, 0.88 * s]]); }
  wheels(B, [1.2, -1.2], 0.45, 0.32, 0.86);
  B.tube(P.turret, V.paint, [-0.2, 1.62, 0], [-0.2, 1.72, 0], 0.4, 0.4, 12); mg(B, P.turret, -0.1, 1.9, 0, 0.9);
  ant(B, P.hull, -1.7, 1.6, 0.6); flags(B, P.hull, -1.7, -1.4, 1.0, 1.2, 1.0);
  B.piv = { turret: [-0.2, 1.62, 0], gun: [-0.1, 1.9, 0] };
  return B.build({ muzzle: [0.8, 1.9, 0], cmd: [-0.2, 1.72, 0], len: 3.84, wid: 2.02, hgt: 1.7, deck: 1.62, eng: [1.4, 1.2, 0], turret: true, recoil: 0.03 });
}
export function sherpa() {
  const B = new VB();
  hull(B, P.hull, V.paint, [[2.5, sec(0.65, 0.85, 0.8, 1.05, 1.25, 1.0, 0.03)], [1.3, sec(0.55, 1.0, 0.95, 1.12, 1.45, 1.05)], [0.85, sec(0.55, 1.0, 1.0, 1.15, 2.2, 1.0)], [-2.3, sec(0.55, 1.0, 1.0, 1.15, 2.2, 1.0)], [-2.5, sec(0.6, 0.98, 1.0, 1.12, 2.15, 0.98)]]);
  for (const s of [1, -1]) { win(B, [[1.25, 1.5, 0.95 * s], [1.25, 1.5, 0.08 * s], [0.88, 2.15, 0.08 * s], [0.88, 2.15, 0.92 * s]]); light(B, 2.4, 1.1, 0.8 * s); win(B, [[0.6, 1.55, 1.13 * s], [0.0, 1.55, 1.13 * s], [0.0, 1.95, 1.07 * s], [0.6, 1.95, 1.07 * s]]); win(B, [[-0.2, 1.55, 1.13 * s], [-0.8, 1.55, 1.13 * s], [-0.8, 1.95, 1.07 * s], [-0.2, 1.95, 1.07 * s]]); }
  B.cbox(P.door, V.paint, -2.56, -2.49, 0.65, 2.0, -0.85, 0.85, 0.015);
  wheels(B, [1.7, -1.55], 0.52, 0.38, 0.95);
  rws(B, P.turret, -0.6, 2.2, 0);
  ant(B, P.hull, -2.2, 2.2, 0.8); flags(B, P.hull, -2.2, -1.85, 1.3, 1.5, 1.14);
  B.piv = { turret: [-0.6, 2.2, 0], gun: [-0.55, 2.52, -0.28], door: [-2.52, 0.65, 0, 0] };
  return B.build({ muzzle: [0.45, 2.52, -0.28], cmd: [-0.6, 2.2, 0], cmdHull: true, len: 5.0, wid: 2.3, hgt: 2.6, deck: 2.2, eng: [1.9, 1.3, 0], turret: true, recoil: 0.03 });
}
export function defender() {
  const B = new VB();
  box4x4(B, 2.3, 1.15, -2.3, 0.55, 1.12, 2.0, 0.89, { spare: 0.38, wins: [[1.05, 0.25], [0.15, -0.65], [-0.75, -1.6]] }); B.cbox(P.hull, V.paint, -0.1, 1.15, 1.12, 1.16, -0.9, 0.9, 0.01);
  wheels(B, [1.6, -1.2], 0.39, 0.26, 0.76);
  flags(B, P.hull, 1.35, 1.65, 0.75, 0.95, 0.895);
  return B.build({ len: 4.6, wid: 1.79, hgt: 2.0, deck: 2.0, eng: [1.7, 1.12, 0] });
}
export function lc70() {
  const B = new VB();
  box4x4(B, 2.5, 1.2, -2.5, 0.6, 1.2, 2.0, 0.93, { wins: [[1.1, 0.3], [0.2, -0.6], [-0.7, -1.6]] });
  wheels(B, [1.65, -1.35], 0.4, 0.27, 0.8);
  flags(B, P.hull, 1.4, 1.7, 0.8, 1.0, 0.935);
  return B.build({ len: 5.0, wid: 1.87, hgt: 2.0, deck: 2.0, eng: [1.8, 1.2, 0] });
}

export const MIL = { leclerc, leo2a4: leopard2, amx30, amx10rc, jaguar, vab, vbci, griffon, serval, amx10p, m113, trm2000, trm10000, gbc180, vlra, p4, vbl, sherpa, defender, lc70 };
