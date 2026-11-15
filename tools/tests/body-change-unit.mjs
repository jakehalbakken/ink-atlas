// If your body changes: shapes stay in range, skin growth is the square root of the area ratio, and
// the words read plainly.
import assert from 'node:assert/strict';
import { BODY_CHANGES, changedShape, skinGrowth, growthWords, changeLine } from '../../src/body-change.js';

assert.deepEqual(changedShape({ muscle: 0.5, weight: 0.5 }, BODY_CHANGES[2]), { muscle: 0.5, weight: 1 });
assert.deepEqual(changedShape({ muscle: 0.9, weight: 0.1 }, { muscle: 0.3, weight: -0.25 }), { muscle: 1, weight: 0 });
assert.deepEqual(changedShape({}, BODY_CHANGES[0]), { muscle: 0.5, weight: 0.5 });
// one square of two triangles, scaled by 1.1 each way: grows 10%
const A = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], B = A.map((v) => v * 1.1), I = [0, 1, 2, 0, 2, 3];
assert.ok(Math.abs(skinGrowth(A, B, I, [0, 1]) - 1.1) < 1e-9);
assert.ok(Math.abs(skinGrowth(A, B, I, [0, 0, 1]) - 1.1) < 1e-9, 'a triangle listed twice counts once');
assert.equal(skinGrowth(A, A, I, []), 1);
// stretched one way only: the area grows 21%, so about 10% each way
const C = A.map((v, i) => (i % 3 === 0 ? v * 1.21 : v));
assert.ok(Math.abs(skinGrowth(A, C, I, [0, 1]) - 1.1) < 1e-9);
assert.equal(growthWords(1.004), 'about the same');
assert.equal(growthWords(1.08), '8% bigger');
assert.equal(growthWords(0.95), '5% smaller');
const line = changeLine([{ key: 'slim', growth: 0.95 }, { key: 'heavy', growth: 1.07 }, { key: 'muscle', growth: 1.02 }]);
assert.equal(line, 'It grows and shrinks with the skin: 7% bigger if you gain weight, 5% smaller if you lose some, 2% bigger with more muscle.');
assert.ok(/keeps its shape well/.test(changeLine([{ key: 'heavy', growth: 1.01 }])));
assert.ok(/changes a lot/.test(changeLine([{ key: 'heavy', growth: 1.15 }])));
assert.equal(changeLine([]), '');
console.log('body-change-unit ok');
