// Does it fit: the loop round a cylinder is its circumference, walked only on its own surface even
// with a second cylinder beside it; the plain words for too wide, too long and wrapping.
import assert from 'node:assert/strict';
import { edgeTris, girthAt, fitNote } from '../../src/spots.js';

// two closed cylinders side by side, radius 0.04, 48 round, 10 rings up
function cylinders() {
  const pos = [], idx = [], N = 48, R = 10;
  for (const cx of [0, 0.1]) {
    const base = pos.length / 3;
    for (let r = 0; r < R; r++) for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; pos.push(cx + 0.04 * Math.cos(a), r * 0.02, 0.04 * Math.sin(a)); }
    for (let r = 0; r < R - 1; r++) for (let i = 0; i < N; i++) {
      const a = base + r * N + i, b = base + r * N + (i + 1) % N, c = a + N, d = b + N;
      idx.push(a, b, c, b, d, c);
    }
  }
  return { pos: new Float32Array(pos), index: new Uint32Array(idx), tris: idx.length / 3 };
}
const m = cylinders(), edges = edgeTris(m.index, m.tris);
// a triangle on the first cylinder at height about 0.09 (ring 4)
const tri = 4 * 48 * 2 + 6;
const g = girthAt(m.pos, m.index, tri, [0.04, 0.091, 0], [0, 1, 0], edges);
const ideal = 2 * 48 * 0.04 * Math.sin(Math.PI / 48);
assert.ok(g != null && Math.abs(g - ideal) < 1e-4, `the loop round one cylinder: ${g} vs ${ideal}`);
// a tilted plane still closes, a little longer
const t2 = girthAt(m.pos, m.index, tri, [0.04, 0.091, 0], [0.2, 1, 0].map((v, _, a) => v / Math.hypot(...a)), edges);
assert.ok(t2 > g && t2 < g * 1.1, 'a slanted cut is a little longer: ' + t2);
// a plane that leaves the mesh (cut along the cylinder) gives null
assert.equal(girthAt(m.pos, m.index, tri, [0.04, 0.091, 0], [0, 0, 1], edges), null, 'an open cut gives nothing');

assert.equal(fitNote(0.05, 0.08, 0.25, 0.2), '');
assert.equal(fitNote(0.15, 0.08, 0.25, 0.2), 'wraps more than half way round');
assert.equal(fitNote(0.23, 0.08, 0.25, 0.2), 'too wide, it goes nearly all the way round');
assert.equal(fitNote(0.05, 0.25, 0.25, 0.2), 'too long for here at this size');
assert.equal(fitNote(0.05, 0.25, 0, 0), '', 'nothing to go on: nothing said');
console.log('spot-fit-unit ok');
