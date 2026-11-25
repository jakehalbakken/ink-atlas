// Unit checks for how much Clean up's undo steps hold (src/cleanup-memory.js) and for the
// Clean up draft kept on the device (src/cleanup-draft.js). Run: node tools/tests/cleanup-memory-unit.mjs
import assert from 'node:assert/strict';
import { heldBytes, trimStack, reuseRead, UNDO_BUDGET } from '../../src/cleanup-memory.js';
import { cleanDraft, draftFits, DRAFT_MAX_AGE } from '../../src/cleanup-draft.js';

const pic = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const MB = 1024 * 1024;
// a picture shared by two steps is counted once
{
  const orig = pic(1000, 1000), base = pic(1000, 1000);
  const a = { full: pic(1000, 1000), baseline: base, pixels: pic(1000, 1000), original: orig };
  const b = { full: pic(1000, 1000), baseline: base, pixels: pic(1000, 1000), original: orig };
  assert.equal(heldBytes([[a]]), 16e6);
  assert.equal(heldBytes([[a, b]]), 24e6, 'the unchanged original and baseline are not counted twice');
  assert.equal(heldBytes([[a], [b]]), 24e6, 'across the undo and redo stacks too');
  assert.equal(heldBytes([[{ selOnly: true, sel: new Uint8Array(100) }]]), 100, 'a selection step holds only its selection');
}
// trimming keeps the newest step and drops the oldest until it fits
{
  const shared = pic(1600, 1600);
  const step = () => ({ full: pic(1600, 1600), baseline: shared, pixels: pic(1600, 1600), original: shared });
  const h = Array.from({ length: 10 }, step), newest = h[9];
  trimStack(h);
  assert(heldBytes([h]) <= UNDO_BUDGET, 'held pictures fit the budget');
  assert(h.length >= 2, 'more than one undo step at 1600 px when pictures are shared');
  assert.equal(h[h.length - 1], newest, 'the newest step is kept');
  const huge = [{ full: pic(4000, 4000), baseline: pic(4000, 4000), pixels: pic(4000, 4000), original: pic(4000, 4000) }];
  trimStack(huge); assert.equal(huge.length, 1, 'one step is always kept so the last change can be undone');
  const hist = Array.from({ length: 4 }, step), fut = Array.from({ length: 4 }, step);
  trimStack(hist, [fut]); assert(heldBytes([hist, fut]) <= UNDO_BUDGET || hist.length === 1, 'the redo steps count against the same budget');
  assert(UNDO_BUDGET <= 64 * MB);
}
// a canvas read again with no change in between hands back the same pixels
{
  const cache = {}; let reads = 0; const read = () => { reads++; return pic(4, 4); };
  const a = reuseRead(cache, 'full', 3, 4, 4, read), b = reuseRead(cache, 'full', 3, 4, 4, read);
  assert.equal(a, b); assert.equal(reads, 1);
  const c = reuseRead(cache, 'full', 4, 4, 4, read); assert.notEqual(c, a, 'a change means a fresh copy'); assert.equal(reads, 2);
  const d = reuseRead(cache, 'full', 4, 5, 4, read); assert.notEqual(d, c, 'a new size means a fresh copy');
}
// the draft kept on the device
{
  const png = () => { const b = new ArrayBuffer(64); new Uint8Array(b).set([137, 80, 78, 71, 13, 10, 26, 10]); return b; };
  const good = { v: 1, tattooId: 't1', img: 'k1', name: 'Rose', sourceHash: 'a', openHash: 'b', full: png(), baseline: png(), fw: 100, fh: 80, rect: { x: 10, y: 10, w: 50, h: 40 }, ref: { x: 0, y: 0, w: 100, h: 80 }, opened: { ref: { x: 0, y: 0, w: 100, h: 80 }, fw: 100, fh: 80 }, hadSession: false, tool: 'erase', steps: 3, at: Date.now() };
  const c = cleanDraft(good); assert(c && c.tattooId === 't1' && c.steps === 3 && c.rect.w === 50);
  assert.equal(cleanDraft({ ...good, v: 2 }), null);
  assert.equal(cleanDraft({ ...good, full: new ArrayBuffer(64) }), null, 'not a PNG');
  assert.equal(cleanDraft({ ...good, rect: { x: 60, y: 10, w: 50, h: 40 } }), null, 'the work box runs off the picture');
  assert.equal(cleanDraft({ ...good, tattooId: 5 }), null);
  assert.equal(cleanDraft(null), null);
  const t = { id: 't1', img: 'k1' };
  assert(draftFits(c, t)); assert(!draftFits(c, { id: 't1', img: 'k2' }), 'the picture changed since');
  assert(!draftFits(c, { id: 't2', img: 'k1' })); assert(!draftFits(c, t, c.at + DRAFT_MAX_AGE + 1), 'too old');
}
console.log('PASS cleanup memory: shared pictures counted once, budget kept with the newest step, unchanged canvases reused; drafts checked before use');
