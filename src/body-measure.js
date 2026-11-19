// Real measurements of the body, the way a tape measure takes them: lengths joint to joint, and
// round a limb or the torso as the snug loop a tape makes (the convex hull of where a plane cuts
// the skin, so it bridges hollows the way a tape does). Pure maths on rest positions (1.75 units
// tall) and the rest skeleton's joints; nothing here touches the scene or the saved project.
//
// Each measurement names the body slider that drives it, so the Body panel can show it beside that
// slider and, given an exact number, search the slider for it (solveSlider).
import { POSE_BONES, boneWeightSum } from './pose.js';
import { MARKS } from './mesh.js';

const boneAt = Object.fromEntries(POSE_BONES.map((b) => [b.name, b]));
const jp = (joints, bone, end = 'head') => { const k = boneAt[bone][end] * 3; return [joints[k], joints[k + 1], joints[k + 2]]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// What each body slider measures. kind: 'length' (straight, joint to joint, or up the body) or
// 'round' (a tape round it). how: a few words on where to put the tape.
export const MEASURES = [
  { key: 'neckSize', label: 'Neck', kind: 'round', how: 'round the middle of the neck' },
  { key: 'neckLen', label: 'Neck length', kind: 'length', how: 'base of the neck to the base of the skull' },
  { key: 'shoulders', label: 'Shoulders', kind: 'length', how: 'straight across, outside edge to outside edge' },
  { key: 'chest', label: 'Chest', kind: 'round', how: 'round the fullest part, under the arms' },
  { key: 'waist', label: 'Waist', kind: 'round', how: 'round the narrowest part, above the navel' },
  { key: 'hips', label: 'Hips', kind: 'round', how: 'round the widest part of the hips and seat' },
  { key: 'torsoLen', label: 'Torso length', kind: 'length', how: 'base of the neck down to the navel' },
  { key: 'upperArmLen', label: 'Upper arm length', kind: 'length', how: 'shoulder joint to the elbow' },
  { key: 'foreArmLen', label: 'Forearm length', kind: 'length', how: 'elbow to the wrist' },
  { key: 'upperArmSize', label: 'Upper arm', kind: 'round', how: 'round the biggest part of the biceps, relaxed' },
  { key: 'foreArmSize', label: 'Forearm', kind: 'round', how: 'round the biggest part, just below the elbow' },
  { key: 'wristSize', label: 'Wrist', kind: 'round', how: 'round the wrist, just above the bone' },
  { key: 'hand', label: 'Hand length', kind: 'length', how: 'wrist crease to the tip of the middle finger' },
  { key: 'thighLen', label: 'Thigh length', kind: 'length', how: 'crotch down to the middle of the knee' },
  { key: 'shinLen', label: 'Shin length', kind: 'length', how: 'middle of the knee down to the ankle bone' },
  { key: 'thighSize', label: 'Thigh', kind: 'round', how: 'round the biggest part, just under the seat' },
  { key: 'calfSize', label: 'Calf', kind: 'round', how: 'round the biggest part of the calf' },
  { key: 'ankleSize', label: 'Ankle', kind: 'round', how: 'round the narrowest part, above the ankle bone' },
  { key: 'foot', label: 'Foot length', kind: 'length', how: 'back of the heel to the tip of the longest toe' },
];
export const MEASURE_KEYS = MEASURES.map((m) => m.key);

let masks = null;
function maskSets(count) {
  if (masks) return masks;
  const names = POSE_BONES.map((b) => b.name);
  const arm = (s) => names.filter((n) => n.endsWith('.' + s) && /^(upperarm|lowerarm|wrist|finger|metacarpal)/.test(n));
  const leg = (s) => names.filter((n) => n.endsWith('.' + s) && /^(upperleg|lowerleg|foot|toe)/.test(n));
  const armL = boneWeightSum(arm('L')), armR = boneWeightSum(arm('R'));
  const legL = boneWeightSum(leg('L'));
  const footL = boneWeightSum(names.filter((n) => n.endsWith('.L') && /^(foot|toe)/.test(n)));
  const handL = boneWeightSum(names.filter((n) => n.endsWith('.L') && /^(wrist|finger|metacarpal)/.test(n)));
  const n = Math.min(count, armL.length);
  const noArms = new Uint8Array(n), armOnly = new Uint8Array(n), legOnly = new Uint8Array(n), foot = new Uint8Array(n), hand = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    noArms[v] = armL[v] + armR[v] < 0.5 ? 1 : 0;
    armOnly[v] = armL[v] > 0.5 ? 1 : 0;
    legOnly[v] = legL[v] > 0.5 ? 1 : 0;
    foot[v] = footL[v] > 0.5 ? 1 : 0;
    hand[v] = handL[v] > 0.6 ? 1 : 0;
  }
  masks = { noArms, armOnly, legOnly, foot, hand, n };
  return masks;
}
// The triangles whose three corners all pass a vertex mask, cached per mask.
const triCache = new Map();
function trisFor(name, mask, index, n) {
  const key = name + ':' + index.length; let t = triCache.get(key);
  if (t) return t;
  const out = [];
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (a < n && b < n && c < n && mask[a] && mask[b] && mask[c]) out.push(i);
  }
  t = Int32Array.from(out); triCache.set(key, t); return t;
}

// The tape round the skin where the plane through `point` square to `normal` cuts the triangles
// `tris`, for the loop nearest `centre`: the length of the convex hull of its points. null when
// the plane misses.
export function tapeRound(pos, index, tris, point, normal, centre = point) {
  const nrm = unit(normal), d = (v) => (pos[v * 3] - point[0]) * nrm[0] + (pos[v * 3 + 1] - point[1]) * nrm[1] + (pos[v * 3 + 2] - point[2]) * nrm[2] + 1e-9;
  const parent = new Map(), pts = new Map();
  const find = (k) => { let r = k; while (parent.get(r) !== r) r = parent.get(r); let x = k; while (parent.get(x) !== r) { const nx = parent.get(x); parent.set(x, r); x = nx; } return r; };
  const node = (a, b, da, db) => {
    const key = a < b ? a * 65536 + b : b * 65536 + a;
    if (!parent.has(key)) {
      parent.set(key, key); const s = da / (da - db);
      pts.set(key, [pos[a * 3] + (pos[b * 3] - pos[a * 3]) * s, pos[a * 3 + 1] + (pos[b * 3 + 1] - pos[a * 3 + 1]) * s, pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * s]);
    }
    return key;
  };
  for (let j = 0; j < tris.length; j++) {
    const i = tris[j], v = [index[i], index[i + 1], index[i + 2]], dv = v.map(d), got = [];
    for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3], da = dv[k], db = dv[(k + 1) % 3]; if ((da > 0) !== (db > 0)) got.push(node(a, b, da, db)); }
    if (got.length === 2) { const ra = find(got[0]), rb = find(got[1]); if (ra !== rb) parent.set(ra, rb); }
  }
  if (!pts.size) return null;
  // the loop nearest the centre
  const groups = new Map();
  for (const [k, p] of pts) { const r = find(k); let g = groups.get(r); if (!g) groups.set(r, (g = [])); g.push(p); }
  let best = null, bestD = Infinity;
  for (const g of groups.values()) {
    if (g.length < 6) continue;
    let m = Infinity; for (const p of g) { const q = Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]); if (q < m) m = q; }
    if (m < bestD) { bestD = m; best = g; }
  }
  if (!best) return null;
  // flatten onto the plane and take the hull
  const ref = Math.abs(nrm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = unit([ref[1] * nrm[2] - ref[2] * nrm[1], ref[2] * nrm[0] - ref[0] * nrm[2], ref[0] * nrm[1] - ref[1] * nrm[0]]);
  const w = [nrm[1] * u[2] - nrm[2] * u[1], nrm[2] * u[0] - nrm[0] * u[2], nrm[0] * u[1] - nrm[1] * u[0]];
  const flat = best.map((p) => [p[0] * u[0] + p[1] * u[1] + p[2] * u[2], p[0] * w[0] + p[1] * w[1] + p[2] * w[2]]);
  return hullLength(flat);
}
export function hullLength(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return 0;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  const h = lower.slice(0, -1).concat(upper.slice(0, -1));
  let L = 0; for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; L += Math.hypot(a[0] - b[0], a[1] - b[1]); }
  return L;
}

// Biggest or smallest loop along a bone between two shares of its length.
function alongBone(pos, index, tris, a, b, from, to, pick, steps = 7) {
  const axis = sub(b, a); let out = pick === 'max' ? -Infinity : Infinity;
  for (let i = 0; i < steps; i++) {
    const t = from + (to - from) * (i / (steps - 1)), p = lerp(a, b, t), g = tapeRound(pos, index, tris, p, axis, p);
    if (g == null || !(g > 0)) continue;
    out = pick === 'max' ? Math.max(out, g) : Math.min(out, g);
  }
  return Number.isFinite(out) ? out : null;
}
// Biggest or smallest level loop round the torso between two heights.
function level(pos, index, tris, y0, y1, pick, z, steps = 8) {
  let out = pick === 'max' ? -Infinity : Infinity;
  for (let i = 0; i < steps; i++) {
    const y = y0 + (y1 - y0) * (i / (steps - 1)), p = [0, y, z], g = tapeRound(pos, index, tris, p, [0, 1, 0], p);
    if (g == null || !(g > 0)) continue;
    out = pick === 'max' ? Math.max(out, g) : Math.min(out, g);
  }
  return Number.isFinite(out) ? out : null;
}

// The body's landmarks the measurements hang from (rest positions, units).
function marks(pos, joints, M, bodyCount) {
  const J = (n, e) => jp(joints, n, e);
  const crotchY = (() => { let lo = Infinity; for (let v = 0; v < bodyCount; v++) { const x = pos[v * 3], y = pos[v * 3 + 1]; if (Math.abs(x) < 0.012 && y > 0.55 && y < 1.1 && y < lo) lo = y; } return lo; })();
  const nip = MARKS.nipL, nav = MARKS.navel;
  return {
    shoulder: J('upperarm01.L'), elbow: J('lowerarm01.L'), wrist: J('wrist.L'), hip: J('upperleg01.L'), knee: J('lowerleg01.L'), ankle: J('foot.L'),
    neckBase: J('neck01'), neckTop: J('neck02', 'tail'), neckUp: J('neck03', 'tail'), skull: J('head'), crotchY,
    nipY: pos[nip * 3 + 1], navelY: pos[nav * 3 + 1], navelZ: pos[nav * 3 + 2],
  };
}

// Every measurement, in body units (multiply by unitsToInches for inches). positions: rest
// positions, joints: the rest skeleton's joints (createRestRig / shapeJoints), index: the body's
// triangles, bodyCount: vertices of the body proper. only: a measurement key, or a list, to save time.
export function measureBody(positions, joints, index, bodyCount, only = null) {
  const M = maskSets(bodyCount), pos = positions, want = only == null ? null : new Set([].concat(only));
  const k = marks(pos, joints, M, bodyCount), out = {};
  const T = (name) => trisFor(name, M[name], index, M.n);
  const go = (key, f) => { if (want && !want.has(key)) return; try { const v = f(); if (v != null && Number.isFinite(v) && v > 0) out[key] = v; } catch (_) {} };
  const torsoZ = () => k.navelZ - 0.09; // about the middle of the torso, front to back
  go('neckSize', () => { // the slimmest loop low on the neck, square to it, above the collarbones and under the jaw
    const a = k.neckBase, b = k.neckTop, nrm = sub(k.neckUp, a); let m = Infinity;
    for (let i = 0; i < 5; i++) { const p = lerp(a, b, 0.15 + 0.3 * i / 4), g = tapeRound(pos, index, T('noArms'), p, nrm, p); if (g > 0 && g < m) m = g; }
    return Number.isFinite(m) ? m : null;
  });
  go('neckLen', () => len(sub(k.skull, k.neckBase)));
  go('shoulders', () => { const y = k.shoulder[1]; let lo = Infinity, hi = -Infinity; for (let v = 0; v < M.n; v++) if (Math.abs(pos[v * 3 + 1] - y) < 0.012) { const x = pos[v * 3]; if (x < lo) lo = x; if (x > hi) hi = x; } return hi - lo; });
  go('chest', () => level(pos, index, T('noArms'), k.nipY - 0.015, k.nipY + 0.045, 'max', torsoZ(k.nipY)));
  go('waist', () => level(pos, index, T('noArms'), k.navelY + 0.01, k.navelY + 0.55 * (k.nipY - k.navelY), 'min', torsoZ(k.navelY)));
  go('hips', () => level(pos, index, T('noArms'), k.crotchY + 0.04, k.crotchY + 0.55 * (k.navelY - k.crotchY), 'max', torsoZ(k.crotchY)));
  go('torsoLen', () => k.neckBase[1] - k.navelY);
  go('upperArmLen', () => len(sub(k.elbow, k.shoulder)));
  go('foreArmLen', () => len(sub(k.wrist, k.elbow)));
  go('upperArmSize', () => alongBone(pos, index, T('armOnly'), k.shoulder, k.elbow, 0.35, 0.7, 'max'));
  go('foreArmSize', () => alongBone(pos, index, T('armOnly'), k.elbow, k.wrist, 0.12, 0.4, 'max'));
  go('wristSize', () => alongBone(pos, index, T('armOnly'), k.elbow, k.wrist, 0.86, 0.97, 'min', 5));
  go('hand', () => { const H = M.hand, w = k.wrist, dir = unit(sub(k.wrist, k.elbow)); let m = 0; for (let v = 0; v < M.n; v++) if (H[v]) { const d = (pos[v * 3] - w[0]) * dir[0] + (pos[v * 3 + 1] - w[1]) * dir[1] + (pos[v * 3 + 2] - w[2]) * dir[2]; if (d > m) m = d; } return m; });
  go('thighLen', () => k.crotchY - k.knee[1]);
  go('shinLen', () => k.knee[1] - k.ankle[1]);
  go('thighSize', () => alongBone(pos, index, T('legOnly'), k.hip, k.knee, 0.2, 0.42, 'max'));
  go('calfSize', () => alongBone(pos, index, T('legOnly'), k.knee, k.ankle, 0.15, 0.55, 'max'));
  go('ankleSize', () => alongBone(pos, index, T('legOnly'), k.knee, k.ankle, 0.8, 0.95, 'min', 5));
  go('foot', () => { const F = M.foot; let lo = Infinity, hi = -Infinity; for (let v = 0; v < M.n; v++) if (F[v]) { const z = pos[v * 3 + 2]; if (z < lo) lo = z; if (z > hi) hi = z; } return hi - lo; });
  return out;
}

export const unitsToInches = (u, heightCm = 175) => u * 100 * (heightCm / 175) / 2.54;
export const inchesToUnits = (i, heightCm = 175) => i * 2.54 / 100 / (heightCm / 175);

// "14.3 in" for the Body panel; quarter inches past 20 in read as plain tenths still.
export function inchText(inches) { return Number.isFinite(inches) ? `${inches.toFixed(1)} in` : ''; }
// What someone typed as a measurement, in inches: "14.5", "14 1/2", "14½", "36 cm", "1' 2\"".
export function parseInches(text) {
  if (text == null) return null;
  let s = String(text).trim().toLowerCase().replace(/,/g, '.').replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4');
  if (!s) return null;
  const cm = /^(\d+(?:\.\d+)?)\s*(cm|centimet(?:er|re)s?)$/.exec(s); if (cm) return +cm[1] / 2.54;
  const mm = /^(\d+(?:\.\d+)?)\s*mm$/.exec(s); if (mm) return +mm[1] / 25.4;
  const ft = /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?)?)?$/.exec(s); if (ft) return +ft[1] * 12 + (+ft[2] || 0);
  s = s.replace(/\s*(?:"|in|inch(?:es)?)$/, '').trim();
  const frac = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(s); if (frac && +frac[3]) return (+frac[1] || 0) + +frac[2] / +frac[3];
  if (/^\d+(?:\.\d+)?$|^\.\d+$/.test(s)) return +s;
  return null;
}

// The slider value (-1..1) that gives `target` for one measurement. measureAt(v) returns the
// measurement with the slider at v (null if it can't be taken). The shape targets make a
// measurement grow or shrink steadily with its slider, so a false-position search (Illinois)
// finds it in a handful of tries. Returns { value, reached, got, lo, hi }: reached false when the
// target is past the slider's range, and value is then the nearest end.
export function solveSlider(measureAt, target, { tol = 0.01, steps = 12 } = {}) {
  let fa = measureAt(-1), fb = measureAt(1);
  if (fa == null || fb == null) return null;
  const min = Math.min(fa, fb), max = Math.max(fa, fb), up = fb >= fa;
  if (target <= min + tol) return { value: up ? -1 : 1, reached: target >= min - tol, got: min, lo: min, hi: max };
  if (target >= max - tol) return { value: up ? 1 : -1, reached: target <= max + tol, got: max, lo: min, hi: max };
  let a = -1, b = 1, ga = fa - target, gb = fb - target, side = 0, v = 0, got = null;
  for (let i = 0; i < steps; i++) {
    v = (a * gb - b * ga) / (gb - ga); if (!Number.isFinite(v)) v = (a + b) / 2;
    got = measureAt(v); if (got == null) break;
    const g = got - target; if (Math.abs(g) <= tol) break;
    if ((g > 0) === (gb > 0)) { b = v; gb = g; if (side === -1) ga /= 2; side = -1; } else { a = v; ga = g; if (side === 1) gb /= 2; side = 1; }
  }
  return { value: Math.max(-1, Math.min(1, v)), reached: got != null && Math.abs(got - target) <= tol * 3, got, lo: min, hi: max };
}

// Set several measurements at once: each slider in `targets` ({ key: inches }) is searched in
// turn, then any that moved off (a longer shin makes the whole body taller, so everything else
// shrinks a little to keep the height) are searched again, a few rounds at most.
// measure(fit, key) gives inches for a fit. first: the key to do first (the one just typed).
// Returns { fit, misses: [{ key, target, got, lo, hi }] } for any the sliders can't reach.
export function matchMeasurements(fit, targets, measure, { first = null, tol = 0.05, rounds = 3 } = {}) {
  const out = { ...fit }, keys = Object.keys(targets).filter((k) => Number.isFinite(targets[k]));
  if (first && keys.includes(first)) keys.splice(keys.indexOf(first), 1), keys.unshift(first);
  const last = {};
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (const key of keys) {
      const now = measure(out, key); if (now == null || Math.abs(now - targets[key]) <= tol) continue;
      const res = solveSlider((v) => { const f = { ...out }; if (v) f[key] = v; else delete f[key]; return measure(f, key); }, targets[key], { tol: tol / 2 });
      if (!res) continue;
      const before = out[key] || 0;
      if (Math.abs(res.value) > 1e-4) out[key] = +res.value.toFixed(4); else delete out[key];
      last[key] = res; if (Math.abs((out[key] || 0) - before) > 1e-4) moved = true;
    }
    if (!moved) break;
  }
  const misses = [];
  for (const key of keys) { const got = measure(out, key); if (got != null && Math.abs(got - targets[key]) > tol * 2) misses.push({ key, target: targets[key], got, lo: last[key] && last[key].lo, hi: last[key] && last[key].hi }); }
  return { fit: out, misses };
}
