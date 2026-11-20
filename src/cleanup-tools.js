// Picture maths for the Clean up toolbox (pure, no DOM): brushes on a per-stroke coverage mask
// (erase, restore, clone, heal), the magic wand and selection edits (grow, similar, shift edge, smooth,
// feather), one-tap background removal, and adjustments (brightness and contrast, levels, curves,
// threshold, sharpen, blur). Pictures are RGBA Uint8ClampedArray rows; masks are Uint8Array, one byte
// a pixel, 0 to 255, where values between are a soft (feathered) selection. Written for Ink Atlas; the
// tool set follows Photoshop and miniPaint, but no code is copied from either.

const okSize = (w, h) => Number.isInteger(w) && Number.isInteger(h) && w >= 1 && h >= 1 && w <= 4096 && h <= 4096;
const need = (data, w, h) => { if (!okSize(w, h) || (data && data.length !== w * h * 4)) throw new Error('Invalid picture size'); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- brushes
// A stroke keeps the picture from before it (`base`) and a coverage mask that only ever grows (the
// most any dab has covered each pixel). The picture is worked out again from those two, so going over
// the same spot twice in one stroke never goes past the stroke's opacity, as in Photoshop.

// Add one round dab to the coverage. `feather` 0 is a hard edge, 1 is soft from the middle out.
// Returns the box it touched, or null when it falls outside the picture.
export function dabCoverage(cov, w, h, cx, cy, radius, feather = 0) {
  if (!okSize(w, h) || cov.length !== w * h || ![cx, cy, radius, feather].every(Number.isFinite) || radius <= 0) throw new Error('Invalid brush dab');
  const x0 = Math.max(0, Math.floor(cx - radius)), y0 = Math.max(0, Math.floor(cy - radius)), x1 = Math.min(w, Math.ceil(cx + radius)), y1 = Math.min(h, Math.ceil(cy + radius));
  if (x1 <= x0 || y1 <= y0) return null;
  const f = clamp(feather, 0, 1), inner = radius * (1 - f), r2 = radius * radius;
  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx, d2 = dx * dx + dy * dy; if (d2 >= r2) continue;
      let v = 255; const d = Math.sqrt(d2);
      if (d > inner) v = Math.round(255 * smooth((radius - d) / Math.max(1e-6, radius - inner)));
      else if (f === 0 && d > radius - 1) v = Math.round(255 * clamp(radius - d, 0, 1)); // a one-pixel smoothed rim
      const i = y * w + x; if (v > cov[i]) cov[i] = v;
    }
  }
  return { x0, y0, x1, y1 };
}

// Every dab along a segment, spaced a quarter of the brush apart. Returns the union box or null.
export function strokeCoverage(cov, w, h, a, b, radiusA, radiusB = radiusA, feather = 0) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(dist / Math.max(0.5, Math.min(radiusA, radiusB) / 2)));
  let box = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, r = radiusA + (radiusB - radiusA) * t, d = dabCoverage(cov, w, h, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r, feather);
    if (d) box = box ? { x0: Math.min(box.x0, d.x0), y0: Math.min(box.y0, d.y0), x1: Math.max(box.x1, d.x1), y1: Math.max(box.y1, d.y1) } : d;
  }
  return box;
}

// Mix two pixels in premultiplied alpha, so a clear pixel's colour never bleeds in.
const mixInto = (out, i, A, j, B, k, t) => {
  const a = A[j + 3] / 255, b = B[k + 3] / 255, alpha = a * (1 - t) + b * t;
  if (alpha <= 0) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; return; }
  for (let c = 0; c < 3; c++) out[i + c] = Math.round((A[j + c] * a * (1 - t) + B[k + c] * b * t) / alpha);
  out[i + 3] = Math.round(alpha * 255);
};

// Work out the pixels inside `box` from the stroke's start picture and its coverage.
// kind 'erase': less alpha. 'restore': back towards `orig` (the picture as it was first opened).
// 'clone': copies `src` from `offset` pixels away. 'heal': the same, matched to the colour and light
// round each pixel (`lowBase` and `lowSrc` are blurred copies of base and src).
// `sel`, when given, limits the change to the selection (soft selections give a partial change).
export function compositeBrush(out, base, cov, w, h, box, opts = {}) {
  const { kind = 'erase', opacity = 1, sel = null, orig = null, src = null, offset = { x: 0, y: 0 }, lowBase = null, lowSrc = null } = opts;
  if (!box) return out;
  const op = clamp(opacity, 0, 1), ox = Math.round(offset.x), oy = Math.round(offset.y), tmp = new Uint8ClampedArray(4);
  for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) {
    const p = y * w + x, i = p * 4; let t = cov[p] / 255 * op; if (sel) t *= sel[p] / 255;
    if (t <= 0) { out[i] = base[i]; out[i + 1] = base[i + 1]; out[i + 2] = base[i + 2]; out[i + 3] = base[i + 3]; continue; }
    if (kind === 'erase') { out[i] = base[i]; out[i + 1] = base[i + 1]; out[i + 2] = base[i + 2]; out[i + 3] = Math.round(base[i + 3] * (1 - t)); continue; }
    if (kind === 'restore') { mixInto(out, i, base, i, orig, i, t); continue; }
    const sx = x - ox, sy = y - oy;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) { out[i] = base[i]; out[i + 1] = base[i + 1]; out[i + 2] = base[i + 2]; out[i + 3] = base[i + 3]; continue; }
    const j = (sy * w + sx) * 4;
    if (kind === 'clone') { mixInto(out, i, base, i, src, j, t); continue; }
    // heal: the source's detail on the destination's own colour and light
    for (let c = 0; c < 4; c++) tmp[c] = src[j + c] + (lowBase[i + c] - lowSrc[j + c]);
    mixInto(out, i, base, i, tmp, 0, t);
  }
  return out;
}

// ---------------------------------------------------------------- blur
// Three box blurs in a row look like a Gaussian. Colour is blurred premultiplied, so clear pixels
// never darken an edge. Radius in pixels; 0 returns a copy.
function boxPass(src, dst, w, h, r, ch, horizontal) {
  const div = 2 * r + 1;
  if (horizontal) {
    const last = w - 1, acc = new Float64Array(ch);
    for (let y = 0; y < h; y++) {
      const start = y * w * ch;
      for (let c = 0; c < ch; c++) acc[c] = 0;
      for (let k = -r; k <= r; k++) { const o = start + (k < 0 ? 0 : k > last ? last : k) * ch; for (let c = 0; c < ch; c++) acc[c] += src[o + c]; }
      for (let x = 0; x < w; x++) {
        const o = start + x * ch; for (let c = 0; c < ch; c++) dst[o + c] = acc[c] / div;
        const ka = x + r + 1, ks = x - r, add = start + (ka > last ? last : ka) * ch, sub = start + (ks < 0 ? 0 : ks) * ch;
        for (let c = 0; c < ch; c++) acc[c] += src[add + c] - src[sub + c];
      }
    }
    return;
  }
  // down the columns a whole row at a time, so memory is read in order
  const row = w * ch, last = h - 1, acc = new Float64Array(row);
  for (let k = -r; k <= r; k++) { const o = (k < 0 ? 0 : k > last ? last : k) * row; for (let i = 0; i < row; i++) acc[i] += src[o + i]; }
  for (let y = 0; y < h; y++) {
    const o = y * row; for (let i = 0; i < row; i++) dst[o + i] = acc[i] / div;
    const ka = y + r + 1, ks = y - r, add = (ka > last ? last : ka) * row, sub = (ks < 0 ? 0 : ks) * row;
    for (let i = 0; i < row; i++) acc[i] += src[add + i] - src[sub + i];
  }
}
function blurChannels(f, w, h, radius, ch) {
  const r = Math.max(0, radius); if (r < 0.5) return f;
  // three box passes with the same spread as a Gaussian of sigma = radius / 2 (a box of radius k adds k(k+1)/3)
  const sigma = r / 2, k = Math.max(1, Math.round((-1 + Math.sqrt(1 + 4 * sigma * sigma)) / 2)), sizes = [k, k, k];
  let a = f, b = new Float32Array(f.length);
  for (const s of sizes) { if (!s) continue; boxPass(a, b, w, h, s, ch, true); boxPass(b, a, w, h, s, ch, false); }
  return a;
}
export function blurRGBA(data, w, h, radius) {
  need(data, w, h);
  const f = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) { const a = data[i + 3] / 255; f[i] = data[i] * a; f[i + 1] = data[i + 1] * a; f[i + 2] = data[i + 2] * a; f[i + 3] = data[i + 3]; }
  const g = blurChannels(f, w, h, radius, 4), out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < out.length; i += 4) { const a = g[i + 3] / 255; out[i + 3] = Math.round(g[i + 3]); if (a > 0) for (let c = 0; c < 3; c++) out[i + c] = Math.round(g[i + c] / a); }
  return out;
}
export function blurMask(mask, w, h, radius) {
  if (!okSize(w, h) || mask.length !== w * h) throw new Error('Invalid mask size');
  const g = blurChannels(Float32Array.from(mask), w, h, radius, 1), out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(clamp(g[i], 0, 255));
  return out;
}

// ---------------------------------------------------------------- selections
// How different two pixels look, 0 to 255: the biggest difference in red, green, blue or alpha,
// with colour only counting as far as both pixels have alpha.
const pixelDiff = (d, i, j) => {
  const a = Math.abs(d[i + 3] - d[j + 3]), both = Math.min(d[i + 3], d[j + 3]) / 255;
  return Math.max(a, both * Math.max(Math.abs(d[i] - d[j]), Math.abs(d[i + 1] - d[j + 1]), Math.abs(d[i + 2] - d[j + 2])));
};
const diffTo = (d, i, ref) => {
  const a = Math.abs(d[i + 3] - ref[3]), both = Math.min(d[i + 3], ref[3]) / 255;
  return Math.max(a, both * Math.max(Math.abs(d[i] - ref[0]), Math.abs(d[i + 1] - ref[1]), Math.abs(d[i + 2] - ref[2])));
};

// Magic wand: pixels that look like the one tapped, within `tolerance` (0 to 255). Touching only
// (`contiguous`) floods out from the tap; otherwise it takes every matching pixel in the picture.
export function wandMask(data, w, h, x, y, tolerance = 32, contiguous = true) {
  need(data, w, h);
  const sx = clamp(Math.floor(x), 0, w - 1), sy = clamp(Math.floor(y), 0, h - 1), s = (sy * w + sx) * 4, tol = clamp(tolerance, 0, 255);
  const m = new Uint8Array(w * h), ok = (p) => pixelDiff(data, p * 4, s) <= tol;
  if (!contiguous) { for (let p = 0; p < m.length; p++) if (ok(p)) m[p] = 255; return m; }
  const queue = new Int32Array(w * h); let head = 0, tail = 0; m[sy * w + sx] = 255; queue[tail++] = sy * w + sx;
  while (head < tail) {
    const p = queue[head++], px = p % w;
    const visit = (q) => { if (!m[q] && ok(q)) { m[q] = 255; queue[tail++] = q; } };
    if (px > 0) visit(p - 1); if (px < w - 1) visit(p + 1); if (p >= w) visit(p - w); if (p < (h - 1) * w) visit(p + w);
  }
  return m;
}

// The average colour of what is selected (weighted by how selected each pixel is).
export function meanColor(data, mask) {
  const s = [0, 0, 0, 0]; let n = 0;
  for (let p = 0; p < mask.length; p++) { const k = mask[p] / 255; if (!k) continue; const i = p * 4; for (let c = 0; c < 4; c++) s[c] += data[i + c] * k; n += k; }
  return n ? s.map((v) => v / n) : null;
}

// Grow: spread the selection into touching pixels that look like what is already selected.
export function growSimilar(data, w, h, mask, tolerance = 32) {
  need(data, w, h); const ref = meanColor(data, mask); if (!ref) return mask;
  const m = Uint8Array.from(mask), queue = new Int32Array(w * h); let head = 0, tail = 0; const tol = clamp(tolerance, 0, 255);
  for (let p = 0; p < m.length; p++) if (m[p] >= 128) queue[tail++] = p;
  while (head < tail) {
    const p = queue[head++], px = p % w;
    const visit = (q) => { if (m[q] < 128 && diffTo(data, q * 4, ref) <= tol) { m[q] = 255; queue[tail++] = q; } };
    if (px > 0) visit(p - 1); if (px < w - 1) visit(p + 1); if (p >= w) visit(p - w); if (p < (h - 1) * w) visit(p + w);
  }
  return m;
}
// Similar: every pixel in the picture that looks like what is selected joins it.
export function selectSimilar(data, w, h, mask, tolerance = 32) {
  need(data, w, h); const ref = meanColor(data, mask); if (!ref) return mask;
  const m = Uint8Array.from(mask), tol = clamp(tolerance, 0, 255);
  for (let p = 0; p < m.length; p++) if (diffTo(data, p * 4, ref) <= tol) m[p] = 255;
  return m;
}

// Distance in pixels from each pixel to the nearest pixel where `inside(p)` is true (two-pass
// chamfer with 1 and √2 steps, close to a true distance and fast at 1600 px).
function distanceTo(w, h, inside) {
  const INF = 1e9, d = new Float32Array(w * h), D = Math.SQRT2;
  for (let p = 0; p < d.length; p++) d[p] = inside(p) ? 0 : INF;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; let v = d[p]; if (!v) continue;
    if (x > 0) v = Math.min(v, d[p - 1] + 1); if (y > 0) { v = Math.min(v, d[p - w] + 1); if (x > 0) v = Math.min(v, d[p - w - 1] + D); if (x < w - 1) v = Math.min(v, d[p - w + 1] + D); }
    d[p] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const p = y * w + x; let v = d[p]; if (!v) continue;
    if (x < w - 1) v = Math.min(v, d[p + 1] + 1); if (y < h - 1) { v = Math.min(v, d[p + w] + 1); if (x < w - 1) v = Math.min(v, d[p + w + 1] + D); if (x > 0) v = Math.min(v, d[p + w - 1] + D); }
    d[p] = v;
  }
  return d;
}
// Move the selection's edge out (positive) or in (negative) by `px` pixels.
export function shiftEdge(mask, w, h, px) {
  if (!okSize(w, h) || mask.length !== w * h) throw new Error('Invalid mask size');
  const n = Math.round(px); if (!n) return Uint8Array.from(mask);
  const m = new Uint8Array(mask.length);
  if (n > 0) { const d = distanceTo(w, h, (p) => mask[p] >= 128); for (let p = 0; p < m.length; p++) m[p] = d[p] <= n ? 255 : 0; }
  else { const d = distanceTo(w, h, (p) => mask[p] < 128); for (let p = 0; p < m.length; p++) m[p] = d[p] > -n ? 255 : 0; }
  return m;
}
// Smooth: round off jagged edges and drop specks smaller than about `radius`.
export function smoothMask(mask, w, h, radius) {
  if (radius < 0.5) return Uint8Array.from(mask);
  const b = blurMask(mask, w, h, radius), m = new Uint8Array(mask.length);
  for (let p = 0; p < m.length; p++) m[p] = b[p] >= 128 ? 255 : 0;
  return m;
}
// Refine edge: shift, then smooth, then feather, in that order (as Photoshop's Select and Mask does).
export function refineMask(mask, w, h, { shift = 0, smooth: s = 0, feather = 0 } = {}) {
  let m = shift ? shiftEdge(mask, w, h, shift) : Uint8Array.from(mask);
  if (s >= 0.5) m = smoothMask(m, w, h, s);
  if (feather >= 0.5) m = blurMask(m, w, h, feather);
  return m;
}
export const softInvert = (m) => { const out = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) out[i] = 255 - m[i]; return out; };

// ---------------------------------------------------------------- background
// The colour round the edge of the picture: the middle value of each channel over the opaque edge
// pixels, or null when the edge is clear.
export function borderColor(data, w, h) {
  need(data, w, h); const r = [], g = [], b = [], step = Math.max(1, Math.floor(Math.max(w, h) / 300));
  const look = (x, y) => { const i = (y * w + x) * 4; if (data[i + 3] > 200) { r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]); } };
  for (let x = 0; x < w; x += step) { look(x, 0); look(x, h - 1); }
  for (let y = 0; y < h; y += step) { look(0, y); look(w - 1, y); }
  if (r.length < 4) return null;
  const mid = (v) => { v.sort((p, q) => p - q); return v[v.length >> 1]; };
  return { r: mid(r), g: mid(g), b: mid(b) };
}
// How far a colour is from the background, 0 to about 255, weighted the way eyes weigh red, green and blue.
const colourDist = (d, i, bg) => Math.sqrt(2 * (d[i] - bg.r) ** 2 + 4 * (d[i + 1] - bg.g) ** 2 + 3 * (d[i + 2] - bg.b) ** 2) / 3;
// Remove the background colour. Pixels within `range` of it go, pixels past range + `soft` stay, and
// between fade so edges stay smooth. `edgesOnly` takes only background joined to the picture's edge,
// so the same colour inside the design (a pale highlight on skin) is kept.
export function removeBackground(data, w, h, { color = null, range = 40, soft = 24, edgesOnly = false } = {}) {
  need(data, w, h); const bg = color || borderColor(data, w, h), out = new Uint8ClampedArray(data);
  if (!bg) return out;
  const keep = (p) => { const i = p * 4; return clamp((colourDist(data, i, bg) - range) / Math.max(1, soft), 0, 1); };
  if (!edgesOnly) { for (let p = 0; p < w * h; p++) out[p * 4 + 3] = Math.round(data[p * 4 + 3] * keep(p)); return out; }
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h); let head = 0, tail = 0;
  const visit = (p) => { if (seen[p]) return; seen[p] = 1; if (data[p * 4 + 3] === 0 || keep(p) < 1) queue[tail++] = p; };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); } for (let y = 1; y < h - 1; y++) { visit(y * w); visit(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++], px = p % w; out[p * 4 + 3] = Math.round(data[p * 4 + 3] * keep(p));
    if (px > 0) visit(p - 1); if (px < w - 1) visit(p + 1); if (p >= w) visit(p - w); if (p < (h - 1) * w) visit(p + w);
  }
  return out;
}

// ---------------------------------------------------------------- adjustments
// Each returns a new picture; alpha is kept. `applyMasked` then limits any of them to a selection.
const withLut = (data, lut) => { const out = new Uint8ClampedArray(data); for (let i = 0; i < out.length; i += 4) { out[i] = lut[data[i]]; out[i + 1] = lut[data[i + 1]]; out[i + 2] = lut[data[i + 2]]; } return out; };
// brightness and contrast, each -100 to 100
export function brightnessContrastLut(brightness = 0, contrast = 0) {
  const b = clamp(brightness, -100, 100) * 1.28, c = clamp(contrast, -100, 99.9), k = (100 + c) / (100 - c), lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.round((v + b - 128) * k + 128);
  return lut;
}
export const brightnessContrast = (data, brightness, contrast) => withLut(data, brightnessContrastLut(brightness, contrast));
// Levels: input black and white points, a middle (gamma, 0.1 to 9.99, 1 = none), and output black and white.
export function levelsLut({ inBlack = 0, inWhite = 255, gamma = 1, outBlack = 0, outWhite = 255 } = {}) {
  const lo = clamp(inBlack, 0, 254), hi = clamp(inWhite, lo + 1, 255), g = clamp(gamma, 0.1, 9.99), lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) { const t = clamp((v - lo) / (hi - lo), 0, 1); lut[v] = Math.round(outBlack + (outWhite - outBlack) * Math.pow(t, 1 / g)); }
  return lut;
}
export const levels = (data, opts) => withLut(data, levelsLut(opts));
// Curves: points { x, y } from 0 to 255, joined by a smooth curve that never overshoots (monotone
// cubic, Fritsch and Carlson), flat past the first and last points.
export function curveLut(points) {
  const p = [...(points || [])].filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y)).map((q) => ({ x: clamp(q.x, 0, 255), y: clamp(q.y, 0, 255) })).sort((a, b) => a.x - b.x)
    .filter((q, i, a) => i === 0 || q.x - a[i - 1].x >= 1);
  const lut = new Uint8ClampedArray(256);
  if (p.length < 2) { for (let v = 0; v < 256; v++) lut[v] = p.length ? p[0].y : v; return lut; }
  const n = p.length, dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; m[i] = (p[i + 1].y - p[i].y) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  for (let v = 0; v < 256; v++) {
    if (v <= p[0].x) { lut[v] = Math.round(p[0].y); continue; } if (v >= p[n - 1].x) { lut[v] = Math.round(p[n - 1].y); continue; }
    let i = 0; while (v > p[i + 1].x) i++;
    const h = dx[i], s = (v - p[i].x) / h, s2 = s * s, s3 = s2 * s;
    lut[v] = Math.round((2 * s3 - 3 * s2 + 1) * p[i].y + (s3 - 2 * s2 + s) * h * t[i] + (-2 * s3 + 3 * s2) * p[i + 1].y + (s3 - s2) * h * t[i + 1]);
  }
  return lut;
}
export const curves = (data, points) => withLut(data, curveLut(points));
const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
// Threshold: black ink on a clear picture, like a stencil. Darker than `level` stays as black, the
// rest goes clear; `soft` levels either side fade, so lines keep smooth edges.
export function threshold(data, level = 128, soft = 6) {
  const out = new Uint8ClampedArray(data.length), s = Math.max(0.5, soft);
  for (let i = 0; i < data.length; i += 4) { const k = clamp((level - lum(data, i)) / (2 * s) + 0.5, 0, 1); out[i + 3] = Math.round(data[i + 3] * k); }
  return out;
}
// Sharpen (unsharp mask): the picture plus `amount` (0 to 3) of its difference from a blurred copy.
export function sharpen(data, w, h, amount = 1, radius = 1.5) {
  need(data, w, h); const b = blurRGBA(data, w, h, radius), out = new Uint8ClampedArray(data), k = clamp(amount, 0, 5);
  for (let i = 0; i < out.length; i += 4) { if (!data[i + 3]) continue; for (let c = 0; c < 3; c++) out[i + c] = data[i + c] + k * (data[i + c] - b[i + c]); }
  return out;
}
export const blur = (data, w, h, radius) => blurRGBA(data, w, h, radius);
// Mix an adjusted picture back over the original by how selected each pixel is (all of it with no selection).
export function applyMasked(before, after, mask) {
  if (!mask) return after;
  const out = new Uint8ClampedArray(before.length);
  for (let p = 0; p < mask.length; p++) { const i = p * 4; mixInto(out, i, before, i, after, i, mask[p] / 255); }
  return out;
}
// 256 bins of brightness over the visible pixels, for the Levels picture.
export function histogram(data, mask = null) {
  const bins = new Uint32Array(256);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) { if (data[i + 3] < 16 || (mask && mask[p] < 128)) continue; bins[Math.round(lum(data, i))]++; }
  return bins;
}
// Levels' Auto: black and white points just inside the darkest and lightest half percent.
export function autoLevels(bins) {
  const total = bins.reduce((a, b) => a + b, 0); if (!total) return { inBlack: 0, inWhite: 255 };
  let s = 0, lo = 0, hi = 255; for (; lo < 255; lo++) { s += bins[lo]; if (s > total * 0.005) break; }
  s = 0; for (; hi > 0; hi--) { s += bins[hi]; if (s > total * 0.005) break; }
  return hi - lo < 8 ? { inBlack: 0, inWhite: 255 } : { inBlack: lo, inWhite: hi };
}
