// Two people's changes to one shared project put together (src/merge.js).
import assert from 'node:assert/strict';
import { mergeStates } from '../../src/merge.js';

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
console.log('merge-unit: ok');
