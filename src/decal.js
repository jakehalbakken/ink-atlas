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
// A band round an arm or leg: the skin is laid flat like a sleeve, each vertex placed by its
// distance along the limb's line and its angle round it times the limb's typical radius at that
// height, so a wide piece closes on itself round the limb with no holes, tears or loose pieces.
// limb: { joints: [[x,y,z], ...] down the limb in the standing body, keep: Uint8Array per vertex
// (the limb's own skin, for its radius), rest: the standing positions }. Returns null when the
// piece is small enough for the stencil unfold below, which follows bumps more closely.
function limbFlat(geo, t, frame, startTri, limb) {
  const P = geo.attributes.position.array, Q = limb.rest, I = geo.index.array, verts = (P.length / 3) | 0;
  const J = limb.joints, segs = [];
  let total = 0;
  for (let i = 0; i < J.length - 1; i++) {
    const d = [J[i + 1][0] - J[i][0], J[i + 1][1] - J[i][1], J[i + 1][2] - J[i][2]], len = Math.hypot(...d) || 1e-9;
    segs.push({ a: J[i], dir: d.map((x) => x / len), len, start: total }); total += len;
  }
  // stretch the line past both ends, so a band at the wrist or ankle still has a line to wrap round
  const ext = 0.15, f = segs[0], l = segs[segs.length - 1];
  f.a = f.a.map((x, i) => x - f.dir[i] * ext); f.len += ext; for (const g of segs) if (g !== f) g.start += ext; l.len += ext; total += 2 * ext;
  // one "outside" direction carried down the limb so angles agree between its parts
  const o0 = (() => { let o = [1, 0, 0]; if (Math.abs(f.dir[0]) > 0.8) o = [0, 0, 1]; const k = o[0] * f.dir[0] + o[1] * f.dir[1] + o[2] * f.dir[2]; o = o.map((x, i) => x - f.dir[i] * k); const n = Math.hypot(...o); return o.map((x) => x / n); })();
  let prev = o0;
  for (const g of segs) {
    const k = prev[0] * g.dir[0] + prev[1] * g.dir[1] + prev[2] * g.dir[2];
    let o = prev.map((x, i) => x - g.dir[i] * k); const n = Math.hypot(...o) || 1; o = o.map((x) => x / n);
    g.o = o; g.side = [g.dir[1] * o[2] - g.dir[2] * o[1], g.dir[2] * o[0] - g.dir[0] * o[2], g.dir[0] * o[1] - g.dir[1] * o[0]]; prev = o;
  }
  // each vertex: distance down the line, and its offset square to the line in that part's frame
  const S = new Float64Array(verts), Wo = new Float64Array(verts), Ws = new Float64Array(verts);
  const place = (x, y, z) => {
    let best = null, bd = Infinity;
    for (const g of segs) {
      const px = x - g.a[0], py = y - g.a[1], pz = z - g.a[2], tt = Math.max(0, Math.min(g.len, px * g.dir[0] + py * g.dir[1] + pz * g.dir[2]));
      const wx = px - g.dir[0] * tt, wy = py - g.dir[1] * tt, wz = pz - g.dir[2] * tt, d = Math.hypot(wx, wy, wz);
      if (d < bd) { bd = d; best = [g, tt, wx, wy, wz]; }
    }
    const [g, tt, wx, wy, wz] = best;
    return [g.start + tt, wx * g.o[0] + wy * g.o[1] + wz * g.o[2], wx * g.side[0] + wy * g.side[1] + wz * g.side[2], g];
  };
  for (let v = 0; v < verts; v++) { const r = place(Q[v * 3], Q[v * 3 + 1], Q[v * 3 + 2]); S[v] = r[0]; Wo[v] = r[1]; Ws[v] = r[2]; }
  // The limb is not round and its bones are not in its middle (the Achilles sits far behind the
  // ankle joint), so each height gets the middle of its own skin, and the way round is measured
  // as real length round that cross-section, from a table of radius by height and angle.
  const bin = 0.01, nb = Math.ceil(total / bin) + 1, NA = 48, own = (v) => v < limb.keep.length && limb.keep[v] === 1;
  const sb = (s) => Math.min(nb - 1, Math.max(0, Math.round(s / bin)));
  const smooth = (arr, reach) => { const out = new Float64Array(nb).fill(NaN); for (let b = 0; b < nb; b++) { let a = 0, c = 0; for (let k = -reach; k <= reach; k++) { const j = b + k; if (j >= 0 && j < nb && arr[j] === arr[j]) { a += arr[j]; c++; } } if (c) out[b] = a / c; } for (let b = 1; b < nb; b++) if (!(out[b] === out[b])) out[b] = out[b - 1]; for (let b = nb - 2; b >= 0; b--) if (!(out[b] === out[b])) out[b] = out[b + 1]; return out; };
  const so = new Float64Array(nb), ss = new Float64Array(nb), sc = new Float64Array(nb);
  for (let v = 0; v < Math.min(verts, limb.keep.length); v++) if (own(v)) { const b = sb(S[v]); so[b] += Wo[v]; ss[b] += Ws[v]; sc[b]++; }
  const mo = smooth(so.map((x, b) => sc[b] ? x / sc[b] : NaN), 2), ms = smooth(ss.map((x, b) => sc[b] ? x / sc[b] : NaN), 2);
  // read between the 1 cm rows, not from the nearest one: a row step put a kink in every line
  // crossing it, which crept along the ink as it was moved (2026-11-19, Jake: "warping the tattoo")
  const lerpRow = (arr, s) => { const f = Math.max(0, Math.min(nb - 1, s / bin)), i = Math.min(nb - 2, Math.floor(f)), r = f - i; return (arr[i] || 0) * (1 - r) + (arr[i + 1] || 0) * r; };
  const ang = new Float64Array(verts), Rv = new Float64Array(verts);
  for (let v = 0; v < verts; v++) { const x = Wo[v] - lerpRow(mo, S[v]), y = Ws[v] - lerpRow(ms, S[v]); ang[v] = Math.atan2(y, x); Rv[v] = Math.hypot(x, y); }
  const ab = (a) => ((Math.floor((a + Math.PI) / (2 * Math.PI) * NA) % NA) + NA) % NA;
  const table = (pick) => {
    const rsum = new Float64Array(nb * NA), rc = new Float64Array(nb * NA);
    for (let v = 0; v < Math.min(verts, limb.keep.length); v++) if (pick(v)) { const b = sb(S[v]); for (let k = -2; k <= 2; k++) { const j = b + k; if (j < 0 || j >= nb) continue; const c = j * NA + ab(ang[v]); rsum[c] += Rv[v]; rc[c]++; } }
    // radius per height and angle bin, gaps filled round the ring, rows with nothing copied from nearby
    const RT = new Float64Array(nb * NA).fill(NaN);
    for (let b = 0; b < nb; b++) {
      const row = []; for (let a = 0; a < NA; a++) { const c = b * NA + a; row.push(rc[c] ? rsum[c] / rc[c] : NaN); }
      if (!row.some((x) => x === x)) continue;
      for (let a = 0; a < NA; a++) if (!(row[a] === row[a])) { let l = 1, r = 1; while (!(row[(a - l + NA) % NA] === row[(a - l + NA) % NA])) l++; while (!(row[(a + r) % NA] === row[(a + r) % NA])) r++; RT[b * NA + a] = (row[(a - l + NA) % NA] * r + row[(a + r) % NA] * l) / (l + r); } else RT[b * NA + a] = row[a];
    }
    for (let b = 1; b < nb; b++) if (!(RT[b * NA] === RT[b * NA])) for (let a = 0; a < NA; a++) RT[b * NA + a] = RT[(b - 1) * NA + a];
    for (let b = nb - 2; b >= 0; b--) if (!(RT[b * NA] === RT[b * NA])) for (let a = 0; a < NA; a++) RT[b * NA + a] = RT[(b + 1) * NA + a];
    // cumulative length round each ring, from angle -PI
    const CT = new Float64Array(nb * (NA + 1)), da = 2 * Math.PI / NA;
    for (let b = 0; b < nb; b++) for (let a = 0; a < NA; a++) CT[b * (NA + 1) + a + 1] = CT[b * (NA + 1) + a] + (RT[b * NA + a] || 0) * da;
    return CT;
  };
  // first from the limb's own skin, then again with the hand or foot where it still lies round the
  // same ring (the wrist or ankle bone), so a band there is measured on the skin it really covers
  const CT0 = table(own), da0 = 2 * Math.PI / NA;
  const CT = table((v) => own(v) || (v < limb.keep.length && limb.keep[v] === 2 && Rv[v] < 1.6 * CT0[sb(S[v]) * (NA + 1) + NA] / (2 * Math.PI))), da = da0;
  const cum = (b, t) => { const f = (t + Math.PI) / da, i = Math.max(0, Math.min(NA - 1, Math.floor(f))), r = f - i; return CT[b * (NA + 1) + i] + (CT[b * (NA + 1) + i + 1] - CT[b * (NA + 1) + i]) * r; };
  const perim = (b) => CT[b * (NA + 1) + NA];
  // length round the ring at this height from angle a0 by turn (-PI..PI, plus whole turns)
  const alongRow = (b, a0, turn) => { const a1 = a0 + turn; let L = cum(b, Math.atan2(Math.sin(a1), Math.cos(a1))) - cum(b, a0); const k = Math.round((a1 - Math.atan2(Math.sin(a1), Math.cos(a1))) / (2 * Math.PI)); return L + k * perim(b); };
  const along = (s, a0, turn) => { const f = Math.max(0, Math.min(nb - 1, s / bin)), i = Math.min(nb - 2, Math.floor(f)), r = f - i; return alongRow(i, a0, turn) * (1 - r) + alongRow(i + 1, a0, turn) * r; };
  // the anchor in the standing body, through its triangle's barycentric weights
  const ia = I[startTri * 3], ib = I[startTri * 3 + 1], ic = I[startTri * 3 + 2];
  const vec = (A, i, j) => [A[j * 3] - A[i * 3], A[j * 3 + 1] - A[i * 3 + 1], A[j * 3 + 2] - A[i * 3 + 2]];
  const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const e1 = vec(P, ia, ib), e2 = vec(P, ia, ic), q1 = vec(Q, ia, ib), q2 = vec(Q, ia, ic);
  const g11 = dt(e1, e1), g12 = dt(e1, e2), g22 = dt(e2, e2), det = g11 * g22 - g12 * g12 || 1e-12;
  const inPlane = (x) => { const b1 = dt(x, e1), b2 = dt(x, e2); return [(g22 * b1 - g12 * b2) / det, (g11 * b2 - g12 * b1) / det]; };
  const toRest = (x) => { const [al, be] = inPlane(x); return [q1[0] * al + q2[0] * be, q1[1] * al + q2[1] * be, q1[2] * al + q2[2] * be]; };
  const off = toRest([t.pos[0] - P[ia * 3], t.pos[1] - P[ia * 3 + 1], t.pos[2] - P[ia * 3 + 2]]);
  const A0 = place(Q[ia * 3] + off[0], Q[ia * 3 + 1] + off[1], Q[ia * 3 + 2] + off[2]), b0 = sb(A0[0]);
  const s0 = A0[0], g0 = A0[3], ang0 = Math.atan2(A0[2] - lerpRow(ms, s0), A0[1] - lerpRow(mo, s0)), rr = (() => { const f = Math.max(0, Math.min(nb - 1, s0 / bin)), i = Math.min(nb - 2, Math.floor(f)), r = f - i; return (perim(i) * (1 - r) + perim(i + 1) * r) / (2 * Math.PI); })();
  // round and down the limb at the anchor, and the artwork's own right and up in those terms
  const eRound = [0, 1, 2].map((i) => -Math.sin(ang0) * g0.o[i] + Math.cos(ang0) * g0.side[i]), eDown = g0.dir;
  const nrm = (x) => { const n = Math.hypot(...x) || 1; return x.map((y) => y / n); };
  const Rr = nrm(toRest([frame.right.x, frame.right.y, frame.right.z])), Ur = nrm(toRest([frame.up.x, frame.up.y, frame.up.z]));
  const rx = dt(Rr, eRound), rs = dt(Rr, eDown), ux = dt(Ur, eRound), us = dt(Ur, eDown);
  const w = t.width, h = t.width / t.aspect, round = Math.abs(rx) * w + Math.abs(ux) * h;
  // Most pieces part way round are unfolded like a stencil, which follows bumps more closely. A
  // band at least a third of the way round a forearm or lower leg is laid out as a sleeve too: the
  // ankle and wrist narrow fast, and a stencil turned off the limb's line tore there into a V.
  // (Not the upper arm or thigh, which run into the shoulder and hip, and not over the bend of the
  // elbow or knee: a sleeve stretches there.)
  const part = round / (2 * Math.PI * rr), reach = (Math.abs(rs) * w + Math.abs(us) * h) / 2;
  const belowJoint = g0 !== segs[0] && s0 - reach - g0.start > 0.02;
  // Half way round a forearm or lower leg, not a third: an 8 cm piece on the front of the forearm
  // was laid as a sleeve and squashed and kinked as it moved (2026-11-19). The bar moves a little
  // the other way from what this piece was last time, so a drag across it does not flick between
  // the two ways of laying it.
  const keep = limb.prev === true ? -0.05 : limb.prev === false ? 0.05 : 0;
  if (!(rr > 0) || part < 0.5 + keep || (part < 0.8 + keep && !belowJoint)) return null;
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  return {
    // flat x, y of vertex v with its angle shifted by k turns (for triangles across the back)
    at: (v, k = 0) => { const X = along(S[v], ang0, wrapA(ang[v] - ang0) + 2 * Math.PI * k), Y = S[v] - s0; return [X * rx + Y * rs, X * ux + Y * us]; },
    turn: (v) => wrapA(ang[v] - ang0),
    // the limb's own skin and the hand or foot below it, never the body it hangs from
    // (or skin weighted to the shoulder or hip that still lies on the limb's own ring)
    on: (v) => v < limb.keep.length && (limb.keep[v] > 0 || Rv[v] < 1.2 * perim(sb(S[v])) / (2 * Math.PI)),
  };
}

export function buildDecal(geo, adj, t, frame, startTri, limb) {
  const sleeve = limb ? limbFlat(geo, t, frame, startTri, limb) : null;
  if (sleeve) return buildSleeve(geo, adj, t, startTri, sleeve);
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

// The band version: walk out from the anchor over connected skin, each triangle drawn with its
// sleeve coordinates; one that crosses the back of the limb (opposite the anchor) is drawn twice,
// once from each side, so the two ends of the artwork meet there with no gap.
function buildSleeve(geo, adj, t, startTri, sleeve) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, I = geo.index.array;
  const tris = (I.length / 3) | 0, w = t.width, h = t.width / t.aspect;
  const bend = clamp(t.bend || 0, -1, 1), taper = clamp(t.taper || 0, -0.75, 0.75), m = UV_MARGIN, span = 1 - 2 * m, edge = 0.05;
  const rect = ([x, y]) => {
    const halfW = Math.max(1e-4, (w / 2) * (1 + taper * clamp(2 * y / h, -1, 1)));
    const yb = y - 0.35 * w * bend * (x / (w / 2)) * (x / (w / 2));
    return [0.5 + x / (2 * halfW), 0.5 - yb / h];
  };
  const pos = [], uv = [], supports = [], from = [], seen = new Uint8Array(tris), queue = [startTri | 0];
  seen[startTri | 0] = 1;
  let head = 0;
  while (head < queue.length && head < 20000) {
    const tri = queue[head++], o = tri * 3, vs = [I[o], I[o + 1], I[o + 2]];
    if (!sleeve.on(vs[0]) || !sleeve.on(vs[1]) || !sleeve.on(vs[2])) continue;
    const turns = vs.map((v) => sleeve.turn(v)), across = Math.max(...turns) - Math.min(...turns) > Math.PI;
    let inside = false;
    for (const k of across ? [1, -1] : [0]) {
      const rs = vs.map((v, i) => rect(sleeve.at(v, k && turns[i] * k < 0 ? k : 0)));
      const minU = Math.min(rs[0][0], rs[1][0], rs[2][0]), maxU = Math.max(rs[0][0], rs[1][0], rs[2][0]), minV = Math.min(rs[0][1], rs[1][1], rs[2][1]), maxV = Math.max(rs[0][1], rs[1][1], rs[2][1]);
      if (maxU < -edge || minU > 1 + edge || maxV < -edge || minV > 1 + edge) continue;
      inside = true;
      for (let i = 0; i < 3; i++) {
        const vi = vs[i];
        pos.push(P[vi * 3] + N[vi * 3] * 0.0004, P[vi * 3 + 1] + N[vi * 3 + 1] * 0.0004, P[vi * 3 + 2] + N[vi * 3 + 2] * 0.0004);
        supports.push(vi); uv.push(m + rs[i][0] * span, m + rs[i][1] * span);
      }
      from.push(tri);
    }
    if (!inside) continue;
    for (let s = 0; s < 3; s++) { const nb = adj[o + s]; if (nb >= 0 && !seen[nb]) { seen[nb] = 1; queue.push(nb); } }
  }
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), supports: new Uint32Array(supports), tris: new Uint32Array(from), sleeve: true };
}
