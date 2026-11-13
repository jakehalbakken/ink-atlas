// Match the body to a photo: a full-length photo taken from the front gives the proportions
// (shoulders, chest, waist, hips, thighs, how long the torso and legs are, all as a share of
// the height), and the body's sliders are searched until the 3D body has the same proportions.
//
// The photo side uses MediaPipe's pose landmarker (33 points on the body plus a mask of the
// person), run on the device. Nothing is uploaded and the photo is not kept.
//
// The two sides measure the same things in the same way: a row of the person's outline (photo)
// or a slice of the body's front outline (3D) at the same place between the same joints.

// MediaPipe pose landmark numbers
export const LM = { nose: 0, earL: 7, earR: 8, shoulderL: 11, shoulderR: 12, elbowL: 13, elbowR: 14, wristL: 15, wristR: 16, hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankleL: 27, ankleR: 28, heelL: 29, heelR: 30, toeL: 31, toeR: 32 };

// Where each width is taken: a share of the way from the shoulders (0) to the hips (1), or
// from the hips (0) to the knees (1) for the thighs.
export const LEVELS = { chest: 0.22, waist: 0.62, hips: 1.0, thigh: 0.3 };
export const KEYS = ['shoulders', 'chest', 'waist', 'hips', 'thigh', 'torso', 'legs'];

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// The run of 'on' pixels in one row that contains column cx, or null. mask: values 0..1.
export function rowRun(mask, w, h, y, cx) {
  y = Math.round(y); cx = Math.round(cx);
  if (y < 0 || y >= h || cx < 0 || cx >= w) return null;
  const on = (x) => mask[y * w + x] > 0.5;
  // allow the centre to sit in a small gap (a navel shadow, a belt): look nearby first
  let c = cx; if (!on(c)) { for (let d = 1; d < Math.max(3, w * 0.02) && !on(c); d++) { if (cx + d < w && on(cx + d)) c = cx + d; else if (cx - d >= 0 && on(cx - d)) c = cx - d; } if (!on(c)) return null; }
  let a = c, b = c; while (a > 0 && on(a - 1)) a--; while (b < w - 1 && on(b + 1)) b++;
  return { a, b, width: b - a + 1 };
}

// Proportions from a photo. lm: 33 landmarks with x, y in 0..1 (and visibility). mask: the
// person mask at w x h. Returns { ratios, problems }; ratios are shares of the height, problems
// is a list of plain sentences when the photo can't be read well.
export function measurePhoto(lm, mask, w, h) {
  const problems = [];
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const need = [LM.shoulderL, LM.shoulderR, LM.hipL, LM.hipR, LM.kneeL, LM.kneeR, LM.ankleL, LM.ankleR];
  if (need.some((i) => !lm[i] || P(i).v < 0.4)) problems.push('Your whole body needs to be in the photo, head to feet.');
  const sL = P(LM.shoulderL), sR = P(LM.shoulderR), hL = P(LM.hipL), hR = P(LM.hipR), kL = P(LM.kneeL), kR = P(LM.kneeR);
  const feet = [LM.heelL, LM.heelR, LM.ankleL, LM.ankleR, LM.toeL, LM.toeR].map(P).filter((p) => p.v > 0.3);
  // the top of the head: the highest row of the person above the face
  const head = [LM.nose, LM.earL, LM.earR].map(P);
  const hx0 = Math.max(0, Math.floor(Math.min(...head.map((p) => p.x)) - w * 0.04)), hx1 = Math.min(w - 1, Math.ceil(Math.max(...head.map((p) => p.x)) + w * 0.04));
  let top = -1;
  for (let y = 0; y < h && top < 0; y++) for (let x = hx0; x <= hx1; x++) if (mask[y * w + x] > 0.5) { top = y; break; }
  const bottom = feet.length ? Math.max(...feet.map((p) => p.y)) : Math.max(P(LM.ankleL).y, P(LM.ankleR).y);
  if (top < 0 || top >= head[0].y) problems.push('I could not find the top of your head.');
  if (top <= 1) problems.push('The top of your head is cut off. Step back a little.');
  if (bottom >= h - 2) problems.push('Your feet are cut off. Step back a little.');
  const H = bottom - top;
  if (!(H > h * 0.35)) problems.push('You look small in the photo. Fill more of the frame, head to feet.');
  // facing the camera: the shoulders read wide next to the hips; side-on they collapse
  if (Math.abs(sL.x - sR.x) < Math.abs(sL.y - sR.y) * 2 || Math.abs(sL.x - sR.x) < H * 0.12) problems.push('Face the camera straight on.');
  const S = mid(sL, sR), Hm = mid(hL, hR), K = mid(kL, kR);
  const cx = (S.x + Hm.x) / 2;
  const width = (t, from, to, x) => { const y = from.y + (to.y - from.y) * t; const r = rowRun(mask, w, h, y, x ?? (from.x + (to.x - from.x) * t)); return r ? r.width : NaN; };
  const chest = width(LEVELS.chest, S, Hm, cx), waist = width(LEVELS.waist, S, Hm, cx), hips = width(LEVELS.hips, S, Hm, cx);
  // a thigh on each side, from its own hip towards its own knee
  const thighs = [[hL, kL], [hR, kR]].map(([a, b]) => width(LEVELS.thigh, a, b, a.x + (b.x - a.x) * LEVELS.thigh)).filter(Number.isFinite);
  const thigh = thighs.length ? Math.min(...thighs) : NaN;
  // arms touching the sides make the chest and waist read too wide
  if (Number.isFinite(chest) && chest > Math.abs(sL.x - sR.x) * 1.6) problems.push('Hold your arms a little away from your sides.');
  // thighs that touch read as one: leave the thighs out rather than refuse the photo
  const thighOk = !(Number.isFinite(hips) && Number.isFinite(thigh) && thigh > hips * 0.8);
  const ankleY = (P(LM.ankleL).y + P(LM.ankleR).y) / 2;
  const ratios = {
    shoulders: Math.abs(sL.x - sR.x) / H, chest: chest / H, waist: waist / H, hips: hips / H, thigh: thighOk ? thigh / H : NaN,
    torso: (Hm.y - S.y) / H, legs: (ankleY - Hm.y) / H,
  };
  for (const k of KEYS) if (!Number.isFinite(ratios[k]) || ratios[k] <= 0) { ratios[k] = NaN; }
  if (KEYS.filter((k) => Number.isNaN(ratios[k])).length > 2 && !problems.length) problems.push('I could not read your outline. Try a plain background.');
  return { ratios, problems: [...new Set(problems)] };
}

// The same proportions from the 3D body. positions: flat xyz (y up, front +z), joints: flat
// xyz of the skeleton, bones: [{name, head, tail}], parts: { arm, legL } per-vertex weights
// (0..1) for the arms and the left leg, count: how many body vertices to look at.
export function measureBody(positions, joints, bones, parts, count) {
  const J = (name, end = 'head') => { const b = bones.find((x) => x.name === name); const i = b[end] * 3; return { x: joints[i], y: joints[i + 1], z: joints[i + 2] }; };
  const sL = J('upperarm01.L'), sR = J('upperarm01.R'), hL = J('upperleg01.L'), hR = J('upperleg01.R'), kL = J('lowerleg01.L'), aL = J('lowerleg02.L', 'tail'), aR = J('lowerleg02.R', 'tail');
  let top = -Infinity, bottom = Infinity;
  for (let v = 0; v < count; v++) { const y = positions[v * 3 + 1]; if (y > top) top = y; if (y < bottom) bottom = y; }
  const H = top - bottom;
  const S = mid(sL, sR), Hm = mid(hL, hR);
  // width of the front outline in a thin slice at height y, of vertices passing `keep`
  const slice = (y, keep) => {
    let lo = Infinity, hi = -Infinity; const band = H * 0.006;
    for (let v = 0; v < count; v++) {
      const py = positions[v * 3 + 1]; if (Math.abs(py - y) > band || !keep(v)) continue;
      const px = positions[v * 3]; if (px < lo) lo = px; if (px > hi) hi = px;
    }
    return hi > lo ? hi - lo : NaN;
  };
  const torso = (v) => parts.arm[v] < 0.5;
  const at = (t) => S.y + (Hm.y - S.y) * t;
  const thighY = hL.y + (kL.y - hL.y) * LEVELS.thigh;
  return {
    shoulders: Math.abs(sL.x - sR.x) / H,
    chest: slice(at(LEVELS.chest), torso) / H, waist: slice(at(LEVELS.waist), torso) / H, hips: slice(at(LEVELS.hips), torso) / H,
    thigh: slice(thighY, (v) => parts.legL[v] > 0.5) / H,
    torso: (S.y - Hm.y) / H, legs: (Hm.y - (aL.y + aR.y) / 2) / H,
  };
}

// The sliders searched, with how much each proportion matters. Muscle and figure are left as
// they are: a front outline can't tell muscle from fat.
export const SEARCH = [
  { key: 'weight', lo: 0, hi: 1 },
  { key: 'fit.shoulders' }, { key: 'fit.chest' }, { key: 'fit.waist' }, { key: 'fit.hips' },
  { key: 'fit.thighSize' }, { key: 'fit.torsoLen' }, { key: 'fit.legLen' },
];
const WEIGHTS = { shoulders: 0.8, chest: 1, waist: 1.3, hips: 1.1, thigh: 0.8, torso: 1, legs: 1 };

// How far the body's proportions are from the target: relative error, weighted, plus a small
// pull towards standard so a slider only moves when the photo asks for it.
export function mismatch(target, got, params) {
  let e = 0;
  for (const k of KEYS) { const t = target[k], g = got[k]; if (!Number.isFinite(t) || !Number.isFinite(g)) continue; const r = (g - t) / t; e += WEIGHTS[k] * r * r; }
  for (const s of SEARCH) if (s.key.startsWith('fit.')) { const v = getParam(params, s.key); e += 0.0004 * v * v; }
  return e;
}

export function getParam(p, key) { if (key.startsWith('fit.')) return (p.fit && p.fit[key.slice(4)]) || 0; return p[key] ?? 0.5; }
export function setParam(p, key, v) {
  const q = { ...p, fit: { ...(p.fit || {}) } };
  if (key === 'fit.legLen') { q.fit.thighLen = v; q.fit.shinLen = v; return q; }
  if (key.startsWith('fit.')) q.fit[key.slice(4)] = v; else q[key] = v;
  return q;
}
const range = (s) => [s.lo ?? -1, s.hi ?? 1];

// Search the sliders. measure(params) -> proportions of the body with those settings. Plain
// coordinate descent with a shrinking step: dependable, and fast enough with ~150 looks.
export function fitBody(target, start, measure, { rounds = 8 } = {}) {
  let best = { ...start, fit: { ...(start.fit || {}) } };
  if (best.fit.thighLen !== undefined || best.fit.shinLen !== undefined) { const v = ((best.fit.thighLen || 0) + (best.fit.shinLen || 0)) / 2; best = setParam(best, 'fit.legLen', v); }
  let bestE = mismatch(target, measure(best), best), looks = 1;
  let step = 0.5;
  for (let r = 0; r < rounds; r++, step *= 0.6) {
    for (const s of SEARCH) {
      const [lo, hi] = range(s);
      const scale = s.key === 'weight' ? 0.5 : 1;
      for (const dir of [1, -1]) {
        let moved = true;
        while (moved) {
          moved = false;
          const cur = s.key === 'fit.legLen' ? getParam(best, 'fit.thighLen') : getParam(best, s.key);
          const v = Math.max(lo, Math.min(hi, cur + dir * step * scale)); if (v === cur) break;
          const cand = setParam(best, s.key, v); const e = mismatch(target, measure(cand), cand); looks++;
          if (e < bestE - 1e-7) { best = cand; bestE = e; moved = true; }
        }
      }
    }
  }
  return { params: best, error: bestE, looks };
}
