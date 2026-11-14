// Tape measure on the body: the length along the skin between two points, and the length
// around a limb (or the torso) at a point. Pure maths on the body mesh, so it can be tested
// without a browser. Lengths are in body units (the body is 1.75 tall); the app turns them
// into inches and centimetres from the height setting.
//
// Along the skin: the plane through both points that also holds their average surface normal
// cuts the skin in a curve that runs straight over the body from one point to the other, as a
// tape laid over the skin would. The cut is walked triangle by triangle from the first point,
// both ways, and the shorter way that reaches the second point wins. A shortest path over the
// mesh edges is worked out too, and the shorter of the two is the answer, since both are real
// paths on the skin.
// Around: planes through the point that hold its surface normal are turned through half a
// circle; the shortest closed loop is the way round the limb, as a tape wrapped round it.

// For each triangle edge (t*3+k, the edge from corner k to k+1), the triangle on the other side.
export function meshNeighbours(index) {
  const T = index.length / 3, nb = new Int32Array(T * 3).fill(-1), seen = new Map();
  for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) {
    const a = index[t * 3 + k], b = index[t * 3 + (k + 1) % 3], key = a < b ? a * 1048576 + b : b * 1048576 + a;
    const o = seen.get(key);
    if (o === undefined) seen.set(key, t * 3 + k);
    else if (o >= 0) { nb[t * 3 + k] = (o / 3) | 0; nb[o] = t; seen.set(key, -1); }
  }
  return nb;
}

const sub = (p, a, b) => [p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Walk the cut of the plane (normal n, through point o) across the skin from point `from` in
// triangle t0, leaving by edge `edge`. Stops when it enters triangle `goal` (and adds the step
// to `to`), comes back to t0 (a closed loop), runs off the mesh, or goes on too long.
function walkCut(pos, index, nb, n, o, t0, from, edge, goal, to, maxSteps) {
  const side = (v) => { const d = n[0] * (pos[v * 3] - o[0]) + n[1] * (pos[v * 3 + 1] - o[1]) + n[2] * (pos[v * 3 + 2] - o[2]); return d === 0 ? 1e-12 : d; };
  const cross = (t, k) => {
    const a = index[t * 3 + k], b = index[t * 3 + (k + 1) % 3], da = side(a), db = side(b), s = da / (da - db);
    return [pos[a * 3] + (pos[b * 3] - pos[a * 3]) * s, pos[a * 3 + 1] + (pos[b * 3 + 1] - pos[a * 3 + 1]) * s, pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * s];
  };
  const crosses = (t, k) => (side(index[t * 3 + k]) > 0) !== (side(index[t * 3 + (k + 1) % 3]) > 0);
  let t = t0, k = edge, prev = from, len = 0;
  const pts = [from];
  for (let step = 0; step < maxSteps; step++) {
    const x = cross(t, k); len += dist(prev, x); pts.push(x); prev = x;
    const next = nb[t * 3 + k]; if (next < 0) return null;
    // the same edge seen from the next triangle
    const a = index[t * 3 + k], b = index[t * 3 + (k + 1) % 3];
    let entry = -1; for (let j = 0; j < 3; j++) { const p = index[next * 3 + j], q = index[next * 3 + (j + 1) % 3]; if ((p === a && q === b) || (p === b && q === a)) { entry = j; break; } }
    if (entry < 0) return null;
    if (next === goal) { len += dist(prev, to); pts.push(to); return { len, pts, closed: goal === t0 }; }
    if (next === t0) return null;
    let exit = -1; for (let j = 0; j < 3; j++) if (j !== entry && crosses(next, j)) { exit = j; break; }
    if (exit < 0) return null;
    t = next; k = exit;
  }
  return null;
}

function crossingEdges(pos, index, n, o, t) {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const a = index[t * 3 + k], b = index[t * 3 + (k + 1) % 3];
    const da = n[0] * (pos[a * 3] - o[0]) + n[1] * (pos[a * 3 + 1] - o[1]) + n[2] * (pos[a * 3 + 2] - o[2]);
    const db = n[0] * (pos[b * 3] - o[0]) + n[1] * (pos[b * 3 + 1] - o[1]) + n[2] * (pos[b * 3 + 2] - o[2]);
    if (((da === 0 ? 1e-12 : da) > 0) !== ((db === 0 ? 1e-12 : db) > 0)) out.push(k);
  }
  return out;
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Shortest path over mesh edges from a point in one triangle to a point in another.
function edgePath(pos, index, A, tA, B, tB, vertexCount) {
  const n = vertexCount || pos.length / 3, adj = edgePath.cache && edgePath.cache.index === index ? edgePath.cache.adj : null;
  let nbrs = adj;
  if (!nbrs) {
    const lists = Array.from({ length: n }, () => []);
    for (let i = 0; i < index.length; i += 3) for (let k = 0; k < 3; k++) { const a = index[i + k], b = index[i + (k + 1) % 3]; if (!lists[a].includes(b)) { lists[a].push(b); lists[b].push(a); } }
    nbrs = lists; edgePath.cache = { index, adj: lists };
  }
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const cost = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const heap = []; const push = (c, v) => { heap.push([c, v]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (let k = 0; k < 3; k++) { const v = index[tA * 3 + k], c = dist(A, P(v)); if (c < cost[v]) { cost[v] = c; push(c, v); } }
  const goals = new Map(); for (let k = 0; k < 3; k++) { const v = index[tB * 3 + k]; goals.set(v, dist(P(v), B)); }
  let best = Infinity, bestV = -1, left = goals.size;
  while (heap.length) {
    const [c, v] = pop(); if (done[v]) continue; done[v] = 1;
    if (c >= best) break;
    if (goals.has(v)) { const total = c + goals.get(v); if (total < best) { best = total; bestV = v; } if (!--left) break; }
    for (const w of nbrs[v]) { const nc = c + dist(P(v), P(w)); if (nc < cost[w]) { cost[w] = nc; from[w] = v; push(nc, w); } }
  }
  if (bestV < 0) return null;
  const pts = [B]; for (let v = bestV; v >= 0; v = from[v]) pts.push(P(v)); pts.push(A); pts.reverse();
  return { len: best, pts };
}

// Length along the skin from A (in triangle tA, surface normal nA) to B (tB, nB).
export function alongSkin(pos, index, nb, A, tA, nA, B, tB, nB, { maxSteps = 6000 } = {}) {
  if (tA === tB) return { len: dist(A, B), pts: [A, B], how: 'straight' };
  const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  let up = [nA[0] + nB[0], nA[1] + nB[1], nA[2] + nB[2]];
  if (Math.hypot(...up) < 0.3) up = nA; // points on opposite sides: the cut holds the first one's normal
  let pn = crossV(ab, up); if (Math.hypot(...pn) < 1e-9) pn = crossV(ab, [0, 1, 0]); pn = norm(pn);
  let best = null;
  for (const e of crossingEdges(pos, index, pn, A, tA)) {
    const w = walkCut(pos, index, nb, pn, A, tA, A, e, tB, B, maxSteps);
    if (w && (!best || w.len < best.len)) best = { len: w.len, pts: w.pts, how: 'cut' };
  }
  const e = edgePath(pos, index, A, tA, B, tB);
  if (e && (!best || e.len < best.len)) best = { len: e.len, pts: e.pts, how: 'edges' };
  return best;
}

// The shortest way round the body through P (in triangle tP, surface normal nP).
export function aroundAt(pos, index, nb, P, tP, nP, { steps = 36, maxSteps = 4000 } = {}) {
  const n = norm(nP), ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = norm(crossV(n, ref)), v = crossV(n, u);
  const loopFor = (th) => {
    const m = [u[0] * Math.cos(th) + v[0] * Math.sin(th), u[1] * Math.cos(th) + v[1] * Math.sin(th), u[2] * Math.cos(th) + v[2] * Math.sin(th)];
    const edges = crossingEdges(pos, index, m, P, tP); if (edges.length < 2) return null;
    const w = walkCut(pos, index, nb, m, P, tP, P, edges[0], tP, P, maxSteps);
    return w ? { len: w.len, pts: w.pts, axis: m } : null;
  };
  let best = null, bestTh = 0;
  for (let i = 0; i < steps; i++) { const th = Math.PI * i / steps, l = loopFor(th); if (l && (!best || l.len < best.len)) { best = l; bestTh = th; } }
  if (!best) return null;
  for (let i = -5; i <= 5; i++) { const th = bestTh + Math.PI / steps * i / 5, l = loopFor(th); if (l && l.len < best.len) best = l; }
  return best;
}

// Inches and centimetres for a length in body units at a body height in cm.
export function tapeText(len, heightCm) {
  const cm = len * heightCm / 1.75, inch = cm / 2.54;
  return { cm, inch, text: `${inch < 10 ? inch.toFixed(1) : Math.round(inch)} in (${cm < 10 ? cm.toFixed(1) : Math.round(cm)} cm)` };
}
