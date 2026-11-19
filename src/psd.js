// A layered Photoshop file (PSD), the kind Procreate opens with every layer kept.
// 8-bit RGB, each layer with its own transparency, name and blend mode, plus the
// flattened picture that apps without layers show. Channels are packed with PackBits.
//
// layers: [{ name, rgba: Uint8ClampedArray (width*height*4, rows from the top),
//            blend: a PSD blend key such as 'norm', 'mul ', 'scrn', 'over', opacity: 0..255, hidden }] bottom layer first.
// A layer may instead carry { box, rgba } from cropLayer, rgba being just the box.
// Each layer is cropped to what it actually covers, so mostly-empty tattoo layers
// stay small.

function packBits(src, out) {
  // src: one row of bytes. Appends PackBits runs to out (array of numbers). Returns length.
  const n = src.length, start = out.length;
  let i = 0;
  while (i < n) {
    let run = 1;
    while (i + run < n && run < 128 && src[i + run] === src[i]) run++;
    if (run >= 3 || (run === 2 && i + 2 >= n)) { out.push(257 - run, src[i]); i += run; continue; }
    let lit = 1;
    while (i + lit < n && lit < 128) {
      if (i + lit + 2 < n && src[i + lit] === src[i + lit + 1] && src[i + lit] === src[i + lit + 2]) break;
      lit++;
    }
    out.push(lit - 1); for (let k = 0; k < lit; k++) out.push(src[i + k]);
    i += lit;
  }
  return out.length - start;
}

// One channel of a w x h region, packed: { counts: row byte counts, bytes }.
function packChannel(rgba, width, box, ch) {
  const w = box.right - box.left, h = box.bottom - box.top, row = new Uint8Array(w), counts = new Array(h), bytes = [];
  for (let y = 0; y < h; y++) {
    const o = ((box.top + y) * width + box.left) * 4 + ch;
    for (let x = 0; x < w; x++) row[x] = rgba[o + x * 4];
    counts[y] = packBits(row, bytes);
  }
  return { counts, bytes };
}

// The part of a full-size layer that has anything in it: { box, rgba } with rgba cropped
// to the box. Lets a caller keep only the small piece of each tattoo layer in memory.
export function cropLayer(rgba, width, height) {
  const box = bounds(rgba, width, height), w = box.right - box.left, h = box.bottom - box.top, out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(rgba.subarray(((box.top + y) * width + box.left) * 4, ((box.top + y) * width + box.right) * 4), y * w * 4);
  return { box, rgba: out };
}

function bounds(rgba, width, height) {
  let top = height, left = width, bottom = 0, right = 0;
  for (let y = 0; y < height; y++) for (let x = 0, o = y * width * 4 + 3; x < width; x++, o += 4) if (rgba[o]) {
    if (y < top) top = y; if (y >= bottom) bottom = y + 1; if (x < left) left = x; if (x >= right) right = x + 1;
  }
  return bottom > top ? { top, left, bottom, right } : { top: 0, left: 0, bottom: 0, right: 0 };
}

// Packing a big picture a strip at a time, so a 600 PPI canvas never has to sit in memory
// whole (iPad Safari caps a canvas at about 16.7 million pixels). Feed strips of full-width
// rows top to bottom; pass the result as a layer's `packed` (or as `merged: { packed }`).
export class StripPacker {
  constructor(channels = 4) { this.ch = Array.from({ length: channels }, () => ({ counts: [], chunks: [], length: 0 })); }
  add(rgba, width, rows) {
    const box = { top: 0, left: 0, bottom: rows, right: width };
    this.ch.forEach((c, k) => { const p = packChannel(rgba, width, box, k); for (const n of p.counts) c.counts.push(n); const u = Uint8Array.from(p.bytes); c.chunks.push(u); c.length += u.length; });
  }
  // layer channel order is alpha, red, green, blue by channel index 3, 0, 1, 2
  get packed() { return this.ch; }
}
const countBytes = (counts) => { const u = new Uint8Array(counts.length * 2); for (let i = 0; i < counts.length; i++) { u[i * 2] = counts[i] >> 8; u[i * 2 + 1] = counts[i] & 255; } return u; };

class Out {
  constructor() { this.parts = []; this.length = 0; }
  bytes(a) { const u = a instanceof Uint8Array ? a : Uint8Array.from(a); this.parts.push(u); this.length += u.length; }
  u8(v) { this.bytes([v & 255]); }
  u16(v) { this.bytes([(v >> 8) & 255, v & 255]); }
  i16(v) { this.u16(v & 0xffff); }
  u32(v) { this.bytes([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]); }
  ascii(s) { this.bytes([...s].map((c) => c.charCodeAt(0) & 127)); }
  blob() { return new Blob(this.parts, { type: 'image/vnd.adobe.photoshop' }); }
  concat() { const u = new Uint8Array(this.length); let o = 0; for (const p of this.parts) { u.set(p, o); o += p.length; } return u; }
}

const asciiName = (s) => String(s || 'Layer').replace(/[^\x20-\x7e]/g, '_').slice(0, 255);

// locked: true marks a layer as fully locked (the 'lspf' block), so Procreate and Photoshop keep
// it from being painted on or moved. ppi writes the resolution, so the canvas opens at its real
// physical size.
export function writePsd({ width, height, layers, merged, ppi }) {
  if (!(width > 0 && height > 0 && width <= 30000 && height <= 30000)) throw new Error('Picture size out of range');
  // ---- layer records and their channel data
  const rec = new Out(), data = new Out();
  for (const L of layers) {
    const { box, rgba } = L.packed ? { box: { top: 0, left: 0, bottom: height, right: width } } : L.box ? L : cropLayer(L.rgba, width, height), w = box.right - box.left, h = box.bottom - box.top;
    const chans = [[-1, 3], [0, 0], [1, 1], [2, 2]].map(([id, ch]) => {
      if (L.packed) { const pk = L.packed[ch]; return { id, len: 2 + pk.counts.length * 2 + pk.length, write: () => { data.u16(1); data.bytes(countBytes(pk.counts)); for (const b of pk.chunks) data.bytes(b); } }; }
      if (!w || !h) return { id, len: 2, write: () => data.u16(0) };
      const p = packChannel(rgba, w, { top: 0, left: 0, bottom: h, right: w }, ch);
      return { id, len: 2 + h * 2 + p.bytes.length, write: () => { data.u16(1); for (const c of p.counts) data.u16(c); data.bytes(p.bytes); } };
    });
    rec.u32(box.top); rec.u32(box.left); rec.u32(box.bottom); rec.u32(box.right);
    rec.u16(4); for (const c of chans) { rec.i16(c.id); rec.u32(c.len); }
    rec.ascii('8BIM'); rec.ascii(typeof L.blend === 'string' && /^[a-zA-Z ]{4}$/.test(L.blend) ? L.blend : 'norm');
    rec.u8(L.opacity ?? 255); rec.u8(0); rec.u8(L.hidden ? 2 : 0); rec.u8(0);
    // extra data: no mask, no blending ranges, Pascal name padded to 4, then the full (Unicode) name
    const nm = asciiName(L.name), padded = Math.ceil((nm.length + 1) / 4) * 4;
    const uni = [...String(L.name || 'Layer').slice(0, 255)], luniLen = 4 + uni.length * 2, luniPad = luniLen % 2;
    rec.u32(4 + 4 + padded + 12 + luniLen + luniPad + (L.locked ? 16 : 0));
    rec.u32(0); rec.u32(0);
    rec.u8(nm.length); rec.ascii(nm); for (let k = nm.length + 1; k < padded; k++) rec.u8(0);
    rec.ascii('8BIM'); rec.ascii('luni'); rec.u32(luniLen + luniPad); rec.u32(uni.length); for (const c of uni) rec.u16(c.charCodeAt(0)); if (luniPad) rec.u8(0);
    if (L.locked) { rec.ascii('8BIM'); rec.ascii('lspf'); rec.u32(4); rec.u32(0x80000000); }
    for (const c of chans) c.write();
  }
  let info = 2 + rec.length + data.length; const infoPad = info % 2; info += infoPad;
  // ---- file
  const f = new Out();
  f.ascii('8BPS'); f.u16(1); f.bytes([0, 0, 0, 0, 0, 0]); f.u16(3); f.u32(height); f.u32(width); f.u16(8); f.u16(3);
  f.u32(0); // colour mode data
  if (ppi > 0) { // image resources: just ResolutionInfo (1005), pixels per inch both ways
    const fx = Math.round(ppi * 65536);
    f.u32(28); f.ascii('8BIM'); f.u16(1005); f.u16(0); f.u32(16);
    f.u32(fx); f.u16(1); f.u16(1); f.u32(fx); f.u16(1); f.u16(1);
  } else f.u32(0); // image resources
  f.u32(4 + info + 4); // layer and mask information
  f.u32(info); f.i16(layers.length); f.parts.push(...rec.parts, ...data.parts); f.length += rec.length + data.length; if (infoPad) f.u8(0);
  f.u32(0); // global layer mask
  // ---- flattened picture: RGB, packed, all rows of R then G then B
  if (merged && merged.packed) { f.u16(1); for (const ch of [0, 1, 2]) f.bytes(countBytes(merged.packed[ch].counts)); for (const ch of [0, 1, 2]) for (const b of merged.packed[ch].chunks) f.bytes(b); return f.blob(); }
  const full = { top: 0, left: 0, bottom: height, right: width }, packed = [0, 1, 2].map((ch) => packChannel(merged, width, full, ch));
  f.u16(1); for (const p of packed) for (const c of p.counts) f.u16(c); for (const p of packed) f.bytes(p.bytes);
  return f.blob();
}

// Reads back what writePsd wrote (enough to check it): size, layer names, boxes, modes,
// and each layer's pixels. Used by the tests.
// opts.want(layer) -> false skips unpacking that layer's pixels; opts.merged === false skips the
// flattened picture. Both keep memory down on a big canvas.
export function readPsd(buf, opts = {}) {
  const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength); let p = 0;
  const u16 = () => { const v = dv.getUint16(p); p += 2; return v; }, i16 = () => { const v = dv.getInt16(p); p += 2; return v; }, u32 = () => { const v = dv.getUint32(p); p += 4; return v; }, str = (n) => { const s = String.fromCharCode(...u.subarray(p, p + n)); p += n; return s; };
  if (str(4) !== '8BPS') throw new Error('not a PSD');
  u16(); p += 6; const channels = u16(), height = u32(), width = u32(), depth = u16(), mode = u16();
  const skip = () => { const n = u32(); p += n; };
  skip();
  let ppi = 0; { const n = u32(), end = p + n; while (p + 12 <= end) { str(4); const id = u16(); const nl = u.at(p); p += (nl + 2) & ~1; const len = u32(), e2 = p + len + (len & 1); if (id === 1005 && len >= 16) ppi = dv.getUint32(p) / 65536; p = e2; } p = end; }
  const lmEnd = u32() + p, infoLen = u32(), infoEnd = p + infoLen, count = Math.abs(i16()), layers = [];
  for (let k = 0; k < count; k++) {
    const top = u32(), left = u32(), bottom = u32(), right = u32(), n = u16(), ch = [];
    for (let c = 0; c < n; c++) ch.push({ id: i16(), len: u32() });
    str(4); const blend = str(4), opacity = u.at(p++); p++; const flags = u.at(p++); p++;
    const extra = u32(), extraEnd = p + extra; skip(); skip(); const nl = u.at(p); const name = String.fromCharCode(...u.subarray(p + 1, p + 1 + nl));
    let unicode = null, locked = false; p += Math.ceil((nl + 1) / 4) * 4;
    while (p + 12 <= extraEnd) { str(4); const key = str(4), len = u32(), end = p + len; if (key === 'luni') { const n2 = u32(); unicode = ''; for (let i = 0; i < n2; i++) unicode += String.fromCharCode(u16()); } else if (key === 'lspf' && len >= 4) locked = u32() !== 0; p = end; }
    p = extraEnd;
    layers.push({ top, left, bottom, right, ch, blend, opacity, hidden: !!(flags & 2), locked, name: unicode ?? name });
  }
  const unpack = (h, w, rows) => { const out = new Uint8Array(w * h); let o = 0; for (let y = 0; y < h; y++) { const end = p + rows[y]; while (p < end) { const b = dv.getInt8(p++); if (b >= 0) { for (let i = 0; i <= b; i++) out[o++] = u[p++]; } else if (b !== -128) { const v = u[p++]; for (let i = 0; i < 1 - b; i++) out[o++] = v; } } } return out; };
  for (const L of layers) {
    const w = L.right - L.left, h = L.bottom - L.top; L.pixels = {};
    const skipL = opts.want && !opts.want(L);
    for (const c of L.ch) { if (skipL) { p += c.len; continue; } const end = p + c.len, comp = u16(); if (comp === 1 && w && h) { const rows = []; for (let y = 0; y < h; y++) rows.push(u16()); L.pixels[c.id] = unpack(h, w, rows); } p = end; }
  }
  p = lmEnd;
  if (opts.merged === false) return { width, height, depth, mode, channels, layers, merged: [], infoEnd, ppi };
  const comp = u16(), merged = [];
  if (comp === 1) { const rows = []; for (let k = 0; k < channels * height; k++) rows.push(u16()); for (let c = 0; c < channels; c++) merged.push(unpack(height, width, rows.slice(c * height, (c + 1) * height))); }
  return { width, height, depth, mode, channels, layers, merged, infoEnd, ppi };
}
