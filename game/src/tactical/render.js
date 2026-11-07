// Three.js renderer for the city layer: tiles (terrain, land use, roads, buildings), dynamic agents and an RTS camera.
import * as THREE from 'three';
import { FLAG } from './city.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export const USE_COLORS = {
  house: 0xc9b896, apartments: 0xd2b48c, retail: 0xd98a7a, office: 0x8fb3d9, industrial: 0x9c8fbf, warehouse: 0x8e86a8, civic: 0xa9c79a, school: 0xe6cf7a,
  hospital: 0xe8e8ea, police: 0x5b8def, fire_station: 0xe0703a, religious: 0xe9e3d0, transport: 0xa0a0a0, hotel: 0xd6a6c9, minor: 0x8a8580, military: 0x7d8a5a,
  sports: 0xb0c4a0, unknown: 0xb5aea3, farm: 0xb7a27a, utility: 0x9a9a9a, parking: 0x9a9a9a, university: 0xe0c060,
};
const AREA_COLORS = { residential: 0x262c30, commercial: 0x2b2a30, retail: 0x2e2a2c, industrial: 0x2c2a33, military: 0x2c3326, railway: 0x2a2a2a, farmland: 0x3a4a2a, forest: 0x1f3a24, grass: 0x2d4a30, park: 0x2a4a2e, cemetery: 0x2c3e2e, water: 0x1d4f73, wetland: 0x2a4a48, sports: 0x2f5234, parking: 0x2e3236, construction: 0x3b3428, allotments: 0x34482c, farmyard: 0x3a3a2a, beach: 0x8a7d5a, scrub: 0x2e4228 };
const AREA_Y = { water: 0.12 };

export class Renderer {
  constructor(canvas, city) {
    this.city = city; this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.pixelRatio = Math.min(1.5, devicePixelRatio || 1); this.r.setPixelRatio(this.pixelRatio);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0b1015); this.scene.fog = new THREE.Fog(0x0b1015, 2500, 7000);
    this.cam = new THREE.PerspectiveCamera(50, 1, 2, 12000);
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x2a2620, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.35); sun.position.set(-0.6, 1, 0.45); this.scene.add(sun);
    this.tileGroups = new Map(); this.pickMeshes = []; this.groundMeshes = [];
    this.matB = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.matLocked = new THREE.MeshLambertMaterial({ color: 0x3b4146, side: THREE.DoubleSide });
    this.matGround = new THREE.MeshLambertMaterial({ color: 0x1d2328, side: THREE.DoubleSide });
    this.matGroundLocked = new THREE.MeshLambertMaterial({ color: 0x15191c, side: THREE.DoubleSide });
    this.matArea = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.matRoad = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.cc = { target: new THREE.Vector3(0, 0, 0), dist: 1400, yaw: 0.6, pitch: 0.95 };
    this.dyn = {};
    this.initDynamic();
    this.resize(); this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement);
  }
  setQuality(pr) { this.pixelRatio = pr; this.r.setPixelRatio(pr); this.resize(); }
  groundPick(sx, sy) { const rc = this.ray(sx, sy), out = new THREE.Vector3(); if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.cc.target.y), out)) return { p: [out.x, -out.z] }; return null; }
  dispose() { this.ro.disconnect(); this.r.dispose(); }
  resize() { const p = this.canvas.parentElement.getBoundingClientRect(); this.w = p.width; this.h = p.height; this.r.setSize(p.width, p.height, false); this.cam.aspect = p.width / p.height; this.cam.updateProjectionMatrix(); }
  // world (x east, y north, z up) -> three (x, y up, -z north)
  V(x, y, z = 0) { return new THREE.Vector3(x, z, -y); }

  updateCamera() {
    const c = this.cc; c.pitch = Math.max(0.25, Math.min(1.45, c.pitch)); c.dist = Math.max(40, Math.min(6000, c.dist));
    const t = c.target;
    this.cam.position.set(t.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, t.y + Math.sin(c.pitch) * c.dist, t.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist);
    this.cam.lookAt(t);
    this.scene.fog.near = c.dist * 1.6; this.scene.fog.far = c.dist * 4 + 1500;
  }
  render() { this.updateCamera(); this.r.render(this.scene, this.cam); for (const m of this.pickMeshes) { const g = m.geometry; g.attributes.color.clearUpdateRanges?.(); } }

  // ---------------- Tiles ----------------
  buildTile(tile) {
    const old = this.tileGroups.get(tile.key); if (old) { this.scene.remove(old.g); old.g.traverse(o => o.geometry?.dispose()); this.pickMeshes = this.pickMeshes.filter(m => m !== old.b); this.groundMeshes = this.groundMeshes.filter(m => m !== old.ground); }
    const city = this.city, t = tile.data, g = new THREE.Group(); g.name = tile.key;
    // terrain
    const T = t.terrain, n = T.n, pos = new Float32Array(n * n * 3), idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = (j * n + i) * 3; pos[k] = T.ox + i * T.step; pos[k + 1] = T.data[j * n + i] * T.scale - city.zMin - 0.05; pos[k + 2] = -(T.oy + j * T.step); }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    const ground = new THREE.Mesh(tg, tile.unlocked ? this.matGround : this.matGroundLocked); ground.userData.tile = tile.key; g.add(ground);
    // areas
    const ap = [], ac = [], col = new THREE.Color();
    const sorted = t.areas.slice().sort((a, b) => (city.codes.area[a.kind] === 'water') - (city.codes.area[b.kind] === 'water'));
    for (const a of sorted) {
      const kind = city.codes.area[a.kind]; col.setHex(AREA_COLORS[kind] || 0x222222); if (!tile.unlocked) col.lerp(new THREE.Color(0x16191c), 0.6);
      const y0 = AREA_Y[kind] || 0.03;
      triangulate(a.ring, a.holes, (p) => { ap.push(p[0], city.heightAt(p[0], p[1]) + y0, -p[1]); ac.push(col.r, col.g, col.b); });
    }
    // rivers / canals as ribbons, rails & tram as thin dark strips
    const rp = [], rc = [];
    for (const l of t.lines) {
      const kind = city.codes.line[l.kind];
      const w = kind === 'river' ? 18 : kind === 'canal' ? 12 : kind === 'stream' ? 3 : kind === 'tram' ? 2.2 : 3;
      col.setHex(['river', 'canal', 'stream'].includes(kind) ? AREA_COLORS.water : kind === 'tram' ? 0x5a4a66 : 0x3a3a3a); if (!tile.unlocked) col.lerp(new THREE.Color(0x16191c), 0.6);
      if (l.flags & 1) continue; // tunnel
      ribbon(l.pts, w, p => city.heightAt(p[0], p[1]) + (['river', 'canal', 'stream'].includes(kind) ? 0.1 : 0.2), (x, y, z) => { rp.push(x, y, -z); rc.push(col.r, col.g, col.b); });
    }
    if (ap.length) g.add(meshFrom(ap, ac, this.matArea));
    // roads
    for (const e of t.edges) {
      if (e.flags & FLAG.tunnel) continue;
      const drive = e.flags & FLAG.drive, lanes = Math.max(1, e.lf + e.lb);
      const w = drive ? lanes * 3.1 + 1.2 : e.cls >= 11 ? 1.6 : 3;
      col.setHex(drive ? (e.cls <= 2 ? 0x4a4d52 : e.cls <= 4 ? 0x3e4146 : 0x35383c) : 0x4a4640);
      if (!tile.unlocked) col.lerp(new THREE.Color(0x1a1d20), 0.55);
      const zs = e.pts.map(p => city.heightAt(p[0], p[1]) + (e.flags & FLAG.bridge ? 5 : 0) + 0.3 + (drive ? 0.05 : 0));
      ribbon(e.pts, w, (p, i) => zs[i], (x, y, z) => { rp.push(x, y, -z); rc.push(col.r, col.g, col.b); });
    }
    for (const j of t.junctions) {
      const ins = (j.inc || []).length; if (ins < 2) continue;
      col.setHex(0x3a3d41); if (!tile.unlocked) col.lerp(new THREE.Color(0x1a1d20), 0.55);
      const r = 5.5, z = city.heightAt(j.p[0], j.p[1]) + 0.36;
      for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2; rp.push(j.p[0], z, -j.p[1], j.p[0] + Math.cos(a1) * r, z, -(j.p[1] + Math.sin(a1) * r), j.p[0] + Math.cos(a0) * r, z, -(j.p[1] + Math.sin(a0) * r)); for (let q = 0; q < 3; q++) rc.push(col.r, col.g, col.b); }
    }
    if (rp.length) g.add(meshFrom(rp, rc, this.matRoad));
    // buildings
    const bp = [], bc = [], tri2b = [];
    for (const bi of tile.bIdx) {
      const b = city.buildings[bi]; b.vStart = bp.length / 3;
      const z0 = b.z, z1 = b.z + Math.max(2.5, b.h);
      const base = new THREE.Color(USE_COLORS[city.codes.use[b.use]] || 0xb0a898);
      const shade = 0.85 + ((b.osm * 2654435761) >>> 0) % 1000 / 1000 * 0.3; base.multiplyScalar(shade);
      const R = b.ring;
      for (let k = 0; k < R.length; k++) {
        const a = R[k], c = R[(k + 1) % R.length];
        bp.push(a[0], z0, -a[1], c[0], z0, -c[1], c[0], z1, -c[1], a[0], z0, -a[1], c[0], z1, -c[1], a[0], z1, -a[1]);
        tri2b.push(bi, bi);
      }
      for (const h of b.holes) for (let k = 0; k < h.length; k++) { const a = h[k], c = h[(k + 1) % h.length]; bp.push(a[0], z0, -a[1], c[0], z0, -c[1], c[0], z1, -c[1], a[0], z0, -a[1], c[0], z1, -c[1], a[0], z1, -a[1]); tri2b.push(bi, bi); }
      const wallEnd = bp.length / 3;
      triangulate(R, b.holes, p => { bp.push(p[0], z1, -p[1]); }, true);
      for (let q = (bp.length / 3 - wallEnd) / 3; q > 0; q--) tri2b.push(bi);
      b.vCount = bp.length / 3 - b.vStart; b.wallEnd = wallEnd; b.baseCol = base; b.z1 = z1;
      for (let v = 0; v < b.vCount; v++) { const roof = b.vStart + v >= wallEnd; const k = roof ? 1.08 : 0.92; bc.push(base.r * k, base.g * k, base.b * k); }
    }
    let bmesh = null;
    if (bp.length) {
      bmesh = meshFrom(bp, bc, tile.unlocked ? this.matB : this.matLocked); bmesh.geometry.computeBoundsTree({ indirect: true }); bmesh.userData.tri2b = Int32Array.from(tri2b); bmesh.userData.tile = tile.key; g.add(bmesh);
      for (const bi of tile.bIdx) city.buildings[bi].mesh = bmesh;
      this.pickMeshes.push(bmesh);
    }
    this.groundMeshes.push(ground);
    this.scene.add(g);
    this.tileGroups.set(tile.key, { g, b: bmesh, ground });
    tile.justUnlocked = false;
  }
  // Recolour a building to reflect its state; collapse damaged ones.
  paintBuilding(b, col, collapse = 0) {
    const m = b.mesh; if (!m || m.material === this.matLocked) return;
    const ca = m.geometry.attributes.color, pa = m.geometry.attributes.position;
    for (let v = 0; v < b.vCount; v++) { const i = b.vStart + v, roof = i >= b.wallEnd, k = roof ? 1.08 : 0.92; ca.setXYZ(i, col.r * k, col.g * k, col.b * k); }
    ca.addUpdateRange(b.vStart * 3, b.vCount * 3); ca.needsUpdate = true;
    if (collapse !== b.collapsed) {
      const top = b.z + Math.max(2.5, b.h) * (1 - collapse * 0.8);
      for (let v = 0; v < b.vCount; v++) { const i = b.vStart + v; if (pa.getY(i) > b.z + 0.01) pa.setY(i, top); }
      pa.addUpdateRange(b.vStart * 3, b.vCount * 3); pa.needsUpdate = true; b.collapsed = collapse; m.geometry.computeBoundingSphere();
    }
  }
  setTileLocked(tile) { const tg = this.tileGroups.get(tile.key); if (tg) this.buildTile(tile); }

  // ---------------- Picking ----------------
  ray(sx, sy) { const v = new THREE.Vector2(sx / this.w * 2 - 1, -(sy / this.h) * 2 + 1); const rc = new THREE.Raycaster(); rc.setFromCamera(v, this.cam); return rc; }
  pick(sx, sy) {
    const rc = this.ray(sx, sy);
    const hits = rc.intersectObjects([...this.pickMeshes, ...this.groundMeshes], false);
    for (const h of hits) {
      const p = [h.point.x, -h.point.z];
      if (h.object.userData.tri2b) return { building: this.city.buildings[h.object.userData.tri2b[h.faceIndex]], p };
      return { p };
    }
    // fallback: intersect y=0 plane
    const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), out = new THREE.Vector3();
    if (rc.ray.intersectPlane(pl, out)) return { p: [out.x, -out.z] };
    return null;
  }
  toScreen(x, y, z) { const v = new THREE.Vector3(x, z, -y).project(this.cam); if (v.z > 1) return null; return [(v.x + 1) / 2 * this.w, (1 - v.y) / 2 * this.h]; }

  // ---------------- Dynamic layers ----------------
  initDynamic() {
    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; this.scene.add(m); return m; };
    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    const carG = new THREE.BoxGeometry(4.3, 1.5, 1.85); carG.translate(0, 0.75, 0);
    this.dyn.cars = mk(carG, new THREE.MeshLambertMaterial({ vertexColors: false }), 6000);
    this.dyn.cars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(6000 * 3), 3);
    const pedG = new THREE.CylinderGeometry(0.35, 0.35, 1.75, 5); pedG.translate(0, 0.88, 0);
    this.dyn.peds = mk(pedG, lam(0xd8d0c0), 6000);
    const blipG = new THREE.BufferGeometry(); blipG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12000 * 3), 3)); blipG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12000 * 3), 3));
    this.dyn.blips = new THREE.Points(blipG, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 })); this.dyn.blips.frustumCulled = false; this.dyn.blips.renderOrder = 5; this.scene.add(this.dyn.blips);
    const crG = new THREE.OctahedronGeometry(1.1, 0); crG.scale(1, 1.4, 1); crG.translate(0, 1.4, 0);
    this.dyn.creatures = mk(crG, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x220000 }), 4000);
    this.dyn.creatures.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(4000 * 3), 3);
    const solG = new THREE.CapsuleGeometry(0.38, 1.1, 2, 6); solG.translate(0, 0.95, 0);
    this.dyn.soldiers = mk(solG, lam(0x4f6b45), 3000);
    const vehG = new THREE.BoxGeometry(6.5, 2.4, 2.8); vehG.translate(0, 1.2, 0);
    const turret = new THREE.BoxGeometry(2.2, 0.9, 1.9); turret.translate(0, 2.8, 0);
    this.dyn.vehicles = mk(mergeGeos([vehG, turret]), lam(0x55654a), 400);
    const heliG = mergeGeos([(() => { const g = new THREE.CapsuleGeometry(1.2, 6, 2, 8); g.rotateZ(Math.PI / 2); return g; })(), (() => { const g = new THREE.BoxGeometry(13, 0.15, 0.5); g.translate(0, 1.6, 0); return g; })(), (() => { const g = new THREE.BoxGeometry(0.5, 0.15, 13); g.translate(0, 1.6, 0); return g; })()]);
    this.dyn.helis = mk(heliG, lam(0x5d6b55), 60);
    const ringG = new THREE.RingGeometry(0.93, 1, 48); ringG.rotateX(-Math.PI / 2);
    this.dyn.rings = mk(ringG, new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.85, depthTest: false }), 400); this.dyn.rings.renderOrder = 6;
    const discG = new THREE.CircleGeometry(1, 20); discG.rotateX(-Math.PI / 2);
    this.dyn.discs = mk(discG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthTest: false }), 3600); this.dyn.discs.renderOrder = 3;
    this.dyn.discs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3600 * 3), 3);
    const markG = new THREE.CylinderGeometry(0.6, 0.6, 1, 6); markG.translate(0, 0.5, 0);
    this.dyn.markers = mk(markG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }), 600);
    this.dyn.markers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4000 * 6), 3));
    this.dyn.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 })); this.dyn.tracers.frustumCulled = false; this.scene.add(this.dyn.tracers);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8000 * 6), 3)); lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(8000 * 6), 3));
    this.dyn.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthTest: false })); this.dyn.lines.frustumCulled = false; this.dyn.lines.renderOrder = 4; this.scene.add(this.dyn.lines);
    // selection box overlay handled in DOM
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._p = new THREE.Vector3(); this._c = new THREE.Color(); this._up = new THREE.Vector3(0, 1, 0);
  }
  setInst(mesh, i, x, y, z, hx, hy, scale = 1, color) {
    this._p.set(x, z, -y); this._q.setFromAxisAngle(this._up, Math.atan2(hy, hx)); this._s.set(scale, scale, scale);
    this._m.compose(this._p, this._q, this._s); mesh.setMatrixAt(i, this._m);
    if (color !== undefined && mesh.instanceColor) { this._c.set(color); mesh.setColorAt(i, this._c); }
  }
  setInstS(mesh, i, x, y, z, sx, sy, sz, color) { this._p.set(x, z, -y); this._q.identity(); this._s.set(sx, sy, sz); this._m.compose(this._p, this._q, this._s); mesh.setMatrixAt(i, this._m); if (color !== undefined && mesh.instanceColor) { this._c.set(color); mesh.setColorAt(i, this._c); } }
  commit(mesh, n) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
}

function meshFrom(pos, col, mat) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function mergeGeos(gs) {
  const pos = [], nor = [];
  for (const g0 of gs) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}
// Triangulate polygon (world x,y); emits vertices CCW from above (three's y-up with z=-y keeps CCW when viewed from +y)
function triangulate(ring, holes, emit) {
  if (ring.length < 3) return;
  const c = ring.map(p => new THREE.Vector2(p[0], p[1])), hs = (holes || []).filter(h => h.length >= 3).map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(c, hs); } catch { return; }
  const all = [...ring, ...(holes || []).filter(h => h.length >= 3).flat()];
  const ccw = THREE.ShapeUtils.isClockWise(c) ? false : true;
  for (const f of faces) { const [a, b, d] = ccw ? f : [f[0], f[2], f[1]]; emit(all[a]); emit(all[b]); emit(all[d]); }
}
function ribbon(pts, w, zf, emit) {
  if (pts.length < 2) return;
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = -dy * w / 2, ny = dx * w / 2, z = zf(pts[i], i);
    L.push([pts[i][0] + nx, pts[i][1] + ny, z]); R.push([pts[i][0] - nx, pts[i][1] - ny, z]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = L[i], b = R[i], c = R[i + 1], d = L[i + 1];
    emit(b[0], b[2], b[1]); emit(c[0], c[2], c[1]); emit(d[0], d[2], d[1]);
    emit(b[0], b[2], b[1]); emit(d[0], d[2], d[1]); emit(a[0], a[2], a[1]);
  }
}
