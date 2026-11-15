// Ink check: how a design will read on this skin at this size. Three things a tattoo artist
// looks for: colours that barely show on the skin tone, lines too fine for the size (they blur
// as the ink spreads over the years), and gaps between lines so tight they fill in. Pure maths
// on the artwork's RGBA pixels at a known real pixel size, so it can be tested without a
// browser; the app draws the marked picture and the summary.

// Distance (chamfer 3-4, in pixels) from each pixel where `inside` is set to the nearest pixel
// where it is not. Outside the picture counts as `edge` (true: inside, so it is far away).
function distance(inside, w, h, edge) {
  const BIG = 1e9, d = new Float32Array(w * h), E = edge ? BIG : 0;
  for (let p = 0; p < d.length; p++) d[p] = inside[p] ? BIG : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (!d[p]) continue;
    d[p] = Math.min(d[p], (x > 0 ? d[p - 1] : E) + 3, (y > 0 ? d[p - w] : E) + 3, (x > 0 && y > 0 ? d[p - w - 1] : E) + 4, (x < w - 1 && y > 0 ? d[p - w + 1] : E) + 4);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const p = y * w + x; if (!d[p]) continue;
    d[p] = Math.min(d[p], (x < w - 1 ? d[p + 1] : E) + 3, (y < h - 1 ? d[p + w] : E) + 3, (x < w - 1 && y < h - 1 ? d[p + w + 1] : E) + 4, (x > 0 && y < h - 1 ? d[p + w - 1] : E) + 4);
  }
  for (let p = 0; p < d.length; p++) d[p] = Math.min(d[p] / 3, 1e6);
  return d;
}
// The largest value within r pixels (a square), in two passes.
function maxNear(d, w, h, r) {
  const a = new Float32Array(d.length), b = new Float32Array(d.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, d[y * w + k]); a[y * w + x] = m; }
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { let m = 0; for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, a[k * w + x]); b[y * w + x] = m; }
  return b;
}

// Colour maths: sRGB 0..255 to CIE Lab, and the plain colour difference between two.
function lab([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
export function deltaE(a, b) { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
// How much ink stands out from the skin round it. Light and dark matter most: a pale colour
// that only tints the skin reads as a stain from a step away, so tint counts for a third.
export function contrast(skin, shown) { const p = lab(skin), q = lab(shown); return Math.hypot(p[0] - q[0], 0.35 * Math.hypot(p[1] - q[1], p[2] - q[2])); }
// Ink over skin: the ink colour multiplies the skin, at the tattoo's ink strength.
export function onSkin(rgb, skin, opacity = 0.92) { return skin.map((s, i) => s * (1 - opacity + opacity * rgb[i] / 255)); }

// A plain name for an ink colour, so the summary can say "the yellow".
export function colourName([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
  if (s < 0.18 || mx - mn < 24) return l > 0.85 ? 'white' : l > 0.6 ? 'light grey' : l > 0.25 ? 'grey' : 'black';
  let hue; const d = mx - mn;
  if (mx === r) hue = ((g - b) / d + 6) % 6; else if (mx === g) hue = (b - r) / d + 2; else hue = (r - g) / d + 4;
  hue *= 60;
  const light = l > 0.72 ? 'pale ' : l < 0.22 ? 'dark ' : '';
  if (hue < 15 || hue >= 340) return l > 0.72 ? 'pink' : light + 'red';
  if (hue < 40) return l < 0.4 ? 'brown' : light + 'orange';
  if (hue < 68) return l < 0.35 ? 'olive' : light + 'yellow';
  if (hue < 160) return light + 'green';
  if (hue < 200) return light + 'teal';
  if (hue < 255) return light + 'blue';
  if (hue < 290) return light + 'purple';
  return l > 0.6 ? 'pink' : light + 'magenta';
}

// The check itself. pxMm is the real size of one pixel; skin is the skin colour [r, g, b].
export function inkCheck(rgba, w, h, { pxMm, skin, opacity = 0.92, line = 0.5, gap = 0.7 }) {
  const n = w * h, ink = new Uint8Array(n);
  let inkPixels = 0;
  for (let p = 0, o = 0; p < n; p++, o += 4) {
    const a = ((255 - Math.min(rgba[o], rgba[o + 1], rgba[o + 2])) / 255) * (rgba[o + 3] / 255);
    if (a > 0.45) { ink[p] = 1; inkPixels++; }
  }
  const out = { inkPixels, thin: new Uint8Array(n), tight: new Uint8Array(n), faint: new Uint8Array(n), colours: [], thinShare: 0, tightMm2: 0, lineP10Mm: null, gapP10Mm: null, pxMm };
  if (!inkPixels) return out;
  const d = distance(ink, w, h, false);
  // lines thinner than `line` mm: no wider stroke within reach
  const linePx = line / pxMm, rL = Math.ceil(linePx / 2) + 1, mL = maxNear(d, w, h, rL);
  let thin = 0;
  for (let p = 0; p < n; p++) if (ink[p] && 2 * mL[p] - 1 < linePx) { out.thin[p] = 1; thin++; }
  out.thinShare = thin / inkPixels;
  // how wide the strokes are: the width at each point on their middle line
  const widths = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x; if (!ink[p]) continue; const v = d[p];
    if (v >= d[p - 1] && v >= d[p + 1] && v >= d[p - w] && v >= d[p + w] && v >= d[p - w - 1] && v >= d[p - w + 1] && v >= d[p + w - 1] && v >= d[p + w + 1]) widths.push((2 * v - 1) * pxMm);
  }
  if (widths.length) { widths.sort((a, b) => a - b); out.lineP10Mm = widths[Math.floor(widths.length * 0.1)]; }
  // gaps narrower than `gap` mm between bits of ink
  const paper = new Uint8Array(n); for (let p = 0; p < n; p++) paper[p] = ink[p] ? 0 : 1;
  const e = distance(paper, w, h, true), gapPx = gap / pxMm, mG = maxNear(e, w, h, Math.ceil(gapPx / 2) + 1);
  let tight = 0;
  for (let p = 0; p < n; p++) if (paper[p] && 2 * mG[p] - 1 < gapPx) { out.tight[p] = 1; tight++; }
  out.tightMm2 = tight * pxMm * pxMm;
  // how wide the gaps between bits of ink are, the same way (open paper round the outside left out)
  const gaps = [], openPx = 10 / pxMm;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x; if (ink[p]) continue; const v = e[p]; if (2 * v - 1 > openPx) continue;
    if (v >= e[p - 1] && v >= e[p + 1] && v >= e[p - w] && v >= e[p + w] && v >= e[p - w - 1] && v >= e[p - w + 1] && v >= e[p + w - 1] && v >= e[p + w + 1]) gaps.push((2 * v - 1) * pxMm);
  }
  if (gaps.length) { gaps.sort((a, b) => a - b); out.gapP10Mm = gaps[Math.floor(gaps.length * 0.1)]; }
  // colours: the solid inside of the ink, grouped, each against the skin
  const bins = new Map(); let solid = 0;
  for (let p = 0; p < n; p++) {
    if (!ink[p] || (d[p] < 1.5 && mL[p] >= 2)) continue; // skip the soft edge of strokes that have a solid middle
    const o = p * 4; if (rgba[o + 3] < 200) continue;
    const key = (rgba[o] >> 5) << 6 | (rgba[o + 1] >> 5) << 3 | (rgba[o + 2] >> 5);
    let b = bins.get(key); if (!b) bins.set(key, b = { n: 0, r: 0, g: 0, b: 0, px: [] });
    b.n++; b.r += rgba[o]; b.g += rgba[o + 1]; b.b += rgba[o + 2]; b.px.push(p); solid++;
  }
  let groups = [...bins.values()].filter((b) => b.n >= Math.max(4, solid * 0.01)).map((b) => ({ rgb: [b.r / b.n, b.g / b.n, b.b / b.n], n: b.n, px: b.px }));
  groups.sort((a, b) => b.n - a.n);
  const merged = [];
  for (const g of groups) {
    const m = merged.find((x) => deltaE(x.rgb, g.rgb) < 12);
    if (m) { const t = m.n + g.n; m.rgb = m.rgb.map((c, i) => (c * m.n + g.rgb[i] * g.n) / t); m.n = t; m.px.push(...g.px); } else merged.push({ ...g, px: [...g.px] });
  }
  for (const g of merged) {
    const shown = onSkin(g.rgb, skin, opacity), dE = contrast(skin, shown), level = dE < 8 ? 'barely' : dE < 16 ? 'faint' : 'ok';
    out.colours.push({ rgb: g.rgb.map(Math.round), share: g.n / solid, dE, level, name: colourName(g.rgb) });
    if (level !== 'ok') for (const p of g.px) out.faint[p] = 1;
  }
  // a faint colour marks the whole of its ink, edges included
  if (out.colours.some((c) => c.level !== 'ok')) {
    const faintCols = out.colours.filter((c) => c.level !== 'ok').map((c) => c.rgb);
    for (let p = 0; p < n; p++) if (ink[p] && !out.faint[p]) { const o = p * 4, c = [rgba[o], rgba[o + 1], rgba[o + 2]]; if (faintCols.some((f) => deltaE(f, c) < 14)) out.faint[p] = 1; }
  }
  return out;
}

// The artwork as it sits on the skin, with the findings marked: fine lines orange, tight gaps
// blue, colours that barely show striped in magenta.
export function inkCheckPixels(rgba, w, h, r, skin, opacity = 0.92) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0, o = 0; p < w * h; p++, o += 4) {
    const a = rgba[o + 3] / 255, c = [0, 1, 2].map((i) => 255 + (rgba[o + i] - 255) * a);
    let px = onSkin(c, skin, opacity);
    const x = p % w, y = (p / w) | 0;
    if (r.faint[p] && ((x + y) >> 2) % 2 === 0) px = [214, 40, 160];
    if (r.thin[p]) px = [255, 106, 0];
    if (r.tight[p]) px = [0, 150, 255];
    out[o] = px[0]; out[o + 1] = px[1]; out[o + 2] = px[2]; out[o + 3] = 255;
  }
  return out;
}

// The width (in the same units as `now`) at which nearly every line is at least `line` mm.
export function widthForLines(now, lineP10Mm, line = 0.5) {
  if (!lineP10Mm || lineP10Mm >= line) return null;
  return now * line / lineP10Mm;
}
