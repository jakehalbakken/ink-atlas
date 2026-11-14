// Reading Procreate's own file: binary plists, keyed archives, LZO1X and LZ4 tiles, layers
// of a 3D painting (each material layer's colour layer, the composite left out), hidden
// layers, rows from the bottom, edge tiles, premultiplied pixels, and the 2D layout.
import assert from 'node:assert/strict';
import { readBplist, unarchive, lzo1x, lz4Frames, readProcreate } from '../../src/procreate-file.js';
import { bplist, keyedArchive, lzo1x as packLzo, lz4Frame, procreateFile } from '../procreate-fixture.mjs';

// plists and keyed archives
const pl = readBplist(bplist({ a: 1, b: [true, false, null, 2.5, 'héllo', 'plain'], c: { d: 70000 } }));
assert.deepEqual(pl, { a: 1, b: [true, false, null, 2.5, 'héllo', 'plain'], c: { d: 70000 } });
const doc = unarchive(readBplist(keyedArchive({ $class: 'SilicaDocument', size: '{10, 20}', tileSize: 256, layers: [{ $class: 'SilicaLayer', UUID: 'A', name: 'Rose', hidden: false }] })));
assert.equal(doc.$class, 'SilicaDocument'); assert.equal(doc.size, '{10, 20}'); assert.equal(doc.layers[0].name, 'Rose'); assert.equal(doc.layers[0].UUID, 'A');

// compression round trips: runs, repeats near and far, and random bytes
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
const cases = [];
cases.push(new Uint8Array(0x10000).fill(0));
cases.push(Uint8Array.from({ length: 5000 }, () => (rnd() * 256) | 0));
const mix = new Uint8Array(262144); for (let i = 0; i < mix.length; i++) mix[i] = i < 300 ? (rnd() * 256) | 0 : rnd() < 0.7 ? mix[i - 1 - ((rnd() * (rnd() < 0.5 ? 8 : rnd() < 0.5 ? 2000 : 40000)) | 0) % Math.min(i, 49000)] : (rnd() * 256) | 0; cases.push(mix);
const tile = new Uint8Array(256 * 256 * 4); for (let p = 0; p < 65536; p++) if (Math.hypot((p % 256) - 128, (p >> 8) - 128) < 60) tile.set([200, 30, 40, 255], p * 4); cases.push(tile);
cases.push(Uint8Array.from([1, 2, 3, 1, 2, 3, 1, 2, 3, 9, 9]));
for (const c of cases) {
  assert.deepEqual(lzo1x(packLzo(c), c.length), c, 'LZO1X round trip of ' + c.length);
  assert.deepEqual(lz4Frames(lz4Frame(c), c.length), c, 'LZ4 round trip of ' + c.length);
}
assert.throws(() => lzo1x(Uint8Array.from([0x30, 0xff, 0xff]), 100), /damaged/, 'a reference before the start is refused');

// a 3D painting, 600 x 520 (edge tiles cut short), three layers, one hidden
const W = 600, H = 520, px = () => new Uint8ClampedArray(W * H * 4);
const base = px(); for (let p = 0; p < W * H; p++) base.set([224, 179, 148, 255], p * 4);
const rose = px(); for (let y = 20; y < 60; y++) for (let x = 500; x < 590; x++) rose.set([200, 20, 40, 255], (y * W + x) * 4);
for (let x = 500; x < 590; x++) rose.set([200, 20, 40, 128], (60 * W + x) * 4); // a half-covered row
const script = px(); for (let y = 480; y < 515; y++) for (let x = 10; x < 120; x++) script.set([20, 20, 20, 255], (y * W + x) * 4);
const ghost = px(); for (let y = 200; y < 220; y++) for (let x = 200; x < 220; x++) ghost.set([0, 0, 255, 255], (y * W + x) * 4);
const file = procreateFile({ width: W, height: H, layers: [
  { uuid: 'AAAAAAAA-1', name: 'Rose', pixels: rose }, { uuid: 'AAAAAAAA-2', name: 'Script', pixels: script },
  { uuid: 'AAAAAAAA-3', name: 'Ghost', hidden: true, pixels: ghost }, { uuid: 'AAAAAAAA-4', name: 'Layer 1', pixels: base },
], composite: { uuid: 'AAAAAAAA-C', pixels: base } });
const r = await readProcreate(file);
assert.equal(r.three, true); assert.equal(r.width, W); assert.equal(r.height, H);
assert.deepEqual(r.layers.map((l) => [l.name, l.hidden]), [['Rose', false], ['Script', false], ['Ghost', true], ['Layer 1', false]], 'colour layers, composite left out');
assert.equal(r.composite.length, 1);
const at = (d, S, x, y) => [...d.subarray(((Math.floor(y * S / H)) * S + Math.floor(x * S / W)) * 4, ((Math.floor(y * S / H)) * S + Math.floor(x * S / W)) * 4 + 4)];
const S = 300; // half size
const R = await r.layers[0].read(S), Sc = await r.layers[1].read(S), B = await r.layers[3].read(S);
assert.deepEqual(at(R, S, 540, 40), [200, 20, 40, 255], 'rose where it was painted, rows from the top');
assert.deepEqual(at(R, S, 100, 40), [0, 0, 0, 0], 'clear elsewhere');
assert.deepEqual(at(R, S, 540, 500), [0, 0, 0, 0], 'not upside down');
const R2 = await r.layers[0].read(H), half = at(R2, H, 541, 60); assert.ok(half[3] > 100 && half[3] < 160 && Math.abs(half[0] - 200) <= 3, 'a soft edge keeps its colour (not premultiplied): ' + half);
assert.deepEqual(at(Sc, S, 60, 500), [20, 20, 20, 255], 'script in the last (cut short) row of tiles');
assert.deepEqual(at(B, S, 300, 300), [224, 179, 148, 255], 'the base layer is skin everywhere');
assert.deepEqual(at(B, S, 599, 519), [224, 179, 148, 255], 'to the far corner');

// a 2D document reads its layers list
const flat = await readProcreate(procreateFile({ width: 300, height: 300, three: false, layers: [{ uuid: 'BBBBBBBB-1', name: 'Ink', pixels: Uint8ClampedArray.from({ length: 300 * 300 * 4 }, (_, i) => (i % 4 === 3 ? 255 : 10)) }] }));
assert.equal(flat.three, false); assert.deepEqual(flat.layers.map((l) => l.name), ['Ink']);
const up = await flat.layers[0].read(700); assert.ok(up.every((v, i) => i % 4 !== 3 || v === 255), "a small document scaled up leaves no pixel empty");
await assert.rejects(() => readProcreate(procreateFile({ width: 0, height: 0, layers: [] })), /could not be read/);
console.log('PASS procreate-file-unit: plists, keyed archives, LZO1X and LZ4 tiles, 3D layers apart, hidden layers, edge tiles, rows from the bottom, soft edges, 2D documents');
