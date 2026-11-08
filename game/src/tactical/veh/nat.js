// National equipment: the vehicles and helicopters of the major armies (US, UK, Germany, Russia, China, Japan,
// India, Italy, Spain, Turkey, South Korea, Brazil) and the kit their neighbours field (ex-Soviet, Western export).
// Each is built from its own real dimensions by a family builder (main battle tank, tracked IFV/APC, wheeled
// armoured vehicle, protected 4x4, soft 4x4, truck, transport / utility / attack / tandem / coaxial helicopter);
// the parameters carry what sets the vehicle apart: hull and turret shape, wheel and road-wheel counts, gun,
// armour packages, weapon stations, rotor layout.
import { VB, VP, VS } from './kit.js';
import { hull, hh, sec, tt, tracked, wheels, smoke, mg, rws, hatch, light, flags, ant, win, cabOver, bonnet, cargo, chassis, box4x4 } from './mil.js';
import { ring, fuselage, tailRotor, fenestron, skids, wheelGear, flagH, fin } from './heli.js';
const P = VP, V = VS, S = VB.sym;

// rounded (cast) turret section: half-ring from the bottom centre to the top centre
const dome = (yb, zb, yt, zt, n = 4) => { const o = [[yb, 0], [yb, zb]]; for (let i = 1; i <= n; i++) { const a = i / (n + 1) * Math.PI / 2; o.push([yb + (yt - yb) * Math.sin(a), zb + (zt - zb) * (1 - Math.cos(a)) - (zb - zt) * 0]); } o.push([yt, zt * 0.55]); o.push([yt, 0]); return o; };
const era = (B, part, x0, x1, y0, y1, z0, z1, nx, ny) => { for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const xa = x0 + (x1 - x0) * i / nx, xb = x0 + (x1 - x0) * (i + 0.85) / nx, ya = y0 + (y1 - y0) * j / ny, yb = y0 + (y1 - y0) * (j + 0.85) / ny; B.cbox(part, V.paint, Math.min(xa, xb), Math.max(xa, xb), ya, yb, z0, z1, 0.01); } };
function rotorP(B, part, x, y, r, n, chord = 0.5, phase = 0) {
  B.tube(part, V.metal, [x, y - 0.1, 0], [x, y + 0.15, 0], 0.32, 0.22, 10);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + phase, c = Math.cos(a), s = Math.sin(a), px = -s, pz = c, h = chord / 2;
    const pts = [[x + c * 0.3 + px * h * 0.6, y + 0.02, -(s * 0.3) + pz * h * 0.6], [x + c * r + px * h, y + 0.02 + r * 0.004, -(s * r) + pz * h], [x + c * r - px * h, y + 0.02 + r * 0.004, -(s * r) - pz * h], [x + c * 0.3 - px * h * 0.6, y + 0.02, -(s * 0.3) - pz * h * 0.6]];
    const lo = pts.map(q => [q[0], q[1] - 0.05, q[2]]);
    B.quad(pts[0], pts[1], pts[2], pts[3], part, V.black, [x, y - 5, 0]); B.quad(lo[3], lo[2], lo[1], lo[0], part, V.black, [x, y + 5, 0]); B.quad(pts[1], lo[1], lo[2], pts[2], part, V.black, [x, y, 0]);
  }
}
const mast = (B, x, y0, y1) => B.tube(P.hull, V.metal, [x, y0, 0], [x, y1, 0], 0.12, 0.1, 8);

// ===================== MAIN BATTLE TANKS =====================
// d: L, W, deck, nose (glacis length), wh: [n road wheels, r], rollers, tw, skirt, turret {x, f, b, w, y0, y1, shape}, gun {L, r, ev, sleeve}, era, cupola, rws, mgs
export function mbt(d) {
  const B = new VB(), hl = d.L / 2, w = d.W / 2, dk = d.deck, top = d.top ?? 0.95, n = d.wh[0], r = d.wh[1], tz = w - (d.tw ?? 0.63) / 2 - 0.05;
  const nl = d.nose ?? 1.0;
  hull(B, P.hull, V.paint, [[hl, hh(dk - 0.62, w * 0.55, dk - 0.6, w * 0.92, dk - 0.55, 0.03)], [hl - 0.35, hh(0.52, w * 0.6, top, w, dk - 0.42)], [hl - nl, hh(0.48, w * 0.6, top, w, dk)], [-hl + 0.35, hh(0.48, w * 0.6, top, w, dk + (d.rearUp || 0))], [-hl, hh(0.72, w * 0.6, top, w, dk - 0.1)]]);
  const xs = Array.from({ length: n }, (_, i) => hl - 0.9 - i * (d.L - 1.8) / Math.max(1, n - 1));
  const T = d.idlerFront === false ? { idl: [-hl + 0.4, 0.62, 0.3], spr: [hl - 0.42, 0.66, 0.33] } : { idl: [hl - 0.42, 0.62, 0.3], spr: [-hl + 0.42, 0.66, 0.33] };
  tracked(B, { xs, r, ...T, z: tz, tw: d.tw ?? 0.63, topY: top, rollers: d.rollers, rr: 0.1 });
  for (const s of [1, -1]) {
    if (d.skirt !== false) B.cbox(P.hull, V.paint, -hl + 0.15, hl - 0.6, top - 0.38, top + 0.04, s > 0 ? w : -w - 0.07, s > 0 ? w + 0.07 : -w, 0.02);
    light(B, hl - 0.08, dk - 0.5, (w - 0.3) * s);
    if (d.era) era(B, P.hull, -hl * 0.1, hl - 0.65, top - 0.35, top + 0.02, s > 0 ? w + 0.07 : -w - 0.16, s > 0 ? w + 0.16 : -w - 0.07, 6, 1);
  }
  if (d.era) era(B, P.hull, hl - nl + 0.1, hl - 0.4, dk - 0.32, dk + 0.08, -w * 0.8, w * 0.8, 2, 1);
  B.plate(P.hull, V.black, [[-hl * 0.35, dk + 0.005, w * 0.5], [-hl * 0.35, dk + 0.005, -w * 0.5], [-hl + 0.5, dk + 0.005, -w * 0.5], [-hl + 0.5, dk + 0.005, w * 0.5]], 0.01);
  hatch(B, P.hull, hl - nl + 0.3, dk, d.driverZ ?? 0, 0.26);
  // turret
  const t = d.turret, tx = t.x ?? 0.1, tw = t.w, y0 = t.y0 ?? dk, y1 = t.y1, f = tx + t.f, bk = tx - t.b;
  const sh = t.shape || 'slab';
  if (sh === 'cast') hull(B, P.turret, V.paint, [[f, dome(y0, tw * 0.45, y1 - 0.15, tw * 0.3)], [f - 0.45, dome(y0, tw * 0.92, y1 - 0.02, tw * 0.6)], [tx, dome(y0, tw, y1, tw * 0.62)], [bk + 0.5, dome(y0, tw * 0.95, y1 - 0.03, tw * 0.6)], [bk, dome(y0 + 0.1, tw * 0.6, y1 - 0.15, tw * 0.35)]]);
  else if (sh === 'wedge') { hull(B, P.turret, V.paint, [[f + 0.85, tt(y0 + 0.2, tw * 0.12, y1 - 0.05, tw * 0.12, 0.03)], [f, tt(y0, tw * 0.92, y1, tw * 0.9)], [bk + 0.6, tt(y0, tw, y1, tw * 0.95)], [bk, tt(y0 + 0.05, tw * 0.85, y1 - 0.03, tw * 0.8)]]); }
  else if (sh === 'faceted') hull(B, P.turret, V.paint, [[f, tt(y0, tw * 0.45, y1 - 0.08, tw * 0.4)], [f - 0.9, tt(y0, tw, y1, tw * 0.95)], [bk + 0.5, tt(y0, tw, y1, tw * 0.95)], [bk, tt(y0 + 0.05, tw * 0.82, y1 - 0.02, tw * 0.78)]]);
  else if (sh === 'low') hull(B, P.turret, V.paint, [[f, tt(y0, tw * 0.6, y1 - 0.15, tw * 0.35)], [f - 0.7, tt(y0, tw, y1, tw * 0.75)], [bk + 0.3, tt(y0, tw * 0.95, y1, tw * 0.75)], [bk, tt(y0 + 0.05, tw * 0.7, y1 - 0.05, tw * 0.55)]]);
  else hull(B, P.turret, V.paint, [[f, tt(y0, tw * 0.78, y1, tw * 0.76, 0.05)], [f - 0.2, tt(y0, tw, y1, tw * 0.96)], [bk + 0.5, tt(y0, tw, y1, tw * 0.96)], [bk, tt(y0 + 0.05, tw * 0.88, y1 - 0.02, tw * 0.84)]]);
  if (t.bustle) B.cbox(P.turret, V.paint, bk - 0.3, bk, y0 + 0.2, y1 - 0.1, -tw * 0.8, tw * 0.8, 0.03);
  if (d.era) { for (const s of [1, -1]) era(B, P.turret, f - 0.1, tx - 0.2, y0 + 0.1, y1 - 0.05, s > 0 ? tw : -tw - 0.1, s > 0 ? tw + 0.1 : -tw, 3, 2); era(B, P.turret, f - 0.05, f + 0.15, y1 - 0.05, y1 + 0.08, -tw * 0.8, tw * 0.8, 1, 1); }
  // sights, hatches, cupola, smoke
  B.cbox(P.turret, V.paint, f - 0.9, f - 0.35, y1, y1 + 0.24, -tw * 0.72, -tw * 0.42, 0.04); B.plate(P.turret, V.glass, [[f - 0.345, y1 + 0.04, -tw * 0.7], [f - 0.345, y1 + 0.04, -tw * 0.45], [f - 0.345, y1 + 0.18, -tw * 0.45], [f - 0.345, y1 + 0.18, -tw * 0.7]], 0.008);
  const cmd = [tx - 0.35, y1, tw * 0.45];
  if (d.cupola === 'rws') rws(B, P.turret, cmd[0], y1, cmd[2]); else { B.tube(P.turret, V.paint, [cmd[0], y1, cmd[2]], [cmd[0], y1 + 0.18, cmd[2]], 0.36, 0.33, 10); hatch(B, P.turret, cmd[0], y1 + 0.18, cmd[2], 0.28); if (d.cupola !== false) mg(B, P.turret, cmd[0] + 0.1, y1 + 0.36, cmd[2], 0.9, d.hmg ? 0.03 : 0.02); }
  hatch(B, P.turret, tx - 0.35, y1, -tw * 0.45, 0.3);
  for (const s of [1, -1]) smoke(B, P.turret, f - 1.2, f - 0.6, 3, y0 + 0.5, tw * 0.95, s, 0.18);
  ant(B, P.turret, bk + 0.3, y1, tw * 0.7); ant(B, P.turret, bk + 0.3, y1, -tw * 0.7, 1.8);
  flags(B, P.turret, bk + 0.2, bk + 0.65, y0 + 0.3, y0 + 0.55, tw + 0.003);
  // gun
  const g = d.gun, gy = g.y ?? (y0 + (y1 - y0) * 0.45), gx0 = f - 0.1;
  B.cbox(P.gun, V.paint, gx0 - 0.15, gx0 + 0.35, gy - 0.22, gy + 0.22, -0.33, 0.33, 0.04);
  const gL = g.L, gr = g.r ?? 0.11; B.tube(P.gun, V.paint, [gx0 + 0.3, gy, 0], [gx0 + gL * 0.55, gy, 0], gr, gr * 0.92, 10); B.tube(P.gun, V.paint, [gx0 + gL * 0.55, gy, 0], [gx0 + gL, gy, 0], gr * 0.8, gr * 0.78, 10);
  if (g.ev) B.tube(P.gun, V.paint, [gx0 + gL * g.ev, gy, 0], [gx0 + gL * g.ev + 0.5, gy, 0], gr * 1.5, gr * 1.5, 10);
  if (g.brake) B.cbox(P.gun, V.metal, gx0 + gL - 0.3, gx0 + gL, gy - gr * 1.4, gy + gr * 1.4, -gr * 1.6, gr * 1.6, 0.02);
  mg(B, P.gun, gx0 + 0.3, gy - 0.1, -0.28, 0.35);
  B.piv = { turret: [tx, y0, 0], gun: [gx0, gy, 0] };
  return B.build({ muzzle: [gx0 + gL, gy, 0], cmd: [cmd[0], y1 + 0.18, cmd[2]], len: d.L + Math.max(0, gx0 + gL - hl), wid: d.W, hgt: y1 + 0.3, deck: dk, eng: [-hl + 1.2, dk, 0], tracked: true, turret: true, recoil: d.recoil ?? 0.4 });
}

// ===================== TRACKED IFV / APC =====================
// d: L, W, H (roof), noseY, glacis (length of the upper front plate), wh [n, r], tw, turret {x, w, l, h, gun: '25'|'30'|'bmp3'|'73'|'cannon'} | null, cupola, rws, ramp, low, skirt
export function ifvT(d) {
  const B = new VB(), hl = d.L / 2, w = d.W / 2, H = d.H, gl = d.glacis ?? 1.0, top = d.top ?? Math.min(0.95, d.wh[1] * 2 + 0.3);
  const ny = d.noseY ?? 0.85;
  hull(B, P.hull, V.paint, [[hl, sec(ny - 0.15, w * 0.85, ny, w * 0.95, ny + 0.12, w * 0.92, 0.02)], [hl - 0.25, sec(0.42, w * 0.9, top, w, ny + 0.3, w, 0.03)], [hl - gl, sec(0.42, w * 0.9, top, w, H, w * (d.tumble ?? 0.97))], [-hl + 0.1, sec(0.42, w * 0.9, top, w, H, w * (d.tumble ?? 0.97))], [-hl, sec(0.5, w * 0.9, top, w, H - 0.05, w * (d.tumble ?? 0.97) - 0.02)]]);
  const n = d.wh[0], r = d.wh[1], tz = w - (d.tw ?? 0.45) / 2 - 0.04;
  const xs = Array.from({ length: n }, (_, i) => hl - 0.75 - i * (d.L - 1.5) / Math.max(1, n - 1));
  tracked(B, { xs, r, idl: [-hl + 0.32, 0.5, 0.27], spr: [hl - 0.35, 0.58, 0.29], z: tz, tw: d.tw ?? 0.45, topY: top, rollers: d.rollers, rr: 0.09 });
  for (const s of [1, -1]) { light(B, hl - 0.05, ny, (w - 0.25) * s); if (d.skirt) B.cbox(P.hull, V.paint, -hl + 0.15, hl - 0.4, top - 0.35, top + 0.03, s > 0 ? w : -w - 0.06, s > 0 ? w + 0.06 : -w, 0.02); if (d.era) era(B, P.hull, -hl + 0.3, hl - 0.6, top - 0.32, top + 0.02, s > 0 ? w + 0.06 : -w - 0.14, s > 0 ? w + 0.14 : -w - 0.06, 7, 1); }
  hatch(B, P.hull, hl - gl + 0.35, H, d.driverZ ?? (w * 0.45), 0.25);
  if (d.troopHatch !== false) B.cbox(P.hull, V.paint, -hl + 0.4, -hl + 1.6, H, H + 0.04, -w * 0.5, w * 0.5, 0.02);
  if (d.ramp !== false) B.cbox(P.door, V.paint, -hl - 0.06, -hl, 0.45, H - 0.15, -w * 0.6, w * 0.6, 0.02); else { B.cbox(P.door, V.paint, -hl - 0.06, -hl, 0.5, H - 0.1, 0.02, w * 0.55, 0.015); B.cbox(P.doorR, V.paint, -hl - 0.06, -hl, 0.5, H - 0.1, -w * 0.55, -0.02, 0.015); }
  const T = d.turret; let muzzle = null, gunPiv = null, cmd = [0, H, 0], tPiv = [0, H, 0];
  if (T) {
    const tx = T.x ?? 0, tw = T.w, tl = T.l, th = T.h; tPiv = [tx, H, T.z || 0];
    const z0 = T.z || 0, shift = q => q.map(([y, z]) => [y, z]);
    hull(B, P.turret, V.paint, [[tx + tl * 0.55, tt(H, tw * 0.55, H + th - 0.08, tw * 0.45)], [tx + tl * 0.3, tt(H, tw, H + th, tw * 0.85)], [tx - tl * 0.45, tt(H, tw, H + th, tw * 0.85)], [tx - tl * 0.55, tt(H + 0.05, tw * 0.8, H + th - 0.05, tw * 0.7)]].map(([x, q]) => [x, shift(q)]));
    cmd = [tx - 0.15, H + th, tw * 0.45]; hatch(B, P.turret, cmd[0], cmd[1], cmd[2], 0.27);
    for (const s of [1, -1]) smoke(B, P.turret, tx + tl * 0.1, tx + tl * 0.35, 3, H + th * 0.5, tw, s, 0.15);
    B.cbox(P.turret, V.paint, tx - 0.1, tx + 0.35, H + th, H + th + 0.25, -tw * 0.7, -tw * 0.35, 0.03);
    const gy = H + th * 0.5, gx = tx + tl * 0.55; gunPiv = [gx, gy, 0];
    if (T.gun === 'bmp3') { B.tube(P.gun, V.paint, [gx, gy, 0], [gx + 2.0, gy, 0], 0.11, 0.1, 10); B.tube(P.gun, V.paint, [gx, gy - 0.05, 0.28], [gx + 2.6, gy - 0.05, 0.28], 0.04, 0.035, 6); muzzle = [gx + 2.0, gy, 0]; }
    else if (T.gun === '73') { B.tube(P.gun, V.paint, [gx, gy, 0], [gx + 1.5, gy, 0], 0.07, 0.06, 8); B.tube(P.turret, V.paint, [gx - 0.3, H + th + 0.1, 0], [gx + 0.6, H + th + 0.1, 0], 0.07, 0.07, 6); muzzle = [gx + 1.5, gy, 0]; }
    else if (T.gun === 'mgs') { B.cbox(P.gun, V.paint, gx - 0.1, gx + 0.3, gy - 0.18, gy + 0.18, -0.25, 0.25, 0.03); B.tube(P.gun, V.paint, [gx + 0.2, gy, 0], [gx + (T.L || 4.5), gy, 0], 0.1, 0.08, 10); muzzle = [gx + (T.L || 4.5), gy, 0]; }
    else { const gL = T.gun === '30' ? 2.6 : T.gun === '40' ? 2.4 : 2.2, gr = T.gun === '40' ? 0.07 : 0.045; B.cbox(P.gun, V.paint, gx - 0.1, gx + 0.25, gy - 0.12, gy + 0.12, -0.18, 0.18, 0.03); B.tube(P.gun, V.metal, [gx + 0.2, gy, 0], [gx + gL, gy, 0], gr, gr * 0.85, 8); muzzle = [gx + gL, gy, 0]; if (T.atgm) B.cbox(P.turret, V.paint, tx - 0.3, tx + 0.5, gy - 0.1, gy + 0.2, tw + 0.02, tw + 0.32, 0.03); }
  } else if (d.rws) { const rx = d.rws[0], rz = d.rws[1]; rws(B, P.turret, rx, H, rz, d.rws[2]); tPiv = [rx, H, rz]; gunPiv = [rx + 0.05, H + 0.32, rz - 0.28]; muzzle = [rx + 1.1, H + 0.32, rz - 0.28]; cmd = [rx, H + 0.2, rz]; }
  else if (d.cupola !== false) { const cz = d.cupZ ?? -w * 0.4, cx = d.cupX ?? hl - gl - 0.6; B.tube(P.turret, V.paint, [cx, H, cz], [cx, H + 0.2, cz], 0.38, 0.35, 10); hatch(B, P.turret, cx, H + 0.2, cz, 0.28); mg(B, P.turret, cx + 0.2, H + 0.4, cz, 1.2, d.hmg ? 0.03 : 0.022); tPiv = [cx, H, cz]; gunPiv = [cx + 0.2, H + 0.4, cz]; muzzle = [cx + 1.4, H + 0.4, cz]; cmd = [cx, H + 0.2, cz]; }
  ant(B, P.hull, -hl + 0.3, H, w * 0.8); flags(B, P.hull, -hl + 0.3, -hl + 0.75, top + 0.15, top + 0.4, w + 0.003);
  B.piv = { turret: tPiv, gun: gunPiv || tPiv, door: d.ramp !== false ? [-hl - 0.03, 0.45, 0, 0] : [-hl - 0.03, 0, w * 0.55, 1] };
  return B.build({ muzzle: muzzle || [hl, H, 0], cmd, len: d.L, wid: d.W, hgt: H + (T ? T.h : 0.4), deck: H, eng: [d.engRear ? -hl + 1 : hl - 0.9, H, d.engRear ? 0 : -w * 0.4], tracked: true, turret: !!(T || d.rws || d.cupola !== false), ramp: d.ramp !== false, doors: d.ramp === false ? 2 : 0, recoil: T && T.gun === 'mgs' ? 0.35 : 0.05 });
}

// ===================== WHEELED ARMOURED VEHICLES =====================
// d: L, W, H, axles [x...], r, belly, nose: 'boat'|'wedge'|'slab', noseLen, turret (as ifvT), rws [x, z, big], cupola, ramp, cab (windows at the front), slope (tumblehome)
export function wheeled(d) {
  const B = new VB(), hl = d.L / 2, w = d.W / 2, H = d.H, nl = d.noseLen ?? 1.0, yb = d.belly ?? 0.5, wy = d.waist ?? yb + 0.7, tum = d.slope ?? 0.88;
  const nose = d.nose || 'wedge';
  const secs = nose === 'boat' ? [[hl, sec(wy - 0.05, w * 0.4, wy + 0.1, w * 0.55, wy + 0.25, w * 0.5, 0.03)], [hl - nl * 0.5, sec(yb + 0.05, w * 0.75, wy, w, H - 0.25, w * tum, 0.04)], [hl - nl, sec(yb, w * 0.8, wy, w, H, w * tum)]]
    : nose === 'slab' ? [[hl, sec(yb + 0.1, w * 0.85, wy, w * 0.98, H - 0.35, w * tum, 0.04)], [hl - nl * 0.4, sec(yb, w * 0.85, wy, w, H, w * tum)]]
    : [[hl, sec(wy - 0.25, w * 0.7, wy - 0.1, w * 0.9, wy + 0.05, w * 0.85, 0.03)], [hl - 0.3, sec(yb + 0.05, w * 0.8, wy, w, wy + 0.4, w * 0.95, 0.04)], [hl - nl, sec(yb, w * 0.85, wy, w, H, w * tum)]];
  secs.push([-hl + 0.15, sec(yb, w * 0.85, wy, w, H, w * tum)], [-hl, sec(yb + 0.08, w * 0.8, wy, w * 0.97, H - 0.08, w * tum - 0.02)]);
  hull(B, P.hull, V.paint, secs);
  wheels(B, d.axles, d.r, d.r * 0.75, w - d.r * 0.38 + (d.wheelOut ?? 0));
  for (const s of [1, -1]) {
    light(B, hl - 0.05, wy, (w - 0.25) * s);
    if (d.cab) win(B, [[hl - nl + 0.02, H - 0.35, (w * tum - 0.1) * s], [hl - nl + 0.02, H - 0.35, 0.1 * s], [hl - nl + 0.3, H - 0.6, 0.1 * s], [hl - nl + 0.3, H - 0.6, (w * tum - 0.1) * s]]);
    if (d.vision !== false) win(B, [[hl - nl - 0.2, wy + 0.25, (w + 0.005) * s], [hl - nl - 0.6, wy + 0.25, (w + 0.005) * s], [hl - nl - 0.6, wy + 0.45, (w * 0.97) * s], [hl - nl - 0.2, wy + 0.45, (w * 0.97) * s]]);
    if (d.slat) for (let x = -hl + 0.2; x < hl - nl; x += 0.25) B.cbox(P.hull, V.metal, x, x + 0.03, wy, H - 0.1, s > 0 ? w + 0.12 : -w - 0.14, s > 0 ? w + 0.14 : -w - 0.12, 0.004);
  }
  hatch(B, P.hull, hl - nl + 0.2, H, d.driverZ ?? (w * 0.4), 0.25);
  if (d.ramp !== false) B.cbox(P.door, V.paint, -hl - 0.06, -hl, yb + 0.05, H - 0.15, -w * 0.6, w * 0.6, 0.02); else { B.cbox(P.door, V.paint, -hl - 0.06, -hl, yb + 0.1, H - 0.1, 0.02, w * 0.6, 0.015); B.cbox(P.doorR, V.paint, -hl - 0.06, -hl, yb + 0.1, H - 0.1, -w * 0.6, -0.02, 0.015); }
  if (d.sideDoor) B.extrude(P.hull, V.paint, [[d.sideDoor - 0.4, wy], [d.sideDoor + 0.4, wy], [d.sideDoor + 0.4, H - 0.15], [d.sideDoor - 0.4, H - 0.15]], w - 0.02, w + 0.02, 0.01);
  if (d.firing) for (const s of [1, -1]) for (let i = 0; i < d.firing; i++) B.cbox(P.hull, V.metal, -hl + 0.8 + i * 0.7, -hl + 0.95 + i * 0.7, wy + 0.3, wy + 0.42, s > 0 ? w * tum : -w * tum - 0.04, s > 0 ? w * tum + 0.04 : -w * tum, 0.005);
  // weapon
  const T = d.turret; let muzzle = null, gunPiv = null, cmd = [0, H, 0], tPiv = [0, H, 0];
  if (T) {
    const tx = T.x ?? 0, tw = T.w, tl = T.l, th = T.h; tPiv = [tx, H, 0];
    const shape = T.shape === 'cast' ? (x, a, b) => dome(H, tw * a, H + th, tw * b) : (x, a, b) => tt(H, tw * a, H + th, tw * b);
    hull(B, P.turret, V.paint, [[tx + tl * 0.55, T.shape === 'cast' ? dome(H, tw * 0.5, H + th - 0.1, tw * 0.35) : tt(H, tw * 0.55, H + th - 0.08, tw * 0.45)], [tx + tl * 0.3, shape(0, 1, 0.85)], [tx - tl * 0.45, shape(0, 1, 0.85)], [tx - tl * 0.55, T.shape === 'cast' ? dome(H + 0.05, tw * 0.8, H + th - 0.08, tw * 0.5) : tt(H + 0.05, tw * 0.8, H + th - 0.05, tw * 0.7)]]);
    cmd = [tx - 0.15, H + th, tw * 0.45]; hatch(B, P.turret, cmd[0], cmd[1], cmd[2], 0.27);
    for (const s of [1, -1]) smoke(B, P.turret, tx + tl * 0.05, tx + tl * 0.3, 3, H + th * 0.5, tw, s, 0.15);
    const gy = H + th * 0.5, gx = tx + tl * 0.55; gunPiv = [gx, gy, 0];
    if (T.gun === 'mgs' || T.gun === 'big') { B.cbox(P.gun, V.paint, gx - 0.15, gx + 0.3, gy - 0.18, gy + 0.18, -0.25, 0.25, 0.03); B.tube(P.gun, V.paint, [gx + 0.2, gy, 0], [gx + (T.L || 4.5), gy, 0], T.r || 0.1, (T.r || 0.1) * 0.8, 10); if (T.ev) B.tube(P.gun, V.paint, [gx + (T.L || 4.5) * T.ev, gy, 0], [gx + (T.L || 4.5) * T.ev + 0.4, gy, 0], (T.r || 0.1) * 1.4, (T.r || 0.1) * 1.4, 10); if (T.brake) B.cbox(P.gun, V.metal, gx + (T.L || 4.5) - 0.25, gx + (T.L || 4.5), gy - 0.12, gy + 0.12, -0.15, 0.15, 0.02); muzzle = [gx + (T.L || 4.5), gy, 0]; }
    else if (T.gun === 'hmg') { mg(B, P.gun, gx, gy, 0, 1.4, 0.03); mg(B, P.gun, gx, gy - 0.05, -0.2, 0.6); muzzle = [gx + 1.4, gy, 0]; }
    else { const gL = T.gun === '30' ? 2.4 : T.gun === '40' ? 2.3 : 2.1, gr = T.gun === '40' ? 0.07 : 0.045; B.cbox(P.gun, V.paint, gx - 0.1, gx + 0.25, gy - 0.12, gy + 0.12, -0.18, 0.18, 0.03); B.tube(P.gun, V.metal, [gx + 0.2, gy, 0], [gx + gL, gy, 0], gr, gr * 0.85, 8); muzzle = [gx + gL, gy, 0]; if (T.atgm) B.cbox(P.turret, V.paint, tx - 0.3, tx + 0.5, gy - 0.1, gy + 0.2, tw + 0.02, tw + 0.32, 0.03); }
  } else if (d.rws) { const rx = d.rws[0], rz = d.rws[1]; rws(B, P.turret, rx, H, rz, d.rws[2]); tPiv = [rx, H, rz]; gunPiv = [rx + 0.05, H + 0.32, rz - 0.28]; muzzle = [rx + 1.1, H + 0.32, rz - 0.28]; cmd = [rx, H + 0.2, rz]; }
  else if (d.cupola !== false) { const cz = d.cupZ ?? 0, cx = d.cupX ?? 0; B.tube(P.turret, V.paint, [cx, H, cz], [cx, H + 0.15, cz], 0.42, 0.42, 12); mg(B, P.turret, cx + 0.1, H + 0.35, cz, 1.3, d.hmg ? 0.03 : 0.022); B.cbox(P.turret, V.paint, cx + 0.3, cx + 0.35, H + 0.15, H + 0.5, cz - 0.3, cz + 0.3, 0.01); tPiv = [cx, H, cz]; gunPiv = [cx + 0.1, H + 0.35, cz]; muzzle = [cx + 1.4, H + 0.35, cz]; cmd = [cx, H + 0.15, cz]; }
  ant(B, P.hull, -hl + 0.3, H, w * 0.8); flags(B, P.hull, -hl + 0.3, -hl + 0.75, wy + 0.15, wy + 0.4, w + 0.003);
  B.piv = { turret: tPiv, gun: gunPiv || tPiv, door: d.ramp !== false ? [-hl - 0.03, yb + 0.05, 0, 0] : [-hl - 0.03, 0, w * 0.6, 1] };
  return B.build({ muzzle: muzzle || [hl, H, 0], cmd, len: d.L, wid: d.W, hgt: H + (T ? T.h : 0.5), deck: H, eng: [d.engRear ? -hl + 1 : hl - 0.9, H - 0.2, d.engRear ? 0 : -w * 0.4], turret: !!(T || d.rws || d.cupola !== false), ramp: d.ramp !== false, doors: d.ramp === false ? 2 : 0, recoil: T && (T.gun === 'mgs' || T.gun === 'big') ? 0.35 : 0.04 });
}

// ===================== PROTECTED 4x4 (MRAP, patrol) =====================
// d: L, W, H, bonnet (length of the engine hood, 0 = cab-over), belly, axles, r, vee, rws [x, z, big] | ring [x, z], bed (open rear bed length), rearDoor
export function p4x4(d) {
  const B = new VB(), hl = d.L / 2, w = d.W / 2, H = d.H, bn = d.bonnet ?? 1.2, yb = d.belly ?? 0.6, hy = d.hoodY ?? yb + 0.75, wy = yb + 0.55, tum = d.slope ?? 0.9;
  const xw = hl - bn; // windscreen base
  if (bn > 0.3) hull(B, P.hull, V.paint, [[hl, sec(yb + 0.05, w * 0.8, yb + 0.35, w * 0.86, hy - 0.05, w * 0.78, 0.04)], [xw + 0.05, sec(yb, w * 0.85, wy, w * 0.92, hy, w * 0.84, 0.04)]]);
  const back = d.bed ? xw - (d.cabLen ?? 1.6) : -hl;
  hull(B, P.hull, V.paint, [[xw + (bn > 0.3 ? 0 : 0.25), sec(yb, w * 0.85, wy, w, bn > 0.3 ? hy : H - 0.45, w * tum, 0.04)], [xw - 0.55, sec(yb, w * 0.85, wy, w, H, w * tum)], [back + 0.1, sec(yb, w * 0.85, wy, w, H, w * tum)], [back, sec(yb + 0.05, w * 0.82, wy, w * 0.98, H - 0.06, w * tum - 0.02)]]);
  if (d.bed) { B.cbox(P.hull, V.paint, -hl, back, yb, wy + 0.25, -w, w, 0.03); B.cbox(P.hull, V.black, -hl + 0.05, back - 0.05, wy + 0.25, wy + 0.27, -w + 0.06, w - 0.06, 0.01); }
  win(B, [[xw + 0.01, (bn > 0.3 ? hy : wy + 0.2) + 0.1, w * tum - 0.12], [xw + 0.01, (bn > 0.3 ? hy : wy + 0.2) + 0.1, -w * tum + 0.12], [xw - 0.5, H - 0.1, -w * tum + 0.15], [xw - 0.5, H - 0.1, w * tum - 0.15]]);
  for (const s of [1, -1]) { light(B, hl - 0.02, bn > 0.3 ? hy - 0.2 : wy, (w - 0.2) * s, 0.12); win(B, [[xw - 0.5, wy + 0.4, (w * (tum + 1) / 2 + 0.005) * s], [xw - 0.5, H - 0.15, (w * tum + 0.005) * s], [xw - 1.2, H - 0.15, (w * tum + 0.005) * s], [xw - 1.2, wy + 0.4, (w * (tum + 1) / 2 + 0.005) * s]]); if (!d.bed && d.rearWin !== false) win(B, [[xw - 1.4, wy + 0.4, (w * (tum + 1) / 2 + 0.005) * s], [xw - 1.4, H - 0.15, (w * tum + 0.005) * s], [xw - 2.0, H - 0.15, (w * tum + 0.005) * s], [xw - 2.0, wy + 0.4, (w * (tum + 1) / 2 + 0.005) * s]]); }
  if (d.vee) B.extrude(P.hull, V.paint, [[hl - 0.4, yb], [-hl + 0.3, yb], [-hl + 0.3, yb - 0.2]], -w * 0.6, w * 0.6, 0.02);
  B.cbox(P.hull, V.black, hl - 0.05, hl + 0.1, yb - 0.1, yb + 0.15, -w, w, 0.02);
  wheels(B, d.axles, d.r, d.r * 0.7, w - d.r * 0.35);
  if (!d.bed) B.cbox(P.door, V.paint, -hl - 0.05, -hl, yb + 0.1, H - 0.1, -w * 0.55, w * 0.55, 0.015);
  let tPiv = [0, H, 0], gunPiv = null, muzzle = null, cmd = [xw - 1.0, H, 0];
  const ry = d.bed && d.ringOnBed ? wy + 0.27 : H;
  if (d.rws) { const [rx, rz, big] = d.rws; rws(B, P.turret, rx, ry, rz, big); tPiv = [rx, ry, rz]; gunPiv = [rx + 0.05, ry + 0.32, rz - 0.28]; muzzle = [rx + 1.1, ry + 0.32, rz - 0.28]; cmd = [rx, ry + 0.2, rz]; }
  else if (d.ring) { const [rx, rz] = d.ring; B.tube(P.turret, V.paint, [rx, ry, rz], [rx, ry + 0.12, rz], 0.4, 0.4, 12); mg(B, P.turret, rx + 0.1, ry + 0.35, rz, d.hmg ? 1.4 : 1.0, d.hmg ? 0.03 : 0.022); if (d.shield !== false) B.cbox(P.turret, V.paint, rx + 0.3, rx + 0.35, ry + 0.12, ry + 0.5, rz - 0.32, rz + 0.32, 0.01); tPiv = [rx, ry, rz]; gunPiv = [rx + 0.1, ry + 0.35, rz]; muzzle = [rx + 1.3, ry + 0.35, rz]; cmd = [rx, ry + 0.12, rz]; }
  if (d.turret) { const T = d.turret, tx = T.x ?? 0; hull(B, P.turret, V.paint, [[tx + T.l * 0.5, dome(H, T.w * 0.6, H + T.h - 0.05, T.w * 0.4)], [tx, dome(H, T.w, H + T.h, T.w * 0.7)], [tx - T.l * 0.5, dome(H, T.w * 0.8, H + T.h - 0.05, T.w * 0.5)]]); const gy = H + T.h * 0.5, gx = tx + T.l * 0.5; tPiv = [tx, H, 0]; gunPiv = [gx, gy, 0];
    if (T.gun === 'big') { B.tube(P.gun, V.paint, [gx, gy, 0], [gx + (T.L || 3), gy, 0], 0.08, 0.07, 10); B.cbox(P.gun, V.metal, gx + (T.L || 3) - 0.25, gx + (T.L || 3), gy - 0.1, gy + 0.1, -0.12, 0.12, 0.02); muzzle = [gx + (T.L || 3), gy, 0]; } else { mg(B, P.gun, gx, gy, 0, 1.2, 0.03); muzzle = [gx + 1.2, gy, 0]; } cmd = [tx, H + T.h, 0]; }
  ant(B, P.hull, -hl + 0.3, H, w * 0.7); flags(B, P.hull, xw - 0.45, xw - 0.15, wy - 0.05, wy + 0.15, w + 0.003);
  B.piv = { turret: tPiv, gun: gunPiv || tPiv, door: [-hl - 0.03, yb + 0.1, 0, 0] };
  return B.build({ muzzle: muzzle || [hl, H, 0], cmd, cmdHull: !d.turret, len: d.L, wid: d.W, hgt: H + 0.5, deck: H, eng: [hl - bn * 0.5, hy, 0], turret: !!(d.rws || d.ring || d.turret), recoil: d.turret?.gun === 'big' ? 0.2 : 0.03 });
}
// soft-skinned 4x4: d = [length, wheelbase, width, roof, soft top, wheel r, spare]
export function soft(d) { const [L, wb, W, roof, softTop, r, ring] = d, B = new VB(), hl = L / 2, w = W / 2;
  box4x4(B, hl, hl - L * 0.28, -hl, 0.55, 1.12, roof, w, { soft: softTop, spare: r * 0.95, wins: softTop ? [[hl - L * 0.3, hl - L * 0.45]] : [[hl - L * 0.3, hl - L * 0.47], [hl - L * 0.52, hl - L * 0.7]] });
  wheels(B, [wb / 2 + 0.1, -wb / 2 + 0.1], r, r * 0.65, w - r * 0.3);
  ant(B, P.hull, -hl + 0.2, roof, w * 0.8); flags(B, P.hull, hl - L * 0.24, hl - L * 0.17, 0.75, 0.95, w + 0.005);
  if (ring) { B.tube(P.turret, V.paint, [-0.2, roof, 0], [-0.2, roof + 0.1, 0], 0.35, 0.35, 10); mg(B, P.turret, -0.1, roof + 0.3, 0, 1.0); B.piv = { turret: [-0.2, roof, 0], gun: [-0.1, roof + 0.3, 0] }; return B.build({ muzzle: [0.9, roof + 0.3, 0], cmd: [-0.2, roof + 0.1, 0], cmdHull: true, len: L, wid: W, hgt: roof, deck: roof, eng: [hl - 0.6, 1.12, 0], turret: true, recoil: 0.03 }); }
  return B.build({ len: L, wid: W, hgt: roof, deck: roof, eng: [hl - 0.6, 1.12, 0] });
}

// ===================== TRUCKS =====================
// d: { L, W, cab: 'over'|'bonnet', axles [x...], r, bedH, soft }
export function truck(d) {
  const B = new VB(), hl = d.L / 2, w = d.W / 2, r = d.r;
  chassis(B, hl - 0.3, -hl + 0.1, r + 0.15, 0.45);
  let cabBack;
  if (d.cab === 'bonnet') { const xw = hl - (d.hood ?? 1.5); cabBack = xw - 1.4; bonnet(B, hl, xw, cabBack, r + 0.5, r + 1.2, r + 2.1, w, w * 0.95, { soft: d.softCab }); }
  else { cabBack = hl - 1.6; cabOver(B, hl, cabBack, r + 0.5, r + 2.15, w); }
  cargo(B, cabBack - 0.15, -hl, r + 0.6, w, d.bedH ?? 1.7);
  wheels(B, d.axles, r, r * 0.7, w - r * 0.4);
  flags(B, P.hull, cabBack + 0.25, cabBack + 0.6, r + 0.7, r + 0.9, w + 0.005);
  return B.build({ len: d.L, wid: d.W, hgt: r + 2.3, deck: r + 2.15, eng: [hl - 0.7, r + 1.0, 0], truck: true });
}

// ===================== HELICOPTERS =====================
// transport / utility: { L (fuselage), st stations, rot [x, y, r, n, chord], tr [x, y, z, r, n] | fen [x, y, r, n], boom [x0, x1, y0, y1, r0, r1], fin, stab, gear wheels | skids, eng [x0, x1, y], door [x0, x1], sponson [x0, x1, y, z], len, hgt, wings }
export function heliT(d) {
  const B = new VB();
  fuselage(B, d.st, { segs: d.segs ?? 2, side: d.side, low: d.low });
  if (d.eng) { const [x0, x1, y, wE] = d.eng; B.loft(P.hull, V.paint, [{ w: x0, ring: ring(y, 0.3, (wE || 0.8) * 0.8, 10) }, { w: x0 - 0.5, ring: ring(y + 0.05, 0.42, wE || 0.8, 10) }, { w: x1 + 0.4, ring: ring(y + 0.05, 0.42, wE || 0.8, 10) }, { w: x1, ring: ring(y - 0.05, 0.28, (wE || 0.8) * 0.6, 10) }]); }
  if (d.boom) { const [x0, x1, y0, y1, r0, r1] = d.boom; B.tube(P.hull, V.paint, [x0, y0, 0], [x1, y1, 0], r0, r1, 12); }
  if (d.fin) fin(B, d.fin, d.finT ?? 0.18);
  if (d.stab) B.cbox(P.hull, V.paint, d.stab[0] - 0.5, d.stab[0], d.stab[1], d.stab[1] + 0.08, -d.stab[2], d.stab[2], 0.02);
  if (d.tr) tailRotor(B, ...d.tr); if (d.fen) fenestron(B, ...d.fen);
  for (const s of [1, -1]) {
    if (d.sponson) { const [x0, x1, y, z] = d.sponson; B.loft(P.hull, V.paint, [{ w: x0, ring: ring(y, 0.3, 0.25, 8) }, { w: x0 - 0.4, ring: ring(y, 0.42, 0.42, 8) }, { w: x1, ring: ring(y, 0.35, 0.35, 8) }].map(r => ({ w: r.w, ring: r.ring.map(([yy, zz]) => [yy, zz + s * z]) }))); }
    if (d.door) { const [x0, x1, y0, y1, z] = d.door; B.plate(P.hull, V.trim, [[x0, y0, s * z], [x1, y0, s * z], [x1, y1, s * z], [x0, y1, s * z]], 0.012); }
    if (d.wings) { const [x0, x1, y, span] = d.wings; B.extrude(P.hull, V.paint, [[x0, y], [x1, y], [x1 - 0.1, y + 0.1], [x0 - 0.05, y + 0.12]], s > 0 ? 0.5 : -span, s > 0 ? span : -0.5, 0.02); for (const z of d.pods || []) B.tube(P.hull, V.paint, [x0 + 0.4, y - 0.3, s * z], [x1 - 0.4, y - 0.3, s * z], 0.18, 0.18, 8); }
    if (d.fuel) B.tube(P.hull, V.paint, [d.fuel[0], d.fuel[2], s * d.fuel[3]], [d.fuel[1], d.fuel[2], s * d.fuel[3]], 0.32, 0.32, 10);
  }
  if (d.skids) skids(B, ...d.skids); if (d.gear) wheelGear(B, d.gear, 0, d.wheelR || 0.32);
  if (d.chin) { const [x, y] = d.chin; B.tube(P.hull, V.metal, [x, y + 0.2, 0], [x, y, 0], 0.17, 0.17, 8); B.tube(P.hull, V.metal, [x, y, 0], [x + 1.6, y, 0], 0.035, 0.03, 6); }
  if (d.radar) B.tube(P.hull, V.paint, [d.rot[0], d.rot[1] + 0.2, 0], [d.rot[0], d.rot[1] + 0.75, 0], 0.45, 0.45, 12); // mast-mounted radar
  if (d.probe) B.tube(P.hull, V.metal, d.probe[0], d.probe[1], 0.05, 0.04, 6);
  const [rx, ry, rr, rn, rc] = d.rot; mast(B, rx, ry - 0.6, ry); rotorP(B, P.rotor, rx, ry, rr, rn, rc);
  B.piv = B.piv || {}; B.piv.rotor = [rx, ry, 0];
  if (d.rot2) { const [ax, ay, ar, an, ac] = d.rot2; mast(B, ax, ay - (d.coax ? 1.0 : 0.6), ay); rotorP(B, P.rotor2, ax, ay, ar, an, ac, Math.PI / an); B.piv.rotor2 = [ax, ay, 0]; }
  if (d.flag) flagH(B, ...d.flag);
  return B.build({ len: d.len, hgt: d.hgt, heli: true, cabin: !!d.cabin });
}

// ===================== THE CATALOGUE OF MODELS =====================
const H = (d) => () => heliT(d), M = d => () => mbt(d), I = d => () => ifvT(d), W = d => () => wheeled(d), R = d => () => p4x4(d), F = d => () => soft(d), T = d => () => truck(d);
export const NAT = {
  // ---------- United States ----------
  abrams: M({ L: 7.93, W: 3.66, deck: 1.62, nose: 1.4, wh: [7, 0.32], tw: 0.64, turret: { x: -0.1, f: 2.2, b: 2.7, w: 1.75, y1: 2.4, shape: 'faceted', bustle: true }, gun: { L: 5.3, r: 0.12, ev: 0.45 }, cupola: 'rws', hmg: true }),
  bradley: I({ L: 6.55, W: 3.6, H: 2.0, glacis: 1.6, noseY: 0.95, wh: [6, 0.3], tw: 0.53, skirt: true, rollers: [1.4, 0.0, -1.4], turret: { x: 0.0, w: 1.0, l: 1.9, h: 0.75, gun: '25', atgm: true }, engRear: false }),
  stryker: W({ L: 6.95, W: 2.72, H: 2.3, axles: [2.2, 0.95, -0.95, -2.2], r: 0.57, nose: 'wedge', noseLen: 1.5, rws: [0.4, 0.0, true], slope: 0.86 }),
  hmmwv: R({ L: 4.57, W: 2.16, H: 1.85, bonnet: 1.55, belly: 0.55, hoodY: 1.25, axles: [1.55, -1.75], r: 0.45, slope: 0.92, ring: [-0.4, 0], hmg: true }),
  jltv: R({ L: 6.2, W: 2.5, H: 2.6, bonnet: 1.7, belly: 0.7, hoodY: 1.55, axles: [1.9, -1.45], r: 0.55, vee: true, rws: [-0.6, 0, false] }),
  maxxpro: R({ L: 6.4, W: 2.6, H: 3.05, bonnet: 1.4, belly: 0.9, hoodY: 1.9, axles: [2.0, -1.9], r: 0.6, vee: true, slope: 0.82, rws: [-0.6, 0, true] }),
  fmtv: T({ L: 7.0, W: 2.44, cab: 'over', axles: [2.3, -1.6], r: 0.57 }),
  uh60: H({ st: [[6.8, 1.45, 0.3, 0.3], [6.2, 1.55, 0.8, 0.75], [5.3, 1.65, 1.0, 0.95], [2.8, 1.7, 1.05, 1.05], [0.2, 1.75, 1.0, 1.0], [-1.0, 2.0, 0.7, 0.6]], side: [5.3, 2.8], eng: [1.8, -0.8, 2.95, 0.75], boom: [-1.0, -8.2, 2.1, 2.5, 0.5, 0.25], fin: [[-7.4, 2.2], [-8.5, 2.6], [-9.0, 4.3], [-8.4, 4.3]], stab: [-8.0, 2.3, 2.2], tr: [-8.6, 3.7, 0.3, 1.7, 4], door: [3.0, 1.2, 0.9, 2.5, 1.05], gear: [[4.7, 1.2], [4.7, -1.2], [-7.6, 0]], rot: [0.6, 3.6, 8.2, 4, 0.53], flag: [-4.0, -3.4, 2.25, 2.5, 0.38], len: 15.3, hgt: 4.1, cabin: true }),
  ch47: H({ st: [[7.6, 1.6, 0.4, 0.4], [7.0, 1.75, 1.0, 0.95], [6.0, 1.95, 1.3, 1.25], [-4.5, 1.95, 1.3, 1.25], [-6.4, 2.6, 0.8, 0.9]], side: [6.0, 4.0], segs: 2, eng: [-4.4, -6.6, 3.0, 0.5], sponson: [5.0, -4.4, 0.75, 1.3], fin: [[-5.2, 3.0], [-7.0, 3.0], [-7.3, 5.3], [-6.2, 5.3]], finT: 0.9, gear: [[4.7, 1.2], [4.7, -1.2], [-4.8, 1.2], [-4.8, -1.2]], rot: [6.3, 4.3, 9.1, 3, 0.65], rot2: [-6.3, 5.6, 9.1, 3, 0.65], flag: [-2.5, -1.8, 2.6, 2.9, 1.27], len: 15.9, hgt: 5.7, cabin: true }),
  ah64: H({ st: [[6.6, 1.55, 0.25, 0.2], [6.0, 1.65, 0.55, 0.45], [5.0, 1.8, 0.75, 0.5], [3.6, 2.0, 0.9, 0.55], [2.0, 2.05, 0.95, 0.65], [0.2, 2.1, 0.9, 0.62], [-1.6, 2.2, 0.55, 0.4]], segs: 4, eng: [1.5, -0.8, 2.6, 1.15], boom: [-1.6, -8.6, 2.25, 2.55, 0.42, 0.2], fin: [[-7.8, 2.3], [-9.0, 2.3], [-9.4, 4.1], [-8.8, 4.1]], stab: [-8.6, 2.5, 1.7], tr: [-9.1, 3.5, -0.3, 1.4, 4], wings: [1.2, -0.2, 1.85, 2.4], pods: [1.25, 2.05], chin: [5.2, 0.9], gear: [[3.2, 1.0], [3.2, -1.0], [-8.4, 0]], rot: [0.4, 3.95, 7.3, 4, 0.53], radar: true, flag: [-4.2, -3.6, 2.3, 2.55, 0.33], len: 17.7, hgt: 4.7 }),
  // ---------- United Kingdom ----------
  challenger2: M({ L: 8.33, W: 3.52, deck: 1.6, nose: 1.0, wh: [6, 0.35], tw: 0.62, turret: { x: 0.0, f: 2.3, b: 2.6, w: 1.7, y1: 2.45, shape: 'faceted', bustle: true }, gun: { L: 6.0, r: 0.12, ev: 0.35, sleeve: true }, rearUp: 0.05 }),
  warrior: I({ L: 6.34, W: 3.03, H: 1.95, glacis: 1.2, noseY: 0.9, wh: [6, 0.32], tw: 0.46, turret: { x: 0.1, w: 0.95, l: 1.7, h: 0.7, gun: '30' }, ramp: false }),
  fv432: I({ L: 5.25, W: 2.8, H: 1.88, glacis: 1.1, noseY: 1.0, wh: [5, 0.31], tw: 0.36, ramp: false, cupZ: 0.6, cupX: 0.9 }),
  boxer: W({ L: 7.93, W: 2.99, H: 2.37, axles: [2.65, 1.25, -1.15, -2.55], r: 0.62, nose: 'wedge', noseLen: 1.7, rws: [0.3, 0.3, true], slope: 0.84 }),
  foxhound: R({ L: 5.32, W: 2.1, H: 2.35, bonnet: 1.0, belly: 0.6, hoodY: 1.35, axles: [1.65, -1.6], r: 0.5, vee: true, slope: 0.86, ring: [-0.7, 0] }),
  jackal: R({ L: 5.39, W: 2.0, H: 1.75, bonnet: 1.4, belly: 0.65, hoodY: 1.3, axles: [1.75, -1.65], r: 0.5, bed: true, cabLen: 1.1, ring: [-1.2, 0], ringOnBed: true, hmg: true, shield: false }),
  mansv: T({ L: 7.5, W: 2.5, cab: 'over', axles: [2.5, -1.7], r: 0.58, bedH: 1.8 }),
  wildcat: H({ st: [[4.8, 1.3, 0.25, 0.2], [4.3, 1.4, 0.7, 0.6], [3.2, 1.5, 0.95, 0.85], [1.0, 1.6, 0.95, 0.85], [-0.4, 1.8, 0.65, 0.55]], side: [3.2, 1.0], eng: [1.2, -0.6, 2.65, 0.65], boom: [-0.4, -7.2, 1.95, 2.3, 0.42, 0.2], fin: [[-6.6, 2.0], [-7.6, 2.4], [-7.9, 3.9], [-7.3, 3.9]], stab: [-6.9, 3.6, 1.0], tr: [-7.5, 3.3, -0.3, 1.2, 4], gear: [[3.4, 1.0], [3.4, -1.0], [-1.0, 1.25], [-1.0, -1.25]], rot: [0.4, 3.2, 6.4, 4, 0.5], flag: [-3.0, -2.5, 2.0, 2.2, 0.32], len: 15.2, hgt: 3.7, cabin: true }),
  merlin: H({ st: [[8.6, 1.55, 0.35, 0.3], [8.0, 1.7, 1.0, 0.9], [7.0, 1.95, 1.35, 1.2], [-1.8, 2.0, 1.35, 1.2], [-3.2, 2.4, 0.9, 0.8]], side: [7.0, 3.0], eng: [3.6, -1.6, 3.6, 1.0], boom: [-3.2, -9.6, 2.5, 3.0, 0.6, 0.3], fin: [[-8.9, 2.6], [-10.4, 3.0], [-10.8, 5.1], [-10.0, 5.1]], stab: [-9.6, 4.6, 1.3], tr: [-10.4, 4.3, 0.3, 2.0, 4], sponson: [2.0, -1.6, 0.85, 1.35], door: [3.4, 1.6, 0.95, 2.9, 1.2], gear: [[6.8, 1.0], [6.8, -1.0], [0.4, 1.6], [0.4, -1.6]], rot: [1.0, 4.9, 9.3, 5, 0.6], flag: [-6.0, -5.2, 2.7, 3.0, 0.42], len: 22.8, hgt: 6.6, cabin: true }),
  // ---------- Germany ----------
  leo2a6: M({ L: 7.72, W: 3.75, deck: 1.6, nose: 1.15, wh: [7, 0.35], rollers: [2.3, 0.65, -1.0, -2.6], tw: 0.635, turret: { x: 0.25, f: 1.95, b: 2.75, w: 1.72, y1: 2.42, shape: 'wedge', bustle: true }, gun: { L: 6.55, r: 0.12, ev: 0.4 } }),
  leo1: M({ L: 7.09, W: 3.25, deck: 1.45, nose: 1.0, wh: [7, 0.34], tw: 0.55, rollers: [2.0, 0.4, -1.2], turret: { x: 0.0, f: 1.6, b: 2.2, w: 1.5, y1: 2.35, shape: 'cast', bustle: false }, gun: { L: 5.2, r: 0.1, ev: 0.55 } }),
  puma_ifv: I({ L: 7.6, W: 3.9, H: 2.0, glacis: 1.6, noseY: 1.05, wh: [6, 0.36], tw: 0.56, skirt: true, rws: null, turret: { x: 0.1, w: 1.0, l: 2.0, h: 0.55, gun: '30', atgm: true } }),
  marder: I({ L: 6.88, W: 3.38, H: 1.98, glacis: 1.5, noseY: 1.0, wh: [6, 0.33], tw: 0.45, rollers: [1.5, 0, -1.5], turret: { x: 0.2, w: 0.85, l: 1.6, h: 0.65, gun: '25' } }),
  fuchs: W({ L: 6.83, W: 2.98, H: 2.3, axles: [2.0, 0.55, -1.6], r: 0.56, nose: 'boat', noseLen: 1.9, cupola: true, cupX: 0.3, cupZ: 0.5, ramp: false, slope: 0.88, cab: true }),
  dingo: R({ L: 5.45, W: 2.39, H: 2.5, bonnet: 1.3, belly: 0.65, hoodY: 1.4, axles: [1.7, -1.8], r: 0.53, vee: true, rws: [-0.6, 0, false] }),
  gwagen: F([4.66, 2.85, 1.81, 2.0, false, 0.38, false]),
  ch53: H({ st: [[9.4, 1.55, 0.4, 0.35], [8.8, 1.75, 1.1, 1.0], [7.8, 2.05, 1.45, 1.35], [-3.5, 2.05, 1.45, 1.35], [-5.2, 2.6, 0.8, 0.75]], side: [7.8, 3.0], eng: [3.8, -1.2, 3.85, 1.25], boom: [-5.2, -10.8, 2.7, 3.3, 0.65, 0.3], fin: [[-10.2, 2.8], [-11.8, 3.3], [-12.4, 5.8], [-11.4, 5.8]], stab: [-11.3, 4.8, 1.6], tr: [-11.7, 5.0, -0.35, 2.4, 4], sponson: [3.5, -1.5, 0.95, 1.5], door: [5.5, 3.5, 0.95, 3.0, 1.37], gear: [[6.8, 1.1], [6.8, -1.1], [-0.2, 1.8], [-0.2, -1.8]], probe: [[8.8, 1.9, 0.9], [11.0, 1.9, 0.9]], rot: [0.8, 5.0, 11.0, 6, 0.75], flag: [-7.0, -6.2, 2.9, 3.2, 0.5], len: 26.9, hgt: 7.6, cabin: true }),
  h145: H({ st: [[3.9, 1.3, 0.25, 0.25], [3.5, 1.35, 0.75, 0.65], [2.4, 1.45, 0.98, 0.82], [0.2, 1.55, 0.98, 0.82], [-1.3, 1.7, 0.85, 0.75], [-1.9, 1.9, 0.5, 0.45]], side: [2.4, 0.2], eng: [0.7, -1.6, 2.55, 0.6], boom: [-1.9, 2.0, 1.95, 2.15, 0.35, 0.16].map((v, i) => i === 1 ? -6.0 : v), fin: [[-5.4, 1.8], [-6.4, 1.75], [-6.7, 3.3], [-6.2, 3.3], [-5.8, 2.2]], finT: 0.14, fen: [-6.1, 2.1, 0.38, 10], stab: [-5.1, 2.05, 0.9], skids: [2.2, -1.5, 1.05], rot: [0.1, 3.3, 5.5, 4, 0.32], flag: [-3.2, -2.7, 1.95, 2.15, 0.27], len: 11.6, hgt: 3.95, cabin: true }),
  // ---------- Russia and the ex-Soviet bloc ----------
  t72: M({ L: 6.95, W: 3.59, deck: 1.5, nose: 1.6, wh: [6, 0.38], tw: 0.58, idlerFront: true, skirt: true, turret: { x: -0.2, f: 1.35, b: 1.55, w: 1.45, y1: 2.2, shape: 'cast' }, gun: { L: 6.1, r: 0.1, ev: 0.5 }, era: true, hmg: true }),
  t90: M({ L: 6.86, W: 3.78, deck: 1.5, nose: 1.6, wh: [6, 0.38], tw: 0.58, skirt: true, turret: { x: -0.2, f: 1.5, b: 1.95, w: 1.6, y1: 2.25, shape: 'wedge', bustle: true }, gun: { L: 6.1, r: 0.1, ev: 0.5 }, era: true, cupola: 'rws' }),
  t55: M({ L: 6.45, W: 3.27, deck: 1.45, nose: 1.5, wh: [5, 0.42], tw: 0.58, skirt: false, turret: { x: 0.3, f: 1.25, b: 1.3, w: 1.35, y1: 2.35, shape: 'cast' }, gun: { L: 5.3, r: 0.09, ev: 0.85 }, hmg: true }),
  bmp1: I({ L: 6.74, W: 2.94, H: 1.6, glacis: 2.2, noseY: 0.6, wh: [6, 0.36], tw: 0.3, rollers: [1.2, 0.0, -1.2], turret: { x: -0.1, w: 0.85, l: 1.5, h: 0.55, gun: '73' }, ramp: false, engRear: false }),
  bmp2: I({ L: 6.72, W: 3.15, H: 1.65, glacis: 2.2, noseY: 0.6, wh: [6, 0.36], tw: 0.3, rollers: [1.2, 0.0, -1.2], turret: { x: -0.1, w: 0.9, l: 1.6, h: 0.65, gun: '30', atgm: true }, ramp: false }),
  bmp3: I({ L: 7.14, W: 3.15, H: 1.75, glacis: 2.0, noseY: 0.7, wh: [6, 0.36], tw: 0.38, turret: { x: 0.3, w: 1.0, l: 1.8, h: 0.6, gun: 'bmp3' }, ramp: false }),
  mtlb: I({ L: 6.45, W: 2.86, H: 1.6, glacis: 1.0, noseY: 0.85, wh: [6, 0.31], tw: 0.35, ramp: false, cupola: true, cupX: 1.8, cupZ: 0.6, tumble: 1.0 }),
  btr82: W({ L: 7.65, W: 2.9, H: 2.0, axles: [2.6, 1.15, -0.65, -2.1], r: 0.57, nose: 'boat', noseLen: 1.9, belly: 0.5, waist: 1.2, slope: 0.82, turret: { x: 0.4, w: 0.55, l: 1.1, h: 0.55, gun: '30', shape: 'cast' }, ramp: false, sideDoor: 0.0 }),
  btr80: W({ L: 7.55, W: 2.9, H: 2.0, axles: [2.6, 1.15, -0.65, -2.1], r: 0.57, nose: 'boat', noseLen: 1.9, belly: 0.5, waist: 1.2, slope: 0.82, turret: { x: 0.4, w: 0.5, l: 1.0, h: 0.5, gun: 'hmg', shape: 'cast' }, ramp: false, sideDoor: 0.0 }),
  brdm2: W({ L: 5.75, W: 2.35, H: 1.85, axles: [1.6, -1.25], r: 0.6, nose: 'boat', noseLen: 1.5, belly: 0.45, waist: 1.1, slope: 0.8, turret: { x: -0.1, w: 0.48, l: 0.95, h: 0.5, gun: 'hmg', shape: 'cast' }, ramp: false, vision: false, cab: true }),
  tigr: R({ L: 5.7, W: 2.4, H: 2.4, bonnet: 1.5, belly: 0.6, hoodY: 1.45, axles: [1.8, -1.6], r: 0.55, slope: 0.82, ring: [-0.6, 0] }),
  uaz469: F([4.03, 2.38, 1.78, 2.05, true, 0.38, false]),
  ural: T({ L: 7.37, W: 2.5, cab: 'bonnet', hood: 1.9, axles: [2.4, -1.4, -2.75], r: 0.57, bedH: 1.7 }),
  kamaz: T({ L: 7.9, W: 2.55, cab: 'over', axles: [2.6, -1.3, -2.7], r: 0.6, bedH: 1.8 }),
  gaz66: T({ L: 5.8, W: 2.32, cab: 'over', axles: [1.85, -1.45], r: 0.55, bedH: 1.5 }),
  mi8: H({ st: [[8.6, 1.5, 0.35, 0.3], [8.0, 1.65, 1.0, 0.9], [7.0, 1.9, 1.25, 1.15], [1.0, 1.95, 1.25, 1.15], [-0.8, 2.4, 0.8, 0.75]], side: [7.0, 2.4], segs: 2, low: true, eng: [5.0, 0.0, 3.25, 1.05], boom: [-0.8, -7.6, 2.5, 3.1, 0.55, 0.28], fin: [[-7.0, 2.8], [-8.3, 3.2], [-8.9, 5.1], [-8.2, 5.1]], stab: [-6.8, 2.85, 1.3], tr: [-8.5, 4.6, 0.32, 1.95, 3], fuel: [5.0, 1.8, 1.3, 1.45], door: [6.2, 5.2, 0.9, 2.6, 1.17], gear: [[7.0, 1.1], [7.0, -1.1], [1.6, 1.8], [1.6, -1.8]], rot: [3.7, 4.6, 10.65, 5, 0.52], flag: [-3.5, -2.8, 2.65, 2.95, 0.6], len: 18.2, hgt: 5.65, cabin: true }),
  mi24: H({ st: [[8.6, 1.5, 0.3, 0.25], [8.0, 1.55, 0.65, 0.5], [7.0, 1.75, 0.85, 0.6], [6.0, 1.95, 1.0, 0.7], [4.8, 2.0, 1.2, 1.0], [1.0, 2.05, 1.2, 1.0], [-0.8, 2.4, 0.75, 0.65]], segs: 4, side: [4.8, 2.0], eng: [4.0, 0.5, 3.15, 1.0], boom: [-0.8, -9.0, 2.5, 3.0, 0.55, 0.26], fin: [[-8.3, 2.8], [-9.6, 3.2], [-10.2, 4.9], [-9.5, 4.9]], stab: [-8.0, 2.9, 1.5], tr: [-9.9, 4.2, 0.32, 1.9, 3], wings: [3.4, 2.2, 1.7, 3.3], pods: [1.6, 2.5], chin: [7.6, 0.9], gear: [[6.8, 1.0], [6.8, -1.0], [1.6, 1.5], [1.6, -1.5]], rot: [2.5, 4.4, 8.65, 5, 0.58], flag: [-3.5, -2.8, 2.6, 2.9, 0.55], len: 19.8, hgt: 6.5, cabin: true }),
  ka52: H({ st: [[6.6, 1.6, 0.3, 0.3], [6.0, 1.75, 0.8, 0.7], [4.6, 1.95, 1.0, 0.85], [2.6, 2.05, 1.05, 0.85], [0.6, 2.05, 0.95, 0.75], [-1.0, 2.3, 0.6, 0.5]], segs: 3, eng: [1.6, -0.8, 2.8, 1.2], boom: [-1.0, -6.0, 2.35, 2.6, 0.45, 0.25], fin: [[-5.2, 2.3], [-6.4, 2.3], [-6.6, 3.8], [-6.0, 3.8]], stab: [-5.6, 2.55, 1.6], wings: [2.0, 0.9, 1.9, 3.7], pods: [1.6, 2.6, 3.4], chin: [3.4, 1.1], gear: [[4.6, 0], [0.6, 1.4], [0.6, -1.4]], rot: [0.6, 4.1, 7.25, 3, 0.55], rot2: [0.6, 5.0, 7.25, 3, 0.55], coax: true, flag: [-3.0, -2.4, 2.35, 2.6, 0.45], len: 16.0, hgt: 5.0 }),
  // ---------- China ----------
  ztz99: M({ L: 7.6, W: 3.5, deck: 1.55, nose: 1.4, wh: [6, 0.38], tw: 0.58, skirt: true, turret: { x: -0.1, f: 1.8, b: 2.3, w: 1.6, y1: 2.3, shape: 'wedge', bustle: true }, gun: { L: 6.3, r: 0.1, ev: 0.5 }, era: true, hmg: true }),
  ztz96: M({ L: 6.9, W: 3.4, deck: 1.5, nose: 1.5, wh: [6, 0.38], tw: 0.58, skirt: true, turret: { x: -0.1, f: 1.5, b: 1.6, w: 1.45, y1: 2.25, shape: 'cast' }, gun: { L: 6.1, r: 0.1, ev: 0.5 }, era: true, hmg: true }),
  zbd04: I({ L: 7.2, W: 3.2, H: 1.85, glacis: 2.1, noseY: 0.7, wh: [6, 0.36], tw: 0.38, turret: { x: 0.2, w: 1.0, l: 1.8, h: 0.6, gun: 'bmp3' }, ramp: false }),
  zbl08: W({ L: 8.0, W: 3.0, H: 2.15, axles: [2.7, 1.25, -0.95, -2.4], r: 0.6, nose: 'wedge', noseLen: 1.6, turret: { x: 0.1, w: 0.95, l: 1.7, h: 0.6, gun: '30', atgm: true } }),
  wz551: W({ L: 6.73, W: 2.86, H: 2.1, axles: [2.0, 0.4, -1.6], r: 0.57, nose: 'boat', noseLen: 1.6, cupola: true, cupX: 0.4, cupZ: 0.5, ramp: false }),
  mengshi: R({ L: 4.95, W: 2.2, H: 1.95, bonnet: 1.55, belly: 0.55, hoodY: 1.3, axles: [1.6, -1.7], r: 0.46, slope: 0.92, ring: [-0.4, 0], hmg: true }),
  shaanxi: T({ L: 7.6, W: 2.5, cab: 'over', axles: [2.5, -1.3, -2.65], r: 0.58 }),
  z20: H({ st: [[6.8, 1.45, 0.3, 0.3], [6.2, 1.55, 0.8, 0.75], [5.3, 1.65, 1.0, 0.95], [2.8, 1.7, 1.05, 1.05], [0.2, 1.75, 1.0, 1.0], [-1.0, 2.0, 0.7, 0.6]], side: [5.3, 2.8], eng: [1.8, -0.8, 2.95, 0.75], boom: [-1.0, -8.2, 2.1, 2.5, 0.5, 0.25], fin: [[-7.4, 2.2], [-8.5, 2.6], [-9.0, 4.3], [-8.4, 4.3]], stab: [-8.0, 2.3, 2.2], tr: [-8.6, 3.7, 0.3, 1.7, 4], door: [3.0, 1.2, 0.9, 2.5, 1.05], gear: [[4.7, 1.2], [4.7, -1.2], [-7.6, 0]], rot: [0.6, 3.6, 8.2, 5, 0.5], flag: [-4.0, -3.4, 2.25, 2.5, 0.38], len: 15.3, hgt: 4.1, cabin: true }),
  z8: H({ st: [[9.5, 1.6, 0.4, 0.35], [8.9, 1.8, 1.1, 1.0], [7.9, 2.1, 1.4, 1.3], [-2.5, 2.1, 1.4, 1.3], [-4.0, 2.6, 0.8, 0.75]], side: [7.9, 3.0], low: true, eng: [3.6, -1.2, 3.8, 1.2], boom: [-4.0, -9.8, 2.7, 3.3, 0.6, 0.3], fin: [[-9.2, 2.9], [-10.6, 3.3], [-11.0, 5.5], [-10.3, 5.5]], tr: [-10.6, 4.6, 0.35, 2.0, 5], sponson: [2.0, -1.6, 0.9, 1.45], gear: [[7.4, 0], [0.4, 1.7], [0.4, -1.7]], rot: [1.0, 5.0, 9.45, 6, 0.6], flag: [-6.5, -5.8, 2.8, 3.1, 0.5], len: 23.0, hgt: 6.7, cabin: true }),
  z10: H({ st: [[6.2, 1.5, 0.25, 0.2], [5.6, 1.6, 0.55, 0.45], [4.6, 1.75, 0.75, 0.5], [3.2, 1.95, 0.9, 0.55], [1.6, 2.0, 0.95, 0.6], [0.0, 2.05, 0.9, 0.6], [-1.6, 2.15, 0.55, 0.4]], segs: 4, eng: [1.2, -0.9, 2.55, 1.05], boom: [-1.6, -7.6, 2.2, 2.45, 0.42, 0.2], fin: [[-6.8, 2.2], [-8.0, 2.2], [-8.3, 3.8], [-7.7, 3.8]], stab: [-7.4, 2.4, 1.5], tr: [-8.0, 3.3, -0.3, 1.3, 4], wings: [1.0, -0.2, 1.8, 2.3], pods: [1.2, 1.95], chin: [4.8, 0.9], gear: [[3.0, 1.0], [3.0, -1.0], [-7.3, 0]], rot: [0.3, 3.9, 6.5, 5, 0.5], flag: [-4.0, -3.4, 2.2, 2.45, 0.33], len: 14.2, hgt: 3.85 }),
  z9: H({ st: [[4.2, 1.3, 0.25, 0.25], [3.8, 1.35, 0.75, 0.65], [2.8, 1.45, 0.98, 0.85], [0.6, 1.55, 0.98, 0.85], [-0.8, 1.75, 0.7, 0.6]], side: [2.8, 0.6], eng: [0.9, -0.9, 2.55, 0.65], boom: [-0.8, -6.6, 1.95, 2.15, 0.4, 0.16], fin: [[-6.0, 1.8], [-7.1, 1.75], [-7.4, 3.3], [-6.9, 3.3], [-6.4, 2.2]], finT: 0.14, fen: [-6.8, 2.1, 0.4, 13], stab: [-5.6, 2.05, 1.0], gear: [[3.0, 0], [-0.3, 1.1], [-0.3, -1.1]], rot: [0.1, 3.3, 5.95, 4, 0.35], flag: [-3.5, -3.0, 1.95, 2.15, 0.3], len: 13.5, hgt: 4.0, cabin: true }),
  // ---------- Japan ----------
  type10: M({ L: 9.42 - 2.0, W: 3.24, deck: 1.45, nose: 1.0, wh: [5, 0.38], tw: 0.55, turret: { x: 0.2, f: 1.9, b: 2.6, w: 1.55, y1: 2.3, shape: 'wedge', bustle: true }, gun: { L: 5.5, r: 0.11 } }),
  type90: M({ L: 7.55, W: 3.33, deck: 1.5, nose: 1.0, wh: [6, 0.36], tw: 0.6, turret: { x: 0.2, f: 2.0, b: 2.6, w: 1.6, y1: 2.35, shape: 'slab', bustle: true }, gun: { L: 5.5, r: 0.12 }, hmg: true }),
  type89: I({ L: 6.8, W: 3.2, H: 1.9, glacis: 1.6, noseY: 0.95, wh: [6, 0.32], tw: 0.48, turret: { x: 0.0, w: 1.0, l: 1.8, h: 0.65, gun: '30', atgm: true }, ramp: false }),
  type96: W({ L: 6.84, W: 2.48, H: 1.85, axles: [2.3, 0.95, -0.85, -2.2], r: 0.55, nose: 'slab', noseLen: 1.4, cupola: true, cupX: 0.6, cupZ: -0.45, hmg: true }),
  type16: W({ L: 8.45, W: 2.98, H: 1.95, axles: [2.8, 1.35, -1.0, -2.45], r: 0.6, nose: 'wedge', noseLen: 1.5, turret: { x: -0.2, w: 1.45, l: 2.5, h: 0.75, gun: 'big', L: 5.2, r: 0.1, ev: 0.5 } }),
  komatsu_lav: R({ L: 4.4, W: 2.04, H: 1.85, bonnet: 1.0, belly: 0.55, hoodY: 1.2, axles: [1.3, -1.3], r: 0.45, slope: 0.85, ring: [-0.2, 0] }),
  type73: T({ L: 7.0, W: 2.5, cab: 'over', axles: [2.3, -1.6, -2.85], r: 0.55 }),
  oh1: H({ st: [[5.4, 1.4, 0.25, 0.2], [4.8, 1.5, 0.55, 0.42], [3.8, 1.65, 0.75, 0.5], [2.6, 1.8, 0.85, 0.55], [1.2, 1.85, 0.8, 0.55], [-0.6, 1.95, 0.5, 0.38]], segs: 4, eng: [0.9, -0.8, 2.5, 0.85], boom: [-0.6, -5.6, 1.95, 2.1, 0.36, 0.17], fin: [[-5.0, 1.8], [-6.0, 1.75], [-6.3, 3.2], [-5.8, 3.2], [-5.4, 2.2]], finT: 0.14, fen: [-5.8, 2.1, 0.36, 8], stab: [-4.8, 2.0, 0.9], skids: [2.6, -1.3, 1.0], rot: [0.3, 3.3, 5.8, 4, 0.33], flag: [-3.0, -2.5, 1.95, 2.15, 0.3], len: 12.0, hgt: 3.8 }),
  hmv_jp: R({ L: 4.91, W: 2.15, H: 1.85, bonnet: 1.5, belly: 0.55, hoodY: 1.2, axles: [1.6, -1.6], r: 0.45, slope: 0.92 }),
  // ---------- India ----------
  arjun: M({ L: 7.6, W: 3.85, deck: 1.6, nose: 1.1, wh: [7, 0.35], tw: 0.6, turret: { x: 0.0, f: 2.0, b: 2.3, w: 1.7, y1: 2.45, shape: 'slab', bustle: true }, gun: { L: 6.1, r: 0.11, ev: 0.45 }, hmg: true }),
  gypsy: F([4.0, 2.38, 1.54, 1.85, true, 0.33, false]),
  tata_lpta: T({ L: 7.4, W: 2.5, cab: 'over', axles: [2.4, -1.6], r: 0.55 }),
  dhruv: H({ st: [[6.4, 1.45, 0.3, 0.28], [5.8, 1.55, 0.8, 0.72], [4.8, 1.65, 1.0, 0.9], [2.4, 1.7, 1.02, 0.95], [0.6, 1.75, 0.95, 0.9], [-0.6, 2.0, 0.65, 0.55]], side: [4.8, 2.4], eng: [1.8, -0.4, 2.9, 0.7], boom: [-0.6, -7.4, 2.15, 2.45, 0.45, 0.22], fin: [[-6.8, 2.2], [-7.8, 2.5], [-8.1, 4.0], [-7.6, 4.0]], stab: [-6.4, 2.4, 1.3], tr: [-7.8, 3.5, 0.3, 1.25, 4], skids: [4.2, -0.8, 1.15], rot: [1.0, 3.5, 6.6, 4, 0.48], flag: [-3.6, -3.0, 2.2, 2.45, 0.38], len: 15.9, hgt: 4.98, cabin: true }),
  lch: H({ st: [[6.6, 1.45, 0.25, 0.2], [6.0, 1.55, 0.55, 0.42], [5.0, 1.7, 0.75, 0.5], [3.6, 1.9, 0.9, 0.55], [2.0, 1.95, 0.95, 0.6], [0.4, 2.0, 0.9, 0.6], [-1.0, 2.15, 0.55, 0.4]], segs: 4, eng: [1.4, -0.6, 2.6, 1.0], boom: [-1.0, -7.6, 2.2, 2.5, 0.45, 0.2], fin: [[-7.0, 2.2], [-8.0, 2.5], [-8.3, 4.0], [-7.8, 4.0]], stab: [-6.6, 2.4, 1.3], tr: [-8.0, 3.5, 0.3, 1.25, 4], wings: [1.4, 0.2, 1.85, 2.2], pods: [1.2, 1.9], chin: [5.2, 0.85], skids: [3.8, -0.6, 1.2], rot: [0.9, 3.85, 6.6, 4, 0.48], flag: [-4.0, -3.4, 2.2, 2.45, 0.33], len: 15.8, hgt: 4.7 }),
  // ---------- Italy ----------
  ariete: M({ L: 7.6, W: 3.6, deck: 1.6, nose: 1.1, wh: [7, 0.35], tw: 0.6, turret: { x: 0.0, f: 2.2, b: 2.5, w: 1.65, y1: 2.5, shape: 'faceted', bustle: true }, gun: { L: 6.3, r: 0.11, ev: 0.45 } }),
  dardo: I({ L: 6.7, W: 3.0, H: 1.95, glacis: 1.4, noseY: 0.95, wh: [6, 0.32], tw: 0.45, turret: { x: 0.0, w: 0.95, l: 1.7, h: 0.65, gun: '25', atgm: true } }),
  centauro: W({ L: 7.85, W: 3.05, H: 1.95, axles: [2.65, 1.25, -1.05, -2.45], r: 0.6, nose: 'wedge', noseLen: 1.6, turret: { x: -0.3, w: 1.45, l: 2.6, h: 0.75, gun: 'big', L: 5.6, r: 0.1, ev: 0.5 } }),
  freccia: W({ L: 7.85, W: 3.05, H: 2.1, axles: [2.65, 1.25, -1.05, -2.45], r: 0.6, nose: 'wedge', noseLen: 1.6, turret: { x: 0.0, w: 0.95, l: 1.7, h: 0.6, gun: '25', atgm: true } }),
  lince: R({ L: 4.79, W: 2.05, H: 1.95, bonnet: 1.2, belly: 0.55, hoodY: 1.25, axles: [1.5, -1.5], r: 0.45, slope: 0.86, rws: [-0.5, 0, false] }),
  actl: T({ L: 7.6, W: 2.5, cab: 'over', axles: [2.5, -1.4, -2.8], r: 0.58 }),
  aw139: H({ st: [[6.4, 1.45, 0.3, 0.28], [5.8, 1.55, 0.8, 0.72], [4.8, 1.65, 1.0, 0.95], [2.0, 1.7, 1.02, 1.0], [0.0, 1.75, 0.95, 0.9], [-1.0, 2.0, 0.65, 0.55]], side: [4.8, 2.0], eng: [1.4, -0.8, 2.9, 0.75], boom: [-1.0, -7.6, 2.15, 2.5, 0.45, 0.22], fin: [[-7.0, 2.2], [-8.0, 2.5], [-8.3, 4.0], [-7.8, 4.0]], stab: [-6.6, 2.35, 1.4], tr: [-8.0, 3.5, -0.3, 1.35, 4], sponson: [1.6, -0.8, 0.85, 1.05], gear: [[4.4, 0], [0.3, 1.25], [0.3, -1.25]], rot: [0.6, 3.6, 6.9, 5, 0.42], flag: [-4.0, -3.4, 2.2, 2.45, 0.38], len: 16.7, hgt: 4.98, cabin: true }),
  a129: H({ st: [[5.8, 1.45, 0.25, 0.2], [5.2, 1.55, 0.55, 0.42], [4.2, 1.7, 0.72, 0.48], [2.8, 1.9, 0.85, 0.52], [1.4, 1.95, 0.9, 0.55], [0.0, 2.0, 0.85, 0.55], [-1.2, 2.1, 0.5, 0.38]], segs: 4, eng: [0.9, -0.8, 2.55, 0.95], boom: [-1.2, -6.6, 2.15, 2.35, 0.38, 0.18], fin: [[-6.0, 2.1], [-7.0, 2.1], [-7.3, 3.6], [-6.8, 3.6]], stab: [-6.4, 2.3, 1.2], tr: [-7.0, 3.1, -0.28, 1.15, 2], wings: [0.9, -0.1, 1.85, 2.0], pods: [1.1, 1.75], chin: [4.4, 0.9], gear: [[2.6, 0.9], [2.6, -0.9], [-6.2, 0]], rot: [0.2, 3.6, 5.9, 4, 0.45], flag: [-3.6, -3.0, 2.15, 2.4, 0.3], len: 12.3, hgt: 3.35 }),
  // ---------- Spain ----------
  pizarro: I({ L: 6.83, W: 3.15, H: 1.95, glacis: 1.4, noseY: 0.95, wh: [7, 0.31], tw: 0.48, turret: { x: 0.0, w: 0.95, l: 1.7, h: 0.7, gun: '30' } }),
  bmr600: W({ L: 6.15, W: 2.5, H: 2.0, axles: [2.0, 0.4, -1.6], r: 0.55, nose: 'boat', noseLen: 1.5, cupola: true, cupX: 0.3, cupZ: 0.4, hmg: true }),
  vamtac: R({ L: 4.85, W: 2.2, H: 1.95, bonnet: 1.5, belly: 0.55, hoodY: 1.3, axles: [1.65, -1.7], r: 0.46, slope: 0.92, ring: [-0.4, 0], hmg: true }),
  // ---------- Turkey ----------
  m60t: M({ L: 6.95, W: 3.63, deck: 1.6, nose: 1.0, wh: [6, 0.36], tw: 0.6, rollers: [1.8, 0.3, -1.2], turret: { x: 0.1, f: 1.9, b: 2.3, w: 1.6, y1: 2.6, shape: 'cast', bustle: true }, gun: { L: 6.2, r: 0.11, ev: 0.45 }, era: true, hmg: true }),
  m60a3: M({ L: 6.95, W: 3.63, deck: 1.6, nose: 1.0, wh: [6, 0.36], tw: 0.6, rollers: [1.8, 0.3, -1.2], skirt: false, turret: { x: 0.1, f: 1.7, b: 2.3, w: 1.6, y1: 2.6, shape: 'cast', bustle: true }, gun: { L: 5.4, r: 0.1, ev: 0.6 }, hmg: true }),
  acv15: I({ L: 5.3, W: 2.8, H: 1.95, glacis: 0.9, noseY: 0.95, wh: [5, 0.31], tw: 0.38, turret: { x: 0.2, w: 0.65, l: 1.2, h: 0.55, gun: '25' } }),
  arma: W({ L: 7.3, W: 2.7, H: 2.2, axles: [2.4, 0.8, -0.8, -2.3].slice(0, 3).map((v, i) => [2.3, 0.4, -1.8][i]), r: 0.6, nose: 'wedge', noseLen: 1.5, rws: [0.2, 0.0, true] }),
  cobra: R({ L: 5.23, W: 2.22, H: 2.1, bonnet: 1.35, belly: 0.6, hoodY: 1.35, axles: [1.65, -1.6], r: 0.5, slope: 0.82, ring: [-0.5, 0] }),
  kirpi: R({ L: 6.2, W: 2.5, H: 2.7, bonnet: 1.4, belly: 0.75, hoodY: 1.7, axles: [1.95, -1.85], r: 0.57, vee: true, slope: 0.84, rws: [-0.7, 0, false] }),
  bmc: T({ L: 7.2, W: 2.5, cab: 'over', axles: [2.4, -1.6], r: 0.57 }),
  t129: H({ st: [[5.8, 1.45, 0.25, 0.2], [5.2, 1.55, 0.55, 0.42], [4.2, 1.7, 0.72, 0.48], [2.8, 1.9, 0.85, 0.52], [1.4, 1.95, 0.9, 0.55], [0.0, 2.0, 0.85, 0.55], [-1.2, 2.1, 0.5, 0.38]], segs: 4, eng: [0.9, -0.8, 2.6, 1.0], boom: [-1.2, -6.6, 2.15, 2.35, 0.38, 0.18], fin: [[-6.0, 2.1], [-7.0, 2.1], [-7.3, 3.6], [-6.8, 3.6]], stab: [-6.4, 2.3, 1.2], tr: [-7.0, 3.1, -0.28, 1.15, 4], wings: [0.9, -0.1, 1.85, 2.0], pods: [1.1, 1.75], chin: [4.4, 0.9], gear: [[2.6, 0.9], [2.6, -0.9], [-6.2, 0]], rot: [0.2, 3.65, 5.95, 5, 0.42], flag: [-3.6, -3.0, 2.15, 2.4, 0.3], len: 13.8, hgt: 3.4 }),
  // ---------- South Korea ----------
  k2: M({ L: 7.5, W: 3.6, deck: 1.6, nose: 1.1, wh: [6, 0.36], tw: 0.6, turret: { x: 0.0, f: 2.3, b: 2.7, w: 1.68, y1: 2.4, shape: 'wedge', bustle: true }, gun: { L: 6.6, r: 0.12 }, cupola: 'rws' }),
  k1: M({ L: 7.48, W: 3.6, deck: 1.55, nose: 1.1, wh: [6, 0.36], tw: 0.6, turret: { x: 0.0, f: 2.1, b: 2.4, w: 1.65, y1: 2.3, shape: 'faceted', bustle: true }, gun: { L: 5.3, r: 0.11, ev: 0.5 }, hmg: true }),
  k21: I({ L: 6.9, W: 3.4, H: 1.95, glacis: 1.6, noseY: 0.95, wh: [6, 0.33], tw: 0.48, skirt: true, turret: { x: 0.0, w: 1.05, l: 1.8, h: 0.65, gun: '40', atgm: true } }),
  k200: I({ L: 5.49, W: 2.85, H: 1.92, glacis: 0.9, noseY: 0.95, wh: [5, 0.31], tw: 0.38, cupZ: -0.55, cupX: 0.8, hmg: true }),
  k808: W({ L: 7.4, W: 2.7, H: 2.2, axles: [2.6, 1.1, -0.8, -2.3], r: 0.6, nose: 'wedge', noseLen: 1.5, rws: [0.2, 0.0, true] }),
  k151: F([4.85, 3.0, 2.0, 1.95, false, 0.43, true]),
  km250: T({ L: 7.0, W: 2.45, cab: 'bonnet', hood: 1.6, axles: [2.3, -1.3, -2.6], r: 0.55, bedH: 1.6 }),
  surion: H({ st: [[7.2, 1.5, 0.32, 0.3], [6.6, 1.6, 0.85, 0.78], [5.6, 1.75, 1.08, 1.0], [2.8, 1.8, 1.12, 1.05], [0.0, 1.85, 1.05, 1.0], [-1.4, 2.15, 0.7, 0.6]], side: [5.6, 2.8], eng: [2.0, -1.0, 3.1, 0.85], boom: [-1.4, -8.6, 2.3, 2.7, 0.5, 0.24], fin: [[-8.0, 2.4], [-9.2, 2.7], [-9.6, 4.5], [-8.9, 4.5]], stab: [-8.4, 3.8, 1.2], tr: [-9.2, 3.9, 0.3, 1.55, 4], sponson: [1.8, -1.0, 0.85, 1.15], door: [2.6, 0.8, 0.95, 2.6, 1.1], gear: [[5.2, 0], [0.2, 1.35], [0.2, -1.35]], rot: [0.9, 4.0, 7.8, 4, 0.55], flag: [-4.6, -4.0, 2.4, 2.7, 0.4], len: 19.0, hgt: 4.5, cabin: true }),
  // ---------- Brazil ----------
  guarani: W({ L: 6.91, W: 2.7, H: 2.34, axles: [2.2, 0.5, -1.9], r: 0.6, nose: 'wedge', noseLen: 1.5, rws: [0.2, 0.0, true] }),
  cascavel: W({ L: 5.2, W: 2.59, H: 1.75, axles: [1.75, -0.6, -1.85], r: 0.55, nose: 'wedge', noseLen: 1.2, turret: { x: 0.0, w: 1.05, l: 1.8, h: 0.65, gun: 'big', L: 3.6, r: 0.08, shape: 'cast' } }),
  urutu: W({ L: 6.1, W: 2.65, H: 2.1, axles: [2.0, 0.0, -1.5].map((v, i) => [1.9, -0.6, -1.9][i]), r: 0.55, nose: 'boat', noseLen: 1.4, cupola: true, cupX: 0.3, cupZ: 0.5 }),
  marrua: F([4.6, 2.75, 1.85, 2.0, true, 0.4, false]),
  h225m: H({ st: [[7.5, 1.5, 0.35, 0.3], [6.9, 1.6, 0.9, 0.8], [5.9, 1.75, 1.15, 1.0], [3.2, 1.85, 1.22, 1.07], [-1.6, 1.9, 1.17, 1.02], [-2.9, 2.2, 0.75, 0.65]], side: [5.9, 3.2], eng: [4.2, -1.4, 3.15, 0.95], boom: [-2.9, -8.6, 2.3, 2.7, 0.52, 0.22], fin: [[-8.0, 2.3], [-9.2, 2.6], [-9.6, 4.5], [-8.9, 4.5]], stab: [-7.6, 2.6, 1.05], tr: [-9.2, 3.7, -0.25, 1.55, 4], sponson: [2.2, -1.0, 0.85, 1.22], door: [2.6, 0.6, 0.95, 2.65, 1.07], gear: [[5.8, 0], [0.4, 1.4], [0.4, -1.4]], rot: [1.0, 4.35, 8.1, 5, 0.6], flag: [-5.0, -4.3, 2.35, 2.65, 0.32], len: 19.5, hgt: 4.97, cabin: true }),
  // ---------- Western export (older kit) ----------
  m35: T({ L: 6.7, W: 2.4, cab: 'bonnet', hood: 1.7, softCab: true, axles: [2.2, -1.3, -2.55], r: 0.5, bedH: 1.5 }),
  aml90: W({ L: 3.79, W: 1.97, H: 1.55, axles: [1.0, -1.0], r: 0.5, nose: 'wedge', noseLen: 1.0, belly: 0.45, waist: 1.0, turret: { x: -0.3, w: 0.85, l: 1.6, h: 0.6, gun: 'big', L: 3.4, r: 0.07, brake: true, shape: 'cast' }, ramp: false, vision: false }),
  uh1: H({ st: [[5.2, 1.45, 0.3, 0.28], [4.6, 1.55, 0.85, 0.7], [3.6, 1.65, 1.05, 0.85], [0.6, 1.7, 1.05, 0.88], [-0.6, 1.95, 0.7, 0.6]], side: [3.6, 0.6], low: true, eng: [0.6, -1.0, 2.75, 0.55], boom: [-0.6, -7.6, 2.0, 2.4, 0.45, 0.2], fin: [[-7.0, 2.1], [-8.0, 2.4], [-8.3, 3.8], [-7.8, 3.8]], stab: [-5.0, 2.25, 1.3], tr: [-8.0, 3.4, 0.3, 1.3, 2], skids: [3.4, -1.6, 1.25], rot: [0.0, 3.5, 7.3, 2, 0.53], flag: [-3.4, -2.8, 2.05, 2.3, 0.4], len: 17.4, hgt: 4.4, cabin: true }),
};
