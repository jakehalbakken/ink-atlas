// Moving a piece that goes round an arm or leg (pure maths, no three.js).
//
// A flat drag (the middle of the tattoo follows the finger) cannot work for a band: its middle is
// often round the back of the limb, out of sight, and the skin under the finger faces another way
// from the middle. So a band moves like a ring on a rod: the skin point under the finger is read as
// a distance along the limb's line and an angle round it, and the band is turned round the limb and
// slid along it by the same amounts. Sideways turns it round, up and down slides it along.
//
// joints: the limb's joints down the limb in the standing body (shoulder, elbow, wrist or hip, knee,
// ankle). The line runs on a little past both ends, so a band at the wrist or ankle still has a line.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function limbAxis(joints, ext = 0.15) {
  const segs = []; let total = 0;
  for (let i = 0; i < joints.length - 1; i++) {
    const d = sub(joints[i + 1], joints[i]), len = Math.hypot(...d) || 1e-9;
    segs.push({ a: joints[i].slice(), dir: d.map((x) => x / len), len, start: total }); total += len;
  }
  const f = segs[0], l = segs[segs.length - 1];
  f.a = f.a.map((x, i) => x - f.dir[i] * ext); f.len += ext; for (const g of segs) if (g !== f) g.start += ext; l.len += ext; total += 2 * ext;
  // one "outside" direction carried down the limb so angles agree between its parts
  let o = Math.abs(f.dir[0]) > 0.8 ? [0, 0, 1] : [1, 0, 0];
  for (const g of segs) {
    const k = dot(o, g.dir); o = unit(o.map((x, i) => x - g.dir[i] * k));
    g.o = o; g.side = crossV(g.dir, o);
  }
  return { segs, total, ext };
}

// Where a point sits: s along the line, angle round it, r its distance from the line.
export function limbPlace(ax, p) {
  let best = null, bd = Infinity;
  for (const g of ax.segs) {
    const q = sub(p, g.a), tt = Math.max(0, Math.min(g.len, dot(q, g.dir))), w = q.map((x, i) => x - g.dir[i] * tt), d = Math.hypot(...w);
    if (d < bd) { bd = d; best = { g, s: g.start + tt, w }; }
  }
  const { g, s, w } = best;
  return { s, angle: Math.atan2(dot(w, g.side), dot(w, g.o)), r: bd, dir: g.dir };
}

// The point at s along the line and angle round it, r out from it, and the way out there.
export function limbPoint(ax, s, angle, r) {
  const sc = Math.max(ax.ext * 0.5, Math.min(ax.total - ax.ext * 0.5, s));
  let g = ax.segs[ax.segs.length - 1];
  for (const x of ax.segs) if (sc <= x.start + x.len) { g = x; break; }
  const tt = sc - g.start, c = g.a.map((x, i) => x + g.dir[i] * tt);
  const out = [0, 1, 2].map((i) => Math.cos(angle) * g.o[i] + Math.sin(angle) * g.side[i]);
  return { point: c.map((x, i) => x + out[i] * r), out, dir: g.dir, s: sc };
}

// Turn v round the unit axis k by a (Rodrigues).
export function spin(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), kv = dot(k, v), kx = crossV(k, v);
  return [0, 1, 2].map((i) => v[i] * c + kx[i] * s + k[i] * kv * (1 - c));
}

// How far round the limb a piece reaches, as a share of the way round (about 2 pi r there).
// right and up: the artwork's own directions on the skin; n the skin's outward direction there;
// w, h its size; at: limbPlace of its middle. The way round is square to the line and to the skin.
export function shareRound(right, up, n, w, h, at) {
  const round = unit(crossV(at.dir, n));
  const reach = Math.abs(dot(right, round)) * w + Math.abs(dot(up, round)) * h;
  return { reach, share: at.r > 0 ? reach / (2 * Math.PI * at.r) : 0 };
}

// One drag step: the finger moved from (s0, a0) to (s1, a1) on the limb. Turns and slides the
// piece that started at `start` (its limbPlace, its up direction) by the whole way moved so far.
export class LimbDrag {
  constructor(ax, start, finger, up0) { this.ax = ax; this.start = start; this.up0 = up0; this.s = finger.s; this.a = finger.angle; this.dS = 0; this.dA = 0; }
  // finger: limbPlace of the skin under the finger now, or null when it is off the limb
  step(finger) {
    if (!finger) { this.lost = true; return null; }
    if (this.lost) { this.lost = false; this.s = finger.s; this.a = finger.angle; return this.spot(); }
    this.dA += wrapAngle(finger.angle - this.a); this.dS += finger.s - this.s; this.a = finger.angle; this.s = finger.s;
    return this.spot();
  }
  // where the middle should go: a point a little outside the skin to look back in from, the way in,
  // and the artwork's up turned with it
  spot() {
    const p = limbPoint(this.ax, this.start.s + this.dS, this.start.angle + this.dA, this.start.r);
    return { point: p.point, out: p.out, up: spin(this.up0, this.start.dir, this.dA), s: p.s };
  }
}

// The turn (as t.rot) that gives a skin frame (x, y) this up direction, flattened onto the skin.
export function rotFor(x, y, up) { return Math.atan2(-dot(up, x), dot(up, y)); }

// The turn that lays the artwork's long side round the limb, with its top towards the body.
// x, y: the skin frame at rot 0; dir: the limb's line, pointing away from the body; aspect: w / h.
export function rotRound(x, y, dir, aspect) {
  const xd = dot(x, dir), yd = dot(y, dir);
  // long side across: right square to the line, so up runs along it; else up runs round
  const r = aspect >= 1 ? Math.atan2(-xd, yd) : Math.atan2(yd, xd);
  const upOf = (a) => [0, 1, 2].map((i) => -Math.sin(a) * x[i] + Math.cos(a) * y[i]);
  const rightOf = (a) => [0, 1, 2].map((i) => Math.cos(a) * x[i] + Math.sin(a) * y[i]);
  // top towards the body (against dir) when up runs along; when up runs round, keep right towards the body
  const score = (a) => (aspect >= 1 ? -dot(upOf(a), dir) : -dot(rightOf(a), dir));
  return wrapAngle(score(r) >= score(r + Math.PI) ? r : r + Math.PI);
}
