// What changed since you last looked (src/changes.js).
import assert from 'node:assert/strict';
import { changesBetween } from '../../src/changes.js';

const T = (id, more) => ({ id, name: id, img: 'k' + id, width: 0.1, rot: 0, pos: [0, 1, 0], ...more });
const before = { skin: 1, muscle: 0.5, tattoos: [T('Rose'), T('Koi'), T('Moth')], notes: [{ id: 'n1', text: 'old', by: 'Jake' }] };
const after = JSON.parse(JSON.stringify(before));
after.tattoos[0].pos = [0, 1.02, 0]; after.tattoos[0].width = 0.12;
after.tattoos[1].review = { verdict: 'changes', note: 'a little smaller please', by: 'Artist' };
after.tattoos = after.tattoos.filter((t) => t.id !== 'Moth');
after.tattoos.push(T('Swallow'));
after.notes.push({ id: 'n2', text: 'move it up', by: 'Artist', pin: { tri: 1, w: [1, 0, 0] } }, { id: 'n3', text: 'mine', by: 'Jake' });
after.refs = [{ id: 'r1', img: 'x', by: 'Artist' }, { id: 'r2', img: 'y', by: 'Artist' }];
after.muscle = 0.7;
const got = changesBetween(before, after, { me: 'Jake', inches: (w) => w * 100 / 2.54 });
const texts = got.map((c) => c.text);
assert.deepEqual(texts, [
  '"Rose": moved it, made it bigger (3.9 to 4.7 in)',
  'Artist asked for a change on "Koi": "a little smaller please"',
  'Added "Swallow"',
  'Removed "Moth"',
  'Artist commented: "move it up"',
  'Artist added 2 reference pictures',
  'Changed the body shape',
]);
assert.equal(got[0].tattooId, 'Rose'); assert.equal(got[4].noteId, 'n2'); assert.equal(got[4].pinned, true);
assert.deepEqual(changesBetween(before, JSON.parse(JSON.stringify(before))), [], 'nothing changed');
// my own answer is not news to me
const mine = JSON.parse(JSON.stringify(before)); mine.tattoos[2].review = { verdict: 'approved', by: 'Jake' };
assert.deepEqual(changesBetween(before, mine, { me: 'Jake' }), []);
assert.deepEqual(changesBetween(before, mine, { me: 'Liv' }).map((c) => c.text), ['Jake said yes to "Moth"']);
assert.deepEqual(changesBetween(null, after), [], 'nothing to compare with');
console.log('changes-unit: ok');
