// If your body changes: a tattoo grows and shrinks with the skin under it. For a few likely changes
// (slimmer, heavier, more muscle) this compares the area of the body triangles under the tattoo on
// the body as it is and on the changed body, and turns that into how much bigger or smaller the
// tattoo would be. Pure maths, no three.js.

export const BODY_CHANGES = [
  { key: 'now', label: 'Now' },
  { key: 'slim', label: 'Slimmer', weight: -0.5 },
  { key: 'heavy', label: 'Heavier', weight: 0.5 },
  { key: 'muscle', label: 'More muscle', muscle: 0.5 },
];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// The muscle and weight for a change, from the body as it is (both 0..1, 0.5 = average).
export function changedShape(base, change) {
  return { muscle: clamp01((base.muscle ?? 0.5) + (change.muscle || 0)), weight: clamp01((base.weight ?? 0.5) + (change.weight || 0)) };
}

const area = (P, a, b, c) => {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
};

// How much longer each way the skin under a tattoo gets, from positions A to positions B, over the
// body triangles `tris`: the square root of the ratio of their total areas. 1 = no change.
export function skinGrowth(A, B, I, tris) {
  let a = 0, b = 0;
  for (const t of new Set(tris)) { const i = I[t * 3], j = I[t * 3 + 1], k = I[t * 3 + 2]; a += area(A, i, j, k); b += area(B, i, j, k); }
  return a > 1e-12 ? Math.sqrt(b / a) : 1;
}

// A change as a short plain phrase: "4% bigger", "3% smaller", or "about the same".
export function growthWords(g) {
  const p = Math.round((g - 1) * 100);
  if (Math.abs(p) < 2) return 'about the same';
  return p > 0 ? `${p}% bigger` : `${-p}% smaller`;
}

// One line on what matters most, from [{ key, label, growth }] (the changes, not Now). Each change is as far as the Weight or Muscle slider goes from an average body.
export function changeLine(results) {
  const by = Object.fromEntries(results.map((r) => [r.key, r.growth]));
  const parts = [];
  if (by.heavy != null) parts.push(`${growthWords(by.heavy)} if you gain weight`);
  if (by.slim != null) parts.push(`${growthWords(by.slim)} if you lose some`);
  if (by.muscle != null) parts.push(`${growthWords(by.muscle)} with more muscle`);
  if (!parts.length) return '';
  const most = Math.max(...results.map((r) => Math.abs(r.growth - 1)));
  const tail = most < 0.04 ? ' This spot keeps its shape well.' : most > 0.1 ? ' This spot changes a lot, so leave room round fine detail.' : '';
  return `It grows and shrinks with the skin: ${parts.join(', ')}.${tail}`;
}
