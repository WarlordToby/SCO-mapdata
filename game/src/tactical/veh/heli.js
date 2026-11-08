// Helicopters, modelled from their real dimensions: lofted fuselage with the glazing on the right panels,
// tail boom and fin, main rotor (spins about the mast), tail rotor or fenestron, skids or wheels.
import { VB, VP, VS } from './kit.js';
const P = VP, V = VS;

// a fuselage station: centre height cy, half height hy, half width hz; flat: how flat the belly is (0..1)
function ring(cy, hy, hz, n = 12, flat = 0.3) {
  const half = [];
  for (let i = 0; i <= n / 2; i++) { const t = -Math.PI / 2 + Math.PI * i / (n / 2); let y = cy + hy * Math.sin(t), z = hz * Math.cos(t); if (i === 0 || i === n / 2) z = 0; if (Math.sin(t) < 0) y = cy - hy * (1 - flat) * -Math.sin(t) - hy * flat * (Math.sin(t) < -0.7 ? 1 : 0) * 0 ; half.push([y, Math.abs(z) < 1e-6 ? 0 : z]); }
  return VB.sym(half);
}
// fuselage from stations [x, cy, hy, hz]; glazing: { segs: n front segments, low: also glaze below the waist, side: [x0, x1] side windows }
function fuselage(B, st, gl = {}, n = 12) {
  const secs = st.map(([x, cy, hy, hz]) => ({ w: x, ring: ring(cy, hy, hz, n), cy, hy }));
  B.loft(P.hull, (e, s) => {
    const R = secs[s].ring, a = R[e], b = R[(e + 1) % R.length], cy = secs[s].cy, hy = secs[s].hy, upper = (a[0] + b[0]) / 2 > cy - hy * 0.05, mid = (a[0] + b[0]) / 2 > cy - hy * 0.6;
    const front = s < (gl.segs || 0);
    if (front && (upper || (gl.low && mid))) return V.glass;
    if (gl.side && secs[s].w <= gl.side[0] && secs[s + 1].w >= gl.side[1] - 0.01 && Math.abs((a[0] + b[0]) / 2 - cy) < hy * 0.45 && Math.abs((a[1] + b[1]) / 2) > 0.1) return V.glass;
    return V.paint;
  }, secs, { capA: true, capB: true });
}
function rotor(B, x, y, r, n, chord = 0.5, o = {}) {
  B.tube(P.hull, V.metal, [x, y - 0.6, 0], [x, y, 0], 0.12, 0.1, 8);
  B.tube(P.rotor, V.metal, [x, y - 0.1, 0], [x, y + 0.15, 0], 0.32, 0.22, 10);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), px = -s, pz = c, h = chord / 2;
    const p = (d, w, yy) => [x + c * d + px * w, yy, -(s * d) + pz * w * -1 * -1];
    const pts = [[x + c * 0.3 + px * h * 0.6, y + 0.02, -(s * 0.3) + pz * h * 0.6], [x + c * r + px * h, y + 0.02 + r * 0.004, -(s * r) + pz * h], [x + c * r - px * h, y + 0.02 + r * 0.004, -(s * r) - pz * h], [x + c * 0.3 - px * h * 0.6, y + 0.02, -(s * 0.3) - pz * h * 0.6]];
    // a thin blade with an upper and a lower face
    const lo = pts.map(q => [q[0], q[1] - 0.05, q[2]]);
    B.quad(pts[0], pts[1], pts[2], pts[3], P.rotor, V.black, [x, y - 5, 0]); B.quad(lo[3], lo[2], lo[1], lo[0], P.rotor, V.black, [x, y + 5, 0]);
    B.quad(pts[1], lo[1], lo[2], pts[2], P.rotor, V.black, [x, y, 0]);
  }
}
function tailRotor(B, x, y, z, r, n) {
  B.tube(P.tail, V.metal, [x, y, z], [x, y, z + Math.sign(z) * 0.15], 0.09, 0.07, 8);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.3, c = Math.cos(a), s = Math.sin(a), w = 0.08;
    B.quad([x + c * 0.08 - s * w, y + s * 0.08 + c * w, z], [x + c * r - s * w, y + s * r + c * w, z], [x + c * r + s * w, y + s * r - c * w, z], [x + c * 0.08 + s * w, y + s * 0.08 - c * w, z], P.tail, V.black, [x, y, z - 1]);
    B.quad([x + c * 0.08 + s * w, y + s * 0.08 - c * w, z - 0.02], [x + c * r + s * w, y + s * r - c * w, z - 0.02], [x + c * r - s * w, y + s * r + c * w, z - 0.02], [x + c * 0.08 - s * w, y + s * 0.08 + c * w, z - 0.02], P.tail, V.black, [x, y, z + 1]);
  }
  B.piv.tail = [x, y, z];
}
function fenestron(B, x, y, r, n) {
  B.tube(P.hull, V.paint, [x, y, -0.18], [x, y, 0.18], r + 0.12, r + 0.12, 16); // shroud ring (outer)
  B.tube(P.hull, V.black, [x, y, -0.17], [x, y, 0.17], r + 0.01, r + 0.01, 16, { caps: false });
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), w = 0.045; B.quad([x + c * 0.07 - s * w, y + s * 0.07 + c * w, 0.02], [x + c * r - s * w, y + s * r + c * w, 0.02], [x + c * r + s * w, y + s * r - c * w, 0.02], [x + c * 0.07 + s * w, y + s * 0.07 - c * w, 0.02], P.tail, V.metal, [x, y, -1]); }
  B.piv.tail = [x, y, 0];
}
const skids = (B, x0, x1, z, y = 0.08, h = 0.75) => { for (const s of [1, -1]) { B.tube(P.hull, V.metal, [x0, y, z * s], [x1, y, z * s], 0.05, 0.05, 6); B.tube(P.hull, V.metal, [x0, y, z * s], [x0 + 0.25, y + 0.18, z * s], 0.05, 0.05, 6); for (const xc of [x1 + (x0 - x1) * 0.25, x1 + (x0 - x1) * 0.75]) B.tube(P.hull, V.metal, [xc, y, z * s], [xc, y + h, z * s * 0.55], 0.045, 0.045, 6); } };
const wheelGear = (B, xs, z, r = 0.3, ys = 0.3) => { for (const [x, zz] of xs) { B.wheel(x, r, zz, r, 0.18, { sides: 10 }); B.tube(P.hull, V.metal, [x, r, zz], [x, r + ys + 0.4, zz * 0.6], 0.05, 0.05, 6); } };
const flagH = (B, x0, x1, y0, y1, z) => { B.plate(P.hull, V.flag, [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]], 0.01); B.plate(P.hull, V.flag, [[x0, y0, -z], [x1, y0, -z], [x1, y1, -z], [x0, y1, -z]], 0.01); };
const fin = (B, prof, t = 0.1) => B.extrude(P.hull, V.paint, prof, -t / 2, t / 2, 0.02);

export function alouette3() {
  const B = new VB();
  fuselage(B, [[4.4, 1.55, 0.3, 0.25], [3.9, 1.55, 0.75, 0.62], [3.0, 1.6, 0.95, 0.82], [1.8, 1.65, 1.0, 0.85], [0.6, 1.7, 0.95, 0.8], [-0.4, 1.85, 0.6, 0.55]], { segs: 3, low: true, side: [1.8, 0.6] });
  B.cbox(P.hull, V.metal, -1.2, 0.6, 2.55, 3.05, -0.38, 0.38, 0.08); B.tube(P.hull, V.metal, [-1.2, 2.8, 0], [-1.7, 2.8, 0], 0.25, 0.2, 10); // exposed Artouste turbine
  // open truss tail boom (as a slim tapered beam with cross members)
  B.tube(P.hull, V.paint, [-0.4, 2.0, 0], [-5.6, 2.2, 0], 0.32, 0.12, 4); for (let x = -1.0; x > -5.4; x -= 0.6) B.tube(P.hull, V.metal, [x, 1.8, 0], [x - 0.3, 2.4, 0], 0.02, 0.02, 4);
  fin(B, [[-5.3, 2.0], [-5.9, 2.0], [-6.1, 3.0], [-5.75, 3.0]], 0.08); B.cbox(P.hull, V.paint, -5.0, -4.6, 2.15, 2.22, -0.8, 0.8, 0.02);
  tailRotor(B, -5.9, 2.5, 0.25, 0.95, 3);
  wheelGear(B, [[3.5, 0], [0.2, 1.1], [0.2, -1.1]], 0, 0.22);
  rotor(B, 0.3, 3.3, 5.5, 3, 0.35); flagH(B, -2.6, -2.0, 2.05, 2.3, 0.2);
  B.piv.rotor = [0.3, 3.3, 0];
  return B.build({ len: 10.0, hgt: 3.0, heli: true });
}
export function gazelle() {
  const B = new VB();
  fuselage(B, [[2.6, 1.3, 0.2, 0.2], [2.2, 1.35, 0.65, 0.55], [1.3, 1.45, 0.85, 0.7], [0.3, 1.5, 0.85, 0.7], [-0.9, 1.6, 0.65, 0.55], [-1.7, 1.75, 0.35, 0.3]], { segs: 3, low: true });
  B.loft(P.hull, V.paint, [{ w: -0.5, ring: ring(2.35, 0.25, 0.42, 10) }, { w: -1.9, ring: ring(2.15, 0.2, 0.3, 10) }]);
  B.tube(P.hull, V.paint, [-1.7, 1.8, 0], [-5.2, 1.85, 0], 0.3, 0.15, 10);
  fin(B, [[-4.6, 1.7], [-5.6, 1.7], [-5.9, 3.1], [-5.4, 3.1], [-5.0, 2.1]], 0.12); fenestron(B, -5.3, 1.95, 0.32, 13); B.cbox(P.hull, V.paint, -4.4, -4.0, 1.9, 1.96, -0.8, 0.8, 0.02);
  skids(B, 1.6, -1.6, 0.95);
  rotor(B, 0.0, 2.9, 5.25, 3, 0.35); flagH(B, -3.2, -2.7, 1.8, 2.0, 0.22);
  B.piv.rotor = [0, 2.9, 0];
  return B.build({ len: 9.5, hgt: 3.2, heli: true });
}
function twinEngineHeli(B, o) {
  const k = o.k || 1;
  fuselage(B, o.st, { segs: 2, side: o.side });
  B.loft(P.hull, V.paint, [{ w: o.engX0, ring: ring(o.engY, 0.38, 0.85, 10) }, { w: o.engX0 - 0.6, ring: ring(o.engY + 0.05, 0.45, 0.95, 10) }, { w: o.engX1 + 0.5, ring: ring(o.engY + 0.05, 0.45, 0.95, 10) }, { w: o.engX1, ring: ring(o.engY - 0.05, 0.3, 0.6, 10) }]);
  B.tube(P.hull, V.paint, [o.boom[0], o.boom[2], 0], [o.boom[1], o.boom[3], 0], o.boom[4], o.boom[5], 12);
  fin(B, o.fin, 0.2); if (o.stab) B.cbox(P.hull, V.paint, o.stab[0] - 0.5, o.stab[0], o.stab[1], o.stab[1] + 0.08, -o.stab[2], o.stab[2], 0.02);
  tailRotor(B, o.tr[0], o.tr[1], o.tr[2], o.tr[3], o.tr[4]);
  for (const s of [1, -1]) {
    if (o.sponson) B.loft(P.hull, V.paint, [{ w: o.sponson[0], ring: ring(o.sponson[2], 0.3, 0.25, 8) }, { w: o.sponson[0] - 0.4, ring: ring(o.sponson[2], 0.4, 0.4, 8).map(([y, z]) => [y, z]) }, { w: o.sponson[1], ring: ring(o.sponson[2], 0.35, 0.35, 8) }].map(r => ({ w: r.w, ring: r.ring.map(([y, z]) => [y, z + s * o.sponson[3]]) })));
    B.plate(P.hull, V.trim, [[o.door[0], o.door[2], s * o.door[4]], [o.door[1], o.door[2], s * o.door[4]], [o.door[1], o.door[3], s * o.door[4]], [o.door[0], o.door[3], s * o.door[4]]], 0.012);
  }
  wheelGear(B, o.gear, 0, o.wheelR || 0.35);
  rotor(B, o.rot[0], o.rot[1], o.rot[2], o.rot[3], o.rot[4]);
  flagH(B, o.flag[0], o.flag[1], o.flag[2], o.flag[3], o.flag[4]);
  B.piv.rotor = [o.rot[0], o.rot[1], 0];
}
export function puma() {
  const B = new VB();
  twinEngineHeli(B, { st: [[6.2, 1.5, 0.35, 0.3], [5.6, 1.6, 0.9, 0.8], [4.6, 1.75, 1.15, 1.0], [2.5, 1.85, 1.2, 1.05], [-1.2, 1.9, 1.15, 1.0], [-2.4, 2.2, 0.75, 0.65]], side: [4.6, 2.5],
    engX0: 3.6, engX1: -1.3, engY: 3.15, boom: [-2.4, -7.6, 2.3, 2.65, 0.5, 0.22], fin: [[-7.0, 2.3], [-8.2, 2.6], [-8.6, 4.4], [-7.9, 4.4]], stab: [-6.6, 2.55, 1.0], tr: [-8.2, 3.6, -0.25, 1.5, 5],
    sponson: [1.8, -0.8, 0.85, 1.2], door: [2.2, 0.4, 0.95, 2.6, 1.05], gear: [[4.8, 0], [0.4, 1.35], [0.4, -1.35]], rot: [0.9, 4.2, 7.5, 4, 0.55], flag: [-4.5, -3.8, 2.35, 2.65, 0.32] });
  return B.build({ len: 14.1, hgt: 4.4, heli: true, cabin: true });
}
export function cougar() {
  const B = new VB();
  twinEngineHeli(B, { st: [[6.9, 1.5, 0.35, 0.3], [6.3, 1.6, 0.9, 0.8], [5.3, 1.75, 1.15, 1.0], [3.0, 1.85, 1.22, 1.07], [-1.5, 1.9, 1.17, 1.02], [-2.8, 2.2, 0.75, 0.65]], side: [5.3, 3.0],
    engX0: 4.0, engX1: -1.4, engY: 3.15, boom: [-2.8, -8.2, 2.3, 2.7, 0.52, 0.22], fin: [[-7.6, 2.3], [-8.8, 2.6], [-9.2, 4.5], [-8.5, 4.5]], stab: [-7.2, 2.6, 1.05], tr: [-8.8, 3.7, -0.25, 1.55, 5],
    sponson: [2.2, -1.0, 0.85, 1.22], door: [2.6, 0.6, 0.95, 2.65, 1.07], gear: [[5.4, 0], [0.4, 1.4], [0.4, -1.4]], rot: [1.0, 4.3, 7.8, 4, 0.6], flag: [-5.0, -4.3, 2.35, 2.65, 0.32] });
  return B.build({ len: 15.5, hgt: 4.6, heli: true, cabin: true });
}
export function nh90() {
  const B = new VB();
  twinEngineHeli(B, { st: [[7.0, 1.55, 0.3, 0.3], [6.4, 1.7, 0.95, 0.85], [5.3, 1.9, 1.25, 1.1], [2.6, 2.0, 1.32, 1.15], [-1.4, 2.05, 1.27, 1.1], [-3.0, 2.4, 0.8, 0.7]], side: [5.3, 2.6],
    engX0: 3.6, engX1: -1.6, engY: 3.45, boom: [-3.0, -8.6, 2.5, 2.9, 0.55, 0.25], fin: [[-8.0, 2.5], [-9.3, 2.8], [-9.7, 4.7], [-9.0, 4.7]], stab: [-8.4, 3.9, 1.2], tr: [-9.25, 3.95, 0.3, 1.6, 4],
    sponson: [2.0, -1.4, 0.8, 1.3], door: [2.3, 0.4, 0.95, 2.8, 1.15], gear: [[5.8, 0], [0.0, 1.45], [0.0, -1.45]], rot: [0.9, 4.6, 8.15, 4, 0.6], flag: [-5.3, -4.6, 2.55, 2.85, 0.35] });
  return B.build({ len: 16.1, hgt: 5.2, heli: true, cabin: true });
}
export function h125() {
  const B = new VB();
  fuselage(B, [[3.3, 1.35, 0.25, 0.25], [2.9, 1.4, 0.75, 0.65], [2.0, 1.5, 0.95, 0.8], [0.6, 1.6, 0.95, 0.8], [-0.6, 1.75, 0.75, 0.65], [-1.3, 1.95, 0.45, 0.4]], { segs: 2, side: [2.0, 0.6] });
  B.loft(P.hull, V.paint, [{ w: 0.2, ring: ring(2.6, 0.25, 0.5, 10) }, { w: -1.6, ring: ring(2.45, 0.2, 0.35, 10) }]);
  B.tube(P.hull, V.paint, [-1.3, 2.0, 0], [-6.2, 2.15, 0], 0.32, 0.14, 10);
  fin(B, [[-5.7, 1.7], [-6.4, 1.6], [-6.6, 3.0], [-6.1, 3.0], [-5.8, 2.2]], 0.1); B.cbox(P.hull, V.paint, -5.3, -4.9, 2.1, 2.16, -0.9, 0.9, 0.02);
  tailRotor(B, -6.3, 2.35, -0.25, 0.93, 2);
  skids(B, 1.9, -1.4, 1.05);
  rotor(B, 0.1, 3.05, 5.35, 3, 0.35); flagH(B, -3.4, -2.9, 2.0, 2.2, 0.24);
  B.piv.rotor = [0.1, 3.05, 0];
  return B.build({ len: 10.9, hgt: 3.3, heli: true, cabin: true });
}
export function h135() {
  const B = new VB();
  fuselage(B, [[3.6, 1.3, 0.25, 0.25], [3.2, 1.35, 0.75, 0.65], [2.2, 1.45, 0.95, 0.8], [0.4, 1.55, 0.95, 0.8], [-1.0, 1.65, 0.85, 0.75], [-1.6, 1.85, 0.5, 0.45]], { segs: 2, side: [2.2, 0.4] });
  B.loft(P.hull, V.paint, [{ w: 0.6, ring: ring(2.55, 0.3, 0.6, 10) }, { w: -1.4, ring: ring(2.45, 0.3, 0.55, 10) }, { w: -1.9, ring: ring(2.3, 0.15, 0.3, 10) }]);
  B.tube(P.hull, V.paint, [-1.6, 1.9, 0], [-5.6, 2.05, 0], 0.35, 0.16, 10);
  fin(B, [[-5.0, 1.8], [-6.0, 1.75], [-6.3, 3.2], [-5.8, 3.2], [-5.4, 2.2]], 0.14); fenestron(B, -5.7, 2.05, 0.35, 10); B.cbox(P.hull, V.paint, -4.7, -4.3, 2.0, 2.06, -0.85, 0.85, 0.02);
  for (const s of [1, -1]) B.cbox(P.hull, V.paint, -5.0, -4.6, 2.0, 2.4, s * 0.85 - 0.02, s * 0.85 + 0.02, 0.01);
  skids(B, 2.0, -1.4, 1.0);
  rotor(B, 0.1, 3.2, 5.1, 4, 0.3); flagH(B, -3.0, -2.5, 1.95, 2.15, 0.26);
  B.piv.rotor = [0.1, 3.2, 0];
  return B.build({ len: 10.2, hgt: 3.5, heli: true, cabin: true });
}
export function tigre() {
  const B = new VB();
  // narrow fuselage with stepped tandem canopies: pilot in front, gunner behind and higher (HAD)
  fuselage(B, [[5.2, 1.35, 0.25, 0.2], [4.6, 1.45, 0.55, 0.45], [3.8, 1.55, 0.7, 0.5], [2.6, 1.75, 0.85, 0.55], [1.6, 1.9, 0.9, 0.55], [0.0, 1.9, 0.85, 0.55], [-1.5, 1.95, 0.55, 0.42]], { segs: 4 });
  B.loft(P.hull, V.paint, [{ w: 1.2, ring: ring(2.75, 0.25, 0.5, 10) }, { w: 0.6, ring: ring(2.9, 0.35, 0.75, 10) }, { w: -1.6, ring: ring(2.75, 0.3, 0.6, 10) }, { w: -2.3, ring: ring(2.5, 0.15, 0.3, 10) }]);
  B.tube(P.hull, V.paint, [-1.5, 2.0, 0], [-7.0, 2.25, 0], 0.4, 0.17, 10);
  fin(B, [[-6.3, 2.0], [-7.3, 1.95], [-7.6, 3.6], [-7.0, 3.6], [-6.6, 2.4]], 0.14); B.cbox(P.hull, V.paint, -6.6, -6.1, 2.2, 2.27, -1.1, 1.1, 0.02);
  for (const s of [1, -1]) B.cbox(P.hull, V.paint, -6.6, -6.2, 2.0, 2.6, s * 1.1 - 0.02, s * 1.1 + 0.02, 0.01);
  tailRotor(B, -7.3, 3.0, -0.25, 1.2, 3);
  // stub wings with launchers
  for (const s of [1, -1]) { B.extrude(P.hull, V.paint, [[0.9, 1.95], [-0.2, 1.95], [-0.3, 2.05], [0.8, 2.08]], s > 0 ? 0.5 : -2.1, s > 0 ? 2.1 : -0.5, 0.02); for (const z of [1.25, 1.95]) { B.cbox(P.hull, V.paint, -0.05, 0.25, 1.75, 1.95, s * z - 0.04, s * z + 0.04, 0.01); B.tube(P.hull, V.paint, [1.0, 1.55, s * z], [-0.8, 1.55, s * z], 0.18, 0.18, 8); } }
  B.tube(P.hull, V.metal, [3.6, 1.0, 0], [3.6, 0.75, 0], 0.18, 0.18, 8); B.tube(P.hull, V.metal, [3.6, 0.8, 0], [5.0, 0.75, 0], 0.035, 0.03, 6); // 30 mm chin turret
  B.tube(P.hull, V.paint, [0.3, 3.6, 0], [0.3, 4.0, 0], 0.08, 0.08, 6); B.tube(P.hull, V.paint, [0.3, 3.95, -0.25], [0.3, 3.95, 0.25], 0.22, 0.22, 10); // roof sight (Strix)
  wheelGear(B, [[2.8, 0.85], [2.8, -0.85], [-6.4, 0]], 0, 0.28);
  rotor(B, 0.3, 3.55, 6.5, 4, 0.5); flagH(B, -3.6, -3.0, 2.1, 2.35, 0.32);
  B.piv.rotor = [0.3, 3.55, 0];
  return B.build({ len: 14.0, hgt: 3.8, heli: true });
}

export const HELI = { alouette3, gazelle, puma, cougar, nh90, h125, ec135: h135, tigre };
export { ring, fuselage, rotor, tailRotor, fenestron, skids, wheelGear, flagH, fin, twinEngineHeli };
