// On my photo: the body posed the way you stand in a photo and the camera put where it stood.
// A body is posed from the catalog, seen by a known camera, and its joints turned into the two
// sets of points MediaPipe gives (picture and metres, with a little noise). The fit has to land
// every joint back on its picture point, at about the right depth, from the front, the side and
// the back, close up and far away.
import assert from 'node:assert/strict';
import { createRestRig, POSE_BONES } from '../../src/pose.js';
import { catalogRotations } from '../../src/pose-catalog.js';
import { fitPhoto, restPoints, posedPoints, qrot, mirrorPoints, turnPoints, exifFocal35, focalPixels, toPhoto } from '../../src/photo-pose.js';

const rest = createRestRig({ figure: 'male', muscle: 0.5 });
const idx = Object.fromEntries(POSE_BONES.map((b, i) => [b.name, i]));
const J = (name, end = 'head') => { const k = POSE_BONES[idx[name]][end] * 3; return [rest.joints[k], rest.joints[k + 1], rest.joints[k + 2]]; };
const add = (a, b) => a.map((x, i) => x + b[i]), sub = (a, b) => a.map((x, i) => x - b[i]);
// the head's three points: a little in front of and to either side of the head bone
const hb = J('head'), side = Math.sign(J('upperarm01.L')[0] - J('upperarm01.R')[0]);
const head = { nose: add(hb, [0, 0.07, 0.1]), earL: add(hb, [0.075 * side, 0.06, 0]), earR: add(hb, [-0.075 * side, 0.06, 0]) };
const R = restPoints(rest, head);
// a person built differently from the body on screen (the photo is always of someone real)
const other = createRestRig({ figure: 'female', muscle: 0.3, weight: 0.7 });
const Jo = (name) => { const k = POSE_BONES[idx[name]].head * 3; return [other.joints[k], other.joints[k + 1], other.joints[k + 2]]; };
const hbo = Jo('head'), headO = { nose: add(hbo, [0, 0.07, 0.1]), earL: add(hbo, [0.075 * side, 0.06, 0]), earR: add(hbo, [-0.075 * side, 0.06, 0]) };
const RO = restPoints(other, headO);

let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const yawM = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const pitchM = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const mm = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
const mr = (m, p) => m.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);

function shoot(rotations, { body = null, yaw = 0, pitch = 0, dist = 3, w = 1080, h = 1440, f35 = 26, noisePx = 2, noiseM = 0.015, hideBelow = null }) {
  const Q = body ? posedPoints(other, RO, rotations) : posedPoints(rest, R, rotations);
  const G = mm(pitchM(pitch), yawM(yaw)); // body -> camera turn
  const centre = [0, 0.9, 0];
  const T = sub([0, 0, -dist], mr(G, centre));
  const f = focalPixels(w, h, f35);
  const lm2 = Array(33).fill(null), lmW = Array(33).fill(null);
  const hipMid = Q[23].map((x, i) => (x + Q[24][i]) / 2);
  for (let i = 0; i < 33; i++) {
    const p = Q[i]; if (!p) { lm2[i] = { x: 0.5, y: 0.5, visibility: 0 }; lmW[i] = { x: 0, y: 0, z: 0, visibility: 0 }; continue; }
    const c = add(mr(G, p), T), u = w / 2 + f * c[0] / -c[2] + rnd() * 2 * noisePx, v = h / 2 - f * c[1] / -c[2] + rnd() * 2 * noisePx;
    const cw = mr(G, sub(p, hipMid));
    const hidden = hideBelow != null && p[1] < hideBelow;
    lm2[i] = { x: u / w, y: v / h, visibility: hidden ? 0.05 : 0.98 };
    lmW[i] = { x: cw[0] + rnd() * noiseM, y: -cw[1] + rnd() * noiseM, z: -cw[2] + rnd() * noiseM, visibility: hidden ? 0.05 : 0.98 };
  }
  return { lm2, lmW, w, h, f35, truth: { G, T, Q } };
}

function check(name, rotations, opt, { maxPx = 12, maxDepth = 0.08 } = {}) {
  const s = shoot(rotations, opt);
  const fit = fitPhoto({ lm2: s.lm2, lmW: s.lmW, w: s.w, h: s.h, rest, head, focal35: s.f35 });
  const Q = posedPoints(rest, R, fit.rotations);
  // every point (fitted or not) lands where the true one does in the picture, and at about the
  // same depth from the middle of the hips
  let worst = 0, worstDepth = 0;
  const hipT = add(mr(s.truth.G, s.truth.Q[23]), s.truth.T)[2] / 2 + add(mr(s.truth.G, s.truth.Q[24]), s.truth.T)[2] / 2;
  const camOf = (p) => { const q = fit.camera.quaternion, d = sub(p, fit.camera.position); return qrot([-q[0], -q[1], -q[2], q[3]], d); };
  const hipF = (camOf(Q[23])[2] + camOf(Q[24])[2]) / 2;
  for (const i of Object.keys(Q)) {
    if (opt.hideBelow != null && s.truth.Q[i][1] < opt.hideBelow) continue;
    const a = toPhoto(fit.camera, Q[i], s.w, s.h), b = [s.lm2[i].x * s.w, s.lm2[i].y * s.h];
    worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1]));
    const dT = add(mr(s.truth.G, s.truth.Q[i]), s.truth.T)[2] - hipT, dF = camOf(Q[i])[2] - hipF;
    if (process.env.PP_DEBUG && Math.abs(dT - dF) > 0.06) console.log("  point", i, ((dT - dF) * 100).toFixed(1), "cm");
    worstDepth = Math.max(worstDepth, Math.abs(dT - dF));
  }
  console.log(`${name.padEnd(34)} mean ${fit.error.toFixed(1)} px, worst ${worst.toFixed(1)} px, depth ${(worstDepth * 100).toFixed(1)} cm, ${fit.view}`);
  assert.ok(fit.error < maxPx * 0.6, `${name}: mean error ${fit.error}`);
  assert.ok(worst < maxPx, `${name}: worst point ${worst} px`);
  assert.ok(worstDepth < maxDepth, `${name}: depth off by ${worstDepth}`);
  return fit;
}

const poses = ['neutral', 'relaxedSides', 'straightOut', 'raisedBoth', 'doubleBiceps', 'reachForward', 'leftForward', 'rightBehind', 'twist', 'kneeLeft', 'stride'];
for (const p of poses) check(p + ' from the front', catalogRotations(p, rest), { yaw: 0.15 * rnd() });
for (const p of ['neutral', 'leftBiceps', 'reachForward']) check(p + ' turned 50 degrees', catalogRotations(p, rest), { yaw: 0.87 });
for (const p of ['neutral', 'rightLateral']) check(p + ' from the back', catalogRotations(p, rest), { yaw: Math.PI + 0.2 });
check('neutral from above, close', catalogRotations('neutral', rest), { yaw: -0.3, pitch: 0.25, dist: 2.2 });
check('relaxed, far, wide lens', catalogRotations('relaxedSides', rest), { dist: 5, f35: 24 });
for (const p of ['hinge', 'squat', 'seated']) check(p + ' from the side', catalogRotations(p, rest), { yaw: 1.2 }, { maxPx: 16, maxDepth: 0.12 });
const half = check('upper body only', catalogRotations('doubleBiceps', rest), { dist: 1.6, hideBelow: 0.75 }, { maxPx: 14, maxDepth: 0.1 });
assert.equal(half.view, 'front');
for (const p of ['neutral', 'doubleBiceps', 'leftForward', 'stride']) check(p + ', someone built differently', catalogRotations(p, other), { body: 'other', yaw: 0.4 * rnd() }, { maxPx: 22, maxDepth: 0.1 });
const back = shoot(catalogRotations('neutral', rest), { yaw: Math.PI });
assert.equal(fitPhoto({ ...back, rest, head }).view, 'back');

// mirrored and turned points are their own inverse
const s = shoot(catalogRotations('leftForward', rest), {});
const m2 = mirrorPoints(...Object.values(mirrorPoints(s.lm2, s.lmW)));
assert.deepEqual(m2.lm2[13], s.lm2[13]); assert.deepEqual(m2.lmW[15], s.lmW[15]);
const t2 = turnPoints(...Object.values(turnPoints(s.lm2, s.lmW)));
assert.deepEqual(t2.lmW[25], s.lmW[25]);

// too little of a person is refused in plain words
assert.throws(() => fitPhoto({ lm2: Array(33).fill({ x: 0.5, y: 0.5, visibility: 0 }), lmW: Array(33).fill({ x: 0, y: 0, z: 0 }), w: 100, h: 100, rest }), /shoulders and hips/);

// a JPEG's 35 mm focal length
const jpeg = (() => {
  const le = true, t = new DataView(new ArrayBuffer(64));
  t.setUint16(0, 0x4949); t.setUint16(2, 42, le); t.setUint32(4, 8, le);
  t.setUint16(8, 1, le); t.setUint16(10, 0x8769, le); t.setUint16(12, 4, le); t.setUint32(14, 1, le); t.setUint32(18, 26, le); t.setUint32(22, 0, le);
  t.setUint16(26, 1, le); t.setUint16(28, 0xa405, le); t.setUint16(30, 3, le); t.setUint32(32, 1, le); t.setUint16(36, 28, le); t.setUint32(40, 0, le);
  const tiff = new Uint8Array(t.buffer, 0, 44), out = new Uint8Array(2 + 4 + 6 + tiff.length + 2), v = new DataView(out.buffer);
  v.setUint16(0, 0xffd8); v.setUint16(2, 0xffe1); v.setUint16(4, 2 + 6 + tiff.length); out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6); out.set(tiff, 12); v.setUint16(12 + tiff.length, 0xffd9);
  return out.buffer;
})();
assert.equal(exifFocal35(jpeg), 28);
assert.equal(exifFocal35(new Uint8Array([1, 2, 3, 4]).buffer), null);
console.log('photo-pose-unit ok');
