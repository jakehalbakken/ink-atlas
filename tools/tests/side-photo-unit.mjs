// Match photos of me from the side: the 3D body's own outline, seen side on from far away, is read
// by the same code as a photo (measurePhoto), and gives back the body's depth at the chest, belly
// and seat (measureBody), so a side photo can shape how deep the body is front to back. A body
// made deeper, rounder in the belly and flatter in the seat is found again from a standard one,
// only the three depth sliders move, and the widths a front photo set are kept.
import assert from 'node:assert/strict';
import { shapePositions, INDEX, COUNTS } from '../../src/mesh.js';
import { createRestRig, POSE_BONES, boneWeightSum } from '../../src/pose.js';
import { measurePhoto, LM, SIDE_KEYS } from '../../src/body-photo.js';
import { bodyMeasure, fitToPhoto, CALIBRATION } from '../../src/body-match.js';

// the body's outline seen from its left side, z to the right, at 900 pixels per unit. The arms
// hang at the sides in a photo, inside the outline, so they are left out (the rest skeleton holds
// the forearms forward).
const arm = boneWeightSum(POSE_BONES.map((b) => b.name).filter((n) => /^(upperarm|lowerarm|wrist|finger|metacarpal)/.test(n)));
function sidePhoto(params, facing = 1) {
  const P = shapePositions(params), J = createRestRig(params).joints, N = COUNTS.body;
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let v = 0; v < N; v++) { const y = P[v * 3 + 1], z = P[v * 3 + 2]; y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const k = 900, pad = 60, w = Math.ceil((z1 - z0) * k) + pad * 2, h = Math.ceil((y1 - y0) * k) + pad * 2;
  const X = (z) => (facing > 0 ? (z - z0) * k : (z1 - z) * k) + pad, Y = (y) => (y1 - y) * k + pad;
  const mask = new Float32Array(w * h);
  for (let t = 0; t < INDEX.length; t += 3) {
    const a = INDEX[t], b = INDEX[t + 1], c = INDEX[t + 2]; if (a >= N || b >= N || c >= N || arm[a] > 0.5 || arm[b] > 0.5 || arm[c] > 0.5) continue;
    const q = [a, b, c].map((i) => [X(P[i * 3 + 2]), Y(P[i * 3 + 1])]);
    const xa = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), xb = Math.min(w - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
    const ya = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), yb = Math.min(h - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
    const d = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]); if (Math.abs(d) < 1e-9) continue;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const px = x + 0.5, py = y + 0.5;
      const u = ((q[1][0] - px) * (q[2][1] - py) - (q[2][0] - px) * (q[1][1] - py)) / d, v = ((q[2][0] - px) * (q[0][1] - py) - (q[0][0] - px) * (q[2][1] - py)) / d;
      if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) mask[y * w + x] = 1;
    }
  }
  const at = (name, end = 'head') => { const b = POSE_BONES.find((x) => x.name === name); return [J[b[end] * 3], J[b[end] * 3 + 1], J[b[end] * 3 + 2]]; };
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  const put = (i, p, dz = 0) => { lm[i] = { x: X(p[2] + dz) / w, y: Y(p[1]) / h, visibility: 0.95 }; };
  put(LM.shoulderL, at('upperarm01.L'), 0.004); put(LM.shoulderR, at('upperarm01.R'), -0.004);
  put(LM.hipL, at('upperleg01.L')); put(LM.hipR, at('upperleg01.R'));
  put(LM.kneeL, at('lowerleg01.L')); put(LM.kneeR, at('lowerleg01.R'));
  put(LM.ankleL, at('lowerleg02.L', 'tail')); put(LM.ankleR, at('lowerleg02.R', 'tail'));
  for (const i of [LM.heelL, LM.heelR]) put(i, [0, y0 + 0.03, at('lowerleg02.L', 'tail')[2] - 0.04]);
  for (const i of [LM.toeL, LM.toeR]) put(i, [0, y0 + 0.02, at('lowerleg02.L', 'tail')[2] + 0.12]);
  const head = at('head'), nose = [0, head[1] + 0.07, z1 - 0.01];
  put(LM.nose, nose); put(LM.earL, [0, head[1] + 0.08, head[2]]); put(LM.earR, [0, head[1] + 0.08, head[2]]);
  return { lm, mask, w, h };
}

const std = { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} };
const r = (() => { const p = sidePhoto(std); return measurePhoto(p.lm, p.mask, p.w, p.h); })();
assert.equal(r.view, 'side', 'read as a side photo'); assert.deepEqual(r.problems, []); assert.equal(r.ref, 'height');
assert.deepEqual(r.parts, SIDE_KEYS, 'the chest, belly and seat depths');
const body = bodyMeasure(std);
for (const k of SIDE_KEYS) {
  const c = r.ratios[k] / body[k];
  console.log(k, 'photo', r.ratios[k].toFixed(4), 'body', body[k].toFixed(4), 'body over photo', (1 / c).toFixed(3), 'in use', CALIBRATION[k]);
  assert.ok(Math.abs(c * CALIBRATION[k] - 1) < 0.02, `${k}: the outline reads the body's own depth (${c.toFixed(3)})`);
}
// facing the other way reads the same
const back = (() => { const p = sidePhoto(std, -1); return measurePhoto(p.lm, p.mask, p.w, p.h); })();
for (const k of SIDE_KEYS) assert.ok(Math.abs(back.ratios[k] / r.ratios[k] - 1) < 0.02, `${k} the same facing the other way`);

// a deeper body with a rounder belly and a flatter seat, found again from the standard body
const front = { ...std, weight: 0.35, fit: { shoulders: 0.4, waist: -0.3 } };
const truth = { ...front, fit: { ...front.fit, depth: 0.6, belly: 0.5, butt: -0.4 } };
const p = sidePhoto(truth), read = measurePhoto(p.lm, p.mask, p.w, p.h);
const fit = fitToPhoto(read, front).params, want = bodyMeasure(truth), got = bodyMeasure(fit), was = bodyMeasure(front);
for (const k of SIDE_KEYS) {
  const err = Math.abs(got[k] / want[k] - 1), before = Math.abs(was[k] / want[k] - 1);
  console.log(k, 'was off', (before * 100).toFixed(1) + '%', 'now', (err * 100).toFixed(1) + '%');
  assert.ok(err < 0.04, `${k} within 4% (${(err * 100).toFixed(1)}%)`);
  if (before > 0.04) assert.ok(err < before / 2, `${k} moved towards the photo`);
}
assert.equal(fit.weight, front.weight, 'weight kept'); assert.equal(fit.fit.shoulders, 0.4); assert.equal(fit.fit.waist, -0.3, 'what a front photo set is kept');
assert.ok(fit.fit.depth > 0.2 && fit.fit.belly > 0.15, 'deeper with a rounder belly ' + JSON.stringify(fit.fit));
console.log('PASS side-photo-unit: a side outline reads the body\'s chest, belly and seat depth, either way round, and finds a deeper body again with only the depth sliders');
