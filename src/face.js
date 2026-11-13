// "My face" in the browser: MediaPipe's face landmarker finds the face in a selfie on the device
// (the model loads on first use from vision/ and is cached for offline use), then face-fit.js
// works out the texture and where each head vertex takes its colour from.
import { faceCrop, detailTexture, IRIS, FACE_OVAL } from './face-fit.js';
import { nearestTone, toneColour } from './skin-tone.js';

let ready = null;
const base = () => (import.meta.env && import.meta.env.BASE_URL) || '/';
export function loadFaceFinder() {
  if (!ready) {
    ready = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(new URL(base() + 'vision', location.href).href);
      return FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL(base() + 'vision/face_landmarker.task', location.href).href, delegate: 'CPU' },
        runningMode: 'IMAGE', numFaces: 1, minFaceDetectionConfidence: 0.4,
      });
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}

// The 478 landmarks in a picture (x, y in 0..1), or null.
export async function findFace(source) {
  const finder = await loadFaceFinder();
  const res = finder.detect(source);
  return (res.faceLandmarks && res.faceLandmarks[0]) || null;
}

export const TEX = 512;

// From a picture: the face texture (a canvas), each landmark in texture space, and the colour of
// the irises. Throws a plain sentence when there is no usable face.
export async function readFacePhoto(source) {
  const sw = source.naturalWidth || source.videoWidth || source.width, sh = source.naturalHeight || source.videoHeight || source.height;
  if (!sw || !sh) throw new Error('That picture could not be opened.');
  const k = Math.min(1, 1600 / Math.max(sw, sh)), w = Math.round(sw * k), h = Math.round(sh * k);
  const full = document.createElement('canvas'); full.width = w; full.height = h;
  full.getContext('2d').drawImage(source, 0, 0, w, h);
  const lm = await findFace(full);
  if (!lm) throw new Error('I could not find a face in that photo. Use a clear photo of your face, looking at the camera.');
  const problems = [];
  const crop = faceCrop(lm, w, h);
  if (crop.s < 160) problems.push('Your face is small in that photo, so it will look soft. A closer photo works better.');
  // turned away: the nose sits well off the middle of the cheeks
  const L = lm[234], R = lm[454], nose = lm[1];
  const turn = (nose.x - (L.x + R.x) / 2) / Math.max(1e-3, Math.abs(R.x - L.x));
  if (Math.abs(turn) > 0.12) problems.push('Look straight at the camera for the best match.');
  return { ...makeFaceTexture(full, lm, crop), problems };
}

// Build the texture from a full picture and its landmarks (also used when a saved face reopens).
export function makeFaceTexture(full, lm, crop) {
  const w = full.width, h = full.height;
  crop = crop || faceCrop(lm, w, h);
  const c = document.createElement('canvas'); c.width = c.height = TEX;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#808080'; g.fillRect(0, 0, TEX, TEX);
  g.drawImage(full, crop.x, crop.y, crop.s, crop.s, 0, 0, TEX, TEX);
  const img = g.getImageData(0, 0, TEX, TEX);
  const uv = lm.map((p) => [(p.x * w - crop.x) / crop.s, (p.y * h - crop.y) / crop.s]);
  // the face outline as a mask, for the blur that takes the photo's light out
  const m = document.createElement('canvas'); m.width = m.height = TEX;
  const mg = m.getContext('2d', { willReadFrequently: true });
  mg.fillStyle = '#000'; mg.fillRect(0, 0, TEX, TEX); mg.fillStyle = '#fff'; mg.beginPath();
  FACE_OVAL.forEach((i, n) => { const [x, y] = uv[i]; n ? mg.lineTo(x * TEX, y * TEX) : mg.moveTo(x * TEX, y * TEX); });
  mg.closePath(); mg.fill();
  const md = mg.getImageData(0, 0, TEX, TEX).data, mask = new Float32Array(TEX * TEX);
  for (let i = 0; i < mask.length; i++) mask[i] = md[i * 4] / 255;
  const { pixels, mean } = detailTexture(img.data, mask, TEX, Math.round(TEX * 0.06));
  const tex = document.createElement('canvas'); tex.width = tex.height = TEX;
  tex.getContext('2d').putImageData(new ImageData(pixels, TEX, TEX), 0, 0);
  // iris colour: the middle of each iris, a little in from its edge
  const irisCol = [0, 0, 0]; let cnt = 0;
  for (const side of [IRIS.l, IRIS.r]) {
    const [cx, cy] = uv[side[0]], rr = Math.hypot(uv[side[1]][0] - cx, uv[side[1]][1] - cy) * TEX;
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const d = Math.hypot(dx, dy); if (d < rr * 0.35 || d > rr * 0.8) continue;
      const x = Math.round(cx * TEX + dx), y = Math.round(cy * TEX + dy); if (x < 0 || y < 0 || x >= TEX || y >= TEX) continue;
      const o = (y * TEX + x) * 4; irisCol[0] += img.data[o]; irisCol[1] += img.data[o + 1]; irisCol[2] += img.data[o + 2]; cnt++;
    }
  }
  const iris = cnt ? irisCol.map((v) => v / cnt / 255) : null;
  // a small copy of the cropped photo, to keep on this device and rebuild from
  const keep = document.createElement('canvas'); keep.width = keep.height = TEX;
  keep.getContext('2d').drawImage(c, 0, 0);
  // the skin tone: the middle of the face's pixels by brightness (brows, lips, shadows and shine
  // fall outside), matched to the nearest tone the body can take
  const px = [];
  for (let i = 0; i < mask.length; i += 3) if (mask[i] > 0.9) { const o = i * 4, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2]; px.push([r, g, b, 0.299 * r + 0.587 * g + 0.114 * b]); }
  let tone = null;
  if (px.length > 200) {
    px.sort((a, b) => a[3] - b[3]);
    const mid = px.slice(Math.floor(px.length * 0.35), Math.ceil(px.length * 0.8));
    const avg = [0, 1, 2].map((k) => mid.reduce((s, c) => s + c[k], 0) / mid.length);
    const n = nearestTone('#' + avg.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')); tone = toneColour(n.depth, n.warmth);
  }
  return { texture: tex, uv, iris, mean, tone, photo: keep, lm: lm.map((p) => [(p.x * w - crop.x) / crop.s, (p.y * h - crop.y) / crop.s]) };
}
