// City look: materials & shaders (facades, windows, night lights, tactical blend), sky, sun, palettes,
// building/roof geometry and street furniture. "Blend" style: realistic up close, clean tactical map when zoomed out.
import * as THREE from 'three';

export const U = { uArid: { value: 0 }, uTac: { value: 0 }, uNight: { value: 0 }, uLocked: { value: 0 }, uTime: { value: 0 }, uSkyHor: { value: new THREE.Color(0xb9cde0) }, uSkyTop: { value: new THREE.Color(0x4f7fb8) } };
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
    sh.uniforms.uTac = U.uTac; sh.uniforms.uArid = U.uArid;
    sh.vertexShader = 'varying vec3 vWP2;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uTac; uniform float uArid; varying vec3 vWP2;\n${TAC}\n${NOISE}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      ${mottle ? `{ vec2 q = vWP2.xz; float n1 = fbm(q * 0.025), n2 = fbm(q * 0.11 + 13.0);
        ${mottle === 2 ? `vec3 grass = vec3(0.105, 0.16, 0.06), earth = vec3(0.17, 0.15, 0.11), shrub = vec3(0.065, 0.105, 0.04);
        float gm = smoothstep(0.34, 0.52, n1);
        vec3 nat = mix(mix(earth, grass, smoothstep(0.25, 0.6, n2)), shrub, smoothstep(0.72, 0.85, fbm(q * 0.06 + 3.0)));
        nat = mix(nat, mix(vec3(0.3, 0.25, 0.17), vec3(0.2, 0.17, 0.11), smoothstep(0.3, 0.7, n2)), uArid * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, nat, gm * 0.9);` : ''}
        ${mottle === 3 ? `vec3 lawn = vec3(0.105, 0.16, 0.06), shrub = vec3(0.065, 0.105, 0.04), paving = vec3(0.23, 0.22, 0.2);
        vec3 gard = mix(lawn, shrub, smoothstep(0.6, 0.8, n2));
        gard = mix(gard, paving, smoothstep(0.62, 0.74, fbm(q * 0.045 + 21.0)) * 0.7);
        gard = mix(gard, mix(vec3(0.24, 0.2, 0.13), vec3(0.11, 0.12, 0.06), smoothstep(0.55, 0.8, n2)), uArid * 0.85);
        diffuseColor.rgb = gard;` : ''}
        diffuseColor.rgb *= 0.92 + 0.16 * n2; }` : ''}
      diffuseColor.rgb = mix(diffuseColor.rgb, tacPal(diffuseColor.rgb) * ${locked ? '0.72' : '1.0'}, uTac);`);
  };
  m.customProgramCacheKey = () => 'flat' + locked + mottle;
  return m;
}

// Ground with satellite land cover (WorldCover 10 m classes in a per-tile texture): forest, shrubs, grass, crops,
// built-up ground, bare sand/rock, wetland. Borders are broken up with noise so the 10 m cells do not show.
export function groundLCMat(tex, origin, locked = false) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTac = U.uTac; sh.uniforms.uArid = U.uArid; sh.uniforms.uLC = { value: tex }; sh.uniforms.uLCo = { value: new THREE.Vector2(origin[0], origin[1]) };
    sh.vertexShader = 'varying vec3 vWP2;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uTac; uniform float uArid; uniform sampler2D uLC; uniform vec2 uLCo; varying vec3 vWP2;\n${TAC}\n${NOISE}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 q = vec2(vWP2.x, -vWP2.z), uv = (q - uLCo) / 1000.0;
        vec2 jit = (vec2(fbm(q * 0.09), fbm(q * 0.09 + 5.3)) - 0.5) * 0.014;
        float code = floor(texture2D(uLC, clamp(uv + jit, 0.0005, 0.9995)).r * 255.0 + 0.5);
        float n2 = fbm(q * 0.11 + 13.0), n3 = fbm(q * 0.035);
        vec3 grass = mix(vec3(0.1, 0.15, 0.055), vec3(0.22, 0.19, 0.12), uArid * 0.8);
        vec3 c = diffuseColor.rgb;
        if (code < 0.5) c = mix(c, grass, 0.5);
        else if (code < 1.5) c = mix(vec3(0.04, 0.07, 0.03), vec3(0.06, 0.09, 0.035), n2);
        else if (code < 2.5) c = mix(vec3(0.1, 0.1, 0.055), vec3(0.17, 0.15, 0.09), n2 * uArid + 0.2);
        else if (code < 3.5) c = grass;
        else if (code < 4.5) c = mix(vec3(0.2, 0.18, 0.085), vec3(0.13, 0.16, 0.06), step(0.5, fract(n3 * 9.0)));
        else if (code < 5.5) c = mix(mix(vec3(0.19, 0.18, 0.16), vec3(0.21, 0.165, 0.12), smoothstep(0.35, 0.65, n3)), vec3(0.11, 0.14, 0.07), smoothstep(0.62, 0.8, n2) * (1.0 - uArid)) + uArid * vec3(0.05, 0.04, 0.02);
        else if (code < 6.5) c = mix(vec3(0.36, 0.3, 0.2), vec3(0.3, 0.26, 0.19), n2);
        else if (code < 7.5) c = vec3(0.8, 0.82, 0.85);
        else if (code < 8.5) c = vec3(0.13, 0.14, 0.12);
        else if (code < 9.5) c = vec3(0.07, 0.1, 0.07);
        else if (code < 10.5) c = vec3(0.04, 0.07, 0.04);
        else c = vec3(0.14, 0.14, 0.09);
        diffuseColor.rgb = c * (0.9 + 0.2 * n2); }
      diffuseColor.rgb = mix(diffuseColor.rgb, tacPal(diffuseColor.rgb) * ${locked ? '0.72' : '1.0'}, uTac);
      ${locked ? `diffuseColor.rgb = vec3(dot(diffuseColor.rgb, ${LUM})) * 0.55 + 0.04;` : ''}`);
  };
  m.customProgramCacheKey = () => 'groundLC' + locked;
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
// Regional building traditions: wall and roof palettes, and how often unmapped roofs are pitched (houses / others).
const L = (house, apts, roofPitch, roofFlat, pitchHouse, pitchOther, hip) => ({ house: pal(house), apartments: pal(apts), roofPitch: pal(roofPitch), roofFlat: pal(roofFlat), pitchHouse, pitchOther, hip });
const FLAT = [0xa8a59e, 0x9c9a93, 0x8e8d89, 0xb3ada2, 0x97958e];
export const REGION_LOOK = {
  'eu-west': { house: WALLS.house, apartments: WALLS.apartments, roofPitch: ROOF_PITCH, roofFlat: ROOF_FLAT, pitchHouse: 1, pitchOther: 1, hip: 0.4 },
  'eu-north': L([0x9e3b2e, 0xe3cf8f, 0xd9d6cc, 0x8e9a84, 0xe6e0d0], [0xd8cfc0, 0xc9c1b2, 0xb8a690, 0xe0d8c8], [0x3c3f42, 0x7a3a2c, 0x4c5055, 0x2f3236], FLAT, 1, 0.6, 0.2),
  'eu-east': L([0xe6dcc8, 0xd9c9a8, 0xe8d2c0, 0xcfd6c9], [0xd6d0c4, 0xc4c2bc, 0xe0d4bc, 0xcac6bc], [0x9a4a35, 0x5d6166, 0x7c4a3a, 0x4f6a5a], FLAT, 1, 0.5, 0.4),
  'post-soviet': L([0xd9cfb8, 0xc8b9a0, 0xb8c4c0, 0xe0d8c8], [0xcfccc4, 0xbfc4c6, 0xd8cbb6, 0xc4b8a4, 0xe2ddd2], [0x5c6b5a, 0x7a3d33, 0x6b6f72, 0x4a6a7a], FLAT, 0.9, 0.15, 0.5),
  'mediterranean': L([0xf2eee4, 0xe8d6b0, 0xd9b48a, 0xf4e9d6, 0xe6c9a0], [0xeee8dc, 0xe2d2b6, 0xd8c4a4, 0xf0e4cc], [0xb45a3a, 0xc06a45, 0xa65538], [0xd8d0c0, 0xc9c0ae, 0xbfb6a4], 0.6, 0.3, 0.4),
  'mena': L([0xd8c4a0, 0xcdb48e, 0xe8dcc6, 0xbfa682, 0xf0ebe0, 0xd4b896], [0xd8c8aa, 0xc8b28c, 0xe6dac4, 0xbca27e, 0xece4d4], [0xa8805a], [0xc9b99c, 0xb8aa90, 0xd2c4a8], 0.03, 0, 0.5),
  'subsaharan': L([0xd9c3a0, 0xc9a27e, 0xe6dccb, 0xb9cbb8, 0xd8b8a0, 0xc8b4a0], [0xd8cfc0, 0xcbbfa8, 0xe0d8c8, 0xbfc8c8], [0x8c8f91, 0x9a6b4f, 0x7d7f80, 0xa8774f, 0xb0b4b5, 0x6f5a4a], [0xa9a49a, 0x9b968c], 0.85, 0.3, 0.6),
  'south-asia': L([0xe8dcc0, 0xd9c2a5, 0xc9d6dc, 0xe6cfa8, 0xd8a888, 0xf0e6d2, 0xc7d9b8], [0xe2d8c4, 0xd4c4aa, 0xc8d0d4, 0xe0c8a4, 0xeae0cc], [0x9a5a40], [0xb3ab9c, 0x9d968a, 0xc0b6a4], 0.05, 0, 0.5),
  'east-asia': L([0xe2e0dc, 0xcfd2d4, 0xd8d0c4, 0xc8c4bc], [0xe4e2de, 0xd2d4d6, 0xc8ccd0, 0xdcd4c8], [0x5a6370, 0x3f5f7a, 0x4a4f55], [0xa8aaa8, 0x9ea2a4, 0xb2b0aa], 0.25, 0.05, 0.5),
  'japan': L([0xe6e2da, 0xcfcac0, 0xb7b1a8, 0xdcd7cc, 0xc9c3b8], [0xe2ded6, 0xd0ccc4, 0xbcb8b0, 0xd8d2c8], [0x4a4f55, 0x3a3f45, 0x4d5f73, 0x6b5b4d, 0x5a5e62], FLAT, 0.95, 0.2, 0.55),
  'southeast-asia': L([0xeee8dc, 0xe6d6b8, 0xd4e0d0, 0xe8c9a8, 0xd8e0e8], [0xe8e4dc, 0xdcd6c8, 0xd0d8d8, 0xe2d4bc], [0xa8452f, 0xc0603a, 0x46607a, 0x8a8f92, 0x9a5a3a], FLAT, 0.65, 0.15, 0.5),
  'latam': L([0xe8dcc6, 0xd99a6c, 0xe2c36a, 0x9fc2c4, 0xe6b8a8, 0xc9d8a8, 0xf0e8dc, 0xd8c8b0], [0xe4dccc, 0xd8ccb8, 0xccc4b8, 0xe8d8c0], [0xb45a3a, 0xa8553a], [0xb0a898, 0xa49c8e, 0xbcb2a0], 0.25, 0.05, 0.3),
  'north-america': L([0xe8e6e0, 0xc9c2b4, 0xa86450, 0x9aa8b0, 0xd8cfbe, 0xb8b0a0, 0x8a9a8a], [0xa86450, 0x9a5a48, 0xc8bca8, 0xb8b4ac, 0xd4ccbc], [0x55585c, 0x6b625a, 0x4a4c50, 0x5e5248], FLAT, 0.9, 0.2, 0.35),
  'oceania': L([0xe8dcc4, 0xb5735a, 0xd6cbb6, 0xc9b8a0, 0xe2e0d8], [0xd8d0c4, 0xc8c0b4, 0xb8735a], [0x8c4632, 0x5f6b6e, 0x7d8a8c, 0x4f5558, 0xa05a40], FLAT, 0.95, 0.3, 0.7),
};
export function wallColor(useName, seed, old, look) {
  if (look && look !== REGION_LOOK['eu-west'] && ['house', 'apartments', 'unknown'].includes(useName)) { const a = useName === 'house' ? look.house : look.apartments; return a[seed % a.length]; }
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

// Barriers: one instanced unit box per segment (x along the barrier 0..1, y up 0..1, z across ±0.5), sheared to follow the
// slope. Patterns are drawn from metric coordinates: posts, bars, chain-link mesh, boards, hedge foliage, masonry courses.
// see = see-through kinds (alpha patterns), otherwise solid. aK = kind code (+100 when knocked down).
const STRIPE = `float stripe(float x, float p, float w){ float f = fract(x / p); float s = step(f, w / p); float fw = fwidth(x) / p; return mix(s, w / p, clamp(fw * 2.0, 0.0, 1.0)); }`;
export function barrierMat(see) {
  const m = new THREE.MeshLambertMaterial({ transparent: see, side: see ? THREE.DoubleSide : THREE.FrontSide, depthWrite: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTac = U.uTac;
    sh.vertexShader = 'attribute float aK; varying float vK; varying vec3 vM;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vK = aK; vM = vec3(position.x * length(instanceMatrix[0].xyz), position.y * length(instanceMatrix[1].xyz), length(instanceMatrix[1].xyz));`);
    sh.fragmentShader = `uniform float uTac; varying float vK; varying vec3 vM;\n${TAC}\n${NOISE}\n${STRIPE}\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float k = mod(vK, 100.0), fallen = step(99.5, vK), x = vM.x, y = vM.y, H = vM.z;
      ${see ? `
      float post = stripe(x + 0.03, 2.5, 0.06), top = step(H - 0.05, y), bot = step(0.04, y) * step(y, 0.09), a;
      if (k < 0.5 || abs(k - 3.0) < 0.5) a = max(max(stripe(x, 0.13, 0.025), post), max(top, bot));           // fence / railing: bars
      else if (abs(k - 1.0) < 0.5) a = max(max(stripe(x + y, 0.075, 0.011), stripe(x - y, 0.075, 0.011)) * 0.95, max(post, top)); // chain-link mesh
      else if (abs(k - 4.0) < 0.5) a = max(stripe(x + 0.05, 3.0, 0.08), stripe(y + 0.1, H / 3.2, 0.012));          // wire strands
      else if (abs(k - 10.0) < 0.5) a = max(step(0.45, y) * step(y, 0.75), stripe(x + 0.05, 2.0, 0.1));         // guard rail
      else a = 1.0;
      if (a < 0.03) discard;
      diffuseColor.a = clamp(a, 0.0, 1.0);
      diffuseColor.rgb *= 0.92 + 0.12 * post;` : `
      if (abs(k - 2.0) < 0.5) { float bd = floor(x / 0.15); diffuseColor.rgb *= (0.84 + 0.22 * fract(sin(bd * 91.7) * 4375.5)) * (1.0 - 0.25 * stripe(x, 0.15, 0.012)); }   // boards
      else if (abs(k - 5.0) < 0.5) { float n = fbm(vec2(x, y) * 2.2), n2 = fbm(vec2(x, y) * 7.0 + 4.0); diffuseColor.rgb *= (0.62 + 0.55 * n) * (0.85 + 0.25 * n2) * (0.75 + 0.25 * smoothstep(0.0, 0.6, y)); } // foliage
      else { float n = fbm(vec2(x, y) * 1.3); diffuseColor.rgb *= (0.9 + 0.16 * n) * (1.0 - 0.06 * stripe(y, 0.26, 0.02)); diffuseColor.rgb *= 1.0 + 0.12 * step(H - 0.07, y); } // masonry, coping
      `}
      diffuseColor.rgb *= 1.0 - 0.3 * fallen;
      diffuseColor.rgb = mix(diffuseColor.rgb, tacPal(diffuseColor.rgb), uTac);`);
  };
  m.customProgramCacheKey = () => 'barrier' + see;
  return m;
}
export const BARRIER_LOOK = { // [colours], thickness m, see-through
  fence: [[0x3b4a40, 0x50555a, 0x2b2e30], 0.04, true], chain: [[0x2f4a36, 0x2c4433, 0x8a9091], 0.03, true], wood: [[0x7a5a3a, 0x8b7355, 0x6d6a63, 0x5e4a36], 0.06, false],
  railing: [[0x2b2e30, 0x3a4a3d, 0xd8d6cf, 0x3a3a3a], 0.04, true], wire: [[0x77736b], 0.03, true], hedge: [[0x2e4a22, 0x35512a, 0x3c5a2c, 0x2b4420], 0.75, false],
  wall: [[0xc8bfae, 0xb9b2a4, 0x9d968a, 0xb98f70], 0.25, false], muret: [[0xd6cfc0, 0xc2b8a5, 0xe0dbd0], 0.25, false], retaining: [[0x8f8b84], 0.3, false],
  jersey: [[0xa9a7a1], 0.6, false], guard: [[0xb7bcbf], 0.12, true], city_wall: [[0x9b7d68], 1.5, false],
};
