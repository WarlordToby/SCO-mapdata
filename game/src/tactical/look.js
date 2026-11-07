// City look: materials & shaders (facades, windows, night lights, tactical blend), sky, sun, palettes,
// building/roof geometry and street furniture. "Blend" style: realistic up close, clean tactical map when zoomed out.
import * as THREE from 'three';

export const U = { uTac: { value: 0 }, uNight: { value: 0 }, uLocked: { value: 0 } };
const LUM = 'vec3(0.299, 0.587, 0.114)';
const TAC = `vec3 tacPal(vec3 c){ float l = dot(c, ${LUM}); return mix(vec3(l), c, 0.8) * 0.62 + 0.3; }`;
const HASH = `float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`;

// Ground / land use / roads / markings: realistic colours that fade to a light, desaturated map palette when zoomed out.
export function flatMat(opts = {}, locked = false) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...opts });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTac = U.uTac;
    sh.fragmentShader = `uniform float uTac;\n${TAC}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, tacPal(diffuseColor.rgb) * ${locked ? '0.72' : '1.0'}, uTac);`);
  };
  m.customProgramCacheKey = () => 'flat' + locked;
  return m;
}

// Buildings: base colour per vertex, facade detail (windows, floor bands, shopfronts, curtain walls) from wall UVs,
// ground-contact darkening, lit windows at night, state tint per building, tactical blend and greyed-out locked tiles.
export function buildingMat(locked = false) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `attribute vec2 aUV; attribute vec4 aKS; attribute vec4 aTint;
      varying vec2 vUV; varying vec4 vKS; varying vec4 vTint; varying vec3 vWP;\n` + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vUV = aUV; vKS = aKS; vTint = aTint; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = `uniform float uTac; uniform float uNight;
      varying vec2 vUV; varying vec4 vKS; varying vec4 vTint; varying vec3 vWP;\n${TAC}\n${HASH}\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float kind = floor(vKS.x * 255.0 + 0.5), seed = vKS.y;
        float dist = length(vWP - cameraPosition);
        float lod = 1.0 - smoothstep(320.0, 1150.0, dist);
        vec3 base = diffuseColor.rgb; float lit = 0.0;
        bool wall = kind == 0.0 || (kind >= 3.0 && kind <= 7.0);
        if (wall) {
          float fh = kind == 5.0 ? 5.0 : 3.1;
          float fl = floor(vUV.y / fh), fy = fract(vUV.y / fh);
          float bay = kind == 4.0 ? 3.4 : kind == 7.0 ? 1.6 : 2.7;
          float col = floor(vUV.x / bay), fx = fract(vUV.x / bay);
          float win = step(0.28, fx) * step(fx, 0.72) * step(0.33, fy) * step(fy, 0.8);
          if (kind == 4.0) win = step(0.1, fx) * step(fx, 0.9) * step(0.22, fy) * step(fy, 0.86);
          if (kind == 3.0 && fl < 0.5) win = step(0.06, fx) * step(fx, 0.94) * step(0.06, fy) * step(fy, 0.72);
          if (kind == 5.0) win = step(0.62, fy) * step(fy, 0.82) * step(0.05, fx) * step(fx, 0.95) * step(1.0, fl + 0.5);
          if (kind == 7.0) win = step(0.06, fx) * step(fx, 0.94) * step(0.06, fy) * step(fy, 0.94);
          if (kind == 6.0) win = 0.0;
          if (vUV.y < 0.7 && kind != 3.0) win = 0.0;
          vec3 glass = mix(vec3(0.16, 0.2, 0.25), vec3(0.42, 0.5, 0.58), 0.35 + 0.3 * hh(vec3(col, fl, seed)));
          base = mix(base, glass, win * lod * (1.0 - uTac));
          base *= 1.0 - 0.13 * (1.0 - step(0.05, fy)) * lod * step(1.0, fl);      // floor band / cornice
          base *= mix(0.6, 1.0, smoothstep(0.0, 4.5, vUV.y));                      // ground-contact darkening
          lit = win * step(hh(vec3(col + 0.37, fl, seed * 31.0)), 0.36) * lod;
        } else if (kind == 1.0) {
          base *= 0.95 + 0.05 * hh(floor(vWP * 1.3) + seed);                        // flat roof patches
        } else if (kind == 2.0) {
          base *= 0.86 + 0.14 * step(0.5, fract(vUV.y * 2.2));                     // tile courses
        }
        base = mix(base, tacPal(base) ${locked ? '* 0.72' : ''}, uTac);
        base = mix(base, vTint.rgb, vTint.a);
        ${locked ? `base = mix(vec3(dot(base, ${LUM})) * 0.55 + 0.06, base, 0.12);` : ''}
        diffuseColor.rgb = base;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${locked ? '' : 'totalEmissiveRadiance += vec3(1.0, 0.76, 0.42) * lit * uNight * (1.0 - uTac) * 1.15;'}`);
  };
  m.customProgramCacheKey = () => 'bld' + locked;
  return m;
}

export function treeMat(locked = false) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTac = U.uTac;
    sh.fragmentShader = `uniform float uTac;\n${TAC}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      #ifdef USE_INSTANCING_COLOR
      #endif
      diffuseColor.rgb = mix(diffuseColor.rgb, tacPal(diffuseColor.rgb) * 0.92, uTac);
      ${locked ? `diffuseColor.rgb = vec3(dot(diffuseColor.rgb, ${LUM})) * 0.5 + 0.05;` : ''}`);
  };
  m.customProgramCacheKey = () => 'tree' + locked;
  return m;
}

// ---------------- Sky & sun ----------------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, hor, sunCol, sunDir; uniform float glow; varying vec3 vD;
      void main(){ float h = max(vD.y, 0.0); vec3 c = mix(hor, top, pow(h, 0.55)); if (vD.y < 0.0) c = hor * 0.92;
        float s = max(dot(normalize(vD), sunDir), 0.0); c += sunCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25 * glow);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -10;
  return m;
}
const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));
// Sun position for a given local hour (Strasbourg, roughly November), returns lighting parameters.
export function skyAt(hour) {
  const dayT = (hour - 7.4) / (16.9 - 7.4);            // short November day
  const el = Math.sin(Math.max(0, Math.min(1, dayT)) * Math.PI) * 22 * Math.PI / 180 - (dayT < 0 || dayT > 1 ? 0.2 : 0);
  const az = (110 + Math.max(0, Math.min(1, dayT)) * 140) * Math.PI / 180;  // ESE → WSW
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
  const day = Math.max(0, Math.min(1, (el * 180 / Math.PI + 6) / 14));          // 0 night … 1 full day
  const golden = Math.max(0, 1 - Math.abs(el * 180 / Math.PI - 3) / 9) * day;
  return {
    dir, day, golden, night: 1 - day,
    top: lerpC(0x070b16, 0x4f7fb8, day), hor: lerpC(lerpC(0x0d1322, 0xb9cde0, day), 0xf0b080, golden * 0.7),
    sun: lerpC(0xfff2dc, 0xff9a52, golden), sunI: 2.1 * day, hemiI: 0.25 + 0.95 * day,
    hemiSky: lerpC(0x24324f, 0xd4e4f5, day), hemiGround: lerpC(0x0c0e12, 0x6b6150, day),
  };
}

// ---------------- Palettes ----------------
const pal = a => a.map(c => new THREE.Color(c));
export const WALLS = {
  house: pal([0xe8dcc4, 0xe3c99e, 0xe9cfc0, 0xddd6c8, 0xd9c7a3, 0xece4d2, 0xc9b79a]),
  apartments: pal([0xded6c8, 0xd2cabb, 0xe6dccb, 0xc8c1b4, 0xe1cfb0, 0xd7c0b0, 0xbdb6ab]),
  old: pal([0xe9d3b0, 0xe6c2ab, 0xdcc9a0, 0xefe2c8, 0xd9b49a, 0xb98a72]),       // old-town plaster & sandstone
  office: pal([0xb8c0c6, 0xa9b3ba, 0xcfd1cf, 0x9fa9b0]),
  industrial: pal([0xa8a59c, 0x9a9c9b, 0xb2aea2, 0x8e9294]),
  retail: pal([0xd8d0c2, 0xcfc5b5, 0xe0d8ca]),
  civic: pal([0xd9c7a6, 0xc59a80, 0xe2d6bf]),
  religious: pal([0xc4846c, 0xb97a62, 0xd6b89c]),                                  // Vosges pink sandstone
  hospital: pal([0xe6e5e0, 0xdedcd4]),
  school: pal([0xdccdb0, 0xd4c4a8, 0xe2d4b8]),
  minor: pal([0xa9a196, 0x9b9488, 0xb7ae9f]),
};
export const ROOF_PITCH = pal([0x9c4a34, 0x8e4532, 0xa65a3e, 0x7a4636, 0x575c62, 0x4d5257]); // Alsace tile, some slate
export const ROOF_FLAT = pal([0x8f8d88, 0x7f7e7a, 0x6a6b6c, 0x9a958c]);
export const AREA = { residential: 0x6c6d68, commercial: 0x6f6d6a, retail: 0x706c69, industrial: 0x6a6970, military: 0x59604c, railway: 0x6b6560, farmland: 0x8c8b5c, forest: 0x3f5c34, grass: 0x637f4a, park: 0x5d7d47, cemetery: 0x5a704f, water: 0x3d6f8e, wetland: 0x4f6e5e, sports: 0x5f8a4c, parking: 0x7b7b79, construction: 0x7b6b55, allotments: 0x6a7d48, farmyard: 0x7a735a, beach: 0xc7b88e, scrub: 0x5a6b42 };
export const GROUND = 0x6b6c66;

export function wallStyle(useName, b, dense) {
  if (useName === 'minor' || useName === 'utility' || useName === 'parking') return 6;
  if (useName === 'industrial' || useName === 'warehouse' || useName === 'farm' || useName === 'sports' || useName === 'transport') return 5;
  if (useName === 'office') return b.h > 22 ? 7 : 4;
  if (useName === 'retail' || useName === 'hotel' || useName === 'hospital' || useName === 'university' || useName === 'school' || useName === 'civic' || useName === 'police') return 4;
  if (useName === 'religious') return 6;
  if ((useName === 'apartments' || useName === 'unknown') && (b.kinds?.length || dense)) return 3;
  return 0;
}
export function wallColor(useName, seed, old) {
  const key = old && ['house', 'apartments', 'unknown', 'retail'].includes(useName) ? 'old' : WALLS[useName] ? useName : ['hotel', 'police', 'fire_station', 'university'].includes(useName) ? 'civic' : ['warehouse', 'farm', 'utility', 'transport', 'sports', 'parking'].includes(useName) ? 'industrial' : useName === 'military' ? 'industrial' : 'apartments';
  const a = WALLS[key]; return a[seed % a.length];
}

// Minimum-area oriented bounding box of a ring (rotating edges).
export function obb(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    let mnu = Infinity, mxu = -Infinity, mnv = Infinity, mxv = -Infinity;
    for (const p of ring) { const u = p[0] * ux + p[1] * uy, v = -p[0] * uy + p[1] * ux; mnu = Math.min(mnu, u); mxu = Math.max(mxu, u); mnv = Math.min(mnv, v); mxv = Math.max(mxv, v); }
    const ar = (mxu - mnu) * (mxv - mnv);
    if (!best || ar < best.area) best = { area: ar, ux, uy, mnu, mxu, mnv, mxv };
  }
  if (!best) return null;
  const { ux, uy } = best, P = (u, v) => [u * ux - v * uy, u * uy + v * ux];
  let lu = best.mxu - best.mnu, lv = best.mxv - best.mnv;
  // long axis along u
  if (lv > lu) return { area: best.area, len: lv, wid: lu, c: P((best.mnu + best.mxu) / 2, (best.mnv + best.mxv) / 2), ax: [-uy, ux], ay: [ux, uy] };
  return { area: best.area, len: lu, wid: lv, c: P((best.mnu + best.mxu) / 2, (best.mnv + best.mxv) / 2), ax: [ux, uy], ay: [-uy, ux] };
}
