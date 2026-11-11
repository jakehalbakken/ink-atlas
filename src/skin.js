// Skin material and the anatomical detail painted on top of the plain skin tone:
// eyes that look like eyes, lips, areolae and nipples, the navel, and soft
// shading in creases so muscle and bone read as form instead of a smooth mannequin.
// Detail is positioned from landmark vertices, so it follows every shape change.
import * as THREE from 'three';
import { COUNTS, MARKS, EYES, LIPS_MASK } from './mesh.js';

export function createSkin(geo, color) {
  const n = geo.attributes.position.count;
  const part = new Float32Array(n), lip = new Float32Array(n);
  for (const k of ['l', 'r']) for (let i = EYES[k][0]; i < EYES[k][0] + EYES[k][1]; i++) part[i] = 1;
  for (let i = 0; i < n; i++) lip[i] = LIPS_MASK[i] / 255;
  geo.setAttribute('part', new THREE.BufferAttribute(part, 1));
  geo.setAttribute('lip', new THREE.BufferAttribute(lip, 1));
  geo.setAttribute('cav', new THREE.BufferAttribute(new Float32Array(n), 1));
  const V = () => ({ value: new THREE.Vector3() });
  const uniforms = { uEyeL: V(), uEyeR: V(), uNipL: V(), uNipR: V(), uNavel: V(), uAreolaR: { value: 0.016 }, uIris: { value: new THREE.Color('#4a3524') } };
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.54, metalness: 0, specularIntensity: 0.45, sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffd9c8') });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float part;\nattribute float lip;\nattribute float cav;\nvarying float vPart;\nvarying float vLip;\nvarying float vCav;\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = part; vLip = lip; vCav = cav; vObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uEyeL;\nuniform vec3 uEyeR;\nuniform vec3 uNipL;\nuniform vec3 uNipR;\nuniform vec3 uNavel;\nuniform float uAreolaR;\nuniform vec3 uIris;\nvarying float vPart;\nvarying float vLip;\nvarying float vCav;\nvarying vec3 vObj;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 skin = diffuseColor.rgb;
    float crease = smoothstep(0.0, 1.0, vCav), ridge = smoothstep(0.0, 1.0, -vCav);
    skin *= mix(vec3(1.0), vec3(0.60, 0.47, 0.45), crease * 0.8);
    skin *= 1.0 + 0.07 * ridge;
    skin = mix(skin, skin * vec3(0.88, 0.58, 0.58), smoothstep(0.55, 0.9, vLip) * 0.75);
    float dn = min(distance(vObj, uNipL), distance(vObj, uNipR));
    skin = mix(skin, skin * vec3(0.74, 0.50, 0.48), (1.0 - smoothstep(uAreolaR * 0.78, uAreolaR, dn)) * 0.85);
    skin = mix(skin, skin * vec3(0.62, 0.42, 0.42), (1.0 - smoothstep(uAreolaR * 0.2, uAreolaR * 0.36, dn)) * 0.6);
    skin *= 1.0 - 0.4 * (1.0 - smoothstep(0.003, 0.013, distance(vObj, uNavel)));
    if (vPart > 0.5) {
      vec3 c = vObj.x > 0.0 ? uEyeL : uEyeR;
      float f = normalize(vObj - c).z;
      skin = vec3(0.86, 0.85, 0.83);
      skin = mix(skin, uIris, smoothstep(0.800, 0.830, f));
      skin = mix(skin, uIris * 1.9, smoothstep(0.86, 0.93, f) * 0.5);
      skin = mix(skin, vec3(0.015), smoothstep(0.945, 0.962, f));
    }
    diffuseColor.rgb = skin;
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (vPart > 0.5) roughnessFactor = 0.1;');
  };
  return { mat, uniforms };
}

let acc = null, cnt = null, elen = null;
const CAVITY_GAIN = 4;
// Call after positions and normals change. `areola` is the areola radius in model units.
export function updateSkin(geo, uniforms, areola) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, I = geo.index.array, cav = geo.attributes.cav.array, n = P.length / 3;
  if (!acc || acc.length !== P.length) { acc = new Float32Array(P.length); cnt = new Float32Array(n); elen = new Float32Array(n); }
  acc.fill(0); cnt.fill(0); elen.fill(0); cav.fill(0);
  // Uniform Laplacian: how far each vertex sits below (crease) or above (ridge) its
  // neighbours, divided by the local edge length so dense and coarse areas match.
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    for (let j = 0; j < 3; j++) { const pa = P[a + j], pb = P[b + j], pc = P[c + j]; acc[a + j] += pb + pc; acc[b + j] += pa + pc; acc[c + j] += pa + pb; }
    const ab = Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]), bc = Math.hypot(P[b] - P[c], P[b + 1] - P[c + 1], P[b + 2] - P[c + 2]), ca = Math.hypot(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]);
    elen[a / 3] += ab + ca; elen[b / 3] += ab + bc; elen[c / 3] += bc + ca;
    cnt[a / 3] += 2; cnt[b / 3] += 2; cnt[c / 3] += 2;
  }
  const eyeFrom = COUNTS.body, eyeTo = COUNTS.body + COUNTS.eyes;
  for (let v = 0; v < n; v++) {
    const k = cnt[v]; if (!k || (v >= eyeFrom && v < eyeTo)) continue;
    const o = v * 3, lx = acc[o] / k - P[o], ly = acc[o + 1] / k - P[o + 1], lz = acc[o + 2] / k - P[o + 2];
    const edge = Math.max(1e-5, elen[v] / k);
    cav[v] = Math.max(-1, Math.min(1, ((lx * N[o] + ly * N[o + 1] + lz * N[o + 2]) / edge) * CAVITY_GAIN));
  }
  geo.attributes.cav.needsUpdate = true;
  const at = (i, target) => target.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  at(MARKS.nipL, uniforms.uNipL.value); at(MARKS.nipR, uniforms.uNipR.value); at(MARKS.navel, uniforms.uNavel.value);
  for (const [k, u] of [['l', uniforms.uEyeL], ['r', uniforms.uEyeR]]) {
    let x = 0, y = 0, z = 0; const [s, c] = EYES[k];
    for (let i = s; i < s + c; i++) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; }
    u.value.set(x / c, y / c, z / c);
  }
  uniforms.uAreolaR.value = areola;
}
