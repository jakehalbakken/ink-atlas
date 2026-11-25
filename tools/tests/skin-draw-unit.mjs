// Drawing right on the skin in a layer: the pure maths in src/skin-draw-math.js.
// Run: node tools/tests/skin-draw-unit.mjs
import assert from 'node:assert/strict';
import { artSize, uvToArt, dabRadius, dabsAlong, smoothPoint, dabRect, clampRect, unionRect, areaBox, softenMask, closeGaps, StrokeHistory, alphaBounds, padBox } from '../../src/skin-draw-math.js';
const near = (a, b, e = 1e-6, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} vs ${b}`);

// picture size: sharp for a small piece, capped for a big one, never under 4 px a mm
{ const a = artSize(50, 25); assert.equal(a.pxPerMm, 16); assert.deepEqual([a.w, a.h], [800, 400]);
  const b = artSize(300, 100); assert.equal(b.w, 1600); near(b.pxPerMm, 1600 / 300, 1e-9); assert.equal(b.h, Math.round(100 * 1600 / 300));
  const c = artSize(900, 10); assert.equal(c.pxPerMm, 4); assert.equal(c.w, 1600); assert.ok(c.h >= 16);
  const d = artSize(NaN, 0); assert.ok(d.w >= 16 && d.h >= 16); }

// texture point to picture pixel, with the margin; a mirrored tattoo reads the other side
{ const M = 0.04, s = 1 - 2 * M;
  assert.deepEqual(uvToArt(0.5, 0.5, 200, 100, M), [100, 50]);
  const p = uvToArt(M + 0.25 * s, M + 0.75 * s, 200, 100, M); near(p[0], 50, 1e-9); near(p[1], 75, 1e-9);
  const q = uvToArt(M + 0.25 * s, M + 0.75 * s, 200, 100, M, true); near(q[0], 150, 1e-9); near(q[1], 75, 1e-9);
  assert.equal(uvToArt(0.001, 0.5, 200, 100, M), null, 'outside the picture');
  assert.equal(uvToArt(0.5, 0.5, 200, 100, 0.5), null, 'no picture when the margin eats it'); }

// pressure: the pencil thins most, no pressure draws at most of the size
{ assert.ok(dabRadius(10, 0.1, 'pencil') < dabRadius(10, 0.1, 'brush'));
  near(dabRadius(10, 1, 'pencil'), 5); near(dabRadius(10, 1, 'brush'), 5); near(dabRadius(10, 1, 'eraser'), 5);
  near(dabRadius(10, NaN, 'pencil'), 5 * (0.25 + 0.75 * 0.7)); near(dabRadius(10, 0, 'area'), 5);
  assert.ok(dabRadius(0.1, 0.01, 'pencil') >= 0.5, 'never vanishes'); }

// dabs along a stroke: evenly spaced, carry joins two pieces without a gap or a double
{ const a = { x: 0, y: 0, r: 2 }, b = { x: 10, y: 0, r: 4 };
  const one = dabsAlong(a, b, 2, 0); assert.deepEqual(one.dabs.map((d) => d.x), [2, 4, 6, 8, 10]); near(one.dabs[4].r, 4); near(one.carry, 0);
  const c = { x: 13, y: 0, r: 4 }, two = dabsAlong(b, c, 2, one.carry); assert.deepEqual(two.dabs.map((d) => d.x), [12]); near(two.carry, 1);
  const three = dabsAlong(c, { x: 14, y: 0, r: 4 }, 2, two.carry); assert.deepEqual(three.dabs.map((d) => d.x), [14]);
  const still = dabsAlong(c, c, 2, 1.3); assert.equal(still.dabs.length, 0); near(still.carry, 1.3, 1e-12, 'a still pen keeps its carry');
  const fine = dabsAlong(a, { x: 1, y: 0, r: 2 }, 0.01, 0); assert.ok(fine.dabs.length <= 3, 'spacing has a floor'); }

// smoothing follows part of the way
{ assert.deepEqual(smoothPoint(null, { x: 3, y: 4, r: 1 }), { x: 3, y: 4, r: 1 });
  const s = smoothPoint({ x: 0, y: 0, r: 1 }, { x: 10, y: 0, r: 1 }, 0.35); near(s.x, 6.5);
  near(smoothPoint({ x: 0, y: 0, r: 1 }, { x: 10, y: 0, r: 1 }, 0).x, 10); }

// rectangles
{ assert.deepEqual(dabRect(5, 5, 2, 100, 100), [1, 1, 8, 8]);
  assert.deepEqual(dabRect(1, 1, 3, 100, 100), [0, 0, 6, 6]);
  assert.equal(clampRect([200, 0, 10, 10], 100, 100), null);
  assert.deepEqual(unionRect([0, 0, 5, 5], [10, 2, 5, 5]), [0, 0, 15, 7]);
  assert.deepEqual(unionRect(null, [1, 2, 3, 4]), [1, 2, 3, 4]); assert.equal(unionRect(null, null), null); }

// the box round the chosen skin, as half widths from the middle
{ const M = 0.04, s = 1 - 2 * M, U = (x, y) => [M + x * s, M + y * s];
  const uvs = [...U(0.4, 0.4), ...U(0.6, 0.4), ...U(0.5, 0.7), ...U(0, 0), ...U(1, 0), ...U(1, 1)];
  const b = areaBox(uvs, [7, 9], new Set([7]), M); near(b.hx, 0.1, 1e-9); near(b.hy, 0.2, 1e-9); assert.equal(b.n, 3);
  assert.equal(areaBox(uvs, [7, 9], new Set([3]), M), null); }

// the soft edge: a hard step becomes a ramp, the inside stays full, a thin gap closes
{ const W = 40, H = 10, A = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < 20; x++) A[y * W + x] = 255;
  const s = softenMask(A, W, H, 2); assert.equal(s[5 * W + 5], 255); assert.equal(s[5 * W + 35], 0);
  assert.ok(s[5 * W + 19] > 64 && s[5 * W + 19] < 255 && s[5 * W + 20] > 0 && s[5 * W + 20] < 191, 'a ramp at the edge');
  assert.equal(softenMask(A, W, H, 0), A);
  const G = Uint8ClampedArray.from(A); for (let y = 0; y < H; y++) G[y * W + 10] = 0;
  const shut = closeGaps(G, W, H, 2); assert.equal(shut[5 * W + 10], 255, 'a one pixel gap closes'); assert.equal(shut[5 * W + 30], 0, 'empty stays empty'); }

// undo budget: old steps drop off, never the newest; a new stroke clears redo
{ const step = (n, word) => ({ word, patches: [{ on: 'art', rect: [0, 0, 1, 1], before: { data: new Uint8ClampedArray(n) }, after: { data: new Uint8ClampedArray(n) } }] });
  const h = new StrokeHistory(1000);
  h.push(step(100, 'a')); h.push(step(100, 'b')); assert.equal(h.count, 2); assert.equal(h.bytes, 400);
  assert.equal(h.undo().word, 'b'); assert.ok(h.canRedo); assert.equal(h.redo().word, 'b'); assert.ok(!h.canRedo);
  h.undo(); h.push(step(100, 'c')); assert.ok(!h.canRedo); assert.equal(h.bytes, 400, 'redo steps given back');
  h.push(step(400, 'big')); assert.equal(h.done[0].word, 'c', 'the oldest went'); assert.ok(h.bytes <= 1000);
  h.push(step(5000, 'huge')); assert.equal(h.count, 1, 'the newest is always kept'); assert.equal(h.done[0].word, 'huge');
  const e = new StrokeHistory(); assert.equal(e.undo(), null); assert.equal(e.redo(), null); assert.ok(!e.canUndo); }

// what was drawn, and room round it
{ const W = 10, H = 8, d = new Uint8ClampedArray(W * H * 4);
  assert.equal(alphaBounds(d, W, H), null);
  d[(3 * W + 4) * 4 + 3] = 255; d[(5 * W + 6) * 4 + 3] = 9; d[(7 * W + 9) * 4 + 3] = 7;
  assert.deepEqual(alphaBounds(d, W, H), { x: 4, y: 3, w: 3, h: 3 });
  assert.deepEqual(padBox({ x: 4, y: 3, w: 3, h: 3 }, 2, W, H), { x: 2, y: 1, w: 7, h: 7 });
  assert.deepEqual(padBox({ x: 0, y: 0, w: 10, h: 8 }, 5, W, H), { x: 0, y: 0, w: 10, h: 8 }); }

console.log('skin-draw-unit: ok');
