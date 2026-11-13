// "My face": a selfie laid onto the 3D head. Pure maths, no browser.
//
// MediaPipe's face landmarker finds 478 points on a face. The same 478 points were found once on
// the 3D head itself (tools/face-map-bake.mjs) and stored as triangle + barycentric weights in
// face-map.js, so they follow every body shape. Each head vertex then gets a place in the photo:
// the front view of the 3D landmarks is cut into triangles, the vertex is found in one, and the
// same weights on the photo's landmarks say where its colour comes from. The photo's own lighting
// is taken out (each pixel is divided by a soft blur of the face around it), so the face keeps its
// features (brows, lips, eyes, stubble) but takes the body's skin tone and the scene's light.

// The outline of the face in MediaPipe's numbering, round from the top of the forehead.
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
export const IRIS = { l: [468, 469, 470, 471, 472], r: [473, 474, 475, 476, 477] };
// round each eye opening (upper and lower lid)
export const EYE_RING = {
  r: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  l: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
};

// Delaunay triangulation of 2D points (Bowyer-Watson). pts: [[x, y]...] -> flat triangle list.
export function delaunay(pts) {
  const n = pts.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  const d = Math.max(maxX - minX, maxY - minY) * 20, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const P = pts.concat([[mx - d, my - d], [mx + d, my - d], [mx, my + d]]);
  const circ = (a, b, c) => {
    const [ax, ay] = P[a], [bx, by] = P[b], [cx, cy] = P[c];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(D) < 1e-18) return { x: 0, y: 0, r2: Infinity };
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const x = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / D, y = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / D;
    return { x, y, r2: (ax - x) ** 2 + (ay - y) ** 2 };
  };
  let tris = [{ v: [n, n + 1, n + 2], c: circ(n, n + 1, n + 2) }];
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i], bad = [], keep = [];
    for (const t of tris) ((px - t.c.x) ** 2 + (py - t.c.y) ** 2 < t.c.r2 ? bad : keep).push(t);
    const edges = new Map();
    for (const t of bad) for (let k = 0; k < 3; k++) {
      const a = t.v[k], b = t.v[(k + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a;
      edges.set(key, edges.has(key) ? null : [a, b]);
    }
    for (const e of edges.values()) if (e) keep.push({ v: [e[0], e[1], i], c: circ(e[0], e[1], i) });
    tris = keep;
  }
  const out = [];
  for (const t of tris) if (t.v.every((v) => v < n)) out.push(...t.v);
  return out;
}

// Barycentric weights of (x, y) in the 2D triangle a, b, c.
export function bary2(x, y, a, b, c) {
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(d) < 1e-20) return null;
  const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
  const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
  return [u, v, 1 - u - v];
}

// Distance from (x, y) to a closed polygon's edges, positive inside.
export function insideDistance(x, y, poly) {
  let inside = false, best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    const ex = xj - xi, ey = yj - yi, L = ex * ex + ey * ey;
    const t = L ? Math.max(0, Math.min(1, ((x - xi) * ex + (y - yi) * ey) / L)) : 0;
    best = Math.min(best, Math.hypot(x - xi - t * ex, y - yi - t * ey));
  }
  return inside ? best : -best;
}

// The 3D landmarks on the current body: map = flat [tri, w1, w2] * 478 (w0 = 1 - w1 - w2).
export function landmarks3D(positions, index, map) {
  const out = [];
  for (let i = 0; i < map.length; i += 3) {
    const t = map[i] * 3, w1 = map[i + 1], w2 = map[i + 2], w0 = 1 - w1 - w2, p = [0, 0, 0];
    for (let k = 0; k < 3; k++) p[k] = w0 * positions[index[t] * 3 + k] + w1 * positions[index[t + 1] * 3 + k] + w2 * positions[index[t + 2] * 3 + k];
    out.push(p);
  }
  return out;
}

// Where each head vertex takes its colour from. lm3: the 478 landmarks on the body (front +z,
// up +y); photo: the 478 landmarks in texture space [u, v]. Returns a Float32Array of
// n * 3: u, v, and how much of the photo shows (0..1). skip(v) leaves a vertex out (the eyes).
export function faceAttribute(positions, normals, n, lm3, photo, skip = () => false) {
  const out = new Float32Array(n * 3);
  const pts = lm3.map((p) => [p[0], p[1]]);
  const tri = delaunay(pts);
  const oval = FACE_OVAL.map((i) => pts[i]);
  const rings = [EYE_RING.l, EYE_RING.r].map((r) => r.map((i) => pts[i]));
  // the face's size, for fades that scale with the body
  let top = -Infinity, bottom = Infinity, left = Infinity, right = -Infinity;
  for (const [x, y] of oval) { top = Math.max(top, y); bottom = Math.min(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  const size = top - bottom, fade = size * 0.09, zEps = size * 0.12;
  const pad = size * 0.15;
  // triangles with bounds, for a quick search
  const T = [];
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i], b = tri[i + 1], c = tri[i + 2], A = pts[a], B = pts[b], C = pts[c];
    T.push({ a, b, c, x0: Math.min(A[0], B[0], C[0]), x1: Math.max(A[0], B[0], C[0]), y0: Math.min(A[1], B[1], C[1]), y1: Math.max(A[1], B[1], C[1]) });
  }
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    if (y < bottom - pad || y > top + pad || x < left - pad || x > right + pad || skip(v)) continue;
    if (normals[v * 3 + 2] < -0.2) continue; // the back of the head
    // the triangle it sits in, or the nearest one (weights a little outside) near the edge
    let hit = null, hitErr = Infinity;
    for (const t of T) {
      if (x < t.x0 - pad || x > t.x1 + pad || y < t.y0 - pad || y > t.y1 + pad) continue;
      const w = bary2(x, y, pts[t.a], pts[t.b], pts[t.c]); if (!w) continue;
      const err = Math.max(0, -w[0]) + Math.max(0, -w[1]) + Math.max(0, -w[2]);
      if (err < hitErr) { hitErr = err; hit = { t, w }; if (err === 0) break; }
    }
    if (!hit) continue;
    const { t, w } = hit;
    // only the skin on the front surface: not the back of the head behind the same spot
    const zs = w[0] * lm3[t.a][2] + w[1] * lm3[t.b][2] + w[2] * lm3[t.c][2];
    if (z < zs - zEps) continue;
    const u = w[0] * photo[t.a][0] + w[1] * photo[t.b][0] + w[2] * photo[t.c][0];
    const vv = w[0] * photo[t.a][1] + w[1] * photo[t.b][1] + w[2] * photo[t.c][1];
    let alpha = smooth(0, fade, insideDistance(x, y, oval));
    // a soft gap round each eye opening, so lid skin never picks up the white of the eye
    for (const r of rings) alpha *= smooth(-size * 0.004, size * 0.022, -insideDistance(x, y, r));
    alpha *= smooth(0.05, 0.45, normals[v * 3 + 2]);
    out[v * 3] = u; out[v * 3 + 1] = vv; out[v * 3 + 2] = alpha;
  }
  return out;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The square of the photo the texture is cut from: the face's landmarks with a margin.
export function faceCrop(lm, w, h) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of lm) { x0 = Math.min(x0, p.x * w); y0 = Math.min(y0, p.y * h); x1 = Math.max(x1, p.x * w); y1 = Math.max(y1, p.y * h); }
  const s = Math.max(x1 - x0, y1 - y0) * 1.15, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: cx - s / 2, y: cy - s / 2, s };
}

// The texture: photo divided by a soft blur of the face (the blur only counts face pixels), so
// what is left is the detail, around 1. Stored as ratio / 2 so 0..2 fits 0..255.
// rgba: the cropped photo, size x size; mask: 0..1 per pixel, the face.
export function detailTexture(rgba, mask, size, radius) {
  const N = size * size, ch = [new Float32Array(N), new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) { const m = mask[i]; ch[0][i] = rgba[i * 4] * m; ch[1][i] = rgba[i * 4 + 1] * m; ch[2][i] = rgba[i * 4 + 2] * m; ch[3][i] = m; }
  for (const c of ch) for (let pass = 0; pass < 3; pass++) { boxBlur(c, size, radius, true); boxBlur(c, size, radius, false); }
  const out = new Uint8ClampedArray(N * 4);
  let sum = [0, 0, 0], cnt = 0;
  for (let i = 0; i < N; i++) {
    const m = Math.max(ch[3][i], 1e-4);
    for (let k = 0; k < 3; k++) {
      const low = ch[k][i] / m, r = (rgba[i * 4 + k] + 2) / (low + 2);
      out[i * 4 + k] = Math.round(Math.min(2, r) * 127.5);
    }
    out[i * 4 + 3] = 255;
    if (mask[i] > 0.5) { sum[0] += rgba[i * 4]; sum[1] += rgba[i * 4 + 1]; sum[2] += rgba[i * 4 + 2]; cnt++; }
  }
  return { pixels: out, mean: sum.map((s) => s / Math.max(1, cnt)) };
}
function boxBlur(a, size, r, horiz) {
  const tmp = new Float32Array(size);
  for (let line = 0; line < size; line++) {
    let acc = 0; const at = (i) => horiz ? line * size + i : i * size + line;
    for (let i = -r; i <= r; i++) acc += a[at(Math.max(0, Math.min(size - 1, i)))];
    for (let i = 0; i < size; i++) {
      tmp[i] = acc / (2 * r + 1);
      acc += a[at(Math.min(size - 1, i + r + 1))] - a[at(Math.max(0, i - r))];
    }
    for (let i = 0; i < size; i++) a[at(i)] = tmp[i];
  }
}

// The face's shape from the photo: the photo's landmarks are laid over the 3D ones (best fit by
// size, turn and position), and each 3D landmark is pulled towards its photo point, front to back
// left alone. The pull spreads smoothly to the head's other vertices and fades out past the edge
// of the face. Returns offsets (n * 3) to add to the positions. eyes: [[from, count], ...]: each
// eyeball moves as one piece with the lids round it.
// headZ: MediaPipe's own depth for each landmark on the plain 3D head (FACE_DEPTH), in face widths.
// When the photo's landmarks carry depth too, the difference between the two is this person's
// depth (a longer nose, a deeper brow), so the head's front moves forward or back by it as well.
export function faceMorph(positions, normals, n, lm3, photo, eyes = [], strength = 0.85, headZ = null) {
  const out = new Float32Array(n * 3);
  const N = lm3.length;
  // similarity fit, photo (u right, v down) -> front view (x right, y up), as complex numbers
  let px = 0, py = 0, qx = 0, qy = 0;
  for (let i = 0; i < N; i++) { px += lm3[i][0]; py += lm3[i][1]; qx += photo[i][0]; qy += -photo[i][1]; }
  px /= N; py /= N; qx /= N; qy /= N;
  let re = 0, im = 0, qq = 0;
  for (let i = 0; i < N; i++) {
    const ax = photo[i][0] - qx, ay = -photo[i][1] - qy, bx = lm3[i][0] - px, by = lm3[i][1] - py;
    re += ax * bx + ay * by; im += ax * by - ay * bx; qq += ax * ax + ay * ay;
  }
  re /= qq; im /= qq;
  const oval = FACE_OVAL.map((i) => [lm3[i][0], lm3[i][1]]);
  let top = -Infinity, bottom = Infinity, left = Infinity, right = -Infinity;
  for (const [x, y] of oval) { top = Math.max(top, y); bottom = Math.min(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  const size = top - bottom, cap = size * 0.1, sigma = size * 0.07, s2 = 2 * sigma * sigma, reach = size * 0.2;
  // depth: both in face widths (cheek to cheek), each less its own mean; nearer the camera is
  // smaller z in the photo and larger z on the body
  const depth = headZ && headZ.length === N && photo.every((q) => Number.isFinite(q[2]));
  let dz = null;
  if (depth) {
    const pw = Math.max(1e-6, Math.hypot(photo[454][0] - photo[234][0], photo[454][1] - photo[234][1]));
    const bw = Math.hypot(lm3[454][0] - lm3[234][0], lm3[454][1] - lm3[234][1]);
    let m = 0; for (let i = 0; i < N; i++) m += photo[i][2] / pw - headZ[i]; m /= N;
    const zcap = bw * 0.06;
    dz = photo.map((q, i) => Math.max(-zcap, Math.min(zcap, -(q[2] / pw - headZ[i] - m) * bw * strength)));
  }
  const d = lm3.map((p, i) => {
    const ax = photo[i][0] - qx, ay = -photo[i][1] - qy;
    let dx = (re * ax - im * ay + px - p[0]) * strength, dy = (im * ax + re * ay + py - p[1]) * strength;
    const L = Math.hypot(dx, dy); if (L > cap) { dx *= cap / L; dy *= cap / L; }
    return [dx, dy, dz ? dz[i] : 0];
  });
  const at = (x, y) => {
    let sx = 0, sy = 0, sz = 0, sw = 0;
    for (let i = 0; i < N; i++) { const ex = x - lm3[i][0], ey = y - lm3[i][1], w = Math.exp(-(ex * ex + ey * ey) / s2); sx += w * d[i][0]; sy += w * d[i][1]; sz += w * d[i][2]; sw += w; }
    return sw > 1e-9 ? [sx / sw, sy / sw, sz / sw] : [0, 0, 0];
  };
  const eyeOf = (v) => eyes.findIndex(([s, c]) => v >= s && v < s + c);
  for (let v = 0; v < n; v++) {
    if (eyeOf(v) >= 0) continue;
    const x = positions[v * 3], y = positions[v * 3 + 1];
    if (y < bottom - reach || y > top + reach || x < left - reach || x > right + reach) continue;
    const nz = normals[v * 3 + 2]; if (nz < -0.3) continue;
    const w = smooth(-reach, 0, insideDistance(x, y, oval)) * smooth(-0.3, 0.3, nz);
    if (w < 1e-3) continue;
    const [dx, dy, ddz] = at(x, y);
    out[v * 3] = dx * w; out[v * 3 + 1] = dy * w; out[v * 3 + 2] = ddz * w * smooth(0, 0.5, nz);
  }
  for (const [s, c] of eyes) {
    let x = 0, y = 0; for (let v = s; v < s + c; v++) { x += positions[v * 3]; y += positions[v * 3 + 1]; }
    const [dx, dy, ddz] = at(x / c, y / c);
    for (let v = s; v < s + c; v++) { out[v * 3] = dx; out[v * 3 + 1] = dy; out[v * 3 + 2] = ddz; }
  }
  return out;
}
