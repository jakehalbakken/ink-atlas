// Medium hair as strands: thousands of thin ribbons grown from the scalp, inside the hairline
// (the body's 'hair' field from hair.js), so they fit every head shape. Pure maths: positions in,
// arrays out, so it can be checked without a browser.
//
// The style is swept back: on top the hair runs back from the front hairline and stands up a
// little there; at the sides and back it falls down and back. Each strand keeps outside the head
// (an ellipsoid fitted to the scalp, scaled so its own root sits on it) and leans further out the
// further along it is, which gives the top its volume.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// A small seeded random, so the same head always grows the same hair.
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

export const STRAND_STYLES = {
  // lengths in body units (the body is 1.75 tall, so 0.01 is about a centimetre)
  medium: { count: 14000, segs: 7, top: 0.065, side: 0.03, back: 0.04, width: 0.0016, lift: 0.5 },
  // long: to just below the shoulders (cut is how far below the top of the head the ends fall)
  long: { count: 15000, segs: 14, cut: 0.34, width: 0.0019, long: true },
};

// R: rest positions; N: rest normals; index: triangle index; hair: the hairline field per vertex
// (positive under hair); bodyCount: vertices of the body proper. Returns { position, normal,
// shade, index, anchors, strands } where shade is a per-vertex brightness (root darker, tips
// lighter) and anchors are four skull vertices for following the head in a pose.
// The scalp and what the strands are measured against: an ellipsoid round the skull, four skull
// vertices that carry the hair through a pose, and the scalp triangles roots grow from.
function scalpFrame(R, index, hair, bodyCount) {
  const P = (v) => [R[v * 3], R[v * 3 + 1], R[v * 3 + 2]];
  const scalp = [];
  for (let v = 0; v < bodyCount; v++) if (hair[v] > 0.002) scalp.push(v);
  if (scalp.length < 20) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of scalp) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], R[v * 3 + a]); hi[a] = Math.max(hi[a], R[v * 3 + a]); }
  // an ellipsoid round the skull: centred between the sides, below the top by its height
  const c = [(lo[0] + hi[0]) / 2, hi[1] - (hi[0] - lo[0]) * 0.62, (lo[2] + hi[2]) / 2];
  const rad = [(hi[0] - lo[0]) / 2, hi[1] - c[1], (hi[2] - lo[2]) / 2];
  const rMean = (rad[0] + rad[1] + rad[2]) / 3;
  const ell = (q) => Math.hypot((q[0] - c[0]) / rad[0], (q[1] - c[1]) / rad[1], (q[2] - c[2]) / rad[2]);
  let top = scalp[0], left = scalp[0], right = scalp[0], back = scalp[0];
  for (const v of scalp) {
    if (R[v * 3 + 1] > R[top * 3 + 1]) top = v;
    if (R[v * 3] > R[left * 3]) left = v;
    if (R[v * 3] < R[right * 3]) right = v;
    if (R[v * 3 + 2] < R[back * 3 + 2]) back = v;
  }
  // root triangles: all three corners under hair, picked by area
  const I = index, tris = [], cum = [];
  let total = 0;
  for (let t = 0; t < I.length / 3; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], d = I[t * 3 + 2];
    if (a >= bodyCount || b >= bodyCount || d >= bodyCount) continue;
    if (!(hair[a] > 0 && hair[b] > 0 && hair[d] > 0)) continue;
    const A = P(a), B = P(b), D = P(d);
    const ar = Math.hypot(...cross([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [D[0] - A[0], D[1] - A[1], D[2] - A[2]])) / 2;
    total += ar; tris.push(t); cum.push(total);
  }
  if (!tris.length) return null;
  return { scalp, lo, hi, c, rad, rMean, ell, anchors: [top, left, right, back], tris, cum, total };
}

export function buildStrands(R, N, index, hair, bodyCount, style = 'medium', seed = 7) {
  const S = STRAND_STYLES[style] || STRAND_STYLES.medium;
  const F = scalpFrame(R, index, hair, bodyCount);
  if (!F) return null;
  if (S.long) return buildLong(R, N, index, hair, bodyCount, S, F, seed);
  const { c, rad, rMean, ell, tris, cum, total } = F, I = index;
  const [top, left, right, back] = F.anchors;
  const rand = rng(seed);
  const K = S.segs, per = (K + 1) * 2, count = S.count;
  const position = new Float32Array(count * per * 3), normal = new Float32Array(count * per * 3), shade = new Float32Array(count * per);
  const idx = new Uint32Array(count * K * 6);
  let vi = 0, ii = 0, made = 0;
  for (let s = 0; s < count; s++) {
    // a root: a random point on a random scalp triangle
    const pick = rand() * total; let lo2 = 0, hi2 = cum.length - 1;
    while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (cum[m] < pick) lo2 = m + 1; else hi2 = m; }
    const t = tris[lo2];
    let u = rand(), w = rand(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const ids = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], bw = [1 - u - w, u, w];
    const p = [0, 0, 0], n = [0, 0, 0]; let depth = 0;
    for (let k = 0; k < 3; k++) { for (let a = 0; a < 3; a++) { p[a] += R[ids[k] * 3 + a] * bw[k]; n[a] += N[ids[k] * 3 + a] * bw[k]; } depth += hair[ids[k]] * bw[k]; }
    const nn = norm(n), rel = norm([p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
    const onTop = smooth(0.25, 0.75, rel[1]), atBack = smooth(0.1, 0.7, -rel[2]) * (1 - onTop);
    // the way it lies: back over the top, down and back at the sides and back
    // over the forehead it is brushed up and back, never down onto the face
    const front = smooth(0.15, 0.55, rel[2]) * smooth(-0.3, 0.2, rel[1]) * (1 - smooth(0.25, 0.6, Math.abs(rel[0])));
    const lie = norm([0, -1 + onTop * 1.15, -0.45 - onTop * 0.75]);
    const flowWorld = norm([lie[0] * (1 - front), lie[1] * (1 - front) + 0.3 * front, lie[2] * (1 - front) - front]);
    const along = (v) => norm([v[0] - nn[0] * dot(v, nn), v[1] - nn[1] * dot(v, nn), v[2] - nn[2] * dot(v, nn)]);
    // near the hairline it lies flat and short, so the edge thins out instead of spiking
    const edge = smooth(0.0, 0.016, depth), rise = (0.15 + 0.45 * front * smooth(0, 0.008, depth)) * edge;
    let d = norm([...along(flowWorld).map((x, a) => x + nn[a] * rise)]);
    const len = (S.top * onTop + S.side * (1 - onTop) * (1 - atBack) + S.back * atBack) * (0.75 + 0.5 * rand()) * (0.35 + 0.65 * edge) + 0.003;
    const step = len / K, layer = rand();
    const scale = ell(p); // the root sits on this ellipsoid
    const pts = [p.slice()], dirs = [d];
    let q = p.slice();
    for (let k = 1; k <= K; k++) {
      const f = k / K;
      // turns toward the way it lies, then falls a little under its own weight
      const r2 = norm([q[0] - c[0], q[1] - c[1], q[2] - c[2]]);
      const flow = norm([flowWorld[0] - r2[0] * dot(flowWorld, r2), flowWorld[1] - r2[1] * dot(flowWorld, r2), flowWorld[2] - r2[2] * dot(flowWorld, r2)]);
      d = norm([d[0] + flow[0] * 0.55, d[1] + flow[1] * 0.55 - (0.18 + 0.2 * onTop) * f * (1 - front), d[2] + flow[2] * 0.55]);
      q = [q[0] + d[0] * step, q[1] + d[1] * step, q[2] + d[2] * step];
      // stays outside the head, further out along the strand and for the outer layers
      // in body units over the scalp: a few millimetres, up to a couple of centimetres on top
      // the volume is mostly at the front, where it is brushed up
      const lift = 0.003 + (0.004 + 0.04 * S.lift * (front + 0.35 * onTop * (1 - front))) * layer * smooth(0, 0.5, f) * edge;
      const want = scale * (1 + lift / rMean), cap = scale * (1 + (lift + 0.003 + 0.006 * front) / rMean);
      const e = ell(q);
      // inside the head: out to the surface; standing off it: laid back down
      if (e < want || e > cap) { const g = (e < want ? want : cap) / Math.max(e, 1e-6); q = [c[0] + (q[0] - c[0]) * g, c[1] + (q[1] - c[1]) * g, c[2] + (q[2] - c[2]) * g]; }
      d = norm([q[0] - pts[k - 1][0], q[1] - pts[k - 1][1], q[2] - pts[k - 1][2]]);
      pts.push(q.slice()); dirs.push(d);
    }
    // a flat ribbon lying on the head
    const tone = 0.85 + 0.3 * rand();
    for (let k = 0; k <= K; k++) {
      const f = k / K, q2 = pts[k], out = norm([q2[0] - c[0], q2[1] - c[1], q2[2] - c[2]]);
      const across = norm(cross(dirs[k], out)), hw = S.width * (1 - 0.75 * f) / 2;
      const ribbon = norm(cross(across, dirs[k]));
      const nrm = norm([ribbon[0] * 0.5 + out[0] * 0.5, ribbon[1] * 0.5 + out[1] * 0.5, ribbon[2] * 0.5 + out[2] * 0.5]);
      for (const sgn of [-1, 1]) {
        for (let a = 0; a < 3; a++) { position[vi * 3 + a] = q2[a] + across[a] * hw * sgn; normal[vi * 3 + a] = nrm[a]; }
        shade[vi] = tone * (0.55 + 0.45 * smooth(0, 0.35, f) + 0.15 * f); vi++;
      }
    }
    const base = made * per;
    for (let k = 0; k < K; k++) {
      const a = base + k * 2;
      idx[ii++] = a; idx[ii++] = a + 1; idx[ii++] = a + 2; idx[ii++] = a + 1; idx[ii++] = a + 3; idx[ii++] = a + 2;
    }
    made++;
  }
  return { position, normal, shade, index: idx, anchors: [top, left, right, back], strands: made, centre: c, radii: rad };
}

// Long hair: parted in the middle, over the ears and round the face, to a soft line a little
// below the shoulders, longer at the back. Grown in small steps that keep outside the head, out of
// the face and off the neck and shoulders (it slides over them, in front or behind), then
// resampled to even segments. Also returns follow per vertex (0 down to the jaw, rising to 1 at the
// shoulders) and four upper-chest vertices, so in a pose the top moves with the skull and the
// ends with the chest.
function buildLong(R, N, index, hair, bodyCount, S, F, seed) {
  const { c, rad, rMean, ell, tris, cum, total, hi } = F, I = index, top = hi[1];
  // the front hairline: the lowest scalp point at the front middle
  let frontZ = -Infinity, frontY = top;
  for (const v of F.scalp) if (Math.abs(R[v * 3] - c[0]) < 0.25 * rad[0]) frontZ = Math.max(frontZ, R[v * 3 + 2]);
  for (const v of F.scalp) if (Math.abs(R[v * 3] - c[0]) < 0.25 * rad[0] && R[v * 3 + 2] > frontZ - 0.02) frontY = Math.min(frontY, R[v * 3 + 1]);
  const cutY = top - S.cut, browY = frontY - 0.035, faceZ = c[2] + 0.2 * rad[2], faceW = 0.74 * rad[0];
  const jawY = c[1] - 0.8 * rad[1];
  // the skin round the head, neck and shoulders, for the hair to rest on: vertices in a grid
  const cell = 0.04, grid = new Map(), key = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  for (let v = 0; v < bodyCount; v++) {
    const y = R[v * 3 + 1];
    if (y < cutY - 0.06 || y > top + 0.01 || hair[v] > 0.002) continue; // the scalp is the ellipsoid's
    const k = key(Math.floor(R[v * 3] / cell), Math.floor(y / cell), Math.floor(R[v * 3 + 2] / cell));
    let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(v);
  }
  // the nearest skin vertex within half a cell: only the eight cells round the nearest corner
  const nearest = (q) => {
    const fx = q[0] / cell, fy = q[1] / cell, fz = q[2] / cell;
    const gx = Math.round(fx) - 1, gy = Math.round(fy) - 1, gz = Math.round(fz) - 1;
    let best = -1, bd = (cell / 2) * (cell / 2);
    for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) for (let e = 0; e <= 1; e++) {
      const list = grid.get(key(gx + a, gy + b, gz + e)); if (!list) continue;
      for (const v of list) { const dx = R[v * 3] - q[0], dy = R[v * 3 + 1] - q[1], dz = R[v * 3 + 2] - q[2], dd = dx * dx + dy * dy + dz * dz; if (dd < bd) { bd = dd; best = v; } }
    }
    return best;
  };
  // the upper chest, which carries the ends through a pose
  let cf = -1, cl = -1, cr = -1, cb = -1;
  for (let v = 0; v < bodyCount; v++) {
    const x = R[v * 3] - c[0], y = R[v * 3 + 1], z = R[v * 3 + 2];
    if (y < top - 0.34 || y > top - 0.27 || Math.abs(x) > 0.12) continue;
    if (cf < 0 || z > R[cf * 3 + 2]) cf = v;
    if (cb < 0 || z < R[cb * 3 + 2]) cb = v;
    if (cl < 0 || x > R[cl * 3] - c[0]) cl = v;
    if (cr < 0 || x < R[cr * 3] - c[0]) cr = v;
  }
  // a neck and a jaw, as two capsules, so the ends can be kept out of them in a pose
  const nt = [c[0], c[1] - 0.85 * rad[1], c[2]];
  const ring = [];
  for (let v = 0; v < bodyCount; v++) { const y = R[v * 3 + 1]; if (y < nt[1] - 0.07 || y > nt[1] - 0.035 || Math.abs(R[v * 3] - c[0]) > 0.09) continue; ring.push(v); }
  let ncx = 0, ncz = 0; for (const v of ring) { ncx += R[v * 3]; ncz += R[v * 3 + 2]; } ncx /= ring.length || 1; ncz /= ring.length || 1;
  const rd = ring.map((v) => Math.hypot(R[v * 3] - ncx, R[v * 3 + 2] - ncz)).sort((x, y) => x - y);
  const rn = rd.length ? rd[rd.length >> 1] : 0.055;
  const nb = cf >= 0 ? [0, 1, 2].map((a) => (R[cf * 3 + a] + R[cl * 3 + a] + R[cr * 3 + a] + R[cb * 3 + a]) / 4) : [nt[0], nt[1] - 0.1, nt[2]];
  const rand = rng(seed);
  const K = S.segs, per = (K + 1) * 2, count = S.count, stepLen = 0.0075, maxSteps = 110;
  const position = new Float32Array(count * per * 3), normal = new Float32Array(count * per * 3), shade = new Float32Array(count * per), follow = new Float32Array(count * per);
  const idx = new Uint32Array(count * K * 6);
  let vi = 0, ii = 0, made = 0;
  for (let s = 0; s < count; s++) {
    const pick = rand() * total; let lo2 = 0, hi2 = cum.length - 1;
    while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (cum[m] < pick) lo2 = m + 1; else hi2 = m; }
    const t = tris[lo2];
    let u = rand(), w = rand(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const ids = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], bw = [1 - u - w, u, w];
    const p = [0, 0, 0], n = [0, 0, 0]; let depth = 0;
    for (let k = 0; k < 3; k++) { for (let a = 0; a < 3; a++) { p[a] += R[ids[k] * 3 + a] * bw[k]; n[a] += N[ids[k] * 3 + a] * bw[k]; } depth += hair[ids[k]] * bw[k]; }
    const nn = norm(n), rel = norm([p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
    // the parting runs down the middle; each strand falls to its own side
    const sx = Math.abs(p[0] - c[0]) < 0.003 ? (rand() < 0.5 ? -1 : 1) : Math.sign(p[0] - c[0]);
    const onTop = smooth(0.3, 0.8, rel[1]), front = smooth(0.1, 0.5, rel[2]) * smooth(-0.2, 0.3, rel[1]);
    const toFront = rel[2] > 0.05 ? 1 : -1; // over the shoulder: in front or behind
    const layer = rand(), edge = smooth(0, 0.012, depth);
    const myCut = cutY - 0.03 * smooth(0, 0.8, -rel[2]) + (rand() - 0.5) * 0.02;
    const scale = ell(p);
    let q = p.slice(), d = norm([nn[0] * 0.3, nn[1] * 0.3 - 1, nn[2] * 0.3]);
    const pts = [p.slice()];
    for (let k = 0; k < maxSteps; k++) {
      const r2 = norm([q[0] - c[0], q[1] - c[1], q[2] - c[2]]);
      const up = smooth(c[1] - 0.4 * rad[1], c[1] + 0.4 * rad[1], q[1]); // still up on the head
      let T = [sx * (0.9 * onTop + 2.5 * front) * up, -1, -(0.35 * onTop + 0.3 * front) * up];
      const tin = dot(T, r2); if (tin < 0 && ell(q) < scale * 1.3) T = [T[0] - r2[0] * tin, T[1] - r2[1] * tin, T[2] - r2[2] * tin];
      T = norm(T);
      d = norm([d[0] + T[0] * 0.35, d[1] + T[1] * 0.35, d[2] + T[2] * 0.35]);
      const prev = q;
      q = [q[0] + d[0] * stepLen, q[1] + d[1] * stepLen, q[2] + d[2] * stepLen];
      // outside the head, with a little body to it, laid on it while up on the head
      const lift = 0.002 + (0.003 + 0.01 * layer * (0.4 + 0.6 * onTop)) * edge;
      const want = scale * (1 + lift / rMean), cap = scale * (1 + (lift + 0.005) / rMean), e = ell(q);
      if (e < want || (e > cap && q[1] > c[1] - 0.1 * rad[1])) { const g = (e < want ? want : cap) / Math.max(e, 1e-6); q = [c[0] + (q[0] - c[0]) * g, c[1] + (q[1] - c[1]) * g, c[2] + (q[2] - c[2]) * g]; }
      // out of the face: below the brows the face stays clear and the hair frames it
      if (q[2] > faceZ && q[1] < browY && Math.abs(q[0] - c[0]) < faceW) q[0] += clamp(c[0] + sx * faceW - q[0], -0.01, 0.01);
      // off the skin: lifted out to rest on it, and slid over it, in front of or behind the shoulder
      const v = nearest(q);
      if (v >= 0) {
        const vn = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
        const off = 0.002 + 0.005 * layer, sd = (q[0] - R[v * 3]) * vn[0] + (q[1] - R[v * 3 + 1]) * vn[1] + (q[2] - R[v * 3 + 2]) * vn[2];
        if (sd < off) {
          q = [q[0] + vn[0] * (off - sd), q[1] + vn[1] * (off - sd), q[2] + vn[2] * (off - sd)];
          const dn = dot(d, vn); if (dn < 0) d = norm([d[0] - vn[0] * dn, d[1] - vn[1] * dn, d[2] - vn[2] * dn]);
          // on the shoulders it parts in front or behind instead of fanning out along them
          if (q[1] < jawY) d = norm([d[0] * 0.3, d[1], d[2] + toFront * 0.6]);
        }
      }
      const step = [q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]], sl = Math.hypot(...step);
      if (sl > 1e-6) d = norm([d[0] * 0.5 + step[0] / sl * 0.5, d[1] * 0.5 + step[1] / sl * 0.5, d[2] * 0.5 + step[2] / sl * 0.5]);
      pts.push(q);
      if (q[1] < myCut) break;
    }
    // even segments along the strand
    const arc = [0]; for (let k = 1; k < pts.length; k++) arc.push(arc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]));
    const L = arc[arc.length - 1]; if (L < 0.01) continue;
    const at = []; let j = 0;
    for (let k = 0; k <= K; k++) {
      const want = L * k / K; while (j < arc.length - 2 && arc[j + 1] < want) j++;
      const f = clamp((want - arc[j]) / Math.max(1e-9, arc[j + 1] - arc[j]), 0, 1);
      at.push([0, 1, 2].map((a) => pts[j][a] + (pts[j + 1][a] - pts[j][a]) * f));
    }
    const tone = 0.85 + 0.3 * rand();
    for (let k = 0; k <= K; k++) {
      const f = k / K, q2 = at[k], a2 = at[Math.max(0, k - 1)], b2 = at[Math.min(K, k + 1)];
      const dir = norm([b2[0] - a2[0], b2[1] - a2[1], b2[2] - a2[2]]), out = norm([q2[0] - c[0], Math.max(0, q2[1] - c[1]), q2[2] - c[2]]);
      const across = norm(cross(dir, out)), hw = S.width * (1 - 0.6 * f) / 2;
      const ribbon = norm(cross(across, dir));
      const nrm = norm([ribbon[0] * 0.5 + out[0] * 0.5, ribbon[1] * 0.5 + out[1] * 0.5, ribbon[2] * 0.5 + out[2] * 0.5]);
      for (const sgn of [-1, 1]) {
        for (let a = 0; a < 3; a++) { position[vi * 3 + a] = q2[a] + across[a] * hw * sgn; normal[vi * 3 + a] = nrm[a]; }
        shade[vi] = tone * (0.6 + 0.4 * smooth(0, 0.15, f) + 0.12 * f);
        follow[vi] = smooth(Math.min(jawY + 0.01, p[1]), cutY + 0.02, q2[1]); vi++;
      }
    }
    const base = made * per;
    for (let k = 0; k < K; k++) {
      const a = base + k * 2;
      idx[ii++] = a; idx[ii++] = a + 1; idx[ii++] = a + 2; idx[ii++] = a + 1; idx[ii++] = a + 3; idx[ii++] = a + 2;
    }
    made++;
  }
  const sl = (A) => A.subarray(0, made * per * (A === shade || A === follow ? 1 : 3));
  return { position: sl(position), normal: sl(normal), shade: sl(shade), follow: sl(follow), index: idx.subarray(0, made * K * 6), anchors: F.anchors, chest: cf >= 0 ? [cf, cl, cr, cb] : null, collide: { nb, nt, c: c.slice(), rn: rn + 0.006, rh: 0.8 * rad[0] }, strands: made, segs: K, centre: c, radii: rad };
}

// The rigid move of the skull from rest to now, from the four anchor vertices: a 4x4 matrix
// (column-major, as three.js keeps it). Rest and now are position arrays.
// A full beard: short, slightly curly strands from inside the beard (the body's 'beard' field from
// beard.js), longer on the chin and under it, short on the cheeks and over the lip. Each grows out
// from the skin and falls downwards, and never back into the skin it grew from. Moves with the
// skull in a pose, read from four vertices high on the head.
export function buildBeard(R, N, index, beard, bodyCount, seed = 11, count = 16000) {
  const I = index, tris = [], cum = [];
  let total = 0, topY = -Infinity, minY = Infinity;
  for (let v = 0; v < bodyCount; v++) if (beard[v] > 0.001) { topY = Math.max(topY, R[v * 3 + 1]); minY = Math.min(minY, R[v * 3 + 1]); }
  if (!(topY > minY)) return null;
  for (let t = 0; t < I.length / 3; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], d = I[t * 3 + 2];
    if (a >= bodyCount || b >= bodyCount || d >= bodyCount) continue;
    if (!(beard[a] > 0.0005 && beard[b] > 0.0005 && beard[d] > 0.0005)) continue;
    const A = [R[a * 3], R[a * 3 + 1], R[a * 3 + 2]], B = [R[b * 3], R[b * 3 + 1], R[b * 3 + 2]], D = [R[d * 3], R[d * 3 + 1], R[d * 3 + 2]];
    const ar = Math.hypot(...cross([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [D[0] - A[0], D[1] - A[1], D[2] - A[2]])) / 2;
    total += ar; tris.push(t); cum.push(total);
  }
  if (tris.length < 20) return null;
  // four vertices high on the head, which carry the beard through a pose
  const above = topY + 0.03;
  let top = -1, left = -1, right = -1, back = -1;
  for (let v = 0; v < bodyCount; v++) {
    if (R[v * 3 + 1] < above) continue;
    if (top < 0 || R[v * 3 + 1] > R[top * 3 + 1]) top = v;
    if (left < 0 || R[v * 3] > R[left * 3]) left = v;
    if (right < 0 || R[v * 3] < R[right * 3]) right = v;
    if (back < 0 || R[v * 3 + 2] < R[back * 3 + 2]) back = v;
  }
  if (top < 0) return null;
  const rand = rng(seed), K = 5, per = (K + 1) * 2, width = 0.0011;
  const position = new Float32Array(count * per * 3), normal = new Float32Array(count * per * 3), shade = new Float32Array(count * per);
  const idx = new Uint32Array(count * K * 6);
  let vi = 0, ii = 0;
  const midY = (topY + minY) / 2;
  for (let s = 0; s < count; s++) {
    const pick = rand() * total; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < pick) lo = m + 1; else hi = m; }
    const t = tris[lo];
    let u = rand(), w = rand(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const ids = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], bw = [1 - u - w, u, w];
    const p = [0, 0, 0], n = [0, 0, 0]; let depth = 0;
    for (let k = 0; k < 3; k++) { for (let a = 0; a < 3; a++) { p[a] += R[ids[k] * 3 + a] * bw[k]; n[a] += N[ids[k] * 3 + a] * bw[k]; } depth += beard[ids[k]] * bw[k]; }
    const nn = norm(n);
    // where on the beard: the chin and under it grow longest; over the lip and high on the cheek, short
    const facing = nn[2], under = smooth(0.1, 0.6, -nn[1]), low = smooth(midY + 0.01, minY + 0.01, p[1]);
    const chin = smooth(0.04, 0.0, Math.abs(p[0])) * Math.max(under, smooth(0.4, 0.9, facing) * low);
    const edge = smooth(0, 0.008, depth);
    const len = (0.008 + 0.012 * chin + 0.004 * under + 0.003 * low) * (0.7 + 0.6 * rand()) * (0.4 + 0.6 * edge);
    const step = len / K;
    // out of the skin, then down; a slight random lean and curl
    const down = [0, -1, 0.15 * facing], phase = rand() * 6.283, curl = 0.5 + 0.6 * rand();
    let d = norm([nn[0] * 0.8 + down[0] * 0.5 + (rand() - 0.5) * 0.4, nn[1] * 0.8 + down[1] * 0.5, nn[2] * 0.8 + down[2] * 0.5 + (rand() - 0.5) * 0.3]);
    const side = norm(cross(nn, [0, 1, 0])), pts = [p.slice()], dirs = [d];
    let q = p.slice();
    for (let k = 1; k <= K; k++) {
      const f = k / K, wob = Math.sin(phase + f * 5) * curl * 0.35;
      d = norm([d[0] + down[0] * 0.35 + side[0] * wob, d[1] + down[1] * 0.35 + side[1] * wob, d[2] + down[2] * 0.35 + side[2] * wob]);
      q = [q[0] + d[0] * step, q[1] + d[1] * step, q[2] + d[2] * step];
      // never back into the skin: at least a little off it, further along the strand
      const off = dot([q[0] - p[0], q[1] - p[1], q[2] - p[2]], nn), want = 0.0012 + 0.0025 * f;
      if (off < want) q = [q[0] + nn[0] * (want - off), q[1] + nn[1] * (want - off), q[2] + nn[2] * (want - off)];
      d = norm([q[0] - pts[k - 1][0], q[1] - pts[k - 1][1], q[2] - pts[k - 1][2]]);
      pts.push(q.slice()); dirs.push(d);
    }
    const tone = 0.8 + 0.35 * rand();
    for (let k = 0; k <= K; k++) {
      const f = k / K, q2 = pts[k];
      const across = norm(cross(dirs[k], nn)), hw = width * (1 - 0.7 * f) / 2;
      const ribbon = norm(cross(across, dirs[k]));
      const nrm = norm([ribbon[0] * 0.5 + nn[0] * 0.5, ribbon[1] * 0.5 + nn[1] * 0.5, ribbon[2] * 0.5 + nn[2] * 0.5]);
      for (const sgn of [-1, 1]) {
        for (let a = 0; a < 3; a++) { position[vi * 3 + a] = q2[a] + across[a] * hw * sgn; normal[vi * 3 + a] = nrm[a]; }
        shade[vi] = tone * (0.5 + 0.5 * smooth(0, 0.5, f)); vi++;
      }
    }
    const base = s * per;
    for (let k = 0; k < K; k++) { const a = base + k * 2; idx[ii++] = a; idx[ii++] = a + 1; idx[ii++] = a + 2; idx[ii++] = a + 1; idx[ii++] = a + 3; idx[ii++] = a + 2; }
  }
  return { position, normal, shade, index: idx, anchors: [top, left, right, back], strands: count, segs: K };
}

export function skullMove(rest, now, anchors) {
  const frame = (A) => {
    const p = anchors.map((v) => [A[v * 3], A[v * 3 + 1], A[v * 3 + 2]]);
    const o = [0, 1, 2].map((a) => (p[0][a] + p[1][a] + p[2][a] + p[3][a]) / 4);
    const e1 = norm([p[1][0] - p[2][0], p[1][1] - p[2][1], p[1][2] - p[2][2]]);
    const up = [p[0][0] - p[3][0], p[0][1] - p[3][1], p[0][2] - p[3][2]];
    const e2 = norm([up[0] - e1[0] * dot(up, e1), up[1] - e1[1] * dot(up, e1), up[2] - e1[2] * dot(up, e1)]);
    return { o, e: [e1, e2, cross(e1, e2)] };
  };
  const a = frame(rest), b = frame(now);
  // M = B * A^T: a rest vector's parts along A's axes, rebuilt on B's axes
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) M[i][j] += b.e[k][i] * a.e[k][j];
  const t = [0, 1, 2].map((i) => b.o[i] - (M[i][0] * a.o[0] + M[i][1] * a.o[1] + M[i][2] * a.o[2]));
  return [M[0][0], M[1][0], M[2][0], 0, M[0][1], M[1][1], M[2][1], 0, M[0][2], M[1][2], M[2][2], 0, t[0], t[1], t[2], 1];
}
