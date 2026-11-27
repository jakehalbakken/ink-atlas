// Back from Procreate when the 3D body went out with each tattoo separate (src/layered-model.js).
// That file has one texture set per tattoo plus one for the skin, so what was painted on a
// tattoo's set is that tattoo's new artwork, and what was painted on the skin set is new
// drawing. Plain maths here: which picture in the file belongs to which part, where a part's
// picture sits in the tattoo's own artwork, and the ink taken back out of a picture that is
// ink multiplied over skin. The app does the drawing.

const IMAGE = /\.(png|jpe?g)$/i;
const base = (n) => String(n || '').split('/').pop();
const plain = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// The colour pictures in the file, not roughness, normal or other maps.
export function colourPictures(names) {
  return names.filter((n) => IMAGE.test(n) && !/(^|[/_.-])(normal|rough|roughness|metal|metallic|metalness|occlusion|ao|height|bump|spec|specular|opacity|emissive)([_.-]|$)/i.test(base(n)));
}

// Material name -> picture, read from a text USD (usda). Each `def Material "Name"` block owns
// the first colour picture named in it. A binary file gives nothing here; the names of the
// pictures themselves are tried next.
export function materialPictures(usda) {
  const out = new Map(); if (typeof usda !== 'string') return out;
  const re = /def\s+Material\s+"([^"]+)"/g, at = [];
  let m; while ((m = re.exec(usda))) at.push([m[1], m.index]);
  for (let i = 0; i < at.length; i++) {
    const block = usda.slice(at[i][1], i + 1 < at.length ? at[i + 1][1] : usda.length);
    const files = [...block.matchAll(/@([^@]+\.(?:png|jpe?g))@/gi)].map((x) => x[1]);
    const colour = colourPictures(files);
    if (colour.length) out.set(at[i][0], colour[0]);
  }
  return out;
}

// Which picture belongs to the skin and to each part.
// pictures: [{ name, w, h }]; parts: [{ label, ratio }] (ratio = width / height of its picture);
// usda: the model's text, if it has one.
// Returns { skin, parts: Map label -> picture name }. A part is matched by its material's
// picture, else by a picture whose own name carries the part's name, else by being the only
// picture left with its shape.
export function matchPictures({ pictures, parts, usda = null }) {
  const byName = new Map(pictures.map((p) => [p.name, p])), left = new Set(pictures.map((p) => p.name));
  const mats = materialPictures(usda), found = new Map();
  const take = (label, name) => { if (name && left.has(name)) { found.set(label, name); left.delete(name); return true; } return false; };
  const fromMat = (label) => { for (const [mat, file] of mats) if (plain(mat) === plain(label)) { const hit = pictures.find((p) => p.name === file || p.name.endsWith('/' + file) || base(p.name) === base(file)); if (hit) return hit.name; } return null; };
  // the skin first: its material, a picture called skin, else the biggest square picture
  let skin = fromMat('Skin');
  if (!skin) skin = (pictures.find((p) => /(^|[^a-z])skin([^a-z]|$)/i.test(base(p.name))) || {}).name || null;
  if (!skin) { const sq = pictures.filter((p) => p.w > 0 && Math.abs(p.w / p.h - 1) < 0.01).sort((a, b) => b.w * b.h - a.w * a.h); skin = sq.length ? sq[0].name : null; }
  if (skin) left.delete(skin);
  for (const q of parts) take(q.label, fromMat(q.label));
  // a picture's own name, longest names first so Rose_2 is not taken by Rose
  for (const q of [...parts].sort((a, b) => b.label.length - a.label.length)) {
    if (found.has(q.label)) continue;
    const key = plain(q.label); if (key.length < 3) continue;
    const hits = [...left].filter((n) => { const b = plain(base(n).replace(IMAGE, '')); return b === key || (b.startsWith(key) && !/^[0-9]/.test(b.slice(key.length))); });
    if (hits.length === 1) take(q.label, hits[0]);
  }
  // shape: only a picture whose shape no other unmatched part shares
  const open = parts.filter((q) => !found.has(q.label));
  for (const q of open) {
    const near = (p) => p.w > 0 && p.h > 0 && Math.abs(Math.log((p.w / p.h) / q.ratio)) < 0.03;
    const hits = [...left].filter((n) => near(byName.get(n)));
    const rivals = open.filter((o) => o !== q && Math.abs(Math.log(o.ratio / q.ratio)) < 0.03);
    if (hits.length === 1 && !rivals.length) take(q.label, hits[0]);
  }
  return { skin, parts: found };
}

// Where a part picture sits in its tattoo's artwork. The picture covers the tattoo's decal
// texture coordinates box [u0, v0, u1, v1] (rows from the top read v1 down to v0); the decal
// lays the artwork, inset by `margin`, mirrored when `flip`, with rows from the top at v = 1
// when `flipY` (the usual way) and at v = 0 otherwise. crop: the part of the picture kept, in
// shares of its width and height ({ x, y, w, h }, rows from the top).
// Returns how the kept picture sits against the old artwork: widthScale and heightScale (its
// size in shares of the old artwork's width and height), shift (its middle less the old
// middle, in those shares, right and down in the old artwork), and mirror / upsideDown, which
// say the kept picture must be turned that way to stand like the artwork does.
export function partFrame({ box, margin, flip = false, flipY = true, crop = { x: 0, y: 0, w: 1, h: 1 } }) {
  const [u0, v0, u1, v1] = box, du = u1 - u0, dv = v1 - v0, span = 1 - 2 * margin;
  // the kept picture in decal texture coordinates
  const a = u0 + du * crop.x, b = u0 + du * (crop.x + crop.w);
  const top = v1 - dv * crop.y, bottom = v1 - dv * (crop.y + crop.h);
  const ax = (u) => { const x = (u - margin) / span; return flip ? 1 - x : x; };
  const ay = (v) => (flipY ? 1 - v - margin : v - margin) / span;
  const x0 = ax(a), x1 = ax(b), y0 = ay(top), y1 = ay(bottom);
  return {
    widthScale: Math.abs(x1 - x0), heightScale: Math.abs(y1 - y0),
    shift: { x: (x0 + x1) / 2 - 0.5, y: (y0 + y1) / 2 - 0.5 },
    mirror: x1 < x0, upsideDown: y1 < y0,
  };
}

// sRGB byte <-> linear light
const toLin = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const toByte = (l) => { const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); };

// The skin colour a part picture was made on: the most common light colour round its edge
// (the part's picture runs a little past the artwork on every side, so its edge is bare skin).
export function edgeSkin(px, w, h) {
  const bins = new Map(); let best = null, bestN = 0;
  const add = (x, y) => { const o = (y * w + x) * 4; const k = (px[o] >> 3) + ',' + (px[o + 1] >> 3) + ',' + (px[o + 2] >> 3); const n = (bins.get(k) || 0) + 1; bins.set(k, n); if (n > bestN) { bestN = n; best = o; } };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
  return best == null ? [255, 255, 255] : [px[best], px[best + 1], px[best + 2]];
}

// Ink over white, out of a picture of ink multiplied over `skin` (in linear light, as the body
// is lit). Returns RGBA with the ink's own colour and see-through where there is none; `strength`
// is the tattoo's ink strength, taken back out so the slider keeps meaning what it did.
export function inkOutOfSkin(px, skin, strength = 1) {
  const out = new Uint8ClampedArray(px.length), s = [toLin[skin[0]] || 1e-4, toLin[skin[1]] || 1e-4, toLin[skin[2]] || 1e-4], k = strength > 0.05 ? strength : 1;
  for (let o = 0; o < px.length; o += 4) {
    const r = toByte(Math.min(1, toLin[px[o]] / s[0])) / 255, g = toByte(Math.min(1, toLin[px[o + 1]] / s[1])) / 255, b = toByte(Math.min(1, toLin[px[o + 2]] / s[2])) / 255;
    const a = 1 - Math.min(r, g, b);
    if (a < 6 / 255) { out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = 0; continue; }
    out[o] = Math.round(255 * (1 - (1 - r) / a)); out[o + 1] = Math.round(255 * (1 - (1 - g) / a)); out[o + 2] = Math.round(255 * (1 - (1 - b) / a));
    out[o + 3] = Math.round(255 * Math.min(1, a / k));
  }
  return out;
}

// Did the picture change? Both RGBA at the same size. A pixel counts when a channel moved by
// more than `tol`; the picture changed when more than `share` of its pixels did (and at least
// `least`), so the softening of a re-saved file is not taken for a drawing.
export function changedPixels(a, b, { tol = 40, share = 0.002, least = 12 } = {}) {
  let n = 0; const total = Math.min(a.length, b.length) / 4;
  for (let o = 0; o < total * 4; o += 4) if (Math.abs(a[o] - b[o]) > tol || Math.abs(a[o + 1] - b[o + 1]) > tol || Math.abs(a[o + 2] - b[o + 2]) > tol) n++;
  return { n, changed: n > Math.max(least, total * share) };
}
