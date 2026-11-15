// The maths behind body hair: forearms and lower legs carry the most, the chest middle and the line
// below the navel some, the back, hands, face and upper back stay bare; hair lies along the limb;
// a female body gets far less; every shape gets a field.
import assert from 'node:assert/strict';
import { bodyHairField } from '../../src/body-hair.js';
import { shapePositions, INDEX, COUNTS } from '../../src/mesh.js';
import { createRestRig, POSE_BONES } from '../../src/pose.js';
import { MARKS } from '../../src/body.js';

const n = COUNTS.body;
function fieldFor(shape) {
  const P = shapePositions(shape), I = INDEX, N = new Float32Array(n * 3);
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]]; if (a >= n || b >= n || c >= n) continue;
    const u = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]), v = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
    const m = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) N[i * 3 + k] += m[k];
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  const { joints } = createRestRig(shape);
  const at = (name, end) => { const b = POSE_BONES.find((x) => x.name === name); const i = b[end] * 3; return [joints[i], joints[i + 1], joints[i + 2]]; };
  const J = {};
  for (const s of ['L', 'R']) { J['shoulder' + s] = at('upperarm01.' + s, 'head'); J['elbow' + s] = at('lowerarm01.' + s, 'head'); J['wrist' + s] = at('wrist.' + s, 'head'); J['hip' + s] = at('upperleg01.' + s, 'head'); J['knee' + s] = at('lowerleg01.' + s, 'head'); J['ankle' + s] = at('foot.' + s, 'head'); }
  const m = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const F = bodyHairField({ pos: P, nor: N, count: n, joints: J, marks: { navel: m(MARKS.navel), nipL: m(MARKS.nipL), nipR: m(MARKS.nipR) }, figure: shape.figure });
  return { P, N, J, F, m };
}
// average density of the skin around a point, within r
function around({ P, F }, q, r = 0.03) { let s = 0, c = 0; for (let v = 0; v < n; v++) if ((P[v * 3] - q[0]) ** 2 + (P[v * 3 + 1] - q[1]) ** 2 + (P[v * 3 + 2] - q[2]) ** 2 < r * r) { s += F[v * 4 + 3]; c++; } return c ? s / c : NaN; }
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

for (const shape of [{ figure: 'male', muscle: 0.5, weight: 0.5, fit: {} }, { figure: 'male', muscle: 0.9, weight: 0.2, fit: { chest: 0.6 } }, { figure: 'neutral', muscle: 0.3, weight: 0.8, fit: {} }]) {
  const f = fieldFor(shape), { J, F, m } = f;
  assert.equal(F.length, n * 4);
  for (let i = 0; i < F.length; i++) assert.ok(Number.isFinite(F[i]), 'finite');
  const forearm = around(f, mix(J.elbowL, J.wristL, 0.55), 0.06), shin = around(f, mix(J.kneeR, J.ankleR, 0.5), 0.07);
  const hand = around(f, [J.wristL[0] + (J.wristL[0] - J.elbowL[0]) * 0.6, J.wristL[1] + (J.wristL[1] - J.elbowL[1]) * 0.6, J.wristL[2] + (J.wristL[2] - J.elbowL[2]) * 0.6], 0.03);
  const nip = m(MARKS.nipL), nav = m(MARKS.navel);
  const chest = around(f, [0, nip[1] - 0.02, nip[2]], 0.04), trail = around(f, [0, nav[1] - 0.06, nav[2]], 0.02);
  const back = around(f, [0, nip[1], -0.12], 0.08), face = around(f, [0, 1.6, 0.08], 0.06), shoulderTop = around(f, [J.shoulderL[0], J.shoulderL[1] + 0.05, J.shoulderL[2]], 0.04);
  const k = shape.figure === 'male' ? 1 : 0.55;
  const tag = JSON.stringify(shape);
  assert.ok(forearm > 0.45 * k, `forearm has hair ${forearm} ${tag}`);
  assert.ok(shin > 0.5 * k, `shin has hair ${shin} ${tag}`);
  assert.ok(chest > 0.2 * k, `chest middle has some ${chest} ${tag}`);
  assert.ok(trail > 0.15 * k, `line below the navel ${trail} ${tag}`);
  for (const [name, d] of [['back', back], ['face', face], ['hand', hand], ['top of the shoulder', shoulderTop]]) assert.ok(!(d > 0.05), `${name} stays bare: ${d} ${tag}`);
  // hair lies along the forearm and down the shin
  let fv = 0, best = Infinity; const fm = mix(J.elbowL, J.wristL, 0.5);
  for (let v = 0; v < n; v++) { const d = Math.hypot(...m(v).map((x, i) => x - fm[i])); if (d < best) { best = d; fv = v; } }
  const dir = [F[fv * 4], F[fv * 4 + 1], F[fv * 4 + 2]], limb = J.wristL.map((x, i) => x - J.elbowL[i]), ll = Math.hypot(...limb);
  assert.ok(Math.abs(dir[0] * limb[0] + dir[1] * limb[1] + dir[2] * limb[2]) / ll > 0.95, 'forearm hair lies along the arm');
}
// a female body: far less, but the same places
const male = fieldFor({ figure: 'male', muscle: 0.5, weight: 0.5, fit: {} }), fem = fieldFor({ figure: 'female', muscle: 0.5, weight: 0.5, fit: {} });
const sum = (F) => { let s = 0; for (let v = 0; v < n; v++) s += F[v * 4 + 3]; return s; };
assert.ok(sum(fem.F) < sum(male.F) * 0.2 && sum(fem.F) > 0, 'female: far less');
console.log('body-hair-unit ok');
