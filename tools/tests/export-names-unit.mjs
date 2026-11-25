// Saved files name themselves (src/export-names.js): "Ink Atlas - <project> - <what> <n>.<ext>",
// n counting up from the last export of that kind in that project, kept on the device only.
import assert from 'node:assert/strict';
import { kindOf, splitExt, projectLabel, nextExportName, bumpCount, makeNamer, readCounts } from '../../src/export-names.js';

assert.deepEqual(splitExt('ink-atlas-view.png'), ['ink-atlas-view', '.png']);
assert.deepEqual(splitExt('x.ink.json'), ['x', '.ink.json'], 'a v47 backup keeps its two-part ending');
assert.deepEqual(splitExt('no ending'), ['no ending', '']);
assert.equal(kindOf('ink-atlas-view.png'), 'View');
assert.equal(kindOf('ink-atlas-sizes-labelled.png'), 'Sizes labelled');
assert.equal(kindOf('ink-atlas-backup-2026-11-25.json'), 'Backup', 'the date goes, the number does its job');
assert.equal(kindOf('ink-atlas-set-aside-2026-11-20.json'), 'Set aside');
assert.equal(kindOf('Rose-stencil.pdf'), 'Rose stencil');
assert.equal(kindOf('Rose try-on.jpg'), 'Rose try on');
assert.equal(kindOf('Leg piece colours.swatches', 'Leg piece'), 'Colours', 'the project name is not said twice');
assert.equal(kindOf('Ink Atlas.png'), 'Export');
assert.equal(kindOf('a/b:c*?.pdf'), 'A b c', 'nothing a file system refuses');
assert.equal(projectLabel(''), 'My tattoos');
assert.equal(projectLabel('  Ink Atlas: Sleeve  '), 'Sleeve');
assert.equal(projectLabel('My "best" / plan'), 'My best plan');

// counting: from 1, per project, per kind, per file type
let c = {};
const step = (file, proj) => { const r = nextExportName(file, proj, c); c = bumpCount(c, r.key, r.n); return r.name; };
assert.equal(step('ink-atlas-view.png', 'Sleeve'), 'Ink Atlas - Sleeve - View 1.png');
assert.equal(step('ink-atlas-view.png', 'Sleeve'), 'Ink Atlas - Sleeve - View 2.png');
assert.equal(step('ink-atlas-sizes.png', 'Sleeve'), 'Ink Atlas - Sleeve - Sizes 1.png', 'each kind counts on its own');
assert.equal(step('Rose-stencil.pdf', 'Sleeve'), 'Ink Atlas - Sleeve - Rose stencil 1.pdf');
assert.equal(step('Rose-stencil.png', 'Sleeve'), 'Ink Atlas - Sleeve - Rose stencil 1.png', 'a PNG and a PDF count apart');
assert.equal(step('ink-atlas-view.png', 'Back piece'), 'Ink Atlas - Back piece - View 1.png', 'another project starts at 1');
assert.equal(step('ink-atlas-view.png', 'Sleeve'), 'Ink Atlas - Sleeve - View 3.png', 'and the first carries on');
assert.equal(step('ink-atlas-backup-2026-11-25.json', 'Sleeve'), 'Ink Atlas - Sleeve - Backup 1.json');
assert.equal(step('ink-atlas-backup-2026-11-26.json', 'Sleeve'), 'Ink Atlas - Sleeve - Backup 2.json', 'a backup on another day still counts on');
assert.equal(nextExportName('ink-atlas-view.png', 'sleeve', c).n, 4, 'the project name in another case is the same project');
// a damaged count never breaks a name
assert.equal(nextExportName('ink-atlas-view.png', 'Sleeve', { 'sleeve|view|.png': 'junk' }).n, 1);
assert.equal(nextExportName('ink-atlas-view.png', 'Sleeve', { 'sleeve|view|.png': -5 }).n, 1);
// the list of kinds stays small
let big = {}; for (let i = 0; i < 400; i++) big = bumpCount(big, 'k' + i, 1);
assert.equal(Object.keys(big).length, 300); assert.ok(big.k399 && !big.k0, 'the oldest kinds go first');
// a count never goes back
assert.equal(bumpCount({ a: 7 }, 'a', 3).a, 7);

// the namer: peeking uses no number; only a kept save moves the count, and the device remembers it
const mem = new Map(), storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
let proj = 'Sleeve';
const namer = makeNamer(() => proj, storage);
const a = namer('ink-atlas-view.png'), a2 = namer('ink-atlas-view.png');
assert.equal(a.name, 'Ink Atlas - Sleeve - View 1.png'); assert.equal(a2.name, a.name, 'a look ahead (or a cancelled share) uses no number');
a.commit();
assert.equal(namer('ink-atlas-view.png').name, 'Ink Atlas - Sleeve - View 2.png');
assert.equal(makeNamer(() => proj, storage)('ink-atlas-view.png').name, 'Ink Atlas - Sleeve - View 2.png', 'after a reload it carries on');
proj = 'Back piece'; assert.equal(namer('ink-atlas-view.png').name, 'Ink Atlas - Back piece - View 1.png', 'renaming the project counts for the new name');
assert.deepEqual(readCounts({ getItem: () => '[1,2]' }), {}); assert.deepEqual(readCounts({ getItem: () => '{oops' }), {});
// private mode: storage refuses, names still count up on this page
const broken = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
const pn = makeNamer(() => 'Sleeve', broken); const x = pn('ink-atlas-view.png'); x.commit();
assert.equal(pn('ink-atlas-view.png').name, 'Ink Atlas - Sleeve - View 2.png', 'counts up without storage');
// no em-dashes and nothing a file system refuses
for (const n of [a.name, step('x:y?.png', 'a*b')]) { assert.ok(!/[—\\/:*?"<>|]/.test(n), n); }
console.log('PASS export-names-unit: ' + [a.name, 'Ink Atlas - Sleeve - Backup 2.json', 'Ink Atlas - Sleeve - Rose stencil 1.pdf'].join(' | '));
