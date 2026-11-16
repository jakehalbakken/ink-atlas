// Procreate package for a measured wrap: canvas size, layers, session, manifest, and the checks on
// what comes back (exact, resized, cropped, stretched, turned). Plus the PSD lock and resolution.
import assert from 'node:assert/strict';
import { develop, toPx, pxFor, ptFor } from '../../src/wrap-geometry.js';
import * as P from '../../src/procreate-package.js';
import { writePsd, readPsd, StripPacker } from '../../src/psd.js';
import { cleanSession } from '../../src/measured-region.js';

const region = { id: 'r1', name: 'Ankle wrap', limb: 'legR', seam: 0, method: 'skin', calib: 3, levels: [{ circ: 228.6 }, { circ: 317.5, gap: 101.6 }] };
const t = develop(region.levels, 'skin');

// canvas at 300 and 600 PPI: pixel count = round(mm / 25.4 x PPI)
const c3 = P.packageCanvas(t, 300), c6 = P.packageCanvas(t, 600);
assert.equal(c3.w, pxFor(t.bounds.w + 2 * P.PAD_MM, 300)); assert.equal(c3.h, pxFor(t.bounds.h + 2 * P.PAD_MM, 300));
assert.equal(c6.w, pxFor(t.bounds.w + 2 * P.PAD_MM, 600));
assert.ok(Math.abs(c3.wMm - (307.47 + 24)) < 0.02, 'width ' + c3.wMm);
assert.ok(Math.abs(ptFor(25.4) - 72) < 1e-9);
console.log('canvas 300 PPI', c3.w, 'x', c3.h, '600 PPI', c6.w, 'x', c6.h);
// marks inside the canvas, outside the shape's box
for (const m of c3.marks) { const p = toPx(c3, m[0], m[1]); assert.ok(p[0] > 0 && p[0] < c3.w && p[1] > 0 && p[1] < c3.h, 'mark on canvas ' + p); }
assert.throws(() => P.packageCanvas(t, 72));

// session survives cleanSession unchanged in what matters
const s = P.makeSession(region, t, { ppi: 300, id: 'abc123xyz', at: '2026-11-16T10:00:00Z' });
const sc = cleanSession(JSON.parse(JSON.stringify(s)));
assert.ok(sc); assert.equal(sc.w, s.w); assert.equal(sc.calib, 3); assert.equal(sc.marks.length, 4); assert.equal(sc.layers.length, P.LAYERS.length);
assert.equal(s.name, 'Ankle wrap ABC123');

// layers: garden on top and editable, every reference locked, background hidden with the code
const L = P.psdLayers(s);
assert.equal(L.at(-1).name, 'Proposed garden'); assert.equal(L.at(-1).locked, false);
assert.ok(L.slice(0, -1).every((l) => l.locked));
assert.equal(L[0].name, 'Optional background (Ink Atlas ABC123)'); assert.ok(L[0].hidden);
assert.deepEqual(P.LAYERS.map((l) => l.name), ['Proposed garden', 'Existing cactus reference', 'Existing ink mask', 'Negative-space protection', 'Anatomical landmarks', 'Seam and alignment marks', 'Measurement grid', 'Optional background']);

// manifest
const man = P.manifest(s, region);
assert.equal(man.canvas.widthPx, s.w); assert.equal(man.canvas.ppi, 300); assert.equal(man.layers[0].file, '01-garden.png'); assert.equal(man.registration.length, 4);

// matching a document to its trip
const other = { ...s, id: 'zzzz99', w: 100, h: 50 };
assert.equal(P.matchSession([s, other], { w: 1, h: 1, names: ['Optional background (Ink Atlas ABC123)'] }).session.id, s.id);
assert.equal(P.matchSession([s, other], { w: s.w, h: s.h }).by, 'size');
assert.equal(P.matchSession([s, other], { w: Math.round(s.w / 2), h: Math.round(s.h / 2) }).by, 'shape');

// a marks layer drawn at canvas pixels, then resampled: square targets at the four mark spots
function marksPicture(W, H, k, t0, turn = 0, sy = 1) {
  const a = new Uint8Array(W * H), sizePx = P.MARK_MM * s.w / s.wMm;
  const cs = Math.cos(turn), sn = Math.sin(turn);
  for (const m of s.marks) {
    const [cx, cy] = toPx(s, m[0], m[1]);
    // picture px from canvas px: inverse of canvas = k * pic + t (plus an optional turn / stretch)
    const px = (cx - t0[0]) / k, py = (cy - t0[1]) / k / sy;
    const r = sizePx / 2 / k;
    for (let y = Math.floor(py - r * 1.5); y <= py + r * 1.5; y++) for (let x = Math.floor(px - r * 1.5); x <= px + r * 1.5; x++) {
      const dx = x - px, dy = y - py, rx = dx * cs + dy * sn, ry = -dx * sn + dy * cs;
      if (Math.abs(rx) <= r && Math.abs(ry) <= r && (Math.abs(rx) < r * 0.2 || Math.abs(ry) < r * 0.2 || Math.abs(Math.hypot(rx, ry) - r * 0.7) < r * 0.15)) {
        const X = Math.round(px + (x - px)), Y = Math.round(py + (y - py)); if (X >= 0 && Y >= 0 && X < W && Y < H) a[Y * W + X] = 255;
      }
    }
  }
  // a long seam line, which must not be taken for a target
  for (let y = 0; y < H; y++) a[y * W + Math.round(W / 2)] = 255;
  return a;
}

// exact
assert.equal(P.checkReturn(s, { w: s.w, h: s.h }).how, 'exact');
// resized to half, whole canvas
{
  const k = 2, W = Math.round(s.w / 2), H = Math.round(s.h / 2), a = marksPicture(W, H, k, [0, 0]);
  const f = P.findMarks(a, W, H, s.w / s.wMm / k); assert.ok(f, 'marks found at half size');
  const r = P.checkReturn(s, { w: W, h: H, found: f }); assert.equal(r.how, 'registered', r.why); assert.ok(Math.abs(r.k - 2) < 0.01, 'k ' + r.k);
  const piece = P.returnedPiece(s, r, W, H);
  assert.ok(Math.abs(piece.w - s.wMm) < 0.6, 'covers the canvas width ' + piece.w);
  console.log('half size:', r.why);
}
// cropped: 20 px off the left, 18 off the top, same scale
{
  const W = s.w - 40, H = s.h - 36, a = marksPicture(W, H, 1, [20, 18]);
  // the crop must keep all four marks in view for this to work
  const f = P.findMarks(a, W, H, s.w / s.wMm); assert.ok(f, 'marks found after crop');
  const r = P.checkReturn(s, { w: W, h: H, found: f }); assert.equal(r.how, 'registered', r.why); assert.ok(Math.abs(r.t[0] - 20) < 2 && Math.abs(r.t[1] - 18) < 2, 'shift ' + r.t);
  const piece = P.returnedPiece(s, r, W, H), full = P.returnedPiece(s, { k: 1, t: [0, 0] }, s.w, s.h);
  const mmPerPx = s.wMm / s.w;
  assert.ok(Math.abs((piece.x - piece.w / 2) - (full.x - full.w / 2) - 20 * mmPerPx) < 0.3, 'left edge moved by the crop');
  console.log('cropped:', r.why);
}
// stretched 3% taller: refused
{
  const W = s.w, H = Math.round(s.h * 1.03), a = marksPicture(W, H, 1, [0, 0], 0, 1 / 1.03);
  const f = P.findMarks(a, W, H, s.w / s.wMm);
  const r = P.checkReturn(s, { w: W, h: H, found: f }); assert.equal(r.how, 'refuse'); console.log('stretched:', r.why);
}
// no marks, different shape: refused; same shape: offered as scaled
assert.equal(P.checkReturn(s, { w: s.w - 100, h: s.h }).how, 'refuse');
assert.equal(P.checkReturn(s, { w: Math.round(s.w * 0.5), h: Math.round(s.h * 0.5) }).how, 'scaled');
assert.equal(P.checkReturn(null, { w: 1, h: 1 }).how, 'refuse');
// a stale trip
assert.ok(P.staleSession(s, { ...region, calib: 4 })); assert.ok(!P.staleSession(s, region));

// PSD: locks and resolution survive a write and read
{
  const W = 40, H = 20, px = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * 4 * 5; i += 4) { px[i] = 200; px[i + 3] = 255; }
  const blob = writePsd({ width: W, height: H, ppi: 300, merged: px, layers: [{ name: 'Locked ref', rgba: px, locked: true }, { name: 'Proposed garden', rgba: px }] });
  const back = readPsd(await blob.arrayBuffer());
  assert.equal(back.ppi, 300); assert.equal(back.layers[0].locked, true); assert.equal(back.layers[1].locked, false); assert.equal(back.layers[1].name, 'Proposed garden');
  const plain = readPsd(await writePsd({ width: W, height: H, merged: px, layers: [{ name: 'a', rgba: px }] }).arrayBuffer());
  assert.equal(plain.ppi, 0); assert.equal(plain.layers[0].locked, false);
}
// strip by strip packing reads back the same as packing whole
{
  const W = 37, H = 23, px = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < px.length; i++) px[i] = (i * 7919) % 251 > 120 ? (i * 13) % 256 : 0;
  const lp = new StripPacker(4), mp = new StripPacker(3);
  for (let y = 0; y < H; y += 6) { const rows = Math.min(6, H - y), part = px.subarray(y * W * 4, (y + rows) * W * 4); lp.add(part, W, rows); mp.add(part, W, rows); }
  const a = readPsd(await writePsd({ width: W, height: H, ppi: 600, merged: { packed: mp.packed }, layers: [{ name: 'S', packed: lp.packed, locked: true }] }).arrayBuffer());
  const L0 = a.layers[0];
  assert.equal(L0.right - L0.left, W); assert.equal(L0.bottom - L0.top, H); assert.ok(L0.locked); assert.equal(a.ppi, 600);
  for (let i = 0; i < W * H; i++) { assert.equal(L0.pixels[-1][i], px[i * 4 + 3]); assert.equal(L0.pixels[0][i], px[i * 4]); assert.equal(a.merged[2][i], px[i * 4 + 2]); }
}
console.log('PASS procreate package');
// the higher choice fits an iPad canvas
{ const hp = P.highPpi(t), c = P.packageCanvas(t, hp); assert.ok(hp >= 300 && c.w * c.h <= P.MAX_PIXELS, 'high ' + hp + ' ' + c.w * c.h); console.log('higher PPI for the ankle', hp, c.w, 'x', c.h); }
