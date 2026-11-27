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
const HOLE_SHARE = 0.002;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Working arrays the size of the whole body, kept from one laying to the next. A drag lays its piece
// again on every move of the finger, and fresh arrays each time came to over a megabyte a move since
// 2026-11-25, tens of megabytes a second for the iPad to clear while it also held the project's
// pictures (2026-11-27, Jake: placing a new tattoo "keeps refreshing" the page). Each is filled
// before use and never kept past the call that took it; a call takes each name once.
const scratchPool = new Map();
function scratch(name, Type, n, fill) {
  let a = scratchPool.get(name);
  if (!a || a.length < n) { a = new Type(n); scratchPool.set(name, a); }
  if (a.length !== n) a = a.subarray(0, n);
  if (fill !== undefined) a.fill(fill);
  return a;
}

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
// Everything about a limb that does not depend on the tattoo: each vertex's place along the limb's
// line and round it, and the table of length round each ring. With many tattoos on the arms and legs
// this was redone for every piece on every rebuild, most of a body slider step (2026-11-24), so it is
// kept per limb until the shape (limb.ver) or the skeleton changes.
const limbPrepCache = new Map();
export const limbPrepStats = { builds: 0 };
export function limbPrepReset() { limbPrepCache.clear(); }
function limbPrep(geo, limb) {
  const P = geo.attributes.position.array, verts = (P.length / 3) | 0, J = limb.joints;
  const key = limb.ver != null ? [limb.key, limb.ver, verts, limb.keep.length, J.map((j) => j.join(',')).join(';')].join('|') : null;
  if (key) { const c = limbPrepCache.get(limb.key); if (c && c.key === key && c.rest === limb.rest) return c.prep; }
  const Q = limb.rest, segs = []; limbPrepStats.builds++;
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
  const prep = { segs, place, S, Wo, Ws, bin, nb, sb, mo, ms, lerpRow, ang, Rv, perim, along };
  if (key) limbPrepCache.set(limb.key, { key, rest: limb.rest, prep });
  return prep;
}
function limbFlat(geo, t, frame, startTri, limb, box) {
  const P = geo.attributes.position.array, Q = limb.rest, I = geo.index.array;
  const { segs, place, S, bin, nb, sb, mo, ms, lerpRow, ang, Rv, perim, along } = limbPrep(geo, limb);
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
  // a warped piece is judged by the size of the box its warped picture fills
  const w = t.width * (box ? box[2] - box[0] : 1), h = t.width / t.aspect * (box ? box[3] - box[1] : 1), round = Math.abs(rx) * w + Math.abs(ux) * h;
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
  const sleeve = {
    // flat x, y of vertex v with its angle shifted by k turns (for triangles across the back)
    at: (v, k = 0) => { const X = along(S[v], ang0, wrapA(ang[v] - ang0) + 2 * Math.PI * k), Y = S[v] - s0; return [X * rx + Y * rs, X * ux + Y * us]; },
    turn: (v) => wrapA(ang[v] - ang0),
    // the limb's own skin and the hand or foot below it, never the body it hangs from
    // (or skin weighted to the shoulder or hip that still lies on the limb's own ring)
    on: (v) => v < limb.keep.length && (limb.keep[v] > 0 || Rv[v] < 1.2 * perim(sb(S[v])) / (2 * Math.PI)),
  };
  // A sleeve stops where the limb meets the body, in a straight line. A piece at the top of the upper
  // arm or thigh that is not a whole band and runs on past that line (from the bicep up into the
  // armpit and onto the chest or back) is laid as a stencil instead, which carries on over the body
  // (2026-11-25, Jake: a design pulled from the armpit onto the bicep "kind of cuts out").
  if (!belowJoint && part < 0.95 + keep && runsOff(I, sleeve, S, s0, reach, w, h, t, box)) return null;
  return sleeve;
}
// Whether any skin just past the edge of a sleeve (the body the limb hangs from, next to the limb's
// own skin) would lie well inside the artwork.
function runsOff(I, sleeve, S, s0, reach, w, h, t, box) {
  const cx = box ? ((box[0] + box[2]) / 2 - 0.5) * t.width : 0, cy = box ? (0.5 - (box[1] + box[3]) / 2) * t.width / t.aspect : 0;
  const lo = s0 - reach - 0.03, hi = s0 + reach + 0.03, seen = new Set();
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i], b = I[i + 1], c = I[i + 2];
    if (S[a] < lo && S[b] < lo && S[c] < lo || S[a] > hi && S[b] > hi && S[c] > hi) continue;
    const oa = sleeve.on(a), ob = sleeve.on(b), oc = sleeve.on(c);
    if (oa === ob && ob === oc) continue;
    for (const [v, o] of [[a, oa], [b, ob], [c, oc]]) {
      if (o || seen.has(v)) continue; seen.add(v);
      const [x, y] = sleeve.at(v);
      if (Math.abs(x - cx) < 0.4 * w && Math.abs(y - cy) < 0.4 * h) return true;
    }
  }
  return false;
}

// box: for a warped tattoo, the part of its frame the warped picture fills ([x0, y0, x1, y1], 0..1
// being the unwarped picture, already mirrored for a mirrored tattoo); the texture then covers that
// box instead of the frame, so the skin past the old edge carries the warped ink too.
const inBox = (box) => {
  if (!box) return (r) => r;
  const x0 = box[0], y0 = box[1], bw = Math.max(1e-4, box[2] - box[0]), bh = Math.max(1e-4, box[3] - box[1]);
  return (r) => [(r[0] - x0) / bw, (r[1] - y0) / bh];
};
// Each vertex's neighbours along mesh edges (each once), kept per index buffer.
const ringCache = new WeakMap();
function vertexRings(I, verts) {
  const hit = ringCache.get(I); if (hit && hit.verts === verts) return hit;
  const sets = Array.from({ length: verts }, () => []);
  for (let i = 0; i < I.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = I[i + k]; if (v >= verts) continue;
    for (const u of [I[i + (k + 1) % 3], I[i + (k + 2) % 3]]) if (u < verts && !sets[v].includes(u)) sets[v].push(u);
  }
  const off = new Int32Array(verts + 1); for (let v = 0; v < verts; v++) off[v + 1] = off[v] + sets[v].length;
  const list = new Int32Array(off[verts]); for (let v = 0; v < verts; v++) list.set(sets[v], off[v]);
  const out = { verts, off, list }; ringCache.set(I, out); return out;
}
// Flat x, y (metres, along the artwork's right and up) for every vertex within maxD of the anchor
// along the skin, into flat (NaN elsewhere). The anchor triangle's corners are laid flat on the
// artwork's plane; every other vertex, nearest first, is placed from each placed neighbour by the
// edge between them seen in that neighbour's own right and up (carried from vertex to vertex over
// the skin), averaged over the neighbours that agree, so curved skin never tears inside the picture.
const h3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z), h2 = (x, y) => Math.sqrt(x * x + y * y);
export function placeFlat(P, N, I, verts, origin, R, U, startTri, maxD, flat, relaxR = Infinity) {
  const { off, list } = vertexRings(I, verts);
  const dist = scratch('pf.dist', Float64Array, verts, Infinity), fin = scratch('pf.fin', Uint8Array, verts, 0), fr = scratch('pf.fr', Float64Array, verts * 6, 0);
  const H = { d: [], v: [] };
  const hpush = (d, v) => { const hd = H.d, hv = H.v; let i = hd.length; hd.push(d); hv.push(v); while (i > 0) { const q = (i - 1) >> 1; if (hd[q] <= d) break; hd[i] = hd[q]; hv[i] = hv[q]; i = q; } hd[i] = d; hv[i] = v; };
  const hpop = () => { const hd = H.d, hv = H.v, v0 = hv[0], ld = hd.pop(), lv = hv.pop(), n = hd.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hd[c + 1] < hd[c]) c++; if (hd[c] >= ld) break; hd[i] = hd[c]; hv[i] = hv[c]; i = c; } hd[i] = ld; hv[i] = lv; } return v0; };
  const Ox = origin[0], Oy = origin[1], Oz = origin[2];
  // a right and up for vertex v: the given right laid into its skin's plane, up square to it
  const frameFrom = (v, rx, ry, rz) => {
    let nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2]; const nl = h3(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const d = rx * nx + ry * ny + rz * nz; let ex = rx - d * nx, ey = ry - d * ny, ez = rz - d * nz; const el = h3(ex, ey, ez);
    if (!(el > 1e-9)) return false;
    ex /= el; ey /= el; ez /= el;
    const o = v * 6; fr[o] = ex; fr[o + 1] = ey; fr[o + 2] = ez; fr[o + 3] = ny * ez - nz * ey; fr[o + 4] = nz * ex - nx * ez; fr[o + 5] = nx * ey - ny * ex;
    return true;
  };
  const a0 = [I[startTri * 3], I[startTri * 3 + 1], I[startTri * 3 + 2]];
  for (const v of a0) {
    if (fin[v]) continue;
    const dx = P[v * 3] - Ox, dy = P[v * 3 + 1] - Oy, dz = P[v * 3 + 2] - Oz;
    flat[v * 2] = dx * R.x + dy * R.y + dz * R.z; flat[v * 2 + 1] = dx * U.x + dy * U.y + dz * U.z;
    dist[v] = h3(dx, dy, dz); fin[v] = 1;
    if (!frameFrom(v, R.x, R.y, R.z)) { const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2]; frameFrom(v, U.y * nz - U.z * ny, U.z * nx - U.x * nz, U.x * ny - U.y * nx); }
    // keep the artwork's own way round (up to the left of right, seen from outside)
    const o = v * 6;
    if (fr[o + 3] * U.x + fr[o + 4] * U.y + fr[o + 5] * U.z < 0) { fr[o + 3] = -fr[o + 3]; fr[o + 4] = -fr[o + 4]; fr[o + 5] = -fr[o + 5]; }
  }
  const relax = (p) => { for (let k = off[p]; k < off[p + 1]; k++) { const q = list[k]; if (fin[q]) continue; const d = dist[p] + h3(P[q * 3] - P[p * 3], P[q * 3 + 1] - P[p * 3 + 1], P[q * 3 + 2] - P[p * 3 + 2]); if (d < dist[q] && d <= maxD) { dist[q] = d; hpush(d, q); } } };
  for (const v of a0) relax(v);
  // one neighbour's guess at where q lies: its own place plus the edge to q in its right and up,
  // at the edge's full length
  const guess = (p, q, out) => {
    const ex = P[q * 3] - P[p * 3], ey = P[q * 3 + 1] - P[p * 3 + 1], ez = P[q * 3 + 2] - P[p * 3 + 2], L = h3(ex, ey, ez), o = p * 6;
    const x = ex * fr[o] + ey * fr[o + 1] + ez * fr[o + 2], y = ex * fr[o + 3] + ey * fr[o + 4] + ez * fr[o + 5], l = h2(x, y);
    if (!(l > 1e-12)) { out[0] = flat[p * 2]; out[1] = flat[p * 2 + 1]; return L; }
    out[0] = flat[p * 2] + x / l * L; out[1] = flat[p * 2 + 1] + y / l * L; return L;
  };
  const g = [0, 0], order = [];
  while (H.d.length) {
    const q = hpop(); if (fin[q]) continue;
    // the neighbour it was reached through (the nearest to the anchor) leads; others that agree with
    // it join in, weighted by how close they are, so the places run smooth
    let best = -1, bd = Infinity;
    for (let k = off[q]; k < off[q + 1]; k++) { const p = list[k]; if (!fin[p]) continue; const d = dist[p] + h3(P[q * 3] - P[p * 3], P[q * 3 + 1] - P[p * 3 + 1], P[q * 3 + 2] - P[p * 3 + 2]); if (d < bd) { bd = d; best = p; } }
    if (best < 0) continue;
    const L0 = guess(best, q, g), gx = g[0], gy = g[1];
    let sx = gx / L0, sy = gy / L0, sw = 1 / L0;
    for (let k = off[q]; k < off[q + 1]; k++) {
      const p = list[k]; if (!fin[p] || p === best) continue;
      const L = guess(p, q, g); if (h2(g[0] - gx, g[1] - gy) > 0.5 * Math.min(L, L0) + 0.002) continue;
      sx += g[0] / L; sy += g[1] / L; sw += 1 / L;
    }
    flat[q * 2] = sx / sw; flat[q * 2 + 1] = sy / sw; fin[q] = 1;
    // carry the leading neighbour's right over to q's skin
    const o = best * 6;
    if (!frameFrom(q, fr[o], fr[o + 1], fr[o + 2])) frameFrom(q, fr[o + 3], fr[o + 4], fr[o + 5]);
    const qo = q * 6, s = fr[qo + 3] * fr[o + 3] + fr[qo + 4] * fr[o + 4] + fr[qo + 5] * fr[o + 5];
    if (s < 0) { fr[qo + 3] = -fr[qo + 3]; fr[qo + 4] = -fr[qo + 4]; fr[qo + 5] = -fr[qo + 5]; }
    relax(q);
    order.push(q);
  }
  // Then even out: each vertex is pulled towards where its placed neighbours, at the true length of
  // the edge to each, would put it, a few rounds over, so skin that cannot lie flat (the hollow of the
  // armpit, a shoulder) shares the stretch smoothly instead of tearing in one place. An edge already
  // torn past three times or a third of its length (the two ways round the back of a limb meeting)
  // pulls nothing.
  // Only the vertices out to relaxR (flat distance from the anchor: the picture and a little round
  // it) move; those further out hold still as its edge, which keeps a big piece quick.
  const near = relaxR < Infinity ? order.filter((q) => h2(flat[q * 2], flat[q * 2 + 1]) <= relaxR) : order;
  const nq = near.length;
  // each placed vertex's placed neighbours and the true length to each, once
  const nOff = new Int32Array(nq + 1);
  for (let i = 0; i < nq; i++) { const q = near[i]; let c = 0; for (let k = off[q]; k < off[q + 1]; k++) if (fin[list[k]]) c++; nOff[i + 1] = nOff[i] + c; }
  const nId = new Int32Array(nOff[nq]), nLen = new Float64Array(nOff[nq]);
  for (let i = 0, j = 0; i < nq; i++) {
    const q = near[i];
    for (let k = off[q]; k < off[q + 1]; k++) { const p = list[k]; if (!fin[p]) continue; const dx = P[q * 3] - P[p * 3], dy = P[q * 3 + 1] - P[p * 3 + 1], dz = P[q * 3 + 2] - P[p * 3 + 2]; nId[j] = p; nLen[j++] = Math.sqrt(dx * dx + dy * dy + dz * dz); }
  }
  // up to 64 rounds, stopping once nothing moves more than a twentieth of a millimetre
  for (let it = 0; it < 64; it++) {
    let moved = 0;
    for (let i = 0; i < nq; i++) {
      const q = near[i], qx = flat[q * 2], qy = flat[q * 2 + 1]; let sx = 0, sy = 0, sw = 0;
      for (let k = nOff[i]; k < nOff[i + 1]; k++) {
        const p = nId[k], L = nLen[k], px = flat[p * 2], py = flat[p * 2 + 1], dx = qx - px, dy = qy - py, l = Math.sqrt(dx * dx + dy * dy);
        if (!(l > 1e-9) || !(L > 1e-9) || l > 3 * L || l * 3 < L) continue;
        sx += px + dx / l * L; sy += py + dy / l * L; sw++;
      }
      if (sw >= 2) { const nx = sx / sw, ny = sy / sw, m = Math.abs(nx - qx) + Math.abs(ny - qy); if (m > moved) moved = m; flat[q * 2] = nx; flat[q * 2 + 1] = ny; }
    }
    if (moved < 5e-5) break;
  }
  return flat;
}
export function buildDecal(geo, adj, t, frame, startTri, limb, box) {
  const sleeve = limb ? limbFlat(geo, t, frame, startTri, limb, box) : null;
  if (sleeve) return buildSleeve(geo, adj, t, startTri, sleeve, box);
  // The artwork is laid on the skin like a paper stencil, unfolded triangle by triangle outward from
  // the anchor (stencilUnfold). Where the skin curves two ways at once (the armpit onto the arm,
  // round the chest or shoulder), two unfoldings reach the same triangle by different routes and
  // disagree, and that triangle was left out: holes in the middle of the ink (2026-11-25, Jake: a
  // design pulled from the armpit onto the bicep "kind of cuts out"). Only then is the piece laid by
  // stencilFlat, which gives every vertex one place; a piece the unfolding lays whole stays exactly
  // as it always was.
  return stencilUnfold(geo, adj, t, frame, startTri, box) || stencilFlat(geo, adj, t, frame, startTri, box);
}

// The share of the picture the drawn triangles leave bare (a grid over it).
function uncovered(uv, n = 64) {
  const m = UV_MARGIN, sp = 1 - 2 * m, hit = scratch('uncovered', Uint8Array, n * n, 0);
  for (let k = 0; k + 5 < uv.length; k += 6) {
    const ax = (uv[k] - m) / sp * n, ay = (uv[k + 1] - m) / sp * n, bx = (uv[k + 2] - m) / sp * n, by = (uv[k + 3] - m) / sp * n, cx = (uv[k + 4] - m) / sp * n, cy = (uv[k + 5] - m) / sp * n;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (!den) continue;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(n - 1, Math.floor(Math.max(ax, bx, cx))), j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(n - 1, Math.floor(Math.max(ay, by, cy)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = i + 0.5, py = j + 0.5, l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l1 + l2 <= 1 + 1e-6) hit[j * n + i] = 1;
    }
  }
  let c = 0; for (const x of hit) c += 1 - x; return c / (n * n);
}

function stencilUnfold(geo, adj, t, frame, startTri, box) {
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
  const flat = scratch('su.flat', Float64Array, verts * 2, NaN);
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
  const toBox = inBox(box);
  const raw = (ix) => {
    const x = flat[ix * 2], y = flat[ix * 2 + 1];
    const halfW = Math.max(1e-4, (w / 2) * (1 + taper * clamp(2 * y / h, -1, 1)));
    const yb = y - 0.35 * w * bend * (x / (w / 2)) * (x / (w / 2));
    return [0.5 + x / (2 * halfW), 0.5 - yb / h];
  };
  const rect = (ix) => toBox(raw(ix));
  const len3 = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  const len2 = (a, b) => Math.hypot(flat[a * 2] - flat[b * 2], flat[a * 2 + 1] - flat[b * 2 + 1]);
  const faceN = (o) => { const a = I[o] * 3, b = I[o + 1] * 3, c = I[o + 2] * 3;
    return [N[a] + N[b] + N[c], N[a + 1] + N[b + 1] + N[c + 1], N[a + 2] + N[b + 2] + N[c + 2]]; };
  const edge = 0.05; // triangles may overhang the rectangle by this much before being dropped

  const pos = [], uv = [], supports = [], from = [], seen = scratch('su.seen', Uint8Array, tris, 0), parent = scratch('su.parent', Int32Array, tris, -1);
  // trouble: a triangle inside the picture left out because two unfoldings disagreed (see buildDecal)
  const drawn = scratch('su.drawn', Uint8Array, tris, 0), inPic = (x) => { const r = rect(x); return r[0] > 0 && r[0] < 1 && r[1] > 0 && r[1] < 1; };
  let trouble = false;
  const queue = [startTri | 0]; seen[startTri | 0] = 1;
  let head = 0;
  while (head < queue.length && head < 12000) {
    const tri = queue[head++], o = tri * 3, a = I[o], b = I[o + 1], c = I[o + 2];
    if (tri !== (startTri | 0)) {
      // a sharp fold (armpit, between fingers, the groin) is not skin a stencil lies across
      const pn = faceN(parent[tri] * 3), fn = faceN(o);
      if ((pn[0] * fn[0] + pn[1] * fn[1] + pn[2] * fn[2]) / ((Math.hypot(...pn) * Math.hypot(...fn)) || 1) < 0.2) continue;
      const missing = [a, b, c].filter((v) => !known(v));
      if (missing.length > 1) { if (drawn[parent[tri]] || [a, b, c].some((x) => known(x) && inPic(x))) trouble = true; continue; }
      const v = missing.length ? missing[0] : -1;
      if (v >= 0) { const [p, q] = [a, b, c].filter((x) => x !== v); unfold(p, q, v, [a, b, c]); }
      // where two unfoldings meet round the back of a limb the flat triangle tears: drop it
      const bad = (x, y) => { const l2 = len2(x, y), l3 = len3(x, y); return l2 > l3 * 1.6 + 1e-4 || l2 < l3 / 1.6 - 1e-4; };
      // flat distance from the anchor can never be shorter than the straight one through the body,
      // so a vertex that folds back into the picture (the far side of a limb) is dropped too
      const near = (x) => Math.hypot(flat[x * 2], flat[x * 2 + 1]) < 0.9 * Math.hypot(P[x * 3] - Ox, P[x * 3 + 1] - Oy, P[x * 3 + 2] - Oz) - 0.004;
      const torn = bad(a, b) || bad(b, c) || bad(c, a) || (v >= 0 && near(v));
      if (torn || Math.sign(area2(a, b, c)) !== side0) { if (inPic(a) || inPic(b) || inPic(c)) trouble = true; if (v >= 0) { flat[v * 2] = NaN; flat[v * 2 + 1] = NaN; } continue; }
    }
    const A = rect(a), B = rect(b), C = rect(c);
    const minU = Math.min(A[0], B[0], C[0]), maxU = Math.max(A[0], B[0], C[0]), minV = Math.min(A[1], B[1], C[1]), maxV = Math.max(A[1], B[1], C[1]);
    if (maxU < -edge || minU > 1 + edge || maxV < -edge || minV > 1 + edge) { // outside the artwork
      // a warp can move the whole picture off its old frame: the walk still crosses the old frame to
      // reach it, drawing nothing there
      if (!box) continue;
      const Ar = raw(a), Br = raw(b), Cr = raw(c);
      if (Math.max(Ar[0], Br[0], Cr[0]) < -edge || Math.min(Ar[0], Br[0], Cr[0]) > 1 + edge || Math.max(Ar[1], Br[1], Cr[1]) < -edge || Math.min(Ar[1], Br[1], Cr[1]) > 1 + edge) continue;
      for (let s = 0; s < 3; s++) { const nb = adj[o + s]; if (nb >= 0 && !seen[nb]) { seen[nb] = 1; parent[nb] = tri; queue.push(nb); } }
      continue;
    }
    for (const [vi, r] of [[a, A], [b, B], [c, C]]) {
      pos.push(P[vi * 3] + N[vi * 3] * 0.0004, P[vi * 3 + 1] + N[vi * 3 + 1] * 0.0004, P[vi * 3 + 2] + N[vi * 3 + 2] * 0.0004);
      supports.push(vi);
      uv.push(m + r[0] * span, m + r[1] * span);
    }
    from.push(tri); drawn[tri] = 1;
    for (let s = 0; s < 3; s++) { const nb = adj[o + s]; if (nb >= 0 && !seen[nb]) { seen[nb] = 1; parent[nb] = tri; queue.push(nb); } }
  }
  // a triangle left out may still be covered by its neighbours' overhang: only a picture with skin
  // missing from it is laid again
  if (trouble && uncovered(uv, 128) > HOLE_SHARE) return null;
  // or one whose unfoldings drifted apart enough to stretch a tenth of its skin by a quarter
  const rs = [];
  for (const tri of from) { const o = tri * 3; for (let e = 0; e < 3; e++) { const x = I[o + e], y = I[o + (e + 1) % 3], l3 = len3(x, y); if (l3 > 1e-6) rs.push(len2(x, y) / l3); } }
  rs.sort((p, q) => p - q);
  if (rs.length && (rs[Math.floor(rs.length * 0.1)] < 0.8 || rs[Math.floor(rs.length * 0.9)] > 1.25)) return null;
  // tris: the body triangle each decal triangle copies (used to bake ink into the skin texture).
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), supports: new Uint32Array(supports), tris: new Uint32Array(from) };
}

function stencilFlat(geo, adj, t, frame, startTri, box) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, I = geo.index.array;
  const tris = (I.length / 3) | 0, verts = (P.length / 3) | 0;
  const w = t.width, h = t.width / t.aspect;
  const bend = clamp(t.bend || 0, -1, 1), taper = clamp(t.taper || 0, -0.75, 0.75);
  const R = frame.right, U = frame.up;
  const m = UV_MARGIN, span = 1 - 2 * m;
  // The artwork is laid on the skin like a paper stencil: each vertex gets flat x, y coordinates that
  // keep the ink's true size along the skin and carry it on round an arm or leg (the old flat
  // projection cut pieces off at the side). Since 2026-11-25 the coordinates come from a walk over
  // the vertices nearest first, each one placed from the vertices already placed round it in their
  // own carried-along directions (a discrete exponential map), instead of unfolding triangle by
  // triangle: across curved skin (the armpit onto the arm, round the chest or shoulder) two
  // unfoldings reached the same triangle different ways and disagreed, and the triangle was left
  // out, holes in the middle of the ink (Jake: a design pulled from the armpit onto the bicep
  // "kind of cuts out"). Every vertex now has one place, so the ink stays whole there.
  const flat = scratch('sf.flat', Float64Array, verts * 2, NaN);
  const known = (ix) => flat[ix * 2] === flat[ix * 2];
  // how far from the anchor along the skin any of the picture can reach: its corners (or its warped
  // box), widened by a taper and a bend, with room for skin that the walk measures a little long
  const bx = box || [0, 0, 1, 1], tw = 1 + Math.abs(taper);
  let reachMax = 0;
  for (const u of [bx[0], bx[2]]) for (const v of [bx[1], bx[3]]) reachMax = Math.max(reachMax, Math.hypot((u - 0.5) * w * tw, (0.5 - v) * h + 0.35 * w * Math.abs(bend)));
  placeFlat(P, N, I, verts, t.pos, R, U, startTri | 0, reachMax * 2 + 0.02, flat, reachMax * 1.2 + 0.02);
  const toBox = inBox(box);
  const raw = (ix) => {
    const x = flat[ix * 2], y = flat[ix * 2 + 1];
    const halfW = Math.max(1e-4, (w / 2) * (1 + taper * clamp(2 * y / h, -1, 1)));
    const yb = y - 0.35 * w * bend * (x / (w / 2)) * (x / (w / 2));
    return [0.5 + x / (2 * halfW), 0.5 - yb / h];
  };
  const rect = (ix) => toBox(raw(ix));
  const len3 = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  const len2 = (a, b) => Math.hypot(flat[a * 2] - flat[b * 2], flat[a * 2 + 1] - flat[b * 2 + 1]);
  const faceN = (o) => { const a = I[o] * 3, b = I[o + 1] * 3, c = I[o + 2] * 3;
    return [N[a] + N[b] + N[c], N[a + 1] + N[b + 1] + N[c + 1], N[a + 2] + N[b + 2] + N[c + 2]]; };
  const edge = 0.05; // triangles may overhang the rectangle by this much before being dropped
  // where the walk met itself round the back of a limb the flat triangle tears: dropped. One turned
  // over (skin in the hollow of the armpit has more room than flat paper, so a strip of it folds) is
  // kept: ink there beats a bare triangle in the middle of the picture.
  const bad = (x, y) => { const l2 = len2(x, y), l3 = len3(x, y); return l2 > l3 * 1.6 + 1e-4 || l2 < l3 / 1.6 - 1e-4; };

  const pos = [], uv = [], supports = [], from = [], parent = scratch('sf.parent', Int32Array, tris, -1);
  // done: drawn, or outside the artwork. One left out at a sharp fold from the side it was reached is
  // tried again from another drawn neighbour (three times at most).
  const done = scratch('sf.done', Uint8Array, tris, 0), queued = scratch('sf.queued', Uint8Array, tris, 0), tries = scratch('sf.tries', Uint8Array, tris, 0);
  const queue = [startTri | 0]; queued[startTri | 0] = 1;
  const reach = (tri, o) => { for (let s = 0; s < 3; s++) { const nb = adj[o + s]; if (nb >= 0 && !done[nb] && !queued[nb] && tries[nb] < 3) { queued[nb] = 1; parent[nb] = tri; queue.push(nb); } } };
  let head = 0;
  while (head < queue.length && head < 20000) {
    const tri = queue[head++], o = tri * 3, a = I[o], b = I[o + 1], c = I[o + 2];
    queued[tri] = 0;
    if (!known(a) || !known(b) || !known(c)) { done[tri] = 1; continue; }
    if (tri !== (startTri | 0)) {
      // a sharp fold (between fingers, the groin) is not skin a stencil lies across
      const pn = faceN(parent[tri] * 3), fn = faceN(o);
      if ((pn[0] * fn[0] + pn[1] * fn[1] + pn[2] * fn[2]) / ((Math.hypot(...pn) * Math.hypot(...fn)) || 1) < 0.2) { tries[tri]++; continue; }
      if (bad(a, b) || bad(b, c) || bad(c, a)) { done[tri] = 1; continue; }
    }
    const A = rect(a), B = rect(b), C = rect(c);
    const minU = Math.min(A[0], B[0], C[0]), maxU = Math.max(A[0], B[0], C[0]), minV = Math.min(A[1], B[1], C[1]), maxV = Math.max(A[1], B[1], C[1]);
    if (maxU < -edge || minU > 1 + edge || maxV < -edge || minV > 1 + edge) { // outside the artwork
      done[tri] = 1;
      // a warp can move the whole picture off its old frame: the walk still crosses the old frame to
      // reach it, drawing nothing there
      if (!box) continue;
      const Ar = raw(a), Br = raw(b), Cr = raw(c);
      if (Math.max(Ar[0], Br[0], Cr[0]) < -edge || Math.min(Ar[0], Br[0], Cr[0]) > 1 + edge || Math.max(Ar[1], Br[1], Cr[1]) < -edge || Math.min(Ar[1], Br[1], Cr[1]) > 1 + edge) continue;
      reach(tri, o);
      continue;
    }
    for (const [vi, r] of [[a, A], [b, B], [c, C]]) {
      pos.push(P[vi * 3] + N[vi * 3] * 0.0004, P[vi * 3 + 1] + N[vi * 3 + 1] * 0.0004, P[vi * 3 + 2] + N[vi * 3 + 2] * 0.0004);
      supports.push(vi);
      uv.push(m + r[0] * span, m + r[1] * span);
    }
    from.push(tri); done[tri] = 1;
    reach(tri, o);
  }
  // tris: the body triangle each decal triangle copies (used to bake ink into the skin texture).
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), supports: new Uint32Array(supports), tris: new Uint32Array(from) };
}

// The band version: walk out from the anchor over connected skin, each triangle drawn with its
// sleeve coordinates; one that crosses the back of the limb (opposite the anchor) is drawn twice,
// once from each side, so the two ends of the artwork meet there with no gap.
function buildSleeve(geo, adj, t, startTri, sleeve, box) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, I = geo.index.array;
  const tris = (I.length / 3) | 0, w = t.width, h = t.width / t.aspect;
  const bend = clamp(t.bend || 0, -1, 1), taper = clamp(t.taper || 0, -0.75, 0.75), m = UV_MARGIN, span = 1 - 2 * m, edge = 0.05;
  const toBox = inBox(box);
  const rawOf = ([x, y]) => {
    const halfW = Math.max(1e-4, (w / 2) * (1 + taper * clamp(2 * y / h, -1, 1)));
    const yb = y - 0.35 * w * bend * (x / (w / 2)) * (x / (w / 2));
    return [0.5 + x / (2 * halfW), 0.5 - yb / h];
  };
  const rect = (q) => toBox(rawOf(q));
  const pos = [], uv = [], supports = [], from = [], seen = new Uint8Array(tris), queue = [startTri | 0];
  seen[startTri | 0] = 1;
  let head = 0;
  while (head < queue.length && head < 20000) {
    const tri = queue[head++], o = tri * 3, vs = [I[o], I[o + 1], I[o + 2]];
    if (!sleeve.on(vs[0]) || !sleeve.on(vs[1]) || !sleeve.on(vs[2])) continue;
    const turns = vs.map((v) => sleeve.turn(v)), across = Math.max(...turns) - Math.min(...turns) > Math.PI;
    let inside = false, near = false;
    for (const k of across ? [1, -1] : [0]) {
      const rs = vs.map((v, i) => rect(sleeve.at(v, k && turns[i] * k < 0 ? k : 0)));
      const minU = Math.min(rs[0][0], rs[1][0], rs[2][0]), maxU = Math.max(rs[0][0], rs[1][0], rs[2][0]), minV = Math.min(rs[0][1], rs[1][1], rs[2][1]), maxV = Math.max(rs[0][1], rs[1][1], rs[2][1]);
      if (maxU < -edge || minU > 1 + edge || maxV < -edge || minV > 1 + edge) {
        if (box && !near) { const rr = vs.map((v, i) => rawOf(sleeve.at(v, k && turns[i] * k < 0 ? k : 0))); near = !(Math.max(...rr.map((q) => q[0])) < -edge || Math.min(...rr.map((q) => q[0])) > 1 + edge || Math.max(...rr.map((q) => q[1])) < -edge || Math.min(...rr.map((q) => q[1])) > 1 + edge); }
        continue;
      }
      inside = true;
      for (let i = 0; i < 3; i++) {
        const vi = vs[i];
        pos.push(P[vi * 3] + N[vi * 3] * 0.0004, P[vi * 3 + 1] + N[vi * 3 + 1] * 0.0004, P[vi * 3 + 2] + N[vi * 3 + 2] * 0.0004);
        supports.push(vi); uv.push(m + rs[i][0] * span, m + rs[i][1] * span);
      }
      from.push(tri);
    }
    if (!inside && !near) continue;
    for (let s = 0; s < 3; s++) { const nb = adj[o + s]; if (nb >= 0 && !seen[nb]) { seen[nb] = 1; queue.push(nb); } }
  }
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), supports: new Uint32Array(supports), tris: new Uint32Array(from), sleeve: true };
}
