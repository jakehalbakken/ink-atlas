// Warp, distort and arc for a tattoo placed on the body: the artwork bent into a new shape before
// it is laid on the skin, the way Procreate's Warp and Distort work on a layer. Pure maths, no DOM.
//
// A warp is a grid of n x n points, row by row from the top, each where that point of the artwork
// now sits, in the tattoo's own frame: x 0..1 from its left edge to its right, y 0..1 from its top
// to its bottom (as you look at it, before any mirroring). The untouched grid is evenly spaced; a
// point dragged outside the frame grows the picture past its old edge. The picture between the
// points follows a smooth surface through every point (Catmull-Rom), so a dragged point bends the
// artwork round it instead of folding it at the grid lines.
//
// Stored as optional t.warp = { n, p: [x, y, x, y, ...] }; a tattoo without it is unchanged, so no
// save needs a migration. The artwork itself is never changed.

export const WARP_SIZES = [3, 4, 5];
export const WARP_DEFAULT = 4;
const LIM = [-1.5, 2.5]; // how far past its frame a point may go (one and a half frames each way)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const finite = (x) => typeof x === 'number' && Number.isFinite(x);

export function identityWarp(n = WARP_DEFAULT) {
  const p = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) p.push(j / (n - 1), i / (n - 1));
  return { n, p };
}
export function isIdentity(w, eps = 1e-4) {
  if (!w) return true;
  const n = w.n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = (i * n + j) * 2;
    if (Math.abs(w.p[k] - j / (n - 1)) > eps || Math.abs(w.p[k + 1] - i / (n - 1)) > eps) return false;
  }
  return true;
}
// A saved warp made safe, or null when there is none worth keeping (absent, broken or untouched).
export function cleanWarp(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w) || !WARP_SIZES.includes(w.n) || !Array.isArray(w.p) || w.p.length !== w.n * w.n * 2) return null;
  if (!w.p.every(finite)) return null;
  const out = { n: w.n, p: w.p.map((x) => Math.round(clamp(x, LIM[0], LIM[1]) * 1e5) / 1e5) };
  return isIdentity(out) ? null : out;
}
export const hasWarp = (t) => !!(t && cleanWarp(t.warp));
export const warpOf = (t) => cleanWarp(t && t.warp);
export const warpKey = (w) => (w ? w.n + ':' + w.p.map((x) => x.toFixed(4)).join(',') : '');

// Catmull-Rom weights for a point a share f of the way between the second and third of four.
function crw(f, out) {
  const f2 = f * f, f3 = f2 * f;
  out[0] = -0.5 * f3 + f2 - 0.5 * f; out[1] = 1.5 * f3 - 2.5 * f2 + 1; out[2] = -1.5 * f3 + 2 * f2 + 0.5 * f; out[3] = 0.5 * f3 - 0.5 * f2;
  return out;
}
// The grid's points with one more ring round the outside, carried on in a straight line, so the
// surface reaches the frame's edge with no flattening and an untouched grid stays exactly flat.
function padded(w) {
  const n = w.n, m = n + 2, P = new Float64Array(m * m * 2);
  const g = (i, j, c) => w.p[(i * n + j) * 2 + c];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let c = 0; c < 2; c++) P[((i + 1) * m + j + 1) * 2 + c] = g(i, j, c);
  for (let i = 1; i <= n; i++) for (let c = 0; c < 2; c++) {
    P[(i * m) * 2 + c] = 2 * P[(i * m + 1) * 2 + c] - P[(i * m + 2) * 2 + c];
    P[(i * m + m - 1) * 2 + c] = 2 * P[(i * m + m - 2) * 2 + c] - P[(i * m + m - 3) * 2 + c];
  }
  for (let j = 0; j < m; j++) for (let c = 0; c < 2; c++) {
    P[j * 2 + c] = 2 * P[(m + j) * 2 + c] - P[(2 * m + j) * 2 + c];
    P[((m - 1) * m + j) * 2 + c] = 2 * P[((m - 2) * m + j) * 2 + c] - P[((m - 3) * m + j) * 2 + c];
  }
  return { P, m };
}
// A function giving where the artwork's point (s, t), each 0..1, now sits: [x, y] in the frame.
export function warpFn(w) {
  if (!w) return (s, t) => [s, t];
  const n = w.n, { P, m } = padded(w), ws = [0, 0, 0, 0], wt = [0, 0, 0, 0];
  return (s, t) => {
    const fs = clamp(s, 0, 1) * (n - 1), ft = clamp(t, 0, 1) * (n - 1);
    const j = Math.min(n - 2, Math.floor(fs)), i = Math.min(n - 2, Math.floor(ft));
    crw(fs - j, ws); crw(ft - i, wt);
    let x = 0, y = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const k = ((i + a) * m + j + b) * 2, q = wt[a] * ws[b];
      x += P[k] * q; y += P[k + 1] * q;
    }
    return [x, y];
  };
}
export const warpAt = (w, s, t) => warpFn(w)(s, t);

// The box the warped artwork fills, in the frame's units: [x0, y0, x1, y1]. An untouched grid gives
// [0, 0, 1, 1].
export function warpBounds(w, samples = 40) {
  if (!w) return [0, 0, 1, 1];
  const f = warpFn(w);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i <= samples; i++) for (let j = 0; j <= samples; j++) {
    // the edges are where the box is decided: sample them finely, the inside more coarsely
    const edge = i === 0 || j === 0 || i === samples || j === samples;
    if (!edge && (i % 4 || j % 4)) continue;
    const [x, y] = f(j / samples, i / samples);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  // never a box of no size, which would make a picture of no size
  if (x1 - x0 < 0.02) { const c = (x0 + x1) / 2; x0 = c - 0.01; x1 = c + 0.01; }
  if (y1 - y0 < 0.02) { const c = (y0 + y1) / 2; y0 = c - 0.01; y1 = c + 0.01; }
  return [x0, y0, x1, y1];
}

// The same shape on a finer or coarser grid (the grid size changes, the artwork does not move).
export function regrid(w, n) {
  if (!WARP_SIZES.includes(n)) return w;
  const f = warpFn(w), p = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [x, y] = f(j / (n - 1), i / (n - 1)); p.push(x, y); }
  return { n, p };
}
export function movePoint(w, k, x, y) {
  const p = w.p.slice(); p[k * 2] = clamp(x, LIM[0], LIM[1]); p[k * 2 + 1] = clamp(y, LIM[0], LIM[1]);
  return { n: w.n, p };
}
// The four corner points' indexes, top left, top right, bottom right, bottom left.
export const cornerIndexes = (n) => [0, n - 1, n * n - 1, n * (n - 1)];

// A projective map (homography) taking the four points from[] to to[], as a 3x3 row by row.
export function homography(from, to) {
  // solve the 8 unknowns of h (h33 = 1) by Gaussian elimination
  const A = [], b = [];
  for (let k = 0; k < 4; k++) {
    const [x, y] = from[k], [u, v] = to[k];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c]; if (!k) continue;
      for (let q = c; q < 8; q++) A[r][q] -= k * A[c][q];
      b[r] -= k * b[c];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
export function applyH(H, x, y) {
  const d = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
}
// Distort: one corner moved to (x, y) and the whole picture carried with it in perspective, so what
// was drawn inside keeps its own bends. Returns the warp unchanged if the corners would cross.
export function distortCorner(w, corner, x, y) {
  const n = w.n, idx = cornerIndexes(n), from = idx.map((k) => [w.p[k * 2], w.p[k * 2 + 1]]);
  const to = from.map((q) => q.slice()); to[corner] = [clamp(x, LIM[0], LIM[1]), clamp(y, LIM[0], LIM[1])];
  if (!convexQuad(to)) return w;
  const H = homography(from, to); if (!H) return w;
  const p = w.p.slice();
  for (let k = 0; k < n * n; k++) { const [u, v] = applyH(H, w.p[k * 2], w.p[k * 2 + 1]); p[k * 2] = clamp(u, LIM[0], LIM[1]); p[k * 2 + 1] = clamp(v, LIM[0], LIM[1]); }
  for (let c = 0; c < 4; c++) { p[idx[c] * 2] = to[c][0]; p[idx[c] * 2 + 1] = to[c][1]; }
  return { n, p };
}
// Whether four points in order make a quadrilateral that does not fold over itself.
export function convexQuad(q) {
  let sign = 0;
  for (let k = 0; k < 4; k++) {
    const a = q[k], b = q[(k + 1) % 4], c = q[(k + 2) % 4];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-9) return false;
    if (!sign) sign = Math.sign(z); else if (Math.sign(z) !== sign) return false;
  }
  return true;
}
// Arc: the picture bent along a circle, its middle line keeping its length, like lettering set on
// an arch. amount -1..1 (1 is half a circle arching up, -1 half a circle sagging down). aspect is
// the tattoo's width over its height, so the bend is round on the skin and not stretched. Applied to
// a starting warp, so an arc can go over a shape already made.
export function arcWarp(base, amount, aspect) {
  // the full slider is the strongest arc that keeps the inside edge from folding through the middle
  // (its radius stays more than the picture's height), at most a half circle
  const asp = Math.max(0.05, aspect || 1), a = clamp(amount, -1, 1), A = a * Math.min(Math.PI, asp / 0.62), w = base || identityWarp(), n = w.n;
  if (Math.abs(A) < 1e-4) return { n, p: w.p.slice() };
  const R = asp / A, cx = asp / 2, cy = 0.5 + R, p = w.p.slice();
  for (let k = 0; k < n * n; k++) {
    const X = w.p[k * 2] * asp, Y = w.p[k * 2 + 1], phi = (X - cx) / R, r = R + (0.5 - Y);
    p[k * 2] = clamp((cx + r * Math.sin(phi)) / asp, LIM[0], LIM[1]); p[k * 2 + 1] = clamp(cy - r * Math.cos(phi), LIM[0], LIM[1]);
  }
  return { n, p };
}

// The warped picture, drawn pixel by pixel: src is { data (RGBA, not premultiplied), width,
// height }, out { width, height } covers the box [x0, y0, x1, y1] (in the frame's units). flipY reads
// the source bottom row first (a picture stored upside down). Returns the RGBA pixels. The grid is
// cut into small triangles, each filled by sampling the source between its corners' places in it.
export function renderWarp(src, w, out, box, { flipY = false, steps = 0 } = {}) {
  const OW = out.width | 0, OH = out.height | 0, D = new Uint8ClampedArray(OW * OH * 4);
  const SW = src.width, SH = src.height, S = src.data, f = warpFn(w);
  const [x0, y0, x1, y1] = box, kx = OW / (x1 - x0), ky = OH / (y1 - y0);
  const G = steps || Math.max(12, Math.min(48, (w ? w.n - 1 : 1) * 10));
  // the grid's corners on the output, in pixels
  const gx = new Float64Array((G + 1) * (G + 1)), gy = new Float64Array((G + 1) * (G + 1));
  for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) { const [x, y] = f(j / G, i / G), k = i * (G + 1) + j; gx[k] = (x - x0) * kx; gy[k] = (y - y0) * ky; }
  const sample = (s, t, o) => {
    // bilinear, with colours weighted by how solid each pixel is so see-through edges do not darken
    const fx = clamp(s * SW - 0.5, 0, SW - 1), fy = clamp((flipY ? 1 - t : t) * SH - 0.5, 0, SH - 1);
    const ix = Math.min(SW - 2, Math.floor(fx)), iy = Math.min(SH - 2, Math.floor(fy)), rx = SW > 1 ? fx - ix : 0, ry = SH > 1 ? fy - iy : 0;
    const a = (Math.max(0, iy) * SW + Math.max(0, ix)) * 4, b = a + (SW > 1 ? 4 : 0), c = a + (SH > 1 ? SW * 4 : 0), d = c + (SW > 1 ? 4 : 0);
    const wa = (1 - rx) * (1 - ry) * S[a + 3], wb = rx * (1 - ry) * S[b + 3], wc = (1 - rx) * ry * S[c + 3], wd = rx * ry * S[d + 3], al = wa + wb + wc + wd;
    if (al <= 0) return;
    D[o] = (S[a] * wa + S[b] * wb + S[c] * wc + S[d] * wd) / al; D[o + 1] = (S[a + 1] * wa + S[b + 1] * wb + S[c + 1] * wc + S[d + 1] * wd) / al;
    D[o + 2] = (S[a + 2] * wa + S[b + 2] * wb + S[c + 2] * wc + S[d + 2] * wd) / al; D[o + 3] = al;
  };
  const tri = (ax, ay, as, at, bx, by, bs, bt, cx, cy, cs, ct) => {
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) return;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(OW - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(OH - 1, Math.ceil(Math.max(ay, by, cy)));
    // half a pixel of overlap between neighbours, so no pixel on a shared edge is left out
    const ad = Math.abs(den), e1 = -0.5 * Math.hypot(bx - cx, by - cy) / ad, e2 = -0.5 * Math.hypot(cx - ax, cy - ay) / ad, e3 = -0.5 * Math.hypot(ax - bx, ay - by) / ad;
    for (let py = minY; py <= maxY; py++) {
      const yy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const xx = px + 0.5;
        const l1 = ((by - cy) * (xx - cx) + (cx - bx) * (yy - cy)) / den, l2 = ((cy - ay) * (xx - cx) + (ax - cx) * (yy - cy)) / den, l3 = 1 - l1 - l2;
        if (l1 < e1 || l2 < e2 || l3 < e3) continue;
        sample(l1 * as + l2 * bs + l3 * cs, l1 * at + l2 * bt + l3 * ct, (py * OW + px) * 4);
      }
    }
  };
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const k = i * (G + 1) + j, s0 = j / G, s1 = (j + 1) / G, t0 = i / G, t1 = (i + 1) / G;
    const a = k, b = k + 1, c = k + G + 1, d = k + G + 2;
    tri(gx[a], gy[a], s0, t0, gx[b], gy[b], s1, t0, gx[d], gy[d], s1, t1);
    tri(gx[a], gy[a], s0, t0, gx[d], gy[d], s1, t1, gx[c], gy[c], s0, t1);
  }
  return D;
}

// How big a warped picture should be drawn: the source's own detail across the warped box, capped.
// aspect is the tattoo's width over its height. Returns { width, height, aspect } with aspect the
// picture's own width over height.
export function warpCanvasSize(box, aspect, srcW, max = 1024) {
  const bw = box[2] - box[0], bh = box[3] - box[1], asp = (bw * aspect) / bh;
  let W = Math.max(16, Math.min(max, Math.round(srcW * bw)));
  let H = Math.round(W / asp);
  if (H > max) { H = max; W = Math.max(16, Math.round(H * asp)); }
  return { width: W, height: Math.max(8, H), aspect: asp };
}

// A few words for the edit sheet's line: how far the shape is from the drawing.
export function describeWarp(w) {
  if (!w) return '';
  const n = w.n; let worst = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = (i * n + j) * 2; worst = Math.max(worst, Math.hypot(w.p[k] - j / (n - 1), w.p[k + 1] - i / (n - 1))); }
  return worst < 0.05 ? 'Slightly warped' : worst < 0.2 ? 'Warped' : 'Strongly warped';
}
