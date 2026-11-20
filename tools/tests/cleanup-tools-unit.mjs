// Unit checks for the Clean up toolbox maths (src/cleanup-tools.js). Run: node tools/tests/cleanup-tools-unit.mjs
import assert from 'node:assert/strict';
import { dabCoverage, strokeCoverage, compositeBrush, blurRGBA, blurMask, wandMask, growSimilar, selectSimilar, shiftEdge, smoothMask, refineMask, softInvert, borderColor, removeBackground, brightnessContrastLut, levelsLut, curveLut, threshold, sharpen, applyMasked, histogram, autoLevels, meanColor } from '../../src/cleanup-tools.js';

const pic = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(f(x, y), (y * w + x) * 4); return d; };
const px = (d, w, x, y) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];

// brushes: coverage only grows, so opacity caps per stroke
{
  const w = 40, h = 40, cov = new Uint8Array(w * h);
  const box = dabCoverage(cov, w, h, 20, 20, 8, 0);
  assert.deepEqual(box, { x0: 12, y0: 12, x1: 28, y1: 28 });
  assert.equal(cov[20 * w + 20], 255); assert.equal(cov[20 * w + 29], 0);
  const soft = new Uint8Array(w * h); dabCoverage(soft, w, h, 20, 20, 8, 1);
  assert(soft[20 * w + 20] > 240 && soft[20 * w + 25] > 0 && soft[20 * w + 25] < 200, 'soft edge fades');
  assert.equal(dabCoverage(cov, w, h, -50, -50, 4), null, 'a dab off the picture touches nothing');
  const line = new Uint8Array(w * h); const b2 = strokeCoverage(line, w, h, { x: 5, y: 20 }, { x: 35, y: 20 }, 3);
  for (let x = 5; x <= 35; x++) assert.equal(line[20 * w + x], 255, 'a stroke has no gaps at ' + x);
  assert(b2.x0 <= 2 && b2.x1 >= 38);
  const base = pic(w, h, () => [10, 20, 30, 255]), out = new Uint8ClampedArray(base);
  compositeBrush(out, base, line, w, h, b2, { kind: 'erase', opacity: 0.5 });
  assert.equal(px(out, w, 20, 20)[3], 128, 'half opacity erase leaves half');
  strokeCoverage(line, w, h, { x: 5, y: 20 }, { x: 35, y: 20 }, 3); compositeBrush(out, base, line, w, h, b2, { kind: 'erase', opacity: 0.5 });
  assert.equal(px(out, w, 20, 20)[3], 128, 'going over it again in the same stroke never goes past the opacity');
  assert.deepEqual(px(out, w, 20, 5), [10, 20, 30, 255], 'outside the stroke nothing changes');
  // a selection limits the change
  const sel = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < 20; x++) sel[y * w + x] = 255;
  const o2 = new Uint8ClampedArray(base); compositeBrush(o2, base, line, w, h, b2, { kind: 'erase', opacity: 1, sel });
  assert.equal(px(o2, w, 10, 20)[3], 0); assert.equal(px(o2, w, 30, 20)[3], 255, 'erase stops at the selection');
  // restore mixes back to the original
  const orig = pic(w, h, () => [200, 100, 50, 255]), clear = pic(w, h, () => [0, 0, 0, 0]), o3 = new Uint8ClampedArray(clear);
  compositeBrush(o3, clear, line, w, h, b2, { kind: 'restore', opacity: 1, orig });
  assert.deepEqual(px(o3, w, 20, 20), [200, 100, 50, 255], 'restore brings the original back, colour and all');
  // clone copies from the offset; heal matches the destination's light
  const two = pic(w, h, (x) => x < 20 ? [0, 0, 0, 255] : [240, 240, 240, 255]), cov2 = new Uint8Array(w * h), bb = dabCoverage(cov2, w, h, 30, 20, 4);
  const o4 = new Uint8ClampedArray(two); compositeBrush(o4, two, cov2, w, h, bb, { kind: 'clone', src: two, offset: { x: 20, y: 0 } });
  assert.deepEqual(px(o4, w, 30, 20), [0, 0, 0, 255], 'clone paints the source 20 px to the left');
  const dot = pic(w, h, (x, y) => (x === 10 && y === 20) ? [0, 0, 0, 255] : x < 20 ? [100, 100, 100, 255] : [220, 220, 220, 255]);
  const lb = blurRGBA(dot, w, h, 6), o5 = new Uint8ClampedArray(dot), c5 = new Uint8Array(w * h), b5 = dabCoverage(c5, w, h, 30, 20, 3);
  compositeBrush(o5, dot, c5, w, h, b5, { kind: 'heal', src: dot, lowBase: lb, lowSrc: lb, offset: { x: 20, y: 0 } });
  assert(px(o5, w, 31, 20)[0] > 180, 'heal takes the texture but keeps the light round it: ' + px(o5, w, 31, 20));
}
// blur keeps clear pixels from darkening edges; mask blur feathers
{
  const w = 30, h = 30, d = pic(w, h, (x) => x < 15 ? [255, 0, 0, 255] : [0, 0, 0, 0]), b = blurRGBA(d, w, h, 4);
  const e = px(b, w, 15, 15); assert(e[3] > 20 && e[3] < 235, 'alpha softens at the edge'); assert(e[0] > 245, 'colour stays pure red, no dark halo: ' + e);
  const m = new Uint8Array(w * h); for (let p = 0; p < m.length; p++) m[p] = (p % w) < 15 ? 255 : 0;
  const f = blurMask(m, w, h, 4); assert(f[15 * w + 2] === 255 && f[15 * w + 27] === 0 && f[15 * w + 15] > 10 && f[15 * w + 15] < 245);
  assert.deepEqual(blurRGBA(d, w, h, 0), d, 'radius 0 is a copy');
}
// magic wand, grow, similar
{
  const w = 20, h = 10, d = pic(w, h, (x, y) => x === 10 ? [0, 0, 0, 255] : (x < 10 ? [250, 250, 250, 255] : [245, 245, 245, 255]));
  const left = wandMask(d, w, h, 2, 2, 20, true), count = (m) => m.reduce((n, v) => n + (v ? 1 : 0), 0);
  assert.equal(count(left), 10 * 10, 'touching only stops at the black line');
  assert.equal(count(wandMask(d, w, h, 2, 2, 20, false)), 19 * 10, 'not touching takes both sides');
  assert.equal(count(wandMask(d, w, h, 2, 2, 2, false)), 10 * 10, 'a tight tolerance keeps only the exact colour');
  assert.equal(count(wandMask(d, w, h, 10, 5, 0, true)), 10, 'tapping the line takes the line');
  const clearPic = pic(w, h, (x) => x < 5 ? [0, 0, 0, 0] : [9, 9, 9, 255]); assert.equal(count(wandMask(clearPic, w, h, 0, 0, 10)), 50, 'clear pixels select clear pixels');
  const seed = new Uint8Array(w * h); seed[2 * w + 2] = 255;
  assert.equal(count(growSimilar(d, w, h, seed, 20)), 100, 'grow spreads over the touching matching colour');
  assert.equal(count(selectSimilar(d, w, h, seed, 20)), 190, 'similar takes matching colour anywhere');
  assert.deepEqual(meanColor(d, seed), [250, 250, 250, 255]);
}
// edge shift, smooth, refine, invert
{
  const w = 40, h = 40, m = new Uint8Array(w * h); for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) m[y * w + x] = 255;
  const count = (q) => q.reduce((n, v) => n + (v >= 128 ? 1 : 0), 0);
  const g = shiftEdge(m, w, h, 2); assert(g[9 * w + 20] && g[8 * w + 20] && !g[7 * w + 20], 'grows two pixels out');
  const s = shiftEdge(m, w, h, -3); assert(!s[12 * w + 20] && s[13 * w + 20], 'shrinks three pixels in'); assert.equal(count(s), 14 * 14);
  const speck = Uint8Array.from(m); speck[2 * w + 2] = 255; assert.equal(smoothMask(speck, w, h, 3)[2 * w + 2], 0, 'smooth drops a lone speck');
  const r = refineMask(m, w, h, { shift: 1, smooth: 1, feather: 3 }); assert(r[20 * w + 20] === 255 && r[20 * w + 9] > 0 && r[20 * w + 9] < 255, 'refine ends soft');
  assert.equal(softInvert(r)[20 * w + 20], 0); assert.equal(softInvert(r)[0], 255);
}
// background removal
{
  const w = 30, h = 30, d = pic(w, h, (x, y) => (x > 10 && x < 20 && y > 10 && y < 20) ? [20, 20, 25, 255] : (x === 15 && y === 3) ? [222, 180, 150, 255] : [225, 182, 152, 255]);
  assert.deepEqual(borderColor(d, w, h), { r: 225, g: 182, b: 152 });
  const out = removeBackground(d, w, h, { range: 20, soft: 10 });
  assert.equal(px(out, w, 2, 2)[3], 0, 'skin gone'); assert.equal(px(out, w, 15, 15)[3], 255, 'ink kept'); assert.equal(px(out, w, 15, 3)[3], 0, 'a near shade goes too');
  // edges only keeps the same colour enclosed by ink
  const ring = pic(w, h, (x, y) => { const r = Math.hypot(x - 15, y - 15); return r > 6 && r < 9 ? [10, 10, 10, 255] : [240, 240, 240, 255]; });
  const all = removeBackground(ring, w, h, { range: 20, soft: 10 }), edges = removeBackground(ring, w, h, { range: 20, soft: 10, edgesOnly: true });
  assert.equal(px(all, w, 15, 15)[3], 0); assert.equal(px(edges, w, 15, 15)[3], 255, 'inside the ring kept with edges only'); assert.equal(px(edges, w, 1, 1)[3], 0);
  assert.deepEqual(removeBackground(pic(4, 4, () => [0, 0, 0, 0]), 4, 4), pic(4, 4, () => [0, 0, 0, 0]), 'a clear edge has no background to remove');
}
// adjustments
{
  const lut = brightnessContrastLut(0, 0); for (let v = 0; v < 256; v++) assert.equal(lut[v], v, 'zero is no change');
  assert(brightnessContrastLut(50, 0)[100] > 150 && brightnessContrastLut(0, 50)[200] > 230 && brightnessContrastLut(0, 50)[60] < 30);
  const lv = levelsLut({ inBlack: 50, inWhite: 200 }); assert.equal(lv[50], 0); assert.equal(lv[200], 255); assert.equal(lv[125], 128);
  assert(levelsLut({ gamma: 2 })[64] > 100, 'a middle above 1 lightens'); assert.equal(levelsLut({ outBlack: 40, outWhite: 220 })[0], 40);
  const id = curveLut([{ x: 0, y: 0 }, { x: 255, y: 255 }]); for (let v = 0; v < 256; v++) assert.equal(id[v], v);
  const sc = curveLut([{ x: 0, y: 0 }, { x: 64, y: 40 }, { x: 192, y: 215 }, { x: 255, y: 255 }]);
  for (let v = 1; v < 256; v++) assert(sc[v] >= sc[v - 1], 'curves never go back down'); assert(sc[64] === 40 && sc[192] === 215);
  const t = threshold(pic(3, 1, (x) => [[20, 20, 20, 255], [127, 127, 127, 255], [240, 240, 240, 255]][x]), 128, 2);
  assert.deepEqual([...t.slice(0, 4)], [0, 0, 0, 255]); assert(t[7] > 150 && t[7] < 230, "just darker than the level is mostly kept"); assert.equal(t[11], 0);
  const edge = pic(10, 1, (x) => x < 5 ? [100, 100, 100, 255] : [150, 150, 150, 255]), sh = sharpen(edge, 10, 1, 1, 1);
  assert(sh[4 * 4] < 100 && sh[5 * 4] > 150, 'sharpen widens the step at the edge');
  const before = pic(2, 1, () => [0, 0, 0, 255]), after = pic(2, 1, () => [200, 200, 200, 255]), mixed = applyMasked(before, after, Uint8Array.from([255, 0]));
  assert.deepEqual([...mixed], [200, 200, 200, 255, 0, 0, 0, 255]); assert.equal(applyMasked(before, after, null), after);
  const bins = histogram(pic(4, 1, (x) => x < 2 ? [0, 0, 0, 255] : [255, 255, 255, 0])); assert.equal(bins[0], 2); assert.equal(bins[255], 0, 'clear pixels are not counted');
  const hb = new Uint32Array(256); for (let v = 30; v <= 220; v++) hb[v] = 10; assert.deepEqual(autoLevels(hb), { inBlack: 30, inWhite: 220 });
}
// speed at the workspace's full size
{
  const w = 1600, h = 1200, d = pic(w, h, (x, y) => ((x >> 4) + (y >> 4)) & 1 ? [230, 220, 210, 255] : [20, 20, 20, 255]);
  let t0 = performance.now(); blurRGBA(d, w, h, 8); const tb = performance.now() - t0;
  t0 = performance.now(); wandMask(d, w, h, 3, 3, 30, false); const tw = performance.now() - t0;
  t0 = performance.now(); shiftEdge(wandMask(d, w, h, 3, 3, 30, true), w, h, 4); const ts = performance.now() - t0;
  console.log(`1600x1200: blur ${tb.toFixed(0)} ms, wand ${tw.toFixed(0)} ms, shift edge ${ts.toFixed(0)} ms`);
  assert(tb < 3000 && tw < 1000 && ts < 2000);
}
console.log('PASS cleanup tools: brushes (opacity per stroke, selection, restore, clone, heal), blur, wand, grow, similar, shift edge, smooth, refine, background, adjustments, histogram');
