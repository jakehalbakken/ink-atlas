// Picture with sizes: where each tattoo's size label goes on a picture of the view.
// Pure maths. Each item is { box: [x0, y0, x1, y1], w, h } in picture pixels (the tattoo's box
// on screen and the label's own size). With the body's span across the picture given as
// body = [x0, x1], labels go out to the side, in a column beside the body on the tattoo's own
// side (or the other side when that one has no room), each level with its tattoo and stacked so
// none overlap, so the body itself stays clear. A label with no room beside the body sits under
// its tattoo, or over it, stepping away from labels already placed.
// Returns [{ x, y, side }] (top left of each label; side is 'left', 'right' or 'near').
export function placeLabels(items, W, H, gap = 6, body = null) {
  const out = new Array(items.length), placed = [];
  const cols = { left: [], right: [] };
  if (body) {
    const mid = (body[0] + body[1]) / 2, room = { left: body[0] - gap * 3, right: W - body[1] - gap * 3 };
    items.forEach((it, i) => {
      const cx = (it.box[0] + it.box[2]) / 2, own = cx < mid ? 'left' : 'right', other = own === 'left' ? 'right' : 'left';
      const side = it.w <= room[own] ? own : it.w <= room[other] ? other : null;
      if (side) cols[side].push(i);
    });
    for (const side of ['left', 'right']) {
      const list = cols[side].sort((a, b) => (items[a].box[1] + items[a].box[3]) - (items[b].box[1] + items[b].box[3]));
      const ys = []; let next = gap;
      for (const i of list) { const it = items[i], want = (it.box[1] + it.box[3]) / 2 - it.h / 2, y = Math.max(next, want); ys.push(y); next = y + it.h + gap; }
      // pushed off the bottom: slide the column back up
      let limit = H - gap;
      for (let k = list.length - 1; k >= 0; k--) { const h = items[list[k]].h; if (ys[k] + h > limit) ys[k] = limit - h; limit = ys[k] - gap; }
      list.forEach((i, k) => {
        const it = items[i], x = side === 'left' ? Math.max(gap, body[0] - gap * 3 - it.w) : Math.min(W - gap - it.w, body[1] + gap * 3), y = Math.max(gap, ys[k]);
        out[i] = { x, y, side }; placed.push([x, y, x + it.w, y + it.h]);
      });
    }
  }
  const hits = (r) => placed.some((q) => r[0] < q[2] + gap / 2 && r[2] > q[0] - gap / 2 && r[1] < q[3] + gap / 2 && r[3] > q[1] - gap / 2);
  // the rest go next to their tattoo, top to bottom so the stepping goes one way
  const order = items.map((_, i) => i).filter((i) => !out[i]).sort((a, b) => items[a].box[3] - items[b].box[3] || items[a].box[0] - items[b].box[0]);
  for (const i of order) {
    const { box, w, h } = items[i], cx = (box[0] + box[2]) / 2;
    const x = Math.max(gap, Math.min(W - gap - w, cx - w / 2));
    const below = box[3] + gap, above = box[1] - gap - h;
    const tries = [];
    for (let k = 0; k < 8; k++) tries.push(below + k * (h + gap), above - k * (h + gap));
    let y = null;
    for (const t of tries) {
      if (t < gap || t + h > H - gap) continue;
      if (!hits([x, t, x + w, t + h])) { y = t; break; }
    }
    if (y === null) y = Math.max(gap, Math.min(H - gap - h, below));
    placed.push([x, y, x + w, y + h]); out[i] = { x, y, side: 'near' };
  }
  return out;
}

// Where the line from a label meets its tattoo, and where it leaves the label: [[x, y], [x, y]].
export function leader(box, spot, w, h) {
  const cy = (box[1] + box[3]) / 2, cx = (box[0] + box[2]) / 2;
  if (spot.side === 'left') return [[spot.x + w, spot.y + h / 2], [box[0], cy]];
  if (spot.side === 'right') return [[spot.x, spot.y + h / 2], [box[2], cy]];
  const under = spot.y >= box[3] - 1, lx = Math.max(spot.x + 8, Math.min(spot.x + w - 8, cx));
  return [[lx, under ? spot.y : spot.y + h], [cx, under ? box[3] : box[1]]];
}

// The label's words: the size in inches, then centimetres.
export function sizeLabel(widthIn, heightIn) {
  const cm = (v) => Math.round(v * 2.54);
  return `${widthIn.toFixed(1)} × ${heightIn.toFixed(1)} in (${cm(widthIn)} × ${cm(heightIn)} cm)`;
}
