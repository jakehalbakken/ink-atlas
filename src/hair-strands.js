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
};

// R: rest positions; N: rest normals; index: triangle index; hair: the hairline field per vertex
// (positive under hair); bodyCount: vertices of the body proper. Returns { position, normal,
// shade, index, anchors, strands } where shade is a per-vertex brightness (root darker, tips
// lighter) and anchors are four skull vertices for following the head in a pose.
export function buildStrands(R, N, index, hair, bodyCount, style = 'medium', seed = 7) {
  const S = STRAND_STYLES[style] || STRAND_STYLES.medium;
  const P = (v) => [R[v * 3], R[v * 3 + 1], R[v * 3 + 2]];
  // the scalp: body vertices under hair
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
  // the skull vertices that carry the hair through a pose
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

// The rigid move of the skull from rest to now, from the four anchor vertices: a 4x4 matrix
// (column-major, as three.js keeps it). Rest and now are position arrays.
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
