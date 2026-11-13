// Procreate palette maths: colour conversion, ink colours picked from pictures (paper and
// see-through pixels skipped, similar colours merged, specks ignored), and the file layout.
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHsb, skinSet, inkColours, swatchesJson, swatchesFile } from '../../src/swatches.js';
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
assert.deepEqual(hexToRgb('#e0b394'), [224, 179, 148]);
let h = rgbToHsb([255, 0, 0]); close(h.hue, 0); close(h.saturation, 1); close(h.brightness, 1);
h = rgbToHsb([0, 0, 255]); close(h.hue, 2 / 3);
h = rgbToHsb([128, 128, 128]); close(h.saturation, 0); close(h.brightness, 128 / 255);
const [skin, shade, light] = skinSet('#e0b394');
assert.deepEqual(skin, [224, 179, 148]); assert.ok(shade[0] < skin[0] && light[0] > skin[0], 'shade darker, highlight lighter');
// a picture: white paper, black ink, red, green, see-through pixels, a speck, and soft grey and pink edges
const px = []; const put = (c, n, a = 255) => { for (let i = 0; i < n; i++) px.push(...c, a); };
put([255, 255, 255], 600); put([10, 10, 12], 120); put([14, 12, 9], 130); put([200, 30, 30], 100); put([0, 0, 0], 40, 0); put([120, 120, 120], 2); put([140, 142, 141], 30); put([238, 150, 150], 20); put([40, 160, 60], 40);
const inks = inkColours([new Uint8ClampedArray(px)]);
assert.equal(inks.length, 3, 'black, red and green; specks and soft edges dropped: ' + JSON.stringify(inks));
assert.ok(Math.max(...inks[0]) < 20, 'black first (most used)'); assert.ok(inks[1][0] > 180 && inks[1][1] < 50, 'then red');
const json = swatchesJson('Ink Atlas test', [skin, ...inks]);
assert.equal(json.length, 1); assert.equal(json[0].name, 'Ink Atlas test'); assert.equal(json[0].swatches.length, 4);
for (const s of json[0].swatches) { for (const k of ['hue', 'saturation', 'brightness', 'alpha']) assert.ok(s[k] >= 0 && s[k] <= 1, k); assert.equal(s.colorSpace, 0); }
assert.equal(swatchesJson('x', Array(40).fill([1, 2, 3]))[0].swatches.length, 30, 'Procreate holds 30');
const blob = swatchesFile('Ink Atlas test', [skin]); const b = new Uint8Array(await blob.arrayBuffer());
assert.equal(new DataView(b.buffer).getUint32(0, true), 0x04034b50, 'a ZIP');
const n = new DataView(b.buffer).getUint16(26, true); assert.equal(new TextDecoder().decode(b.slice(30, 30 + n)), 'Swatches.json');
console.log('PASS swatches unit: colours, ink picking, 30-swatch limit, ZIP with Swatches.json');
