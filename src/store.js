import { imageKeysFor } from './project.js';
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
  // Which save this page last read or wrote. Another copy of the app open on the device (a second tab, or the
  // home-screen app resumed with an older project) writes a different one, so a save from here can tell that
  // its project changed elsewhere and keep that version as an earlier save before writing (2026-11-20).
  let mine = null;
  const sidOf = (rec) => (rec && typeof rec === 'object' ? (typeof rec.sid === 'string' ? rec.sid : rec.savedAt ? 't' + rec.savedAt : null) : null);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const hasWork = (st) => !!st && typeof st === 'object' && ((Array.isArray(st.tattoos) && st.tattoos.some((t) => !/\(sample\)$/.test(String((t && t.name) || '')))) || (Array.isArray(st.regions) && st.regions.length > 0) || (Array.isArray(st.refs) && st.refs.length > 0) || (Array.isArray(st.notes) && st.notes.length > 0) || !!st.paint);
  // Inside a readwrite transaction: put a copy on the list of earlier saves, read from disk, never from
  // what this page remembers, so two copies of the app never drop each other's earlier saves.
  const pushRecovery = (s, state, keys, reason, done) => {
    const g = s.get('recovery');
    g.onsuccess = () => {
      const list = Array.isArray(g.result) ? g.result.filter((r) => r && typeof r.id === 'string') : [];
      const json = JSON.stringify(state), sig = sigOf(json);
      if (list.length && list[0].sig === sig) { index = list; done(false); return; }
      const id = newId(), tattoos = Array.isArray(state.tattoos) ? state.tattoos : [];
      const next = [{ id, at: Date.now(), reason, tattoos: tattoos.length, real: tattoos.filter((t) => !/\(sample\)$/.test(String((t && t.name) || ''))).length, sig, imageKeys: keys }, ...list];
      const drop = next.splice(MAX_RECOVERY);
      s.put({ state: JSON.parse(json), imageKeys: keys }, 'rec:' + id); for (const d of drop) s.delete('rec:' + d.id); s.put(next, 'recovery');
      index = next; done(true);
    };
  };
  const tx = (mode, fn) => new Promise((res, rej) => {
    let t; try { t = db.transaction(STORE, mode); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(); t.onabort = t.onerror = () => rej(t.error || new Error('Storage failed'));
    try { fn(t.objectStore(STORE)); } catch (e) { try { t.abort(); } catch (_) { /* already closed */ } rej(e); }
  });
  const getMany = async (keys) => { const out = {}; await tx('readonly', (s) => { for (const k of keys) { const r = s.get(k); r.onsuccess = () => { out[k] = r.result; }; } }); return out; };
  const imagesFor = async (keys) => { const got = await getMany(keys.map((k) => 'img:' + k)); const images = {}; for (const k of keys) { const v = got['img:' + k]; if (typeof v === 'string') { images[k] = v; stored.add(k); } } return images; };
  // A picture this page already wrote is checked, not trusted: another copy of the app open on the same
  // device (a second tab, the home-screen app and Safari) can have removed it since, and a save that
  // only named it would then point at nothing (2026-11-20).
  const putImages = (s, imgs, keys) => { for (const k of keys) { if (!stored.has(k)) { s.put(imgs[k], 'img:' + k); continue; } const c = s.count('img:' + k); c.onsuccess = () => { if (!c.result) s.put(imgs[k], 'img:' + k); }; } };
  // Every picture key a stored record names: the project, each earlier save, the list of them and each set-aside save.
  const namedBy = (key, v, into) => {
    if (!v || typeof v !== 'object') return;
    const add = (ks) => { if (Array.isArray(ks)) for (const k of ks) if (typeof k === 'string') into.add(k); };
    const scan = (st) => { if (st && typeof st === 'object') { try { add(imageKeysFor(st)); } catch (e) { /* an odd record still keeps what it lists */ } } };
    if (key === 'recovery') { if (Array.isArray(v)) for (const r of v) add(r && r.imageKeys); return; }
    add(v.imageKeys); scan(v.state);
    if (key.startsWith('quarantine:') && v.raw && typeof v.raw === 'object') { add(v.raw.imageKeys); scan(v.raw.state || v.raw); if (v.raw.images && typeof v.raw.images === 'object') add(Object.keys(v.raw.images)); }
  };

  return {
    ok: !!db,
    // The project saved on this device, or null. `raw` is the record exactly as stored.
    async load() {
      if (!db) return null;
      const got = await getMany(['project', 'recovery']);
      index = Array.isArray(got.recovery) ? got.recovery.filter((r) => r && typeof r.id === 'string') : [];
      const rec = got.project; mine = sidOf(rec); if (rec == null) return null;
      if (typeof rec !== 'object') throw new Error('The save on this device is damaged'); // set aside, never written over
      if (rec.format === 2 && Array.isArray(rec.imageKeys)) return { state: rec.state, images: await imagesFor(rec.imageKeys.filter((k) => typeof k === 'string')), raw: rec };
      return { state: rec.state, images: rec.images && typeof rec.images === 'object' ? rec.images : {}, raw: rec, legacy: true };
    },
    // Resolves only once the project is really on disk; rejects (for example when the device is full) otherwise.
    // When the project on disk was written by another copy of the app since this page read or wrote it, that
    // version is kept as an earlier save first ({ other: true }), so neither copy's work is lost.
    async save(state, imgs) {
      if (!db) throw new Error('Storage is off');
      const keys = Object.keys(imgs).filter((k) => typeof imgs[k] === 'string');
      const sid = newId(); let other = false;
      await tx('readwrite', (s) => {
        putImages(s, imgs, keys);
        const g = s.get('project');
        g.onsuccess = () => {
          const cur = g.result, write = () => s.put({ format: 2, state, imageKeys: keys, savedAt: Date.now(), sid }, 'project');
          const theirs = sidOf(cur);
          if (theirs && theirs !== mine && cur && typeof cur === 'object' && hasWork(cur.state)) {
            const ks = new Set(Array.isArray(cur.imageKeys) ? cur.imageKeys.filter((k) => typeof k === 'string') : []);
            try { for (const k of imageKeysFor(cur.state)) ks.add(k); } catch (e) { /* keeps what it lists */ }
            pushRecovery(s, cur.state, [...ks], 'Saved in another window', (kept) => { other = kept; write(); });
          } else write();
        };
      });
      mine = sid; keys.forEach((k) => stored.add(k));
      return { other };
    },
    // True when the project on disk is not the one this page last read or wrote: another copy of the app saved it.
    async changedElsewhere() {
      if (!db) return false;
      const rec = (await getMany(['project'])).project; const theirs = sidOf(rec);
      return !!theirs && theirs !== mine;
    },
    listRecovery() { return index.map((r) => ({ id: r.id, at: r.at, reason: r.reason, tattoos: r.tattoos })); },
    // Keep a copy to go back to. Skipped when it would be identical to the newest copy.
    async addRecovery(state, imgs, reason) {
      if (!db) return false;
      const json = JSON.stringify(state), sig = sigOf(json);
      if (index.length && index[0].sig === sig) return false;
      const keys = imageKeysFor(state).filter((k) => typeof imgs[k] === 'string');
      let added = false;
      await tx('readwrite', (s) => { putImages(s, imgs, keys); pushRecovery(s, JSON.parse(json), keys, reason, (kept) => { added = kept; }); });
      keys.forEach((k) => stored.add(k)); return added;
    },
    async loadRecovery(id) {
      if (!db) return null;
      const rec = (await getMany(['rec:' + id]))['rec:' + id]; if (!rec || typeof rec !== 'object') return null;
      return { state: rec.state, images: await imagesFor(Array.isArray(rec.imageKeys) ? rec.imageKeys : []) };
    },
    // Set an unreadable project aside, artwork included, so nothing later can overwrite it.
    async quarantine(raw, images) { if (!db) return false; try { await tx('readwrite', (s) => { s.put({ raw, images, at: Date.now() }, 'quarantine:' + Date.now()); }); return true; } catch (e) { return false; } },
    // The project record exactly as stored, set aside before anything replaces it. False when it cannot be read.
    async setAsideCurrent() {
      if (!db) return false;
      try { const rec = (await getMany(['project'])).project; if (!rec) return true; const keys = Array.isArray(rec.imageKeys) ? rec.imageKeys.filter((k) => typeof k === 'string') : []; return await this.quarantine(rec, keys.length ? await imagesFor(keys) : (rec.images || {})); } catch (e) { return false; }
    },
    // Every set-aside unreadable save, newest first: { key, at, tattoos, name }.
    async listQuarantine() {
      if (!db) return [];
      const box = {}; await tx('readonly', (s) => { const r = s.getAllKeys(); r.onsuccess = () => { box.keys = r.result; }; });
      const keys = (box.keys || []).filter((k) => typeof k === 'string' && k.startsWith('quarantine:'));
      const got = keys.length ? await getMany(keys) : {};
      return keys.map((key) => {
        const q = got[key] || {}; const st = q.raw && typeof q.raw === 'object' ? (q.raw.state || q.raw) : null;
        return { key, at: q.at || Number(key.slice(11)) || 0, tattoos: st && Array.isArray(st.tattoos) ? st.tattoos.length : 0, real: st && Array.isArray(st.tattoos) ? st.tattoos.filter((t) => !/\(sample\)$/.test(String((t && t.name) || ''))).length : 0, names: st && Array.isArray(st.tattoos) ? st.tattoos.map((t) => t && t.name).filter(Boolean).slice(0, 4) : [] };
      }).sort((a, b) => b.at - a.at);
    },
    async loadQuarantine(key) {
      if (!db || typeof key !== 'string' || !key.startsWith('quarantine:')) return null;
      const q = (await getMany([key]))[key]; if (!q || typeof q !== 'object') return null;
      const raw = q.raw && typeof q.raw === 'object' ? q.raw : null; if (!raw) return null;
      const state = raw.state && typeof raw.state === 'object' ? raw.state : raw;
      let images = q.images && typeof q.images === 'object' ? { ...q.images } : {};
      const want = Array.isArray(raw.imageKeys) ? raw.imageKeys.filter((k) => typeof images[k] !== 'string') : [];
      if (want.length) Object.assign(images, await imagesFor(want));
      return { state, images };
    },
    // Pictures by key from anywhere on this device: their own records, then any set-aside save.
    async findImages(keys) {
      if (!db || !keys.length) return {};
      const out = await imagesFor(keys); let left = keys.filter((k) => typeof out[k] !== 'string');
      if (!left.length) return out;
      const box = {}; await tx('readonly', (s) => { const r = s.getAllKeys(); r.onsuccess = () => { box.keys = r.result; }; });
      for (const qk of (box.keys || []).filter((k) => typeof k === 'string' && k.startsWith('quarantine:'))) {
        const q = (await getMany([qk]))[qk]; const im = q && q.images && typeof q.images === 'object' ? q.images : {};
        for (const k of left) if (typeof im[k] === 'string' && im[k].startsWith('data:image/')) out[k] = im[k];
        left = left.filter((k) => typeof out[k] !== 'string'); if (!left.length) break;
      }
      return out;
    },
    // Remove artwork that nothing stored on this device names any more. Read and removed in one
    // transaction, from what is on disk at that moment (never from what this page remembers), so a
    // save made by another copy of the app, or an earlier save this page has not listed, keeps its pictures.
    async gc(liveKeys) {
      if (!db) return 0;
      let removed = 0;
      await tx('readwrite', (s) => {
        const keep = new Set(liveKeys); for (const r of index) for (const k of r.imageKeys || []) keep.add(k);
        const all = s.getAllKeys();
        all.onsuccess = () => {
          const keys = (all.result || []).filter((k) => typeof k === 'string');
          const holders = keys.filter((k) => k === 'project' || k === 'recovery' || k.startsWith('rec:') || k.startsWith('quarantine:'));
          const sweep = () => { for (const k of keys) if (k.startsWith('img:') && !keep.has(k.slice(4))) { s.delete(k); stored.delete(k.slice(4)); removed++; } };
          let left = holders.length; if (!left) { sweep(); return; }
          for (const h of holders) { const g = s.get(h); g.onsuccess = () => { namedBy(h, g.result, keep); if (--left === 0) sweep(); }; }
        };
      });
      return removed;
    },
    // Ask the browser not to clear this site's data when the device runs low.
    async persist() { try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch (e) { return false; } },
  };
}
