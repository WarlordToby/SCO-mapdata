// Civilian traffic and emergency vehicles. Car bodies are lofted from stations along the length; the
// greenhouse (windscreen, side glass, rear window) is picked out of the same loft by segment, so every
// panel is a proper face. Service vehicles carry livery panels and beacon bars.
import { VB, VP, VS } from './kit.js';
const P = VP, V = VS;

// station: x, bottom y, belt y, roof y, body half-width, roof half-width; seg: type of the segment that follows
// ('nose', 'hood', 'wind', 'cab', 'rear', 'boot', 'tail')
function carBody(B, st, segs, o = {}) {
  const ring = s => { const y5 = Math.max(s[3] - 0.05, s[2] + 0.05), y6 = Math.max(s[3], y5 + 0.02), r5 = Math.min(s[5], s[4] - 0.06); return VB.sym([[s[1], 0], [s[1], s[4] - 0.1], [s[1] + 0.16, s[4]], [s[2], s[4]], [s[2] + 0.04, s[4] - 0.05], [y5, r5], [y6, r5 - 0.08], [y6, 0]]); };
  const secs = st.map(s => ({ w: s[0], ring: ring(s) }));
  const n = secs[0].ring.length; // 14: edges 4 & 9 side glass, 5..8 roof
  B.loft(P.hull, (e, s) => {
    const t = segs[s];
    if ((e === 4 || e === 9) && (t === 'cab' || t === 'wind' || t === 'rear') && !(o.panelVan && t !== 'wind' && segs.indexOf('cab') < s)) return V.glass;
    if ((e >= 5 && e <= 8) && (t === 'wind' || t === 'rear')) return V.glass;
    if (e >= 2 && e <= 3 || e >= 10 && e <= 11) return V.paint;
    return V.paint;
  }, secs);
  // bumpers, lights, grille
  const f = st[0], r = st[st.length - 1];
  B.cbox(P.hull, V.trim, f[0] - 0.08, f[0] + 0.05, f[1] - 0.02, f[1] + 0.2, -f[4] + 0.02, f[4] - 0.02, 0.03);
  B.cbox(P.hull, V.trim, r[0] - 0.05, r[0] + 0.08, r[1] - 0.02, r[1] + 0.2, -r[4] + 0.02, r[4] - 0.02, 0.03);
  B.plate(P.hull, V.black, [[f[0] + 0.005, f[1] + 0.22, f[4] * 0.45], [f[0] + 0.005, f[1] + 0.22, -f[4] * 0.45], [f[0] + 0.005, f[2] - 0.05, -f[4] * 0.45], [f[0] + 0.005, f[2] - 0.05, f[4] * 0.45]], 0.01);
  for (const s of [1, -1]) { B.plate(P.hull, V.light, [[f[0] + 0.006, f[2] - 0.13, s * f[4] * 0.92], [f[0] + 0.006, f[2] - 0.13, s * f[4] * 0.55], [f[0] + 0.006, f[2] - 0.03, s * f[4] * 0.55], [f[0] + 0.006, f[2] - 0.03, s * f[4] * 0.92]].map(p => p), 0.01);
    B.plate(P.hull, V.red, [[r[0] - 0.006, r[2] - 0.15, s * r[4] * 0.55], [r[0] - 0.006, r[2] - 0.15, s * r[4] * 0.92], [r[0] - 0.006, r[2] - 0.03, s * r[4] * 0.92], [r[0] - 0.006, r[2] - 0.03, s * r[4] * 0.55]], 0.01); }
  // pillars between door windows
  if (o.pillars) for (const x of o.pillars) for (const s of [1, -1]) { const k = st.findIndex(q => q[0] < x) - 1, a = st[Math.max(0, k)]; B.cbox(P.hull, V.black, x - 0.05, x + 0.05, a[2] + 0.05, a[3] - 0.06, s > 0 ? a[4] - 0.08 : -a[4] + 0.02, s > 0 ? a[4] - 0.02 : -a[4] + 0.08, 0.01); }
}
const wheels4 = (B, xs, r, w, z) => { for (const x of xs) for (const s of [1, -1]) B.wheel(x, r, z * s, r, w, { sides: 12, hub: V.hub, boss: r * 0.25 }); };
const beacons = (B, x, y, w, l = 0.25) => { B.cbox(P.hull, V.black, x - l / 2, x + l / 2, y, y + 0.05, -w, w, 0.01); B.cbox(P.hull, V.beacon, x - l / 2 + 0.03, x + l / 2 - 0.03, y + 0.05, y + 0.14, -w + 0.04, -0.03, 0.02); B.cbox(P.hull, V.beacon, x - l / 2 + 0.03, x + l / 2 - 0.03, y + 0.05, y + 0.14, 0.03, w - 0.04, 0.02); };
// a livery band along both sides between x0..x1 at y0..y1, laid on body half-width z
const livery = (B, x0, x1, y0, y1, z) => { for (const s of [1, -1]) B.plate(P.hull, V.livery, s > 0 ? [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]] : [[x0, y0, -z], [x1, y0, -z], [x1, y1, -z], [x0, y1, -z]], 0.008); };

export function hatch() {
  const B = new VB();
  carBody(B, [[2.0, 0.3, 0.72, 0.78, 0.86, 0.55], [1.75, 0.28, 0.82, 0.86, 0.87, 0.6], [1.05, 0.28, 0.9, 0.92, 0.87, 0.66], [0.55, 0.28, 0.92, 1.45, 0.87, 0.66], [-1.5, 0.28, 0.95, 1.47, 0.87, 0.66], [-1.95, 0.3, 0.95, 1.38, 0.86, 0.62], [-2.0, 0.32, 0.9, 1.2, 0.85, 0.6]], ['nose', 'hood', 'wind', 'cab', 'rear', 'tail'], { pillars: [-0.35] });
  wheels4(B, [1.3, -1.25], 0.31, 0.2, 0.75);
  return B.build({ len: 4.0, wid: 1.75, hgt: 1.47, car: true });
}
export function sedan() {
  const B = new VB();
  carBody(B, [[2.35, 0.3, 0.7, 0.76, 0.9, 0.55], [2.1, 0.28, 0.8, 0.84, 0.91, 0.6], [1.15, 0.28, 0.88, 0.9, 0.91, 0.66], [0.55, 0.28, 0.9, 1.42, 0.91, 0.66], [-0.8, 0.28, 0.92, 1.44, 0.91, 0.66], [-1.6, 0.28, 0.95, 1.0, 0.91, 0.62], [-2.35, 0.3, 0.95, 1.0, 0.9, 0.6]], ['nose', 'hood', 'wind', 'cab', 'rear', 'boot'], { pillars: [-0.15] });
  wheels4(B, [1.45, -1.4], 0.32, 0.21, 0.79);
  return B.build({ len: 4.7, wid: 1.82, hgt: 1.44, car: true });
}
export function suv() {
  const B = new VB();
  carBody(B, [[2.3, 0.4, 0.85, 0.92, 0.92, 0.6], [2.05, 0.38, 0.95, 1.0, 0.93, 0.62], [1.1, 0.38, 1.05, 1.08, 0.93, 0.7], [0.6, 0.38, 1.08, 1.68, 0.93, 0.74], [-1.95, 0.38, 1.1, 1.7, 0.93, 0.74], [-2.25, 0.4, 1.1, 1.62, 0.92, 0.7], [-2.3, 0.42, 1.05, 1.4, 0.92, 0.68]], ['nose', 'hood', 'wind', 'cab', 'rear', 'tail'], { pillars: [-0.25, -1.3] });
  wheels4(B, [1.45, -1.4], 0.37, 0.24, 0.8);
  return B.build({ len: 4.6, wid: 1.86, hgt: 1.7, car: true });
}
export function van() {
  const B = new VB();
  carBody(B, [[2.65, 0.35, 0.85, 0.9, 0.98, 0.6], [2.4, 0.33, 0.95, 1.0, 0.99, 0.7], [1.9, 0.33, 1.05, 1.15, 0.99, 0.85], [1.35, 0.33, 1.1, 2.25, 0.99, 0.92], [0.9, 0.33, 1.1, 2.3, 0.99, 0.93], [-2.6, 0.33, 1.1, 2.3, 0.99, 0.93], [-2.65, 0.35, 1.1, 2.2, 0.98, 0.9]], ['nose', 'hood', 'wind', 'cab', 'panel', 'tail'], { pillars: [] });
  wheels4(B, [1.85, -1.65], 0.34, 0.22, 0.86);
  return B.build({ len: 5.3, wid: 2.0, hgt: 2.3, car: true, van: true });
}
export function pickup() {
  const B = new VB();
  carBody(B, [[2.65, 0.45, 0.9, 0.98, 0.92, 0.6], [2.4, 0.43, 1.0, 1.05, 0.93, 0.65], [1.3, 0.43, 1.1, 1.12, 0.93, 0.72], [0.75, 0.43, 1.12, 1.78, 0.93, 0.76], [-0.55, 0.43, 1.14, 1.78, 0.93, 0.76], [-0.6, 0.43, 1.14, 1.14, 0.93, 0.76], [-2.65, 0.45, 1.14, 1.14, 0.92, 0.76]], ['nose', 'hood', 'wind', 'cab', 'rear', 'boot'], {});
  B.cbox(P.hull, V.black, -2.5, -0.65, 1.0, 1.06, -0.82, 0.82, 0.01); // load bed floor
  wheels4(B, [1.65, -1.6], 0.38, 0.25, 0.8);
  return B.build({ len: 5.3, wid: 1.86, hgt: 1.8, car: true });
}
export function minibus() {
  const B = new VB();
  carBody(B, [[2.5, 0.35, 0.85, 0.9, 0.95, 0.6], [2.4, 0.33, 0.95, 1.05, 0.96, 0.75], [2.15, 0.33, 1.0, 1.15, 0.96, 0.88], [1.6, 0.33, 1.05, 2.1, 0.96, 0.9], [-2.4, 0.33, 1.05, 2.12, 0.96, 0.9], [-2.5, 0.35, 1.05, 2.0, 0.95, 0.88]], ['nose', 'hood', 'wind', 'cab', 'tail'], { pillars: [0.8, -0.2, -1.2] });
  wheels4(B, [1.7, -1.6], 0.33, 0.22, 0.84);
  return B.build({ len: 5.0, wid: 1.92, hgt: 2.12, car: true });
}
export function bus() {
  const B = new VB();
  carBody(B, [[6.0, 0.35, 1.0, 1.1, 1.27, 1.0], [5.92, 0.33, 1.0, 2.9, 1.27, 1.22], [5.6, 0.33, 1.05, 3.0, 1.27, 1.25], [-5.9, 0.33, 1.05, 3.0, 1.27, 1.25], [-6.0, 0.35, 1.05, 2.9, 1.27, 1.22]], ['wind', 'wind', 'cab', 'tail'], { pillars: [4.4, 3.0, 1.6, 0.2, -1.2, -2.6, -4.0, -5.2] });
  for (const s of [1, -1]) for (const x of [4.6, 1.2]) B.plate(P.hull, V.black, s > 0 ? [[x + 1.0, 0.45, 1.272], [x, 0.45, 1.272], [x, 2.6, 1.272], [x + 1.0, 2.6, 1.272]] : [[x, 0.45, -1.272], [x + 1.0, 0.45, -1.272], [x + 1.0, 2.6, -1.272], [x, 2.6, -1.272]], 0.006); // doors
  wheels4(B, [3.9, -3.2], 0.5, 0.3, 1.05);
  return B.build({ len: 12.0, wid: 2.55, hgt: 3.0, car: true, big: true });
}
export function boxTruck() {
  const B = new VB();
  carBody(B, [[3.75, 0.45, 1.0, 1.1, 1.15, 0.9], [3.65, 0.43, 1.1, 2.55, 1.15, 1.05], [2.4, 0.43, 1.15, 2.6, 1.15, 1.08], [2.35, 0.43, 1.15, 1.2, 1.15, 1.08]], ['wind', 'cab', 'cab'], {});
  B.cbox(P.hull, V.trim, -3.75, 2.25, 0.9, 3.35, -1.2, 1.2, 0.04); B.cbox(P.hull, V.black, -3.6, 2.4, 0.55, 0.85, -0.45, 0.45, 0.02);
  wheels4(B, [2.9, -2.4], 0.48, 0.3, 1.0);
  return B.build({ len: 7.5, wid: 2.4, hgt: 3.35, car: true, big: true });
}
export function tuktuk() {
  const B = new VB();
  carBody(B, [[1.35, 0.3, 0.75, 0.8, 0.35, 0.3], [1.15, 0.3, 0.8, 1.6, 0.6, 0.55], [0.85, 0.3, 0.8, 1.72, 0.65, 0.62], [-1.2, 0.3, 0.8, 1.72, 0.65, 0.62], [-1.35, 0.32, 0.78, 1.6, 0.63, 0.58]], ['nose', 'wind', 'cab', 'tail'], {});
  B.wheel(1.05, 0.22, 0, 0.22, 0.12, { sides: 10 }); for (const s of [1, -1]) B.wheel(-0.9, 0.22, 0.58 * s, 0.22, 0.13, { sides: 10 });
  return B.build({ len: 2.7, wid: 1.3, hgt: 1.75, car: true });
}
// ---- emergency services ----
export function policeSedan() { const B = new VB(); carBody(B, [[2.35, 0.3, 0.7, 0.76, 0.9, 0.55], [2.1, 0.28, 0.8, 0.84, 0.91, 0.6], [1.15, 0.28, 0.88, 0.9, 0.91, 0.66], [0.55, 0.28, 0.9, 1.42, 0.91, 0.66], [-0.8, 0.28, 0.92, 1.44, 0.91, 0.66], [-1.6, 0.28, 0.95, 1.0, 0.91, 0.62], [-2.35, 0.3, 0.95, 1.0, 0.9, 0.6]], ['nose', 'hood', 'wind', 'cab', 'rear', 'boot'], { pillars: [-0.15] }); livery(B, -2.3, 2.3, 0.48, 0.86, 0.912); beacons(B, -0.1, 1.44, 0.55); wheels4(B, [1.45, -1.4], 0.32, 0.21, 0.79); return B.build({ len: 4.7, wid: 1.82, hgt: 1.6, car: true, police: true }); }
export function policeHatch() { const B = new VB(); carBody(B, [[2.0, 0.3, 0.72, 0.78, 0.86, 0.55], [1.75, 0.28, 0.82, 0.86, 0.87, 0.6], [1.05, 0.28, 0.9, 0.92, 0.87, 0.66], [0.55, 0.28, 0.92, 1.45, 0.87, 0.66], [-1.5, 0.28, 0.95, 1.47, 0.87, 0.66], [-1.95, 0.3, 0.95, 1.38, 0.86, 0.62], [-2.0, 0.32, 0.9, 1.2, 0.85, 0.6]], ['nose', 'hood', 'wind', 'cab', 'rear', 'tail'], { pillars: [-0.35] }); livery(B, -1.95, 1.95, 0.48, 0.88, 0.872); beacons(B, -0.4, 1.47, 0.52); wheels4(B, [1.3, -1.25], 0.31, 0.2, 0.75); return B.build({ len: 4.0, wid: 1.75, hgt: 1.62, car: true, police: true }); }
export function policeSuv() { const B = new VB(); carBody(B, [[2.3, 0.4, 0.85, 0.92, 0.92, 0.6], [2.05, 0.38, 0.95, 1.0, 0.93, 0.62], [1.1, 0.38, 1.05, 1.08, 0.93, 0.7], [0.6, 0.38, 1.08, 1.68, 0.93, 0.74], [-1.95, 0.38, 1.1, 1.7, 0.93, 0.74], [-2.25, 0.4, 1.1, 1.62, 0.92, 0.7], [-2.3, 0.42, 1.05, 1.4, 0.92, 0.68]], ['nose', 'hood', 'wind', 'cab', 'rear', 'tail'], { pillars: [-0.25, -1.3] }); livery(B, -2.25, 2.25, 0.58, 1.04, 0.932); beacons(B, -0.2, 1.7, 0.6); wheels4(B, [1.45, -1.4], 0.37, 0.24, 0.8); return B.build({ len: 4.6, wid: 1.86, hgt: 1.85, car: true, police: true }); }
export function policeVan() { const B = new VB(); carBody(B, [[2.65, 0.35, 0.85, 0.9, 0.98, 0.6], [2.4, 0.33, 0.95, 1.0, 0.99, 0.7], [1.9, 0.33, 1.05, 1.15, 0.99, 0.85], [1.35, 0.33, 1.1, 2.25, 0.99, 0.92], [0.9, 0.33, 1.1, 2.3, 0.99, 0.93], [-2.6, 0.33, 1.1, 2.3, 0.99, 0.93], [-2.65, 0.35, 1.1, 2.2, 0.98, 0.9]], ['nose', 'hood', 'wind', 'cab', 'rear', 'tail'], { pillars: [0.2, -0.9, -1.9] }); livery(B, -2.6, 2.6, 0.5, 1.05, 0.992); beacons(B, 1.0, 2.3, 0.7, 0.3); wheels4(B, [1.85, -1.65], 0.34, 0.22, 0.86); return B.build({ len: 5.3, wid: 2.0, hgt: 2.45, car: true, police: true }); }
export function ambulance() {
  const B = new VB();
  carBody(B, [[2.9, 0.35, 0.85, 0.9, 0.98, 0.6], [2.65, 0.33, 0.95, 1.0, 0.99, 0.7], [2.15, 0.33, 1.05, 1.15, 0.99, 0.85], [1.6, 0.33, 1.1, 2.15, 0.99, 0.9], [1.25, 0.33, 1.1, 2.2, 0.99, 0.9]], ['nose', 'hood', 'wind', 'cab'], {});
  B.cbox(P.hull, V.paint, -2.9, 1.25, 0.42, 2.75, -1.1, 1.1, 0.05); // box body
  livery(B, -2.85, 1.2, 0.95, 1.5, 1.102); livery(B, 1.3, 2.85, 0.5, 0.95, 0.992);
  beacons(B, 1.1, 2.75, 0.75, 0.3); beacons(B, -2.75, 2.75, 0.8, 0.2);
  for (const s of [1, -1]) B.plate(P.hull, V.glass, s > 0 ? [[0.6, 1.75, 1.103], [0.0, 1.75, 1.103], [0.0, 2.3, 1.103], [0.6, 2.3, 1.103]] : [[0.0, 1.75, -1.103], [0.6, 1.75, -1.103], [0.6, 2.3, -1.103], [0.0, 2.3, -1.103]], 0.005);
  wheels4(B, [2.1, -1.8], 0.36, 0.23, 0.88);
  return B.build({ len: 5.8, wid: 2.2, hgt: 2.9, car: true, service: true });
}
export function fireEngine() {
  const B = new VB();
  carBody(B, [[4.0, 0.45, 1.05, 1.15, 1.2, 0.95], [3.9, 0.43, 1.15, 2.7, 1.2, 1.1], [2.2, 0.43, 1.2, 2.8, 1.2, 1.12], [2.15, 0.43, 1.2, 1.25, 1.2, 1.12]], ['wind', 'cab', 'cab'], { pillars: [3.0] });
  B.cbox(P.hull, V.paint, -4.0, 2.1, 0.55, 2.9, -1.22, 1.22, 0.05);
  for (const s of [1, -1]) for (let x = 1.6; x > -3.6; x -= 1.3) B.plate(P.hull, V.trim, s > 0 ? [[x, 0.9, 1.222], [x - 1.15, 0.9, 1.222], [x - 1.15, 2.6, 1.222], [x, 2.6, 1.222]] : [[x - 1.15, 0.9, -1.222], [x, 0.9, -1.222], [x, 2.6, -1.222], [x - 1.15, 2.6, -1.222]], 0.006); // roller shutters
  livery(B, -4.0, 4.0, 0.6, 0.85, 1.225);
  B.cbox(P.hull, V.chrome, -3.8, 1.5, 3.0, 3.12, -0.45, 0.45, 0.02); for (let x = -3.6; x < 1.4; x += 0.4) B.cbox(P.hull, V.chrome, x - 0.02, x + 0.02, 3.12, 3.18, -0.45, 0.45, 0.005); // ladder
  beacons(B, 3.1, 2.8, 0.95, 0.3);
  wheels4(B, [3.0, -2.2], 0.5, 0.32, 1.02);
  return B.build({ len: 8.0, wid: 2.5, hgt: 3.2, car: true, service: true });
}

export const CIV = { hatch, sedan, suv, van, pickup, minibus, bus, boxTruck, tuktuk };
export const EMERG = { policeSedan, policeHatch, policeSuv, policeVan, ambulance, fireEngine };
