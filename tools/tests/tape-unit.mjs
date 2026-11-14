// Tape measure maths: on a capped cylinder (an arm) the way round is its circumference and the
// length along it is the straight distance; across a sphere the length is the arc, not the
// chord; opposite sides go round the short way; inches and centimetres from the height.
import assert from 'node:assert/strict';
import { meshNeighbours, alongSkin, aroundAt, tapeText } from '../../src/tape.js';

// a closed cylinder along y, radius R, length L, with fine rings
function cylinder(R, L, seg = 96, rings = 120) {
  const pos = [], idx = [];
  for (let j = 0; j <= rings; j++) for (let i = 0; i < seg; i++) { const a = 2 * Math.PI * i / seg; pos.push(R * Math.cos(a), L * j / rings, R * Math.sin(a)); }
  const v = (j, i) => j * seg + (i % seg);
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) idx.push(v(j, i), v(j + 1, i), v(j + 1, i + 1), v(j, i), v(j + 1, i + 1), v(j, i + 1));
  const c0 = pos.length / 3; pos.push(0, 0, 0); const c1 = pos.length / 3; pos.push(0, L, 0);
  for (let i = 0; i < seg; i++) { idx.push(c0, v(0, i + 1), v(0, i)); idx.push(c1, v(rings, i), v(rings, i + 1)); }
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) };
}
function sphere(R, seg = 96, rings = 64) {
  const pos = [], idx = [];
  for (let j = 0; j <= rings; j++) { const th = Math.PI * j / rings; for (let i = 0; i < seg; i++) { const ph = 2 * Math.PI * i / seg; pos.push(R * Math.sin(th) * Math.cos(ph), R * Math.cos(th), R * Math.sin(th) * Math.sin(ph)); } }
  const v = (j, i) => j * seg + (i % seg);
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) idx.push(v(j, i), v(j + 1, i), v(j + 1, i + 1), v(j, i), v(j + 1, i + 1), v(j, i + 1));
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) };
}
// the triangle under a point (nearest centroid) and the surface point itself
function onMesh(m, p) {
  let best = -1, bd = Infinity;
  for (let t = 0; t < m.idx.length / 3; t++) { let c = [0, 0, 0]; for (let k = 0; k < 3; k++) for (let d = 0; d < 3; d++) c[d] += m.pos[m.idx[t * 3 + k] * 3 + d] / 3; const dd = Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]); if (dd < bd) { bd = dd; best = t; } }
  let c = [0, 0, 0]; for (let k = 0; k < 3; k++) for (let d = 0; d < 3; d++) c[d] += m.pos[m.idx[best * 3 + k] * 3 + d] / 3;
  return { t: best, p: c };
}

const R = 0.04, L = 0.3, cyl = cylinder(R, L), nb = meshNeighbours(cyl.idx);
assert.equal(nb.filter((x) => x < 0).length, 0, 'a closed mesh: every edge has a neighbour');
// around the arm in the middle
const mid = onMesh(cyl, [R, 0.15, 0]);
const ar = aroundAt(cyl.pos, cyl.idx, nb, mid.p, mid.t, [1, 0, 0]);
const circ = 2 * Math.PI * R;
assert.ok(ar && Math.abs(ar.len - circ) / circ < 0.01, `round the cylinder ${ar && ar.len} vs ${circ}`);
assert.ok(Math.abs(ar.axis[1]) > 0.98, 'the loop is square to the arm');
// along the arm
const a = onMesh(cyl, [R, 0.05, 0]), b = onMesh(cyl, [R, 0.25, 0]);
const al = alongSkin(cyl.pos, cyl.idx, nb, a.p, a.t, [1, 0, 0], b.p, b.t, [1, 0, 0]);
assert.ok(Math.abs(al.len - Math.abs(b.p[1] - a.p[1])) < 0.002, 'along the arm: ' + al.len);
// to the other side: half way round, the short way
const c = onMesh(cyl, [-R, 0.15, 0]);
const op = alongSkin(cyl.pos, cyl.idx, nb, mid.p, mid.t, [1, 0, 0], c.p, c.t, [-1, 0, 0]);
assert.ok(Math.abs(op.len - circ / 2) / (circ / 2) < 0.03, `half way round ${op.len} vs ${circ / 2}`);
// a quarter round and up
const q = onMesh(cyl, [0, 0.25, R]);
const qq = alongSkin(cyl.pos, cyl.idx, nb, mid.p, mid.t, [1, 0, 0], q.p, q.t, [0, 0, 1]);
const unrolled = Math.hypot(circ / 4, q.p[1] - mid.p[1]);
assert.ok(qq.len <= unrolled * 1.04 && qq.len >= unrolled * 0.98, `diagonal ${qq.len} vs unrolled ${unrolled}`);
assert.ok(qq.pts.length > 3 && qq.pts.every((p) => Math.abs(Math.hypot(p[0], p[2]) - R) < 0.002 || p[1] <= 0 || p[1] >= L), 'the path stays on the skin');

// across a sphere: the arc, not the chord
const Rs = 0.1, sp = sphere(Rs), nbs = meshNeighbours(sp.idx);
const s1 = onMesh(sp, [Rs, 0, 0]), s2 = onMesh(sp, [0, 0, Rs]);
const arc = alongSkin(sp.pos, sp.idx, nbs, s1.p, s1.t, [1, 0, 0], s2.p, s2.t, [0, 0, 1]);
const want = Rs * Math.acos((s1.p[0] * s2.p[0] + s1.p[1] * s2.p[1] + s1.p[2] * s2.p[2]) / (Math.hypot(...s1.p) * Math.hypot(...s2.p)));
assert.ok(Math.abs(arc.len - want) / want < 0.02, `arc ${arc.len} vs ${want}`);
assert.ok(arc.len > Math.hypot(s1.p[0] - s2.p[0], s1.p[1] - s2.p[1], s1.p[2] - s2.p[2]) * 1.05, 'longer than the chord');
const eq = aroundAt(sp.pos, sp.idx, nbs, s1.p, s1.t, [1, 0, 0]);
assert.ok(eq && Math.abs(eq.len - 2 * Math.PI * Rs) / (2 * Math.PI * Rs) < 0.02, 'round a sphere is a great circle: ' + (eq && eq.len));

// units: the body is 1.75 tall
assert.deepEqual(tapeText(0.0254 * 1.75 / 1.75 * 100 / 100, 175).inch.toFixed(2), '1.00');
assert.equal(tapeText(0.1, 175).text, '3.9 in (10 cm)');
assert.equal(tapeText(0.5, 175).text, '20 in (50 cm)');
console.log('PASS tape-unit: round a limb, along it, to the far side, diagonals unrolled, arcs not chords, units');
