// A Procreate colour palette (.swatches) for the project: the body's skin tone with a shade and
// a highlight, then the ink colours actually used in the artwork. Drawing in Procreate with
// these means what you draw matches what Ink Atlas shows on the body.
//
// A .swatches file is a ZIP holding Swatches.json: a list of palettes, each with a name and up
// to 30 swatches given as hue, saturation and brightness from 0 to 1.
import { zipStored } from './obj-export.js';

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return null;
  const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) { return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
export function rgbToHsb([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
  return { hue: h, saturation: max === 0 ? 0 : d / max, brightness: max };
}

// The skin colour, a shade for creases and a highlight, as Ink Atlas lights them.
export function skinSet(hex) {
  const c = hexToRgb(hex) || [224, 179, 148];
  return [c, c.map((v) => v * 0.72), c.map((v) => v + (255 - v) * 0.35)];
}

// The main ink colours in a set of pictures (RGBA pixel arrays). White paper and see-through
// pixels are skipped, as they are on the body. Similar colours merge; the most used come first.
export function inkColours(pictures, { max = 12 } = {}) {
  const bins = new Map();
  for (const px of pictures) {
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      if (Math.min(r, g, b) > 232) continue; // paper
      const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
      const e = bins.get(k) || bins.set(k, [0, 0, 0, 0]).get(k); e[0] += r; e[1] += g; e[2] += b; e[3]++;
    }
  }
  const total = [...bins.values()].reduce((n, e) => n + e[3], 0);
  const found = [];
  for (const e of [...bins.values()].sort((a, b) => b[3] - a[3])) {
    const c = [e[0] / e[3], e[1] / e[3], e[2] / e[3]];
    const near = found.find((f) => Math.hypot(f.c[0] - c[0], f.c[1] - c[1], f.c[2] - c[2]) < 48);
    if (near) { const n = near.n + e[3]; near.c = near.c.map((v, j) => (v * near.n + c[j] * e[3]) / n); near.n = n; continue; }
    if (e[3] < total * 0.015) continue; // stray specks
    if (found.some((f) => tintOf(c, f.c))) continue; // a soft edge of a colour already found, blending into paper
    found.push({ c, n: e[3] });
  }
  return found.sort((a, b) => b.n - a.n).slice(0, max).map((f) => f.c.map(Math.round));
}

// Whether c lies between colour f and white paper (an anti-aliased edge of f).
function tintOf(c, f) {
  const d = f.map((v) => 255 - v), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]; if (dd < 1) return false;
  const t = ((c[0] - f[0]) * d[0] + (c[1] - f[1]) * d[1] + (c[2] - f[2]) * d[2]) / dd;
  if (t <= 0 || t >= 1) return false;
  return Math.hypot(...c.map((v, i) => v - (f[i] + t * d[i]))) < 18;
}
export function swatchesJson(name, colours) {
  const swatches = colours.slice(0, 30).map((c) => ({ ...rgbToHsb(c), alpha: 1, colorSpace: 0 }));
  return [{ name: String(name || 'Ink Atlas').slice(0, 60), swatches }];
}
export function swatchesFile(name, colours) {
  return zipStored([{ name: 'Swatches.json', data: new TextEncoder().encode(JSON.stringify(swatchesJson(name, colours))) }]);
}
