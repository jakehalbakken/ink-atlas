// Project a tattoo onto the body by walking the surface outward from its anchor
// triangle over mesh adjacency, instead of three.js DecalGeometry which projects a
// box and can grab a disconnected surface behind the target (arm ink bleeding onto
// the torso). The walk stays on connected, forward-facing triangles inside the
// artwork rectangle, so ink can wrap around a limb but never jumps across a gap.
//
// wrap  0..1     unroll sideways around a cylinder, so a band meets around an arm
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
  const tris = (I.length / 3) | 0;
  const w = t.width, h = t.width / t.aspect;
  const wrap = clamp(t.wrap || 0, 0, 1), bend = clamp(t.bend || 0, -1, 1), taper = clamp(t.taper || 0, -0.75, 0.75);
  const radius = clamp(0.57 * w, 0.046, 0.15);
  const Ox = t.pos[0], Oy = t.pos[1], Oz = t.pos[2], R = frame.right, U = frame.up, Nt = frame.n;
  const m = UV_MARGIN, span = 1 - 2 * m;
  // Surface vertex -> rectangle coords u0,v0 in [0,1] (0,0 = one corner of the artwork).
  const rect = (ix) => {
    const dx = P[ix * 3] - Ox, dy = P[ix * 3 + 1] - Oy, dz = P[ix * 3 + 2] - Oz;
    let x = dx * R.x + dy * R.y + dz * R.z;
    const y = dx * U.x + dy * U.y + dz * U.z, z = dx * Nt.x + dy * Nt.y + dz * Nt.z;
    if (wrap) x = x * (1 - wrap) + Math.atan2(x, z + radius) * radius * wrap;
    const halfW = Math.max(1e-4, (w / 2) * (1 + taper * clamp(2 * y / h, -1, 1)));
    const yb = y - 0.35 * w * bend * (x / (w / 2)) * (x / (w / 2));
    return [0.5 + x / (2 * halfW), 0.5 - yb / h];
  };
  const faceFwd = (t3) => { const a = I[t3] * 3, b = I[t3 + 1] * 3, c = I[t3 + 2] * 3;
    return ((N[a] + N[b] + N[c]) * Nt.x + (N[a + 1] + N[b + 1] + N[c + 1]) * Nt.y + (N[a + 2] + N[b + 2] + N[c + 2]) * Nt.z) / 3; };
  const gate = wrap > 0.02 ? -0.3 : 0.12; // let it curl around when wrapping; keep it flat otherwise
  const edge = 0.05; // triangles may overhang the rectangle by this much before being dropped

  const pos = [], uv = [], supports = [], from = [], seen = new Uint8Array(tris), stack = [startTri | 0]; seen[startTri | 0] = 1;
  let guard = 0;
  while (stack.length && guard++ < 8000) {
    const tri = stack.pop(), o = tri * 3;
    if (tri !== (startTri | 0) && faceFwd(o) < gate) continue; // silhouette: stop, do not cross to the back
    const a = I[o], b = I[o + 1], c = I[o + 2], A = rect(a), B = rect(b), C = rect(c);
    const minU = Math.min(A[0], B[0], C[0]), maxU = Math.max(A[0], B[0], C[0]), minV = Math.min(A[1], B[1], C[1]), maxV = Math.max(A[1], B[1], C[1]);
    if (maxU < -edge || minU > 1 + edge || maxV < -edge || minV > 1 + edge) continue; // outside the artwork
    for (const [vi, r] of [[a, A], [b, B], [c, C]]) {
      pos.push(P[vi * 3] + N[vi * 3] * 0.0004, P[vi * 3 + 1] + N[vi * 3 + 1] * 0.0004, P[vi * 3 + 2] + N[vi * 3 + 2] * 0.0004);
      supports.push(vi);
      uv.push(m + r[0] * span, m + r[1] * span);
    }
    from.push(tri);
    for (let s = 0; s < 3; s++) { const nb = adj[o + s]; if (nb >= 0 && !seen[nb]) { seen[nb] = 1; stack.push(nb); } }
  }
  // tris: the body triangle each decal triangle copies (used to bake ink into the skin texture).
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), supports: new Uint32Array(supports), tris: new Uint32Array(from) };
}
