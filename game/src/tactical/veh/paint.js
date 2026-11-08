// Paint: national camouflage schemes and markings for military vehicles (by the army operating them),
// police, ambulance and fire service liveries by country, and the civilian car mix and colours by region.
const pk = h => (h >> 16 & 255) * 65536 + (h >> 8 & 255) * 256 + (h & 255);
// pattern ids (vehicle shader): 0 solid, 1 disruptive, 2 multi-environment, 3 splinter, 4 digital, 5 desert sparse
const SCHEME = {
  FR: [1, 0x4a5233, 0x5c4a33, 0x26241f],       // Centre-Europe two-tone + black
  DE: [1, 0x3e4a33, 0x5a4434, 0x23231f],       // NATO three-tone (Bronzegrün, Lederbraun, Teerschwarz)
  GB: [1, 0x3f4732, 0x24241f, 0x3f4732],       // green/black
  US: [1, 0x4a5236, 0x5a4a34, 0x24241f], CA: [1, 0x4a5236, 0x24241f, 0x4a5236],
  NL: [1, 0x48503a, 0x2a2c24, 0x5c5a40], BE: [1, 0x48503a, 0x5a4a34, 0x24241f], IT: [1, 0x535a3c, 0x5c4a34, 0x2a2822], ES: [1, 0x50573a, 0x60503a, 0x2a2822],
  SE: [3, 0x4e5e3a, 0x2c3a26, 0x1e2018], NO: [1, 0x3f4a32, 0x23241f, 0x3f4a32], DK: [3, 0x4e5a3c, 0x2c3a28, 0x5a5e44], FI: [1, 0x4a553e, 0x2a2e26, 0x6e6a58],
  PL: [1, 0x4b5434, 0x5a4a34, 0x23231f], CZ: [1, 0x4b5434, 0x5a4a34, 0x23231f], UA: [4, 0x56603e, 0x3c4630, 0x6a6448], RU: [1, 0x4c5a3a, 0x2c2e26, 0x6a6a58], BY: [0, 0x4c5a3a, 0x4c5a3a, 0x4c5a3a],
  TR: [1, 0x4f5636, 0x5e4c34, 0x24241f], GR: [1, 0x56603e, 0x6e6044, 0x2a2822], IL: [0, 0x8a8670, 0x8a8670, 0x8a8670],
  SA: [5, 0xc2a878, 0x9a8460, 0x6e5c44], AE: [5, 0xc2a878, 0x9a8460, 0x6e5c44], EG: [5, 0xc4ac80, 0x9a8460, 0x6e5c44], IQ: [5, 0xc2a878, 0x9a8460, 0x6e5c44], IR: [5, 0xb0a07c, 0x7e7258, 0x5e5240],
  CN: [4, 0x56603e, 0x3e4a32, 0x6e6448], JP: [1, 0x4a5434, 0x5c4a34, 0x24241f], KR: [1, 0x4a5434, 0x5a4a34, 0x24241f], TW: [1, 0x4a5434, 0x5a4a34, 0x24241f],
  IN: [1, 0x56603e, 0x6e6044, 0x3c3a2c], PK: [1, 0x56603e, 0x6e6044, 0x3c3a2c], BR: [1, 0x4a5434, 0x5c4a34, 0x24241f], MX: [1, 0x4a5434, 0x5c4a34, 0x24241f], AU: [1, 0x50563a, 0x6a5038, 0x24241f],
  ZA: [0, 0x6e5e44, 0x6e5e44, 0x6e5e44], NG: [1, 0x4a5434, 0x5c4a34, 0x24241f],
};
const REGION_SCHEME = { 'eu-west': SCHEME.DE, 'eu-north': SCHEME.SE, 'eu-east': SCHEME.PL, 'post-soviet': SCHEME.RU, mediterranean: SCHEME.IT, mena: SCHEME.EG, subsaharan: SCHEME.NG, 'south-asia': SCHEME.IN, 'east-asia': SCHEME.CN, japan: SCHEME.JP, 'southeast-asia': SCHEME.JP, latam: SCHEME.BR, 'north-america': SCHEME.US, oceania: SCHEME.AU };
// national markings: [style, c1, c2, c3]; 1 vertical tricolour, 2 horizontal tricolour, 3 Nordic cross, 4 disc on field, 5 bicolour
const MARK = {
  FR: [1, 0x0055a4, 0xffffff, 0xef4135], IT: [1, 0x009246, 0xffffff, 0xce2b37], IE: [1, 0x169b62, 0xffffff, 0xff883e], BE: [1, 0x000000, 0xfdda24, 0xef3340], RO: [1, 0x002b7f, 0xfcd116, 0xce1126],
  DE: [2, 0x000000, 0xdd0000, 0xffce00], NL: [2, 0xae1c28, 0xffffff, 0x21468b], RU: [2, 0xffffff, 0x0039a6, 0xd52b1e], AT: [2, 0xed2939, 0xffffff, 0xed2939], HU: [2, 0xce2939, 0xffffff, 0x477050], BG: [2, 0xffffff, 0x00966e, 0xd62612],
  SE: [3, 0x006aa7, 0xfecc00, 0], NO: [3, 0xba0c2f, 0xffffff, 0], DK: [3, 0xc8102e, 0xffffff, 0], FI: [3, 0xffffff, 0x002f6c, 0], IS: [3, 0x02529c, 0xffffff, 0],
  JP: [4, 0xffffff, 0xbc002d, 0], BD: [4, 0x006a4e, 0xf42a41, 0], KR: [4, 0xffffff, 0xcd2e3a, 0], PL: [5, 0xffffff, 0xdc143c, 0], UA: [5, 0x0057b7, 0xffd700, 0], ID: [5, 0xff0000, 0xffffff, 0],
  GB: [4, 0x012169, 0xc8102e, 0], US: [4, 0x3c3b6e, 0xffffff, 0], CA: [1, 0xd52b1e, 0xffffff, 0xd52b1e], ES: [2, 0xaa151b, 0xf1bf00, 0xaa151b], IN: [2, 0xff9933, 0xffffff, 0x138808], EG: [2, 0xce1126, 0xffffff, 0x000000],
  CN: [6, 0xde2910, 0, 0], TR: [4, 0xe30a17, 0xffffff, 0], BR: [4, 0x009c3b, 0xffdf00, 0], AU: [4, 0x012169, 0xffffff, 0], IL: [2, 0xffffff, 0x0038b8, 0xffffff], SA: [6, 0x006c35, 0, 0], AE: [2, 0x00732f, 0xffffff, 0x000000],
  MX: [1, 0x006847, 0xffffff, 0xce1126], NG: [1, 0x008751, 0xffffff, 0x008751], PK: [6, 0x01411c, 0, 0], ZA: [6, 0x007a4d, 0, 0], IR: [2, 0x239f40, 0xffffff, 0xda0000], IQ: [2, 0xce1126, 0xffffff, 0x000000],
};
export function militaryPaint(cc, region) {
  const s = SCHEME[cc] || REGION_SCHEME[region] || SCHEME.US, m = MARK[cc] || [6, 0x404040, 0, 0];
  return { P: [s[0], pk(s[1]), pk(s[2]), pk(s[3])], M: [m[0], pk(m[1]), pk(m[2]), pk(m[3])] };
}
// helicopters: plain operator green/grey with markings (most armies paint them in one colour)
export function heliPaint(cc, region) {
  const s = SCHEME[cc] || REGION_SCHEME[region] || SCHEME.US, m = MARK[cc] || [6, 0x404040, 0, 0], desert = s[0] === 5;
  return { P: [0, pk(desert ? 0xb8a47c : cc === 'FR' || cc === 'DE' || cc === 'GB' ? 0x3c4434 : s[1]), pk(s[2]), pk(s[3])], M: [m[0], pk(m[1]), pk(m[2]), pk(m[3])] };
}

// ---- service liveries: body colour, livery style (10 band, 11 Battenburg, 12 half-and-half, 13 chevrons), livery colours, model ----
const POL = {
  FR: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xc8102e, cars: ['policeHatch', 'policeSedan', 'policeVan'] }, // Police nationale: white with blue band
  DE: { body: 0xc9ccd0, st: 10, m1: 0x1d4ea8, m2: 0xffffff, cars: ['policeSedan', 'policeSuv', 'policeVan'] },
  GB: { body: 0xf2f2f2, st: 11, m1: 0xe8e020, m2: 0x1d4ea8, cars: ['policeHatch', 'policeSedan', 'policeVan'] },
  IE: { body: 0xf2f2f2, st: 11, m1: 0xe8e020, m2: 0x1d4ea8, cars: ['policeSedan', 'policeHatch'] },
  SE: { body: 0xf2f2f2, st: 11, m1: 0x1d4ea8, m2: 0xe8e020, cars: ['policeSedan', 'policeSuv', 'policeVan'] }, NO: { body: 0xf2f2f2, st: 11, m1: 0x1d4ea8, m2: 0xe8e020, cars: ['policeSedan', 'policeSuv'] },
  FI: { body: 0xf2f2f2, st: 11, m1: 0x1d4ea8, m2: 0xe8e020, cars: ['policeSedan', 'policeVan'] }, DK: { body: 0xf2f2f2, st: 11, m1: 0x1d4ea8, m2: 0xe8e020, cars: ['policeSedan', 'policeVan'] },
  NL: { body: 0xf2f2f2, st: 13, m1: 0x1d4ea8, m2: 0xff7f00, cars: ['policeSedan', 'policeHatch', 'policeVan'] }, BE: { body: 0xf2f2f2, st: 11, m1: 0x1d4ea8, m2: 0xe8e020, cars: ['policeSedan', 'policeVan'] },
  IT: { body: 0x7aa7d6, st: 10, m1: 0xf2f2f2, m2: 0xf2f2f2, cars: ['policeSedan', 'policeHatch'] }, ES: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xf2f2f2, cars: ['policeSedan', 'policeSuv'] },
  PT: { body: 0xf2f2f2, st: 11, m1: 0x1d4ea8, m2: 0xf2f2f2, cars: ['policeHatch', 'policeSedan'] }, PL: { body: 0xc9ccd0, st: 10, m1: 0x1d4ea8, m2: 0xf2f2f2, cars: ['policeSedan', 'policeVan'] },
  CZ: { body: 0xf2f2f2, st: 13, m1: 0x1d4ea8, m2: 0xe8e020, cars: ['policeSedan', 'policeHatch'] }, AT: { body: 0xc9ccd0, st: 10, m1: 0x1d4ea8, m2: 0xc8102e, cars: ['policeSedan', 'policeVan'] },
  RU: { body: 0xf2f2f2, st: 10, m1: 0x1d4ea8, m2: 0xf2f2f2, cars: ['policeSedan', 'policeSuv'] }, UA: { body: 0xf2f2f2, st: 10, m1: 0x0057b7, m2: 0xffd700, cars: ['policeSedan', 'policeSuv'] },
  US: { body: 0xf2f2f2, st: 12, m1: 0xf2f2f2, m2: 0x18191c, cars: ['policeSedan', 'policeSuv'] }, CA: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xc8102e, cars: ['policeSedan', 'policeSuv'] },
  MX: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xf2f2f2, cars: ['policeSedan', 'policeSuv'] }, BR: { body: 0xf2f2f2, st: 10, m1: 0x18191c, m2: 0xf2f2f2, cars: ['policeSuv', 'policeSedan'] },
  JP: { body: 0xf2f2f2, st: 12, m1: 0xf2f2f2, m2: 0x18191c, cars: ['policeSedan'] }, KR: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xf2f2f2, cars: ['policeSedan', 'policeSuv'] }, CN: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xf2f2f2, cars: ['policeSedan', 'policeSuv', 'policeVan'] },
  IN: { body: 0xf2f2f2, st: 10, m1: 0xc8102e, m2: 0x1d3b8b, cars: ['policeSuv', 'policeHatch'] }, TR: { body: 0x1d3b8b, st: 10, m1: 0xf2f2f2, m2: 0xf2f2f2, cars: ['policeSedan', 'policeHatch'] },
  AU: { body: 0xf2f2f2, st: 11, m1: 0x1d3b8b, m2: 0xf2f2f2, cars: ['policeSedan', 'policeSuv'] }, EG: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xf2f2f2, cars: ['policeSedan', 'policeSuv'] },
  SA: { body: 0xf2f2f2, st: 10, m1: 0x006c35, m2: 0xf2f2f2, cars: ['policeSuv', 'policeSedan'] }, AE: { body: 0xf2f2f2, st: 10, m1: 0x00732f, m2: 0xf2f2f2, cars: ['policeSuv', 'policeSedan'] },
  NG: { body: 0x18191c, st: 10, m1: 0xf2f2f2, m2: 0x18191c, cars: ['policeSuv'] }, ZA: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xffd700, cars: ['policeSuv', 'policeSedan'] },
  ID: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xffd700, cars: ['policeSuv', 'policeSedan'] }, PH: { body: 0xf2f2f2, st: 10, m1: 0x1d3b8b, m2: 0xc8102e, cars: ['policeSuv', 'policeVan'] },
};
const POL_REGION = { 'eu-west': POL.DE, 'eu-north': POL.SE, 'eu-east': POL.PL, 'post-soviet': POL.RU, mediterranean: POL.IT, mena: POL.EG, subsaharan: POL.ZA, 'south-asia': POL.IN, 'east-asia': POL.CN, japan: POL.JP, 'southeast-asia': POL.ID, latam: POL.MX, 'north-america': POL.US, oceania: POL.AU };
const AMB = { GB: [11, 0x1a9a3a, 0xe8e020, 0xe8e020], IE: [11, 0x1a9a3a, 0xe8e020, 0xe8e020], SE: [11, 0x1a9a3a, 0xe8e020, 0xe8e020], DE: [10, 0xc8102e, 0xc8102e, 0xf2f2f2], FR: [10, 0x1d4ea8, 0xff7f00, 0xf2f2f2], US: [10, 0xc8102e, 0xc8102e, 0xf2f2f2], NL: [13, 0x1d4ea8, 0xe8e020, 0xe8e020], _: [10, 0xc8102e, 0xc8102e, 0xf2f2f2] };
const FIRE = { US: [0xb01010, 13, 0xf2f2f2, 0xb01010], DE: [0xc8102e, 13, 0xf2f2f2, 0xc8102e], GB: [0xc8102e, 11, 0xe8e020, 0xc8102e], _: [0xc8102e, 13, 0xf2f2f2, 0xc8102e] };

export function policeLivery(cc, region, seed) {
  const L = POL[cc] || POL_REGION[region] || POL.DE;
  return { model: L.cars[Math.floor(seed * L.cars.length) % L.cars.length], P: [0, pk(L.body), pk(0x3a3d40), pk(0x404040)], M: [L.st, pk(L.m1), pk(L.m2), 0] };
}
export function ambulanceLivery(cc) { const a = AMB[cc] || AMB._; return { model: 'ambulance', P: [0, pk(a[3] === 0xe8e020 ? 0xe8e020 : 0xf2f2f2), pk(a[1]), pk(0x404040)], M: [a[0], pk(a[1]), pk(a[2]), 0] }; }
export function fireLivery(cc) { const f = FIRE[cc] || FIRE._; return { model: 'fireEngine', P: [0, pk(f[0]), pk(0xd8d8d8), pk(0x404040)], M: [f[1], pk(f[2]), pk(f[3]), 0] }; }

// ---- civilian traffic ----
const CAR_MIX = {
  'eu-west': { hatch: 38, sedan: 18, suv: 16, van: 12, pickup: 1, minibus: 2, bus: 3, boxTruck: 5 }, 'eu-north': { hatch: 30, sedan: 22, suv: 22, van: 12, bus: 3, boxTruck: 5 },
  'eu-east': { hatch: 36, sedan: 26, suv: 14, van: 12, minibus: 4, bus: 3, boxTruck: 5 }, 'post-soviet': { sedan: 34, hatch: 22, suv: 16, van: 8, minibus: 10, bus: 4, boxTruck: 6 },
  mediterranean: { hatch: 42, sedan: 16, suv: 14, van: 12, minibus: 2, bus: 3, boxTruck: 5 }, 'north-america': { sedan: 26, suv: 32, pickup: 24, van: 6, hatch: 4, bus: 3, boxTruck: 5 },
  mena: { sedan: 34, suv: 20, pickup: 18, hatch: 10, minibus: 8, bus: 3, boxTruck: 6 }, subsaharan: { sedan: 26, minibus: 26, pickup: 14, suv: 12, hatch: 10, bus: 4, boxTruck: 6 },
  'south-asia': { tuktuk: 32, hatch: 24, sedan: 10, suv: 8, minibus: 8, bus: 6, boxTruck: 10 }, 'southeast-asia': { hatch: 22, sedan: 16, pickup: 16, minibus: 14, tuktuk: 12, suv: 10, bus: 4, boxTruck: 6 },
  'east-asia': { sedan: 34, suv: 24, hatch: 16, van: 10, bus: 6, boxTruck: 8 }, japan: { hatch: 40, sedan: 18, van: 18, suv: 12, bus: 5, boxTruck: 7 },
  latam: { sedan: 28, hatch: 24, pickup: 16, suv: 10, minibus: 10, bus: 6, boxTruck: 6 }, oceania: { sedan: 22, suv: 28, pickup: 18, hatch: 18, van: 6, bus: 3, boxTruck: 5 },
};
const COLS = [[0xf0f0f0, 24], [0x18191c, 18], [0xa8acb0, 16], [0x6a6e72, 12], [0x1f3a6e, 8], [0x8a1c1c, 7], [0x3a4a3a, 3], [0x6a5a44, 3], [0xc8b48a, 3], [0x2a6a9a, 3], [0xd8a020, 1], [0x5a2a6a, 1]];
const TAXI = { US: 0xf2c20f, MX: 0xd8d8d8, IN: 0x18191c, GB: 0x18191c, JP: 0x1f3a6e, EG: 0x18191c, TR: 0xf2c20f, BR: 0xf2f2f2 };
export function civilianLook(region, cc, seed) {
  const mix = CAR_MIX[region] || CAR_MIX['eu-west'], keys = Object.keys(mix);
  let t = (seed * 9301 % 1) * keys.reduce((a, k) => a + mix[k], 0), model = keys[0]; for (const k of keys) if ((t -= mix[k]) < 0) { model = k; break; }
  let w = ((seed * 49297) % 1) * COLS.reduce((a, c) => a + c[1], 0), col = COLS[0][0]; for (const [c, n] of COLS) if ((w -= n) < 0) { col = c; break; }
  if (model === 'bus') col = [0xf2f2f2, 0x1d6a3a, 0xc8102e, 0xe8c020, 0x1d4ea8][Math.floor(seed * 50) % 5];
  if (model === 'tuktuk') col = cc === 'IN' ? 0x2a7a2a : 0x1d4ea8;
  if (model === 'minibus' && region === 'subsaharan') col = (seed * 77 % 1) < 0.5 ? 0xf2f2f2 : 0xe8c020;
  if ((model === 'sedan' || model === 'hatch') && TAXI[cc] && (seed * 131 % 1) < 0.08) col = TAXI[cc];
  if (model === 'boxTruck') col = 0xf0f0f0;
  return { model, P: [0, pk(col), pk(0x9a9ea2), pk(0x404040)], M: [0, 0, 0, 0] };
}
