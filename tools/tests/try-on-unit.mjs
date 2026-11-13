// Try on with camera: the maths behind it. Two fingers keep their grip on the artwork, a
// picture covers the view the way the camera does, and the arm curve keeps the middle at true
// scale while the edges bunch up.
import assert from 'node:assert/strict';
import { coverRect, pinch, sourceU, curvedWidth, curveTurn } from '../../src/try-on.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
// cover: fills the box, keeps the shape, centred
{ const r = coverRect(1920, 1080, 1000, 1000); assert.ok(near(r.h, 1000) && near(r.w, 1920 * 1000 / 1080) && near(r.x, (1000 - r.w) / 2) && near(r.y, 0)); }
{ const r = coverRect(1080, 1920, 1200, 800); assert.ok(near(r.w, 1200) && r.h > 800 && near(r.y, (800 - r.h) / 2)); }

// pinch: a point of the art under each finger stays under that finger
const toLocal = (t, p) => { const dx = p.x - t.x, dy = p.y - t.y, c = Math.cos(-t.r), s = Math.sin(-t.r); return { x: (c * dx - s * dy) / t.s, y: (s * dx + c * dy) / t.s }; };
const toScreen = (t, q) => { const c = Math.cos(t.r), s = Math.sin(t.r); return { x: t.x + t.s * (c * q.x - s * q.y), y: t.y + t.s * (s * q.x + c * q.y) }; };
const t0 = { x: 400, y: 300, s: 1.2, r: 0.3 };
const a0 = { x: 350, y: 280 }, b0 = { x: 470, y: 330 }, a1 = { x: 300, y: 400 }, b1 = { x: 520, y: 520 };
const qa = toLocal(t0, a0), qb = toLocal(t0, b0), t1 = pinch(t0, a0, b0, a1, b1);
for (const [q, p] of [[qa, a1], [qb, b1]]) { const s = toScreen(t1, q); assert.ok(near(s.x, p.x, 1e-6) && near(s.y, p.y, 1e-6), `finger keeps its point ${JSON.stringify(s)} ${JSON.stringify(p)}`); }
assert.ok(t1.s > t0.s, 'spreading grows it');
// fingers that do not move change nothing
{ const t = pinch(t0, a0, b0, a0, b0); for (const k of ['x', 'y', 's', 'r']) assert.ok(near(t[k], t0[k])); }

// curve: no curve is the flat art; the middle keeps true scale; edges map to edges; narrower overall
assert.equal(sourceU(0.4, 0), 0.4);
assert.equal(curvedWidth(500, 0), 500);
for (const c of [0.3, 0.7, 1]) {
  assert.ok(near(sourceU(1, c), 1) && near(sourceU(-1, c), -1) && near(sourceU(0, c), 0), 'edges stay edges');
  const W = curvedWidth(1000, c), e = 1e-4, mid = (sourceU(e, c) - sourceU(-e, c)) / (2 * e) * 1000 / W;
  assert.ok(near(mid, 1, 1e-3), `middle at true scale: ${mid}`);
  assert.ok(W < 1000, 'curved art is narrower on screen');
  const edge = (sourceU(1, c) - sourceU(1 - 1e-3, c)) / 1e-3 * 1000 / W;
  assert.ok(edge > 1.02, `edges bunch up: ${edge}`);
}
assert.ok(curveTurn(2) === curveTurn(1) && curveTurn(-1) === 0, 'curve is clamped');
console.log('PASS try-on-unit: pinch keeps the grip, cover fills, the curve keeps the middle true');
