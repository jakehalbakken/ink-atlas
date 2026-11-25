// Your tattoos on a photo of you (On my photo): the 3D body is posed the way you stand in the
// photo and seen from where the camera was, so every tattoo can be drawn onto the photo where
// it sits on your skin. Pure maths: no DOM, no three.js.
//
// MediaPipe's pose landmarker gives two things for one person: 33 points in the picture (x, y
// as shares of its width and height) and the same 33 points in metres around the middle of the
// hips, lined up with the camera (x right, y down, z away from the camera). The metres give the
// pose: which way each arm and leg points, even towards or away from the camera. The picture
// points then pin the body down: the camera is placed so the posed joints land on them, and the
// limbs are turned a little more until each joint sits on its point.
//
// Rotations are the rig's own: a quaternion [x, y, z, w] per bone, local to its parent, turning
// about the bone's rest head (see poseTransforms in pose.js). The body is never turned as a
// whole: the camera moves round it instead, so the floor, the lights and the ink stay as they are.

import { POSE_BONES, poseTransforms } from './pose.js';

const IDX = Object.fromEntries(POSE_BONES.map((b, i) => [b.name, i]));
// ---- small vector and quaternion helpers ----
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
export const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
export function qrot(q, p) { const [x, y, z] = p, [a, b, c, w] = q, tx = 2 * (b * z - c * y), ty = 2 * (c * x - a * z), tz = 2 * (a * y - b * x); return [x + w * tx + b * tz - c * ty, y + w * ty + c * tx - a * tz, z + w * tz + a * ty - b * tx]; }
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((x) => x / l); };
function qaxis(axis, ang) { const a = unit(axis), s = Math.sin(ang / 2); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)]; }
// the shortest turn taking direction a onto direction b
export function qbetween(a, b) {
  const u = unit(a), v = unit(b), d = dot(u, v);
  if (d > 1 - 1e-9) return [0, 0, 0, 1];
  if (d < -1 + 1e-9) { const o = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; return qaxis(cross(u, o), Math.PI); }
  const c = cross(u, v); return qnorm([c[0], c[1], c[2], 1 + d]);
}
// a share of a rotation (0 none, 1 all of it)
function qpow(q, k) {
  const w = Math.max(-1, Math.min(1, q[3])), ang = 2 * Math.acos(w), s = Math.sqrt(Math.max(0, 1 - w * w));
  if (s < 1e-9) return [0, 0, 0, 1];
  return qaxis([q[0] / s, q[1] / s, q[2] / s], ang * k);
}
const qangle = (q) => 2 * Math.acos(Math.min(1, Math.abs(q[3])));
// rotation matrices as rows [[..],[..],[..]]
const mrot = (m, p) => [dot(m[0], p), dot(m[1], p), dot(m[2], p)];
const mT = (m) => [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]];
const mmul = (a, b) => { const bt = mT(b); return a.map((r) => bt.map((c) => dot(r, c))); };
// a frame whose columns are x, y, z
const frameCols = (x, y, z) => [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
// x along a, y as near b as stays square to it
function frameFrom(a, b) { const x = unit(a), z = unit(cross(x, b)), y = cross(z, x); return frameCols(x, y, z); }
function expMap(w) { const a = len(w); if (a < 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; const k = mul(w, 1 / a), c = Math.cos(a), s = Math.sin(a), t = 1 - c; const [x, y, z] = k; return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]]; }
export function quatFromMatrix(m) {
  const tr = m[0][0] + m[1][1] + m[2][2]; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, s / 4]; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = [s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s]; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = [(m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s]; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = [(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4, (m[1][0] - m[0][1]) / s]; }
  return qnorm(q);
}

// ---- the points ----
// MediaPipe pose landmark numbers, and where each sits on the rig (a bone's head, or its tail)
export const LANDMARK = { nose: 0, earL: 7, earR: 8, shoulderL: 11, shoulderR: 12, elbowL: 13, elbowR: 14, wristL: 15, wristR: 16, pinkyL: 17, pinkyR: 18, indexL: 19, indexR: 20, hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankleL: 27, ankleR: 28, toeL: 31, toeR: 32 };
const ON_RIG = {
  11: ['upperarm01.L', 'head'], 12: ['upperarm01.R', 'head'], 13: ['lowerarm01.L', 'head'], 14: ['lowerarm01.R', 'head'],
  15: ['wrist.L', 'head'], 16: ['wrist.R', 'head'], 17: ['finger5-1.L', 'head'], 18: ['finger5-1.R', 'head'], 19: ['finger2-1.L', 'head'], 20: ['finger2-1.R', 'head'],
  23: ['upperleg01.L', 'head'], 24: ['upperleg01.R', 'head'], 25: ['lowerleg01.L', 'head'], 26: ['lowerleg01.R', 'head'],
  27: ['foot.L', 'head'], 28: ['foot.R', 'head'], 31: ['toe2-1.L', 'head'], 32: ['toe2-1.R', 'head'],
};
// which bone carries each point once posed (the head's three points ride on the head bone)
const CARRIER = { 11: 'upperarm01.L', 12: 'upperarm01.R', 13: 'lowerarm01.L', 14: 'lowerarm01.R', 15: 'wrist.L', 16: 'wrist.R', 17: 'wrist.L', 18: 'wrist.R', 19: 'wrist.L', 20: 'wrist.R', 23: 'upperleg01.L', 24: 'upperleg01.R', 25: 'lowerleg01.L', 26: 'lowerleg01.R', 27: 'foot.L', 28: 'foot.R', 31: 'foot.L', 32: 'foot.R', 0: 'head', 7: 'head', 8: 'head' };
// the picture points the camera is fitted to, with how much each counts
// short end pieces and the joint each hangs from
const SHORT = { 17: 15, 19: 15, 18: 16, 20: 16, 31: 27, 32: 28, 0: -1, 7: -1, 8: -1 }; // the head's points only give its turn, so they stay as read
const FIT = { 11: 1.4, 12: 1.4, 23: 1.4, 24: 1.4, 13: 1, 14: 1, 15: 0.9, 16: 0.9, 25: 1, 26: 1, 27: 0.9, 28: 0.9, 0: 0.6, 7: 0.5, 8: 0.5 };
// left and right swap over when the photo is a mirror image or the person is read back to front
const SWAP = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];
export function swapSides(lm) { const out = lm.slice(); for (const [a, b] of SWAP) { out[a] = lm[b]; out[b] = lm[a]; } return out; }
// A mirror image of the photo's points (the photo flipped left to right): x mirrors and the sides swap.
export function mirrorPoints(lm2, lmW) {
  return { lm2: swapSides(lm2.map((p) => p && { ...p, x: 1 - p.x })), lmW: swapSides(lmW.map((p) => p && { ...p, x: -p.x })) };
}
// Read the other way round (a back taken for a front, or the other way): the sides swap and
// depth turns over, so an arm in front of the chest becomes an arm in front of the chest seen
// from behind.
export function turnPoints(lm2, lmW) { return { lm2: swapSides(lm2), lmW: swapSides(lmW.map((p) => p && { ...p, z: -p.z })) }; }

const seen = (p, v = 0.5) => !!p && (p.visibility ?? 1) >= v && p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.02;

// Rest positions of every point used, from the rest rig (and the head's three points, given).
export function restPoints(rest, head) {
  const J = rest.joints, out = {};
  for (const [i, [name, end]] of Object.entries(ON_RIG)) { const k = POSE_BONES[IDX[name]][end] * 3; out[i] = [J[k], J[k + 1], J[k + 2]]; }
  if (head) { out[0] = head.nose; out[7] = head.earL; out[8] = head.earR; }
  Object.defineProperty(out, 'rest', { value: rest, enumerable: false });
  return out;
}
// Where each point is with these rotations.
export function posedPoints(rest, restP, rotations) {
  const T = poseTransforms(rest, rotations), out = {};
  for (const [i, p] of Object.entries(restP)) { const t = T[IDX[CARRIER[i]]], r = qrot(t.q, p); out[i] = add(r, t.t); }
  return out;
}

// ---- the pose ----
// World rotations down the chain, from the local ones set so far.
function worldQ(rot, name) {
  const chain = []; for (let i = IDX[name]; i >= 0; i = POSE_BONES[i].parent) chain.unshift(POSE_BONES[i].name);
  let q = [0, 0, 0, 1]; for (const n of chain) if (rot[n]) q = qmul(q, rot[n]); return q;
}
const parentQ = (rot, name) => { const p = POSE_BONES[IDX[name]].parent; return p >= 0 ? worldQ(rot, POSE_BONES[p].name) : [0, 0, 0, 1]; };
// Turn a bone so its rest direction points along target (a world direction in the body's own
// frame). With twistRest/twistTarget it is also turned about that direction until twistRest
// lines up with twistTarget, by the share `twist` (0..1).
function aim(rot, name, restDir, target, twistRest, twistTarget, twist = 1) {
  if (!(len(target) > 1e-9)) return;
  const Qp = parentQ(rot, name), cur = qrot(Qp, restDir);
  let A = qbetween(cur, target);
  if (twistRest && twistTarget && twist > 0) {
    const ax = unit(target), b = qrot(A, qrot(Qp, twistRest)), bp = sub(b, mul(ax, dot(b, ax))), tp = sub(twistTarget, mul(ax, dot(twistTarget, ax)));
    if (len(bp) > 1e-6 && len(tp) > 1e-6) {
      const u = unit(bp), v = unit(tp), ang = Math.atan2(dot(cross(u, v), ax), dot(u, v));
      A = qmul(qaxis(ax, ang * twist), A);
    }
  }
  rot[name] = qnorm(qmul(qinv(Qp), qmul(A, Qp)));
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const angleOf = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b)))));

// The body's own frame from hips and shoulders: x to the body's left, y up the torso, z forward.
function bodyFrame(hipL, hipR, shL, shR) { return frameFrom(sub(hipL, hipR), sub(mid(shL, shR), mid(hipL, hipR))); }

// The rotations that make the rest body take up the pose of target points P (in the body's own
// frame, the same frame as the rest points R). Points that aren't in P are left alone.
export function poseFrom(R, P, { hands = true, feet = true, head = true } = {}) {
  const rot = {};
  // the shoulders' turn against the hips, shared out up the spine
  if (P[11] && P[12]) {
    const A = qbetween(sub(R[11], R[12]), sub(P[11], P[12]));
    if (qangle(A) > 1e-4) { const part = qpow(A, 1 / 3); for (const n of ['spine03', 'spine02', 'spine01']) rot[n] = part; }
  }
  for (const s of ['L', 'R']) {
    const [sh, el, wr, pk, ix, hp, kn, an, to] = s === 'L' ? [11, 13, 15, 17, 19, 23, 25, 27, 31] : [12, 14, 16, 18, 20, 24, 26, 28, 32];
    // the shoulder: raised, dropped, pulled forward or back by the collarbone, at most 35 degrees
    if (P[sh] && R.rest) {
      const b = IDX['clavicle.' + s], tp = poseTransforms(R.rest, rot)[POSE_BONES[b].parent];
      const k = POSE_BONES[b].head * 3, head = [R.rest.joints[k], R.rest.joints[k + 1], R.rest.joints[k + 2]];
      const Qp = tp.q, at = add(qrot(Qp, head), tp.t), cur = qrot(Qp, sub(R[sh], head)), to = sub(P[sh], at);
      let A = qbetween(cur, to); const ang = qangle(A); if (ang > 0.61) A = qpow(A, 0.61 / ang);
      rot['clavicle.' + s] = qnorm(qmul(qinv(Qp), qmul(A, Qp)));
    }
    // arm: the upper arm turns so the elbow folds the way it does in the photo
    if (P[sh] && P[el]) {
      const ur = sub(R[el], R[sh]), ut = sub(P[el], P[sh]);
      let tw = 0, nr = null, nt = null;
      if (P[wr]) { const fr = sub(R[wr], R[el]), ft = sub(P[wr], P[el]); nr = cross(ur, fr); nt = cross(ut, ft); tw = smooth(0.25, 0.5, angleOf(ut, ft)); }
      aim(rot, 'upperarm01.' + s, ur, ut, nr, nt, tw);
      if (P[wr]) aim(rot, 'lowerarm01.' + s, sub(R[wr], R[el]), sub(P[wr], P[el]));
      // the hand: the forearm twists so the knuckles run the way they do in the photo
      if (hands && P[wr] && P[ix] && P[pk]) {
        const fr = sub(R[wr], R[el]), ft = sub(P[wr], P[el]);
        aim(rot, 'lowerarm02.' + s, fr, ft, sub(R[ix], R[pk]), sub(P[ix], P[pk]), 1);
        aim(rot, 'wrist.' + s, sub(mid(R[ix], R[pk]), R[wr]), sub(mid(P[ix], P[pk]), P[wr]));
      }
    }
    // leg: the thigh turns so the knee folds the way it does, or, nearly straight, so the foot points the way it does
    if (P[hp] && P[kn]) {
      const ur = sub(R[kn], R[hp]), ut = sub(P[kn], P[hp]);
      let tw = 0, nr = null, nt = null;
      if (P[an]) {
        const fr = sub(R[an], R[kn]), ft = sub(P[an], P[kn]), bend = smooth(0.25, 0.5, angleOf(ut, ft));
        if (bend > 0.5) { nr = cross(ur, fr); nt = cross(ut, ft); tw = bend; }
        else if (feet && P[to]) { nr = sub(R[to], R[an]); nt = sub(P[to], P[an]); tw = 1 - bend; }
      }
      aim(rot, 'upperleg01.' + s, ur, ut, nr, nt, tw);
      if (P[an]) aim(rot, 'lowerleg01.' + s, sub(R[an], R[kn]), sub(P[an], P[kn]));
      if (feet && P[an] && P[to]) aim(rot, 'foot.' + s, sub(R[to], R[an]), sub(P[to], P[an]));
    }
  }
  // the head: turned from the ears and the nose, shared over the neck, at most 70 degrees
  if (head && P[0] && P[7] && P[8] && R[0] && R[7] && R[8]) {
    const fr = (n, l, r) => { const x = sub(l, r), em = mid(l, r), f = sub(n, em); return frameCols(unit(x), unit(cross(f, x)), unit(cross(x, cross(f, x)))); };
    const Fr = fr(R[0], R[7], R[8]), Ft = fr(P[0], P[7], P[8]);
    const H = quatFromMatrix(mmul(Ft, mT(Fr))), Qp = worldQ(rot, 'neck01') ;
    let r = qmul(qinv(parentQ(rot, 'neck01')), H);
    const ang = qangle(r); if (ang > 1.22) r = qpow(r, 1.22 / ang);
    const part = qpow(r, 1 / 3); for (const n of ['neck01', 'neck02', 'head']) rot[n] = part;
    void Qp;
  }
  return rot;
}

// ---- the camera ----
// Camera coordinates as three.js has them: x right, y up, looking down -z. MediaPipe's metres are
// x right, y down, z away from the camera.
const fromMP = (p) => [p.x, -p.y, -p.z];
function project(c, cam) { const d = -c[2]; return [cam.cx + cam.f * c[0] / d, cam.cy - cam.f * c[1] / d]; }

// The camera's translation for a known turn G, straight from the picture points (least squares,
// linear: f (X + tx) = (u - cx)(-(Z + tz)), the same for y).
function solveT(G, pts, cam) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (const { P, u, w } of pts) {
    const c = mrot(G, P), du = u[0] - cam.cx, dv = cam.cy - u[1];
    // rows: [f, 0, du] t = -du Z - f X ; [0, f, dv] t = -dv Z - f Y
    for (const [row, rhs] of [[[cam.f, 0, du], -du * c[2] - cam.f * c[0]], [[0, cam.f, dv], -dv * c[2] - cam.f * c[1]]]) {
      for (let i = 0; i < 3; i++) { b[i] += w * row[i] * rhs; for (let j = 0; j < 3; j++) A[i][j] += w * row[i] * row[j]; }
    }
  }
  return solve3(A, b);
}
function solve3(A, b) {
  const m = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k;
    [m[i], m[p]] = [m[p], m[i]]; if (Math.abs(m[i][i]) < 1e-12) return null;
    for (let k = 0; k < 3; k++) if (k !== i) { const f = m[k][i] / m[i][i]; for (let j = i; j < 4; j++) m[k][j] -= f * m[i][j]; }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}
function solveN(A, b) { // small dense system, Gaussian elimination with pivoting
  const n = b.length, m = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k;
    [m[i], m[p]] = [m[p], m[i]]; if (Math.abs(m[i][i]) < 1e-12) return null;
    for (let k = 0; k < n; k++) if (k !== i) { const f = m[k][i] / m[i][i]; for (let j = i; j <= n; j++) m[k][j] -= f * m[i][j]; }
  }
  return m.map((r, i) => r[n] / r[i]);
}
function logMap(m) {
  const c = Math.max(-1, Math.min(1, (m[0][0] + m[1][1] + m[2][2] - 1) / 2)), a = Math.acos(c);
  if (a < 1e-9) return [0, 0, 0];
  const k = a / (2 * Math.sin(a)); return [(m[2][1] - m[1][2]) * k, (m[0][2] - m[2][0]) * k, (m[1][0] - m[0][1]) * k];
}
function residuals(G, T, pts, cam, prior) {
  const out = [];
  // the photo's own metres say which way the body faces: turning away from that costs as much
  // as a point 25 pixels off for every 10 degrees
  if (prior) for (const v of logMap(mmul(G, mT(prior.G)))) out.push(v * prior.k);
  for (const { P, u, w } of pts) { const c = add(mrot(G, P), T); if (c[2] > -1e-3) { out.push(1e3, 1e3); continue; } const q = project(c, cam), sw = Math.sqrt(w); out.push(sw * (q[0] - u[0]), sw * (q[1] - u[1])); }
  return out;
}
// Fit the camera's turn and place (6 numbers) so the points land on the picture: Gauss-Newton
// with a numeric Jacobian, from a starting turn G0. Huber weights keep one bad point from
// pulling the rest off.
export function fitCamera(G0, pts, cam, { rounds = 20, prior = null } = {}) {
  let G = G0, T = solveT(G, pts, cam) || [0, 0, -4];
  if (T[2] > -0.3) T[2] = -3;
  const huber = Math.max(4, cam.h * 0.012);
  let w = pts.map(() => 1);
  for (let it = 0; it < rounds; it++) {
    const P = pts.map((p, i) => ({ ...p, w: p.w * w[i] }));
    const r0 = residuals(G, T, P, cam, prior), J = [], eps = [1e-4, 1e-4, 1e-4, 1e-4, 1e-4, 1e-4];
    for (let k = 0; k < 6; k++) {
      const d = [0, 0, 0, 0, 0, 0]; d[k] = eps[k];
      const G1 = mmul(expMap(d.slice(0, 3)), G), T1 = add(T, d.slice(3));
      const r1 = residuals(G1, T1, P, cam, prior); J.push(r1.map((v, i) => (v - r0[i]) / eps[k]));
    }
    const A = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => J[i].reduce((s, v, n) => s + v * J[j][n], 0) + (i === j ? 1e-3 + (i < 3 ? 50 : 0.5) * 1e-3 : 0)));
    const g = J.map((row) => -row.reduce((s, v, n) => s + v * r0[n], 0));
    const step = solveN(A, g); if (!step) break;
    // keep each step modest: at most 0.15 radians of turn
    const ang = len(step.slice(0, 3)), k = ang > 0.15 ? 0.15 / ang : 1;
    const G1 = mmul(expMap(mul(step.slice(0, 3), k)), G), T1 = add(T, mul(step.slice(3), k));
    const e0 = r0.reduce((s, v) => s + v * v, 0), e1 = residuals(G1, T1, P, cam, prior).reduce((s, v) => s + v * v, 0);
    if (e1 < e0) { G = G1; T = T1; } else break;
    // re-weight
    w = pts.map((p) => { const c = add(mrot(G, p.P), T); if (c[2] > -1e-3) return 0.1; const q = project(c, cam), e = Math.hypot(q[0] - p.u[0], q[1] - p.u[1]); return e <= huber ? 1 : huber / e; });
  }
  return { G, T };
}

// The camera's focal length in pixels: from the photo's own 35 mm equivalent focal length when it
// gives one, or a phone's main camera (26 mm).
export function focalPixels(w, h, focal35 = 26) {
  const f35 = Number.isFinite(focal35) && focal35 > 8 && focal35 < 300 ? focal35 : 26;
  return f35 / 43.27 * Math.hypot(w, h);
}

// The whole fit. lm2: the 33 picture points (x, y in 0..1, visibility); lmW: the 33 points in
// metres; w, h: the photo's size in pixels; rest: the rest rig ({ joints }); head: rest positions
// of the nose and the ears ({ nose, earL, earR }) or null; focal35: the photo's 35 mm equivalent
// focal length if known.
// Returns { rotations, camera: { position, quaternion, fov, aspect, near, far }, error (pixels,
// how far the posed joints land from the photo's points on average), used (points fitted), view }.
export function fitPhoto({ lm2, lmW, w, h, rest, head = null, focal35 = null, rounds = 4 }) {
  if (!lm2 || !lmW || lm2.length < 33 || lmW.length < 33) throw new Error('Not enough points.');
  const cam = { f: focalPixels(w, h, focal35), cx: w / 2, cy: h / 2, w, h };
  const R = restPoints(rest, head);
  const hasTorso = [11, 12, 23, 24].every((i) => lmW[i]) && (seen(lm2[11], 0.3) || seen(lm2[12], 0.3)) && (seen(lm2[23], 0.2) || seen(lm2[24], 0.2) || seen(lm2[11], 0.5));
  if (!hasTorso) throw new Error('I could not find your shoulders and hips in this photo.');
  // the points in metres, in camera axes
  const C = {}; for (const i of Object.keys(R)) if (lmW[i]) C[i] = fromMP(lmW[i]);
  // the body's turn from the photo: its frame in the camera against its frame at rest
  const Fr = bodyFrame(R[23], R[24], R[11], R[12]), Fc = bodyFrame(C[23], C[24], C[11], C[12]);
  let G = mmul(Fc, mT(Fr));
  const Gm = G;
  // the targets in the body's own frame: the photo's metres turned back by G, scaled to the rest
  // body's size, with the middle of the hips on the rest body's
  const toBody = (c) => mrot(mT(G), c);
  const hipMidR = mid(R[23], R[24]), hipMidC = mid(C[23], C[24]);
  const sizeR = len(sub(mid(R[11], R[12]), hipMidR)), sizeC = len(sub(mid(C[11], C[12]), hipMidC)) || 1, k = sizeR / sizeC;
  let P = {}; for (const [i, c] of Object.entries(C)) P[i] = add(hipMidR, mul(toBody(sub(c, hipMidC)), k));
  const P0 = P;
  // which picture points pin the camera
  const fitIds = Object.keys(FIT).map(Number).filter((i) => R[i] && seen(lm2[i], 0.5));
  if (fitIds.length < 4) throw new Error('Too little of you shows in this photo.');
  const px = (i) => [lm2[i].x * w, lm2[i].y * h];
  let rotations = {}, T = null;
  for (let it = 0; it < rounds; it++) {
    rotations = poseFrom(R, P);
    const Q = posedPoints(rest, R, rotations);
    const pts = fitIds.map((i) => ({ P: Q[i], u: px(i), w: FIT[i] * Math.min(1, (lm2[i].visibility ?? 1) + 0.2) }));
    ({ G, T } = fitCamera(G, pts, cam, { prior: { G: Gm, k: 25 / 0.1745 * Math.sqrt(pts.length) / 4 } }));
    if (it === rounds - 1) break;
    // move each target to the picture point's ray, at the depth it has now (the photo's x and y
    // are surer than its depth), then pose again from those
    const next = { ...P };
    for (const i of Object.keys(Q)) {
      const id = +i; if (SHORT[id] != null || !seen(lm2[id], 0.5) || !P[id]) continue;
      const c = add(mrot(G, Q[id]), T), d = -c[2]; if (!(d > 1e-3)) continue;
      const u = px(id), ray = [(u[0] - cam.cx) / cam.f * d, -(u[1] - cam.cy) / cam.f * d, -d];
      next[id] = mrot(mT(G), sub(ray, T));
    }
    // the hips stay where the rest body has them (the body is never moved): only their
    // direction from each other counts, and the knees and the rest follow from it
    // hands, feet and the head are too short to place from the picture: they keep the
    // photo's own metres, carried along with the joint they hang from
    for (const [id, from] of Object.entries(SHORT)) if (P0[id] && P0[from] && next[from]) next[id] = add(next[from], sub(P0[id], P0[from]));
    P = next;
  }
  const Q = posedPoints(rest, R, rotations);
  let e = 0, n = 0;
  for (const i of fitIds) { const c = add(mrot(G, Q[i]), T); if (c[2] > -1e-3) continue; const q = project(c, cam), u = px(i); e += Math.hypot(q[0] - u[0], q[1] - u[1]); n++; }
  // the camera in the body's frame: at -G^T T, turned by G^T
  const Gt = mT(G), position = mul(mrot(Gt, T), -1), quaternion = quatFromMatrix(Gt);
  const fov = 2 * Math.atan(h / 2 / cam.f) * 180 / Math.PI;
  // facing: the body's forward (+z) seen from the camera
  const fwd = mrot(G, [0, 0, 1]);
  return { rotations, camera: { position, quaternion, fov, aspect: w / h, f: cam.f }, error: n ? e / n : Infinity, used: fitIds.length, view: fwd[2] > 0 ? 'front' : 'back' };
}

// Where a body point (in the body's own frame) lands in the photo, in pixels, for a fit's camera.
export function toPhoto(camera, p, w, h) {
  const Gt = (() => { const q = camera.quaternion, [x, y, z, s] = q; return [[1 - 2 * (y * y + z * z), 2 * (x * y - s * z), 2 * (x * z + s * y)], [2 * (x * y + s * z), 1 - 2 * (x * x + z * z), 2 * (y * z - s * x)], [2 * (x * z - s * y), 2 * (y * z + s * x), 1 - 2 * (x * x + y * y)]]; })();
  const c = mrot(mT(Gt), sub(p, camera.position)), d = -c[2];
  if (!(d > 1e-6)) return null;
  return [w / 2 + camera.f * c[0] / d, h / 2 - camera.f * c[1] / d];
}

// The 35 mm equivalent focal length in a JPEG's EXIF (tag 0xA405), or null.
export function exifFocal35(buf) {
  try {
    const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer);
    if (v.getUint16(0) !== 0xffd8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const mark = v.getUint16(o), size = v.getUint16(o + 2);
      if (mark === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949, u16 = (p) => v.getUint16(t + p, le), u32 = (p) => v.getUint32(t + p, le);
        const ifd = (start, want) => { const n = u16(start); for (let i = 0; i < n; i++) { const e = start + 2 + i * 12; if (u16(e) === want) return e; } return -1; };
        const e0 = ifd(u32(4), 0x8769); if (e0 < 0) return null;
        const ex = u32(e0 + 8), e1 = ifd(ex, 0xa405); if (e1 < 0) return null;
        const f = u16(e1 + 8); return f > 0 ? f : null;
      }
      if ((mark & 0xff00) !== 0xff00) return null;
      o += 2 + size;
    }
  } catch { /* not a JPEG with EXIF */ }
  return null;
}
