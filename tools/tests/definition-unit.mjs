// Muscle definition on the skin: more muscle shows more, more body fat hides it, the Abs and
// Back sliders add to it, a female body shows less on the chest, and it always stays in range.
import assert from 'node:assert/strict';
import { definition, limbJoints } from '../../src/skin.js';
const d = (s) => definition(s);
const avg = d({ figure: 'male', muscle: 0.5, weight: 0.5, fit: {} });
assert.ok(avg.front > 0.25 && avg.front < 0.6, `average man shows some abs ${avg.front}`);
assert.ok(d({ figure: 'male', muscle: 0.9, weight: 0.5 }).front > avg.front, 'more muscle shows more');
assert.ok(d({ figure: 'male', muscle: 0.5, weight: 0.9 }).front < avg.front * 0.5, 'body fat hides it');
assert.ok(d({ figure: 'male', muscle: 0.5, weight: 0.5, fit: { abs: 1 } }).front > avg.front * 1.5, 'Abs slider adds');
assert.ok(d({ figure: 'male', muscle: 0.5, weight: 0.5, fit: { back: 1 } }).back > avg.back * 1.5, 'Back slider adds');
const f = d({ figure: 'female', muscle: 0.5, weight: 0.5, fit: {} });
assert.ok(f.front < avg.front && f.chest < 0.3, 'female shows less, no pec lines');
for (const m of [0, 0.5, 1]) for (const w of [0, 0.5, 1]) for (const a of [-1, 0, 1]) {
  const r = d({ figure: 'male', muscle: m, weight: w, fit: { abs: a, back: a } });
  for (const v of [r.front, r.back, r.chest, r.limbs]) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1.3);
}
assert.deepEqual(d({}), d({ figure: 'male', muscle: 0.5, weight: 0.5, fit: {} }), 'missing values read as average');
assert.ok(Number.isFinite(d({ muscle: NaN, weight: 'x' }).front), 'bad values are ignored');
assert.ok(d({ figure: 'male', muscle: 0.9, weight: 0.4 }).limbs > avg.limbs, 'arms and legs show more with more muscle');
// the limb muscles hang off the body's own joints: shoulder above elbow, hip above knee above ankle, all on the left
for (const shape of [{}, { figure: 'female', muscle: 0.2, weight: 0.9 }, { figure: 'male', muscle: 1, weight: 0, fit: { shoulders: 1 } }]) {
  const [sh, el, hip, knee, ankle] = limbJoints(shape);
  assert.ok(sh[1] > el[1] && hip[1] > knee[1] && knee[1] > ankle[1] && ankle[1] > 0, 'joints run down the body');
  assert.ok([sh, el, hip, knee, ankle].every((v) => v[0] > 0.05), 'all on the left side');
  assert.ok(el[0] > sh[0], 'elbow outside the shoulder');
}
console.log('PASS definition-unit: muscle shows, fat hides, sliders add, always in range, limbs on the skeleton');
