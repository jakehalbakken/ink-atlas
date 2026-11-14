// Stencil for the artist: a tattoo's artwork as clean black lines on white, at real size.
// Line work and dots up to about 4 mm wide stays as drawn, wider filled areas become their outline, and where two colours meet
// inside the ink a line is drawn too. Specks are dropped. Pure maths on RGBA pixels, so it
// can be tested without a browser; the app draws the result and prints or shares it.

// How much ink a pixel holds, 0 (paper) to 1: any channel away from white counts, so a
// yellow or a red reads as ink as well as black, and see-through pixels are paper.
export function inkAmount(rgba, w, h) {
  const out = new Float32Array(w * h);
  for (let p = 0, o = 0; p < out.length; p++, o += 4) out[p] = ((255 - Math.min(rgba[o], rgba[o + 1], rgba[o + 2])) / 255) * (rgba[o + 3] / 255);
  return out;
}

// Distance (in pixels, chamfer 3-4) from each pixel to the nearest pixel where `inside` is false.
function distanceOut(inside, w, h) {
  const BIG = 1e9, d = new Float32Array(w * h);
  for (let p = 0; p < d.length; p++) d[p] = inside[p] ? BIG : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (!d[p]) continue;
    let v = d[p];
    // outside the picture counts as paper
    v = Math.min(v, x > 0 ? d[p - 1] + 3 : 3, y > 0 ? d[p - w] + 3 : 3);
    v = Math.min(v, x > 0 && y > 0 ? d[p - w - 1] + 4 : 4, x < w - 1 && y > 0 ? d[p - w + 1] + 4 : 4);
    d[p] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const p = y * w + x; if (!d[p]) continue;
    let v = d[p];
    v = Math.min(v, x < w - 1 ? d[p + 1] + 3 : 3, y < h - 1 ? d[p + w] + 3 : 3);
    v = Math.min(v, x < w - 1 && y < h - 1 ? d[p + w + 1] + 4 : 4, x > 0 && y < h - 1 ? d[p + w - 1] + 4 : 4);
    d[p] = v;
  }
  for (let p = 0; p < d.length; p++) d[p] /= 3;
  return d;
}

// Drop connected pieces smaller than minArea pixels.
function dropSpecks(mask, w, h, minArea) {
  const seen = new Uint8Array(w * h), stack = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    const piece = []; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(); piece.push(p); const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx; if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (piece.length < minArea) for (const p of piece) mask[p] = 0;
  }
  return mask;
}

// detail 0..1: higher keeps lighter shading as ink. line: outline thickness in pixels.
// solid: lines up to this wide (pixels) stay solid, wider fills become outlines.
// Returns { lines: Uint8Array (1 = black), inkPixels, linePixels }.
export function stencilLines(rgba, w, h, { detail = 0.5, line = 4, solid = line * 4 } = {}) {
  const ink = inkAmount(rgba, w, h), T = 0.6 - 0.48 * Math.min(1, Math.max(0, detail));
  let mask = new Uint8Array(w * h), inkPixels = 0;
  for (let p = 0; p < mask.length; p++) if (ink[p] >= T) mask[p] = 1;
  mask = dropSpecks(mask, w, h, Math.max(4, Math.round(line * line * 1.5)));
  for (let p = 0; p < mask.length; p++) inkPixels += mask[p];
  const lines = new Uint8Array(w * h);
  // a line up to `solid` wide stays as it is; a wider filled area becomes its outline
  const din = distanceOut(mask, w, h), half = solid / 2, notCore = new Uint8Array(w * h);
  let cores = 0; for (let p = 0; p < mask.length; p++) if (din[p] > half) cores++; else notCore[p] = 1;
  const dcore = cores ? distanceOut(notCore, w, h) : null;
  for (let p = 0; p < mask.length; p++) if (mask[p] && (!dcore || dcore[p] > half + 1.5 || din[p] <= line)) lines[p] = 1;
  // where two clearly different colours meet inside the ink
  const edge = new Uint8Array(w * h); let edges = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) {
    for (const q of [y * w + x + 1, y < h - 1 ? (y + 1) * w + x : -1]) {
      const p = y * w + x; if (q < 0 || !mask[p] || !mask[q]) continue;
      const a = p * 4, b = q * 4;
      if (Math.hypot(rgba[a] - rgba[b], rgba[a + 1] - rgba[b + 1], rgba[a + 2] - rgba[b + 2]) > 90) { edge[p] = 1; edges++; }
    }
  }
  if (edges) {
    const notEdge = new Uint8Array(w * h); for (let p = 0; p < edge.length; p++) notEdge[p] = edge[p] ? 0 : 1;
    const de = distanceOut(notEdge, w, h);
    for (let p = 0; p < lines.length; p++) if (mask[p] && de[p] <= line / 2) lines[p] = 1;
  }
  let linePixels = 0; for (const v of lines) linePixels += v;
  return { lines, inkPixels, linePixels };
}

// The lines as RGBA, black on white.
export function stencilPixels(lines, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0, o = 0; p < lines.length; p++, o += 4) { const v = lines[p] ? 0 : 255; out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255; }
  return out;
}

// Size of the stencil picture: about 300 dots per inch at real size, the long side and the
// whole picture capped so a big back piece stays quick on an iPad.
export function stencilScale(wIn, hIn, dpi = 300, cap = 4000, maxPixels = 6e6) {
  const k = Math.min(1, cap / (Math.max(wIn, hIn) * dpi), Math.sqrt(maxPixels / (wIn * hIn * dpi * dpi))), d = dpi * k;
  return { w: Math.max(1, Math.round(wIn * d)), h: Math.max(1, Math.round(hIn * d)), dpi: d, line: Math.max(2, Math.round(0.4 / 25.4 * d)), solid: Math.max(6, Math.round(4 / 25.4 * d)) };
}

// A PNG's print size: add a pHYs chunk (dots per metre) after the header, so printing the
// picture at its own size gives the real size.
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u) => { let c = ~0; for (const x of u) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
export function pngWithDpi(png, dpi) {
  const u = png instanceof Uint8Array ? png : new Uint8Array(png);
  if (u.length < 33 || u[12] !== 0x49 || u[13] !== 0x48) return u; // not a PNG with its header first
  const ppm = Math.round(dpi / 0.0254), chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  // drop any pHYs already there
  const parts = [u.subarray(0, 33), chunk]; let p = 33;
  while (p + 8 <= u.length) { const len = new DataView(u.buffer, u.byteOffset + p).getUint32(0), type = String.fromCharCode(...u.subarray(p + 4, p + 8)); if (type !== 'pHYs') parts.push(u.subarray(p, p + 12 + len)); p += 12 + len; }
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0)); let at = 0; for (const x of parts) { out.set(x, at); at += x.length; }
  return out;
}
