// Flash sheet: separate designs on one picture found, in reading order, with their own pixels.
import assert from 'node:assert/strict';
import { findDesigns, inkMask, inDesign } from '../../src/flash.js';
const sheet = (w, h, bg = [255, 255, 255, 255]) => { const px = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) px.set(bg, i * 4); return px; };
const rect = (px, w, x0, y0, x1, y1, c = [10, 10, 10, 255]) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.set(c, (y * w + x) * 4); };
const ring = (px, w, x0, y0, s, t = 6) => { rect(px, w, x0, y0, x0 + s, y0 + t); rect(px, w, x0, y0 + s - t, x0 + s, y0 + s); rect(px, w, x0, y0, x0 + t, y0 + s); rect(px, w, x0 + s - t, y0, x0 + s, y0 + s); };
// six outlined squares in two rows on white paper, each with a dot just inside and a caption
// just under it that belong to it
{
  const W = 1200, H = 800, px = sheet(W, H);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = 80 + c * 380, y = 60 + r * 380; ring(px, W, x, y, 260); rect(px, W, x + 120, y + 120, x + 140, y + 140); rect(px, W, x + 60, y + 275, x + 200, y + 285);
  }
  const f = findDesigns(px, W, H);
  assert.equal(f.boxes.length, 6, 'six designs');
  // reading order: top row left to right, then the bottom row
  const xs = f.boxes.map((b) => b.x), ys = f.boxes.map((b) => b.y);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2] && xs[3] < xs[4] && xs[4] < xs[5], 'left to right ' + xs);
  assert.ok(ys[0] < ys[3] - 200, 'top row first');
  // each box holds its square and caption, not the next design
  for (const b of f.boxes) { assert.ok(b.w >= 260 && b.w < 340, 'width ' + b.w); assert.ok(b.h >= 285 && b.h < 360, 'height ' + b.h); }
  const b0 = f.boxes[0];
  assert.ok(inDesign(f, b0.id, 100, 70) && inDesign(f, b0.id, 130, 330), 'ring and caption are its own');
  assert.ok(!inDesign(f, b0.id, 480, 70), 'the next square is not');
}
// one design: nothing to split
{ const W = 400, H = 400, px = sheet(W, H); ring(px, W, 50, 50, 300); rect(px, W, 190, 190, 210, 210); assert.equal(findDesigns(px, W, H).boxes.length, 0); }
// specks of dust do not count as designs
{ const W = 800, H = 400, px = sheet(W, H); ring(px, W, 40, 40, 300); ring(px, W, 440, 40, 300); rect(px, W, 395, 380, 397, 382); assert.equal(findDesigns(px, W, H).boxes.length, 2); }
// transparent picture: ink is anything solid, whatever its colour (white lines too)
{
  const W = 800, H = 400, px = sheet(W, H, [0, 0, 0, 0]);
  ring(px, W, 40, 40, 300, 8); rect(px, W, 440, 60, 760, 340, [255, 255, 255, 255]);
  const m = inkMask(px, W, H); assert.equal(m[60 * W + 500], 1, 'white ink on clear'); assert.equal(m[10 * W + 10], 0);
  assert.equal(findDesigns(px, W, H).boxes.length, 2);
}
// coloured paper: the paper is not ink
{ const W = 800, H = 400, px = sheet(W, H, [230, 215, 180, 255]); ring(px, W, 40, 40, 300); ring(px, W, 440, 40, 300, 8); assert.equal(findDesigns(px, W, H).boxes.length, 2); }
// too many pieces (a texture or writing) is not a flash sheet
{ const W = 1000, H = 1000, px = sheet(W, H); for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) rect(px, W, 20 + x * 98, 20 + y * 98, 60 + x * 98, 60 + y * 98); assert.equal(findDesigns(px, W, H).boxes.length, 0); }
// blank
{ assert.equal(findDesigns(sheet(100, 100), 100, 100).boxes.length, 0); }
console.log('flash-unit ok');
