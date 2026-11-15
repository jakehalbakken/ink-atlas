// What changed since you last looked (src/changes.js).
import assert from 'node:assert/strict';
import { changesBetween } from '../../src/changes.js';
import { cleanReacts } from '../../src/project.js';
import { mergeStates } from '../../src/merge.js';

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
// replies and resolving
const later = JSON.parse(JSON.stringify(after));
later.notes[1].replies = [{ id: 'r1', text: 'how much higher?', by: 'Jake' }, { id: 'r2', text: 'an inch', by: 'Artist' }];
later.notes[1].done = { by: 'Artist', at: '2026-11-15' };
assert.deepEqual(changesBetween(after, later, { me: 'Jake' }).map((c) => c.text), ['Artist replied to "move it up": "an inch"', 'Artist marked "move it up" resolved']);
assert.equal(changesBetween(after, later, { me: 'Jake' })[0].noteId, 'n2');
assert.deepEqual(changesBetween(after, later, { me: 'Artist' }).map((c) => c.text), ['Jake replied to "move it up": "how much higher?"']);
const reopened = JSON.parse(JSON.stringify(later)); delete reopened.notes[1].done;
assert.deepEqual(changesBetween(later, reopened, { me: 'Artist' }).map((c) => c.text), ['Reopened "move it up"']);
// mentions of me come first and say so
{
  const b = { tattoos: [], notes: [{ id: 'm1', text: 'old', by: 'Jake', replies: [] }] };
  const a = { tattoos: [T('New')], notes: [{ id: 'm1', text: 'old', by: 'Jake', replies: [{ id: 'x', text: '@jake smaller?', by: 'Liv' }] }, { id: 'm2', text: 'hi @Liv', by: 'Mara' }] };
  const c = changesBetween(b, a, { me: 'Jake H' });
  assert.equal(c[0].mention, true); assert.match(c[0].text, /^Liv mentioned you on "old": "@jake smaller\?"$/);
  assert.equal(c.find((x) => x.noteId === 'm2').mention, undefined, 'a mention of someone else is a comment');
}
// reactions: cleaned to one of each kind per person, merged from both sides, listed for the others
{
  assert.deepEqual(cleanReacts([{ e: '👍', by: 'Liv' }, { e: '👍', by: 'Liv' }, { e: '💩', by: 'Liv' }, { e: '🔥', by: '' }, { e: '❤️', by: 'Jake', id: 'x' }]),
    [{ id: '👍|Liv', e: '👍', by: 'Liv' }, { id: '❤️|Jake', e: '❤️', by: 'Jake' }]);
  const base = { notes: [{ id: 'n', text: 'Darker here', reacts: [{ id: '👀|Mara', e: '👀', by: 'Mara' }] }] };
  const l = JSON.parse(JSON.stringify(base)); l.notes[0].reacts.push({ id: '👍|Jake', e: '👍', by: 'Jake' });
  const r = JSON.parse(JSON.stringify(base)); r.notes[0].reacts = [{ id: '🔥|Liv', e: '🔥', by: 'Liv' }];
  const m = mergeStates(base, l, r);
  assert.deepEqual(m.notes[0].reacts.map((x) => x.id).sort(), ['🔥|Liv', '👍|Jake'].sort(), 'both added, the one taken back stays gone');
  const c = changesBetween(base, r, { me: 'Jake' });
  assert.ok(c.some((x) => x.kind === 'react' && x.text === 'Liv reacted 🔥 to "Darker here"'));
  assert.ok(!changesBetween(base, l, { me: 'Jake' }).some((x) => x.kind === 'react'), 'not my own');
}
console.log('changes-unit: ok');
