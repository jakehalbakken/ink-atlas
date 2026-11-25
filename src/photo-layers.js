// On a photo of me, one layer per tattoo (Jake, 2026-11-25: "I need to be able to like address
// each individual tattoo as a layer, cause right now it's all just one bulk thing"). Pure maths:
// each tattoo's ink is cut to the box round its own ink, carries its own nudge { x, y, r, s }
// about the middle of that box (in photo pixels), and a move of all of them together turns and
// sizes them about their shared middle, so they keep their places relative to each other.

// The box round the ink in an RGBA picture drawn over white (ink = anything clearly not white),
// padded a little. Returns { x, y, w, h } in pixels, or null when there is no ink.
export function inkBox(rgba, W, H, pad = 2, level = 250) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      const i = row + x * 4;
      if (rgba[i] < level || rgba[i + 1] < level || rgba[i + 2] < level) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// That box cut out of the picture, as its own RGBA bytes (w x h).
export function cropBox(rgba, W, box) {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) out.set(rgba.subarray(((box.y + y) * W + box.x) * 4, ((box.y + y) * W + box.x + box.w) * 4), y * box.w * 4);
  return out;
}


// One triangle in screen pixels filled into an owner map with a depth test (nearer z wins), so where
// two tattoos overlap the one in front owns the pixel.
export function fillTri(x0, y0, z0, x1, y1, z1, x2, y2, z2, k, ids, depth, W, H) {
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) return;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  if (minX > maxX || minY > maxY) return;
  const e = 1e-6;
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < -e || w1 < -e || w2 < -e) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2, i = y * W + x;
      if (z < depth[i]) { depth[i] = z; ids[i] = k; }
    }
  }
}
// One tattoo's layer out of the shared picture: the box round the ink it owns, with the shared
// picture's pixels where it owns them and white elsewhere. null when it owns no ink here.
export function splitInk(top, ids, k, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (ids[i] !== k) continue;
    const p = i * 4; if (top[p] >= 250 && top[p + 1] >= 250 && top[p + 2] >= 250) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y0 + y) * W + x0 + x; if (ids[i] !== k) continue;
    const s = i * 4, o = (y * w + x) * 4; px[o] = top[s]; px[o + 1] = top[s + 1]; px[o + 2] = top[s + 2];
  }
  return { x: x0, y: y0, w, h, px };
}

// The owner map grown into unowned pixels next to each owner: three steps everywhere (the soft edge
// of the ink), then on through any ink still unowned, so no ink in the shared picture is left out of
// every layer. ids: Int16Array, -1 for none, changed in place. top: the shared RGBA picture over white.
export function growOwners(ids, top, W, H, level = 250) {
  const inkAt = (i) => top[i * 4] < level || top[i * 4 + 1] < level || top[i * 4 + 2] < level;
  for (let step = 0; step < 40; step++) {
    const prev = ids.slice(); let grew = false, left = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (prev[i] >= 0) continue;
      if (step >= 3 && !inkAt(i)) continue;
      const o = (x > 0 && prev[i - 1] >= 0) ? prev[i - 1] : (x < W - 1 && prev[i + 1] >= 0) ? prev[i + 1] : (y > 0 && prev[i - W] >= 0) ? prev[i - W] : (y < H - 1 && prev[i + W] >= 0) ? prev[i + W] : -1;
      if (o >= 0) { ids[i] = o; grew = true; } else if (inkAt(i)) left = true;
    }
    if (step >= 2 && (!grew || !left)) break;
  }
  return ids;
}

export const still = () => ({ x: 0, y: 0, r: 0, s: 1 });
export const moved = (n) => !!n && (Math.abs(n.x) > 0.01 || Math.abs(n.y) > 0.01 || Math.abs(n.r) > 1e-4 || Math.abs(n.s - 1) > 1e-4);
export const MIN_S = 0.25, MAX_S = 4;

// Where the middle of a layer is now.
export function centreOf(layer) { return { x: layer.x + layer.w / 2 + layer.nudge.x, y: layer.y + layer.h / 2 + layer.nudge.y }; }

// The transform from a layer's own pixels to the photo's: [a, b, c, d, e, f] as canvas setTransform.
export function layerMatrix(layer) {
  const n = layer.nudge, c = centreOf(layer), co = Math.cos(n.r) * n.s, si = Math.sin(n.r) * n.s;
  // translate(c) rotate scale translate(-w/2, -h/2)
  return [co, si, -si, co, c.x - co * layer.w / 2 + si * layer.h / 2, c.y - si * layer.w / 2 - co * layer.h / 2];
}

// A point on the photo in the layer's own pixels.
export function toLayer(layer, px, py) {
  const n = layer.nudge, c = centreOf(layer), dx = px - c.x, dy = py - c.y, co = Math.cos(-n.r) / n.s, si = Math.sin(-n.r) / n.s;
  return { x: dx * co - dy * si + layer.w / 2, y: dx * si + dy * co + layer.h / 2 };
}

// The four corners of a layer on the photo, for the box drawn round the picked one.
export function corners(layer) {
  const m = layerMatrix(layer), at = (x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  return [at(0, 0), at(layer.w, 0), at(layer.w, layer.h), at(0, layer.h)];
}

// Is there ink in a layer within slop photo pixels of a point? inkAt(layer, x, y) says whether
// its own pixel (x, y) holds ink. Looked for on a small ring so a finger near a thin line counts.
export function touches(layer, px, py, slop, inkAt) {
  const steps = slop > 0 ? [[0, 0], ...ring(slop / 2), ...ring(slop)] : [[0, 0]];
  for (const [dx, dy] of steps) {
    const p = toLayer(layer, px + dx, py + dy), x = Math.floor(p.x), y = Math.floor(p.y);
    if (x >= 0 && y >= 0 && x < layer.w && y < layer.h && inkAt(layer, x, y)) return true;
  }
  return false;
}
function ring(r) { const o = []; for (let k = 0; k < 8; k++) o.push([Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r]); return o; }

// The topmost shown layer with ink under a point (the list's last is drawn last, so on top), else
// the topmost whose box holds the point, else null.
export function pick(layers, px, py, slop, inkAt) {
  for (let i = layers.length - 1; i >= 0; i--) { const L = layers[i]; if (L.shown && touches(L, px, py, slop, inkAt)) return L; }
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i]; if (!L.shown) continue;
    const p = toLayer(L, px, py); if (p.x >= 0 && p.y >= 0 && p.x <= L.w && p.y <= L.h) return L;
  }
  return null;
}

// The middle of several layers' boxes as they sit now.
export function groupCentre(layers) {
  if (!layers.length) return { x: 0, y: 0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const L of layers) for (const c of corners(L)) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

// A move of one layer from where a gesture started: slid by (dx, dy), turned by dr and sized by ds
// about its own middle. start: the nudge when the gesture began.
export function moveOne(start, { dx = 0, dy = 0, dr = 0, ds = 1 }) {
  return { x: start.x + dx, y: start.y + dy, r: start.r + dr, s: clampS(start.s * ds) };
}

// A move of several layers together from where a gesture started: each layer's middle is turned and
// sized about the pivot and slid, and each layer turns and grows with it. starts: Map id -> nudge.
// Returns Map id -> new nudge. The size is held so no layer goes past MIN_S or MAX_S, and every
// layer is sized by the same amount, so they keep their sizes relative to each other.
export function moveAll(layers, starts, pivot, { dx = 0, dy = 0, dr = 0, ds = 1 }) {
  let lo = 0, hi = Infinity;
  for (const L of layers) { const s = starts.get(L.id).s; lo = Math.max(lo, MIN_S / s); hi = Math.min(hi, MAX_S / s); }
  const k = Math.min(hi, Math.max(lo, ds)), co = Math.cos(dr) * k, si = Math.sin(dr) * k, out = new Map();
  for (const L of layers) {
    const n0 = starts.get(L.id), cx = L.x + L.w / 2 + n0.x, cy = L.y + L.h / 2 + n0.y, rx = cx - pivot.x, ry = cy - pivot.y;
    const nx = pivot.x + rx * co - ry * si + dx, ny = pivot.y + rx * si + ry * co + dy;
    out.set(L.id, { x: nx - (L.x + L.w / 2), y: ny - (L.y + L.h / 2), r: n0.r + dr, s: n0.s * k });
  }
  return out;
}
function clampS(s) { return Math.min(MAX_S, Math.max(MIN_S, s)); }

// What a two-finger gesture did, from the two points when it began (a0, b0) to now (a1, b1):
// the slide of the middle, the turn and the size change.
export function twoFinger(a0, b0, a1, b1) {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y) || 1;
  const t0 = Math.atan2(b0.y - a0.y, b0.x - a0.x), t1 = Math.atan2(b1.y - a1.y, b1.x - a1.x);
  let dr = t1 - t0; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
  return { dx: (a1.x + b1.x) / 2 - (a0.x + b0.x) / 2, dy: (a1.y + b1.y) / 2 - (a0.y + b0.y) / 2, dr, ds: d1 / d0, mid0: { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 } };
}
