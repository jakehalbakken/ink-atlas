// The body's side of fitting a 3D scan (scan-fit.js): which vertices are the arms and legs,
// which are held smooth (fingers and toes, which no phone scan sees clearly), and the standing
// body posed the way the person stood. Pure (no DOM), so the whole fit runs in tests.
import { POSE_BONES, boneWeightSum, createRestRig, skinPose } from './pose.js';
import { stanceRotations } from './pose-catalog.js';
import { INDEX, COUNTS, shapeWithJoints } from './mesh.js';
import { fitScan, extendOffsets } from './scan-fit.js';
import { MEASURES, measureBody, matchMeasurements, unitsToInches } from './body-measure.js';
import { FIT_GROUPS, fitVisible } from './fit.js';

let PARTS = null;
export function scanParts() {
  if (PARTS) return PARTS;
  const names = POSE_BONES.map((b) => b.name), w = (re) => boneWeightSum(names.filter((x) => (typeof re === 'function' ? re(x) : re.test(x))));
  const pick = (arr) => { const out = []; for (let v = 0; v < COUNTS.body; v++) if (arr[v] > 0.6) out.push(v); return out; };
  const armL = w(/^(upperarm|lowerarm|wrist|finger|metacarpal).*\.L$/), armR = w(/^(upperarm|lowerarm|wrist|finger|metacarpal).*\.R$/);
  const legL = w(/^(upperleg|lowerleg|foot|toe).*\.L$/), legR = w(/^(upperleg|lowerleg|foot|toe).*\.R$/);
  // fingers, toes and the face (lips, eyelids, ears) are finer than a phone scan sees, so they
  // take the smooth shape of the skin round them, not each lump; Add my face does the face
  const hands = w(/^(finger|metacarpal|toe)/), head = w((x) => !/^(root|pelvis|spine|neck|clavicle|shoulder|upperarm|lowerarm|wrist|finger|metacarpal|breast|upperleg|lowerleg|foot|toe)/.test(x));
  const soft = new Float32Array(COUNTS.body);
  for (let v = 0; v < COUNTS.body; v++) soft[v] = Math.min(1, Math.max(hands[v], head[v] > 0.3 ? 1 : 0));
  PARTS = { parts: { L: pick(armL), R: pick(armR), legL: pick(legL), legR: pick(legR) }, soft };
  return PARTS;
}

// stance -> a function that poses any standing positions of this body that way
export function skinForState(state) {
  const rig = createRestRig(state);
  return (stance) => { const rot = stanceRotations(stance, rig); return (positions) => skinPose({ positions, joints: rig.joints }, rot, { noSwell: true, noContact: true, bulge: 0, noSpread: true }).positions; };
}

// Fit the body of this state to a scan. Returns fitScan's answer, its offsets on body vertices.
export function fitBodyToScan(scan, state, { turn = null, stance = null, progress } = {}) {
  const rig = createRestRig(state), { parts, soft } = scanParts();
  return fitScan({ scan, rest: rig.positions, index: INDEX, bodyCount: COUNTS.body, parts, soft, skinFor: skinForState(state), turn, stance, progress });
}

// What a tape round the scan reads. Only what the skin's own shape gives: girths and the width
// of the shoulders (lengths come from the skeleton, which the scan does not move).
export const SCAN_MEASURES = MEASURES.filter((m) => m.kind === 'round' || m.key === 'shoulders').map((m) => m.key);
const shown = (figure) => new Set(FIT_GROUPS.filter((g) => fitVisible(g.when, figure)).flatMap((g) => g.items).filter((i) => fitVisible(i.when, figure)).map((i) => i.key));

// Measurements of a body with scan offsets on it, in inches at 175 cm (scale by height after).
export function measureScanned(state, off) {
  const rig = createRestRig(state), P = new Float32Array(rig.positions);
  for (let i = 0; i < COUNTS.body * 3; i++) P[i] += off[i];
  const r = measureBody(P, rig.joints, INDEX, COUNTS.body, SCAN_MEASURES), out = {};
  for (const k of Object.keys(r)) out[k] = unitsToInches(r[k], 175);
  return out;
}

// The whole bring-in: fit the body to the scan; move the body sliders so the plain body measures
// what the scan does (so its readouts, and anything that leaves the scan off, are as near as the
// sliders go); fit again from there, keeping the turn and the stance found the first time.
// Returns { fit, off (every vertex), align, stance, quality, coverage, measures } for state's
// shape with fit in place of its own. progress(0..1) as it goes.
export function scanToBody(scan, state, { turn = null, progress = () => {} } = {}) {
  const first = fitBodyToScan(scan, state, { turn, progress: (f) => progress(f * 0.55) });
  const want = measureScanned(state, first.off), vis = shown(state.figure), targets = {};
  for (const k of Object.keys(want)) if (vis.has(k)) targets[k] = want[k];
  progress(0.6);
  const res = matchMeasurements(state.fit || {}, targets, (fit, k) => { const { positions, joints } = shapeWithJoints({ ...state, fit }); const r = measureBody(positions, joints, INDEX, COUNTS.body, [k]); return r[k] != null ? unitsToInches(r[k], 175) : null; }, { tol: 0.08, rounds: 2 });
  progress(0.72);
  const st = { ...state, fit: res.fit };
  const fit = fitBodyToScan(scan, st, { turn: first.align.R, stance: first.stance, progress: (f) => progress(0.72 + f * 0.26) });
  const rest = createRestRig(st).positions, total = rest.length / 3;
  const off = extendOffsets(fit.off, rest, COUNTS.body, total);
  return { fit: res.fit, off, align: fit.align, stance: fit.stance, quality: fit.quality, coverage: fit.coverage, measures: measureScanned(st, off) };
}
