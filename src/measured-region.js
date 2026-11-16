// A measured region: a stretch of an arm or leg planned from your own tape measurements, not from
// the 3D body's proportions. Its rings (circumferences) and the lengths between them are the truth
// for everything printed or sent to Procreate; the body only shows roughly where it sits. Plain
// data and checks, kept in the project as `state.regions`, so backups and account sync carry it.
//
// Every length is stored in millimetres. Inches are only for showing and typing.
import { develop } from './wrap-geometry.js';

export const REGION_V = 1;
export const MAX_REGIONS = 8;
export const MAX_LEVELS = 6;
export const LIMBS = ['legR', 'legL', 'armR', 'armL'];
export const LIMB_NAMES = { legR: 'Right leg', legL: 'Left leg', armR: 'Right arm', armL: 'Left arm' };
// where the cut runs, in degrees round the limb: 0 the inside, 90 the front, 180 the outside, 270 the back
export const SEAMS = [[0, 'Inside'], [90, 'Front'], [180, 'Outside'], [270, 'Back']];
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const uid = () => Math.random().toString(36).slice(2, 10);
const text = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : '');

// Jake's ankle, the starting values of his first wrap: 9 in round at the bottom of the existing
// cactus, 12.5 in round at its top, 4 in between. Whether that 4 in ran along the skin or straight
// up is not known yet, so it starts as along the skin and says so until it is confirmed.
export function startingRegion(limb = 'legR') {
  return {
    id: uid(), v: REGION_V, name: 'Ankle wrap', limb, method: 'skin', methodConfirmed: false, seam: 0, calib: 1,
    levels: [{ id: uid(), label: 'Bottom of the cactus', circ: 228.6 }, { id: uid(), label: 'Top of the cactus', circ: 317.5, gap: 101.6 }],
  };
}

// A spot on the body: a triangle of the body mesh and three weights inside it.
function cleanPin(p) {
  if (!p || typeof p !== 'object' || !Number.isInteger(p.tri) || p.tri < 0 || p.tri > 2e6 || !Array.isArray(p.w) || p.w.length !== 3 || !p.w.every((x) => num(x) && x > -0.01 && x < 1.01)) return null;
  const sum = p.w[0] + p.w[1] + p.w[2]; if (!(sum > 0.5 && sum < 1.5)) return null;
  return { tri: p.tri, w: p.w.map((x) => Math.min(1, Math.max(0, x)) / sum) };
}
const key = (v, hasImage) => typeof v === 'string' && v.length <= 80 && hasImage(v);

// Checks one region and returns a clean copy, or null when it cannot describe a wrap. Parts that
// do not check out are dropped and the rest kept, so a damaged save loses as little as possible.
export function cleanRegion(raw, hasImage = () => true) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = { id: typeof raw.id === 'string' && raw.id && raw.id.length <= 40 ? raw.id : uid(), v: REGION_V };
  r.name = text(raw.name, 60) || 'Measured wrap';
  r.limb = LIMBS.includes(raw.limb) ? raw.limb : 'legR';
  r.method = raw.method === 'axial' ? 'axial' : 'skin';
  r.methodConfirmed = !!raw.methodConfirmed;
  r.seam = num(raw.seam) ? ((Math.round(raw.seam) % 360) + 360) % 360 : 0;
  r.calib = Number.isInteger(raw.calib) && raw.calib > 0 && raw.calib < 1e6 ? raw.calib : 1;
  const levels = [];
  for (const l of Array.isArray(raw.levels) ? raw.levels : []) {
    if (levels.length >= MAX_LEVELS || !l || typeof l !== 'object') continue;
    if (!(num(l.circ) && l.circ >= 20 && l.circ <= 2000)) continue;
    const o = { id: typeof l.id === 'string' && l.id && l.id.length <= 40 ? l.id : uid(), circ: l.circ };
    const lab = text(l.label, 40); if (lab) o.label = lab;
    if (levels.length) { if (!(num(l.gap) && l.gap >= 1 && l.gap <= 1500)) continue; o.gap = l.gap; }
    const pin = cleanPin(l.pin); if (pin) o.pin = pin;
    levels.push(o);
  }
  if (levels.length < 2) return null;
  r.levels = levels;
  try { develop(levels, r.method); } catch (_) { return null; } // e.g. a slant shorter than the change in radius
  if (raw.units === 'in' || raw.units === 'mm') r.units = raw.units;
  const ex = cleanExisting(raw.existing, hasImage); if (ex) r.existing = ex;
  const art = cleanArt(raw.art, hasImage); if (art) r.art = art;
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).map(cleanSession).filter(Boolean).slice(-10); if (sessions.length) r.sessions = sessions;
  const pr = cleanPrint(raw.print); if (pr) r.print = pr;
  // the front focal point's spot on the wrap: its direction round the limb (degrees, 90 the
  // front), its middle up the wrap as a share of the length, its width and height in mm
  const fo = raw.focal;
  if (fo && typeof fo === 'object' && num(fo.deg) && num(fo.at) && num(fo.w) && num(fo.h)) r.focal = { deg: ((fo.deg % 360) + 360) % 360, at: Math.min(1, Math.max(0, fo.at)), w: Math.min(400, Math.max(10, fo.w)), h: Math.min(400, Math.max(10, fo.h)) };
  // approved for printing at a calibration, and the separate fitting check on the real leg
  if (raw.approved && typeof raw.approved === 'object' && Number.isInteger(raw.approved.calib) && typeof raw.approved.at === 'string') { r.approved = { calib: raw.approved.calib, at: raw.approved.at.slice(0, 30) }; if (typeof raw.approved.sig === 'string' && /^[a-z0-9]{1,16}$/.test(raw.approved.sig)) r.approved.sig = raw.approved.sig; }
  if (raw.fitted && typeof raw.fitted === 'object' && typeof raw.fitted.at === 'string') { r.fitted = { at: raw.fitted.at.slice(0, 30), ok: !!raw.fitted.ok }; const n = text(raw.fitted.note, 300); if (n) r.fitted.note = n; }
  return r;
}

// The tattoo already on the skin, registered onto the template. Several photos (or the original
// stencil) can feed one registration; each keeps its picture untouched and records how it is
// straightened (`quad`, four corners on the photo, top left first) and placed (`fit`: centre in
// template mm, mm per straightened pixel, turn in degrees, mirrored). Landmarks are the named spots
// matched between photos and the template (`src` per photo in straightened pixels, `at` in template
// mm). `knownMm` is the measured length used for scale (the 4 in cactus) and `knownHow` whether it
// was taken straight up or along the skin. Masks are pictures on a grid in template mm: `maskO` is
// the template point of their top left corner and `maskPpmm` their pixels per mm. `ink` is the old
// ink, `gap` the bare skin that must stay bare; `buffer` the clear margin kept round the ink (mm).
const pt2 = (v, lim = 1e5) => Array.isArray(v) && v.length === 2 && v.every((x) => num(x) && Math.abs(x) < lim);
function cleanFit(f) {
  if (!f || typeof f !== 'object' || !num(f.x) || !num(f.y) || Math.abs(f.x) > 5000 || Math.abs(f.y) > 5000 || !(num(f.mmPerPx) && f.mmPerPx > 1e-4 && f.mmPerPx < 10)) return null;
  return { x: f.x, y: f.y, mmPerPx: f.mmPerPx, rot: num(f.rot) ? ((f.rot % 360) + 540) % 360 - 180 : 0, flip: !!f.flip };
}
export function cleanExisting(e, hasImage) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const o = {}, photos = [];
  for (const p of Array.isArray(e.photos) ? e.photos : []) {
    if (photos.length >= 6 || !p || typeof p !== 'object' || !key(p.img, hasImage)) continue;
    const q = { id: typeof p.id === 'string' && p.id && p.id.length <= 40 ? p.id : uid(), img: p.img };
    if (Number.isInteger(p.pw) && Number.isInteger(p.ph) && p.pw > 0 && p.ph > 0 && p.pw <= 20000 && p.ph <= 20000) { q.pw = p.pw; q.ph = p.ph; }
    if (Array.isArray(p.quad) && p.quad.length === 4 && p.quad.every((c) => pt2(c))) q.quad = p.quad.map((c) => c.slice());
    const f = cleanFit(p.fit); if (f) q.fit = f;
    const nm = text(p.name, 60); if (nm) q.name = nm;
    if (num(p.opacity) && p.opacity >= 0 && p.opacity <= 1) q.opacity = p.opacity;
    photos.push(q);
  }
  if (photos.length) { o.photos = photos; o.active = photos.some((p) => p.id === e.active) ? e.active : photos[0].id; }
  const ids = new Set(photos.map((p) => p.id)), lms = [];
  for (const m of Array.isArray(e.landmarks) ? e.landmarks : []) {
    if (lms.length >= 16 || !m || typeof m !== 'object') continue;
    const name = text(m.name, 40); if (!name) continue;
    const l = { id: typeof m.id === 'string' && m.id && m.id.length <= 40 ? m.id : uid(), name };
    if (typeof m.key === 'string' && m.key.length <= 12) l.key = m.key;
    if (m.src && typeof m.src === 'object') { const src = {}; for (const [k, v] of Object.entries(m.src)) if (ids.has(k) && pt2(v)) src[k] = v.slice(); if (Object.keys(src).length) l.src = src; }
    if (pt2(m.at, 5000)) l.at = m.at.slice();
    lms.push(l);
  }
  if (lms.length) o.landmarks = lms;
  if (num(e.knownMm) && e.knownMm > 1 && e.knownMm < 1500) o.knownMm = e.knownMm;
  if (e.knownHow === 'vertical' || e.knownHow === 'skin') o.knownHow = e.knownHow;
  o.locked = !!e.locked;
  if (num(e.maskPpmm) && e.maskPpmm >= 0.5 && e.maskPpmm <= 8 && pt2(e.maskO, 5000)) {
    if (key(e.ink, hasImage)) o.ink = e.ink;
    if (key(e.gap, hasImage)) o.gap = e.gap;
    if (o.ink || o.gap) { o.maskPpmm = e.maskPpmm; o.maskO = e.maskO.slice(); if (Number.isInteger(e.maskCalib) && e.maskCalib > 0) o.maskCalib = e.maskCalib; }
  }
  if (num(e.buffer) && e.buffer >= 0 && e.buffer <= 20) o.buffer = e.buffer;
  return o.photos || o.ink || o.gap || o.landmarks ? o : null;
}

// The new artwork on the template, as separate plants (pieces) that can be moved, sized, turned,
// mirrored, hidden and reordered: each is a picture kept at full resolution (never the 1600 px
// screen size), with its centre in template mm, its width in mm and its picture's pixel size.
// Later pieces draw on top. `saved` holds named design versions (the piece lists only; their
// pictures stay shared).
function cleanPieces(list, hasImage, max = 60) {
  const pieces = [];
  for (const p of Array.isArray(list) ? list : []) {
    if (pieces.length >= max || !p || typeof p !== 'object' || !key(p.img, hasImage)) continue;
    if (!(num(p.x) && num(p.y) && Math.abs(p.x) < 5000 && Math.abs(p.y) < 5000 && num(p.w) && p.w > 0.5 && p.w < 2000 && num(p.aspect) && p.aspect > 0.02 && p.aspect < 50)) continue;
    const q = { id: typeof p.id === 'string' && p.id && p.id.length <= 40 ? p.id : uid(), img: p.img, x: p.x, y: p.y, w: p.w, aspect: p.aspect, rot: num(p.rot) ? ((p.rot % 360) + 540) % 360 - 180 : 0, flip: !!p.flip };
    const nm = text(p.name, 60); if (nm) q.name = nm;
    if (p.hidden === true) q.hidden = true;
    if (Number.isInteger(p.pw) && Number.isInteger(p.ph) && p.pw > 0 && p.ph > 0 && p.pw <= 30000 && p.ph <= 30000) { q.pw = p.pw; q.ph = p.ph; }
    if (num(p.ppi) && p.ppi >= 50 && p.ppi <= 1200) q.ppi = p.ppi;
    if (typeof p.from === 'string' && p.from.length <= 40) q.from = p.from;
    pieces.push(q);
  }
  return pieces;
}
export function cleanArt(a, hasImage) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const o = {}, pieces = cleanPieces(a.pieces, hasImage); if (pieces.length) o.pieces = pieces;
  const saved = [];
  for (const v of Array.isArray(a.saved) ? a.saved : []) {
    if (saved.length >= 12 || !v || typeof v !== 'object') continue;
    const ps = cleanPieces(v.pieces, hasImage); const nm = text(v.name, 40) || 'Version';
    saved.push({ id: typeof v.id === 'string' && v.id && v.id.length <= 40 ? v.id : uid(), name: nm, at: typeof v.at === 'string' ? v.at.slice(0, 30) : '', pieces: ps });
  }
  if (saved.length) o.saved = saved;
  return o.pieces || o.saved ? o : null;
}

// One trip out to Procreate: what was sent, so the picture that comes back can be checked
// against it. Only numbers and names: the pictures themselves live with the artwork.
export function cleanSession(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || typeof s.id !== 'string' || !s.id || s.id.length > 40) return null;
  const ints = (v) => Number.isInteger(v) && v > 0 && v <= 30000;
  if (!ints(s.w) || !ints(s.h) || !(num(s.ppi) && s.ppi >= 50 && s.ppi <= 1200) || !(Number.isInteger(s.calib) && s.calib > 0)) return null;
  if (!(num(s.wMm) && s.wMm > 0 && num(s.hMm) && s.hMm > 0 && Array.isArray(s.originMm) && s.originMm.length === 2 && s.originMm.every(num))) return null;
  const o = { id: s.id, at: typeof s.at === 'string' ? s.at.slice(0, 30) : '', calib: s.calib, ppi: s.ppi, w: s.w, h: s.h, wMm: s.wMm, hMm: s.hMm, originMm: s.originMm.slice(), padMm: num(s.padMm) ? s.padMm : 0, seam: num(s.seam) ? s.seam : 0, method: s.method === 'axial' ? 'axial' : 'skin', mapping: 'frustum-v1' };
  if (Array.isArray(s.levels)) o.levels = s.levels.filter((l) => l && num(l.circ)).slice(0, MAX_LEVELS).map((l) => (num(l.gap) ? { circ: l.circ, gap: l.gap } : { circ: l.circ }));
  if (Array.isArray(s.marks)) o.marks = s.marks.filter((m) => Array.isArray(m) && m.length === 2 && m.every(num)).slice(0, 16).map((m) => m.slice());
  if (Array.isArray(s.layers)) o.layers = s.layers.filter((n) => typeof n === 'string').slice(0, 12).map((n) => n.slice(0, 60));
  if (Array.isArray(s.sources)) o.sources = s.sources.filter((n) => typeof n === 'string' && n.length <= 80).slice(0, 50);
  if (typeof s.name === 'string') o.name = s.name.slice(0, 80);
  if (s.returned && typeof s.returned === 'object' && typeof s.returned.at === 'string') o.returned = { at: s.returned.at.slice(0, 30), how: ['registered', 'scaled'].includes(s.returned.how) ? s.returned.how : 'exact' };
  return o;
}

// Printing choices for the stencil, kept with the region so the next print matches.
export function cleanPrint(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const o = {};
  if (typeof p.paper === 'string' && p.paper.length <= 20) o.paper = p.paper;
  if (p.orient === 'portrait' || p.orient === 'landscape' || p.orient === 'auto') o.orient = p.orient;
  if (num(p.overlap) && p.overlap >= 0 && p.overlap <= 50) o.overlap = p.overlap;
  if (typeof p.printer === 'string' && p.printer.length <= 30) o.printer = p.printer;
  if (p.mirror === true || p.mirror === false) o.mirror = p.mirror;
  if (p.custom && typeof p.custom === 'object' && num(p.custom.w) && num(p.custom.h) && p.custom.w >= 50 && p.custom.h >= 50 && p.custom.w <= 2000 && p.custom.h <= 2000) o.custom = { w: p.custom.w, h: p.custom.h };
  if (p.margins && typeof p.margins === 'object' && ['top', 'right', 'bottom', 'left'].every((k) => num(p.margins[k]) && p.margins[k] >= 0 && p.margins[k] <= 60)) o.margins = { ...p.margins };
  if (Array.isArray(p.cuts)) o.cuts = p.cuts.filter((c) => c && (c.axis === 'x' || c.axis === 'y') && num(c.at)).slice(0, 20).map((c) => ({ axis: c.axis, at: c.at }));
  return Object.keys(o).length ? o : null;
}

export function cleanRegions(list, hasImage) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const raw of list) { if (out.length >= MAX_REGIONS) break; const r = cleanRegion(raw, hasImage); if (!r) continue; if (seen.has(r.id)) r.id = uid(); seen.add(r.id); out.push(r); }
  return out;
}

// Every picture a region holds, for saving, backups and sync.
export function regionImageKeys(r) {
  const k = [];
  if (r?.existing) { for (const n of ['ink', 'gap']) if (typeof r.existing[n] === 'string') k.push(r.existing[n]); for (const p of r.existing.photos || []) if (typeof p?.img === 'string') k.push(p.img); }
  if (r?.art) { for (const p of r.art.pieces || []) if (typeof p?.img === 'string') k.push(p.img); for (const v of r.art.saved || []) for (const p of v.pieces || []) if (typeof p?.img === 'string') k.push(p.img); }
  return k;
}

// The developed template for a region, or null if its numbers cannot make one.
export function templateOf(r) { try { return develop(r.levels, r.method); } catch (_) { return null; } }

// The part of a region that changes the template: when it changes, the calibration moves on.
export function measureKey(r) { return JSON.stringify([r.method, r.levels.map((l) => [l.circ, l.gap || 0])]); }

/* ---------- inches and millimetres ---------- */
export function fmtLen(mm, units = 'in', digits) {
  if (!num(mm)) return '';
  if (units === 'mm') return (Math.round(mm * 10 ** (digits ?? 1)) / 10 ** (digits ?? 1)).toFixed(digits ?? 1) + ' mm';
  return (mm / 25.4).toFixed(digits ?? 2) + ' in';
}
export function fmtBoth(mm, units = 'in') { return units === 'mm' ? `${fmtLen(mm, 'mm')} (${fmtLen(mm, 'in')})` : `${fmtLen(mm, 'in')} (${fmtLen(mm, 'mm')})`; }
// What was typed into a length box, as millimetres: a plain number is in the shown units, and a
// number followed by in, ", mm or cm says its own.
export function parseLen(str, units = 'in') {
  const m = String(str ?? '').trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?|\.\d+)\s*(mm|cm|in|inch|inches|"|”)?$/);
  if (!m) return NaN;
  const v = parseFloat(m[1]), u = m[2] || (units === 'mm' ? 'mm' : 'in');
  return u === 'mm' ? v : u === 'cm' ? v * 10 : v * 25.4;
}
