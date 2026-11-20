// Look for lost pictures anywhere this site keeps data on the device: every IndexedDB database
// and object store it can list, and localStorage. Only reads. A picture is matched by its key:
// a record named img:<key> or <key>, or any object (to a few levels deep) with a property named
// <key> that holds a picture. Returns { key: dataUrl } for what it found.

const isPic = (v) => typeof v === 'string' && v.startsWith('data:image/') && v.length > 64;

// pure: walk one value for the wanted keys
export function picturesIn(value, want, out = {}, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 5) return out;
  if (Array.isArray(value)) { for (const v of value.slice(0, 2000)) picturesIn(v, want, out, depth + 1); return out; }
  for (const [k, v] of Object.entries(value)) {
    if (want.has(k) && !out[k] && isPic(v)) out[k] = v;
    else if (v && typeof v === 'object') picturesIn(v, want, out, depth + 1);
  }
  return out;
}

// pure: a record's own key may name the picture
export function pictureForRecord(recordKey, value, want) {
  if (typeof recordKey !== 'string' || !isPic(value)) return null;
  const k = recordKey.startsWith('img:') ? recordKey.slice(4) : recordKey;
  return want.has(k) ? k : null;
}

function openExisting(name) {
  return new Promise((res) => {
    let r; try { r = indexedDB.open(name); } catch (e) { res(null); return; }
    // never create a database that is not there
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* aborted */ } };
    r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    setTimeout(() => res(null), 8000);
  });
}

function scanStore(db, storeName, want, out) {
  return new Promise((res) => {
    let tx; try { tx = db.transaction(storeName, 'readonly'); } catch (e) { res(); return; }
    let req; try { req = tx.objectStore(storeName).openCursor(); } catch (e) { res(); return; }
    req.onsuccess = () => {
      const c = req.result; if (!c) { res(); return; }
      try {
        const own = pictureForRecord(c.key, c.value, want);
        if (own && !out[own]) out[own] = c.value; else picturesIn(c.value, want, out);
      } catch (e) { /* skip this record */ }
      if ([...want].every((k) => out[k])) { res(); return; }
      c.continue();
    };
    req.onerror = () => res(); tx.onabort = () => res();
  });
}

export async function scanDevice(keys) {
  const want = new Set(keys.filter((k) => typeof k === 'string' && k)), out = {};
  if (!want.size) return out;
  const done = () => [...want].every((k) => out[k]);
  let dbs = [];
  try { if (indexedDB.databases) dbs = await indexedDB.databases(); } catch (e) { dbs = []; }
  const names = new Set(dbs.map((d) => d && d.name).filter(Boolean));
  for (const n of ['ink-atlas-proto', 'ink-atlas-project-shelf', 'ink-atlas-scan']) names.add(n);
  for (const name of names) {
    if (done()) break;
    if (!dbs.some((d) => d && d.name === name) && dbs.length) continue; // listed databases only, when the list works
    const db = await openExisting(name); if (!db) continue;
    try { for (const s of Array.from(db.objectStoreNames)) { if (done()) break; await scanStore(db, s, want, out); } }
    finally { try { db.close(); } catch (e) { /* closed */ } }
  }
  try {
    for (let i = 0; i < localStorage.length && !done(); i++) {
      const k = localStorage.key(i), v = localStorage.getItem(k);
      if (typeof v !== 'string' || !v.includes('data:image/')) continue;
      const own = pictureForRecord(k, v, want); if (own) { out[own] = v; continue; }
      try { picturesIn(JSON.parse(v), want, out); } catch (e) { /* not JSON */ }
    }
  } catch (e) { /* no storage */ }
  return out;
}
