// What it shows in (src/visibility.js): the lightest outfit that hides a tattoo and the one just
// lighter that shows it, said by what differs.
// Run: node tools/tests/visibility-unit.mjs
import assert from 'node:assert/strict';
import { visibilityText } from '../../src/visibility.js';
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
