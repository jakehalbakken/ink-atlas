// Design versions (src/versions.js): an artwork change keeps the old one, names stay with their
// artwork, bringing one back swaps it with the current one, at most twelve are kept, and a
// damaged list in a save is cleaned. Run: node tools/tests/versions-unit.mjs
import assert from 'node:assert/strict';
import { keepVersion, useVersion, versionList, cleanVersions, currentName, MAX_VERSIONS } from '../../src/versions.js';
const t0 = { id: 'a', img: 'k1', aspect: 1, flip: true, imageTopDown: false };
assert.equal(currentName(t0), 'v1');
// an edit in Procreate: k1 becomes k2
let t = keepVersion(t0, { ...t0, img: 'k2', aspect: 2, flip: false, imageTopDown: true });
assert.deepEqual(t.versions, [{ img: 'k1', aspect: 1, flip: true, top: false, name: 'v1' }]);
assert.equal(t.vName, 'v2');
// same picture again: nothing new
assert.deepEqual(keepVersion(t, { ...t }), t);
// a cleanup: k2 becomes k3
t = keepVersion(t, { ...t, img: 'k3', aspect: 1.5 });
assert.deepEqual(versionList(t).map((v) => v.name + (v.now ? '*' : '')), ['v1', 'v2', 'v3*']);
// bring v1 back: names stay, v3 joins the list
assert.ok(useVersion(t, 0));
assert.equal(t.img, 'k1'); assert.equal(t.aspect, 1); assert.equal(t.flip, true); assert.equal(t.imageTopDown, false); assert.equal(t.vName, 'v1');
assert.deepEqual(versionList(t).map((v) => v.name + (v.now ? '*' : '')), ['v1*', 'v2', 'v3']);
// a new edit after going back is v4, and v3 is still there
t = keepVersion(t, { ...t, img: 'k4' });
assert.deepEqual(versionList(t).map((v) => v.name + (v.now ? '*' : '')), ['v1', 'v2', 'v3', 'v4*']);
assert.ok(!useVersion(t, 9), 'no such version');
// at most twelve kept, oldest go first
let u = { id: 'b', img: 'p0', aspect: 1 };
for (let i = 1; i <= 20; i++) u = keepVersion(u, { ...u, img: 'p' + i });
assert.equal(u.versions.length, MAX_VERSIONS); assert.equal(u.vName, 'v21'); assert.equal(u.versions[0].name, 'v9');
// a damaged save
const d = cleanVersions({ versions: [{ img: 'gone', aspect: 1, name: 'v1' }, { img: 'k2', aspect: 2, name: 'v2' }, { img: 'k3', aspect: 'x' }, { img: 'k5', aspect: 1, name: 'bad' }, 7], vName: 'v2' }, (k) => k !== 'gone');
assert.deepEqual(d.versions, [{ img: 'k2', aspect: 2, flip: false, top: false, name: 'v2' }, { img: 'k5', aspect: 1, flip: false, top: false, name: 'v1' }]);
assert.equal(d.vName, undefined, 'a current name that clashes with a version is dropped');
assert.equal(currentName(d), 'v3');
assert.deepEqual(cleanVersions({ versions: 'no' }, () => true), {});
console.log('versions-unit: ok');
