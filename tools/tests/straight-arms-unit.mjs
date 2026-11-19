// Straight arms: every Straight arms pose leaves both elbows straight (within a degree),
// Down hangs the arm clear of the hips, Out is level with the shoulders, and Palms forward
// only turns the forearm (the arm's line is the same as Down).
import assert from 'node:assert/strict';
import { createRestRig, POSE_BONES, poseTransforms } from '../../src/pose.js';
import { catalogRotations, POSE_CATALOG, POSE_GROUPS } from '../../src/pose-catalog.js';
const bi = Object.fromEntries(POSE_BONES.map((b, i) => [b.name, i]));
const sub = (a, b) => a.map((x, i) => x - b[i]), unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); }, dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const deg = (r) => r * 180 / Math.PI;
function joints(shape, key) {
  const rest = createRestRig(shape), T = poseTransforms(rest, key ? catalogRotations(key, rest) : {});
  return (name, end = 'head') => {
    const b = POSE_BONES.find((x) => x.name === name), k = b[end] * 3, p = Array.from(rest.joints.slice(k, k + 3)), t = T[bi[name]];
    const [x, y, z] = p, [a, bq, c, w] = t.q, tx = 2 * (bq * z - c * y), ty = 2 * (c * x - a * z), tz = 2 * (a * y - bq * x);
    return [x + w * tx + bq * tz - c * ty + t.t[0], y + w * ty + c * tx - a * tz + t.t[1], z + w * tz + a * ty - bq * tx + t.t[2]];
  };
}
function arm(J, s) {
  const sh = J('upperarm01.' + s), el = J('lowerarm01.' + s), wr = J('wrist.' + s);
  const up = unit(sub(el, sh)), fo = unit(sub(wr, el));
  return { bend: deg(Math.acos(Math.min(1, dot(up, fo)))), below: deg(Math.asin(-up[1])), forward: deg(Math.asin(up[2])), out: Math.abs(wr[0]) - Math.abs(sh[0]), wr };
}
assert.equal(POSE_GROUPS[1], 'Straight arms', 'the group sits right under Standing');
assert.deepEqual(Object.keys(POSE_CATALOG).filter((k) => POSE_CATALOG[k].group === 'Straight arms'), ['straightDown', 'straightOut', 'straightPalms', 'relaxedSides']);
const rest = arm(joints({}), 'L'); assert.ok(rest.bend > 30, 'the standing body has its elbows bent: ' + rest.bend.toFixed(1));
for (const shape of [{}, { figure: 'female' }, { muscle: 1, weight: 1 }, { muscle: 0, weight: 0 }]) {
  for (const key of ['straightDown', 'straightOut', 'straightPalms']) {
    const J = joints(shape, key);
    for (const s of ['L', 'R']) {
      const a = arm(J, s);
      assert.ok(a.bend < 1, `${key} ${s} elbow straight on ${JSON.stringify(shape)}: ${a.bend.toFixed(2)} deg`);
      if (key === 'straightOut') assert.ok(Math.abs(a.below) < 6, `${key} level: ${a.below.toFixed(1)}`);
      else { assert.ok(a.below > 70 && a.below < 85, `${key} hangs down: ${a.below.toFixed(1)}`); assert.ok(a.out > 0.03, `${key} wrist clear of the hip: ${a.out.toFixed(3)}`); }
      assert.ok(Math.abs(a.forward) < 8, `${key} not forward or back: ${a.forward.toFixed(1)}`);
    }
  }
  const d = joints(shape, 'straightDown'), p = joints(shape, 'straightPalms');
  const wd = d('wrist.L'), wp = p('wrist.L'); assert.ok(Math.hypot(...sub(wd, wp)) < 1e-6, 'palms forward keeps the arm where it was');
  const td = d('finger1-3.L', 'tail'), tp = p('finger1-3.L', 'tail'); assert.ok(Math.abs(tp[0]) > Math.abs(td[0]) + 0.01, 'palms forward turns the thumb outward');
}
console.log('straight arms ok, rest elbow', rest.bend.toFixed(1), 'deg');
