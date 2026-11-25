// Drawing straight onto the skin in a layer (2026-11-25, Jake: "select an area of skin like with a
// brush and then have that part be something I can edit and draw on in a layer ... without having to
// like do it in Procreate"). The pure maths: how big the layer's picture is, where a touch on the
// skin lands in it, where the dabs of a stroke go, the area mask's soft edge, and the undo budget.
// No DOM here, so it runs under node (tools/tests/skin-draw-unit.mjs).

// The picture for a layer of this size on the skin, in pixels: as sharp as 16 px a millimetre (about
// 400 dots an inch) for a small piece, never past `cap` on its long side, never under 4 px a mm.
export function artSize(widthMm, heightMm, cap = 1600, most = 16, least = 4) {
  const w = Math.max(1, Number(widthMm) || 1), h = Math.max(1, Number(heightMm) || 1);
  const k = Math.max(least, Math.min(most, cap / Math.max(w, h)));
  return { w: Math.max(16, Math.min(cap, Math.round(w * k))), h: Math.max(16, Math.min(cap, Math.round(h * k))), pxPerMm: k };
}

// A point of the decal's texture (u, v as three.js reports them for a picture drawn top down, with
// UV_MARGIN round it) to the artwork's own pixel, or null outside the artwork. A mirrored tattoo
// shows its picture flipped across, so the pixel is read from the other side.
export function uvToArt(u, v, W, H, margin, flip = false) {
  const span = 1 - 2 * margin; if (!(span > 0)) return null;
  let ax = (u - margin) / span; const ay = (v - margin) / span;
  if (flip) ax = 1 - ax;
  if (!(ax >= -0.02 && ax <= 1.02 && ay >= -0.02 && ay <= 1.02)) return null;
  return [ax * W, ay * H];
}

// How wide a dab is for a tool at a pen pressure (0..1; a finger or mouse reports none, read as 0.7
// so it draws at most of the size). The pencil thins a lot with a light touch, the brush less.
export function dabRadius(sizePx, pressure, tool) {
  const p = Number.isFinite(pressure) && pressure > 0 ? Math.min(1, pressure) : 0.7;
  const r = sizePx / 2, k = tool === 'pencil' ? 0.25 + 0.75 * p : tool === 'brush' ? 0.45 + 0.55 * p : tool === 'eraser' ? 0.6 + 0.4 * p : 1;
  return Math.max(0.5, r * k);
}

// The dabs between the last point of a stroke and the next, a fixed share of the radius apart so a
// fast stroke stays a line. carry is how far past the last dab the stroke had already gone. Pressure
// and radius are blended along the way.
export function dabsAlong(from, to, spacing, carry = 0) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy), step = Math.max(0.35, spacing);
  const out = []; let d = step - carry;
  if (!(len > 0)) return { dabs: out, carry };
  while (d <= len) { const k = d / len; out.push({ x: from.x + dx * k, y: from.y + dy * k, r: from.r + (to.r - from.r) * k }); d += step; }
  return { dabs: out, carry: len - (d - step) };
}

// A little smoothing for a stroke, like Procreate's streamline: each new point moves part of the way
// from the last smoothed one. amount 0 follows the pen exactly.
export function smoothPoint(prev, next, amount = 0.35) {
  if (!prev) return { ...next };
  const k = 1 - Math.max(0, Math.min(0.9, amount));
  return { x: prev.x + (next.x - prev.x) * k, y: prev.y + (next.y - prev.y) * k, r: prev.r + (next.r - prev.r) * k };
}

// Rectangles as [x, y, w, h] in whole pixels, kept inside the picture.
export function dabRect(x, y, r, W, H) { return clampRect([Math.floor(x - r - 2), Math.floor(y - r - 2), Math.ceil(2 * r + 4), Math.ceil(2 * r + 4)], W, H); }
export function clampRect(r, W, H) {
  if (!r) return null;
  const x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(0, Math.floor(r[1])), x1 = Math.min(W, Math.ceil(r[0] + r[2])), y1 = Math.min(H, Math.ceil(r[1] + r[3]));
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
}
export function unionRect(a, b) {
  if (!a) return b ? [...b] : null; if (!b) return [...a];
  const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[0] + a[2], b[0] + b[2]), y1 = Math.max(a[1] + a[3], b[1] + b[3]);
  return [x0, y0, x1 - x0, y1 - y0];
}

// The box (in the decal's own 0..1 frame) that holds the chosen skin, from a probe decal laid over
// it: uvs are the decal's texture coordinates (with the margin), tris the body triangle under each
// decal triangle, keep the chosen body triangles. Returned as half widths from the middle, so the
// layer can stay centred on the anchor, which is on the skin.
export function areaBox(uvs, tris, keep, margin) {
  const span = 1 - 2 * margin; let hx = 0, hy = 0, n = 0;
  for (let t = 0; t < tris.length; t++) {
    if (!keep.has(tris[t])) continue;
    for (let k = 0; k < 3; k++) {
      const i = (t * 3 + k) * 2, x = (uvs[i] - margin) / span - 0.5, y = (uvs[i + 1] - margin) / span - 0.5;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      hx = Math.max(hx, Math.abs(x)); hy = Math.max(hy, Math.abs(y)); n++;
    }
  }
  return n ? { hx, hy, n } : null;
}

// The chosen area's soft edge: a box blur of the mask's alpha (radius r px, run twice, near a
// gaussian), so an edge drawn to stays soft instead of a hard step. Holes smaller than about the
// radius close first (the triangles of the skin leave thin gaps between them in the picture).
export function softenMask(alpha, W, H, r) {
  r = Math.max(0, Math.round(r)); if (!r) return alpha;
  const a = Float32Array.from(alpha), tmp = new Float32Array(W * H);
  const pass = (src, dst, horizontal) => {
    const n = horizontal ? W : H, m = horizontal ? H : W;
    for (let j = 0; j < m; j++) {
      let s = 0; const at = (i) => (horizontal ? src[j * W + Math.max(0, Math.min(n - 1, i))] : src[Math.max(0, Math.min(n - 1, i)) * W + j]);
      for (let i = -r; i <= r; i++) s += at(i);
      for (let i = 0; i < n; i++) { (horizontal ? (dst[j * W + i] = s / (2 * r + 1)) : (dst[i * W + j] = s / (2 * r + 1))); s += at(i + r + 1) - at(i - r); }
    }
  };
  pass(a, tmp, true); pass(tmp, a, false); pass(a, tmp, true); pass(tmp, a, false);
  const out = new Uint8ClampedArray(W * H);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(a[i]);
  return out;
}
// Close small gaps in a hard mask: anything a blur of radius r lifts past half is in.
export function closeGaps(alpha, W, H, r) {
  if (!(r > 0)) return alpha;
  const s = softenMask(alpha, W, H, r), out = new Uint8ClampedArray(W * H);
  for (let i = 0; i < out.length; i++) out[i] = alpha[i] > 127 || s[i] > 64 ? 255 : 0;
  return out;
}

// Undo for strokes: each step keeps the pixels it changed, before and after, so going back and
// forward is a copy. Old steps drop off once the kept pixels pass the budget (bytes), never the
// newest one. Steps carry a word for what they did, for the toast.
export class StrokeHistory {
  constructor(budget = 64 * 1024 * 1024) { this.budget = budget; this.done = []; this.undone = []; this.bytes = 0; }
  static size(step) { let b = 0; for (const p of step.patches || []) b += (p.before?.data?.length || 0) + (p.after?.data?.length || 0); return b; }
  push(step) {
    step.bytes = StrokeHistory.size(step);
    for (const s of this.undone) this.bytes -= s.bytes; this.undone = [];
    this.done.push(step); this.bytes += step.bytes;
    while (this.bytes > this.budget && this.done.length > 1) this.bytes -= this.done.shift().bytes;
  }
  undo() { const s = this.done.pop(); if (s) this.undone.push(s); return s || null; }
  redo() { const s = this.undone.pop(); if (s) this.done.push(s); return s || null; }
  get canUndo() { return this.done.length > 0; }
  get canRedo() { return this.undone.length > 0; }
  get count() { return this.done.length; }
}

// Whether anything is drawn: any pixel with real alpha. Returns the box round it (alpha 8 and up,
// like Trim to the ink) or null.
export function alphaBounds(data, W, H, min = 8) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] >= min) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// A box grown by pad on every side, kept inside the picture.
export function padBox(b, pad, W, H) {
  const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
  return { x, y, w: Math.min(W, b.x + b.w + pad) - x, h: Math.min(H, b.y + b.h + pad) - y };
}
