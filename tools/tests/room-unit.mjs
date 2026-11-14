// Open skin, where it sits and time to tattoo: the maths. Clearance runs along the skin (a strip
// folded back on itself stays far apart along the skin even where it nearly touches in space),
// seeds come from ink points and off-limits skin, the summary and regions read right, where it
// sits measures along a limb and on the torso, and the hour guesses match the usual rules of thumb.
import assert from 'node:assert/strict';
import { clearance, inkSeeds, vertexAreas, roomByRegion, halfGirth, acrossAt, regionOf, roomColour, roomSummary, inchWords } from '../../src/room.js';
import { whereItSits, along, measure } from '../../src/where.js';
import { sessionHours, sessionText, planHours } from '../../src/estimate.js';

// a strip of 21 x 3 vertices, 1 apart, folded at the middle so its two ends sit 0.2 apart in space
const W = 21, pos = [], idx = [];
for (let i = 0; i < W; i++) for (let j = 0; j < 3; j++) { const fold = i > 10, x = fold ? 20 - i : i; pos.push(x, j, fold ? 0.2 : 0); }
const P = Float32Array.from(pos), id = (i, j) => i * 3 + j;
for (let i = 0; i < W - 1; i++) for (let j = 0; j < 2; j++) idx.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
const nb = Array.from({ length: W * 3 }, () => new Set());
for (let k = 0; k < idx.length; k += 3) { const [a, b, c] = idx.slice(k, k + 3); nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
const NB = nb.map((s) => [...s]);
const d = clearance(P, NB, new Map([[id(0, 1), 0]]));
assert.equal(d[id(0, 1)], 0); assert.ok(Math.abs(d[id(5, 1)] - 5) < 1e-6, 'five along');
assert.ok(d[id(20, 1)] > 19, 'the folded end is far along the skin, though it is 0.2 away in space: ' + d[id(20, 1)]);
// seeds: an ink point between vertices starts the nearest one at its gap; off-limits start at 0
const seeds = inkSeeds(P, W * 3, [Float32Array.from([3.1, 1, 0])], (v) => v === id(10, 0), 2);
assert.ok(Math.abs(seeds.get(id(3, 1)) - 0.1) < 1e-6, 'nearest vertex at its gap'); assert.equal(seeds.get(id(10, 0)), 0, 'off limits');
// the fold does not pull in the ink: the vertex right over it in space is still far along the skin
const near = clearance(P, NB, seeds);
assert.ok(near[id(17, 1)] > 3, 'the other side of the fold keeps its room: ' + near[id(17, 1)]);
// a long irregular strip reaches every vertex (single precision once dropped most of them)
{ const n = 4000, pp = [], nn = []; for (let i = 0; i < n; i++) { pp.push(i * 0.0013 + (i % 7) * 1e-5, Math.sin(i) * 1e-4, 0); nn.push([i - 1, i + 1].filter((k) => k >= 0 && k < n)); }
  const dd = clearance(Float32Array.from(pp), nn, new Map([[0, 0]])); assert.ok(dd.every(Number.isFinite), 'reaches all'); assert.ok(dd[n - 1] > 5.19, 'all the way: ' + dd[n - 1]); }
// areas: a flat 20 x 2 strip
const A = vertexAreas(P, Uint32Array.from(idx), W * 3); const tot = A.reduce((a, b) => a + b, 0);
assert.ok(Math.abs(tot - 40) < 0.1, 'area ' + tot);
// regions and the summary
assert.equal(regionOf('Upper back'), 'Back'); assert.equal(regionOf('Spine'), 'Back'); assert.equal(regionOf('Back of neck'), 'Neck');
assert.equal(regionOf('Back of arm'), 'Upper arms'); assert.equal(regionOf('Back of knee'), 'Knees'); assert.equal(regionOf('Thigh, outside'), 'Thighs');
assert.equal(regionOf('Forearm, inside'), 'Forearms'); assert.equal(regionOf('Calf'), 'Lower legs'); assert.equal(regionOf('Ribs'), 'Ribs');
const regs = roomByRegion(Float32Array.from([2, 6, 4, Infinity]), ['Calf', 'Upper back', 'Ribs', 'Ribs'], (v) => v < 3);
assert.deepEqual(regs.map((r) => r.region), ['Back', 'Ribs', 'Lower legs']); assert.equal(regs[0].across, 6);
assert.equal(roomSummary({ inkShare: 0.062, planShare: 0.021, regions: regs, toInches: (u) => u * 2 }), 'About 6% of your skin has ink, and your plans add about 2%. Most room: back (up to 12 in across), ribs (8.0 in), lower legs (4.0 in).');
assert.equal(roomSummary({ inkShare: 0, planShare: 0.003, regions: [], toInches: (u) => u }), 'No ink on you yet. Your plans cover under 1%.');
assert.equal(inchWords(3.04), '3.0 in'); assert.equal(inchWords(12.6), '13 in');
// half the way round: a ring of radius 1 round the y axis reads pi; capped widths
const ring = [], rn = 16; for (let k = 0; k < rn; k++) ring.push(Math.cos(k / rn * 2 * Math.PI), 0, Math.sin(k / rn * 2 * Math.PI));
const hg = halfGirth({ pos: Float32Array.from(ring), count: rn, nb: Array.from({ length: rn }, (_, k) => [(k + 1) % rn, (k + rn - 1) % rn]), axis: () => ({ p: [0, 5, 0], d: [0, 1, 0], ring: 'a' }) });
assert.ok(Math.abs(hg[3] - Math.PI) < 1e-5, 'pi round a unit ring: ' + hg[3]);
// an oval ring: every point gets the same, the front as much as the sides
const oval = []; for (let k = 0; k < rn; k++) oval.push(2 * Math.cos(k / rn * 2 * Math.PI), 0, Math.sin(k / rn * 2 * Math.PI));
const ho = halfGirth({ pos: Float32Array.from(oval), count: rn, nb: null, axis: () => ({ p: [0, 0, 0], d: [0, 1, 0], ring: 't', k: 0.5 }) });
assert.ok(Math.abs(ho[0] - ho[4]) < 1e-6 && ho[0] > 0.5 * Math.PI * 1.2 && ho[0] < 0.5 * Math.PI * 1.8, 'oval: ' + ho[0]);
assert.deepEqual(Array.from(acrossAt(Float32Array.from([1, 5]), Float32Array.from([10, 4]))), [2, 4]);
assert.equal(halfGirth({ pos: Float32Array.from([0, 0, 0]), count: 1, nb: [[]], axis: () => null })[0], Infinity);
const c0 = roomColour(0), c9 = roomColour(14); assert.ok(c9[2] > c9[0] && c0[0] > c9[0], 'grey to teal');
// where it sits: an arm from shoulder (0, 1.4) down to elbow (0, 1.1) and wrist (0, 0.85); 100 cm per unit
const j = { shoulder: [0.2, 1.4, 0], elbow: [0.2, 1.1, 0], wrist: [0.2, 0.85, 0], hip: [0.1, 0.9, 0], knee: [0.1, 0.5, 0], ankle: [0.1, 0.08, 0], neck: [0, 1.5, 0], navel: [0, 1.05, 0.1] };
let w = whereItSits({ p: [0.24, 1.02, 0], place: 'Forearm, outside', side: 'left', j, toCm: 100 });
assert.equal(w.line, 'Left forearm, outside: centre 3.1 in (8 cm) below the elbow.');
w = whereItSits({ p: [0.24, 0.9, 0], place: 'Forearm, inside', side: 'right', j, toCm: 100 });
assert.equal(w.line, 'Right forearm, inside: centre 2.0 in (5 cm) above the wrist bone.');
w = whereItSits({ p: [0.12, 0.38, 0.05], place: 'Shin', side: 'left', j, toCm: 100 }); assert.match(w.line, /^Left shin: centre 4\.7 in \(12 cm\) below the middle of the knee\.$/);
w = whereItSits({ p: [0.2, 1.1, 0], place: 'Elbow', side: 'left', j, toCm: 100 }); assert.equal(w.line, 'Left elbow: centred on the elbow.');
w = whereItSits({ p: [-0.08, 1.3, -0.1], place: 'Upper back', side: 'right', j, toCm: 100 }); assert.equal(w.line, 'Upper back, right side: centre 3.1 in (8 cm) right of the spine, 7.9 in (20 cm) below the base of the neck.');
w = whereItSits({ p: [0.004, 1.2, 0.1], place: 'Sternum', side: 'left', j, toCm: 100 }); assert.equal(w.line, 'Sternum: centre on the centre line, 12 in (30 cm) below the base of the neck.');
w = whereItSits({ p: [0.05, 0.97, 0.1], place: 'Stomach', side: 'left', j, toCm: 100 }); assert.equal(w.line, 'Stomach, left side: centre 2.0 in (5 cm) left of centre, 3.1 in (8 cm) below the navel.');
w = whereItSits({ p: [0.2, 0.75, 0], place: 'Hand', side: 'left', j, toCm: 100 }); assert.equal(w.line, 'Hand, left side.');
assert.equal(whereItSits({ p: [0, 0, 0], place: '', side: 'left', j, toCm: 100 }), null);
assert.ok(Math.abs(along([0, 0.5, 0], [0, 1, 0], [0, 0, 0]).t - 0.5) < 1e-9); assert.equal(measure(0.254, 10), '1.0 in (3 cm)');
// hours: a small line piece about an hour, a palm-sized shaded piece a few hours, a sleeve 40 to 60
const small = sessionHours({ widthIn: 2, heightIn: 2, fill: 0.15 }); assert.ok(small.hi <= 1.25 && small.sessions === 1, JSON.stringify(small));
assert.equal(sessionText(small), 'About an hour or less, one session.');
const palm = sessionHours({ widthIn: 3, heightIn: 4, fill: 0.5 }); assert.ok(palm.lo >= 1 && palm.hi <= 3.5, JSON.stringify(palm));
const sleeve = sessionHours({ widthIn: 11, heightIn: 25, fill: 0.8 }); assert.ok(sleeve.lo > 32 && sleeve.hi < 65 && sleeve.sessions >= 8, JSON.stringify(sleeve));
assert.ok(sessionHours({ widthIn: 6, heightIn: 6, fill: 0.5, colour: 1 }).hi > sessionHours({ widthIn: 6, heightIn: 6, fill: 0.5 }).hi, 'colour takes longer');
assert.equal(sessionText(palm), 'About 1.5 to 2.5 hours, one session.');
assert.match(sessionText(sleeve), /^About \d+ to \d+ hours, about \d+ sessions\.$/);
assert.equal(sessionText(palm, 150), 'About 1.5 to 2.5 hours, one session. About $225 to $375 at $150 an hour.');
assert.equal(sessionText(small, 120), 'About an hour or less, one session. About $120 at $120 an hour.');
assert.deepEqual(planHours([{ lo: 1, hi: 2, sessions: 1 }, { lo: 3, hi: 4, sessions: 1 }]), { lo: 4, hi: 6, sessions: 2 });
console.log('PASS room-unit: clearance along the skin, seeds, areas, regions and summary, where it sits on limbs and torso, hour guesses; ' + sessionText(palm, 150) + ' | ' + sessionText(sleeve));
