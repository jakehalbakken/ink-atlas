// Long hair in a still pose: each strand laid again from its root, keeping its length.
//
// The shader's plain blend moves a strand's top with the skull and its ends with the chest, and
// mixes the two in between. That is right while the head and chest keep their places, but when the
// head bows, tilts or turns against the chest the mix squashes the hair between the chin and the
// chest (a bunch under the chin) or stretches it thin down the back. Here the blended points are
// only where each segment would like to go: walking down from the root, every segment points that
// way but keeps its own length, so the hair hangs instead (follow the leader). The neck and jaw are
// kept clear as in the shader. Pure maths.

// hang: { per (vertices per strand, two per point), strands, rest (xyz), follow, collide: { nb,
// nt, c, rn, rh } }; m: the skull-to-chest move as a column-major 4x4; out: xyz for every vertex.
export function hangStrands(hang, m, out) {
  const { per, strands, rest: R, follow: F, collide: k } = hang, pts = per / 2;
  const mv = (x, y, z, o) => { o[0] = m[0] * x + m[4] * y + m[8] * z + m[12]; o[1] = m[1] * x + m[5] * y + m[9] * z + m[13]; o[2] = m[2] * x + m[6] * y + m[10] * z + m[14]; return o; };
  const nbMoved = mv(k.nb[0], k.nb[1], k.nb[2], [0, 0, 0]);
  // how far inside the neck or jaw a point is (positive inside), and which way is out
  const cap = (p, a, b, r, o) => {
    const ab0 = b[0] - a[0], ab1 = b[1] - a[1], ab2 = b[2] - a[2], ll = Math.max(ab0 * ab0 + ab1 * ab1 + ab2 * ab2, 1e-8);
    const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * ab0 + (p[1] - a[1]) * ab1 + (p[2] - a[2]) * ab2) / ll));
    const d0 = p[0] - a[0] - ab0 * t, d1 = p[1] - a[1] - ab1 * t, d2 = p[2] - a[2] - ab2 * t, l = Math.hypot(d0, d1, d2);
    if (l > 1e-6) { o[0] = d0 / l; o[1] = d1 / l; o[2] = d2 / l; } else { o[0] = 0; o[1] = 0; o[2] = 1; }
    return r - l;
  };
  const dn = [0, 0, 0], dj = [0, 0, 0];
  const inside = (p, nb, o) => { const n = cap(p, nb, k.nt, k.rn, dn), j = cap(p, k.nt, k.c, k.rh, dj); const d = n > j ? dn : dj; o[0] = d[0]; o[1] = d[1]; o[2] = d[2]; return Math.max(n, j); };
  const want = new Float32Array(pts * 3), mid = new Float32Array(pts * 3), len = new Float32Array(pts), q = [0, 0, 0], dir = [0, 0, 0], p0 = [0, 0, 0];
  // push a point (with its rest place) back out of the neck and jaw, by no more than it went in
  const clear = (x, rx, i) => {
    const was = Math.max(0, inside([R[rx], R[rx + 1], R[rx + 2]], k.nb, dir)), now = inside(x, nbMoved, dir), push = Math.max(0, now - was);
    if (push > 0) { x[0] += dir[0] * push; x[1] += dir[1] * push; x[2] += dir[2] * push; }
    return i;
  };
  for (let s = 0; s < strands; s++) {
    const base = s * per;
    // where the blend would put each point, and the strand's own segment lengths at rest
    for (let j = 0; j < pts; j++) {
      const a = (base + j * 2) * 3, b = a + 3, f = (F[base + j * 2] + F[base + j * 2 + 1]) / 2;
      const cx = (R[a] + R[b]) / 2, cy = (R[a + 1] + R[b + 1]) / 2, cz = (R[a + 2] + R[b + 2]) / 2;
      mv(cx, cy, cz, q);
      p0[0] = cx + (q[0] - cx) * f; p0[1] = cy + (q[1] - cy) * f; p0[2] = cz + (q[2] - cz) * f;
      if (f > 0) clear(p0, a, j);
      want[j * 3] = p0[0]; want[j * 3 + 1] = p0[1]; want[j * 3 + 2] = p0[2];
      if (j) len[j] = Math.hypot(cx - mid[j * 3 - 3], cy - mid[j * 3 - 2], cz - mid[j * 3 - 1]);
      mid[j * 3] = cx; mid[j * 3 + 1] = cy; mid[j * 3 + 2] = cz; // rest centres for now
    }
    // from the root down: each segment points where it wants to go, at its own length
    let px = want[0], py = want[1], pz = want[2];
    for (let j = 0; j < pts; j++) {
      if (j) {
        let dx = want[j * 3] - px, dy = want[j * 3 + 1] - py, dz = want[j * 3 + 2] - pz; let l = Math.hypot(dx, dy, dz) || 1;
        // slack (the root came nearer, as on the side the head tilts to): the spare length falls
        // down instead of carrying the strand on past where it wants to be and out sideways
        if (l < len[j]) { dy -= len[j] - l; l = Math.hypot(dx, dy, dz) || 1; }
        dx /= l; dy /= l; dz /= l;
        p0[0] = px + dx * len[j]; p0[1] = py + dy * len[j]; p0[2] = pz + dz * len[j];
        const a = (base + j * 2) * 3; if (F[base + j * 2] > 0) clear(p0, a, j);
        px = p0[0]; py = p0[1]; pz = p0[2];
      }
      // both edges of the ribbon keep their rest offset from the centre, carried by the blend
      const a = (base + j * 2) * 3, b = a + 3, f = (F[base + j * 2] + F[base + j * 2 + 1]) / 2;
      for (const v of [a, b]) {
        const ox = R[v] - mid[j * 3], oy = R[v + 1] - mid[j * 3 + 1], oz = R[v + 2] - mid[j * 3 + 2];
        // the offset turned with the blend (the move's 3x3, mixed by follow)
        const tx = m[0] * ox + m[4] * oy + m[8] * oz, ty = m[1] * ox + m[5] * oy + m[9] * oz, tz = m[2] * ox + m[6] * oy + m[10] * oz;
        out[v] = px + ox + (tx - ox) * f; out[v + 1] = py + oy + (ty - oy) * f; out[v + 2] = pz + oz + (tz - oz) * f;
      }
    }
  }
  return out;
}
