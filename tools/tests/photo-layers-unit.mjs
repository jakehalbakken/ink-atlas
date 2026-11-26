// photo-layers.js: one layer per tattoo on a photo. Run: node tools/tests/photo-layers-unit.mjs
import assert from 'node:assert/strict';
import { inkBox, cropBox, fillTri, growOwners, splitInk, still, moved, layerMatrix, toLayer, corners, touches, pick, groupCentre, moveOne, moveAll, twoFinger, centreOf, MAX_S } from '../../src/photo-layers.js';

const near = (a, b, e = 1e-6, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} vs ${b}`);

// a 40 x 30 white picture with a black block at x 10..14, y 5..9
const W = 40, H = 30, px = new Uint8ClampedArray(W * H * 4).fill(255);
for (let y = 5; y < 10; y++) for (let x = 10; x < 15; x++) { const i = (y * W + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
const box = inkBox(px, W, H, 2);
assert.deepEqual(box, { x: 8, y: 3, w: 9, h: 9 }, 'box round the ink, padded');
assert.equal(inkBox(new Uint8ClampedArray(W * H * 4).fill(255), W, H), null, 'no ink, no box');
const cut = cropBox(px, W, box);
assert.equal(cut.length, 9 * 9 * 4);
assert.equal(cut[(2 * 9 + 2) * 4], 0, 'the cut starts at the box corner');
assert.equal(cut[0], 255);

// the matrix and its inverse agree, through a turn and a size
const L = { id: 'a', x: 100, y: 50, w: 40, h: 20, nudge: { x: 7, y: -3, r: 0.6, s: 1.7 }, shown: true };
const m = layerMatrix(L);
for (const [x, y] of [[0, 0], [40, 0], [13, 17], [20, 10]]) {
  const p = { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }, q = toLayer(L, p.x, p.y);
  near(q.x, x, 1e-6, 'inverse x'); near(q.y, y, 1e-6, 'inverse y');
}
const c = centreOf(L), mid = { x: m[0] * 20 + m[2] * 10 + m[4], y: m[1] * 20 + m[3] * 10 + m[5] };
near(mid.x, c.x); near(mid.y, c.y);
// with no nudge, the layer sits exactly where it was cut from
const S = { ...L, nudge: still() };
assert.deepEqual(corners(S).map((p) => [Math.round(p.x), Math.round(p.y)]), [[100, 50], [140, 50], [140, 70], [100, 70]]);
assert.equal(moved(still()), false); assert.equal(moved({ x: 0, y: 0, r: 0, s: 1.1 }), true);

// picking: ink under the finger first, then the topmost box, hidden layers never
const ink = (layer, x, y) => layer.ink(x, y);
const A = { id: 'A', x: 0, y: 0, w: 100, h: 100, nudge: still(), shown: true, ink: (x, y) => x < 10 && y < 10 };
const B = { id: 'B', x: 50, y: 50, w: 100, h: 100, nudge: still(), shown: true, ink: (x, y) => x > 80 && y > 80 };
assert.equal(pick([A, B], 5, 5, 0, ink).id, 'A', 'ink of the lower one wins over the box of the upper one');
assert.equal(pick([A, B], 60, 60, 0, ink).id, 'B', 'no ink there: the topmost box');
assert.equal(pick([A, B], 145, 145, 0, ink).id, 'B');
assert.equal(pick([A, B], 300, 300, 0, ink), null, 'outside everything');
assert.equal(pick([A, { ...B, shown: false }], 145, 145, 0, ink), null, 'a hidden layer is never picked');
// the photo screen's own layers carry no shown flag at all (it hands pick only the shown ones)
const bare = ({ shown, ...rest }) => rest;
assert.equal(pick([bare(A), bare(B)], 5, 5, 0, ink).id, 'A', 'a layer with no shown flag is pickable by its ink');
assert.equal(pick([bare(A), bare(B)], 60, 60, 0, ink).id, 'B', 'and by its box');
assert.equal(touches(A, 12, 12, 0, ink), false); assert.equal(touches(A, 12, 12, 4, ink), true, 'a finger near thin ink still counts');
// picked after it moved: the ink is where it is shown
const A2 = { ...A, nudge: { x: 200, y: 0, r: 0, s: 1 } };
assert.equal(pick([A2], 205, 5, 0, ink).id, 'A'); assert.equal(pick([A2], 5, 5, 0, ink), null);

// one layer: slide, turn and size from the start, size held
assert.deepEqual(moveOne(still(), { dx: 5, dy: -2 }), { x: 5, y: -2, r: 0, s: 1 });
assert.equal(moveOne({ x: 0, y: 0, r: 0, s: 3 }, { ds: 10 }).s, MAX_S, 'size held');

// all of them: turning a quarter about the middle of two layers swaps their places round it
const P = { id: 'P', x: 0, y: 0, w: 10, h: 10, nudge: still() }, Q = { id: 'Q', x: 90, y: 0, w: 10, h: 10, nudge: still() };
const g = groupCentre([P, Q]); near(g.x, 50); near(g.y, 5);
const starts = new Map([['P', still()], ['Q', still()]]);
const res = moveAll([P, Q], starts, g, { dr: Math.PI / 2 });
const pc = centreOf({ ...P, nudge: res.get('P') }), qc = centreOf({ ...Q, nudge: res.get('Q') });
near(pc.x, 50, 1e-9, 'P above the middle x'); near(pc.y, -40, 1e-9, 'P above the middle y'); near(qc.x, 50, 1e-9); near(qc.y, 50, 1e-9);
near(res.get('P').r, Math.PI / 2);
// doubling keeps their spacing doubled and both sizes doubled
const big = moveAll([P, Q], starts, g, { ds: 2 });
near(centreOf({ ...Q, nudge: big.get('Q') }).x - centreOf({ ...P, nudge: big.get('P') }).x, 180); near(big.get('P').s, 2); near(big.get('Q').s, 2);
// a size past the limit for one layer holds all of them at the same amount
const st2 = new Map([['P', { ...still(), s: 2 }], ['Q', still()]]);
const held = moveAll([P, Q], st2, g, { ds: 5 });
near(held.get('P').s, MAX_S); near(held.get('Q').s, MAX_S / 2, 1e-9, 'Q grows by the same amount');
// a plain slide moves every middle by the same amount
const sl = moveAll([P, Q], starts, g, { dx: 3, dy: 4 });
assert.deepEqual([sl.get('P').x, sl.get('P').y, sl.get('Q').x, sl.get('Q').y], [3, 4, 3, 4]);

// two fingers: slide of the middle, turn the short way round, size
const t = twoFinger({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 25 });
near(t.dx, 0); near(t.dy, 15); near(t.dr, Math.PI / 2); near(t.ds, 2);
near(twoFinger({ x: 0, y: 0 }, { x: -10, y: 0.001 }, { x: 0, y: 0 }, { x: -10, y: -0.001 }).dr, 0, 1e-3, 'across the back is a small turn');

// splitting one shared picture into layers: each layer is the shared pixels it owns, white elsewhere,
// so multiplying every layer back together gives the shared picture exactly
{
  const W2 = 60, H2 = 40, top = new Uint8ClampedArray(W2 * H2 * 4).fill(255);
  const paint = (x0, y0, x1, y1, v) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W2 + x) * 4; top[i] = Math.min(top[i], v); top[i + 1] = Math.min(top[i + 1], v); top[i + 2] = Math.min(top[i + 2], v); } };
  paint(5, 5, 25, 25, 40); paint(20, 10, 45, 30, 90); paint(50, 34, 53, 37, 120); // A, B overlapping A, a stray soft edge
  const ids = new Int16Array(W2 * H2).fill(-1), depth = new Float32Array(W2 * H2).fill(Infinity);
  const quad = (x0, y0, x1, y1, z, k) => { fillTri(x0, y0, z, x1, y0, z, x1, y1, z, k, ids, depth, W2, H2); fillTri(x0, y0, z, x1, y1, z, x0, y1, z, k, ids, depth, W2, H2); };
  quad(5, 5, 25, 25, 0.5, 0); quad(20, 10, 45, 30, 0.2, 1);  // B nearer, so it owns the overlap
  quad(30, 33, 49, 38, 0.6, 0);                                // A again, a little short of the stray ink
  assert.equal(ids[15 * W2 + 22], 1, 'the nearer tattoo owns the overlap');
  assert.equal(ids[15 * W2 + 10], 0);
  growOwners(ids, top, W2, H2);
  for (let i = 0; i < W2 * H2; i++) if (top[i * 4] < 250) assert.ok(ids[i] >= 0, 'every ink pixel has an owner');
  const back = new Float32Array(W2 * H2 * 3).fill(1);
  for (const k of [0, 1]) {
    const L = splitInk(top, ids, k, W2, H2); assert.ok(L, 'a layer per owner');
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) for (let c = 0; c < 3; c++) back[((L.y + y) * W2 + L.x + x) * 3 + c] *= L.px[(y * L.w + x) * 4 + c] / 255;
  }
  for (let i = 0; i < W2 * H2; i++) for (let c = 0; c < 3; c++) near(back[i * 3 + c] * 255, top[i * 4 + c], 1e-3, 'layers multiply back to the shared picture');
  assert.equal(splitInk(top, ids, 5, W2, H2), null, 'no ink owned, no layer');
}

console.log('PASS photo-layers: split by owner multiplies back exactly, ink boxes, cuts, matrix and inverse, picking by ink then box, one and all moves, size held, two fingers');
