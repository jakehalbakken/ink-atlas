// Body hair: how much hair grows on each part of the skin and which way it lies, painted in the
// skin shader (Body > Hair). Pure maths on the standing body. Forearms and lower legs most, the
// front and outside of the thighs, the middle of the chest and a line down from the navel; the
// back, shoulders and upper arms stay nearly bare. Hair lies down the limb, and down the torso.
//
// pos, nor: standing positions and normals (xyz per vertex); count: vertices to fill (the body).
// joints: { shoulderL, elbowL, wristL, hipL, kneeL, ankleL } and the same with R, each [x, y, z].
// marks: { navel, nipL, nipR }. figure: 'male', 'neutral' or 'female' (less, finer hair).
// Returns a Float32Array of count * 4: the direction the hair lies (unit xyz) and how dense it
// is (0..1).
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// distance from p to the segment a-b, how far along it (t, unclamped) and its direction, into o
function seg(p, a, b, o) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const len2 = abx * abx + aby * aby + abz * abz || 1e-9, len = Math.sqrt(len2);
  const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / len2, tc = t < 0 ? 0 : t > 1 ? 1 : t;
  o.t = t; o.d = Math.hypot(p[0] - a[0] - abx * tc, p[1] - a[1] - aby * tc, p[2] - a[2] - abz * tc);
  o.dir = [abx / len, aby / len, abz / len];
  return o;
}
export function bodyHairField({ pos, nor, count, joints, marks, figure = 'male' }) {
  const out = new Float32Array(count * 4);
  const amount = figure === 'female' ? 0.12 : figure === 'neutral' ? 0.55 : 1;
  const J = joints, chestMid = marks && marks.nipL && marks.nipR ? [(marks.nipL[0] + marks.nipR[0]) / 2, (marks.nipL[1] + marks.nipR[1]) / 2 - 0.02, (marks.nipL[2] + marks.nipR[2]) / 2] : null;
  const nipW = marks && marks.nipL && marks.nipR ? Math.abs(marks.nipL[0] - marks.nipR[0]) : 0.2;
  const navel = marks && marks.navel;
  const S0 = {}, S1 = {}, S2 = {}, S3 = {};
  for (let v = 0; v < count; v++) {
    const o = v * 3, p = [pos[o], pos[o + 1], pos[o + 2]], n = [nor[o], nor[o + 1], nor[o + 2]];
    let dens = 0, dir = [0, -1, 0];
    for (const s of ['L', 'R']) {
      const side = s === 'L' ? 1 : -1, outward = n[0] * side; // facing away from the middle
      if (p[0] * side < -0.03) continue; // the other side of the body: none of this side's limbs
      const back = -n[2];
      // forearm: elbow to wrist, more on the back and outside, thinning onto the hand
      const fa = seg(p, J['elbow' + s], J['wrist' + s], S0);
      if (fa.d < 0.075 && fa.t > -0.06 && fa.t < 1.12) {
        const sideMore = 0.7 + 0.3 * Math.max(0, Math.max(outward, back * 0.8, n[1] * 0.6));
        const k = sideMore * (0.55 + 0.45 * sm(0, 0.15, fa.t)) * (1 - 0.7 * sm(0.9, 1.1, fa.t));
        if (k > dens) { dens = k; dir = fa.dir; }
      }
      // upper arm: a little on the outside
      const ua = seg(p, J['shoulder' + s], J['elbow' + s], S1);
      if (ua.d < 0.085 && ua.t > 0.25 && ua.t < 1.05) {
        const k = 0.18 * Math.max(0, outward) * sm(0.25, 0.7, ua.t);
        if (k > dens) { dens = k; dir = ua.dir; }
      }
      // lower leg: all round, thinning at the ankle and onto the foot
      const ll = seg(p, J['knee' + s], J['ankle' + s], S2);
      if (ll.d < 0.1 && ll.t > -0.04 && ll.t < 1.1) {
        const k = 0.95 * (0.7 + 0.3 * sm(0, 0.12, ll.t)) * (1 - 0.6 * sm(0.88, 1.08, ll.t));
        if (k > dens) { dens = k; dir = ll.dir; }
      }
      // thigh: front and outside more than the inside and back, fading up to the hip
      const ul = seg(p, J['hip' + s], J['knee' + s], S3);
      if (ul.d < 0.13 && ul.t > 0.05 && ul.t < 1.04) {
        const face = Math.max(0, Math.max(n[2], outward));
        const k = (0.3 + 0.4 * face) * sm(0.12, 0.45, ul.t);
        if (k > dens) { dens = k; dir = ul.dir; }
      }
    }
    // the middle of the chest, on the front
    if (chestMid && n[2] > 0.2) {
      const dx = (p[0] - chestMid[0]) / (nipW * 0.55), dy = (p[1] - chestMid[1]) / (nipW * 0.42);
      const k = 0.75 * (1 - sm(0.35, 1, Math.hypot(dx, dy))) * sm(0.2, 0.5, n[2]);
      if (k > dens) { dens = k; dir = [0, -1, 0]; }
    }
    // a line down the middle of the stomach, fuller below the navel
    if (navel && n[2] > 0.3 && Math.abs(p[0]) < 0.05) {
      const dy = p[1] - navel[1];
      if (dy < 0.16 && dy > -0.15) {
        const below = dy < 0, wide = below ? 0.012 + 0.03 * sm(0, 0.14, -dy) : 0.008;
        const k = (below ? 0.7 * (1 - sm(0.1, 0.15, -dy)) : 0.32 * (1 - sm(0.06, 0.16, dy))) * (1 - sm(wide * 0.6, wide * 1.6, Math.abs(p[0])));
        if (k > dens) { dens = k; dir = [0, -1, 0]; }
      }
    }
    out[v * 4] = dir[0]; out[v * 4 + 1] = dir[1]; out[v * 4 + 2] = dir[2]; out[v * 4 + 3] = Math.max(0, Math.min(1, dens * amount));
  }
  return out;
}
