// Registering the existing tattoo: perspective straightening is exact on a known quad; one known
// length sets the scale (the 4 in cactus comes out 101.6 mm on the template); landmarks fit a
// photo without stretching it; directions round the limb land on the template the right way round
// for left and right limbs; the gaps between floating sections are found as protected skin.
import assert from 'node:assert/strict';
import { homography, applyH, invertH, straighten, quadOk, photoToTemplate, templateToPhoto, calibrate, fitLandmarks, fAt, degAt, distanceField, gapsBetween } from '../../src/wrap-register.js';
const near = (a, b, t, w) => assert.ok(Math.abs(a - b) <= t, `${w}: ${a} vs ${b}`);

const src = [[10, 20], [400, 40], [380, 300], [30, 260]], dst = [[0, 0], [300, 0], [300, 200], [0, 200]];
const H = homography(src, dst); for (let i = 0; i < 4; i++) { const p = applyH(H, ...src[i]); near(p[0], dst[i][0], 1e-6, 'H x'); near(p[1], dst[i][1], 1e-6, 'H y'); }
const Hi = invertH(H), q = applyH(Hi, 150, 100), back = applyH(H, ...q); near(back[0], 150, 1e-6, 'inverse'); near(back[1], 100, 1e-6, 'inverse y');
const st = straighten([[0, 0], [800, 0], [800, 600], [0, 600]]); assert.equal(st.w, 800); assert.equal(st.h, 600, 'a square-on photo is unchanged');
near(applyH(st.H, 123, 456)[0], 123, 1e-6, 'identity');
assert.ok(quadOk(src)); assert.ok(!quadOk([[0, 0], [10, 10], [10, 0], [0, 10]]), 'crossed quad refused');

// calibrate: base at (100, 900), top at (130, 100) in a 400 x 1000 picture; 101.6 mm apart
const w = 400, h = 1000, base = [100, 900], top = [130, 100];
const fit = calibrate(w, h, base, top, 101.6, [5, 0]);
const B = photoToTemplate(fit, w, h, ...base), T = photoToTemplate(fit, w, h, ...top);
near(B[0], 5, 1e-9, 'base x'); near(B[1], 0, 1e-9, 'base y'); near(T[0], 5, 1e-9, 'top straight above'); near(T[1], 101.6, 1e-9, 'cactus stays 4 in long');
const r = templateToPhoto(fit, w, h, ...T); near(r[0], top[0], 1e-9, 'back to photo'); near(r[1], top[1], 1e-9, 'back to photo y');
const ff = calibrate(w, h, base, top, 101.6, [0, 0], true), Tf = photoToTemplate(ff, w, h, ...top); near(Tf[0], 0, 1e-9, 'flipped still upright'); near(Tf[1], 101.6, 1e-9, 'flipped length');

// landmarks: a second photo of the same tattoo at another scale and turn fits back exactly
const pts = [[100, 900], [130, 100], [40, 500], [260, 420]].map((p) => [p, photoToTemplate(fit, w, h, ...p)]);
const other = { x: 30, y: 40, mmPerPx: 0.05, rot: 33, flip: false }, W2 = 900, H2 = 700;
const pairs = pts.map(([, t]) => [templateToPhoto(other, W2, H2, ...t), t]);
const lf = fitLandmarks(W2, H2, pairs); near(lf.fit.mmPerPx, 0.05, 1e-9, 'scale found'); near(lf.fit.rot, 33, 1e-7, 'turn found'); assert.ok(lf.miss < 1e-6, 'exact');
const locked = fitLandmarks(W2, H2, pairs, { lockScale: 0.06 }); near(locked.fit.mmPerPx, 0.06, 1e-12, 'scale kept'); assert.ok(locked.miss > 1, 'miss reported');
assert.equal(fitLandmarks(W2, H2, pairs.slice(0, 1)), null);

// round the limb: seam on the inside puts the outside in the middle; on the right leg the back
// is to the left and the front to the right (seen from outside); the left leg is the mirror
near(fAt(180, 0, 'legR'), 0, 1e-12, 'outside in the middle');
near(fAt(270, 0, 'legR'), -0.25, 1e-12, 'right leg back on the left'); near(fAt(90, 0, 'legR'), 0.25, 1e-12, 'right leg front on the right');
near(fAt(270, 0, 'legL'), 0.25, 1e-12, 'left leg back on the right');
near(Math.abs(fAt(0, 0, 'legR')), 0.5, 1e-12, 'the cut at the edges');
for (const limb of ['legR', 'legL']) for (const d of [0.1, 45, 170, 300]) near(degAt(fAt(d, 90, limb), 90, limb), d, 1e-9, 'deg round trip');

// distance and gaps: two ink bars with a gap between keep the gap protected, not the far skin
const gw = 40, gh = 40, ink = new Uint8Array(gw * gh);
for (let y = 5; y < 15; y++) for (let x = 15; x < 25; x++) ink[y * gw + x] = 1;
for (let y = 19; y < 30; y++) for (let x = 15; x < 25; x++) ink[y * gw + x] = 1;
const df = distanceField(ink, gw, gh); assert.equal(df[10 * gw + 20], 0); near(df[10 * gw + 30], 6, 0.01, 'distance across');
const gap = gapsBetween(ink, gw, gh, 4); assert.equal(gap[17 * gw + 20], 1, 'the gap between sections is protected'); assert.equal(gap[17 * gw + 35], 0, 'open skin is not'); assert.equal(gap[10 * gw + 20], 0, 'ink is not gap');
console.log('wrap-register-unit PASS');
