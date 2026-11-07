import './style.css';
import { d3, WORLD, META, territoryOf, regionsOf, citiesOf } from './geo.js';
import { MapView } from './map.js';
import { badgeSVG, randomBadge, SHAPES, DIVISIONS, EMBLEMS, PALETTE } from './badge.js';
import * as G from './state.js';
import { $, $$, esc, eur, big, num, setTZ, fmtDate } from './util.js';
import { renderTab, renderCtx, UI } from './tabs.js';
import { VERSION, CHANGELOG } from './version.js';
import { modal, showBroadcast, showDispatch, showHandoff, closeModal, escMenu } from './modals.js';
import * as M from './modals.js';
import { loadPackIndex } from './packs.js';
import { loadWorld, landAt, G as WG } from './world.js';
import { newOutbreak } from './outbreak.js';
const packsReady = Promise.all([loadPackIndex(), loadWorld().catch(e => console.error(e))]);

const screens = ['menu', 'select', 'found', 'game'];
function show(id) { screens.forEach(s => $('#' + s).classList.toggle('on', s === id)); }

// ---------------- Main menu ----------------
let globeAnim = null;
function menu() {
  show('menu');
  $('#btnContinue').style.display = G.hasSave() ? '' : 'none';
  const si = G.saveInfo(); $('#btnContinue').textContent = si ? `Continue — ${si.org || ''}` : 'Continue';
  $('#verTag').textContent = `v${VERSION}`;
  let seen = null; try { seen = localStorage.getItem('sco_seen_version'); } catch (e) { }
  renderChangelog(seen !== VERSION ? 'new' : 'latest', seen);
  try { localStorage.setItem('sco_seen_version', VERSION); } catch (e) { }
  const cv = $('#menu canvas'), ctx = cv.getContext('2d');
  const proj = d3.geoOrthographic().clipAngle(90), path = d3.geoPath(proj, ctx);
  let rot = -20;
  cancelAnimationFrame(globeAnim);
  const frame = () => {
    const d = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    if (cv.width !== w * d) { cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
    const r = Math.min(w, h) * 0.46; proj.scale(r).translate([w * 0.68, h * 0.52]).rotate([rot, -18]); rot += 0.04;
    ctx.beginPath(); path({ type: 'Sphere' }); const g = ctx.createRadialGradient(w * .62, h * .4, r * .2, w * .68, h * .52, r); g.addColorStop(0, '#0f2230'); g.addColorStop(1, '#070d12'); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); path(d3.geoGraticule10()); ctx.strokeStyle = '#59c8e812'; ctx.lineWidth = .7; ctx.stroke();
    ctx.beginPath(); WORLD.forEach(f => path(f)); ctx.fillStyle = '#16303d'; ctx.fill(); ctx.strokeStyle = '#59c8e840'; ctx.lineWidth = .6; ctx.stroke();
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.strokeStyle = '#59c8e855'; ctx.lineWidth = 1.2; ctx.stroke();
    if ($('#menu').classList.contains('on')) globeAnim = requestAnimationFrame(frame);
  };
  frame();
}
function renderChangelog(mode, seen) {
  const cmp = (a, b) => { const x = a.split('.').map(Number), y = (b || '0.0.0').split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  const list = mode === 'all' ? CHANGELOG : mode === 'new' && seen ? CHANGELOG.filter(c => cmp(c.v, seen) > 0) : CHANGELOG.slice(0, 1);
  $('#chTitle').textContent = mode === 'all' ? 'Changelog' : `v${CHANGELOG[0].v} — ${CHANGELOG[0].title}`;
  $('#chBody').innerHTML = list.map(c => `<div class="chv"><div class="row"><b>v${c.v}</b><span class="mut">${c.title}</span><span class="sp"></span><span class="mut mono">${c.date}</span></div><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('');
  $('#chAll').textContent = mode === 'all' ? 'Latest only' : 'Full changelog';
  $('#chAll').onclick = () => renderChangelog(mode === 'all' ? 'latest' : 'all');
}
$('#btnNew').onclick = async () => { await packsReady; selectCountry(); };
$('#btnContinue').onclick = async () => { await packsReady; if (G.load()) startGame(); };

// ---------------- Country select ----------------
let selMap = null, selCountry = null;
function selectCountry() {
  show('select');
  selCountry = selCountry || WORLD.find(f => f.meta.cca2 === 'FR');
  if (!selMap) {
    selMap = new MapView($('#select canvas'), { mode: 'world', padRight: 380, selected: () => selCountry, onClick: h => { if (h?.f) { selCountry = h.f; renderSel(); } }, onHover: (h, m) => tip(h?.f ? `<b>${esc(h.f.meta.flag || '')} ${esc(h.f.meta.name)}</b>` : null, m, '#select') });
  }
  renderSel();
  $('#cSearch').oninput = renderSel;
}
function renderSel() {
  const q = $('#cSearch').value.toLowerCase();
  const seen = new Set(); const list = WORLD.filter(f => f.meta.cca2 && META[f.id] && f.meta.name.toLowerCase().includes(q) && !seen.has(f.meta.cca2) && seen.add(f.meta.cca2)).sort((a, b) => a.meta.name.localeCompare(b.meta.name));
  $('#cList').innerHTML = list.map(f => `<div data-id="${f.id}" class="${f === selCountry ? 'on' : ''}"><span>${f.meta.flag || ''}</span><span>${esc(f.meta.name)}</span></div>`).join('');
  $$('#cList div').forEach(d => d.onclick = () => { selCountry = WORLD.find(f => f.id === d.dataset.id); renderSel(); });
  const m = selCountry.meta;
  const terr = territoryOf(selCountry), cities = citiesOf(m.cca2, terr);
  const sv = cities.find(c => c.name === 'Strasbourg') || [...cities].sort((a, b) => b.pop - a.pop)[Math.min(cities.length - 1, 6)];
  const grant = Math.max(2e6, Math.min(120e6, (m.gdp || 5e10) * 1.4e-5));
  $('#cInfo').innerHTML = `<div class="title">${m.flag || ''} ${esc(m.name)}</div><div class="mut">${esc(m.official || '')}</div>
   <div class="stats" style="margin-top:8px"><span>Capital</span><span>${esc(m.capital)}</span><span>Population${m.popYear ? ' (' + m.popYear + ')' : ''}</span><span>${m.pop ? big(m.pop) : '—'}</span>
   <span>GDP${m.gdpYear ? ' (' + m.gdpYear + ')' : ''}</span><span>${m.gdp ? '$' + big(m.gdp) : '—'}</span><span>Monitored cities</span><span>${cities.length}</span>
   <span>Est. monthly grant</span><span>${eur(grant)}</span><span>Tactical-ready city</span><span>${sv ? esc(sv.name) : '—'}</span></div>
   ${m.cca2 !== 'FR' ? '<div class="mut" style="margin-top:6px;font-size:12px">Only France has a hand-checked setup (regions, district names, survey city). Other countries are playable on the strategic map with generic data.</div>' : ''}`;
  $('#cGo').disabled = !cities.length;
  selMap.dirty = true;
}
$('#cBack').onclick = menu;
$('#cGo').onclick = () => found();

// ---------------- Founding ----------------
let badge = null;
function found() {
  show('found');
  if (!badge) { badge = { shape: 'shield', division: 'chief', emblem: 'gate', field: '#13202e', second: '#1d3557', trim: '#c9a227', emblemColor: '#e8e3d3', acr: 'SCO' }; }
  const nm = $('#oName'); if (!nm.value) nm.value = 'Special Containment Organization';
  renderFound();
}
function acronym(n) { return n.split(/\s+/).filter(w => w && !/^(of|the|and|for|de|la|le|des|du)$/i.test(w)).map(w => w[0].toUpperCase()).join('').slice(0, 6); }
function renderFound() {
  const name = $('#oName').value.trim();
  if (!$('#oAcr').dataset.touched) $('#oAcr').value = acronym(name);
  badge.acr = $('#oAcr').value.toUpperCase();
  const chip = (arr, key) => arr.map(v => `<button class="${badge[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${v}</button>`).join('');
  $('#bShape').innerHTML = chip(SHAPES, 'shape'); $('#bDiv').innerHTML = chip(DIVISIONS, 'division');
  $('#bEmb').innerHTML = EMBLEMS.map(e => `<button class="${badge.emblem === e ? 'on' : ''}" data-k="emblem" data-v="${e}" title="${e}">${badgeSVG({ ...badge, emblem: e, shape: 'roundel', division: 'plain' }, 34, false)}</button>`).join('');
  for (const k of ['field', 'second', 'trim', 'emblemColor']) $('#bc_' + k).innerHTML = PALETTE.map(c => `<i style="background:${c}" class="${badge[k] === c ? 'on' : ''}" data-k="${k}" data-v="${c}"></i>`).join('');
  $$('#found [data-k]').forEach(el => el.onclick = () => { badge[el.dataset.k] = el.dataset.v; renderFound(); });
  $('#bPrev').innerHTML = badgeSVG(badge, 260);
  $('#bPrevName').textContent = name || '—';
  $('#bPrevSub').textContent = `${selCountry.meta.flag || ''} Defensive authority of ${selCountry.meta.name}`;
  $('#oGo').disabled = !name || !badge.acr;
}
$('#oName').oninput = renderFound;
$('#oAcr').oninput = () => { $('#oAcr').dataset.touched = 1; renderFound(); };
$('#bRand').onclick = () => { badge = randomBadge(badge.acr); renderFound(); };
$('#oBack').onclick = selectCountry;
$('#oGo').onclick = () => {
  G.newGame({ ccn3: selCountry.id, orgName: $('#oName').value.trim(), acronym: badge.acr, badge: { ...badge } });
  startGame();
};

// ---------------- Game ----------------
let gmap = null, last = 0, accum = 0, uiTimer = 0;
export const GAME = { placing: null, sel: null };
const SPEEDS = [0, 5 * 60e3, 30 * 60e3, 3 * 3600e3]; // game ms per real second

function startGame() {
  const S = G.getS();
  setTZ(S.nation.cca2 === 'FR' ? 'Europe/Paris' : tzFor(G.GEO.terr));
  show('game');
  GAME.view = 'nation'; makeMap();
  $('#gVer').textContent = 'v' + VERSION;
  $('#topOrg').innerHTML = `${badgeSVG(S.org.badge, 30, false)}<div><div>${esc(S.org.name)}</div><div class="mut" style="font-size:10.5px;letter-spacing:.1em">${esc(S.nation.flag || '')} ${esc(S.nation.name)}</div></div>`;
  UI.tab = UI.tab || 'org';
  refreshAll();
  last = performance.now(); requestAnimationFrame(loop);
}
function makeMap() {
  const S = G.getS();
  if (gmap) gmap.destroy();
  gmap = new MapView($('#game canvas'), {
    mode: GAME.view === 'world' ? 'strat' : 'nation', terr: G.GEO.terr, regions: regionsOf(S.nation.cca2), getState: G.getS, padLeft: 450, padRight: 340,
    placing: () => !!GAME.placing || !!GAME.front || S.needsHQ,
    cursor: () => (GAME.placing || GAME.front || G.getS().needsHQ) ? 'crosshair' : null,
    onClick: onMapClick, onHover: onMapHover,
  });
  GAME.map = gmap; window.__gm = gmap;
  $('#btnView').textContent = GAME.view === 'world' ? 'National map' : 'World map';
}
function toggleView() { if (G.getS().needsHQ) return; GAME.view = GAME.view === 'world' ? 'nation' : 'world'; makeMap(); }
UI.toggleView = toggleView;
function tzFor(terr) { const c = d3.geoCentroid(terr); const o = Math.round(c[0] / 15); return o === 0 ? 'UTC' : `Etc/GMT${o > 0 ? '-' : '+'}${Math.abs(o)}`; }

function loop(now) {
  if (!$('#game').classList.contains('on')) return;
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  const S = G.getS();
  if (S.speed && !$('#modal').classList.contains('on') && !S.needsHQ) {
    const evs = G.tick(dt * SPEEDS[S.speed]);
    for (const e of evs) handleEvent(e);
    if (Math.floor(S.t / G.DAY) !== Math.floor((S.t - dt * SPEEDS[S.speed]) / G.DAY)) G.save();
  }
  uiTimer += dt; if (uiTimer > 0.5) { uiTimer = 0; refreshAll(true); }
  updateTop();
  requestAnimationFrame(loop);
}
function handleEvent(e) {
  const S = G.getS();
  if (e.type === 'incident') { S.speed = 0; G.save(); showBroadcast(e.inc, refreshAll); }
  if (e.type === 'handoff') { S.speed = 0; showHandoff(e.inc, refreshAll); }
  if (e.type === 'world') { S.speed = 0; G.save(); M.worldNews(e, refreshAll); }
}

function updateTop() {
  const S = G.getS();
  $('#clock').textContent = fmtDate(S.t);
  $('#tFunds').textContent = eur(S.funds); $('#tFunds').className = S.funds < 0 ? 'bad' : '';
  $('#tStand').textContent = Math.round(S.standing); $('#tTrust').textContent = Math.round(S.trust);
  const inc = G.activeIncident();
  $('#tAlert').innerHTML = inc ? `<span class="pill bad">INCIDENT</span> <span class="bad">${esc(G.cityOf(inc).name)}</span>` : '<span class="pill good">NOMINAL</span>';
  $$('#speeds button').forEach((b, i) => b.classList.toggle('on', S.speed === i));
  const ban = $('#banner');
  if (S.needsHQ) { const n = 4 - (S.setupLeft ?? 3); ban.style.display = 'block'; ban.textContent = n === 1 ? 'Base 1 of 3 — select a site inside the national territory for your Headquarters.' : `Base ${n} of 3 — select a site for a regional garrison (at least 30 km from other bases).`; }
  else if (GAME.front) { ban.style.display = 'block'; ban.textContent = 'Front line — click the map where your units should hold (Esc / right-click to cancel)'; }
  else if (GAME.placing) { ban.style.display = 'block'; ban.textContent = `Place ${GAME.placing.label} — click the map (Esc / right-click to cancel)`; }
  else ban.style.display = 'none';
}
let lastLog = '';
export function refreshAll(soft) {
  const S = G.getS(); if (!S) return;
  renderTab(soft); renderCtx();
  const sig = S.log.slice(0, 5).map(l => l.t + l.text).join();
  if (sig !== lastLog) { lastLog = sig; $('#log').innerHTML = S.log.slice(0, 5).map(l => `<div class="${l.kind}"><span class="mut mono">${fmtDate(l.t).slice(-5)}</span> ${esc(l.text)}</div>`).join(''); }
}
UI.refresh = refreshAll; UI.game = GAME;

function onMapClick(hit, geo) {
  const S = G.getS();
  if (S.needsHQ || GAME.placing) {
    if (!geo) return;
    const err = G.canPlaceBase(geo); if (err) return flash(err);
    if (S.needsHQ) {
      const { city } = G.nearestCity(geo);
      const hq = (S.setupLeft ?? 3) >= 3, L = ['Alpha', 'Bravo', 'Charlie'][3 - (S.setupLeft ?? 3)];
      modal(hq ? `<h2>Base 1 of 3 — Headquarters</h2><p>Headquarters near <b>${esc(city.name)}</b>. Starts with 2× Barracks, Armory, 2× Motor Pool, Helipad, 64 personnel, the surplus stock released by the Ministry of the Armed Forces, and Contingency Group Alpha.</p>
        <div class="col"><span class="lbl">Base name</span><input id="hqName" value="HQ ${esc(city.name)}"></div>`
        : `<h2>Base ${4 - S.setupLeft} of 3 — Regional garrison</h2><p>Garrison near <b>${esc(city.name)}</b>. Starts with Barracks, Armory, Motor Pool, Helipad, 40 personnel, its own stock and Contingency Group ${L} (rifle squad, response team, VAB, truck, Alouette).</p>
        <div class="col"><span class="lbl">Base name</span><input id="hqName" value="Garrison ${esc(city.name)}"></div>`) ;
      $('#modal .dlg').insertAdjacentHTML('beforeend', `<div class="foot"><button onclick="window.__close()">Cancel</button><button class="pri" id="hqOk">Establish</button></div>`);
      $('#hqOk').onclick = () => { const r = G.placeBase(geo, hq ? 'hq' : 'garrison', $('#hqName').value.trim()); if (typeof r === 'string') return flash(r); closeModal(); G.save(); UI.tab = S.needsHQ ? 'bases' : 'org'; refreshAll(); };
      return;
    }
    const p = GAME.placing; GAME.placing = null;
    const { city } = G.nearestCity(geo);
    const r = G.placeBase(geo, p.size, `${p.label} ${city.name}`);
    if (typeof r === 'string') flash(r); else { UI.tab = 'bases'; UI.openBase = r.id; }
    refreshAll(); return;
  }
  if (GAME.front) { GAME.front = null; if (!geo) return; return M.frontDialog(geo); }
  GAME.sel = hit ? { type: hit.type, id: hit.obj.id, obj: ['wcity', 'request', 'front'].includes(hit.type) ? hit.obj : undefined } : null;
  if (hit?.type === 'request' || hit?.type === 'front') UI.tab = 'world';
  if (hit?.type === 'base') { UI.tab = 'bases'; UI.openBase = hit.obj.id; }
  refreshAll();
}
function onMapHover(h, m) {
  if (!h) return tip(null);
  const o = h.obj;
  if (h.type === 'city') tip(`<b>${esc(o.name)}</b>${o.capital ? ' <span class="amb">★</span>' : ''}${o.surveyed ? ' <span class="pill acc">SURVEYED</span>' : ''}<div class="mut">Pop. ${num(o.pop)}</div><div class="row"><span style="width:62px">Integrity</span><b class="mono">${Math.round(o.integrity)}%</b></div><div class="row"><span style="width:62px">Panic</span><b class="mono">${Math.round(o.panic)}%</b></div>`, m, '#game');
  else if (h.type === 'wcity') { const x = G.getS().world?.inf[o.k] || 0; tip(`<b>${esc(o.name)}</b>${o.capital ? ' <span class="amb">★</span>' : ''}<div class="mut">Pop. ${num(o.pop)} · ${esc(o.cc)}</div><div class="row"><span style="width:70px">Overrun</span><b class="mono ${x > 0.1 ? 'bad' : ''}">${Math.round(x * 100)}%</b></div>`, m, '#game'); }
  else if (h.type === 'request') tip(`<b class="amb">Assistance requested</b><div>${esc(o.name)}</div><div class="mut">Open the World tab to respond.</div>`, m, '#game');
  else if (h.type === 'front') tip(`<b>${esc(o.name)}</b><div class="mut">${o.units.length} unit(s) holding · ${o.kia || 0} KIA</div>`, m, '#game');
  else if (h.type === 'base') tip(`<b>${esc(o.name)}</b><div class="mut">${o.built ? 'Operational' : 'Under construction'}</div>`, m, '#game');
  else if (h.type === 'unit') tip(`<b>${esc(o.name)}</b><div class="mut">${o.status}</div>`, m, '#game');
}
function tip(html, m, scr) {
  const t = $('#tip'); if (!html || !m) { t.style.display = 'none'; return; }
  const r = $(scr + ' canvas').getBoundingClientRect();
  t.innerHTML = html; t.style.display = 'block'; t.style.left = (r.left + m[0] + 16) + 'px'; t.style.top = (r.top + m[1] + 12) + 'px';
}
export function flash(msg) { const b = $('#banner'); b.style.display = 'block'; b.textContent = msg; b.style.background = '#4a1a1df0'; b.style.borderColor = 'var(--red)'; setTimeout(() => { b.style.background = ''; b.style.borderColor = ''; }, 1800); }
UI.flash = flash;

$$('#tabs button').forEach(b => b.onclick = () => { UI.tab = b.dataset.tab; renderTab(); });
$$('#speeds button').forEach((b, i) => b.onclick = () => { const S = G.getS(); if (!S.needsHQ) S.speed = i; });
$('#btnMenu').onclick = () => escMenu(menu);
window.addEventListener('keydown', e => {
  if (!$('#game').classList.contains('on') || e.target.tagName === 'INPUT') return;
  const S = G.getS();
  if (e.key === 'Escape') { if ($('#modal').classList.contains('on')) return; if (GAME.placing || GAME.front) { GAME.placing = null; GAME.front = null; return; } escMenu(menu); }
  if (e.key === 'm' || e.key === 'M') toggleView();
  if (e.key === ' ') { e.preventDefault(); if (!S.needsHQ && !$('#modal').classList.contains('on')) S.speed = S.speed ? 0 : 1; }
  if (['1', '2', '3'].includes(e.key) && !S.needsHQ) S.speed = +e.key;
});
$('#game canvas').addEventListener('contextmenu', e => { e.preventDefault(); GAME.placing = null; GAME.front = null; });
$('#btnView').onclick = toggleView;
window.__S = () => G.getS(); window.__tick = ms => G.tick(ms); window.__ui = UI; window.__newOutbreak = th => newOutbreak(G.getS(), th, G.GEO.ci); window.__handle = e => handleEvent(e); window.__G = G; window.__wg = { landAt, G: WG };
window.__dbgIncident = () => { const i = G.debugSpawn(); if (i) handleEvent({ type: 'incident', inc: i }); };

menu();
