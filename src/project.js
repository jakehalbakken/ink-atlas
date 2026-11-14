// Checks and repairs a project state before it is allowed to replace the working one.
// Used for the save on this device, backup files and recovery copies alike.
// Throws if the data is not a project at all; never changes its input. Anything it has
// to leave out or fix is counted, so the caller can say so instead of failing silently.
import { FIT_GROUPS } from './fit.js';

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
  s.heightCm = num(s.heightCm) ? clamp(Math.round(s.heightCm), 150, 205) : 175;
  if (s.figure != null && !FIGURES.includes(s.figure)) s.figure = 'male'; // absent is meaningful: a save from before body types
  // v1 kept muscle 0..1 from average and weight -1..1; v2 keeps both 0..1 with 0.5 = average
  s.muscle = num(s.muscle) ? clamp(s.muscle, 0, 1) : v >= 2 ? 0.5 : 0;
  s.weight = num(s.weight) ? clamp(s.weight, v >= 2 ? 0 : -1, 1) : v >= 2 ? 0.5 : 0;
  const fit = {};
  if (s.fit && typeof s.fit === 'object' && !Array.isArray(s.fit)) for (const k of Object.keys(s.fit)) if (FIT_KEYS.has(k) && num(s.fit[k]) && s.fit[k]) fit[k] = clamp(s.fit[k], -1, 1);
  s.fit = fit; s.genitals = s.genitals !== false;

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
    const len = vec3(t.normal, 2) ? Math.hypot(t.normal[0], t.normal[1], t.normal[2]) : 0;
    if (vec3(t.pos, 10) && len > 0.5) t.normal = t.normal.map((c) => c / len);
    else { t.pos = [0, 1.3, 0.12]; t.normal = [0, 0, 1]; replace.push(t.id); }
    out.push(t);
  }
  s.tattoos = out;
  // paint on the body from Procreate's 3D painting: one picture in the body's texture layout
  if (s.paint && typeof s.paint === 'object' && !Array.isArray(s.paint) && typeof s.paint.img === 'string' && hasImage(s.paint.img)) s.paint = { img: s.paint.img, hidden: !!s.paint.hidden };
  else delete s.paint;
  return { state: s, dropped, replace };
}

// Shared asset traversal for current state, named layouts, checkpoints and backups.
export function imageKeysFor(state) {
  const keys = new Set();
  const scan = (s) => {
    for (const t of [...(s?.tattoos || []),...(s?.unplacedTattoos || [])]) if (typeof t?.img === 'string') keys.add(t.img);
    if (typeof s?.paint?.img === 'string') keys.add(s.paint.img);
    for(const board of Array.isArray(s?.artworkBoards)?s.artworkBoards:[])for(const entry of Object.values(board?.entries||{}))for(const k of [entry?.sourceKey,entry?.outputKey])if(typeof k==='string')keys.add(k);
    for (const a of Object.values(s?.artworks || {})) {
      for (const k of [a?.source, a?.output, a?.mask]) if (typeof k === 'string') keys.add(k);
    }
  };
  scan(state);
  for (const group of ['layouts', 'checkpoints']) for (const s of state?.[group] || []) scan(s.state || s);
  return [...keys];
}
