// Blend and colour maths (src/ink-look.js): the blend formulas match the W3C compositing spec at
// known points, multiply over skin gives the ink itself, cleanLook drops defaults and junk,
// the adjustments do what their names say, and ratios survive encoding.
import assert from 'node:assert/strict';
import { BLEND_MODES, blendOf, blendColor, cleanLook, cleanAdjust, adjustColor, ADJUST_DEFAULT, adjustPixels, lookRatios, encodeRatios, needsLift, psdBlendKey, describeLook, hasLook, lookKey, blendLetter } from '../../src/ink-look.js';
const near = (a, b, e = 1e-6, m = '') => { for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - b[k]) < e, `${m} ${a} vs ${b}`); };
const s = [0.8, 0.6, 0.5], i = [0.2, 0.4, 0.9];
near(blendColor('multiply', s, i), [0.16, 0.24, 0.45], 1e-9, 'multiply');
near(blendColor('screen', s, i), [0.84, 0.76, 0.95], 1e-9, 'screen');
near(blendColor('darken', s, i), [0.2, 0.4, 0.5], 1e-9, 'darken');
near(blendColor('linearBurn', s, i), [0, 0, 0.4], 1e-9, 'linear burn');
near(blendColor('colorBurn', s, i), [0, 0, 1 - 0.5 / 0.9], 1e-9, 'color burn');
near(blendColor('difference', s, i), [0.6, 0.2, 0.4], 1e-9, 'difference');
near(blendColor('overlay', [0.25, 0.75, 0.5], [0.5, 0.5, 0.5]), [0.25, 0.75, 0.5], 1e-9, 'overlay grey is neutral');
near(blendColor('softLight', s, [0.5, 0.5, 0.5]), s, 1e-9, 'soft light grey is neutral');
// colour modes keep the skin's luminance (hue/colour) or take the ink's (luminosity)
const L = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
for (const m of ['hue', 'saturation', 'color']) assert.ok(Math.abs(L(blendColor(m, s, i)) - L(s)) < 1e-6, m + ' keeps skin luminance');
assert.ok(Math.abs(L(blendColor('luminosity', s, i)) - L(i)) < 1e-6, 'luminosity takes ink luminance');
for (const m of BLEND_MODES) { const c = blendColor(m.id, s, i); assert.ok(c.every((v) => v >= -1e-9 && v <= 1 + 1e-9), m.id + ' in range'); assert.match(m.psd, /^[a-zA-Z ]{4}$/, m.id + ' psd key'); assert.ok(blendLetter(m.id), m.id + ' letter'); }
assert.equal(psdBlendKey('colorBurn'), 'idiv'); assert.equal(psdBlendKey('nope'), 'mul ');
// cleaning: defaults and junk go, real values stay rounded and clamped
const t = { blend: 'multiply', adjust: { hue: 0, sat: 0 } }; cleanLook(t); assert.deepEqual(t, {}, 'defaults dropped');
const u = { blend: 'colorBurn', adjust: { hue: 400, sat: -30.4, light: 'x', invert: true, tintAmt: 0, tint: '#ff0000', evil: '<script>' } }; cleanLook(u);
assert.equal(u.blend, 'colorBurn'); assert.equal(u.adjust.hue, 180); assert.equal(u.adjust.sat, -30); assert.equal(u.adjust.invert, true); assert.ok(!('tint' in u.adjust) && !('evil' in u.adjust) && !('light' in u.adjust), JSON.stringify(u.adjust));
const v = { blend: 'bogus', adjust: 'nope' }; cleanLook(v); assert.deepEqual(v, {}, 'junk dropped');
assert.equal(blendOf({}), 'multiply'); assert.equal(hasLook({}), false); assert.equal(lookKey({}), '');
assert.equal(cleanAdjust({ tintAmt: 50, tint: 'red' }).tint, ADJUST_DEFAULT.tint, 'a bad tint colour falls back');
assert.ok(describeLook(u).includes('Colour burn'), describeLook(u));
// adjustments
const A = (x) => ({ ...ADJUST_DEFAULT, ...x });
near(adjustColor([0.2, 0.4, 0.9], A({ invert: true })), [0.8, 0.6, 0.1], 1e-9, 'invert');
const grey = adjustColor([0.9, 0.2, 0.2], A({ sat: -100 })); assert.ok(Math.abs(grey[0] - grey[1]) < 1e-9 && Math.abs(grey[1] - grey[2]) < 1e-9, 'no saturation is grey');
const hue = adjustColor([1, 0, 0], A({ hue: 120 })); near(hue, [0, 1, 0], 1e-9, 'hue 120 turns red green');
assert.ok(adjustColor([0.5, 0.5, 0.5], A({ light: 50 }))[0] > 0.7, 'brighter'); assert.ok(adjustColor([0.5, 0.5, 0.5], A({ light: -50 }))[0] < 0.3, 'darker');
const hi = adjustColor([0.4, 0.6, 0.5], A({ contrast: 60 })); assert.ok(hi[0] < 0.4 && hi[1] > 0.6, 'contrast spreads');
const red = adjustColor([0.2, 0.2, 0.2], A({ tint: '#ff0000', tintAmt: 100 })); assert.ok(red[0] > red[1] && red[0] > red[2], 'recolour to red');
const px = new Uint8ClampedArray([10, 20, 30, 255, 99, 99, 99, 0]); adjustPixels(px, { invert: true }); assert.deepEqual([...px], [245, 235, 225, 255, 99, 99, 99, 0], 'alpha left, clear pixels untouched');
// ratios: multiply over skin = ink; screen lifts above 1 and needs the doubled draw
const skin = [204, 153, 128], ink = new Uint8ClampedArray([51, 102, 230, 255, 0, 0, 0, 0]);
const m = lookRatios(ink, skin, 'multiply', 1); near([m.ratios[0], m.ratios[1], m.ratios[2]], [0.2, 0.4, 230 / 255], 1e-6, 'multiply ratio = ink');
near([m.ratios[3], m.ratios[4], m.ratios[5]], [1, 1, 1], 1e-9, 'clear pixel leaves skin');
assert.equal(needsLift(m.max), false);
const sc = lookRatios(ink, skin, 'screen', 1); assert.ok(needsLift(sc.max), 'screen lifts');
const enc = encodeRatios(sc.ratios, true); assert.ok(Math.abs(enc[0] * 2 / 255 - sc.ratios[0]) < 2 / 255, 'doubled encoding');
const lin = encodeRatios(sc.ratios, true, true); assert.ok(Math.abs(Math.pow(lin[0] / 255, 2.2) * 2 - Math.pow(sc.ratios[0], 2.2)) < 0.02, 'linear doubled encoding');
const half = lookRatios(ink, skin, 'linearBurn', 0.5); assert.ok(half.ratios[0] > lookRatios(ink, skin, 'linearBurn', 1).ratios[0], 'strength softens');
console.log('ink-look-unit: ok');
