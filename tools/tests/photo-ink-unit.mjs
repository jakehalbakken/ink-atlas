// The maths behind "Find my tattoos in a photo": ink on skin is found under uneven light, a dark
// shirt, the background and a mole are not, coloured ink counts, a design in several parts is
// one piece, the cut artwork is the ink on white, and photo points land on the right part of the
// body (torso, a bent arm, a back photo, a mirror selfie).
import assert from 'node:assert/strict';
import { findInk, cutPiece, inkMapper, mirrorLandmarks, mirrorArt } from '../../src/photo-ink.js';

const w = 400, h = 600, px = new Uint8ClampedArray(w * h * 4), mask = new Float32Array(w * h);
const set = (x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const o = (y * w + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; };
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const inBody = ((x - 200) / 150) ** 2 + ((y - 330) / 300) ** 2 < 1;
  mask[y * w + x] = inBody ? 1 : 0;
  // light from the left: skin runs from bright to shaded across the body
  const k = 1.15 - 0.45 * (x / w);
  set(x, y, inBody ? [200 * k, 150 * k, 120 * k] : [60, 70, 90]);
}
// a ring tattoo with a separate dot beside it (one design), at (200, 250)
for (let a = 0; a < 720; a++) for (let r = 24; r <= 27; r++) set(Math.round(200 + r * Math.cos(a / 114.6)), Math.round(250 + r * Math.sin(a / 114.6)), [45, 45, 50]);
for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) set(236 + x, 250 + y, [45, 45, 50]);
// a red rose, coloured ink, at (140, 390)
for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) if (x * x + y * y <= 100) set(140 + x, 390 + y, [175, 45, 55]);
// a mole
for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) set(280 + x, 330 + y, [70, 50, 40]);
// a soft shadow (like under the arm): darker than the skin round it, but fading in over many pixels
for (let y = 280; y < 360; y++) for (let x = 250; x < 330; x++) { const d = Math.hypot(x - 290, y - 320) / 40; if (d < 1) { const o = (y * w + x) * 4, k = 1 - 0.45 * (1 - d) ** 0.7; px[o] *= k; px[o + 1] *= k; px[o + 2] *= k; } }
// crisp but faint strands (body hair, a fold's line): only a little darker than the skin
for (let s = 0; s < 6; s++) for (let y = 290; y < 320; y++) for (let x = 110 + s * 6; x < 112 + s * 6; x++) { const o = (y * w + x) * 4; px[o] *= 0.68; px[o + 1] *= 0.68; px[o + 2] *= 0.68; }
// a shadow along the shirt's edge, crisp and dark: clothing, not ink
for (let y = 490; y < 500; y++) for (let x = 170; x < 230; x++) set(x, y, [70, 55, 50]);
// a dark shirt over the bottom of the body
for (let y = 500; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) set(x, y, [30, 40, 70]);
const L = (x, y, v = 1) => ({ x: x / w, y: y / h, visibility: v });
const lm = Array.from({ length: 33 }, () => L(0, 0, 0));
Object.assign(lm, { 11: L(280, 120), 12: L(120, 120), 23: L(250, 420), 24: L(150, 420) });
const found = findInk(px, mask, w, h, lm);
console.log(found.pieces.map((p) => [Math.round(p.cx), Math.round(p.cy), p.area, +p.sharp.toFixed(2)]));
assert.equal(found.pieces.length, 2, 'the ring and the rose, nothing else (not the shadow, the faint mark or the shirt edge)');
const ring = found.pieces.find((p) => Math.abs(p.cx - 205) < 12 && Math.abs(p.cy - 250) < 8), rose = found.pieces.find((p) => Math.abs(p.cx - 140) < 5 && Math.abs(p.cy - 390) < 5);
assert.ok(ring && rose, 'found where they are');
assert.ok(ring.x1 >= 238, 'the dot beside the ring is part of it');
// the cut: ink dark, its middle and the skin round it white, the rose stays red
const cut = cutPiece(px, w, h, ring, found.ref, found.sw), at = (c, x, y) => c.pixels.slice((y * c.w + x) * 4, (y * c.w + x) * 4 + 3);
const mid = at(cut, 200 - cut.x0, 250 - cut.y0), line = at(cut, 225 - cut.x0, 250 - cut.y0);
assert.deepEqual([...mid], [255, 255, 255], 'skin inside the ring drops out');
assert.ok(line[0] < 90 && line[2] < 140, 'the line is dark ' + [...line]);
const rc = cutPiece(px, w, h, rose, found.ref, found.sw), rm = at(rc, 140 - rc.x0, 390 - rc.y0);
assert.ok(rm[0] > rm[1] + 90 && rm[1] < 120, 'the rose stays red ' + [...rm]);
assert.deepEqual([...at(rc, 0, 0)], [255, 255, 255], 'corner is white');
// mirror: sides swap, the art flips
const ml = mirrorLandmarks(lm);
assert.ok(Math.abs(ml[11].x - (1 - lm[12].x)) < 1e-9 && Math.abs(ml[12].x - (1 - lm[11].x)) < 1e-9, 'shoulders swap sides');
const mc = mirrorArt(cut); assert.deepEqual([...at(mc, cut.w - 1 - (225 - cut.x0), 250 - cut.y0)], [...line], 'art flips');

// mapping: a body whose joints are the photo's, scaled to 1/200 and the right way up
const J = {}; for (const i of [11, 12, 13, 14, 15, 16, 23, 24]) J[i] = null;
const toBody = (x, y) => [(x - 200) / 200, (600 - y) / 200];
lm[13] = L(300, 220); lm[15] = L(380, 160); // the left arm bent up in the photo
lm[14] = L(100, 230); lm[16] = L(90, 330);
const joints = {}; for (const i of [11, 12, 23, 24, 14, 16]) joints[i] = toBody(lm[i].x * w, lm[i].y * h);
// on the body the left arm hangs down: elbow and wrist below the shoulder
joints[13] = [0.5, 2.4 - 0.5]; joints[15] = [0.6, 2.4 - 1.0];
const map = inkMapper(lm, w, h, joints, 'front');
const c = map(200, 250); assert.ok(Math.abs(c.x - 0) < 1e-6 && Math.abs(c.y - 1.75) < 1e-6, 'torso point exact ' + JSON.stringify(c));
assert.ok(Math.abs(c.k - 1 / 200) < 1e-6 && Math.abs(c.up[0]) < 1e-9 && c.up[1] > 0, 'scale and up');
// halfway along the raised forearm in the photo is halfway along the hanging forearm on the body
const f = map(340, 190); assert.ok(Math.hypot(f.x - 0.55, f.y - 1.65) < 1e-6, 'forearm point follows the arm ' + JSON.stringify(f));
// the forearm's up (towards the wrist in the photo, mostly) turns with it: on the body it points down the arm
assert.ok(f.up[1] < 0, 'up turns with the arm');
// a back photo: the photo's right is the body's -x... from behind, its own right: x mirrors
const jb = {}; for (const i of [11, 12, 23, 24]) { const [x, y] = toBody(lm[i].x * w, lm[i].y * h); jb[i] = [-x, y]; }
const mb = inkMapper(lm, w, h, jb, 'back'), b = mb(240, 250);
assert.ok(Math.abs(b.x + 0.2) < 1e-6 && Math.abs(b.y - 1.75) < 1e-6, 'back photo point ' + JSON.stringify(b));
// a person far away in the photo: too small to tell ink from hair and shading, nothing is looked for
const far = findInk(px, mask, w, h, Object.assign([...lm], { 11: L(240, 120), 12: L(160, 120) }));
assert.ok(far.small && far.pieces.length === 0, 'nothing looked for when the person is small');
console.log('PASS photo-ink-unit: ink found under uneven light, shirt, mole and background left out, coloured ink, one design in parts, cut on white, faint marks and far-away photos left alone, mirror, torso and bent arm and back mapping');
