// Long hair hanging in a still pose (src/bend.js): a strand keeps its length whether the chest
// comes nearer the skull (slack falls down, no sideways flare) or moves away (no stretching),
// and with no move it stays exactly where it was.
// Run: node tools/tests/bend-unit.mjs
import assert from 'node:assert/strict';
import { hangStrands } from '../../src/bend.js';

const pts = 10, per = pts * 2, seg = 0.02;
const R = new Float32Array(per * 3), F = new Float32Array(per);
for (let j = 0; j < pts; j++) for (const e of [0, 1]) { const v = j * 2 + e; R[v * 3] = e ? 0.001 : -0.001; R[v * 3 + 1] = -seg * j; R[v * 3 + 2] = 0.2; F[v] = j / (pts - 1); }
const hang = { per, strands: 1, rest: R, follow: F, collide: { nb: [0, -1, -1], nt: [0, -0.9, -1], c: [0, -0.8, -1], rn: 0.01, rh: 0.01 } };
const move = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const centre = (o, j) => [0, 1, 2].map((k) => (o[j * 6 + k] + o[j * 6 + 3 + k]) / 2);
const length = (o) => { let L = 0; for (let j = 1; j < pts; j++) { const a = centre(o, j - 1), b = centre(o, j); L += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); } return L; };
const run = (m) => hangStrands(hang, m, new Float32Array(per * 3));

// no move: exactly the rest strand
const still = run(move(0, 0, 0));
for (let i = 0; i < R.length; i++) assert.ok(Math.abs(still[i] - R[i]) < 1e-6, 'no move keeps the strand where it was');

// chest 5 cm up against the skull, and a little to the side: slack
const slack = run(move(0.03, 0.05, 0));
assert.ok(Math.abs(length(slack) - seg * (pts - 1)) < 1e-4, 'slack: the strand keeps its length, ' + length(slack));
const end = centre(slack, pts - 1);
assert.ok(end[1] <= -seg * (pts - 1) + 0.05 + 1e-6, 'slack: the spare length falls down, not past the end');
assert.ok(end[0] <= 0.031, 'slack: no flare out sideways past where the end wants to be, ' + end[0]);

// chest 5 cm down, away from the skull: no stretching
const away = run(move(0, -0.05, 0));
assert.ok(Math.abs(length(away) - seg * (pts - 1)) < 1e-4, 'stretch: the strand keeps its length, ' + length(away));
assert.ok(centre(away, 0)[1] === centre(still, 0)[1], 'the root stays on the scalp');
console.log('bend-unit: ok');
