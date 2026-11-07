// Regional building traditions, by country. Used to style buildings (game) and to shape generated buildings (compiler)
// where satellite land cover shows built-up land that OpenStreetMap has not mapped yet.
const R = {
  'eu-west': 'FR BE NL LU DE AT CH GB IE LI MC AD',
  'eu-north': 'SE NO FI DK IS EE LV LT',
  'eu-east': 'PL CZ SK HU RO BG RS HR SI BA ME MK AL MD XK',
  'post-soviet': 'RU UA BY KZ UZ KG TJ TM AZ GE AM MN',
  'mediterranean': 'ES PT IT GR MT CY TR IL LB SM VA',
  'mena': 'EG SA AE IQ IR SY JO KW QA BH OM YE LY TN DZ MA PS EH MR',
  'subsaharan': 'NG CD KE ET TZ UG GH CI CM SN SD SO AO ZM ZW MZ MG ML BF NE TD GN RW BJ TG SL LR CF CG GA SS ER DJ MW BI GM GW GQ LS SZ',
  'south-asia': 'IN PK BD NP LK AF BT MV',
  'east-asia': 'CN KR KP TW HK MO',
  'japan': 'JP',
  'southeast-asia': 'TH VN ID PH MM MY SG KH LA BN TL',
  'latam': 'MX GT HN SV NI CR PA CU DO HT PR JM CO VE EC PE BO CL AR UY PY BR TT',
  'north-america': 'US CA',
  'oceania': 'AU NZ ZA NA BW',
};
const BY_CC = {};
for (const [r, list] of Object.entries(R)) for (const cc of list.split(' ')) BY_CC[cc] = r;
export const regionOf = cc => BY_CC[(cc || '').toUpperCase()] || 'eu-west';

// Generated-building parameters: footprint along the street (w) and depth (d) in metres, setback from the kerb,
// gap between neighbours, rows of buildings behind the street front, and typical storeys.
export const FILL = {
  'eu-west': { w: [8, 16], d: [10, 14], setback: [1, 4], gap: [0, 3], rows: 1, levels: [2, 5] },
  'eu-north': { w: [10, 18], d: [10, 14], setback: [3, 8], gap: [4, 10], rows: 1, levels: [2, 5] },
  'eu-east': { w: [10, 20], d: [10, 14], setback: [2, 6], gap: [2, 8], rows: 1, levels: [2, 5] },
  'post-soviet': { w: [12, 40], d: [11, 14], setback: [6, 15], gap: [10, 25], rows: 1, levels: [5, 9] },
  'mediterranean': { w: [8, 16], d: [10, 15], setback: [0, 2], gap: [0, 1], rows: 2, levels: [3, 6] },
  'mena': { w: [8, 18], d: [10, 18], setback: [0, 2], gap: [0, 1], rows: 3, levels: [3, 7] },
  'subsaharan': { w: [6, 12], d: [6, 12], setback: [1, 4], gap: [1, 4], rows: 3, levels: [1, 2] },
  'south-asia': { w: [6, 12], d: [8, 14], setback: [0, 1], gap: [0, 1], rows: 3, levels: [2, 5] },
  'east-asia': { w: [10, 30], d: [10, 16], setback: [3, 10], gap: [6, 20], rows: 2, levels: [5, 18] },
  'japan': { w: [7, 11], d: [7, 11], setback: [1, 2], gap: [1, 2], rows: 3, levels: [2, 3] },
  'southeast-asia': { w: [5, 10], d: [10, 18], setback: [0, 2], gap: [0, 1], rows: 2, levels: [2, 4] },
  'latam': { w: [6, 12], d: [12, 20], setback: [0, 1], gap: [0, 0.5], rows: 2, levels: [1, 3] },
  'north-america': { w: [9, 14], d: [10, 15], setback: [5, 9], gap: [3, 7], rows: 1, levels: [1, 2] },
  'oceania': { w: [10, 16], d: [10, 16], setback: [5, 9], gap: [3, 7], rows: 1, levels: [1, 2] },
};

// Latin-script label: prefer the English or international name when the local name is in another script.
const NON_LATIN = /[^\u0000-ɏḀ-ỿ -⁯\s\d]/;
export const latinName = t => {
  if (!t) return '';
  const n = t.name || '';
  if (!n || !NON_LATIN.test(n)) return n;
  return t['name:en'] || t.int_name || t['name:latin'] || t['name:fr'] || n;
};
