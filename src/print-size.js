// Print at real size: a PDF with every visible tattoo at the size it has on the body,
// so it can be printed, cut out and held against the skin, or taken to the artist.
// US Letter pages with a 1 inch check square on each. A piece bigger than one page is
// split into numbered parts that line up edge to edge. The layout and the PDF writer
// are plain functions so they can be tested without a browser.

export const PAGE = Object.freeze({ w: 612, h: 792, margin: 36, header: 30, footer: 96, gap: 18, label: 14 });
const PT_PER_CM = 72 / 2.54;

// Size on paper, in points, from the tattoo's width on the model.
export function pieceSize(t, heightCm) {
  const wCm = t.width * 100 * heightCm / 175, hCm = wCm / (t.aspect || 1);
  return { wCm, hCm, w: wCm * PT_PER_CM, h: hCm * PT_PER_CM };
}

// pieces: [{ id, w, h, labelW }] in points (labelW: room the caption needs). Returns pages: [{ items: [{ id, x, y, w, h, clip, part }] }]
// where (x, y) is the piece's bottom-left corner in PDF points and clip, when set, is the
// part of the page this item shows (for pieces split over several pages).
export function layoutPrint(pieces, page = PAGE) {
  const left = page.margin, right = page.w - page.margin, top = page.h - page.margin - page.header, bottom = page.margin + page.footer;
  const areaW = right - left, areaH = top - bottom - page.label;
  const pages = [];
  let cur = null, x = left, rowTop = top, rowH = 0;
  const newPage = () => { cur = { items: [] }; pages.push(cur); x = left; rowTop = top; rowH = 0; };
  for (const p of pieces) {
    if (!(p.w > 0 && p.h > 0)) continue;
    if (p.w <= areaW && p.h <= areaH) {
      if (!cur) newPage();
      const span = Math.min(areaW, Math.max(p.w, p.labelW || 0));
      if (x + span > right + 1e-6) { rowTop -= rowH + page.label + page.gap; x = left; rowH = 0; }
      if (rowTop - page.label - p.h < bottom - 1e-6) newPage();
      cur.items.push({ id: p.id, x, y: rowTop - page.label - p.h, w: p.w, h: p.h, labelY: rowTop - page.label + 4 });
      x += span + page.gap; rowH = Math.max(rowH, p.h);
      continue;
    }
    // Too big for one page: split into a grid of parts, each on its own page.
    const cols = Math.ceil(p.w / areaW), rows = Math.ceil(p.h / areaH);
    const tw = p.w / cols, th = p.h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      newPage();
      const cx = left, cy = top - page.label - th;
      cur.items.push({ id: p.id, x: cx - c * tw, y: cy - (rows - 1 - r) * th, w: p.w, h: p.h, clip: { x: cx, y: cy, w: tw, h: th }, part: { row: r + 1, col: c + 1, rows, cols }, labelY: top - page.label + 4 });
    }
    cur = null; // the next piece starts on a fresh page
  }
  return pages;
}

/* ---------- a small PDF writer: JPEG images, Helvetica text, lines ---------- */
const latin = (s) => String(s).replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, (c) => '\\' + c);
const n = (v) => (Math.round(v * 100) / 100).toString();
function bytes(s) { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; }

// pages: from layoutPrint. art: id -> { name, note, jpeg: { width, height, data: Uint8Array } }.
export function buildPrintPdf(pages, art, { title = 'Ink Atlas', page = PAGE } = {}) {
  if (!pages.length) throw new Error('Nothing to print');
  const chunks = [], offsets = [];
  let length = 0;
  const push = (b) => { const u = typeof b === 'string' ? bytes(b) : b; chunks.push(u); length += u.length; };
  const objects = []; // index = object number - 1, value = function writing its body
  const reserve = () => { objects.push(null); return objects.length; };
  const catalog = reserve(), pagesObj = reserve(), font = reserve(), fontBold = reserve();
  const imageObj = {};
  for (const id of new Set(pages.flatMap((pg) => pg.items.map((i) => i.id)))) {
    const a = art[id]; if (!a || !a.jpeg) throw new Error('Missing artwork');
    imageObj[id] = reserve();
  }
  const pageObjs = [];
  pages.forEach((pg, pi) => {
    const pageNo = reserve(), contentNo = reserve(); pageObjs.push(pageNo);
    const xo = [...new Set(pg.items.map((i) => i.id))].map((id) => `/Im${imageObj[id]} ${imageObj[id]} 0 R`).join(' ');
    let s = '';
    const text = (x, y, size, str, bold) => { s += `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${n(x)} ${n(y)} Td (${latin(str)}) Tj ET\n`; };
    text(page.margin, page.h - page.margin - 14, 13, title, true);
    text(page.w - page.margin - 70, page.h - page.margin - 14, 9, `Page ${pi + 1} of ${pages.length}`);
    for (const it of pg.items) {
      const a = art[it.id];
      if (it.clip) s += `q ${n(it.clip.x)} ${n(it.clip.y)} ${n(it.clip.w)} ${n(it.clip.h)} re W n\n`; else s += 'q\n';
      s += `${n(it.w)} 0 0 ${n(it.h)} ${n(it.x)} ${n(it.y)} cm /Im${imageObj[it.id]} Do Q\n`;
      // a thin cut line around what is on this page
      const box = it.clip || it;
      s += `q 0.6 G 0.5 w [3 3] 0 d ${n(box.x)} ${n(box.y)} ${n(box.w)} ${n(box.h)} re S Q\n`;
      const lx = box.x;
      const part = it.part ? `  part ${(it.part.row - 1) * it.part.cols + it.part.col} of ${it.part.rows * it.part.cols} (row ${it.part.row}, column ${it.part.col}): line up the edges` : '';
      text(lx, it.labelY, 9, `${a.name}  ${a.note || ''}${part}`, !!it.part);
    }
    // 1 inch check square and a 5 cm bar
    const fx = page.margin, fy = page.margin + 22;
    s += `q 0 G 1 w ${n(fx)} ${n(fy)} 72 72 re S Q\n`;
    s += `q 0 G 1 w ${n(fx + 96)} ${n(fy)} m ${n(fx + 96 + 5 * PT_PER_CM)} ${n(fy)} l S`;
    for (let c = 0; c <= 5; c++) s += ` ${n(fx + 96 + c * PT_PER_CM)} ${n(fy)} m ${n(fx + 96 + c * PT_PER_CM)} ${n(fy + (c % 5 ? 6 : 12))} l S`;
    s += ' Q\n';
    text(fx + 22, fy + 31, 9, '1 inch');
    text(fx + 96, fy + 18, 9, '5 cm');
    text(fx, page.margin + 6, 9, 'Print at 100% (Actual size, no Fit to page). The square should measure exactly 1 inch.');
    const data = bytes(s);
    objects[contentNo - 1] = () => { push(`<< /Length ${data.length} >>\nstream\n`); push(data); push('\nendstream'); };
    objects[pageNo - 1] = () => push(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${page.w} ${page.h}] /Resources << /Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >> /XObject << ${xo} >> >> /Contents ${contentNo} 0 R >>`);
  });
  objects[catalog - 1] = () => push(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  objects[pagesObj - 1] = () => push(`<< /Type /Pages /Kids [${pageObjs.map((p) => p + ' 0 R').join(' ')}] /Count ${pageObjs.length} >>`);
  objects[font - 1] = () => push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects[fontBold - 1] = () => push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  for (const [id, no] of Object.entries(imageObj)) {
    const j = art[id].jpeg;
    objects[no - 1] = () => { push(`<< /Type /XObject /Subtype /Image /Width ${j.width} /Height ${j.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.data.length} >>\nstream\n`); push(j.data); push('\nendstream'); };
  }
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  objects.forEach((write, i) => { offsets[i] = length; push(`${i + 1} 0 obj\n`); write(); push('\nendobj\n'); });
  const xref = length;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const o of offsets) push(String(o).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length); let at = 0; for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

// Readable size note, matching the app's own readout.
export function sizeNote(s) {
  const inch = (v) => (v / 2.54).toFixed(1);
  return `${inch(s.wCm)} x ${inch(s.hCm)} in (${s.wCm.toFixed(1)} x ${s.hCm.toFixed(1)} cm)`;
}
