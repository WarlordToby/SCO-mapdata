// Procedural organization badge (SVG).
export const SHAPES = ['shield', 'roundel', 'star', 'hexagon', 'pentagon'];
export const DIVISIONS = ['plain', 'pale', 'bend', 'chevron', 'chief'];
export const EMBLEMS = ['eye', 'sword', 'tower', 'flame', 'bolt', 'star', 'key', 'globe', 'trefoil', 'gate', 'crescent', 'owl'];
export const PALETTE = ['#13202e', '#1d3557', '#2b4a3a', '#5a1e1e', '#3d2b4f', '#2d2d2d', '#6b5a2a', '#0f3b46', '#e8e3d3', '#8a1c1c', '#c9a227', '#9aa7b0'];

const shapePath = {
  shield: 'M50 4 L92 14 L92 48 C92 72 74 88 50 96 C26 88 8 72 8 48 L8 14 Z',
  roundel: 'M50 4 A46 46 0 1 1 49.9 4 Z',
  star: (() => { let p = ''; for (let i = 0; i < 12; i++) { const r = i % 2 ? 34 : 48, a = (i * 30 - 90) * Math.PI / 180; p += (i ? 'L' : 'M') + (50 + r * Math.cos(a)).toFixed(1) + ' ' + (50 + r * Math.sin(a)).toFixed(1) + ' '; } return p + 'Z'; })(),
  hexagon: 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z',
  pentagon: 'M50 4 L94 36 L77 92 L23 92 L6 36 Z',
};
const division = (d, c) => ({
  plain: '',
  pale: `<rect x="50" y="0" width="50" height="100" fill="${c}"/>`,
  bend: `<polygon points="0,0 100,100 100,0" fill="${c}"/>`,
  chevron: `<polygon points="0,100 50,48 100,100 100,78 50,26 0,78" fill="${c}"/>`,
  chief: `<rect x="0" y="0" width="100" height="32" fill="${c}"/>`,
}[d]);
const emblem = (e, c) => ({
  eye: `<path d="M22 50 Q50 26 78 50 Q50 74 22 50 Z" fill="none" stroke="${c}" stroke-width="4"/><circle cx="50" cy="50" r="9" fill="${c}"/>`,
  sword: `<path d="M50 20 L55 30 L55 64 L45 64 L45 30 Z" fill="${c}"/><rect x="36" y="64" width="28" height="5" fill="${c}"/><rect x="47" y="69" width="6" height="11" fill="${c}"/><circle cx="50" cy="83" r="4" fill="${c}"/>`,
  tower: `<path d="M34 78 L34 40 L30 40 L30 28 L37 28 L37 33 L43 33 L43 28 L57 28 L57 33 L63 33 L63 28 L70 28 L70 40 L66 40 L66 78 Z" fill="${c}"/><path d="M45 78 L45 62 Q50 55 55 62 L55 78 Z" fill="#0006"/>`,
  flame: `<path d="M50 20 C62 36 70 44 68 60 C66 74 58 80 50 80 C42 80 33 74 32 62 C31 50 40 46 42 36 C46 44 48 46 50 48 C52 40 52 30 50 20 Z" fill="${c}"/>`,
  bolt: `<polygon points="56,18 32,54 48,54 42,82 68,44 52,44" fill="${c}"/>`,
  star: `<polygon points="50,20 57,41 79,41 61,54 68,76 50,63 32,76 39,54 21,41 43,41" fill="${c}"/>`,
  key: `<circle cx="50" cy="34" r="11" fill="none" stroke="${c}" stroke-width="5"/><rect x="47" y="44" width="6" height="34" fill="${c}"/><rect x="53" y="62" width="9" height="5" fill="${c}"/><rect x="53" y="71" width="6" height="5" fill="${c}"/>`,
  globe: `<circle cx="50" cy="50" r="24" fill="none" stroke="${c}" stroke-width="4"/><ellipse cx="50" cy="50" rx="10" ry="24" fill="none" stroke="${c}" stroke-width="3"/><line x1="26" y1="50" x2="74" y2="50" stroke="${c}" stroke-width="3"/><path d="M30 38 H70 M30 62 H70" stroke="${c}" stroke-width="2.5"/>`,
  trefoil: [0, 120, 240].map(a => { const r = a * Math.PI / 180; return `<circle cx="${50 + 14 * Math.sin(r)}" cy="${50 - 14 * Math.cos(r)}" r="11" fill="none" stroke="${c}" stroke-width="4"/>`; }).join('') + `<circle cx="50" cy="50" r="5" fill="${c}"/>`,
  gate: `<path d="M28 78 L28 44 Q50 18 72 44 L72 78 L62 78 L62 48 Q50 34 38 48 L38 78 Z" fill="${c}"/><rect x="24" y="78" width="52" height="5" fill="${c}"/>`,
  crescent: `<path fill-rule="evenodd" d="M22 50 a28 28 0 1 0 56 0 a28 28 0 1 0 -56 0 Z M37 46 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 Z" fill="${c}"/>`,
  owl: `<path d="M30 30 L40 38 Q50 34 60 38 L70 30 L68 60 Q60 80 50 80 Q40 80 32 60 Z" fill="${c}"/><circle cx="42" cy="48" r="6" fill="#0008"/><circle cx="58" cy="48" r="6" fill="#0008"/><polygon points="50,52 46,58 54,58" fill="#0008"/>`,
}[e]);

export function badgeSVG(b, size = 120, withText = true) {
  const id = 'bc' + Math.random().toString(36).slice(2, 7);
  const p = shapePath[b.shape];
  const ring = withText && b.shape === 'roundel';
  const txt = ring ? `<defs><path id="${id}t" d="M50 50 m-37 0 a37 37 0 1 1 74 0"/></defs><text font-size="9" font-weight="700" letter-spacing="2" fill="${b.trim}" font-family="ui-sans-serif,system-ui"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${esc(b.acr)}</textPath></text>` : '';
  const scale = ring ? 0.62 : 0.78;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <clipPath id="${id}"><path d="${p}"/></clipPath>
  <g clip-path="url(#${id})"><rect width="100" height="100" fill="${b.field}"/>${division(b.division, b.second)}</g>
  <path d="${p}" fill="none" stroke="${b.trim}" stroke-width="4"/>
  ${ring ? `<circle cx="50" cy="50" r="30" fill="none" stroke="${b.trim}" stroke-width="1.5"/>` : ''}
  ${txt}
  <g transform="translate(${50 - 50 * scale} ${50 - 50 * scale + (b.shape === 'shield' ? -2 : 0)}) scale(${scale})">${emblem(b.emblem, b.emblemColor)}</g>
  ${withText && !ring && b.shape !== 'star' ? `<text x="50" y="${b.shape === 'shield' ? 84 : 86}" font-size="8" text-anchor="middle" font-weight="800" letter-spacing="1.5" fill="${b.trim}" font-family="ui-sans-serif,system-ui">${esc(b.acr)}</text>` : ''}
</svg>`;
}
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export function randomBadge(acr) {
  const light = ['#e8e3d3', '#c9a227', '#9aa7b0', '#d9d9d9'];
  return { shape: pick(SHAPES), division: pick(DIVISIONS), emblem: pick(EMBLEMS), field: pick(PALETTE.slice(0, 8)), second: pick(PALETTE.slice(0, 8)), trim: pick(light), emblemColor: pick(light), acr };
}
