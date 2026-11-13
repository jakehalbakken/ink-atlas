// Poses picture: the poses chosen for a tattoo follow the part of the body it is on.
import assert from 'node:assert/strict';
import { posesFor } from '../../src/pose-pick.js';
import { POSE_CATALOG } from '../../src/pose-catalog.js';
const k = (b, f) => posesFor(b, f).keys;
assert.deepEqual(k([['lowerarm01.L', 0.7], ['upperarm02.L', 0.3]]), ['neutral', 'leftBiceps', 'overheadLeft', 'leftForward']);
assert.deepEqual(k([['upperarm01.R', 0.6], ['spine02', 0.4]]).slice(1), ['rightBiceps', 'overheadRight', 'rightForward']);
assert.equal(posesFor([['lowerleg01.R', 1]]).keys[1], 'kneeRight');
assert.equal(posesFor([['upperleg02.L', 0.8], ['pelvis.L', 0.2]]).region, 'leg');
assert.equal(posesFor([['spine03', 0.5], ['breast.L', 0.5]], true).keys[3], 'chestOpener');
assert.equal(posesFor([['spine03', 1]], false).keys[3], 'hinge');
assert.equal(posesFor([['neck02', 1]]).region, 'neck');
assert.equal(posesFor([['clavicle.L', 0.3], ['spine01', 0.7]]).region, 'torso');
for (const b of [[['wrist.L', 1]], [['foot.R', 1]], [['head', 1]], [['spine05', 1]]]) for (const key of posesFor(b).keys) assert.ok(POSE_CATALOG[key], key);
console.log('pose-pick ok');
