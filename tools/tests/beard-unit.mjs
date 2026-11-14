// The maths behind the beard: it covers the chin, the jaw, the moustache and under the chin, keeps
// the lips, the nose, the upper cheeks and the back of the neck bare, and follows every shape. A full
// beard's strands grow from inside it, stay off the skin and fall a few centimetres at most.
import assert from 'node:assert/strict';
import { beardField } from '../../src/beard.js';
import { buildBeard, skullMove } from '../../src/hair-strands.js';
import { landmarks3D } from '../../src/face-fit.js';
import { FACE_MAP } from '../../src/face-map.js';
import { shapePositions, INDEX, COUNTS } from '../../src/mesh.js';

function normals(P, I) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    const u = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]), v = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) N[i * 3 + k] += n[k];
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}
// the vertex nearest a point, and the field there
const nearest = (P, q) => { let best = 0, bd = Infinity; for (let v = 0; v < COUNTS.body; v++) { const d = (P[v * 3] - q[0]) ** 2 + (P[v * 3 + 1] - q[1]) ** 2 + (P[v * 3 + 2] - q[2]) ** 2; if (d < bd) { bd = d; best = v; } } return best; };
const near = (P, B, q) => B[nearest(P, q)];
// the most beard on the skin within a few millimetres of the nearest skin to a point
const around = (P, B, q, r = 0.005) => { const c = nearest(P, q), s = [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]]; let m = -1; for (let v = 0; v < COUNTS.body; v++) if ((P[v * 3] - s[0]) ** 2 + (P[v * 3 + 1] - s[1]) ** 2 + (P[v * 3 + 2] - s[2]) ** 2 < r * r) m = Math.max(m, B[v]); return m; };
const mid = (a, b, t = 0.5) => a.map((x, i) => x + (b[i] - x) * t);

const shapes = [
  { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} },
  { figure: 'female', muscle: 0.5, weight: 0.5, fit: {} },
  { figure: 'male', muscle: 0.9, weight: 0.9, fit: { neckSize: 0.8 } },
  { figure: 'neutral', muscle: 0.2, weight: 0.1, fit: { neckLen: 0.8 } },
];
for (const shape of shapes) {
  const name = shape.figure + ' ' + shape.muscle + '/' + shape.weight;
  const P = shapePositions(shape), n = P.length / 3, N = normals(P, INDEX);
  const lm = landmarks3D(P, INDEX, FACE_MAP);
  const B = beardField(P, n, lm, COUNTS.body);
  const h = lm[10][1] - lm[152][1];
  const yes = { chin: lm[152], 'below the lower lip': lm[199], jaw: lm[172], 'other jaw': lm[397], moustache: mid(lm[2], lm[0], 0.4), 'under the chin': [lm[152][0], lm[152][1] - 0.08 * h, lm[152][2] - 0.25 * h] };
  const no = { 'upper lip': lm[0], 'lower lip': lm[17], 'inside the lips': lm[13], nose: lm[1], 'nose wing': lm[98], 'upper cheek': lm[50], forehead: lm[10], 'back of the neck': [0, lm[152][1] - 0.2 * h, lm[234][2] - 0.6 * h], throat: [0, lm[152][1] - 0.5 * h, lm[152][2] - 0.3 * h] };
  for (const [k, q] of Object.entries(yes)) assert.ok(around(P, B, q) > 0, `${name}: beard on the ${k} (${around(P, B, q).toFixed(4)})`);
  for (const [k, q] of Object.entries(no)) assert.ok(near(P, B, q) <= 0, `${name}: no beard on the ${k} (${near(P, B, q).toFixed(4)})`);
  for (let v = COUNTS.body; v < n; v++) assert.ok(B[v] <= -0.02 + 1e-9, 'only the body proper');
  // left and right the same
  let lr = 0, cnt = 0;
  for (let v = 0; v < COUNTS.body; v += 7) if (B[v] > 0) { cnt++; if (near(P, B, [-P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]) <= 0) lr++; }
  assert.ok(lr / cnt < 0.03, `${name}: the same on both sides (${lr} of ${cnt})`);

  const t0 = Date.now(), S = buildBeard(P, N, INDEX, B, COUNTS.body), ms = Date.now() - t0;
  assert.ok(S && S.strands === 16000, name + ': full beard strands made');
  const K = S.segs, per = (K + 1) * 2;
  let longest = 0, under = 0, rootsOut = 0;
  for (let k = 0; k < S.strands; k += 5) {
    const o = k * per * 3, at = (j) => [0, 1, 2].map((a) => (S.position[o + j * 6 + a] + S.position[o + j * 6 + 3 + a]) / 2);
    const root = at(0); if (near(P, B, root) <= -0.003) rootsOut++;
    let len = 0, prev = root;
    for (let j = 1; j <= K; j++) {
      const q = at(j); len += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]); prev = q;
      // the nearest skin is never in front of the strand by more than a hair's width
      let best = 0, bd = Infinity;
      for (let v = 0; v < COUNTS.body; v += 1) { const y = P[v * 3 + 1]; if (Math.abs(y - q[1]) > 0.03) continue; const d = (P[v * 3] - q[0]) ** 2 + (y - q[1]) ** 2 + (P[v * 3 + 2] - q[2]) ** 2; if (d < bd) { bd = d; best = v; } }
      const depth = -((q[0] - P[best * 3]) * N[best * 3] + (q[1] - P[best * 3 + 1]) * N[best * 3 + 1] + (q[2] - P[best * 3 + 2]) * N[best * 3 + 2]);
      if (depth > 0.003) under++;
    }
    longest = Math.max(longest, len);
  }
  console.log(name, 'beard', B.filter((x) => x > 0).length, 'vertices;', S.strands, 'strands in', ms, 'ms; longest', longest.toFixed(3), 'into the skin', under, 'roots outside', rootsOut);
  assert.ok(rootsOut === 0, name + ': strands grow only from the beard');
  assert.ok(under < 30, name + ': strands stay on the skin, not in it (' + under + ')');
  assert.ok(longest < 0.045, name + ': a few centimetres at most (' + longest.toFixed(3) + ')');
  assert.ok(ms < 800, name + ': built quickly (' + ms + ' ms)');
  // through a pose: the skull turns and moves; the beard's matrix does exactly the same
  const ang = -0.5, cs = Math.cos(ang), sn = Math.sin(ang), T = [0.02, -0.05, 0.1];
  const move = (x, y, z) => [cs * x + sn * z + T[0], y + T[1], -sn * x + cs * z + T[2]];
  const now = new Float32Array(P.length); for (let i = 0; i < n; i++) now.set(move(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), i * 3);
  const M = skullMove(P, now, S.anchors);
  const [x, y, z] = [S.position[0], S.position[1], S.position[2]];
  const got = [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
  const want = move(x, y, z);
  assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]) < 1e-5, name + ': the beard follows the skull');
  for (const v of S.anchors) assert.ok(P[v * 3 + 1] > lm[234][1], name + ': carried by points high on the head');
}
console.log('PASS beard-unit: chin, jaw, moustache and under the chin covered; lips, nose, cheeks and neck bare; same both sides; full beard strands grow from it, stay on the skin, a few centimetres long, follow the skull');
