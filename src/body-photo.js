// Match the body to a photo. Any photo of the person works: head to toe, a mirror selfie of the
// upper body, or a photo of the back. Whatever the photo shows is measured (shoulders, chest,
// waist, hips, thighs, how long the torso and legs are), and only the sliders for those parts
// are searched, so a partial photo leaves the rest of the body as it was and several photos
// build it up.
//
// A head-to-toe photo gives every measurement as a share of the height. A partial photo has no
// height, so its measurements are shares of the shoulder width (or of the hip width when the
// shoulders are out of frame), and the 3D body is measured the same way.
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
export const KEYS = ['shoulders', 'chest', 'waist', 'hips', 'thigh', 'torso', 'legs', 'chestD', 'waistD', 'hipsD'];
// a photo from the side reads these instead of the widths: how deep the chest, belly and seat are
export const SIDE_KEYS = ['chestD', 'waistD', 'hipsD'];
// in plain words, for "Matched your ..."
export const PART_NAMES = { shoulders: 'shoulders', chest: 'chest', waist: 'waist', hips: 'hips', thigh: 'thighs', torso: 'torso length', legs: 'leg length', chestD: 'chest depth', waistD: 'belly', hipsD: 'seat' };

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
// person mask at w x h. Returns { ratios, ref, parts, view, problems, notes }:
// - ratios: each measurement as a share of ref ('height', 'shoulders' or 'hips'); NaN when the
//   photo doesn't show it. ratios[ref] is NaN unless ref is 'height'.
// - parts: the measurements read, in KEYS order. view: 'front', 'back' or 'side' (side on to
//   the camera: the depth of the chest, belly and seat are read in place of the widths).
// - problems: plain sentences when nothing usable could be read (the photo is refused).
// - notes: plain sentences about parts left out of an otherwise usable photo.
// opts.view: 'front', 'side' or 'back' to read the photo that way whatever it looks like (the
// person said so). opts.frontShape: shape from a photo of the same person straight on, which a
// side photo, only as deep as the body, is clearly narrower than.
export function measurePhoto(lm, mask, w, h, opts = {}) {
  const problems = [], notes = [];
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  // a joint counts when it's confidently found and inside the picture
  const seen = (i) => { if (!lm[i]) return false; const p = lm[i]; return (p.visibility ?? 1) >= 0.5 && p.x >= 0.01 && p.x <= 0.99 && p.y >= 0.01 && p.y <= 0.99; };
  const both = (a, b) => seen(a) && seen(b);
  const hasS = both(LM.shoulderL, LM.shoulderR), hasH = both(LM.hipL, LM.hipR), hasK = both(LM.kneeL, LM.kneeR), hasA = both(LM.ankleL, LM.ankleR);
  // From behind, the nose sits further from the camera than the ears (the landmarker's z is
  // depth, smaller = nearer); with no depth, a face that isn't seen means a back.
  const nz = lm[LM.nose]?.z, ez = ((lm[LM.earL]?.z ?? NaN) + (lm[LM.earR]?.z ?? NaN)) / 2;
  let view = Number.isFinite(nz) && Number.isFinite(ez) ? (nz > ez + 0.02 ? 'back' : 'front')
    : (lm[LM.nose]?.visibility ?? 1) < 0.5 && (lm[LM.earL]?.visibility ?? 1) < 0.6 && (lm[LM.earR]?.visibility ?? 1) < 0.6 ? 'back' : 'front';
  const ratios = Object.fromEntries(KEYS.map((k) => [k, NaN]));
  const inPic = (i) => lm[i] && lm[i].x >= 0.01 && lm[i].x <= 0.99 && lm[i].y >= 0.01 && lm[i].y <= 0.99;
  const pair = (a, b) => inPic(a) && inPic(b) && Math.max(lm[a].visibility ?? 1, lm[b].visibility ?? 1) >= 0.5;
  if (!hasS && !hasH && !(pair(LM.shoulderL, LM.shoulderR) && pair(LM.hipL, LM.hipR))) return { ratios, ref: null, parts: [], view, problems: ['I could not find your shoulders or hips in this photo. Use a photo that shows at least your upper body.'], notes };
  const sL = P(LM.shoulderL), sR = P(LM.shoulderR), hL = P(LM.hipL), hR = P(LM.hipR), kL = P(LM.kneeL), kR = P(LM.kneeR);
  const S = mid(sL, sR), Hm = mid(hL, hR);
  const raw = {};
  // a width of the outline; a run that reaches the frame's edge is cut off, so it doesn't count
  const run = (y, x) => { const r = rowRun(mask, w, h, y, x); return r && r.a > 0 && r.b < w - 1 ? r.width : NaN; };
  // where each arm crosses a row (shoulder, elbow, wrist, then the hand), so a width the arm lies
  // inside can be left out: arms hanging at the sides join the outline at the waist, hips and thighs
  const armChain = [[LM.shoulderL, LM.elbowL, LM.wristL, 19], [LM.shoulderR, LM.elbowR, LM.wristR, 20]]
    .map((c) => c.filter((i) => inPic(i) && (lm[i].visibility ?? 1) >= 0.3).map(P))
    // a joint guessed far from the one before it (more than a torso away) is a wrong guess
    .map((c) => c.filter((p, i) => !i || Math.hypot(p.x - c[i - 1].x, p.y - c[i - 1].y) < Math.abs(lm[LM.hipL].y - lm[LM.shoulderL].y) * h * 1.2));
  const armIn = (y, x) => {
    const r = rowRun(mask, w, h, y, x); if (!r) return false;
    return armChain.some((c) => c.some((p, i) => { const q = c[i + 1]; if (!q || y < Math.min(p.y, q.y) || y > Math.max(p.y, q.y) || p.y === q.y) return false; const ax = p.x + (q.x - p.x) * (y - p.y) / (q.y - p.y); return ax > r.a && ax < r.b; }));
  };
  // side on: the shoulders sit nearly over each other, so the outline's width is the body's depth.
  // Side on, the far shoulder and hip are often only guessed (low visibility), so here a pair
  // counts when both are in the picture and one is clearly seen; the landmarker's depth (z, in
  // the same units as x) then shows the shoulders lie one behind the other.
  const upright = Hm.y - S.y > Math.abs(Hm.x - S.x) * 2, dx = Math.abs(sL.x - sR.x), dxH = Math.abs(hL.x - hR.x);
  const dz = Math.abs((lm[LM.shoulderL].z ?? NaN) - (lm[LM.shoulderR].z ?? NaN)) * w;
  // a face in profile: the nose well out past both ears, the ears nearly over each other
  const tl = Hm.y - S.y, nose = inPic(LM.nose) && inPic(LM.earL) && inPic(LM.earR) ? [P(LM.nose), P(LM.earL), P(LM.earR)] : null;
  const profile = !!nose && Math.abs(nose[1].x - nose[2].x) < tl * 0.25
    && Math.max(Math.min(nose[1].x, nose[2].x) - nose[0].x, nose[0].x - Math.max(nose[1].x, nose[2].x)) > tl * 0.12;
  // Side on, the landmarker can also guess the shoulders as if facing the camera. Facing it, the
  // outline just under the shoulders always spans past both shoulder joints (the deltoids sit
  // outside them); side on it is only the body's depth, so the guessed shoulders spill out of it.
  const spill = dx > 0 && [0.08, 0.15].every((t) => { const r = run(S.y + tl * t, S.x); return Number.isFinite(r) && r < dx * 0.75; });
  // the landmarker reads a turned body part way when side on, so a narrowish pair of shoulders
  // counts too when the depth or the face says side on
  // the outline's width at the chest over the torso's length: about the body's width straight on
  // (with the arms), only its depth side on
  const shape = run(S.y + tl * LEVELS.chest, (S.x + Hm.x) / 2) / tl;
  const narrower = Number.isFinite(opts.frontShape) && Number.isFinite(shape) && shape < opts.frontShape * 0.72;
  const auto = pair(LM.shoulderL, LM.shoulderR) && pair(LM.hipL, LM.hipR) && upright
    && (dx < tl * 0.22 || spill || narrower || (dx < tl * 0.45 && dxH < tl * 0.45 && ((Number.isFinite(dz) && dz > dx * 1.2) || profile)));
  const autoView = auto ? 'side' : view;
  const forced = ['front', 'side', 'back'].includes(opts.view) ? opts.view : null;
  const side = forced ? forced === 'side' && tl > 0 : auto;
  if (forced && forced !== 'side') view = forced;
  const why = { dx: +(dx / tl).toFixed(3), runs: [0.08, 0.15].map((t) => +(run(S.y + tl * t, S.x) / dx).toFixed(3)), shape: +shape.toFixed(3), frontShape: opts.frontShape ?? null, dz: Number.isFinite(dz) ? +(dz / dx).toFixed(3) : null, profile, auto: autoView };
  if (side) {
    const cx = (S.x + Hm.x) / 2, at = (t) => S.y + (Hm.y - S.y) * t;
    raw.chestD = run(at(LEVELS.chest), cx); raw.waistD = run(at(LEVELS.waist), cx); raw.hipsD = run(at(LEVELS.hips), Hm.x);
    raw.torso = Hm.y - S.y;
  } else if (hasS) raw.shoulders = Math.abs(sL.x - sR.x);
  if (side) { /* the widths can't be read side on */ } else if (hasS && hasH) {
    const cx = (S.x + Hm.x) / 2, at = (t) => S.y + (Hm.y - S.y) * t;
    raw.chest = run(at(LEVELS.chest), cx); raw.waist = run(at(LEVELS.waist), cx); raw.hips = run(at(LEVELS.hips), cx);
    raw.torso = Hm.y - S.y;
    // facing the camera (or straight away from it): side-on, the shoulders collapse
    if (Math.abs(sL.x - sR.x) < Math.abs(sL.y - sR.y) * 2 || raw.shoulders < raw.torso * 0.3) problems.push(view === 'back' ? 'Stand with your back straight to the camera.' : 'Face the camera straight on.');
    // arms touching the sides make the chest and waist read too wide: leave them out
    const touched = [];
    if (Number.isFinite(raw.chest) && (raw.chest > raw.shoulders * 1.6 || armIn(at(LEVELS.chest), cx))) { raw.chest = NaN; touched.push('chest'); }
    if (Number.isFinite(raw.waist) && (touched.length || armIn(at(LEVELS.waist), cx))) { raw.waist = NaN; touched.push('waist'); }
    if (Number.isFinite(raw.hips) && armIn(at(LEVELS.hips), cx)) { raw.hips = NaN; touched.push('hips'); }
    if (touched.length) notes.push(`Your arms touch your sides, so I left your ${touched.length > 1 ? touched.slice(0, -1).join(', ') + ' and ' + touched.at(-1) : touched[0]} out.`);
  } else if (hasS && Math.abs(sL.x - sR.x) < Math.abs(sL.y - sR.y) * 2) problems.push('Face the camera straight on.');
  if (hasH && !hasS) raw.hips = run(Hm.y, Hm.x);
  if (hasH && hasK && !side) {
    // a thigh on each side, from its own hip towards its own knee
    // (a hand resting on the thigh joins it: that one is left out)
    const thighs = [[hL, kL], [hR, kR]].map(([a, b]) => { const y = a.y + (b.y - a.y) * LEVELS.thigh, x = a.x + (b.x - a.x) * LEVELS.thigh; return armIn(y, x) ? NaN : run(y, x); }).filter(Number.isFinite);
    raw.thigh = thighs.length ? Math.min(...thighs) : NaN;
    // thighs that touch read as one: leave the thighs out
    if (Number.isFinite(raw.hips) && raw.thigh > raw.hips * 0.8) raw.thigh = NaN;
  }
  if (hasH && hasA) raw.legs = (P(LM.ankleL).y + P(LM.ankleR).y) / 2 - Hm.y;
  // the whole height: the top of the head (the highest row of the person above the face) to the feet
  let height = NaN;
  if (hasS && hasH && hasK && hasA) {
    const head = [LM.nose, LM.earL, LM.earR].map(P);
    const hx0 = Math.max(0, Math.floor(Math.min(...head.map((p) => p.x)) - w * 0.04)), hx1 = Math.min(w - 1, Math.ceil(Math.max(...head.map((p) => p.x)) + w * 0.04));
    let top = -1;
    for (let y = 0; y < h && top < 0; y++) for (let x = hx0; x <= hx1; x++) if (mask[y * w + x] > 0.5) { top = y; break; }
    const feet = [LM.heelL, LM.heelR, LM.ankleL, LM.ankleR, LM.toeL, LM.toeR].map(P).filter((p) => p.v > 0.3);
    const bottom = Math.max(...feet.map((p) => p.y));
    const headY = Math.min(...head.map((p) => p.y));
    if (top > 1 && top < headY && bottom < h - 2) height = bottom - top;
  }
  const ref = Number.isFinite(height) && height > h * 0.35 ? 'height' : side ? 'torso' : Number.isFinite(raw.shoulders) ? 'shoulders' : Number.isFinite(raw.hips) ? 'hips' : null;
  const denom = ref === 'height' ? height : raw[ref];
  if (!ref || !(denom > w * 0.04)) problems.push('You look small in the photo. Come a little closer.');
  for (const k of KEYS) { const v = raw[k] / denom; ratios[k] = k !== ref && Number.isFinite(v) && v > 0 ? v : NaN; }
  // from the side only the depths are used: the lengths come from a photo straight on
  if (side) for (const k of KEYS) if (!SIDE_KEYS.includes(k)) ratios[k] = NaN;
  if (side && Number.isFinite(raw.chestD) && Number.isFinite(raw.hipsD) && raw.chestD > raw.torso * 0.9) { ratios.chestD = NaN; ratios.waistD = NaN; notes.push('An arm stands out from your body, so I left your chest and belly out. Let your arms hang at your sides.'); }
  const parts = KEYS.filter((k) => Number.isFinite(ratios[k]));
  if (!parts.length && !problems.length) problems.push('I could not read your outline. Try a plain background.');
  return { ratios, ref, parts, view: side ? 'side' : forced || view, problems: [...new Set(problems)], notes, shape, why };
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
  // depth of the side outline in the same slice: front to back of the torso (arms left out)
  const deep = (y) => {
    let lo = Infinity, hi = -Infinity; const band = H * 0.006;
    for (let v = 0; v < count; v++) { if (Math.abs(positions[v * 3 + 1] - y) > band || !torso(v)) continue; const pz = positions[v * 3 + 2]; if (pz < lo) lo = pz; if (pz > hi) hi = pz; }
    return hi > lo ? (hi - lo) / H : NaN;
  };
  return {
    chestD: deep(at(LEVELS.chest)), waistD: deep(at(LEVELS.waist)), hipsD: deep(at(LEVELS.hips)),
    shoulders: Math.abs(sL.x - sR.x) / H,
    chest: slice(at(LEVELS.chest), torso) / H, waist: slice(at(LEVELS.waist), torso) / H, hips: slice(at(LEVELS.hips), torso) / H,
    thigh: slice(thighY, (v) => parts.legL[v] > 0.5) / H,
    torso: (S.y - Hm.y) / H, legs: (Hm.y - (aL.y + aR.y) / 2) / H,
  };
}

// The same measurements as shares of ref: 'height' leaves them as they are.
export function relativeTo(m, ref) {
  if (!ref || ref === 'height') return m;
  const out = {}; for (const k of KEYS) out[k] = k === ref ? NaN : m[k] / m[ref];
  return out;
}

// The sliders searched, with how much each proportion matters. Muscle and figure are left as
// they are: a front outline can't tell muscle from fat.
export const SEARCH = [
  { key: 'weight', lo: 0, hi: 1 },
  { key: 'fit.shoulders' }, { key: 'fit.chest' }, { key: 'fit.waist' }, { key: 'fit.hips' },
  { key: 'fit.thighSize' }, { key: 'fit.torsoLen' }, { key: 'fit.legLen' },
];
// the sliders a side photo moves: front to back, belly and seat
export const SIDE_SEARCH = [{ key: 'fit.depth' }, { key: 'fit.belly' }, { key: 'fit.butt' }];
// Which slider answers to which measurement.
const SLIDER_FOR = { shoulders: 'fit.shoulders', chest: 'fit.chest', waist: 'fit.waist', hips: 'fit.hips', thigh: 'fit.thighSize', torso: 'fit.torsoLen', legs: 'fit.legLen' };
// all three depths move together with Depth, front to back, so a side photo searches all three
// sliders whenever it reads any depth
// The sliders a photo may move: a head-to-toe photo moves them all (weight too); a partial photo
// moves only the sliders of the parts it shows, so the rest of the body stays as it was.
export function searchFor(parts, ref) {
  if (parts.some((k) => SIDE_KEYS.includes(k))) return SIDE_SEARCH.filter((s) => s.key === 'fit.depth' || (s.key === 'fit.belly' ? parts.includes('waistD') : parts.includes('hipsD')));
  if (ref === 'height') return SEARCH;
  const keys = new Set(parts.map((k) => SLIDER_FOR[k]));
  return SEARCH.filter((s) => keys.has(s.key));
}
const WEIGHTS = { shoulders: 0.8, chest: 1, waist: 1.3, hips: 1.1, thigh: 0.8, torso: 1, legs: 1, chestD: 1, waistD: 1.2, hipsD: 1 };

// How far the body's proportions are from the target: relative error, weighted, plus a small
// pull towards standard so a slider only moves when the photo asks for it.
export function mismatch(target, got, params) {
  let e = 0;
  for (const k of KEYS) { const t = target[k], g = got[k]; if (!Number.isFinite(t) || !Number.isFinite(g)) continue; const r = (g - t) / t; e += WEIGHTS[k] * r * r; }
  for (const s of [...SEARCH, ...SIDE_SEARCH]) if (s.key.startsWith('fit.')) { const v = getParam(params, s.key); e += 0.0004 * v * v; }
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
// search: which sliders may move (all of them unless told).
export function fitBody(target, start, measure, { rounds = 8, search = SEARCH } = {}) {
  let best = { ...start, fit: { ...(start.fit || {}) } };
  const legs = search.some((s) => s.key === 'fit.legLen');
  if (legs && (best.fit.thighLen !== undefined || best.fit.shinLen !== undefined)) { const v = ((best.fit.thighLen || 0) + (best.fit.shinLen || 0)) / 2; best = setParam(best, 'fit.legLen', v); }
  let bestE = mismatch(target, measure(best), best), looks = 1;
  let step = 0.5;
  for (let r = 0; r < rounds; r++, step *= 0.6) {
    for (const s of search) {
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

// The skin tone of a bare back: the middle of the back (between the shoulders and hips, in from the
// sides) by brightness, leaving out shadow and shine. Null when most of it doesn't look like skin
// (a shirt, a tattoo-covered back) or too little of it is in the photo.
export function backTone(pixels, mask, w, h, lm) {
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const sl = P(LM.shoulderL), sr = P(LM.shoulderR), hl = P(LM.hipL), hr = P(LM.hipR);
  const top = (sl.y + sr.y) / 2, bottom = (hl.y + hr.y) / 2, span = bottom - top;
  if (!(span > 20)) return null;
  let n = 0; const skin = [];
  for (let y = Math.round(top + span * 0.15); y < bottom - span * 0.12; y += 2) {
    const t = (y - top) / span, xl = sl.x + (hl.x - sl.x) * t, xr = sr.x + (hr.x - sr.x) * t;
    const a = Math.min(xl, xr), b = Math.max(xl, xr), inset = (b - a) * 0.2;
    for (let x = Math.round(a + inset); x < b - inset; x += 2) {
      if (x < 0 || y < 0 || x >= w || y >= h || mask[y * w + x] < 0.5) continue;
      n++;
      const o = (y * w + x) * 4, r = pixels[o], g = pixels[o + 1], bl = pixels[o + 2], lum = 0.299 * r + 0.587 * g + 0.114 * bl;
      if (r >= g && g >= bl - 4 && r - bl > 12 && lum > 35 && lum < 245) skin.push([r, g, bl, lum]);
    }
  }
  if (n < 200 || skin.length < n * 0.6) return null;
  skin.sort((p, q) => p[3] - q[3]);
  const mid = skin.slice(Math.floor(skin.length * 0.35), Math.ceil(skin.length * 0.8));
  return '#' + [0, 1, 2].map((k) => Math.round(mid.reduce((s, c) => s + c[k], 0) / mid.length).toString(16).padStart(2, '0')).join('');
}
