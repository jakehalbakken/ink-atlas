// How I see it: on the real standing body you see your own chest, belly, the front of your
// thighs and the top of your feet, never your back, the back of your head or your neck; a bent
// elbow shows the forearm better; the live view stays inside what a head and eyes can turn to;
// and the mirror selfie camera is the phone's reflection looking back at you.
import assert from 'node:assert/strict';
import { shapePositions, INDEX, COUNTS } from '../../src/mesh.js';
import { createRestRig, skinPose, vertexBones } from '../../src/pose.js';
import { catalogRotations } from '../../src/pose-catalog.js';
import { vertexNormals, bodyParts, headLandmarks, headFrame, lookPostures, seenMask, shareSeen, eyeView, LOOK_SIDE, LOOK_DOWN, selfieCamera, seenLine, turn } from '../../src/self-view.js';

const state = { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} };
const P = shapePositions(state), n = COUNTS.body + COUNTS.eyes;
const normals0 = (P, I) => { const N = new Float32Array(P.length); for (let i = 0; i < I.length; i += 3) { const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3; const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]; const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; for (const o of [a, b, c]) { N[o] += x; N[o + 1] += y; N[o + 2] += z; } } for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; } return N; };
const normals = vertexNormals; const N0 = normals(P, INDEX);
let t0 = performance.now();
const parts = bodyParts(n, vertexBones);
const skip = new Uint8Array(n); for (let v = COUNTS.body; v < n; v++) skip[v] = 1;
const unseen = new Uint8Array(n); for (let v = 0; v < n; v++) unseen[v] = parts.head[v] || parts.neck[v];
const L = headLandmarks(P, parts.head, [COUNTS.body, COUNTS.eyes]);
const tParts = performance.now() - t0;
const F = headFrame(P, L);
assert.ok(F.forward[2] > 0.95, 'the head faces forward: ' + F.forward);
assert.ok(F.up[1] > 0.95, 'and up is up: ' + F.up);
assert.ok(F.eye[1] > 1.55 && F.eye[1] < 1.7, 'eyes at eye height: ' + F.eye[1]);
t0 = performance.now();
const seen = seenMask(P, N0, INDEX, n, { postures: lookPostures(F), skip, unseen, clear: parts.head });
const tSeen = performance.now() - t0;
console.log(`parts ${tParts.toFixed(0)} ms, seen ${tSeen.toFixed(0)} ms`);
// sample regions: vertices near a point on the rest body
// skin near a point that faces one way (facing: [axis, min])
const near = (x, y, z, r = 0.04, facing = null) => { const out = []; for (let v = 0; v < COUNTS.body; v++) if (Math.hypot(P[v * 3] - x, P[v * 3 + 1] - y, P[v * 3 + 2] - z) < r && (!facing || facing[1] * N0[v * 3 + facing[0]] > Math.abs(facing[1]) * 0.6)) out.push(v); return out; };
const at = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
const front = (y, x = 0) => { let best = -1; for (let v = 0; v < COUNTS.body; v++) if (Math.abs(P[v * 3] - x) < 0.02 && Math.abs(P[v * 3 + 1] - y) < 0.02 && (best < 0 || P[v * 3 + 2] > P[best * 3 + 2])) best = v; return at(best); };
const backOf = (y, x = 0) => { let best = -1; for (let v = 0; v < COUNTS.body; v++) if (Math.abs(P[v * 3] - x) < 0.02 && Math.abs(P[v * 3 + 1] - y) < 0.02 && (best < 0 || P[v * 3 + 2] < P[best * 3 + 2])) best = v; return at(best); };
const share = (p, facing) => shareSeen(seen, near(...p, 0.04, facing));
const F_ = [2, 1], B_ = [2, -1], U_ = [1, 1];
const footTop = []; for (let v = 0; v < COUNTS.body; v++) if (P[v * 3 + 1] < 0.07 && P[v * 3 + 2] > 0.06 && Math.abs(P[v * 3] - 0.2) < 0.05 && N0[v * 3 + 1] > 0.6) footTop.push(v);
const report = { belly: share(front(1.05), F_), chest: share(front(1.3, 0.08), F_), thigh: share(front(0.65, 0.1), F_), foot: shareSeen(seen, footTop), back: share(backOf(1.2), B_), buttock: share(backOf(0.9, 0.08), B_), calfBack: share(backOf(0.35, 0.1), B_), nape: share(backOf(1.55), B_) };
console.log(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v == null ? null : +v.toFixed(2)])));
assert.ok(report.belly > 0.8 && report.chest > 0.6 && report.thigh > 0.7 && report.foot > 0.7, 'front of the body is seen');
assert.ok(report.back < 0.05 && report.buttock < 0.1 && report.calfBack < 0.1 && report.nape === 0, 'the back is not');
let all = 0; for (let v = 0; v < COUNTS.body; v++) all += seen[v];
console.log('skin seen', (all / COUNTS.body).toFixed(2));
assert.ok(all / COUNTS.body > 0.2 && all / COUNTS.body < 0.6, 'some of the skin, not all');

// a bent elbow brings the inner forearm up into sight
const rig = createRestRig(state);
const inner = (pos) => { const Pp = pos; return Pp; };
const forearm = near(...(() => { let best = -1; for (let v = 0; v < COUNTS.body; v++) if (P[v * 3] > 0.2 && Math.abs(P[v * 3 + 1] - 0.95) < 0.03 && (best < 0 || P[v * 3 + 2] > P[best * 3 + 2])) best = v; return at(best); })(), 0.035);
const posedShare = (key) => { const Q = skinPose(rig, catalogRotations(key, rig)).positions; const Fq = headFrame(Q, L); return shareSeen(seenMask(Q, normals(Q, INDEX), INDEX, n, { postures: lookPostures(Fq), skip, unseen, clear: parts.head, only: forearm }), forearm); };
t0 = performance.now(); const standing = posedShare('neutral'), bent = posedShare('elbow'); const tPose = (performance.now() - t0) / 2;
console.log('forearm standing', standing.toFixed(2), 'elbow bent', bent.toFixed(2), `${tPose.toFixed(0)} ms a pose`);
assert.ok(bent > standing + 0.1, 'bending the elbow shows the forearm');

// the live view is held to what a head and eyes can do
const far = eyeView(F, 9, 9); assert.ok(Math.abs(far.yaw - LOOK_SIDE) < 1e-9 && Math.abs(far.pitch - LOOK_DOWN) < 1e-9, 'held to the reach');
const down = eyeView(F, 0, 1.2); assert.ok(down.dir[1] < -0.85, 'looking down looks down: ' + down.dir);
assert.ok(down.pos[2] > F.eye[2], 'bending the head carries the eyes forward');
const left = eyeView(F, 1.2, 0); assert.ok(left.dir[0] > 0.8, 'a turn to the left looks to the body\'s left: ' + left.dir);
// mirror selfie: the camera is the phone's reflection, looking back at the phone
const hand = [-0.15, 1.3, 0.3], cam = selfieCamera(hand, { gap: 0.6 });
assert.ok(Math.abs(cam.pos[2] - 1.5) < 1e-9 && cam.dir[2] < -0.99, 'reflected straight back');
const turned = selfieCamera(hand, { gap: 0.6, turnBody: 0.5 });
assert.ok(Math.abs(Math.hypot(...turned.pos.map((x, i) => x - hand[i])) - 1.2) < 1e-9 && turned.pos[0] < hand[0], 'turning to the left brings the mirror round to the right');
assert.equal(seenLine('Rose', 1), 'You can see all of Rose yourself standing.');
assert.match(seenLine('Rose', 0.42, true), /about 40% of Rose yourself in this pose/);
assert.ok(Math.abs(turn([1, 0, 0], [0, 1, 0], Math.PI / 2)[2] + 1) < 1e-9, 'turn');
console.log('self-view unit ok');
