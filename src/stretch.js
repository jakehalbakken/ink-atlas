// How much the skin under a tattoo stretches and squeezes as you move: each body triangle under it
// is compared between the standing body and a pose. The change of a triangle is a 2D stretch; its
// two principal values (the singular values) say how much it got longer one way and shorter the
// other. Pure maths, no three.js, so it can be checked on its own.

// A: standing positions, B: posed positions (xyz per vertex), I: triangle index, tri: which one.
// Returns [most stretch (1 = none), least (1 = none), standing area].
export function triangleStretch(A, B, I, tri) {
  const a = I[tri * 3] * 3, b = I[tri * 3 + 1] * 3, c = I[tri * 3 + 2] * 3;
  // each triangle in its own plane: edge one along x, the third corner above it
  const flat = (P) => {
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const lu = Math.hypot(ux, uy, uz) || 1e-12, x2 = (vx * ux + vy * uy + vz * uz) / lu;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, y2 = Math.hypot(nx, ny, nz) / lu;
    return [lu, x2, y2];
  };
  const [p1, p2, p3] = flat(A), [q1, q2, q3] = flat(B);
  const area = p1 * p3 / 2;
  if (p1 < 1e-9 || p3 < 1e-9) return [1, 1, 0];
  // F = Q * P^-1 with P = [[p1, p2], [0, p3]] and Q = [[q1, q2], [0, q3]]
  const f11 = q1 / p1, f12 = (q2 - f11 * p2) / p3, f22 = q3 / p3;
  // singular values of [[f11, f12], [0, f22]]
  const s = f11 * f11 + f12 * f12 + f22 * f22, d = Math.abs(f11 * f22);
  const r = Math.sqrt(Math.max(0, s * s / 4 - d * d));
  return [Math.sqrt(s / 2 + r), Math.sqrt(Math.max(0, s / 2 - r)), area];
}

// The stretch and squeeze under a tattoo: over the body triangles `tris`, the amount that 90% of the
// skin (by area) stays within, so one thin sliver at a joint doesn't speak for the whole piece.
// Returns { stretch, squeeze } as shares (0.12 = 12%).
export function stretchUnder(A, B, I, tris, share = 0.9) {
  const st = [], sq = []; let total = 0;
  for (const tri of tris) {
    const [hi, lo, area] = triangleStretch(A, B, I, tri); if (!(area > 0)) continue;
    st.push([hi - 1, area]); sq.push([1 - lo, area]); total += area;
  }
  if (!total) return { stretch: 0, squeeze: 0 };
  const at = (list) => { list.sort((x, y) => x[0] - y[0]); let acc = 0; for (const [v, w] of list) { acc += w; if (acc >= total * share) return Math.max(0, v); } return Math.max(0, list[list.length - 1][0]); };
  return { stretch: at(st), squeeze: at(sq) };
}

// One plain line from the results of a few poses: [{ key, label, stretch, squeeze }]. Returns
// { text, key } with the pose that moves the skin most, or null with nothing to say.
export function stretchText(results) {
  const list = (results || []).filter((r) => r && Number.isFinite(r.stretch) && Number.isFinite(r.squeeze));
  if (!list.length) return null;
  const pct = (v) => Math.round(v * 100);
  const most = (k) => list.reduce((m, r) => (r[k] > m[k] ? r : m), list[0]);
  const s = most('stretch'), q = most('squeeze'), worst = s.stretch >= q.squeeze ? s : q, top = Math.max(s.stretch, q.squeeze);
  if (top < 0.06) return { text: 'The skin here hardly moves: under 6% stretch in the poses that move it most.', key: worst.key, top };
  const parts = [], both = pct(s.stretch) >= 3 && pct(q.squeeze) >= 3, same = both && s.key === q.key;
  if (pct(s.stretch) >= 3) parts.push(`stretches up to ${pct(s.stretch)}%` + (same ? '' : ` (${s.label})`));
  if (pct(q.squeeze) >= 3) parts.push(`squeezes up to ${pct(q.squeeze)}% (${q.label})`);
  let text = `As you move, the skin under it ${parts.join(' and ')}.`;
  if (top >= 0.25) text += ' Fine detail here can look warped in those moments; bold lines and open space hold up better.';
  else if (top >= 0.12) text += ' A little warping shows in those moments, which is normal here.';
  return { text, key: worst.key, top };
}
