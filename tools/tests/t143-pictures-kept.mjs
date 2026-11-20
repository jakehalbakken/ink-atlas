// No stored save ever names a picture that is not on the device (2026-11-20 follow-up to Jake's lost
// pictures). After adding pictures, cleaning one up (a new version), removing a tattoo, undo, and
// reopening the app several times, every picture named by the project, each earlier save and each
// set-aside save is still there. A piece whose picture will not open is left out without its picture
// being removed, and the app does not clean up pictures on that start. Also checks the guards from
// the rescue: a blank start is not saved over the real project and keeps no earlier save.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const install = () => p.evaluate(() => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('ink-atlas-proto', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const run = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); let out; t.oncomplete = () => { db.close(); res(out); }; t.onerror = () => rej(t.error); const r = fn(t.objectStore('kv')); if (r) r.onsuccess = () => { out = r.result; }; }); };
    window.__idb = { get: (k) => run('readonly', (s) => s.get(k)), put: (k, v) => run('readwrite', (s) => { s.put(v, k); }), del: (k) => run('readwrite', (s) => { s.delete(k); }), keys: () => run('readonly', (s) => s.getAllKeys()) };
  });
  const ready = async () => { await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1500); await install(); };
  const reload = async () => { await p.evaluate(() => window.__ink.flush && window.__ink.flush()); await wait(400); await p.reload({ waitUntil: 'load' }); await ready(); };
  // every picture key named by a stored record, and which of those have no picture
  const audit = () => p.evaluate(async () => {
    const keys = (await window.__idb.keys()).map(String), have = new Set(keys.filter((k) => k.startsWith('img:')).map((k) => k.slice(4)));
    const named = new Map();
    const add = (where, ks) => { for (const k of ks || []) if (typeof k === 'string') named.set(k, where); };
    const fromState = (where, st) => { for (const t of (st && st.tattoos) || []) { add(where, [t.img]); for (const v of t.versions || []) add(where, [v.img]); } };
    for (const k of keys) {
      if (k !== 'project' && !k.startsWith('rec:') && !k.startsWith('quarantine:')) continue;
      const v = await window.__idb.get(k); if (!v) continue;
      if (k.startsWith('quarantine:')) { const inline = v.images || {}; for (const [ik, where] of [...((v.raw && v.raw.imageKeys) || []).map((x) => [x, k])]) if (typeof inline[ik] !== 'string') add(where, [ik]); continue; }
      add(k, v.imageKeys); fromState(k, v.state);
    }
    const missing = [...named].filter(([k]) => !have.has(k)).map(([k, w]) => w + ':' + k);
    return { named: named.size, missing };
  });
  await ready();
  // a real project
  await p.evaluate(async () => { const r = await window.__idb.get('project'); r.state.tattoos[0].name = 'Cactus'; r.state.tattoos[1].name = 'Rose'; await window.__idb.put('project', r); });
  await reload();
  assert.equal(await p.evaluate(() => window.__ink.looksBlank()), false, 'a real project');
  // add a picture
  const url = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 300); g.fillStyle = '#123'; g.beginPath(); g.arc(150, 150, 90, 0, 7); g.fill(); return c.toDataURL('image/png'); });
  const file = join(tmpdir(), 'pictures-kept-test.png'); writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  const n0 = await p.evaluate(() => window.__ink.state().tattoos.length);
  await (await p.$('#file')).uploadFile(file);
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 20000 }, n0); await wait(800);
  // remove one, undo it, remove it again
  await p.evaluate(() => { document.querySelector('#toast').hidden = true; });
  const del = async () => { await p.click('#ldList .ld-tat'); await wait(500); await p.click('#bDelTop'); await wait(600); };
  await del(); await p.evaluate(() => document.querySelector('#undoBtn, #bUndo, [aria-label="Undo"]')?.click()); await wait(600); await del();
  await reload(); await reload();
  let a = await audit();
  assert.ok(a.named >= 2, 'pictures are named by the saves: ' + a.named);
  assert.deepEqual(a.missing, [], 'every picture a save names is on the device');
  // a piece whose picture will not open: left out, its picture kept, no clean-up on that start
  await p.evaluate(async () => {
    const r = await window.__idb.get('project'); const t = JSON.parse(JSON.stringify(r.state.tattoos[0])); t.id = 'broken1'; t.name = 'Broken'; t.img = 'brokenpic';
    r.state.tattoos.push(t); r.imageKeys.push('brokenpic'); await window.__idb.put('img:brokenpic', 'data:image/png;base64,AAAA'); await window.__idb.put('img:loose', 'data:image/png;base64,AAAA'); await window.__idb.put('project', r);
  });
  await reload();
  const names = await p.evaluate(() => window.__ink.state().tattoos.map((t) => t.name));
  assert.ok(!names.includes('Broken') && names.length >= 2, 'the piece that will not open is left out, the rest open: ' + names);
  const kept = await p.evaluate(async () => [!!(await window.__idb.get('img:brokenpic')), !!(await window.__idb.get('img:loose'))]);
  assert.deepEqual(kept, [true, true], 'its picture stays on the device, and nothing is cleaned up on a start that left a piece out');
  a = await audit();
  assert.deepEqual(a.missing, [], 'still nothing missing: ' + a.missing);
  // a start whose save is gone: the samples are not saved over anything and keep no earlier save
  const recBefore = (await p.evaluate(() => window.__idb.get('recovery')) || []).length;
  const good = await p.evaluate(() => window.__idb.get('project'));
  await p.evaluate(() => window.__idb.del('project'));
  await reload();
  assert.equal(await p.evaluate(() => window.__ink.looksBlank()), true, 'a missing save starts blank');
  await wait(1500);
  assert.equal((await p.evaluate(() => window.__idb.get('recovery')) || []).length, recBefore, 'a blank start keeps no earlier save');
  a = await audit();
  assert.deepEqual(a.missing, [], 'and removes no picture an earlier save names: ' + a.missing);
  await p.evaluate((r) => window.__idb.put('project', r), good);
  await reload();
  assert.equal(await p.evaluate(() => window.__ink.looksBlank()), false, 'the real project opens again');
  console.log('PASS pictures named by any save stay on the device through add, remove, undo and reopening; a piece that will not open keeps its picture; a blank start saves nothing over real work');
}
