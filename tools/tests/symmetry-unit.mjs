// Even placement maths (src/symmetry.js): centre line distance near the middle, and how a twin
// from Copy to other side differs from its pair.
// Run: node tools/tests/symmetry-unit.mjs
import assert from 'node:assert/strict';
import { evenness, evennessText } from '../../src/symmetry.js';
const toCm = 100; // 1 unit = 1 m
const mid = { id: 'a', pos: [0.012, 1.3, 0.12], width: 0.08, rot: 0 };
let e = evenness(mid, [mid], toCm);
assert.equal(e.kind, 'centre'); assert.equal(e.side, 'left'); assert.equal(evennessText(e), '0.5 in left of the centre line.');
assert.equal(evennessText(evenness({ ...mid, pos: [-0.001, 1.3, 0.12] }, [], toCm)), 'On the centre line.');
assert.equal(evenness({ ...mid, pos: [0.15, 1.3, 0.12], width: 0.05 }, [], toCm), null, 'out on the side: nothing');
const L = { id: 'l', name: 'Rose (left)', artworkId: 'w', pos: [0.15, 1.3, 0.1], width: 0.06, rot: 0.2 };
const R = { id: 'r', name: 'Rose (right)', artworkId: 'w', pos: [-0.15, 1.3, 0.1], width: 0.06, rot: -0.2 };
e = evenness(L, [L, R], toCm); assert.equal(e.kind, 'twin'); assert.equal(e.even, true); assert.equal(evennessText(e), 'Matches Rose (right) on the other side.');
const L2 = { ...L, pos: [0.16, 1.32, 0.1], width: 0.065 };
assert.equal(evennessText(evenness(L2, [L2, R], toCm)), '0.8 in higher, 0.4 in further out and 0.2 in wider than Rose (right) on the other side.');
const L3 = { ...L, rot: -0.2 };
assert.match(evennessText(evenness(L3, [L3, R], toCm)), /^Turned 23° differently than Rose \(right\)/);
assert.equal(evenness({ ...L, artworkId: 'other' }, [L, R], toCm), null, 'different artwork: no twin');
assert.equal(evenness({ ...L, hidden: true }, [L, R], toCm), null);
console.log('symmetry-unit: ok');
import { limbLine, straighten, readsFor } from '../../src/symmetry.js';
{
  const bones = [['upperarm01.L', 0], ['lowerarm01.L', 1], ['wrist.L', 2], ['upperleg01.L', 3], ['lowerleg01.L', 4], ['foot.L', 5], ['upperleg01.R', 6], ['neck01', 7]].map(([name, head]) => ({ name, head }));
  const J = [0.2, 1.45, 0, 0.45, 1.45, 0, 0.7, 1.45, 0, 0.1, 0.9, 0, 0.1, 0.5, 0, 0.1, 0.1, 0, -0.1, 0.9, 0, 0, 1.5, 0].flat();
  const fore = limbLine([0.6, 1.47, 0.03], bones, J);
  assert.equal(fore.name, 'forearm'); assert.ok(fore.along[0] < 0, 'points towards the body'); assert.ok(Math.abs(Math.abs(fore.along[0]) - 1) < 1e-9, 'a T-pose forearm runs across');
  assert.equal(limbLine([0.11, 0.3, 0.05], bones, J).name, 'shin');
  const chest = limbLine([0.08, 1.3, 0.1], bones, J); assert.equal(chest.name, 'body'); assert.deepEqual(chest.along, [0, 1, 0]);
  let s = straighten(0.2, 0); assert.ok(Math.abs(s.rot) < 1e-9 && Math.abs(s.offDeg - 11.459) < 0.01);
  s = straighten(3.0, 0); assert.ok(Math.abs(Math.abs(s.rot) - Math.PI) < 1e-9, 'upside down stays upside down');
}
// who it reads for
{
  const arm = { name: 'forearm', along: [0.3, 0.95, 0] }, body = { name: 'body', along: [0, 1, 0] };
  let r = readsFor([0.3, 0.95, 0], [0, 0, 1], arm); assert.equal(r.who, 'others'); assert.match(r.text, /^Reads the right way up for others while your arm hangs\./); assert.equal(r.turn, 'Turn it to face me');
  r = readsFor([-0.3, -0.95, 0], [0, 0, 1], arm); assert.equal(r.who, 'you'); assert.equal(r.turn, 'Turn it to face others');
  r = readsFor([0.95, -0.3, 0], [0, 0, 1], arm); assert.equal(r.who, 'side'); assert.match(r.text, /across the arm/); assert.equal(r.turn, '');
  assert.match(readsFor([0, -1, 0], [0, 0, 1], { name: 'shin', along: [0, 1, 0] }).text, /while you stand/);
  assert.equal(readsFor([0, 1, 0], [0, 0, 1], body).who, 'others');
  r = readsFor([0, 1, 0], [0, 0, -1], body); assert.equal(r.who, 'back'); assert.equal(r.turn, '', 'upright on the back: nothing to turn');
  assert.equal(readsFor([0, -1, 0], [0, 0, -1], body).turn, 'Turn it upright');
  assert.equal(readsFor([0, 1, 0], [0, 0, 1], null), null);
}
console.log('symmetry-unit limb line: ok');
