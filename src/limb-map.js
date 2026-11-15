// A limb's skin laid flat, the way artists plan a sleeve: cut along the inside of the arm (or leg),
// unrolled round the limb, with the top of the limb at the top. Each vertex gets its distance down
// the limb (along the line of its joints) and its angle round it, measured from the outside of the
// limb; across the map that angle is multiplied by the vertex's own distance from the limb's middle,
// so a wider part of the limb comes out wider. Pure maths, no three.js.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// pos: flat xyz; count: vertices; joints: the line of the limb from its top, [[x,y,z], ...];
// keep(v): whether a vertex belongs to the limb; outward: the direction the outside of the limb
// faces (its middle on the map). Returns { ang, r, s, length } with ang (radians, -PI..PI, 0 the
// outside), r (distance from the limb's line) and s (distance down the limb) per vertex, NaN for
// vertices not kept. With trim, vertices beyond either end of the limb's line are left out too, so
// the map stops cleanly at the shoulder (or hip) and the wrist (or ankle) instead of piling them up.
export function unrollLimb({ pos, count, joints, keep, outward, trim = false }) {
  const n = joints.length - 1, segs = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const d = sub(joints[i + 1], joints[i]), len = Math.hypot(...d) || 1e-9, dir = d.map((v) => v / len);
    // the outside, square to this part of the limb
    let o = sub(outward, dir.map((v) => v * dot(outward, dir)));
    if (Math.hypot(...o) < 1e-6) o = crs(dir, [0, 0, 1]);
    o = nrm(o); const side = crs(dir, o);
    segs.push({ a: joints[i], dir, len, o, side, start: total }); total += len;
  }
  const ang = new Float32Array(count).fill(NaN), r = new Float32Array(count).fill(NaN), s = new Float32Array(count).fill(NaN);
  for (let v = 0; v < count; v++) {
    if (!keep(v)) continue;
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    let best = null, bd = Infinity;
    for (const g of segs) {
      const t = Math.max(0, Math.min(g.len, dot(sub(p, g.a), g.dir))), q = g.a.map((x, i) => x + g.dir[i] * t), d = Math.hypot(...sub(p, q));
      if (d < bd) { bd = d; best = { g, t, q }; }
    }
    if (trim) { const g0 = segs[0], gl = segs[n - 1]; if (dot(sub(p, g0.a), g0.dir) < 0 || dot(sub(p, gl.a), gl.dir) > gl.len) continue; }
    const w = sub(p, best.q), g = best.g;
    ang[v] = Math.atan2(dot(w, g.side), dot(w, g.o)); r[v] = bd; s[v] = g.start + best.t;
  }
  return { ang, r, s, length: total };
}

// A triangle's corners on the map, [x, y] each (x across, y down the limb), as one or two
// triangles: one that crosses the cut along the inside of the limb is drawn on both edges of the
// map. Returns [] when a corner is not on the limb.
export function mapTriangle(m, a, b, c) {
  const vs = [a, b, c];
  if (vs.some((v) => !Number.isFinite(m.ang[v]))) return [];
  const A = vs.map((v) => m.ang[v]);
  const flat = (shift) => vs.map((v, i) => { let t = A[i]; if (shift && t * shift < 0) t += 2 * Math.PI * shift; return [t * m.r[v], m.s[v]]; });
  if (Math.max(...A) - Math.min(...A) <= Math.PI) return [flat(0)];
  return [flat(1), flat(-1)];
}

// The limb's map bounds: the widest the map gets either side of the middle, and its length.
export function mapBounds(m) {
  let w = 0;
  for (let v = 0; v < m.r.length; v++) if (Number.isFinite(m.r[v])) w = Math.max(w, m.r[v] * Math.PI);
  return { half: w, length: m.length };
}

// The usual distance round the limb: twice pi times the median distance of its skin from its line.
export function typicalRound(m) {
  const r = Array.from(m.r).filter(Number.isFinite).sort((a, b) => a - b);
  return r.length ? 2 * Math.PI * r[r.length >> 1] : 0;
}
