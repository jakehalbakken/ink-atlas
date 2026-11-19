// Checks and repairs a project state before it is allowed to replace the working one.
// Used for the save on this device, backup files and recovery copies alike.
// Throws if the data is not a project at all; never changes its input. Anything it has
// to leave out or fix is counted, so the caller can say so instead of failing silently.
import { FIT_GROUPS } from './fit.js';
import { cleanReview, cleanAsks } from './approval.js';
import { cleanVersions } from './versions.js';
import { cleanRegions, regionImageKeys } from './measured-region.js';
import { cleanLook } from './ink-look.js';

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const vec3 = (v, lim) => Array.isArray(v) && v.length === 3 && v.every((x) => num(x) && Math.abs(x) < lim);
const FIT_KEYS = new Set(FIT_GROUPS.flatMap((g) => g.items.map((i) => i.key)));
const FIGURES = ['male', 'neutral', 'female'];
export const MAX_TATTOOS = 200;
const uid = () => Math.random().toString(36).slice(2, 10);

// hasImage(key) says whether artwork for that key is available.
// Returns { state, dropped, replace } where `replace` lists tattoo ids whose position
// was unusable (the caller puts them back on the body) and `dropped` counts pieces left out.
export function cleanState(raw, hasImage) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.tattoos)) throw new Error('Not an Ink Atlas project');
  let s; try { s = JSON.parse(JSON.stringify(raw)); } catch (e) { throw new Error('Not an Ink Atlas project'); }
  const v = num(s.v) && s.v >= 1 ? Math.floor(s.v) : 1;
  s.app = 'ink-atlas-proto'; s.v = v;
  s.skin = Number.isInteger(s.skin) && s.skin >= 0 && s.skin <= 4 ? s.skin : 1;
  if (!(typeof s.skinHex === 'string' && /^#[0-9a-f]{6}$/i.test(s.skinHex))) delete s.skinHex;
  s.heightCm = num(s.heightCm) ? clamp(Math.round(s.heightCm * 10) / 10, 150, 205) : 175; // to a millimetre, so a typed height in inches keeps
  if (s.figure != null && !FIGURES.includes(s.figure)) s.figure = 'male'; // absent is meaningful: a save from before body types
  // v1 kept muscle 0..1 from average and weight -1..1; v2 keeps both 0..1 with 0.5 = average
  s.muscle = num(s.muscle) ? clamp(s.muscle, 0, 1) : v >= 2 ? 0.5 : 0;
  s.weight = num(s.weight) ? clamp(s.weight, v >= 2 ? 0 : -1, 1) : v >= 2 ? 0.5 : 0;
  const fit = {};
  if (s.fit && typeof s.fit === 'object' && !Array.isArray(s.fit)) for (const k of Object.keys(s.fit)) if (FIT_KEYS.has(k) && num(s.fit[k]) && s.fit[k]) fit[k] = clamp(s.fit[k], -1, 1);
  s.fit = fit; s.genitals = s.genitals !== false;
  // measurements typed in the Body panel, in inches, by body slider (optional)
  if (s.measured !== undefined) { const m = {}; if (s.measured && typeof s.measured === 'object' && !Array.isArray(s.measured)) for (const k of Object.keys(s.measured)) if (FIT_KEYS.has(k) && num(s.measured[k]) && s.measured[k] > 0.5 && s.measured[k] < 120) m[k] = Math.round(s.measured[k] * 100) / 100; if (Object.keys(m).length) s.measured = m; else delete s.measured; }

  const out = [], replace = [], seen = new Set(); let dropped = 0;
  for (const t of s.tattoos) {
    if (!t || typeof t !== 'object' || Array.isArray(t) || typeof t.img !== 'string' || !hasImage(t.img) || out.length >= MAX_TATTOOS) { dropped++; continue; }
    if (typeof t.id !== 'string' || !t.id || seen.has(t.id)) t.id = uid();
    seen.add(t.id);
    t.name = typeof t.name === 'string' && t.name.trim() ? t.name.slice(0, 60) : 'Tattoo';
    t.aspect = num(t.aspect) && t.aspect >= 0.05 && t.aspect <= 20 ? t.aspect : 0; // 0 = work it out from the picture
    t.width = num(t.width) ? clamp(t.width, 0.012, 0.9) : 0.11;
    t.rot = num(t.rot) ? t.rot : 0;
    t.opacity = num(t.opacity) ? clamp(t.opacity, 0.1, 1) : 0.92;
    t.flip = !!t.flip; t.locked = !!t.locked; t.hidden = !!t.hidden;
    for (const [k, lo, hi] of [['wrap', 0, 1], ['bend', -1, 1], ['taper', -0.75, 0.75]]) { if (num(t[k]) && t[k]) t[k] = clamp(t[k], lo, hi); else delete t[k]; }
    if (t.status !== 'existing' && t.status !== 'planned') delete t.status;
    if (t.fromLayer !== undefined && (typeof t.fromLayer !== 'string' || t.fromLayer.length > 100)) delete t.fromLayer;
    // a note for the artist and, for ink already on, who did it and when (optional)
    if (t.note !== undefined) { if (typeof t.note === 'string' && t.note.trim()) t.note = t.note.slice(0, 500); else delete t.note; }
    if (t.sittings !== undefined) { const m = t.sittings, c = {}; if (m && typeof m === 'object' && !Array.isArray(m)) { if (typeof m.start === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(m.start)) c.start = m.start; if ([2, 3, 4, 6, 8].includes(m.gap)) c.gap = m.gap; if (typeof m.away === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(m.away)) c.away = m.away; } if (Object.keys(c).length) t.sittings = c; else delete t.sittings; }
    if (t.made !== undefined) { const m = t.made, c = {}; if (m && typeof m === 'object' && !Array.isArray(m)) { for (const k of ['artist', 'studio']) if (typeof m[k] === 'string' && m[k].trim()) c[k] = m[k].trim().slice(0, 60); if (typeof m.when === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m.when)) c.when = m.when; } if (Object.keys(c).length) t.made = c; else delete t.made; }
    cleanVersions(t, hasImage); // earlier artwork of this tattoo (optional)
    cleanLook(t); // blend mode and colour adjustments (optional)
    if (t.review !== undefined) { const r = cleanReview(t.review); if (r) t.review = r; else delete t.review; } // an answer from Ask for approval (optional)
    const len = vec3(t.normal, 2) ? Math.hypot(t.normal[0], t.normal[1], t.normal[2]) : 0;
    if (vec3(t.pos, 10) && len > 0.5) t.normal = t.normal.map((c) => c / len);
    else { t.pos = [0, 1.3, 0.12]; t.normal = [0, 0, 1]; replace.push(t.id); }
    out.push(t);
  }
  s.tattoos = out;
  // paint on the body from Procreate's 3D painting: one picture in the body's texture layout
  if (s.paint && typeof s.paint === 'object' && !Array.isArray(s.paint) && typeof s.paint.img === 'string' && hasImage(s.paint.img)) s.paint = { img: s.paint.img, hidden: !!s.paint.hidden };
  else delete s.paint;
  // approval pages sent (optional): which tattoos each one asked about, for reading answers back
  if (s.asks !== undefined) { const a = cleanAsks(s.asks); if (a) s.asks = a; else delete s.asks; }
  // comments pinned to a spot on the body (optional, in the artist notes): a bad spot is dropped, the words kept
  if (Array.isArray(s.notes)) for (const n of s.notes) {
    if (!n || typeof n !== 'object' || Array.isArray(n)) continue;
    if (n.pin !== undefined) { const p = cleanPin(n.pin); if (p) n.pin = p; else delete n.pin; }
    if (n.by !== undefined) { if (typeof n.by === 'string') n.by = n.by.slice(0, 60); else delete n.by; }
    if (n.at !== undefined && !(typeof n.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.at))) delete n.at;
    // replies to a pinned comment, and who marked it resolved (optional)
    if (n.replies !== undefined) { const r = cleanReplies(n.replies); if (r.length) n.replies = r; else delete n.replies; }
    if (n.done !== undefined) { const d = cleanWho(n.done); if (d) n.done = d; else delete n.done; }
    // a placement someone who can only comment suggests for a tattoo (optional)
    if (n.suggest !== undefined) { const g = cleanSuggest(n.suggest); if (g) n.suggest = g; else delete n.suggest; }
    // quick reactions to a pinned comment (optional)
    if (n.reacts !== undefined) { const r = cleanReacts(n.reacts); if (r.length) n.reacts = r; else delete n.reacts; }
  }
  // reference pictures (optional): inspiration for the whole project or one tattoo
  if (s.refs !== undefined) { const r = cleanRefs(s.refs, hasImage, new Set(out.map((t) => t.id))); if (r.length) s.refs = r; else delete s.refs; }
  // measured wraps planned from tape measurements (optional, no migration)
  if (s.regions !== undefined) { const r = cleanRegions(s.regions, hasImage); if (r.length) s.regions = r; else delete s.regions; }
  return { state: s, dropped, replace };
}

const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
// who did something and on which day: { by?, at? }
export function cleanWho(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = {}; if (typeof v.by === 'string' && v.by) o.by = v.by.slice(0, 60); if (isDay(v.at)) o.at = v.at;
  return o;
}
// replies to a pinned comment: [{ id, text, by?, at? }], at most 50
export const MAX_REPLIES = 50;
export function cleanReplies(list) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const r of list) {
    if (out.length >= MAX_REPLIES) break;
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id || seen.has(r.id) || typeof r.text !== 'string' || !r.text.trim()) continue;
    seen.add(r.id);
    out.push({ id: r.id.slice(0, 40), text: r.text.slice(0, 500), ...cleanWho(r) });
  }
  return out;
}

// a suggested spot for a tattoo: { tattooId, pos, normal, width, rot, wrap?, bend?, taper? }
export const SUGGEST_KEYS = ['pos', 'normal', 'width', 'rot', 'wrap', 'bend', 'taper'];
export function cleanSuggest(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g) || typeof g.tattooId !== 'string' || !g.tattooId) return null;
  const v3 = (a, m) => Array.isArray(a) && a.length === 3 && a.every((c) => num(c) && Math.abs(c) <= m);
  if (!v3(g.pos, 10) || !v3(g.normal, 2) || !num(g.width) || !num(g.rot)) return null;
  const len = Math.hypot(...g.normal); if (len < 0.5) return null;
  const o = { tattooId: g.tattooId.slice(0, 40), pos: g.pos.slice(), normal: g.normal.map((c) => c / len), width: clamp(g.width, 0.012, 0.9), rot: g.rot };
  for (const [k, lo, hi] of [['wrap', 0, 1], ['bend', -1, 1], ['taper', -0.75, 0.75]]) if (num(g[k]) && g[k]) o[k] = clamp(g[k], lo, hi);
  return o;
}
// quick reactions to a comment: [{ id, e, by }], one of each kind per person (id is kind|name)
export const REACTIONS = [['👍', 'Thumbs up'], ['❤️', 'Love it'], ['🔥', 'Fire'], ['👀', 'Looking at it']];
export const MAX_REACTS = 40;
export function cleanReacts(list) {
  if (!Array.isArray(list)) return [];
  const kinds = new Set(REACTIONS.map((r) => r[0])), out = [], seen = new Set();
  for (const r of list) {
    if (out.length >= MAX_REACTS) break;
    if (!r || typeof r !== 'object' || !kinds.has(r.e) || typeof r.by !== 'string' || !r.by.trim()) continue;
    const by = r.by.slice(0, 60), id = (r.e + '|' + by).slice(0, 80);
    if (seen.has(id)) continue;
    seen.add(id); out.push({ id, e: r.e, by });
  }
  return out;
}

// Reference pictures: { id, img, tattooId?, note?, by?, at? }. A picture that is missing goes,
// and a tattoo that is gone leaves its pictures on the whole project.
export const MAX_REFS = 60;
export function cleanRefs(list, hasImage, tattooIds) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const r of list) {
    if (out.length >= MAX_REFS) break;
    if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(r.id) || seen.has(r.id)) continue;
    if (typeof r.img !== 'string' || !hasImage(r.img)) continue;
    seen.add(r.id);
    const c = { id: r.id, img: r.img };
    if (typeof r.tattooId === 'string' && tattooIds.has(r.tattooId)) c.tattooId = r.tattooId;
    if (typeof r.note === 'string' && r.note.trim()) c.note = r.note.trim().slice(0, 300);
    if (typeof r.by === 'string' && r.by.trim()) c.by = r.by.slice(0, 60);
    if (typeof r.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.at)) c.at = r.at;
    if (Number.isFinite(r.aspect) && r.aspect > 0.05 && r.aspect < 20) c.aspect = r.aspect;
    out.push(c);
  }
  return out;
}

// A spot on the body: a triangle of the body mesh and three weights inside it.
export function cleanPin(p) {
  if (!p || typeof p !== 'object' || !Number.isInteger(p.tri) || p.tri < 0 || p.tri > 2e6 || !Array.isArray(p.w) || p.w.length !== 3 || !p.w.every((x) => num(x) && x > -0.01 && x < 1.01)) return null;
  const sum = p.w[0] + p.w[1] + p.w[2]; if (!(sum > 0.5 && sum < 1.5)) return null;
  return { tri: p.tri, w: p.w.map((x) => Math.min(1, Math.max(0, x)) / sum) };
}

// Shared asset traversal for current state, named layouts, checkpoints and backups.
export function imageKeysFor(state) {
  const keys = new Set();
  const scan = (s) => {
    for (const t of [...(s?.tattoos || []),...(s?.unplacedTattoos || [])]) { if (typeof t?.img === 'string') keys.add(t.img); for (const v of Array.isArray(t?.versions) ? t.versions : []) if (typeof v?.img === 'string') keys.add(v.img); }
    if (typeof s?.paint?.img === 'string') keys.add(s.paint.img);
    for (const r of Array.isArray(s?.refs) ? s.refs : []) if (typeof r?.img === 'string') keys.add(r.img);
    for (const r of Array.isArray(s?.regions) ? s.regions : []) for (const k of regionImageKeys(r)) keys.add(k);
    for(const board of Array.isArray(s?.artworkBoards)?s.artworkBoards:[])for(const entry of Object.values(board?.entries||{}))for(const k of [entry?.sourceKey,entry?.outputKey])if(typeof k==='string')keys.add(k);
    for (const a of Object.values(s?.artworks || {})) {
      for (const k of [a?.source, a?.output, a?.mask]) if (typeof k === 'string') keys.add(k);
    }
  };
  scan(state);
  for (const group of ['layouts', 'checkpoints']) for (const s of state?.[group] || []) scan(s.state || s);
  return [...keys];
}
