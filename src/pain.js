// Pain map: how much a tattoo usually hurts on each part of the body, from the ratings that
// common tattoo pain charts agree on (bony, thin-skinned and nerve-rich places hurt most:
// ribs, sternum, spine, knees, elbows, hands, feet, armpits, groin; fleshy places least:
// outer arm, outer thigh, calf, buttock). Everyone feels it differently, so this is a
// guide for planning, not a promise.
//
// Each vertex gets its place from the bone that moves it most (the body's own rig, so it
// follows every shape), which way its skin faces, and how near it is to a joint. Pure maths.

// level 1..10 and the place's plain name
const P = (level, place) => ({ level, place });
const FACE = /^(head|jaw|levator|oris|temporalis|oculi|orbicularis|risorius|special0[1-4]|tongue|eye)/;

// bone: the rig bone's name; face: 'front' | 'back' | 'out' | 'in'; centre: on the body's
// middle line; near: distances (body units, 1.75 tall) to the joints that hurt; down: the
// skin faces the floor (under the arm).
export function painFor(bone, face, centre, near, down = false) {
  const b = bone.replace(/\.[LR]$/, '');
  if (bone === 'genital') return P(9, 'Groin');
  if (FACE.test(b) || b === 'special05' || b === 'special06') return face === 'front' ? P(8, 'Face') : P(7, 'Head');
  if (/^neck/.test(b)) return face === 'front' ? P(8, 'Throat') : face === 'back' ? P(5, 'Back of neck') : P(7, 'Side of neck');
  if (/^finger|^metacarpal/.test(b)) return P(8, 'Fingers');
  if (b === 'wrist') return P(8, 'Hand');
  if (/^toe|^foot/.test(b)) return P(8, 'Foot');
  if (down && near.shoulder < 0.1) return P(9, 'Armpit');
  if (near.ankle < 0.05) return P(8, 'Ankle');
  if (near.knee < 0.065) return face === 'back' ? P(9, 'Back of knee') : P(9, 'Knee');
  if (near.elbow < 0.05) return face === 'front' || face === 'in' ? P(8, 'Inner elbow') : P(8, 'Elbow');
  if (near.wrist < 0.04) return P(7, 'Wrist');
  if (b === 'shoulder01') return P(4, 'Shoulder');
  if (b === 'upperarm01') return face === 'in' ? P(9, 'Armpit') : P(4, 'Shoulder');
  if (b === 'upperarm02') return face === 'out' ? P(3, 'Upper arm, outside') : face === 'back' ? P(4, 'Back of arm') : face === 'in' ? P(6, 'Inner arm') : P(4, 'Bicep');
  if (/^lowerarm/.test(b)) return face === 'out' || face === 'back' ? P(3, 'Forearm, outside') : P(4, 'Forearm, inside');
  if (b === 'clavicle') return face === 'front' ? P(7, 'Collarbone') : face === 'back' ? P(4, 'Upper back') : P(4, 'Shoulder');
  if (b === 'breast') return P(6, 'Chest');
  if (b === 'spine01' || b === 'spine02' || b === 'spine03') {
    if (face === 'front') return centre ? P(8, 'Sternum') : P(6, 'Chest');
    if (face === 'back') return centre ? P(7, 'Spine') : P(4, 'Upper back');
    return b === 'spine03' ? P(9, 'Ribs') : P(8, 'Ribs');
  }
  if (b === 'spine04') return face === 'front' ? P(6, 'Stomach') : face === 'back' ? (centre ? P(7, 'Spine') : P(5, 'Lower back')) : P(8, 'Ribs');
  if (b === 'spine05' || b === 'root') return face === 'front' ? P(6, 'Stomach') : face === 'back' ? (centre ? P(7, 'Spine') : P(5, 'Lower back')) : P(7, 'Hip');
  if (b === 'pelvis') return face === 'back' ? P(3, 'Buttock') : face === 'in' || (face === 'front' && centre) ? P(9, 'Groin') : P(7, 'Hip');
  if (/^upperleg/.test(b)) return face === 'out' ? P(3, 'Thigh, outside') : face === 'in' ? P(7, 'Inner thigh') : face === 'back' ? P(4, 'Back of thigh') : P(4, 'Thigh, front');
  if (/^lowerleg/.test(b)) return face === 'back' ? P(3, 'Calf') : face === 'front' ? P(7, 'Shin') : face === 'out' ? P(4, 'Calf, outside') : P(6, 'Shin, inside');
  return P(5, 'Body');
}

// Which way a skin normal faces: front and back first, then out or in by the body's side.
export function facing(n, x) {
  if (n[2] > 0.45) return 'front';
  if (n[2] < -0.45) return 'back';
  const sx = x >= 0 ? 1 : -1;
  return n[0] * sx >= 0 ? 'out' : 'in';
}

// The whole body. pos, nor: flat xyz arrays (standing); count: vertices to rate; boneOf(v):
// the name of the bone that moves vertex v most; joints: { knee: [[xyz], [xyz]], ... } both
// sides; skip(v): true for eyes. Returns { level: Float32Array, place: string[] (one per
// vertex, the shared names) }.
export function painMap({ pos, nor, count, boneOf, joints, skip = () => false }) {
  const level = new Float32Array(count), place = new Array(count);
  const near = {}, names = Object.keys(joints);
  for (let v = 0; v < count; v++) {
    if (skip(v)) { level[v] = 0; place[v] = ''; continue; }
    const o = v * 3, x = pos[o], y = pos[o + 1], z = pos[o + 2];
    for (const k of names) { let d = Infinity; for (const j of joints[k]) d = Math.min(d, Math.hypot(x - j[0], y - j[1], z - j[2])); near[k] = d; }
    const r = painFor(boneOf(v), facing([nor[o], nor[o + 1], nor[o + 2]], x), Math.abs(x) < 0.028, near, nor[o + 1] < -0.5);
    level[v] = r.level; place[v] = r.place;
  }
  return { level, place };
}

// Soften the edges between places: a few passes of averaging with the neighbours.
export function smoothLevels(level, nb, passes = 3, skip = () => false) {
  let a = Float32Array.from(level);
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(a.length);
    for (let v = 0; v < a.length; v++) {
      if (skip(v) || !nb[v] || !nb[v].length) { b[v] = a[v]; continue; }
      let s = a[v] * 2, c = 2; for (const u of nb[v]) { if (skip(u)) continue; s += a[u]; c++; }
      b[v] = s / c;
    }
    a = b;
  }
  return a;
}

// green (low) through amber to red (very high), linear 0..1 rgb
const STOPS = [[1, [0.16, 0.74, 0.44]], [4, [0.62, 0.84, 0.30]], [6, [0.99, 0.80, 0.22]], [10, [0.90, 0.20, 0.18]]];
export function painColour(level) {
  const l = Math.max(1, Math.min(10, level));
  for (let i = 1; i < STOPS.length; i++) {
    const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
    if (l <= b) { const t = (l - a) / (b - a); return ca.map((c, k) => c + (cb[k] - c) * t); }
  }
  return STOPS[STOPS.length - 1][1];
}

export function painWords(level) { return level < 3.5 ? 'low' : level < 6.5 ? 'moderate' : level < 8 ? 'high' : 'very high'; }

// One sentence for a spot: "Ribs: very high, about 9 out of 10."
export function painLine(level, place) { return `${place}: ${painWords(level)}, about ${Math.round(level)} out of 10.`; }

// Each vertex's neighbours along the triangles' edges.
export function vertexNeighbours(index, count) {
  const sets = Array.from({ length: count }, () => new Set());
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (a >= count || b >= count || c >= count) continue;
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b);
  }
  return sets.map((s) => [...s]);
}

// Over a tattoo: the skin within `radius` of its centre. Returns the usual level there, the
// place most of it sits on, and the worst part with its place, or null when no skin is near.
export function painUnder({ pos, count, level, place, centre, radius }) {
  let s = 0, c = 0, max = -1, maxPlace = '', near = -1, nd = Infinity; const tally = new Map();
  const r2 = radius * radius;
  for (let v = 0; v < count; v++) {
    if (!place[v]) continue;
    const o = v * 3, dx = pos[o] - centre[0], dy = pos[o + 1] - centre[1], dz = pos[o + 2] - centre[2], d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < nd) { nd = d2; near = v; }
    if (d2 > r2) continue;
    s += level[v]; c++; tally.set(place[v], (tally.get(place[v]) || 0) + 1);
    if (level[v] > max) { max = level[v]; maxPlace = place[v]; }
  }
  if (!c) { if (near < 0) return null; return { level: level[near], place: place[near], max: level[near], maxPlace: place[near] }; }
  let top = '', tn = -1; for (const [k, n] of tally) if (n > tn) { tn = n; top = k; }
  return { level: s / c, place: top, max, maxPlace };
}
