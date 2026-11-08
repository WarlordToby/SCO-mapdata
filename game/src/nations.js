// Which army fields what: national equipment lineups for the major armies, bloc lineups for everyone else,
// starting forces for a new headquarters, and procurement terms (home kit is cheapest and fastest; allied or
// export kit costs more and takes longer; some kit is embargoed across the blocs).
import { ITEM } from './catalog.js';

export const ORIGIN_CC = { 'France': 'FR', 'Germany': 'DE', 'United Kingdom': 'GB', 'United States': 'US', 'Belgium': 'BE', 'Switzerland': 'CH', 'Austria': 'AT', 'Sweden': 'SE', 'Japan': 'JP', 'Europe': 'EU', 'Russia': 'RU', 'China': 'CN', 'India': 'IN', 'Italy': 'IT', 'Spain': 'ES', 'Turkey': 'TR', 'South Korea': 'KR', 'Brazil': 'BR' };
const ccOf = it => ORIGIN_CC[it.origin] || 'XX';

// political blocs for procurement
const WEST = 'US GB FR DE IT ES NL BE LU PT DK NO IS PL CZ SK HU RO BG GR TR SI HR AL ME MK EE LV LT FI SE CA AU NZ JP KR IE AT CH IL EU'.split(' ');
const EAST = 'RU BY KZ KG TJ AM'.split(' ');
const CHINA = 'CN KP'.split(' ');
export const blocOf = cc => WEST.includes(cc) ? 'west' : EAST.includes(cc) ? 'east' : CHINA.includes(cc) ? 'china' : 'open';

// a lineup: start (stock of a new HQ), garrison (stock of a new garrison), home (counts as domestic: licence-built or long-standing)
const L = (start, garrison, home = []) => ({ start, garrison, home });
const inf = (rifle, smg, mg, at, extra = {}) => ({ [rifle]: 60, [smg]: 40, [mg]: 8, [at]: 4, vest: 60, nrbc: 40, riot: 20, ...extra });
const gar = (rifle, smg, mg, at, extra = {}) => ({ [rifle]: 24, [smg]: 10, [mg]: 3, [at]: 2, vest: 24, nrbc: 16, riot: 10, ...extra });
export const LINEUPS = {
  FR: L({ mas4956: 80, mat49: 40, famas: 60, aa52: 8, m2hb: 2, lracf1: 4, vest: 60, nrbc: 40, riot: 20, p4: 6, trm2000: 6, gbc180: 2, vab: 4, alouette3: 1 }, { mas4956: 20, mat49: 10, famas: 24, aa52: 3, lracf1: 2, vest: 24, nrbc: 16, riot: 10, p4: 2, trm2000: 2, vab: 2, alouette3: 1 }, ['hk416f', 'tigre', 'nh90']),
  US: L(inf('m16a4', 'mp5', 'm240b', 'at4', { m249: 6, m2hb: 2, hmmwv: 6, m35: 4, fmtv: 2, m113: 4, uh1: 1 }), gar('m16a4', 'mp5', 'm240b', 'at4', { hmmwv: 2, m35: 2, m113: 2, uh1: 1 }), ['m4a1', 'm2hb', 'm113', 'garand']),
  GB: L(inf('l85a2', 'mp5', 'l7a2', 'at4', { minimi: 6, m2hb: 2, defender: 6, mansv: 6, fv432: 4, puma: 1 }), gar('l85a2', 'mp5', 'l7a2', 'at4', { defender: 2, mansv: 2, fv432: 2, puma: 1 }), ['defender', 'enfield4', 'puma', 'ah64', 'ch47', 'boxer', 'mansv']),
  DE: L(inf('g36', 'mp5', 'mg3', 'pzf3', { mg4: 6, m2hb: 2, gwagen: 6, mansv: 6, fuchs: 4, h145: 1 }), gar('g36', 'mp5', 'mg3', 'pzf3', { gwagen: 2, mansv: 2, fuchs: 2, h145: 1 }), ['k98k', 'nh90', 'tigre', 'ec135']),
  RU: L(inf('ak74m', 'pp19', 'pkm', 'rpg7', { akm: 40, rpk74: 6, kord: 2, uaz469: 6, ural: 6, kamaz: 2, btr80: 4, mi8: 1 }), gar('ak74m', 'pp19', 'pkm', 'rpg7', { uaz469: 2, ural: 2, btr80: 2, mi8: 1 })),
  CN: L(inf('qbz95', 'qcw05', 'qjy88', 'pf98', { qbb95: 6, qjz89: 2, mengshi: 6, shaanxi: 6, wz551: 4, z9: 1 }), gar('qbz95', 'qcw05', 'qjy88', 'pf98', { mengshi: 2, shaanxi: 2, wz551: 2, z9: 1 })),
  JP: L(inf('howa89', 'mp5', 'minimi', 'cg4', { type64: 20, m2hb: 2, hmv_jp: 6, type73: 6, type96: 4, uh1: 1 }), gar('howa89', 'mp5', 'minimi', 'cg4', { hmv_jp: 2, type73: 2, type96: 2, uh1: 1 }), ['minimi', 'cg4', 'm2hb', 'uh60', 'ch47', 'ah64', 'uh1']),
  IN: L(inf('insas', 'mp5', 'mag', 'cg4', { enfield4: 30, svd: 4, gypsy: 6, tata_lpta: 6, bmp2: 4, dhruv: 1 }), gar('insas', 'mp5', 'mag', 'cg4', { gypsy: 2, tata_lpta: 2, bmp2: 2, dhruv: 1 }), ['ak203', 'bmp2', 't72', 't90', 'mi8', 'cg4', 'mag', 'svd']),
  IT: L(inf('ar7090', 'mp5', 'mg4259', 'pzf3', { minimi: 6, m2hb: 2, lince: 4, actl: 6, m113: 4, aw139: 1 }), gar('ar7090', 'mp5', 'mg4259', 'pzf3', { lince: 2, actl: 2, m113: 2, aw139: 1 }), ['m113', 'nh90', 'minimi']),
  ES: L(inf('g36', 'mp5', 'mg4259', 'c90', { cetme: 30, minimi: 6, vamtac: 6, actl: 4, bmr600: 4, ec135: 1 }), gar('g36', 'mp5', 'mg4259', 'c90', { vamtac: 2, actl: 2, bmr600: 2, ec135: 1 }), ['g36', 'leo2a6', 'm113', 'nh90', 'tigre', 'cougar', 'ec135']),
  TR: L(inf('mpt76', 'mp5', 'mg3', 'at4', { g3: 40, m2hb: 2, cobra: 6, bmc: 6, acv15: 4, uh1: 1 }), gar('mpt76', 'mp5', 'mg3', 'at4', { cobra: 2, bmc: 2, acv15: 2, uh1: 1 }), ['g3', 'mg3', 'leo2a4', 'leo1', 'm60a3', 'uh60', 'cougar', 'm113']),
  KR: L(inf('k2rifle', 'k1a', 'k3', 'pzf3', { k6: 2, k151: 6, km250: 6, k200: 4, uh1: 1 }), gar('k2rifle', 'k1a', 'k3', 'pzf3', { k151: 2, km250: 2, k200: 2, uh1: 1 }), ['uh60', 'ah64', 'pzf3']),
  BR: L(inf('ia2', 'mp5', 'mag', 'at4', { fal: 40, minimi: 4, marrua: 6, m35: 6, urutu: 4, h125: 1 }), gar('ia2', 'mp5', 'mag', 'at4', { marrua: 2, m35: 2, urutu: 2, h125: 1 }), ['fal', 'm113', 'leo1', 'h125', 'h225m', 'cascavel', 'urutu']),
  // ---- blocs ----
  sov: L(inf('akm', 'pp19', 'pkm', 'rpg7', { rpk74: 6, svd: 4, uaz469: 6, gaz66: 4, ural: 2, btr80: 2, bmp1: 2, mi8: 1 }), gar('akm', 'pp19', 'pkm', 'rpg7', { uaz469: 2, gaz66: 2, btr80: 2, mi8: 1 }), ['akm', 'ak74m', 'pkm', 'rpk74', 'svd', 'rpg7', 'uaz469', 'gaz66', 'ural', 'btr80', 'bmp1', 'bmp2', 't55', 't72', 'mtlb', 'brdm2', 'mi8', 'mi24']),
  west: L(inf('m16a4', 'mp5', 'mag', 'at4', { fal: 30, m2hb: 2, lc70: 6, m35: 6, m113: 4, uh1: 1 }), gar('m16a4', 'mp5', 'mag', 'at4', { lc70: 2, m35: 2, m113: 2, uh1: 1 }), ['lc70', 'defender', 'm35', 'm113', 'uh1', 'fal', 'g3', 'mag', 'm60a3', 'leo1', 'aml90']),
  afr: L(inf('akm', 'mat49', 'pkm', 'rpg7', { fal: 20, lc70: 6, m35: 2, gaz66: 2, wz551: 2, aml90: 2, alouette3: 1 }), gar('akm', 'mat49', 'pkm', 'rpg7', { lc70: 2, gaz66: 2, aml90: 2, alouette3: 1 }), ['akm', 'pkm', 'rpg7', 'lc70', 'aml90', 'alouette3', 'p4', 'vlra', 'wz551', 'type56']),
  gulf: L(inf('m4a1', 'mp5', 'mag', 'at4', { m2hb: 2, hmmwv: 6, fmtv: 6, m113: 4, uh60: 1 }), gar('m4a1', 'mp5', 'mag', 'at4', { hmmwv: 2, fmtv: 2, m113: 2, uh60: 1 }), ['hmmwv', 'fmtv', 'm113', 'm4a1']),
  latam: L(inf('fal', 'mp5', 'mag', 'at4', { m16a4: 30, lc70: 6, m35: 6, m113: 2, urutu: 2, uh1: 1 }), gar('fal', 'mp5', 'mag', 'at4', { lc70: 2, m35: 2, urutu: 2, uh1: 1 }), ['fal', 'lc70', 'm35', 'm113', 'uh1', 'urutu', 'cascavel']),
  asia: L(inf('m16a4', 'mp5', 'mag', 'at4', { type56: 30, lc70: 6, m35: 6, m113: 4, uh1: 1 }), gar('m16a4', 'mp5', 'mag', 'at4', { lc70: 2, m35: 2, m113: 2, uh1: 1 }), ['lc70', 'm35', 'm113', 'uh1', 'type56']),
  chn: L(inf('type56', 'mp5', 'qjy88', 'rpg7', { lc70: 6, shaanxi: 6, wz551: 4, z9: 1 }), gar('type56', 'mp5', 'qjy88', 'rpg7', { lc70: 2, shaanxi: 2, wz551: 2, z9: 1 }), ['type56', 'wz551', 'shaanxi', 'z9', 'ztz96', 'mengshi']),
};
// which lineup a country without its own fields
const BLOC_OF = {
  sov: 'BY UA KZ UZ TM KG TJ AZ AM GE MD MN AF IQ SY DZ LY ET ER AO MZ CU VN LA KH YE'.split(' '),
  west: 'NL BE LU PT DK NO IS PL CZ SK HU RO BG GR SI HR AL ME MK RS BA EE LV LT FI SE CA AU NZ IE AT CH IL ZA MA TN PH TW'.split(' '),
  afr: 'SN ML NE TD BF CI GN CM CF CG GA BJ TG MR MG DJ CD RW BI'.split(' '),
  gulf: 'SA AE KW QA BH OM JO EG LB'.split(' '),
  latam: 'MX AR CL CO PE VE EC BO PY UY GT HN SV NI CR PA DO HT JM'.split(' '),
  asia: 'TH MY ID SG BD LK NP MM'.split(' '),
  chn: 'PK KP NG GH KE TZ UG ZM ZW SD SS NA BW IR'.split(' '),
};
export function lineupKey(cc) { if (LINEUPS[cc]) return cc; for (const [k, l] of Object.entries(BLOC_OF)) if (l.includes(cc)) return k; return 'west'; }
export const lineupOf = cc => LINEUPS[lineupKey(cc)];

// procurement terms for a nation: { tag, cost, lead, standing, ok, note }
export function procureTerms(cc, it) {
  const o = ccOf(it), L = lineupOf(cc), home = o === cc || L.home.includes(it.id) || (o === 'EU' && blocOf(cc) === 'west' && ['FR', 'DE', 'IT', 'ES', 'GB'].includes(cc)) || L.start[it.id] !== undefined;
  if (home) return { tag: 'home', cost: it.cost, lead: it.lead, standing: it.standing, ok: true, note: 'Domestic' };
  const a = blocOf(cc), b = blocOf(o === 'EU' ? 'FR' : o);
  if (a !== 'open' && b !== 'open' && a !== b) return { tag: 'embargo', cost: it.cost, lead: it.lead, standing: it.standing, ok: false, note: 'Embargoed' };
  if (a === b && a !== 'open') return { tag: 'allied', cost: Math.round(it.cost * 1.3), lead: Math.ceil(it.lead * 1.5), standing: Math.min(90, it.standing + 10), ok: true, note: 'Allied supplier' };
  return { tag: 'export', cost: Math.round(it.cost * 1.7), lead: Math.ceil(it.lead * 2), standing: Math.min(95, it.standing + 20), ok: true, note: 'Export market' };
}

// the starter units of a new base, drawn from its lineup: rifle squad, response team, two carriers, a truck, a helicopter
export function starterKit(cc, garrison = false) {
  const L = lineupOf(cc), st = garrison ? L.garrison : L.start, ids = Object.keys(st).filter(id => ITEM[id]);
  const best = f => ids.filter(id => f(ITEM[id])).sort((a, b) => st[b] - st[a])[0];
  const rifle = best(i => i.sub === 'rifle') || best(i => i.sub === 'surplus'), mg = best(i => i.sub === 'gpmg' || i.sub === 'lmg'), marks = best(i => i.sub === 'dmr' || i.sub === 'surplus') || rifle, smg = best(i => i.sub === 'smg') || rifle;
  const apc = best(i => i.cat === 'apc') || best(i => i.cat === 'light'), truck = best(i => i.cat === 'truck'), heli = best(i => i.cat === 'heli');
  const sq = { [rifle]: 6 }; sq[mg] = (sq[mg] || 0) + 1; sq[marks] = (sq[marks] || 0) + 1;
  return { squad: sq, response: { [smg]: 6 }, apc, truck, heli };
}
