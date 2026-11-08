import * as d3 from 'd3-geo';
import { feature } from 'topojson-client';
import DATA from './data.json';

export const META = DATA.meta;
export const WORLD = feature(DATA.topo, DATA.topo.objects.countries).features
  .filter(f => f.id && f.id !== '010'); // drop Antarctica
WORLD.forEach(f => { f.meta = META[f.id] || { name: f.properties.name, cca2: '', pop: 0, gdp: 0 }; });
export const byCcn3 = id => WORLD.find(f => f.id === id);

const R = 6371;
export const distKm = (a, b) => d3.geoDistance(a, b) * R;
export const bearing = (from, to) => {
  const [l1, p1] = from.map(x => x * Math.PI / 180), [l2, p2] = to.map(x => x * Math.PI / 180);
  const y = Math.sin(l2 - l1) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};
export const compass = deg => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
export const interp = (a, b, t) => d3.geoInterpolate(a, b)(t);

// Playable territory = largest polygon plus islands near it (drops overseas territories).
export function territoryOf(f) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const feats = polys.map(c => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: c } }));
  feats.forEach(p => { p.area = d3.geoArea(p); p.c = d3.geoCentroid(p); });
  const main = feats.reduce((a, b) => (b.area > a.area ? b : a));
  const [[x0, y0], [x1, y1]] = d3.geoBounds(main);
  const span = Math.max(4, Math.hypot(x1 - x0, y1 - y0));
  const keep = feats.filter(p => p === main || distKm(p.c, main.c) < span * 111 * 0.9);
  const terr = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: keep.map(p => p.geometry.coordinates) } };
  return terr;
}

export function regionsOf(cca2) { return DATA.regions[cca2] || null; }

export function citiesOf(cca2, terr) {
  const raw = DATA.cities[cca2] || [];
  const [[x0, y0], [x1, y1]] = d3.geoBounds(terr);
  // territories that cross the antimeridian (Russia, the US with the Aleutians, Fiji…) have x0 > x1
  const inLon = lon => x0 <= x1 ? lon > x0 - .3 && lon < x1 + .3 : lon > x0 - .3 || lon < x1 + .3;
  return raw.filter(([n, lon, lat]) => inLon(lon) && lat > y0 - .3 && lat < y1 + .3 &&
    (d3.geoContains(terr, [lon, lat]) || nearTerr(terr, [lon, lat])))
    .map(([name, lon, lat, pop, cap], i) => ({ id: 'c' + i, name, lon, lat, pop, capital: !!cap }));
}
function nearTerr(terr, p) { // coastal tolerance ~12 km for coarse coastlines
  const d = 0.11;
  return [[d, 0], [-d, 0], [0, d], [0, -d]].some(([a, b]) => d3.geoContains(terr, [p[0] + a, p[1] + b]));
}

export function makeProjection(terr) {
  const [[x0, y0], [x1, y1]] = d3.geoBounds(terr);
  const cx = x0 <= x1 ? (x0 + x1) / 2 : ((x0 + x1 + 360) / 2 + 180) % 360 - 180;
  return d3.geoConicConformal().parallels([y0 + (y1 - y0) / 6, y1 - (y1 - y0) / 6]).rotate([-cx, 0]);
}
export { d3 };
