// Three.js renderer for the city layer: tiles (terrain, land use, streets, buildings, trees, lamps), sky & sun,
// dynamic agents and an RTS camera. Look: realistic up close, fading into a clean tactical map when zoomed out.
import * as THREE from 'three';
import { FLAG } from './city.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { U, flatMat, buildingMat, treeMat, waterMat, parkMat, makeSky, skyAt, AREA, GROUND, ROOF_PITCH, ROOF_FLAT, wallStyle, wallColor, obb, barrierMat, BARRIER_LOOK } from './look.js';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Use colours are an optional intel overlay (key V), not the default look.
export const USE_COLORS = {
  house: 0xd9b36a, apartments: 0xe0a050, retail: 0xe0607a, office: 0x4f9be0, industrial: 0x9a72e0, warehouse: 0x8a72c8, civic: 0x6ac060, school: 0xf0d040,
  hospital: 0xffffff, police: 0x3070ff, fire_station: 0xff7020, religious: 0xc8c0b0, transport: 0x909090, hotel: 0xe070c0, minor: 0x707070, military: 0x7d9a40,
  sports: 0x90c070, unknown: 0xb0a898, farm: 0xb09060, utility: 0x8a8a8a, parking: 0x8a8a8a, university: 0xf0b030,
};
const GFX = {
  low: { shadows: false, map: 0, treeShadows: false, pr: 1, label: 'Low' },
  medium: { shadows: true, map: 2048, treeShadows: false, barShadows: true, pr: 1.25, label: 'Medium' },
  high: { shadows: true, map: 4096, treeShadows: true, barShadows: true, pr: 1.5, label: 'High' },
};
const OLD_TOWN = /^(Centre|Bourse-Esplanade-Krutenau|Tribunal-Gare|Orangerie|Neudorf)/;
const rng = seed => { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; };
const BARRIER_KINDS_IDX = { fence: 0, chain: 1, wood: 2, railing: 3, wire: 4, hedge: 5, wall: 6, muret: 7, retaining: 8, jersey: 9, guard: 10, city_wall: 11 };
const strHash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

export class Renderer {
  constructor(canvas, city) {
    this.city = city; this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.r.outputColorSpace = THREE.SRGBColorSpace; this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.05;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0xb9cde0, 2500, 7000);
    this.cam = new THREE.PerspectiveCamera(50, 1, 2, 12000);
    this.hemi = new THREE.HemisphereLight(0xd4e4f5, 0x6b6150, 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2); this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    this.sky = makeSky(); this.scene.add(this.sky);
    this.tileGroups = new Map(); this.pickMeshes = []; this.groundMeshes = [];
    this.matB = buildingMat(false); this.matBL = buildingMat(true);
    const off = f => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });
    this.mat = { ground: flatMat({}, false, 2), groundL: flatMat({}, true, 2), area: flatMat(off(-1), false, 1), areaL: flatMat(off(-1), true, 1), pave: flatMat(off(-2), false, 1), paveL: flatMat(off(-2), true, 1), road: flatMat(off(-3)), roadL: flatMat(off(-3), true), mark: flatMat(off(-4)), markL: flatMat(off(-4), true) };
    this.mat.tree = treeMat(false); this.mat.treeL = treeMat(true);
    this.mat.garden = flatMat(off(-1), false, 3); this.mat.gardenL = flatMat(off(-1), true, 3); this.mat.water = waterMat(off(-1)); this.mat.park = parkMat(off(-1));
    this.lampMat = new THREE.PointsMaterial({ color: 0xffd9a0, size: 7, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTex() });
    this.poolMat = new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTex(), polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
    this.treeGeo = { broad: treeGeometry(false), needle: treeGeometry(true) };
    this.mat.barS = barrierMat(false); this.mat.barT = barrierMat(true); this.barGeo = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0); this.barMeshes = new Map();
    this.cc = { target: new THREE.Vector3(0, 0, 0), dist: 1400, yaw: 0.6, pitch: 0.95 };
    this.dyn = {};
    this.initDynamic();
    let g = 'medium'; try { g = localStorage.getItem('sco_gfx') || 'medium'; } catch (e) { }
    this.setGraphics(GFX[g] ? g : 'medium');
    this.setTimeOfDay(12);
    this.resize(); this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement);
  }
  get gfxLabel() { return GFX[this.gfx].label; }
  setGraphics(level) {
    this.gfx = level; const q = GFX[level];
    try { localStorage.setItem('sco_gfx', level); } catch (e) { }
    this.r.shadowMap.enabled = q.shadows; this.sun.castShadow = q.shadows;
    if (q.shadows) { this.sun.shadow.mapSize.set(q.map, q.map); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.scene.traverse(o => { if (o.userData.tree) o.castShadow = q.treeShadows; if (o.userData.barShadow) o.castShadow = !!q.barShadows; if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
    this.setQuality(Math.min(q.pr, devicePixelRatio || 1));
  }
  nextGraphics() { const k = Object.keys(GFX); this.setGraphics(k[(k.indexOf(this.gfx) + 1) % k.length]); return this.gfxLabel; }
  setTimeOfDay(hour) {
    const s = skyAt(hour); this.sky_ = s;
    this.sun.color.copy(s.sun); this.sun.intensity = s.sunI + 0.12; this.sunDir = s.day > 0 ? s.dir : new THREE.Vector3(-0.3, 0.8, 0.4).normalize();
    if (s.day <= 0) { this.sun.color.set(0x9fb4e0); this.sun.intensity = 0.55; }   // moonlight
    this.hemi.color.copy(s.hemiSky); this.hemi.groundColor.copy(s.hemiGround); this.hemi.intensity = s.hemiI;
    const su = this.sky.material.uniforms; su.top.value.copy(s.top); su.hor.value.copy(s.hor); su.sunDir.value.copy(s.dir); su.sunCol.value.copy(s.sun).multiplyScalar(s.day); su.glow.value = 0.4 + s.golden;
    this.scene.fog.color.copy(s.hor); U.uSkyHor.value.copy(s.hor); U.uSkyTop.value.copy(s.top);
    U.uNight.value = s.night; this.lampMat.opacity = Math.min(1, s.night * 1.3) * 0.95; this.poolMat.opacity = Math.min(1, s.night * 1.3) * 0.35;
    this.r.toneMappingExposure = 1.12 + s.night * 0.4;
  }
  setQuality(pr) { this.pixelRatio = pr; this.r.setPixelRatio(pr); if (this.w) this.resize(); }
  groundPick(sx, sy) { const rc = this.ray(sx, sy), out = new THREE.Vector3(); if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.cc.target.y), out)) return { p: [out.x, -out.z] }; return null; }
  dispose() { this.ro.disconnect(); this.r.dispose(); }
  resize() { const p = this.canvas.parentElement.getBoundingClientRect(); this.w = p.width; this.h = p.height; this.r.setSize(p.width, p.height, false); this.cam.aspect = p.width / p.height; this.cam.updateProjectionMatrix(); }
  V(x, y, z = 0) { return new THREE.Vector3(x, z, -y); }

  updateCamera() {
    const c = this.cc; c.pitch = Math.max(0.25, Math.min(1.45, c.pitch)); c.dist = Math.max(40, Math.min(6000, c.dist));
    const t = c.target;
    this.cam.position.set(t.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, t.y + Math.sin(c.pitch) * c.dist, t.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist);
    this.cam.lookAt(t);
    this.scene.fog.near = c.dist * (1.8 + 6 * U.uTac.value); this.scene.fog.far = c.dist * (5 + 12 * U.uTac.value) + 2500;
    // blend: realistic street level → clean tactical map
    const tac = Math.max(0, Math.min(1, (c.dist - 1300) / 1500)); U.uTac.value = tac * tac * (3 - 2 * tac);
    this.sky.position.copy(this.cam.position);
    const showPaths = U.uTac.value < 0.55; if (showPaths !== this._paths) { this._paths = showPaths; this.scene.traverse(o => { if (o.userData.paths) o.visible = showPaths; }); }
    U.uTime.value = performance.now() / 1000;
    // shadows follow the view
    const q = GFX[this.gfx];
    this.sun.castShadow = q.shadows && c.dist < 2400;
    if (this.sun.castShadow) {
      const S = Math.max(220, Math.min(1500, c.dist * 0.95)), sh = this.sun.shadow.camera;
      sh.left = -S; sh.right = S; sh.top = S; sh.bottom = -S; sh.near = 10; sh.far = 6000; sh.updateProjectionMatrix();
      this.sun.shadow.intensity = 0.85 * (1 - U.uTac.value);
    }
    this.sun.target.position.copy(t); this.sun.position.copy(t).addScaledVector(this.sunDir, 2500);
  }
  render() { this.updateCamera(); this.r.render(this.scene, this.cam); for (const m of this.pickMeshes) { const g = m.geometry; g.attributes.aTint?.clearUpdateRanges?.(); } }

  // ---------------- Tiles ----------------
  buildTile(tile) {
    const old = this.tileGroups.get(tile.key);
    if (old) { this.scene.remove(old.g); old.g.traverse(o => { o.geometry?.boundsTree && o.geometry.disposeBoundsTree?.(); o.geometry?.dispose(); }); this.pickMeshes = this.pickMeshes.filter(m => m !== old.b); this.groundMeshes = this.groundMeshes.filter(m => m !== old.ground); }
    const city = this.city, t = tile.data, g = new THREE.Group(), L = !tile.unlocked, M = this.mat;
    const H = (x, y) => city.heightAt(x, y), col = new THREE.Color();
    const dense = (pts, step = 6) => { const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.ceil(l / step); for (let s = 1; s <= k; s++) out.push([a[0] + (b[0] - a[0]) * s / k, a[1] + (b[1] - a[1]) * s / k]); } return out; };
    const denseRing = r => { const d = dense([...r, r[0]], 12); d.pop(); return d; };
    // terrain
    const T = t.terrain, n = T.n, pos = new Float32Array(n * n * 3), cols = new Float32Array(n * n * 3), idx = [];
    col.setHex(GROUND);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = (j * n + i) * 3; pos[k] = T.ox + i * T.step; pos[k + 1] = T.data[j * n + i] * T.scale - city.zMin - 0.05; pos[k + 2] = -(T.oy + j * T.step); cols[k] = col.r; cols[k + 1] = col.g; cols[k + 2] = col.b; }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    const ground = new THREE.Mesh(tg, L ? M.groundL : M.ground); ground.receiveShadow = true; ground.userData.tile = tile.key; g.add(ground);
    // land use: gardens/lawns around housing, paved commercial & industrial ground, nature; water and car parks separately
    const groups = { garden: [[], []], paved: [[], []], nature: [[], []], water: [[], []] }, park = [[], [], []];
    const KIND_GROUP = { residential: 'garden', allotments: 'garden', cemetery: 'nature', commercial: 'paved', retail: 'paved', industrial: 'paved', railway: 'paved', construction: 'paved', military: 'paved', farmyard: 'paved', water: 'water' };
    for (const a of t.areas) {
      const kind = city.codes.area[a.kind]; col.setHex(AREA[kind] || GROUND);
      if (kind === 'parking') { // car parks: own surface with bay markings oriented along the lot
        const ob = obb(a.ring) || { c: a.ring[0], ax: [1, 0], ay: [0, 1] };
        triangulate(denseRing(a.ring), a.holes.map(denseRing), p => { park[0].push(p[0], H(p[0], p[1]) + 0.06, -p[1]); park[1].push(col.r, col.g, col.b); const dx = p[0] - ob.c[0], dy = p[1] - ob.c[1]; park[2].push(dx * ob.ax[0] + dy * ob.ax[1], dx * ob.ay[0] + dy * ob.ay[1]); });
        continue;
      }
      const gr = groups[KIND_GROUP[kind] || 'nature'], y0 = kind === 'water' ? 0.1 : 0.03;
      triangulate(denseRing(a.ring), a.holes.map(denseRing), p => { gr[0].push(p[0], H(p[0], p[1]) + y0, -p[1]); gr[1].push(col.r, col.g, col.b); });
    }
    for (const l of t.lines) {
      const kind = city.codes.line[l.kind]; if (l.flags & 1) continue;
      if (!['river', 'canal', 'stream'].includes(kind)) continue;
      col.setHex(AREA.water); const gr = groups.water;
      ribbon(dense(l.pts), kind === 'river' ? 18 : kind === 'canal' ? 12 : 3, p => H(p[0], p[1]) + 0.1, (x, y, z) => { gr[0].push(x, y, -z); gr[1].push(col.r, col.g, col.b); });
    }
    const AM = { garden: L ? M.gardenL : M.garden, paved: L ? M.areaL : M.area, nature: L ? M.areaL : M.area, water: L ? M.areaL : M.water };
    for (const [k, [ps, cs]] of Object.entries(groups)) if (ps.length) { const m = meshFrom(ps, cs, AM[k]); m.receiveShadow = true; g.add(m); }
    if (park[0].length) { const m = meshFrom(park[0], park[1], L ? M.areaL : M.park); m.geometry.setAttribute('aPark', new THREE.Float32BufferAttribute(park[2], 2)); m.receiveShadow = true; g.add(m); }
    // streets: pavements, asphalt, markings, footpaths, rails
    const pp = [], pc = [], rp = [], rc = [], mp = [], mc = [], fp = [], fc = [];
    const P = (arrP, arrC, c) => (x, y, z) => { arrP.push(x, y, -z); arrC.push(c.r, c.g, c.b); };
    const cPave = new THREE.Color(0xa29e96), cFoot = new THREE.Color(0x938b7c), cCycle = new THREE.Color(0x86766c), cPed = new THREE.Color(0xb0aaa0), cMajor = new THREE.Color(0x484c51), cMinor = new THREE.Color(0x53575b), cService = new THREE.Color(0x63666a), cTrack = new THREE.Color(0x8a7f6a), cMark = new THREE.Color(0xe6e4dc), cRail = new THREE.Color(0x5a534c), cTram = new THREE.Color(0x6b6560);
    const roadW = e => e.cls >= 8 ? (e.cls === 9 ? 3 : 3.4) : Math.max(1, e.lf + e.lb) * 3.1 + 0.8;
    for (const e of t.edges) {
      if (e.flags & FLAG.tunnel) continue;
      const drive = e.flags & FLAG.drive, lanes = Math.max(1, e.lf + e.lb), bridge = e.flags & FLAG.bridge ? 5 : 0;
      const ep = dense(e.pts), n0 = ep.length - 1;
      // bridges rise smoothly from their ends instead of floating as a slab
      const zs = ep.map((p, i) => H(p[0], p[1]) + 0.25 + (bridge ? bridge * Math.min(1, Math.min(i, n0 - i) / Math.max(1, n0 * 0.2)) : 0));
      e._dense = ep;
      if (drive && e.cls <= 7) {
        const w = roadW(e);
        if (e.cls >= 2) ribbon(ep, w + 4.6, (p, i) => zs[i] - 0.05, P(pp, pc, cPave));
        ribbon(ep, w, (p, i) => zs[i], P(rp, rc, e.cls <= 3 ? cMajor : cMinor));
        if (e.cls <= 6 && lanes >= 2) { // lane markings: dashed centre / lane dividers
          const oneway = e.flags & FLAG.oneway;
          const lines = oneway ? Array.from({ length: e.lf - 1 }, (_, k) => (k + 1 - e.lf / 2) * 3.1) : [(e.lb - e.lf) * 3.1 / 2];
          for (const off of lines) dashes(ep, off, 0.16, oneway ? 3 : (e.cls <= 3 ? 1e9 : 3), oneway ? 6 : (e.cls <= 3 ? 0 : 5), (p, i) => zs[Math.min(i, zs.length - 1)] + 0.03, P(mp, mc, cMark));
        }
      } else if (drive) ribbon(ep, roadW(e), (p, i) => zs[i] - 0.03, P(rp, rc, e.cls === 9 ? cTrack : cService)); // service roads, drives, tracks
      else if (e.cls === 10) ribbon(ep, 5, (p, i) => zs[i] - 0.06, P(pp, pc, cPed));                                // pedestrian streets
      else ribbon(ep, e.cls === 13 ? 1.8 : 1.4, (p, i) => zs[i] - 0.08, P(fp, fc, e.cls === 12 ? cCycle : cFoot));     // footpaths, cycleways, steps
    }
    // zebra crossings just behind the stop line of signalised approaches
    for (const j of t.junctions) {
      if (j.ctrl !== 5) continue;
      const inc = (j.inc || []).map(([eid]) => city.edges.get(eid)).filter(e => e && (e.flags & FLAG.drive));
      const rJ = Math.max(4, ...inc.map(e => roadW(e))) / 2 + 0.6;
      for (const [eid, dir] of j.inc || []) {
        const e = city.edges.get(eid); if (!e || !e._dense || !(e.flags & FLAG.drive) || e.cls > 6) continue;
        const pts = dir === 1 ? e._dense.slice().reverse() : e._dense; // from the junction outwards
        if ((e.L || 0) < rJ + 14) continue;
        let acc = 0, at = null, ux = 0, uy = 0;
        for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + l >= rJ + 2.2) { const t2 = (rJ + 2.2 - acc) / l; at = [a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2]; ux = (b[0] - a[0]) / l; uy = (b[1] - a[1]) / l; break; } acc += l; }
        if (!at) continue;
        const w = roadW(e), z = H(at[0], at[1]) + 0.3;
        for (let s2 = -w / 2 + 0.4; s2 < w / 2 - 0.3; s2 += 1.0) quad(at[0] - uy * s2, at[1] + ux * s2, ux, uy, 2.6, 0.45, z, P(mp, mc, cMark));
      }
    }
    for (const l of t.lines) {
      const kind = city.codes.line[l.kind]; if ((l.flags & 1) || ['river', 'canal', 'stream'].includes(kind)) continue;
      ribbon(dense(l.pts), kind === 'tram' ? 2.6 : 3.4, p => H(p[0], p[1]) + 0.2, P(pp, pc, kind === 'tram' ? cTram : cRail));
    }
    for (const j of t.junctions) {
      const inc = (j.inc || []).map(([eid]) => city.edges.get(eid)).filter(e => e && (e.flags & FLAG.drive));
      if (inc.length < 2) continue;
      const wmax = Math.max(...inc.map(roadW)), r = wmax / 2 + 0.6, z = H(j.p[0], j.p[1]) + 0.25;
      const cj = inc.some(e => e.cls <= 3) ? cMajor : inc.every(e => e.cls >= 8) ? cService : cMinor;
      for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2; rp.push(j.p[0], z, -j.p[1], j.p[0] + Math.cos(a1) * r, z, -(j.p[1] + Math.sin(a1) * r), j.p[0] + Math.cos(a0) * r, z, -(j.p[1] + Math.sin(a0) * r)); for (let q = 0; q < 3; q++) rc.push(cj.r, cj.g, cj.b); }
    }
    for (const [ps, cs, m] of [[pp, pc, L ? M.paveL : M.pave], [rp, rc, L ? M.roadL : M.road], [mp, mc, L ? M.markL : M.mark]]) if (ps.length) { const mesh = meshFrom(ps, cs, m); mesh.receiveShadow = true; g.add(mesh); }
    if (fp.length) { const mesh = meshFrom(fp, fc, L ? M.paveL : M.pave); mesh.receiveShadow = true; mesh.userData.paths = true; mesh.visible = this._paths !== false; g.add(mesh); }
    // buildings
    const bmesh = this.buildBuildings(tile, L);
    if (bmesh) { g.add(bmesh); this.pickMeshes.push(bmesh); }
    // trees & street lamps
    this.buildTrees(tile, g, L);
    if (!L) { this.buildLamps(tile, g); this.buildBarriers(tile, g); } else this.barMeshes.delete(tile.key);
    this.groundMeshes.push(ground);
    this.scene.add(g);
    this.tileGroups.set(tile.key, { g, b: bmesh, ground });
    tile.justUnlocked = false;
  }

  buildBuildings(tile, locked) {
    const city = this.city, uses = city.codes.use;
    const P = [], C = [], UV = [], KS = [], tri2b = [];
    const c = new THREE.Color();
    const push = (x, y, z, col, u, v, kind, seed) => { P.push(x, z, -y); C.push(col.r * 255, col.g * 255, col.b * 255, 255); UV.push(u, v); KS.push(kind, seed, 0, 0); };
    const tri = (a, b, d, col, kind, seed, bi) => { push(a[0], a[1], a[2], col, a[3], a[4], kind, seed); push(b[0], b[1], b[2], col, b[3], b[4], kind, seed); push(d[0], d[1], d[2], col, d[3], d[4], kind, seed); tri2b.push(bi); };
    for (const bi of tile.bIdx) {
      const b = city.buildings[bi], useName = uses[b.use];
      const seed = (Math.abs(b.osm) * 2654435761 >>> 0) % 251;
      const dn = city.districts[b.district]?.name || '';
      const old = OLD_TOWN.test(dn) && b.area < 900;
      // colours: mapped colours first, otherwise a regional palette
      let wall = wallColor(useName, seed, old).clone(), roofC;
      if (b.col) { try { wall.setStyle(b.col); } catch (e) { } }
      const rs = city.codes.roof ? city.codes.roof[b.roof || 0] : 'unknown';
      const ob = obb(b.ring), rect = ob ? b.area / ob.area : 0;
      const residential = ['house', 'apartments', 'unknown', 'farm', 'minor', 'religious', 'civic', 'school'].includes(useName);
      let shape = 'flat';
      if (['gabled', 'half-hipped', 'saltbox', 'gambrel'].includes(rs)) shape = 'gabled';
      else if (['hipped', 'mansard'].includes(rs)) shape = 'hipped';
      else if (['pyramidal', 'cone', 'dome', 'onion', 'round'].includes(rs)) shape = 'pyramid';
      else if (rs === 'unknown' && ob && residential && rect > 0.78 && b.area < 900 && b.levels <= 6 && ob.wid < 18 && ob.wid > 4) shape = seed % 5 < 3 ? 'gabled' : 'hipped';
      if (shape !== 'flat' && (!ob || rect < 0.6)) shape = 'flat';
      roofC = (shape === 'flat' ? ROOF_FLAT[seed % ROOF_FLAT.length] : ROOF_PITCH[(seed >> 2) % ROOF_PITCH.length]).clone();
      if (b.rcol) { try { roofC.setStyle(b.rcol); } catch (e) { } }
      const slope = (useName === 'house' || old ? 50 : 38) * Math.PI / 180;
      const roofH = shape === 'flat' ? 0 : Math.min(10, b.rh ? b.rh / 10 : (ob.wid / 2) * Math.tan(slope));
      let zg = Infinity; for (const p of b.ring) zg = Math.min(zg, city.heightAt(p[0], p[1]));
      if (b.zOrig === undefined) b.zOrig = b.z;
      // Very tall religious outlines (e.g. the cathedral, whose spire is a separate building part in the map data) keep a nave-height body
      const hBody = useName === 'religious' && b.h > 35 ? Math.min(b.h, 32) : b.h;
      const z0 = Math.min(b.zOrig, zg) - 0.4, h = Math.max(2.5, hBody) + (b.zOrig - z0);
      b.z = z0;
      const eave = z0 + (shape === 'flat' ? h : Math.max(2.6, b.est ? h : h - roofH));
      const style = wallStyle(useName, b, old);
      b.vStart = P.length / 3; b.z1 = eave + roofH; b.zEave = eave;
      // walls (u = distance along the facade, v = height above ground)
      const parapet = shape === 'flat' && b.area > 150 ? 0.8 : 0, wTop = eave + parapet;
      const walls = ring => { let u = 0; for (let k = 0; k < ring.length; k++) { const a = ring[k], d = ring[(k + 1) % ring.length], l = Math.hypot(d[0] - a[0], d[1] - a[1]); const A = [a[0], a[1], z0, u, 0], B = [d[0], d[1], z0, u + l, 0], C2 = [d[0], d[1], wTop, u + l, wTop - z0], D = [a[0], a[1], wTop, u, wTop - z0]; tri(A, B, C2, wall, style, seed, bi); tri(A, C2, D, wall, style, seed, bi); u += l; } };
      walls(b.ring); for (const hr of b.holes) walls(hr);
      if (shape === 'flat' && b.area > 260 && !locked) { // rooftop plant: air handlers, lift rooms
        const R2 = rng(seed * 7919 + bi), nBox = Math.min(9, Math.floor(b.area / 320));
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of b.ring) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
        const plant = new THREE.Color(0xc4c3be);
        for (let k = 0, tries = 0; k < nBox && tries < 40; tries++) {
          const cx = x0 + R2() * (x1 - x0), cy = y0 + R2() * (y1 - y0), sx = 1.2 + R2() * 2, sy = 1 + R2() * 1.6, hgt = 1 + R2() * 1.4;
          if (![[cx - sx, cy - sy], [cx + sx, cy - sy], [cx + sx, cy + sy], [cx - sx, cy + sy]].every(p => inRing(p, b.ring))) continue;
          const zt = eave + hgt, c4 = [[cx - sx, cy - sy], [cx + sx, cy - sy], [cx + sx, cy + sy], [cx - sx, cy + sy]];
          for (let q = 0; q < 4; q++) { const a = c4[q], d = c4[(q + 1) % 4]; tri([a[0], a[1], eave, 0, 9], [d[0], d[1], eave, 1, 9], [d[0], d[1], zt, 1, 9], plant, 6, seed, bi); tri([a[0], a[1], eave, 0, 9], [d[0], d[1], zt, 1, 9], [a[0], a[1], zt, 0, 9], plant, 6, seed, bi); }
          tri([c4[0][0], c4[0][1], zt, 0, 0], [c4[1][0], c4[1][1], zt, 0, 0], [c4[2][0], c4[2][1], zt, 0, 0], plant, 1, seed, bi); tri([c4[0][0], c4[0][1], zt, 0, 0], [c4[2][0], c4[2][1], zt, 0, 0], [c4[3][0], c4[3][1], zt, 0, 0], plant, 1, seed, bi);
          k++;
        }
      }
      // roofs
      if (shape === 'flat') triangulate(b.ring, b.holes, null, (p0, p1, p2) => tri([p0[0], p0[1], eave, p0[0], p0[1]], [p1[0], p1[1], eave, p1[0], p1[1]], [p2[0], p2[1], eave, p2[0], p2[1]], roofC, 1, seed, bi));
      else {
        const o = 0.4, hl = ob.len / 2 + o, hw = ob.wid / 2 + o, R = eave + roofH, [ax, ay] = ob.ax, [bx, by] = ob.ay, [cx, cy] = ob.c;
        const pt = (u, v, z, su, sv) => [cx + ax * u + bx * v, cy + ay * u + by * v, z, su, sv];
        const sl = Math.hypot(hw, roofH);
        const A = pt(-hl, -hw, eave, 0, 0), B = pt(hl, -hw, eave, ob.len, 0), C2 = pt(hl, hw, eave, ob.len, 0), D = pt(-hl, hw, eave, 0, 0);
        if (shape === 'pyramid' || (shape === 'hipped' && ob.len - ob.wid < 1)) {
          const X = pt(0, 0, R, ob.len / 2, sl);
          tri(A, B, X, roofC, 2, seed, bi); tri(B, C2, X, roofC, 2, seed, bi); tri(C2, D, X, roofC, 2, seed, bi); tri(D, A, X, roofC, 2, seed, bi);
        } else {
          const inset = shape === 'hipped' ? ob.wid / 2 : -o;
          const r1 = pt(-hl + inset + o, 0, R, 0, sl), r2 = pt(hl - inset - o, 0, R, ob.len, sl);
          tri(A, B, r2, roofC, 2, seed, bi); tri(A, r2, r1, roofC, 2, seed, bi);
          tri(C2, D, r1, roofC, 2, seed, bi); tri(C2, r1, r2, roofC, 2, seed, bi);
          if (shape === 'hipped') { tri(D, A, r1, roofC, 2, seed, bi); tri(B, C2, r2, roofC, 2, seed, bi); }
          else { const g1 = [...r1.slice(0, 3), 0, R - z0], g2 = [...r2.slice(0, 3), 0, R - z0]; tri([...D.slice(0, 3), 0, eave - z0], [...A.slice(0, 3), 2, eave - z0], g1, wall, 6, seed, bi); tri([...B.slice(0, 3), 0, eave - z0], [...C2.slice(0, 3), 2, eave - z0], g2, wall, 6, seed, bi); }
        }
      }
      b.vCount = P.length / 3 - b.vStart; b.baseCol = wall;
    }
    if (!P.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Uint8Array.from(C), 4, true));
    geo.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(UV), 2));
    geo.setAttribute('aKS', new THREE.BufferAttribute(Uint8Array.from(KS), 4, true));
    geo.setAttribute('aTint', new THREE.BufferAttribute(new Uint8Array(KS.length), 4, true));
    geo.computeBoundsTree({ indirect: true });
    const m = new THREE.Mesh(geo, locked ? this.matBL : this.matB);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.tri2b = Int32Array.from(tri2b); m.userData.tile = tile.key;
    for (const bi of tile.bIdx) city.buildings[bi].mesh = m;
    return m;
  }
  buildTrees(tile, g, locked) {
    const city = this.city, t = tile.data, R = rng(strHash(tile.key)), items = { broad: [], needle: [] };
    const tr = t.trees || [];
    for (let i = 0; i < tr.length; i += 4) { const x = t.origin[0] + tr[i] / 10, y = t.origin[1] + tr[i + 1] / 10; (tr[i + 2] === 1 ? items.needle : items.broad).push([x, y, tr[i + 3] ? tr[i + 3] / 10 : 0]); }
    // parks, woods and green spaces without individually mapped trees get planted procedurally
    const codes = city.codes.area;
    for (const a of t.areas) {
      const kind = codes[a.kind], dens = kind === 'forest' ? 1 / 90 : kind === 'park' ? 1 / 420 : kind === 'cemetery' ? 1 / 300 : kind === 'scrub' ? 1 / 250 : 0;
      if (!dens) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of a.ring) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const nTry = Math.min(1600, (x1 - x0) * (y1 - y0) * dens);
      for (let k = 0; k < nTry; k++) { const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0); if (!inRing([x, y], a.ring) || a.holes.some(h => inRing([x, y], h))) continue; (kind === 'forest' && R() < 0.3 ? items.needle : items.broad).push([x, y, 0]); }
    }
    for (const [k, list] of Object.entries(items)) {
      if (!list.length) continue;
      const m = new THREE.InstancedMesh(this.treeGeo[k], locked ? this.mat.treeL : this.mat.tree, list.length);
      const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
      list.forEach(([x, y, hh], i) => {
        const h = hh || 8 + R() * 8; s.set(h / 12 * (0.85 + R() * 0.3), h / 12, h / 12 * (0.85 + R() * 0.3));
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28); p.set(x, city.heightAt(x, y), -y);
        mat4.compose(p, q, s); m.setMatrixAt(i, mat4);
        c.setHSL(k === 'needle' ? 0.33 : 0.24 + R() * 0.08, 0.35 + R() * 0.15, 0.27 + R() * 0.1); m.setColorAt(i, c);
      });
      m.castShadow = GFX[this.gfx].treeShadows; m.receiveShadow = false; m.userData.tree = true; m.computeBoundingSphere();
      g.add(m);
    }
  }
  // Fences, walls and hedges: two instanced meshes per tile (solid / see-through); rebuilt when a section is knocked down.
  buildBarriers(tile, g) {
    const old = this.barMeshes.get(tile.key); if (old) for (const m of old) { m.parent?.remove(m); m.geometry.dispose(); m.dispose(); }
    const segs = (tile.barSegs || []).filter(s => !s.dead); if (!segs.length) { this.barMeshes.delete(tile.key); return; }
    const city = this.city, items = { s: [], t: [] }, col = new THREE.Color();
    for (const s of segs) {
      const look = BARRIER_LOOK[s.kind] || BARRIER_LOOK.fence, seed = Math.abs(Math.sin(s.ax * 12.9898 + s.ay * 78.233)) * 43758.5 % 1;
      const pal = look[0], c = pal[Math.floor(seed * pal.length) % pal.length];
      if (s.kind === 'muret') { // low masonry wall topped by a railing
        const base = Math.min(0.6, s.h * 0.5);
        items.s.push([s, base, look[1], c, 7]);
        items.t.push([s, s.h - base, 0.04, [0x2b2e30, 0x3a4a3d, 0xd8d6cf][Math.floor(seed * 30) % 3], 3, base]);
      } else (look[2] ? items.t : items.s).push([s, s.h, look[1], c, BARRIER_KINDS_IDX[s.kind] ?? 0]);
    }
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), m4 = new THREE.Matrix4(), out = [];
    const shadows = !!GFX[this.gfx].barShadows;
    for (const [key, list] of Object.entries(items)) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(this.barGeo, key === 's' ? this.mat.barS : this.mat.barT, list.length), aK = new Float32Array(list.length);
      list.forEach(([s, h, th, c, k, lift = 0], i) => {
        const za = city.heightAt(s.ax, s.ay) + lift, zb = city.heightAt(s.bx, s.by) + lift, dx = s.bx - s.ax, dy = s.by - s.ay, L = Math.hypot(dx, dy) || 0.01, ux = dx / L, uy = dy / L;
        X.set(dx, zb - za, -dy);
        if (s.down) {
          if (s.kind === 'hedge') { Y.set(0, 0.35, 0); Z.set(uy, 0, ux).multiplyScalar(th * 1.3); m4.makeBasis(X, Y, Z).setPosition(s.ax, za - 0.05, -s.ay); }
          else { Y.set(uy, 0, ux).multiplyScalar(h); Z.set(0, Math.max(0.03, th), 0); m4.makeBasis(X, Y, Z).setPosition(s.ax, za + Math.max(0.03, th) / 2 + 0.02, -s.ay); }
        } else { Y.set(0, h, 0); Z.set(uy, 0, ux).multiplyScalar(th); m4.makeBasis(X, Y, Z).setPosition(s.ax, za - 0.04, -s.ay); }
        mesh.setMatrixAt(i, m4); col.setHex(c); mesh.setColorAt(i, col); aK[i] = k + (s.down ? 100 : 0);
      });
      mesh.geometry = this.barGeo.clone(); mesh.geometry.setAttribute('aK', new THREE.InstancedBufferAttribute(aK, 1));
      mesh.castShadow = key === 's' && shadows; mesh.userData.barShadow = key === 's'; mesh.receiveShadow = key === 's'; mesh.userData.paths = true; mesh.visible = this._paths !== false;
      mesh.computeBoundingSphere(); g.add(mesh); out.push(mesh);
    }
    this.barMeshes.set(tile.key, out);
  }
  updateBarriers() {
    const B = this.city.bars; if (!B.dirty.size) return;
    for (const k of B.dirty) { const tg = this.tileGroups.get(k), tile = this.city.tiles.get(k); if (tg && tile && tile.unlocked) this.buildBarriers(tile, tg.g); }
    B.dirty.clear();
  }
  buildLamps(tile, g) {
    const city = this.city, t = tile.data, pts = [], pools = [];
    const add = (x, y) => { const z = city.heightAt(x, y); pts.push(x, z + 7, -y); pools.push([x, y, z]); };
    const lm = t.lamps || []; for (let i = 0; i < lm.length; i += 2) add(t.origin[0] + lm[i] / 10, t.origin[1] + lm[i + 1] / 10);
    if (lm.length < 20) for (const e of t.edges) { // procedural lighting along urban streets where lamps are not mapped
      if (!(e.flags & FLAG.drive) || e.cls < 2 || e.cls > 7 || (e.flags & FLAG.tunnel)) continue;
      const w = Math.max(1, e.lf + e.lb) * 1.55 + 2.2; let acc = 0, side = 1;
      for (let i = 1; i < e.pts.length; i++) { const a = e.pts[i - 1], b = e.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.1) continue; const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l; for (let s = (30 - acc % 30); s < l; s += 30) { add(a[0] + ux * s - uy * w * side, a[1] + uy * s + ux * w * side); side = -side; } acc += l; }
    }
    if (!pts.length) return;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const glow = new THREE.Points(pg, this.lampMat); glow.frustumCulled = true; g.add(glow);
    const qg = new THREE.PlaneGeometry(1, 1); qg.rotateX(-Math.PI / 2);
    const pm = new THREE.InstancedMesh(qg, this.poolMat, pools.length), m4 = new THREE.Matrix4();
    pools.forEach(([x, y, z], i) => { m4.makeScale(22, 1, 22); m4.setPosition(x, z + 0.4, -y); pm.setMatrixAt(i, m4); });
    pm.computeBoundingSphere(); g.add(pm);
  }
  // Smoke columns from burning / infested buildings: soft rising particles (custom point shader with per-particle alpha & size).
  initSmoke() {
    const N = 2400, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(N), 1)); g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(N), 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { map: { value: glowTex() }, col: { value: new THREE.Color(0x4a4744) }, scale: { value: 400 } },
      vertexShader: 'attribute float aA; attribute float aS; varying float vA; uniform float scale; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 col; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(col, t.a * vA); if (gl_FragColor.a < 0.01) discard; }' });
    this.smoke = new THREE.Points(g, m); this.smoke.frustumCulled = false; this.smoke.renderOrder = 7; this.scene.add(this.smoke); this.smokeP = []; this.smokeN = N;
  }
  updateSmoke(sources, dt) {
    if (!this.smoke) this.initSmoke();
    const P = this.smokeP;
    for (const s of sources) { s.acc = (s.acc || 0) + dt * s.rate; while (s.acc >= 1 && P.length < this.smokeN) { s.acc--; P.push({ x: s.x + (Math.random() - .5) * s.r, y: s.y + (Math.random() - .5) * s.r, z: s.z, age: 0, life: 7 + Math.random() * 5, sz: 6 + Math.random() * 6 }); } }
    const pos = this.smoke.geometry.attributes.position, A = this.smoke.geometry.attributes.aA, S = this.smoke.geometry.attributes.aS;
    let n = 0;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.age += dt; if (p.age > p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      p.z += dt * 3.2; p.x += dt * 1.6; p.y += dt * 0.6;
      const k = p.age / p.life; pos.setXYZ(n, p.x, p.z, -p.y); A.setX(n, 0.42 * Math.min(1, k * 6) * (1 - k)); S.setX(n, p.sz * (1 + k * 3)); n++;
    }
    pos.needsUpdate = true; A.needsUpdate = true; S.needsUpdate = true; this.smoke.geometry.setDrawRange(0, n);
    this.smoke.material.uniforms.scale.value = this.h * 0.9;
  }
  // State tint for one building (rgb 0..1, strength 0..1) and collapse of damaged buildings.
  paintBuilding(b, tint, a, collapse = 0, pulse = false) {
    const m = b.mesh; if (!m || m.material === this.matBL) return;
    const ta = m.geometry.attributes.aTint, pa = m.geometry.attributes.position, arr = ta.array;
    const r = Math.round(tint.r * 255), gg = Math.round(tint.g * 255), bb = Math.round(tint.b * 255), a8 = Math.round(a * 254), al = pulse ? (a8 | 1) : (a8 & ~1);
    for (let v = 0; v < b.vCount; v++) { const i = (b.vStart + v) * 4; arr[i] = r; arr[i + 1] = gg; arr[i + 2] = bb; arr[i + 3] = al; }
    ta.addUpdateRange(b.vStart * 4, b.vCount * 4); ta.needsUpdate = true;
    if (collapse !== b.collapsed) {
      const top = b.z + (b.zEave - b.z) * (1 - collapse * 0.8);
      for (let v = 0; v < b.vCount; v++) { const i = b.vStart + v; if (pa.getY(i) > b.z + 0.01) pa.setY(i, Math.min(pa.getY(i), top)); }
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
function triangulate(ring, holes, emit, triCb) {
  if (ring.length < 3) return;
  const c = ring.map(p => new THREE.Vector2(p[0], p[1])), hs = (holes || []).filter(h => h.length >= 3).map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(c, hs); } catch { return; }
  const all = [...ring, ...(holes || []).filter(h => h.length >= 3).flat()];
  const ccw = THREE.ShapeUtils.isClockWise(c) ? false : true;
  for (const f of faces) { const [a, b, d] = ccw ? f : [f[0], f[2], f[1]]; if (triCb) triCb(all[a], all[b], all[d]); else { emit(all[a]); emit(all[b]); emit(all[d]); } }
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

function inRing(p, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
// Dashed line offset sideways from a polyline (on/off in metres).
function dashes(pts, off, w, on, gap, zf, emit) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.1) continue;
    const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l, nx = -uy, ny = ux, z = zf(a, i - 1);
    let s = 0;
    while (s < l) {
      const ph = acc % (on + gap), seg = ph < on ? Math.min(on - ph, l - s) : Math.min(on + gap - ph, l - s);
      if (ph < on && seg > 0.05) { const x0 = a[0] + ux * s + nx * off, y0 = a[1] + uy * s + ny * off, x1 = x0 + ux * seg, y1 = y0 + uy * seg; const hx = nx * w / 2, hy = ny * w / 2;
        emit(x0 - hx, z, y0 - hy); emit(x1 - hx, z, y1 - hy); emit(x1 + hx, z, y1 + hy); emit(x0 - hx, z, y0 - hy); emit(x1 + hx, z, y1 + hy); emit(x0 + hx, z, y0 + hy); }
      s += Math.max(seg, 0.01); acc += Math.max(seg, 0.01);
    }
  }
}
function quad(cx, cy, ux, uy, len, wid, z, emit) {
  const ax = ux * len / 2, ay = uy * len / 2, bx = -uy * wid / 2, by = ux * wid / 2;
  emit(cx - ax - bx, z, cy - ay - by); emit(cx + ax - bx, z, cy + ay - by); emit(cx + ax + bx, z, cy + ay + by);
  emit(cx - ax - bx, z, cy - ay - by); emit(cx + ax + bx, z, cy + ay + by); emit(cx - ax + bx, z, cy - ay + by);
}
let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); _glow = new THREE.CanvasTexture(c); return _glow;
}
function treeGeometry(needle) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.22, 0.32, 3.2, 5); trunk.translate(0, 1.6, 0); parts.push([trunk, 0x5a4636]);
  if (needle) { const c1 = new THREE.ConeGeometry(2.6, 6.5, 7); c1.translate(0, 5.6, 0); const c2 = new THREE.ConeGeometry(1.9, 4.5, 7); c2.translate(0, 8.6, 0); parts.push([c1, 0xffffff], [c2, 0xffffff]); }
  else { const c1 = new THREE.IcosahedronGeometry(3.4, 0); c1.scale(1, 0.95, 1); c1.translate(0, 6.6, 0); const c2 = new THREE.IcosahedronGeometry(2.4, 0); c2.translate(1.2, 8.4, 0.6); parts.push([c1, 0xffffff], [c2, 0xffffff]); }
  // trunk keeps its own brown via vertex colour; crowns are white so instance colours tint them
  const pos = [], col = [], c = new THREE.Color();
  for (const [g0, hex] of parts) { const g = g0.index ? g0.toNonIndexed() : g0; c.setHex(hex); const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 3) { pos.push(a[i], a[i + 1], a[i + 2]); col.push(c.r, c.g, c.b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
