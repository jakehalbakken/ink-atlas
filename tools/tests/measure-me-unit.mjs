// The number pad (num-pad.js) and Measure me (measure-me.js): keys build sensible text, fractions
// and points never mix, feet and inches read right, cm convert, what the pad opens with reads back
// the same; Measure me asks height first, then round measurements top to bottom, then optional
// lengths, only for sliders this body shows, and every screen has a drawing with the tape on it.
// node tools/tests/measure-me-unit.mjs
import assert from 'node:assert/strict';
import { padKey, padValue, padStart } from '../../src/num-pad.js';
import { measureSteps, measureDiagram } from '../../src/measure-me.js';
import { MEASURES } from '../../src/body-measure.js';

const type = (keys, unit = 'in', start = '') => keys.reduce((t, k) => padKey(t, k, unit), start);
assert.equal(type(['1', '4', '.', '5']), '14.5');
assert.equal(type(['1', '4', '½']), '14 ½');
assert.equal(type(['1', '4', '½', '¾']), '14 ¾', 'a second fraction replaces the first');
assert.equal(type(['1', '4', '.', '5', '½']), '14.5', 'no fraction after a point');
assert.equal(type(['1', '4', '½', '.']), '14 ½', 'no point after a fraction');
assert.equal(type(['1', '4', '½', '3']), '14 ½', 'no digit after a fraction');
assert.equal(type(['.', '5']), '0.5');
assert.equal(type(['1', '.', '.', '2']), '1.2');
assert.equal(type(['0', '7']), '7', 'no leading zero');
assert.equal(type(['1', '4', '½', '⌫']), '14', 'delete takes the fraction and its space');
assert.equal(type(['1', '2', '3', '4', '5']), '1234', 'four digits at most');
assert.equal(type(['3', '7', '½'], 'cm'), '37', 'no fractions in cm');
assert.equal(type(['5', "'", '1', '0', '.', '5'], 'ft'), "5' 10.5");
assert.equal(type(['5', "'", "'"], 'ft'), "5' ", 'one feet mark');
assert.equal(type(["'"], 'ft'), '', 'feet mark needs a number');

const near = (a, b, msg) => assert.ok(a != null && Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
near(padValue('14.5'), 14.5, 'decimal'); near(padValue('14 ½'), 14.5, 'half'); near(padValue('14 ¼'), 14.25, 'quarter'); near(padValue('¾'), 0.75, 'fraction alone');
near(padValue('37', 'cm'), 37 / 2.54, 'cm'); near(padValue("5' 10.5", 'ft'), 70.5, 'feet and inches'); near(padValue('6', 'ft'), 72, 'bare feet');
near(padValue('70', 'ft'), 70, 'a big bare number is inches'); near(padValue("5'", 'ft'), 60, 'feet only'); near(padValue("5' 10 ½", 'ft'), 70.5, 'feet, inches and a half');
for (const bad of ['', '.', ' ']) assert.equal(padValue(bad), null, `${JSON.stringify(bad)} is nothing`);
for (const [v, u] of [[14.3, 'in'], [13.75, 'in'], [70.5, 'ft'], [69.9, 'ft'], [14.4, 'cm']]) { const t = padStart(v, u); assert.ok(Math.abs(padValue(t, u) - v) < 0.06, `${v} ${u} opens as ${t} and reads back`); }
assert.equal(padStart(71.97, 'ft'), "6' 0", 'rounds up into the next foot');

// Measure me: the order, the filter and the drawings
const steps = measureSteps();
assert.equal(steps[0].key, 'height');
const keys = steps.map((s) => s.key);
for (const k of ['neckSize', 'shoulders', 'chest', 'waist', 'hips', 'upperArmSize', 'foreArmSize', 'wristSize', 'thighSize', 'calfSize', 'ankleSize']) assert.ok(keys.includes(k), `${k} asked`);
assert.ok(keys.indexOf('chest') < keys.indexOf('waist') && keys.indexOf('waist') < keys.indexOf('hips') && keys.indexOf('wristSize') < keys.indexOf('thighSize') && keys.indexOf('calfSize') < keys.indexOf('ankleSize'), 'top to bottom');
const firstLen = steps.findIndex((s) => s.optional); assert.ok(firstLen > keys.indexOf('ankleSize') && steps.slice(firstLen).every((s) => s.optional), 'lengths last, all optional');
for (const s of steps) { assert.ok(s.tip && s.tip.length > 20, `${s.key} says how`); assert.ok(!/—/.test(s.tip), 'no em-dashes'); const svg = measureDiagram(s.key); assert.match(svg, /class="md-tape"/, `${s.key} has the tape drawn`); assert.match(svg, /^<svg[^>]*viewBox/); }
for (const s of steps) if (s.key !== 'height') assert.ok(MEASURES.some((m) => m.key === s.key), `${s.key} is a real measurement`);
assert.ok(!measureSteps((k) => k !== 'wristSize').some((s) => s.key === 'wristSize'), 'a slider this body hides is not asked');
console.log(`PASS measure-me-unit: pad keys, feet, fractions and cm; ${steps.length} screens, ${steps.filter((s) => s.optional).length} optional`);
