// Find a comment (src/comment-find.js).
import assert from 'node:assert/strict';
import { words, matchesComment } from '../../src/comment-find.js';

const n = { text: 'Move this up an inch', by: 'Liv', replies: [{ id: 'r1', text: 'Café line looks thin', by: 'José' }] };
assert.deepEqual(words('  Up   INCH '), ['up', 'inch']);
assert.equal(matchesComment(n, ''), true, 'empty search shows everything');
assert.equal(matchesComment(n, 'inch'), true);
assert.equal(matchesComment(n, 'liv inch'), true, 'every word, anywhere');
assert.equal(matchesComment(n, 'cafe'), true, 'accents do not matter');
assert.equal(matchesComment(n, 'jose'), true, 'who replied');
assert.equal(matchesComment(n, 'rose'), false);
assert.equal(matchesComment(n, 'rose', 'Rose sleeve'), true, 'the tattoo it is on');
assert.equal(matchesComment(n, 'inch rose'), false, 'all words must match');
assert.equal(matchesComment({}, 'x'), false, 'an empty comment matches nothing');
assert.equal(matchesComment({ text: 'a', replies: 'bad' }, 'a'), true, 'odd replies are ignored');
console.log('comment-find-unit: ok');
