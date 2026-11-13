// Short hair painted on the scalp: for every vertex, how far it sits above the hairline (in body
// units, positive = under hair). Worked out from the face points stored on the head (FACE_MAP), so
// the hairline follows every shape. The skin shader turns it into a crisp, slightly ragged edge.
//
// The hairline runs high over the forehead, down past the temples to sideburns at the middle of
// the ear, round each ear with a small gap, and level across the nape. Only the head takes part.

export const HAIR_STYLES = ['none', 'buzz', 'short', 'crop', 'medium'];
export const HAIR_COLOURS = { black: '#1c1714', brown: '#3b2a1f', chestnut: '#6a4128', blond: '#a8834f', grey: '#8a8580' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// positions: rest positions; n: vertices to fill; lm: landmarks3D; bodyCount: vertices of the body
// proper (eyes and the rest get none). Returns a Float32Array of n values, clamped to +-0.02.
export function hairField(positions, n, lm, bodyCount) {
  const out = new Float32Array(n).fill(-0.02);
  const F = lm[10], C = lm[152], Er = lm[234], El = lm[454];
  const h = Math.max(1e-3, F[1] - C[1]); // forehead point to chin
  const half = (Math.abs(Er[0]) + Math.abs(El[0])) / 2; // half the head's width at the ears
  const front = { z: F[2], y: F[1] + 0.17 * h }; // hairline over the middle of the forehead
  const earY = (Er[1] + El[1]) / 2, tragusZ = (Er[2] + El[2]) / 2, earZ = tragusZ - 0.21 * h;
  const nape = { z: earZ - 0.43 * h, y: earY - 0.29 * h }; // the middle of the nape
  const slope = (front.y - nape.y) / Math.max(1e-3, front.z - nape.z);
  // at the side: the temple, then a sideburn down to the middle of the ear, then behind the ear
  // down to the nape
  const templeZ = tragusZ + 0.22 * h, templeY = F[1] - 0.1 * h, burnY = earY - 0.05 * h;
  const ry = 0.21 * h, rz = 0.14 * h; // the ear, seen from the side, with a little room round it
  const yMin = nape.y - 0.05 * h, reach = half * 1.7;
  const sideLine = (z) => z > templeZ ? templeY + (z - templeZ) * 3 : z > tragusZ ? burnY + (templeY - burnY) * smooth(tragusZ, templeZ, z) : z > earZ - 0.12 * h ? burnY : nape.y;
  for (let v = 0; v < Math.min(n, bodyCount); v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    if (y < yMin || Math.abs(x) > reach) continue;
    const centre = Math.max(front.y - (front.z - z) * slope, nape.y);
    const w = smooth(0.5, 0.85, Math.abs(x) / half);
    let s = y - (centre * (1 - w) + Math.min(centre, sideLine(z)) * w);
    const side = smooth(0.62 * half, 0.85 * half, Math.abs(x));
    if (side > 0) {
      const e = Math.hypot((y - earY) / ry, (z - earZ) / rz);
      s = s * (1 - side) + Math.min(s, (e - 1) * 0.03 * h / 0.156) * side;
    }
    out[v] = clamp(s, -0.02, 0.02);
  }
  return out;
}
