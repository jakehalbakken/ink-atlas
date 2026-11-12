// Print at real size, without a browser: sizes, page layout, split parts, PDF structure.
import assert from 'node:assert/strict';
import { pieceSize, layoutPrint, buildPrintPdf, PAGE } from '../../src/print-size.js';

// a 10 cm wide piece on a 175 cm body is 10 cm on paper; a taller body scales it up
{ const s = pieceSize({ width: 0.1, aspect: 2 }, 175); assert.ok(Math.abs(s.wCm - 10) < 1e-9 && Math.abs(s.hCm - 5) < 1e-9); assert.ok(Math.abs(s.w - 10 / 2.54 * 72) < 1e-9); }
{ const s = pieceSize({ width: 0.1, aspect: 1 }, 190); assert.ok(Math.abs(s.wCm - 10 * 190 / 175) < 1e-9); }

const inside = (it) => it.x >= PAGE.margin - 1e-6 && it.x + it.w <= PAGE.w - PAGE.margin + 1e-6 && it.y >= PAGE.margin + PAGE.footer - 1e-6 && it.y + it.h <= PAGE.h - PAGE.margin - PAGE.header + 1e-6;
const overlap = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
// many small pieces pack several to a page, all inside the margins, none overlapping
{
  const pieces = Array.from({ length: 14 }, (_, i) => ({ id: 'p' + i, w: 100 + (i % 3) * 40, h: 90 + (i % 4) * 30 }));
  const pages = layoutPrint(pieces);
  assert.ok(pages.length >= 2 && pages.length < 14, 'packed: ' + pages.length);
  assert.equal(pages.flatMap((p) => p.items).length, 14);
  for (const pg of pages) { for (const it of pg.items) { assert.ok(inside(it), JSON.stringify(it)); assert.ok(!it.clip); } for (let i = 0; i < pg.items.length; i++) for (let j = i + 1; j < pg.items.length; j++) assert.ok(!overlap(pg.items[i], pg.items[j])); }
  // true size kept
  for (const it of pages.flatMap((p) => p.items)) { const src = pieces.find((p) => p.id === it.id); assert.equal(it.w, src.w); assert.equal(it.h, src.h); }
}
// a piece bigger than a page is split into parts that cover it exactly
{
  const big = { id: 'back', w: 30 / 2.54 * 72, h: 45 / 2.54 * 72 }; // 30 x 45 cm back piece
  const pages = layoutPrint([{ id: 'a', w: 80, h: 80 }, big, { id: 'b', w: 80, h: 80 }]);
  const parts = pages.flatMap((p) => p.items).filter((i) => i.id === 'back');
  const { rows, cols } = parts[0].part; assert.equal(parts.length, rows * cols); assert.ok(rows * cols >= 4);
  let area = 0; for (const it of parts) { assert.ok(inside(it.clip)); assert.equal(it.w, big.w); assert.equal(it.h, big.h); area += it.clip.w * it.clip.h;
    // the clip shows exactly its own slice of the piece
    const sx = it.clip.x - it.x, sy = it.clip.y - it.y; assert.ok(Math.abs(sx - (it.part.col - 1) * it.clip.w) < 1e-6); assert.ok(Math.abs(sy - (rows - it.part.row) * it.clip.h) < 1e-6); }
  assert.ok(Math.abs(area - big.w * big.h) < 1e-3, 'parts cover the piece');
  // each part alone on its page, and the next piece starts fresh
  for (const pg of pages) if (pg.items.some((i) => i.id === 'back')) assert.equal(pg.items.length, 1);
}
// PDF: header, every object at its xref offset, one page per layout page, images and fonts
{
  const pages = layoutPrint([{ id: 'x', w: 200, h: 100 }, { id: 'y', w: 900, h: 300 }]);
  const jpeg = { width: 4, height: 2, data: new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]) };
  const pdf = buildPrintPdf(pages, { x: { name: 'Rose (left)', note: '2.8 x 1.4 in', jpeg }, y: { name: 'Sleeve é', note: '', jpeg } }, { title: 'Test' });
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4')); assert.ok(text.trimEnd().endsWith('%%EOF'));
  const xref = +text.match(/startxref\n(\d+)/)[1]; assert.ok(text.slice(xref).startsWith('xref'));
  const rows = text.slice(xref).split('\n').slice(3).filter((l) => / 00000 n $/.test(l));
  rows.forEach((l, i) => assert.ok(text.slice(+l.slice(0, 10)).startsWith(`${i + 1} 0 obj`), 'xref offset ' + (i + 1)));
  assert.equal((text.match(/\/Type \/Page /g) || []).length, pages.length);
  assert.equal((text.match(/\/Subtype \/Image/g) || []).length, 2, 'each artwork stored once');
  assert.match(text, /\(Rose \\\(left\\\)/, 'brackets escaped in text');
  assert.match(text, /Sleeve \?/, 'non-latin letters replaced');
  assert.match(text, /200 0 0 100 /, 'drawn at true size in points');
  assert.match(text, /72 72 re S/, '1 inch check square');
}
assert.throws(() => buildPrintPdf([], {}), /Nothing to print/);
console.log('PASS print at real size: true sizes, packing within margins, split parts cover big pieces, valid PDF');
