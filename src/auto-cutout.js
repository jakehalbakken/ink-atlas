// Automatic cutout. The person taps the tattoo (or the subject of any picture) and
// Google's MediaPipe interactive segmenter, running on the device, finds the shape
// under the finger. Nothing is uploaded: the model and its runtime are served from
// this site and cached after the first use.
//
// Two ways to keep the result:
// - 'subject': keep everything inside the found shape, soft edge, nothing else.
// - 'ink': lift dark ink off a photo of skin (or paper). Inside the found shape the
//   bare-skin brightness is estimated around every pixel and only what is darker
//   than it is kept, as near-black ink on transparent. Same recipe as the old app.
//
// The pixel work below is plain functions so it can be tested without a browser.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Resample a confidence mask (mw x mh, values 0..1) to w x h, bilinear.
export function resampleMask(mask, mw, mh, w, h) {
  if (mw === w && mh === h) return Float32Array.from(mask);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(mh - 1, Math.max(0, (y + 0.5) * mh / h - 0.5)), y0 = Math.floor(fy), y1 = Math.min(mh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(mw - 1, Math.max(0, (x + 0.5) * mw / w - 0.5)), x0 = Math.floor(fx), x1 = Math.min(mw - 1, x0 + 1), tx = fx - x0;
      const a = mask[y0 * mw + x0] * (1 - tx) + mask[y0 * mw + x1] * tx, b = mask[y1 * mw + x0] * (1 - tx) + mask[y1 * mw + x1] * tx;
      out[y * w + x] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

// Sliding max (or min) over a window of radius r along rows then columns. O(n) per pass.
function slide(src, w, h, r, takeMax) {
  const better = takeMax ? (a, b) => a >= b : (a, b) => a <= b;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), q = new Int32Array(Math.max(w, h));
  const pass = (from, to, len, count, stride, step) => {
    for (let line = 0; line < count; line++) {
      const base = line * stride; let head = 0, tail = 0;
      for (let i = 0; i < len + r; i++) {
        if (i < len) { const v = from[base + i * step]; while (tail > head && better(v, from[base + q[tail - 1] * step])) tail--; q[tail++] = i; }
        const c = i - r; if (c < 0) continue;
        while (q[head] < c - r) head++;
        to[base + c * step] = from[base + q[head] * step];
      }
    }
  };
  pass(src, tmp, w, h, w, 1); pass(tmp, out, h, w, 1, w);
  return out;
}
export const maxFilter = (src, w, h, r) => slide(src, w, h, r, true);
export const minFilter = (src, w, h, r) => slide(src, w, h, r, false);

function blur5(src, w, h) {
  const k = [1, 4, 6, 4, 1], tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -2; i <= 2; i++) s += k[i + 2] * src[y * w + Math.min(w - 1, Math.max(0, x + i))]; tmp[y * w + x] = s / 16; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -2; i <= 2; i++) s += k[i + 2] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x]; out[y * w + x] = s / 16; }
  return out;
}

// The connected region (confidence above `level`) that contains the tapped pixel,
// or, if the tap itself landed just outside, the region nearest to it.
export function regionAt(conf, w, h, x, y, level = 0.5) {
  let seed = -1;
  if (conf[y * w + x] > level) seed = y * w + x;
  else {
    const reach = Math.round(Math.max(w, h) * 0.06);
    let best = Infinity;
    for (let j = Math.max(0, y - reach); j <= Math.min(h - 1, y + reach); j++) for (let i = Math.max(0, x - reach); i <= Math.min(w - 1, x + reach); i++) {
      const d = (i - x) ** 2 + (j - y) ** 2; if (d < best && conf[j * w + i] > level) { best = d; seed = j * w + i; }
    }
  }
  const inside = new Uint8Array(w * h);
  if (seed < 0) return { inside, count: 0 };
  const queue = new Int32Array(w * h); let head = 0, tail = 0, count = 0;
  inside[seed] = 1; queue[tail++] = seed;
  while (head < tail) {
    const p = queue[head++]; count++; const px = p % w;
    const visit = (n) => { if (!inside[n] && conf[n] > level) { inside[n] = 1; queue[tail++] = n; } };
    if (px > 0) visit(p - 1); if (px < w - 1) visit(p + 1); if (p >= w) visit(p - w); if (p < w * (h - 1)) visit(p + w);
  }
  return { inside, count };
}

// The soft mask (0..1) for one tap: the found shape that contains the tapped pixel
// (x, y), grown a few pixels so its soft edge is not clipped. Throws a plain message
// when nothing was found there.
export function tapMask(conf, w, h, x, y) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 1600 || h > 1600 || conf.length !== w * h) throw new Error('Invalid cutout input');
  x = Math.min(w - 1, Math.max(0, Math.floor(x))); y = Math.min(h - 1, Math.max(0, Math.floor(y)));
  const { inside, count } = regionAt(conf, w, h, x, y, 0.5);
  if (count < Math.max(30, w * h * 0.005)) throw new Error('Nothing found where you tapped. Tap right on the tattoo.');
  const near = maxFilter(Float32Array.from(inside), w, h, Math.max(2, Math.round(Math.max(w, h) * 0.004)));
  const out = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) out[p] = near[p] ? clamp01((conf[p] - 0.3) / 0.4) : 0;
  return out;
}

// Apply one or more tap masks (from tapMask) to RGBA pixels. Several taps add up, so
// a design in separate parts can be gathered piece by piece. Returns { data, kept }.
export function applyCutout(data, w, h, masks, keep = 'subject') {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 1600 || h > 1600 || data.length !== w * h * 4 || !masks.length || masks.some((m) => m.length !== w * h)) throw new Error('Invalid cutout input');
  const mask = new Float32Array(w * h);
  for (const m of masks) for (let p = 0; p < w * h; p++) if (m[p] > mask[p]) mask[p] = m[p];
  const out = new Uint8ClampedArray(data);
  if (keep === 'subject') {
    let kept = 0;
    for (let p = 0; p < w * h; p++) { out[p * 4 + 3] = Math.round(data[p * 4 + 3] * mask[p]); if (out[p * 4 + 3] > 30) kept++; }
    return { data: out, kept };
  }
  if (keep !== 'ink') throw new Error('Unknown cutout kind');
  const maxEdge = Math.max(w, h), gray = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) gray[p] = 0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2];
  const soft = blur5(gray, w, h), r = Math.max(8, Math.round(maxEdge * 0.04));
  // Bare skin around each pixel: a local estimate (follows uneven light) that is not
  // allowed to fall far below the skin of the whole found area, so a solid filled
  // shape bigger than the local window still reads as ink.
  const local = minFilter(maxFilter(soft, w, h, r), w, h, r);
  const lum = []; for (let p = 0; p < w * h; p += 3) if (mask[p] > 0.5) lum.push(soft[p]);
  lum.sort((a, b) => a - b);
  const skin = lum.length ? lum[Math.floor(lum.length * 0.8)] : 255;
  // Interior: the found shape shrunk a little so its outline (often a shadow) is dropped.
  const solid = new Float32Array(w * h); for (let p = 0; p < w * h; p++) solid[p] = mask[p] > 0.85 ? 1 : 0;
  const interior = minFilter(solid, w, h, Math.max(2, Math.round(maxEdge * 0.009)));
  let kept = 0;
  for (let p = 0; p < w * h; p++) {
    const bg = Math.max(local[p], skin * 0.9), a = interior[p] ? clamp01((bg - soft[p] - 8) / Math.max(15, 0.6 * bg)) : 0;
    const alpha = Math.round(data[p * 4 + 3] * a);
    out[p * 4] = 18; out[p * 4 + 1] = 20; out[p * 4 + 2] = 22; out[p * 4 + 3] = alpha;
    if (alpha > 0.12 * 255) kept++;
  }
  if (kept < Math.max(30, w * h * 0.001)) throw new Error('No dark ink found there. Try "What I tapped" instead.');
  return { data: out, kept };
}

/* ---------- the model ---------- */
let ready = null;
const base = () => (import.meta.env && import.meta.env.BASE_URL) || '/';
// Loads once, on first use. A failed load can be retried.
export function loadSegmenter() {
  if (!ready) {
    ready = (async () => {
      const { FilesetResolver, InteractiveSegmenter } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(new URL(base() + 'vision', location.href).href);
      return InteractiveSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL(base() + 'vision/magic_touch.tflite', location.href).href, delegate: 'CPU' },
        outputCategoryMask: false, outputConfidenceMasks: true,
      });
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}
// Confidence (0..1) at the canvas's size for a tap at canvas pixel (x, y).
export async function segmentAt(canvas, x, y) {
  const segmenter = await loadSegmenter();
  const w = canvas.width, h = canvas.height;
  return new Promise((resolve, reject) => {
    try {
      segmenter.segment(canvas, { keypoint: { x: Math.min(1, Math.max(0, x / w)), y: Math.min(1, Math.max(0, y / h)) } }, (result) => {
        try {
          const mask = result.confidenceMasks && result.confidenceMasks[0];
          if (!mask) throw new Error('The cutout tool returned nothing.');
          const values = mask.getAsFloat32Array();
          resolve(resampleMask(values, mask.width, mask.height, w, h));
        } catch (e) { reject(e); }
      });
    } catch (e) { reject(e); }
  });
}
