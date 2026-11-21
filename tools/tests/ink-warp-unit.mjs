// Warp maths (src/ink-warp.js): an untouched grid is exactly flat and is not kept, a dragged point is
// where the surface goes through, saves are cleaned, regrid keeps the shape, Distort keeps straight
// lines straight, Arc keeps the middle line's length, the box covers the shape, and the pixels come
// out where the warp puts them with no gaps between the grid's triangles.
import assert from 'node:assert/strict';
import { identityWarp, isIdentity, cleanWarp, warpAt, warpBounds, regrid, movePoint, distortCorner, cornerIndexes, arcWarp, renderWarp, warpCanvasSize, homography, applyH, convexQuad, hasWarp, describeWarp, warpKey } from '../../src/ink-warp.js';
const near = (a, b, e = 1e-9, m = '') => assert.ok(Math.abs(a - b) < e, `${m} ${a} vs ${b}`);

// identity is exact everywhere, for every grid size
for (const n of [3, 4, 5]) {
  const w = identityWarp(n); assert.ok(isIdentity(w)); assert.equal(cleanWarp(w), null, 'untouched grid is not kept');
  for (const [s, t] of [[0, 0], [0.13, 0.77], [0.5, 0.5], [1, 1], [0.999, 0.01]]) { const [x, y] = warpAt(w, s, t); near(x, s, 1e-12, 'x'); near(y, t, 1e-12, 'y'); }
  warpBounds(w).forEach((v, i) => near(v, [0, 0, 1, 1][i], 1e-9));
}
// a moved point is passed through exactly, and its neighbours' corners stay put
const w0 = identityWarp(4), w1 = movePoint(w0, 5, 0.5, 0.2);
{ const [x, y] = warpAt(w1, 1 / 3, 1 / 3); near(x, 0.5, 1e-12); near(y, 0.2, 1e-12); const [cx, cy] = warpAt(w1, 1, 1); near(cx, 1, 1e-12); near(cy, 1, 1e-12); }
assert.ok(hasWarp({ warp: w1 }) && !hasWarp({}) && !hasWarp({ warp: w0 }));
assert.ok(describeWarp(w1) && warpKey(w1).startsWith('4:'));
// cleaning: junk dropped, values clamped, sizes checked
assert.equal(cleanWarp(null), null); assert.equal(cleanWarp({ n: 6, p: [] }), null); assert.equal(cleanWarp({ n: 3, p: [1, 2] }), null);
assert.equal(cleanWarp({ n: 3, p: Array(18).fill(NaN) }), null);
{ const c = cleanWarp({ n: 3, p: [-9, 0, 0.5, 0, 1, 0, 0, 0.5, 0.5, 0.5, 1, 0.5, 0, 1, 0.5, 1, 1, 1] }); assert.equal(c.p[0], -1.5, 'clamped'); }
// regrid keeps the shape (a 4 grid's point at a third is also on the 5 grid's surface nearby)
{ const r = regrid(w1, 5); assert.equal(r.n, 5); const a = warpAt(w1, 0.5, 0.5), b = warpAt(r, 0.5, 0.5); near(a[0], b[0], 1e-9); near(a[1], b[1], 1e-9);
  const id5 = regrid(identityWarp(3), 5); assert.ok(isIdentity(id5)); }
// homography: corners land, convexity
{ const H = homography([[0, 0], [1, 0], [1, 1], [0, 1]], [[0.1, 0], [0.9, 0.1], [1.2, 1], [-0.1, 0.9]]); const [x, y] = applyH(H, 1, 1); near(x, 1.2, 1e-9); near(y, 1, 1e-9);
  assert.ok(convexQuad([[0, 0], [1, 0], [1, 1], [0, 1]])); assert.ok(!convexQuad([[0, 0], [1, 1], [1, 0], [0, 1]])); }
// distort: the corner moves, straight lines (the middle row) stay straight, crossing is refused
{
  const d = distortCorner(identityWarp(4), 2, 1.3, 1.2), idx = cornerIndexes(4);
  near(d.p[idx[2] * 2], 1.3, 1e-9); near(d.p[idx[2] * 2 + 1], 1.2, 1e-9); near(d.p[0], 0, 1e-9);
  const pts = [0, 0.25, 0.5, 0.75, 1].map((s) => warpAt(d, s, 0));
  for (const q of pts) near(q[1], 0, 1e-9, 'top edge stays on y=0'); // top edge's corners did not move
  // a diagonal line through the middle stays straight in perspective
  const L = [0, 0.3, 0.6, 1].map((s) => warpAt(d, s, s)), cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  assert.ok(Math.abs(cross(L[0], L[1], L[3])) < 0.01 && Math.abs(cross(L[0], L[2], L[3])) < 0.01, 'diagonal stays nearly straight');
  const bad = distortCorner(identityWarp(4), 2, -0.5, -0.5); assert.deepEqual(bad.p, identityWarp(4).p, 'a fold-over is refused');
}
// arc: the middle line keeps its length and curves up; zero is no change
{
  assert.ok(isIdentity(arcWarp(identityWarp(4), 0, 2)));
  const aspect = 2, a = arcWarp(identityWarp(5), 0.5, aspect);
  let len = 0, prev = null;
  for (let k = 0; k <= 200; k++) { const [x, y] = warpAt(a, k / 200, 0.5), p = [x * aspect, y]; if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
  near(len, aspect, 0.03 * aspect, 'middle line length kept');
  const mid = warpAt(a, 0.5, 0.5), end = warpAt(a, 0, 0.5); assert.ok(end[1] > mid[1] + 0.2, 'ends drop below the middle: it arches up');
  // the strongest arc on a square or a tall picture keeps the inside edge from folding through the middle
  for (const asp of [1, 0.5, 3]) { const f = arcWarp(identityWarp(5), 1, asp), mid = warpAt(f, 0.5, 1), top = warpAt(f, 0.5, 0);
    assert.ok(mid[1] > top[1] + 0.5, 'still the full height in the middle at aspect ' + asp);
    let prev = -Infinity; for (let k = 0; k <= 40; k++) { const x = warpAt(f, k / 40, 1)[0]; assert.ok(x > prev - 1e-9, 'the inside edge runs left to right, never folding, at aspect ' + asp); prev = x; } }
  const sag = arcWarp(identityWarp(5), -0.5, aspect); assert.ok(warpAt(sag, 0, 0.5)[1] < warpAt(sag, 0.5, 0.5)[1] - 0.2, 'negative sags');
}
// bounds cover the warped edges
{ const b = warpBounds(w1); assert.ok(b[0] <= 0 && b[2] >= 1 && b[1] <= 0.2 && b[3] >= 1);
  const big = movePoint(identityWarp(4), 15, 1.6, 1.4); const bb = warpBounds(big); near(bb[2], 1.6, 0.02); near(bb[3], 1.4, 0.02); }
// pixels: an untouched warp reproduces the source; a solid source has no holes after a strong warp
{
  const W = 32, H = 16, data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; data[o] = x * 8; data[o + 1] = y * 16; data[o + 2] = 100; data[o + 3] = 255; }
  const src = { data, width: W, height: H };
  const same = renderWarp(src, identityWarp(4), { width: W, height: H }, [0, 0, 1, 1]);
  let diff = 0; for (let k = 0; k < same.length; k++) diff = Math.max(diff, Math.abs(same[k] - data[k])); assert.ok(diff <= 2, 'identity reproduces the source, off by ' + diff);
  const flip = renderWarp(src, identityWarp(4), { width: W, height: H }, [0, 0, 1, 1], { flipY: true });
  assert.ok(Math.abs(flip[1] - data[((H - 1) * W) * 4 + 1]) <= 2, 'flipY reads the bottom row first');
  const solid = new Uint8ClampedArray(64 * 64 * 4).fill(255), ss = { data: solid, width: 64, height: 64 };
  let wv = identityWarp(4); wv = movePoint(wv, 5, 0.6, 0.15); wv = movePoint(wv, 10, 0.4, 0.95); wv = distortCorner(wv, 1, 1.3, -0.2);
  const box = warpBounds(wv), size = warpCanvasSize(box, 1, 200, 200), px = renderWarp(ss, wv, size, box);
  // every pixel well inside the warped shape is solid: test along the grid's middle lines
  let holes = 0; const fw = (s, t) => { const [x, y] = warpAt(wv, s, t); return [Math.floor((x - box[0]) / (box[2] - box[0]) * size.width), Math.floor((y - box[1]) / (box[3] - box[1]) * size.height)]; };
  for (let k = 2; k < 98; k++) for (const [s, t] of [[k / 100, 0.5], [0.5, k / 100], [k / 100, k / 100]]) { const [x, y] = fw(s, t); if (px[(y * size.width + x) * 4 + 3] < 250) holes++; }
  assert.equal(holes, 0, 'no holes inside a warped solid');
  // and the corner of the box outside the shape stays clear
  assert.ok(warpCanvasSize([0, 0, 2, 1], 1, 500, 1024).aspect === 2);
}
// speed: a full 1024 picture with a 5 grid is drawn quickly enough to follow a finger at preview size
{
  const S = 1024, data = new Uint8ClampedArray(S * S * 4).fill(200), w = movePoint(identityWarp(5), 12, 0.6, 0.6), box = warpBounds(w);
  const t0 = performance.now(); renderWarp({ data, width: S, height: S }, w, warpCanvasSize(box, 1, S, 384), box); const dt = performance.now() - t0;
  assert.ok(dt < 200, 'preview size drawn in ' + dt.toFixed(0) + ' ms');
}
console.log('ink-warp-unit ok');
