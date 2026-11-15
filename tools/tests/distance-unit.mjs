// From a distance maths: the detail an eye sees grows with distance, the shrink for a picture,
// the line from the finest lines and gaps, and the narrowest gap ink check now measures.
import assert from 'node:assert/strict';
import { EYE_RAD, DISTANCES, detailMm, seenUpTo, shrinkFor, distanceText } from '../../src/distance.js';
import { inkCheck } from '../../src/ink-check.js';

assert.ok(Math.abs(detailMm(1) - 0.436) < 0.01, '1 m: about 0.44 mm');
assert.ok(Math.abs(detailMm(3) - 3 * detailMm(1)) < 1e-9, 'three times as far, three times the detail');
assert.ok(Math.abs(seenUpTo(detailMm(2.5)) - 2.5) < 1e-9, 'seenUpTo undoes detailMm');
assert.equal(shrinkFor(0.2, 0.3), 1, 'close up nothing is lost at 0.2 mm pixels');
assert.ok(Math.abs(shrinkFor(0.2, 9) - 0.2 / detailMm(9)) < 1e-12 && shrinkFor(0.2, 9) < 0.06, 'across the street a lot is lost');
assert.deepEqual(DISTANCES.map((d) => d.m), [0.3, 0.9, 3, 9]);
assert.ok(EYE_RAD > 0.0004 && EYE_RAD < 0.0005);

// lines
assert.equal(distanceText(null, null), null);
let r = distanceText(0.4, 1.2);
assert.match(r.text, /lines and gaps \(about 0\.4 mm\) run together from about 3 ft \(90 cm\)/, r.text);
assert.ok(Math.abs(r.upTo - 0.4 / 0.436) < 0.02);
r = distanceText(0.2, null); assert.match(r.text, /lines \(about 0\.2 mm\) run together past arm’s length/, r.text);
r = distanceText(null, 2); assert.match(r.text, /^Its finest gaps .* from about 15 ft \(4\.6 m\)/, r.text);
r = distanceText(6, 5); assert.equal(r.text, 'Its finest lines and gaps stay clear even from across the street.');
for (const v of [0.1, 0.3, 0.8, 1.5, 3, 4, 8]) { const x = distanceText(v, v * 1.3); assert.doesNotMatch(x.text, /NaN|undefined/); assert.ok(x.text.length < 160); }

// ink check: two bold lines 0.6 mm apart, a third far off
const W = 300, H = 200, pxMm = 0.1;
const a = new Uint8ClampedArray(W * H * 4); for (let p = 0; p < W * H; p++) a.set([255, 255, 255, 255], p * 4);
const rect = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a.set([0, 0, 0, 255], (y * W + x) * 4); };
rect(20, 20, 40, 180); rect(46, 20, 66, 180); rect(150, 20, 170, 180);
const c = inkCheck(a, W, H, { pxMm, skin: [232, 196, 170] });
assert.ok(c.gapP10Mm != null && Math.abs(c.gapP10Mm - 0.6) < 0.15, 'narrowest gap about 0.6 mm: ' + c.gapP10Mm);
// one solid block: no gaps inside
const b = new Uint8ClampedArray(W * H * 4); for (let p = 0; p < W * H; p++) b.set([255, 255, 255, 255], p * 4);
for (let y = 40; y < 160; y++) for (let x = 40; x < 260; x++) b.set([0, 0, 0, 255], (y * W + x) * 4);
const d = inkCheck(b, W, H, { pxMm, skin: [232, 196, 170] });
assert.ok(d.gapP10Mm == null || d.gapP10Mm > 2, 'a solid block has no fine gaps: ' + d.gapP10Mm);
console.log('distance-unit ok');
// softening: a one-pixel line spreads and keeps its total; a flat picture stays flat; tiny detail is left alone
{
  const { softenRGBA } = await import('../../src/distance.js');
  const w = 60, h = 20, a = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) a.set([200, 200, 200, 255], p * 4);
  for (let y = 0; y < h; y++) a.set([0, 0, 0, 255], (y * w + 30) * 4);
  const before = a.slice(); softenRGBA(a, w, h, 8);
  const row = (x) => a[(10 * w + x) * 4];
  assert.ok(row(30) > 100 && row(30) < 200, 'the line is lighter: ' + row(30));
  assert.ok(row(27) < 200 && row(33) < 200, 'and wider');
  assert.equal(row(5), 200, 'far skin unchanged');
  let s0 = 0, s1 = 0; for (let x = 0; x < w; x++) { s0 += before[(10 * w + x) * 4]; s1 += a[(10 * w + x) * 4]; }
  assert.ok(Math.abs(s0 - s1) < w * 1.5, 'ink is spread, not lost');
  const b = before.slice(); softenRGBA(b, w, h, 1); assert.deepEqual(b, before, 'detail of a pixel is left alone');
}
console.log('distance-unit soften ok');
