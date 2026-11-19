// How a tattoo's ink sits on the skin: a blend mode, as in Procreate and Photoshop, and
// colour adjustments (hue, saturation, brightness, contrast, recolour, invert). Pure maths,
// no DOM, so it is tested on its own (tools/tests/ink-look-unit.mjs).
//
// Stored on the tattoo as two optional fields, so older saves need nothing:
//   t.blend  = one of the ids below, left out for Multiply (ink in skin, the default)
//   t.adjust = { hue: -180..180, sat: -100..100, light: -100..100, contrast: -100..100,
//                invert: true, tint: '#rrggbb', tintAmt: 0..100 }, left out when all default
// The artwork itself is never changed: the look is worked out each time the ink is drawn.
//
// The body is drawn with the ink multiplied over the lit skin, so any mode is shown as the
// ratio of the blended colour to the plain skin colour (blend(skin, ink) / skin), multiplied on.
// The lighting then falls on the blended colour just as it falls on the skin. Modes that come
// out lighter than the skin need a ratio over 1: those are stored halved and drawn doubled.

export const DEFAULT_BLEND = 'multiply';
export const BLEND_GROUPS = [
  { name: 'In the skin', modes: [['multiply', 'Multiply', 'mul '], ['normal', 'Normal', 'norm']] },
  { name: 'Darker', modes: [['darken', 'Darken', 'dark'], ['colorBurn', 'Colour burn', 'idiv'], ['linearBurn', 'Linear burn', 'lbrn']] },
  { name: 'Lighter', modes: [['screen', 'Screen', 'scrn'], ['lighten', 'Lighten', 'lite'], ['colorDodge', 'Colour dodge', 'div '], ['add', 'Add', 'lddg']] },
  { name: 'Contrast', modes: [['overlay', 'Overlay', 'over'], ['softLight', 'Soft light', 'sLit'], ['hardLight', 'Hard light', 'hLit']] },
  { name: 'Difference', modes: [['difference', 'Difference', 'diff'], ['exclusion', 'Exclusion', 'smud'], ['subtract', 'Subtract', 'fsub']] },
  { name: 'Colour', modes: [['hue', 'Hue', 'hue '], ['saturation', 'Saturation', 'sat '], ['color', 'Colour', 'colr'], ['luminosity', 'Luminosity', 'lum ']] },
];
export const BLEND_MODES = BLEND_GROUPS.flatMap((g) => g.modes.map(([id, name, psd]) => ({ id, name, psd, group: g.name })));
const BY_ID = new Map(BLEND_MODES.map((m) => [m.id, m]));
// the letter Procreate shows on a layer for its mode
const LETTER = { multiply: 'M', normal: 'N', darken: 'D', colorBurn: 'CB', linearBurn: 'LB', screen: 'S', lighten: 'L', colorDodge: 'CD', add: 'A', overlay: 'O', softLight: 'SL', hardLight: 'HL', difference: 'Df', exclusion: 'E', subtract: 'Su', hue: 'H', saturation: 'Sa', color: 'C', luminosity: 'Lu' };

export const blendOf = (t) => (t && BY_ID.has(t.blend) ? t.blend : DEFAULT_BLEND);
export const blendName = (id) => (BY_ID.get(id) || BY_ID.get(DEFAULT_BLEND)).name;
export const blendLetter = (id) => LETTER[id] || 'M';
export const psdBlendKey = (id) => (BY_ID.get(id) || BY_ID.get(DEFAULT_BLEND)).psd;

export const ADJUST_DEFAULT = { hue: 0, sat: 0, light: 0, contrast: 0, invert: false, tint: '#b0413e', tintAmt: 0 };
const RANGES = { hue: [-180, 180], sat: [-100, 100], light: [-100, 100], contrast: [-100, 100], tintAmt: [0, 100] };
const HEX = /^#[0-9a-f]{6}$/i;

// A clean copy of the adjustments, or null when they change nothing.
export function cleanAdjust(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(RANGES)) { const v = +a[k]; if (Number.isFinite(v) && Math.round(v) !== 0) out[k] = Math.max(lo, Math.min(hi, Math.round(v))); }
  if (a.invert === true) out.invert = true;
  if (out.tintAmt) out.tint = typeof a.tint === 'string' && HEX.test(a.tint) ? a.tint.toLowerCase() : ADJUST_DEFAULT.tint;
  return Object.keys(out).length ? out : null;
}
// For cleanState: drops a bad or default blend and adjustments in place. True if anything was dropped.
export function cleanLook(t) {
  let dropped = false;
  if (t.blend !== undefined && (!BY_ID.has(t.blend) || t.blend === DEFAULT_BLEND)) { if (!BY_ID.has(t.blend)) dropped = true; delete t.blend; }
  if (t.adjust !== undefined) { const c = cleanAdjust(t.adjust); if (c) t.adjust = c; else delete t.adjust; }
  return dropped;
}
export const adjustOf = (t) => ({ ...ADJUST_DEFAULT, ...(t && cleanAdjust(t.adjust) || {}) });
export const hasAdjust = (t) => !!(t && cleanAdjust(t.adjust));
export const hasLook = (t) => blendOf(t) !== DEFAULT_BLEND || hasAdjust(t);
export const lookKey = (t) => (hasLook(t) ? blendOf(t) + ':' + JSON.stringify(cleanAdjust(t.adjust) || {}) : '');

// A few words for the layer line and the edit sheet: "Screen", "Multiply, hue +20°, inverted".
export function describeLook(t) {
  const a = cleanAdjust(t && t.adjust) || {}, bits = [];
  const sign = (v) => (v > 0 ? '+' : '') + v;
  if (a.hue) bits.push(`hue ${sign(a.hue)}°`);
  if (a.sat) bits.push(a.sat <= -100 ? 'no colour' : `saturation ${sign(a.sat)}`);
  if (a.light) bits.push(`brightness ${sign(a.light)}`);
  if (a.contrast) bits.push(`contrast ${sign(a.contrast)}`);
  if (a.tintAmt) bits.push(`recoloured ${a.tintAmt}%`);
  if (a.invert) bits.push('inverted');
  return [blendName(blendOf(t)), ...bits].join(', ');
}

/* ---------- colour adjustments on the artwork's pixels ---------- */
function rgbToHsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
  }
  return [h, s, l];
}
function hue2(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
function hslToRgb(h, s, l) {
  if (!s) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [hue2(p, q, h + 1 / 3), hue2(p, q, h), hue2(p, q, h - 1 / 3)];
}
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
function clipColor(c) {
  const l = lum(c), n = Math.min(c[0], c[1], c[2]), x = Math.max(c[0], c[1], c[2]);
  let o = c;
  if (n < 0) o = o.map((v) => l + ((v - l) * l) / (l - n || 1));
  if (x > 1) o = o.map((v) => l + ((v - l) * (1 - l)) / (x - l || 1));
  return o;
}
const setLum = (c, l) => { const d = l - lum(c); return clipColor([c[0] + d, c[1] + d, c[2] + d]); };
const satOf = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
function setSat(c, s) {
  const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
  if (mx === mn) return [0, 0, 0];
  return c.map((v) => ((v - mn) * s) / (mx - mn));
}
export const hexToRgb01 = (h) => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

// One colour (0..1 each) through the adjustments, in this order: invert, hue and saturation,
// brightness, contrast, recolour.
export function adjustColor(c, a) {
  let [r, g, b] = c;
  if (a.invert) { r = 1 - r; g = 1 - g; b = 1 - b; }
  if (a.hue || a.sat) {
    let [h, s, l] = rgbToHsl(r, g, b);
    if (a.hue) h = (((h + a.hue / 360) % 1) + 1) % 1;
    if (a.sat) s = a.sat < 0 ? s * (1 + a.sat / 100) : s + (1 - s) * (a.sat / 100) * (s > 0 ? 1 : 0);
    [r, g, b] = hslToRgb(h, Math.max(0, Math.min(1, s)), l);
  }
  if (a.light) { const k = a.light / 100; [r, g, b] = [r, g, b].map((v) => (k > 0 ? v + (1 - v) * k : v * (1 + k))); }
  if (a.contrast) { const f = a.contrast > 0 ? 1 / Math.max(0.01, 1 - a.contrast / 101) : 1 + a.contrast / 100; [r, g, b] = [r, g, b].map((v) => (v - 0.5) * f + 0.5); }
  if (a.tintAmt) {
    const k = a.tintAmt / 100, tinted = setLum(hexToRgb01(a.tint), lum([r, g, b]));
    r += (tinted[0] - r) * k; g += (tinted[1] - g) * k; b += (tinted[2] - b) * k;
  }
  return [r, g, b].map((v) => Math.max(0, Math.min(1, v)));
}
// In place on RGBA pixels (0..255): colours change, alpha is left alone.
export function adjustPixels(px, adjust) {
  const a = { ...ADJUST_DEFAULT, ...(cleanAdjust(adjust) || {}) };
  if (!cleanAdjust(adjust)) return px;
  for (let o = 0; o < px.length; o += 4) {
    if (!px[o + 3]) continue;
    const c = adjustColor([px[o] / 255, px[o + 1] / 255, px[o + 2] / 255], a);
    px[o] = Math.round(c[0] * 255); px[o + 1] = Math.round(c[1] * 255); px[o + 2] = Math.round(c[2] * 255);
  }
  return px;
}

/* ---------- blend modes: skin (s) under, ink (i) on top, each 0..1 ---------- */
const screen1 = (s, i) => s + i - s * i;
const hard1 = (s, i) => (i <= 0.5 ? s * 2 * i : screen1(s, 2 * i - 1));
const soft1 = (s, i) => {
  if (i <= 0.5) return s - (1 - 2 * i) * s * (1 - s);
  const d = s <= 0.25 ? ((16 * s - 12) * s + 4) * s : Math.sqrt(s);
  return s + (2 * i - 1) * (d - s);
};
const SEP = {
  normal: (s, i) => i,
  multiply: (s, i) => s * i,
  darken: Math.min,
  colorBurn: (s, i) => (s >= 1 ? 1 : i <= 0 ? 0 : 1 - Math.min(1, (1 - s) / i)),
  linearBurn: (s, i) => Math.max(0, s + i - 1),
  screen: screen1,
  lighten: Math.max,
  colorDodge: (s, i) => (s <= 0 ? 0 : i >= 1 ? 1 : Math.min(1, s / (1 - i))),
  add: (s, i) => Math.min(1, s + i),
  overlay: (s, i) => hard1(i, s),
  softLight: soft1,
  hardLight: hard1,
  difference: (s, i) => Math.abs(s - i),
  exclusion: (s, i) => s + i - 2 * s * i,
  subtract: (s, i) => Math.max(0, s - i),
};
// The blended colour of ink i over skin s, before the ink's own strength (alpha) is applied.
export function blendColor(mode, s, i) {
  const f = SEP[mode];
  if (f) return [f(s[0], i[0]), f(s[1], i[1]), f(s[2], i[2])];
  if (mode === 'hue') return setLum(setSat(i, satOf(s)), lum(s));
  if (mode === 'saturation') return setLum(setSat(s, satOf(i)), lum(s));
  if (mode === 'color') return setLum(i, lum(s));
  if (mode === 'luminosity') return setLum(s, lum(i));
  return [s[0] * i[0], s[1] * i[1], s[2] * i[2]];
}

// Ink pixels (RGBA, 0..255, alpha = how much ink) over a plain skin colour (0..255 each) as a
// multiplier per channel: (skin * (1 - a) + blend * a) / skin. Returns the ratios and the
// largest one, so the caller knows whether it has to draw them doubled.
export function lookRatios(px, skin, mode, strength = 1) {
  const s = skin.map((v) => Math.max(1, v) / 255), out = new Float32Array((px.length / 4) * 3); let max = 0;
  for (let o = 0, q = 0; o < px.length; o += 4, q += 3) {
    const a = (px[o + 3] / 255) * strength;
    if (a <= 0) { out[q] = out[q + 1] = out[q + 2] = 1; if (max < 1) max = 1; continue; }
    const b = blendColor(mode, s, [px[o] / 255, px[o + 1] / 255, px[o + 2] / 255]);
    for (let k = 0; k < 3; k++) { const v = (s[k] * (1 - a) + b[k] * a) / s[k]; out[q + k] = v; if (v > max) max = v; }
  }
  return { ratios: out, max };
}
// Encodes the ratios into RGBA pixels (opaque) for the multiplied texture.
//   lift false: the ratio itself (it is never over 1)
//   lift true:  half the ratio, for a texture drawn doubled (up to 2x the skin)
//   linear:     for pictures blended in linear light (the baked skin pictures): there a doubled
//               draw doubles the linear value, so the stored value is the ratio / 2^(1/2.2)
export function encodeRatios(ratios, lift, linear = false, into) {
  const n = ratios.length / 3, px = into || new Uint8ClampedArray(n * 4);
  const k = !lift ? 255 : linear ? 255 / Math.pow(2, 1 / 2.2) : 255 / 2;
  for (let p = 0, q = 0, o = 0; p < n; p++, q += 3, o += 4) { px[o] = ratios[q] * k; px[o + 1] = ratios[q + 1] * k; px[o + 2] = ratios[q + 2] * k; px[o + 3] = 255; }
  return px;
}
// Whether the ratios need the doubled draw (a little slack for rounding).
export const needsLift = (max) => max > 1 + 1.5 / 255;
