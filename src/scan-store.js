// The fitted scan lives on this device only, in its own small database, never in the project,
// its backups or the account copy: { v, name, at, shape, off, align, stance, measures, on }.
// shape is the body sliders it was fitted to; the scan shows only while the body has that shape.
const DB = 'ink-atlas-scan', STORE = 'kv', KEY = 'scan';
function open() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('no storage')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function run(mode, fn) { const db = await open(); try { return await new Promise((res, rej) => { const tx = db.transaction(STORE, mode), q = fn(tx.objectStore(STORE)); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); } finally { db.close(); } }
export async function scanRead() {
  try { const s = await run('readonly', (st) => st.get(KEY)); return s && s.v === 1 && s.off instanceof Float32Array && s.shape ? s : null; } catch (_) { return null; }
}
export async function scanWrite(s) { try { await run('readwrite', (st) => (s ? st.put(s, KEY) : st.delete(KEY))); return true; } catch (_) { return false; } }

// The body sliders a scan belongs to, as one string (height is left out: it changes the size,
// never the shape)
export function shapeOf(state) {
  const fit = state.fit || {}, keys = Object.keys(fit).filter((k) => fit[k]).sort();
  return JSON.stringify([state.figure || 'male', +(state.muscle ?? 0.5), +(state.weight ?? 0.5), keys.map((k) => [k, +fit[k]])]);
}
