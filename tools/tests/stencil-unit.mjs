// Stencil maths: a filled shape becomes its outline, a thin stroke stays whole, two colours
// meeting inside the ink get a line, specks and light shading drop out, white paper and
// see-through pixels are paper, the picture size follows real size, and the PNG keeps its dpi.
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { inkAmount, stencilLines, stencilPixels, stencilScale, pngWithDpi } from '../../src/stencil.js';

const W = 200, H = 200;
const art = () => { const a = new Uint8ClampedArray(W * H * 4); for (let p = 0; p < W * H; p++) a.set([255, 255, 255, 255], p * 4); return a; };
const put = (a, x, y, c) => a.set(c, (y * W + x) * 4);
const at = (L, x, y) => L[y * W + x];

// paper, see-through and ink
const tiny = Uint8ClampedArray.from([255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 255, 255, 220, 0, 255]);
const ia = inkAmount(tiny, 4, 1);
assert.equal(ia[0], 0, 'white paper'); assert.equal(ia[1], 0, 'see-through'); assert.equal(ia[2], 1, 'black');
assert.ok(ia[3] > 0.9, 'yellow counts as ink');

// a filled disc becomes a ring; a thin stroke stays whole
let a = art();
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - 70, y - 100) < 40) put(a, x, y, [20, 20, 20, 255]);
for (let y = 30; y < 170; y++) for (let x = 160; x < 163; x++) put(a, x, y, [10, 10, 10, 255]);
let r = stencilLines(a, W, H, { line: 4 });
assert.equal(at(r.lines, 70, 100), 0, 'inside of the disc is empty');
assert.equal(at(r.lines, 70 - 38, 100), 1, 'edge of the disc is a line');
assert.equal(at(r.lines, 70, 100 - 38), 1, 'top edge too');
assert.equal(at(r.lines, 5, 5), 0, 'paper stays white');
for (const y of [40, 100, 160]) assert.equal(at(r.lines, 161, y), 1, 'thin stroke kept whole at ' + y);
assert.ok(r.linePixels < r.inkPixels / 2, 'far less black than the fill: ' + r.linePixels + ' of ' + r.inkPixels);
// a bold line (12 px, under the solid width of 16) stays solid; a wide bar becomes an outline
a = art();
for (let y = 40; y < 52; y++) for (let x = 20; x < 180; x++) put(a, x, y, [0, 0, 0, 255]);
for (let y = 100; y < 160; y++) for (let x = 20; x < 180; x++) put(a, x, y, [0, 0, 0, 255]);
r = stencilLines(a, W, H, { line: 4 });
for (const y of [41, 45, 50]) assert.equal(at(r.lines, 100, y), 1, 'bold line solid at ' + y);
assert.equal(at(r.lines, 100, 130), 0, 'wide bar hollow'); assert.equal(at(r.lines, 100, 101), 1, 'wide bar edge');
assert.equal(at(r.lines, 21, 130), 1, 'wide bar end edge');

// two colours meeting inside: a line where red meets blue
a = art();
for (let y = 50; y < 150; y++) for (let x = 40; x < 160; x++) put(a, x, y, x < 100 ? [210, 20, 30, 255] : [20, 40, 200, 255]);
r = stencilLines(a, W, H, { line: 4 });
assert.ok(at(r.lines, 99, 100) || at(r.lines, 100, 100), 'line where the colours meet');
assert.equal(at(r.lines, 70, 100), 0, 'inside the red is empty'); assert.equal(at(r.lines, 130, 100), 0, 'inside the blue is empty');
// the same colours only shaded (close in colour) get no inside line
a = art();
for (let y = 50; y < 150; y++) for (let x = 40; x < 160; x++) put(a, x, y, x < 100 ? [40, 40, 40, 255] : [70, 70, 70, 255]);
r = stencilLines(a, W, H, { line: 4 });
assert.equal(at(r.lines, 100, 100), 0, 'close shades make no inside line');

// specks and light shading
a = art();
put(a, 20, 20, [0, 0, 0, 255]); put(a, 21, 20, [0, 0, 0, 255]);
for (let y = 100; y < 160; y++) for (let x = 100; x < 160; x++) put(a, x, y, [215, 215, 215, 255]);
r = stencilLines(a, W, H, { line: 4, detail: 0.3 });
assert.equal(at(r.lines, 20, 20), 0, 'a speck is dropped');
assert.equal(r.inkPixels, 0, 'light grey is left out at low detail');
r = stencilLines(a, W, H, { line: 4, detail: 1 });
assert.ok(r.inkPixels > 3000 && at(r.lines, 100, 130) === 1, 'and kept at full detail');

// pixels
const px = stencilPixels(Uint8Array.from([1, 0]), 2, 1);
assert.deepEqual([...px], [0, 0, 0, 255, 255, 255, 255, 255]);

// size: 3 x 2 inches at 300 dpi, a big piece capped
const s = stencilScale(3, 2); assert.equal(s.w, 900); assert.equal(s.h, 600); assert.equal(s.dpi, 300); assert.equal(s.line, 5); assert.equal(s.solid, 47);
const b = stencilScale(20, 10); assert.ok(b.w * b.h <= 6e6 && b.w <= 4000 && Math.abs(b.w / b.h - 2) < 0.01, 'a big piece is capped: ' + b.w + ' x ' + b.h);
const n = stencilScale(14, 2); assert.equal(n.w, 4000, 'a long thin piece is capped on its long side');

// PNG print size: a minimal real PNG gets a pHYs chunk with a good CRC
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (u) => { let c = ~0; for (const x of u) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (type, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8); out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length); return out; };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('pHYs', Buffer.alloc(9)), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 0]))), chunk('IEND', Buffer.alloc(0))]);
const out = Buffer.from(pngWithDpi(new Uint8Array(png), 300));
const types = []; for (let p = 8; p < out.length;) { const len = out.readUInt32BE(p), t = out.toString('ascii', p + 4, p + 8); types.push(t); assert.equal(out.readUInt32BE(p + 8 + len), crc(out.subarray(p + 4, p + 8 + len)), 'CRC of ' + t); if (t === 'pHYs') { assert.equal(out.readUInt32BE(p + 8), 11811); assert.equal(out[p + 16], 1); } p += 12 + len; }
assert.deepEqual(types, ['IHDR', 'pHYs', 'IDAT', 'IEND'], 'one pHYs, right after the header');
assert.deepEqual(pngWithDpi(Uint8Array.from([1, 2, 3]), 300), Uint8Array.from([1, 2, 3]), 'not a PNG: left alone');
console.log('PASS stencil-unit: fills become outlines, thin strokes whole, colour edges, specks and shading, size, PNG dpi');
