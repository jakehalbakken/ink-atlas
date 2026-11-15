// Two people's changes to one shared project put together (src/merge.js).
import assert from 'node:assert/strict';
import { mergeStates, commentsOnto } from '../../src/merge.js';

const T = (id, more) => ({ id, name: id, width: 0.1, rot: 0, pos: [0, 1, 0], ...more });
const base = { skin: 1, heightCm: 175, tattoos: [T('a'), T('b'), T('c')], notes: [{ id: 'n1', text: 'hi' }] };
const clone = (x) => JSON.parse(JSON.stringify(x));

// Jake moves a, Liv approves a and adds d: both kept
let l = clone(base), r = clone(base);
l.tattoos[0].pos = [0, 1.2, 0];
r.tattoos[0].review = { verdict: 'approved', note: '', by: 'Liv', at: '2026-11-14' };
r.tattoos.splice(1, 0, T('d'));
let m = mergeStates(base, l, r);
assert.deepEqual(m.tattoos.map((t) => t.id), ['a', 'd', 'b', 'c'], 'added there, in its place');
assert.deepEqual(m.tattoos[0].pos, [0, 1.2, 0], 'my move kept');
assert.equal(m.tattoos[0].review.by, 'Liv', 'their approval kept');

// removed there and untouched here: goes. removed here, untouched there: goes.
l = clone(base); r = clone(base);
r.tattoos = r.tattoos.filter((t) => t.id !== 'b');
l.tattoos = l.tattoos.filter((t) => t.id !== 'c');
m = mergeStates(base, l, r);
assert.deepEqual(m.tattoos.map((t) => t.id), ['a'], 'both removals applied');

// removed there but changed here: stays (an edit is never thrown away)
l = clone(base); r = clone(base);
r.tattoos = r.tattoos.filter((t) => t.id !== 'b');
l.tattoos[1].width = 0.2;
m = mergeStates(base, l, r);
assert.deepEqual(m.tattoos.map((t) => t.id), ['a', 'b', 'c']);
assert.equal(m.tattoos[1].width, 0.2);

// both change the same field: this device wins; other fields from there
l = clone(base); r = clone(base);
l.tattoos[2].width = 0.3; r.tattoos[2].width = 0.05; r.tattoos[2].name = 'Rose';
m = mergeStates(base, l, r);
assert.equal(m.tattoos[2].width, 0.3); assert.equal(m.tattoos[2].name, 'Rose');

// settings: changed here wins, otherwise theirs; a field they removed goes
l = clone(base); r = clone(base);
l.heightCm = 180; r.skin = 3; r.notes = [...r.notes, { id: 'n2', text: 'move this up an inch', pin: { tri: 10, w: [0.2, 0.3, 0.5] } }];
m = mergeStates(base, l, r);
assert.equal(m.heightCm, 180); assert.equal(m.skin, 3); assert.equal(m.notes.length, 2, 'their pinned comment arrives');
const b2 = { ...clone(base), paint: { img: 'p1', hidden: false } }, l2 = clone(b2), r2 = clone(b2); delete r2.paint;
assert.equal(mergeStates(b2, l2, r2).paint, undefined, 'paint they removed stays removed');

// no base: nothing is removed, mine wins where both have one
l = clone(base); r = clone(base);
l.tattoos = [T('a', { width: 0.4 }), T('x')]; r.tattoos = [T('a', { width: 0.2, review: { verdict: 'changes' } }), T('b'), T('y')];
m = mergeStates(null, l, r);
assert.deepEqual(m.tattoos.map((t) => t.id).sort(), ['a', 'b', 'x', 'y']);
assert.equal(m.tattoos.find((t) => t.id === 'a').width, 0.4); assert.equal(m.tattoos.find((t) => t.id === 'a').review.verdict, 'changes');

// the same edit on both sides is not doubled
l = clone(base); r = clone(base); l.tattoos.push(T('z')); r.tattoos.push(T('z'));
assert.deepEqual(mergeStates(base, l, r).tattoos.map((t) => t.id), ['a', 'b', 'c', 'z']);
// comment only: the account's project as it is, plus my comments, answers and reference pictures
{
  const b0 = clone(base), l0 = clone(base), r0 = clone(base);
  l0.tattoos[0].width = 0.5; l0.skin = 3; // tried to change things they cannot: dropped
  l0.tattoos[1].review = { verdict: 'changes', note: 'smaller', by: 'Artist', at: '2026-11-15' };
  l0.notes.push({ id: 'n2', text: 'move up', by: 'Artist' });
  l0.refs = [{ id: 'r1', img: 'k9', by: 'Artist' }];
  r0.tattoos[2].pos = [0, 0.5, 0]; r0.notes.push({ id: 'n3', text: 'from Jake', by: 'Jake' });
  r0.tattoos[0].review = { verdict: 'approved', by: 'Liv' };
  const c = commentsOnto(b0, l0, r0);
  assert.equal(c.tattoos[0].width, 0.1, 'their resize is not kept'); assert.equal(c.skin, 1, 'nor the skin');
  assert.deepEqual(c.tattoos[2].pos, [0, 0.5, 0], 'the account\'s move kept');
  assert.equal(c.tattoos[0].review.by, 'Liv', 'someone else\'s answer kept');
  assert.equal(c.tattoos[1].review.note, 'smaller', 'my answer added');
  assert.deepEqual(c.notes.map((n) => n.id), ['n1', 'n3', 'n2'], 'both comments kept');
  assert.deepEqual(c.refs, [{ id: 'r1', img: 'k9', by: 'Artist' }], 'my reference picture added');
  // taking my answer back, and deleting my comment
  const b1 = clone(c), l1 = clone(c); delete l1.tattoos[1].review; l1.notes = l1.notes.filter((n) => n.id !== 'n2');
  const c1 = commentsOnto(b1, l1, clone(c));
  assert.equal(c1.tattoos[1].review, undefined, 'answer taken back'); assert.deepEqual(c1.notes.map((n) => n.id), ['n1', 'n3']);
  // nothing of mine changed: exactly the account's
  assert.deepEqual(commentsOnto(clone(base), clone(base), r0), r0);
}
console.log('merge-unit: ok');
