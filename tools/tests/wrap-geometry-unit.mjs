// Measured wrap geometry: Jake's ankle (9 in and 12.5 in round, 4 in apart) develops to the arcs,
// slant and box his spec gives, for both ways of measuring the 4 in; the box takes in the bulge of
// the arc between the corners; equal and nearly equal circumferences give a steady rectangle;
// narrowing cones, stacked rings, the canvas in pixels, and the rectangular view all round-trip.
import assert from 'node:assert/strict';
import { frustum, develop, point, invert, circAt, arcLength, bounds, outline, canvasFor, toPx, fromPx, pxFor, ptFor, summary, rectToTemplate, templateToRect, segPoint } from '../../src/wrap-geometry.js';

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const IN = 25.4;

// Jake's numbers, the 4 in along the skin
const skin = develop([{ circ: 9 * IN }, { circ: 12.5 * IN, gap: 4 * IN }], 'skin');
let s = summary(skin);
near(s.lower, 228.6, 1e-9, 'lower arc'); near(s.upper, 317.5, 1e-9, 'upper arc'); near(s.middle, 273.05, 1e-9, 'middle arc');
near(s.slant, 101.6, 1e-12, 'slant');
near(s.w, 307.47, 0.01, 'box width'); near(s.h, 126.21, 0.01, 'box height');
near(s.w / IN, 12.105, 0.001, 'box width in'); near(s.h / IN, 4.969, 0.001, 'box height in');
assert.ok(s.w < 12.5 * IN, 'the box is not stretched to the 12.5 in arc');
// the distance between the arcs along any line square to them is the slant
for (const f of [-0.5, -0.3, 0, 0.21, 0.5]) { const a = point(skin, f, 0), b = point(skin, f, skin.slant); near(Math.hypot(b[0] - a[0], b[1] - a[1]), 101.6, 1e-9, 'radial length at ' + f); }
// the arc lengths measured by walking the curve, not by formula
const walk = (u) => { let L = 0, p = point(skin, -0.5, u); for (let i = 1; i <= 20000; i++) { const q = point(skin, -0.5 + i / 20000, u); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; } return L; };
near(walk(0), 228.6, 0.001, 'walked lower arc'); near(walk(skin.slant / 2), 273.05, 0.001, 'walked middle arc'); near(walk(skin.slant), 317.5, 0.001, 'walked upper arc');
for (const u of [0, 30, 50.8, 101.6]) near(arcLength(skin, u), circAt(skin, u), 1e-9, 'arc = circumference at ' + u);

// the same 4 in as straight-up height
const ax = develop([{ circ: 9 * IN }, { circ: 12.5 * IN, gap: 4 * IN }], 'axial');
s = summary(ax);
near(s.w, 307.66, 0.01, 'axial box width'); near(s.h, 126.96, 0.01, 'axial box height');
near(s.lower, 228.6, 1e-9, 'axial lower'); near(s.upper, 317.5, 1e-9, 'axial upper'); near(s.height, 101.6, 1e-9, 'axial height');
const g = frustum(228.6, 317.5, 101.6, 'skin');
near(Math.hypot(g.h, g.dr), 101.6, 1e-9, 'h and dr make the slant');
assert.throws(() => frustum(100, 400, 20, 'skin'), /longer than the difference/, 'a slant shorter than the change in radius is refused');
assert.throws(() => frustum(0, 100, 20), /positive/);

// the box is the whole curve: it is taller than the four corners alone
const corners = [point(skin, -0.5, 0), point(skin, 0.5, 0), point(skin, -0.5, skin.slant), point(skin, 0.5, skin.slant)];
const cornerTop = Math.max(...corners.map((p) => p[1])), cornerBottom = Math.min(...corners.map((p) => p[1]));
assert.ok(skin.bounds.maxY > cornerTop + 10, 'the top arc bulges above its corners and is inside the box');
// nothing on the outline sticks out of the box
for (const t of [skin, ax]) for (const p of outline(t, 400)) assert.ok(p[0] >= t.bounds.minX - 1e-9 && p[0] <= t.bounds.maxX + 1e-9 && p[1] >= t.bounds.minY - 1e-9 && p[1] <= t.bounds.maxY + 1e-9, 'outline inside box');
// a steep cone wraps past a half turn: its width is the full diameter of the outer arc
const steep = develop([{ circ: 50 }, { circ: 400, gap: 60 }], 'skin');
assert.ok(steep.segs[0].angle > Math.PI, 'steep cone opens past a half turn');
near(steep.bounds.w, 2 * steep.segs[0].Rt, 1e-9, 'width at the quarter turns, not the corners');
for (const p of outline(steep, 800)) assert.ok(p[0] >= steep.bounds.minX - 1e-9 && p[0] <= steep.bounds.maxX + 1e-9 && p[1] <= steep.bounds.maxY + 1e-9 && p[1] >= steep.bounds.minY - 1e-9, 'steep outline inside box');
assert.ok(cornerBottom >= skin.bounds.minY - 1e-9);

// equal and nearly equal circumferences: a rectangle, with no jump as the difference shrinks
const cyl = develop([{ circ: 250 }, { circ: 250, gap: 100 }]);
assert.ok(cyl.segs[0].flat, 'equal rings are a cylinder'); near(cyl.bounds.w, 250, 1e-12, 'cylinder width'); near(cyl.bounds.h, 100, 1e-12, 'cylinder height');
for (const d of [1e-12, 1e-9, 1e-7, 1e-5, 1e-3, 0.1]) {
  for (const sign of [1, -1]) {
    const t = develop([{ circ: 250 }, { circ: 250 + sign * d, gap: 100 }]), m = summary(t);
    near(m.lower, 250, 1e-6, 'nearly equal lower ' + d); near(m.upper, 250 + sign * d, 1e-6, 'nearly equal upper ' + d);
    near(m.w, 250 + Math.max(0, sign * d), 0.01, 'nearly equal width ' + d); near(m.h, 100, d >= 0.1 ? 0.05 : 0.01, 'nearly equal height ' + d);
    assert.ok([m.w, m.h, m.lower, m.upper].every(Number.isFinite), 'finite at ' + d);
    const q = point(t, 0.16, 30), r = invert(t, q[0], q[1]); near(r.u, 30, 1e-6, 'invert u near cylinder ' + d); near(r.f, 0.16, 1e-9, 'invert f near cylinder ' + d);
  }
}

// a ring that narrows upward (a calf above its widest point) bows the other way and still measures true
const down = develop([{ circ: 380 }, { circ: 330, gap: 120 }]);
s = summary(down); near(s.lower, 380, 1e-9, 'narrowing lower'); near(s.upper, 330, 1e-9, 'narrowing upper');
for (const p of outline(down, 400)) assert.ok(p[1] >= down.bounds.minY - 1e-9 && p[1] <= down.bounds.maxY + 1e-9);

// invert is the exact way back, across the whole template, for every shape
for (const t of [skin, ax, down, steep, cyl]) for (const f of [-0.5, -0.25, 0, 0.1, 0.49]) for (const k of [0, 0.3, 0.77, 1]) {
  const u = k * t.slant, p = point(t, f, u), r = invert(t, p[0], p[1]);
  near(r.f, f, 1e-9, 'f back'); near(r.u, u, 1e-9, 'u back'); assert.ok(r.inside, 'inside');
}
assert.equal(invert(skin, 0, -20).inside, false, 'below the lowest arc is outside');
assert.equal(invert(skin, 200, 40).inside, false, 'past the cut edge is outside');

// more rings: each segment keeps its own arcs, and the box holds them all
const three = develop([{ circ: 228.6 }, { circ: 317.5, gap: 101.6 }, { circ: 350, gap: 60 }]);
near(arcLength(three, 0), 228.6, 1e-9, 'stack lower'); near(arcLength(three, 101.6), 317.5, 1e-9, 'stack shared ring'); near(arcLength(three, 161.6), 350, 1e-9, 'stack top');
near(three.slant, 161.6, 1e-12, 'stack slant');
for (const p of outline(three, 300)) assert.ok(p[0] <= three.bounds.maxX + 1e-9 && p[1] <= three.bounds.maxY + 1e-9 && p[1] >= three.bounds.minY - 1e-9);
for (const f of [-0.4, 0, 0.3]) for (const u of [10, 120, 150]) { const p = point(three, f, u), r = invert(three, p[0], p[1]); near(r.f, f, 1e-9, 'stack f back'); near(r.u, u, 1e-9, 'stack u back'); }

// the canvas: exact physical size kept apart from the rounded pixels; PPI changes pixels only
const c300 = canvasFor(skin, { ppi: 300, padMm: 0 }), c600 = canvasFor(skin, { ppi: 600, padMm: 0 });
near(c300.wMm, 307.47, 0.01, 'canvas mm'); near(c600.wMm, c300.wMm, 1e-12, 'ppi leaves mm alone'); near(c600.hMm, c300.hMm, 1e-12, 'ppi leaves mm alone (h)');
assert.equal(c300.w, pxFor(c300.wMm, 300)); assert.equal(c300.w, Math.round(307.4683 / 25.4 * 300) || c300.w);
assert.equal(c600.w, pxFor(c600.wMm, 600));
const padded = canvasFor(skin, { ppi: 300, padMm: 6 });
near(padded.wMm, skin.bounds.w + 12, 1e-9, 'padding both sides');
// template corners land inside the canvas, the padding stays clear, and px round-trips
for (const p of outline(skin, 60)) { const q = toPx(padded, p[0], p[1]); assert.ok(q[0] >= 6 / 25.4 * 300 - 1 && q[0] <= padded.w - 6 / 25.4 * 300 + 1 && q[1] >= 6 / 25.4 * 300 - 1 && q[1] <= padded.h - 6 / 25.4 * 300 + 1, 'template inside padding'); const b = fromPx(padded, q[0], q[1]); near(b[0], p[0], 1e-9, 'px x back'); near(b[1], p[1], 1e-9, 'px y back'); }
near(ptFor(25.4), 72, 1e-12, 'one inch is 72 points'); near(ptFor(307.47), 307.47 / 25.4 * 72, 1e-12);

// the rectangular view maps to the measured shape and back, never stretched into it
for (const [X, Y] of [[10, 5], [158.75, 50], [300, 100]]) { const p = rectToTemplate(skin, X, Y), r = templateToRect(skin, p[0], p[1]); near(r[0], X, 1e-9, 'rect X'); near(r[1], Y, 1e-9, 'rect Y'); }
near(segPoint(skin.segs[0], 0, 50)[1], 50, 1e-12, 'middle line is straight');
console.log('wrap-geometry-unit PASS');
