// A piece pulled from the armpit onto the bicep stays whole (2026-11-25, Jake: "when I try to like
// pull a design that I want to wrap up like my armpit and over to my bicep, it like kind of cuts
// out"). The stencil used to be unfolded triangle by triangle; across curved skin two unfoldings
// reached the same triangle different ways, disagreed, and the triangle was left out: bare
// triangles in the middle of the ink. Now every vertex gets one flat place (placeFlat), so the
// skin inside the picture is all drawn. A very wide piece at the top of the upper arm used to be
// laid as a sleeve and cut off in a straight line where the arm meets the body; it now carries on.
// Before the fix this check failed 18 ways: round the armpit 82 of 224 pieces whole, 1487 bare
// triangles inside the picture in 118 of them, a 20 cm piece with 0.59 of its picture drawn; a 12 cm
// piece on the chest at 0.91; 34 to 38 of 138 pieces over the body not whole and some stretched
// a tenth of their skin by more than a quarter, for every shape. A piece took about 1 ms then, 3 now.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRestRig, vertexBones, POSE_BONES } from '../../src/pose.js';
import { INDEX, COUNTS } from '../../src/mesh.js';
import { buildAdjacency, buildDecal } from '../../src/decal.js';

const LIMBS = [
  ['armL', 'L', ['upperarm01', 'lowerarm01', 'wrist'], /^(upperarm|lowerarm)0[12]\.L$/, /^(wrist|metacarpal|finger|thumb)[^.]*\.L$/],
  ['armR', 'R', ['upperarm01', 'lowerarm01', 'wrist'], /^(upperarm|lowerarm)0[12]\.R$/, /^(wrist|metacarpal|finger|thumb)[^.]*\.R$/],
  ['legL', 'L', ['upperleg01', 'lowerleg01', 'foot'], /^(upperleg|lowerleg)0[12]\.L$/, /^(foot|toe)[^.]*\.L$/],
  ['legR', 'R', ['upperleg01', 'lowerleg01', 'foot'], /^(upperleg|lowerleg)0[12]\.R$/, /^(foot|toe)[^.]*\.R$/],
];
function body(shape) {
  const rest = createRestRig(shape), P = rest.positions;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  geo.setIndex(new THREE.BufferAttribute(INDEX.slice(), 1)); geo.computeVertexNormals();
  const N = geo.attributes.normal.array, I = geo.index.array, adj = buildAdjacency(I);
  const top = (v) => { let b = '', w = -1; for (const [n, x] of vertexBones(v)) if (x > w) { w = x; b = n; } return b; };
  const tops = Array.from({ length: COUNTS.body }, (_, i) => top(i));
  const limbs = LIMBS.map(([key, side, bones, kre, ere]) => {
    const keep = new Uint8Array(COUNTS.body); for (let i = 0; i < COUNTS.body; i++) keep[i] = kre.test(tops[i]) ? 1 : ere.test(tops[i]) ? 2 : 0;
    const at = (n) => { const b = POSE_BONES.find((x) => x.name === `${n}.${side}`); return [0, 1, 2].map((i) => rest.joints[b.head * 3 + i]); };
    return { key, kre, at, limb: { key, joints: bones.map(at), keep, rest: P, ver: 1 } };
  });
  const triOf = (v) => { for (let t = 0; t < I.length / 3; t++) if (I[t * 3] === v) return t; return -1; };
  const limbAt = (tri) => { const L = limbs.find((l) => l.kre.test(tops[I[tri * 3]])); return L ? { ...L.limb } : null; };
  return { P, N, I, geo, adj, tops, limbs, triOf, limbAt };
}
function frameOf(n, rot) {
  n = new THREE.Vector3(...n).normalize(); const ref = Math.abs(n.y) > 0.93 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(ref, n).normalize(), y = new THREE.Vector3().crossVectors(n, x).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n)); q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rot));
  return { right: new THREE.Vector3(1, 0, 0).applyQuaternion(q), up: new THREE.Vector3(0, 1, 0).applyQuaternion(q) };
}
const M = 0.04, S = 0.92; // UV_MARGIN and the span inside it
// share of the picture (a 40 x 40 grid over it) that lands on drawn skin
function coverage(d, n = 40) {
  const hit = new Uint8Array(n * n), U = d.uvs;
  for (let k = 0; k < d.tris.length; k++) {
    const ax = (U[k * 6] - M) / S, ay = (U[k * 6 + 1] - M) / S, bx = (U[k * 6 + 2] - M) / S, by = (U[k * 6 + 3] - M) / S, cx = (U[k * 6 + 4] - M) / S, cy = (U[k * 6 + 5] - M) / S;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (!den) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) * n)), x1 = Math.min(n - 1, Math.ceil(Math.max(ax, bx, cx) * n)), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) * n)), y1 = Math.min(n - 1, Math.ceil(Math.max(ay, by, cy) * n));
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      const px = (i + 0.5) / n, py = (j + 0.5) / n, l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l1 + l2 <= 1 + 1e-6) hit[j * n + i] = 1;
    }
  }
  let c = 0; for (const x of hit) c += x; return c / (n * n);
}
// bare triangles inside the picture: not drawn, though all three corners are drawn well inside it
function holes(B, d) {
  const T = B.I.length / 3, drawn = new Uint8Array(T), inside = new Uint8Array(B.P.length / 3); for (const x of d.tris) drawn[x] = 1;
  for (let k = 0; k < d.supports.length; k++) { const u = (d.uvs[k * 2] - M) / S, v = (d.uvs[k * 2 + 1] - M) / S; if (u > 0.03 && u < 0.97 && v > 0.03 && v < 0.97) inside[d.supports[k]] = 1; }
  let n = 0; for (let t = 0; t < T; t++) if (!drawn[t] && inside[B.I[t * 3]] && inside[B.I[t * 3 + 1]] && inside[B.I[t * 3 + 2]]) n++;
  return n;
}
// length on the picture over length on the skin, for every drawn edge: p10 and p90
function stretch(B, d, w, h) {
  const rs = [], W = w / S, H = h / S, P = B.P;
  for (let k = 0; k < d.tris.length * 3; k += 3) for (let e = 0; e < 3; e++) {
    const i = k + e, j = k + (e + 1) % 3, a = d.supports[i], b = d.supports[j];
    const l3 = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
    rs.push(Math.hypot((d.uvs[i * 2] - d.uvs[j * 2]) * W, (d.uvs[i * 2 + 1] - d.uvs[j * 2 + 1]) * H) / l3);
  }
  rs.sort((a, b) => a - b); return [rs[Math.floor(rs.length * 0.1)], rs[Math.floor(rs.length * 0.9)]];
}
const place = (B, v, width, aspect, rot, box = null, limb = true) => {
  const tri = B.triOf(v), pos = [B.P[v * 3], B.P[v * 3 + 1], B.P[v * 3 + 2]], n = [B.N[v * 3], B.N[v * 3 + 1], B.N[v * 3 + 2]];
  const t = { pos, normal: n, width, aspect, rot };
  return { d: buildDecal(B.geo, B.adj, t, frameOf(n, rot), tri, limb ? B.limbAt(tri) : null, box), pos, tri };
};
const report = [];
const B = body({ figure: 'male' });

// 1. round the right armpit: every vertex within 8 cm of its hollow, pieces 6 to 20 cm, two turns
{
  const armR = B.limbs.find((l) => l.key === 'armR'), sh = armR.at('upperarm01'), c = [sh[0] + 0.01, sh[1] - 0.09, sh[2]];
  let n = 0, whole = 0, bare = 0, withBare = 0, worst = 1, sum = 0;
  for (let v = 0; v < COUNTS.body; v += 3) {
    if (Math.hypot(B.P[v * 3] - c[0], B.P[v * 3 + 1] - c[1], B.P[v * 3 + 2] - c[2]) > 0.08 || B.triOf(v) < 0) continue;
    for (const width of [0.06, 0.1, 0.14, 0.2]) for (const rot of [0, 1.2]) {
      const { d } = place(B, v, width, 1, rot), cv = coverage(d), hb = holes(B, d);
      n++; sum += cv; if (cv > 0.995) whole++; worst = Math.min(worst, cv); bare += hb; if (hb) withBare++;
    }
  }
  assert.ok(n > 200, `placements round the armpit (${n})`);
  assert.ok(whole >= 0.9 * n, `nearly every piece round the armpit is drawn whole (${whole} of ${n})`);
  assert.ok(sum / n > 0.995, `on average all of the picture is drawn (${(sum / n).toFixed(4)})`);
  assert.ok(worst > 0.9, `no piece loses a big part of its picture, the 20 cm ones included (worst ${worst.toFixed(3)})`);
  assert.ok(bare <= 160 && withBare <= 0.2 * n, `hardly any bare triangle inside the picture (${bare}, 1487 before the fix, in ${withBare} of ${n})`);
  report.push(`armpit: whole ${whole}/${n}, worst ${worst.toFixed(3)}, bare ${bare} in ${withBare}`);
}

// 2. the usual spots stay whole and true to size
{
  const spots = { chest: [-0.08, 1.30, 0.12], belly: [0, 1.05, 0.13], back: [0, 1.25, -0.12], outerArm: [-0.25, 1.30, 0.0], forearm: [-0.40, 1.05, 0.05], armpit: [-0.179, 1.305, 0.018] };
  for (const [name, p] of Object.entries(spots)) {
    let v = -1, bd = 1e9; for (let i = 0; i < COUNTS.body; i++) { const dd = Math.hypot(B.P[i * 3] - p[0], B.P[i * 3 + 1] - p[1], B.P[i * 3 + 2] - p[2]); if (dd < bd && B.triOf(i) >= 0) { bd = dd; v = i; } }
    for (const width of [0.06, 0.12]) {
      const { d } = place(B, v, width, 1, 0.3, null, false), cv = coverage(d), [lo, hi] = stretch(B, d, width, width);
      assert.ok(cv > 0.995, `${name} ${width * 100} cm: drawn whole (${cv.toFixed(3)})`);
      assert.ok(lo > 0.85 && hi < 1.15, `${name} ${width * 100} cm: true to size (${lo.toFixed(3)} to ${hi.toFixed(3)})`);
    }
  }
}

// 3. a bent, tapered or warped piece fills its box the same way
{
  for (const [p, name] of [[[-0.08, 1.30, 0.12], 'chest'], [[-0.179, 1.305, 0.018], 'armpit']]) {
    let v = -1, bd = 1e9; for (let i = 0; i < COUNTS.body; i++) { const dd = Math.hypot(B.P[i * 3] - p[0], B.P[i * 3 + 1] - p[1], B.P[i * 3 + 2] - p[2]); if (dd < bd && B.triOf(i) >= 0) { bd = dd; v = i; } }
    for (const box of [[-0.2, -0.1, 1.2, 1.1], [0.3, 0.3, 1.4, 1.2]]) {
      const cv = coverage(place(B, v, 0.1, 1, 0.3, box).d);
      assert.ok(cv > 0.99, `${name} warped into ${box}: the warped picture is drawn whole (${cv.toFixed(3)})`);
    }
  }
}

// 4. a band round the middle of the upper arm is still laid as a sleeve, and still whole
{
  const armL = B.limbs.find((l) => l.key === 'armL'), sh = armL.at('upperarm01'), el = armL.at('lowerarm01');
  const ax = new THREE.Vector3(el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]).normalize();
  let v = -1, bd = 1e9;
  for (let i = 0; i < COUNTS.body; i++) { if (!/^upperarm0[12]\.L$/.test(B.tops[i]) || B.N[i * 3 + 2] < 0.6) continue; const dd = Math.abs(B.P[i * 3 + 1] - 1.27) + 0.3 * Math.abs(B.P[i * 3] - 0.27); if (dd < bd && B.triOf(i) >= 0) { bd = dd; v = i; } }
  const n = [B.N[v * 3], B.N[v * 3 + 1], B.N[v * 3 + 2]];
  let rot = 0, bs = 1e9; for (let k = 0; k < 12; k++) { const s = Math.abs(frameOf(n, k * Math.PI / 12).right.dot(ax)); if (s < bs) { bs = s; rot = k * Math.PI / 12; } }
  const { d } = place(B, v, 0.25, 4, rot);
  assert.ok(d.sleeve, 'a band right round the middle of the upper arm is a sleeve');
  assert.ok(coverage(d) > 0.97, `and drawn whole (${coverage(d).toFixed(3)})`);
}

// 5. all over the body, for several shapes: whole, true to size, never reaching far past the picture,
//    and quick to lay
for (const [label, shape] of [['male', { figure: 'male' }], ['female', { figure: 'female' }], ['muscular', { figure: 'male', muscle: 0.9 }]]) {
  const Bs = label === 'male' ? B : body(shape);
  let n = 0, low = 0, off = 0, far = 0, ms = 0;
  for (let v = 0; v < COUNTS.body; v += 97) {
    // the face (its openings), fingers and toes are not skin a picture covers whole
    if (/finger|thumb|metacarpal|toe|eye|jaw|tongue|teeth|head|neck/.test(Bs.tops[v]) || Bs.triOf(v) < 0) continue;
    for (const [w, asp, rot] of [[0.05, 1, 0], [0.09, 0.7, 0.6], [0.14, 1.4, 1.5]]) {
      const t0 = performance.now(), { d, pos } = place(Bs, v, w, asp, rot); ms += performance.now() - t0;
      if (d.sleeve) continue;
      n++;
      if (coverage(d) < 0.97) low++;
      const [lo, hi] = stretch(Bs, d, w, w / asp); if (lo < 0.8 || hi > 1.25) off++;
      let reach = 0; for (const s of d.supports) reach = Math.max(reach, Math.hypot(Bs.P[s * 3] - pos[0], Bs.P[s * 3 + 1] - pos[1], Bs.P[s * 3 + 2] - pos[2]));
      if (reach > Math.max(w, w / asp) * 1.1 + 0.03) far++;
    }
  }
  assert.ok(n > 120, `${label}: placements (${n})`);
  assert.equal(off, 0, `${label}: no piece stretches or squeezes a tenth of its skin by more than a quarter`);
  assert.equal(far, 0, `${label}: no ink lands far past the picture`);
  assert.ok(low <= 25, `${label}: few pieces lose any of the picture, at the feet and the side of the face (${low} of ${n})`);
  assert.ok(ms / n < 20, `${label}: a piece is laid in ${(ms / n).toFixed(1)} ms`);
  report.push(`${label}: ${low} of ${n} not whole, ${(ms / n).toFixed(1)} ms`);
}
console.log('PASS armpit-ink-unit:', report.join('; '));
