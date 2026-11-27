import assert from 'node:assert/strict';
const saved = Uint8Array.fromBase64; delete Uint8Array.fromBase64;
const { b64bytes, b64typed } = await import('../../src/b64.js');
for (let n = 0; n < 300; n++) {
  const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = (i * 37 + n * 11) & 255;
  const s = Buffer.from(a).toString('base64');
  assert.deepEqual([...b64bytes(s)], [...a], 'length ' + n);
  assert.deepEqual([...b64bytes(s.replace(/=+$/, ''))], [...a], 'no padding ' + n);
}
const f = new Float32Array([1.5, -2.25, 3e-7, 1e9]);
assert.deepEqual([...b64typed(Buffer.from(f.buffer).toString('base64'), Float32Array)], [...f]);
const d = new Float64Array([Math.PI, -1e-300]);
assert.deepEqual([...b64typed(Buffer.from(d.buffer).toString('base64'), Float64Array)], [...d]);
if (saved) Uint8Array.fromBase64 = saved;
console.log('b64-unit ok');
