// Cover-up check maths: the new artwork read at each old ink point (solid covers, the gaps in
// line work do not, off the decal does not), the rougher point-reach share on a grid that gives
// the same answer as checking every pair, and the plain line it makes.
import assert from 'node:assert/strict';
import { coverShare, coverText, coverByArt } from '../../src/cover.js';

// a 1 cm square of old ink points, 1 mm apart, on a flat patch
const grid = (x0, y0, w, h, step = 0.001) => { const a = []; for (let x = 0; x <= w + 1e-9; x += step) for (let y = 0; y <= h + 1e-9; y += step) a.push(x0 + x, y0 + y, 0.1); return Float32Array.from(a); };
const old = grid(0, 1, 0.01, 0.01);
assert.equal(coverShare(grid(-0.002, 0.998, 0.014, 0.014), old, 0.0015), 1, 'a bigger piece covers it all');
const half = coverShare(grid(-0.002, 0.998, 0.007, 0.014), old, 0.0005);
assert.ok(half > 0.4 && half < 0.6, 'half over it covers about half: ' + half);
assert.equal(coverShare(grid(0.5, 1, 0.01, 0.01), old, 0.003), 0, 'far away covers none');
assert.equal(coverShare(new Float32Array(), old, 0.003), 0); assert.equal(coverShare(old, null, 0.003), 0);
// the grid answer matches checking every pair, on scattered points
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const A = Float32Array.from({ length: 3000 }, () => rnd() * 0.05), B = Float32Array.from({ length: 1500 }, () => rnd() * 0.05), r = 0.004;
let hit = 0; for (let j = 0; j < B.length; j += 3) { for (let i = 0; i < A.length; i += 3) if ((A[i] - B[j]) ** 2 + (A[i + 1] - B[j + 1]) ** 2 + (A[i + 2] - B[j + 2]) ** 2 <= r * r) { hit++; break; } }
assert.equal(coverShare(A, B, r), hit / 500, 'same as every pair');
// negative coordinates use the same cells
const neg = (a) => a.map((v) => -v); assert.equal(coverShare(neg(A), neg(B), r), hit / 500);
// the new artwork read where the old ink is: a 2 cm square decal of two triangles on z = 0.1
const sq = 0.02, tris = Float32Array.from([0, 1, 0.1, sq, 1, 0.1, sq, 1 + sq, 0.1, 0, 1, 0.1, sq, 1 + sq, 0.1, 0, 1 + sq, 0.1]);
const uvs = Float32Array.from([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
const oldIn = grid(0.005, 1.005, 0.01, 0.01);
assert.equal(coverByArt({ tris, uvs, oldPts: oldIn, ink: () => true, reach: 0.003 }), 1, 'solid ink covers all under it');
const leftHalf = coverByArt({ tris, uvs, oldPts: oldIn, ink: (u) => u < 0.5, reach: 0.003 });
assert.ok(leftHalf > 0.4 && leftHalf < 0.6, 'half the art dark covers about half: ' + leftHalf);
const lines = coverByArt({ tris, uvs, oldPts: oldIn, ink: (u) => (u * 13.7) % 1 < 0.1, reach: 0.003 });
assert.ok(lines < 0.25, 'thin lines cover little: ' + lines);
assert.equal(coverByArt({ tris, uvs, oldPts: grid(0.05, 1.005, 0.01, 0.01), ink: () => true, reach: 0.003 }), 0, 'beside the decal covers none');
const lifted = oldIn.map((v, i) => (i % 3 === 2 ? v + 0.01 : v));
assert.equal(coverByArt({ tris, uvs, oldPts: lifted, ink: () => true, reach: 0.003 }), 0, 'off the skin by more than the reach covers none');
assert.equal(coverByArt({ tris, uvs, oldPts: new Float32Array(), ink: () => true, reach: 0.003 }), 0);
assert.equal(coverText(0.72, 'Old rose'), 'Covers 72% of Old rose’s ink');
assert.equal(coverText(0.99, 'Old rose'), 'Covers all of Old rose’s ink');
assert.equal(coverText(0.01, 'Old rose'), '');
console.log('PASS cover-unit: share of old ink covered, grid matches every pair, plain line, artwork read under the old ink');
