// Reading scan files (scan-load.js): a GLB with the mesh under a moved node, and an OBJ in cm
// wound the other way round, both with a patch of floor; and a file that is not a scan.
// node tools/tests/scan-load-unit.mjs
import assert from 'node:assert/strict';
import { readScan } from '../../src/scan-load.js';
import { personScan, glb, obj } from './scan-fixture.mjs';

const file = (name, data) => ({ name, arrayBuffer: async () => { const b = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
const mesh = personScan();
const span = (pts, k) => { let lo = Infinity, hi = -Infinity; for (let i = k; i < pts.length; i += 3) { lo = Math.min(lo, pts[i]); hi = Math.max(hi, pts[i]); } return [lo, hi]; };
const outward = (s) => { const n = s.pts.length / 3, c = [0, 1, 2].map((k) => { let a = 0; for (let i = k; i < s.pts.length; i += 3) a += s.pts[i]; return a / n; }); let pos = 0; for (let i = 0; i < n; i++) { let d = 0; for (let k = 0; k < 3; k++) d += s.nrm[i * 3 + k] * (s.pts[i * 3 + k] - c[k]); if (d > 0) pos++; } return pos / n; };

const a = await readScan(file('me.glb', glb(mesh)), { points: 60000 });
assert.equal(a.kind, 'glb'); assert.ok(a.dropped > 1000, 'the floor is dropped: ' + a.dropped);
const [x0, x1] = span(a.pts, 0); assert.ok(x0 > -0.7 && x1 < 1.5, 'the node moved the mesh back to where it was: ' + [x0, x1]);
const [z0, z1] = span(a.pts, 2); assert.ok(Math.abs(z1 - z0 - 1.83) < 0.03, 'its height along z, in metres: ' + (z1 - z0));
assert.ok(outward(a) > 0.7, 'normals face out');

const b = await readScan(file('me.obj', obj(mesh)), { points: 60000 });
assert.equal(b.kind, 'obj'); assert.ok(b.dropped > 1000, 'the floor is dropped from the OBJ');
const [w0, w1] = span(b.pts, 2); assert.ok(Math.abs(w1 - w0 - 183) < 3, 'centimetres kept: ' + (w1 - w0));
assert.ok(outward(b) > 0.7, 'an inside-out OBJ is turned to face out');

await assert.rejects(readScan(file('notes.txt', 'hello there')), /not a 3D scan/);
await assert.rejects(readScan(file('tiny.obj', 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3')), /too little/);
console.log(`PASS scan-load-unit: GLB ${a.pts.length / 3} points (${a.dropped} floor dropped), OBJ ${b.pts.length / 3}`);
