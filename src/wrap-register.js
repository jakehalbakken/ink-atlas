// Registering a photo of a tattoo already on the skin onto a measured wrap: straightening the photo
// (a four-corner perspective correction), its scale from one known length, its turn and place from
// matched landmarks, and where a direction round the limb falls across the flat template.
// Pure maths, no DOM, so every step can be tested.

// --- perspective: the 3x3 matrix taking four source points to four target points ---
function solve8(A, b) {
  const n = 8, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
// src, dst: four [x, y] each. Returns h (9 numbers, row major) with dst ~ h * src, or null.
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const s = solve8(A, b); return s ? [...s, 1] : null;
}
export function applyH(h, x, y) { const w = h[6] * x + h[7] * y + h[8]; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; }
export function invertH(h) {
  const [a, b, c, d, e, f, g, k, l] = h;
  const A = e * l - f * k, B = -(d * l - f * g), C = d * k - e * g, det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-15) return null;
  return [A / det, -(b * l - c * k) / det, (b * f - c * e) / det, B / det, (a * l - c * g) / det, -(a * f - c * d) / det, C / det, -(a * k - b * g) / det, (a * e - b * d) / det];
}
// The straightened picture for a quad (top left, top right, bottom right, bottom left) on the
// photo: its size is the average of the quad's opposite sides, so a photo taken square on comes
// out unchanged. Returns { w, h, H (photo -> straight), Hi (straight -> photo) } or null.
export function straighten(quad, maxSide = 2400) {
  if (!Array.isArray(quad) || quad.length !== 4) return null;
  const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  let w = (d(quad[0], quad[1]) + d(quad[3], quad[2])) / 2, h = (d(quad[0], quad[3]) + d(quad[1], quad[2])) / 2;
  if (!(w > 2 && h > 2)) return null;
  const s = Math.min(1, maxSide / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
  const H = homography(quad, [[0, 0], [w, 0], [w, h], [0, h]]); if (!H) return null;
  const Hi = invertH(H); if (!Hi) return null;
  return { w, h, H, Hi };
}
// A quad must be a proper four-sided shape that does not cross itself.
export function quadOk(q) {
  if (!Array.isArray(q) || q.length !== 4 || !q.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4], z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-9) return false; const s = Math.sign(z); if (sign && s !== sign) return false; sign = s;
  }
  return true;
}

// --- placing a straightened photo on the template ---
// fit: { x, y (template mm of the picture's centre), mmPerPx, rot (degrees), flip }, picture w x h.
// Picture rows run down, the template's y runs up.
export function photoToTemplate(fit, w, h, px, py) {
  let dx = (px - w / 2) * fit.mmPerPx, dy = -(py - h / 2) * fit.mmPerPx; if (fit.flip) dx = -dx;
  const a = (fit.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [fit.x + dx * c - dy * s, fit.y + dx * s + dy * c];
}
export function templateToPhoto(fit, w, h, x, y) {
  const a = -(fit.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), X = x - fit.x, Y = y - fit.y;
  let dx = X * c - Y * s; const dy = X * s + Y * c; if (fit.flip) dx = -dx;
  return [dx / fit.mmPerPx + w / 2, -dy / fit.mmPerPx + h / 2];
}
// Scale from one known length between two picture points (e.g. the top of the cactus and the
// bottom of its stone base, 101.6 mm apart), and the turn and place that put `a` at `atA` with the
// line from a to b pointing straight up the template (the length of the limb).
export function calibrate(w, h, a, b, knownMm, atA, flip = false) {
  const dpx = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!(dpx > 1) || !(knownMm > 0)) return null;
  const mmPerPx = knownMm / dpx;
  // direction a->b on the template before any turn (rows down -> y up, mirrored if flipped)
  const vx = (flip ? -1 : 1) * (b[0] - a[0]), vy = -(b[1] - a[1]);
  const rot = 90 - Math.atan2(vy, vx) * 180 / Math.PI;
  const fit = { x: 0, y: 0, mmPerPx, rot: ((rot % 360) + 540) % 360 - 180, flip: !!flip };
  const p = photoToTemplate(fit, w, h, a[0], a[1]);
  fit.x = atA[0] - p[0]; fit.y = atA[1] - p[1];
  return fit;
}
// The best scale, turn and place (a similarity, no stretch) taking picture points to template
// points, from two or more matched landmarks. With `lockScale` the scale is kept as given (a
// physical calibration is not overruled by where landmarks were tapped). Returns fit and the
// largest leftover miss in mm, or null with fewer than two pairs.
export function fitLandmarks(w, h, pairs, { flip = false, lockScale = null } = {}) {
  if (!pairs || pairs.length < 2) return null;
  const P = pairs.map(([s]) => [(flip ? -1 : 1) * (s[0] - w / 2), -(s[1] - h / 2)]), Q = pairs.map(([, t]) => t);
  const n = P.length, mp = [0, 0], mq = [0, 0];
  for (let i = 0; i < n; i++) { mp[0] += P[i][0] / n; mp[1] += P[i][1] / n; mq[0] += Q[i][0] / n; mq[1] += Q[i][1] / n; }
  let sxx = 0, sxy = 0, pp = 0;
  for (let i = 0; i < n; i++) {
    const px = P[i][0] - mp[0], py = P[i][1] - mp[1], qx = Q[i][0] - mq[0], qy = Q[i][1] - mq[1];
    sxx += px * qx + py * qy; sxy += px * qy - py * qx; pp += px * px + py * py;
  }
  if (!(pp > 1e-9)) return null;
  const ang = Math.atan2(sxy, sxx), scale = lockScale || Math.hypot(sxx, sxy) / pp, c = Math.cos(ang), s = Math.sin(ang);
  const fit = { mmPerPx: scale, rot: ang * 180 / Math.PI, flip: !!flip, x: mq[0] - scale * (mp[0] * c - mp[1] * s), y: mq[1] - scale * (mp[0] * s + mp[1] * c) };
  let miss = 0; for (const [sp, t] of pairs) { const q = photoToTemplate(fit, w, h, sp[0], sp[1]); miss = Math.max(miss, Math.hypot(q[0] - t[0], q[1] - t[1])); }
  return { fit, miss };
}

// --- round the limb ---
// Directions round an arm or leg in degrees: 0 the inside, 90 the front, 180 the outside, 270 the
// back. The template is the skin seen from outside, cut along `seam`, with the side opposite the
// cut in the middle. On a right limb, going right on the template turns from the outside towards
// the front only when seen from the outside: sgn handles that, so the flat art is never mirrored.
export const limbSign = (limb) => (/R$/.test(limb) ? -1 : 1);
export function fAt(deg, seam, limb) { const d = (((deg - seam - 180) % 360) + 540) % 360 - 180; return limbSign(limb) * d / 360; }
export function degAt(f, seam, limb) { return (((seam + 180 + limbSign(limb) * f * 360) % 360) + 360) % 360; }

// Landmarks Jake asked for on the cactus, in the order they are placed.
export const LANDMARKS = [
  { key: 'top', name: 'Topmost flower' },
  { key: 'base', name: 'Bottom of the stone base' },
  { key: 'left', name: 'Leftmost arm' },
  { key: 'right', name: 'Rightmost arm' },
  { key: 'j1', name: 'Trunk and arm join 1' },
  { key: 'j2', name: 'Trunk and arm join 2' },
];

// --- masks on a grid: distance (in cells) from the nearest set cell, two-pass chamfer 3-4 ---
export function distanceField(mask, w, h) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : INF;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i]; if (!v) continue;
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) { v = Math.min(v, d[i - w] + 3); if (x > 0) v = Math.min(v, d[i - w - 1] + 4); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i]; if (!v) continue;
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 3); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4); if (x > 0) v = Math.min(v, d[i + w - 1] + 4); }
    d[i] = v;
  }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}
// The bare skin held between pieces of ink: what closing the ink (grow by r cells, then shrink
// back) adds. For a cactus drawn as floating sections, that is the gaps between the sections.
export function gapsBetween(ink, w, h, r) {
  const out = distanceField(ink, w, h), grown = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) grown[i] = out[i] <= r ? 1 : 0;
  const notGrown = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) notGrown[i] = grown[i] ? 0 : 1;
  const back = distanceField(notGrown, w, h), gap = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) gap[i] = !ink[i] && back[i] > r ? 1 : 0;
  return gap;
}
