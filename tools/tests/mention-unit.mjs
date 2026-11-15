// @mentions (src/mention.js).
import assert from 'node:assert/strict';
import { mentioned, mentionsMe, pieces, typingMention, offer, insertMention } from '../../src/mention.js';

assert.deepEqual(mentioned('@Liv can you look? cc @Jake'), ['Liv', 'Jake']);
assert.deepEqual(mentioned('mail me at jake@example.com'), [], 'an email address is not a mention');
assert.deepEqual(mentioned('(@José) and @Zoë-Ann'), ['José', 'Zoë-Ann']);
assert.equal(mentionsMe('hey @jake, smaller?', 'Jake Halbakken'), true, 'first name, any case');
assert.equal(mentionsMe('hey @Jakey', 'Jake'), false, 'a longer word is someone else');
assert.equal(mentionsMe('hey @Jake', ''), false, 'no name, no mention');
assert.deepEqual(pieces('ok @Jake, see @Liv', 'Jake'), [{ text: 'ok ', me: false }, { text: '@Jake', me: true }, { text: ', see @Liv', me: false }]);
assert.deepEqual(pieces('plain', 'Jake'), [{ text: 'plain', me: false }]);
assert.deepEqual(pieces('', 'Jake'), [{ text: '', me: false }]);

assert.deepEqual(typingMention('thanks @Li', 10), { start: 7, end: 10, partial: 'Li' });
assert.deepEqual(typingMention('@', 1), { start: 0, end: 1, partial: '' });
assert.equal(typingMention('jake@ex', 7), null, 'inside an email address');
assert.equal(typingMention('@Liv done', 9), null, 'after a space the word is finished');
assert.deepEqual(typingMention('@Lixx more', 2), { start: 0, end: 5, partial: 'L' }, 'the whole word is replaced');

assert.deepEqual(offer('l', ['Liv Moreno', 'Jake Halbakken', 'liv', 'Lars', 'Mara'], 'Jake'), ['Liv', 'Lars'], 'each first name once, not me');
assert.deepEqual(offer('', ['A', 'B', 'C', 'D', 'E'], ''), ['A', 'B', 'C', 'D'], 'four at most');
assert.deepEqual(offer('j', ['Jake H'], 'Jake'), [], 'never myself');

const at = typingMention('thanks @Li', 10);
assert.deepEqual(insertMention('thanks @Li', at, 'Liv'), { value: 'thanks @Liv ', caret: 12 });
assert.deepEqual(insertMention('@L hi', typingMention('@L hi', 2), 'Liv'), { value: '@Liv hi', caret: 4 });
console.log('mention-unit: ok');
