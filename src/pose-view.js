// Poses in the main view. The body and its ink are skinned on the CPU from the
// MakeHuman rig (pose.js) into separate "posed" geometries that are swapped in only
// while drawing and while hit testing what the finger touches. Everything else in the
// app (anchors, decal building, saves, exports) keeps working on the rest body, so a
// pose never changes the project and ink placed in a pose lands on the same skin.
import { createRestRig, skinPose } from './pose.js';
import { createSkin, updateSkin } from './skin.js';
import { POSE_CATALOG, catalogRotations, MOTION_CATALOG, catalogMotionRotations } from './pose-catalog.js';

const IDENTITY = [0, 0, 0, 1];
const DECAL_LIFT = 0.0004; // same lift off the skin as decal.js

// Blend two rotation sets (bone -> quaternion). t = 0 gives a, 1 gives b.
export function blendRotations(a, b, t) {
  const out = {};
  for (const name of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const p = (a && a[name]) || IDENTITY, q0 = (b && b[name]) || IDENTITY;
    const s = p[0] * q0[0] + p[1] * q0[1] + p[2] * q0[2] + p[3] * q0[3] < 0 ? -1 : 1;
    const q = p.map((v, i) => v * (1 - t) + q0[i] * s * t), n = Math.hypot(...q) || 1;
    out[name] = q.map((v) => v / n);
  }
  return out;
}
const isNeutral = (r) => !r || Object.values(r).every((q) => Math.abs(q[3]) > 1 - 1e-9);

// Posed positions of a decal: each vertex sits on its body vertex, lifted along the
// posed normal, so ink stays on the skin through any bend. UVs never change.
export function posedDecalPositions(P, N, supports) {
  const out = new Float32Array(supports.length * 3);
  for (let i = 0; i < supports.length; i++) {
    const v = supports[i] * 3;
    for (let a = 0; a < 3; a++) out[i * 3 + a] = P[v + a] + DECAL_LIFT * N[v + a];
  }
  return out;
}

export function createPoseView({ THREE, bodyMesh, bodyGeo, skinMat, state, areola, onChange }) {
  const geo = new THREE.BufferGeometry();
  const len = bodyGeo.attributes.position.array.length;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(len), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(len), 3));
  geo.setIndex(bodyGeo.index);
  const { mat, uniforms } = createSkin(geo, skinMat.color.clone());

  let target = null;          // rotations being shown (after any blend), null = standing
  let key = 'neutral';         // catalog key of the chosen still, or 'motion' / 'custom'
  let version = 0, built = -1, rig = null, rigFor = null;
  let blend = null, blendTimer = 0;
  const motion = { kind: 'elbow', playing: false, speed: 1, phase: 0, timer: 0, last: 0 };

  const changed = () => { version++; onChange && onChange(); };
  function show(rotations) { target = isNeutral(rotations) ? null : rotations; changed(); }
  function setRotations(rotations, { animate = true } = {}) {
    clearTimeout(blendTimer); blend = null;
    const from = target;
    if (!animate || (isNeutral(from) && isNeutral(rotations))) { show(rotations); return; }
    blend = { from: from || {}, to: rotations || {}, start: performance.now(), ms: 280 };
    const step = () => {
      if (!blend) return;
      const t = Math.min(1, (performance.now() - blend.start) / blend.ms), e = t * t * (3 - 2 * t);
      show(t >= 1 ? blend.to : blendRotations(blend.from, blend.to, e));
      if (t < 1) blendTimer = setTimeout(step, 33); else blend = null;
    };
    step();
  }

  function rest() {
    const shapeKey = JSON.stringify([state().figure, state().muscle, state().weight, state().fit || {}]);
    if (rigFor !== shapeKey) { rig = createRestRig(state()); rigFor = shapeKey; }
    return { positions: bodyGeo.attributes.position.array, joints: rig.joints };
  }
  // Bring the posed body up to date. Cheap when nothing changed.
  function ensure() {
    if (!target || built === version) return;
    const posed = skinPose(rest(), target).positions;
    geo.attributes.position.array.set(posed); geo.attributes.position.needsUpdate = true;
    if (geo.index !== bodyGeo.index) geo.setIndex(bodyGeo.index);
    geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
    updateSkin(geo, uniforms, areola());
    built = version;
  }
  function decalGeometry(restGeo) {
    let p = restGeo.userData.posed;
    if (!p) {
      const g = new THREE.BufferGeometry();
      const n = restGeo.attributes.position.count;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      if (restGeo.attributes.uv) g.setAttribute('uv', restGeo.attributes.uv);
      p = restGeo.userData.posed = { geo: g, v: -1 };
      restGeo.addEventListener('dispose', () => g.dispose());
    }
    if (p.v !== version && restGeo.userData.supports) {
      p.geo.attributes.position.array.set(posedDecalPositions(geo.attributes.position.array, geo.attributes.normal.array, restGeo.userData.supports));
      p.geo.attributes.position.needsUpdate = true; p.geo.computeBoundingSphere(); p.geo.computeBoundingBox(); p.v = version;
    }
    return p.geo;
  }
  // Run fn with the posed body (and, if given, posed ink) swapped into the meshes.
  function withPosed(fn, inkMeshes = []) {
    if (!target) return fn();
    ensure(); mat.color.copy(skinMat.color);
    const swaps = [[bodyMesh, bodyMesh.geometry, bodyMesh.material]];
    bodyMesh.geometry = geo; bodyMesh.material = mat;
    for (const m of inkMeshes) if (m && m.geometry && m.geometry.userData.supports) { swaps.push([m, m.geometry, m.material]); m.geometry = decalGeometry(m.geometry); }
    try { return fn(); } finally { for (const [m, g, mt] of swaps) { m.geometry = g; m.material = mt; } }
  }
  // Where a point on the rest body (triangle + barycentric weights) is in the pose.
  function pointOn(tri, w) {
    const I = bodyGeo.index.array, ids = [I[tri * 3], I[tri * 3 + 1], I[tri * 3 + 2]];
    const P = target ? (ensure(), geo.attributes.position.array) : bodyGeo.attributes.position.array;
    const N = target ? geo.attributes.normal.array : bodyGeo.attributes.normal.array;
    const pos = [0, 0, 0], nor = [0, 0, 0];
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { pos[j] += P[ids[k] * 3 + j] * w[k]; nor[j] += N[ids[k] * 3 + j] * w[k]; }
    const l = Math.hypot(...nor) || 1;
    return { pos, normal: nor.map((v) => v / l) };
  }

  /* ---------- stills and motion ---------- */
  function choose(k) {
    stop();
    if (!POSE_CATALOG[k]) throw new Error('Unknown pose');
    key = k; setRotations(k === 'neutral' ? null : catalogRotations(k));
  }
  function frame() { show(catalogMotionRotations(motion.kind, motion.phase)); }
  function play(kind = motion.kind) {
    if (!MOTION_CATALOG[kind]) throw new Error('Unknown motion');
    clearTimeout(blendTimer); blend = null;
    if (kind !== motion.kind) motion.phase = 0;
    motion.kind = kind; motion.playing = true; key = 'motion'; motion.last = performance.now();
    clearTimeout(motion.timer);
    const tick = () => {
      if (!motion.playing) return;
      if (document.hidden) { pause(); return; }
      const now = performance.now();
      motion.phase = (motion.phase + (now - motion.last) / (MOTION_CATALOG[motion.kind].duration * 1000) * motion.speed) % 1;
      motion.last = now; frame();
      motion.timer = setTimeout(tick, 50); // at most 20 body updates a second
    };
    tick();
  }
  function pause() { if (!motion.playing) return; motion.playing = false; clearTimeout(motion.timer); onChange && onChange(); }
  function stop() { motion.playing = false; clearTimeout(motion.timer); }
  function scrub(phase, kind = motion.kind) {
    stop(); clearTimeout(blendTimer); blend = null;
    if (!MOTION_CATALOG[kind]) throw new Error('Unknown motion');
    motion.kind = kind; motion.phase = Math.min(1, Math.max(0, phase)); key = 'motion'; frame();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  return {
    get active() { return !!target; },
    get key() { return key; },
    get motion() { return { kind: motion.kind, playing: motion.playing, speed: motion.speed, phase: motion.phase }; },
    get version() { return version; },
    set speed(v) { motion.speed = v; },
    invalidate() { if (target) changed(); else version++; },
    choose, play, pause, scrub,
    setCustom(rotations, opts) { stop(); key = 'custom'; setRotations(rotations, opts); },
    reset() { stop(); key = 'neutral'; setRotations(null); },
    withPosed, pointOn, ensure,
    settled: () => !blend,
    geometry: geo,
  };
}
