// Undo and redo say what they changed: the step's words from the states before and after it.
import assert from 'node:assert/strict';
import { changeWords, undoToast } from '../../src/undo-words.js';
const t = (o) => ({ id: 'a', name: 'Rose', img: 'k1', pos: [0, 1, 0.1], normal: [0, 0, 1], width: 0.1, rot: 0, aspect: 1, opacity: 0.92, flip: false, locked: false, hidden: false, status: 'planned', ...o });
const S = (...tattoos) => ({ v: 2, tattoos, figure: 'male', muscle: 0.6, weight: 0.5, fit: {}, heightCm: 175, skin: 1 });
const w = (a, b) => changeWords(S(...a), S(...b));
assert.equal(w([t()], [t({ pos: [0.01, 1, 0.1], normal: [0.1, 0, 1] })]), 'moving Rose');
assert.equal(w([t()], [t({ width: 0.12 })]), 'resizing Rose');
assert.equal(w([t()], [t({ rot: 0.2 })]), 'turning Rose');
assert.equal(w([t()], [t({ wrap: 0.4 })]), 'the wrap on Rose');
assert.equal(w([t()], [t({ status: 'existing' })]), 'marking Rose as on your skin');
assert.equal(w([t({ status: 'existing' })], [t()]), 'marking Rose as planned');
assert.equal(w([t()], [t({ hidden: true })]), 'hiding Rose');
assert.equal(w([t()], [t({ locked: true })]), 'locking Rose');
assert.equal(w([t()], [t({ name: 'Peony' })]), 'renaming Rose');
assert.equal(w([t()], [t({ note: 'fine lines' })]), 'the note on Rose');
assert.equal(w([t()], [t({ img: 'k2' })]), 'the artwork of Rose');
assert.equal(w([t()], [t(), t({ id: 'b', name: 'Rose copy' })]), 'adding Rose copy');
assert.equal(w([t(), t({ id: 'b' })], [t()]), 'removing Rose');
assert.equal(w([], [t(), t({ id: 'b' }), t({ id: 'c' })]), 'adding 3 tattoos');
assert.equal(w([t(), t({ id: 'b', name: 'Moth' })], [t({ pos: [1, 1, 1] }), t({ id: 'b', name: 'Moth', pos: [2, 1, 1] })]), 'moving 2 tattoos');
assert.equal(w([t(), t({ id: 'b', name: 'Moth' })], [t({ width: 0.2 }), t({ id: 'b', name: 'Moth', rot: 1 })]), 'changes to 2 tattoos');
assert.equal(w([t(), t({ id: 'b' })], [t({ id: 'b' }), t()]), 'reordering the tattoos');
assert.equal(changeWords({ ...S(t()), muscle: 0.8 }, S(t())), 'the body shape');
assert.equal(changeWords({ ...S(t()), fit: { waist: 0.2 } }, S(t())), 'the body shape');
assert.equal(changeWords({ ...S(t()), skinHex: '#aa8866' }, S(t())), 'the skin tone');
assert.equal(changeWords({ ...S(t()), heightCm: 180 }, S(t())), 'the height');
assert.equal(changeWords(S(t()), S(t())), '');
assert.equal(changeWords(null, S()), '');
// folders (2026-11-23): putting a line in a folder, taking it out, Sort by area, a folder renamed or
// made, said in words, not "the change to" or "the last change"
{
  const G = (...g) => g.map(([id, name, area]) => (area ? { id, name, area } : { id, name }));
  const F = (tats, groups) => ({ ...S(...tats), groups });
  const fw = (a, ga, b, gb) => changeWords(F(a, ga), F(b, gb));
  const g1 = G(['f1', 'Left thigh', 'Left thigh']);
  assert.equal(fw([t()], g1, [t({ group: 'f1' })], g1), 'putting Rose in Left thigh');
  assert.equal(fw([t({ group: 'f1' })], g1, [t()], g1), 'taking Rose out of Left thigh');
  assert.equal(fw([t(), t({ id: 'b', name: 'Moth' })], [], [t({ group: 'f1' }), t({ id: 'b', name: 'Moth', group: 'f1' })], g1), 'the folders', 'Sort by area');
  assert.equal(fw([t({ group: 'f1' })], g1, [t({ group: 'f1' })], G(['f1', 'Leg piece', 'Left thigh'])), 'renaming Left thigh');
  assert.equal(fw([t()], [], [t()], G(['f2', 'Flash ideas'])), 'the folders', 'a folder made');
  assert.equal(fw([t({ group: 'f1' })], g1, [t({ group: 'f1', pos: [1, 1, 1] })], g1), 'moving Rose', 'a move says moving');
  assert.equal(fw([t()], g1, [t({ pos: [1, 1, 1], group: 'f1' })], g1), 'moving Rose', 'a move that refiles it still says moving');
  console.log('undo words: folders ok');
}
assert.equal(undoToast('moving Rose'), 'Undid moving Rose.');
assert.equal(undoToast('moving Rose', true), 'Redid moving Rose.');
assert.equal(undoToast(''), 'Undone.');
console.log('PASS undo-words-unit');
// the history list: newest first, each with how many undos reach before it
{
  const { historyList } = await import('../../src/undo-words.js');
  const s0 = { tattoos: [{ id: 'a', name: 'Rose', pos: [0, 0, 0], width: 0.1 }] };
  const s1 = { tattoos: [{ id: 'a', name: 'Rose', pos: [0, 1, 0], width: 0.1 }] };
  const s2 = { tattoos: [{ id: 'a', name: 'Rose', pos: [0, 1, 0], width: 0.2 }] };
  const s3 = { ...s2, fit: { waist: 0.3 } };
  const h = historyList([s0, s1, s2].map((x) => JSON.stringify(x)), s3);
  assert.deepEqual(h.map((x) => x.steps), [1, 2, 3]);
  assert.deepEqual(h.map((x) => x.words), ['The body shape', 'Resizing Rose', 'Moving Rose']);
  assert.equal(historyList([], s3).length, 0);
  assert.equal(historyList(Array(30).fill(JSON.stringify(s0)), s0, 15).length, 15, 'at most 15');
  assert.equal(historyList([JSON.stringify(s0)], s0)[0].words, 'A change');
  console.log('history list ok');
}
