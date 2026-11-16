// Measured regions: Jake's starting ankle is 9 in and 12.5 in round, 4 in apart along the skin
// (not yet confirmed); a damaged region keeps what checks out; pictures are found for saving;
// inch and millimetre typing; the project keeps regions through cleanState and imageKeysFor.
import assert from 'node:assert/strict';
import { startingRegion, cleanRegion, cleanRegions, regionImageKeys, templateOf, measureKey, fmtLen, parseLen, cleanSession } from '../../src/measured-region.js';
import { cleanState, imageKeysFor } from '../../src/project.js';
import { summary } from '../../src/wrap-geometry.js';

const near = (a, b, t, w) => assert.ok(Math.abs(a - b) <= t, `${w}: ${a} vs ${b}`);
const r0 = startingRegion();
assert.equal(r0.method, 'skin'); assert.equal(r0.methodConfirmed, false);
near(r0.levels[0].circ, 228.6, 1e-9, 'bottom'); near(r0.levels[1].circ, 317.5, 1e-9, 'top'); near(r0.levels[1].gap, 101.6, 1e-9, 'gap');
const c = cleanRegion(r0); assert.deepEqual(c.levels.map((l) => l.circ), [228.6, 317.5]);
const s = summary(templateOf(c)); near(s.w, 307.47, 0.01, 'box w'); near(s.h, 126.21, 0.01, 'box h');
// damaged parts dropped, the rest kept
const bad = { ...r0, method: 'weird', seam: 450, levels: [{ circ: 228.6 }, { circ: 'x', gap: 3 }, { circ: 317.5, gap: 101.6, pin: { tri: 5, w: [0.2, 0.3, 0.5] } }], existing: { photos: [{ img: 'missing' }], landmarks: [{ name: 'Topmost flower', at: [1, 2] }, { name: '' }] } };
const cb = cleanRegion(bad, (k) => k !== 'missing');
assert.equal(cb.method, 'skin'); assert.equal(cb.seam, 90); assert.equal(cb.levels.length, 2); assert.ok(cb.levels[1].pin);
assert.equal(cb.existing.photos, undefined); assert.equal(cb.existing.landmarks.length, 1);
assert.equal(cleanRegion({ levels: [{ circ: 100 }, { circ: 400, gap: 20 }] }), null, 'impossible cone dropped');
assert.equal(cleanRegion({ levels: [{ circ: 200 }] }), null, 'one ring is not a wrap');
assert.equal(cleanRegions([r0, r0]).length, 2); assert.notEqual(cleanRegions([r0, r0])[1].id, r0.id, 'duplicate ids renamed');
// pictures
const withPics = { ...r0, existing: { photos: [{ id: 'p1', img: 'a', pw: 10, ph: 10 }], ink: 'b', gap: 'c', maskPpmm: 2, maskO: [0, 0] }, art: { pieces: [{ img: 'f', x: 0, y: 0, w: 20, aspect: 1 }], saved: [{ name: 'one', pieces: [{ img: 'd', x: 0, y: 0, w: 20, aspect: 1 }, { img: 'e', x: 0, y: 0, w: 20, aspect: 1 }] }] } };
assert.deepEqual(regionImageKeys(cleanRegion(withPics)).sort(), ['a', 'b', 'c', 'd', 'e', 'f']);
// calibration key moves with measurements only
const k1 = measureKey(c); assert.equal(measureKey({ ...c, seam: 90 }), k1); assert.notEqual(measureKey({ ...c, method: 'axial' }), k1);
// units
assert.equal(fmtLen(228.6, 'in'), '9.00 in'); assert.equal(fmtLen(228.6, 'mm'), '228.6 mm');
near(parseLen('9', 'in'), 228.6, 1e-9, 'in'); near(parseLen('12.5"', 'mm'), 317.5, 1e-9, '"'); near(parseLen('101.6', 'mm'), 101.6, 1e-9, 'mm'); near(parseLen('10 cm', 'in'), 100, 1e-9, 'cm'); near(parseLen('4,5 in'), 114.3, 1e-9, 'comma');
assert.ok(Number.isNaN(parseLen('abc')));
// sessions
assert.equal(cleanSession({ id: 'x' }), null);
assert.ok(cleanSession({ id: 's', w: 100, h: 50, ppi: 300, calib: 1, wMm: 8.4, hMm: 4.2, originMm: [1, 2] }));
// the project keeps them, and older saves without them are untouched
const proj = { v: 2, tattoos: [], regions: [withPics] };
const out = cleanState(proj, () => true).state;
assert.equal(out.regions.length, 1); assert.ok(imageKeysFor(out).includes('f'));
assert.equal(cleanState({ v: 2, tattoos: [] }, () => true).state.regions, undefined);
console.log('measured-region-unit PASS');
