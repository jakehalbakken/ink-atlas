// Even placement: a piece near the middle of the body says how far off the centre line it sits
// (Centre it moves it on), and a mirrored twin from Copy to other side says how far it is from
// matching its pair (Match the other side moves it to the mirror spot, size and turn). Distances
// are on the standing body, x across (the body's own left is +x). Pure maths.

// t: the tattoo; all: every tattoo; toCm: centimetres per unit. Returns null when neither applies.
export function evenness(t, all, toCm) {
  if (!t || t.hidden) return null;
  const xCm = Math.abs(t.pos[0]) * toCm, halfCm = t.width / 2 * toCm;
  // a twin: the same artwork, on the other side, far enough out to be its own piece
  const twin = t.artworkId && xCm > Math.max(2, halfCm * 0.6) ? all.find((q) => q.id !== t.id && !q.hidden && q.artworkId === t.artworkId && Math.sign(q.pos[0]) === -Math.sign(t.pos[0]) && Math.abs(q.pos[0]) * toCm > 2) : null;
  if (twin) {
    const up = (t.pos[1] - twin.pos[1]) * toCm, out = xCm - Math.abs(twin.pos[0]) * toCm, depth = (t.pos[2] - twin.pos[2]) * toCm;
    const size = (t.width - twin.width) * toCm, turn = angleGap(t.rot || 0, -(twin.rot || 0));
    const even = Math.hypot(up, out, depth) < 0.3 && Math.abs(size) < 0.2 && turn < 3;
    return { kind: 'twin', twinId: twin.id, twinName: twin.name, upCm: up, outCm: out, sizeCm: size, turnDeg: turn, even };
  }
  // near the middle: within about 4 cm of the centre line, or straddling it
  if (xCm < Math.max(4, halfCm * 0.5)) return { kind: 'centre', offCm: xCm, side: t.pos[0] >= 0 ? 'left' : 'right', even: xCm < 0.25 };
  return null;
}

function angleGap(a, b) { let d = Math.abs(((a - b) * 180 / Math.PI) % 360); if (d > 180) d = 360 - d; return d; }
const len = (cm) => { const i = Math.abs(cm) / 2.54; return i < 0.95 ? `${(Math.round(i * 10) / 10).toFixed(1)} in` : `${i < 10 ? i.toFixed(1) : Math.round(i)} in`; };

// the line under Where it sits
export function evennessText(e) {
  if (!e) return '';
  if (e.kind === 'centre') return e.even ? 'On the centre line.' : `${len(e.offCm)} ${e.side} of the centre line.`;
  if (e.even) return `Matches ${e.twinName} on the other side.`;
  const bits = [];
  if (Math.abs(e.upCm) >= 0.3) bits.push(`${len(e.upCm)} ${e.upCm > 0 ? 'higher' : 'lower'}`);
  if (Math.abs(e.outCm) >= 0.3) bits.push(`${len(e.outCm)} ${e.outCm > 0 ? 'further out' : 'further in'}`);
  if (Math.abs(e.sizeCm) >= 0.2) bits.push(`${len(e.sizeCm)} ${e.sizeCm > 0 ? 'wider' : 'narrower'}`);
  if (e.turnDeg >= 3) bits.push(`turned ${Math.round(e.turnDeg)}° differently`);
  if (!bits.length) return `Almost matches ${e.twinName} on the other side.`;
  const list = bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits.at(-1) : bits[0];
  return `${list[0].toUpperCase()}${list.slice(1)} than ${e.twinName} on the other side.`;
}

// Straight along the body: the line of the limb under a tattoo (upper arm, forearm, thigh, shin)
// or straight up on the torso. p: the tattoo's centre; joints: the rest rig; bones: POSE_BONES.
export function limbLine(p, bones, joints) {
  const at = (name) => { const b = bones.find((x) => x.name === name); return b ? [joints[b.head * 3], joints[b.head * 3 + 1], joints[b.head * 3 + 2]] : null; };
  const segs = [];
  for (const s of ['L', 'R']) {
    segs.push(['upper arm', at('upperarm01.' + s), at('lowerarm01.' + s)], ['forearm', at('lowerarm01.' + s), at('wrist.' + s)], ['thigh', at('upperleg01.' + s), at('lowerleg01.' + s)], ['shin', at('lowerleg01.' + s), at('foot.' + s)]);
  }
  const hipL = at('upperleg01.L'), hipR = at('upperleg01.R'), neck = at('neck01');
  if (hipL && hipR && neck) segs.push(['body', [0, (hipL[1] + hipR[1]) / 2, (hipL[2] + hipR[2]) / 2], [0, neck[1], neck[2]]]);
  let best = null, bd = Infinity;
  for (const [name, a, b] of segs) {
    if (!a || !b) continue;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
    const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2));
    // the torso is wide: count distance across it at half
    const q = [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k], dist = Math.hypot((p[0] - q[0]) * (name === 'body' ? 0.5 : 1), p[1] - q[1], p[2] - q[2]);
    if (dist < bd) { bd = dist; let al = d.map((v) => v / Math.sqrt(l2)); if (al[1] < 0) al = al.map((v) => -v); best = { name, along: name === 'body' ? [0, 1, 0] : al }; }
  }
  return best;
}

// the nearest straight turn to the one it has (upright or upside down), and how far off it is
export function straighten(rot, target) {
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const a = wrap(target), b = wrap(target + Math.PI), da = Math.abs(wrap(rot - a)), db = Math.abs(wrap(rot - b));
  return da <= db ? { rot: a, offDeg: da * 180 / Math.PI } : { rot: b, offDeg: db * 180 / Math.PI };
}
