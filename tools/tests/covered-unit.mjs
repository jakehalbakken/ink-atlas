// How covered each area is: the maths. Pain-map place names fold into areas with left and right
// from x (the body's own left is +x), ink is shared among the areas its points land in, and the
// line reads plainly.
import assert from 'node:assert/strict';
import { coveredArea, coveredByArea, coveredText } from '../../src/room.js';

assert.equal(coveredArea('Forearm (outer)', 0.2), 'left arm');
assert.equal(coveredArea('Upper arm (inner)', -0.2), 'right arm');
assert.equal(coveredArea('Inner elbow', 0.3), 'left arm');
assert.equal(coveredArea('Calf', -0.1), 'right leg');
assert.equal(coveredArea('Back of knee', 0.1), 'left leg');
assert.equal(coveredArea('Sternum', 0), 'chest');
assert.equal(coveredArea('Collarbone', 0.1), 'chest');
assert.equal(coveredArea('Ribs', -0.1), 'ribs');
assert.equal(coveredArea('Stomach', 0), 'stomach');
assert.equal(coveredArea('Spine', 0), 'back');
assert.equal(coveredArea('Lower back', 0), 'back');
assert.equal(coveredArea('Side of neck', 0.05), 'neck');
assert.equal(coveredArea('Throat', 0), 'neck');
assert.equal(coveredArea('Hand', 0.4), null, 'hands are not counted');
assert.equal(coveredArea('Face', 0), null);

// two strips of four vertices: a "left arm" at x = 1 and a "chest" at x = 0, each vertex 1 unit of skin
const pos = new Float32Array([1, 0, 0, 1, 0.1, 0, 1, 0.2, 0, 1, 0.3, 0, 0, 0, 0, 0, 0.1, 0, 0, 0.2, 0, 0, 0.3, 0]);
const areaOf = (v) => (v < 4 ? 'left arm' : 'chest'), skin = new Float32Array(8).fill(1);
// already on: 1 unit of ink, all on the arm; planned: 2 units, half on the arm and half on the chest
const r = coveredByArea(pos, 8, areaOf, skin, [
  { pts: [1, 0.05, 0, 1, 0.15, 0], inkArea: 1, planned: false },
  { pts: [1, 0.25, 0, 0, 0.25, 0], inkArea: 2, planned: true },
  { pts: null, inkArea: 3, planned: true },
], 0.2);
assert.equal(r.length, 2);
assert.equal(r[0].area, 'left arm'); assert.ok(Math.abs(r[0].ink - 0.25) < 1e-9 && Math.abs(r[0].plan - 0.25) < 1e-9, JSON.stringify(r));
assert.equal(r[1].area, 'chest'); assert.equal(r[1].ink, 0); assert.ok(Math.abs(r[1].plan - 0.25) < 1e-9);
// a point far from any counted skin is dropped, never put on the wrong area
const far = coveredByArea(pos, 8, areaOf, skin, [{ pts: [5, 5, 5, 1, 0, 0], inkArea: 2, planned: false }], 0.2);
assert.equal(far.length, 1); assert.ok(Math.abs(far[0].ink - 0.25) < 1e-9, 'half the points land, half the ink counts');

assert.equal(coveredText(r), 'Covered so far: left arm about 25% (50% with your plans), chest 25% planned.');
assert.equal(coveredText([{ area: 'back', ink: 0.004, plan: 0.002 }]), 'Covered so far: back under 1%.');
assert.equal(coveredText([{ area: 'back', ink: 0.001, plan: 0.001 }]), '', 'too little to say');
assert.equal(coveredText([]), '');
assert.equal(coveredText([{ area: 'left arm', ink: 0.9, plan: 0.5 }]), 'Covered so far: left arm about 90% (100% with your plans).', 'capped at all of it');
const many = ['left arm', 'right arm', 'chest', 'back'].map((area, i) => ({ area, ink: 0.4 - i * 0.1, plan: 0 }));
assert.equal(coveredText(many), 'Covered so far: left arm about 40%, right arm 30%, chest 20%.', 'three at most');
console.log('PASS covered-unit: areas, left and right, shares, line; ' + coveredText(r));
