// Sleeve map maths: a cylinder hanging down the y axis unrolls to a rectangle as wide as its
// circumference and as long as the limb, the outside in the middle, a triangle across the cut drawn
// on both edges, and a bent limb measured along its joints.
import assert from 'node:assert/strict';
import { unrollLimb, mapTriangle, mapBounds, typicalRound } from '../../src/limb-map.js';

const N = 36, R = 10, rad = 0.05, pos = [], idx = [];
for (let k = 0; k < R; k++) for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; pos.push(rad * Math.cos(a), -k * 0.05, rad * Math.sin(a)); }
for (let k = 0; k < R - 1; k++) for (let i = 0; i < N; i++) { const a = k * N + i, b = k * N + (i + 1) % N; idx.push(a, b, a + N, b, b + N, a + N); }
const P = new Float32Array(pos), count = pos.length / 3;
const m = unrollLimb({ pos: P, count, joints: [[0, 0, 0], [0, -0.45, 0]], keep: () => true, outward: [1, 0, 0] });
assert.ok(Math.abs(m.length - 0.45) < 1e-9, 'length along the joints');
assert.ok(Math.abs(m.ang[0]) < 1e-6, 'the outside (+x) is the middle of the map');
assert.ok(Math.abs(m.r[5] - rad) < 1e-6, 'distance from the line');
assert.ok(Math.abs(m.s[3 * N] - 0.15) < 1e-6, 'distance down');
assert.ok(Math.abs(Math.abs(m.ang[N / 2]) - Math.PI) < 1e-6, 'the inside is the cut');
const b = mapBounds(m); assert.ok(Math.abs(b.half - Math.PI * rad) < 1e-6, 'half the circumference either side');
// a triangle away from the cut: one triangle; across the cut: two, one on each edge
let crossing = 0, normal = 0;
for (let t = 0; t < idx.length / 3; t++) {
  const out = mapTriangle(m, idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  if (out.length === 2) { crossing++; assert.ok(out[0].every(([x]) => x >= -1e-9) && out[1].every(([x]) => x <= 1e-9), 'one copy each side'); } else normal++;
  for (const tri of out) for (const [x] of tri) assert.ok(Math.abs(x) <= b.half * 2.01, 'inside the map, give or take the copy');
}
assert.ok(crossing > 0 && crossing <= 2 * (R - 1) + 2, 'only triangles at the cut cross: ' + crossing);
// skipped vertices give nothing
const m2 = unrollLimb({ pos: P, count, joints: [[0, 0, 0], [0, -0.45, 0]], keep: (v) => v >= N, outward: [1, 0, 0] });
assert.equal(mapTriangle(m2, 0, 1, N).length, 0);
assert.ok(Number.isNaN(m2.s[0]));
// a bent limb: distance down runs along both parts
const m3 = unrollLimb({ pos: new Float32Array([0.1, -0.3, 0.02]), count: 1, joints: [[0, 0, 0], [0, -0.2, 0], [0.2, -0.4, 0]], keep: () => true, outward: [0, 0, 1] });
assert.ok(m3.s[0] > 0.2 && m3.s[0] < 0.2 + Math.hypot(0.2, 0.2), 'past the elbow: ' + m3.s[0]);
assert.ok(Math.abs(typicalRound(m) - 2 * Math.PI * rad) < 1e-6, 'typical round');
// trim leaves out what lies past either end of the line
const m4 = unrollLimb({ pos: new Float32Array([0.05, 0.02, 0, 0.05, -0.2, 0, 0.05, -0.5, 0]), count: 3, joints: [[0, 0, 0], [0, -0.45, 0]], keep: () => true, outward: [1, 0, 0], trim: true });
assert.ok(Number.isNaN(m4.s[0]) && Number.isFinite(m4.s[1]) && Number.isNaN(m4.s[2]), 'trimmed ends');
console.log('limb-map-unit ok');
