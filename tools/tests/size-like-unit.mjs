// Size as an everyday thing (src/size-like.js): the nearest everyday thing by both sides, with a
// plain word for a bit bigger or smaller, tiny pieces, and nothing when nothing is close.
import assert from 'node:assert/strict';
import { sizeLikeText, sizeLike, THINGS } from '../../src/size-like.js';

assert.equal(sizeLikeText(3.37, 2.13), 'About the size of a credit card.');
assert.equal(sizeLikeText(2.13, 3.37), 'About the size of a credit card.', 'either way round');
assert.equal(sizeLikeText(1, 1), 'About the size of a postage stamp.');
assert.equal(sizeLikeText(3, 3), 'About the size of a playing card.');
assert.equal(sizeLikeText(6, 1), 'About the size of a toothbrush.', 'a long thin script');
assert.equal(sizeLikeText(14, 12), 'About the size of a record sleeve.');
assert.equal(sizeLikeText(18, 14), 'About the size of a large pizza box.', 'a back piece');
assert.equal(sizeLikeText(0.3, 0.3), 'Tiny: smaller than a fingernail.');
assert.equal(sizeLikeText(30, 20), 'Bigger than a newspaper page.');
assert.match(sizeLikeText(2, 2), /^A bit bigger than /);
assert.match(sizeLikeText(9, 7), /^A bit smaller than /);
assert.equal(sizeLikeText(0, 2), ''); assert.equal(sizeLikeText(NaN, 2), '');
assert.equal(sizeLikeText(40, 0.2), '', 'nothing close: say nothing');
// every thing names itself at its own size
for (const x of THINGS) assert.equal(sizeLike(x.l, x.s).thing, x.say, x.say);
// no em-dashes in anything said
for (const x of THINGS) assert.ok(!/—/.test(x.say));
console.log('PASS size-like-unit: ' + [[3.4, 2.1], [6, 1], [18, 14]].map(([w, h]) => sizeLikeText(w, h)).join(' | '));
