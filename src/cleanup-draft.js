// The Clean up workspace in progress, kept on this device so a page that the iPad reloads or closes
// (it does that to a tab that runs short of memory, or to the app while it sits behind Procreate or
// Photos) comes back to the same picture instead of losing every edit made since Clean up opened.
// One draft at a time, in its own IndexedDB database `ink-atlas-cleanup-draft`, never in the project,
// the backups or the account. Written a moment after each change and when the app leaves the screen,
// cleared when Clean up closes with Done, Cancel or Discard.
const DB = 'ink-atlas-cleanup-draft', STORE = 'draft', KEY = 'current';
// a draft older than this is left alone and cleared: the person has long moved on
export const DRAFT_MAX_AGE = 14 * 24 * 3600 * 1000;

let dbp = null;
function open() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('No storage'));
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbp = null; }; res(db); };
    r.onerror = () => { dbp = null; rej(r.error); }; r.onblocked = () => { dbp = null; rej(new Error('Draft storage blocked')); };
  });
  return dbp;
}
async function run(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE));
    t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error || new Error('Draft storage failed'));
  });
}

// What a stored draft must look like before it is trusted. Pictures are PNG bytes.
const isRect = (r) => !!r && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(r[k])) && r.w > 0 && r.h > 0;
const isPng = (b) => b instanceof ArrayBuffer && b.byteLength > 33 && new Uint8Array(b, 0, 4).every((v, i) => v === [137, 80, 78, 71][i]);
export function cleanDraft(d) {
  if (!d || typeof d !== 'object' || d.v !== 1) return null;
  if (typeof d.tattooId !== 'string' || typeof d.img !== 'string' || typeof d.sourceHash !== 'string' || typeof d.openHash !== 'string') return null;
  if (!isPng(d.full) || !isPng(d.baseline) || !isRect(d.rect) || !isRect(d.ref)) return null;
  if (!Number.isFinite(d.at) || !Number.isFinite(d.fw) || !Number.isFinite(d.fh) || d.fw < 1 || d.fh < 1) return null;
  if (d.rect.x < 0 || d.rect.y < 0 || d.rect.x + d.rect.w > d.fw || d.rect.y + d.rect.h > d.fh) return null;
  return {
    v: 1, tattooId: d.tattooId, img: d.img, name: typeof d.name === 'string' ? d.name.slice(0, 80) : '', sourceHash: d.sourceHash, openHash: d.openHash,
    full: d.full, baseline: d.baseline, fw: d.fw, fh: d.fh, rect: { ...d.rect }, ref: { ...d.ref },
    opened: d.opened && isRect(d.opened.ref) ? { ref: { ...d.opened.ref }, fw: +d.opened.fw || 0, fh: +d.opened.fh || 0 } : null,
    hadSession: !!d.hadSession, tool: typeof d.tool === 'string' ? d.tool : '', steps: Math.max(0, Math.floor(+d.steps || 0)), at: d.at,
  };
}
export async function readDraft() { try { return cleanDraft(await run('readonly', (s) => s.get(KEY))); } catch (e) { return null; } }
export async function writeDraft(d) { await run('readwrite', (s) => s.put(d, KEY)); return true; }
export async function clearDraft() { try { await run('readwrite', (s) => s.delete(KEY)); return true; } catch (e) { return false; } }
// Which draft, if any, belongs to a tattoo as it is now: same tattoo, same picture, not too old.
export function draftFits(d, t, now = Date.now()) { return !!(d && t && d.tattooId === t.id && d.img === t.img && now - d.at < DRAFT_MAX_AGE); }
