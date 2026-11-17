// The measured wrap sent to Procreate and brought back: which layers the document holds and in
// what order, the record of each trip out (a session), the manifest that goes with the PNG
// fallback, and the checks on what comes back (same canvas, scaled, cropped or stretched).
// Pure maths, no DOM: the pictures themselves are drawn by the studio.
//
// The canvas is the flat template at its real size (`canvasFor` in wrap-geometry.js): pixels are
// round(mm / 25.4 x PPI), the whole measured shape plus padding, transparent. Four registration
// targets sit in the padding outside the shape, so a document that comes back cropped or resized
// can be put back on the template explicitly instead of being stretched to fit.

import { canvasFor, toPx, fromPx, bounds, runOnFor, develop, band, wrapAffine, outline } from './wrap-geometry.js';

export const PPI_CHOICES = [300, 600];
export const DEFAULT_PPI = 300;
export const PAD_MM = 12; // room round the shape for the registration targets
export const MARK_MM = 7; // size of each target

// iPad Safari will not make a canvas over about 16.7 million pixels, and the picture that comes
// back has to fit in one. The higher choice is the most that fits, in steps of 50, up to 600.
export const MAX_PIXELS = 16_700_000;
export function highPpi(t, runOn = runOnFor(t)) {
  const b = bounds(t, 0.5 + runOn), wIn = (b.w + 2 * PAD_MM) / 25.4, hIn = (b.h + 2 * PAD_MM) / 25.4;
  return Math.max(DEFAULT_PPI, Math.min(600, Math.floor(Math.sqrt(MAX_PIXELS / (wIn * hIn)) / 50) * 50));
}

// Top to bottom as Procreate lists them. Only Proposed garden is meant to be drawn on; the rest are
// locked references. The background is there but hidden, so the canvas stays transparent.
export const LAYERS = [
  { key: 'garden', name: 'Proposed garden', locked: false },
  { key: 'wrapref', name: 'Other end of the wrap', locked: true, opacity: 110 },
  { key: 'cactus', name: 'Existing cactus reference', locked: true, opacity: 200 },
  { key: 'ink', name: 'Existing ink mask', locked: true, opacity: 115 },
  { key: 'gap', name: 'Negative-space protection', locked: true, opacity: 115 },
  { key: 'landmarks', name: 'Anatomical landmarks', locked: true },
  { key: 'marks', name: 'Seam and alignment marks', locked: true },
  { key: 'grid', name: 'Measurement grid', locked: true, opacity: 140 },
  { key: 'background', name: 'Optional background', locked: true, hidden: true },
];
export const GARDEN = LAYERS[0].name;
export const MARKS = LAYERS.find((L) => L.key === 'marks').name;

const uid = () => Math.random().toString(36).slice(2, 10);
const code = (id) => id.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();

// The physical canvas and its registration targets (template mm, one in each corner of the
// padding, just outside the shape's box). runOn is the share of a turn added past each cut edge
// (runOnFor in wrap-geometry.js), so a design can be drawn across the cut; 0 is the plain shape.
export function packageCanvas(t, ppi = DEFAULT_PPI, runOn = runOnFor(t)) {
  if (!PPI_CHOICES.includes(ppi) && !(ppi >= 150 && ppi <= 1200)) throw new Error('Choose 300 or 600 PPI');
  const b = bounds(t, 0.5 + runOn), c = canvasFor(t, { ppi, padMm: PAD_MM, box: b }), m = PAD_MM / 2;
  const marks = [[b.minX - m, b.maxY + m], [b.maxX + m, b.maxY + m], [b.maxX + m, b.minY - m], [b.minX - m, b.minY - m]];
  return { ...c, marks, runOn };
}

// A new trip out: everything needed to check and place what comes back, nothing that could go
// stale. `calib` ties it to the measurements it was made from.
export function makeSession(region, t, { ppi = DEFAULT_PPI, at = new Date().toISOString(), id = uid(), sources = [], runOn = runOnFor(t) } = {}) {
  const c = packageCanvas(t, ppi, runOn);
  const s = {
    id, at, calib: region.calib, ppi: c.ppi, w: c.w, h: c.h, wMm: c.wMm, hMm: c.hMm, originMm: c.originMm.slice(), padMm: c.padMm,
    seam: region.seam, method: region.method, mapping: 'frustum-v1',
    levels: region.levels.map((l) => (l.gap ? { circ: l.circ, gap: l.gap } : { circ: l.circ })),
    marks: c.marks, layers: LAYERS.map((L) => L.name), sources: sources.slice(0, 50),
    name: fileBase(region, id),
  };
  if (runOn > 0) s.runOn = runOn;
  return s;
}

// What drawn past a cut edge becomes when it comes back: for each segment and each side, the strip
// it was drawn in and the exact map onto the other end of the measured shape, both in the
// session's canvas pixels. `clip` is where the folded picture lands, `from` the strip it came from.
export function foldPlan(s) {
  const ro = s.runOn || 0; if (!(ro > 0)) return [];
  const t = develop(s.levels, s.method), kx = s.w / s.wMm, ky = s.h / s.hMm;
  const P = [kx, 0, 0, -ky, s.originMm[0] * kx, s.originMm[1] * ky], Pi = [1 / kx, 0, 0, -1 / ky, -s.originMm[0], s.originMm[1]];
  const px = (pts) => pts.map(([x, y]) => [P[0] * x + P[4], P[3] * y + P[5]]);
  const out = [];
  for (let i = 0; i < t.segs.length; i++) for (const side of [1, -1]) {
    const from = band(t, i, side * 0.5, side * (0.5 + ro)), to = band(t, i, -side * 0.5, -side * (0.5 - ro));
    out.push({ from: px(from), clip: px(to), m: mul3(P, mul3(wrapAffine(t, i, -side), Pi)) });
  }
  return out;
}
// The measured shape itself in the session's canvas pixels.
export function shapeOutline(s) {
  const t = develop(s.levels, s.method), kx = s.w / s.wMm, ky = s.h / s.hMm;
  return outline(t, 160).map(([x, y]) => [(s.originMm[0] + x) * kx, (s.originMm[1] - y) * ky]);
}
export const mul3 = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
export const fileBase = (region, id) => `${(region.name || 'Measured wrap').replace(/[^\w -]+/g, '').trim() || 'Measured wrap'} ${code(id)}`;
// The background layer's name carries the trip's code, so a document can be matched to its trip
// even after it has been renamed.
export const backgroundName = (s) => `${LAYERS[LAYERS.length - 1].name} (Ink Atlas ${code(s.id)})`;
export const layerName = (L, s) => (L.key === 'background' ? backgroundName(s) : L.name);

// The order and flags for writePsd (bottom layer first).
export function psdLayers(s) { return LAYERS.slice().reverse().map((L) => ({ key: L.key, name: layerName(L, s), locked: L.locked, hidden: !!L.hidden, opacity: L.opacity ?? 255 })); }

// The manifest that goes with the PNG fallback (a zip of one PNG per layer).
export function manifest(s, region) {
  return {
    app: 'Ink Atlas', kind: 'measured-wrap', version: 1, session: s.id, made: s.at,
    region: { id: region.id, name: region.name, limb: region.limb, seam: s.seam, method: s.method, levels: s.levels, calib: s.calib },
    canvas: { widthPx: s.w, heightPx: s.h, ppi: s.ppi, widthMm: +s.wMm.toFixed(3), heightMm: +s.hMm.toFixed(3), originMm: s.originMm.map((v) => +v.toFixed(4)), mapping: s.mapping },
    registration: s.marks.map((m) => { const p = toPx(s, m[0], m[1]); return { mm: m.map((v) => +v.toFixed(3)), px: p.map((v) => +v.toFixed(2)) }; }),
    layers: LAYERS.map((L, i) => ({ order: i + 1, file: pngName(L), name: layerName(L, s), locked: L.locked, hidden: !!L.hidden })),
    note: 'Draw only on Proposed garden. The faded strips past each cut edge are the same skin as the other end: draw straight across, and it is folded back when it comes back. Keep the canvas size; if you crop or resize it, keep the Seam and alignment marks layer so Ink Atlas can put it back exactly.',
  };
}
export const pngName = (L) => `${String(LAYERS.indexOf(L) + 1).padStart(2, '0')}-${L.key}.png`;

// --- coming back ---

// Which trip a document belongs to: by the code in a layer name first, then by canvas size.
export function matchSession(sessions, { w, h, names = [] }) {
  const list = (sessions || []).slice().reverse();
  for (const n of names) { const m = /Ink Atlas ([A-Z0-9]{3,6})\)/.exec(n || ''); if (m) { const s = list.find((q) => code(q.id) === m[1]); if (s) return { session: s, by: 'code' }; } }
  const same = list.find((q) => q.w === w && q.h === h); if (same) return { session: same, by: 'size' };
  const ratio = list.find((q) => Math.abs(w / h - q.w / q.h) < 0.003 * (q.w / q.h)); if (ratio) return { session: ratio, by: 'shape' };
  return list.length ? { session: list[0], by: 'latest' } : null;
}

// The registration targets in a picture of the marks layer: blobs of ink about MARK_MM square at
// the picture's own scale, the four nearest the corners. alpha: Uint8Array of w*h (0..255).
// Returns four [x, y] centres in picture pixels (top left, top right, bottom right, bottom left),
// or null when they are not all there.
export function findMarks(alpha, w, h, expectPxPerMm) {
  // label blobs on a grid coarse enough to stay quick on a 600 PPI canvas
  const step = Math.max(1, Math.floor(Math.max(w, h) / 2400)), gw = Math.ceil(w / step), gh = Math.ceil(h / step), on = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let hit = 0; for (let yy = y * step; yy < Math.min(h, y * step + step) && !hit; yy++) for (let xx = x * step; xx < Math.min(w, x * step + step); xx++) if (alpha[yy * w + xx] > 100) { hit = 1; break; }
    on[y * gw + x] = hit;
  }
  const lab = new Int32Array(gw * gh), blobs = [], stack = [];
  for (let i = 0; i < gw * gh; i++) {
    if (!on[i] || lab[i]) continue;
    const b = { n: 0, sx: 0, sy: 0, x0: Infinity, y0: Infinity, x1: -1, y1: -1 }; lab[i] = blobs.length + 1; stack.push(i);
    while (stack.length) {
      const j = stack.pop(), x = j % gw, y = (j - x) / gw; b.n++; b.sx += x; b.sy += y;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (const k of [j - 1, j + 1, j - gw, j + gw, j - gw - 1, j - gw + 1, j + gw - 1, j + gw + 1]) {
        if (k < 0 || k >= gw * gh) continue; const kx = k % gw; if (Math.abs(kx - x) > 1 || !on[k] || lab[k]) continue;
        lab[k] = lab[i]; stack.push(k);
      }
    }
    blobs.push(b);
  }
  // a target is a near-square blob; its size tells the scale, so all four must agree
  const cands = blobs.map((b) => ({ ...b, bw: (b.x1 - b.x0 + 1) * step, bh: (b.y1 - b.y0 + 1) * step, cx: ((b.x0 + b.x1) / 2 + 0.5) * step, cy: ((b.y0 + b.y1) / 2 + 0.5) * step }))
    .filter((b) => b.bw > 6 && b.bh > 6 && Math.abs(b.bw - b.bh) <= Math.max(3 * step, 0.12 * Math.max(b.bw, b.bh)));
  const size = expectPxPerMm ? MARK_MM * expectPxPerMm : null;
  const corners = [[0, 0], [w, 0], [w, h], [0, h]], out = [];
  for (const [qx, qy] of corners) {
    let best = null, bd = Infinity;
    for (const b of cands) {
      if (size && (b.bw < size * 0.25 || b.bw > size * 4)) continue;
      const d = Math.hypot(b.cx - qx, b.cy - qy); if (d < bd) { bd = d; best = b; }
    }
    if (!best || out.includes(best)) return null;
    out.push(best);
  }
  const s0 = out.map((b) => b.bw), mean = s0.reduce((a, v) => a + v, 0) / 4;
  if (s0.some((v) => Math.abs(v - mean) > 0.15 * mean + 2 * step)) return null;
  return out.map((b) => [b.cx, b.cy]);
}

// Fit picture pixels to session canvas pixels from the four targets: a general affine first, to
// tell a uniform resize from a stretch or a turn, then the scale and shift on their own.
export function fitMarks(s, found) {
  const want = s.marks.map((m) => toPx(s, m[0], m[1]));
  // least squares affine found -> want
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
  for (let i = 0; i < 4; i++) { const r = [found[i][0], found[i][1], 1]; for (let a = 0; a < 3; a++) { for (let b = 0; b < 3; b++) A[a][b] += r[a] * r[b]; bx[a] += r[a] * want[i][0]; by[a] += r[a] * want[i][1]; } }
  const solve3 = (M, v) => { const m = M.map((r, i) => [...r, v[i]]); for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r; [m[c], m[p]] = [m[p], m[c]]; if (Math.abs(m[c][c]) < 1e-12) return null; for (let r = 0; r < 3; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k]; } } return m.map((r, i) => r[3] / r[i]); };
  const ax = solve3(A, bx), ay = solve3(A, by); if (!ax || !ay) return null;
  const sx = Math.hypot(ax[0], ay[0]), sy = Math.hypot(ax[1], ay[1]), turn = Math.atan2(ay[0], ax[0]) * 180 / Math.PI, shear = (ax[0] * ax[1] + ay[0] * ay[1]) / (sx * sy);
  // scale and shift only (canvas px = k * picture px + t)
  let mf = [0, 0], mw = [0, 0]; for (let i = 0; i < 4; i++) { mf[0] += found[i][0] / 4; mf[1] += found[i][1] / 4; mw[0] += want[i][0] / 4; mw[1] += want[i][1] / 4; }
  let num = 0, den = 0; for (let i = 0; i < 4; i++) { const fx = found[i][0] - mf[0], fy = found[i][1] - mf[1]; num += fx * (want[i][0] - mw[0]) + fy * (want[i][1] - mw[1]); den += fx * fx + fy * fy; }
  const k = num / den, t = [mw[0] - k * mf[0], mw[1] - k * mf[1]];
  let miss = 0; for (let i = 0; i < 4; i++) miss = Math.max(miss, Math.hypot(k * found[i][0] + t[0] - want[i][0], k * found[i][1] + t[1] - want[i][1]));
  return { k, t, sx, sy, turn, shear, miss };
}

// What to do with a picture that came back. Never stretches: an exact canvas goes straight on; a
// resize that kept the shape, or targets that line up with only a scale and shift, are offered as
// a re-registration the person confirms; anything stretched or turned is refused with the reason.
// info: { w, h, found (targets in picture px, or null) }.
export function checkReturn(s, { w, h, found = null }) {
  if (!s) return { ok: false, how: 'refuse', why: 'No trip out to Procreate is on record for this wrap. Send it to Procreate first, then bring the file back.' };
  if (w === s.w && h === s.h) return { ok: true, how: 'exact', k: 1, t: [0, 0], why: 'Same canvas as sent: it goes back exactly.' };
  if (found) {
    const f = fitMarks(s, found);
    if (f) {
      const stretch = Math.abs(f.sx - f.sy) / Math.max(f.sx, f.sy);
      if (stretch > 0.005) return { ok: false, how: 'refuse', why: `The marks show the picture was stretched (${(stretch * 100).toFixed(1)}% more one way than the other). Ink Atlas won't stretch it back. Bring back the file with the canvas size you were sent.` };
      if (Math.abs(f.turn) > 0.5 || Math.abs(f.shear) > 0.01) return { ok: false, how: 'refuse', why: `The marks show the picture was turned by ${Math.abs(f.turn).toFixed(1)} degrees. Turn it back in Procreate, or bring back the file you were sent.` };
      const pxTol = Math.max(2, 0.6 * s.ppi / 25.4); // 0.6 mm
      if (f.miss <= pxTol) return { ok: true, how: 'registered', k: f.k, t: f.t, miss: f.miss, why: `${cropOrScale(s, w, h, f)} The alignment marks put it back exactly (largest miss ${(f.miss / (s.w / s.wMm)).toFixed(2)} mm).` };
      return { ok: false, how: 'refuse', why: `The alignment marks don't line up with the canvas that was sent (off by ${(f.miss / (s.w / s.wMm)).toFixed(1)} mm). Bring back the file you were sent, without moving the marks layer.` };
    }
  }
  const r = w / h, r0 = s.w / s.h;
  if (Math.abs(r - r0) <= 0.003 * r0) { const k = s.w / w; return { ok: true, how: 'scaled', k, t: [0, 0], why: `It came back ${w} x ${h} pixels instead of ${s.w} x ${s.h}, the same shape. Put back at the measured size, it lines up only if the whole canvas was resized; check the review before you use it.` }; }
  return { ok: false, how: 'refuse', why: `It came back ${w} x ${h} pixels instead of ${s.w} x ${s.h}, so it was cropped or stretched, and the alignment marks layer isn't there to put it back. Bring back the Procreate file itself (it keeps the marks), or export the whole canvas uncropped.` };
}
function cropOrScale(s, w, h, f) {
  const sz = Math.abs(f.k - 1) > 0.002 ? `resized to ${Math.round(100 / f.k)}%` : '', cr = Math.abs(w * f.k - s.w) > 2 || Math.abs(h * f.k - s.h) > 2 ? 'cropped' : '';
  return `It came back ${[sz, cr].filter(Boolean).join(' and ') || 'changed'} (${w} x ${h} pixels).`;
}

// Where a returned picture sits on the template once checked: a piece covering exactly the
// picture, at the measured size. k and t take picture pixels to session canvas pixels.
export function returnedPiece(s, check, w, h) {
  const ppmmX = s.w / s.wMm, ppmmY = s.h / s.hMm;
  const tl = [check.t[0], check.t[1]], br = [check.k * w + check.t[0], check.k * h + check.t[1]];
  const a = fromPx(s, tl[0], tl[1]), b = fromPx(s, br[0], br[1]);
  return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, w: (br[0] - tl[0]) / ppmmX, aspect: w / h, rot: 0, flip: false, pw: w, ph: h, ppi: s.ppi / check.k, hMm: (br[1] - tl[1]) / ppmmY };
}

// Whether the measurements changed since the trip went out, in which case what comes back was
// drawn on an older template and is put on the old shape's numbers, with a warning.
export const staleSession = (s, region) => s.calib !== region.calib;
