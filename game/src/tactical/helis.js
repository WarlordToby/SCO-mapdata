// Helicopters over the city: they patrol above the hostiles and fire down instead of running HVT errands on their
// own. You choose how they fly: high (above the rooftops, safe, but street canyons hide targets) or low (between
// the buildings, clear shots down the streets, but a rotor strike on a facade is possible). Pilots steer away from
// buildings they get close to; damage can make one lose control. A crash into a building blows the sections it hits
// out and the wreck comes to rest in the hollow it made; otherwise it falls to the street.
const ROTOR = { alouette3: 5.5, gazelle: 5.3, puma: 7.5, cougar: 7.8, nh90: 8.2, h125: 5.4, ec135: 5.1, tigre: 6.5, uh60: 8.2, ch47: 15, ah64: 7.3, uh1: 7.3, wildcat: 6.4, merlin: 9.3, ch53: 11, h145: 5.5, mi8: 10.7, mi24: 8.7, ka52: 7.3, z20: 8.2, z8: 9.5, z10: 6.5, z9: 6, oh1: 5.8, dhruv: 6.6, lch: 6.6, aw139: 6.9, a129: 5.9, t129: 6, surion: 7.8, h225m: 8.1 };
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t); };
const ringD = (x, y, r) => { if (inRing(x, y, r)) return 0; let m = Infinity; for (let i = 0; i < r.length; i++) m = Math.min(m, segD(x, y, r[i], r[(i + 1) % r.length])); return m; };

export function installHelis(Sim) {
  const P = Sim.prototype;
  P.rotorOf = u => ROTOR[u.vehicle] || 6.5;
  // height above the ground of the building tops near a point
  P.roofsNear = function (x, y, r) { const C = this.city, out = []; C.bGrid.near(x, y, r + 60, i => { const b = C.buildings[i]; if (b.destroyed) return; const d = ringD(x, y, b.ring); if (d < r) out.push({ b, d, top: (b.z1 ?? (b.z + b.h)) - C.heightAt(x, y) }); }); return out; };
  // a building between a helicopter and its target?
  P.heliSight = function (u, tx, ty, tz = 1) {
    const C = this.city, g = C.heightAt(u.x, u.y), hz = g + (u.alt ?? 45), L = Math.hypot(tx - u.x, ty - u.y), n = Math.ceil(L / 7), tg = C.heightAt(tx, ty) + tz;
    for (let i = 1; i < n; i++) { const k = i / n, x = u.x + (tx - u.x) * k, y = u.y + (ty - u.y) * k, z = hz + (tg - hz) * k;
      let blocked = false; C.bGrid.near(x, y, 60, j => { if (blocked) return; const b = C.buildings[j]; if (b.destroyed || (b.z1 ?? b.z + b.h) < z) return; if (inRing(x, y, b.ring)) blocked = true; }); if (blocked) return false; }
    return true;
  };
  // altitude, avoiding the buildings, collisions and loss of control; returns true if the helicopter came down
  P.stepHeli = function (u, dt) {
    const C = this.city, R = this.rotorOf(u), near = this.roofsNear(u.x, u.y, R + 14);
    const tallest = near.reduce((m, q) => Math.max(m, q.top), 0);
    u.altMode = u.altMode || 'high';
    if (u.lost) { // out of control: spinning, drifting, dropping
      u.lost.t -= dt; u.alt -= dt * (4 + (5 - Math.max(0, u.lost.t))); u.x += u.lost.vx * dt; u.y += u.lost.vy * dt; u.lost.spin += dt * 4;
      u.hx = Math.cos(u.lost.spin); u.hy = Math.sin(u.lost.spin);
      for (const q of near) if (q.d < R * 0.6 && q.top > u.alt - 1) return this.heliCrash(u, q.b);
      if (u.alt <= 0.5) return this.heliCrash(u, null);
      return false;
    }
    const tight = near.filter(q => q.d < R * 0.9).reduce((m, q) => Math.max(m, q.top), 0); // hemmed in: climb clear of what is closest
    const want = u.altMode === 'low' ? Math.max(16, tight > 14 ? tight + 3 : 16) : Math.max(45, tallest + 22);
    if (u.order?.type === 'extract' && u.order.wait > 0) u.alt += (Math.max(2, (u.order.b.z1 ?? 0) - C.heightAt(u.x, u.y) + 1) - u.alt) * Math.min(1, dt * 0.5); // settling onto the roof
    else u.alt += Math.max(-5 * dt, Math.min(5 * dt, (want - (u.alt ?? 45))));
    // pilots steer clear of facades they are getting close to
    let px = 0, py = 0;
    for (const q of near) { if (q.top < u.alt - 2) continue; const pull = (R + 10 - q.d) / (R + 10); if (pull <= 0) continue; const dx = u.x - q.b.c[0], dy = u.y - q.b.c[1], d = Math.hypot(dx, dy) || 1; px += dx / d * pull; py += dy / d * pull;
      if ((q.d < R * 0.45 && Math.random() < dt * 0.35) || (u.altMode === 'low' && q.d < R * 0.8 && Math.random() < dt * 0.004)) { /* blade into the facade, or a gust off a tall building */ this.log(`${u.name}: rotor strike on ${q.b.name || q.b.addr || 'a building'}!`, 'bad'); return this.heliCrash(u, q.b, true); } }
    if (px || py) { const k = Math.min(1, Math.hypot(px, py)) * 12 * dt, nx = u.x + px * k, ny = u.y + py * k; if (!this.heliBlocked(u, nx, ny)) { u.x = nx; u.y = ny; } }
    return false;
  };
  P.heliBlocked = function (u, x, y) { const R = this.rotorOf(u); return this.roofsNear(x, y, R * 0.7).some(q => q.top > (u.alt ?? 45) - 1); };
  // hit hard enough, a pilot can lose control
  P.heliHit = function (u) { if (u.kind !== 'heli' || u.lost || u.dead) return; if (u.hp < u.maxHp * 0.45 && Math.random() < 0.25) { const a = Math.random() * 6.28; u.lost = { t: 3 + Math.random() * 4, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, spin: Math.atan2(u.hy, u.hx) }; this.log(`${u.name} is hit and losing control!`, 'bad'); } };
  P.heliCrash = function (u, b, strike = false) {
    const C = this.city, g = C.heightAt(u.x, u.y), z = g + Math.max(0, u.alt);
    u.hp = 0; u.dead = true; u.men = 0; if (!u.ai) this.stats.vehiclesLost++; this.stats[u.ai ? 'natKIA' : 'soldiersKIA'] = (this.stats[u.ai ? 'natKIA' : 'soldiersKIA'] || 0) + u.pers;
    for (const h of u.carrying) { h.state = 'lost'; this.stats.hvtLost++; }
    let rest = null;
    if (b) { // into the building: the sections it hits are blown out, and the wreck rests in the hollow if it opened one
      const s = this.hitBuildingAt(b, u.x, u.y, z, 1400, 10); this.damageBuilding(b, 600);
      if (s && s.dead) { rest = { x: s.cx * 0.6 + u.x * 0.4, y: s.cy * 0.6 + u.y * 0.4, z: s.z, b }; this.log(`${u.name} crashed into ${b.name || b.addr || 'a building'} — the wreck is lodged in the floors it tore open.`, 'bad'); }
      else { const dx = u.x - b.c[0], dy = u.y - b.c[1], d = Math.hypot(dx, dy) || 1; u.x += dx / d * 6; u.y += dy / d * 6; this.log(`${u.name} struck ${b.name || b.addr || 'a building'} and fell into the street.`, 'bad'); }
    } else this.log(`${u.name} crashed${strike ? '' : ' in the street'}.`, 'bad');
    if (!rest) { this.explode(u.x, u.y, 9, 120, null); rest = { x: u.x, y: u.y, z: C.heightAt(u.x, u.y) }; }
    u.wreckAt = rest; u.alt = 0;
    for (const w of this.units) if (!w.dead && w !== u && w.kind !== 'heli' && Math.hypot(w.x - rest.x, w.y - rest.y) < 10) this.hurtUnit(w, 150, null);
    this.fxPush({ k: 'heliCrash', u, x: rest.x, y: rest.y, z: rest.z });
    return true;
  };
  // where the helicopters should patrol: over the densest group of hostiles in the open (or the outbreak centre)
  P.containPoint = function () {
    let best = null, bn = 0; const cs = this.creatures.filter(c => !c.inB && c.hp > 0 && c.vis);
    for (let i = 0; i < cs.length; i += Math.max(1, Math.floor(cs.length / 40))) { const c = cs[i]; let n = 0; this.cGrid.near(c.x, c.y, 80, k => { if (!k.inB && k.hp > 0) n++; }); if (n > bn) { bn = n; best = [c.x, c.y]; } }
    return best || this.outbreakCentre();
  };
}
