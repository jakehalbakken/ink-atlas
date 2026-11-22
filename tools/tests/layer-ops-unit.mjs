// Layer actions (src/layer-ops.js): duplicate copies everything in place, the list order with groups,
// pinch ranges, Merge down's line below, moving a line (into and out of groups), which tattoo a merge
// keeps and when one is refused, comments moved onto it, the triangle maths of flattening, and how
// a finger move reads. Run: node tools/tests/layer-ops-unit.mjs
import assert from 'node:assert/strict';
import { displayOrder, rangeBetween, lineBelow, duplicateTattoo, copyName, moveLine, mergePlan, applyMerge, affineFor, grow, inkFromDarkening, doubled, darkBox, swipeKind, pinchMerges, SWIPE } from '../../src/layer-ops.js';

const mk = () => ({
  groups: [{ id: 'g1', name: 'Arm' }],
  tattoos: [
    { id: 'a', name: 'Rose', pos: [0, 1, 0], warp: { n: 3, p: [1, 2] }, bend: 0.3, blend: 'screen', fromLayer: { id: 'L' }, review: { s: 'ok' }, note: 'thin', group: 'g1' },
    { id: 'b', name: 'Sun', pos: [0, 1.1, 0] },
    { id: 'c', name: 'Moon', pos: [0, 1.2, 0], group: 'g1' },
    { id: 'd', name: 'Star', pos: [0, 1.3, 0], status: 'existing', locked: true },
  ],
  notes: [{ id: 'n1', tattooId: 'b' }, { id: 'n2', tattooId: 'c', suggest: { tattooId: 'c' } }], refs: [{ id: 'r1', tattooId: 'c' }],
});

// groups first, then the rest, each in the project's order
assert.deepEqual(displayOrder(mk()), ['a', 'c', 'b', 'd']);
assert.deepEqual(rangeBetween(['a', 'c', 'b', 'd'], 'b', 'a'), ['a', 'c', 'b']);
assert.deepEqual(rangeBetween(['a', 'c'], 'a', 'z'), []);
assert.equal(lineBelow(mk(), 'a'), 'c'); assert.equal(lineBelow(mk(), 'c'), 'b'); assert.equal(lineBelow(mk(), 'd'), null);

// duplicate: an exact copy right after it, bend, warp, blend, note and group kept, its own name and id
{ const s = mk(), c = duplicateTattoo(s, 'a', 'a2');
  assert.equal(s.tattoos[1], c); assert.equal(c.id, 'a2'); assert.equal(c.name, 'Rose copy');
  assert.deepEqual(c.warp, s.tattoos[0].warp); assert.notEqual(c.warp, s.tattoos[0].warp, 'a copy, not shared');
  assert.equal(c.bend, 0.3); assert.equal(c.blend, 'screen'); assert.equal(c.note, 'thin'); assert.equal(c.group, 'g1'); assert.deepEqual(c.pos, [0, 1, 0]);
  assert.equal(c.fromLayer, undefined); assert.equal(c.review, undefined); assert.ok(s.tattoos[0].fromLayer, 'the original keeps its marks');
  const c2 = duplicateTattoo(s, 'a2', 'a3'); assert.equal(c2.name, 'Rose copy 2');
  assert.equal(duplicateTattoo(s, 'zz', 'x'), null); }
assert.equal(copyName({ tattoos: [{ name: 'X copy' }, { name: 'X copy 2' }] }, 'X copy'), 'X copy 3');

// moving a line: above another (joins its group), to the end of a group, out of groups
{ const s = mk(); assert.equal(moveLine(s, 'b', { before: 'a' }), true); assert.equal(s.tattoos.find((t) => t.id === 'b').group, 'g1'); assert.deepEqual(displayOrder(s), ['b', 'a', 'c', 'd']); }
{ const s = mk(); moveLine(s, 'd', { group: 'g1' }); assert.deepEqual(displayOrder(s), ['a', 'c', 'd', 'b']); }
{ const s = mk(); moveLine(s, 'a', { group: null }); assert.equal(s.tattoos.find((t) => t.id === 'a').group, undefined); assert.deepEqual(displayOrder(s), ['c', 'b', 'd', 'a']); }
{ const s = mk(); moveLine(s, 'a', { before: 'd' }); assert.deepEqual(displayOrder(s), ['c', 'b', 'a', 'd']); }
{ const s = mk(); assert.equal(moveLine(s, 'a', { before: 'c' }), false, 'already there'); assert.equal(moveLine(s, 'a', { before: 'a' }), false); }
{ const s = mk(); s.tattoos[1].group = 'gone'; moveLine(s, 'a', { before: 'b' }); assert.equal(s.tattoos.find((t) => t.id === 'a').group, undefined, 'an unknown group counts as none'); }

// merge plan: the lowest in the list is kept; mixed kinds and locked planned pieces are refused
{ const s = mk(), p = mergePlan(s, ['a', 'b']); assert.equal(p.ok, true); assert.equal(p.target, 'b'); assert.equal(p.existing, false); }
{ const s = mk(); assert.equal(mergePlan(s, ['a', 'c']).target, 'c'); }
assert.equal(mergePlan(mk(), ['a']).ok, false);
assert.match(mergePlan(mk(), ['a', 'd']).why, /one kind/);
{ const s = mk(); s.tattoos[1].locked = true; assert.match(mergePlan(s, ['a', 'b']).why, /Sun is locked/); }
{ const s = mk(); s.tattoos[0].status = 'existing'; s.tattoos[0].locked = true; const p = mergePlan(s, ['a', 'd']); assert.equal(p.ok, true); assert.equal(p.existing, true); assert.equal(p.target, 'd'); }

// applying a merge: one tattoo in the lowest one's place, comments and pictures moved onto it
{ const s = mk(); applyMerge(s, ['a', 'b', 'c'], 'b', { id: 'b', name: 'Sun', img: 'new' });
  assert.deepEqual(s.tattoos.map((t) => t.id), ['b', 'd']); assert.equal(s.tattoos[0].img, 'new');
  assert.equal(s.notes[1].tattooId, 'b'); assert.equal(s.notes[1].suggest, undefined, 'a suggested spot for a merged-away piece is dropped'); assert.equal(s.refs[0].tattooId, 'b'); }

// triangle maps
{ const s = [[0, 0], [10, 0], [0, 10]], d = [[5, 5], [5, 25], [-15, 5]], A = affineFor(s, d);
  const ap = ([x, y]) => [A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5]];
  for (let i = 0; i < 3; i++) { const [x, y] = ap(s[i]); assert.ok(Math.abs(x - d[i][0]) < 1e-9 && Math.abs(y - d[i][1]) < 1e-9, 'corner ' + i); }
  assert.equal(affineFor([[0, 0], [1, 1], [2, 2]], d), null, 'no area');
  const gr = grow(s, 1); assert.ok(gr[0][0] < 0 && gr[0][1] < 0 && gr[1][0] > 10 && gr[2][1] > 10); }

// darkening back to ink: white is clear, black is black, a grey over white comes back as see-through black
{ const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255, 255, 128, 128, 255]); inkFromDarkening(px);
  assert.equal(px[3], 0); assert.deepEqual([...px.slice(4, 8)], [0, 0, 0, 255]);
  assert.ok(px[8] < 2 && Math.abs(px[11] - 127) <= 1, 'grey is half black');
  assert.ok(px[12] > 250 && px[13] < 3 && Math.abs(px[15] - 127) <= 1, 'pink is half-strength red');
  // multiplied back on white it gives the same darkening
  const r = 255 - px[15] / 255 * (255 - px[12]); assert.ok(Math.abs(r - 255) < 2); const gch = 255 - px[15] / 255 * (255 - px[13]); assert.ok(Math.abs(gch - 128) < 2); }
{ const px = new Uint8ClampedArray([100, 200, 127, 255]); doubled(px); assert.deepEqual([...px], [200, 255, 254, 255]); }
{ const w = 4, h = 3, px = new Uint8ClampedArray(w * h * 4).fill(255); assert.equal(darkBox(px, w, h), null); px[(1 * w + 2) * 4] = 40; px[(2 * w + 1) * 4 + 1] = 100; assert.deepEqual(darkBox(px, w, h), { x: 1, y: 1, w: 2, h: 2 }); }

// how a finger move reads
assert.equal(swipeKind(3, 2), null); assert.equal(swipeKind(-30, 4), 'left'); assert.equal(swipeKind(30, -5), 'right'); assert.equal(swipeKind(8, 30), 'scroll');
assert.ok(SWIPE.actions >= 3 * 44, 'three buttons, each at least 44 pt');
assert.equal(pinchMerges(200, 120), false); assert.equal(pinchMerges(200, 100), true); assert.equal(pinchMerges(20, 2), false, 'fingers that start together are not a pinch');
console.log('layer-ops-unit: all good');
