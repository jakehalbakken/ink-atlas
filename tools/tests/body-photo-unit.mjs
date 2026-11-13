// Match a photo of me, the maths: reading a row of the outline, spotting photos that can't be
// read, and the slider search finding a known body from its proportions alone.
import assert from 'node:assert/strict';
import { rowRun, measurePhoto, fitBody, LM } from '../../src/body-photo.js';
import { bodyMeasure } from '../../src/body-match.js';
// rows
const w = 20, h = 3, m = new Float32Array(w * h); for (let x = 5; x < 15; x++) m[w + x] = 1;
assert.deepEqual(rowRun(m, w, h, 1, 9), { a: 5, b: 14, width: 10 });
assert.equal(rowRun(m, w, h, 0, 9), null, 'empty row');
m[w + 9] = 0; assert.equal(rowRun(m, w, h, 1, 9).width >= 4, true, 'a one-pixel gap at the centre is stepped over');
// a stick person drawn as a mask: front-on, whole body in frame
const W = 400, H = 800, mask = new Float32Array(W * H), fill = (x0, x1, y0, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * W + x] = 1; };
fill(185, 215, 60, 110); fill(150, 250, 110, 400); fill(155, 195, 400, 740); fill(205, 245, 400, 740);
const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.1, visibility: 1 }));
const put = (i, x, y) => { lm[i] = { x: x / W, y: y / H, visibility: 1 }; };
put(LM.nose, 200, 90); put(LM.earL, 210, 85); put(LM.earR, 190, 85);
put(LM.shoulderL, 250, 125); put(LM.shoulderR, 150, 125); put(LM.hipL, 225, 390); put(LM.hipR, 175, 390);
put(LM.kneeL, 225, 560); put(LM.kneeR, 175, 560); put(LM.ankleL, 225, 720); put(LM.ankleR, 175, 720);
for (const [i, x] of [[LM.heelL, 225], [LM.heelR, 175], [LM.toeL, 228], [LM.toeR, 172]]) put(i, x, 738);
let r = measurePhoto(lm, mask, W, H);
assert.deepEqual(r.problems, [], 'a clear photo reads');
assert.ok(Math.abs(r.ratios.shoulders - 100 / 678) < 1e-6 && Math.abs(r.ratios.waist - 100 / 678) < 1e-6, 'shares of the height');
assert.ok(Math.abs(r.ratios.thigh - 40 / 678) < 1e-6, 'one thigh');
// cut off at the feet, side-on, missing joints
put(LM.heelL, 225, 799); assert.match(measurePhoto(lm, mask, W, H).problems.join(' '), /feet are cut off/);
put(LM.heelL, 225, 738);
put(LM.shoulderL, 205, 125); put(LM.shoulderR, 195, 125); assert.match(measurePhoto(lm, mask, W, H).problems.join(' '), /Face the camera/);
put(LM.shoulderL, 250, 125); put(LM.shoulderR, 150, 125);
lm[LM.kneeL].visibility = 0.1; assert.match(measurePhoto(lm, mask, W, H).problems.join(' '), /whole body/);
// the search finds a known body from its proportions
const truth = { figure: 'male', muscle: 0.5, weight: 0.25, fit: { shoulders: 0.6, waist: -0.4, hips: 0.2, thighSize: -0.3, torsoLen: 0.3 } };
const want = bodyMeasure(truth), fit = fitBody(want, { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} }, bodyMeasure), got = bodyMeasure(fit.params);
for (const k of Object.keys(want)) assert.ok(Math.abs(got[k] / want[k] - 1) < 0.015, `${k} within 1.5%`);
assert.ok(Math.abs(fit.params.weight - 0.25) < 0.1 && Math.abs(fit.params.fit.shoulders - 0.6) < 0.15, 'settings close to the truth');
assert.equal(fit.params.muscle, 0.5, 'muscle left alone'); assert.equal(fit.params.figure, 'male');
for (const v of Object.values(fit.params.fit)) assert.ok(v >= -1 && v <= 1, 'sliders in range');
console.log(`PASS body-photo-unit: rows, unreadable photos named, search finds a known body in ${fit.looks} looks`);
