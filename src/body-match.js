// Runs the photo side of "Match a photo of me" in the browser: MediaPipe's pose landmarker
// finds the person and their joints, then the maths in body-photo.js measures and fits. The
// model loads on first use from vision/ and is cached for offline use.
import { shapePositions, COUNTS } from './mesh.js';
import { createRestRig, POSE_BONES, boneWeightSum } from './pose.js';
import { measurePhoto, measureBody, fitBody, KEYS } from './body-photo.js';

// The landmarker puts its shoulder and hip points a little differently from the body's own
// joints, and the outline of a photo is a little wider than the 3D mesh. These factors were
// measured by photographing the 3D body itself at several shapes and reading it back
// (tools/tests/t58-body-photo.mjs prints them), so a photo of the 3D body fits back to itself.
export const CALIBRATION = { shoulders: 1.075, chest: 1.0, waist: 1.02, hips: 1.01, thigh: 1.01, torso: 0.98, legs: 1.08 };

let ready = null;
const base = () => (import.meta.env && import.meta.env.BASE_URL) || '/';
export function loadPoseFinder() {
  if (!ready) {
    ready = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(new URL(base() + 'vision', location.href).href);
      return PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL(base() + 'vision/pose_landmarker_full.task', location.href).href, delegate: 'CPU' },
        runningMode: 'IMAGE', numPoses: 1, outputSegmentationMasks: true, minPoseDetectionConfidence: 0.4,
      });
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}

// source: an image or canvas. Returns { lm, mask, w, h, canvas, ratios, problems } or throws a
// plain sentence when no one is found.
export async function readBodyPhoto(source) {
  const sw = source.naturalWidth || source.videoWidth || source.width, sh = source.naturalHeight || source.videoHeight || source.height;
  if (!sw || !sh) throw new Error('That picture could not be opened.');
  const k = Math.min(1, 1280 / Math.max(sw, sh)), w = Math.round(sw * k), h = Math.round(sh * k);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(source, 0, 0, w, h);
  const finder = await loadPoseFinder();
  const res = finder.detect(canvas);
  const lm = res.landmarks && res.landmarks[0];
  const m = res.segmentationMasks && res.segmentationMasks[0];
  if (!lm || !m) { if (m) m.close(); throw new Error('I could not find a person in that photo. Use a full-length photo, facing the camera.'); }
  let mask = m.getAsFloat32Array(); const mw = m.width, mh = m.height;
  mask = new Float32Array(mask); m.close();
  if (mw !== w || mh !== h) { const out = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = mask[Math.min(mh - 1, Math.floor(y * mh / h)) * mw + Math.min(mw - 1, Math.floor(x * mw / w))]; mask = out; }
  const { ratios, problems } = measurePhoto(lm, mask, w, h);
  return { lm, mask, w, h, canvas, ratios, problems };
}

let parts = null;
export function bodyMeasure(params) {
  if (!parts) {
    const arm = POSE_BONES.map((b) => b.name).filter((n) => /^(upperarm|lowerarm|wrist|finger|metacarpal)/.test(n));
    parts = { arm: boneWeightSum(arm), legL: boneWeightSum(['upperleg01.L', 'upperleg02.L']) };
  }
  return measureBody(shapePositions(params), createRestRig(params).joints, POSE_BONES, parts, COUNTS.body);
}

// The body settings that match the photo, starting from the current ones.
export function fitToPhoto(ratios, start) {
  const target = {}; for (const k of KEYS) target[k] = ratios[k] * CALIBRATION[k];
  return fitBody(target, start, bodyMeasure);
}
