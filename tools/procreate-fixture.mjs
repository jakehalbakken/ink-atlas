// Builds .procreate files for tests: a stored ZIP of Document.archive (an NSKeyedArchiver
// binary plist) and per-layer tile folders, LZO1X or LZ4 (Apple bv41 frames) compressed,
// premultiplied RGBA with rows counted from the bottom, as Procreate writes them.

/* ---------- ZIP (stored) ---------- */
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) {
  const enc = new TextEncoder(), parts = [], dir = []; let off = 0;
  for (const { name, data } of files) {
    const n = enc.encode(name), h = new Uint8Array(30 + n.length), v = new DataView(h.buffer), crc = crc32(data);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true); v.setUint16(26, n.length, true); h.set(n, 30);
    const c = new Uint8Array(46 + n.length), w = new DataView(c.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint32(16, crc, true); w.setUint32(20, data.length, true); w.setUint32(24, data.length, true); w.setUint16(28, n.length, true); w.setUint32(42, off, true); c.set(n, 46);
    parts.push(h, data); dir.push(c); off += h.length + data.length;
  }
  const dsize = dir.reduce((s, c) => s + c.length, 0), e = new Uint8Array(22), ev = new DataView(e.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, dsize, true); ev.setUint32(16, off, true);
  const all = [...parts, ...dir, e], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let p = 0; for (const x of all) { out.set(x, p); p += x.length; }
  return out;
}

/* ---------- binary plist ---------- */
export const UID = (n) => ({ UID: n, __uid: true });
export function bplist(root) {
  const objs = [], bytes = [];
  const add = (v) => {
    const i = objs.length; objs.push(null);
    if (v && typeof v === 'object' && !v.__uid && !(v instanceof Uint8Array)) {
      if (Array.isArray(v)) objs[i] = { arr: v.map(add) };
      else { const ks = Object.keys(v); objs[i] = { keys: ks.map(add), vals: ks.map((k) => add(v[k])) }; }
    } else objs[i] = { v };
    return i;
  };
  add(root);
  const ref = 2; // up to 65535 objects
  const lenHead = (hi, n) => (n < 15 ? [(hi << 4) | n] : [(hi << 4) | 15, 0x12, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const r = (i) => [i >> 8, i & 255];
  const offsets = [];
  const out = [...'bplist00'].map((c) => c.charCodeAt(0));
  for (const o of objs) {
    offsets.push(out.length);
    if (o.arr) out.push(...lenHead(10, o.arr.length), ...o.arr.flatMap(r));
    else if (o.keys) out.push(...lenHead(13, o.keys.length), ...o.keys.flatMap(r), ...o.vals.flatMap(r));
    else {
      const v = o.v;
      if (v === null || v === undefined) out.push(0);
      else if (v === false) out.push(8); else if (v === true) out.push(9);
      else if (v.__uid) out.push(0x81, (v.UID >> 8) & 255, v.UID & 255);
      else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 2 ** 31) out.push(0x12, (v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      else if (typeof v === 'number') { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, v); out.push(0x23, ...new Uint8Array(b.buffer)); }
      else if (typeof v === 'string') {
        if (/^[\x00-\x7f]*$/.test(v)) out.push(...lenHead(5, v.length), ...[...v].map((c) => c.charCodeAt(0)));
        else { out.push(...lenHead(6, v.length)); for (let k = 0; k < v.length; k++) out.push(v.charCodeAt(k) >> 8, v.charCodeAt(k) & 255); }
      } else if (v instanceof Uint8Array) out.push(...lenHead(4, v.length), ...v);
      else throw new Error('cannot write ' + typeof v);
    }
  }
  const table = out.length;
  for (const o of offsets) out.push((o >>> 24) & 255, (o >>> 16) & 255, (o >>> 8) & 255, o & 255);
  const trailer = new Uint8Array(32), tv = new DataView(trailer.buffer);
  trailer[6] = 4; trailer[7] = ref; tv.setBigUint64(8, BigInt(objs.length)); tv.setBigUint64(16, 0n); tv.setBigUint64(24, BigInt(table));
  return Uint8Array.from([...out, ...trailer]);
}

// NSKeyedArchiver: tree of { $class: 'Name', ...fields }, arrays (NSArray) and plain values.
export function keyedArchive(root) {
  const objects = ['$null'], classes = new Map();
  const cls = (name) => { if (!classes.has(name)) { classes.set(name, objects.length); objects.push({ $classname: name, $classes: [name, 'NSObject'] }); } return UID(classes.get(name)); };
  const put = (v) => {
    if (v === null || v === undefined) return UID(0);
    if (typeof v === 'boolean' || typeof v === 'number') return v;
    if (typeof v === 'string') { objects.push(v); return UID(objects.length - 1); }
    if (Array.isArray(v)) { const i = objects.length; objects.push(null); objects[i] = { 'NS.objects': v.map(put), $class: cls('NSArray') }; return UID(i); }
    const i = objects.length; objects.push(null);
    const o = { $class: cls(v.$class || 'NSObject') };
    for (const k of Object.keys(v)) if (k !== '$class') o[k] = put(v[k]);
    objects[i] = o; return UID(i);
  };
  const top = put(root);
  return bplist({ $version: 100000, $archiver: 'NSKeyedArchiver', $top: { root: top }, $objects: objects });
}

/* ---------- LZ4 in Apple's bv41 frames (greedy, real back references) ---------- */
export function lz4Frame(src) {
  const out = [], n = src.length, table = new Map();
  let anchor = 0, i = 0;
  const lenBytes = (x) => { const b = []; while (x >= 255) { b.push(255); x -= 255; } b.push(x); return b; };
  while (i + 12 < n) {
    const key = src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24), cand = table.get(key); table.set(key, i);
    if (cand !== undefined && i - cand < 65535 && src[cand] === src[i] && src[cand + 1] === src[i + 1] && src[cand + 2] === src[i + 2] && src[cand + 3] === src[i + 3]) {
      let len = 4; while (i + len < n - 5 && src[cand + len] === src[i + len]) len++;
      const lit = i - anchor, ml = len - 4;
      out.push(((lit >= 15 ? 15 : lit) << 4) | (ml >= 15 ? 15 : ml));
      if (lit >= 15) out.push(...lenBytes(lit - 15));
      for (let k = anchor; k < i; k++) out.push(src[k]);
      out.push((i - cand) & 255, (i - cand) >> 8);
      if (ml >= 15) out.push(...lenBytes(ml - 15));
      i += len; anchor = i;
    } else i++;
  }
  const lit = n - anchor; out.push((lit >= 15 ? 15 : lit) << 4); if (lit >= 15) out.push(...lenBytes(lit - 15)); for (let k = anchor; k < n; k++) out.push(src[k]);
  const head = new Uint8Array(12), hv = new DataView(head.buffer);
  head.set([0x62, 0x76, 0x34, 0x31]); hv.setUint32(4, n, true); hv.setUint32(8, out.length, true);
  return Uint8Array.from([...head, ...out, 0x62, 0x76, 0x34, 0x24]);
}

/* ---------- LZO1X (literal runs and M1 to M4 back references) ---------- */
export function lzo1x(src) {
  const out = [], n = src.length, table = new Map();
  let anchor = 0, i = 0, state = 0, prevLit = -1; // state: literals pending in the last match's low bits
  const more = (x) => { while (x > 255) { out.push(0); x -= 255; } out.push(x); };
  const flushLits = (upto) => {
    const L = upto - anchor; if (!L) { prevLit = 0; return; }
    if (out.length === 0) { // the first run
      if (L <= 238) out.push(17 + L); else { out.push(0); more(L - 18); }
    } else if (L <= 3 && prevLit === null) { out[state] |= L; } // in the last match's low bits
    else if (L <= 18) out.push(L - 3);
    else { out.push(0); more(L - 18); }
    for (let k = anchor; k < upto; k++) out.push(src[k]);
    prevLit = L;
  };
  while (i + 4 < n) {
    const key = src[i] | (src[i + 1] << 8) | (src[i + 2] << 16), cand = table.get(key); table.set(key, i);
    const d = cand === undefined ? 0 : i - cand;
    if (d && d <= 49151 && src[cand] === src[i] && src[cand + 1] === src[i + 1] && src[cand + 2] === src[i + 2]) {
      let len = 3; while (i + len < n && src[cand + len] === src[i + len] && len < 2000) len++;
      flushLits(i);
      if (len <= 8 && d <= 2048) { // M2
        out.push(((len - 1) << 5) | (((d - 1) & 7) << 2)); state = out.length - 1; out.push((d - 1) >> 3);
      } else if (d <= 16384) { // M3
        if (len - 2 <= 31) out.push(32 | (len - 2)); else { out.push(32); more(len - 2 - 31); }
        state = out.length; out.push(((d - 1) & 63) << 2, (d - 1) >> 6);
      } else { // M4
        const dd = d - 0x4000;
        if (len - 2 <= 7) out.push(16 | ((dd & 0x4000) >> 11) | (len - 2)); else { out.push(16 | ((dd & 0x4000) >> 11)); more(len - 2 - 7); }
        state = out.length; out.push((dd & 63) << 2, (dd >> 6) & 255);
      }
      i += len; anchor = i; prevLit = null;
    } else i++;
  }
  // the last literals, then the end marker
  if (n - anchor) { if (prevLit === null && n - anchor <= 3) { out[state] |= n - anchor; for (let k = anchor; k < n; k++) out.push(src[k]); } else flushLits(n); }
  out.push(17, 0, 0);
  return Uint8Array.from(out);
}

// layers: [{ uuid, name, hidden, opacity, pixels (W x H straight RGBA, rows from the top) }]
// opts: { width, height, tile, three, lzo (use LZO for every other tile), composite }
export function procreateFile({ width, height, tile = 256, three = true, layers, composite = null, lzoEvery = 2 }) {
  const files = [];
  let count = 0;
  const pack = (uuid, px) => {
    for (let row = 0; row * tile < height; row++) for (let col = 0; col * tile < width; col++) {
      const x0 = col * tile, yb = row * tile, w = Math.min(tile, width - x0), h = Math.min(tile, height - yb);
      const t = new Uint8Array(w * h * 4); let any = false;
      for (let ly = 0; ly < h; ly++) {
        const y = height - 1 - (yb + ly);
        for (let lx = 0; lx < w; lx++) {
          const s = (y * width + x0 + lx) * 4, d = (ly * w + lx) * 4, a = px[s + 3];
          t[d] = Math.round(px[s] * a / 255); t[d + 1] = Math.round(px[s + 1] * a / 255); t[d + 2] = Math.round(px[s + 2] * a / 255); t[d + 3] = a; if (a) any = true;
        }
      }
      if (!any) continue; // Procreate drops empty tiles
      const lzo = lzoEvery && count++ % lzoEvery === 1;
      files.push({ name: `${uuid}/${col}~${row}.${lzo ? 'chunk' : 'lz4'}`, data: lzo ? lzo1x(t) : lz4Frame(t) });
    }
  };
  for (const l of layers) pack(l.uuid, l.pixels);
  if (composite) pack(composite.uuid, composite.pixels);
  const silica = (l) => ({ $class: 'SilicaLayer', UUID: l.uuid, name: l.name, hidden: !!l.hidden, opacity: l.opacity ?? 1, sizeWidth: width, sizeHeight: height });
  const doc = { $class: 'SilicaDocument', size: `{${width}, ${height}}`, tileSize: tile, orientation: 1, flippedHorizontally: false, flippedVertically: false, featureSet: three ? 2 : 1 };
  if (three) {
    const mat = (l) => ({ $class: 'ValkyrieMaterialLayer', name: l.name, hidden: !!l.hidden, opacity: l.opacity ?? 1, albedoLayer: silica(l), roughnessLayer: silica({ uuid: l.uuid + '-R', name: 'r' }), metallicLayer: silica({ uuid: l.uuid + '-M', name: 'm' }) });
    doc.unwrappedLayers3D = [{ $class: 'ValkyrieDocumentTextureSet', name: 'Body', layers: layers.map(mat), textureSetComposite: composite ? mat({ ...composite, name: 'Composite' }) : null }];
    doc.layers = [];
  } else {
    doc.layers = layers.map(silica);
    doc.composite = composite ? silica(composite) : null;
  }
  files.unshift({ name: 'Document.archive', data: keyedArchive(doc) });
  return zip(files);
}
