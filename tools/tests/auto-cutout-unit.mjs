// Pixel rules for automatic cutout, without the model: a made-up confidence mask
// stands in for the segmenter.
import assert from 'node:assert/strict';
import { applyCutout, tapMask, regionAt, maxFilter, minFilter, resampleMask } from '../../src/auto-cutout.js';

// sliding filters match a brute-force version
{
  const w = 23, h = 17, src = Float32Array.from({ length: w * h }, (_, i) => Math.sin(i * 1.7) * 50 + (i % 7));
  for (const r of [1, 3, 9]) {
    const mx = maxFilter(src, w, h, r), mn = minFilter(src, w, h, r);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = -Infinity, b = Infinity;
      for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) { a = Math.max(a, src[j * w + i]); b = Math.min(b, src[j * w + i]); }
      assert.equal(mx[y * w + x], a); assert.equal(mn[y * w + x], b);
    }
  }
}
// resample keeps a constant and the size
{ const m = resampleMask(new Float32Array(16).fill(0.7), 4, 4, 9, 5); assert.equal(m.length, 45); assert.ok(m.every((v) => Math.abs(v - 0.7) < 1e-6)); }

// a skin-coloured picture with a dark ring tattoo at the centre and a dark blob in a corner
const w = 200, h = 160, data = new Uint8ClampedArray(w * h * 4), conf = new Float32Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const p = y * w + x, d = Math.hypot(x - 100, y - 80), ring = d > 22 && d < 30, blob = Math.hypot(x - 20, y - 20) < 10, light = 200 - x * 0.2;
  const c = ring || blob ? [30, 25, 25] : [light, light * 0.8, light * 0.65];
  data.set([...c, 255], p * 4);
  conf[p] = d < 40 ? 0.95 : blob ? 0.9 : 0.02; // the model found the tattoo disc and, separately, the blob
}
const before = data.slice();
// regionAt follows only the tapped shape
{ const r = regionAt(conf, w, h, 100, 80); assert.ok(r.count > 4000 && r.count < 5200, `disc size ${r.count}`); assert.equal(r.inside[20 * w + 20], 0, 'blob not included'); }
// a tap just outside still picks the nearest shape
{ const r = regionAt(conf, w, h, 100, 80 + 42); assert.ok(r.count > 4000); }

// keep what I tapped
{
  const { data: out } = applyCutout(data, w, h, [tapMask(conf, w, h, 100, 80)], 'subject');
  assert.deepEqual(data, before, 'input untouched');
  assert.equal(out[(80 * w + 100) * 4 + 3], 255, 'centre of the tapped shape kept');
  assert.equal(out[(80 * w + 126) * 4 + 3], 255, 'ring kept');
  assert.equal(out[(20 * w + 20) * 4 + 3], 0, 'other dark shape removed');
  assert.equal(out[(5 * w + 190) * 4 + 3], 0, 'background removed');
  assert.deepEqual([...out.slice((80 * w + 126) * 4, (80 * w + 126) * 4 + 3)], [30, 25, 25], 'colour kept');
}
// just the ink
{
  const { data: out, kept } = applyCutout(data, w, h, [tapMask(conf, w, h, 100, 80)], 'ink');
  assert.ok(kept > 500, `ink pixels ${kept}`);
  assert.ok(out[(80 * w + 126) * 4 + 3] > 200, 'ring is solid ink');
  assert.equal(out[(80 * w + 100) * 4 + 3], 0, 'bare skin inside the ring dropped');
  assert.equal(out[(20 * w + 20) * 4 + 3], 0, 'ink outside the tapped shape dropped');
  assert.deepEqual([...out.slice((80 * w + 126) * 4, (80 * w + 126) * 4 + 3)], [18, 20, 22]);
}
// nothing there
assert.throws(() => tapMask(new Float32Array(w * h), w, h, 100, 80), /Nothing found/);
// a shape with no dark ink in it
{ const plain = data.slice(); for (let p = 0; p < w * h; p++) plain.set([190, 150, 120, 255], p * 4); assert.throws(() => applyCutout(plain, w, h, [tapMask(conf, w, h, 100, 80)], 'ink'), /No dark ink/); }
assert.throws(() => tapMask(conf.subarray(1), w, h, 100, 80), /Invalid/);
// two taps add up: the blob joins the ring
{ const { data: out } = applyCutout(data, w, h, [tapMask(conf, w, h, 100, 80), tapMask(conf, w, h, 20, 20)], 'subject'); assert.equal(out[(20 * w + 20) * 4 + 3], 255, 'second tap added'); assert.equal(out[(80 * w + 126) * 4 + 3], 255, 'first tap kept'); assert.equal(out[(5 * w + 190) * 4 + 3], 0); }
// a solid filled shape much bigger than the local window still reads as ink
{
  const W = 300, H = 300, d = new Uint8ClampedArray(W * H * 4), c = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x, inS = Math.abs(x - 150) < 60 && Math.abs(y - 150) < 60; d.set(inS ? [25, 22, 22, 255] : [210, 170, 140, 255], p * 4); c[p] = Math.abs(x - 150) < 100 && Math.abs(y - 150) < 100 ? 0.95 : 0.01; }
  const { data: out } = applyCutout(d, W, H, [tapMask(c, W, H, 150, 150)], 'ink');
  assert.ok(out[(150 * W + 150) * 4 + 3] > 200, 'centre of a big solid fill is ink');
  assert.equal(out[(150 * W + 230) * 4 + 3], 0, 'skin around it is not');
}
console.log('PASS auto cutout pixel rules: filters, tapped shape only, subject keep, ink lift, refusals');
