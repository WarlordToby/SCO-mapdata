// City look: materials & shaders (facades, windows, night lights, tactical blend), sky, sun, palettes,
// building/roof geometry and street furniture. "Blend" style: realistic up close, clean tactical map when zoomed out.
import * as THREE from 'three';

export const U = { uTac: { value: 0 }, uNight: { value: 0 }, uLocked: { value: 0 }, uTime: { value: 0 }, uSkyHor: { value: new THREE.Color(0xb9cde0) }, uSkyTop: { value: new THREE.Color(0x4f7fb8) } };
const LUM = 'vec3(0.299, 0.587, 0.114)';
const TAC = `vec3 tacPal(vec3 c){ float l = dot(c, ${LUM}); return mix(vec3(l), c, 0.8) * 0.62 + 0.3; }`;
const HASH = `float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`;

// Ground / land use / roads / markings: realistic colours that fade to a light, desaturated map palette when zoomed out.
const NOISE = `float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5),
        c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
  float fbm(vec2 p){ return vn(p) * 0.55 + vn(p * 2.3 + 7.1) * 0.3 + vn(p * 5.7 + 3.3) * 0.15; }`;
// mottle: 0 = none, 1 = gentle variation (land use, paving), 2 = natural ground (patches of grass, earth and paving)
export function flatMat(opts = {}, locked = false, mottle = 0) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...opts });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTac = U.uTac;
    sh.vertexShader = 'varying vec3 vWP2;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uTac; varying vec3 vWP2;\n${TAC}\n${NOISE}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      ${mottle ? `{ vec2 q = vWP2.xz; float n1 = fbm(q * 0.025), n2 = fbm(q * 0.11 + 13.0);
        ${mottle === 2 ? `vec3 grass = vec3(0.105, 0.16, 0.06), earth = vec3(0.17, 0.15, 0.11), shrub = vec3(0.065, 0.105, 0.04);
        float gm = smoothstep(0.34, 0.52, n1);
        vec3 nat = mix(mix(earth, grass, smoothstep(0.25, 0.6, n2)), shrub, smoothstep(0.72, 0.85, fbm(q * 0.06 + 3.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, nat, gm * 0.9);` : ''}
        ${mottle === 3 ? `vec3 lawn = vec3(0.105, 0.16, 0.06), shrub = vec3(0.065, 0.105, 0.04), paving = vec3(0.23, 0.22, 0.2);
        vec3 gard = mix(lawn, shrub, smoothstep(0.6, 0.8, n2));
        gard = mix(gard, paving, smoothstep(0.62, 0.74, fbm(q * 0.045 + 21.0)) * 0.7);
        diffuseColor.rgb = gard;` : ''}
        diffuseColor.rgb *= 0.92 + 0.16 * n2; }` : ''}
      diffuseColor.rgb = mix(diffuseColor.rgb, tacPal(diffuseColor.rgb) * ${locked ? '0.72' : '1.0'}, uTac);`);
  };
  m.customProgramCacheKey = () => 'flat' + locked + mottle;
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
    sh.fragmentShader = `uniform float uTac; uniform float uNight; uniform float uTime;
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
        { float ta = floor(vTint.a * 255.0 + 0.5); float k = vTint.a;
          if (mod(ta, 2.0) > 0.5) k *= 0.75 + 0.25 * sin(uTime * 3.0 + seed * 6.28);           // pulsing (infestation)
          float detail = dot(base, ${LUM});
          base = mix(base, vTint.rgb * (0.55 + 0.75 * detail), k); }
        ${locked ? `base = mix(vec3(dot(base, ${LUM})) * 0.55 + 0.06, base, 0.12);` : ''}
        diffuseColor.rgb = base;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${locked ? '' : 'totalEmissiveRadiance += vec3(1.0, 0.76, 0.42) * lit * uNight * (1.0 - uTac) * 1.15;'}`);
  };
  m.customProgramCacheKey = () => 'bld' + locked;
  return m;
}

// Water: sky reflection by viewing angle (Fresnel), slow moving ripples and sun glints.
export function waterMat(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...opts });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uTac: U.uTac, uTime: U.uTime, uSkyHor: U.uSkyHor, uSkyTop: U.uSkyTop, uNight: U.uNight });
    sh.vertexShader = 'varying vec3 vWP3;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP3 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uTac, uTime, uNight; uniform vec3 uSkyHor, uSkyTop; varying vec3 vWP3;\n${TAC}\n${NOISE}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 v = normalize(cameraPosition - vWP3); float fr = pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
        vec2 q = vWP3.xz; float rip = fbm(q * 0.08 + vec2(uTime * 0.05, uTime * 0.03)) * 0.6 + fbm(q * 0.31 - vec2(uTime * 0.12, 0.0)) * 0.4;
        vec3 sky = mix(uSkyTop, uSkyHor, 0.5 + fr * 0.5);
        vec3 w = mix(diffuseColor.rgb * (0.85 + 0.3 * rip), sky, 0.25 + fr * 0.55);
        w += vec3(1.0, 0.95, 0.85) * pow(rip, 9.0) * 1.6 * (1.0 - uNight) * (1.0 - uTac);
        diffuseColor.rgb = mix(w, tacPal(diffuseColor.rgb), uTac); }`);
  };
  m.customProgramCacheKey = () => 'water';
  return m;
}
// Car parks: lighter asphalt with bay lines laid out along the lot (rows of 5 m bays either side of 6 m aisles).
export function parkMat(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...opts });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTac = U.uTac;
    sh.vertexShader = 'attribute vec2 aPark; varying vec2 vPark; varying float vDist;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vPark = aPark; vDist = length((modelMatrix * vec4(transformed, 1.0)).xyz - cameraPosition);');
    sh.fragmentShader = `uniform float uTac; varying vec2 vPark; varying float vDist;\n${TAC}\n${NOISE}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float row = mod(vPark.y + 8.0, 16.0), bay = fract(vPark.x / 2.5);
        float inBay = step(0.0, row) * step(row, 5.0) + step(11.0, row) * step(row, 16.0);
        float line = inBay * (1.0 - step(0.05, bay)) + (step(4.85, row) * step(row, 5.0) + step(11.0, row) * step(row, 11.15));
        float lod = 1.0 - smoothstep(250.0, 700.0, vDist);
        diffuseColor.rgb *= 0.94 + 0.1 * fbm(vPark * 0.2);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.87, 0.84), clamp(line, 0.0, 1.0) * lod * 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, tacPal(diffuseColor.rgb), uTac); }`);
  };
  m.customProgramCacheKey = () => 'park';
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
    top: lerpC(0x0a1020, 0x4f7fb8, day), hor: lerpC(lerpC(0x1c2438, 0xb9cde0, day), 0xf0b080, golden * 0.7),
    sun: lerpC(0xfff2dc, 0xff9a52, golden), sunI: 2.1 * day, hemiI: 0.55 + 0.65 * day,
    hemiSky: lerpC(0x3a4c78, 0xd4e4f5, day), hemiGround: lerpC(0x1a1c22, 0x6b6150, day),
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
export const ROOF_FLAT = pal([0xa8a59e, 0x9c9a93, 0x8e8d89, 0xb3ada2, 0x97958e]);
export const AREA = { residential: 0x6a7458, commercial: 0x6f6d6a, retail: 0x706c69, industrial: 0x6a6970, military: 0x59604c, railway: 0x6b6560, farmland: 0x8c8b5c, forest: 0x3f5c34, grass: 0x637f4a, park: 0x5d7d47, cemetery: 0x5a704f, water: 0x3d6f8e, wetland: 0x4f6e5e, sports: 0x5f8a4c, parking: 0x6e7072, construction: 0x7b6b55, allotments: 0x6a7d48, farmyard: 0x7a735a, beach: 0xc7b88e, scrub: 0x5a6b42 };
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
