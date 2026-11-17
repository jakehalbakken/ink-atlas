// Moving a wrap like a ring on a rod: a point's place along and round a limb's line round-trips,
// angles agree across a bent joint, a drag that goes right round comes back to the start, the art's
// up direction turns with the band, the share round is right for a band and a small piece, and
// Wrap it round lays the long side round the limb with the top towards the body.
import assert from 'node:assert/strict';
import { limbAxis, limbPlace, limbPoint, LimbDrag, spin, shareRound, rotFor, rotRound, wrapAngle } from '../../src/wrap-drag.js';
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// a leg: hip, knee bent a little forward, ankle
const ax = limbAxis([[0.1, 0.9, 0], [0.1, 0.5, 0.03], [0.1, 0.1, 0]], 0.1);
near(ax.total, Math.hypot(0.4, 0.03) * 2 + 0.2, 1e-12, 'length with run-on at both ends');
for (const s of [0.15, 0.3, 0.4, 0.8, 0.85]) for (const a of [-3, -1.5, 0, 1, 2.5]) {
  const p = limbPoint(ax, s, a, 0.05), q = limbPlace(ax, p.point);
  near(q.s, s, 1e-9, `s round-trips at ${s},${a}`); near(wrapAngle(q.angle - a), 0, 1e-9, `angle round-trips at ${s},${a}`); near(q.r, 0.05, 1e-9, 'r');
  near(dot(p.out, p.dir), 0, 1e-12, 'out is square to the line');
}
// angles agree across the knee: the same angle just above and below points nearly the same way
const up = limbPoint(ax, 0.5 + 0.1 - 1e-3, 0.7, 0.05).out, dn = limbPoint(ax, 0.5 + 0.1 + 1e-3, 0.7, 0.05).out;
assert.ok(dot(up, dn) > 0.99, 'outside direction carried over the knee');
// limbPoint keeps the band on the line
near(limbPoint(ax, -1, 0, 0.05).s, ax.ext / 2, 1e-12, 'clamped at the top'); near(limbPoint(ax, 9, 0, 0.05).s, ax.total - ax.ext / 2, 1e-12, 'clamped at the bottom');

// a drag: the finger moves round and down; the band moves the same
const start = limbPlace(ax, limbPoint(ax, 0.75, 0.2, 0.05).point), up0 = [0, 1, 0];
const d = new LimbDrag(ax, start, limbPlace(ax, limbPoint(ax, 0.7, 1.0, 0.05).point), up0);
let spot = d.step(limbPlace(ax, limbPoint(ax, 0.72, 1.5, 0.05).point));
let at = limbPlace(ax, spot.point); near(at.s, 0.77, 1e-9, 'slid along by the finger'); near(wrapAngle(at.angle - 0.7), 0, 1e-9, 'turned round by the finger');
// right round in small steps comes back to the start, through the back
for (let k = 1; k <= 24; k++) spot = d.step(limbPlace(ax, limbPoint(ax, 0.72, 1.5 + k * Math.PI / 12, 0.05).point));
at = limbPlace(ax, spot.point); near(wrapAngle(at.angle - 0.7), 0, 1e-9, 'right round lands on the same angle'); near(d.dA, 0.5 + 2 * Math.PI, 1e-9, 'counted the whole way round');
// the finger off the limb: nothing; back on: carries on from there, no jump
assert.equal(d.step(null), null, 'off the limb does nothing');
const before = d.spot().point; spot = d.step(limbPlace(ax, limbPoint(ax, 0.6, -2, 0.05).point));
near(Math.hypot(...spot.point.map((v, i) => v - before[i])), 0, 1e-12, 'no jump when the finger comes back');
// up turns with the band
const u = spin([1, 0, 0], [0, 1, 0], Math.PI / 2); near(u[2], -1, 1e-12, 'spin x about y by a quarter'); near(Math.hypot(...u), 1, 1e-12, 'spin keeps length');

// share round: a band 2 pi r wide reaches all the way, a small square a small share
const at0 = { r: 0.05, dir: [0, -1, 0] }, n = [0, 0, 1];
near(shareRound([1, 0, 0], [0, 1, 0], n, 2 * Math.PI * 0.05, 0.04, at0).share, 1, 1e-12, 'band all the way round');
near(shareRound([0, 1, 0], [-1, 0, 0], n, 0.3, 0.04, at0).share, 0.04 / (2 * Math.PI * 0.05), 1e-12, 'turned a quarter: its height goes round');
assert.ok(shareRound([1, 0, 0], [0, 1, 0], n, 0.03, 0.03, at0).share < 0.15, 'small piece');

// Wrap it round: long side round the limb (square to dir), top towards the body (against dir)
const x = [1, 0, 0], y = [0, 1, 0], dir = [0, -1, 0];
for (const base of [0, 0.4, 2.2, -2.9]) {
  const xb = [Math.cos(base), Math.sin(base), 0], yb = [-Math.sin(base), Math.cos(base), 0];
  for (const aspect of [4, 0.25]) {
    const r = rotRound(xb, yb, dir, aspect);
    const right = [0, 1, 2].map((i) => Math.cos(r) * xb[i] + Math.sin(r) * yb[i]), upv = [0, 1, 2].map((i) => -Math.sin(r) * xb[i] + Math.cos(r) * yb[i]);
    if (aspect >= 1) { near(dot(right, dir), 0, 1e-12, `wide: right goes round (${base})`); near(dot(upv, dir), -1, 1e-12, `wide: top towards the body (${base})`); }
    else { near(dot(upv, dir), 0, 1e-12, `tall: up goes round (${base})`); near(dot(right, dir), -1, 1e-12, `tall: right towards the body (${base})`); }
  }
}
// rotFor gives back the turn that makes up point where asked
for (const r of [-2, 0, 0.7, 3]) { const upv = [-Math.sin(r), Math.cos(r), 0]; near(wrapAngle(rotFor(x, y, upv) - r), 0, 1e-12, `rotFor ${r}`); }
console.log('wrap-drag-unit ok');
