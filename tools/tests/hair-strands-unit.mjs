// The maths behind Medium hair: strands grow only from inside the hairline, stay off the face and
// outside the head, are longer on top than at the sides, and follow the skull through a pose. Long
// hair keeps off the face, rests on the neck and shoulders without going into them, and ends just
// below the shoulders.
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

  // Long: to just below the shoulders, clear of the face, resting on the skin, not in it
  const t1 = Date.now(), L = buildStrands(P, N, INDEX, H, COUNTS.body, 'long'), lms = Date.now() - t1;
  assert.ok(L && L.strands > STRAND_STYLES.long.count * 0.98, figure + ': long strands made (' + (L && L.strands) + ')');
  const KL = L.segs, pl = (KL + 1) * 2;
  let top = -Infinity; for (let v = 0; v < COUNTS.body; v++) top = Math.max(top, P[v * 3 + 1]);
  const halfFace = Math.abs(lm[454][0] - lm[234][0]) / 2, chin = lm[152][1];
  const grid = new Map(), cell = 0.03, key = (x, y, z) => x + ',' + y + ',' + z;
  for (let v = 0; v < COUNTS.body; v++) { if (H[v] > 0.002) continue; const k = key(Math.floor(P[v * 3] / cell), Math.floor(P[v * 3 + 1] / cell), Math.floor(P[v * 3 + 2] / cell)); (grid.get(k) || grid.set(k, []).get(k)).push(v); }
  const depthIn = (q) => {
    let best = -1, bd = 0.02 * 0.02; const g = q.map((x) => Math.floor(x / cell));
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) for (const v of grid.get(key(g[0] + a, g[1] + b, g[2] + e)) || []) {
      const dd = (P[v * 3] - q[0]) ** 2 + (P[v * 3 + 1] - q[1]) ** 2 + (P[v * 3 + 2] - q[2]) ** 2; if (dd < bd) { bd = dd; best = v; }
    }
    return best < 0 ? 0 : -((q[0] - P[best * 3]) * N[best * 3] + (q[1] - P[best * 3 + 1]) * N[best * 3 + 1] + (q[2] - P[best * 3 + 2]) * N[best * 3 + 2]);
  };
  let face = 0, deep = 0, lowest = Infinity, highTip = -Infinity, insideL = 0;
  for (let k = 0; k < L.strands; k++) {
    const o = k * pl * 3, mid = (j) => [0, 1, 2].map((a) => (L.position[o + j * 6 + a] + L.position[o + j * 6 + 3 + a]) / 2);
    const e0 = ell(...mid(0));
    for (let j = 1; j <= KL; j++) {
      const q = mid(j);
      if (q[1] < brow && q[1] > chin && Math.abs(q[0]) < 0.6 * halfFace && q[2] > foreheadZ - 0.03) face++;
      if (q[1] > c[1] && ell(...q) < e0 * 0.99) insideL++;
      if (k % 10 === 0 && depthIn(q) > 0.004) { deep++; if (process.env.DBG && deep < 40) console.log('deep', q.map((x) => x.toFixed(3)).join(' '), (top - q[1]).toFixed(3), depthIn(q).toFixed(4)); }
    }
    const tip = mid(KL); lowest = Math.min(lowest, tip[1]); highTip = Math.max(highTip, tip[1]);
    assert.equal(L.follow[k * pl], 0, 'roots move with the head');
  }
  const tipsDown = Array.from({ length: L.strands }, (_, k) => L.position[(k * pl + pl - 1) * 3 + 1]).filter((y) => y < top - 0.25).length / L.strands;
  console.log(figure, 'long', L.strands, 'strands in', lms, 'ms; ends', (top - lowest).toFixed(3), 'below the top at most; past the shoulders', (tipsDown * 100).toFixed(0) + '%; over the face', face, 'in the head', insideL, 'into the skin', deep);
  assert.equal(face, 0, figure + ': long hair stays off the face');
  assert.equal(insideL, 0, figure + ': long hair stays outside the head');
  assert.ok(deep < 20, figure + ': long hair rests on the skin, not in it (' + deep + ')');
  assert.ok(top - lowest < 0.42, figure + ': ends just below the shoulders, not further');
  assert.ok(tipsDown > 0.7, figure + ': most ends fall past the shoulders');
  assert.ok(L.follow[pl - 1] >= 0 && L.follow.reduce((m, x) => Math.max(m, x), 0) === 1, 'the ends move with the chest');
  assert.ok(lms < 2500, figure + ': built in good time (' + lms + ' ms)');
}
console.log('PASS hair-strands-unit: medium strands from inside the hairline, off the face, outside the head, longer on top, follow the skull; long hair off the face, on the skin and to just below the shoulders');
