// The skin over a bent elbow or knee stretches across the whole joint, not in one ring. MakeHuman
// hands the elbow and the knee from one bone to the next over a ring or two of the mesh, and the
// hinge's contact correction flattened the outside of the bend onto the plane between the bones,
// so the ring over the point of the elbow or the knee cap went to three times its length and a fine
// line of ink there became a thick smeared bar (2026-11-21, Jake: "Ink is looking weird on my
// elbow"). Checked on the edges that run along the limb within 12 cm of the joint, for several body
// shapes, both sides and the bent poses; the volume and the inside of the bend are pose-deform-unit's.
import assert from 'node:assert/strict';
import { createRestRig, skinPose, POSE_BONES, boneWeightSum } from '../../src/pose.js';
import { catalogRotations, POSE_CATALOG } from '../../src/pose-catalog.js';
import { INDEX } from '../../src/mesh.js';
const idx = Object.fromEntries(POSE_BONES.map((b, i) => [b.name, i]));
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a), unit = (a) => a.map((x) => x / len(a));
const at = (a, v) => [a[v * 3], a[v * 3 + 1], a[v * 3 + 2]];
const JOINTS = {
  elbow: (s) => ({ up: ['upperarm01.' + s, 'upperarm02.' + s], lo: ['lowerarm01.' + s, 'lowerarm02.' + s, 'wrist.' + s], A: 'upperarm01.' + s, B: 'lowerarm01.' + s, poses: s === 'L' ? ['guard', 'elbow', 'leftBiceps', 'doubleBiceps'] : ['guard', 'rightElbow', 'rightBiceps'] }),
  knee: (s) => ({ up: ['upperleg01.' + s, 'upperleg02.' + s], lo: ['lowerleg01.' + s, 'lowerleg02.' + s], A: 'upperleg01.' + s, B: 'lowerleg01.' + s, poses: ['squat', 'seated', s === 'L' ? 'kneeLeft' : 'kneeRight'] }),
};
function worst(rest, kind, s, opts = {}) {
  const j = JOINTS[kind](s), wu = boneWeightSum(j.up), wl = boneWeightSum(j.lo), NV = rest.positions.length / 3;
  const joint = (n) => { const k = POSE_BONES[idx[n]].head * 3; return [rest.joints[k], rest.joints[k + 1], rest.joints[k + 2]]; };
  const B = joint(j.B), u0 = unit(sub(B, joint(j.A))), edges = [], seen = new Set();
  for (let t = 0; t < INDEX.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = INDEX[t + k], b = INDEX[t + (k + 1) % 3]; if (a >= NV || b >= NV) continue;
    const key = a < b ? a * 1e5 + b : b * 1e5 + a; if (seen.has(key)) continue; seen.add(key);
    if (wu[a] + wl[a] < 0.9 || wu[b] + wl[b] < 0.9) continue;
    const pa = at(rest.positions, a), pb = at(rest.positions, b), m = pa.map((x, i) => (x + pb[i]) / 2);
    if (len(sub(m, B)) > 0.12) continue;
    const e = sub(pb, pa); if (Math.abs(dot(e, u0)) / len(e) < 0.7) continue; edges.push([a, b, len(e)]);
  }
  const out = {};
  for (const key of j.poses) {
    const pos = skinPose(rest, catalogRotations(key, rest), { muscle: 0.5, ...opts }).positions;
    let max = 0; for (const [a, b, l0] of edges) max = Math.max(max, len(sub(at(pos, b), at(pos, a))) / l0);
    out[key] = max;
  }
  return { edges: edges.length, out };
}
const shapes = { male: { figure: 'male' }, female: { figure: 'female' }, muscular: { figure: 'male', muscle: 0.9 }, heavy: { figure: 'female', weight: 0.85 }, slim: { figure: 'male', weight: 0.15 } };
const report = [];
for (const [name, shape] of Object.entries(shapes)) {
  const rest = createRestRig(shape);
  // standing changes nothing
  const still = skinPose(rest, {}).positions; let d = 0; for (let i = 0; i < still.length; i++) d = Math.max(d, Math.abs(still[i] - rest.positions[i]));
  assert.ok(d < 1e-6, `${name}: standing leaves the body where it is (${d})`);
  for (const kind of ['elbow', 'knee']) {
    const cap = kind === 'elbow' ? 2 : 2.25, L = worst(rest, kind, 'L'), R = worst(rest, kind, 'R');
    assert.ok(L.edges > 150, `${name} ${kind}: edges found (${L.edges})`);
    for (const [key, v] of Object.entries(L.out)) {
      assert.ok(v < cap, `${name} ${kind} ${key}: the skin over the joint stretches at most about twice (${v.toFixed(2)})`);
      report.push(`${name} ${kind} ${key} ${v.toFixed(2)}`);
    }
    for (const [key, v] of Object.entries(R.out)) assert.ok(v < cap, `${name} ${kind} ${key} R: ${v.toFixed(2)}`);
    const l = L.out[kind === 'elbow' ? 'guard' : 'squat'], r = R.out[kind === 'elbow' ? 'guard' : 'squat'];
    assert.ok(Math.abs(l - r) < 0.08, `${name} ${kind}: left and right match (${l.toFixed(2)} ${r.toFixed(2)})`);
  }
}
// the check bites: MakeHuman's own hand-over with the old contact stretched the ring about three times
const rest = createRestRig({ figure: 'male' });
const old = { elbow: worst(rest, 'elbow', 'L', { noSpread: true, contactAll: true }).out.guard, knee: worst(rest, 'knee', 'L', { noSpread: true, contactAll: true }).out.squat };
assert.ok(old.elbow > 3 && old.knee > 3, 'the old skinning stretched the point of the elbow and the knee cap about three times: ' + JSON.stringify(old));
assert.ok(POSE_CATALOG.guard && POSE_CATALOG.squat);
console.log('PASS joint-stretch-unit:', report.filter((x) => /guard|squat/.test(x)).join('; '), '| old', old.elbow.toFixed(2), old.knee.toFixed(2));
