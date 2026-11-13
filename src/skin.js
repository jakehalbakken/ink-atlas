// Skin material and the anatomical detail painted on top of the plain skin tone:
// eyes that look like eyes, lips, areolae and nipples, the navel, and soft
// shading in creases so muscle and bone read as form instead of a smooth mannequin.
// Detail is positioned from landmark vertices, so it follows every shape change.
import * as THREE from 'three';
import { COUNTS, MARKS, EYES, LIPS_MASK } from './mesh.js';
import { createRestRig, POSE_BONES } from './pose.js';

const MUSCLE_GLSL = `
uniform vec3 uDef;
float mg(float d, float s) { return exp(-d * d / (s * s)); }
float segD(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * t); }
// Muscle definition as a height field in body units, from the navel and nipples, so it follows
// every shape. x: height (positive = bulge). y: how deep in a groove (0..1), for shading.
// Arms and legs: each limb is a segment between two joints of the skeleton (left side; the right
// is its mirror). s: x = how far along (0 at the top joint), y = angle around it (0 = front,
// +pi/2 = the outside), z = distance from the bone, w = segment length.
uniform vec3 uLimb[5];
uniform float uLimbDef;
vec4 limbSeg(vec3 q, vec3 a, vec3 b) {
  vec3 d = b - a; float L = length(d); d /= L;
  vec3 w = q - a; float along = dot(w, d); vec3 r = w - d * along;
  vec3 o = normalize(vec3(1.0, 0.0, 0.0) - d * d.x), f = normalize(cross(d, o));
  return vec4(along / L, atan(dot(r, o), dot(r, f)), length(r), L);
}
// one muscle: a soft lump at (t, angle), sized in body units along the limb and around it
float lump(vec4 s, float t, float ang, float sl, float sa) {
  float da = abs(mod(s.y - ang + 3.14159265, 6.2831853) - 3.14159265);
  return mg((s.x - t) * s.w, sl) * mg(da * max(s.z, 0.02), sa);
}
// cheap test first: is q anywhere near the segment a-b (within r of it)?
bool nearSeg(vec3 q, vec3 a, vec3 b, float r) { vec3 m = 0.5 * (a + b); float R = 0.5 * length(b - a) + r; vec3 d = q - m; return dot(d, d) < R * R; }
vec2 limbH(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float h = 0.0, cr = 0.0;
  // upper arm, shoulder to elbow: the deltoid cap with its front and rear heads, the biceps in
  // front, the triceps behind, and the groove down the outside between them
  vec4 a = nearSeg(q, uLimb[0], uLimb[1], 0.09) ? limbSeg(q, uLimb[0], uLimb[1]) : vec4(-1.0, 0.0, 1.0, 1.0);
  float am = smoothstep(0.085, 0.06, a.z) * smoothstep(-0.12, 0.02, a.x) * smoothstep(1.08, 0.95, a.x);
  if (am > 0.001) {
    float delt = lump(a, 0.16, 1.35, 0.05, 0.03) + 0.65 * lump(a, 0.15, 0.55, 0.045, 0.022) + 0.55 * lump(a, 0.16, 2.3, 0.045, 0.025);
    float bic = lump(a, 0.58, 0.05, 0.06, 0.022), tri = 0.7 * lump(a, 0.45, 3.14159, 0.07, 0.028) + 0.45 * lump(a, 0.5, 2.3, 0.05, 0.02);
    float edge = lump(a, 0.44, 1.35, 0.022, 0.03), side = lump(a, 0.72, 1.45, 0.07, 0.01);
    h += am * (delt + bic + tri - 0.55 * edge - 0.45 * side);
    cr += am * (0.45 * edge + 0.35 * side);
  }
  // thigh, hip to knee: the outer and front quads, the teardrop above the knee on the inside,
  // the groove down the outside, and the kneecap
  vec4 t = nearSeg(q, uLimb[2], uLimb[3], 0.16) ? limbSeg(q, uLimb[2], uLimb[3]) : vec4(-1.0, 0.0, 1.0, 1.0);
  float tm = smoothstep(0.15, 0.11, t.z) * smoothstep(0.12, 0.3, t.x) * smoothstep(1.12, 1.02, t.x);
  if (tm > 0.001) {
    float quad = 0.7 * lump(t, 0.55, 1.0, 0.12, 0.035) + 0.5 * lump(t, 0.45, 0.1, 0.12, 0.03) + lump(t, 0.84, -0.75, 0.055, 0.028);
    float it = lump(t, 0.62, 1.75, 0.13, 0.012), cap = lump(t, 1.02, 0.0, 0.028, 0.025), capRim = lump(t, 0.95, 0.0, 0.012, 0.03);
    h += tm * (quad - 0.45 * it + 0.6 * cap - 0.4 * capRim);
    cr += tm * (0.35 * it + 0.3 * capRim);
  }
  // lower leg, knee to ankle: the two heads of the calf with the groove between them, and the
  // muscle beside the shin bone
  vec4 c = nearSeg(q, uLimb[3], uLimb[4], 0.11) ? limbSeg(q, uLimb[3], uLimb[4]) : vec4(-1.0, 0.0, 1.0, 1.0);
  float cm = smoothstep(0.1, 0.075, c.z) * smoothstep(0.03, 0.12, c.x) * smoothstep(0.98, 0.85, c.x);
  if (cm > 0.001) {
    float calf = lump(c, 0.3, -2.55, 0.08, 0.028) + 0.8 * lump(c, 0.26, 2.55, 0.07, 0.026);
    float split = lump(c, 0.3, 3.14159, 0.09, 0.009), tib = 0.5 * lump(c, 0.36, 0.55, 0.12, 0.016), shin = lump(c, 0.45, -0.1, 0.16, 0.008);
    h += cm * (calf - 0.5 * split + tib - 0.3 * shin);
    cr += cm * (0.35 * split + 0.2 * shin);
  }
  return vec2(h * 2.6 * uLimbDef, cr * uLimbDef);
}
vec2 muscleH(vec3 p) {
  vec2 lh = uLimbDef > 0.001 ? limbH(p) : vec2(0.0);
  if (uDef.x + uDef.y < 0.001) return vec2(lh.x * 0.0055, clamp(lh.y, 0.0, 1.0));
  float nipY = 0.5 * (uNipL.y + uNipR.y), hw = max(0.5 * abs(uNipL.x - uNipR.x), 0.05);
  float L = max(nipY - uNavel.y, 0.08), W = hw * 0.8, ax = abs(p.x);
  float u = ax / W, v = (p.y - uNavel.y) / L;
  float torso = smoothstep(2.1 * hw, 1.7 * hw, ax);
  float front = smoothstep(uNavel.z - 0.085, uNavel.z - 0.035, p.z) * torso;
  float back = smoothstep(uNavel.z - 0.13, uNavel.z - 0.17, p.z) * torso;
  float h = 0.0, crease = 0.0;
  if (front > 0.001 && v > -1.25 && v < 1.9) {
    // six-pack: the rectus narrows towards the pubis and its top curves up to the ribs
    float edgeU = (1.0 + 0.12 * clamp(v, 0.0, 1.0)) - 0.36 * clamp(-v, 0.0, 1.0), topV = 0.72 + 0.2 * u * u;
    float inRect = smoothstep(edgeU + 0.2, edgeU - 0.1, u) * smoothstep(-1.05, -0.6, v) * smoothstep(topV + 0.2, topV - 0.05, v);
    float alba = mg(ax, 0.0085) * smoothstep(-0.35, 0.05, v) * smoothstep(0.95, 0.7, v) * 0.6;
    float male = 0.3 + 0.7 * uDef.z;
    // six rounded blocks above the navel and one long soft one below it, each a pillow
    float bumps = 0.0;
    vec4 rows[4];
    rows[0] = vec4(0.775, 0.115, 0.92, 0.85); // centre v, half height, width scale, strength
    rows[1] = vec4(0.505, 0.135, 1.0, 1.0);
    rows[2] = vec4(0.215, 0.145, 1.0, 1.0);
    rows[3] = vec4(-0.42, 0.42, 0.9, 0.55);
    for (int i = 0; i < 4; i++) {
      vec4 r = rows[i];
      float tilt = (i < 3) ? 0.05 * u * u : 0.0;
      float hu = 0.55 * edgeU * r.z, uc = 0.05 + hu;
      float du = (u - uc) / hu, dv = (v - r.x - tilt) / r.y;
      float k = pow(pow(abs(du), 3.0) + pow(abs(dv), 3.0), 1.0 / 3.0);
      float b = (1.0 - smoothstep(0.35, 1.15, k)) * r.w;
      if (i < 3) b = mix(r.w * (1.0 - smoothstep(0.3, 1.2, length(vec2(du, dv)))) * 0.6, b, male);
      bumps = max(bumps, b);
    }
    float groove = max(alba, inRect * (1.0 - bumps) * smoothstep(edgeU * 0.98, edgeU * 0.62, u));
    float semi = 0.7 * mg(u - edgeU, 0.12) * smoothstep(-0.6, -0.3, v) * smoothstep(0.85, 0.55, v);
    float vline = mg(segD(vec2(ax, v * L), vec2(1.75 * W, -0.15 * L), vec2(0.5 * W, -1.05 * L)), 0.015) * 0.85;
    // lower border of the chest and the groove between the pecs
    float px = ax / hw, vb = 0.86 + 0.10 * max(0.0, px - 0.9) * max(0.0, px - 0.9) * 4.0;
    float pec = smoothstep(vb - 0.03, vb + 0.10, v) * smoothstep(1.75, 1.35, px) * smoothstep(1.8, 1.4, v);
    float sternal = mg(ax, 0.008) * smoothstep(0.75, 0.95, v) * smoothstep(1.7, 1.4, v);
    float underPec = mg(v - vb, 0.05) * smoothstep(1.65, 1.2, px) * smoothstep(0.15, 0.4, px);
    float ab = inRect * (0.35 + 0.65 * bumps) - 0.6 * alba - 0.4 * semi - 0.6 * vline;
    float ch = (0.75 * pec - 0.6 * sternal) * uDef.z;
    h += front * (uDef.x * ab + uDef.x * ch * 0.8);
    crease += front * uDef.x * (0.55 * groove * smoothstep(-0.7, -0.2, v) + 0.35 * semi + 0.45 * vline + 0.5 * underPec * uDef.z + 0.3 * sternal * uDef.z);
  }
  if (back > 0.001 && v > -1.3 && v < 2.4) {
    // the groove of the spine between the long back muscles, and the two dimples low on the back
    float span = smoothstep(-0.75, -0.35, v) * smoothstep(1.9, 1.45, v);
    float spine = 0.75 * mg(ax, 0.012) * span, erect = mg(ax - 0.026, 0.016) * smoothstep(-1.0, -0.6, v) * smoothstep(1.2, 0.6, v);
    float dimple = mg(length(vec2(ax - 0.042, (v + 0.45) * L)), 0.011);
    float blade = mg(ax - 1.05 * hw, 0.03) * smoothstep(1.1, 1.4, v) * smoothstep(2.1, 1.7, v);
    h += back * uDef.y * (0.8 * erect - spine - 0.8 * dimple - 0.3 * blade);
    crease += back * uDef.y * (0.45 * spine + 0.35 * dimple + 0.2 * blade);
  }
  return vec2((h + lh.x) * 0.0055, clamp(crease + lh.y, 0.0, 1.0));
}
`;

// The left shoulder, elbow, hip, knee and ankle from the body's own skeleton, for the limb
// muscles. Kept for the last shape asked, since a slider drag asks many times a second.
let jointsFor = null, jointsAt = null;
export function limbJoints(shape) {
  const key = JSON.stringify([shape.figure, shape.muscle, shape.weight, shape.fit || {}]);
  if (key === jointsFor) return jointsAt;
  let out = null;
  try {
    const { joints } = createRestRig(shape);
    const at = (name, end) => { const b = POSE_BONES.find((x) => x.name === name); if (!b) return null; const i = b[end] * 3; return [joints[i], joints[i + 1], joints[i + 2]]; };
    out = [at('upperarm01.L', 'head'), at('lowerarm01.L', 'head'), at('upperleg01.L', 'head'), at('lowerleg01.L', 'head'), at('lowerleg02.L', 'tail')];
    if (out.some((v) => !v || v.some((x) => !Number.isFinite(x)))) out = null;
  } catch { out = null; }
  jointsFor = key; jointsAt = out; return out;
}

// How strongly muscle shows through the skin: front (abs), back, and chest (less where there are
// breasts). More muscle shows more, more body fat hides it, and the Abs and Back sliders add to it.
export function definition(shape = {}) {
  const c = (v, a, b) => Math.max(a, Math.min(b, v));
  const mus = Number.isFinite(shape.muscle) ? shape.muscle : 0.5, wt = Number.isFinite(shape.weight) ? shape.weight : 0.5, fit = shape.fit || {};
  const fem = shape.figure === 'female' ? 1 : shape.figure === 'male' || !shape.figure ? 0 : 0.5;
  const lean = c(1.25 - 1.3 * (wt - 0.3), 0, 1), base = c(0.55 + 1.2 * (mus - 0.5), 0.12, 1.15) * lean * (1 - 0.6 * fem);
  const front = c(base * (1 + 0.9 * (+fit.abs || 0)), 0, 1.3), back = c(base * (1 + 0.9 * (+fit.back || 0)), 0, 1.3);
  const limbs = c(c(0.55 + 1.2 * (mus - 0.5), 0.12, 1.15) * lean * (1 - 0.45 * fem), 0, 1.2);
  return { front, back, chest: c(1 - 0.85 * fem, 0, 1), limbs };
}

export function createSkin(geo, color) {
  const n = geo.attributes.position.count;
  const part = new Float32Array(n), lip = new Float32Array(n);
  for (const k of ['l', 'r']) for (let i = EYES[k][0]; i < EYES[k][0] + EYES[k][1]; i++) part[i] = 1;
  for (let i = 0; i < n; i++) lip[i] = LIPS_MASK[i] / 255;
  geo.setAttribute('part', new THREE.BufferAttribute(part, 1));
  geo.setAttribute('lip', new THREE.BufferAttribute(lip, 1));
  geo.setAttribute('cav', new THREE.BufferAttribute(new Float32Array(n), 1));
  const V = () => ({ value: new THREE.Vector3() });
  const uniforms = { uEyeL: V(), uEyeR: V(), uNipL: V(), uNipR: V(), uNavel: V(), uAreolaR: { value: 0.016 }, uIris: { value: new THREE.Color('#4a3524') }, uDef: { value: new THREE.Vector3(0.38, 0.38, 1) }, uLimb: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector3()) }, uLimbDef: { value: 0 } };
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.54, metalness: 0, specularIntensity: 0.45, sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffd9c8') });
  // A posed body keeps its standing positions in 'rest', so painted detail stays on the same
  // skin when the body bends; a standing body paints straight from its positions.
  const rest = !!geo.attributes.rest;
  if (rest) mat.defines = { USE_REST: '' };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float part;\nattribute float lip;\nattribute float cav;\n#ifdef USE_REST\nattribute vec3 rest;\n#endif\nvarying float vPart;\nvarying float vLip;\nvarying float vCav;\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = part; vLip = lip; vCav = cav;\n#ifdef USE_REST\nvObj = rest;\n#else\nvObj = position;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uEyeL;\nuniform vec3 uEyeR;\nuniform vec3 uNipL;\nuniform vec3 uNipR;\nuniform vec3 uNavel;\nuniform float uAreolaR;\nuniform vec3 uIris;\nvarying float vPart;\nvarying float vLip;\nvarying float vCav;\nvarying vec3 vObj;\n' + MUSCLE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 mhAll = muscleH(vObj); // once per pixel: shading here, the bump below
  {
    vec3 skin = diffuseColor.rgb;
    float crease = smoothstep(0.0, 1.0, vCav), ridge = smoothstep(0.0, 1.0, -vCav);
    skin *= mix(vec3(1.0), vec3(0.60, 0.47, 0.45), crease * 0.8);
    skin *= 1.0 + 0.07 * ridge;
    vec2 mh = mhAll;
    skin *= mix(vec3(1.0), vec3(0.82, 0.72, 0.70), mh.y * 0.4);
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
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    float hb = mhAll.x;
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection;
    vec3 grad = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
    normal = normalize(abs(det) * normal - grad);
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (vPart > 0.5) roughnessFactor = 0.1;');
  };
  return { mat, uniforms };
}

let acc = null, cnt = null, elen = null;
const CAVITY_GAIN = 4;
// Call after positions and normals change. `areola` is the areola radius in model units.
export function updateSkin(geo, uniforms, areola, shape) {
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
  const R = geo.attributes.rest ? geo.attributes.rest.array : P;
  const at = (i, target) => target.set(R[i * 3], R[i * 3 + 1], R[i * 3 + 2]);
  at(MARKS.nipL, uniforms.uNipL.value); at(MARKS.nipR, uniforms.uNipR.value); at(MARKS.navel, uniforms.uNavel.value);
  for (const [k, u] of [['l', uniforms.uEyeL], ['r', uniforms.uEyeR]]) {
    let x = 0, y = 0, z = 0; const [s, c] = EYES[k];
    for (let i = s; i < s + c; i++) { x += R[i * 3]; y += R[i * 3 + 1]; z += R[i * 3 + 2]; }
    u.value.set(x / c, y / c, z / c);
  }
  uniforms.uAreolaR.value = areola;
  if (shape) {
    const d = definition(shape); uniforms.uDef.value.set(d.front, d.back, d.chest);
    const j = limbJoints(shape);
    if (j) { j.forEach((v, i) => uniforms.uLimb.value[i].set(v[0], v[1], v[2])); uniforms.uLimbDef.value = d.limbs; } else uniforms.uLimbDef.value = 0;
  }
}
