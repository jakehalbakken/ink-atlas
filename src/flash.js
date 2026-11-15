// Flash sheet: one picture holding several separate designs (an artist's flash sheet, a page of
// sketches) split into one picture per design. Pure maths on RGBA pixels, rows from the top.

// Which pixels are ink: on a transparent picture anything solid enough; on paper anything that
// differs clearly from the paper colour (the most common colour round the edge).
export function inkMask(px, w, h) {
  const edge = [];
  const take = (x, y) => edge.push((y * w + x) * 4);
  const step = Math.max(1, Math.floor(Math.max(w, h) / 200));
  for (let x = 0; x < w; x += step) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y += step) { take(0, y); take(w - 1, y); }
  const clear = edge.filter((o) => px[o + 3] < 40).length > edge.length / 2;
  const out = new Uint8Array(w * h);
  if (clear) { for (let i = 0; i < w * h; i++) out[i] = px[i * 4 + 3] > 40 ? 1 : 0; return out; }
  // the paper: the middle of the edge colours, channel by channel
  const mid = (c) => { const v = edge.map((o) => px[o + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const bg = [mid(0), mid(1), mid(2)];
  for (let i = 0; i < w * h; i++) {
    const o = i * 4; if (px[o + 3] <= 40) continue;
    const d = Math.abs(px[o] - bg[0]) + Math.abs(px[o + 1] - bg[1]) + Math.abs(px[o + 2] - bg[2]);
    out[i] = d > 90 ? 1 : 0;
  }
  return out;
}

// The separate designs on a picture: ink is looked at on a coarse grid, cells closer than `gap`
// (a share of the picture's long side) join one design, so a design's own strokes, dots and
// caption stay together. Specks smaller than minShare of all the ink are dropped. Returns
// { boxes: [{ id, x, y, w, h }] in reading order (pixels, with a small border), cell, gw, gh,
// labels } where labels gives each grid cell its design's id (0 for none), or boxes [] when
// the picture holds one design, or more than `max` (likely texture or writing, not a sheet).
export function findDesigns(px, w, h, { cells = 320, gap = 0.03, minShare = 0.01, max = 24 } = {}) {
  const none = { boxes: [], cell: 1, gw: 0, gh: 0, labels: null };
  if (!(w > 8 && h > 8)) return none;
  const mask = inkMask(px, w, h), cell = Math.max(1, Math.ceil(Math.max(w, h) / cells));
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), count = new Uint32Array(gw * gh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) count[((y / cell) | 0) * gw + ((x / cell) | 0)]++;
  const least = Math.max(1, Math.round(cell * cell * 0.02)), ink = new Uint8Array(gw * gh);
  let total = 0; for (let i = 0; i < ink.length; i++) if (count[i] >= least) { ink[i] = 1; total += count[i]; }
  if (!total) return none;
  // grow each ink cell by r cells, rows then columns
  const r = Math.max(1, Math.round(gap * Math.max(gw, gh))), row = new Uint8Array(gw * gh), grown = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) { let last = -1e9; for (let x = 0; x < gw; x++) { if (ink[y * gw + x]) last = x; if (x - last <= r) row[y * gw + x] = 1; } last = 1e9; for (let x = gw - 1; x >= 0; x--) { if (ink[y * gw + x]) last = x; if (last - x <= r) row[y * gw + x] = 1; } }
  for (let x = 0; x < gw; x++) { let last = -1e9; for (let y = 0; y < gh; y++) { if (row[y * gw + x]) last = y; if (y - last <= r) grown[y * gw + x] = 1; } last = 1e9; for (let y = gh - 1; y >= 0; y--) { if (row[y * gw + x]) last = y; if (last - y <= r) grown[y * gw + x] = 1; } }
  // joined groups
  const labels = new Int32Array(gw * gh), parts = [];
  for (let s = 0; s < gw * gh; s++) {
    if (!grown[s] || labels[s]) continue;
    const id = parts.length + 1, stack = [s]; labels[s] = id;
    const p = { id, x0: 1e9, y0: 1e9, x1: -1, y1: -1, ink: 0 };
    while (stack.length) {
      const c = stack.pop(), cx = c % gw, cy = (c / gw) | 0;
      if (ink[c]) { p.ink += count[c]; if (cx < p.x0) p.x0 = cx; if (cx > p.x1) p.x1 = cx; if (cy < p.y0) p.y0 = cy; if (cy > p.y1) p.y1 = cy; }
      for (const n of [cx > 0 ? c - 1 : -1, cx < gw - 1 ? c + 1 : -1, cy > 0 ? c - gw : -1, cy < gh - 1 ? c + gw : -1]) if (n >= 0 && grown[n] && !labels[n]) { labels[n] = id; stack.push(n); }
    }
    parts.push(p);
  }
  // parts whose boxes overlap are one design: a dot in a ring, the rays of a sunburst round its
  // middle, a mandala's rings; on a flash sheet the designs sit apart with clear space between
  const real = parts.filter((p) => p.x1 >= 0), into = new Map();
  const touch = (a, b) => a.x0 <= b.x1 + 1 && b.x0 <= a.x1 + 1 && a.y0 <= b.y1 + 1 && b.y0 <= a.y1 + 1;
  for (let joined = true; joined;) {
    joined = false;
    for (const a of real) {
      if (into.has(a.id)) continue;
      for (const b of real) {
        if (b === a || into.has(b.id) || !touch(a, b)) continue;
        into.set(b.id, a.id); a.ink += b.ink; joined = true;
        a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1);
      }
    }
  }
  const root = (id) => { while (into.has(id)) id = into.get(id); return id; };
  if (into.size) for (let i = 0; i < labels.length; i++) if (labels[i]) labels[i] = root(labels[i]);
  const kept = real.filter((p) => !into.has(p.id) && p.ink >= total * minShare);
  if (kept.length < 2 || kept.length > max) return { ...none, cell, gw, gh, labels };
  const keep = new Set(kept.map((p) => p.id));
  for (let i = 0; i < labels.length; i++) if (labels[i] && !keep.has(labels[i])) labels[i] = 0;
  // reading order: rows of designs top to bottom, left to right in each row
  kept.sort((a, b) => a.y0 - b.y0);
  const rows = [];
  for (const p of kept) { const rw = rows.find((q) => p.y0 <= q.y1 - (q.y1 - q.y0) / 2); if (rw) { rw.items.push(p); rw.y1 = Math.max(rw.y1, p.y1); } else rows.push({ y0: p.y0, y1: p.y1, items: [p] }); }
  const order = rows.flatMap((q) => q.items.sort((a, b) => a.x0 - b.x0));
  const boxes = order.map((p) => {
    const x = Math.max(0, (p.x0 - 1) * cell), y = Math.max(0, (p.y0 - 1) * cell);
    return { id: p.id, x, y, w: Math.min(w, (p.x1 + 2) * cell) - x, h: Math.min(h, (p.y1 + 2) * cell) - y };
  });
  return { boxes, cell, gw, gh, labels };
}

// Whether pixel (x, y) belongs to design `id` (cells of other designs and empty paper do not).
export function inDesign(found, id, x, y) {
  const { cell, gw, gh, labels } = found; if (!labels) return false;
  const cx = Math.min(gw - 1, (x / cell) | 0), cy = Math.min(gh - 1, (y / cell) | 0);
  return labels[cy * gw + cx] === id;
}
