// Project a tattoo onto the body by walking the surface outward from its anchor
// triangle over mesh adjacency, instead of three.js DecalGeometry which projects a
// box and can grab a disconnected surface behind the target (arm ink bleeding onto
// the torso). The walk stays on connected, forward-facing triangles inside the
// artwork rectangle, so ink can wrap around a limb but never jumps across a gap.
//
// The artwork is unfolded onto the skin like a stencil, so it always follows the skin round
// a limb (t.wrap is kept in saved projects but no longer changes anything).
// bend  -1..1    arch the artwork up or down across its width
// taper -0.75..0.75  widen one end and narrow the other
import * as THREE from 'three';

// The artwork sits inside this margin of the texture; the border is white, which is
// invisible under multiply blending. Triangles that overhang the rectangle a little
// sample that border and disappear cleanly, with no edge smearing and no clipping math.
export const UV_MARGIN = 0.04;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Neighbour triangle across each of a triangle's three edges, or -1. Built once per
// index buffer (the index only changes when the genital geometry is shown or hidden).
export function buildAdjacency(index) {
  const tris = (index.length / 3) | 0;
  const adj = new Int32Array(tris * 3).fill(-1);
  const seen = new Map(); // edge key -> triangle*3 + edge slot, until its pair arrives
  const key = (a, b) => (a < b ? a * 100000 + b : b * 100000 + a);
  for (let t = 0; t < tris; t++) {
    const o = t * 3, v = [index[o], index[o + 1], index[o + 2]];
    for (let s = 0; s < 3; s++) {
      const k = key(v[s], v[(s + 1) % 3]), prev = seen.get(k);
      if (prev === undefined) seen.set(k, o + s);
      else { adj[o + s] = (prev / 3) | 0; adj[prev] = t; seen.delete(k); }
    }
  }
  return adj;
}

// geo must have up-to-date position and normal attributes and an index.
// frame is { right, up, n } from the anchor. startTri is the triangle under the anchor.
// Returns { positions: Float32Array, uvs: Float32Array } ready for a BufferGeometry.
export function buildDecal(geo, adj, t, frame, startTri) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, I = geo.index.array;
  const tris = (I.length / 3) | 0, verts = (P.length / 3) | 0;
  const w = t.width, h = t.width / t.aspect;
  const bend = clamp(t.bend || 0, -1, 1), taper = clamp(t.taper || 0, -0.75, 0.75);
  const Ox = t.pos[0], Oy = t.pos[1], Oz = t.pos[2], R = frame.right, U = frame.up;
  const m = UV_MARGIN, span = 1 - 2 * m;
  // The artwork is laid on the skin like a paper stencil: each vertex gets flat x, y
  // coordinates by unfolding the triangles one by one outward from the anchor, so ink keeps
  // its true size along the skin and carries on round an arm or leg instead of smearing and
  // stopping where the limb turns away (the old flat projection cut pieces off at the side).
  const flat = new Float64Array(verts * 2).fill(NaN);
  const setPlanar = (ix) => { const dx = P[ix * 3] - Ox, dy = P[ix * 3 + 1] - Oy, dz = P[ix * 3 + 2] - Oz;
    flat[ix * 2] = dx * R.x + dy * R.y + dz * R.z; flat[ix * 2 + 1] = dx * U.x + dy * U.y + dz * U.z; };
  const known = (ix) => flat[ix * 2] === flat[ix * 2];
  const area2 = (a, b, c) => (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]);
  for (let k = 0; k < 3; k++) setPlanar(I[startTri * 3 + k]);
  const side0 = Math.sign(area2(I[startTri * 3], I[startTri * 3 + 1], I[startTri * 3 + 2])) || 1;
  // place vertex c from the known edge a-b, on the side that keeps the mesh's winding
  const unfold = (a, b, c, order) => {
    const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
    const cx = P[c * 3] - P[a * 3], cy = P[c * 3 + 1] - P[a * 3 + 1], cz = P[c * 3 + 2] - P[a * 3 + 2];
    const L2 = ex * ex + ey * ey + ez * ez || 1e-12, tp = (cx * ex + cy * ey + cz * ez) / L2;
    const hx = cx - ex * tp, hy = cy - ey * tp, hz = cz - ez * tp, hh = Math.hypot(hx, hy, hz);
    const ax = flat[a * 2], ay = flat[a * 2 + 1], fx = flat[b * 2] - ax, fy = flat[b * 2 + 1] - ay, fl = Math.hypot(fx, fy) || 1e-12;
    const sc = fl / Math.sqrt(L2), nx = -fy / fl, ny = fx / fl;
    for (const sd of [1, -1]) {
      flat[c * 2] = ax + fx * tp + nx * hh * sc * sd; flat[c * 2 + 1] = ay + fy * tp + ny * hh * sc * sd;
      if (Math.sign(area2(order[0], order[1], order[2])) === side0) return;
    }
  };
  const rect = (ix) => {
    const x = flat[ix * 2], y = flat[ix * 2 + 1];
    const halfW = Math.max(1e-4, (w / 2) * (1 + taper * clamp(2 * y / h, -1, 1)));
    const yb = y - 0.35 * w * bend * (x / (w / 2)) * (x / (w / 2));
    return [0.5 + x / (2 * halfW), 0.5 - yb / h];
  };
  const len3 = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  const len2 = (a, b) => Math.hypot(flat[a * 2] - flat[b * 2], flat[a * 2 + 1] - flat[b * 2 + 1]);
  const faceN = (o) => { const a = I[o] * 3, b = I[o + 1] * 3, c = I[o + 2] * 3;
    return [N[a] + N[b] + N[c], N[a + 1] + N[b + 1] + N[c + 1], N[a + 2] + N[b + 2] + N[c + 2]]; };
  const edge = 0.05; // triangles may overhang the rectangle by this much before being dropped

  const pos = [], uv = [], supports = [], from = [], seen = new Uint8Array(tris), parent = new Int32Array(tris).fill(-1);
  const queue = [startTri | 0]; seen[startTri | 0] = 1;
  let head = 0;
  while (head < queue.length && head < 12000) {
    const tri = queue[head++], o = tri * 3, a = I[o], b = I[o + 1], c = I[o + 2];
    if (tri !== (startTri | 0)) {
      // a sharp fold (armpit, between fingers, the groin) is not skin a stencil lies across
      const pn = faceN(parent[tri] * 3), fn = faceN(o);
      if ((pn[0] * fn[0] + pn[1] * fn[1] + pn[2] * fn[2]) / ((Math.hypot(...pn) * Math.hypot(...fn)) || 1) < 0.2) continue;
      const missing = [a, b, c].filter((v) => !known(v));
      if (missing.length > 1) continue;
      const v = missing.length ? missing[0] : -1;
      if (v >= 0) { const [p, q] = [a, b, c].filter((x) => x !== v); unfold(p, q, v, [a, b, c]); }
      // where two unfoldings meet round the back of a limb the flat triangle tears: drop it
      const bad = (x, y) => { const l2 = len2(x, y), l3 = len3(x, y); return l2 > l3 * 1.6 + 1e-4 || l2 < l3 / 1.6 - 1e-4; };
      // flat distance from the anchor can never be shorter than the straight one through the body,
      // so a vertex that folds back into the picture (the far side of a limb) is dropped too
      const near = (x) => Math.hypot(flat[x * 2], flat[x * 2 + 1]) < 0.9 * Math.hypot(P[x * 3] - Ox, P[x * 3 + 1] - Oy, P[x * 3 + 2] - Oz) - 0.004;
      const torn = bad(a, b) || bad(b, c) || bad(c, a) || (v >= 0 && near(v));
      if (torn || Math.sign(area2(a, b, c)) !== side0) { if (v >= 0) { flat[v * 2] = NaN; flat[v * 2 + 1] = NaN; } continue; }
    }
    const A = rect(a), B = rect(b), C = rect(c);
    const minU = Math.min(A[0], B[0], C[0]), maxU = Math.max(A[0], B[0], C[0]), minV = Math.min(A[1], B[1], C[1]), maxV = Math.max(A[1], B[1], C[1]);
    if (maxU < -edge || minU > 1 + edge || maxV < -edge || minV > 1 + edge) continue; // outside the artwork
    for (const [vi, r] of [[a, A], [b, B], [c, C]]) {
      pos.push(P[vi * 3] + N[vi * 3] * 0.0004, P[vi * 3 + 1] + N[vi * 3 + 1] * 0.0004, P[vi * 3 + 2] + N[vi * 3 + 2] * 0.0004);
      supports.push(vi);
      uv.push(m + r[0] * span, m + r[1] * span);
    }
    from.push(tri);
    for (let s = 0; s < 3; s++) { const nb = adj[o + s]; if (nb >= 0 && !seen[nb]) { seen[nb] = 1; parent[nb] = tri; queue.push(nb); } }
  }
  // tris: the body triangle each decal triangle copies (used to bake ink into the skin texture).
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), supports: new Uint32Array(supports), tris: new Uint32Array(from) };
}
