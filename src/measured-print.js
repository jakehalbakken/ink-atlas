// The measured stencil and placement guide as a PDF at 100%: one page per piece from print-profiles,
// the art clipped to its piece, crosshairs at the joins above and below it, the size checks (a 1 in
// square, 1 in rulers both ways and a 50 mm bar) and a small assembly map. Labels stay in the bands
// outside the art. Pure: the pictures and the compression come in from the caller.
import { PdfPage, buildPdf } from './pdf-writer.js';
import { tileLabel, MARK_MM, FOOTER_MM } from './print-profiles.js';

// The layout as it will print: mirrored, every piece flips to the other end and pages are in order
// from the left of the printed art.
export function printedLayout(L, D, mirror) {
  if (!mirror) return L;
  const tiles = L.tiles.map((t) => ({ ...t, x0: D - t.x1, x1: D - t.x0, col: L.cols - 1 - t.col }))
    .sort((a, b) => a.row - b.row || a.col - b.col).map((t, i) => ({ ...t, i }));
  // the page spot follows the piece's width, which doesn't change, so the page position stays
  return { ...L, tiles, cuts: { x: L.cuts.x.map((c) => D - c).sort((a, b) => a - b), y: L.cuts.y } };
}

function cross(pg, x, y, r = 2.2) { pg.circle(x, y, r * 0.55); pg.line(x - r, y, x + r, y); pg.line(x, y - r, x, y + r); }

// opts: kind 'stencil' | 'guide', L (layoutTiles), art { w, h } mm, picture { w, h, channels, data },
// outline (art mm from the top left, as printed), mirror, title, paperName, status (approval line),
// deflate
export async function measuredPdf(opts) {
  const { kind, art, picture, mirror = false, title = 'Measured wrap', paperName = '', status = '', outline = null, deflate } = opts;
  const L = printedLayout(opts.L, art.w, mirror);
  if (!L.ok) throw new Error(L.why);
  const pages = [], S = L.area.sheet, o = L.overlap;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const t of L.tiles) {
    const pg = new PdfPage(L.page.w, L.page.h), tw = t.x1 - t.x0, th = t.y1 - t.y0, px = t.page.x, py = t.page.y;
    // header, outside the art
    pg.fill(0).text(S.x, S.y + 4, `${title}: ${kind === 'stencil' ? 'stencil, new art only' : 'placement guide, not a stencil'}`, 9, { bold: true });
    pg.text(S.x + S.w, S.y + 4, tileLabel(L, t), 8, { align: 'right' });
    const sizeLine = `Print at 100% / Actual size. Turn off Fit to page. ${paperName} ${L.orient}.`;
    pg.text(S.x, S.y + 8.6, kind === 'stencil' ? `${sizeLine} ${mirror ? 'Mirrored here once: do not mirror again in the printer.' : 'Not mirrored.'}` : sizeLine, 7);
    // the art for this piece
    pg.save().clip(px, py, tw, th).image('Art', px - t.x0, py - t.y0, art.w, art.h, mirror);
    if (outline) { pg.stroke(0.25, 0.3); pg.poly(outline.map(([x, y]) => [px - t.x0 + (mirror ? art.w - x : x), py - t.y0 + y])); }
    pg.restore();
    // crosshairs at both ends of the art and at every join, in the bands above and below
    pg.stroke(0, 0.25);
    const xs = [0, ...L.cuts.x, art.w];
    xs.forEach((xm, k) => {
      if (xm < t.x0 - 0.01 || xm > t.x1 + 0.01) return;
      const x = px + xm - t.x0;
      cross(pg, x, py - MARK_MM / 2); cross(pg, x, py + th + MARK_MM / 2);
      if (k > 0 && k < xs.length - 1) {
        pg.fill(0).text(x + 2.8, py - MARK_MM / 2 - 1.2, letters[(k - 1) % 26], 7, { bold: true });
        // the overlap either side of the join
        for (const e of [xm - o / 2, xm + o / 2]) if (e >= t.x0 - 0.01 && e <= t.x1 + 0.01) { const ex = px + e - t.x0; pg.line(ex, py - 1.6, ex, py - 0.3); pg.line(ex, py + th + 0.3, ex, py + th + 1.6); }
      }
    });
    if (L.rows > 1) [0, ...L.cuts.y, art.h].forEach((ym) => {
      if (ym < t.y0 - 0.01 || ym > t.y1 + 0.01) return;
      const y = py + ym - t.y0;
      if (px - S.x >= 5) cross(pg, px - 3.2, y); if (S.x + S.w - (px + tw) >= 5) cross(pg, px + tw + 3.2, y);
    });
    // footer: size checks and the assembly map
    const fy = S.y + S.h - FOOTER_MM + 3.5, sx = S.x;
    pg.stroke(0, 0.3).rect(sx, fy, 25.4, 25.4); pg.fill(0).text(sx + 12.7, fy + 14, '1 in', 8, { bold: true, align: 'center' });
    pg.text(sx + 12.7, fy + 18, 'square', 6, { align: 'center' });
    // a 1 in ruler down beside the square, one across, and 50 mm, each with ticks
    const vx = sx + 28.5;
    pg.line(vx, fy, vx, fy + 25.4); for (let i = 0; i <= 4; i++) pg.line(vx, fy + i * 6.35, vx + (i % 4 ? 1.2 : 2.4), fy + i * 6.35);
    pg.text(vx + 3, fy + 25, '1 in down', 6);
    const hx = sx + 42, hy = fy + 1.5;
    pg.line(hx, hy, hx + 25.4, hy); for (let i = 0; i <= 4; i++) pg.line(hx + i * 6.35, hy, hx + i * 6.35, hy + (i % 4 ? 1.2 : 2.4));
    pg.text(hx + 12.7, hy + 5.5, '1 in across', 6, { align: 'center' });
    const bx = hx + 34, by = hy;
    pg.stroke(0, 0.5).line(bx, by, bx + 50, by); pg.stroke(0, 0.25); for (let i = 0; i <= 5; i++) pg.line(bx + i * 10, by, bx + i * 10, by + (i % 5 ? 1.2 : 2.4));
    pg.text(bx + 25, by + 5.5, '50 mm', 6, { align: 'center' });
    pg.text(hx, fy + 13.5, 'Measure before you cut: the square is 1 in (25.4 mm) each way and the bar 50 mm.', 6.5);
    pg.text(hx, fy + 17.5, L.tiles.length > 1 ? `Trim one page on a join line, lay it over the next with the ${o} mm overlap, and match the crosshairs.` : 'The crosshairs mark the ends of the art.', 6.5);
    if (status) pg.text(hx, fy + 21.5, status, 6.5, { bold: true });
    // assembly map at the right
    const mw = 52, mh = 16, k = Math.min(mw / art.w, mh / art.h), mx = S.x + S.w - mw, my = fy + 5;
    pg.text(mx, fy + 1.5, 'How the pages join', 6);
    for (const u of L.tiles) {
      const r = [mx + u.x0 * k, my + u.y0 * k, (u.x1 - u.x0) * k, (u.y1 - u.y0) * k];
      if (u.i === t.i) { pg.fill(0.82); pg.rect(...r, 'f'); }
      pg.stroke(0, 0.2).rect(...r); pg.fill(0).text(r[0] + r[2] / 2, r[1] + r[3] / 2 + 1.2, String(u.i + 1), 6.5, { bold: u.i === t.i, align: 'center' });
    }
    if (outline) { pg.stroke(0.4, 0.15); pg.poly(outline.map(([x, y]) => [mx + (mirror ? art.w - x : x) * k, my + y * k])); }
    pages.push(pg);
  }
  const images = { Art: picture };
  return buildPdf(pages, images, { deflate, title: `${title} ${kind}`, subject: 'Print at 100% / Actual size' });
}
