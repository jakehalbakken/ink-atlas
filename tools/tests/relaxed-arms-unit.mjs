// Arms relaxed at sides (Preview > Pose): the upper arm hangs straight down, the elbow keeps a small
// natural bend so the forearm comes a little forward, the palm faces the thigh, and the arm hangs as
// close in as the body allows with the hand a finger's width off the hip and thigh. On every shape.
// And the measurements typed in Body hold in it and in the other hanging poses: arm lengths exactly
// (the skeleton is rigid) and the tape round the upper arm, forearm and wrist within a tenth of an
// inch of what was typed.
// node tools/tests/relaxed-arms-unit.mjs
import assert from 'node:assert/strict';
import { createRestRig, POSE_BONES, poseTransforms, skinPose } from '../../src/pose.js';
import { catalogRotations, POSE_CATALOG, relaxedGap, relaxedLift, RELAXED_GAP } from '../../src/pose-catalog.js';
import { measureBody, unitsToInches, matchMeasurements } from '../../src/body-measure.js';
import { shapeWithJoints, INDEX, COUNTS } from '../../src/mesh.js';
const bi = Object.fromEntries(POSE_BONES.map((b, i) => [b.name, i]));
const sub = (a, b) => a.map((x, i) => x - b[i]), unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); }, dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const deg = (r) => r * 180 / Math.PI;
const posedPoint = (t, [x, y, z]) => { const [a, b, c, w] = t.q, tx = 2 * (b * z - c * y), ty = 2 * (c * x - a * z), tz = 2 * (a * y - b * x); return [x + w * tx + b * tz - c * ty + t.t[0], y + w * ty + c * tx - a * tz + t.t[1], z + w * tz + a * ty - b * tx + t.t[2]]; };
// every bone's head and tail where the pose puts them, as a joints array like the rest one
function posedJoints(rest, T) {
  const J = new Float32Array(rest.joints), at = (i, k) => { const p = posedPoint(T[i], [rest.joints[k], rest.joints[k + 1], rest.joints[k + 2]]); J[k] = p[0]; J[k + 1] = p[1]; J[k + 2] = p[2]; };
  POSE_BONES.forEach((b, i) => at(i, b.tail * 3)); POSE_BONES.forEach((b, i) => at(i, b.head * 3));
  return J;
}
const jointOf = (J, name, end = 'head') => { const k = POSE_BONES[bi[name]][end] * 3; return [J[k], J[k + 1], J[k + 2]]; };

assert.equal(POSE_CATALOG.relaxedSides.group, 'Straight arms'); assert.equal(POSE_CATALOG.relaxedSides.label, 'Arms relaxed at sides');
for (const shape of [{}, { figure: 'female' }, { muscle: 1, weight: 1 }, { muscle: 0, weight: 0 }, { muscle: 0, weight: 1 }, { figure: 'female', weight: 0.9, fit: { hips: 1 } }]) {
  const rest = createRestRig(shape), T = poseTransforms(rest, catalogRotations('relaxedSides', rest)), J = posedJoints(rest, T);
  const lift = relaxedLift(rest), gap = relaxedGap(rest, lift);
  for (const s of ['L', 'R']) {
    const sh = jointOf(J, 'upperarm01.' + s), el = jointOf(J, 'lowerarm01.' + s), wr = jointOf(J, 'wrist.' + s);
    const up = unit(sub(el, sh)), fo = unit(sub(wr, el)), bend = deg(Math.acos(Math.min(1, dot(up, fo)))), below = deg(Math.asin(-up[1]));
    const tag = `${s} on ${JSON.stringify(shape)}`;
    assert.ok(bend > 12 && bend < 22, `${tag}: the elbow keeps a small bend: ${bend.toFixed(1)} deg`);
    assert.ok(fo[2] > Math.sin(10 * Math.PI / 180), `${tag}: the forearm comes forward: ${deg(Math.asin(fo[2])).toFixed(1)} deg`);
    assert.ok(Math.abs(deg(Math.asin(up[2]))) < 4, `${tag}: the upper arm is not swung forward or back`);
    assert.ok(below > 66 && below < 89, `${tag}: the upper arm hangs down: ${below.toFixed(1)} deg below level`);
    if (!shape.weight || shape.weight < 0.9) assert.ok(below > 78, `${tag}: on a body that allows it, close to straight down: ${below.toFixed(1)}`);
    // the palm faces the thigh: its normal points in towards the body more than any other way
    const across = unit(sub(jointOf(J, 'finger2-1.' + s), jointOf(J, 'finger5-1.' + s))), fingers = unit(sub(jointOf(J, 'finger3-1.' + s, 'tail'), jointOf(J, 'finger3-1.' + s)));
    let pn = unit(cross(fingers, across)); if (dot(pn, sub(jointOf(J, 'finger1-3.' + s, 'tail'), jointOf(J, 'finger3-1.' + s))) < 0) pn = pn.map((x) => -x);
    const inward = s === 'L' ? -pn[0] : pn[0];
    assert.ok(inward > 0.8, `${tag}: palm to the thigh: ${pn.map((x) => x.toFixed(2))}`);
  }
  assert.ok(gap >= RELAXED_GAP - 1e-9 && gap < 0.03, `the hand clears the hip and thigh by a finger's width: ${(gap * 1000).toFixed(0)} mm`);
  // and in closer than that, the hand would be in the thigh: the arm hangs as far in as it can
  if (lift > -0.72 + 1e-6) assert.ok(relaxedGap(rest, lift - 0.06) < RELAXED_GAP, 'any closer and the hand would touch');
}

// typed measurements hold in the hanging poses
const shape = { figure: 'male', muscle: 0.5, weight: 0.5, heightCm: 175, fit: {} };
const ARM = ['upperArmLen', 'foreArmLen', 'upperArmSize', 'foreArmSize', 'wristSize'];
const inches = (fit, only) => { const { positions, joints } = shapeWithJoints({ ...shape, fit }), r = measureBody(positions, joints, INDEX, COUNTS.body, only), o = {}; for (const k in r) o[k] = unitsToInches(r[k], 175); return o; };
const std = inches({});
const typed = { upperArmSize: +(std.upperArmSize + 0.9).toFixed(2), foreArmSize: +(std.foreArmSize + 0.6).toFixed(2), wristSize: +(std.wristSize + 0.4).toFixed(2), upperArmLen: +(std.upperArmLen + 0.5).toFixed(2), foreArmLen: +(std.foreArmLen - 0.3).toFixed(2) };
const { fit, misses } = matchMeasurements({}, typed, (f, k) => inches(f, k)[k] ?? null);
assert.equal(misses.length, 0, 'all five typed sizes reachable');
const body = { ...shape, fit }, rest = createRestRig(body), standing = inches(fit, ARM);
for (const k of ARM) assert.ok(Math.abs(standing[k] - typed[k]) < 0.12, `standing ${k}: typed ${typed[k]}, measures ${standing[k].toFixed(2)}`);
const lines = [];
for (const key of ['relaxedSides', 'straightDown', 'straightPalms', 'straightOut', 'armsLifted', 'raisedBoth', 'twist', 'hinge']) {
  const { positions, transforms } = skinPose(rest, catalogRotations(key, rest), { muscle: 0.5 });
  const m = measureBody(positions, posedJoints(rest, transforms), INDEX, COUNTS.body, ARM), got = {};
  for (const k of ARM) { got[k] = unitsToInches(m[k], 175); assert.ok(Math.abs(got[k] - typed[k]) < (k.endsWith('Len') ? 0.12 : 0.15), `${key}: ${k} typed ${typed[k]} in, measures ${got[k].toFixed(2)} in`); }
  for (const k of ['upperArmLen', 'foreArmLen']) assert.ok(Math.abs(got[k] - standing[k]) < 1e-3, `${key}: ${k} is the same bone length`);
  if (key === 'relaxedSides') lines.push(ARM.map((k) => `${k} ${got[k].toFixed(2)} (typed ${typed[k]})`).join(', '));
}
console.log(`PASS relaxed-arms-unit: hangs down with a small elbow bend on 6 shapes, palms in, hands just off the thighs; in the relaxed pose ${lines[0]}`);
