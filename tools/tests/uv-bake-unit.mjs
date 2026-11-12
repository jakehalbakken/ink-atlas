// The baked UVs line up with the body's triangles: each triangle's shape on the
// texture matches its shape on the body (MakeHuman's UVs are close to angle
// preserving), which a wrong corner order or face order would destroy.
import assert from 'node:assert/strict';
import { BASE, INDEX } from '../../src/mesh.js';
import { UV_TRIS, UV_BODY_TRIS } from '../../src/body-uv.js';
import { bodyCornerUVs, dilate } from '../../src/uv-bake.js';

const uv = bodyCornerUVs();
assert.equal(UV_TRIS, INDEX.length / 3, 'one UV triangle per body and eye triangle');
assert.equal(uv.length, UV_TRIS * 6);
assert.ok(uv.every((v) => v >= 0 && v <= 1));

const shape = (map) => {
  const errs = [];
  for (let t = 0; t < UV_BODY_TRIS; t++) {
    const p = [0, 1, 2].map((j) => { const v = INDEX[t * 3 + j]; return [BASE[v * 3], BASE[v * 3 + 1], BASE[v * 3 + 2]]; });
    const q = [0, 1, 2].map((j) => { const c = map(t, j); return [uv[c * 2], uv[c * 2 + 1]]; });
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const r3 = d3(p[0], p[1]) / d3(p[1], p[2]), r2 = d2(q[0], q[1]) / d2(q[1], q[2]);
    if (Number.isFinite(r3) && Number.isFinite(r2) && r3 > 0 && r2 > 0) errs.push(Math.abs(Math.log(r3 / r2)));
  }
  errs.sort((a, b) => a - b); return errs[errs.length >> 1];
};
const right = shape((t, j) => t * 3 + j);
const shifted = shape((t, j) => ((t + 1) % UV_BODY_TRIS) * 3 + j);
const rotated = shape((t, j) => t * 3 + (j + 1) % 3);
assert.ok(right < 0.08, `triangle shapes match on body and texture (median log error ${right.toFixed(3)})`);
assert.ok(shifted > right * 3 && rotated > right * 3, `a misaligned order would show (${shifted.toFixed(3)}, ${rotated.toFixed(3)})`);

// dilate grows colour outward and leaves covered pixels alone
{
  const w = 8, h = 8, px = new Uint8ClampedArray(w * h * 4);
  px.set([200, 10, 10, 255], (3 * w + 3) * 4);
  dilate(px, w, h, 2);
  assert.deepEqual([...px.slice((3 * w + 3) * 4, (3 * w + 3) * 4 + 4)], [200, 10, 10, 255]);
  assert.equal(px[(3 * w + 5) * 4 + 3], 255, 'two steps out filled');
  assert.equal(px[(3 * w + 6) * 4 + 3], 0, 'three steps out still empty');
  assert.equal(px[(3 * w + 5) * 4], 200);
}
console.log(`PASS uv bake: ${UV_TRIS} triangles aligned (median shape error ${right.toFixed(3)} vs ${shifted.toFixed(3)} misaligned), dilation`);
