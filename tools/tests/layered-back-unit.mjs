// Pure maths for bringing back the 3D body sent with each tattoo separate (src/layered-back.js).
import assert from 'node:assert/strict';
import { matchPictures, materialPictures, partFrame, inkOutOfSkin, edgeSkin, changedPixels, colourPictures } from '../../src/layered-back.js';
const near = (a, b, e = 1e-9, m = '') => assert.ok(Math.abs(a - b) < e, `${m} ${a} vs ${b}`);
// materials in a text USD, each with its own picture
const usda = `def Material "Skin" { def Shader "Tex" { asset inputs:file = @textures/Texture_1.png@ } }
def Material "Rose" { asset inputs:file = @textures/Texture_9_normal.png@ asset inputs:file = @textures/Texture_7.png@ }
def Material "Rose_2" { asset inputs:file = @textures/Texture_8.png@ }`;
const mp = materialPictures(usda);
assert.equal(mp.get('Skin'), 'textures/Texture_1.png'); assert.equal(mp.get('Rose'), 'textures/Texture_7.png'); assert.equal(mp.get('Rose_2'), 'textures/Texture_8.png');
assert.deepEqual(colourPictures(['a/Rose_normal.png', 'a/Rose_roughness.png', 'a/Rose.png', 'x.usdc']), ['a/Rose.png']);
const pics = [{ name: 'textures/Texture_1.png', w: 4096, h: 4096 }, { name: 'textures/Texture_7.png', w: 1024, h: 512 }, { name: 'textures/Texture_8.png', w: 1024, h: 512 }];
let m = matchPictures({ pictures: pics, parts: [{ label: 'Rose', ratio: 2 }, { label: 'Rose_2', ratio: 2 }], usda });
assert.equal(m.skin, 'textures/Texture_1.png'); assert.equal(m.parts.get('Rose'), 'textures/Texture_7.png'); assert.equal(m.parts.get('Rose_2'), 'textures/Texture_8.png');
// a binary file: by the pictures' own names, Rose_2 not taken by Rose
const named = [{ name: 'Skin_Color.png', w: 2048, h: 2048 }, { name: 'Rose_2_Color.png', w: 2048, h: 2048 }, { name: 'Rose_Color.png', w: 2048, h: 2048 }, { name: 'Rose_Roughness.png', w: 2048, h: 2048 }];
m = matchPictures({ pictures: named.filter((p) => colourPictures([p.name]).length), parts: [{ label: 'Rose', ratio: 2 }, { label: 'Rose_2', ratio: 1 }] });
assert.equal(m.skin, 'Skin_Color.png'); assert.equal(m.parts.get('Rose'), 'Rose_Color.png'); assert.equal(m.parts.get('Rose_2'), 'Rose_2_Color.png');
// no names at all: by shape, only where it is the only one of that shape
m = matchPictures({ pictures: [{ name: 'a.png', w: 4096, h: 4096 }, { name: 'b.png', w: 2048, h: 1024 }, { name: 'c.png', w: 600, h: 1800 }, { name: 'd.png', w: 300, h: 900 }], parts: [{ label: 'Sun', ratio: 2 }, { label: 'A', ratio: 1 / 3 }, { label: 'B', ratio: 1 / 3 }] });
assert.equal(m.skin, 'a.png'); assert.equal(m.parts.get('Sun'), 'b.png'); assert.equal(m.parts.has('A'), false, 'two parts of one shape are never guessed');
// where a part's picture sits in the artwork: a box that is exactly the artwork, the usual way up
const mg = 0.04;
let f = partFrame({ box: [mg, mg, 1 - mg, 1 - mg], margin: mg });
near(f.widthScale, 1); near(f.heightScale, 1); near(f.shift.x, 0); near(f.shift.y, 0); assert.equal(f.mirror, false); assert.equal(f.upsideDown, false);
// a bigger box, more room on the right and the top
f = partFrame({ box: [mg - 0.092, mg - 0.092, 1 - mg + 0.184, 1 - mg + 0.368], margin: mg });
near(f.widthScale, 1.3, 1e-9, 'w'); near(f.heightScale, 1.5, 1e-9, 'h'); near(f.shift.x, 0.05, 1e-9, 'x'); near(f.shift.y, -0.15, 1e-9, 'y: up in the picture');
// mirrored and upside down
f = partFrame({ box: [mg - 0.092, mg, 1 - mg + 0.184, 1 - mg], margin: mg, flip: true });
near(f.shift.x, -0.05); assert.equal(f.mirror, true);
f = partFrame({ box: [mg, mg - 0.092, 1 - mg, 1 - mg + 0.184], margin: mg, flipY: false });
near(f.shift.y, 0.05); assert.equal(f.upsideDown, true);
// a crop: the left half of the exact box
f = partFrame({ box: [mg, mg, 1 - mg, 1 - mg], margin: mg, crop: { x: 0, y: 0, w: 0.5, h: 1 } });
near(f.widthScale, 0.5); near(f.shift.x, -0.25);
// ink back out of ink multiplied over skin
const skin = [224, 172, 140];
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }, enc = (l) => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055));
const px = new Uint8ClampedArray(4 * 4);
const put = (i, ink) => { for (let k = 0; k < 3; k++) px[i * 4 + k] = enc(lin(skin[k]) * lin(ink[k])); px[i * 4 + 3] = 255; };
put(0, [255, 255, 255]); put(1, [0, 0, 0]); put(2, [128, 128, 128]); put(3, [200, 40, 40]);
const ink = inkOutOfSkin(px, skin);
assert.equal(ink[3], 0, 'bare skin is see-through'); assert.ok(ink[7] >= 250 && ink[4] <= 3, 'black stays black');
// over white the ink comes back as it was
const over = (i) => [0, 1, 2].map((k) => 255 - (255 - ink[i * 4 + k]) * ink[i * 4 + 3] / 255);
for (const [i, want] of [[2, [128, 128, 128]], [3, [200, 40, 40]]]) over(i).forEach((v, k) => assert.ok(Math.abs(v - want[k]) <= 3, `ink ${i}: ${over(i)} vs ${want}`));
// strength taken out: half strength ink comes back twice as dense
const half = inkOutOfSkin(px, skin, 0.5); assert.ok(half[11] > ink[11] * 1.9 || half[11] === 255);
// the skin colour from the edge of a picture with ink in its middle
const w = 10, h = 6, e = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { e.set([...skin, 255], i * 4); } e.set([0, 0, 0, 255], (2 * w + 4) * 4);
assert.deepEqual(edgeSkin(e, w, h), skin);
// changed or not
const a = new Uint8ClampedArray(100 * 100 * 4).fill(200), b = new Uint8ClampedArray(a);
for (let i = 0; i < 9; i++) b[i * 4] = 20;
assert.equal(changedPixels(a, b).changed, false, 'a few pixels are noise');
for (let i = 0; i < 200; i++) b[i * 4] = 20;
assert.equal(changedPixels(a, b).changed, true, 'a stroke is a change');
console.log('PASS layered-back-unit');
