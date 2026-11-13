// The maths behind "Your face on the body": triangulation, inside test, the stored face points
// sit on the head, a photo that matches the head changes nothing, and a wider face widens it.
import assert from 'node:assert/strict';
import { delaunay, bary2, insideDistance, landmarks3D, faceMorph, faceAttribute, FACE_OVAL, detailTexture } from '../../src/face-fit.js';
import { FACE_MAP } from '../../src/face-map.js';
import { shapePositions, INDEX, COUNTS, EYES } from '../../src/mesh.js';

// Delaunay of a square plus its centre: four triangles, all counter-clockwise or clockwise, none empty
const sq = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]];
const t = delaunay(sq); assert.equal(t.length, 12, 'four triangles');
const w = bary2(0.5, 0.5, [0, 0], [1, 0], [0, 1]); assert.ok(Math.abs(w[0]) < 1e-9 && Math.abs(w[1] - 0.5) < 1e-9);
assert.ok(insideDistance(0.5, 0.5, [[0, 0], [1, 0], [1, 1], [0, 1]]) > 0.49, 'inside is positive');
assert.ok(insideDistance(2, 0.5, [[0, 0], [1, 0], [1, 1], [0, 1]]) < -0.99, 'outside is negative');

// the 478 stored points are on the head, in front, between chin and forehead
assert.equal(FACE_MAP.length, 478 * 3);
const P = shapePositions({ figure: 'male', muscle: 0.5, weight: 0.5, fit: {} });
const lm3 = landmarks3D(P, INDEX, FACE_MAP);
let ey = 0; for (let v = EYES.l[0]; v < EYES.l[0] + EYES.l[1]; v++) ey += P[v * 3 + 1]; ey /= EYES.l[1];
for (const p of lm3) { assert.ok(Math.abs(p[1] - ey) < 0.17 && Math.abs(p[0]) < 0.1 && p[2] > 0, 'landmark on the face'); }
// nose tip (1) in front of the cheeks, chin (152) below the forehead (10)
assert.ok(lm3[1][2] > lm3[234][2] + 0.03 && lm3[152][1] < lm3[10][1] - 0.15, 'face points the right way up and out');

// the brow points the painted eyebrows use sit above the eyes and below the forehead's top
for (const i of [107, 66, 105, 63, 70, 336, 296, 334, 293, 300]) assert.ok(lm3[i][1] > ey + 0.01 && lm3[i][1] < lm3[10][1], `brow point ${i} above the eye`);
// a "photo" that is the head's own front view (scaled, shifted, v down) changes nothing
const photo = lm3.map(([x, y]) => [0.5 + x * 3, 0.5 - y * 3 + 4.9]);
const n = COUNTS.body + COUNTS.eyes, N = new Float32Array(P.length);
for (let i = 0; i < P.length; i += 3) N[i + 2] = 1; // facing forward is enough here
let off = faceMorph(P, N, n, lm3, photo, [EYES.l, EYES.r]);
assert.ok(Math.max(...off.map(Math.abs)) < 1e-6, 'own photo, no change');
// a face that is 10% wider widens the cheeks and leaves the back of the head alone
const wide = lm3.map(([x, y]) => [0.5 + x * 3.3, 0.5 - y * 3 + 4.9]);
off = faceMorph(P, N, n, lm3, wide, [EYES.l, EYES.r]);
const cheek = lm3[234], i234 = (() => { let b = -1, d = Infinity; for (let v = 0; v < COUNTS.body; v++) { const e = Math.hypot(P[v * 3] - cheek[0], P[v * 3 + 1] - cheek[1], P[v * 3 + 2] - cheek[2]); if (e < d) { d = e; b = v; } } return b; })();
assert.ok(Math.sign(off[i234 * 3]) === Math.sign(P[i234 * 3]) && Math.abs(off[i234 * 3]) > 0.002, 'cheek moves out');
let feet = 0; for (let v = 0; v < COUNTS.body; v++) if (P[v * 3 + 1] < 1) feet = Math.max(feet, Math.abs(off[v * 3]));
assert.equal(feet, 0, 'nothing below the head moves');

// where each vertex takes its colour: some of the face, none of the eyes or the back of the head
const attr = faceAttribute(P, N, n, lm3, photo, (v) => v >= COUNTS.body);
let shown = 0; for (let v = 0; v < n; v++) if (attr[v * 3 + 2] > 0.05) { shown++; assert.ok(v < COUNTS.body, 'not on the eyes'); assert.ok(P[v * 3 + 1] > ey - 0.2, 'only the head'); }
assert.ok(shown > 300, 'face covers the front of the head');

// the detail texture is about 1 (127) on an even face, and keeps a dark spot dark
const S = 64, rgba = new Uint8ClampedArray(S * S * 4).fill(180), mask = new Float32Array(S * S).fill(1);
rgba[(32 * S + 32) * 4] = rgba[(32 * S + 32) * 4 + 1] = rgba[(32 * S + 32) * 4 + 2] = 40;
const d = detailTexture(rgba, mask, S, 4);
assert.ok(Math.abs(d.pixels[(5 * S + 5) * 4] - 127) <= 2, 'even skin is about 1');
assert.ok(d.pixels[(32 * S + 32) * 4] < 60, 'a dark spot stays dark');
console.log('PASS face-fit-unit: triangles, face points on the head, own photo changes nothing, wider face widens, colour only on the face, detail texture');
