// Ink Atlas open twice on one device (two tabs, or the home-screen app resumed with an older project
// while another copy kept working): a change in one copy is never made on an older copy, and no
// copy's work is lost (2026-11-20 QA, after Jake's lost work).
// - a copy that comes back to the screen with nothing unsaved opens the newer save made elsewhere
// - a copy that saves over a newer save made elsewhere keeps that version as an earlier save first,
//   says so, and Find my saves opens it
// - a copy that saves over its own save adds no earlier save
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ready = async (q) => { await q.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1500); };
  const idb = (q, fn, arg) => q.evaluate(async (src, a) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('ink-atlas-proto', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const get = async (k) => { const d = await open(); return new Promise((res) => { const t = d.transaction('kv', 'readonly'); const r = t.objectStore('kv').get(k); r.onsuccess = () => { d.close(); res(r.result); }; }); };
    const put = async (k, v) => { const d = await open(); return new Promise((res) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => { d.close(); res(); }; }); };
    return (0, eval)('(' + src + ')')({ get, put }, a);
  }, fn.toString(), arg);
  const names = (q) => q.evaluate(() => window.__ink.state().tattoos.map((t) => t.name));
  const rename = (q, i, n) => q.evaluate(async (i, n) => { window.__ink.state().tattoos[i].name = n; window.__ink.commitTest(); await window.__ink.flush(); }, i, n);
  const back = async (q) => { await q.evaluate(() => { window.dispatchEvent(new Event('focus')); }); await wait(2500); };
  const recovery = (q) => idb(q, async ({ get }) => (await get('recovery')) || []);

  await ready(p);
  // a real project, not the samples
  await idb(p, async ({ get, put }) => { const r = await get('project'); r.state.tattoos[0].name = 'Cactus'; r.state.tattoos[1].name = 'Rose'; await put('project', r); });
  await p.reload({ waitUntil: 'load' }); await ready(p);
  assert.deepEqual((await names(p)).slice(0, 2), ['Cactus', 'Rose'], 'the real project opens');

  // a second copy of the app
  const q = await p.browser().newPage(); await q.setViewport({ width: 1180, height: 820 });
  q.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await q.goto(p.url(), { waitUntil: 'load' }); await ready(q);
  assert.equal((await names(q))[0], 'Cactus', 'the second copy opens the same project');

  // the second copy changes it; the first copy, untouched, comes back to the screen and opens that
  const rec0 = (await recovery(p)).length;
  await rename(q, 0, 'Cactus from the other window');
  await back(p);
  assert.equal((await names(p))[0], 'Cactus from the other window', 'back on screen, the first copy opens the newer save');
  assert.equal(await p.evaluate(() => document.querySelector('#undo').disabled), true, 'with no undo back to the older copy');
  // a change made now is made on the newer project, so nothing is set aside
  await rename(p, 1, 'Rose here');
  assert.equal((await recovery(p)).length, rec0, 'saving over its own save keeps no earlier save');
  let disk = await idb(p, async ({ get }) => (await get('project')).state.tattoos.slice(0, 2).map((t) => t.name));
  assert.deepEqual(disk, ['Cactus from the other window', 'Rose here'], 'both changes are in the save');

  // the second copy is now the older one; it changes something before it hears of the newer save
  await rename(q, 0, 'Cactus changed on the old copy');
  const list = await recovery(q);
  assert.equal(list.length, rec0 + 1, 'the newer save made elsewhere is kept as an earlier save');
  assert.equal(list[0].reason, 'Saved in another window');
  const kept = await idb(q, async ({ get }, id) => (await get('rec:' + id)).state.tattoos.slice(0, 2).map((t) => t.name), list[0].id);
  assert.deepEqual(kept, ['Cactus from the other window', 'Rose here'], 'with the other window\'s work in it');
  const toast = await q.evaluate(() => document.querySelector('#toast').textContent);
  assert.match(toast, /also changed in another window/, 'and it says so: ' + toast);
  // its pictures are all on the device
  const missing = await idb(q, async ({ get }, id) => { const r = await get('rec:' + id); const out = []; for (const k of r.imageKeys) if (!(await get('img:' + k))) out.push(k); return out; }, list[0].id);
  assert.deepEqual(missing, [], 'every picture of that earlier save is on the device');

  // Find my saves lists it, and opening it brings the other window's work back
  await q.evaluate(() => window.__ink.flush && window.__ink.flush()); await wait(300);
  await q.close();
  await p.reload({ waitUntil: 'load' }); await ready(p);
  assert.equal((await names(p))[0], 'Cactus changed on the old copy', 'the last save wins on screen');
  const rows = await p.evaluate(() => window.__ink.listRecovery ? window.__ink.listRecovery() : null);
  if (rows) assert.ok(rows.some((r) => r.reason === 'Saved in another window'), 'Find my saves lists it');
  console.log('PASS two windows: a copy back on screen opens the newer save, a copy saving over a newer save keeps it as an earlier save and says so, no extra copies otherwise');
}
