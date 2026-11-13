// Hair from a photo, the maths: a drawn face with hair of different lengths reads as bald, a buzz
// cut, short or longer hair, and the colour comes from the hair, not its shine or shadow.
import assert from 'node:assert/strict';
import { readHair } from '../../src/hair-photo.js';
const W = 400, H = 500;
// face points: forehead (10) at y 150, chin (152) at 350, cheeks at x 130/270, eyes at y 220
const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
const put = (i, x, y) => { lm[i] = { x: x / W, y: y / H }; };
put(10, 200, 150); put(152, 200, 350); put(234, 130, 260); put(454, 270, 260); put(33, 160, 220); put(263, 240, 220);
const make = (draw) => {
  const mask = new Float32Array(W * H), px = new Uint8ClampedArray(W * H * 4).fill(200);
  draw((x0, x1, y0, y1, rgb = [60, 40, 30]) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { mask[y * W + x] = 1; px.set([...rgb, 255], (y * W + x) * 4); } });
  return readHair(px, mask, W, H, lm);
};
// the skull's top is about 150 - 0.33 * 200 = 84
assert.equal(make(() => {}).style, 'none', 'bald');
assert.equal(make((f) => f(120, 280, 86, 130)).style, 'buzz', 'a thin layer on the scalp');
assert.equal(make((f) => f(120, 280, 74, 135)).style, 'short', 'a little volume');
assert.equal(make((f) => { f(110, 290, 50, 135); f(95, 130, 100, 300); f(270, 305, 100, 300); }).style, 'crop', 'fuller, over the ears');
assert.equal(make((f) => { f(110, 290, 60, 135); f(80, 130, 100, 420); f(270, 320, 100, 420); }).style, 'long', 'past the chin');
// colour: the middle of the hair, not the shine or the shadow
const c = make((f) => { f(110, 290, 70, 100, [90, 60, 40]); f(110, 290, 100, 108, [250, 240, 230]); f(110, 290, 108, 116, [5, 5, 5]); });
assert.equal(c.colour, '#5a3c28', 'hair colour ' + c.colour);
console.log('PASS hair-photo-unit: bald, buzz, short, fuller and long hair told apart; colour without shine or shadow');
