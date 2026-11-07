import * as G from './state.js';
import { ITEM, ITEMS, INF_SUBS, EQUIP_TABS, BASE_SIZES, MODULES, TEMPLATES, THREATS, isVehicle, isHeli } from './catalog.js';
import { $, $$, esc, eur, num, big, bar, fmtDate, fmtDay, dur } from './util.js';
import { badgeSVG } from './badge.js';
import { panicColor } from './map.js';
import { distKm } from './geo.js';
import * as M from './modals.js';

export const UI = { tab: 'org', eqTab: 'infantry', eqBase: 'all', eqCatalog: false, eqOpen: null, openBase: null, refresh: () => {}, game: null, flash: () => {} };
let lastHTML = '', lastCtx = '', mouseDown = false;
document.addEventListener('pointerdown', () => mouseDown = true, true);
document.addEventListener('pointerup', () => setTimeout(() => mouseDown = false, 0), true);

export function renderTab(soft) {
  const S = G.getS(); if (!S) return;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === UI.tab));
  const html = ({ org: tabOrg, equip: tabEquip, research: tabResearch, bases: tabBases })[UI.tab](S);
  if (soft && (html === lastHTML || mouseDown)) return;
  const body = $('#tabbody'), st = body.scrollTop;
  if (!soft || html !== lastHTML) { body.innerHTML = html; body.scrollTop = soft ? st : (UI.keepScroll ? st : 0); UI.keepScroll = false; }
  lastHTML = html;
}

const mandate = s => s >= 80 ? 'Paramount' : s >= 60 ? 'Trusted' : s >= 35 ? 'Recognised' : 'Provisional';
const stockTotal = (S, id, baseId) => S.bases.filter(b => baseId === 'all' || b.id === baseId).reduce((a, b) => a + (b.storage[id] || 0), 0);

// ---------------- Organization ----------------
function tabOrg(S) {
  const nat = G.nationalStats(), up = G.monthlyUpkeep(), grant = G.grantNow();
  const pers = { assigned: S.units.reduce((a, u) => a + u.pers, 0), free: S.bases.reduce((a, b) => a + b.personnel, 0), training: S.recruits.reduce((a, r) => a + r.n, 0) };
  const deployed = S.units.filter(u => u.status !== 'ready');
  const veh = S.units.filter(u => u.vehicle);
  const nextMonth = (() => { const d = new Date(S.t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); })();
  const alert = nat.panic > 50 ? ['CRITICAL', 'bad'] : nat.panic > 25 || G.activeIncident() ? ['ELEVATED', 'amb'] : ['GUARDED', 'good'];
  return `
  <div class="row" style="gap:14px;margin-bottom:14px">${badgeSVG(S.org.badge, 86)}<div class="col" style="gap:2px"><div class="title">${esc(S.org.name)}</div>
    <div class="mut">${esc(S.org.acronym)} · Chartered ${fmtDay(S.org.founded)}</div><div>Mandate: <b class="acc">${mandate(S.standing)}</b></div></div></div>
  <div class="sec"><div class="lbl">Nation</div><div class="card stats">
    <span>Country</span><span>${esc(S.nation.flag || '')} ${esc(S.nation.name)}</span><span>Capital</span><span>${esc(S.nation.capital)}</span>
    <span>Population${S.nation.popYear ? ' (' + S.nation.popYear + ')' : ''}</span><span>${big(S.nation.pop)}</span>
    <span>GDP${S.nation.gdpYear ? ' (' + S.nation.gdpYear + ')' : ''}</span><span>$${big(S.nation.gdp)}</span>
    <span>Monitored cities</span><span>${S.cities.length}</span><span>National alert</span><span class="${alert[1]}">${alert[0]}</span>
    <span>Urban integrity (pop.-weighted)</span><span>${nat.integrity.toFixed(1)}%</span><span>Urban panic (pop.-weighted)</span><span>${nat.panic.toFixed(1)}%</span>
  </div></div>
  <div class="sec"><div class="lbl">Standing</div><div class="card col">
    <div class="row"><span style="width:150px">Government standing</span>${bar(S.standing, '#59c8e8')}<b class="mono" style="width:30px;text-align:right">${Math.round(S.standing)}</b></div>
    <div class="row"><span style="width:150px">Public trust</span>${bar(S.trust, '#5ec98c')}<b class="mono" style="width:30px;text-align:right">${Math.round(S.trust)}</b></div>
    <div class="mut" style="font-size:12px">Standing scales the monthly grant (×${(0.5 + S.standing / 100).toFixed(2)}) and unlocks procurement of modern equipment. Contained incidents raise it; lost cities collapse it.</div>
  </div></div>
  <div class="sec"><div class="lbl">Funding</div><div class="card stats">
    <span>Balance</span><span class="${S.funds < 0 ? 'bad' : ''}">${eur(S.funds)}</span><span>Monthly grant (projected)</span><span class="good">+${eur(grant)}</span>
    <span>Monthly upkeep</span><span class="bad">−${eur(up.total)}</span><span>Net per month</span><span class="${grant - up.total < 0 ? 'bad' : 'good'}">${eur(grant - up.total)}</span>
    <span>Next payment</span><span>${fmtDay(nextMonth)}</span></div>
    <table class="t">${S.ledger.slice(0, 8).map(l => `<tr><td class="mut mono" style="width:70px">${fmtDay(l.t).slice(0, 6)}</td><td>${esc(l.text)}</td><td class="n ${l.amount < 0 ? 'bad' : 'good'}">${eur(l.amount)}</td></tr>`).join('') || '<tr><td class="mut">No transactions yet.</td></tr>'}</table>
  </div>
  <div class="sec"><div class="lbl">Active assets</div><div class="card stats">
    <span>Bases</span><span>${S.bases.filter(b => b.built).length} operational${S.bases.some(b => !b.built) ? ` + ${S.bases.filter(b => !b.built).length} building` : ''}</span>
    <span>Personnel in units</span><span>${pers.assigned}</span><span>Unassigned personnel</span><span>${pers.free}</span><span>In training</span><span>${pers.training}</span>
    <span>Fielded units</span><span>${S.units.length}</span><span>Fielded vehicles</span><span>${veh.filter(u => !isHeli(u.vehicle)).length} ground · ${veh.filter(u => isHeli(u.vehicle)).length} air</span>
    <span>Deployed now</span><span class="${deployed.length ? 'amb' : ''}">${deployed.length}</span><span>Contingency groups</span><span>${S.groups.length}</span>
  </div></div>
  <div class="sec"><div class="lbl">Incident record</div>${S.incidents.length ? S.incidents.slice().reverse().map(i => { const c = S.cities.find(x => x.id === i.cityId); return `<div class="card row"><span class="pill" style="color:${THREATS[i.threat].color}">${THREATS[i.threat].short}</span><div class="sp"><b>${esc(c.name)}</b> — ${esc(i.district)}<div class="mut" style="font-size:12px">${fmtDate(i.t0)} · ${esc(THREATS[i.threat].name)}</div></div><span class="${i.phase === 'resolved' ? 'good' : i.phase === 'lost' ? 'bad' : 'amb'}">${i.phase.toUpperCase()}</span></div>`; }).join('') : '<div class="mut">No incidents recorded.</div>'}</div>`;
}

// ---------------- Equipment ----------------
function tabEquip(S) {
  const tab = UI.eqTab;
  const items = ITEMS.filter(i => tab === 'infantry' ? i.cat === 'infantry' : i.cat === tab);
  const rows = it => {
    const q = stockTotal(S, it.id, UI.eqBase);
    if (!UI.eqCatalog && !q) return '';
    const fielded = S.units.reduce((a, u) => a + (u.items[it.id] || 0), 0);
    const incoming = S.deliveries.filter(d => d.item === it.id).reduce((a, d) => a + d.qty, 0);
    const locked = S.standing < it.standing;
    const open = UI.eqOpen === it.id;
    const spec = it.cat === 'infantry' ? (it.sub === 'gear' ? '' : `${it.cal} · ${it.range} m`) : `${it.crew}+${it.pax} · ${it.armor} · ${it.speed} km/h`;
    return `<tr class="it" data-act="eqOpen" data-id="${it.id}"><td><b>${esc(it.name)}</b><div class="mut" style="font-size:11px">${esc(it.origin)}${spec ? ' · ' + spec : ''}</div></td>
      <td class="n">${q || '<span class="mut">0</span>'}</td><td class="n mut">${fielded || ''}</td><td class="n amb">${incoming ? '+' + incoming : ''}</td></tr>
      ${open ? `<tr><td colspan="4" class="det"><div>${esc(it.desc)}</div>
        <div class="stats" style="margin:6px 0">${it.cat === 'infantry' ? (it.sub !== 'gear' ? `<span>Calibre</span><span>${it.cal}</span><span>Effective range</span><span>${it.range} m</span><span>Firepower</span><span>${it.power}</span>` : '') : `<span>Crew / passengers</span><span>${it.crew} / ${it.pax}</span><span>Armour</span><span>${it.armor}</span><span>Road speed</span><span>${it.speed} km/h</span><span>Armament</span><span>${esc(it.arm)}</span><span>Firepower</span><span>${it.power}</span>`}
        <span>Unit cost</span><span>${eur(it.cost)}</span><span>Delivery</span><span>${it.lead} days</span><span>Required standing</span><span class="${locked ? 'bad' : ''}">${it.standing}</span></div>
        ${S.bases.filter(b => b.storage[it.id]).map(b => `<div class="row"><span class="sp">${esc(b.name)}</span><span class="mono">${b.storage[it.id]}</span></div>`).join('')}
        <div class="row" style="margin-top:6px"><button class="sm pri" data-act="order" data-id="${it.id}" ${locked ? 'disabled' : ''}>Procure…</button><button class="sm" data-act="transfer" data-id="${it.id}" ${q && S.bases.length > 1 ? '' : 'disabled'}>Transfer…</button>${locked ? '<span class="bad" style="font-size:11px">Standing too low</span>' : ''}</div></td></tr>` : ''}`;
  };
  let body;
  if (tab === 'infantry') body = INF_SUBS.map(([k, label]) => { const r = items.filter(i => i.sub === k).map(rows).join(''); return r ? `<tr><th colspan="4" style="padding-top:12px;color:var(--acc)">${label}</th></tr>${r}` : ''; }).join('');
  else body = items.map(rows).join('');
  const deliveries = S.deliveries.filter(d => (tab === 'infantry' ? ITEM[d.item].cat === 'infantry' : ITEM[d.item].cat === tab));
  return `<div class="subtabs">${EQUIP_TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="eqTab" data-id="${k}">${l}</button>`).join('')}</div>
   <div class="row" style="margin-bottom:8px"><select data-act="eqBase"><option value="all">All bases</option>${S.bases.map(b => `<option value="${b.id}" ${UI.eqBase === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
   <span class="sp"></span><button class="sm ${UI.eqCatalog ? 'on' : ''}" data-act="eqCatalog">${UI.eqCatalog ? 'Showing catalogue' : 'Show procurement catalogue'}</button></div>
   <div class="mut" style="font-size:12px;margin-bottom:6px">Storage only — equipment issued to fielded units is listed under Bases. Click a row for details.</div>
   <table class="t"><tr><th>Item</th><th class="n">Stored</th><th class="n">Fielded</th><th class="n">Inbound</th></tr>${body || `<tr><td colspan="4" class="mut" style="padding:14px 4px">Nothing in storage. Open the procurement catalogue to order.</td></tr>`}</table>
   ${deliveries.length ? `<div class="sec" style="margin-top:14px"><div class="lbl">Inbound deliveries</div>${deliveries.map(d => `<div class="row"><span class="sp">${d.qty}× ${esc(ITEM[d.item].name)} → ${esc(S.bases.find(b => b.id === d.baseId).name)}</span><span class="mono mut">${dur(d.at - S.t)}</span></div>`).join('')}</div>` : ''}`;
}

// ---------------- Research ----------------
function tabResearch(S) {
  return `<div class="col" style="align-items:center;text-align:center;padding:40px 10px;gap:10px">
    <div style="font-size:38px;opacity:.35">⌬</div><div class="title" style="font-size:16px">No study projects</div>
    <div class="mut" style="max-width:300px">Study projects open up as your teams recover material from neutralised threats. A Laboratory is required at one of your bases.</div></div>
    ${S.specimens.length ? `<div class="sec"><div class="lbl">Specimen archive</div>${S.specimens.map(s => `<div class="card row"><span class="pill" style="color:${THREATS[s.threat].color}">${THREATS[s.threat].short}</span><span class="sp">${s.n} sample(s) — ${esc(s.city)}</span><span class="mut mono">${fmtDay(s.t)}</span></div>`).join('')}</div>` : ''}`;
}

// ---------------- Bases ----------------
function tabBases(S) {
  const capRow = (l, u, c) => `<span>${l}</span>${bar(c ? u / c * 100 : 0, u > c ? '#e5484d' : '#59c8e8')}<span class="mono" style="text-align:right">${u}/${c}</span>`;
  const bases = S.bases.map(b => {
    const open = UI.openBase === b.id, caps = G.baseCaps(b), use = G.baseUsage(b), size = BASE_SIZES[b.size];
    const units = S.units.filter(u => u.baseId === b.id);
    const head = `<div class="row" data-act="openBase" data-id="${b.id}" style="cursor:pointer"><span style="font-size:15px;color:var(--acc)">◆</span><div class="sp"><b>${esc(b.name)}</b><div class="mut" style="font-size:11.5px">${size.name} · ${b.built ? `${units.length} units · ${b.personnel} unassigned` : `<span class="amb">Under construction — ${dur(b.doneAt - S.t)}</span>`}</div></div><span class="mut">${open ? '▾' : '▸'}</span></div>`;
    if (!open) return `<div class="card">${head}</div>`;
    const slots = [];
    for (let i = 0; i < size.slots; i++) { const m = b.modules[i]; slots.push(m ? `<div class="slot ${m.done ? '' : 'build'}" title="${esc(MODULES[m.type].desc)}"><b>${MODULES[m.type].name}</b>${m.done ? '' : `<span>${dur(m.doneAt - S.t)}</span>`}</div>` : `<div class="slot empty" data-act="module" data-id="${b.id}">+ Build</div>`); }
    const recruits = S.recruits.filter(r => r.baseId === b.id).reduce((a, r) => a + r.n, 0);
    return `<div class="card">${head}
      <div style="margin:10px 0 6px" class="lbl">Modules (${b.modules.length}/${size.slots})</div><div class="slots">${slots.join('')}</div>
      <div style="margin:12px 0 6px" class="lbl">Capacity</div><div class="cap">${capRow('Personnel', use.pers, caps.pers)}${capRow('Infantry storage', use.inf, caps.inf)}${capRow('Vehicle bays', use.ground, caps.ground)}${capRow('Helicopter bays', use.heli, caps.heli)}</div>
      <div class="row" style="margin-top:10px"><span class="sp">Unassigned personnel: <b class="mono">${b.personnel}</b>${recruits ? ` <span class="amb">(+${recruits} training)</span>` : ''}</span><button class="sm" data-act="recruit" data-id="${b.id}" ${b.built ? '' : 'disabled'}>Recruit…</button></div>
      <div style="margin:12px 0 6px" class="lbl">Fielded units</div>
      <table class="t">${units.map(u => { const st = G.unitStats(u); return `<tr><td><b>${esc(u.name)}</b><div class="mut" style="font-size:11px">${u.vehicle ? esc(ITEM[u.vehicle].name) : esc(TEMPLATES[u.tpl].name)} · ${u.pers} pers${Object.entries(u.items).filter(([id]) => !isVehicle(id)).map(([id, q]) => ` · ${q}× ${esc(ITEM[id].name)}`).join('')}</div></td><td class="n" title="Firepower / protection">${st.fire}/${st.prot}</td><td class="n"><span class="${u.status === 'ready' ? 'good' : 'amb'}">${u.status}</span></td><td class="n">${u.status === 'ready' ? `<button class="sm" data-act="disband" data-id="${u.id}" title="Return equipment to storage">✕</button>` : ''}</td></tr>`; }).join('') || '<tr><td class="mut">No units.</td></tr>'}</table>
      <div class="row" style="margin-top:8px"><button class="sm pri" data-act="form" data-id="${b.id}" ${b.built ? '' : 'disabled'}>Form unit…</button><button class="sm" data-act="focusBase" data-id="${b.id}">Show on map</button></div>
    </div>`;
  }).join('');
  const groups = S.groups.map(g => {
    const us = g.unitIds.map(id => S.units.find(u => u.id === id)).filter(Boolean);
    const baseNames = [...new Set(us.map(u => S.bases.find(b => b.id === u.baseId)?.name))].join(', ');
    return `<div class="card"><div class="row"><b class="sp">${esc(g.name)}</b><button class="sm" data-act="editGroup" data-id="${g.id}">Edit…</button></div>
      <div class="mut" style="font-size:12px">${us.length} units · ${us.reduce((a, u) => a + u.pers, 0)} personnel${baseNames ? ' · ' + esc(baseNames) : ''}</div>
      <div style="font-size:12px;margin-top:4px">${us.map(u => `<span class="${u.status === 'ready' ? '' : 'amb'}">${esc(u.name)}</span>`).join(' · ') || '<span class="mut">Empty</span>'}</div></div>`;
  }).join('');
  return `<div class="sec"><div class="lbl">Bases</div>${bases}
     <div class="row wrap" style="margin-top:6px">${Object.entries(BASE_SIZES).map(([k, s]) => `<button class="sm" data-act="newBase" data-id="${k}" ${S.funds < s.cost ? 'disabled' : ''}>+ ${s.name} <span class="mut">${eur(s.cost)}</span></button>`).join('')}</div></div>
   <div class="sec"><div class="lbl">Contingency groups</div>${groups}<button class="sm" data-act="newGroup">+ New contingency group</button></div>
   ${S.transfers.length ? `<div class="sec"><div class="lbl">Convoys</div>${S.transfers.map(t => `<div class="row"><span class="sp">${esc(S.bases.find(b => b.id === t.from).name)} → ${esc(S.bases.find(b => b.id === t.to).name)}</span><span class="mono mut">${dur(t.at - S.t)}</span></div>`).join('')}</div>` : ''}`;
}

// ---------------- Context panel ----------------
export function renderCtx() {
  const S = G.getS(), sel = UI.game?.sel, el = $('#ctx');
  if (!sel) { el.style.display = 'none'; $('#log').style.right = '12px'; lastCtx = ''; return; }
  let html = '';
  if (sel.type === 'city') {
    const c = S.cities.find(x => x.id === sel.id); if (!c) return;
    const inc = S.incidents.find(i => i.cityId === c.id && ['alert', 'responding', 'onscene'].includes(i.phase));
    const nb = S.bases.map(b => ({ b, km: distKm([b.lon, b.lat], [c.lon, c.lat]) })).sort((a, b) => a.km - b.km)[0];
    html = `<div class="row"><div class="title sp">${esc(c.name)}</div><button class="sm" data-act="closeCtx">✕</button></div>
     <div class="mut">${c.capital ? 'National capital · ' : ''}Population ${num(c.pop)}</div>
     <div class="col" style="margin:10px 0"><div class="row"><span style="width:70px">Integrity</span>${bar(c.integrity, '#d8eef6')}<b class="mono" style="width:38px;text-align:right">${Math.round(c.integrity)}%</b></div>
     <div class="row"><span style="width:70px">Panic</span>${bar(c.panic, panicColor(c.panic))}<b class="mono" style="width:38px;text-align:right">${Math.round(c.panic)}%</b></div>
     <div class="row"><span style="width:70px">Status</span><b class="${c.status === 'normal' ? 'good' : 'bad'}">${c.status.toUpperCase()}</b></div></div>
     <div class="card" style="font-size:12px">${c.surveyed ? '<b class="acc">Detailed survey on file</b><div class="mut">Building footprints, road network and traffic model available — tactical operations possible.</div>' : '<b>No detailed survey</b><div class="mut">Only strategic data available for this city.</div>'}</div>
     ${nb ? `<div class="mut" style="font-size:12px">Nearest base: ${esc(nb.b.name)} — ${Math.round(nb.km)} km</div>` : ''}
     ${inc ? `<div class="card" style="border-color:#e5484d66;margin-top:10px"><div class="row"><span class="pill" style="color:${THREATS[inc.threat].color}">${THREATS[inc.threat].short}</span><b class="sp">${esc(THREATS[inc.threat].name)}</b></div>
       <div class="mut" style="font-size:12px;margin:4px 0">${esc(inc.district)} · since ${fmtDate(inc.t0)}</div>
       <div class="row"><span style="width:70px">Spread</span>${bar(inc.infest, '#e5484d')}<b class="mono" style="width:38px;text-align:right">${Math.round(inc.infest)}</b></div>
       <div style="margin-top:6px;font-size:12px">${inc.units.map(id => S.units.find(u => u.id === id)).filter(Boolean).map(u => `<div class="row"><span class="sp">${esc(u.name)}</span><span class="${u.status === 'onscene' ? 'good' : 'amb'}">${u.status === 'transit' ? 'ETA ' + dur(u.route.arr - S.t) : u.status}</span></div>`).join('') || '<span class="bad">No forces assigned.</span>'}</div>
       <div class="row" style="margin-top:8px"><button class="pri sm" data-act="dispatch" data-id="${inc.id}">Dispatch forces…</button>${inc.handoff ? `<button class="sm" data-act="handoff" data-id="${inc.id}">Command on scene…</button>` : ''}</div></div>` : ''}`;
  } else if (sel.type === 'base') {
    const b = S.bases.find(x => x.id === sel.id); if (!b) return;
    html = `<div class="row"><div class="title sp">${esc(b.name)}</div><button class="sm" data-act="closeCtx">✕</button></div><div class="mut">${BASE_SIZES[b.size].name} · ${b.built ? 'Operational' : 'Under construction'}</div>
      <div style="margin-top:8px">${b.modules.map(m => `<span class="pill ${m.done ? 'acc' : 'amb'}" style="margin:2px">${MODULES[m.type].name}</span>`).join('')}</div>
      <div class="mut" style="margin-top:8px;font-size:12px">Details are open in the Bases tab.</div>`;
  } else if (sel.type === 'unit') {
    const u = S.units.find(x => x.id === sel.id); if (!u) { UI.game.sel = null; return; }
    html = `<div class="row"><div class="title sp">${esc(u.name)}</div><button class="sm" data-act="closeCtx">✕</button></div>
      <div class="mut">${u.vehicle ? esc(ITEM[u.vehicle].name) : esc(TEMPLATES[u.tpl].name)} · ${u.pers} personnel</div>
      <div class="stats" style="margin-top:8px"><span>Status</span><span>${u.status}</span>${u.route ? `<span>Mode</span><span>${u.route.mode}</span><span>${u.status === 'onscene' ? 'Approach' : 'ETA'}</span><span>${u.status === 'onscene' ? u.approach : dur(u.route.arr - S.t)}</span>` : ''}</div>`;
  }
  el.style.display = 'block'; $('#log').style.right = '354px';
  if (html !== lastCtx && !mouseDown) { el.innerHTML = html; lastCtx = html; }
}

// ---------------- Actions ----------------
function act(e) {
  const t = e.target.closest('[data-act]'); if (!t || t.tagName === 'SELECT' && e.type === 'click') return;
  const S = G.getS(), id = t.dataset.id, a = t.dataset.act;
  UI.keepScroll = true;
  switch (a) {
    case 'eqTab': UI.eqTab = id; UI.eqOpen = null; UI.keepScroll = false; break;
    case 'eqOpen': UI.eqOpen = UI.eqOpen === id ? null : id; break;
    case 'eqCatalog': UI.eqCatalog = !UI.eqCatalog; break;
    case 'order': return M.orderDialog(id);
    case 'transfer': return M.transferDialog(id);
    case 'openBase': UI.openBase = UI.openBase === id ? null : id; break;
    case 'module': return M.moduleDialog(id);
    case 'recruit': return M.recruitDialog(id);
    case 'form': return M.formDialog(id);
    case 'disband': { const err = G.disband(id); if (err) UI.flash(err); break; }
    case 'focusBase': { const b = S.bases.find(x => x.id === id); UI.game.map.focus([b.lon, b.lat], 4); break; }
    case 'newBase': UI.game.placing = { size: id, label: BASE_SIZES[id].name }; break;
    case 'newGroup': S.groups.push({ id: 'g' + Math.random().toString(36).slice(2, 7), name: `Contingency Group ${'Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett'.split(' ')[S.groups.length % 10]}`, unitIds: [] }); break;
    case 'editGroup': return M.groupDialog(id);
    case 'closeCtx': UI.game.sel = null; break;
    case 'dispatch': return M.showDispatch(S.incidents.find(i => i.id === id));
    case 'handoff': return M.showHandoff(S.incidents.find(i => i.id === id));
  }
  UI.refresh();
}
for (const s of ['#tabbody', '#ctx']) { document.querySelector(s).addEventListener('click', act); }
document.querySelector('#tabbody').addEventListener('change', e => { if (e.target.dataset.act === 'eqBase') { UI.eqBase = e.target.value; UI.refresh(); } });
