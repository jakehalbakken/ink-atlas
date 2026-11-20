// Fitting the body to a 3D scan of the person (Scaniverse, Polycam), pure maths.
//
// The scan is never shown in place of the body. The body keeps its own mesh, so every saved
// tattoo anchor, the rig, poses, the painted skin detail, decals, wraps and every export keep
// working; it is moved onto the scan's surface instead, as per-vertex offsets in the standing
// (rest) pose:
//  1. alignScan: which way is up and which way the scan faces (24 square turns, then a finer
//     turn round the up axis), scaled to the body's normalised 1.75 height, feet on the floor;
//  2. fitStance: the arms and legs of the body are swung to the angles the person stood at;
//  3. shrinkwrap: each vertex of that posed body goes to the nearest scan surface facing the
//     same way, holes and noise smoothed over the mesh, fingers held smoother still;
//  4. unpose: those offsets are turned back into the standing pose through each vertex's own
//     skinning rotation, so later poses bend the scanned shape like the body's own.
// Distances are in the body's units (1.75 = the person's height).

const H = 1.75;

// 24 rotations that take the axes onto each other (which axis is up, and which way round)
export const ROTATIONS = (() => {
  const out = [], axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (const up of axes) for (const fw of axes) {
    if (Math.abs(up[0] * fw[0] + up[1] * fw[1] + up[2] * fw[2]) > 0.5) continue;
    const x = cross(up, fw); // rows: new x, new y (up), new z (forward)
    out.push([x[0], x[1], x[2], up[0], up[1], up[2], fw[0], fw[1], fw[2]]);
  }
  return out;
})();
export const turnY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const mul3 = (A, B) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return o; };

// a small seeded random number source, so a fit is the same every time
function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// Points spread evenly over a triangle surface (by area), with each one's face normal.
export function sampleSurface(positions, index, n, seed = 7) {
  const tris = index ? index.length / 3 : positions.length / 9, cum = new Float64Array(tris);
  const V = (t, k) => (index ? index[t * 3 + k] : t * 3 + k) * 3;
  let total = 0;
  for (let t = 0; t < tris; t++) {
    const a = V(t, 0), b = V(t, 1), c = V(t, 2);
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const ar = Math.hypot(cx, cy, cz) / 2; total += Number.isFinite(ar) ? ar : 0; cum[t] = total;
  }
  const pts = new Float32Array(n * 3), nrm = new Float32Array(n * 3), rnd = rng(seed);
  if (!(total > 0)) return { pts: new Float32Array(0), nrm: new Float32Array(0), area: 0 };
  for (let i = 0; i < n; i++) {
    const x = rnd() * total; let lo = 0, hi = tris - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    const a = V(lo, 0), b = V(lo, 1), c = V(lo, 2);
    let r1 = rnd(), r2 = rnd(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    for (let k = 0; k < 3; k++) pts[i * 3 + k] = positions[a + k] + (positions[b + k] - positions[a + k]) * r1 + (positions[c + k] - positions[a + k]) * r2;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx, l = Math.hypot(cx, cy, cz) || 1;
    nrm[i * 3] = cx / l; nrm[i * 3 + 1] = cy / l; nrm[i * 3 + 2] = cz / l;
  }
  return { pts, nrm, area: total };
}

// A uniform grid over points for nearest-point questions.
export function pointGrid(pts, cell = 0.02) {
  const n = pts.length / 3, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const v = pts[i * 3 + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  const dim = [0, 1, 2].map((k) => Math.max(1, Math.min(512, Math.ceil((hi[k] - lo[k]) / cell) + 1)));
  const key = (x, y, z) => (z * dim[1] + y) * dim[0] + x;
  const cellOf = (v, k) => Math.max(0, Math.min(dim[k] - 1, Math.floor((v - lo[k]) / cell)));
  const count = new Uint32Array(dim[0] * dim[1] * dim[2] + 1);
  for (let i = 0; i < n; i++) count[key(cellOf(pts[i * 3], 0), cellOf(pts[i * 3 + 1], 1), cellOf(pts[i * 3 + 2], 2)) + 1]++;
  for (let i = 1; i < count.length; i++) count[i] += count[i - 1];
  const fill = count.slice(), items = new Uint32Array(n);
  for (let i = 0; i < n; i++) items[fill[key(cellOf(pts[i * 3], 0), cellOf(pts[i * 3 + 1], 1), cellOf(pts[i * 3 + 2], 2))]++] = i;
  // the nearest point within maxR (and facing within minDot of normal n, when given), or -1
  function nearest(x, y, z, maxR = cell * 3, n = null, nrm = null, minDot = -2) {
    const r = Math.ceil(maxR / cell), cx = Math.floor((x - lo[0]) / cell), cy = Math.floor((y - lo[1]) / cell), cz = Math.floor((z - lo[2]) / cell);
    let best = -1, bd = maxR * maxR;
    for (let k = Math.max(0, cz - r); k <= Math.min(dim[2] - 1, cz + r); k++) for (let j = Math.max(0, cy - r); j <= Math.min(dim[1] - 1, cy + r); j++) for (let i = Math.max(0, cx - r); i <= Math.min(dim[0] - 1, cx + r); i++) {
      const c = key(i, j, k);
      for (let a = count[c]; a < count[c + 1]; a++) {
        const p = items[a], dx = pts[p * 3] - x, dy = pts[p * 3 + 1] - y, dz = pts[p * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
        if (d >= bd) continue;
        if (n && nrm && nrm[p * 3] * n[0] + nrm[p * 3 + 1] * n[1] + nrm[p * 3 + 2] * n[2] < minDot) continue;
        bd = d; best = p;
      }
    }
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  }
  return { nearest, cell, pts };
}

// apply R, scale s and offset t to points (scan file -> body units)
export function transformPoints(pts, { R, s, t }) {
  const out = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1], z = pts[i + 2];
    out[i] = (R[0] * x + R[1] * y + R[2] * z) * s + t[0];
    out[i + 1] = (R[3] * x + R[4] * y + R[5] * z) * s + t[1];
    out[i + 2] = (R[6] * x + R[7] * y + R[8] * z) * s + t[2];
  }
  return out;
}
export function rotateNormals(nrm, R) { return transformPoints(nrm, { R, s: 1, t: [0, 0, 0] }); }

const quantile = (arr, q) => { const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.max(0, Math.floor(q * (a.length - 1))))]; };

// Height, floor and middle of points turned by R: the scale and offset that stand them 1.75
// tall with the lowest point on the floor and the middle over the origin. Height comes from
// the 0.2% and 99.9% points so a stray speck does not count.
export function standUp(pts, R) {
  const n = pts.length / 3, ys = new Float64Array(n), xs = new Float64Array(n), zs = new Float64Array(n);
  for (let i = 0; i < n; i++) { const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2]; xs[i] = R[0] * x + R[1] * y + R[2] * z; ys[i] = R[3] * x + R[4] * y + R[5] * z; zs[i] = R[6] * x + R[7] * y + R[8] * z; }
  const lo = quantile(ys, 0.002), hi = quantile(ys, 0.999), tall = hi - lo, s = H / (tall || 1);
  // the middle of the body, not of arms held out: the middle of the middle half of the height
  const midX = [], midZ = [];
  for (let i = 0; i < n; i++) { const f = (ys[i] - lo) / tall; if (f > 0.45 && f < 0.6) { midX.push(xs[i]); midZ.push(zs[i]); } }
  const cx = midX.length ? quantile(midX, 0.5) : quantile(xs, 0.5), cz = midZ.length ? quantile(midZ, 0.5) : quantile(zs, 0.5);
  return { R, s, t: [-cx * s, -lo * s, -cz * s], tall };
}

// How far apart two point sets are: the mean of the nearest distances both ways, leaving out
// the worst 20% (floor, a chair, missing skin), in body units.
export function chamfer(aPts, aGrid, bPts, bGrid, maxR = 0.12) {
  const one = (pts, grid) => { const n = pts.length / 3, d = new Float64Array(n); for (let i = 0; i < n; i++) { const h = grid.nearest(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], maxR); d[i] = h ? h.d : maxR; } d.sort(); let s = 0; const k = Math.max(1, Math.floor(n * 0.8)); for (let i = 0; i < k; i++) s += d[i]; return s / k; };
  return (one(aPts, bGrid) + one(bPts, aGrid)) / 2;
}

// Stand the scan up and turn it to face the way the body faces. scanPts: a few thousand points
// from the scan file; body: points from the standing body (body units) and their grid.
// Returns { R, s, t, err, tall, tries } with tall the scan's height in its own file units.
export function alignScan(scanPts, bodyPts, bodyGrid, { only = null } = {}) {
  const tries = [];
  const score = (R) => { const st = standUp(scanPts, R), p = transformPoints(scanPts, st), g = pointGrid(p, 0.04); return { ...st, err: chamfer(bodyPts, bodyGrid, p, g) }; };
  let best = null;
  for (const R of only ? [only] : ROTATIONS) { const r = score(R); tries.push(r.err); if (!best || r.err < best.err) best = r; }
  // then a finer turn round the up axis: 10 degrees, then 3
  for (const step of only ? [3] : [10, 3]) { // a turn chosen by hand is only straightened a little
    let bestHere = best;
    for (const k of [-3, -2, -1, 1, 2, 3]) { const r = score(mul3(turnY((k * step * Math.PI) / 180), best.R)); if (r.err < bestHere.err) bestHere = r; }
    best = bestHere;
  }
  return { ...best, tries };
}

// Mean distance from each of these body vertices to the scan (nearest point facing the same
// way), with the worst 15% left out.
export function partError(posed, normals, verts, grid, nrm, maxR = 0.1) {
  const d = new Float64Array(verts.length);
  for (let a = 0; a < verts.length; a++) { const v = verts[a] * 3, h = grid.nearest(posed[v], posed[v + 1], posed[v + 2], maxR, [normals[v], normals[v + 1], normals[v + 2]], nrm, 0.2); d[a] = h ? h.d : maxR; }
  d.sort(); const k = Math.max(1, Math.floor(d.length * 0.85)); let s = 0; for (let i = 0; i < k; i++) s += d[i]; return s / k;
}

// Vertex normals of a triangle mesh
export function vertexNormals(P, index, count = P.length / 3) {
  const N = new Float32Array(count * 3);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    if (a >= count * 3 || b >= count * 3 || c >= count * 3) continue;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { N[o] += nx; N[o + 1] += ny; N[o + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}

// Swing the arms and legs to how the person stood. pose(stance) -> posed positions of the body;
// parts: { L, R, legL, legR } lists of vertex indices; grid/nrm: the scan in body units.
// near: a stance found before (on a body nearer the scan's shape now) to refine instead of a search.
export function fitStance(pose, index, count, parts, grid, nrm, near = null) {
  const err = (stance, verts) => { const P = pose(stance), N = vertexNormals(P, index, count); return partError(P, N, verts, grid, nrm); };
  const stance = near ? JSON.parse(JSON.stringify(near)) : { L: { lift: 0, straight: 0 }, R: { lift: 0, straight: 0 }, legL: 0, legR: 0 };
  for (const side of ['L', 'R']) {
    let best = { e: Infinity, lift: 0, straight: 0 };
    if (near) best = { e: err(stance, parts[side]), lift: near[side].lift, straight: near[side].straight };
    else for (const straight of [0, 0.5, 1]) for (let lift = -0.8; lift <= 0.95; lift += 0.15) {
      const e = err({ ...stance, [side]: { lift, straight } }, parts[side]); if (e < best.e) best = { e, lift, straight };
    }
    for (const [span, step] of (near ? [[0.05, 0.0125], [0.0125, 0.003]] : [[0.1, 0.025], [0.025, 0.00625]])) {
      const c = best.lift;
      for (let lift = c - span; lift <= c + span + 1e-9; lift += step) { const e = err({ ...stance, [side]: { lift, straight: best.straight } }, parts[side]); if (e < best.e) best = { ...best, e, lift }; }
    }
    for (const straight of [best.straight - 0.25, best.straight + 0.25]) if (straight >= 0 && straight <= 1) { const e = err({ ...stance, [side]: { lift: best.lift, straight } }, parts[side]); if (e < best.e) best = { ...best, e, straight }; }
    stance[side] = { lift: Math.round(best.lift * 10000) / 10000, straight: best.straight };
  }
  for (const leg of ['legL', 'legR']) {
    let best = { e: Infinity, a: 0 };
    if (near) best = { e: err(stance, parts[leg]), a: near[leg] };
    else for (let a = -0.12; a <= 0.32; a += 0.04) { const e = err({ ...stance, [leg]: a }, parts[leg]); if (e < best.e) best = { e, a }; }
    for (const [span, step] of [[0.03, 0.01], [0.01, 0.0025]]) { const c = best.a; for (let a = c - span; a <= c + span + 1e-9; a += step) { const e = err({ ...stance, [leg]: a }, parts[leg]); if (e < best.e) best = { e, a }; } }
    stance[leg] = Math.round(best.a * 1000) / 1000;
  }
  return stance;
}

// Neighbours of each vertex over the triangles
export function neighbours(index, count) {
  const sets = Array.from({ length: count }, () => new Set());
  for (let t = 0; t < index.length; t += 3) { const a = index[t], b = index[t + 1], c = index[t + 2]; if (a >= count || b >= count || c >= count) continue; sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b); }
  const off = new Uint32Array(count + 1); for (let v = 0; v < count; v++) off[v + 1] = off[v] + sets[v].size;
  const list = new Uint32Array(off[count]); for (let v = 0; v < count; v++) { let k = off[v]; for (const u of sets[v]) list[k++] = u; }
  return { off, list };
}

// Move each vertex of the posed body onto the scan. Returns offsets (posed space) and how many
// vertices found skin of their own. soft: per vertex 0..1, more is smoother (fingers, toes).
export function shrinkwrap(P, N, count, nb, grid, nrm, { maxR = 0.06, soft = null, rounds = 40 } = {}) {
  const raw = new Float32Array(count * 3), conf = new Float32Array(count); let found = 0;
  for (let v = 0; v < count; v++) {
    const o = v * 3, h = grid.nearest(P[o], P[o + 1], P[o + 2], maxR, [N[o], N[o + 1], N[o + 2]], nrm, 0.3);
    if (!h) continue;
    const q = h.i * 3, g = grid.pts;
    raw[o] = g[q] - P[o]; raw[o + 1] = g[q + 1] - P[o + 1]; raw[o + 2] = g[q + 2] - P[o + 2];
    conf[v] = 1 - 0.5 * (h.d / maxR); found++;
  }
  // soft parts first take a broad average of what was found round them, so the fine lumps of
  // the face and fingers never fold the skin
  if (soft) {
    let A = new Float32Array(raw), B = new Float32Array(raw.length); const cw = Float32Array.from(conf);
    for (let r = 0; r < 60; r++) {
      for (let v = 0; v < count; v++) {
        const o = v * 3; if (!(soft[v] > 0)) { B[o] = A[o]; B[o + 1] = A[o + 1]; B[o + 2] = A[o + 2]; continue; }
        let sx = A[o] * cw[v], sy = A[o + 1] * cw[v], sz = A[o + 2] * cw[v], sw = cw[v];
        for (let k = nb.off[v]; k < nb.off[v + 1]; k++) { const u = nb.list[k], c = cw[u] || 0.25; sx += A[u * 3] * c; sy += A[u * 3 + 1] * c; sz += A[u * 3 + 2] * c; sw += c; }
        const f = soft[v];
        B[o] = (1 - f) * raw[o] + f * sx / sw; B[o + 1] = (1 - f) * raw[o + 1] + f * sy / sw; B[o + 2] = (1 - f) * raw[o + 2] + f * sz / sw;
      }
      [A, B] = [B, A];
    }
    raw.set(A); for (let v = 0; v < count; v++) if (soft[v] > 0.5 && !conf[v]) conf[v] = 0.5;
  }
  // smooth: each vertex is pulled to its own find and to its neighbours' offsets; vertices that
  // found nothing (holes under the arms, the top of the head) take their neighbours'
  let D = new Float32Array(raw), E = new Float32Array(count * 3);
  for (let r = 0; r < rounds; r++) {
    for (let v = 0; v < count; v++) {
      const o = v * 3, w = conf[v] * 3 * (soft ? 1 - 0.9 * soft[v] : 1);
      let sx = raw[o] * w, sy = raw[o + 1] * w, sz = raw[o + 2] * w, sw = w;
      for (let k = nb.off[v]; k < nb.off[v + 1]; k++) { const u = nb.list[k] * 3; sx += D[u]; sy += D[u + 1]; sz += D[u + 2]; sw++; }
      E[o] = sx / sw; E[o + 1] = sy / sw; E[o + 2] = sz / sw;
    }
    [D, E] = [E, D];
  }
  for (let v = 0; v < count; v++) { const o = v * 3, l = Math.hypot(D[o], D[o + 1], D[o + 2]); if (l > maxR) { const f = maxR / l; D[o] *= f; D[o + 1] *= f; D[o + 2] *= f; } }
  return { off: D, found, coverage: found / count };
}

// Offsets measured on the posed body, turned back into the standing pose. skin(positions) is
// the same pose applied to any standing positions (pose.js skinPose with no swelling), so each
// vertex's rotation is read from three tiny moves along x, y and z.
export function unpose(off, rest, skin, count) {
  const h = 0.001, base = skin(rest), cols = [0, 1, 2].map((k) => { const p = new Float32Array(rest); for (let v = 0; v < count; v++) p[v * 3 + k] += h; return skin(p); });
  const out = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const o = v * 3, R = [0, 1, 2].map((k) => [(cols[k][o] - base[o]) / h, (cols[k][o + 1] - base[o + 1]) / h, (cols[k][o + 2] - base[o + 2]) / h]);
    // R[k] is the column for axis k; rest offset = R^T posed offset
    for (let k = 0; k < 3; k++) out[o + k] = R[k][0] * off[o] + R[k][1] * off[o + 1] + R[k][2] * off[o + 2];
  }
  return out;
}

// Offsets for the vertices past the body's own (eyes, the genital helper): each takes the
// offset of the nearest body vertex, so the eyes stay in their sockets and the rest follows.
export function extendOffsets(off, rest, bodyCount, total) {
  const all = new Float32Array(total * 3); all.set(off.subarray(0, bodyCount * 3));
  const g = pointGrid(rest.subarray(0, bodyCount * 3), 0.02);
  for (let v = bodyCount; v < total; v++) {
    const o = v * 3, hit = g.nearest(rest[o], rest[o + 1], rest[o + 2], 0.2);
    if (hit) { all[o] = off[hit.i * 3]; all[o + 1] = off[hit.i * 3 + 1]; all[o + 2] = off[hit.i * 3 + 2]; }
  }
  return all;
}

// What a scan is in its own file: the height in its units read as metres, centimetres or
// millimetres when it is a person's height in one of them (inches when nothing else fits).
export function scanHeightInches(tall) {
  for (const [lo, hi, toCm] of [[1.2, 2.3, 100], [120, 230, 1], [1200, 2300, 0.1], [47, 91, 2.54]]) if (tall >= lo && tall <= hi) return (tall * toCm) / 2.54;
  return null;
}

// One quick number for how well the body now sits on the scan: the middle and 90th percentile
// distance from the body's vertices to the scan, in body units.
export function fitQuality(P, N, count, grid, nrm, maxR = 0.1) {
  const d = new Float64Array(count); let missed = 0;
  for (let v = 0; v < count; v++) { const o = v * 3, h = grid.nearest(P[o], P[o + 1], P[o + 2], maxR, [N[o], N[o + 1], N[o + 2]], nrm, 0.2); d[v] = h ? h.d : maxR; if (!h) missed++; }
  d.sort();
  return { median: d[Math.floor(count * 0.5)], p90: d[Math.floor(count * 0.9)], missed: missed / count };
}

// A scan often carries a patch of floor (or a wall) under or behind the person. It is a large
// flat piece with everything else on one side of it: found by trying planes through three
// points, and dropped with the little that lies past it. A body has no flat piece that big.
// Works in the file's own units (sizes are shares of the points' spread). Returns kept points.
export function dropFloor(pts, nrm, { share = 0.15, tries = 400, seed = 3 } = {}) {
  let P = pts, Nn = nrm;
  for (let round = 0; round < 2; round++) {
    const n = P.length / 3; if (n < 100) break;
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const v = P[i * 3 + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
    const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), tol = diag * 0.004;
    const every = Math.max(1, Math.floor(n / 4000)), sub = []; for (let i = 0; i < n; i += every) sub.push(i);
    const rnd = rng(seed + round); let best = null;
    for (let t = 0; t < tries; t++) {
      const [a, b, c] = [0, 1, 2].map(() => sub[Math.floor(rnd() * sub.length)] * 3);
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-12) continue; nx /= l; ny /= l; nz /= l;
      const d0 = nx * P[a] + ny * P[a + 1] + nz * P[a + 2]; let inl = 0, pos = 0, neg = 0;
      for (const i of sub) { const d = nx * P[i * 3] + ny * P[i * 3 + 1] + nz * P[i * 3 + 2] - d0; if (Math.abs(d) <= tol) inl++; else if (d > 0) pos++; else neg++; }
      if (!best || inl > best.inl) best = { inl, n: [nx, ny, nz], d0, side: pos >= neg ? 1 : -1, one: Math.min(pos, neg) / Math.max(1, pos + neg) };
    }
    if (!best || best.inl < share * sub.length || best.one > 0.02) break;
    // the floor's own level and thickness from the points on it, so the soles of the feet stay
    let m = 0, m2 = 0, k = 0;
    for (const i of sub) { const d = best.n[0] * P[i * 3] + best.n[1] * P[i * 3 + 1] + best.n[2] * P[i * 3 + 2] - best.d0; if (Math.abs(d) <= tol) { m += d; m2 += d * d; k++; } }
    m /= k; const sd = Math.sqrt(Math.max(0, m2 / k - m * m)), cut = Math.max(diag * 0.0008, 3 * sd);
    const keep = []; for (let i = 0; i < n; i++) { const d = (best.n[0] * P[i * 3] + best.n[1] * P[i * 3 + 1] + best.n[2] * P[i * 3 + 2] - best.d0 - m) * best.side; if (d > cut) keep.push(i); }
    const P2 = new Float32Array(keep.length * 3), N2 = new Float32Array(keep.length * 3);
    keep.forEach((i, j) => { P2.set(P.subarray(i * 3, i * 3 + 3), j * 3); N2.set(Nn.subarray(i * 3, i * 3 + 3), j * 3); });
    P = P2; Nn = N2;
  }
  return { pts: P, nrm: Nn, dropped: pts.length / 3 - P.length / 3 };
}

// Turn normals to face out of the body when most of them face in (a file wound the other way).
export function faceOut(pts, nrm) {
  const n = pts.length / 3, c = [0, 0, 0]; for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += pts[i * 3 + k] / n;
  let s = 0; for (let i = 0; i < n; i++) s += nrm[i * 3] * (pts[i * 3] - c[0]) + nrm[i * 3 + 1] * (pts[i * 3 + 1] - c[1]) + nrm[i * 3 + 2] * (pts[i * 3 + 2] - c[2]);
  if (s < 0) for (let i = 0; i < nrm.length; i++) nrm[i] = -nrm[i];
  return s < 0;
}

// The whole fit. scan: { pts, nrm } points sampled from the scan file (its own units and axes);
// rest: the standing body's positions (all vertices); skinFor(stance) -> (positions) -> posed
// positions; parts: vertex lists for the arms and legs; soft: per body vertex smoothing.
// turn: a rotation to use instead of searching (after the person turned it by hand).
export function fitScan({ scan, rest, index, bodyCount, parts, soft, skinFor, turn = null, stance: fixed = null, progress = () => {} }) {
  const bodyIdx = []; for (let v = 0; v < bodyCount; v += 3) bodyIdx.push(v);
  const bodyPts = new Float32Array(bodyIdx.length * 3); bodyIdx.forEach((v, i) => bodyPts.set(rest.subarray(v * 3, v * 3 + 3), i * 3));
  const bodyGrid = pointGrid(bodyPts, 0.04);
  const n = scan.pts.length / 3, every = Math.max(1, Math.floor(n / 5000)), small = new Float32Array(Math.floor(n / every) * 3);
  for (let i = 0, j = 0; j < small.length; i += every, j += 3) small.set(scan.pts.subarray(i * 3, i * 3 + 3), j);
  const align = alignScan(small, bodyPts, bodyGrid, { only: turn });
  let pts = transformPoints(scan.pts, align), nrm = rotateNormals(scan.nrm, align.R), grid = pointGrid(pts, 0.025);
  progress(0.1);
  let near = fixed; // after the first search, each refit starts from the stance found
  const stanceOf = () => (near = fitStance((st) => skinFor(st)(rest), index, bodyCount, parts, grid, nrm, near));
  let stance = stanceOf(); progress(0.45);
  // A person with feet apart or arms up stands lower or higher than standing straight, so the
  // scan, stood 1.75 tall, is as tall as the body in that same stance instead; then the stance
  // again on the scan at its right size.
  for (let round = 0; round < 2; round++) {
    const P = skinFor(stance)(rest); let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < bodyCount * 3; i += 3) { if (P[i] < lo) lo = P[i]; if (P[i] > hi) hi = P[i]; }
    const k = (hi - lo) / H; if (Math.abs(k - 1) < 0.001) break;
    for (let i = 0; i < pts.length; i++) pts[i] *= k;
    align.s *= k; align.t = align.t.map((x) => x * k); align.stood = (align.stood || 1) * k;
    grid = pointGrid(pts, 0.025);
    stance = stanceOf(); progress(0.6 + round * 0.15);
  }
  const skin = skinFor(stance), posed = skin(rest), N = vertexNormals(posed, index, bodyCount);
  const nb = neighbours(index, bodyCount);
  const sw = shrinkwrap(posed, N, bodyCount, nb, grid, nrm, { soft }); progress(0.95);
  const off = unpose(sw.off, rest, skin, bodyCount);
  const after = new Float32Array(posed); for (let i = 0; i < bodyCount * 3; i++) after[i] += sw.off[i];
  const quality = fitQuality(after, vertexNormals(after, index, bodyCount), bodyCount, grid, nrm);
  return { align: { R: align.R, s: align.s, t: align.t, tall: align.tall / (align.stood || 1), err: align.err }, stance, off, coverage: sw.coverage, quality, grid, nrm };
}
