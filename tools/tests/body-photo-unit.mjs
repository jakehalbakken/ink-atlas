// Match a photo of me, the maths: reading a row of the outline, reading whatever part of the body
// a photo shows (head to toe, upper body only, legs only, the back), refusing photos with nothing
// usable, and the slider search finding a known body from its proportions, moving only the
// sliders of the parts a partial photo shows, so photos build on each other.
import assert from 'node:assert/strict';
import { rowRun, measurePhoto, fitBody, searchFor, relativeTo, backTone, LM } from '../../src/body-photo.js';
import { bodyMeasure, fitToPhoto } from '../../src/body-match.js';
// rows
const w = 20, h = 3, m = new Float32Array(w * h); for (let x = 5; x < 15; x++) m[w + x] = 1;
assert.deepEqual(rowRun(m, w, h, 1, 9), { a: 5, b: 14, width: 10 });
assert.equal(rowRun(m, w, h, 0, 9), null, 'empty row');
m[w + 9] = 0; assert.equal(rowRun(m, w, h, 1, 9).width >= 4, true, 'a one-pixel gap at the centre is stepped over');
// a stick person drawn as a mask: front-on, whole body in frame
const W = 400, H = 800, mask = new Float32Array(W * H), fill = (x0, x1, y0, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * W + x] = 1; };
fill(185, 215, 60, 110); fill(150, 250, 110, 400); fill(155, 195, 400, 740); fill(205, 245, 400, 740);
const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.1, visibility: 1 }));
const put = (i, x, y, v = 1) => { lm[i] = { x: x / W, y: y / H, visibility: v }; };
put(LM.nose, 200, 90); put(LM.earL, 210, 85); put(LM.earR, 190, 85);
put(LM.shoulderL, 250, 125); put(LM.shoulderR, 150, 125); put(LM.hipL, 225, 390); put(LM.hipR, 175, 390);
put(LM.kneeL, 225, 560); put(LM.kneeR, 175, 560); put(LM.ankleL, 225, 720); put(LM.ankleR, 175, 720);
for (const [i, x] of [[LM.heelL, 225], [LM.heelR, 175], [LM.toeL, 228], [LM.toeR, 172]]) put(i, x, 738);
const read = () => measurePhoto(lm.map((p) => ({ ...p })), mask, W, H);
let r = read();
assert.deepEqual(r.problems, [], 'a clear photo reads');
assert.equal(r.ref, 'height'); assert.equal(r.view, 'front');
assert.ok(Math.abs(r.ratios.shoulders - 100 / 678) < 1e-6 && Math.abs(r.ratios.waist - 100 / 678) < 1e-6, 'shares of the height');
assert.ok(Math.abs(r.ratios.thigh - 40 / 678) < 1e-6, 'one thigh');
assert.deepEqual(r.parts, ['shoulders', 'chest', 'waist', 'hips', 'thigh', 'torso', 'legs']);
// feet cut off: no height, so shares of the shoulder width, and still everything else
put(LM.heelL, 225, 799); r = read(); put(LM.heelL, 225, 738);
assert.deepEqual(r.problems, []); assert.equal(r.ref, 'shoulders');
assert.ok(Math.abs(r.ratios.waist - 1) < 1e-6 && Number.isNaN(r.ratios.shoulders), 'shares of the shoulders');
// a mirror selfie of the upper body: no knees, ankles or feet
const legsOut = [LM.kneeL, LM.kneeR, LM.ankleL, LM.ankleR, LM.heelL, LM.heelR, LM.toeL, LM.toeR];
const saved = legsOut.map((i) => lm[i]);
legsOut.forEach((i) => { lm[i] = { ...lm[i], visibility: 0.1 }; });
r = read();
assert.deepEqual(r.problems, []); assert.equal(r.ref, 'shoulders');
assert.deepEqual(r.parts, ['chest', 'waist', 'hips', 'torso'], 'upper body parts only');
assert.ok(Math.abs(r.ratios.torso - 265 / 100) < 1e-6, 'torso length against the shoulders');
// the same from behind: the face isn't seen
for (const i of [LM.nose, LM.earL, LM.earR]) lm[i] = { ...lm[i], visibility: 0.05 };
r = read(); assert.equal(r.view, 'back'); assert.deepEqual(r.parts, ['chest', 'waist', 'hips', 'torso'], 'a back photo reads the same parts');
for (const i of [LM.nose, LM.earL, LM.earR]) lm[i] = { ...lm[i], visibility: 1 };
// or with depth: the nose behind the ears (as the landmarker reports a back), or in front (a mirror selfie)
lm[LM.nose].z = 0.27; lm[LM.earL].z = 0.05; lm[LM.earR].z = 0.06; assert.equal(read().view, 'back', 'nose behind the ears');
lm[LM.nose].z = -0.65; lm[LM.earL].z = -0.41; lm[LM.earR].z = -0.42; assert.equal(read().view, 'front', 'nose in front of the ears');
legsOut.forEach((i, n) => { lm[i] = saved[n]; });
// joints outside the picture don't count
put(LM.ankleL, 225, 900, 0.9); put(LM.ankleR, 175, 900, 0.9); r = read(); assert.ok(!r.parts.includes('legs') && r.ref === 'shoulders', 'ankles out of frame');
put(LM.ankleL, 225, 720); put(LM.ankleR, 175, 720);
// legs only: shares of the hip width
for (const i of [LM.shoulderL, LM.shoulderR]) lm[i] = { ...lm[i], visibility: 0.1 };
r = read(); assert.equal(r.ref, 'hips'); assert.deepEqual(r.parts, ['thigh', 'legs']);
for (const i of [LM.shoulderL, LM.shoulderR]) lm[i] = { ...lm[i], visibility: 1 };
// nothing usable, or side-on
for (const i of [LM.shoulderL, LM.shoulderR, LM.hipL, LM.hipR]) lm[i] = { ...lm[i], visibility: 0.1 };
assert.match(read().problems.join(' '), /shoulders or hips/);
for (const i of [LM.shoulderL, LM.shoulderR, LM.hipL, LM.hipR]) lm[i] = { ...lm[i], visibility: 1 };
put(LM.shoulderL, 205, 125); put(LM.shoulderR, 195, 125); assert.match(read().problems.join(' '), /Face the camera/);
put(LM.shoulderL, 250, 125); put(LM.shoulderR, 150, 125);
// arms against the sides: chest and waist are left out, with a note
fill(110, 150, 120, 380); fill(250, 290, 120, 380); r = read();
assert.deepEqual(r.problems, []); assert.ok(Number.isNaN(r.ratios.chest) && Number.isNaN(r.ratios.waist) && Number.isFinite(r.ratios.hips), 'chest and waist left out');
assert.match(r.notes.join(' '), /arms touch your sides/);
// the search finds a known body from its proportions
const std = { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} };
const truth = { figure: 'male', muscle: 0.5, weight: 0.25, fit: { shoulders: 0.6, waist: -0.4, hips: 0.2, thighSize: -0.3, torsoLen: 0.3 } };
const want = bodyMeasure(truth), fit = fitBody(want, std, bodyMeasure), got = bodyMeasure(fit.params);
for (const k of Object.keys(want)) assert.ok(Math.abs(got[k] / want[k] - 1) < 0.015, `${k} within 1.5%`);
assert.ok(Math.abs(fit.params.weight - 0.25) < 0.1 && Math.abs(fit.params.fit.shoulders - 0.6) < 0.15, 'settings close to the truth');
assert.equal(fit.params.muscle, 0.5, 'muscle left alone'); assert.equal(fit.params.figure, 'male');
for (const v of Object.values(fit.params.fit)) assert.ok(v >= -1 && v <= 1, 'sliders in range');
// partial photos: an upper body photo moves only the torso sliders; a legs photo then adds the
// legs and keeps what the first one matched
const truth2 = { figure: 'male', muscle: 0.5, weight: 0.5, fit: { waist: -0.5, chest: 0.4, torsoLen: 0.4, thighSize: 0.5, thighLen: -0.4, shinLen: -0.4 } };
const asRead = (ref, parts) => { const m = relativeTo(bodyMeasure(truth2), ref); const ratios = {}; for (const k of Object.keys(m)) ratios[k] = parts.includes(k) ? m[k] : NaN; return { ratios, ref, parts }; };
// readings from a photo carry the photo calibration; undo it so the test starts from the body's own numbers
const { CALIBRATION } = await import('../../src/body-match.js');
const uncal = (rd) => { const c = (k) => (k === 'height' ? 1 : CALIBRATION[k]); for (const k of rd.parts) rd.ratios[k] = rd.ratios[k] / CALIBRATION[k] * c(rd.ref); return rd; };
const up = uncal(asRead('shoulders', ['chest', 'waist', 'hips', 'torso']));
assert.deepEqual(searchFor(up.parts, up.ref).map((s) => s.key), ['fit.chest', 'fit.waist', 'fit.hips', 'fit.torsoLen'], 'only the sliders of the parts shown');
const f1 = fitToPhoto(up, std).params;
assert.equal(f1.weight, 0.5, 'weight left alone'); assert.ok(!f1.fit.thighSize && !f1.fit.thighLen && !f1.fit.shoulders, 'legs and shoulders left alone');
assert.ok(f1.fit.waist < -0.3 && f1.fit.torsoLen > 0.2, 'waist and torso matched ' + JSON.stringify(f1.fit));
const low = uncal(asRead('hips', ['thigh', 'legs']));
const f2 = fitToPhoto(low, f1).params;
assert.equal(f2.fit.waist, f1.fit.waist, 'the legs photo keeps the upper body'); assert.equal(f2.fit.torsoLen, f1.fit.torsoLen);
assert.ok(f2.fit.thighSize > 0.25 && f2.fit.thighLen < -0.2, 'legs matched ' + JSON.stringify(f2.fit));
// skin tone from a bare back: the back's colour, not its shadows; none from a shirt
const px = new Uint8ClampedArray(W * H * 4);
const paint = (rgb) => { for (let i = 0; i < W * H; i++) px.set([...rgb, 255], i * 4); };
paint([196, 150, 122]); for (let y = 200; y < 215; y++) for (let x = 150; x < 250; x++) px.set([60, 40, 30, 255], (y * W + x) * 4);
assert.equal(backTone(px, mask, W, H, lm), '#c4967a', 'bare back');
paint([40, 70, 140]); assert.equal(backTone(px, mask, W, H, lm), null, 'a blue shirt is not skin');
console.log(`PASS body-photo-unit: rows, whole and partial photos, back photos, unreadable photos named, search finds a known body in ${fit.looks} looks, partial photos build up, skin tone from a bare back`);
