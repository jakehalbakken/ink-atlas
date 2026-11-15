// The maths behind How it stretches: a triangle stretched along one edge reads as that stretch, a
// turned triangle reads as none, squeeze reads as squeeze; a whole piece takes the 90% value; the
// line names the poses; and on the real body an elbow-crease piece stretches more in a bent elbow
// than a mid-forearm piece does.
import assert from 'node:assert/strict';
import { triangleStretch, stretchUnder, stretchText } from '../../src/stretch.js';
import { shapePositions, INDEX } from '../../src/mesh.js';
import { createRestRig, skinPose } from '../../src/pose.js';
import { catalogRotations } from '../../src/pose-catalog.js';
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

const A = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), I = [0, 1, 2];
let [hi, lo, area] = triangleStretch(A, A, I, 0); assert.ok(near(hi, 1) && near(lo, 1) && near(area, 0.5), 'unchanged');
// stretched 20% along x
[hi, lo] = triangleStretch(A, new Float32Array([0, 0, 0, 1.2, 0, 0, 0, 1, 0]), I, 0); assert.ok(near(hi, 1.2) && near(lo, 1), 'stretch along x');
// turned and moved: no stretch
const c = Math.cos(0.7), s = Math.sin(0.7), R = new Float32Array([5, 1, 2, 5 + c, 1 + s, 2, 5 - s, 1 + c, 2]);
[hi, lo] = triangleStretch(A, R, I, 0); assert.ok(near(hi, 1) && near(lo, 1), 'a turn is not a stretch');
// tilted out of plane: still none
[hi, lo] = triangleStretch(A, new Float32Array([0, 0, 0, 0, 0, 1, 0, 1, 0]), I, 0); assert.ok(near(hi, 1) && near(lo, 1), 'tilted');
// squeezed 30% along y
[hi, lo] = triangleStretch(A, new Float32Array([0, 0, 0, 1, 0, 0, 0, 0.7, 0]), I, 0); assert.ok(near(hi, 1) && near(lo, 0.7), 'squeeze');
// sheared: both
[hi, lo] = triangleStretch(A, new Float32Array([0, 0, 0, 1, 0, 0, 0.5, 1, 0]), I, 0); assert.ok(hi > 1.2 && lo < 0.85 && near(hi * lo, 1, 1e-6), 'a shear keeps the area');

// a piece: 95% of the area unchanged and a sliver stretched a lot: the 90% value ignores the sliver
const P0 = [], P1 = [], II = [];
for (let k = 0; k < 20; k++) { const o = P0.length / 3; P0.push(k, 0, 0, k + 1, 0, 0, k, 1, 0); P1.push(k, 0, 0, k + (k === 0 ? 2 : 1), 0, 0, k, 1, 0); II.push(o, o + 1, o + 2); }
const tris = II.map((_, i) => i).filter((i) => i < 20);
let r = stretchUnder(new Float32Array(P0), new Float32Array(P1), II, tris);
assert.ok(r.stretch < 0.01, 'one sliver does not speak for the piece: ' + r.stretch);
for (let k = 0; k < 20; k++) P1[k * 9 + 3] = k + 1.15; // all stretched 15%
r = stretchUnder(new Float32Array(P0), new Float32Array(P1), II, tris); assert.ok(near(r.stretch, 0.15, 1e-4) && near(r.squeeze, 0, 1e-4), 'all stretched');

// the line
assert.equal(stretchText([]), null);
let t = stretchText([{ key: 'a', label: 'Left arm overhead', stretch: 0.14, squeeze: 0.02 }, { key: 'b', label: 'Left elbow bent', stretch: 0.05, squeeze: 0.09 }]);
assert.equal(t.key, 'a'); assert.match(t.text, /stretches up to 14% \(Left arm overhead\) and squeezes up to 9% \(Left elbow bent\)/); assert.match(t.text, /A little warping/);
t = stretchText([{ key: 'a', label: 'Turn left', stretch: 0.16, squeeze: 0.14 }]); assert.match(t.text, /stretches up to 16% and squeezes up to 14% \(Turn left\)\./);
t = stretchText([{ key: 'a', label: 'X', stretch: 0.02, squeeze: 0.03 }]); assert.match(t.text, /hardly moves/);
t = stretchText([{ key: 'a', label: 'X', stretch: 0.31, squeeze: 0.01 }]); assert.match(t.text, /bold lines/); assert.doesNotMatch(t.text, /squeezes/);

// the real body: skin round the inside of the elbow moves much more in a bent elbow than the middle of the forearm
const shape = { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} };
const P = shapePositions(shape), rig = createRestRig(shape), rest = { positions: P, joints: rig.joints };
const posed = skinPose(rest, catalogRotations('elbow'), { muscle: 0.5 }).positions;
const J = (i) => [rig.joints[i * 3], rig.joints[i * 3 + 1], rig.joints[i * 3 + 2]];
import { POSE_BONES } from '../../src/pose.js';
const head = (n) => J(POSE_BONES.find((b) => b.name === n).head);
const elbow = head('lowerarm01.L'), wrist = head('wrist.L');
const trisNear = (q, rad) => { const out = []; for (let k = 0; k < INDEX.length / 3; k++) { const a = INDEX[k * 3]; if (a >= 13380) continue; if (Math.hypot(P[a * 3] - q[0], P[a * 3 + 1] - q[1], P[a * 3 + 2] - q[2]) < rad) out.push(k); } return out; };
const atElbow = stretchUnder(P, posed, INDEX, trisNear(elbow, 0.06)), mid = stretchUnder(P, posed, INDEX, trisNear(elbow.map((x, i) => x + (wrist[i] - x) * 0.55), 0.03));
const most = (r) => Math.max(r.stretch, r.squeeze);
assert.ok(most(atElbow) > 0.1 && most(atElbow) > most(mid) * 1.8, `the elbow moves more: ${JSON.stringify(atElbow)} vs ${JSON.stringify(mid)}`);
// standing still: nothing
assert.ok(most(stretchUnder(P, P, INDEX, trisNear(elbow, 0.06))) < 1e-6);
console.log('stretch-unit ok', JSON.stringify(atElbow), JSON.stringify(mid));
