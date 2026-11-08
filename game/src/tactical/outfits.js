// Who wears what: civilian clothing by region and climate, police uniforms and army camouflage by country,
// and the looks of the humanoid threats. Every figure's look is derived from a seed, so it stays the same.
import { CAMO, pack } from './people.js';

// ---- figure types (geometry specs for humanGeometry) ----
export const FIGURES = {
  m_shirt: { sex: 'm', top: 'shirt', sleeves: 'short', lower: 'trousers', hair: 'short' },
  m_jacket: { sex: 'm', top: 'jacket', lower: 'trousers', hair: 'short' },
  m_coat: { sex: 'm', top: 'coat', lower: 'trousers', hair: 'short' },
  m_shorts: { sex: 'm', top: 'shirt', sleeves: 'short', lower: 'shorts', hair: 'short' },
  m_robe: { sex: 'm', top: 'robe', lower: 'robe', hair: 'ghutra' },
  m_tunic: { sex: 'm', top: 'tunic', lower: 'trousers', hair: 'short' },
  f_trousers: { sex: 'f', top: 'shirt', lower: 'trousers', hair: 'long' },
  f_skirt: { sex: 'f', top: 'shirt', sleeves: 'short', lower: 'skirt', hair: 'bun' },
  f_coat: { sex: 'f', top: 'coat', lower: 'trousers', hair: 'long' },
  f_abaya: { sex: 'f', top: 'abaya', lower: 'robe', hair: 'scarf' },
  f_sari: { sex: 'f', top: 'shirt', sleeves: 'short', lower: 'longskirt', drape: true, hair: 'bun' },
  f_tunic: { sex: 'f', top: 'tunic', lower: 'trousers', hair: 'scarf' },
  f_wrap: { sex: 'f', top: 'shirt', sleeves: 'short', lower: 'longskirt', hair: 'scarf' },
  police: { sex: 'm', top: 'shirt', lower: 'trousers', hair: 'none', hat: 'cap', hatSlot: 4, vest: 'police', holster: true, gun: true, boots: true },
  police_f: { sex: 'f', top: 'shirt', lower: 'trousers', hair: 'none', hat: 'cap', hatSlot: 4, vest: 'police', holster: true, gun: true, boots: true },
  soldier: { sex: 'm', top: 'shirt', lower: 'trousers', hair: 'none', hat: 'helmet', vest: 'plate', pack: true, rifle: true, boots: true, kneepads: true, bulk: 1.04 },
  vamp_m: { sex: 'm', top: 'coat', lower: 'trousers', hair: 'short', bulk: 0.92 },
  vamp_f: { sex: 'f', top: 'coat', lower: 'trousers', hair: 'long', bulk: 0.9 },
};

// ---- seeded randomness ----
export function rng(seed) { let s = (Math.floor(Math.abs(seed) * 2654435761) ^ 0x9e3779b9) >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), s ^= s >>> 16) >>> 0) / 4294967296; }
const pick = (R, a) => a[Math.floor(R() * a.length)];
const wpick = (R, w) => { let t = R() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((t -= w[i]) < 0) return i; return w.length - 1; };
const jitter = (R, hex, a = 0.08) => { const f = 1 + (R() - 0.5) * a * 2; const r = Math.min(255, (hex >> 16 & 255) * f), g = Math.min(255, (hex >> 8 & 255) * f), b = Math.min(255, (hex & 255) * f); return (r << 16) | (g << 8) | b; };
const mix = (a, b, t) => { const r = (a >> 16 & 255) * (1 - t) + (b >> 16 & 255) * t, g = (a >> 8 & 255) * (1 - t) + (b >> 8 & 255) * t, c = (a & 255) * (1 - t) + (b & 255) * t; return (r << 16) | (g << 8) | c; };

// ---- people ----
const SKIN = [0xf1d3c0, 0xe6bfa0, 0xd5a07d, 0xb97f5a, 0x9a6443, 0x7a4a2e, 0x5a3420, 0x3f2416];
const SKIN_W = {
  'eu-west': [24, 34, 18, 9, 6, 5, 3, 1], 'eu-north': [36, 34, 12, 6, 5, 4, 2, 1], 'eu-east': [32, 40, 18, 6, 3, 1, 0, 0], 'post-soviet': [30, 38, 20, 8, 3, 1, 0, 0],
  mediterranean: [8, 30, 32, 18, 7, 3, 2, 0], mena: [2, 12, 30, 32, 16, 6, 2, 0], subsaharan: [0, 1, 2, 4, 12, 30, 33, 18], 'south-asia': [0, 2, 10, 25, 33, 20, 8, 2],
  'east-asia': [15, 45, 30, 8, 2, 0, 0, 0], japan: [18, 48, 28, 6, 0, 0, 0, 0], 'southeast-asia': [2, 15, 35, 30, 15, 3, 0, 0], latam: [5, 15, 25, 25, 15, 8, 5, 2],
  'north-america': [18, 25, 15, 12, 10, 10, 7, 3], oceania: [25, 30, 15, 10, 8, 6, 4, 2],
};
const HAIR = [0x1b1612, 0x3a2a1e, 0x5c4330, 0xb8955c, 0xd6bc84, 0x8a4a28, 0x9a9590, 0xd8d4cc];
const HAIR_W = { 'eu-north': [10, 22, 22, 20, 14, 4, 5, 3], 'eu-west': [18, 30, 22, 12, 5, 4, 6, 3], 'eu-east': [15, 30, 25, 14, 6, 3, 5, 2], 'post-soviet': [15, 30, 25, 14, 6, 3, 5, 2], 'north-america': [25, 28, 18, 12, 4, 3, 7, 3], oceania: [22, 28, 18, 13, 6, 4, 6, 3], _: [70, 14, 4, 1, 0, 0, 8, 3] };
const MUTED = [0x24324a, 0x1d1d20, 0x3a3c40, 0x7a7d82, 0xe4e2dc, 0xb9a886, 0x8c7d5a, 0x5b5e3c, 0x3f5873, 0x6b88a8, 0x5a4030, 0x6a2632, 0x2f4a35, 0xa3302c, 0xc49a2c, 0x8fb3d1, 0xd7a0a8, 0x2f6f73, 0xc86a2c];
const DENIM = [0x2a3a52, 0x3f5873, 0x6b88a8, 0x1d1d20, 0x3a3c40, 0x8c7d5a, 0x24324a, 0x5a4030];
const BRIGHT = [0xd4382a, 0xe8a325, 0x1e7a4f, 0x2a5cb8, 0x8a2a8a, 0xf0d24a, 0xe05a9a, 0x20a0a0, 0xe4e2dc, 0x24324a, 0xc86a2c, 0x6a2632];
const ROBE = [0xecebe6, 0xecebe6, 0xecebe6, 0xddd3bd, 0xc9c6bd, 0xb8c4cc, 0x8c7d5a];
const SCARF = [0x141416, 0x24324a, 0x6a2632, 0x5a4030, 0xb9a886, 0x7a7d82, 0x2f4a35, 0xd7a0a8, 0x8fb3d1, 0xe4e2dc];
const BRIGHT_REG = new Set(['subsaharan', 'latam', 'south-asia', 'southeast-asia']);
const HOT_REG = new Set(['mena', 'subsaharan', 'south-asia', 'southeast-asia', 'latam', 'oceania']);
const HIJAB_CC = new Set(['ID', 'MY', 'BD', 'PK', 'AF', 'IR', 'TR', 'EG', 'DZ', 'MA', 'TN', 'IQ', 'SY', 'JO', 'SD', 'NE', 'ML', 'SN', 'SO', 'NG', 'AZ', 'UZ', 'KZ', 'TJ', 'KG', 'TM', 'LY', 'MR', 'TD', 'BN']);
const GULF_CC = new Set(['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE']);

// which civilian figures a place has: weights over figure keys
function civMix(region, cc, cold, hot) {
  const W = {};
  const add = (k, w) => { W[k] = (W[k] || 0) + w; };
  if (cold) { add('m_coat', 30); add('f_coat', 28); add('m_jacket', 18); add('f_trousers', 12); }
  else if (hot) { add('m_shirt', 30); add('m_shorts', 8); add('f_trousers', 18); add('f_skirt', 16); add('m_jacket', 4); }
  else { add('m_jacket', 26); add('m_shirt', 18); add('f_trousers', 26); add('f_skirt', 12); add('f_coat', 6); add('m_coat', 4); }
  if (region === 'mena' || GULF_CC.has(cc)) { const g = GULF_CC.has(cc); add('m_robe', g ? 70 : 28); add('f_abaya', g ? 70 : 30); add('f_tunic', 20); }
  if (region === 'south-asia') { add('m_tunic', 45); add('f_sari', cc === 'PK' || cc === 'AF' ? 10 : 45); add('f_tunic', cc === 'PK' || cc === 'AF' ? 55 : 30); }
  if (region === 'subsaharan') { add('f_wrap', 28); if (HIJAB_CC.has(cc)) { add('m_robe', 20); add('f_tunic', 15); } }
  if (region === 'southeast-asia' && HIJAB_CC.has(cc)) add('f_tunic', 40);
  if (HIJAB_CC.has(cc) && region !== 'south-asia' && region !== 'mena') add('f_tunic', 15);
  return W;
}

export class Wardrobe {
  // region: compiler region key; cc: country code; month: 0–11; lat: latitude (for winter); arid: desert climate
  constructor({ region = 'eu-west', cc = '', month = 6, lat = 45, arid = false, playerCc = cc, nationCc = cc } = {}) {
    const winter = lat >= 0 ? (month >= 10 || month <= 2) : (month >= 4 && month <= 8);
    const cold = winter && Math.abs(lat) > 38 && !arid && !HOT_REG.has(region);
    const hot = HOT_REG.has(region) || arid || (!winter && Math.abs(lat) < 40);
    Object.assign(this, { region, cc, cold, hot, playerCc, nationCc });
    const W = civMix(region, cc, cold, hot); this.civKeys = Object.keys(W); this.civW = this.civKeys.map(k => W[k]);
    this.skinW = SKIN_W[region] || SKIN_W['eu-west']; this.hairW = HAIR_W[region] || HAIR_W._;
    this.bright = BRIGHT_REG.has(region);
  }
  civ(seed) {
    const R = rng(seed), key = this.civKeys[wpick(R, this.civW)], F = FIGURES[key], pal = this.bright && R() < 0.6 ? BRIGHT : MUTED;
    const skin = jitter(R, SKIN[wpick(R, this.skinW)], 0.05);
    let hair = HAIR[wpick(R, this.hairW)]; if (F.sex === 'm' && R() < 0.12) hair = skin; // shaved or bald
    let top = jitter(R, pick(R, pal)), bot = jitter(R, pick(R, F.lower === 'trousers' ? DENIM : pal)), acc = pick(R, SCARF);
    if (key === 'm_robe') { top = jitter(R, pick(R, ROBE), 0.03); bot = top; acc = R() < 0.55 ? 0xeeeeea : 0xc0302c; hair = 0x111111; } // ghutra (white or red shemagh) and agal
    if (key === 'f_abaya') { top = jitter(R, GULF_CC.has(this.cc) || R() < 0.7 ? 0x141416 : pick(R, SCARF), 0.04); bot = top; acc = GULF_CC.has(this.cc) ? 0x141416 : pick(R, SCARF); }
    if (key === 'm_tunic' && R() < 0.6) { top = jitter(R, pick(R, ROBE), 0.04); bot = R() < 0.6 ? top : bot; }
    if (key === 'f_sari') { bot = jitter(R, pick(R, BRIGHT)); top = jitter(R, pick(R, BRIGHT)); acc = bot; }
    if (key === 'f_tunic') { top = jitter(R, pick(R, pal)); bot = jitter(R, pick(R, pal)); acc = pick(R, SCARF); }
    if (key === 'f_wrap') { top = jitter(R, pick(R, BRIGHT)); bot = jitter(R, pick(R, BRIGHT)); acc = jitter(R, pick(R, BRIGHT)); }
    return { key, scale: (F.sex === 'f' ? 0.94 : 1) * (0.94 + R() * 0.12), look: { c: [pack(skin), pack(top), pack(bot), pack(hair)], d: [pack(acc), 0, 0, 0] } };
  }
  police(seed) {
    const R = rng(seed), U = POLICE[this.cc] || POLICE_REGION[this.region] || POLICE._, skin = jitter(R, SKIN[wpick(R, this.skinW)], 0.05);
    const key = R() < 0.22 ? 'police_f' : 'police';
    return { key, scale: (key === 'police_f' ? 0.95 : 1) * (0.96 + R() * 0.08), look: { c: [pack(skin), pack(jitter(R, U.top, 0.03)), pack(U.bot), pack(U.cap)], d: [pack(U.vest), 0, 0, 0] } };
  }
  soldier(seed, cc = this.playerCc) {
    const R = rng(seed), A = ARMY[cc] || ARMY_REGION[this.region] || ARMY._, skin = jitter(R, SKIN[wpick(R, SKIN_W[REGION_OF_CC[cc]] || this.skinW)], 0.05);
    return { key: 'soldier', scale: 0.97 + R() * 0.07, look: { c: [pack(skin), pack(A.c[0]), pack(A.c[1]), pack(0x111111)], d: [pack(A.c[2]), CAMO[A.pat], pack(A.c[3]), 0] } };
  }
  undead(seed) {
    const R = rng(seed), b = R() < 0.07 ? this.soldier(seed + 0.5, this.nationCc) : this.civ(seed), c = b.look.c.slice(), d = b.look.d.slice();
    const unp = v => ((v / 65536 | 0) << 16) | (((v / 256 | 0) & 255) << 8) | (v & 255);
    c[0] = pack(mix(unp(c[0]), 0x8a9078, 0.55)); c[1] = pack(mix(unp(c[1]), 0x4a4038, 0.35)); c[2] = pack(mix(unp(c[2]), 0x3a3430, 0.3));
    d[3] = 0.6 + R() * 0.4;
    return { key: b.key, scale: b.scale, look: { c, d } };
  }
  vampire(seed) {
    const R = rng(seed), key = R() < 0.5 ? 'vamp_m' : 'vamp_f', dark = [0x141416, 0x1d1d20, 0x2a1418, 0x3a3c40, 0x4a1520, 0x24324a];
    return { key, scale: 1.02 + R() * 0.06, look: { c: [pack(jitter(R, 0xe6e0da, 0.03)), pack(pick(R, dark)), pack(pick(R, dark)), pack(R() < 0.7 ? 0x141210 : 0xd8d4cc)], d: [pack(0x6a1018), 0, 0, 0.12] } };
  }
  lycan(seed) {
    const R = rng(seed), fur = jitter(R, pick(R, [0x6b6560, 0x5a4634, 0x2a2622, 0x8a6a44, 0x4a4440]), 0.1), rag = jitter(R, mix(pick(R, MUTED), 0x302820, 0.4));
    return { key: 'lycan', scale: 1.14 + R() * 0.14, look: { c: [pack(fur), pack(rag), pack(jitter(R, pick(R, DENIM))), pack(fur)], d: [pack(fur), 0, 0, 0.25] } };
  }
}

// ---- police uniforms (current everyday patrol dress) ----
const navy = 0x1f2a44, black = 0x18191c, hiv = 0xd8e021;
const POLICE = {
  FR: { top: 0x26324e, bot: 0x1c2438, cap: 0x1c2438, vest: 0x15161a }, // Police nationale: navy, black tactical vest
  DE: { top: 0x23406f, bot: 0x1f2a44, cap: 0x23406f, vest: 0x1f2a44 }, // Polizei blue
  AT: { top: 0x1f3456, bot: 0x1c2438, cap: 0x1f3456, vest: 0x1c2438 },
  CH: { top: 0x1e2430, bot: 0x1e2430, cap: 0x1e2430, vest: hiv },
  GB: { top: black, bot: black, cap: black, vest: hiv }, IE: { top: 0x1f2a44, bot: black, cap: 0x1f2a44, vest: hiv },
  NL: { top: 0x1c2a4a, bot: 0x1c2a4a, cap: 0x1c2a4a, vest: 0x1c2a4a }, BE: { top: 0x1f2a44, bot: 0x1f2a44, cap: 0x1f2a44, vest: hiv },
  ES: { top: 0x1c2438, bot: 0x1c2438, cap: 0x1c2438, vest: 0x1c2438 }, PT: { top: 0x1f2a44, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x1f2a44 },
  IT: { top: 0x26324e, bot: 0x2c3a5c, cap: 0x26324e, vest: 0x26324e }, GR: { top: 0x2c3a5c, bot: 0x1f2a44, cap: 0x2c3a5c, vest: 0x1f2a44 },
  SE: { top: 0x1f2a44, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x1f2a44 }, NO: { top: black, bot: black, cap: black, vest: hiv }, DK: { top: 0x1c2438, bot: black, cap: black, vest: hiv }, FI: { top: 0x1f2a44, bot: 0x1f2a44, cap: 0x1f2a44, vest: hiv }, IS: { top: black, bot: black, cap: black, vest: hiv },
  PL: { top: 0x1f2a44, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x1f2a44 }, CZ: { top: 0x3a4e70, bot: 0x2a3550, cap: 0x2a3550, vest: hiv }, HU: { top: 0x2a3a58, bot: 0x2a3a58, cap: 0x2a3a58, vest: hiv }, RO: { top: 0x2a3a5c, bot: 0x2a3a5c, cap: 0x2a3a5c, vest: 0x2a3a5c }, UA: { top: black, bot: black, cap: black, vest: black },
  RU: { top: 0x404a52, bot: 0x2e353b, cap: 0x2e353b, vest: 0x404a52 }, BY: { top: 0x3a4652, bot: 0x2e353b, cap: 0x2e353b, vest: 0x3a4652 }, TR: { top: 0x1f2a44, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x1f2a44 },
  US: { top: 0x1c2438, bot: 0x1c2438, cap: 0x1c2438, vest: black }, CA: { top: 0x1c2438, bot: 0x1c2438, cap: 0x1c2438, vest: black }, MX: { top: 0x1c2438, bot: 0x1c2438, cap: 0x1c2438, vest: black },
  BR: { top: 0x5a5e5a, bot: 0x4a4e4a, cap: 0x4a4e4a, vest: black }, AR: { top: 0x26324e, bot: 0x1f2a44, cap: 0x1f2a44, vest: hiv }, CO: { top: 0x3c5a3a, bot: 0x3c5a3a, cap: 0x3c5a3a, vest: hiv }, CL: { top: 0x3c5a3a, bot: 0x3c5a3a, cap: 0x3c5a3a, vest: 0x3c5a3a }, PE: { top: 0x4a5a3a, bot: 0x4a5a3a, cap: 0x4a5a3a, vest: hiv },
  CN: { top: 0x1c2438, bot: 0x1c2438, cap: 0x1c2438, vest: hiv }, JP: { top: 0x26324e, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x26324e }, KR: { top: 0x26324e, bot: 0x1f2a44, cap: 0x1f2a44, vest: hiv }, TW: { top: 0x26324e, bot: 0x1f2a44, cap: 0x1f2a44, vest: hiv },
  IN: { top: 0xb8a070, bot: 0xb8a070, cap: 0xb8a070, vest: 0xb8a070 }, PK: { top: 0x2a2a2a, bot: 0x3c4a3a, cap: 0x2a2a2a, vest: 0x2a2a2a }, BD: { top: 0x3a5a8a, bot: 0x2a3a5c, cap: 0x2a3a5c, vest: 0x3a5a8a },
  ID: { top: 0x6b5a3e, bot: 0x5a4a32, cap: 0x5a4a32, vest: 0x6b5a3e }, PH: { top: 0x1f2a44, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x1f2a44 }, TH: { top: 0x5a4632, bot: 0x5a4632, cap: 0x5a4632, vest: 0x5a4632 }, VN: { top: 0xb0a060, bot: 0x4a5a3a, cap: 0x4a5a3a, vest: 0xb0a060 },
  EG: { top: black, bot: black, cap: black, vest: black }, NG: { top: black, bot: black, cap: black, vest: black }, ZA: { top: 0x2a3a5c, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x2a3a5c }, KE: { top: 0x3a5a8a, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x3a5a8a },
  SA: { top: 0x6a6a52, bot: 0x6a6a52, cap: 0x6a6a52, vest: 0x6a6a52 }, AE: { top: 0x5a5a4a, bot: 0x5a5a4a, cap: 0x5a5a4a, vest: 0x5a5a4a }, IR: { top: 0x4a5a48, bot: 0x4a5a48, cap: 0x4a5a48, vest: 0x4a5a48 }, IQ: { top: 0x3a4e70, bot: 0x2a3550, cap: 0x2a3550, vest: 0x3a4e70 },
  AU: { top: 0x1f2a44, bot: 0x1f2a44, cap: 0x1f2a44, vest: 0x1f2a44 }, NZ: { top: black, bot: black, cap: black, vest: hiv },
};
const POLICE_REGION = { 'eu-west': POLICE.DE, 'eu-north': POLICE.FI, 'eu-east': POLICE.PL, 'post-soviet': POLICE.RU, mediterranean: POLICE.IT, mena: POLICE.EG, subsaharan: POLICE.ZA, 'south-asia': POLICE.IN, 'east-asia': POLICE.CN, japan: POLICE.JP, 'southeast-asia': POLICE.PH, latam: POLICE.MX, 'north-america': POLICE.US, oceania: POLICE.AU };
POLICE._ = { top: navy, bot: navy, cap: navy, vest: navy };

// ---- army camouflage: base, second, third, fourth colour ----
const MC = { pat: 'multicam', c: [0x9a8a68, 0x6e6a4a, 0x5a4a36, 0x3a3428] };
const ARMY = {
  FR: { pat: 'multicam', c: [0x968b6a, 0x6f6c4c, 0x5b4c38, 0x3c3a2c] }, // Bariolage multi-environnement (BME)
  DE: { pat: 'flecktarn', c: [0x8a8e6a, 0x3f4a2e, 0x5b4a35, 0x232420] }, AT: { pat: 'none', c: [0x5a5e48, 0x5a5e48, 0x4a4e3a, 0x4a4e3a] },
  CH: { pat: 'woodland', c: [0x7a7a52, 0x3d4a2c, 0x5e4a32, 0x22221e] },
  GB: { pat: 'multicam', c: [0x8f8668, 0x5e6244, 0x5a4a36, 0x2e2c24] }, US: MC, AU: { pat: 'multicam', c: [0x9a8a64, 0x5a6040, 0x6a5038, 0x3a3428] }, NZ: MC, CA: { pat: 'digital', c: [0x6a6c48, 0x4a5234, 0x3a3428, 0x23231f] },
  NL: { pat: 'multicam', c: [0x7e7c5a, 0x5c6044, 0x4e4434, 0x2e2c24] }, BE: MC, IE: { pat: 'dpm', c: [0x7a7a54, 0x4a5232, 0x5a4632, 0x22221e] },
  ES: { pat: 'digital', c: [0x7e7c56, 0x4e5634, 0x5e4a34, 0x2a2822] }, PT: { pat: 'woodland', c: [0x7a7a52, 0x46502e, 0x5e4a32, 0x22221e] }, IT: { pat: 'vegetato', c: [0x7e7a56, 0x4a5232, 0x5c4630, 0x22221e] }, GR: { pat: 'digital', c: [0x7e7a56, 0x4a5232, 0x5c4630, 0x22221e] },
  SE: { pat: 'splinter', c: [0x6e7a52, 0x3e4e32, 0x2a3424, 0x1e2018] }, NO: { pat: 'multicam', c: [0x7e7c5a, 0x4e5a3a, 0x4a3e30, 0x2a2a22] }, DK: { pat: 'splinter', c: [0x6e7652, 0x3a4a2e, 0x5a5a40, 0x1e2018] }, FI: { pat: 'digital', c: [0x6e7656, 0x4a5638, 0x3e3a2c, 0x23231f] }, IS: MC,
  PL: { pat: 'woodland', c: [0x6e7652, 0x3e4a2e, 0x4e3e2c, 0x1e1e1a] }, CZ: { pat: 'woodland', c: [0x7a7a54, 0x404c30, 0x5e4a32, 0x22221e] }, SK: { pat: 'digital', c: [0x7a7a54, 0x404c30, 0x5e4a32, 0x22221e] },
  HU: { pat: 'woodland', c: [0x787852, 0x3e4a2e, 0x5a4630, 0x22221e] }, RO: { pat: 'digital', c: [0x7a7a54, 0x404c30, 0x5e4a32, 0x22221e] }, BG: { pat: 'woodland', c: [0x787852, 0x3e4a2e, 0x5a4630, 0x22221e] },
  UA: { pat: 'digital', c: [0x7c7a5a, 0x4c5638, 0x5e4e38, 0x2c2a24] }, RU: { pat: 'digital', c: [0x7e7c5c, 0x4e5a3a, 0x3e3628, 0x23231f] }, BY: { pat: 'digital', c: [0x7e7c5c, 0x4e5a3a, 0x3e3628, 0x23231f] },
  TR: { pat: 'digital', c: [0x7a7a56, 0x4a5234, 0x5c4a34, 0x2a2822] }, IL: { pat: 'none', c: [0x5a5a3e, 0x55553a, 0x4a4a32, 0x4a4a32] },
  CN: { pat: 'digital', c: [0x6c7254, 0x47533a, 0x5a4c38, 0x2a2a24] }, TW: { pat: 'digital', c: [0x6c7254, 0x47533a, 0x5a4c38, 0x2a2a24] }, JP: { pat: 'woodland', c: [0x6e7652, 0x3e4e30, 0x5a4a34, 0x2a2a22] }, KR: { pat: 'digital', c: [0x6e6e50, 0x464e36, 0x5a4a38, 0x23231f] },
  IN: { pat: 'digital', c: [0x7a7656, 0x52583c, 0x5e4c36, 0x2e2c26] }, PK: { pat: 'woodland', c: [0x6e6e4a, 0x3e462c, 0x5a4630, 0x22221e] }, BD: { pat: 'digital', c: [0x6e7250, 0x46523a, 0x5a4a36, 0x2a2a24] },
  BR: { pat: 'digital', c: [0x6c7250, 0x445036, 0x5a4a36, 0x23231f] }, MX: { pat: 'digital', c: [0x6c7250, 0x445036, 0x5a4a36, 0x23231f] }, AR: { pat: 'woodland', c: [0x787852, 0x3e4a2e, 0x5a4630, 0x22221e] },
  CO: { pat: 'digital', c: [0x6c7250, 0x445036, 0x5a4a36, 0x23231f] }, CL: { pat: 'woodland', c: [0x787852, 0x3e4a2e, 0x5a4630, 0x22221e] }, PE: { pat: 'woodland', c: [0x787852, 0x3e4a2e, 0x5a4630, 0x22221e] },
  SA: { pat: 'digital', c: [0xb8a47c, 0x948060, 0x6e5c44, 0x4e4234] }, AE: { pat: 'digital', c: [0xb8a47c, 0x948060, 0x6e5c44, 0x4e4234] }, EG: { pat: 'desert', c: [0xc0ac84, 0x8e7a5c, 0x6a5a44, 0x4e4234] },
  IQ: { pat: 'desert', c: [0xb8a47c, 0x8e7a5c, 0x6a5a44, 0x4e4234] }, IR: { pat: 'desert', c: [0xb0a07c, 0x7e7258, 0x5e5240, 0x3a3428] },
  NG: { pat: 'woodland', c: [0x6e7250, 0x3e4a2e, 0x5a4630, 0x22221e] }, ZA: { pat: 'none', c: [0x7a6a4c, 0x726246, 0x5e5038, 0x5e5038] }, KE: { pat: 'digital', c: [0x7a7656, 0x52583c, 0x5e4c36, 0x2e2c26] },
  ID: { pat: 'woodland', c: [0x6e7250, 0x3e4a2e, 0x5a4630, 0x22221e] }, PH: { pat: 'digital', c: [0x6e7250, 0x46523a, 0x5a4a36, 0x2a2a24] }, TH: { pat: 'digital', c: [0x6e7250, 0x46523a, 0x5a4a36, 0x2a2a24] }, VN: { pat: 'woodland', c: [0x6e7250, 0x3e4a2e, 0x5a4630, 0x22221e] },
};
const ARMY_REGION = { 'eu-west': ARMY.FR, 'eu-north': ARMY.SE, 'eu-east': ARMY.PL, 'post-soviet': ARMY.RU, mediterranean: ARMY.IT, mena: ARMY.EG, subsaharan: ARMY.NG, 'south-asia': ARMY.IN, 'east-asia': ARMY.CN, japan: ARMY.JP, 'southeast-asia': ARMY.ID, latam: ARMY.BR, 'north-america': ARMY.US, oceania: ARMY.AU };
ARMY._ = { pat: 'woodland', c: [0x787852, 0x3e4a2e, 0x5a4630, 0x22221e] };
// where a nation's soldiers come from (for skin tones when they fight abroad)
const REGION_OF_CC = { FR: 'eu-west', DE: 'eu-west', GB: 'eu-west', NL: 'eu-west', BE: 'eu-west', IE: 'eu-west', CH: 'eu-west', AT: 'eu-west', SE: 'eu-north', NO: 'eu-north', DK: 'eu-north', FI: 'eu-north', IS: 'eu-north', PL: 'eu-east', CZ: 'eu-east', SK: 'eu-east', HU: 'eu-east', RO: 'eu-east', BG: 'eu-east', UA: 'post-soviet', RU: 'post-soviet', BY: 'post-soviet', ES: 'mediterranean', PT: 'mediterranean', IT: 'mediterranean', GR: 'mediterranean', TR: 'mediterranean', US: 'north-america', CA: 'north-america', MX: 'latam', BR: 'latam', AR: 'latam', CO: 'latam', CL: 'latam', PE: 'latam', CN: 'east-asia', KR: 'east-asia', TW: 'east-asia', JP: 'japan', IN: 'south-asia', PK: 'south-asia', BD: 'south-asia', ID: 'southeast-asia', PH: 'southeast-asia', TH: 'southeast-asia', VN: 'southeast-asia', AU: 'oceania', NZ: 'oceania', SA: 'mena', AE: 'mena', EG: 'mena', IQ: 'mena', IR: 'mena', IL: 'mena', NG: 'subsaharan', ZA: 'subsaharan', KE: 'subsaharan' };
