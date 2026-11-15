// Compare spots: the line under each spot in Try other spots.
import assert from 'node:assert/strict';
import { spotNote } from '../../src/spots.js';
assert.equal(spotNote(2, [0, 0, 1, 1, 1]), 'Low pain, a T-shirt hides it');
assert.equal(spotNote(5, [0, 1, 1, 1, 1], true), 'Some pain, shorts hide it');
assert.equal(spotNote(7, [0, 0, 0, 0, 0]), 'High pain, always shows');
assert.equal(spotNote(9, [1, 1, 1, 1, 1]), 'Very high pain, hidden in swimwear');
assert.equal(spotNote(3, [0, 0, 0.2, 0.95, 1]), 'Low pain, long pants hide it');
assert.equal(spotNote(4, [0, 0, 0, 0, 0.92]), 'Some pain, long sleeves hide it');
assert.equal(spotNote(null, [0, 0, 1, 1, 1]), 'A T-shirt hides it');
assert.equal(spotNote(5, null), 'Some pain');
assert.equal(spotNote(null, null), '');
// the pain words break at the same levels as the pain map
assert.equal(spotNote(3.49, null), 'Low pain'); assert.equal(spotNote(6.5, null), 'High pain'); assert.equal(spotNote(8, null), 'Very high pain');
console.log('spot-note-unit ok');
