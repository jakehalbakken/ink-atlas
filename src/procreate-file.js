// Procreate's own file (.procreate): a ZIP holding Document.archive, a keyed archive that
// describes the canvas and its layers, and one folder per layer (named by the layer's UUID)
// of 256-pixel tiles, `col~row.chunk`, each LZO1X or LZ4 compressed (LZ4 in Apple's bv41
// frames on newer versions), premultiplied RGBA, rows counted from the bottom.
//
// For a 3D painting the canvas is the model's texture, so each paint layer comes back in the
// body's own texture layout, apart from the others. That is what lets each layer painted in
// Procreate come back as its own tattoo.
import { readZip } from './procreate-import.js';

/* ---------- binary property lists ---------- */
export function readBplist(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.length < 40 || String.fromCharCode(...u8.subarray(0, 6)) !== 'bplist') throw new Error('not a property list');
  const t = u8.length - 32, offSize = u8[t + 6], refSize = u8[t + 7];
  const count = Number(dv.getBigUint64(t + 8)), top = Number(dv.getBigUint64(t + 16)), table = Number(dv.getBigUint64(t + 24));
  if (count > 5e6 || table + count * offSize > u8.length) throw new Error('damaged property list');
  const uint = (p, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + u8[p + i]; return v; };
  const offset = (i) => uint(table + i * offSize, offSize);
  const memo = new Map();
  const length = (p, low) => {
    if (low !== 15) return [low, p + 1];
    const n = 1 << (u8[p + 1] & 15); return [uint(p + 2, n), p + 2 + n];
  };
  const read = (i, depth = 0) => {
    if (memo.has(i)) return memo.get(i);
    if (depth > 200 || i >= count) throw new Error('damaged property list');
    const p = offset(i), m = u8[p], hi = m >> 4, low = m & 15;
    let v;
    if (m === 0x00) v = null;
    else if (m === 0x08) v = false;
    else if (m === 0x09) v = true;
    else if (hi === 1) { const n = 1 << low; v = n === 8 ? Number(dv.getBigInt64(p + 1)) : uint(p + 1, n); }
    else if (hi === 2) v = low === 2 ? dv.getFloat32(p + 1) : dv.getFloat64(p + 1);
    else if (m === 0x33) v = dv.getFloat64(p + 1);
    else if (hi === 4) { const [n, s] = length(p, low); v = u8.subarray(s, s + n); }
    else if (hi === 5) { const [n, s] = length(p, low); v = String.fromCharCode(...u8.subarray(s, s + n)); }
    else if (hi === 6) { const [n, s] = length(p, low); let str = ''; for (let k = 0; k < n; k++) str += String.fromCharCode(dv.getUint16(s + k * 2)); v = str; }
    else if (hi === 8) v = { UID: uint(p + 1, low + 1) };
    else if (hi === 10 || hi === 12) { const [n, s] = length(p, low); v = []; memo.set(i, v); for (let k = 0; k < n; k++) v.push(read(uint(s + k * refSize, refSize), depth + 1)); }
    else if (hi === 13) {
      const [n, s] = length(p, low); v = {}; memo.set(i, v);
      for (let k = 0; k < n; k++) v[read(uint(s + k * refSize, refSize), depth + 1)] = read(uint(s + (n + k) * refSize, refSize), depth + 1);
    } else throw new Error('damaged property list');
    memo.set(i, v); return v;
  };
  return read(top);
}

// NSKeyedArchiver: objects refer to each other by UID. Returns the root object with every
// reference followed; each object carries its class name as $class.
export function unarchive(plist) {
  const objs = plist && plist.$objects, top = plist && plist.$top;
  if (!Array.isArray(objs) || !top) throw new Error('not a keyed archive');
  const done = new Map();
  const isUid = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array) && Object.keys(v).length === 1 && typeof v.UID === 'number';
  const value = (v) => (isUid(v) ? resolve(v.UID) : v);
  function resolve(i) {
    if (done.has(i)) return done.get(i);
    const o = objs[i];
    if (o === '$null' || o == null) return null;
    if (typeof o !== 'object' || o instanceof Uint8Array || Array.isArray(o)) { done.set(i, o); return o; }
    const cls = o.$class ? objs[o.$class.UID] : null, name = cls && cls.$classname;
    if (name === 'NSArray' || name === 'NSMutableArray' || name === 'NSSet' || name === 'NSMutableSet' || name === 'NSOrderedSet' || name === 'NSMutableOrderedSet') {
      const a = []; done.set(i, a); for (const r of o['NS.objects'] || []) a.push(value(r)); return a;
    }
    if (name === 'NSDictionary' || name === 'NSMutableDictionary') {
      const d = {}; done.set(i, d); const ks = o['NS.keys'] || [], vs = o['NS.objects'] || [];
      ks.forEach((k, n) => { d[value(k)] = value(vs[n]); }); return d;
    }
    if (name === 'NSString' || name === 'NSMutableString') { const s = o['NS.string']; done.set(i, s); return s; }
    if (name === 'NSData' || name === 'NSMutableData') { const s = o['NS.data']; done.set(i, s); return s; }
    const out = { $class: name || '' }; done.set(i, out);
    for (const k of Object.keys(o)) if (k !== '$class') out[k] = value(o[k]);
    return out;
  }
  const rootRef = top.root || Object.values(top)[0];
  return value(rootRef);
}

/* ---------- tile compression ---------- */
// LZ4 block format.
export function lz4Block(src, out, sp = 0, end = src.length, op = 0) {
  while (sp < end) {
    const token = src[sp++];
    let lit = token >> 4;
    if (lit === 15) { let b; do { b = src[sp++]; lit += b; } while (b === 255 && sp < end); }
    if (op + lit > out.length || sp + lit > end) throw new Error('damaged tile');
    out.set(src.subarray(sp, sp + lit), op); sp += lit; op += lit;
    if (sp >= end) break;
    const dist = src[sp] | (src[sp + 1] << 8); sp += 2;
    if (!dist || dist > op) throw new Error('damaged tile');
    let len = token & 15;
    if (len === 15) { let b; do { b = src[sp++]; len += b; } while (b === 255 && sp < end); }
    len += 4;
    if (op + len > out.length) throw new Error('damaged tile');
    for (let k = 0; k < len; k++, op++) out[op] = out[op - dist];
  }
  return op;
}

// Apple's LZ4 frames: blocks 'bv41' (raw size, packed size, LZ4 block), 'bv4-' (stored),
// ending with 'bv4$'.
export function lz4Frames(src, size) {
  const out = new Uint8Array(size), dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
  let sp = 0, op = 0;
  while (sp + 4 <= src.length) {
    const tag = String.fromCharCode(src[sp], src[sp + 1], src[sp + 2], src[sp + 3]); sp += 4;
    if (tag === 'bv4$') break;
    if (tag === 'bv41') {
      const raw = dv.getUint32(sp, true), packed = dv.getUint32(sp + 4, true); sp += 8;
      if (op + raw > size || sp + packed > src.length) throw new Error('damaged tile');
      const got = lz4Block(src, out, sp, sp + packed, op);
      if (got !== op + raw) throw new Error('damaged tile');
      op = got; sp += packed;
    } else if (tag === 'bv4-') {
      const raw = dv.getUint32(sp, true); sp += 4;
      if (op + raw > size || sp + raw > src.length) throw new Error('damaged tile');
      out.set(src.subarray(sp, sp + raw), op); op += raw; sp += raw;
    } else throw new Error('damaged tile');
  }
  return out;
}

// LZO1X (as lzo1x_decompress_safe): literal runs and four kinds of back reference.
export function lzo1x(src, size) {
  const out = new Uint8Array(size);
  let ip = 0, op = 0, t = 0, mp = 0, state = 'start';
  const bad = () => { throw new Error('damaged tile'); };
  const lits = (n) => { if (op + n > size || ip + n > src.length) bad(); out.set(src.subarray(ip, ip + n), op); op += n; ip += n; };
  const copy = (n) => { if (mp < 0 || op + n > size) bad(); for (let k = 0; k < n; k++) out[op++] = out[mp++]; };
  const more = (base) => { let n = 0; while (src[ip] === 0) { n += 255; ip++; if (ip >= src.length) bad(); } return n + base + src[ip++]; };
  for (let guard = 0; guard < 1e8; guard++) {
    if (state === 'start') {
      if (src[ip] > 17) { t = src[ip++] - 17; if (t < 4) { state = 'next'; continue; } lits(t); state = 'first'; continue; }
      state = 'loop'; continue;
    }
    if (state === 'loop') {
      t = src[ip++];
      if (t >= 16) { state = 'match'; continue; }
      if (t === 0) t = more(15);
      lits(t + 3); state = 'first'; continue;
    }
    if (state === 'first') {
      t = src[ip++];
      if (t >= 16) { state = 'match'; continue; }
      mp = op - (1 + 0x0800) - (t >> 2) - (src[ip++] << 2);
      copy(3); state = 'done'; continue;
    }
    if (state === 'match') {
      if (t >= 64) {
        mp = op - 1 - ((t >> 2) & 7) - (src[ip++] << 3);
        copy((t >> 5) + 1);
      } else if (t >= 32) {
        t &= 31; if (t === 0) t = more(31);
        mp = op - 1 - ((src[ip] >> 2) + (src[ip + 1] << 6)); ip += 2;
        copy(t + 2);
      } else if (t >= 16) {
        mp = op - ((t & 8) << 11);
        t &= 7; if (t === 0) t = more(7);
        mp -= (src[ip] >> 2) + (src[ip + 1] << 6); ip += 2;
        if (mp === op) return out; // the end marker
        mp -= 0x4000;
        copy(t + 2);
      } else {
        mp = op - 1 - (t >> 2) - (src[ip++] << 2);
        copy(2);
      }
      state = 'done'; continue;
    }
    if (state === 'done') {
      t = src[ip - 2] & 3;
      if (t === 0) { state = 'loop'; continue; }
      state = 'next'; continue;
    }
    if (state === 'next') { lits(t); t = src[ip++]; state = 'match'; continue; }
    if (ip > src.length) bad();
  }
  bad();
}

export function tilePixels(bytes, w, h) {
  const size = w * h * 4;
  if (bytes.length >= 4 && bytes[0] === 0x62 && bytes[1] === 0x76 && bytes[2] === 0x34) return lz4Frames(bytes, size);
  if (bytes.length === size) return bytes;
  return lzo1x(bytes, size);
}

/* ---------- the document ---------- */
const TILE = /^([0-9A-Za-z-]{8,})\/(\d+)~(\d+)(\..*)?$/;

function walk(o, f, seen = new Set()) {
  if (!o || typeof o !== 'object' || o instanceof Uint8Array || seen.has(o)) return;
  seen.add(o); f(o);
  for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v, f, seen);
}
const isLayer = (o) => o && typeof o === 'object' && typeof o.UUID === 'string';

// The paint layers of a document, in Procreate's order, without their pixels.
export function documentLayers(doc) {
  const three = doc.featureSet === 2 || Array.isArray(doc.unwrappedLayers3D);
  const out = [], composite = new Set();
  const add = (layer, info = layer) => {
    if (!isLayer(layer) || out.some((l) => l.uuid === layer.UUID)) return;
    out.push({ uuid: layer.UUID, name: String(info.name || layer.name || '').slice(0, 60), hidden: !!(info.hidden || layer.hidden), opacity: typeof info.opacity === 'number' ? info.opacity : typeof layer.opacity === 'number' ? layer.opacity : 1 });
  };
  if (three) {
    // texture sets hold material layers, each with its colour (albedo) layer; the composite
    // of a texture set is the flattened picture, not a layer to bring back
    walk(doc.unwrappedLayers3D || doc, (o) => {
      for (const k of Object.keys(o)) if (/composite/i.test(k)) walk(o[k], (c) => { if (isLayer(c)) composite.add(c.UUID); });
    });
    walk(doc.unwrappedLayers3D || doc, (o) => {
      for (const k of Object.keys(o)) {
        if (!/albedo/i.test(k) || !isLayer(o[k]) || composite.has(o[k].UUID)) continue;
        add(o[k], isLayer(o) || o.name != null ? o : o[k]);
      }
    });
  } else {
    walk(doc.layers || [], (o) => { if (isLayer(o) && !Array.isArray(o.children)) add(o); });
  }
  if (isLayer(doc.composite)) composite.add(doc.composite.UUID);
  return { three, layers: out.filter((l) => !composite.has(l.uuid)), composite: [...composite] };
}

const sizeOf = (s) => { const m = /\{\s*([\d.]+)\s*,\s*([\d.]+)\s*\}/.exec(String(s || '')); return m ? [Math.round(+m[1]), Math.round(+m[2])] : null; };

// file bytes -> { width, height, three, layers: [{ uuid, name, hidden, opacity, read(S) }], composite }
// read(S) gives the layer as S x S straight-alpha RGBA, rows from the top of the canvas as
// Procreate stores it (the bottom row of tiles last).
export async function readProcreate(bytes) {
  const entries = await readZip(bytes);
  const archive = entries.find((e) => e.name === 'Document.archive');
  if (!archive) throw new Error('That is not a Procreate file.');
  const doc = unarchive(readBplist(await archive.read()));
  if (!doc || typeof doc !== 'object') throw new Error('That Procreate file could not be read.');
  const [width, height] = sizeOf(doc.size) || [0, 0], tileSize = doc.tileSize || 256;
  if (!width || !height || width > 16384 || height > 16384) throw new Error('That Procreate file could not be read.');
  const tiles = new Map();
  for (const e of entries) {
    const m = TILE.exec(e.name); if (!m) continue;
    const key = m[1], list = tiles.get(key) || []; list.push({ col: +m[2], row: +m[3], e }); tiles.set(key, list);
  }
  const { three, layers, composite } = documentLayers(doc);
  // S x S, straight (not premultiplied) RGBA, rows from the top. A smaller document is read at
  // its own size and then scaled up, so no pixel of the result is left empty.
  const reader = (uuid) => async (S) => {
    const sx = Math.min(S, width), sy = Math.min(S, height), small = await readAt(uuid, sx, sy);
    if (sx === S && sy === S) return small;
    const out = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) { const r = Math.min(sy - 1, Math.floor(y * sy / S)) * sx; for (let x = 0; x < S; x++) { const q = (r + Math.min(sx - 1, Math.floor(x * sx / S))) * 4, o = (y * S + x) * 4; out[o] = small[q]; out[o + 1] = small[q + 1]; out[o + 2] = small[q + 2]; out[o + 3] = small[q + 3]; } }
    return out;
  };
  const readAt = async (uuid, SX, SY) => {
    const list = (tiles.get(uuid) || []).sort((a, b) => (a.e.name < b.e.name ? -1 : 1));
    const sum = new Uint16Array(SX * SY * 4);
    const byTile = new Map(); for (const t of list) byTile.set(t.col + '~' + t.row, t); // the last revision of each tile
    const rows = Math.ceil(height / tileSize), xi = new Int32Array(width), yi = new Int32Array(height);
    for (let x = 0; x < width; x++) xi[x] = Math.min(SX - 1, Math.floor(x * SX / width));
    for (let y = 0; y < height; y++) yi[y] = Math.min(SY - 1, Math.floor(y * SY / height));
    for (const t of byTile.values()) {
      const x0 = t.col * tileSize, w = Math.min(tileSize, width - x0), yb = t.row * tileSize, h = Math.min(tileSize, height - yb);
      if (w <= 0 || h <= 0 || t.row >= rows) continue;
      const px = tilePixels(await t.e.read(), w, h);
      for (let ly = 0; ly < h; ly++) {
        const y = height - 1 - (yb + ly), oy = yi[y] * SX; // rows count up from the bottom
        for (let lx = 0; lx < w; lx++) {
          const s = (ly * w + lx) * 4, d = oy + xi[x0 + lx];
          sum[d * 4] += px[s]; sum[d * 4 + 1] += px[s + 1]; sum[d * 4 + 2] += px[s + 2]; sum[d * 4 + 3] += px[s + 3];
        }
      }
    }
    // every canvas pixel counts, the ones with no tile too (they are clear)
    const per = new Uint16Array(SX * SY);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) per[yi[y] * SX + xi[x]]++;
    const out = new Uint8ClampedArray(SX * SY * 4);
    for (let p = 0; p < SX * SY; p++) {
      const n = per[p] || 1, a = sum[p * 4 + 3] / n;
      if (a <= 0) continue;
      for (let k = 0; k < 3; k++) out[p * 4 + k] = (sum[p * 4 + k] / n) * 255 / a; // back from premultiplied
      out[p * 4 + 3] = a;
    }
    return out;
  };
  return {
    width, height, three, featureSet: doc.featureSet,
    layers: layers.map((l) => ({ ...l, tiles: (tiles.get(l.uuid) || []).length, read: reader(l.uuid) })),
    composite: composite.filter((u) => tiles.has(u)).map((u) => ({ uuid: u, read: reader(u) })),
  };
}
