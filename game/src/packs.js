// Registry of bundled city map packs (packs/index.json): which cities have a playable 3D map.
const IDX = new Map();
export let packList = [];
export async function loadPackIndex() {
  try { const r = await fetch('packs/index.json'); if (r.ok) { packList = await r.json(); for (const p of packList) IDX.set(p.cc + '|' + p.name, p); } } catch (e) { }
  return packList;
}
export const packFor = (cc, name) => IDX.get(cc + '|' + name) || null;
export const packUrl = p => 'packs/' + p.file;
