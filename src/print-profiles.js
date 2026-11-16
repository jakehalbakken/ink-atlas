// Paper, printers and tiling for a measured stencil at 100%. Pure maths, all in millimetres, so it
// can be tested without a browser. The art is never scaled: a smaller sheet only means more pages.
//
// tileCount = 1 + ceil(max(0, D - P) / (P - o)) for an art length D, a printable length P and an
// overlap o. The art box for the ankle is 307.47 x 126.21 mm: two pages of Letter or A4 landscape,
// one of Legal or 8.5 x 16 in.

export const PAPERS = Object.freeze({
  letter: { name: 'Letter', w: 215.9, h: 279.4 },
  a4: { name: 'A4', w: 210, h: 297 },
  legal: { name: 'Legal', w: 215.9, h: 355.6 },
  '8.5x16': { name: '8.5 x 16 in', w: 215.9, h: 406.4 },
  custom: { name: 'Custom' },
});
export const PAPER_ORDER = ['letter', 'a4', 'legal', '8.5x16', 'custom'];

// Margins are what the printer can't reach. Feed is extra clearance at the leading and trailing
// edge as the sheet goes through (the short edges of the sheet). Raster is the dpi the art is drawn
// at inside the PDF.
export const PRINTERS = Object.freeze({
  inkjet: { name: 'Home inkjet', margins: { top: 6.35, right: 6.35, bottom: 6.35, left: 6.35 }, feed: 0, dpi: 300, media: 'Plain paper' },
  laser: { name: 'Office laser', margins: { top: 5, right: 5, bottom: 5, left: 5 }, feed: 0, dpi: 600, media: 'Plain paper' },
  thermal: { name: 'Thermal stencil printer', margins: { top: 2, right: 2, bottom: 2, left: 2 }, feed: 12, dpi: 300, media: 'Thermal stencil paper' },
  custom: { name: 'Custom', margins: { top: 6.35, right: 6.35, bottom: 6.35, left: 6.35 }, feed: 0, dpi: 300, media: 'Plain paper' },
});
export const PRINTER_ORDER = ['inkjet', 'laser', 'thermal', 'custom'];

export const OVERLAP_MM = 10;
export const HEADER_MM = 11;   // title and "Print at 100%" line above the art
export const FOOTER_MM = 31;   // the 1 in square, the checks, the 50 mm bar and the assembly map
export const MARK_MM = 7;      // room above and below the art for the join crosshairs
export const MIN_PIECE_MM = 20; // a cut can't leave a sliver smaller than this

export const ptOf = (mm) => mm / 25.4 * 72;

export function printerOf(print) {
  const p = PRINTERS[print && print.printer] || PRINTERS.inkjet;
  return print && print.printer === 'custom' && print.margins ? { ...p, margins: { ...print.margins } } : p;
}

// The sheet in mm, oriented. Custom paper takes its own size; anything unknown falls back to Letter.
export function paperOf(print, orient) {
  const key = print && PAPERS[print.paper] ? print.paper : 'letter';
  const base = key === 'custom' ? (print.custom && print.custom.w > 0 && print.custom.h > 0 ? { w: print.custom.w, h: print.custom.h } : { w: 215.9, h: 279.4 }) : PAPERS[key];
  const short = Math.min(base.w, base.h), long = Math.max(base.w, base.h);
  return orient === 'landscape' ? { key, w: long, h: short } : { key, w: short, h: long };
}

// Where the art may go on the page, in mm from the page's top left: margins, feed clearance on the
// short edges, then the header and footer bands and room for the crosshairs above and below.
export function artArea(print, orient) {
  const page = paperOf(print, orient), pr = printerOf(print), m = pr.margins, f = pr.feed || 0;
  // the short edges are top and bottom in portrait, left and right in landscape
  const fl = orient === 'landscape' ? f : 0, ft = orient === 'landscape' ? 0 : f;
  const left = m.left + fl, right = m.right + fl, top = m.top + ft, bottom = m.bottom + ft;
  const x = left, y = top + HEADER_MM + MARK_MM;
  const w = page.w - left - right, h = page.h - top - bottom - HEADER_MM - FOOTER_MM - 2 * MARK_MM;
  return { page, x, y, w, h, sheet: { x: left, y: top, w: page.w - left - right, h: page.h - top - bottom } };
}

export function tileCount(D, P, o = OVERLAP_MM) {
  if (!(D > 0)) return 1;
  if (!(P > o)) return Infinity;
  return 1 + Math.ceil(Math.max(0, D - P - 1e-9) / (P - o));
}

// Default cut lines for n pieces along a length D: every piece the same width w = (D + (n-1) o) / n,
// so each cut sits in the middle of its overlap.
export function defaultCuts(D, n, o = OVERLAP_MM) {
  if (n <= 1) return [];
  const w = (D + (n - 1) * o) / n, out = [];
  for (let i = 1; i < n; i++) out.push(i * (w - o) + o / 2);
  return out;
}

// A moved cut, kept inside what still fits a page either side and away from its neighbours.
export function clampCuts(cuts, D, P, o = OVERLAP_MM) {
  const out = cuts.slice().sort((a, b) => a - b);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < out.length; i++) {
    const prev = i ? out[i - 1] : null, next = i < out.length - 1 ? out[i + 1] : null;
    // the piece before: from (prev - o/2 or 0) to (c + o/2) must fit P
    const lo = Math.max(prev == null ? MIN_PIECE_MM : prev + MIN_PIECE_MM, (next == null ? D : next + o / 2) - P - o / 2 + (next == null ? o / 2 : 0));
    const hi = Math.min(next == null ? D - MIN_PIECE_MM : next - MIN_PIECE_MM, (prev == null ? 0 : prev - o / 2) + P - o / 2);
    out[i] = Math.min(Math.max(out[i], lo), Math.max(lo, hi));
  }
  return out;
}

// Spans of each piece along one axis from its cuts: each piece reaches o/2 past each of its cuts.
export function spans(cuts, D, o = OVERLAP_MM) {
  const edges = [0, ...cuts, D], out = [];
  for (let i = 0; i < edges.length - 1; i++) out.push([i === 0 ? 0 : edges[i] - o / 2, i === edges.length - 2 ? D : edges[i + 1] + o / 2]);
  return out;
}

function axisPlan(D, P, o, saved) {
  const n = tileCount(D, P, o);
  if (!isFinite(n)) return null;
  let cuts = defaultCuts(D, n, o);
  if (saved && saved.length === n - 1) cuts = clampCuts(saved, D, P, o);
  const sp = spans(cuts, D, o);
  const ok = sp.every(([a, b]) => b - a <= P + 1e-6);
  return { n, cuts: ok ? cuts : defaultCuts(D, n, o), spans: ok ? sp : spans(defaultCuts(D, n, o), D, o) };
}

// The whole layout for an art box { w, h } in mm: page, art area, pieces in reading order (rows from
// the top, columns from the left), each with the art rectangle it shows and where that sits on the
// page. Orientation 'auto' takes the one with fewer pages, landscape on a tie.
export function layoutTiles(art, print = {}) {
  const o = print.overlap >= 0 ? print.overlap : OVERLAP_MM;
  const plan = (orient) => {
    const A = artArea(print, orient);
    if (A.w <= o + MIN_PIECE_MM || A.h <= o + MIN_PIECE_MM) return { orient, A, why: 'This paper is too small for the margins this printer needs.' };
    const cx = (print.cuts || []).filter((c) => c.axis === 'x').map((c) => c.at), cy = (print.cuts || []).filter((c) => c.axis === 'y').map((c) => c.at);
    const X = axisPlan(art.w, A.w, o, cx), Y = axisPlan(art.h, A.h, o, cy);
    if (!X || !Y) return { orient, A, why: 'This paper is too small for the overlap.' };
    return { orient, A, X, Y, count: X.n * Y.n };
  };
  let p;
  if (print.orient === 'portrait' || print.orient === 'landscape') p = plan(print.orient);
  else { const L = plan('landscape'), Pt = plan('portrait'); p = !L.why && (Pt.why || L.count <= Pt.count) ? L : Pt.why ? L : Pt; }
  if (p.why) return { ok: false, why: p.why, orient: p.orient, page: p.A.page, area: p.A, tiles: [], cols: 0, rows: 0, cuts: { x: [], y: [] }, overlap: o };
  const tiles = [];
  for (let r = 0; r < p.Y.n; r++) for (let c = 0; c < p.X.n; c++) {
    const [x0, x1] = p.X.spans[c], [y0, y1] = p.Y.spans[r];
    // centre the piece in the art area so the paper looks even
    const px = p.A.x + (p.A.w - (x1 - x0)) / 2, py = p.A.y + (p.A.h - (y1 - y0)) / 2;
    tiles.push({ i: tiles.length, col: c, row: r, x0, x1, y0, y1, page: { x: px, y: py } });
  }
  return { ok: true, orient: p.orient, page: p.A.page, area: p.A, cols: p.X.n, rows: p.Y.n, tiles, cuts: { x: p.X.cuts, y: p.Y.cuts }, overlap: o };
}

// Which of the pieces lie left, right, above and below, for the label on each page.
export function tileLabel(L, tile) {
  if (L.tiles.length <= 1) return 'One page';
  const parts = [];
  if (L.rows > 1) parts.push(L.rows === 2 ? ['top', 'bottom'][tile.row] : 'row ' + (tile.row + 1));
  if (L.cols > 1) parts.push(L.cols === 2 ? ['left', 'right'][tile.col] : L.cols === 3 ? ['left', 'middle', 'right'][tile.col] : 'column ' + (tile.col + 1));
  return `Page ${tile.i + 1} of ${L.tiles.length}, ${parts.join(' ')}`;
}

// The raster dpi used inside the PDF: the printer's, lowered only if the whole art would be more
// pixels than an iPad canvas holds.
export function rasterDpi(art, dpi, maxPixels = 16.7e6) {
  let d = dpi;
  while (d > 100 && Math.round(art.w / 25.4 * d) * Math.round(art.h / 25.4 * d) > maxPixels) d -= 50;
  return d;
}

// A short line for the panel: how many pages, which way round, and the overlap.
export function layoutNote(L) {
  if (!L.ok) return L.why;
  const n = L.tiles.length;
  return n === 1 ? `Fits on one ${L.orient} page at 100%.` : `${n} ${L.orient} pages at 100%, overlapping ${L.overlap} mm at each join. Line up the crosshairs and tape them.`;
}
