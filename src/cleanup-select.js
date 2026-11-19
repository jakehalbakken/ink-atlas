// Selection and transform maths for the Clean up workspace (pure, no DOM).
// A selection is a Uint8Array mask over the working picture, one byte a pixel, 0 or 255.
// A lifted piece is moved by T = { cx, cy, s, rot, fx, fy }: its middle in picture pixels, a
// uniform size, a turn in radians and a flip across (fx) or up and down (fy), each 1 or -1.

const okSize = (w, h) => Number.isInteger(w) && Number.isInteger(h) && w >= 1 && h >= 1 && w <= 4096 && h <= 4096;
const need = (w, h) => { if (!okSize(w, h)) throw new Error('Invalid selection size'); };

export function rectMask(w, h, box) {
  need(w, h); const m = new Uint8Array(w * h);
  const x0 = Math.max(0, Math.floor(Math.min(box.x, box.x + box.w))), x1 = Math.min(w, Math.ceil(Math.max(box.x, box.x + box.w)));
  const y0 = Math.max(0, Math.floor(Math.min(box.y, box.y + box.h))), y1 = Math.min(h, Math.ceil(Math.max(box.y, box.y + box.h)));
  for (let y = y0; y < y1; y++) m.fill(255, y * w + x0, y * w + Math.max(x0, x1));
  return m;
}

// A freehand loop, closed from its last point back to its first. Pixels whose middle is inside
// (even-odd rule) are selected, one scanline at a time.
export function lassoMask(w, h, points) {
  need(w, h); const m = new Uint8Array(w * h);
  const p = (points || []).filter((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y));
  if (p.length < 3) return m;
  const xs = [];
  for (let y = 0; y < h; y++) {
    const cy = y + 0.5; xs.length = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const a = p[i], b = p[j];
      if ((a.y > cy) !== (b.y > cy)) xs.push(a.x + (cy - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    if (xs.length < 2) continue; xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(w, Math.ceil(xs[k + 1] - 0.5));
      if (x1 > x0) m.fill(255, y * w + x0, y * w + x1);
    }
  }
  return m;
}

// The separate piece of ink under (x, y): every inked pixel (alpha over 16) joined to it, with gaps
// up to `reach` pixels bridged, so specks and broken lines can come along. A tap on empty skin
// takes the nearest ink within `near` pixels. Returns null when there is none.
export function pieceMask(data, w, h, x, y, reach = 2, near = 24) {
  need(w, h); if (data.length !== w * h * 4) throw new Error('Invalid picture data');
  const inked = (i) => data[i * 4 + 3] > 16;
  let sx = Math.max(0, Math.min(w - 1, Math.floor(x))), sy = Math.max(0, Math.min(h - 1, Math.floor(y)));
  if (!inked(sy * w + sx)) {
    let best = null, bd = Infinity; const r = Math.max(0, Math.round(near));
    for (let j = Math.max(0, sy - r); j <= Math.min(h - 1, sy + r); j++) for (let i = Math.max(0, sx - r); i <= Math.min(w - 1, sx + r); i++) {
      if (!inked(j * w + i)) continue; const d = (i - sx) ** 2 + (j - sy) ** 2; if (d < bd && d <= r * r) { bd = d; best = [i, j]; }
    }
    if (!best) return null; [sx, sy] = best;
  }
  const m = new Uint8Array(w * h), R = Math.max(0, Math.round(reach)) + 1; // a gap of `reach` empty pixels
  if (R <= 4) {
    // exact: neighbours within R pixels in each direction
    const queue = new Int32Array(w * h); let head = 0, tail = 0; const s = sy * w + sx; m[s] = 255; queue[tail++] = s;
    while (head < tail) {
      const p = queue[head++], px = p % w, py = (p - px) / w;
      for (let j = Math.max(0, py - R); j <= Math.min(h - 1, py + R); j++) for (let i = Math.max(0, px - R); i <= Math.min(w - 1, px + R); i++) {
        const q = j * w + i; if (!m[q] && inked(q)) { m[q] = 255; queue[tail++] = q; }
      }
    }
    return m;
  }
  // wider gaps: join on a grid of R-pixel cells, then keep the inked pixels in the joined cells
  const gw = Math.ceil(w / R), gh = Math.ceil(h / R), cell = new Uint8Array(gw * gh);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (inked(j * w + i)) cell[((j / R) | 0) * gw + ((i / R) | 0)] = 1;
  const got = new Uint8Array(gw * gh), queue = new Int32Array(gw * gh); let head = 0, tail = 0;
  const s = ((sy / R) | 0) * gw + ((sx / R) | 0); got[s] = 1; queue[tail++] = s;
  while (head < tail) {
    const c = queue[head++], cx = c % gw, cy = (c - cx) / gw;
    for (let j = Math.max(0, cy - 1); j <= Math.min(gh - 1, cy + 1); j++) for (let i = Math.max(0, cx - 1); i <= Math.min(gw - 1, cx + 1); i++) {
      const q = j * gw + i; if (!got[q] && cell[q]) { got[q] = 1; queue[tail++] = q; }
    }
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (got[((j / R) | 0) * gw + ((i / R) | 0)] && inked(j * w + i)) m[j * w + i] = 255;
  return m;
}

// New replaces, add joins, subtract takes away. A null mask means nothing is selected.
export function combineMasks(old, next, op = 'new') {
  if (!next) return op === 'new' ? null : old;
  if (op === 'new' || !old) return op === 'subtract' ? (old || null) : next;
  if (old.length !== next.length) throw new Error('Selections differ in size');
  const out = new Uint8Array(old.length);
  for (let i = 0; i < old.length; i++) out[i] = op === 'add' ? (old[i] | next[i]) : (next[i] ? 0 : old[i]);
  return out;
}
export const invertMask = (m) => { const out = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) out[i] = m[i] ? 0 : 255; return out; };
export const isEmptyMask = (m) => !m || !m.some((v) => v);

// The box round the selected pixels that hold ink (alpha over 0), or round the whole mask when
// `data` is left out. Null when there is nothing.
export function maskBounds(m, w, h, data = null) {
  need(w, h); let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (m && !m[i]) continue; if (data && !data[i * 4 + 3]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export const identityFor = (box) => ({ cx: box.x + box.w / 2, cy: box.y + box.h / 2, s: 1, rot: 0, fx: 1, fy: 1 });

// Where a point of the lifted piece (pixels from its top left) lands in the picture.
export function placePoint(T, w, h, px, py) {
  const lx = (px - w / 2) * T.s * T.fx, ly = (py - h / 2) * T.s * T.fy, c = Math.cos(T.rot), s = Math.sin(T.rot);
  return { x: T.cx + lx * c - ly * s, y: T.cy + lx * s + ly * c };
}
// The reverse: a picture point in the piece's own pixels.
export function pieceToLocal(T, w, h, x, y) {
  const dx = x - T.cx, dy = y - T.cy, c = Math.cos(-T.rot), s = Math.sin(-T.rot), k = T.s || 1;
  return { x: (dx * c - dy * s) / (k * T.fx) + w / 2, y: (dx * s + dy * c) / (k * T.fy) + h / 2 };
}
export const placedCorners = (T, w, h) => [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => placePoint(T, w, h, x, y));
export function placedBounds(T, w, h) {
  const c = placedCorners(T, w, h), xs = c.map((p) => p.x), ys = c.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// How much to add on each side, the same left and right and the same top and bottom, so a placed
// piece fits in a W x H picture. The middle of the picture stays the middle, so its spot on the body
// stays the same and a width scale of (W + 2px) / W keeps every piece its real size.
export function growPads(T, w, h, W, H) {
  const b = placedBounds(T, w, h), e = 0.01;
  const px = Math.ceil(Math.max(0, -b.x0 - e, b.x1 - W - e)), py = Math.ceil(Math.max(0, -b.y0 - e, b.y1 - H - e));
  return { px, py };
}

// A drag that runs within `deg` degrees of straight across or straight up and down is held to it.
export function snapStraight(dx, dy, deg = 7, force = false) {
  if (!dx && !dy) return { dx, dy, axis: null };
  const a = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI), across = Math.min(a, 180 - a), up = Math.abs(90 - a);
  if (force ? across <= up : across <= deg) return { dx, dy: 0, axis: 'across' };
  if (force || up <= deg) return { dx: 0, dy, axis: 'up' };
  return { dx, dy, axis: null };
}
// A turn within `deg` degrees of a quarter turn lands on it.
export function snapTurn(rot, deg = 4) {
  const q = Math.PI / 2, n = Math.round(rot / q);
  return Math.abs(rot - n * q) <= deg * Math.PI / 180 ? n * q : rot;
}
// Two fingers: the similarity that takes a0, b0 to a, b, applied to the transform at the start.
export function twoFingerTransform(T0, a0, b0, a, b) {
  const d0 = Math.max(1e-6, Math.hypot(b0.x - a0.x, b0.y - a0.y)), d = Math.hypot(b.x - a.x, b.y - a.y);
  const k = d / d0, turn = Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const vx = T0.cx - m0.x, vy = T0.cy - m0.y, c = Math.cos(turn), s = Math.sin(turn);
  return { ...T0, cx: m.x + k * (vx * c - vy * s), cy: m.y + k * (vx * s + vy * c), s: Math.max(0.05, Math.min(20, T0.s * k)), rot: T0.rot + turn };
}

// Plain words for how far a piece moved from where it was picked up, in inches when the real
// size is known (ppi = picture pixels per inch) and in pixels otherwise.
export function moveWords(T0, T, w, h, ppi) {
  const unit = ppi > 0 ? (v) => `${(Math.abs(v) / ppi).toFixed(2)} in` : (v) => `${Math.round(Math.abs(v))} px`;
  const dx = T.cx - T0.cx, dy = T.cy - T0.cy, small = ppi > 0 ? ppi * 0.005 : 0.5, parts = [];
  if (Math.abs(dx) >= small) parts.push(`${unit(dx)} ${dx > 0 ? 'right' : 'left'}`);
  if (Math.abs(dy) >= small) parts.push(`${unit(dy)} ${dy > 0 ? 'down' : 'up'}`);
  const moved = parts.length ? 'Moved ' + parts.join(' and ') : 'Not moved';
  const size = ppi > 0 ? `${(w * T.s / ppi).toFixed(2)} × ${(h * T.s / ppi).toFixed(2)} in` : `${Math.round(w * T.s)} × ${Math.round(h * T.s)} px`;
  let deg = Math.round((T.rot * 180 / Math.PI) % 360); if (deg > 180) deg -= 360; if (deg <= -180) deg += 360;
  return `${moved} · ${size}${Math.abs(T.s - 1) > 0.004 ? ` (${Math.round(T.s * 100)}%)` : ''}${deg ? ` · turned ${deg}°` : ''}${T.fx < 0 ? ' · flipped across' : ''}${T.fy < 0 ? ' · flipped up and down' : ''}`;
}
