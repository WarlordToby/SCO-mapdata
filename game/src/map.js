import { d3, WORLD, makeProjection } from './geo.js';
import { THREATS, ITEM, isHeli } from './catalog.js';
import { G as WG, W as GW, H as GH, RES, cellLonLat } from './world.js';
import { infImage, FALL } from './outbreak.js';
import { packFor } from './packs.js';

const DPR = () => Math.min(2, window.devicePixelRatio || 1);

export class MapView {
  constructor(canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.o = opts; // opts: mode 'world'|'nation', terr, regions, getState, onClick, onHover
    this.k = 1; this.x = 0; this.y = 0; this.hover = null; this.mouse = null; this.static = document.createElement('canvas'); this.dirty = true;
    this.resize(); this.bind();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement);
    const loop = () => { if (this.dead) return; this.draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }
  destroy() { this.dead = true; this.ro.disconnect(); }
  resize() {
    const r = this.c.parentElement.getBoundingClientRect(), d = DPR();
    this.w = r.width; this.h = r.height;
    for (const cv of [this.c, this.static]) { cv.width = r.width * d; cv.height = r.height * d; }
    this.c.style.width = r.width + 'px'; this.c.style.height = r.height + 'px';
    const pad = this.o.mode === 'world' ? 20 : 40;
    const left = this.o.padLeft || 0, right = this.o.padRight || 0;
    if (this.o.mode === 'world') this.proj = d3.geoEqualEarth().fitExtent([[pad + left, pad], [r.width - pad - right, r.height - pad]], { type: 'Sphere' });
    else if (this.o.mode === 'strat') this.proj = d3.geoEquirectangular().fitExtent([[left + 10, 60], [r.width - right - 10, r.height - 40]], { type: 'Sphere' });
    else this.proj = makeProjection(this.o.terr).fitExtent([[pad + left, pad + 30], [r.width - pad - right, r.height - pad - 30]], this.o.terr);
    this.path = d3.geoPath(this.proj); this.dirty = true;
  }
  setPad(l, r) { this.o.padLeft = l; this.o.padRight = r; this.resize(); }
  toScreen(ll) { const p = this.proj(ll); return p ? [p[0] * this.k + this.x, p[1] * this.k + this.y] : null; }
  toGeo(sx, sy) { return this.proj.invert([(sx - this.x) / this.k, (sy - this.y) / this.k]); }
  focus(ll, k = 3) { const p = this.proj(ll); this.k = k; this.x = this.w / 2 - p[0] * k + (this.o.padLeft || 0) / 2 - (this.o.padRight || 0) / 2; this.y = this.h / 2 - p[1] * k; this.dirty = true; }
  bind() {
    const c = this.c; let drag = null, moved = false;
    c.addEventListener('wheel', e => {
      e.preventDefault(); const f = Math.exp(-e.deltaY * 0.0015), nk = Math.max(1, Math.min(this.o.mode === 'world' ? 12 : this.o.mode === 'strat' ? 60 : 40, this.k * f));
      const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      this.x = mx - (mx - this.x) * nk / this.k; this.y = my - (my - this.y) * nk / this.k; this.k = nk; this.dirty = true;
    }, { passive: false });
    c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ox: this.x, oy: this.y }; moved = false; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(); this.mouse = [e.clientX - r.left, e.clientY - r.top];
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; if (moved) { this.x = drag.ox + dx; this.y = drag.oy + dy; this.dirty = true; } }
      this.hover = this.hit(...this.mouse); c.style.cursor = this.o.cursor?.() || (this.hover ? 'pointer' : drag && moved ? 'grabbing' : 'default');
      this.o.onHover?.(this.hover, this.mouse);
    });
    c.addEventListener('pointerup', e => { if (drag && !moved) { const r = c.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; this.o.onClick?.(this.hit(sx, sy), this.toGeo(sx, sy)); } drag = null; });
    c.addEventListener('pointerleave', () => { this.mouse = null; this.hover = null; this.o.onHover?.(null); });
  }
  hit(sx, sy) {
    if (this.o.mode === 'world') {
      const g = this.toGeo(sx, sy); if (!g) return null;
      const f = WORLD.find(f => d3.geoContains(f, g)); return f ? { type: 'country', f } : null;
    }
    const S = this.o.getState(); if (!S) return null;
    let best = null, bd = 1e9;
    if (this.o.mode === 'strat') {
      const test = (type, obj, ll, r) => { const p = this.toScreen(ll); if (!p) return; const d = Math.hypot(p[0] - sx, p[1] - sy); if (d < r && d < bd) { bd = d; best = { type, obj }; } };
      for (const f of S.fronts || []) test('front', f, [f.lon, f.lat], 12);
      for (const rq of S.world?.requests || []) if (rq.state === 'open') test('request', rq, [rq.lon, rq.lat], 12);
      for (const c of S.foreign || []) test('city', c, [c.lon, c.lat], 10);
      for (const b of S.bases) test('base', b, [b.lon, b.lat], 10);
      if (best) return best;
      for (const c of this.visibleCities()) test('wcity', c, [c.lon, c.lat], 8);
      return best;
    }
    const test = (type, obj, ll, r) => { const p = this.toScreen(ll); if (!p) return; const d = Math.hypot(p[0] - sx, p[1] - sy); if (d < r && d < bd) { bd = d; best = { type, obj }; } };
    for (const u of S.units) if (u.status !== 'ready') test('unit', u, [u.lon, u.lat], 10);
    for (const b of S.bases) test('base', b, [b.lon, b.lat], 12);
    if (best) return best;
    for (const c of S.cities) test('city', c, [c.lon, c.lat], Math.max(7, this.cityR(c) + 4));
    return best;
  }
  cityR(c) { return Math.max(2.2, Math.sqrt(c.pop) / 160) * Math.min(2, Math.sqrt(this.k)); }

  drawStatic() {
    const d = DPR(), ctx = this.static.getContext('2d'), k = this.k;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, this.w, this.h);
    const g = ctx.createRadialGradient(this.w * .55, this.h * .45, 50, this.w * .5, this.h * .5, Math.max(this.w, this.h));
    g.addColorStop(0, '#0d1820'); g.addColorStop(1, '#060b10'); ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(d * k, 0, 0, d * k, d * this.x, d * this.y);
    const path = d3.geoPath(this.proj, ctx);
    ctx.lineWidth = 0.6 / k; ctx.strokeStyle = '#ffffff0c'; ctx.beginPath(); path(d3.geoGraticule10()); ctx.stroke();
    if (this.o.mode === 'world') { ctx.beginPath(); path({ type: 'Sphere' }); ctx.strokeStyle = '#3a5566'; ctx.lineWidth = 1 / k; ctx.stroke(); }
    if (this.o.mode === 'strat') return this.drawStratStatic(ctx, path, k);
    for (const f of WORLD) {
      ctx.beginPath(); path(f);
      ctx.fillStyle = this.o.mode === 'world' ? '#18242d' : '#141c22'; ctx.fill();
      ctx.strokeStyle = this.o.mode === 'world' ? '#2c3d49' : '#24313a'; ctx.lineWidth = 0.7 / k; ctx.stroke();
    }
    if (this.o.mode === 'nation') {
      const t = this.o.terr;
      ctx.save(); ctx.shadowColor = '#3fd0ff55'; ctx.shadowBlur = 18 * d;
      ctx.beginPath(); path(t); ctx.fillStyle = '#1b2c36'; ctx.fill(); ctx.restore();
      if (WG.ready) { ctx.save(); ctx.beginPath(); path(t); ctx.clip(); ctx.globalAlpha = 0.55; this.cellsInView().forEach(k2 => { const t2 = WG.lc.subarray(k2 * 7, k2 * 7 + 7); const r = 38 * t2[0] + 86 * t2[1] + 118 * t2[2] + 112 * t2[3] + 150 * t2[4] + 52 * t2[5], gg = 64 * t2[0] + 104 * t2[1] + 116 * t2[2] + 108 * t2[3] + 132 * t2[4] + 82 * t2[5], b = 38 * t2[0] + 62 * t2[1] + 70 * t2[2] + 104 * t2[3] + 100 * t2[4] + 104 * t2[5], s2 = t2[0] + t2[1] + t2[2] + t2[3] + t2[4] + t2[5] || 1; ctx.fillStyle = `rgb(${r / s2 * 0.5 | 0},${gg / s2 * 0.5 | 0},${b / s2 * 0.5 | 0})`; this.cellQuad(ctx, k2); ctx.fill(); }); ctx.restore(); }
      if (this.o.regions) { ctx.beginPath(); for (const r of this.o.regions.features) path(r); ctx.strokeStyle = '#4b6b7c55'; ctx.lineWidth = 0.8 / k; ctx.setLineDash([3 / k, 3 / k]); ctx.stroke(); ctx.setLineDash([]); }
      ctx.beginPath(); path(t); ctx.strokeStyle = '#59c8e8'; ctx.lineWidth = 1.4 / k; ctx.stroke();
    }
    this.dirty = false;
  }

  // land cells within the national map (cached), and a cell's outline in map coordinates
  cellsInView() {
    if (this._cells) return this._cells;
    const [[x0, y0], [x1, y1]] = d3.geoBounds(this.o.terr), out = [];
    for (let lat = y0 - RES; lat <= y1 + RES; lat += RES) for (let lon = x0 - RES; lon <= x1 + RES; lon += RES) { const i = Math.floor((lon + 180) / RES), j = Math.floor((90 - lat) / RES); if (i < 0 || j < 0 || i >= GW || j >= GH) continue; const k = WG.idx[j * GW + i]; if (k >= 0) out.push(k); }
    return (this._cells = [...new Set(out)]);
  }
  cellQuad(ctx, k) {
    const [lon, lat] = cellLonLat(WG.cell[k]), h = RES / 2;
    const a = this.proj([lon - h, lat + h]), b = this.proj([lon + h, lat + h]), c = this.proj([lon + h, lat - h]), d = this.proj([lon - h, lat - h]); if (!a || !b || !c || !d) return;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  }
  visibleCities() { const minPop = this.k > 8 ? 2.5e5 : this.k > 3 ? 6e5 : 1.5e6; return WG.ready ? WG.cities.filter(c => c.pop >= minPop || (c.capital && this.k > 2.5)) : []; }
  drawStratStatic(ctx, path, k) {
    const p0 = this.proj([-180, 90]), p1 = this.proj([180, -90]);
    ctx.fillStyle = '#0a141b'; ctx.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
    if (WG.ready) { ctx.imageSmoothingEnabled = k < 6; ctx.drawImage(WG.landImg, p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]); ctx.imageSmoothingEnabled = true; }
    const S = this.o.getState();
    ctx.lineWidth = 0.6 / k; ctx.strokeStyle = '#ffffff22';
    for (const f of WORLD) { ctx.beginPath(); path(f); ctx.stroke(); }
    if (S) { const home = WORLD.find(f => f.id === S.ccn3); if (home) { ctx.beginPath(); path(home); ctx.strokeStyle = '#59c8e8'; ctx.lineWidth = 1.4 / k; ctx.stroke(); } }
    this.dirty = false;
  }
  drawStrat(ctx) {
    const S = this.o.getState(); if (!S) return;
    const now = performance.now(), pulse = (Math.sin(now / 300) + 1) / 2;
    // infestation layer (re-rendered when the outbreak advances)
    if (S.world && (!this._infCv || this._infSig !== S.t)) { if (!this._infT || now - this._infT > 400) { this._infCv = infImage(S, this._infCv); this._infSig = S.t; this._infT = now; } }
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.k, this.k);
    const p0 = this.proj([-180, 90]), p1 = this.proj([180, -90]);
    if (this._infCv) { ctx.imageSmoothingEnabled = this.k < 6; ctx.drawImage(this._infCv, p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]); ctx.imageSmoothingEnabled = true; }
    const path = d3.geoPath(this.proj, ctx);
    for (const h of this._infCv?.hotspots || []) { const p = this.proj([h.lon, h.lat]); if (!p) continue; const r = Math.sqrt(h.cells) * (p1[0] - p0[0]) / 1440 * 0.9 + 6 / this.k; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.strokeStyle = `rgba(255,70,60,${0.5 + pulse * 0.4})`; ctx.lineWidth = 1.6 / this.k; ctx.stroke(); ctx.fillStyle = 'rgba(255,60,50,0.12)'; ctx.fill(); }
    for (const u of S.units) if (u.route && (u.status === 'transit' || u.status === 'returning')) { ctx.beginPath(); path({ type: 'LineString', coordinates: [[u.lon, u.lat], u.route.to] }); ctx.strokeStyle = u.status === 'returning' ? '#9aa7b055' : '#7fe3ffaa'; ctx.lineWidth = 1.2 / this.k; ctx.setLineDash([2 / this.k, 3 / this.k]); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
    // cities
    ctx.font = '600 10.5px ui-sans-serif,system-ui'; ctx.textBaseline = 'middle'; const placed = [];
    const inf = S.world?.inf;
    for (const c of this.visibleCities()) {
      const p = this.toScreen([c.lon, c.lat]); if (!p || p[0] < -10 || p[1] < -10 || p[0] > this.w + 10 || p[1] > this.h + 10) continue;
      const x = inf ? inf[c.k] : 0, r = Math.max(1.8, Math.sqrt(c.pop) / 900) * Math.min(2, Math.sqrt(this.k));
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fillStyle = x >= FALL ? '#444' : x > 0.1 ? '#ff6b5b' : x > 0.01 ? '#e8b04a' : '#cfe3ea'; ctx.fill();
      if (packFor(c.cc, c.name)) { ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 1; ctx.strokeRect(p[0] - r - 3, p[1] - r - 3, (r + 3) * 2, (r + 3) * 2); }
      if (c.pop > 3e6 / this.k || this.hover?.obj === c) { const w = ctx.measureText(c.name).width, box = [p[0] + r + 4, p[1] - 6, w, 12]; if (!placed.some(b => !(box[0] > b[0] + b[2] || box[0] + box[2] < b[0] || box[1] > b[1] + b[3] || box[1] + box[3] < b[1]))) { placed.push(box); ctx.fillStyle = '#000b'; ctx.fillText(c.name, box[0] + 1, p[1] + 1); ctx.fillStyle = x >= FALL ? '#999' : x > 0.1 ? '#ff9a8a' : '#c6d6de'; ctx.fillText(c.name, box[0], p[1]); } }
    }
    // requests for assistance, foreign emergencies, fronts, bases, units
    for (const rq of S.world?.requests || []) if (rq.state === 'open') { const p = this.toScreen([rq.lon, rq.lat]); if (!p) continue; ctx.beginPath(); ctx.arc(p[0], p[1], 8 + pulse * 6, 0, 7); ctx.strokeStyle = `rgba(232,176,74,${0.9 - pulse * 0.5})`; ctx.lineWidth = 2; ctx.stroke(); ctx.font = '700 9px ui-monospace,monospace'; ctx.fillStyle = '#e8b04a'; ctx.textAlign = 'center'; ctx.fillText('HELP', p[0], p[1] - 16); ctx.textAlign = 'left'; }
    for (const c of S.foreign || []) if (c.status === 'incident') { const p = this.toScreen([c.lon, c.lat]); if (!p) continue; ctx.beginPath(); ctx.arc(p[0], p[1], 7 + pulse * 8, 0, 7); ctx.strokeStyle = `rgba(255,60,60,${0.8 - pulse * 0.5})`; ctx.lineWidth = 2; ctx.stroke(); }
    for (const f of S.fronts || []) { const p = this.toScreen([f.lon, f.lat]); if (!p) continue; ctx.save(); ctx.translate(p[0], p[1]); ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(0, -5); ctx.lineTo(8, 4); ctx.lineWidth = 3; ctx.strokeStyle = '#59c8e8'; ctx.stroke(); ctx.restore(); ctx.font = '700 9.5px ui-monospace,monospace'; ctx.fillStyle = '#9fe6ff'; ctx.textAlign = 'center'; ctx.fillText(f.name.toUpperCase(), p[0], p[1] + 15); ctx.textAlign = 'left'; }
    const badge = S.org.badge;
    for (const b of S.bases) { const p = this.toScreen([b.lon, b.lat]); if (!p) continue; ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.PI / 4); ctx.fillStyle = badge.field; ctx.strokeStyle = badge.trim; ctx.lineWidth = 1.5; ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8); ctx.restore(); }
    for (const u of S.units) if (u.status !== 'ready') { const p = this.toScreen([u.lon, u.lat]); if (!p) continue; ctx.beginPath(); ctx.rect(p[0] - 3, p[1] - 3, 6, 6); ctx.fillStyle = u.status === 'front' ? '#59c8e8' : u.status === 'returning' ? '#9aa7b0' : '#7fe36f'; ctx.fill(); }
    if (this.o.placing?.() && this.mouse) { const g = this.toGeo(...this.mouse); if (g) { const p = this.toScreen(g); ctx.beginPath(); ctx.arc(p[0], p[1], 14, 0, 7); ctx.strokeStyle = '#59c8e8'; ctx.lineWidth = 1.5; ctx.stroke(); } }
  }

  draw() {
    if (!this.w || !this.h || !this.c.width) return;
    if (this.dirty) this.drawStatic();
    const d = DPR(), ctx = this.ctx, now = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.c.width, this.c.height); ctx.drawImage(this.static, 0, 0);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (this.o.mode === 'world') return this.drawWorld(ctx);
    if (this.o.mode === 'strat') return this.drawStrat(ctx);
    const S = this.o.getState(); if (!S) return;
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.k, this.k);
    const path = d3.geoPath(this.proj, ctx);
    // base coverage
    for (const b of S.bases) { ctx.beginPath(); path(d3.geoCircle().center([b.lon, b.lat]).radius(150 / 111)()); ctx.strokeStyle = b.built ? '#59c8e822' : '#c9a22722'; ctx.lineWidth = 1 / this.k; ctx.setLineDash([4 / this.k, 4 / this.k]); ctx.stroke(); ctx.setLineDash([]); }
    // routes
    for (const u of S.units) if (u.route && u.status !== 'ready') {
      ctx.beginPath(); path({ type: 'LineString', coordinates: [[u.lon, u.lat], u.route.to] });
      ctx.strokeStyle = u.status === 'returning' ? '#9aa7b055' : u.route.mode === 'air' ? '#7fe3ffaa' : '#c9a227aa'; ctx.lineWidth = 1.2 / this.k; ctx.setLineDash(u.route.mode === 'air' ? [2 / this.k, 3 / this.k] : []); ctx.stroke(); ctx.setLineDash([]);
    }
    // outbreak in and around the country
    if (S.world && WG.ready) { const inf = S.world.inf; for (const k2 of this.cellsInView()) { const x = inf[k2]; if (x < 0.004) continue; ctx.fillStyle = x >= FALL ? 'rgba(120,20,30,0.75)' : `rgba(230,${60 + (1 - x) * 80 | 0},40,${Math.min(0.8, 0.15 + x * 0.8)})`; this.cellQuad(ctx, k2); ctx.fill(); } }
    // placement preview
    if (this.o.placing?.() && this.mouse) {
      const g = this.toGeo(...this.mouse);
      if (g) { ctx.beginPath(); path(d3.geoCircle().center(g).radius(150 / 111)()); ctx.fillStyle = '#59c8e810'; ctx.fill(); ctx.strokeStyle = '#59c8e8'; ctx.lineWidth = 1 / this.k; ctx.stroke(); }
    }
    ctx.restore();

    // cities
    const labels = []; const pulse = (Math.sin(now / 300) + 1) / 2;
    const sorted = [...S.cities].sort((a, b) => b.pop - a.pop);
    for (const c of sorted) {
      const p = this.toScreen([c.lon, c.lat]); if (!p || p[0] < -20 || p[1] < -20 || p[0] > this.w + 20 || p[1] > this.h + 20) continue;
      const r = this.cityR(c);
      const col = panicColor(c.panic);
      if (c.status === 'incident' || c.status === 'quarantined' || c.status === 'lost') {
        const inc = S.incidents.find(i => i.cityId === c.id && ['alert', 'responding', 'onscene'].includes(i.phase));
        ctx.beginPath(); ctx.arc(p[0], p[1], r + 6 + pulse * 10, 0, 7); ctx.strokeStyle = `rgba(255,60,60,${0.7 - pulse * 0.5})`; ctx.lineWidth = 2; ctx.stroke();
        if (inc) { ctx.font = '700 9px ui-monospace,monospace'; ctx.fillStyle = THREATS[inc.threat].color; ctx.textAlign = 'center'; ctx.fillText(THREATS[inc.threat].short, p[0], p[1] - r - 9); }
      }
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fillStyle = c.status === 'lost' ? '#555' : col; ctx.fill();
      // integrity ring
      if (r > 3) { ctx.beginPath(); ctx.arc(p[0], p[1], r + 2.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c.integrity / 100); ctx.strokeStyle = '#d8eef6cc'; ctx.lineWidth = 1.2; ctx.stroke(); }
      if (c.surveyed) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(p[0] - r - 4, p[1] - r - 4, (r + 4) * 2, (r + 4) * 2); }
      if (this.hover?.obj === c) { ctx.beginPath(); ctx.arc(p[0], p[1], r + 5, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      const show = c.capital || c.surveyed || c.status !== 'normal' || c.pop > 2.4e5 / this.k || this.hover?.obj === c;
      if (show) labels.push({ c, p, r });
    }
    ctx.font = '600 11px ui-sans-serif,system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const placed = [];
    for (const { c, p, r } of labels) {
      const w = ctx.measureText(c.name).width, box = [p[0] + r + 5, p[1] - 7, w, 14];
      if (placed.some(b => !(box[0] > b[0] + b[2] || box[0] + box[2] < b[0] || box[1] > b[1] + b[3] || box[1] + box[3] < b[1]))) continue;
      placed.push(box);
      ctx.fillStyle = '#000a'; ctx.fillText(c.name, box[0] + 1, p[1] + 1);
      ctx.fillStyle = c.status !== 'normal' ? '#ff8a8a' : c.capital ? '#f1e3b0' : '#c6d6de'; ctx.fillText(c.name, box[0], p[1]);
    }
    // bases
    const badge = S.org.badge;
    for (const b of S.bases) {
      const p = this.toScreen([b.lon, b.lat]); if (!p) continue;
      const s = b.size === 'hq' ? 9 : b.size === 'garrison' ? 7.5 : 6;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = b.built ? badge.field : '#333'; ctx.strokeStyle = b.built ? badge.trim : '#c9a227'; ctx.lineWidth = 2;
      ctx.fillRect(-s, -s, s * 2, s * 2); ctx.strokeRect(-s, -s, s * 2, s * 2); ctx.restore();
      if (this.hover?.obj === b) { ctx.strokeStyle = '#fff'; ctx.strokeRect(p[0] - s - 5, p[1] - s - 5, (s + 5) * 2, (s + 5) * 2); }
      ctx.font = '700 10px ui-monospace,monospace'; ctx.fillStyle = b.built ? '#e8f4fa' : '#c9a227'; ctx.textAlign = 'center'; ctx.fillText(b.name.toUpperCase(), p[0], p[1] + s + 12);
    }
    // units in the field
    for (const u of S.units) if (u.status !== 'ready') {
      const p = this.toScreen([u.lon, u.lat]); if (!p) continue;
      const air = u.vehicle && isHeli(u.vehicle);
      ctx.beginPath(); if (air) { ctx.moveTo(p[0], p[1] - 5); ctx.lineTo(p[0] + 5, p[1] + 4); ctx.lineTo(p[0] - 5, p[1] + 4); ctx.closePath(); } else ctx.rect(p[0] - 3.5, p[1] - 3.5, 7, 7);
      ctx.fillStyle = u.status === 'returning' ? '#9aa7b0' : u.status === 'onscene' ? '#7fe36f' : '#59c8e8'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  drawWorld(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.k, this.k);
    const path = d3.geoPath(this.proj, ctx);
    const sel = this.o.selected?.();
    if (this.hover?.f && this.hover.f !== sel) { ctx.beginPath(); path(this.hover.f); ctx.fillStyle = '#2e4a5a'; ctx.fill(); }
    if (sel) { ctx.beginPath(); path(sel); ctx.fillStyle = '#2b6f8c'; ctx.fill(); ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = 1.5 / this.k; ctx.stroke(); }
    ctx.restore();
  }
}
export function panicColor(p) {
  const t = Math.max(0, Math.min(1, p / 100));
  const stops = [[0, [86, 200, 140]], [0.35, [214, 196, 70]], [0.65, [232, 128, 48]], [1, [230, 50, 50]]];
  let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1], f = (t - a) / (b - a);
  return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * f)).join(',')})`;
}
