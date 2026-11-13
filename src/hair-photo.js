// Hair from a photo of the face: its colour, and roughly how long and full it is, read from
// MediaPipe's hair segmenter (a mask of the hair, run on the device) and the face points the
// face landmarker finds. Pure maths on the mask and the pixels, so it can be checked on its own.
//
// Lengths are in face heights (forehead point to chin), so they don't depend on the photo's size:
// - volume: how far the hair stands above the top of the skull
// - reach: how far the hair hangs below the eyes at the sides of the face
// - cover: how much of the scalp band above the forehead is hair

// face points (MediaPipe face mesh numbers)
const F = { top: 10, chin: 152, cheekR: 234, cheekL: 454, eyeR: 33, eyeL: 263 };

// pixels: RGBA bytes (w x h); mask: hair confidence 0..1 (w x h); lm: face points with x, y in
// 0..1. Returns { found, colour: '#rrggbb' | null, volume, reach, cover, style }.
export function readHair(pixels, mask, w, h, lm) {
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const top = P(F.top), chin = P(F.chin), cr = P(F.cheekR), cl = P(F.cheekL);
  const eyeY = (P(F.eyeR).y + P(F.eyeL).y) / 2;
  const fh = Math.max(4, Math.hypot(chin.x - top.x, chin.y - top.y));
  const fw = Math.abs(cl.x - cr.x), cx = (cl.x + cr.x) / 2;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[(y | 0) * w + (x | 0)] > 0.5;
  // the skull's top, about 0.33 face heights above the forehead point in a photo taken straight on
  const skullY = top.y - 0.33 * fh;
  // the band of scalp just above the forehead: what share of it is hair
  let n = 0, hit = 0;
  for (let y = Math.round(skullY + 0.04 * fh); y < top.y - 0.08 * fh; y += 1) for (let x = Math.round(cx - fw * 0.3); x <= cx + fw * 0.3; x += 1) { n++; if (on(x, y)) hit++; }
  const cover = n ? hit / n : 0;
  // the highest hair over the head
  let highY = Infinity;
  for (let x = Math.round(cx - fw * 0.45); x <= cx + fw * 0.45; x++) for (let y = 0; y < top.y; y++) if (on(x, y)) { if (y < highY) highY = y; break; }
  const volume = Number.isFinite(highY) ? Math.max(0, (skullY - highY) / fh) : 0;
  // the lowest hair at each side of the face, just outside the cheeks
  let lowY = -Infinity;
  for (const [x0, x1] of [[cr.x - fw * 0.45, cr.x + fw * 0.02], [cl.x - fw * 0.02, cl.x + fw * 0.45]]) {
    for (let x = Math.round(Math.min(x0, x1)); x <= Math.max(x0, x1); x++) for (let y = h - 1; y > top.y; y--) if (on(x, y)) { if (y > lowY) lowY = y; break; }
  }
  const reach = Number.isFinite(lowY) ? Math.max(0, (lowY - eyeY) / fh) : 0;
  // the colour: the median of the hair pixels over the head, leaving out shine and deep shadow
  const px = [];
  for (let y = 0; y < top.y; y++) for (let x = Math.round(cx - fw * 0.6); x <= cx + fw * 0.6; x++) if (on(x, y)) { const i = ((y | 0) * w + (x | 0)) * 4; px.push([pixels[i], pixels[i + 1], pixels[i + 2]]); }
  let colour = null;
  if (px.length > 20) {
    px.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    const mid = px.slice(Math.floor(px.length * 0.2), Math.ceil(px.length * 0.7)); // shadows and shine out
    const avg = [0, 1, 2].map((k) => Math.round(mid.reduce((s, p) => s + p[k], 0) / mid.length));
    colour = '#' + avg.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  const found = cover > 0.15 || px.length > fh * fh * 0.03;
  return { found, colour, volume, reach, cover, style: hairStyleFor({ found, volume, reach, cover }) };
}

// The nearest style this app can show: bald, shaved (stubble), a buzz cut, short or longer.
export function hairStyleFor({ found, volume, reach, cover }) {
  if (!found || cover < 0.15) return 'none';
  if (reach > 0.75) return 'long';
  if (volume > 0.12 || reach > 0.45) return 'crop';
  if (volume > 0.03) return 'short';
  return 'buzz';
}
