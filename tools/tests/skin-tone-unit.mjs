// Your own skin tone: the depth/warmth model, finding the sliders for a colour, sampling a
// photo, and refusing colours that are not skin.
import assert from 'node:assert/strict';
import { toneColour, nearestTone, sampleSkin, skinCheck, hexToRgb } from '../../src/skin-tone.js';

const lum = (h) => { const [r, g, b] = hexToRgb(h); return 0.299 * r + 0.587 * g + 0.114 * b; };
// deeper is always darker
let prev = Infinity; for (let i = 0; i <= 20; i++) { const L = lum(toneColour(i / 20)); assert.ok(L < prev, 'darker as it deepens'); prev = L; }
// the preset tones are on the line
for (const [d, hex] of [[1 / 6, '#f1d3bd'], [2 / 6, '#e0b394'], [4 / 6, '#9a6644']]) { const a = hexToRgb(toneColour(d)), b = hexToRgb(hex); assert.ok(a.every((v, k) => Math.abs(v - b[k]) <= 2), `preset ${hex}: ${toneColour(d)}`); }
// warm is redder, cool is more yellow, at the same depth
const red = (h) => { const [r, , b] = hexToRgb(h); return r - b; }, yel = (h) => { const [r, g] = hexToRgb(h); return g / r; };
assert.ok(yel(toneColour(0.5, -1)) > yel(toneColour(0.5, 1)), 'cool is more yellow');
assert.ok(Math.abs(lum(toneColour(0.5, 1)) - lum(toneColour(0.5, -1))) < 14, 'warmth keeps depth');
// round trip through the sliders
for (const [d, w] of [[0.1, 0], [0.45, 0.6], [0.8, -0.5], [0.3, -1]]) { const n = nearestTone(toneColour(d, w)); assert.ok(Math.abs(n.depth - d) < 0.02 && Math.abs(n.warmth - w) < 0.06 && n.off < 3, `round trip ${d},${w}: ${JSON.stringify(n)}`); }
assert.ok(nearestTone('#d9a07c').off < 12, 'a real skin colour sits near the line');
// sampling: a skin patch with a dark freckle and a white glint still reads as the skin
const W = 40, H = 40, px = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { px.set([200, 150, 120, 255], i * 4); }
for (const [x, y, c] of [[20, 20, [60, 40, 30]], [21, 20, [60, 40, 30]], [18, 22, [255, 255, 255]], [22, 18, [255, 255, 255]]]) px.set([...c, 255], (y * W + x) * 4);
assert.equal(sampleSkin(px, W, H, 20, 20, 6), '#c89678', 'middle of the disc');
assert.equal(sampleSkin(px, W, H, -50, -50, 3), null, 'off the picture');
// what is not skin
assert.equal(skinCheck('#c89678'), ''); assert.equal(skinCheck('#6a422a'), ''); assert.equal(skinCheck('#f1d3bd'), '');
assert.match(skinCheck('#3a7bd5'), /not look like skin/); assert.match(skinCheck('#fefefe'), /too bright/); assert.match(skinCheck('#0a0a0a'), /too dark/);
console.log('PASS skin-tone-unit');
