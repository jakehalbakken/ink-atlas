// Durable storage on this device (IndexedDB `ink-atlas-proto`, store `kv`). Keys:
//   project             { format: 2, state, imageKeys, savedAt }   older saves: { state, images }
//   img:<key>           one artwork data URL, written once and shared by every copy below
//   recovery            [{ id, at, reason, tattoos, sig, imageKeys }], newest first
//   rec:<id>            { state, imageKeys }: an earlier save the user can go back to
//   quarantine:<time>   a stored project that could not be read, kept whole and untouched
// Every write is one transaction that either lands completely or not at all, and callers
// are told when it fails. Requests are issued without awaiting inside a transaction,
// which is what keeps Safari from closing it early.
const DB = 'ink-atlas-proto', STORE = 'kv';
export const MAX_RECOVERY = 8;

const sigOf = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; };

export async function openStore() {
  let db = null;
  try {
    db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
    });
  } catch (e) { db = null; }
  const stored = new Set(); // artwork keys known to be on disk
  let index = [];
  const tx = (mode, fn) => new Promise((res, rej) => {
    let t; try { t = db.transaction(STORE, mode); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(); t.onabort = t.onerror = () => rej(t.error || new Error('Storage failed'));
    try { fn(t.objectStore(STORE)); } catch (e) { try { t.abort(); } catch (_) { /* already closed */ } rej(e); }
  });
  const getMany = async (keys) => { const out = {}; await tx('readonly', (s) => { for (const k of keys) { const r = s.get(k); r.onsuccess = () => { out[k] = r.result; }; } }); return out; };
  const imagesFor = async (keys) => { const got = await getMany(keys.map((k) => 'img:' + k)); const images = {}; for (const k of keys) { const v = got['img:' + k]; if (typeof v === 'string') { images[k] = v; stored.add(k); } } return images; };
  const putImages = (s, imgs, keys) => { for (const k of keys) if (!stored.has(k)) s.put(imgs[k], 'img:' + k); };

  return {
    ok: !!db,
    // The project saved on this device, or null. `raw` is the record exactly as stored.
    async load() {
      if (!db) return null;
      const got = await getMany(['project', 'recovery']);
      index = Array.isArray(got.recovery) ? got.recovery.filter((r) => r && typeof r.id === 'string') : [];
      const rec = got.project; if (!rec || typeof rec !== 'object') return null;
      if (rec.format === 2 && Array.isArray(rec.imageKeys)) return { state: rec.state, images: await imagesFor(rec.imageKeys.filter((k) => typeof k === 'string')), raw: rec };
      return { state: rec.state, images: rec.images && typeof rec.images === 'object' ? rec.images : {}, raw: rec, legacy: true };
    },
    // Resolves only once the project is really on disk; rejects (for example when the device is full) otherwise.
    async save(state, imgs) {
      if (!db) throw new Error('Storage is off');
      const keys = Object.keys(imgs).filter((k) => typeof imgs[k] === 'string');
      await tx('readwrite', (s) => { putImages(s, imgs, keys); s.put({ format: 2, state, imageKeys: keys, savedAt: Date.now() }, 'project'); });
      keys.forEach((k) => stored.add(k));
    },
    listRecovery() { return index.map((r) => ({ id: r.id, at: r.at, reason: r.reason, tattoos: r.tattoos })); },
    // Keep a copy to go back to. Skipped when it would be identical to the newest copy.
    async addRecovery(state, imgs, reason) {
      if (!db) return false;
      const json = JSON.stringify(state), sig = sigOf(json);
      if (index.length && index[0].sig === sig) return false;
      const keys = [...new Set((Array.isArray(state.tattoos) ? state.tattoos : []).map((t) => t && t.img).filter((k) => typeof k === 'string' && typeof imgs[k] === 'string'))];
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const next = [{ id, at: Date.now(), reason, tattoos: Array.isArray(state.tattoos) ? state.tattoos.length : 0, sig, imageKeys: keys }, ...index];
      const drop = next.splice(MAX_RECOVERY);
      await tx('readwrite', (s) => { putImages(s, imgs, keys); s.put({ state: JSON.parse(json), imageKeys: keys }, 'rec:' + id); for (const d of drop) s.delete('rec:' + d.id); s.put(next, 'recovery'); });
      keys.forEach((k) => stored.add(k)); index = next; return true;
    },
    async loadRecovery(id) {
      if (!db) return null;
      const rec = (await getMany(['rec:' + id]))['rec:' + id]; if (!rec || typeof rec !== 'object') return null;
      return { state: rec.state, images: await imagesFor(Array.isArray(rec.imageKeys) ? rec.imageKeys : []) };
    },
    // Set an unreadable project aside, artwork included, so nothing later can overwrite it.
    async quarantine(raw, images) { if (!db) return; try { await tx('readwrite', (s) => { s.put({ raw, images, at: Date.now() }, 'quarantine:' + Date.now()); }); } catch (e) { /* best effort */ } },
    // Remove artwork that no project or recovery copy points at any more.
    async gc(liveKeys) {
      if (!db) return 0;
      const keep = new Set(liveKeys); for (const r of index) for (const k of r.imageKeys || []) keep.add(k);
      const box = {}; await tx('readonly', (s) => { const r = s.getAllKeys(); r.onsuccess = () => { box.keys = r.result; }; });
      const dead = (box.keys || []).filter((k) => typeof k === 'string' && k.startsWith('img:') && !keep.has(k.slice(4)));
      if (dead.length) { await tx('readwrite', (s) => { for (const k of dead) s.delete(k); }); dead.forEach((k) => stored.delete(k.slice(4))); }
      return dead.length;
    },
    // Ask the browser not to clear this site's data when the device runs low.
    async persist() { try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch (e) { return false; } },
  };
}
