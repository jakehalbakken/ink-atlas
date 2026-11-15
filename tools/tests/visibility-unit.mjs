// What it shows in (src/visibility.js): the lightest outfit that hides a tattoo and the one just
// lighter that shows it, said by what differs.
// Run: node tools/tests/visibility-unit.mjs
import assert from 'node:assert/strict';
import { visibilityText, sittingWear } from '../../src/visibility.js';
assert.equal(visibilityText([1, 1, 1, 1, 1]), 'Hidden even in swimwear.');
assert.equal(visibilityText([0, 0, 0, 0, 0]), 'Shows even in long sleeves and long pants.');
assert.equal(visibilityText([0, 0, 0, 0, 0.5]), 'Partly hidden by long sleeves and long pants, so some of it always shows.');
assert.equal(visibilityText([0, 0, 1, 1, 1]), 'Hidden by a T-shirt, shows in a tank top.', 'upper arm');
assert.equal(visibilityText([0, 0, 0, 1, 1]), 'Hidden by long pants, shows in shorts.', 'calf');
assert.equal(visibilityText([0, 0, 0, 0, 1]), 'Hidden by long sleeves, shows in a T-shirt.', 'forearm');
assert.equal(visibilityText([0, 1, 1, 1, 1]), 'Hidden by a tank top and shorts, shows in swimwear.', 'chest');
assert.equal(visibilityText([0.3, 1, 1, 1, 1]), 'Hidden by a tank top and shorts, partly shows in swimwear.');
assert.equal(visibilityText([0, 0.5, 1, 1, 1]), 'Hidden by a T-shirt, partly shows in a tank top.');
assert.equal(visibilityText(null), '');
console.log('visibility-unit: ok');
import { wearAt } from '../../src/wear.js';
assert.equal(wearAt('Fingers').level, 3); assert.equal(wearAt('Hand').level, 3); assert.equal(wearAt('Inner elbow').level, 2);
assert.equal(wearAt('Back of neck').level, 1); assert.equal(wearAt('Chest').level, 0); assert.equal(wearAt('Body'), null); assert.equal(wearAt(''), null);
console.log('wear: ok');
// what to wear to the sitting: the warmest top and bottom that leave it open, said only where it matters
const open = { tank: 0, tee: 0, long: 0 }, legs = { swim: 0, shorts: 0, pants: 0 };
assert.equal(sittingWear({ tank: 0, tee: 0.05, long: 1 }, legs), 'For the sitting: wear a T-shirt, so the spot is open.', 'forearm');
assert.equal(sittingWear({ tank: 0, tee: 0.6, long: 1 }, legs), 'For the sitting: wear a tank top, so the spot is open.', 'shoulder');
assert.equal(sittingWear({ tank: 1, tee: 1, long: 1 }, legs), 'For the sitting: wear a top you can take off or open, like a button-up, so the spot is open.', 'chest');
assert.equal(sittingWear(open, { swim: 0, shorts: 0, pants: 1 }), 'For the sitting: wear shorts, so the spot is open.', 'calf');
assert.equal(sittingWear(open, { swim: 0, shorts: 0.5, pants: 1 }), 'For the sitting: wear shorts you can roll up high, or bring a pair to change into, so the spot is open.', 'upper thigh');
assert.equal(sittingWear({ tank: 0.3, tee: 1, long: 1 }, { swim: 0, shorts: 1, pants: 1 }), 'For the sitting: wear a top you can take off or open, like a button-up, and shorts you can roll up high, or bring a pair to change into, so the spot is open.', 'hip under both');
assert.equal(sittingWear({ tank: 0, tee: 0.05, long: 1 }, { swim: 0, shorts: 0.5, pants: 1 }), 'For the sitting: wear a T-shirt and shorts you can roll up high, or bring a pair to change into, so the spot is open.');
assert.equal(sittingWear(open, legs), 'For the sitting: any clothes leave it open.', 'hand or neck');
assert.equal(sittingWear(null, legs), '');
console.log('sitting wear: ok');
