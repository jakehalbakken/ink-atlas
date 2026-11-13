// The maths behind Medium hair: strands grow only from inside the hairline, stay off the face and
// outside the head, are longer on top than at the sides, and follow the skull through a pose.
import assert from 'node:assert/strict';
import { buildStrands, skullMove, STRAND_STYLES } from '../../src/hair-strands.js';
import { hairField } from '../../src/hair.js';
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

for (const figure of ['male', 'female']) {
  const P = shapePositions({ figure, muscle: 0.5, weight: 0.5, fit: {} });
  const N = normals(P, INDEX), n = P.length / 3;
  const lm = landmarks3D(P, INDEX, FACE_MAP);
  const H = hairField(P, n, lm, COUNTS.body);
  const t0 = Date.now();
  const s = buildStrands(P, N, INDEX, H, COUNTS.body, 'medium');
  const ms = Date.now() - t0;
  assert.ok(s && s.strands === STRAND_STYLES.medium.count, figure + ': every strand made');
  const K = STRAND_STYLES.medium.segs, per = (K + 1) * 2;
  assert.equal(s.position.length, s.strands * per * 3);
  // no hair on the face: nothing in front of the forehead below the brows
  const brow = (lm[105][1] + lm[334][1]) / 2, foreheadZ = lm[10][2];
  let onFace = 0, inside = 0, topLen = [], sideLen = [];
  const c = s.centre, r = s.radii, ell = (x, y, z) => Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1], (z - c[2]) / r[2]);
  for (let k = 0; k < s.strands; k++) {
    const o = k * per * 3;
    const root = [(s.position[o] + s.position[o + 3]) / 2, (s.position[o + 1] + s.position[o + 4]) / 2, (s.position[o + 2] + s.position[o + 5]) / 2];
    const e0 = ell(...root);
    let len = 0, prev = root;
    for (let j = 1; j <= K; j++) {
      const q = o + j * 6, p = [(s.position[q] + s.position[q + 3]) / 2, (s.position[q + 1] + s.position[q + 4]) / 2, (s.position[q + 2] + s.position[q + 5]) / 2];
      if (p[1] < brow && p[2] > foreheadZ - 0.02 && Math.abs(p[0]) < 0.05) onFace++;
      if (ell(...p) < e0 * 0.995) inside++;
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]); prev = p;
    }
    const up = (root[1] - c[1]) / r[1];
    if (up > 0.85) topLen.push(len); else if (up < 0.3) sideLen.push(len);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.equal(onFace, 0, figure + ': no hair over the face');
  assert.ok(inside === 0, figure + ': strands stay outside the head (' + inside + ')');
  assert.ok(mean(topLen) > mean(sideLen) * 1.4, figure + ': longer on top than at the sides');
  assert.ok(mean(topLen) > 0.035 && mean(topLen) < 0.08, figure + ': top a few centimetres long ' + mean(topLen).toFixed(3));
  assert.ok(ms < 1500, figure + ': built quickly (' + ms + ' ms)');
  // through a pose: the skull turns and moves; the hair's matrix does exactly the same
  const ang = 0.6, cs = Math.cos(ang), sn = Math.sin(ang), T = [0.05, -0.1, 0.2];
  const move = (x, y, z) => [cs * x + sn * z + T[0], y + T[1], -sn * x + cs * z + T[2]];
  const now = new Float32Array(P.length); for (let i = 0; i < n; i++) now.set(move(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), i * 3);
  const M = skullMove(P, now, s.anchors);
  const x = s.position[0], y = s.position[1], z = s.position[2];
  const got = [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
  const want = move(x, y, z);
  assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]) < 1e-5, figure + ': hair follows the skull');
  console.log(figure, s.strands, 'strands in', ms, 'ms; top', mean(topLen).toFixed(3), 'sides', mean(sideLen).toFixed(3));
}
console.log('PASS hair-strands-unit: strands from inside the hairline, off the face, outside the head, longer on top, follow the skull');
