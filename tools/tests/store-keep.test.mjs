// Pictures on the device are never removed while a stored save still names them (2026-11-20: Jake's
// saves kept their placements while their pictures were gone). Two copies of the store stand in for two
// copies of the app open on one device (two tabs, or the home-screen app and Safari).
// - clean-up keeps a picture that another copy's save added after this copy opened
// - clean-up keeps the pictures of an earlier save and a set-aside save this copy never listed
// - a save rewrites a picture that was removed under it, instead of trusting that it wrote it before
// - a picture nothing names is still cleaned up
// Run: node tools/tests/store-keep.test.mjs (set CHROME to a Chrome or headless shell)
import assert from 'node:assert/strict'; import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import puppeteer from 'puppeteer-core';
const server = createServer(async (q, r) => { try { r.setHeader('Content-Type', q.url === '/' ? 'text/html' : 'text/javascript'); r.end(q.url === '/' ? '<!doctype html><title>store</title>' : await readFile(new URL('../../src' + q.url, import.meta.url))); } catch { r.statusCode = 404; r.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r)); let b;
try {
  b = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage(); p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/`);
  const out = await p.evaluate(async () => {
    const { openStore } = await import('/store.js');
    const raw = () => new Promise((res, rej) => { const r = indexedDB.open('ink-atlas-proto', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const has = async (k) => { const d = await raw(); return new Promise((res) => { const t = d.transaction('kv', 'readonly'); const r = t.objectStore('kv').count('img:' + k); r.onsuccess = () => { d.close(); res(r.result > 0); }; }); };
    const put = async (k, v) => { const d = await raw(); return new Promise((res) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => { d.close(); res(); }; }); };
    const del = async (k) => { const d = await raw(); return new Promise((res) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => { d.close(); res(); }; }); };
    const pic = (c) => { const cv = document.createElement('canvas'); cv.width = cv.height = 4; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 4, 4); return cv.toDataURL(); };
    const tat = (id, img) => ({ id, name: id, img, pos: [0, 1, 0], normal: [0, 0, 1], w: 0.05, aspect: 1, rot: 0 });
    const r = {};
    const A = await openStore(), B = await openStore();
    await A.save({ v: 2, tattoos: [tat('rose', 'k1')] }, { k1: pic('red') });
    await B.load(); // B opened with only k1
    // A adds a piece and saves; B, which never saw it, cleans up with what it knows
    await A.save({ v: 2, tattoos: [tat('rose', 'k1'), tat('cactus', 'k2')] }, { k1: pic('red'), k2: pic('green') });
    await B.gc(['k1']);
    r.keptOtherCopysPicture = await has('k2');
    // an earlier save and a set-aside save that B never listed keep their pictures too
    await A.addRecovery({ v: 2, tattoos: [tat('old', 'k3')] }, { k3: pic('blue') }, 'test');
    await put('img:k4', pic('black')); await put('quarantine:1', { raw: { format: 2, state: { v: 2, tattoos: [tat('aside', 'k4')] }, imageKeys: ['k4'] }, images: {}, at: 1 });
    await put('img:orphan', pic('gray'));
    const n = await B.gc(['k1']);
    r.keptEarlierSave = await has('k3'); r.keptSetAside = await has('k4'); r.stillCleans = !(await has('orphan')); r.removed = n;
    // a picture removed under a copy that wrote it before is written again on its next save
    await del('img:k2');
    await A.save({ v: 2, tattoos: [tat('rose', 'k1'), tat('cactus', 'k2')] }, { k1: pic('red'), k2: pic('green') });
    r.rewritten = await has('k2');
    const back = await (await openStore()).load();
    r.reopensWhole = Object.keys(back.images).sort().join(',');
    return r;
  });
  assert.equal(out.keptOtherCopysPicture, true, 'a picture another copy saved is kept');
  assert.equal(out.keptEarlierSave, true, 'an earlier save keeps its picture');
  assert.equal(out.keptSetAside, true, 'a set-aside save keeps its picture');
  assert.equal(out.stillCleans, true, 'a picture nothing names is removed');
  assert.equal(out.removed, 1, 'only that one');
  assert.equal(out.rewritten, true, 'a save writes back a picture removed under it');
  assert.equal(out.reopensWhole, 'k1,k2', 'the save reopens with both pictures');
  console.log('PASS pictures are kept while any save names them: another copy\'s save, earlier and set-aside saves; a removed picture is written again; orphans still go');
} finally { await b?.close(); server.close(); }
