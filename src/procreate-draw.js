// Draw a new tattoo in Procreate on a part of the body you painted.
//
// You paint over a blank area of the body with a finger or the Pencil. Ink Atlas flattens that
// square of skin into a guide picture: your skin colour, any tattoos already nearby, and the
// area you painted tinted. You draw on a new layer in Procreate, hide the guide, Copy All and
// Paste back. Because the picture that comes back is the same square, what you drew lands on
// the same spot at the same size. The empty margin is trimmed so the new tattoo's size and
// handles fit the drawing, not the whole square.

export const GUIDE_SIZE = 2048;

// Where a painted area sits: its middle and size in the plane facing out of the body.
// points: centres of the painted triangles; frame: { right, up, n } unit vectors as arrays.
export function areaExtent(points, centre, frame) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) {
    const d = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
    const x = d[0] * frame.right[0] + d[1] * frame.right[1] + d[2] * frame.right[2];
    const y = d[0] * frame.up[0] + d[1] * frame.up[1] + d[2] * frame.up[2];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { mx: (x0 + x1) / 2, my: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

// The square guide: grey outside the body patch, skin inside, nearby ink, and the painted
// area tinted with a dashed edge. All in the patch's own picture coordinates (0..1).
export function drawGuide({ size = GUIDE_SIZE, mask, highlight = [], skin = '#e0b394', ink = null, label = 'New tattoo', widthCm = 0, flipX = false, flipY = false }) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  let g = c.getContext('2d');
  const tri = (ctx, list) => { ctx.beginPath(); for (const t of list) { ctx.moveTo(t[0] * size, t[1] * size); ctx.lineTo(t[2] * size, t[3] * size); ctx.lineTo(t[4] * size, t[5] * size); ctx.closePath(); } };
  g.fillStyle = '#8f8b86'; g.fillRect(0, 0, size, size);
  g.fillStyle = skin; tri(g, mask); g.fill(); g.strokeStyle = skin; g.lineWidth = 1.5; g.stroke(); // close hairline seams
  if (ink) g.drawImage(ink, 0, 0, size, size);
  if (highlight.length) {
    const h = document.createElement('canvas'); h.width = h.height = size; const hg = h.getContext('2d');
    hg.fillStyle = '#8474ff'; tri(hg, highlight); hg.fill(); hg.strokeStyle = '#8474ff'; hg.lineWidth = 2; hg.stroke();
    g.globalAlpha = 0.22; g.drawImage(h, 0, 0); g.globalAlpha = 1;
    // edge: the outline of the tinted area, drawn as a thin ring from a slightly grown copy
    const e = document.createElement('canvas'); e.width = e.height = size; const eg = e.getContext('2d');
    const r = Math.max(2, size / 512);
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) eg.drawImage(h, dx, dy);
    eg.globalCompositeOperation = 'destination-out'; eg.drawImage(h, 0, 0);
    g.globalAlpha = 0.9; g.drawImage(e, 0, 0); g.globalAlpha = 1;
  }
  // turn the patch picture so the body reads upright, then write the notes on top
  const o = document.createElement('canvas'); o.width = o.height = size; g = o.getContext('2d');
  g.save(); g.translate(flipX ? size : 0, flipY ? size : 0); g.scale(flipX ? -1 : 1, flipY ? -1 : 1); g.drawImage(c, 0, 0); g.restore();
  const f = size / 768;
  g.fillStyle = 'rgba(30,30,34,.82)'; g.font = `600 ${Math.round(16 * f)}px system-ui, sans-serif`;
  g.fillText(`${label}${widthCm > 0 ? `  ·  this square is ${widthCm.toFixed(1)} cm wide` : ''}`, 18 * f, 30 * f, size - 36 * f);
  g.font = `${Math.round(13 * f)}px system-ui, sans-serif`;
  g.fillText('Draw on a new layer. Hide this layer, then Copy All and Paste in Ink Atlas. Top is up.', 18 * f, size - 18 * f, size - 36 * f);
  return o;
}

// The box around what was drawn (pixels with any ink), in 0..1 of the picture, or null.
export function inkBox(rgba, w, h, minAlpha = 8) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] >= minAlpha) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  return { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h, px: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
}

// Share of pixels that are see-through: a drawing on a hidden-guide canvas has many.
export function clearShare(rgba) { let n = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) n++; return n / (rgba.length / 4); }
