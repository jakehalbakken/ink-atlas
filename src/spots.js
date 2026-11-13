// Quick spots: the usual tattoo placements, to try a piece on one spot after another. Each spot
// is a point along a bone of the body's own skeleton (so it follows every body shape), and a
// direction to look at the skin from. The ink goes where a ray from that direction meets the
// skin, turned to run along the limb.
//
// dir: 'front' (+z), 'back' (-z), 'out' (away from the middle), 'in' (towards it). side: which
// side of the body the spot is on is chosen by the user; 'mid' spots sit on the centre line.

export const SPOTS = [
  { id: 'forearm-front', label: 'Forearm, front', bone: 'lowerarm01', at: 0.75, dir: 'front' },
  { id: 'forearm-back', label: 'Forearm, back', bone: 'lowerarm01', at: 0.75, dir: 'back' },
  { id: 'upperarm-out', label: 'Upper arm, outside', bone: 'upperarm02', at: 0.45, dir: 'out' },
  { id: 'upperarm-front', label: 'Upper arm, front', bone: 'upperarm02', at: 0.45, dir: 'front' },
  { id: 'shoulder', label: 'Shoulder', bone: 'upperarm01', at: 0.35, dir: 'out' },
  { id: 'wrist', label: 'Wrist', bone: 'lowerarm02', at: 0.85, dir: 'front' },
  { id: 'chest', label: 'Chest', bone: 'clavicle', at: 0.55, dir: 'front', drop: 0.09 },
  { id: 'ribs', label: 'Ribs', bone: 'spine03', at: 0.2, dir: 'out', fwd: 0.07 },
  { id: 'hip', label: 'Hip', bone: 'pelvis', at: 1, dir: 'out' },
  { id: 'shoulder-blade', label: 'Shoulder blade', bone: 'clavicle', at: 0.7, dir: 'back', drop: 0.12 },
  { id: 'thigh-front', label: 'Thigh, front', bone: 'upperleg02', at: 0.2, dir: 'front' },
  { id: 'thigh-out', label: 'Thigh, outside', bone: 'upperleg02', at: 0.2, dir: 'out' },
  { id: 'calf', label: 'Calf', bone: 'lowerleg01', at: 0.65, dir: 'back' },
  { id: 'shin', label: 'Shin', bone: 'lowerleg01', at: 0.65, dir: 'front' },
  { id: 'ankle', label: 'Ankle', bone: 'lowerleg02', at: 0.9, dir: 'out' },
  { id: 'sternum', label: 'Sternum', bone: 'spine03', at: 0.5, dir: 'front', mid: true },
  { id: 'stomach', label: 'Stomach', bone: 'spine04', at: 0.85, dir: 'front', mid: true },
  { id: 'upper-back', label: 'Upper back', bone: 'spine02', at: 0.5, dir: 'back', mid: true },
  { id: 'lower-back', label: 'Lower back', bone: 'spine05', at: 0.6, dir: 'back', mid: true },
  { id: 'nape', label: 'Back of neck', bone: 'neck01', at: 0.5, dir: 'back', mid: true },
];

// side: 'L' or 'R' (the body's own left is +x). bones: [{name, head, tail}] with joints a flat
// array of xyz. Returns { point, dir, along } as plain arrays: the bone point (pushed sideways
// for a side spot on a middle bone), the direction to look from, and the limb's direction
// pointing up the body (towards the head), or null for an unknown bone.
export function spotAim(spot, side, bones, joints) {
  const name = spot.mid || /^spine|^neck/.test(spot.bone) ? spot.bone : `${spot.bone}.${side}`;
  const b = bones.find((x) => x.name === name); if (!b) return null;
  const h = [0, 1, 2].map((i) => joints[b.head * 3 + i]), t = [0, 1, 2].map((i) => joints[b.tail * 3 + i]);
  const p = h.map((v, i) => v + (t[i] - v) * spot.at);
  const sx = spot.mid ? 0 : side === 'L' ? 1 : -1;
  if (spot.mid) p[0] = 0;
  if (spot.drop) p[1] -= spot.drop;
  if (spot.fwd) p[2] += spot.fwd;
  // up the body: from tail to head, or straight up when the bone runs across
  let along = h.map((v, i) => v - t[i]); if (along[1] < 0) along = along.map((v) => -v);
  const al = Math.hypot(...along); along = al > 1e-9 ? along.map((v) => v / al) : [0, 1, 0];
  if (Math.abs(along[1]) < 0.2) along = [0, 1, 0];
  let dir;
  if (spot.dir === 'front') dir = [0, 0, 1];
  else if (spot.dir === 'back') dir = [0, 0, -1];
  else {
    // sideways, square to the limb so a slanting arm is seen straight on
    const out = [sx || 1, 0, 0], d = out[0] * along[0];
    dir = [out[0] - d * along[0], -d * along[1], -d * along[2]];
    if (spot.dir === 'in') dir = dir.map((v) => -v);
    const n = Math.hypot(...dir); dir = dir.map((v) => v / n);
  }
  // a sideways spot on a middle bone (ribs, hip) is moved out to that side before looking
  if (!spot.mid && /^spine|^neck/.test(spot.bone)) p[0] = 0;
  return { point: p, dir, along };
}

// The turn (radians) that sets a tattoo's up along `along`, for a tattoo whose frame up with
// no turn is `up0` on a skin with normal n. All plain [x,y,z].
export function turnAlong(up0, along, n) {
  const dn = along[0] * n[0] + along[1] * n[1] + along[2] * n[2];
  const a = along.map((v, i) => v - dn * n[i]), al = Math.hypot(...a);
  if (al < 1e-6) return 0;
  const c = up0[0] * a[0] + up0[1] * a[1] + up0[2] * a[2];
  const x = [up0[1] * a[2] - up0[2] * a[1], up0[2] * a[0] - up0[0] * a[2], up0[0] * a[1] - up0[1] * a[0]];
  return Math.atan2(x[0] * n[0] + x[1] * n[1] + x[2] * n[2], c);
}
