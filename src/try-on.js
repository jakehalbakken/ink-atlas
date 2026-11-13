// Try it on with the camera: the artwork over a live camera view (or a photo) of your own skin,
// moved with one finger, sized and turned with two, and curved to follow an arm or a leg. The
// ink is multiplied onto the picture, so white paper drops out and the skin shows through, the
// same way it does on the 3D body. Nothing here touches the project.

// Where a picture lands when it covers a box (CSS object-fit: cover).
export function coverRect(srcW, srcH, dstW, dstH) {
  const s = Math.max(dstW / srcW, dstH / srcH), w = srcW * s, h = srcH * s;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

// Two-finger move: the transform that keeps the two fingers on the same points of the artwork.
// t = {x, y, s, r}: centre in screen pixels, scale, turn in radians.
export function pinch(t, a0, b0, a1, b1) {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y) || 1;
  const k = d1 / d0, dr = Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  // the art's centre relative to the old midpoint, turned and scaled, then put at the new midpoint
  const vx = t.x - m0.x, vy = t.y - m0.y, c = Math.cos(dr), s = Math.sin(dr);
  return { x: m1.x + k * (c * vx - s * vy), y: m1.y + k * (s * vx + c * vy), s: t.s * k, r: t.r + dr };
}

// The cylinder curve: an artwork column at u (-1..1 across the art) on a limb that turns
// through +-theta lands at sin(u theta) / sin(theta) of the half width. Returns the source u for
// an output position v, so the middle stays at true scale and the edges bunch up as they turn away.
export const MAX_TURN = 1.35; // radians each side at full curve, about 77 degrees
export function curveTurn(curve) { return Math.max(0, Math.min(1, curve)) * MAX_TURN; }
export function curvedWidth(width, curve) { const th = curveTurn(curve); return th < 1e-3 ? width : width * Math.sin(th) / th; }
export function sourceU(v, curve) {
  const th = curveTurn(curve); if (th < 1e-3) return v;
  return Math.asin(Math.max(-1, Math.min(1, v * Math.sin(th)))) / th;
}

// The artwork, upright and mirrored as it sits on the body, curved, as a canvas.
// img: a loaded image. flipX mirrors it; flipY turns a bottom-up stored image upright.
export function curvedArt(img, { flipX = false, flipY = false, curve = 0, max = 1024 } = {}) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const k = Math.min(1, max / Math.max(iw, ih)), w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
  const flat = document.createElement('canvas'); flat.width = w; flat.height = h;
  const f = flat.getContext('2d');
  f.translate(flipX ? w : 0, flipY ? h : 0); f.scale(flipX ? -1 : 1, flipY ? -1 : 1); f.drawImage(img, 0, 0, w, h);
  if (curve <= 0.001) return flat;
  const ow = Math.max(1, Math.round(curvedWidth(w, curve)));
  const out = document.createElement('canvas'); out.width = ow; out.height = h;
  const o = out.getContext('2d'), th = curveTurn(curve);
  for (let x = 0; x < ow; x++) {
    const v = ((x + 0.5) / ow) * 2 - 1, u = sourceU(v, curve), sx = Math.min(w - 1, Math.max(0, Math.floor(((u + 1) / 2) * w)));
    o.globalAlpha = 0.72 + 0.28 * Math.cos(u * th); // ink turning away from you reads a little lighter
    o.drawImage(flat, sx, 0, 1, h, x, 0, 1, h);
  }
  return out;
}

// The picture you see, as one canvas: the background (camera frame or photo) covering a view
// of viewW x viewH, then the artwork multiplied on at transform t (in view pixels), its width at
// scale 1 being baseW view pixels. out is the longer side of the result in pixels.
export function compose(bg, bgW, bgH, { mirror = false, art, t, baseW, alpha = 0.92, viewW, viewH, out = 2048 }) {
  const k = out / Math.max(viewW, viewH), W = Math.round(viewW * k), H = Math.round(viewH * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = coverRect(bgW, bgH, W, H);
  g.save(); if (mirror) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(bg, r.x, r.y, r.w, r.h); g.restore();
  const aw = baseW * t.s * k, ah = aw * art.height / art.width;
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = alpha;
  g.translate(t.x * k, t.y * k); g.rotate(t.r); g.drawImage(art, -aw / 2, -ah / 2, aw, ah); g.restore();
  return c;
}
