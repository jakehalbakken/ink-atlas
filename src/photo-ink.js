// Tattoos already on you, found in a photo of you (pure maths, no DOM).
//
// findInk: in a photo with the person's outline (mask) and pose landmarks, ink is skin that is much
// darker, or much more coloured, than the skin around it. The skin around each pixel is a wide
// blur of the skin-like pixels only, so soft shading and light falling across the body are part of
// the reference and don't count as ink. Ink pixels are joined across small gaps (linework becomes
// one piece), small specks are dropped, and a piece only counts when the pixels around it are
// mostly skin (a dark shirt, hair or the background is not a tattoo). Pieces close together are
// one design.
//
// cutPiece: the piece as artwork on white: each pixel divided by the skin under it, so the ink's
// own colour and strength stay and the skin drops out (the app draws ink by multiplying it with
// the 3D skin, which puts the same skin back).
//
// inkMapper: where a point of the photo is on the 3D body. Points on the torso go through a fit of
// the shoulders and hips; points on an arm or leg go along that limb, from joint to joint, so a
// raised or bent arm in the photo still lands on the right part of the arm.

export const SHARP = 0.22;
// The darkest tenth of a piece must be at most this share of the skin's brightness.
export const DARK = 0.6;
// Below this shoulder width in pixels the person is too small in the photo to tell ink from
// body hair and shading, so nothing is looked for.
export const MIN_SW = 140;
const LUM = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const skinLike = (r, g, b) => r >= g - 6 && r - b > 8 && LUM(r, g, b) > 30 && LUM(r, g, b) < 252;

// a weighted box blur in place: values v, weights wt, radius r (both blurred, then divided)
function boxBlur(a, w, h, r) {
  const tmp = new Float32Array(Math.max(w, h));
  for (let pass = 0; pass < 2; pass++) {
    const horiz = pass === 0, n = horiz ? w : h, m = horiz ? h : w;
    for (let j = 0; j < m; j++) {
      const at = (i) => (horiz ? j * w + i : i * w + j);
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[at(Math.max(0, Math.min(n - 1, i)))];
      for (let i = 0; i < n; i++) { tmp[i] = s / (2 * r + 1); s += a[at(Math.min(n - 1, i + r + 1))] - a[at(Math.max(0, i - r))]; }
      for (let i = 0; i < n; i++) a[at(i)] = tmp[i];
    }
  }
}
function dilate(on, w, h, r) {
  if (r < 1) return on;
  const a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = on[i];
  boxBlur(a, w, h, r);
  const out = new Uint8Array(w * h); for (let i = 0; i < a.length; i++) out[i] = a[i] > 1e-4 ? 1 : 0;
  return out;
}
function erode(on, w, h, r) {
  if (r < 1) return on;
  const a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = on[i];
  boxBlur(a, w, h, r);
  const out = new Uint8Array(w * h); for (let i = 0; i < a.length; i++) out[i] = a[i] > 1 - 1e-4 ? 1 : 0;
  return out;
}

// pixels: RGBA, mask: person 0..1 (w*h), lm: pose landmarks (normalised x, y). Returns
// { pieces: [{ x0, y0, x1, y1, cx, cy, area, ids }], ref } where ref is the skin colour under each
// pixel (RGB, w*h*3) for cutPiece. Pieces are biggest first, at most `max`.
export function findInk(pixels, mask, w, h, lm, { max = 8 } = {}) {
  const sl = lm[11], sr = lm[12];
  const sw = Math.max(20, Math.hypot((sl.x - sr.x) * w, (sl.y - sr.y) * h)); // shoulder width, px
  if (sw < MIN_SW) return { pieces: [], ref: null, sw, small: true };
  const neckY = ((sl.y + sr.y) / 2) * h - 0.3 * sw; // the head and hair above here are left out
  const n = w * h, body = new Uint8Array(n);
  for (let y = Math.max(0, Math.ceil(neckY)); y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; body[i] = mask[i] >= 0.5 ? 1 : 0; }
  // hands and feet (the gaps between fingers and toes read as dark lines) and between the legs
  // are left out too
  const vis = (i) => lm[i] && (lm[i].visibility ?? 1) >= 0.5;
  const px = (i) => [lm[i].x * w, lm[i].y * h];
  const cutBeyond = (a, b, r) => {
    if (!vis(a) || !vis(b)) return;
    const [ax, ay] = px(a), [bx, by] = px(b), dl = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / dl, dy = (by - ay) / dl;
    for (let y = Math.max(0, Math.floor(by - r)); y < Math.min(h, by + r); y++) for (let x = Math.max(0, Math.floor(bx - r)); x < Math.min(w, bx + r); x++) {
      if (Math.hypot(x - bx, y - by) < r && (x - bx) * dx + (y - by) * dy > -0.03 * sw) body[y * w + x] = 0;
    }
  };
  cutBeyond(13, 15, 0.6 * sw); cutBeyond(14, 16, 0.6 * sw); cutBeyond(25, 27, 0.5 * sw); cutBeyond(26, 28, 0.5 * sw);
  if (vis(23) && vis(24)) {
    const mx = (lm[23].x + lm[24].x) * w / 2, my = (lm[23].y + lm[24].y) * h / 2;
    for (let y = Math.max(0, Math.floor(my - 0.02 * sw)); y < Math.min(h, my + 0.5 * sw); y++) for (let x = Math.max(0, Math.floor(mx - 0.17 * sw)); x < Math.min(w, mx + 0.17 * sw); x++) body[y * w + x] = 0;
  }
  const R = Math.max(6, Math.round(sw * 0.07));
  // the skin around each pixel: twice, the second time without what the first called ink
  const ref = new Float32Array(n * 3), wt = new Float32Array(n), ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  let ink = new Uint8Array(n);
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < n; i++) {
      const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
      const k = body[i] && !ink[i] && skinLike(r, g, b) ? 1 : 0;
      wt[i] = k; ch[0][i] = r * k; ch[1][i] = g * k; ch[2][i] = b * k;
    }
    boxBlur(wt, w, h, R); for (const c of ch) boxBlur(c, w, h, R);
    for (let i = 0; i < n; i++) { const d = wt[i]; for (let c = 0; c < 3; c++) ref[i * 3 + c] = d > 0.02 ? ch[c][i] / d : NaN; }
    ink = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (!body[i] || !(ref[i * 3] > 0)) continue;
      const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2], L = LUM(r, g, b);
      const Lr = LUM(ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2]);
      const dark = L < 0.78 * Lr;
      // coloured ink: far from the skin's colour once brightness is taken out
      const s = Lr / Math.max(1, L), dc = Math.hypot(r * s - ref[i * 3], g * s - ref[i * 3 + 1], b * s - ref[i * 3 + 2]);
      ink[i] = dark ? 1 : L < 0.95 * Lr && dc > 70 ? 2 : 0;
    }
  }
  const lum = new Float32Array(n); for (let i = 0; i < n; i++) lum[i] = LUM(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]);
  // join linework across small gaps, then find the separate pieces
  const gap = Math.max(1, Math.round(sw * 0.012));
  const closed = erode(dilate(ink, w, h, gap), w, h, gap);
  for (let i = 0; i < n; i++) closed[i] = closed[i] && body[i] ? 1 : 0;
  const label = new Int32Array(n).fill(-1), comps = [], stack = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (!closed[s0] || label[s0] >= 0) continue;
    const c = { x0: w, y0: h, x1: -1, y1: -1, area: 0, ids: [] }; label[s0] = comps.length; stack.push(s0);
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i - x) / w;
      c.area++; c.ids.push(i); if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && closed[j] && label[j] < 0) { label[j] = comps.length; stack.push(j); }
    }
    comps.push(c);
  }
  // keep pieces big enough to be a tattoo, with skin around them
  const minArea = (sw * 0.035) ** 2, ring = Math.max(2, Math.round(sw * 0.03));
  const kept = [];
  for (const c of comps) {
    if (c.area < minArea * 0.25) continue;
    let skin = 0, all = 0;
    const x0 = Math.max(0, c.x0 - ring), x1 = Math.min(w - 1, c.x1 + ring), y0 = Math.max(0, c.y0 - ring), y1 = Math.min(h - 1, c.y1 + ring);
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
      // only the band just outside the bounding box
      if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) continue;
      const i = y * w + x; all++;
      if (body[i] && !closed[i] && skinLike(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2])) skin++;
    }
    if (!(all && skin / all >= 0.55)) continue;
    // ink has crisp edges; a shadow (an armpit, under the chest, a crease) fades in. Edge
    // steepness at the piece's border against how much darker the piece is than the skin.
    let grad = 0, nb = 0, depth = 0, nd = 0;
    for (const i of c.ids) {
      const x = i % w, y = (i - x) / w;
      if (ink[i]) { depth += LUM(ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2]) - lum[i]; nd++; }
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      if (closed[i - 1] && closed[i + 1] && closed[i - w] && closed[i + w]) continue;
      grad += Math.max(Math.abs(lum[i + 1] - lum[i - 1]), Math.abs(lum[i + w] - lum[i - w])) / 2; nb++;
    }
    c.sharp = nb && nd && depth > 0 ? (grad / nb) / (depth / nd) : 0;
    if (c.sharp >= SHARP) kept.push(c);
  }
  // pieces close together are parts of one design
  const near = sw * 0.06;
  let merged = true;
  while (merged) {
    merged = false;
    for (let a = 0; a < kept.length && !merged; a++) for (let b = a + 1; b < kept.length; b++) {
      const A = kept[a], B = kept[b];
      const dx = Math.max(0, Math.max(A.x0, B.x0) - Math.min(A.x1, B.x1)), dy = Math.max(0, Math.max(A.y0, B.y0) - Math.min(A.y1, B.y1));
      if (Math.hypot(dx, dy) > near) continue;
      Object.assign(A, { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1), area: A.area + B.area, ids: A.ids.concat(B.ids) });
      kept.splice(b, 1); merged = true; break;
    }
  }
  for (const c of kept) {
    const rs = []; let col = 0;
    for (const i of c.ids) if (ink[i]) { rs.push(lum[i] / Math.max(1, LUM(ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2]))); if (ink[i] === 2) col++; }
    c.col = rs.length ? col / rs.length : 0;
    rs.sort((a, b) => a - b);
    c.dark = rs.length ? rs[Math.floor(rs.length * 0.1)] : 1; c.mid = rs.length ? rs[Math.floor(rs.length * 0.5)] : 1;
    c.fill = c.area / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1));
    // what is just outside the ink itself: skin, clothing or the background
    const d = Math.max(2, Math.round(sw * 0.02)), dirs = [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, d], [d, -d], [-d, -d]];
    let near = 0, cloth = 0, out = 0;
    for (const i of c.ids) {
      const x = i % w, y = (i - x) / w;
      for (const [ox, oy] of dirs) {
        const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= w || Y >= h) { near++; out++; continue; }
        const j = Y * w + X; if (closed[j]) continue;
        near++; if (!body[j]) out++; else if (!skinLike(pixels[j * 4], pixels[j * 4 + 1], pixels[j * 4 + 2])) cloth++;
      }
    }
    c.cloth = near ? cloth / near : 0; c.out = near ? out / near : 0;
  }
  // what is left too small to be a tattoo (a mole, a freckle, a dimple's shadow) goes, and so
  // does what is only a little darker than the skin (body hair, a fold's shading) unless it is
  // coloured, and what lies along the outline of the body or the edge of clothing (a shadow
  // under a sleeve or an arm). Measured on real photos: those finds were all at least 0.6 of
  // the skin's brightness even at their darkest, and black ink is far below that.
  const big = kept.filter((c) => c.area >= minArea && Math.max(c.x1 - c.x0, c.y1 - c.y0) >= 0.07 * sw
    && (c.dark <= DARK || c.col >= 0.5) && c.out <= 0.3 && c.cloth <= 0.15);
  const pieces = big.sort((a, b) => b.area - a.area).slice(0, max).map((c) => ({ ...c, cx: (c.x0 + c.x1 + 1) / 2, cy: (c.y0 + c.y1 + 1) / 2 }));
  return { pieces, ref, sw };
}

// The piece as artwork: RGBA (w*h*4) of its box with a margin, ink divided by the skin under
// it on white. Pixels away from the piece are white. Returns { w, h, pixels, x0, y0 }.
export function cutPiece(pixels, w, h, piece, ref, sw) {
  const pad = Math.max(3, Math.round(sw * 0.02));
  const x0 = Math.max(0, piece.x0 - pad), y0 = Math.max(0, piece.y0 - pad), x1 = Math.min(w - 1, piece.x1 + pad), y1 = Math.min(h - 1, piece.y1 + pad);
  const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
  // where the piece is, widened a little so the soft edge of each line comes with it
  const on = new Uint8Array(cw * chh);
  for (const i of piece.ids) { const x = i % w, y = (i - x) / w; on[(y - y0) * cw + (x - x0)] = 1; }
  const near = dilate(on, cw, chh, Math.max(1, Math.round(sw * 0.006)));
  const out = new Uint8ClampedArray(cw * chh * 4);
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
    const o = y * cw + x, i = (y + y0) * w + (x + x0);
    out[o * 4 + 3] = 255;
    let v = [255, 255, 255];
    if (near[o] && ref[i * 3] > 0) {
      v = [0, 1, 2].map((c) => Math.min(255, (255 * pixels[i * 4 + c]) / Math.max(1, ref[i * 3 + c])));
      // nearly skin is skin: no grey haze round the ink
      const m = Math.min(v[0], v[1], v[2]);
      if (m > 225) v = [255, 255, 255]; else if (m > 195) { const t = (m - 195) / 30; v = v.map((c) => c + (255 - c) * t); }
    }
    out[o * 4] = v[0]; out[o * 4 + 1] = v[1]; out[o * 4 + 2] = v[2];
  }
  return { w: cw, h: chh, pixels: out, x0, y0 };
}

// Flip a photo's reading left to right: for a mirror selfie, where the photo shows you the other
// way round. Landmarks swap sides, pieces and their artwork flip.
export const MIRROR_PAIRS = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];
export function mirrorLandmarks(lm) {
  const out = lm.map((p) => ({ ...p, x: 1 - p.x }));
  for (const [a, b] of MIRROR_PAIRS) if (out[a] && out[b]) [out[a], out[b]] = [out[b], out[a]];
  return out;
}
export function mirrorArt(art) {
  const { w, h, pixels } = art, out = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4; for (let c = 0; c < 4; c++) out[a + c] = pixels[b + c]; }
  return { ...art, pixels: out };
}

// photo point (px) to the body's plane as seen from the front or back. lm: landmarks
// (normalised), w, h: photo size, joints: { [landmark number]: [X, Y] } of the 3D body (x to its
// left, y up), view: 'front' or 'back'. Returns (x, y) => { x, y, k, up: [dx, dy] } or null when
// the photo shows too little: k is body units per photo pixel, up is the photo's up on the body.
const LIMBS = [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]];
export function inkMapper(lm, w, h, joints, view) {
  const seen = (i) => lm[i] && (lm[i].visibility ?? 1) >= 0.5 && joints[i];
  const P = (i) => [lm[i].x * w, lm[i].y * h];
  // the photo is y down; seen from the front the body's x runs the same way as the photo's, so
  // photo to body is a reflection; from the back it is a turn
  const reflect = view !== 'back';
  // a similarity (turn, scale, maybe reflect) that takes photo a->A and b->B, as complex numbers
  const sim = (a, b, A, B) => {
    const p = [b[0] - a[0], b[1] - a[1]], q = [B[0] - A[0], B[1] - A[1]], pp = p[0] * p[0] + p[1] * p[1];
    if (pp < 1) return null;
    const pc = reflect ? [p[0], -p[1]] : p; // conj(p) when reflecting
    // m = q / pc
    const m = [(q[0] * pc[0] + q[1] * pc[1]) / pp, (q[1] * pc[0] - q[0] * pc[1]) / pp];
    return (x, y) => {
      let d = [x - a[0], y - a[1]]; if (reflect) d = [d[0], -d[1]];
      return [A[0] + d[0] * m[0] - d[1] * m[1], A[1] + d[0] * m[1] + d[1] * m[0]];
    };
  };
  // torso: an affine fit to the shoulders and hips when all four are seen, else the shoulders
  let torso = null, torsoPoly = null;
  const T = [11, 12, 24, 23].filter(seen);
  if (T.length === 4) {
    // least squares affine: [X Y] = [x y 1] M
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
    for (const i of T) { const [x, y] = P(i), r = [x, y, 1]; for (let a = 0; a < 3; a++) { for (let b = 0; b < 3; b++) A[a][b] += r[a] * r[b]; bx[a] += r[a] * joints[i][0]; by[a] += r[a] * joints[i][1]; } }
    const solve = (M, v) => { // 3x3 by Cramer's rule
      const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      const D = det(M); if (Math.abs(D) < 1e-9) return null;
      return [0, 1, 2].map((c) => det(M.map((row, r) => row.map((x, k) => (k === c ? v[r] : x)))) / D);
    };
    const mx = solve(A, bx), my = solve(A, by);
    if (mx && my) torso = (x, y) => [mx[0] * x + mx[1] * y + mx[2], my[0] * x + my[1] * y + my[2]];
    torsoPoly = T.map(P);
  } else if (seen(11) && seen(12)) torso = sim(P(11), P(12), joints[11], joints[12]);
  const sw = seen(11) && seen(12) ? Math.hypot(...[0, 1].map((k) => P(11)[k] - P(12)[k])) : NaN;
  const inside = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const limbs = LIMBS.filter(([a, b]) => seen(a) && seen(b)).map(([a, b]) => ({ a: P(a), b: P(b), f: sim(P(a), P(b), joints[a], joints[b]) })).filter((l) => l.f);
  if (!torso && !limbs.length) return null;
  const pick = (x, y) => {
    if (torsoPoly && inside(x, y, torsoPoly)) return torso;
    let best = null, bd = Infinity;
    for (const l of limbs) {
      const d = [l.b[0] - l.a[0], l.b[1] - l.a[1]], t = Math.max(0, Math.min(1, ((x - l.a[0]) * d[0] + (y - l.a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1])));
      const e = Math.hypot(x - l.a[0] - t * d[0], y - l.a[1] - t * d[1]);
      if (e < bd) { bd = e; best = l.f; }
    }
    // far from every limb: the torso's fit (the chest of an upper body photo, the sides)
    if (torso && (!best || !(bd < 0.3 * (sw || Infinity)))) return torso;
    return best || torso;
  };
  return (x, y) => {
    const f = pick(x, y); if (!f) return null;
    const c = f(x, y), r = f(x + 1, y), u = f(x, y - 1);
    const k = Math.sqrt(Math.abs((r[0] - c[0]) * (u[1] - c[1]) - (r[1] - c[1]) * (u[0] - c[0])));
    return { x: c[0], y: c[1], k, up: [u[0] - c[0], u[1] - c[1]] };
  };
}
