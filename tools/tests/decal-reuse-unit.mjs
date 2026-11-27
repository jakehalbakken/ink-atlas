// A drag lays the piece again on every move of the finger. Since 2026-11-25 each laying made fresh
// arrays the size of the whole body, over a megabyte a move, which piled up faster than the iPad
// cleared it while it also held the project's pictures (2026-11-27, Jake: placing a new tattoo the
// page "keeps refreshing"). The arrays are now kept from one laying to the next. This checks that a
// piece comes out exactly the same whatever was laid before it (stencil and the stretched-skin
// fallback both, bent, tapered and warped), and that after the first laying no whole-body array is
// made again. Before the change: about 11 whole-body arrays a laying.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRestRig } from '../../src/pose.js';
import { INDEX, COUNTS } from '../../src/mesh.js';

// count the typed arrays made the size of the whole body (a slot per vertex or triangle), from here on
const VERTS = createRestRig({ figure: 'male' }).positions.length / 3, TRIS = INDEX.length / 3;
const WHOLE = new Set([VERTS, VERTS * 2, VERTS * 6, TRIS]);
let big = 0;
for (const name of ['Float64Array', 'Float32Array', 'Int32Array', 'Uint8Array', 'Uint32Array']) {
  const Base = globalThis[name];
  globalThis[name] = class extends Base { constructor(...a) { super(...a); if (WHOLE.has(this.length)) big++; } };
}
const { buildAdjacency, buildDecal } = await import('../../src/decal.js');

const rest = createRestRig({ figure: 'male' }), P = rest.positions;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
geo.setIndex(new THREE.BufferAttribute(INDEX.slice(), 1)); geo.computeVertexNormals();
const N = geo.attributes.normal.array, I = geo.index.array, adj = buildAdjacency(I);
const triOfV = new Int32Array(P.length / 3).fill(-1);
for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) if (triOfV[I[t * 3 + k]] < 0) triOfV[I[t * 3 + k]] = t;
const frameOf = (n0, rot) => {
  const n = new THREE.Vector3(...n0).normalize(), ref = Math.abs(n.y) > 0.93 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(ref, n).normalize(), y = new THREE.Vector3().crossVectors(n, x).normalize();
  return { right: x.clone().multiplyScalar(Math.cos(rot)).addScaledVector(y, Math.sin(rot)), up: y.clone().multiplyScalar(Math.cos(rot)).addScaledVector(x, -Math.sin(rot)) };
};
const pieces = [];
for (let v = 11, i = 0; v < COUNTS.body; v += 61, i++) {
  if (triOfV[v] < 0) continue;
  const n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
  pieces.push({ tri: triOfV[v], n, rot: (i % 7) * 0.4, box: i % 9 === 0 ? [-0.1, 0.05, 1.15, 0.9] : null,
    t: { pos: [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], normal: n, width: [0.06, 0.11, 0.2, 0.32][i % 4], aspect: [1, 1.6, 0.7][i % 3], rot: 0, bend: i % 5 === 0 ? 0.4 : 0, taper: i % 6 === 0 ? -0.3 : 0 } });
}
const lay = (p) => buildDecal(geo, adj, p.t, frameOf(p.n, p.rot), p.tri, null, p.box);
const sig = (d) => [d.positions.length, Array.from(d.uvs).join(','), Array.from(d.tris).join(',')].join('|');

lay(pieces[0]); // the first laying makes the kept arrays
big = 0;
const forward = pieces.map((p) => sig(lay(p)));
const madeBig = big;
const backward = pieces.slice().reverse().map((p) => sig(lay(p))).reverse();
let differ = 0; forward.forEach((s, i) => { if (s !== backward[i]) differ++; });
const t0 = performance.now(); for (const p of pieces) lay(p); const ms = (performance.now() - t0) / pieces.length;
console.log(`decal-reuse-unit: ${pieces.length} pieces, ${differ} differ by order, ${madeBig} whole-body arrays made after the first, ${ms.toFixed(2)} ms a piece`);
assert.equal(differ, 0, 'a piece comes out the same whatever was laid before it');
assert.ok(madeBig <= pieces.length * 0.05, `no whole-body arrays made on each laying (made ${madeBig})`);
console.log('PASS decal-reuse-unit');
