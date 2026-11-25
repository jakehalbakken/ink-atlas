// Names for files the app saves, so they never need renaming: every export is called
// "Ink Atlas - <project> - <what it is> <n>.<ext>", and n counts up from the last export
// of that kind in that project. Pure maths here; the counts live on the device (localStorage
// `ia-export-n`), never in the project, so nothing about a save or an account copy changes.

const BAD = /[\\/:*?"<>|\u0000-\u001f]+/g;
const clean = (s) => String(s || '').replace(BAD, ' ').replace(/\s+/g, ' ').trim();

// The extension, keeping the two-part ones the app reads back by name.
export function splitExt(file) {
  const s = String(file || '');
  const m = s.match(/(\.ink\.json|\.[a-z0-9]{1,8})$/i);
  return m ? [s.slice(0, -m[1].length), m[1].toLowerCase()] : [s, ''];
}

// What the file is, from the name the export asked for: "ink-atlas-sizes-labelled.png" is
// "Sizes labelled", "ink-atlas-backup-2026-11-25.json" is "Backup", "Rose-stencil.pdf" is
// "Rose stencil". A name that already starts with the project's name drops it.
export function kindOf(file, project = '') {
  let [b] = splitExt(file);
  b = b.replace(/^\s*ink[\s_-]*atlas\b[\s_:-]*/i, '');
  b = b.replace(/[\s_-]*\d{4}-\d{2}-\d{2}(?:[T_ ]\d{2}[-:.]?\d{2}(?:[-:.]?\d{2})?)?\s*$/, '');
  b = clean(b.replace(/[_-]+/g, ' '));
  const p = clean(project);
  if (p && b.toLowerCase().startsWith(p.toLowerCase() + ' ')) b = b.slice(p.length + 1).trim();
  b = b.slice(0, 60).trim() || 'Export';
  return b[0].toUpperCase() + b.slice(1);
}

export function projectLabel(project) {
  const p = clean(project).replace(/^ink atlas\b[\s:-]*/i, '').slice(0, 40).trim();
  return p || 'My tattoos';
}

export function counterKey(file, project) {
  const proj = projectLabel(project);
  return [proj, kindOf(file, proj), splitExt(file)[1]].join('|').toLowerCase();
}

// The name the next export of `file` gets, given the counts kept so far. Does not change them.
export function nextExportName(file, project, counts = {}) {
  const proj = projectLabel(project), kind = kindOf(file, proj), ext = splitExt(file)[1];
  const key = counterKey(file, project);
  const n = Math.max(0, Math.floor(Number(counts[key]) || 0)) + 1;
  return { name: `Ink Atlas - ${proj} - ${kind} ${n}${ext}`, key, n };
}

// Counts after an export used number n. Keeps at most `max` kinds, the most recent ones.
export function bumpCount(counts, key, n, max = 300) {
  const out = { ...(counts || {}) };
  delete out[key];
  out[key] = Math.max(n, Number((counts || {})[key]) || 0);
  const keys = Object.keys(out);
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) delete out[k];
  return out;
}

const STORE = 'ia-export-n';
export function readCounts(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(STORE) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  catch (_) { return {}; }
}
export function writeCounts(counts, storage = globalThis.localStorage) {
  try { storage?.setItem(STORE, JSON.stringify(counts)); } catch (_) { /* private mode: names still count up until reload */ }
}

// A namer for share.js: peeks the next name, and keeps the number only once the file went out.
export function makeNamer(getProject, storage = globalThis.localStorage) {
  let memory = null;
  // the device's counts, never below what this page already used (private mode keeps none)
  const counts = () => { const s = readCounts(storage); if (memory) for (const k in memory) s[k] = Math.max(Number(s[k]) || 0, memory[k]); return s; };
  return (file) => {
    const r = nextExportName(file, getProject(), counts());
    return { name: r.name, commit: () => { memory = bumpCount(counts(), r.key, r.n); writeCounts(memory, storage); } };
  };
}
