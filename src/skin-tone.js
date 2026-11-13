// Your own skin tone: any shade between the lightest and deepest preset, warmer or cooler,
// or matched from a photo of your skin.
//
// Skin colours mostly vary along two directions: how light or deep, and how warm (red, pink)
// or cool (olive, yellow). Depth follows the preset tones in order; warmth turns the hue a
// little towards red or towards yellow and lifts or lowers its colour.

const ANCHORS = ['#f6e2d3', '#f1d3bd', '#e0b394', '#c6916c', '#9a6644', '#6a422a', '#45291a'];

export function hexToRgb(h) { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbToHex([r, g, b]) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// depth 0 (lightest) .. 1 (deepest); warmth -1 (cool, olive) .. 1 (warm, red)
export function toneColour(depth, warmth = 0) {
  const d = Math.max(0, Math.min(1, depth)) * (ANCHORS.length - 1), i = Math.min(ANCHORS.length - 2, Math.floor(d)), f = d - i;
  const a = hexToRgb(ANCHORS[i]), b = hexToRgb(ANCHORS[i + 1]);
  const base = a.map((v, k) => v + (b[k] - v) * f), [h, s, l] = rgbToHsl(base);
  const w = Math.max(-1, Math.min(1, warmth)), out = hslToRgb([(h - w * 9 + 360) % 360, Math.max(0, Math.min(1, s * (1 + 0.3 * w))), l]);
  const Y = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], k = Y(base) / Math.max(1, Y(out)); // warmth changes hue, not depth
  return rgbToHex(out.map((v) => v * k));
}

// The depth and warmth that come closest to a colour, so the sliders can show it.
export function nearestTone(hex) {
  const t = hexToRgb(hex); let best = { depth: 0.5, warmth: 0, dist: Infinity };
  for (let i = 0; i <= 120; i++) for (let j = -20; j <= 20; j++) {
    const depth = i / 120, warmth = j / 20, c = hexToRgb(toneColour(depth, warmth));
    const dist = (c[0] - t[0]) ** 2 * 0.3 + (c[1] - t[1]) ** 2 * 0.59 + (c[2] - t[2]) ** 2 * 0.11;
    if (dist < best.dist) best = { depth, warmth, dist };
  }
  return { depth: best.depth, warmth: best.warmth, off: Math.sqrt(best.dist) };
}

// The skin colour around a tapped spot of a photo: the middle of the pixels in a small disc,
// so a freckle, a hair or a bright glint does not throw it off. rgba is ImageData.data.
export function sampleSkin(rgba, w, h, cx, cy, r) {
  const px = [];
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const k = (y * w + x) * 4; if (rgba[k + 3] < 200) continue;
      px.push([rgba[k], rgba[k + 1], rgba[k + 2], 0.299 * rgba[k] + 0.587 * rgba[k + 1] + 0.114 * rgba[k + 2]]);
    }
  if (!px.length) return null;
  px.sort((a, b) => a[3] - b[3]);
  const mid = px.slice(Math.floor(px.length * 0.25), Math.max(Math.floor(px.length * 0.25) + 1, Math.ceil(px.length * 0.75)));
  const avg = [0, 1, 2].map((k) => mid.reduce((s, p) => s + p[k], 0) / mid.length);
  return rgbToHex(avg);
}

// A picked colour that is too far from any skin, or very dark or blown out, is most likely a
// shadow, the background or clothing. Say so instead of painting the body that colour.
export function skinCheck(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (l > 0.94) return 'That spot is too bright. Pick a spot without shine.';
  if (l < 0.1) return 'That spot is too dark. Pick a spot in even light.';
  if (s > 0.12 && (h > 60 && h < 330)) return 'That colour does not look like skin. Tap your skin, not the background.';
  return '';
}
