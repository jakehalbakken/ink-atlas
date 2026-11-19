// Your body in inches: every measurement is a sensible size on the standard body, follows its
// own slider one way, typed numbers are read in inches, fractions, cm or feet, the search lands
// a slider on a typed number, several typed numbers are matched together, and the new forearm,
// wrist and ankle sizes change only their own part of the limb while the skeleton used for
// measuring is the same one the app poses (createRestRig).
// node tools/tests/body-measure-unit.mjs
import assert from 'node:assert/strict';
import { MEASURES, measureBody, unitsToInches, inchesToUnits, parseInches, inchText, solveSlider, matchMeasurements } from '../../src/body-measure.js';
import { shapeWithJoints, shapePositions, INDEX, COUNTS } from '../../src/mesh.js';
import { createRestRig } from '../../src/pose.js';
import { FIT_GROUPS } from '../../src/fit.js';

const shape = (fit = {}) => ({ figure: 'male', muscle: 0.5, weight: 0.5, heightCm: 175, fit });
const inches = (fit, only) => { const s = shape(fit), { positions, joints } = shapeWithJoints(s), r = measureBody(positions, joints, INDEX, COUNTS.body, only), o = {}; for (const k in r) o[k] = unitsToInches(r[k], 175); return o; };

// every measurement has a slider, and the standard body reads like a real person of 175 cm
const fitKeys = new Set(FIT_GROUPS.flatMap((g) => g.items.map((i) => i.key)));
for (const m of MEASURES) assert.ok(fitKeys.has(m.key), `${m.key} has a slider`);
const std = inches({});
const range = { neckSize: [12, 17], chest: [33, 45], waist: [26, 36], hips: [33, 43], upperArmSize: [10, 15], foreArmSize: [8.5, 12.5], wristSize: [5, 7.5], thighSize: [18, 26], calfSize: [12, 17], ankleSize: [7, 10.5], shoulders: [14, 21], upperArmLen: [9, 14], foreArmLen: [8, 12], thighLen: [10, 18], shinLen: [14, 21], torsoLen: [14, 24] };
for (const [k, [lo, hi]] of Object.entries(range)) assert.ok(std[k] >= lo && std[k] <= hi, `${k} on the standard body is ${std[k] && std[k].toFixed(1)} in, expected ${lo} to ${hi}`);
for (const m of MEASURES) assert.ok(Number.isFinite(std[m.key]), `${m.key} is measured`);

// each slider moves its own measurement one way, by a clear amount
for (const m of MEASURES) {
  const a = inches({ [m.key]: -1 }, m.key)[m.key], b = inches({ [m.key]: 1 }, m.key)[m.key], mid = std[m.key];
  assert.ok(b > a + 0.15, `${m.key} grows with its slider: ${a.toFixed(2)} .. ${mid.toFixed(2)} .. ${b.toFixed(2)}`);
  assert.ok(a <= mid + 0.05 && mid <= b + 0.05, `${m.key} is in between at 0`);
}

// the new local sizes change only their own part of the limb
const base = shapePositions(shape({}));
for (const [key, keep] of [['foreArmSize', ['upperArmSize', 'thighSize', 'chest']], ['wristSize', ['upperArmSize', 'calfSize']], ['ankleSize', ['thighSize', 'upperArmSize', 'wristSize']]]) {
  const big = inches({ [key]: 1 });
  for (const k of keep) assert.ok(Math.abs(big[k] - std[k]) < 0.15, `${key} leaves ${k} alone: ${std[k].toFixed(2)} -> ${big[k].toFixed(2)}`);
  const P = shapePositions(shape({ [key]: 1 })); let moved = 0;
  for (let v = 0; v < COUNTS.body; v++) if (Math.hypot(P[v * 3] - base[v * 3], P[v * 3 + 1] - base[v * 3 + 1], P[v * 3 + 2] - base[v * 3 + 2]) > 1e-4) moved++;
  assert.ok(moved > 30 && moved < COUNTS.body * 0.12, `${key} moves a small part of the body: ${moved} vertices`);
}
// the skeleton measured on is the one the app poses with, and the shape matches it exactly
for (const fit of [{}, { foreArmSize: 0.7, ankleSize: -0.5, wristSize: 0.4, upperArmLen: 0.3 }]) {
  const s = shape(fit), a = shapeWithJoints(s), rig = createRestRig(s);
  let dp = 0, dj = 0;
  for (let i = 0; i < a.positions.length; i++) dp = Math.max(dp, Math.abs(a.positions[i] - rig.positions[i]));
  for (let i = 0; i < a.joints.length; i++) dj = Math.max(dj, Math.abs(a.joints[i] - rig.joints[i]));
  assert.ok(dp < 1e-6 && dj < 1e-6, `shape and rest rig agree: ${dp} ${dj}`);
}

// typed numbers
const eq = (t, v) => { const got = parseInches(t); assert.ok(got != null && Math.abs(got - v) < 1e-6, `${t} -> ${got}, expected ${v}`); };
eq('14.5', 14.5); eq('14 1/2', 14.5); eq('14½', 14.5); eq('14 ¾"', 14.75); eq('14.5 in', 14.5); eq('14,5', 14.5); eq('37 cm', 37 / 2.54); eq('370 mm', 370 / 25.4);
eq('5\' 10"', 70); eq('5 ft 10.5 in', 70.5); eq('6\'', 72); eq('.5', 0.5);
for (const bad of ['', 'abc', '14 1/0', null]) assert.equal(parseInches(bad), null, `${bad} is not a measurement`);
assert.equal(inchText(14.26), '14.3 in');
assert.ok(Math.abs(inchesToUnits(unitsToInches(0.3, 182), 182) - 0.3) < 1e-12, 'inches and units round trip');

// the search lands on a typed number, and says so when it can't
const lin = (v) => 10 + 2 * v; // 8 .. 12
const r1 = solveSlider(lin, 11.3); assert.ok(r1.reached && Math.abs(lin(r1.value) - 11.3) < 0.02, 'linear target reached');
const curve = (v) => 10 + 2 * v + 0.6 * v * v * v; const r2 = solveSlider(curve, 9.1); assert.ok(r2.reached && Math.abs(curve(r2.value) - 9.1) < 0.02, 'curved target reached');
const r3 = solveSlider(lin, 20); assert.equal(r3.reached, false); assert.equal(r3.value, 1); assert.equal(r3.hi, 12);

// several typed numbers on the real body at once, the first typed one first
const want = { upperArmSize: std.upperArmSize + 0.8, calfSize: std.calfSize - 0.6, waist: std.waist + 1.5, shinLen: std.shinLen + 0.5, wristSize: std.wristSize + 0.3 };
const t0 = Date.now();
const res = matchMeasurements({}, want, (fit, k) => inches(fit, k)[k] ?? null, { first: 'calfSize' });
const ms = Date.now() - t0, got = inches(res.fit);
for (const [k, v] of Object.entries(want)) assert.ok(Math.abs(got[k] - v) < 0.12, `${k}: wanted ${v.toFixed(2)}, got ${got[k].toFixed(2)}`);
assert.equal(res.misses.length, 0, 'nothing missed');
for (const k of Object.keys(res.fit)) assert.ok(k in want, `only the typed sliders moved: ${k}`);
// a number past the slider's reach is reported, with the range
const far = matchMeasurements({}, { wristSize: 30 }, (fit, k) => inches(fit, k)[k] ?? null);
assert.equal(far.misses.length, 1); assert.equal(far.misses[0].key, 'wristSize'); assert.ok(far.misses[0].hi > std.wristSize && far.fit.wristSize === 1, 'goes to the end and says how far it gets');
console.log(`PASS body-measure-unit: ${MEASURES.length} measurements, standard male: neck ${std.neckSize.toFixed(1)}, chest ${std.chest.toFixed(1)}, waist ${std.waist.toFixed(1)}, upper arm ${std.upperArmSize.toFixed(1)}, wrist ${std.wristSize.toFixed(1)}, calf ${std.calfSize.toFixed(1)}, ankle ${std.ankleSize.toFixed(1)} in; five typed numbers matched in ${ms} ms`);
