// Ink check maths: a hairline is marked fine and a bold line is not; two lines almost touching
// mark the gap and two far apart do not; a pale yellow barely shows on light skin while black
// shows on every tone; colour names; the size at which the lines are wide enough.
import assert from 'node:assert/strict';
import { inkCheck, inkCheckPixels, deltaE, contrast, onSkin, colourName, widthForLines } from '../../src/ink-check.js';

const W = 300, H = 200, pxMm = 0.1; // 30 x 20 mm
const art = () => { const a = new Uint8ClampedArray(W * H * 4); for (let p = 0; p < W * H; p++) a.set([255, 255, 255, 255], p * 4); return a; };
const rect = (a, x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a.set(c, (y * W + x) * 4); };
const at = (m, x, y) => m[y * W + x];
const light = [232, 196, 170], deep = [92, 58, 40];

// fine and bold lines: 0.3 mm (3 px) and 1.2 mm (12 px)
let a = art();
rect(a, 20, 20, 23, 180, [0, 0, 0, 255]);
rect(a, 60, 20, 72, 180, [0, 0, 0, 255]);
let r = inkCheck(a, W, H, { pxMm, skin: light });
assert.equal(at(r.thin, 21, 100), 1, 'a 0.3 mm line is too fine');
assert.equal(at(r.thin, 66, 100), 0, 'a 1.2 mm line is fine'); assert.equal(at(r.thin, 60, 100), 0, 'and so is its edge');
assert.ok(r.thinShare > 0.1 && r.thinShare < 0.35, 'share of fine ink ' + r.thinShare);
assert.ok(Math.abs(r.lineP10Mm - 0.3) < 0.11, 'thinnest lines about 0.3 mm: ' + r.lineP10Mm);
assert.equal(at(r.tight, 40, 100), 0, 'a 3.7 mm gap is open');
// the size at which the lines are wide enough
assert.ok(Math.abs(widthForLines(3, 0.3) - 5) < 1e-9); assert.equal(widthForLines(3, 0.6), null); assert.equal(widthForLines(3, null), null);

// two bold lines 0.4 mm apart: the gap is marked, a wide gap is not
a = art();
rect(a, 20, 20, 40, 180, [0, 0, 0, 255]); rect(a, 44, 20, 64, 180, [0, 0, 0, 255]); rect(a, 120, 20, 140, 180, [0, 0, 0, 255]);
r = inkCheck(a, W, H, { pxMm, skin: light });
assert.equal(at(r.tight, 42, 100), 1, 'a 0.4 mm gap fills in');
assert.equal(at(r.tight, 90, 100), 0, 'a 5.6 mm gap stays open');
assert.equal(at(r.tight, 5, 100), 0, 'paper round the outside is open');
assert.ok(r.tightMm2 > 4 && r.tightMm2 < 12, 'tight area ' + r.tightMm2);
assert.equal(at(r.thin, 30, 100), 0, '2 mm lines are not fine');

// colours: pale yellow on light skin barely shows; black always shows; yellow shows on paper-white? not skin
a = art();
rect(a, 20, 20, 120, 180, [250, 235, 120, 255]);
rect(a, 160, 20, 260, 180, [10, 10, 10, 255]);
r = inkCheck(a, W, H, { pxMm, skin: light });
const yel = r.colours.find((c) => /yellow/.test(c.name)), blk = r.colours.find((c) => c.name === 'black');
assert.ok(yel && blk, 'two colours found: ' + JSON.stringify(r.colours.map((c) => c.name)));
assert.notEqual(yel.level, 'ok', 'pale yellow is faint on light skin: ' + yel.dE.toFixed(1));
assert.equal(blk.level, 'ok', 'black shows');
assert.equal(at(r.faint, 70, 100), 1, 'the yellow is marked'); assert.equal(at(r.faint, 200, 100), 0, 'the black is not');
assert.ok(Math.abs(yel.share - 0.5) < 0.1 && Math.abs(blk.share - 0.5) < 0.1, 'shares');
const deepR = inkCheck(a, W, H, { pxMm, skin: deep });
assert.equal(deepR.colours.find((c) => c.name === 'black').level, 'ok', 'black shows on deep skin too');
// a mid red on light skin shows
a = art(); rect(a, 20, 20, 120, 180, [200, 30, 40, 255]);
assert.equal(inkCheck(a, W, H, { pxMm, skin: light }).colours[0].level, 'ok', 'red shows');
// white ink on light skin barely shows
a = art(); rect(a, 20, 20, 120, 180, [235, 235, 235, 255]);
r = inkCheck(a, W, H, { pxMm, skin: light });
assert.ok(r.inkPixels === 0 || r.colours.every((c) => c.level !== 'ok'), 'near-white never counts as showing');

// empty art
r = inkCheck(art(), W, H, { pxMm, skin: light }); assert.equal(r.inkPixels, 0); assert.equal(r.colours.length, 0);

// maths
assert.ok(contrast(light, onSkin([0, 0, 0], light)) > 50 && contrast(light, onSkin([250, 235, 120], light)) < 16, 'tint counts less than light and dark');
assert.ok(deltaE([0, 0, 0], [255, 255, 255]) > 99); assert.equal(deltaE([10, 20, 30], [10, 20, 30]), 0);
assert.deepEqual(onSkin([255, 255, 255], light), light, 'white ink leaves skin as it is');
assert.ok(onSkin([0, 0, 0], light, 0.92)[0] < 20, 'black darkens it');
for (const [c, n] of [[[0, 0, 0], 'black'], [[255, 255, 255], 'white'], [[210, 30, 40], 'red'], [[30, 60, 200], 'blue'], [[40, 160, 60], 'green'], [[250, 230, 90], 'yellow'], [[130, 70, 30], 'brown'], [[128, 128, 128], 'grey']]) assert.match(colourName(c), new RegExp(n), JSON.stringify(c) + ' is ' + colourName(c));
// the marked picture: skin where there is no ink, orange on fine lines
a = art(); rect(a, 20, 20, 23, 180, [0, 0, 0, 255]);
r = inkCheck(a, W, H, { pxMm, skin: light });
const px = inkCheckPixels(a, W, H, r, light);
assert.deepEqual([...px.slice((100 * W + 150) * 4, (100 * W + 150) * 4 + 3)], light.map(Math.round), 'skin round the ink');
assert.deepEqual([...px.slice((100 * W + 21) * 4, (100 * W + 21) * 4 + 3)], [255, 106, 0], 'fine line marked');
console.log('PASS ink-check-unit: fine lines, tight gaps, faint colours on each skin, names, the size that fixes the lines');
