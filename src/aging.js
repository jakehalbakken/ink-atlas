// How a tattoo looks as it ages: ink spreads a little under the skin, so lines soften and
// thicken, the black lightens and drifts toward a slate blue-green. A rough guide for
// fine-line planning, drawn on the ink picture before it goes on the body. Only for
// looking: nothing about it is saved.

export const AGES = Object.freeze([
  { years: 0, label: 'Fresh' },
  { years: 1, label: 'Healed' },
  { years: 10, label: '10 years' },
  { years: 20, label: '20 years' },
]);

// Spread of a line edge in millimetres, how much of the ink is left, and how far it has
// drifted toward blue-green (0..1).
export function agingModel(years) {
  const y = Math.max(0, Number(years) || 0);
  if (!y) return { spreadMm: 0, density: 1, tint: 0 };
  return {
    spreadMm: 0.12 + 0.22 * Math.sqrt(y),
    density: 1 - 0.1 - 0.2 * (1 - Math.exp(-y / 12)),
    tint: Math.min(1, y / 20),
  };
}

// One pass of a box blur along rows (dx = 1) or columns, radius r, on one channel.
function boxPass(src, dst, w, h, r, horizontal) {
  const n = horizontal ? w : h, lines = horizontal ? h : w, step = horizontal ? 1 : w, span = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * w : l;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[base + Math.min(n - 1, Math.max(0, k)) * step];
    for (let i = 0; i < n; i++) {
      dst[base + i * step] = sum / span;
      sum += src[base + Math.min(n - 1, i + r + 1) * step] - src[base + Math.max(0, i - r) * step];
    }
  }
}

// rgba: the ink picture on white (rows of RGBA bytes), changed in place.
// pxPerMm: how many picture pixels make one millimetre on the body.
export function ageInk(rgba, w, h, years, pxPerMm) {
  const m = agingModel(years);
  if (!m.spreadMm || !(w > 0 && h > 0) || rgba.length !== w * h * 4) return rgba;
  // three box passes come close to a soft gaussian of the same spread
  const r = Math.max(0, Math.min(40, Math.round((m.spreadMm * pxPerMm) / 1.7)));
  const a = new Float32Array(w * h), b = new Float32Array(w * h);
  const keep = [1, 1 - 0.06 * m.tint, 1 - 0.12 * m.tint]; // red absorbed most: drifts to blue-green
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < w * h; i++) a[i] = 255 - rgba[i * 4 + c]; // darkness
    if (r > 0) for (let pass = 0; pass < 3; pass++) { boxPass(a, b, w, h, r, true); boxPass(b, a, w, h, r, false); }
    // a spread line is wider and greyer, not fainter overall: lift the thin soft edges back up
    const k = m.density * keep[c], lift = 1 + 1.2 * Math.min(1, m.spreadMm);
    for (let i = 0; i < w * h; i++) { const dark = 1 - Math.pow(1 - Math.min(1, a[i] / 255), lift); rgba[i * 4 + c] = Math.max(0, Math.min(255, Math.round(255 - 255 * dark * k))); }
  }
  return rgba;
}
