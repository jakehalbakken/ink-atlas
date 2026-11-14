// Cover-up check: how much of an older tattoo's ink a planned one lays its own ink over.
//
// coverByArt reads the new artwork itself at each old ink point: the point is found on the new
// tattoo's decal (its triangles on the skin and their artwork coordinates), and it counts as
// covered only where the new artwork is dark there. Thin line work therefore covers little and
// solid fill covers what it sits on. tris: flat xyz, 9 per triangle; uvs: 6 per triangle;
// oldPts: flat xyz; ink(u, v): true where the new artwork has ink; reach: how far off the
// decal a point may sit (body units).
export function coverByArt({ tris, uvs, oldPts, ink, reach }) {
  const T = tris.length / 9, n = oldPts ? oldPts.length / 3 : 0; if (!T || !n) return 0;
  // a grid of triangle boxes, so each point looks at a few triangles only
  let size = 0; for (let t = 0; t < T; t++) { const o = t * 9; size += Math.hypot(tris[o] - tris[o + 3], tris[o + 1] - tris[o + 4], tris[o + 2] - tris[o + 5]); }
  const cell = Math.max(reach * 2, size / T * 1.5), grid = new Map(), key = (x, y, z) => x * 73856093 ^ y * 19349663 ^ z * 83492791;
  for (let t = 0; t < T; t++) {
    const o = t * 9, lo = [0, 1, 2].map((k) => Math.floor((Math.min(tris[o + k], tris[o + 3 + k], tris[o + 6 + k]) - reach) / cell)), hi = [0, 1, 2].map((k) => Math.floor((Math.max(tris[o + k], tris[o + 3 + k], tris[o + 6 + k]) + reach) / cell));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(t); }
  }
  let hit = 0;
  for (let j = 0; j < n; j++) {
    const px = oldPts[j * 3], py = oldPts[j * 3 + 1], pz = oldPts[j * 3 + 2], list = grid.get(key(Math.floor(px / cell), Math.floor(py / cell), Math.floor(pz / cell)));
    if (!list) continue;
    let best = null, bd = reach;
    for (const t of list) {
      const o = t * 9, r = onTriangle(tris, o, px, py, pz);
      if (r && r.d <= bd) { bd = r.d; best = [t, r.w]; }
    }
    if (!best) continue;
    const [t, w] = best, q = t * 6, u = w[0] * uvs[q] + w[1] * uvs[q + 2] + w[2] * uvs[q + 4], v = w[0] * uvs[q + 1] + w[1] * uvs[q + 3] + w[2] * uvs[q + 5];
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && ink(u, v)) hit++;
  }
  return hit / n;
}

// The point on a triangle under p, if p sits over it: barycentric weights and the distance.
function onTriangle(P, o, x, y, z) {
  const ax = P[o], ay = P[o + 1], az = P[o + 2], e1 = [P[o + 3] - ax, P[o + 4] - ay, P[o + 5] - az], e2 = [P[o + 6] - ax, P[o + 7] - ay, P[o + 8] - az], d = [x - ax, y - ay, z - az];
  const d11 = e1[0] * e1[0] + e1[1] * e1[1] + e1[2] * e1[2], d12 = e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2], d22 = e2[0] * e2[0] + e2[1] * e2[1] + e2[2] * e2[2];
  const p1 = d[0] * e1[0] + d[1] * e1[1] + d[2] * e1[2], p2 = d[0] * e2[0] + d[1] * e2[1] + d[2] * e2[2], den = d11 * d22 - d12 * d12;
  if (Math.abs(den) < 1e-18) return null;
  const b = (d22 * p1 - d12 * p2) / den, c = (d11 * p2 - d12 * p1) / den, a = 1 - b - c, eps = -0.02;
  if (a < eps || b < eps || c < eps) return null;
  const qx = ax + e1[0] * b + e2[0] * c, qy = ay + e1[1] * b + e2[1] * c, qz = az + e1[2] * b + e2[2] * c;
  return { w: [a, b, c], d: Math.hypot(x - qx, y - qy, z - qz) };
}

// The share of old ink points with any new ink point within r (both flat xyz). A rougher
// measure, kept for comparison in tests.
export function coverShare(newPts, oldPts, r) {
  if (!newPts || !oldPts || !newPts.length || !oldPts.length) return 0;
  const cell = r, grid = new Map(), key = (x, y, z) => x * 73856093 ^ y * 19349663 ^ z * 83492791;
  for (let i = 0; i < newPts.length; i += 3) {
    const k = key(Math.floor(newPts[i] / cell), Math.floor(newPts[i + 1] / cell), Math.floor(newPts[i + 2] / cell));
    let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(i);
  }
  const r2 = r * r; let hit = 0;
  for (let j = 0; j < oldPts.length; j += 3) {
    const x = oldPts[j], y = oldPts[j + 1], z = oldPts[j + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let found = false;
    for (let dx = -1; dx <= 1 && !found; dx++) for (let dy = -1; dy <= 1 && !found; dy++) for (let dz = -1; dz <= 1 && !found; dz++) {
      const a = grid.get(key(cx + dx, cy + dy, cz + dz)); if (!a) continue;
      for (const i of a) { const ex = newPts[i] - x, ey = newPts[i + 1] - y, ez = newPts[i + 2] - z; if (ex * ex + ey * ey + ez * ez <= r2) { found = true; break; } }
    }
    if (found) hit++;
  }
  return hit / (oldPts.length / 3);
}

// The line under the size: "Covers 72% of Old rose's ink" for a planned tattoo over one already
// on you, or '' when it covers none of it.
export function coverText(share, name) {
  if (share < 0.02) return '';
  const pc = Math.round(share * 100);
  return pc >= 98 ? `Covers all of ${name}’s ink` : `Covers ${pc}% of ${name}’s ink`;
}
