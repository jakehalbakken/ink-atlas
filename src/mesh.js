// Body mesh decode and shape math. Pure: no scene or app state here.
// `body.js` holds the base64 base mesh, index buffer and morph deltas.
import { BODY_BASE, BODY_IDX, DELTAS } from './body.js';

export function b64(s, Type) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Type(u.buffer);
}

// Decoded once at module load.
export const BASE = b64(BODY_BASE, Float32Array);
export const INDEX = b64(BODY_IDX, Uint16Array);

const DEL = {};
for (const k of Object.keys(DELTAS)) DEL[k] = { a: b64(DELTAS[k].d, Int16Array), s: DELTAS[k].s };

// Blend the morph targets for a figure/muscle/weight, then normalise height to 1.75.
export function shapePositions(fig, muscle, weight) {
  const out = new Float32Array(BASE);
  const add = (k, w) => { if (!w) return; const d = DEL[k], f = d.s * w, a = d.a; for (let i = 0; i < out.length; i++) out[i] += a[i] * f; };
  if (fig !== 'legacy') {
    const gm = fig === 'male' ? 1 : fig === 'female' ? 0 : 0.5; const m = muscle || 0, w = weight || 0;
    add('male', gm); add('female', 1 - gm);
    add('mMuscle', gm * m); add('fMuscle', (1 - gm) * m);
    if (w > 0) { add('mHeavy', gm * w); add('fHeavy', (1 - gm) * w); } else if (w < 0) { add('mLight', gm * -w); add('fLight', (1 - gm) * -w); }
  }
  let lo = Infinity, hi = -Infinity; for (let i = 1; i < out.length; i += 3) { if (out[i] < lo) lo = out[i]; if (out[i] > hi) hi = out[i]; }
  const k = 1.75 / (hi - lo); for (let i = 0; i < out.length; i += 3) { out[i] *= k; out[i + 1] = (out[i + 1] - lo) * k; out[i + 2] *= k; }
  return out;
}
