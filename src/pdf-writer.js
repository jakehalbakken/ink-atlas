// A small PDF writer for measured prints: pages of any size, drawn in millimetres from the top left,
// vector lines, text in Helvetica, and Flate-compressed grey or colour pictures shared across pages.
// Pure: compression comes in as `deflate(Uint8Array) -> Promise<Uint8Array>` (zlib format), so the
// browser uses CompressionStream and the tests use node's zlib.

const PT = 72 / 25.4;
const n2 = (v) => (Math.round(v * 1000) / 1000).toString();
// Helvetica widths (per 1000 em) for printable ASCII, so text can be centred or right aligned.
const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
export const ascii = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\x7e]/g, '?');
export function textWidthMm(s, sizePt, bold = false) { let w = 0; for (const ch of ascii(s)) w += HW[ch.charCodeAt(0) - 32] || 556; return w / 1000 * sizePt * (bold ? 1.06 : 1) / PT; }
const esc = (s) => ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export class PdfPage {
  constructor(wMm, hMm) { this.w = wMm; this.h = hMm; this.ops = []; this.images = new Set(); }
  X(x) { return n2(x * PT); }
  Y(y) { return n2((this.h - y) * PT); }
  push(s) { this.ops.push(s); return this; }
  save() { return this.push('q'); }
  restore() { return this.push('Q'); }
  stroke(gray = 0, width = 0.25, dash = null) { return this.push(`${n2(gray)} G ${n2(width * PT)} w ${dash ? `[${dash.map((d) => n2(d * PT)).join(' ')}] 0 d` : '[] 0 d'}`); }
  strokeRGB(r, g, b, width = 0.25, dash = null) { return this.push(`${n2(r)} ${n2(g)} ${n2(b)} RG ${n2(width * PT)} w ${dash ? `[${dash.map((d) => n2(d * PT)).join(' ')}] 0 d` : '[] 0 d'}`); }
  fill(gray = 0) { return this.push(`${n2(gray)} g`); }
  fillRGB(r, g, b) { return this.push(`${n2(r)} ${n2(g)} ${n2(b)} rg`); }
  line(x1, y1, x2, y2) { return this.push(`${this.X(x1)} ${this.Y(y1)} m ${this.X(x2)} ${this.Y(y2)} l S`); }
  rect(x, y, w, h, mode = 'S') { return this.push(`${this.X(x)} ${this.Y(y + h)} ${n2(w * PT)} ${n2(h * PT)} re ${mode}`); }
  poly(pts, close = true, mode = 'S') { if (pts.length < 2) return this; const s = pts.map((p, i) => `${this.X(p[0])} ${this.Y(p[1])} ${i ? 'l' : 'm'}`).join(' '); return this.push(`${s}${close ? ' h' : ''} ${mode}`); }
  circle(cx, cy, r, mode = 'S') {
    const k = 0.5523 * r, p = (x, y) => `${this.X(x)} ${this.Y(y)}`;
    return this.push(`${p(cx + r, cy)} m ${p(cx + r, cy - k)} ${p(cx + k, cy - r)} ${p(cx, cy - r)} c ${p(cx - k, cy - r)} ${p(cx - r, cy - k)} ${p(cx - r, cy)} c ${p(cx - r, cy + k)} ${p(cx - k, cy + r)} ${p(cx, cy + r)} c ${p(cx + k, cy + r)} ${p(cx + r, cy + k)} ${p(cx + r, cy)} c ${mode}`);
  }
  clip(x, y, w, h) { return this.push(`${this.X(x)} ${this.Y(y + h)} ${n2(w * PT)} ${n2(h * PT)} re W n`); }
  // x, y is where the baseline starts (align 'left'), or its middle or end
  text(x, y, s, size = 8, { bold = false, align = 'left' } = {}) {
    const w = textWidthMm(s, size, bold), x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    return this.push(`BT /${bold ? 'F2' : 'F1'} ${n2(size)} Tf ${this.X(x0)} ${this.Y(y)} Td (${esc(s)}) Tj ET`);
  }
  // a picture covering x, y, w, h (mm); flipX draws it mirrored left to right
  image(name, x, y, w, h, flipX = false) {
    this.images.add(name);
    const a = flipX ? -w * PT : w * PT, e = flipX ? (x + w) * PT : x * PT;
    return this.push(`q ${n2(a)} 0 0 ${n2(h * PT)} ${n2(e)} ${this.Y(y + h)} cm /${name} Do Q`);
  }
  get content() { return this.ops.join('\n'); }
}

// images: { name: { w, h, channels: 1 | 3, data: Uint8Array (rows from the top) } }
export async function buildPdf(pages, images, { deflate, title = 'Ink Atlas', subject = '' } = {}) {
  const enc = new TextEncoder(), parts = [], offsets = [];
  let length = 0;
  const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); length += b.length; };
  const objs = []; // [num] = async () => [header string, optional stream bytes]
  const alloc = () => objs.push(null);
  const catalog = alloc(), pagesObj = alloc(), f1 = alloc(), f2 = alloc(), info = alloc();
  const imgNum = {};
  for (const name of Object.keys(images)) imgNum[name] = alloc();
  const pageNums = pages.map(() => ({ page: alloc(), content: alloc() }));
  const set = (num, fn) => { objs[num - 1] = fn; };
  set(catalog, async () => [`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`]);
  set(pagesObj, async () => [`<< /Type /Pages /Kids [${pageNums.map((p) => `${p.page} 0 R`).join(' ')}] /Count ${pages.length} >>`]);
  set(f1, async () => ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
  set(f2, async () => ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
  set(info, async () => [`<< /Title (${esc(title)}) /Subject (${esc(subject)}) /Producer (Ink Atlas) >>`]);
  for (const [name, im] of Object.entries(images)) set(imgNum[name], async () => {
    const z = await deflate(im.data);
    return [`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /${im.channels === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Interpolate false /Filter /FlateDecode /Length ${z.length} >>`, z];
  });
  pages.forEach((pg, i) => {
    const { page, content } = pageNums[i];
    const xo = [...pg.images].map((n) => `/${n} ${imgNum[n]} 0 R`).join(' ');
    // MediaBox, and TrimBox the same, so "actual size" has nothing else to fit to
    const box = `[0 0 ${n2(pg.w * PT)} ${n2(pg.h * PT)}]`;
    set(page, async () => [`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox ${box} /CropBox ${box} /TrimBox ${box} /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xo ? ` /XObject << ${xo} >>` : ''} >> /Contents ${content} 0 R >>`]);
    set(content, async () => { const b = enc.encode(pg.content); return [`<< /Length ${b.length} >>`, b]; });
  });
  put('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  for (let i = 0; i < objs.length; i++) {
    offsets[i] = length;
    const [head, stream] = await objs[i]();
    put(`${i + 1} 0 obj\n${head}\n`);
    if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); }
    put('endobj\n');
  }
  const xref = length;
  put(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
  for (const o of offsets) put(`${String(o).padStart(10, '0')} 00000 n \n`);
  put(`trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// Browser compression: CompressionStream('deflate') gives the zlib format that FlateDecode wants.
export async function deflateBrowser(bytes) {
  const cs = new CompressionStream('deflate'), w = cs.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
