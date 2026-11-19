// Selection and transform maths for Clean up (src/cleanup-select.js). Run: node tools/tests/cleanup-select-unit.mjs
import assert from 'node:assert/strict';
import { rectMask, lassoMask, pieceMask, combineMasks, invertMask, isEmptyMask, maskBounds, identityFor, placePoint, pieceToLocal, placedBounds, growPads, snapStraight, snapTurn, twoFingerTransform, moveWords } from '../../src/cleanup-select.js';

const W = 40, H = 20, count = (m) => m.reduce((n, v) => n + (v ? 1 : 0), 0);
// a box drawn either way
assert.equal(count(rectMask(W, H, { x: 5, y: 2, w: 10, h: 6 })), 60);
assert.deepEqual(rectMask(W, H, { x: 15, y: 8, w: -10, h: -6 }), rectMask(W, H, { x: 5, y: 2, w: 10, h: 6 }));
assert.equal(count(rectMask(W, H, { x: -10, y: -10, w: 100, h: 100 })), W * H, 'clipped to the picture');
// a lasso square and triangle
const sq = lassoMask(W, H, [{ x: 2, y: 2 }, { x: 12, y: 2 }, { x: 12, y: 12 }, { x: 2, y: 12 }]);
assert.equal(count(sq), 100); assert.deepEqual(maskBounds(sq, W, H), { x: 2, y: 2, w: 10, h: 10 });
const tri = lassoMask(W, H, [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }]);
assert(count(tri) > 180 && count(tri) < 220, 'a triangle is about half its box: ' + count(tri));
assert.equal(count(lassoMask(W, H, [{ x: 1, y: 1 }, { x: 5, y: 5 }])), 0, 'two points select nothing');

// two pieces side by side, like a mirrored tattoo: a tap picks one half
const px = new Uint8ClampedArray(W * H * 4), ink = (x0, x1, y0, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px[(y * W + x) * 4 + 3] = 255; };
ink(4, 14, 4, 16); ink(22, 32, 4, 16); ink(17, 18, 10, 11); // a speck 3 px from the left half
const left = pieceMask(px, W, H, 8, 8);
assert.equal(count(left), 120, 'the left half alone'); assert.equal(left[10 * W + 25], 0, 'not the right half');
assert.equal(count(pieceMask(px, W, H, 8, 8, 3)), 121, 'a speck within 3 px comes along');
assert.equal(count(pieceMask(px, W, H, 2, 8)), 120, 'a tap just beside the ink takes the nearest piece');
assert.equal(pieceMask(px, W, H, 38, 1, 2, 3), null, 'nothing near: nothing');
assert(count(pieceMask(px, W, H, 8, 8, 10)) >= 241, 'a wide reach joins both halves');

// add, take away, invert
const right = pieceMask(px, W, H, 25, 8), both = combineMasks(left, right, 'add');
assert.equal(count(both), 240); assert.equal(count(combineMasks(both, left, 'subtract')), 120);
assert.equal(combineMasks(left, null, 'new'), null); assert.equal(combineMasks(null, left, 'subtract'), null);
assert.equal(count(invertMask(left)), W * H - 120); assert(isEmptyMask(new Uint8Array(4))); assert(isEmptyMask(null));
assert.deepEqual(maskBounds(null, W, H, px), { x: 4, y: 4, w: 28, h: 12 }, 'whole picture ink bounds');
assert.equal(maskBounds(new Uint8Array(W * H), W, H), null);

// transform: placing and back
const T0 = identityFor({ x: 4, y: 4, w: 10, h: 12 }); assert.deepEqual([T0.cx, T0.cy], [9, 10]);
const T = { ...T0, cx: 30, cy: 12, s: 2, rot: Math.PI / 3, fx: -1, fy: 1 };
for (const [x, y] of [[0, 0], [10, 0], [3, 7]]) { const p = placePoint(T, 10, 12, x, y), q = pieceToLocal(T, 10, 12, p.x, p.y); assert(Math.abs(q.x - x) < 1e-9 && Math.abs(q.y - y) < 1e-9); }
assert.deepEqual(placedBounds(T0, 10, 12), { x0: 4, y0: 4, x1: 14, y1: 16 });
// moving the right half 6 px further right in a 40 px picture: grow 4 px a side
assert.deepEqual(growPads({ ...identityFor({ x: 22, y: 4, w: 10, h: 12 }), cx: 33 }, 10, 12, W, H), { px: 0, py: 0 });
assert.deepEqual(growPads({ ...identityFor({ x: 30, y: 4, w: 10, h: 12 }), cx: 39 }, 10, 12, W, H), { px: 4, py: 0 });
assert.deepEqual(growPads({ ...identityFor({ x: 0, y: 0, w: 10, h: 10 }), cx: -3, cy: 2 }, 10, 10, W, H), { px: 8, py: 3 });
// snapping
assert.deepEqual(snapStraight(50, 4), { dx: 50, dy: 0, axis: 'across' });
assert.deepEqual(snapStraight(-3, 40), { dx: 0, dy: 40, axis: 'up' });
assert.equal(snapStraight(30, 20).axis, null); assert.equal(snapStraight(30, 20, 7, true).axis, 'across');
assert.equal(snapTurn(Math.PI / 2 + 0.03), Math.PI / 2); assert.equal(snapTurn(0.3), 0.3);
// two fingers spread twice as far and turn a quarter: the piece doubles and turns about their middle
const t2 = twoFingerTransform({ ...T0, cx: 10, cy: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -2 }, { x: 0, y: 2 });
assert(Math.abs(t2.s - 2) < 1e-9 && Math.abs(t2.rot - Math.PI / 2) < 1e-9 && Math.abs(t2.cx) < 1e-9 && Math.abs(t2.cy - 20) < 1e-9, JSON.stringify(t2));
// words
assert.equal(moveWords(T0, { ...T0, cx: T0.cx + 50 }, 100, 50, 100), 'Moved 0.50 in right · 1.00 × 0.50 in');
assert.equal(moveWords(T0, { ...T0, cy: T0.cy - 12, s: 1.5, rot: -Math.PI / 2, fx: -1 }, 10, 10, 0), 'Moved 12 px up · 15 × 15 px (150%) · turned -90° · flipped across');
console.log('PASS cleanup-select-unit: box, lasso, tap a piece, add and take away, transform maths, grow to fit, snapping, words');
