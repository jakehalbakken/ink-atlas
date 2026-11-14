// Open skin: how much room is left on the body, and where a tattoo of a given size still fits.
//
// Every vertex gets its clearance: the distance along the skin (over the mesh's own edges, so
// it never jumps from an arm to the ribs) to the nearest ink or to skin that is not used for
// tattoos here (face, scalp, fingers, groin). A piece fits where its own reach plus a small
// margin is under the clearance. Pure maths; the app supplies positions and places.

// Places that count as off limits for planning (they still hold ink if you put it there).
export const OFF_LIMITS = new Set(['Face', 'Head', 'Fingers', 'Groin', '']);

// The broad parts named in the summary.
export function regionOf(place) {
  if (/back|Spine|Buttock/i.test(place) && !/Back of (arm|knee|neck|thigh)/.test(place)) return place === 'Buttock' ? 'Buttocks' : 'Back';
  if (/^Thigh|Inner thigh|Back of thigh|Hip/.test(place)) return place === 'Hip' ? 'Hips' : 'Thighs';
  if (/Calf|Shin|Back of knee|Knee|Ankle/.test(place)) return place === 'Knee' || place === 'Back of knee' ? 'Knees' : place === 'Ankle' ? 'Ankles' : 'Lower legs';
  if (/Forearm|Wrist|elbow|Elbow/.test(place)) return 'Forearms';
  if (/Upper arm|Bicep|Back of arm|Inner arm|Armpit/.test(place)) return place === 'Armpit' ? 'Armpits' : 'Upper arms';
  if (/Shoulder/.test(place)) return 'Shoulders';
  if (/Chest|Sternum|Collarbone/.test(place)) return 'Chest';
  if (/Stomach/.test(place)) return 'Stomach';
  if (/Ribs/.test(place)) return 'Ribs';
  if (/neck|Throat/.test(place)) return 'Neck';
  if (/Hand/.test(place)) return 'Hands';
  if (/Foot/.test(place)) return 'Feet';
  return 'Other';
}

// A small binary heap of [distance, vertex].
function heap() {
  const d = [], v = [];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (d[p] <= d[i]) break; [d[p], d[i]] = [d[i], d[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } };
  const down = (i) => { for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < d.length && d[l] < d[m]) m = l; if (r < d.length && d[r] < d[m]) m = r; if (m === i) break; [d[m], d[i]] = [d[i], d[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } };
  return {
    push(dist, vert) { d.push(dist); v.push(vert); up(d.length - 1); },
    pop() { const out = [d[0], v[0]], ld = d.pop(), lv = v.pop(); if (d.length) { d[0] = ld; v[0] = lv; down(0); } return out; },
    get size() { return d.length; },
  };
}

// Distance along the skin from the seeds. pos: flat xyz; nb: neighbours per vertex; seeds: Map
// vertex -> starting distance. Returns Float64Array (Infinity where no seed reaches).
export function clearance(pos, nb, seeds) {
  // doubles, so a popped distance compares exactly with the one stored
  const n = nb.length, dist = new Float64Array(n).fill(Infinity), h = heap();
  for (const [v, d0] of seeds) if (d0 < dist[v]) { dist[v] = d0; h.push(d0, v); }
  while (h.size) {
    const [d, v] = h.pop(); if (d > dist[v]) continue;
    const o = v * 3;
    for (const u of nb[v]) {
      const q = u * 3, nd = d + Math.hypot(pos[o] - pos[q], pos[o + 1] - pos[q + 1], pos[o + 2] - pos[q + 2]);
      if (nd < dist[u]) { dist[u] = nd; h.push(nd, u); }
    }
  }
  return dist;
}

// Seeds from ink points (flat xyz): each point starts its nearest vertex at the gap between
// them. A grid of vertices keeps it quick. Off-limits vertices start at 0.
export function inkSeeds(pos, count, points, offLimits, cell = 0.03) {
  const seeds = new Map(), grid = new Map(), key = (x, y, z) => x * 73856093 ^ y * 19349663 ^ z * 83492791;
  for (let v = 0; v < count; v++) {
    if (offLimits(v)) { seeds.set(v, 0); continue; }
    const o = v * 3, k = key(Math.floor(pos[o] / cell), Math.floor(pos[o + 1] / cell), Math.floor(pos[o + 2] / cell));
    let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(v);
  }
  for (const pts of points) {
    if (!pts) continue;
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i], y = pts[i + 1], z = pts[i + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      let best = -1, bd = Infinity;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const a = grid.get(key(cx + dx, cy + dy, cz + dz)); if (!a) continue;
        for (const v of a) { const o = v * 3, dd = (pos[o] - x) ** 2 + (pos[o + 1] - y) ** 2 + (pos[o + 2] - z) ** 2; if (dd < bd) { bd = dd; best = v; } }
      }
      if (best >= 0) { const d = Math.sqrt(bd), was = seeds.get(best); if (was === undefined || d < was) seeds.set(best, d); }
    }
  }
  return seeds;
}

// The skin each vertex stands for: a third of each triangle round it.
export function vertexAreas(pos, index, count, skip = () => false) {
  const a = new Float32Array(count);
  for (let i = 0; i < index.length; i += 3) {
    const p = index[i], q = index[i + 1], r = index[i + 2];
    if (p >= count || q >= count || r >= count || skip(p) || skip(q) || skip(r)) continue;
    const ux = pos[q * 3] - pos[p * 3], uy = pos[q * 3 + 1] - pos[p * 3 + 1], uz = pos[q * 3 + 2] - pos[p * 3 + 2];
    const vx = pos[r * 3] - pos[p * 3], vy = pos[r * 3 + 1] - pos[p * 3 + 1], vz = pos[r * 3 + 2] - pos[p * 3 + 2];
    const s = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 6;
    a[p] += s; a[q] += s; a[r] += s;
  }
  return a;
}

// Half the way round the body at each vertex: how wide a piece can be and still read as one
// flat piece, not a band (on a forearm about 5 in, on the torso far more). axis(v) gives the
// line the skin wraps round there and the ring the vertex belongs to: { p: [xyz], d: [unit
// xyz], ring: key, k: optional share (the torso is flatter than a limb, so less of the way
// round still reads flat) }, or null. Each ring's mean distance from its line gives its half
// girth, so the front of a flat chest counts the same as its sides. A few passes of averaging
// with the neighbours smooth the steps between rings.
export function halfGirth({ pos, count, nb, axis, passes = 2 }) {
  const ringOf = new Array(count), sum = new Map();
  for (let v = 0; v < count; v++) {
    const a = axis(v); if (!a) continue;
    const o = v * 3, w = [pos[o] - a.p[0], pos[o + 1] - a.p[1], pos[o + 2] - a.p[2]], t = w[0] * a.d[0] + w[1] * a.d[1] + w[2] * a.d[2];
    const r = Math.hypot(w[0] - a.d[0] * t, w[1] - a.d[1] * t, w[2] - a.d[2] * t), e = sum.get(a.ring) || { s: 0, n: 0, k: a.k ?? 1 };
    e.s += r; e.n++; sum.set(a.ring, e); ringOf[v] = a.ring;
  }
  let g = new Float32Array(count);
  for (let v = 0; v < count; v++) { const e = ringOf[v] !== undefined && sum.get(ringOf[v]); g[v] = e ? Math.PI * e.k * e.s / e.n : Infinity; }
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(count);
    for (let v = 0; v < count; v++) {
      if (!Number.isFinite(g[v])) { b[v] = g[v]; continue; }
      let s = g[v] * 2, c = 2; for (const u of (nb && nb[v]) || []) if (Number.isFinite(g[u])) { s += g[u]; c++; }
      b[v] = s / c;
    }
    g = b;
  }
  return g;
}

// How wide a piece fits at each vertex: twice the clearance, capped at half the way round.
export function acrossAt(clear, cap) { return clear.map((c, v) => Math.min(c * 2, cap ? cap[v] : Infinity)); }

// The parts with the most room: for each broad part, the widest piece that fits there (body
// units), best first.
export function roomByRegion(across, place, usable) {
  const best = new Map();
  for (let v = 0; v < across.length; v++) {
    if (!usable(v) || !Number.isFinite(across[v])) continue;
    const r = regionOf(place[v]); if (r === 'Other') continue;
    if (!best.has(r) || across[v] > best.get(r)) best.set(r, across[v]);
  }
  return [...best].map(([region, a]) => ({ region, across: a })).sort((a, b) => b.across - a.across);
}

// Colour for the room at a spot (inches across that fit), sRGB 0..1: almost nothing where
// there is no room, through pale mint to deep teal for the biggest open areas.
const STOPS = [[0, [0.55, 0.52, 0.55]], [1.5, [0.80, 0.93, 0.86]], [4, [0.45, 0.85, 0.70]], [8, [0.10, 0.64, 0.62]], [14, [0.04, 0.36, 0.52]]];
export function roomColour(inchesAcross) {
  const l = Math.max(0, Math.min(14, inchesAcross));
  for (let i = 1; i < STOPS.length; i++) {
    const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
    if (l <= b) { const t = (l - a) / (b - a); return ca.map((c, k) => c + (cb[k] - c) * t); }
  }
  return STOPS[STOPS.length - 1][1];
}

// Inches (or a whole number past 10) for a reading.
export const inchWords = (inches) => (inches < 10 ? inches.toFixed(1) : String(Math.round(inches))) + ' in';

// The summary line: "About 6% of your skin has ink, and your plans add 2%. Most room: back
// (up to 16 in across), thighs (11 in), ribs (8 in)."
export function roomSummary({ inkShare, planShare, regions, toInches }) {
  const small = (s) => s > 0 && s < 0.005, pc = (s) => (small(s) ? 'under 1%' : Math.round(s * 100) + '%');
  let line = inkShare > 0 ? `${small(inkShare) ? 'Under 1%' : 'About ' + pc(inkShare)} of your skin has ink` : 'No ink on you yet';
  if (planShare > 0) line += inkShare > 0 ? `, and your plans add ${small(planShare) ? '' : 'about '}${pc(planShare)}.` : `. Your plans cover ${small(planShare) ? '' : 'about '}${pc(planShare)}.`;
  else line += '.';
  const top = regions.filter((r) => toInches(r.across) >= 1).slice(0, 3);
  if (top.length) line += ' Most room: ' + top.map((r, i) => `${r.region.toLowerCase()} (${i ? '' : 'up to '}${inchWords(toInches(r.across))}${i ? '' : ' across'})`).join(', ') + '.';
  return line;
}
