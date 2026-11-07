// Road network compiler: junction-to-junction edges with lanes, lane-level connections through each junction,
// right-of-way rules, generated signal plans, turn restrictions and connectivity.
import { bearingXY, polyLen } from './geom.mjs';

export const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'track', 'pedestrian', 'footway', 'cycleway', 'steps'];
const C = Object.fromEntries(CLASSES.map((c, i) => [c, i]));
const HW = { motorway: 'motorway', motorway_link: 'motorway', trunk: 'trunk', trunk_link: 'trunk', primary: 'primary', primary_link: 'primary', secondary: 'secondary', secondary_link: 'secondary', tertiary: 'tertiary', tertiary_link: 'tertiary', unclassified: 'unclassified', road: 'unclassified', residential: 'residential', living_street: 'living_street', service: 'service', track: 'track', pedestrian: 'pedestrian', footway: 'footway', path: 'footway', bridleway: 'footway', corridor: 'footway', cycleway: 'cycleway', steps: 'steps' };
export const CTRL = ['none', 'priority', 'right_priority', 'stop', 'yield', 'signal', 'roundabout'];
export const TURN = ['through', 'left', 'right', 'uturn'];
export const FLAG = { oneway: 1, bridge: 2, tunnel: 4, roundabout: 8, private: 16, drive: 32, walk: 64, isolated_f: 128, isolated_b: 256, link: 512, bus: 1024, barrier: 2048 };

const DEF_LANES = { motorway: 2, trunk: 2, primary: 1, secondary: 1, tertiary: 1, unclassified: 1, residential: 1, living_street: 1, service: 1, track: 1 };
const DEF_SPEED = { motorway: 110, trunk: 90, primary: 50, secondary: 50, tertiary: 50, unclassified: 50, residential: 50, living_street: 20, service: 20, track: 20, pedestrian: 10 };
function parseSpeed(v, cls) {
  if (!v) return DEF_SPEED[cls] || 30;
  const s = String(v).toLowerCase();
  if (s.includes('walk')) return 7; if (s === 'none') return 130;
  const zone = { 'fr:urban': 50, 'fr:rural': 80, 'fr:motorway': 130, 'fr:zone30': 30, 'fr:zone20': 20, 'de:urban': 50, 'de:rural': 100, 'nl:urban': 50 }[s]; if (zone) return zone;
  const m = s.match(/\d+/); if (!m) return DEF_SPEED[cls] || 30;
  return s.includes('mph') ? Math.round(+m[0] * 1.609) : +m[0];
}
const ang = (a, b) => ((b - a + 540) % 360) - 180;

export function buildRoads(osm, P) {
  const { nodes, ways, tagged, rels } = osm;
  const ctrlNode = new Map();
  for (const n of tagged) {
    const h = n.tags.highway;
    if (h === 'traffic_signals' || (h === 'crossing' && n.tags.crossing === 'traffic_signals')) ctrlNode.set(n.id, 'signal');
    else if (h === 'stop') ctrlNode.set(n.id, 'stop');
    else if (h === 'give_way') ctrlNode.set(n.id, 'yield');
  }
  // 1. Classify ways
  const hw = [];
  for (const w of ways.values()) {
    const t = w.tags, cls = HW[t.highway];
    if (!cls || w.refs.length < 2) continue;
    if (t.area === 'yes' && cls !== 'pedestrian') continue;
    if (['construction', 'proposed', 'abandoned'].includes(t.highway)) continue;
    const drive = C[cls] <= C.track && t.motor_vehicle !== 'no' && t.motorcar !== 'no' && !(t.access === 'no' && !t.motor_vehicle && !t.motorcar);
    const walk = t.foot !== 'no' && t.motorroad !== 'yes' && !(C[cls] <= C.trunk && t.foot !== 'yes') && !(/_link$/.test(t.highway) && t.foot !== 'yes');
    let oneway = t.oneway === 'yes' || t.oneway === '1' || t.oneway === 'true' ? 1 : t.oneway === '-1' || t.oneway === 'reverse' ? -1 : 0;
    const round = t.junction === 'roundabout' || t.junction === 'circular';
    if (!t.oneway && (cls === 'motorway' || round || /_link$/.test(t.highway) && cls === 'motorway')) oneway = 1;
    if (!drive && !walk) continue;
    hw.push({ w, cls, drive, walk, oneway, round, refs: oneway === -1 ? w.refs.slice().reverse() : w.refs });
  }
  // 2. Junction nodes
  const use = new Map();
  for (const h of hw) h.refs.forEach((r, i) => use.set(r, (use.get(r) || 0) + (i === 0 || i === h.refs.length - 1 ? 2 : 1)));
  const isJ = r => (use.get(r) || 0) > 1;
  // Controls placed on approach nodes are moved to the junction they serve (≤ 35 m along the way); isolated signals become their own junction.
  const moved = new Map(); // junction node -> {signal:bool, approach controls [{wayId, ctrl}]}
  const extraJ = new Set();
  const nodeXY = id => { const n = nodes.get(id); return n ? P.fwd(n[0], n[1]) : null; };
  for (const h of hw) {
    const R = h.refs;
    for (let i = 0; i < R.length; i++) {
      const c = ctrlNode.get(R[i]); if (!c) continue;
      let target = null;
      if (isJ(R[i])) target = R[i];
      else {
        let best = null, bd = 36;
        for (const dir of [1, -1]) { let d = 0; for (let k = i; k > 0 && k < R.length - 1 || k === i; k += dir) { const a = nodeXY(R[k]), b = nodeXY(R[k + dir]); if (!a || !b) break; d += Math.hypot(a[0] - b[0], a[1] - b[1]); if (d > bd) break; if (isJ(R[k + dir])) { best = R[k + dir]; bd = d; break; } if (k + dir <= 0 || k + dir >= R.length - 1) break; } }
        target = best;
      }
      if (target == null) { if (c === 'signal') extraJ.add(R[i]); continue; }
      const m = moved.get(target) || { signal: false, appr: [] }; moved.set(target, m);
      if (c === 'signal') m.signal = true; else m.appr.push({ way: h.w.id, ctrl: c, at: R[i] });
    }
  }
  // 3. Split into edges
  const nodeId = new Map(); const jn = []; // junction list
  const jid = r => { let i = nodeId.get(r); if (i === undefined) { const p = nodeXY(r); i = jn.length; nodeId.set(r, i); jn.push({ osm: r, p, ctrl: 0, inc: [], out: [] }); } return i; };
  const edges = [];
  for (const h of hw) {
    const t = h.w.tags, R = h.refs;
    let start = 0;
    for (let i = 1; i < R.length; i++) {
      if (i === R.length - 1 || isJ(R[i]) || extraJ.has(R[i])) {
        const pts = []; let ok = true; for (let k = start; k <= i; k++) { const p = nodeXY(R[k]); if (!p) { ok = false; break; } pts.push(p); }
        if (ok && pts.length > 1) { const e = mkEdge(h, t, pts, jid(R[start]), jid(R[i]), R[start], R[i]); e.refs = R.slice(start, i + 1); edges.push(e); }
        start = i;
      }
    }
  }
  function mkEdge(h, t, pts, a, b, oa, ob) {
    const cls = h.cls, dl = DEF_LANES[cls] || 1, oneway = h.oneway !== 0;
    const lanes = parseInt(t.lanes) || 0;
    let lf, lb;
    if (!h.drive) { lf = 0; lb = 0; }
    else if (oneway) { lf = lanes || dl; lb = 0; }
    else {
      lf = parseInt(t['lanes:forward']) || (lanes ? Math.max(1, Math.ceil(lanes / 2)) : dl);
      lb = parseInt(t['lanes:backward']) || (lanes ? Math.max(1, lanes - lf) : dl);
      if (h.oneway === -1) [lf, lb] = [lb, lf];
    }
    const turnF = oneway ? (t['turn:lanes'] || t['turn:lanes:forward'] || '') : (t['turn:lanes:forward'] || '');
    const turnB = oneway ? '' : (t['turn:lanes:backward'] || '');
    let flags = 0;
    if (oneway) flags |= FLAG.oneway; if (t.bridge && t.bridge !== 'no') flags |= FLAG.bridge; if (t.tunnel && t.tunnel !== 'no') flags |= FLAG.tunnel;
    if (h.round) flags |= FLAG.roundabout; if (['private', 'no', 'destination'].includes(t.access)) flags |= FLAG.private;
    if (h.drive) flags |= FLAG.drive; if (h.walk) flags |= FLAG.walk; if (/_link$/.test(t.highway || '')) flags |= FLAG.link;
    if (t['busway'] || t['lanes:bus'] || t.psv === 'designated') flags |= FLAG.bus;
    return { id: edges.length, a, b, oa, ob, way: h.w.id, cls: C[cls], lf, lb, turnF, turnB, speed: parseSpeed(t.maxspeed, cls), layer: parseInt(t.layer) || 0, name: t.name || t.ref || '', flags, pts, len: polyLen(pts), width: parseFloat(t.width) || 0 };
  }
  // 3b. Point barriers on the carriageway (bollards, blocks, cycle barriers…) close a way to motor traffic but not to people.
  const NOCAR = new Set(['bollard', 'block', 'jersey_barrier', 'cycle_barrier', 'planter', 'bus_trap', 'debris', 'log', 'chain', 'rope', 'kissing_gate', 'stile', 'turnstile', 'full-height_turnstile', 'motorcycle_barrier', 'barrier_board', 'sump_buster']);
  const blockNode = new Set();
  for (const n of tagged) { const b = n.tags.barrier; if (!b) continue; if ((NOCAR.has(b) && n.tags.motor_vehicle !== 'yes' && n.tags.access !== 'yes') || (b === 'gate' && n.tags.locked === 'yes')) blockNode.add(n.id); }
  let nBlocked = 0;
  for (const e of edges) if ((e.flags & FLAG.drive) && e.refs.some(r => blockNode.has(r))) { e.flags = (e.flags & ~FLAG.drive) | FLAG.barrier; nBlocked++; }
  // 4. Junction approaches/exits
  for (const e of edges) {
    const n = e.pts.length;
    const hA = bearingXY(e.pts[0], e.pts[1]), hB = bearingXY(e.pts[n - 2], e.pts[n - 1]);
    if (e.flags & FLAG.drive) {
      // forward travel a->b
      jn[e.b].inc.push({ e: e.id, dir: 1, head: hB, lanes: e.lf, turn: e.turnF });
      jn[e.a].out.push({ e: e.id, dir: 1, head: hA, lanes: e.lf });
      if (!(e.flags & FLAG.oneway)) {
        jn[e.a].inc.push({ e: e.id, dir: -1, head: (hA + 180) % 360, lanes: e.lb, turn: e.turnB });
        jn[e.b].out.push({ e: e.id, dir: -1, head: (hB + 180) % 360, lanes: e.lb });
      }
    }
  }
  // 5. Turn restrictions
  const restr = new Map(); // junction -> [{fromWay, toWay, only, ban}]
  for (const r of rels) {
    if (r.tags.type !== 'restriction') continue;
    const kind = r.tags.restriction || r.tags['restriction:motorcar']; if (!kind) continue;
    const from = r.members.find(m => m.role === 'from' && m.type === 'w'), to = r.members.find(m => m.role === 'to' && m.type === 'w'), via = r.members.find(m => m.role === 'via' && m.type === 'n');
    if (!from || !to || !via || !nodeId.has(via.ref)) continue;
    const j = nodeId.get(via.ref); const a = restr.get(j) || []; restr.set(j, a);
    a.push({ from: from.ref, to: to.ref, only: kind.startsWith('only_') });
  }
  // 6. Connections, right of way, signal plans
  const conn = []; let nSignals = 0;
  const wayOf = id => edges[id].way;
  for (let j = 0; j < jn.length; j++) {
    const J = jn[j], m = moved.get(J.osm);
    J.conn = []; J.phases = null; J.yieldTo = null;
    if (!J.inc.length) continue;
    const R = restr.get(j) || [];
    for (const inc of J.inc) {
      let exits = J.out.filter(o => !(o.e === inc.e && o.dir === -inc.dir));
      const uturnOnly = !exits.length; if (uturnOnly) exits = J.out.slice();
      exits = exits.filter(o => {
        for (const r of R) { if (r.from !== wayOf(inc.e)) continue; if (r.only) { if (wayOf(o.e) !== r.to) return false; } else if (wayOf(o.e) === r.to) return false; }
        return true;
      });
      const k = Math.max(1, inc.lanes);
      // lane permissions, index 0 = rightmost lane
      const perm = Array.from({ length: k }, () => new Set());
      const tl = inc.turn ? inc.turn.split('|') : null;
      if (tl && tl.length === k) {
        tl.forEach((s, i) => { const li = k - 1 - i; for (const p of s.split(';')) { if (/left/.test(p)) perm[li].add(1); else if (/right/.test(p)) perm[li].add(2); else if (p === 'reverse') perm[li].add(3); else perm[li].add(0); } });
      } else if (k === 1) perm[0] = new Set([0, 1, 2, 3]);
      else { perm[k - 1].add(1).add(0).add(3); perm[0].add(2).add(0); for (let i = 1; i < k - 1; i++) perm[i].add(0); }
      for (const o of exits) {
        const d = ang(inc.head, o.head);
        const turn = uturnOnly || Math.abs(d) > 155 ? 3 : Math.abs(d) < 35 ? 0 : d < 0 ? 1 : 2;
        let from = perm.map((s, i) => (s.has(turn) ? i : -1)).filter(i => i >= 0);
        if (!from.length) from = turn === 1 || turn === 3 ? [k - 1] : turn === 2 ? [0] : perm.map((_, i) => i);
        const mo = Math.max(1, o.lanes);
        from.forEach((fl, r) => {
          let tlane;
          if (turn === 2) tlane = Math.min(mo - 1, r);
          else if (turn === 1 || turn === 3) tlane = Math.max(0, mo - 1 - (from.length - 1 - r));
          else tlane = from.length === 1 ? Math.min(mo - 1, Math.round(fl * (mo - 1) / Math.max(1, k - 1))) : Math.min(mo - 1, Math.round(r * (mo - 1) / Math.max(1, from.length - 1)));
          J.conn.push(conn.length); conn.push([inc.e, inc.dir, fl, o.e, o.dir, tlane, turn]);
        });
      }
    }
    // Right of way
    const roundIn = J.inc.some(i => edges[i.e].flags & FLAG.roundabout) && J.inc.some(i => !(edges[i.e].flags & FLAG.roundabout));
    const ranks = J.inc.map(i => edges[i.e].cls), best = Math.min(...ranks);
    if (m?.signal || ctrlNode.get(J.osm) === 'signal') { J.ctrl = 5; nSignals++; }
    else if (roundIn) J.ctrl = 6;
    else if (m?.appr.length) J.ctrl = m.appr[0].ctrl === 'stop' ? 3 : 4;
    else if (J.inc.length <= 1 || J.out.length + J.inc.length <= 3 && new Set(J.inc.map(i => i.e)).size < 2) J.ctrl = 0;
    else if (ranks.filter(r => r === best).length === ranks.length && best >= C.tertiary) J.ctrl = 2; // French "priorité à droite"
    else J.ctrl = 1;
    // Per-approach yield flags (1 = must yield)
    J.yieldTo = J.inc.map(i => {
      const e = edges[i.e];
      if (J.ctrl === 6) return e.flags & FLAG.roundabout ? 0 : 1;
      if (J.ctrl === 3 || J.ctrl === 4) return m.appr.some(a => a.way === e.way) ? 1 : 0;
      if (J.ctrl === 1) return e.cls > best ? 1 : 0;
      return 0;
    });
    if (J.ctrl === 5) J.phases = signalPlan(J, conn, edges);
  }
  // 7. Connectivity (largest strongly connected component of the drivable graph)
  const N = jn.length, adj = Array.from({ length: N }, () => []), radj = Array.from({ length: N }, () => []);
  for (const e of edges) { if (!(e.flags & FLAG.drive) || (e.flags & FLAG.private)) continue; adj[e.a].push(e.b); radj[e.b].push(e.a); if (!(e.flags & FLAG.oneway)) { adj[e.b].push(e.a); radj[e.a].push(e.b); } }
  const order = [], seen = new Uint8Array(N);
  for (let s = 0; s < N; s++) { if (seen[s]) continue; const st = [[s, 0]]; seen[s] = 1; while (st.length) { const top = st[st.length - 1]; if (top[1] < adj[top[0]].length) { const v = adj[top[0]][top[1]++]; if (!seen[v]) { seen[v] = 1; st.push([v, 0]); } } else { order.push(top[0]); st.pop(); } } }
  const comp = new Int32Array(N).fill(-1); let nc = 0; const size = [];
  for (let i = order.length - 1; i >= 0; i--) { const s = order[i]; if (comp[s] >= 0) continue; let cnt = 0; const st = [s]; comp[s] = nc; while (st.length) { const u = st.pop(); cnt++; for (const v of radj[u]) if (comp[v] < 0) { comp[v] = nc; st.push(v); } } size.push(cnt); nc++; }
  const main = size.indexOf(Math.max(...size));
  for (const e of edges) if (e.flags & FLAG.drive) { if (!(comp[e.a] === main && comp[e.b] === main)) { e.flags |= FLAG.isolated_f; if (!(e.flags & FLAG.oneway)) e.flags |= FLAG.isolated_b; } }

  return { edges, junctions: jn, conn, stats: { edges: edges.length, junctions: jn.length, signals: nSignals, connections: conn.length, restrictions: [...restr.values()].reduce((a, r) => a + r.length, 0), mainComponentNodes: Math.max(...size), closedToCars: nBlocked } };
}

// Two- to four-phase fixed-time plan. Opposite approaches share a phase; dedicated left lanes get a protected phase.
function signalPlan(J, conn, edges) {
  const appr = J.inc.map((inc, idx) => ({ idx, inc, head: inc.head, cls: edges[inc.e].cls }));
  const axes = [];
  for (const a of appr) {
    let ax = axes.find(x => x.some(b => { const d = Math.abs(ang(a.head, b.head)); return d < 40 || d > 140; }));
    if (!ax) axes.push(ax = []); ax.push(a);
  }
  const phases = [];
  for (const ax of axes) {
    const ids = new Set(ax.map(a => a.inc.e + ':' + a.inc.dir));
    const mine = J.conn.filter(ci => ids.has(conn[ci][0] + ':' + conn[ci][1]));
    const dedicatedLeft = ax.some(a => (a.inc.turn || '').split('|').some(s => s === 'left'));
    const major = Math.min(...ax.map(a => a.cls)) <= 3;
    const g = major ? 32 : 18;
    if (dedicatedLeft && axes.length > 1) {
      phases.push({ green: mine.filter(ci => conn[ci][6] !== 1), dur: g });
      phases.push({ green: mine.filter(ci => conn[ci][6] === 1 || conn[ci][6] === 2), dur: 10 });
    } else phases.push({ green: mine, dur: g });
  }
  return phases.map(p => ({ ...p, yellow: 3, allRed: 2 }));
}
