// City layer: entry point, game loop, input, HUD.
import * as THREE from 'three';
import { City } from './city.js';
import { Renderer, USE_COLORS } from './render.js';
import { Sim } from './sim.js';
import { ITEM } from '../catalog.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Math.round(v).toLocaleString('en-US');
const CIV_COLS = [0x8a8f96, 0xb8bcc2, 0x3c4a5c, 0x6b2b2b, 0x2f4f3a, 0xd0c8b0, 0x404448, 0x7a6a50, 0x1f2a44, 0x9c9ea0];

export async function enterTactical(o) {
  const root = document.createElement('div'); root.id = 'tac'; root.innerHTML = TEMPLATE; document.body.appendChild(root);
  // HUD panels only touch the DOM when their content actually changes
  const D = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  for (const id of ['tStats', 'tUnits', 'tCmd', 'tHvt', 'tFeed', 'tSel']) { const el = root.querySelector('#' + id); Object.defineProperty(el, 'innerHTML', { set(v) { if (v !== el._h) { el._h = v; D.set.call(el, v); } }, get() { return D.get.call(el); } }); }
  const setLoad = t => { $('#tLoad b', root).textContent = t; };
  const city = new City(o.base);
  let R, sim, raf, alive = true, speed = 1, mode = null, sel = [], selB = null, lastHud = 0, dragging = null, keys = {}, result = null;
  try {
    setLoad('Reading survey data…');
    await city.init();
    // impact building in the reported district
    const want = (o.district || '').replace(/^the /i, '').toLowerCase();
    let dIdx = city.districts.findIndex(d => d.name.toLowerCase().includes(want) || want.includes(d.name.toLowerCase()));
    if (want.includes('grande') || want.includes('centre')) dIdx = city.districts.findIndex(d => d.name === 'Centre');
    const dist = city.districts[dIdx] || city.districts[0];
    const centre = dist ? [dist.x, dist.y] : [0, 0];
    const R0 = 1800;
    setLoad('Loading city blocks…');
    await city.ensureTiles(tilesAround(city, centre, R0), true);
    await city.ensureTiles(tilesAround(city, centre, R0 + 1100).filter(k => !city.tiles.has(k)), false);
    city.buildGraph();
    const cands = city.buildings.filter(b => b.district === dIdx && city.unlockedAt(b.c[0], b.c[1]) && [city.use.apartments, city.use.house, city.use.retail, city.use.unknown, city.use.office].includes(b.use) && b.pop0 > 60);
    cands.sort((a, b) => Math.hypot(a.c[0] - centre[0], a.c[1] - centre[1]) - Math.hypot(b.c[0] - centre[0], b.c[1] - centre[1]));
    const impact = cands[Math.floor(Math.random() * Math.min(40, cands.length))] || city.buildings.find(b => city.unlockedAt(b.c[0], b.c[1]));
    // re-centre unlock on the impact building
    setLoad('Building 3D city…');
    R = new Renderer($('#tCanvas', root), city);
    for (const t of city.tiles.values()) { R.buildTile(t); await frame(); }
    R.cc.target.set(impact.c[0], impact.z, -impact.c[1]); R.cc.dist = 900; R.cc.yaw = 0.7; R.cc.pitch = 0.85;
    sim = new Sim(city, { threat: o.threat, threatName: o.threatName, cityName: o.cityName, clock: o.clock, unlockR: R0, supply: o.supply, severity: o.severity });
    sim.start(impact, o.forces, o.forces.map(f => f.approach));
    window.__tac = { city, sim, R };
    $('#tLoad', root).style.display = 'none';
  } catch (e) {
    console.error(e); setLoad('Failed to load the city: ' + e.message); await new Promise(r => setTimeout(r, 2500)); root.remove(); return { aborted: true };
  }
  const threatCol = new THREE.Color(o.threatColor);

  return new Promise(resolve => {
    // ---------------- loop ----------------
    let last = performance.now(), lastLbl = 0;
    const perf = makePerf(root, R, sim);
    let slow = 0;
    function adapt() { const f = perf.avgFrame(); if (f > 30) slow++; else slow = Math.max(0, slow - 1); if (slow > 12 && R.pixelRatio > 1) { R.setQuality(Math.max(1, R.pixelRatio - 0.25)); slow = 0; sim.log(`Render resolution lowered to ${R.pixelRatio.toFixed(2)}× to keep the frame rate up (F3 for details).`); } }
    const loop = now => {
      if (!alive) return;
      const dtR = Math.min(0.1, (now - last) / 1000); last = now;
      panCamera(dtR);
      const t0 = performance.now();
      if (speed && !result) { let t = dtR * speed; while (t > 0) { const s = Math.min(0.1, t); sim.step(s); t -= s; } }
      const t1 = performance.now(); paintBuildings(); drawDynamic(); const t2 = performance.now(); R.render(); const t3 = performance.now();
      if (now - lastLbl > 90) { lastLbl = now; drawLabels(); }
      const t4 = performance.now();
      perf.push(dtR * 1000, t1 - t0, t2 - t1, t3 - t2, t4 - t3);
      if (now - lastHud > 250) { lastHud = now; hud(); checkEnd(); checkUnlock(); perf.show(); adapt(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ---------------- camera ----------------
    function panCamera(dt) {
      const c = R.cc, sp = c.dist * 0.9 * dt;
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
      let mx = 0, mz = 0;
      if (keys.w || keys.arrowup) { mx += fx; mz += fz; } if (keys.s || keys.arrowdown) { mx -= fx; mz -= fz; }
      if (keys.d || keys.arrowright) { mx += rx; mz += rz; } if (keys.a || keys.arrowleft) { mx -= rx; mz -= rz; }
      if (keys.q) c.yaw += dt * 1.4; if (keys.e) c.yaw -= dt * 1.4; if (keys.r) c.pitch += dt; if (keys.f) c.pitch -= dt;
      c.target.x += mx * sp; c.target.z += mz * sp;
      c.target.y += ((city.heightAt(c.target.x, -c.target.z)) - c.target.y) * Math.min(1, dt * 4);
    }
    const cv = $('#tCanvas', root);
    cv.addEventListener('wheel', e => {
      e.preventDefault(); const c = R.cc, f = Math.exp(e.deltaY * 0.0012), r = cv.getBoundingClientRect();
      const hit = R.groundPick(e.clientX - r.left, e.clientY - r.top);
      const nd = Math.max(40, Math.min(6000, c.dist * f));
      if (hit && f < 1) { const k = 1 - nd / c.dist; c.target.x += (hit.p[0] - c.target.x) * k; c.target.z += (-hit.p[1] - c.target.z) * k; }
      c.dist = nd;
    }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      dragging = { b: e.button, x, y, sx: x, sy: y, yaw: R.cc.yaw, pitch: R.cc.pitch, moved: false, alt: e.altKey };
    });
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (!dragging) { hover(x, y); return; }
      if (Math.abs(x - dragging.sx) + Math.abs(y - dragging.sy) > 5) dragging.moved = true;
      if (dragging.b === 1 || (dragging.b === 0 && dragging.alt)) { R.cc.yaw = dragging.yaw - (x - dragging.sx) * 0.006; R.cc.pitch = dragging.pitch + (y - dragging.sy) * 0.005; }
      else if (dragging.b === 0 && dragging.moved) { const bx = $('#tBox', root); bx.style.display = 'block'; Object.assign(bx.style, { left: Math.min(x, dragging.sx) + 'px', top: Math.min(y, dragging.sy) + 'px', width: Math.abs(x - dragging.sx) + 'px', height: Math.abs(y - dragging.sy) + 'px' }); }
      else if (dragging.b === 2 && dragging.moved) { const c = R.cc, k = c.dist * 0.0016; const dx = x - dragging.x, dy = y - dragging.y; c.target.x += (-dx * Math.cos(c.yaw) - dy * Math.sin(c.yaw)) * k; c.target.z += (dx * Math.sin(c.yaw) - dy * Math.cos(c.yaw)) * k; dragging.panned = true; }
      dragging.x = x; dragging.y = y;
    });
    cv.addEventListener('pointerup', e => {
      const d = dragging; dragging = null; if (!d) return; $('#tBox', root).style.display = 'none';
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (d.b === 0 && !d.alt) { if (d.moved) boxSelect(d.sx, d.sy, x, y, e.shiftKey); else leftClick(x, y, e.shiftKey); }
      if (d.b === 2 && !d.panned) rightClick(x, y, e.shiftKey);
    });
    const kd = e => { if (e.target.tagName === 'INPUT') return; const k = e.key.toLowerCase(); keys[k] = true;
      if (k === ' ') { e.preventDefault(); speed = speed ? 0 : 1; }
      if (k === '1') speed = 1; if (k === '2') speed = 3; if (k === '3') speed = 8; if (k === '4') speed = 16;
      if (k === 'f3') { e.preventDefault(); perf.toggle(); }
      if (k === 'escape') { mode = null; sel = []; selB = null; updateSel(); }
      if (k === 'g' && selB) cmd('mark'); if (k === 'h') cmd('hold');
    };
    const ku = e => { keys[e.key.toLowerCase()] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);

    // ---------------- selection & orders ----------------
    function unitAt(x, y) {
      let best = null, bd = 18 * 18;
      for (const u of sim.units) { if (u.dead) continue; const s = R.toScreen(u.x, u.y, u.inB ? u.inB.z1 : (u.kind === 'heli' ? 60 : city.heightAt(u.x, u.y) + 1)); if (!s) continue; const d = (s[0] - x) ** 2 + (s[1] - y) ** 2; if (d < bd) { bd = d; best = u; } }
      return best;
    }
    function leftClick(x, y, add) {
      if (mode === 'outpost' || mode === 'camp') { const h = R.pick(x, y); if (h) { const err = sim.placeSite(mode, h.p); if (err) flash(err); } mode = null; updateSel(); return; }
      if (mode === 'quarantine') { const h = R.pick(x, y); if (h?.building) sim.toggleQuarantine(h.building.district); mode = null; updateSel(); return; }
      const u = unitAt(x, y);
      if (u) { if (add) { sel.includes(u) ? sel.splice(sel.indexOf(u), 1) : sel.push(u); } else sel = [u]; selB = null; updateSel(); return; }
      const h = R.pick(x, y); const prevB = selB; selB = h?.building && city.unlockedAt(h.building.c[0], h.building.c[1]) ? h.building : null; if (prevB) sim.dirty(prevB); if (selB) sim.dirty(selB); if (!add) sel = []; updateSel();
    }
    function boxSelect(x0, y0, x1, y1, add) {
      const [a, b, c, d] = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
      const got = sim.units.filter(u => { if (u.dead) return false; const s = R.toScreen(u.x, u.y, city.heightAt(u.x, u.y) + 1); return s && s[0] >= a && s[0] <= c && s[1] >= b && s[1] <= d; });
      sel = add ? [...new Set([...sel, ...got])] : got; selB = null; updateSel();
    }
    function rightClick(x, y, shift) {
      if (!sel.length) return;
      const h = R.pick(x, y); if (!h) return;
      if (h.building && city.unlockedAt(h.building.c[0], h.building.c[1])) {
        const b = h.building, hasHvt = sim.hvts.some(v => v.b === b && v.state === 'inside');
        sel.forEach((u, i) => sim.order(u, { type: b.infest > 0.1 ? 'clear' : hasHvt ? 'extract' : (u.kind === 'squad' && i === 0 ? 'garrison' : 'move'), b, p: b.ent, manual: true }));
        ping(b.ent, b.infest > 0.1 ? 0xff5050 : 0x7fe3ff);
      } else {
        const n = sel.length, cols = Math.ceil(Math.sqrt(n));
        sel.forEach((u, i) => { const ox = (i % cols - (cols - 1) / 2) * 14, oy = (Math.floor(i / cols) - (cols - 1) / 2) * 14; sim.order(u, { type: 'move', p: [h.p[0] + ox, h.p[1] + oy], manual: true }); });
        ping(h.p, 0x7fe36f);
      }
      updateSel();
    }
    let pings = [];
    function ping(p, col) { pings.push({ p, col, t: 0.8 }); }
    function cmd(c) {
      if (c === 'hold') sel.forEach(u => sim.order(u, { type: 'move', p: [u.x, u.y], manual: true }));
      if (c === 'release') sel.forEach(u => { u.manual = false; u.order = null; });
      if (c === 'outpost' || c === 'camp' || c === 'quarantine') { mode = c; }
      if (c === 'mark' && selB) { sim.garrisonMarks.has(selB.idx) ? sim.garrisonMarks.delete(selB.idx) : sim.garrisonMarks.add(selB.idx); sim.dirty(selB); }
      if (c === 'qsel' && selB) sim.toggleQuarantine(selB.district);
      if (c === 'evac' && selB) { sim.evacZones.push({ c: selB.c, r: 300 }); sim.log(`Evacuation ordered around ${selB.name || selB.addr || 'the selected block'} (300 m).`); }
      updateSel();
    }
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-c]'); if (t) { cmd(t.dataset.c); return; }
      const u = e.target.closest('[data-u]'); if (u) { const un = sim.units.find(x => x.id === +u.dataset.u); if (un) { if (e.shiftKey) sel.push(un); else sel = [un]; selB = null; updateSel(); if (e.detail === 2) R.cc.target.set(un.x, 0, -un.y); } }
      const sp = e.target.closest('[data-speed]'); if (sp) speed = +sp.dataset.speed;
      const tg = e.target.closest('[data-cmdk]'); if (tg) { sim.cmd[tg.dataset.cmdk] = !sim.cmd[tg.dataset.cmdk]; hud(true); }
      const hv = e.target.closest('[data-hvt]'); if (hv) { const h = sim.hvts.find(x => x.id === hv.dataset.hvt); if (h) { R.cc.target.set(h.x, 0, -h.y); R.cc.dist = Math.min(R.cc.dist, 600); selB = h.b; sel = []; updateSel(); } }
      if (e.target.id === 'tEnd') endOperation(false);
      if (e.target.id === 'tPerfBtn') perf.toggle();
    });
    function hover(x, y) { /* reserved for tooltips */ }
    function flash(t) { sim.log(t, 'warn'); }

    // ---------------- painting ----------------
    const tmp = new THREE.Color(), dark = new THREE.Color(0x1b1e22), amber = new THREE.Color(0xe0a030), blue = new THREE.Color(0x3d7dff), teal = new THREE.Color(0x40d0b0), pale = new THREE.Color(0x9fd8ff), white = new THREE.Color(0xffffff);
    function paintBuildings() {
      const list = sim.dirtyB || []; if (!list.length) return;
      const batch = list.splice(0, 800);
      for (const b of batch) {
        b.colorDirty = false; if (!b.mesh) continue;
        tmp.copy(b.baseCol);
        if (sim.quarantine.has(b.district)) tmp.lerp(amber, 0.28);
        if (b.evac && b.occ < b.pop0 * 0.1) tmp.multiplyScalar(0.6);
        if (b.state === 2) tmp.lerp(teal, 0.3);
        if (b.infest > 0.05) tmp.lerp(threatCol, 0.35 + b.infest * 0.55);
        if (sim.garrisonMarks.has(b.idx)) tmp.lerp(pale, 0.3);
        if (b.garrison.length) tmp.lerp(blue, 0.55);
        const dmg = 1 - b.hp / b.hp0; if (dmg > 0) tmp.lerp(dark, dmg * 0.7);
        if (b === selB) tmp.lerp(white, 0.35);
        R.paintBuilding(b, tmp, b.destroyed ? 1 : dmg > 0.5 ? (dmg - 0.5) : 0);
      }
    }
    // ---------------- dynamic draw ----------------
    function drawDynamic() {
      const D = R.dyn, far = R.cc.dist > 1100;
      let nc = 0, np = 0, nb = 0;
      const bp = D.blips.geometry.attributes.position, bc = D.blips.geometry.attributes.color;
      const blip = (x, y, z, r, g, b) => { if (nb >= 12000) return; bp.setXYZ(nb, x, z + 2, -y); bc.setXYZ(nb, r, g, b); nb++; };
      for (const c of sim.cars) {
        const p = sim.carPos(c);
        if (far) { const k = c.kind === 'police' ? [0.3, 0.5, 1] : c.kind === 'ambulance' ? [1, 1, 1] : [0.75, 0.75, 0.7]; blip(p[0], p[1], p[2], ...k); continue; }
        if (nc < 6000) R.setInst(D.cars, nc++, p[0], p[1], p[2], p[3], p[4], 1, c.kind === 'police' ? (Math.floor(sim.t * 3) % 2 ? 0x2a5bd7 : 0xf0f0f0) : c.kind === 'ambulance' ? 0xf2f2f2 : CIV_COLS[Math.floor(c.id * 10)]);
      }
      R.commit(D.cars, far ? 0 : nc);
      for (const p of sim.peds) { const z = city.heightAt(p.x, p.y); if (far) { blip(p.x, p.y, z, 0.9, 0.85, 0.6); continue; } if (np < 6000) R.setInst(D.peds, np++, p.x, p.y, z, 1, 0); }
      R.commit(D.peds, far ? 0 : np);
      // creatures
      let ncr = 0; const cs = Math.max(1, R.cc.dist / 450) * sim.P.size;
      for (const c of sim.creatures) { if (c.inB || !c.vis) continue; const z = city.heightAt(c.x, c.y); if (ncr < 4000) R.setInst(D.creatures, ncr++, c.x, c.y, z, c.hx, c.hy, cs, o.threatColor); if (far) blip(c.x, c.y, z, 1, 0.25, 0.25); }
      R.commit(D.creatures, ncr);
      // forces
      let ns = 0, nv = 0, nh = 0, nr = 0, nd = 0;
      for (const c of sim.creatures) { if (c.inB || nd > 3000 || !(c.vis || c.ghost)) continue; R.setInstS(D.discs, nd++, c.x, c.y, city.heightAt(c.x, c.y) + 0.35, (c.vis ? 2.4 : 1.6) * cs, 1, (c.vis ? 2.4 : 1.6) * cs, c.vis ? 0xff3b3b : 0x7a3030); }
      const us = Math.max(1, R.cc.dist / 500);
      for (const u of sim.units) {
        if (u.dead) continue;
        const z = city.heightAt(u.x, u.y);
        if (u.kind === 'squad' && u.riding) R.setInst(D.vehicles, nv++, u.x, u.y, z, u.hx, u.hy, us * 0.8);
        else if (u.kind === 'squad' && !u.inB) { const cols = 3; for (let i = 0; i < u.men; i++) { const ox = ((i % cols) - 1) * 2.2 * us, oy = (Math.floor(i / cols) - 1) * 2.2 * us; const rx = ox * u.hy + oy * u.hx, ry = -ox * u.hx + oy * u.hy; R.setInst(D.soldiers, ns++, u.x + rx, u.y + ry, z, u.hx, u.hy, us); } }
        if (u.kind === 'vehicle') R.setInst(D.vehicles, nv++, u.x, u.y, z, u.hx, u.hy, us);
        if (u.kind === 'heli') R.setInst(D.helis, nh++, u.x, u.y, 60, u.hx, u.hy, us);
        if (far) blip(u.x, u.y, u.kind === 'heli' ? 60 : z, 0.5, 1, 0.45);
        R.setInstS(D.discs, nd++, u.x, u.y, (u.kind === 'heli' ? 60 : u.inB ? u.inB.z1 : z) + 0.4, (u.kind === 'squad' ? 5 : 6) * us, 1, (u.kind === 'squad' ? 5 : 6) * us, 0x5ee07a);
        if (sel.includes(u)) R.setInstS(D.rings, nr++, u.x, u.y, (u.kind === 'heli' ? 60 : u.inB ? u.inB.z1 : z) + 0.5, 7 * us, 1, 7 * us);
      }
      R.commit(D.discs, nd); R.commit(D.soldiers, ns); R.commit(D.vehicles, nv); R.commit(D.helis, nh);
      // sites (rings) and markers (HVT beacons, checkpoints, sites)
      let nm = 0;
      for (const s of sim.sites) { R.setInstS(D.rings, nr++, s.p[0], s.p[1], city.heightAt(s.p[0], s.p[1]) + 0.6, s.r, 1, s.r); R.setInstS(D.markers, nm++, s.p[0], s.p[1], city.heightAt(s.p[0], s.p[1]), 3, s.built ? 18 : 8, 3, s.kind === 'staging' ? 0x7fe36f : s.kind === 'safezone' ? 0xffffff : s.built ? 0x7fe3ff : 0xc9a227); }
      for (const h of sim.hvts) { if (h.state !== 'inside' && h.state !== 'escorted') continue; const z = h.state === 'inside' ? h.b.z1 : city.heightAt(h.x, h.y) + 4; R.setInstS(D.markers, nm++, h.x, h.y, z, 1.2 * us, 30 * us, 1.2 * us, h.danger > 0.2 ? 0xff5050 : 0xffd23f); }
      for (const cp of sim.checkpoints) R.setInstS(D.markers, nm++, cp.p[0], cp.p[1], city.heightAt(cp.p[0], cp.p[1]), 2.5, 10, 2.5, cp.guards.length ? 0x7fe36f : 0xff7040);
      for (const p of pings) { p.t -= 0.016; if (p.t > 0) R.setInstS(D.rings, nr++, p.p[0], p.p[1], city.heightAt(p.p[0], p.p[1]) + 0.7, 4 + (0.8 - p.t) * 20, 1, 4 + (0.8 - p.t) * 20); }
      pings = pings.filter(p => p.t > 0);
      R.commit(D.rings, nr); R.commit(D.markers, nm);
      bp.needsUpdate = true; bc.needsUpdate = true; D.blips.geometry.setDrawRange(0, nb);
      // tracers
      const tp = D.tracers.geometry.attributes.position; let nt = 0;
      for (const t of sim.tracers) { if (nt >= 4000) break; const za = city.heightAt(t.a[0], t.a[1]) + t.a[2], zb = city.heightAt(t.b[0], t.b[1]) + t.b[2]; tp.setXYZ(nt * 2, t.a[0], za, -t.a[1]); tp.setXYZ(nt * 2 + 1, t.b[0], zb, -t.b[1]); nt++; }
      tp.needsUpdate = true; D.tracers.geometry.setDrawRange(0, nt * 2);
      // lines: order paths of selected units, quarantine cordon segments
      const lp = D.lines.geometry.attributes.position, lc = D.lines.geometry.attributes.color; let nl = 0;
      const seg = (a, b, za, zb, c) => { if (nl >= 8000) return; lp.setXYZ(nl * 2, a[0], za, -a[1]); lp.setXYZ(nl * 2 + 1, b[0], zb, -b[1]); lc.setXYZ(nl * 2, c[0], c[1], c[2]); lc.setXYZ(nl * 2 + 1, c[0], c[1], c[2]); nl++; };
      for (const u of sel) { if (u.dead || !u.order) continue; const t = u.order.p || u.order.b?.ent || u.order.site?.p; if (!t) continue; let prev = [u.x, u.y]; const pts = (u.path || []).slice(0, 40).concat([t]); for (const q of pts) { seg(prev, q, city.heightAt(prev[0], prev[1]) + 1.5, city.heightAt(q[0], q[1]) + 1.5, u.order.type === 'clear' ? [1, 0.35, 0.35] : [0.5, 1, 0.5]); prev = q; } }
      for (const cp of sim.checkpoints) seg(cp.a, cp.b, city.heightAt(cp.a[0], cp.a[1]) + 1, city.heightAt(cp.b[0], cp.b[1]) + 1, cp.guards.length ? [0.5, 1, 0.5] : [1, 0.55, 0.2]);
      lp.needsUpdate = true; lc.needsUpdate = true; D.lines.geometry.setDrawRange(0, nl * 2);
      // day / night lighting
      const h = (new Date(sim.clock).getUTCHours() + 1 + new Date(sim.clock).getUTCMinutes() / 60) % 24;
      const day = Math.max(0, Math.min(1, (Math.sin((h - 6) / 24 * Math.PI * 2) + 0.25) * 1.3));
      R.scene.children.forEach(l => { if (l.isHemisphereLight) l.intensity = 0.35 + day * 0.85; if (l.isDirectionalLight) l.intensity = 0.15 + day * 1.25; });
      R.scene.background.setRGB(0.02 + day * 0.03, 0.03 + day * 0.04, 0.05 + day * 0.04); R.scene.fog.color.copy(R.scene.background);
    }
    // ---------------- labels ----------------
    const pool = []; let poolN = 0;
    function lbl(cls, x, y, text) {
      let el = pool[poolN]; if (!el) { el = document.createElement('div'); $('#tLabels', root).appendChild(el); pool.push(el); el._t = ''; el._c = ''; }
      if (el._t !== text) { el.textContent = text; el._t = text; } if (el._c !== cls) { el.className = 'tl ' + cls; el._c = cls; }
      el.style.transform = `translate(${x | 0}px,${y | 0}px) translate(-50%,-100%)`; el.style.display = ''; poolN++;
    }
    function drawLabels() {
      poolN = 0;
      const vis = s => s && s[0] > -50 && s[1] > -20 && s[0] < R.w + 50 && s[1] < R.h + 20;
      if (R.cc.dist < 2600) for (const d of city.districts) { if (!d.buildings.length || !city.unlockedAt(d.x, d.y)) continue; const s = R.toScreen(d.x, d.y, 40); if (vis(s)) lbl('dist' + (sim.quarantine.has(d.id) ? ' q' : ''), s[0], s[1], d.name + (sim.quarantine.has(d.id) ? ' · QUARANTINE' : '')); }
      for (const h of sim.hvts) { if (h.state !== 'inside' && h.state !== 'escorted') continue; const s = R.toScreen(h.x, h.y, h.state === 'inside' ? h.b.z1 + 32 : 40); if (vis(s)) lbl('hvt' + (h.danger > 0.2 ? ' d' : ''), s[0], s[1], '★ ' + h.name); }
      for (const u of sel) { if (u.dead) continue; const s = R.toScreen(u.x, u.y, (u.kind === 'heli' ? 60 : city.heightAt(u.x, u.y)) + 12); if (vis(s)) lbl('unit', s[0], s[1], u.name); }
      for (const st of sim.sites) { const s = R.toScreen(st.p[0], st.p[1], city.heightAt(st.p[0], st.p[1]) + 22); if (vis(s)) lbl('site', s[0], s[1], st.name + (st.kind === 'safezone' ? ` · ${Math.round(st.people)} civilians` : st.built ? '' : ' (setting up)')); }
      for (let i = poolN; i < pool.length; i++) if (pool[i].style.display !== 'none') pool[i].style.display = 'none';
    }
    // ---------------- HUD ----------------
    function hud(force) {
      const s = sim.summary(), st = sim.stats;
      const date = new Date(sim.clock), hh = String((date.getUTCHours() + 1) % 24).padStart(2, '0'), mm = String(date.getUTCMinutes()).padStart(2, '0');
      $('#tTop .clock', root).textContent = `${hh}:${mm}${sim.isNight() ? ' ☾' : ''}`;
      $('#tStats', root).innerHTML = [
        ['Integrity', Math.round(s.integrity) + '%', s.integrity < 50 ? 'bad' : ''], ['In zone', num(s.inside)], ['Evacuated', num(st.evacuated), 'good'], ['Civ. casualties', num(st.civDead), st.civDead > 0 ? 'bad' : ''],
        ['Contacts', s.tracked, s.tracked ? 'bad' : ''], ['Infested (known)', s.known, s.known ? 'bad' : ''], ['Safe zones', sim.sites.filter(z => z.kind === 'safezone').reduce((a, z) => a + Math.round(z.people), 0)], ['HVT', `${st.hvtSaved}✓ ${st.hvtLost}✗ / ${sim.hvts.length}`], ['Supply', Math.round(sim.supply)], ['KIA', st.soldiersKIA, st.soldiersKIA ? 'bad' : ''], ['Samples', st.specimens],
      ].map(([l, v, c]) => `<div><span>${l}</span><b class="${c || ''}">${v}</b></div>`).join('');
      root.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === speed));
      if (!root.querySelector('#tLeft:hover') || force) $('#tUnits', root).innerHTML = sim.units.map(u => {
        const hpP = u.dead ? 0 : u.hp / u.maxHp * 100, ord = u.dead ? 'Destroyed' : u.inB ? `Garrisoned · ${u.inB.name || u.inB.addr || 'building'}` : u.order ? ({ move: 'Moving', garrison: 'To garrison', clear: 'Clearing', extract: 'Extracting HVT', resupply: 'Resupplying', guard: u.order.zone ? 'Securing safe zone' : 'Guarding checkpoint', build: 'Building site', recon: 'Reconnaissance orbit' })[u.order.type] : 'Idle';
        return `<div class="tu ${sel.includes(u) ? 'on' : ''} ${u.dead ? 'dead' : ''}" data-u="${u.id}"><div class="row"><b>${esc(u.name)}</b><span class="sp"></span><span class="mut">${u.kind === 'squad' ? u.men + '/' + u.pers : u.vehicle ? esc(ITEM[u.vehicle].name) : ''}</span></div>
          <div class="bars"><i style="width:${hpP}%;background:${hpP > 50 ? '#5ec98c' : hpP > 25 ? '#d6c446' : '#e5484d'}"></i></div><div class="bars am"><i style="width:${Math.max(0, u.ammo)}%"></i></div>
          <div class="mut" style="font-size:11px">${ord}${u.manual ? ' · direct' : ''}${u.carrying.length ? ' · ★ ' + u.carrying.length : ''}${u.kills ? ' · ' + u.kills + ' kills' : ''}</div></div>`;
      }).join('') + sim.pending.map(p => { const sec = (p.at - sim.clock) / 1000; return `<div class="tu dead"><div class="row"><b>${esc(p.f.name)}</b><span class="sp"></span><span class="mut">${p.f.vehicle ? esc(ITEM[p.f.vehicle].name) : p.f.pers + ' men'}</span></div><div class="mut" style="font-size:11px">En route · ETA ${sec >= 3600 ? Math.floor(sec / 3600) + ' h ' : ''}${Math.floor(sec % 3600 / 60)} min · staging ${p.f.approach}</div></div>`; }).join('');
      $('#tCmd', root).innerHTML = [['garrisonKey', 'Garrison key buildings & HVTs'], ['clear', 'Clear infested buildings'], ['manCheckpoints', 'Man quarantine checkpoints'], ['resupply', 'Auto-resupply']].map(([k, l]) => `<label class="row" data-cmdk="${k}"><span class="tg ${sim.cmd[k] ? 'on' : ''}"></span>${l}</label>`).join('');
      if (!root.querySelector('#tRight:hover')) $('#tHvt', root).innerHTML = sim.hvts.map(h => `<div class="row hv ${h.state}" data-hvt="${h.id}"><span>${h.state === 'saved' ? '✓' : h.state === 'lost' ? '✗' : h.state === 'escorted' ? '➜' : '★'}</span><span class="sp">${esc(h.name)}<span class="mut"> · ${h.role}</span></span><span class="mut">${h.state === 'inside' ? (h.danger > 0.2 ? '<b class="bad">danger</b>' : 'sheltering') : h.state}</span></div>`).join('');
      $('#tFeed', root).innerHTML = sim.events.slice(0, 6).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('');
      if (!root.querySelector('#tSel:hover')) updateSel(true);
    }
    function updateSel(soft) {
      const P = $('#tSel', root);
      $('#tMode', root).textContent = mode === 'outpost' ? 'Click the map to place a supply outpost (12 supply)' : mode === 'camp' ? 'Click the map to place a forward camp (30 supply)' : mode === 'quarantine' ? 'Click a building to quarantine its district' : sel.length ? 'Right-click: move · right-click building: garrison / clear / extract HVT' : 'Drag to select forces · middle-drag rotate · wheel zoom · WASD pan';
      if (selB) {
        const b = selB, d = city.districts[b.district], hv = sim.hvts.find(h => h.b === b);
        const state = b.destroyed ? '<b class="bad">Collapsed</b>' : b.infest > 0.1 ? `<b class="bad">Infested ${Math.round(b.infest * 100)}%</b>` : b.garrison.length ? '<b class="acc">Garrisoned</b>' : b.state === 2 ? '<b class="good">Cleared</b>' : b.evac ? 'Evacuating' : 'Normal';
        P.innerHTML = `<div class="title">${esc(b.name || b.addr || city.codes.use[b.use])}</div><div class="mut">${esc(b.name && b.addr ? b.addr + ' · ' : '')}${esc(d?.name || '')}</div>
          <div class="stats"><span>Use</span><span>${city.codes.use[b.use]}</span><span>Floors / height</span><span>${b.levels} / ${b.h.toFixed(0)} m${b.est ? ' (est.)' : ''}</span><span>Occupants</span><span>${num(b.occ)} / ${num(b.pop0)}</span><span>Status</span><span>${state}</span><span>Structure</span><span>${Math.round(b.hp / b.hp0 * 100)}%</span>${b.dead >= 1 ? `<span>Casualties</span><span class="bad">${num(b.dead)}</span>` : ''}${hv ? `<span>HVT</span><span class="amb">★ ${esc(hv.name)} (${hv.state})</span>` : ''}</div>
          <div class="row wrap" style="margin-top:8px"><button data-c="mark">${sim.garrisonMarks.has(b.idx) ? 'Unmark garrison' : 'Mark for garrison (G)'}</button><button data-c="evac">Evacuate 300 m</button><button data-c="qsel">${sim.quarantine.has(b.district) ? 'Lift quarantine' : 'Quarantine ' + esc(d?.name || 'district')}</button></div>`;
        P.style.display = 'block';
      } else if (sel.length === 1) {
        const u = sel[0];
        P.innerHTML = `<div class="title">${esc(u.name)}</div><div class="mut">${u.kind === 'squad' ? 'Infantry squad' : esc(ITEM[u.vehicle]?.name || '')}</div><div class="stats"><span>Strength</span><span>${u.kind === 'squad' ? u.men + ' / ' + u.pers + ' men' : Math.round(u.hp / u.maxHp * 100) + '%'}</span><span>Ammunition</span><span>${Math.round(u.ammo)}%</span><span>Firepower</span><span>${Math.round(u.fire * (u.kind === 'squad' ? u.men : 1))}</span><span>Range</span><span>${u.range} m</span><span>Protection</span><span>${Math.round(u.armor * 100)}%${u.gear ? ' + ' + u.gear.toUpperCase() : ''}</span><span>Kills</span><span>${u.kills}</span></div>
          <div class="row" style="margin-top:8px"><button data-c="hold">Hold (H)</button><button data-c="release">Return to commander</button></div>`;
        P.style.display = 'block';
      } else if (sel.length > 1) { P.innerHTML = `<div class="title">${sel.length} units selected</div><div class="row" style="margin-top:8px"><button data-c="hold">Hold</button><button data-c="release">Return to commander</button></div>`; P.style.display = 'block'; }
      else P.style.display = 'none';
      root.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === mode));
    }
    // ---------------- unlock & end ----------------
    let unlocking = false;
    async function checkUnlock() {
      if (unlocking || !sim.checkSpread()) return;
      unlocking = true; const nr = sim.unlockR + 1000;
      sim.log(`The outbreak is spreading beyond the operation area — area expanded to ${(nr / 1000).toFixed(1)} km.`, 'warn');
      const keysIn = tilesAround(city, sim.origin, nr), ring = tilesAround(city, sim.origin, nr + 1100);
      const prevUnlocked = new Set([...city.tiles.values()].filter(t => t.unlocked).map(t => t.key));
      await city.ensureTiles(keysIn, true); await city.ensureTiles(ring.filter(k => !city.tiles.has(k)), false);
      city.buildGraph();
      for (const t of city.tiles.values()) if (!R.tileGroups.has(t.key) || (t.unlocked && !prevUnlocked.has(t.key))) { R.buildTile(t); await frame(); }
      sim.unlockR = nr; sim.pickHVTs(); sim.refreshFields();
      unlocking = false;
    }
    function checkEnd() {
      if (result) return;
      const s = sim.summary();
      if (sim.t > 45 && s.creatures === 0 && s.infested === 0) return endOperation(true);
      if (sim.units.every(u => u.dead)) return endOperation(false, 'All forces lost.');
      if (s.integrity <= 5 && sim.t > 120) return endOperation(false, 'The city has fallen.');
    }
    function endOperation(success, why) {
      const s = sim.summary(), st = sim.stats;
      if (!success && !why && !confirm_()) return;
      result = { success, why: why || (success ? 'Threat eliminated.' : 'Forces withdrawn.'), stats: { ...st, civDead: Math.round(st.civDead), evacuated: Math.round(st.evacuated) }, integrity: s.integrity, clock: sim.clock,
        units: sim.units.map(u => ({ ref: u.ref, dead: u.dead, men: u.kind === 'squad' ? u.men : (u.dead ? 0 : u.pers) })), popAffected: s.pop0, hvts: sim.hvts.map(h => ({ name: h.name, role: h.role, state: h.state })) };
      speed = 0;
      const M = $('#tEndDlg', root);
      M.innerHTML = `<div class="dlg"><h2>${success ? 'Threat eliminated' : 'Operation ended'} — ${esc(o.cityName)}</h2><div class="mut">${esc(result.why)}</div>
        <div class="stats" style="margin-top:10px"><span>City integrity</span><span>${Math.round(s.integrity)}%</span><span>Civilians evacuated</span><span>${num(st.evacuated)}</span><span>Civilian casualties</span><span class="bad">${num(st.civDead)}</span><span>Hostiles killed</span><span>${st.kills}</span><span>Soldiers killed</span><span>${st.soldiersKIA}</span><span>Vehicles lost</span><span>${st.vehiclesLost}</span><span>Buildings destroyed</span><span>${st.bDestroyed}</span><span>HVTs evacuated / lost</span><span>${st.hvtSaved} / ${st.hvtLost}</span><span>Samples recovered</span><span>${st.specimens}</span></div>
        <div class="foot"><button class="pri" id="tBack">Return to strategic command</button></div></div>`;
      M.style.display = 'flex';
      $('#tBack', root).onclick = () => { alive = false; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); R.dispose(); root.remove(); window.__tac = null; resolve(result); };
    }
    function confirm_() { const s = sim.summary(); if (s.creatures || s.infested) { if (!root.dataset.confirmEnd) { root.dataset.confirmEnd = 1; sim.log('Hostiles remain. Click "End operation" again to withdraw (counts as a failure).', 'warn'); setTimeout(() => delete root.dataset.confirmEnd, 5000); return false; } } return true; }
    hud(); updateSel();
  });
}

function tilesAround(city, c, r) {
  const T = city.T, out = [];
  for (let i = Math.floor((c[0] - r) / T); i <= Math.floor((c[0] + r) / T); i++) for (let j = Math.floor((c[1] - r) / T); j <= Math.floor((c[1] + r) / T); j++) {
    const nx = Math.max(i * T, Math.min(c[0], (i + 1) * T)), ny = Math.max(j * T, Math.min(c[1], (j + 1) * T));
    if (Math.hypot(nx - c[0], ny - c[1]) <= r) out.push(`${i}_${j}`);
  }
  return out;
}
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

const TEMPLATE = `
<canvas id="tCanvas"></canvas><div id="tLabels"></div><div id="tBox"></div>
<div id="tTop"><b class="op">OPERATION</b><span class="clock mono"></span><div class="row" style="gap:3px"><button class="sm" data-speed="0">❚❚</button><button class="sm" data-speed="1">▶</button><button class="sm" data-speed="3">▶▶</button><button class="sm" data-speed="8">▶▶▶</button><button class="sm" data-speed="16" title="16× (4)">▶▶▶▶</button></div><button class="sm" id="tPerfBtn" title="Performance overlay (F3)">F3</button><div id="tStats"></div><span class="sp"></span><button class="warn sm" id="tEnd">End operation</button></div>
<div id="tLeft"><div class="lbl">Forces</div><div id="tUnits"></div><div class="lbl" style="margin-top:10px">Ground commander</div><div id="tCmd"></div></div>
<div id="tRight"><div class="lbl">High value targets</div><div id="tHvt"></div></div>
<div id="tSel"></div>
<div id="tBar"><div class="row" style="gap:4px"><button data-c="outpost">Supply outpost</button><button data-c="camp">Forward camp</button><button data-c="quarantine">Quarantine district</button><button data-c="hold">Hold (H)</button></div><div id="tMode" class="mut"></div></div>
<div id="tFeed"></div><div id="tEndDlg"></div>
<div id="tLoad"><div class="col" style="align-items:center;gap:10px"><div class="spin"></div><b>Loading…</b></div></div>`;

function makePerf(root, R, sim) {
  const N = 90, buf = Array.from({ length: 5 }, () => new Float32Array(N)); let i = 0, on = false;
  const el = document.createElement('div'); el.id = 'tPerf'; el.style.display = 'none'; root.appendChild(el);
  const avg = k => { let s = 0; for (const v of buf[k]) s += v; return s / N; };
  return {
    push(...v) { v.forEach((x, k) => buf[k][i] = x); i = (i + 1) % N; },
    avgFrame: () => avg(0),
    toggle() { on = !on; el.style.display = on ? 'block' : 'none'; },
    show() {
      if (!on) return; const f = avg(0), info = R.r.info.render;
      el.innerHTML = `<b>${(1000 / f).toFixed(0)} FPS</b> · frame ${f.toFixed(1)} ms<br>simulation ${avg(1).toFixed(2)} ms · scene update ${avg(2).toFixed(2)} ms<br>render submit ${avg(3).toFixed(2)} ms · labels ${avg(4).toFixed(2)} ms<br>draw calls ${info.calls} · triangles ${(info.triangles / 1e6).toFixed(2)} M<br>agents: ${sim.cars.length} cars · ${sim.peds.length} on foot · ${sim.creatures.length} hostiles<br>resolution ${R.pixelRatio.toFixed(2)}× <button class="sm" data-q="-0.25">−</button> <button class="sm" data-q="0.25">+</button>`;
      el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => R.setQuality(Math.max(0.5, Math.min(2, R.pixelRatio + +b.dataset.q))));
    },
  };
}
