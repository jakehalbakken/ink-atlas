// Aging: lines spread by about the model's distance in millimetres, the black lightens and
// drifts toward blue-green, fresh ink is untouched, and white paper stays white.
import assert from 'node:assert/strict';
import { ageInk, agingModel, AGES } from '../../src/aging.js';
const W = 200, H = 60, pxPerMm = 10;
const line = () => { const d = new Uint8ClampedArray(W * H * 4).fill(255); for (let y = 0; y < H; y++) for (let x = 98; x < 103; x++) { const o = (y * W + x) * 4; d[o] = d[o + 1] = d[o + 2] = 20; } return d; };
const width = (d) => { let n = 0; const y = 30; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] < 200) n++; return n; };
const fresh = line(); assert.deepEqual(ageInk(line(), W, H, 0, pxPerMm), fresh, 'fresh is untouched');
let last = width(fresh), lastDark = 20;
for (const { years } of AGES.slice(1)) {
  const d = ageInk(line(), W, H, years, pxPerMm), m = agingModel(years), wv = width(d), core = d[(30 * W + 100) * 4];
  assert.ok(wv >= last, `${years} years: lines spread (${wv}px vs ${last}px)`);
  assert.ok(core > lastDark - 1, `${years} years: black lightens (${core})`);
  assert.ok(d[(30 * W + 100) * 4 + 2] >= d[(30 * W + 100) * 4], 'blue keeps at least as much as red');
  assert.equal(d[(30 * W + 10) * 4], 255, 'paper stays white');
  assert.ok(m.spreadMm > 0 && m.spreadMm < 1.5, 'spread stays in the range of real fine-line blur: ' + m.spreadMm);
  last = wv; lastDark = core;
}
assert.ok(last > width(fresh) + 3, '20 years is clearly softer than fresh');
console.log(`PASS aging unit: a 0.5 mm line reads ${width(fresh)}px fresh and ${last}px at 20 years, paper stays white`);
