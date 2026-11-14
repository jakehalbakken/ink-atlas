// A beard painted on the skin: for every vertex, how far it sits inside the beard (in body units,
// positive = under beard). Worked out from the face points stored on the head (FACE_MAP), so it
// follows every shape, like the hairline in hair.js. The skin shader turns it into a soft,
// slightly ragged edge; a full beard adds strands on top (hair-strands.js, buildBeard).
//
// The beard joins the sideburns at the middle of the ear, runs down the cheek in a gentle line to
// just above the corners of the mouth, takes in the moustache under the nose and the chin, and
// ends on the neck a few centimetres under the jaw. The lips stay bare.

export const BEARD_STYLES = ['none', 'stubble', 'short', 'full'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// positions: rest positions; n: vertices to fill; lm: landmarks3D; bodyCount: vertices of the body
// proper. Returns a Float32Array of n values,
// clamped to +-0.02.
export function beardField(positions, n, lm, bodyCount) {
  const out = new Float32Array(n).fill(-0.02);
  const F = lm[10], C = lm[152], Er = lm[234], El = lm[454];
  const h = Math.max(1e-3, F[1] - C[1]);
  const half = (Math.abs(Er[0]) + Math.abs(El[0])) / 2;
  const earY = (Er[1] + El[1]) / 2, tragusZ = (Er[2] + El[2]) / 2, earZ = tragusZ - 0.21 * h;
  const burnY = earY - 0.05 * h; // where the sideburns end (as in hair.js)
  const mw = (Math.abs(lm[61][0]) + Math.abs(lm[291][0])) / 2, mouthY = (lm[61][1] + lm[291][1]) / 2;
  const stacheY = lm[2][1] - 0.014 * h; // just under the nose
  const cornerY = mouthY + 0.1 * h; // where the cheek line meets the moustache, beside the mouth
  // the top of the beard across the face: the moustache, round the corners of the mouth, then up
  // the cheek to the sideburn
  const topY = (ax) => {
    if (ax < mw * 0.95) return stacheY;
    if (ax < mw * 1.4) return lerp(stacheY, cornerY, smooth(mw * 0.95, mw * 1.4, ax));
    const t = clamp((ax - mw * 1.4) / (half * 0.97 - mw * 1.4), 0, 1);
    return lerp(cornerY, burnY, Math.pow(t, 0.8));
  };
  // how far back it reaches: in front of the ear up high, to below the ear lower down
  const backZ = (y) => lerp(tragusZ - 0.05 * h, earZ + 0.09 * h, smooth(earY - 0.1 * h, earY - 0.3 * h, y));
  // the neckline: a few centimetres under the chin at the front, rising to below the ears
  // (lowest in the middle, curving up at the sides)
  const neckFrontZ = C[2] - 0.25 * h;
  const neckY = (x, z) => lerp(earY - 0.26 * h, C[1] - 0.2 * h + 0.12 * h * smooth(0, half * 0.75, Math.abs(x)) ** 2, smooth(earZ + 0.06 * h, neckFrontZ, z));
  // the lips: an oval from the top of the upper lip to the bottom of the lower one; the moustache
  // reaches just over the top of it
  const lipTop = lm[0][1], lipLow = lm[17][1] - 0.001;
  const lipDepth = (ax, y) => {
    if (ax >= mw * 1.02) return -1;
    const k = Math.sqrt(Math.max(0, 1 - (ax / (mw * 1.02)) ** 2));
    return Math.min(mouthY + (lipTop - mouthY) * k - y, y - (mouthY - (mouthY - lipLow) * k), mw * 1.02 - ax);
  };
  const yLo = C[1] - 0.4 * h, yHi = burnY + 0.02 * h, reach = half * 1.1;
  for (let v = 0; v < Math.min(n, bodyCount); v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    if (y < yLo || y > yHi || Math.abs(x) > reach || z < earZ - 0.05 * h) continue;
    let s = Math.min(topY(Math.abs(x)) - y, y - neckY(x, z), (z - backZ(y)) * 0.7);
    const inLip = lipDepth(Math.abs(x), y);
    if (inLip > 0 && z > C[2] - 0.02 * h) s = Math.min(s, -inLip * 1.5); // the lips stay bare
    out[v] = clamp(s, -0.02, 0.02);
  }
  return out;
}
