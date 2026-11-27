// Daily backups in the account: plain maths, no server. One file a day for each project, in the
// person's own artwork folder (<user>/backups/<project id>_<YYYY-MM-DD>.json), so nothing new is
// needed on the server: the folder's own rules already let only its owner read, add and remove.
// The pictures are not copied: they stay where the project keeps them, which never deletes them.

export const KEEP_DAYS = 30;
const ID = /^[A-Za-z0-9-]{1,64}$/;
const p2 = (n) => String(n).padStart(2, '0');

// the day on this device's own calendar
export function dayKey(d = new Date()) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }

export function backupName(projectId, day) {
  if (!ID.test(String(projectId || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return null;
  return `${projectId}_${day}.json`;
}
export function parseBackupName(name) {
  const m = /^([A-Za-z0-9-]{1,64})_(\d{4}-\d{2}-\d{2})\.json$/.exec(String(name || ''));
  return m ? { projectId: m[1], day: m[2], file: m[0] } : null;
}

// the files past the newest `keep` days of each project, to take away
export function toPrune(names, keep = KEEP_DAYS) {
  const by = new Map();
  for (const n of names) { const b = parseBackupName(n); if (!b) continue; if (!by.has(b.projectId)) by.set(b.projectId, []); by.get(b.projectId).push(b); }
  const out = [];
  for (const list of by.values()) { list.sort((a, b) => (a.day < b.day ? 1 : -1)); for (const b of list.slice(Math.max(1, keep))) out.push(b.file); }
  return out;
}

// every backup, newest first, with the project's name where it is known
export function listBackups(names, nameOf = () => '') {
  return names.map(parseBackupName).filter(Boolean)
    .map((b) => ({ ...b, name: nameOf(b.projectId) || '' }))
    .sort((a, b) => (a.day === b.day ? a.name.localeCompare(b.name) : a.day < b.day ? 1 : -1));
}

// "Today", "Yesterday" or the date in words, for the list
export function dayWords(day, now = new Date()) {
  const [y, m, d] = String(day).split('-').map(Number);
  const then = new Date(y, m - 1, d), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - then) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return then.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(y !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

// the file's contents: the project as the account has it, and which pictures it needs
export function backupBody({ projectId, name, state, imageKeys, shared = false, at = new Date() }) {
  const tattoos = Array.isArray(state && state.tattoos) ? state.tattoos.length : 0;
  return JSON.stringify({ app: 'ink-atlas-proto', kind: 'daily-backup', v: 2, savedAt: at.toISOString(), projectId, name: String(name || 'My tattoos').slice(0, 80), shared: !!shared, tattoos, image_keys: (imageKeys || []).filter((k) => typeof k === 'string'), state });
}
export function readBackupBody(text) {
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error('That backup could not be read.'); }
  if (!j || j.kind !== 'daily-backup' || !j.state || typeof j.state !== 'object' || !Array.isArray(j.state.tattoos)) throw new Error('That file is not an Ink Atlas backup.');
  return { state: j.state, keys: Array.isArray(j.image_keys) ? j.image_keys.filter((k) => typeof k === 'string') : [], projectId: String(j.projectId || ''), name: String(j.name || 'My tattoos'), savedAt: j.savedAt || null, shared: !!j.shared };
}
