import * as G from './state.js';
import { ITEM, ITEMS, MODULES, TEMPLATES, GEAR_OPTS, THREATS, BASE_SIZES, isVehicle, isHeli } from './catalog.js';
import { $, $$, esc, eur, num, dur, fmtDate, fmtTime } from './util.js';
import { distKm, compass, bearing } from './geo.js';
import { UI } from './tabs.js';
import { VERSION } from './version.js';
import { enterTactical } from './tactical/index.js';
import { packFor, packUrl } from './packs.js';
const packOf = city => packFor(G.getS().nation.cca2, city.name);

export function modal(html, cls = 'dlg') { const m = $('#modal'); m.innerHTML = `<div class="${cls}">${html}</div>`; m.classList.add('on'); }
export function closeModal() { $('#modal').classList.remove('on'); $('#modal').innerHTML = ''; UI.refresh(); }
window.__close = closeModal;
const err = msg => { const e = $('#modal .err'); if (e) e.textContent = msg || ''; };

// ---------------- Procurement / logistics ----------------
export function orderDialog(id) {
  const S = G.getS(), it = ITEM[id], bases = S.bases.filter(b => b.built || true);
  modal(`<h2>Procure — ${esc(it.name)}</h2><div class="mut">${esc(it.desc)}</div>
   <div class="row" style="margin-top:12px"><div class="col sp"><span class="lbl">Quantity</span><input id="oq" type="number" min="1" value="${isVehicle(id) ? 1 : 10}"></div>
   <div class="col sp"><span class="lbl">Deliver to</span><select id="ob">${bases.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div></div>
   <div class="stats" style="margin-top:10px"><span>Unit cost</span><span>${eur(it.cost)}</span><span>Total</span><span id="ot"></span><span>Delivery time</span><span>${it.lead} days</span><span>Funds</span><span>${eur(S.funds)}</span></div>
   <div class="err"></div><div class="foot"><button onclick="__close()">Cancel</button><button class="pri" id="ook">Place order</button></div>`);
  const upd = () => { $('#ot').textContent = eur(it.cost * Math.max(1, +$('#oq').value || 1)); };
  $('#oq').oninput = upd; upd();
  $('#ook').onclick = () => { const e = G.order(id, Math.max(1, Math.floor(+$('#oq').value || 1)), $('#ob').value); if (e) return err(e); closeModal(); };
}
export function transferDialog(id) {
  const S = G.getS(), it = ITEM[id], src = S.bases.filter(b => b.storage[id]);
  modal(`<h2>Transfer — ${esc(it.name)}</h2>
   <div class="row"><div class="col sp"><span class="lbl">From</span><select id="tf">${src.map(b => `<option value="${b.id}">${esc(b.name)} (${b.storage[id]})</option>`).join('')}</select></div>
   <div class="col sp"><span class="lbl">To</span><select id="tt">${S.bases.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
   <div class="col" style="width:90px"><span class="lbl">Qty</span><input id="tq" type="number" min="1" value="1"></div></div>
   <div class="mut" id="tinfo" style="margin-top:8px"></div><div class="err"></div>
   <div class="foot"><button onclick="__close()">Cancel</button><button class="pri" id="tok">Send convoy</button></div>`);
  const upd = () => { const a = S.bases.find(b => b.id === $('#tf').value), b = S.bases.find(x => x.id === $('#tt').value); const km = distKm([a.lon, a.lat], [b.lon, b.lat]) * 1.3; $('#tinfo').textContent = a === b ? 'Pick a different destination.' : `Road convoy ≈ ${Math.round(km)} km, arrives in ${dur((4 + km / 60) * 3600e3)}.`; };
  $('#tf').onchange = $('#tt').onchange = upd; if (S.bases[1]) $('#tt').value = S.bases.find(b => b.id !== src[0].id).id; upd();
  $('#tok').onclick = () => { if ($('#tf').value === $('#tt').value) return err('Same base.'); const e = G.transfer($('#tf').value, $('#tt').value, { [id]: Math.max(1, Math.floor(+$('#tq').value)) }); if (e) return err(e); closeModal(); };
}
export function moduleDialog(baseId) {
  const S = G.getS(), b = S.bases.find(x => x.id === baseId);
  modal(`<h2>Build module — ${esc(b.name)}</h2><table class="t">${Object.entries(MODULES).map(([k, m]) => `<tr><td><b>${m.name}</b><div class="mut" style="font-size:12px">${esc(m.desc)}</div></td><td class="n">${eur(m.cost)}<div class="mut">${m.days} d · ${eur(m.upkeep)}/mo</div></td><td class="n"><button class="sm pri" data-m="${k}" ${S.funds < m.cost ? 'disabled' : ''}>Build</button></td></tr>`).join('')}</table>
   <div class="err"></div><div class="foot"><button onclick="__close()">Close</button></div>`);
  $$('#modal [data-m]').forEach(bt => bt.onclick = () => { const e = G.buildModule(baseId, bt.dataset.m); if (e) return err(e); closeModal(); });
}
export function recruitDialog(baseId) {
  const S = G.getS(), b = S.bases.find(x => x.id === baseId), c = G.baseCaps(b), u = G.baseUsage(b);
  modal(`<h2>Recruit — ${esc(b.name)}</h2><div class="mut">Recruits complete 3 days of training before joining. €8,000 signing cost each, €3,800/month salary.</div>
   <div class="row" style="margin-top:12px"><span>Barracks: <b class="mono">${u.pers}/${c.pers}</b></span><span class="sp"></span><input id="rq" type="number" min="1" max="${Math.max(1, c.pers - u.pers)}" value="${Math.max(1, Math.min(8, c.pers - u.pers))}" style="width:90px"></div>
   <div class="err"></div><div class="foot"><button onclick="__close()">Cancel</button><button class="pri" id="rok">Recruit</button></div>`);
  $('#rok').onclick = () => { const e = G.recruit(baseId, Math.max(1, Math.floor(+$('#rq').value))); if (e) return err(e); closeModal(); };
}

// ---------------- Form unit ----------------
export function formDialog(baseId) {
  const S = G.getS(), b = S.bases.find(x => x.id === baseId);
  let tpl = 'rifle';
  const render = () => {
    const T = TEMPLATES[tpl];
    const avail = subs => Object.keys(b.storage).filter(id => ITEM[id].cat === 'infantry' && subs.includes(ITEM[id].sub));
    let slotHtml = '';
    if (tpl === 'vehicle') {
      const vs = Object.keys(b.storage).filter(isVehicle);
      slotHtml = `<div class="col"><span class="lbl">Vehicle</span><select id="fv">${vs.map(v => `<option value="${v}">${esc(ITEM[v].name)} — crew ${ITEM[v].crew}, ${b.storage[v]} stored</option>`).join('') || '<option value="">No vehicles in storage</option>'}</select></div>`;
    } else {
      slotHtml = T.slots.map(([label, subs, n], i) => `<div class="row"><span style="width:140px">${label} ×${n}</span><select class="sp" data-slot="${i}">${avail(subs).map(id => `<option value="${id}" ${b.storage[id] < n ? 'disabled' : ''}>${esc(ITEM[id].name)} (${b.storage[id]})</option>`).join('') || '<option value="">None in storage</option>'}</select></div>`).join('') +
        `<div class="lbl" style="margin-top:6px">Protective gear (one per person if available)</div><div class="row wrap">${GEAR_OPTS.map(([g, l]) => `<label class="row" style="gap:4px"><input type="checkbox" data-gear="${g}" ${(b.storage[g] || 0) >= T.pers ? 'checked' : 'disabled'}> ${l} <span class="mut">(${b.storage[g] || 0})</span></label>`).join('')}</div>`;
    }
    modal(`<h2>Form unit — ${esc(b.name)}</h2>
     <div class="chips" style="margin-bottom:10px">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="${k === tpl ? 'on' : ''}" data-tpl="${k}">${t.name}${t.pers ? ` <span class="mut">${t.pers}</span>` : ''}</button>`).join('')}</div>
     <div class="col">${slotHtml}<div class="col"><span class="lbl">Unit name (optional)</span><input id="fn" placeholder="Auto"></div></div>
     <div class="mut" style="margin-top:8px">Unassigned personnel at base: <b class="mono">${b.personnel}</b></div>
     <div class="err"></div><div class="foot"><button onclick="__close()">Cancel</button><button class="pri" id="fok">Form unit</button></div>`);
    $$('#modal [data-tpl]').forEach(bt => bt.onclick = () => { tpl = bt.dataset.tpl; render(); });
    $('#fok').onclick = () => {
      const items = {}, gear = {};
      if (tpl === 'vehicle') { const v = $('#fv').value; if (!v) return err('No vehicle selected.'); items[v] = 1; }
      else {
        for (const [i, [, , n]] of T.slots.entries()) { const v = $(`#modal [data-slot="${i}"]`).value; if (!v) return err('A required weapon slot has nothing available.'); items[v] = (items[v] || 0) + n; }
        $$('#modal [data-gear]:checked').forEach(c => gear[c.dataset.gear] = T.pers);
      }
      const r = G.formUnit(baseId, tpl, items, gear, $('#fn').value.trim() || null);
      if (typeof r === 'string') return err(r);
      closeModal();
    };
  };
  render();
}

// ---------------- Groups ----------------
export function groupDialog(gid) {
  const S = G.getS(), g = S.groups.find(x => x.id === gid);
  const render = () => {
    modal(`<h2>Contingency group</h2><div class="col"><span class="lbl">Name</span><input id="gn" value="${esc(g.name)}"></div>
     <div class="lbl" style="margin:12px 0 6px">Units (any base)</div>
     ${S.bases.map(b => { const us = S.units.filter(u => u.baseId === b.id); return us.length ? `<div class="mut" style="margin-top:6px">${esc(b.name)}</div>${us.map(u => { const other = S.groups.find(x => x !== g && x.unitIds.includes(u.id)); return `<label class="row" style="padding:3px 0"><input type="checkbox" data-u="${u.id}" ${g.unitIds.includes(u.id) ? 'checked' : ''}> <span class="sp">${esc(u.name)}</span><span class="mut" style="font-size:11px">${other ? 'in ' + esc(other.name) : ''}</span></label>`; }).join('')}` : ''; }).join('')}
     <div class="mut" style="font-size:12px;margin-top:8px">A unit belongs to one group; checking it here moves it.</div>
     <div class="foot"><button class="warn" id="gdel">Delete group</button><span class="sp"></span><button onclick="__close()">Cancel</button><button class="pri" id="gok">Save</button></div>`);
    $('#gok').onclick = () => {
      g.name = $('#gn').value.trim() || g.name;
      const ids = $$('#modal [data-u]:checked').map(c => c.dataset.u);
      S.groups.forEach(x => { if (x !== g) x.unitIds = x.unitIds.filter(i => !ids.includes(i)); });
      g.unitIds = ids; closeModal();
    };
    $('#gdel').onclick = () => { S.groups = S.groups.filter(x => x !== g); closeModal(); };
  };
  render();
}

// ---------------- Incident flow ----------------
const CHANNEL = cca2 => cca2 === 'FR' ? 'CN24' : 'NNS 24';
export function showBroadcast(inc) {
  const S = G.getS(), city = S.cities.find(c => c.id === inc.cityId), T = THREATS[inc.threat];
  const fill = s => s.replaceAll('{city}', city.name).replaceAll('{district}', inc.district);
  const silhouette = Array.from({ length: 22 }, (_, i) => `<div style="width:${14 + (i * 37) % 22}px;height:${40 + (i * 53) % 120}px;background:#0b0b0b;border-top:2px solid #3a1010;margin:0 1px"></div>`).join('');
  modal(`<div class="scr"><div class="live"><b>LIVE</b><span style="color:#fff;font-weight:700;letter-spacing:.1em">${fmtTime(S.t)}</span></div><div class="chan">${CHANNEL(S.nation.cca2)}</div>
    <div class="body">${esc(fill(T.news))}<div style="margin-top:14px;font-size:13px;opacity:.75">Authorities urge residents of ${esc(city.name)} to follow official instructions. A special government unit has been notified.</div></div>
    <div class="city" style="${'box-shadow:inset 0 -60px 80px ' + T.color + '44'}">${silhouette}<div style="position:absolute;top:8px;left:10px;font-size:11px;color:#fff9;letter-spacing:.1em">${esc(city.name.toUpperCase())} — ${esc(inc.district.toUpperCase())}</div></div>
    <div class="lower"><div class="k">BREAKING NEWS</div><div class="h">${esc(city.name)}: ${esc(T.name)}</div></div>
    <div class="ticker"><span>${esc(city.name)} — roads out of the city congested as residents flee · Prefecture activates crisis cell · Hospitals in neighbouring cities on alert · Rail services to ${esc(city.name)} suspended · Interior minister to speak within the hour · </span></div></div>
    <div class="foot"><span class="mut sp" style="align-self:center">Incoming emergency call…</span><button class="pri" id="bcOk">Answer emergency call</button></div>`, 'tv');
  $('#bcOk').onclick = () => showCall(inc);
}
function showCall(inc) {
  const S = G.getS(), city = S.cities.find(c => c.id === inc.cityId), T = THREATS[inc.threat];
  const lines = T.call.map(s => s.replaceAll('{city}', city.name).replaceAll('{district}', inc.district));
  modal(`<div class="hd"><div class="dot"></div><div class="sp"><b>EMERGENCY LINE — PRIORITY ONE</b><div class="mut">Caller: ${esc(city.name)} crisis authorities · ${fmtTime(S.t)}</div></div></div>
    <div class="lines" id="cl"></div>
    <div class="foot" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button id="cLater">Acknowledge</button><button class="pri" id="cDisp">Dispatch forces…</button></div>`, 'call');
  let i = 0; const el = $('#cl');
  const next = () => { if (!$('#cl') || i >= lines.length) return; const d = document.createElement('div'); d.textContent = '› ' + lines[i++]; el.appendChild(d); setTimeout(next, 900); };
  next();
  inc.seen = true;
  $('#cLater').onclick = () => { closeModal(); UI.game.sel = { type: 'city', id: city.id }; UI.game.map.focus([city.lon, city.lat], 3); UI.refresh(); };
  $('#cDisp').onclick = () => { UI.game.sel = { type: 'city', id: city.id }; showDispatch(inc); };
}

export function showDispatch(inc) {
  const S = G.getS(), city = S.cities.find(c => c.id === inc.cityId);
  const ready = S.units.filter(u => u.status === 'ready');
  // pre-select the contingency group of the base nearest to the incident
  const nearestBase = S.bases.filter(b => b.built).sort((a, b) => distKm([a.lon, a.lat], [city.lon, city.lat]) - distKm([b.lon, b.lat], [city.lon, city.lat]))[0];
  const g0 = S.groups.find(g => g.unitIds.some(id => S.units.find(u => u.id === id)?.baseId === nearestBase?.id)) || S.groups[0];
  const sel = new Set(ready.filter(u => g0?.unitIds.includes(u.id)).map(u => u.id));
  let approach = null;
  const render = () => {
    const plans = G.planDispatch(inc, [...sel], approach);
    const natural = plans[0]?.dir;
    const dirs = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'];
    const coach = plans.filter(p => p.mode === 'coach');
    modal(`<h2>Dispatch — ${esc(city.name)}</h2><div class="mut">${esc(THREATS[inc.threat].name)} · ${esc(inc.district)} · spread ${Math.round(inc.infest)}</div>
     <div class="row" style="align-items:flex-start;gap:16px;margin-top:12px">
      <div class="sp col">
        <span class="lbl">Contingency groups</span>
        <div class="row wrap">${S.groups.map(g => { const us = g.unitIds.filter(id => ready.some(u => u.id === id)); const all = us.length && us.every(id => sel.has(id)); return `<button class="sm ${all ? 'on' : ''}" data-g="${g.id}" ${us.length ? '' : 'disabled'}>${esc(g.name)} <span class="mut">${us.length}</span></button>`; }).join('')}</div>
        <span class="lbl" style="margin-top:8px">Ready units</span>
        <div style="max-height:260px;overflow:auto">${S.bases.map(b => { const us = ready.filter(u => u.baseId === b.id); return us.length ? `<div class="mut" style="margin-top:4px">${esc(b.name)} — ${Math.round(distKm([b.lon, b.lat], [city.lon, city.lat]))} km</div>` + us.map(u => `<label class="row" style="padding:2px 0"><input type="checkbox" data-u="${u.id}" ${sel.has(u.id) ? 'checked' : ''}><span class="sp">${esc(u.name)}</span><span class="mut" style="font-size:11px">${u.pers} pers${u.vehicle ? ' · ' + (isHeli(u.vehicle) ? 'air' : 'ground') + ' · ' + ITEM[u.vehicle].pax + ' seats' : ''}</span></label>`).join('') : ''; }).join('') || '<div class="mut">No units ready.</div>'}</div>
      </div>
      <div class="col" style="align-items:center"><span class="lbl">Approach</span><div class="compass">${dirs.map(d => d ? `<button class="${(approach || natural) === d ? 'on' : ''}" data-dir="${d}">${d}</button>` : `<button data-dir="" title="Natural approach from base" class="${!approach ? 'on' : ''}">⊙</button>`).join('')}</div>
        <div class="mut" style="font-size:11px;max-width:150px;text-align:center">${approach ? 'Override adds detour around the city.' : `Natural: ${natural || '—'} (direction of your bases)`}</div></div>
     </div>
     <table class="t" style="margin-top:12px"><tr><th>Unit</th><th>Transport</th><th class="n">km</th><th class="n">ETA</th></tr>
      ${plans.sort((a, b) => a.eta - b.eta).map(p => `<tr><td>${esc(p.u.name)}</td><td class="${p.mode === 'coach' ? 'amb' : ''}" style="font-size:12px">${p.mode === 'air' ? '✈ ' : ''}${esc(p.carrier || (p.mode === 'air' ? 'Own aircraft' : 'Own vehicle'))}</td><td class="n">${Math.round(p.km)}</td><td class="n">${dur(p.eta)}</td></tr>`).join('') || '<tr><td colspan="4" class="mut">Select units to see the movement plan.</td></tr>'}</table>
     ${coach.length ? `<div class="amb" style="font-size:12px;margin-top:6px">${coach.length} infantry unit(s) lack seats in selected vehicles — civilian coaches will be requisitioned (slower). Add trucks, APCs or helicopters.</div>` : ''}
     <div class="mut" style="font-size:12px;margin-top:6px">Mobilisation: 2 h (1 h with a Comms Center). Forces stage outside the city on the ${approach || natural || '—'} side.</div>
     <div class="foot"><button onclick="__close()">Cancel</button><button class="pri" id="dGo" ${plans.length ? '' : 'disabled'}>Dispatch ${plans.length} unit(s)</button></div>`);
    $$('#modal [data-u]').forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.u) : sel.delete(c.dataset.u); render(); });
    $$('#modal [data-g]').forEach(bt => bt.onclick = () => { const g = S.groups.find(x => x.id === bt.dataset.g); const us = g.unitIds.filter(id => ready.some(u => u.id === id)); const all = us.every(id => sel.has(id)); us.forEach(id => all ? sel.delete(id) : sel.add(id)); render(); });
    $$('#modal [data-dir]').forEach(bt => bt.onclick = () => { approach = bt.dataset.dir || null; render(); });
    $('#dGo').onclick = () => { G.dispatch(inc.id, [...sel], approach); closeModal(); S.speed = 1; G.save(); };
  };
  render();
}

export function showHandoff(inc) {
  const S = G.getS(), city = S.cities.find(c => c.id === inc.cityId), T = THREATS[inc.threat];
  const us = inc.units.map(id => S.units.find(u => u.id === id)).filter(Boolean);
  const onscene = us.filter(u => u.status === 'onscene');
  const dirs = [...new Set(onscene.map(u => u.approach))];
  modal(`<h2>Forces on scene — ${esc(city.name)}</h2>
   <div class="mut">${esc(T.name)} · ${esc(inc.district)} · spread ${Math.round(inc.infest)} · city integrity ${Math.round(city.integrity)}%</div>
   <div class="card" style="margin-top:10px"><div class="lbl" style="margin-bottom:6px">Staging areas: ${dirs.join(', ') || '—'}</div>
   ${us.map(u => `<div class="row"><span class="sp">${esc(u.name)}</span><span class="mut" style="font-size:12px">${u.pers} pers</span><span class="${u.status === 'onscene' ? 'good' : 'amb'}" style="width:90px;text-align:right">${u.status === 'onscene' ? 'on scene' : 'ETA ' + dur(u.route.arr - S.t)}</span></div>`).join('')}</div>
   ${packOf(city) ? `<div class="card" style="font-size:12.5px"><b class="acc">City survey on file.</b><div class="mut" style="margin-top:4px">Take command in the 3D city: real buildings, roads and traffic of ${esc(city.name)}. Units already on scene start operating at once; units still en route join as reinforcements when they arrive.</div></div>`
     : `<div class="card" style="border-color:#c9a22755;font-size:12.5px"><b class="amb">No detailed survey for ${esc(city.name)}.</b><div class="mut" style="margin-top:4px">Without a city map pack the operation is resolved from force strength, protective gear and spread.</div></div>`}
   <div class="foot"><button onclick="__close()">Hold position</button>${packOf(city) ? `<button class="pri" id="hTac" ${onscene.length ? '' : 'disabled'}>Take command</button>` : `<button class="pri" id="hRes" ${onscene.length ? '' : 'disabled'}>Resolve automatically</button>`}</div>`);
  const tac = $('#hTac');
  if (tac) tac.onclick = async () => {
    closeModal(); S.speed = 0;
    const forces = us.filter(u => u.status === 'onscene' || u.status === 'transit').map(u => ({ id: u.id, name: u.name, tpl: u.tpl, pers: u.pers, items: u.items, vehicle: u.vehicle, approach: u.approach, carrier: u.vehicle ? null : u.carrier, arriveIn: u.status === 'transit' ? Math.max(0, u.route.arr - S.t) : 0 }));
    const res = await enterTactical({ base: packUrl(packOf(city)), threat: inc.threat, threatName: T.name, threatColor: T.color, cityName: city.name, district: inc.district, clock: S.t, forces, supply: 120, severity: 1 + inc.infest / 30 });
    if (res.aborted) return UI.refresh();
    const r = G.resolveTactical(inc.id, res); G.save(); UI.refresh();
    modal(`<h2>${r.success ? 'Threat eliminated' : 'Containment failed'} — ${esc(city.name)}</h2><div class="stats"><span>Soldiers killed</span><span>${r.kia}</span><span>Units lost</span><span>${r.lost.length ? esc(r.lost.join(', ')) : 'None'}</span><span>Civilian casualties</span><span>${num(r.civDead)}</span><span>Evacuated</span><span>${num(r.evacuated)}</span><span>HVTs evacuated / lost</span><span>${r.hvtSaved} / ${r.hvtLost}</span><span>Government standing</span><span>${Math.round(S.standing)}</span><span>Public trust</span><span>${Math.round(S.trust)}</span></div><div class="foot"><button class="pri" onclick="__close()">Continue</button></div>`);
  };
  if (!$('#hRes')) return;
  $('#hRes').onclick = () => {
    const r = G.abstractResolve(inc.id);
    modal(`<h2>${r.success ? 'Threat neutralised' : 'Containment failed'} — ${esc(city.name)}</h2>
      <div class="stats"><span>Outcome</span><span class="${r.success ? 'good' : 'bad'}">${r.success ? 'SUCCESS' : 'FAILURE — QUARANTINE'}</span><span>Force ratio</span><span>${r.ratio.toFixed(2)}</span><span>Killed in action</span><span>${r.kia}</span><span>Vehicles lost</span><span>${r.lost.length ? esc(r.lost.join(', ')) : 'None'}</span>
      <span>Government standing</span><span>${Math.round(S.standing)}</span><span>Public trust</span><span>${Math.round(S.trust)}</span></div>
      ${r.success ? '<div class="mut" style="margin-top:8px">Specimens recovered and logged under Research.</div>' : ''}
      <div class="foot"><button class="pri" onclick="__close()">Continue</button></div>`);
    G.save();
  };
}

export function escMenu(toMenu) {
  const S = G.getS(); const prev = S.speed; S.speed = 0;
  modal(`<h2>Command <span class="mut mono" style="font-size:11px">v${VERSION}</span></h2><div class="col"><button id="eRes">Resume</button><button id="eSave">Save game</button><button id="eInc" title="Testing aid">Trigger incident now (test)</button><button class="warn" id="eExit">Exit to main menu</button></div><div class="err"></div>`);
  $('#eRes').onclick = () => { closeModal(); S.speed = prev; };
  $('#eSave').onclick = () => { $('#modal .err').textContent = G.save() ? 'Saved.' : 'Saving is unavailable in this browser context.'; $('#modal .err').style.color = 'var(--grn)'; };
  $('#eInc').onclick = () => { closeModal(); if (G.activeIncident()) return UI.flash('An incident is already active.'); window.__dbgIncident(); };
  $('#eExit').onclick = () => { G.save(); closeModal(); toMenu(); };
}
