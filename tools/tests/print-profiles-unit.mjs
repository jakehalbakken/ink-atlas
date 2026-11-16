// Paper, printers and tiling for a measured stencil, and the PDF they make: tile counts from the
// spec, overlaps, moved joins, orientation, the art never scaled, and the 1 in square at 72 pt.
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import * as P from '../../src/print-profiles.js';
import { measuredPdf, printedLayout } from '../../src/measured-print.js';
import { develop } from '../../src/wrap-geometry.js';

const t = develop([{ circ: 228.6 }, { circ: 317.5, gap: 101.6 }], 'skin');
const art = { w: t.bounds.w, h: t.bounds.h };
assert.ok(Math.abs(art.w - 307.47) < 0.02 && Math.abs(art.h - 126.21) < 0.02, 'ankle box ' + art.w + ' ' + art.h);

// the formula
assert.equal(P.tileCount(100, 200), 1); assert.equal(P.tileCount(200, 200), 1); assert.equal(P.tileCount(201, 200), 2);
assert.equal(P.tileCount(390, 200, 10), 2); assert.equal(P.tileCount(391, 200, 10), 3);
// the spec's cases: Letter and A4 landscape two pages, Legal and 8.5 x 16 one
const count = (paper, orient = 'landscape', printer = 'inkjet') => P.layoutTiles(art, { paper, orient, printer }).tiles.length;
for (const printer of P.PRINTER_ORDER) {
  assert.equal(count('letter', 'landscape', printer), 2, 'letter ' + printer); assert.equal(count('a4', 'landscape', printer), 2, 'a4 ' + printer);
  assert.equal(count('legal', 'landscape', printer), 1, 'legal ' + printer); assert.equal(count('8.5x16', 'landscape', printer), 1, '8.5x16 ' + printer);
}
// auto takes the fewer pages, landscape on a tie
assert.equal(P.layoutTiles(art, { paper: 'legal' }).orient, 'landscape');
assert.equal(P.layoutTiles(art, { paper: 'letter' }).orient, 'landscape');
// every piece fits, overlaps are exactly 10 mm, and the pieces cover the art end to end
for (const paper of ['letter', 'a4', 'legal', '8.5x16']) for (const orient of ['landscape', 'portrait']) {
  const L = P.layoutTiles(art, { paper, orient });
  assert.ok(L.ok, paper + orient);
  for (const u of L.tiles) { assert.ok(u.x1 - u.x0 <= L.area.w + 1e-6 && u.y1 - u.y0 <= L.area.h + 1e-6, 'fits ' + paper + orient); assert.ok(u.page.x >= L.area.x - 1e-6 && u.page.y >= L.area.y - 1e-6); }
  const row = L.tiles.filter((u) => u.row === 0);
  assert.equal(row[0].x0, 0); assert.ok(Math.abs(row.at(-1).x1 - art.w) < 1e-9);
  for (let i = 1; i < row.length; i++) assert.ok(Math.abs(row[i - 1].x1 - row[i].x0 - 10) < 1e-9, 'overlap 10 mm');
}
// changing the paper never changes the art: the pieces always add up to the same box
{
  const a = P.layoutTiles(art, { paper: 'letter' }), b = P.layoutTiles(art, { paper: 'legal' });
  const span = (L) => Math.max(...L.tiles.map((u) => u.x1)) - Math.min(...L.tiles.map((u) => u.x0));
  assert.equal(span(a), span(b));
}
// a custom small sheet tiles both ways; a tiny one says why
{
  const L = P.layoutTiles(art, { paper: 'custom', custom: { w: 120, h: 150 }, orient: 'portrait' });
  assert.ok(L.ok && L.cols >= 3 && L.rows >= 2, `small sheet ${L.cols} x ${L.rows}`);
  const T = P.layoutTiles(art, { paper: 'custom', custom: { w: 50, h: 60 } });
  assert.equal(T.ok, false); assert.ok(T.why);
}
// a moved join stays where it is put, inside what a page can hold
{
  const L = P.layoutTiles(art, { paper: 'letter', cuts: [{ axis: 'x', at: 120 }] });
  assert.ok(Math.abs(L.cuts.x[0] - 120) < 1e-9, 'moved join kept ' + L.cuts.x);
  assert.ok(Math.abs(L.tiles[0].x1 - 125) < 1e-9 && Math.abs(L.tiles[1].x0 - 115) < 1e-9);
  // too far: the right page would be wider than the paper, so it is pulled back
  const F = P.layoutTiles(art, { paper: 'letter', cuts: [{ axis: 'x', at: 20 }] });
  assert.ok(F.tiles.every((u) => u.x1 - u.x0 <= F.area.w + 1e-6), 'clamped');
  assert.ok(F.cuts.x[0] > 20);
  // a wrong number of joins (saved for another paper) falls back to the even split
  const W = P.layoutTiles(art, { paper: 'legal', cuts: [{ axis: 'x', at: 100 }] });
  assert.equal(W.tiles.length, 1);
}
// the thermal printer's feed clearance is on the short edges
{
  const a = P.artArea({ paper: 'letter', printer: 'thermal' }, 'portrait'), b = P.artArea({ paper: 'letter', printer: 'thermal' }, 'landscape');
  assert.ok(Math.abs(a.sheet.y - 14) < 1e-9 && Math.abs(a.sheet.x - 2) < 1e-9);
  assert.ok(Math.abs(b.sheet.x - 14) < 1e-9 && Math.abs(b.sheet.y - 2) < 1e-9);
}
// raster dpi stays under an iPad canvas
assert.equal(P.rasterDpi(art, 300), 300); assert.ok(P.rasterDpi(art, 600) < 600 && P.rasterDpi(art, 600) >= 450);
// mirrored layout: the first page shows the far end of the art
{
  const L = P.layoutTiles(art, { paper: 'letter', cuts: [{ axis: 'x', at: 120 }] }), M = printedLayout(L, art.w, true);
  assert.ok(Math.abs(M.tiles[0].x0) < 1e-9 && Math.abs(M.tiles[0].x1 - (art.w - 115)) < 1e-9 && Math.abs(M.cuts.x[0] - (art.w - 120)) < 1e-9);
}

// The PDF: explicit page size, the art at real size, the 1 in square at 72 pt and the words to print it at 100%
const deflate = async (b) => new Uint8Array(zlib.deflateSync(Buffer.from(b)));
const dpi = 100, W = Math.round(art.w / 25.4 * dpi), H = Math.round(art.h / 25.4 * dpi), data = new Uint8Array(W * H).fill(255);
for (let x = 0; x < W; x++) data[Math.round(H / 2) * W + x] = 0;
async function make(paper, mirror = false) {
  const L = P.layoutTiles(art, { paper });
  const bytes = await measuredPdf({ kind: 'stencil', L, art, picture: { w: W, h: H, channels: 1, data }, mirror, title: 'Ankle wrap', paperName: P.PAPERS[paper].name, status: 'Approved 16 Nov 2026', deflate });
  return { L, text: Buffer.from(bytes).toString('latin1'), bytes };
}
for (const paper of ['letter', 'a4', 'legal', '8.5x16']) {
  const { L, text } = await make(paper);
  assert.ok(text.startsWith('%PDF-1.4') && text.trimEnd().endsWith('%%EOF'));
  const boxes = [...text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [+m[1], +m[2]]);
  assert.equal(boxes.length, L.tiles.length, paper + ' pages');
  for (const [w, h] of boxes) { assert.ok(Math.abs(w - L.page.w / 25.4 * 72) < 0.01 && Math.abs(h - L.page.h / 25.4 * 72) < 0.01, paper + ' page size ' + w + ' ' + h); assert.ok(w > h, 'landscape'); }
  assert.ok(text.includes('(Print at 100% / Actual size.'), 'says 100%');
  // the 1 in square is a 72 x 72 pt rectangle on every page
  assert.equal([...text.matchAll(/ 72 72 re S/g)].length, L.tiles.length, paper + ' square');
  // the art is drawn at its real size: the image's matrix is the art box in points
  const cm = [...text.matchAll(/q (-?[\d.]+) 0 0 ([\d.]+) (-?[\d.]+) (-?[\d.]+) cm \/Art Do Q/g)];
  assert.equal(cm.length, L.tiles.length);
  for (const m of cm) { assert.ok(Math.abs(+m[1] - art.w / 25.4 * 72) < 0.01 && Math.abs(+m[2] - art.h / 25.4 * 72) < 0.01, 'real size ' + m[1]); }
  // one picture, shared by every page
  assert.equal([...text.matchAll(/\/Subtype \/Image/g)].length, 1);
  assert.ok(text.includes(`/Width ${W} /Height ${H} /ColorSpace /DeviceGray`));
}
{
  const { text } = await make('letter', true);
  const m = text.match(/q (-?[\d.]+) 0 0 [\d.]+ (-?[\d.]+) [\d.-]+ cm \/Art Do Q/);
  assert.ok(+m[1] < 0, 'mirrored once in the drawing'); assert.ok(text.includes('Mirrored here once'));
  assert.equal([...text.matchAll(/cm \/Art Do Q/g)].filter((x) => x).length, 2);
}
// the picture inside reads back as what went in
{
  const { text, bytes } = await make('legal');
  const at = text.indexOf('/Subtype /Image'), s = text.indexOf('stream\n', at) + 7, len = +text.slice(at).match(/\/Length (\d+)/)[1];
  const back = zlib.inflateSync(Buffer.from(bytes.slice(s, s + len)));
  assert.equal(back.length, W * H); assert.equal(back[Math.round(H / 2) * W + 5], 0); assert.equal(back[5], 255);
}
console.log('PASS print profiles and measured PDF');
