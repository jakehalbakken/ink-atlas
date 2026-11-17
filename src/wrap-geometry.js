// A measured wrap laid flat: the skin between two (or more) measured rings round an arm or leg,
// taken as a stack of circular cones (frustums) and developed onto the flat page exactly, so the
// lower ring comes out as an arc as long as the lower circumference, the upper ring as long as the
// upper one, and every line square to the rings as long as the length along the skin.
//
// Pure maths, millimetres throughout, no three.js and no DOM, so every number can be tested.
//
// Flat template coordinates: x to the right, y up, the middle of the lowest arc at (0, 0). Across
// the template, f runs from -0.5 at the left cut edge to +0.5 at the right cut edge (0 is the line
// opposite the cut, the seam); up the template, u is the length along the skin from the lowest ring.

const TAU = 2 * Math.PI;
// Below this slope (difference in radius per length along the skin) a segment is drawn as the
// cylinder it all but is: the flat shape is then a rectangle, with no huge radius to divide by.
// At 1e-6 the cone and the rectangle differ by well under a thousandth of a millimetre.
export const FLAT_SLOPE = 1e-6;

// One cone segment between a lower circumference cb and an upper ct (mm), from either its length
// along the skin (method 'skin') or the straight-up distance between the two rings ('axial').
// Throws on numbers that cannot describe a real cone: lengths must be positive, and a length along
// the skin must be longer than the difference in radius.
export function frustum(cb, ct, length, method = 'skin') {
  if (![cb, ct, length].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)) throw new Error('Circumferences and length must be positive numbers');
  const rb = cb / TAU, rt = ct / TAU, dr = rt - rb;
  let s, h;
  if (method === 'axial') { h = length; s = Math.hypot(h, dr); }
  else if (method === 'skin') {
    s = length;
    if (!(s > Math.abs(dr))) throw new Error('The length along the skin must be longer than the difference in radius (' + Math.abs(dr).toFixed(1) + ' mm)');
    h = Math.sqrt((s - Math.abs(dr)) * (s + Math.abs(dr)));
  } else throw new Error('Unknown measuring method');
  const slope = dr / s, flat = Math.abs(slope) < FLAT_SLOPE;
  // widening upward: the cone's tip is below and the arcs bow upward; narrowing: the other way
  const dir = flat ? 0 : Math.sign(dr);
  const angle = flat ? 0 : TAU * Math.abs(dr) / s;
  // radius of the lower arc about the cone's tip (the larger arc's radius is Rb + dir * s)
  const Rb = flat ? Infinity : s * rb / Math.abs(dr), Rt = flat ? Infinity : s * rt / Math.abs(dr);
  return { cb, ct, rb, rt, dr, s, h, method, flat, dir, angle, Rb, Rt };
}

// Where a point (f across, u along the skin from this segment's lower ring) lands, in this
// segment's own frame (the middle of its lower arc at the origin). The forms below are the stable
// ones: nothing large is subtracted from something nearly as large.
export function segPoint(g, f, u) {
  if (g.flat) { const c = g.cb + (g.ct - g.cb) * (u / g.s); return [f * c, u]; }
  const a = f * g.angle, sh = Math.sin(a / 2);
  if (g.dir > 0) { const R = g.Rb + u; return [R * Math.sin(a), u * Math.cos(a) - 2 * g.Rb * sh * sh]; }
  const R = g.Rb - u; return [R * Math.sin(a), u * Math.cos(a) + 2 * g.Rb * sh * sh];
}

// The other way: a point in the segment's frame to { f, u }, or null for no answer (beyond the
// cone's tip). Points outside the segment come back with f or u outside its range, so the caller
// can tell how far out they are.
export function segInvert(g, x, y) {
  if (g.flat) { const u = y, c = g.cb + (g.ct - g.cb) * (u / g.s); return c > 0 ? { f: x / c, u } : null; }
  if (g.dir > 0) { const cy = y + g.Rb, R = Math.hypot(x, cy); return { f: Math.atan2(x, cy) / g.angle, u: R - g.Rb }; }
  const cy = g.Rb - y, R = Math.hypot(x, cy); return { f: Math.atan2(x, cy) / g.angle, u: g.Rb - R };
}

// Levels bottom to top: [{ circ }, { circ, gap }, ...] where gap is the length to the level below,
// measured along the skin or straight up as `method` says. Returns the developed template.
export function develop(levels, method = 'skin') {
  if (!Array.isArray(levels) || levels.length < 2) throw new Error('A wrap needs at least two measured rings');
  const segs = []; let y0 = 0, u0 = 0;
  for (let i = 1; i < levels.length; i++) {
    const g = frustum(levels[i - 1].circ, levels[i].circ, levels[i].gap, method);
    g.y0 = y0; g.u0 = u0; segs.push(g);
    y0 += g.s; u0 += g.s; // the middle line of every segment is straight and as long as its slant
  }
  const t = { method, segs, slant: u0, height: segs.reduce((a, g) => a + g.h, 0), levels: levels.map((l) => l.circ) };
  t.bounds = bounds(t);
  return t;
}

// Template point from f across and u along the skin from the lowest ring.
export function point(t, f, u) {
  const g = segAt(t, u), p = segPoint(g, f, u - g.u0);
  return [p[0], p[1] + g.y0];
}
function segAt(t, u) {
  for (const g of t.segs) if (u <= g.u0 + g.s) return g;
  return t.segs[t.segs.length - 1];
}

// Template point to { f, u, inside }: which segment it falls in is the one whose band of u holds
// it (where two segments of different taper meet, each keeps its own side of their shared ring).
export function invert(t, x, y) {
  let best = null;
  for (let i = 0; i < t.segs.length; i++) {
    const g = t.segs[i], r = segInvert(g, x, y - g.y0); if (!r) continue;
    const u = r.u + g.u0, lo = i === 0 ? -Infinity : g.u0, hi = i === t.segs.length - 1 ? Infinity : g.u0 + g.s;
    const miss = u < lo ? lo - u : u > hi ? u - hi : 0;
    if (!best || miss < best.miss) best = { f: r.f, u, miss };
    if (!miss) break;
  }
  if (!best) return null;
  const e = 1e-9 * Math.max(1, t.slant); // rounding at the very edge still counts as on it
  return { f: best.f, u: best.u, inside: Math.abs(best.f) <= 0.5 + 1e-12 && best.u >= -e && best.u <= t.slant + e };
}

// Circumference of the ring at u along the skin: what the developed arc there must measure.
export function circAt(t, u) {
  const g = segAt(t, u), k = Math.min(1, Math.max(0, (u - g.u0) / g.s));
  return g.cb + (g.ct - g.cb) * k;
}
// Length of the developed arc at u, measured on the template itself (by its radius and angle, or
// across the rectangle): equal to circAt by construction, and the check that it is.
export function arcLength(t, u) {
  const g = segAt(t, u), v = u - g.u0;
  if (g.flat) return g.cb + (g.ct - g.cb) * (v / g.s);
  return (g.dir > 0 ? g.Rb + v : g.Rb - v) * g.angle;
}

// The exact box round the whole curved shape. On every arc, x = R sin a and y = R cos a + c reach
// their extremes at the ends or where a is a multiple of a quarter turn; the straight cut edges
// reach theirs at their ends. So those candidates are enough: nothing between them can stick out.
// fr is how far across to take it (0.5 is the measured shape itself; more takes in the run-on
// strips past each cut, see runOnFor).
export function bounds(t, fr = 0.5) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const take = (p) => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; };
  for (const g of t.segs) {
    const fs = [-fr, fr];
    if (!g.flat) for (let k = -4; k <= 4; k++) { const f = k * (Math.PI / 2) / g.angle; if (f > -fr && f < fr) fs.push(f); }
    for (const v of [0, g.s]) for (const f of fs) { const p = segPoint(g, f, v); take([p[0], p[1] + g.y0]); }
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

// The outline of the template as one closed polygon (template mm), for drawing and for clipping:
// up the right cut edge, back along each upper arc, down the left edge and along the lowest arc.
// fr as in bounds.
export function outline(t, steps = 96, fr = 0.5) {
  const pts = [];
  const arc = (u, from, to) => { for (let i = 0; i <= steps; i++) pts.push(point(t, from + (to - from) * i / steps, u)); };
  arc(0, -fr, fr);
  for (const g of t.segs) pts.push(point(t, fr, g.u0 + g.s));
  arc(t.slant, fr, -fr);
  for (let i = t.segs.length - 1; i >= 0; i--) pts.push(point(t, -fr, t.segs[i].u0));
  return pts;
}

// Run-on strips. Laid flat, the wrap is cut, so the skin just past the right cut edge is the skin
// at the left one. The file for drawing in adds a strip past each cut that repeats the other end
// (a share of a turn wide), so a design can be drawn straight across the cut; what is drawn there
// is folded back onto the other end when it comes back. The strips stop short of meeting each
// other round a steep cone.
export const RUN_ON = 0.2;
export function runOnFor(t, want = RUN_ON) {
  let ro = want;
  for (const g of t.segs) if (!g.flat) ro = Math.min(ro, Math.PI / g.angle - 0.5 - 0.05);
  return Math.max(0, ro);
}
// One segment's band between f0 and f1 (any order), all the way up it, as a closed polygon in
// template mm.
export function band(t, i, f0, f1, steps = 24) {
  const g = t.segs[i], pts = [], at = (f, v) => { const p = segPoint(g, f, v); return [p[0], p[1] + g.y0]; };
  for (let k = 0; k <= steps; k++) pts.push(at(f0 + (f1 - f0) * k / steps, 0));
  for (let k = 0; k <= steps; k++) pts.push(at(f1, g.s * k / steps));
  for (let k = 0; k <= steps; k++) pts.push(at(f1 + (f0 - f1) * k / steps, g.s));
  for (let k = 0; k <= steps; k++) pts.push(at(f0, g.s * (1 - k / steps)));
  return pts;
}
// The exact map, in segment i, from the point at (f, u) to the point at (f + k, u): a turn about
// the cone's tip (a slide sideways for a straight segment). As a canvas-style affine
// [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f.
export function wrapAffine(t, i, k) {
  const g = t.segs[i], at = (f, v) => { const p = segPoint(g, f, v); return [p[0], p[1] + g.y0]; };
  const src = [at(0, 0), at(0, g.s), at(0.25, 0)], dst = [at(k, 0), at(k, g.s), at(0.25 + k, 0)];
  return affineFrom3(src, dst);
}
export function affineFrom3(src, dst) {
  const [[x0, y0], [x1, y1], [x2, y2]] = src, det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(det) < 1e-12) throw new Error('Points in a line');
  const solve = (v0, v1, v2) => {
    const p = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det, q = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det;
    return [p, q, v0 - p * x0 - q * y0];
  };
  const X = solve(dst[0][0], dst[1][0], dst[2][0]), Y = solve(dst[0][1], dst[1][1], dst[2][1]);
  return [X[0], Y[0], X[1], Y[1], X[2], Y[2]];
}
export const applyAffine = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// The rectangular canvas the template sits in: its exact physical size, how many pixels at `ppi`,
// and where template (0, 0) lands. Rows run from the top, as in a picture.
export function canvasFor(t, { ppi = 300, padMm = 6, box = null } = {}) {
  if (!(ppi > 0) || !(padMm >= 0)) throw new Error('Bad canvas settings');
  const b = box || t.bounds, wMm = b.w + 2 * padMm, hMm = b.h + 2 * padMm;
  return {
    ppi, padMm, wMm, hMm,
    w: Math.round(wMm / 25.4 * ppi), h: Math.round(hMm / 25.4 * ppi),
    // template mm -> canvas mm from the top left corner
    originMm: [padMm - b.minX, padMm + b.maxY],
  };
}
// Template mm to canvas pixels and back, with the canvas's own exact scale (pixels over mm, per
// axis, since rounding the pixel count changes it very slightly).
export function toPx(c, x, y) { return [(c.originMm[0] + x) * (c.w / c.wMm), (c.originMm[1] - y) * (c.h / c.hMm)]; }
export function fromPx(c, px, py) { return [px / (c.w / c.wMm) - c.originMm[0], c.originMm[1] - py / (c.h / c.hMm)]; }

// pixelDimension = round(mm / 25.4 x PPI); PDF points = mm / 25.4 x 72.
export const pxFor = (mm, ppi) => Math.round(mm / 25.4 * ppi);
export const ptFor = (mm) => mm / 25.4 * 72;

// An optional rectangular view for composing: across is the fraction of the way round times the
// widest ring, up is the length along the skin. These two map it to and from the true template,
// so anything drawn in the rectangle is put on the measured shape explicitly, never by stretching.
export function rectSize(t) { return { w: Math.max(...t.levels), h: t.slant }; }
export function rectToTemplate(t, X, Y) { const w = Math.max(...t.levels); return point(t, X / w - 0.5, Y); }
export function templateToRect(t, x, y) { const r = invert(t, x, y); if (!r) return null; const w = Math.max(...t.levels); return [(r.f + 0.5) * w, r.u]; }

// Whole template summary in plain numbers, for the form and the tests.
export function summary(t) {
  return {
    lower: arcLength(t, 0), upper: arcLength(t, t.slant), middle: arcLength(t, t.slant / 2),
    slant: t.slant, height: t.height, w: t.bounds.w, h: t.bounds.h,
  };
}
