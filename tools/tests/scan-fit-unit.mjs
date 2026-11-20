// Fitting the body to a 3D scan (scan-fit.js, scan-body.js). A stand-in scan is made from the
// body itself: heavier and less muscular, arms closer in with straight elbows, feet apart,
// lying on its back with Z up (as some apps export), turned, in metres at 1.83 m tall, as a
// cloud of surface points with a little noise. The fit has to find which way is up and which way
// it faces, the stance, and move the plain standing body onto that surface within a few mm.
// node tools/tests/scan-fit-unit.mjs
import assert from 'node:assert/strict';
import { sampleSurface, transformPoints, rotateNormals, pointGrid, vertexNormals, mul3, turnY, scanHeightInches, extendOffsets, dropFloor, faceOut, ROTATIONS } from '../../src/scan-fit.js';
import { fitBodyToScan, skinForState, scanToBody, measureScanned } from '../../src/scan-body.js';
import { measureBody, unitsToInches } from '../../src/body-measure.js';
import { createRestRig } from '../../src/pose.js';
import { INDEX, COUNTS } from '../../src/mesh.js';

assert.equal(ROTATIONS.length, 24);
for (const R of ROTATIONS) { const det = R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6]) + R[2] * (R[3] * R[7] - R[4] * R[6]); assert.ok(Math.abs(det - 1) < 1e-9, 'a turn, not a mirror'); }
assert.ok(Math.abs(scanHeightInches(1.83) - 72.05) < 0.01, 'metres'); assert.ok(Math.abs(scanHeightInches(183) - 72.05) < 0.01, 'cm'); assert.equal(scanHeightInches(0.4), null);

const person = { figure: 'male', muscle: 0.3, weight: 0.78, fit: { hips: 0.4, chest: 0.2 } };
const stance = { L: { lift: -0.35, straight: 1 }, R: { lift: -0.25, straight: 1 }, legL: 0.12, legR: 0.08 };
const target = skinForState(person)(stance)(createRestRig(person).positions);
const surf = sampleSurface(target.subarray(0, COUNTS.body * 3), INDEX.filter((_, i, a) => a[i - (i % 3)] < COUNTS.body && a[i - (i % 3) + 1] < COUNTS.body && a[i - (i % 3) + 2] < COUNTS.body), 160000, 3);
// on its back (Z up), turned 35 degrees, 1.83 m tall, moved off the origin, 1.5 mm of noise
const lieDown = [1, 0, 0, 0, 0, -1, 0, 1, 0]; // y -> z
const R0 = mul3(lieDown, turnY(0.61)), s0 = 1.83 / 1.75;
const scanPts = transformPoints(surf.pts, { R: R0, s: s0, t: [0.4, -1.2, 0.05] });
let seed = 9; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.003;
for (let i = 0; i < scanPts.length; i++) scanPts[i] += rnd();
const scanNrm = rotateNormals(surf.nrm, R0);
// a floor patch the scanning app kept: 1.6 m square under the feet, as many points as a third of the body
let zlo = Infinity; for (let i = 2; i < scanPts.length; i += 3) zlo = Math.min(zlo, scanPts[i]);
const nf = 50000, floorP = new Float32Array(nf * 3), floorN = new Float32Array(nf * 3);
for (let i = 0; i < nf; i++) { floorP[i * 3] = 0.4 + (rnd() / 0.003) * 1.6; floorP[i * 3 + 1] = -1.2 + ((rnd() / 0.003)) * 1.6; floorP[i * 3 + 2] = zlo - 0.004 + rnd() * 0.3; floorN[i * 3 + 2] = 1; }
const withFloor = { pts: new Float32Array([...scanPts, ...floorP]), nrm: new Float32Array([...scanNrm, ...floorN]) };
// wound the other way round: every normal facing in, put right by faceOut
for (let i = 0; i < withFloor.nrm.length; i++) withFloor.nrm[i] = -withFloor.nrm[i];
const fl = dropFloor(withFloor.pts, withFloor.nrm);
assert.equal(faceOut(fl.pts, fl.nrm), true, 'inward normals are turned out');
assert.ok(fl.dropped >= nf * 0.97 && fl.dropped < nf + 2000, 'the floor goes and the feet stay: ' + fl.dropped);
const plainBody = dropFloor(scanPts, scanNrm); assert.ok(plainBody.dropped < 50, 'a body alone has no floor to drop: ' + plainBody.dropped);
const scan = { pts: fl.pts, nrm: fl.nrm };

const plain = { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} };
const t0 = Date.now();
const fit = fitBodyToScan(scan, plain);
const ms = Date.now() - t0;
let ylo = Infinity, yhi = -Infinity; for (let i = 1; i < COUNTS.body * 3; i += 3) { ylo = Math.min(ylo, target[i]); yhi = Math.max(yhi, target[i]); }
const tallTrue = 1.83; // the standing height, though feet apart stand a little lower
assert.ok(Math.abs(fit.align.tall - tallTrue) < 0.012, `its height in the file: ${fit.align.tall} vs ${tallTrue}`);
// the found turn undoes the one we made
const back = mul3(fit.align.R, R0); assert.ok(back[0] > 0.99 && back[4] > 0.99 && back[8] > 0.99, 'stood up and facing front: ' + back.map((x) => x.toFixed(2)));
assert.ok(fit.stance.L.lift < -0.1 && fit.stance.R.lift < -0.05, 'arms found closer in: ' + JSON.stringify(fit.stance));
assert.ok(fit.coverage > 0.85, 'most of the body found its skin: ' + fit.coverage.toFixed(3));
assert.ok(fit.quality.median < 0.0045 && fit.quality.p90 < 0.012, 'the body sits on the scan: ' + JSON.stringify(fit.quality));

// the whole bring-in: sliders moved so the plain body measures what the scan does, then fitted
// again with the turn kept; the scanned body measures like the person
const t1 = Date.now(), whole = scanToBody(scan, plain, { turn: fit.align.R });
const wholeMs = Date.now() - t1;
assert.deepEqual(whole.align.R.map((x) => x.toFixed(3)).slice(0, 3), fit.align.R.map((x) => x.toFixed(3)).slice(0, 3), 'a kept turn is used');
assert.equal(whole.off.length, createRestRig(plain).positions.length, 'offsets for every vertex');
const tr = createRestRig(person), truthM = measureBody(tr.positions, tr.joints, INDEX, COUNTS.body), plainM = measureScanned(plain, new Float32Array(whole.off.length));
const tape = (k) => unitsToInches(truthM[k], 175);
const rows = ['chest', 'waist', 'hips', 'thighSize', 'upperArmSize'].map((k) => [k, tape(k), whole.measures[k], plainM[k]]);
for (const [k, t, got, was] of rows) assert.ok(Math.abs(got - t) < Math.max(0.6, Math.abs(was - t) / 2), `${k}: the scan measures ${got.toFixed(2)} in, the person ${t.toFixed(2)}, the plain body ${was.toFixed(2)}`);
assert.ok(Object.keys(whole.fit).some((k) => ['hips', 'chest', 'waist'].includes(k)), 'sliders moved towards the scan: ' + JSON.stringify(whole.fit));
// standing, the scanned body is the person's own standing shape (within a few mm of its surface)
const rest = createRestRig(plain).positions, rest1 = createRestRig({ ...plain, fit: whole.fit }).positions, shaped = new Float32Array(rest1);
for (let i = 0; i < COUNTS.body * 3; i++) shaped[i] += whole.off[i];
const truthRest = createRestRig(person).positions, bodyTris = INDEX.filter((_, i, a) => a[i - (i % 3)] < COUNTS.body && a[i - (i % 3) + 1] < COUNTS.body && a[i - (i % 3) + 2] < COUNTS.body);
// the person's standing surface, densely (a vertex alone is a centimetre from the next)
const truth = sampleSurface(truthRest.subarray(0, COUNTS.body * 3), bodyTris, 300000, 5).pts, tg = pointGrid(truth, 0.01);
// a scan has no origin of its own, so it is centred by its middle; take out that plain shift first
for (let it = 0; it < 3; it++) { const m = [0, 0, 0]; let n = 0; for (let v = 0; v < COUNTS.body; v += 11) { const h = tg.nearest(shaped[v * 3], shaped[v * 3 + 1], shaped[v * 3 + 2], 0.1); if (!h) continue; for (let k = 0; k < 3; k++) m[k] += truth[h.i * 3 + k] - shaped[v * 3 + k]; n++; } for (let i = 0; i < COUNTS.body * 3; i++) shaped[i] += m[i % 3] / n; }
// where the plain body was over 8 mm off the person, the fitted one has to be close
const near = (P, v) => { const h = tg.nearest(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], 0.1); return h ? h.d : 0.1; };
const off8 = []; for (let v = 0; v < COUNTS.body; v += 3) if (near(rest, v) > 0.008) off8.push(v);
const was = off8.map((v) => near(rest, v)).sort((a, b) => a - b), now = off8.map((v) => near(shaped, v)).sort((a, b) => a - b);
const med = now[now.length >> 1], p90 = now[Math.floor(now.length * 0.9)];
assert.ok(off8.length > 300, 'the person differs from the plain body: ' + off8.length);
assert.ok(med < 0.01 && med < was[was.length >> 1] / 2, `standing, where the plain body was off by ${(was[was.length >> 1] * 1000).toFixed(1)} mm it is now ${(med * 1000).toFixed(1)} mm (90%: ${(p90 * 1000).toFixed(1)})`);
// the eyes and the rest follow the nearest skin
assert.ok(whole.off.slice(COUNTS.body * 3).some((x) => x !== 0), 'eyes move with the face');
// no triangle turned inside out
const N0 = vertexNormals(rest, INDEX, COUNTS.body), N1 = vertexNormals(shaped, INDEX, COUNTS.body); let flips = 0;
for (let v = 0; v < COUNTS.body; v++) if (N0[v * 3] * N1[v * 3] + N0[v * 3 + 1] * N1[v * 3 + 1] + N0[v * 3 + 2] * N1[v * 3 + 2] < 0) flips++;
assert.ok(flips / COUNTS.body < 0.005, 'the skin keeps facing out: ' + flips);
console.log(`PASS scan-fit-unit: floor dropped, up and facing found, stance ${JSON.stringify(fit.stance)}, median ${(fit.quality.median * 1000).toFixed(1)}, standing ${(med * 1000).toFixed(1)} mm where it was ${(was[was.length >> 1] * 1000).toFixed(1)} mm off, ${ms} ms; whole ${wholeMs} ms, ${rows.map(([k, t, g]) => `${k} ${g.toFixed(1)}/${t.toFixed(1)}`).join(', ')}`);
