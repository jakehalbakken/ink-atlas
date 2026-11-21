// A save that fails part way (the disk is full, or a value cannot be stored) fails as a whole and
// says why: the project on disk stays as it was, the save reports the real error to the app (which
// shows Not saved with a way out), and no stray uncaught error is left behind. Before 2026-11-21 a
// write made once a read had answered threw inside its callback, which left an uncaught error and
// reported only "Storage failed". Checks the project write, the check that rewrites a picture removed
// under the save, and the earlier-save copy kept when another window saved.
// Run: node tools/tests/store-fail.test.mjs (set CHROME to a Chrome or headless shell)
import assert from 'node:assert/strict'; import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import puppeteer from 'puppeteer-core';
const server = createServer(async (q, r) => { try { r.setHeader('Content-Type', q.url === '/' ? 'text/html' : 'text/javascript'); r.end(q.url === '/' ? '<!doctype html><title>store</title>' : await readFile(new URL('../../src' + q.url, import.meta.url))); } catch { r.statusCode = 404; r.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r)); let b; const errs = [];
try {
  b = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/`);
  const out = await p.evaluate(async () => {
    const { openStore } = await import('/store.js');
    const st = (n) => ({ v: 2, tattoos: Array.from({ length: n }, (_, i) => ({ id: 't' + i, name: 'Rose ' + i, img: 'k1' })) });
    const A = await openStore();
    await A.save(st(1), { k1: 'data:image/png;base64,AAAA' });
    const realPut = IDBObjectStore.prototype.put;
    const failOn = (match) => { IDBObjectStore.prototype.put = function (v, k) { if (match(k)) throw new DOMException('full', 'QuotaExceededError'); return realPut.call(this, v, k); }; };
    const tryIt = async (fn) => { try { await fn(); return 'saved'; } catch (e) { return e.name || e.message; } };
    // 1. the project record itself is written from inside a read's callback
    failOn((k) => k === 'project');
    const r1 = await tryIt(() => A.save(st(2), { k1: 'data:image/png;base64,AAAA' }));
    IDBObjectStore.prototype.put = realPut;
    const after1 = (await (await openStore()).load())?.state?.tattoos?.length;
    // 2. a picture removed under the save is written back from inside a count's callback
    const raw = await new Promise((res) => { const r = indexedDB.open('ink-atlas-proto'); r.onsuccess = () => res(r.result); });
    await new Promise((res) => { const t = raw.transaction('kv', 'readwrite'); t.objectStore('kv').delete('img:k1'); t.oncomplete = res; }); raw.close();
    failOn((k) => k === 'img:k1');
    const r2 = await tryIt(() => A.save(st(3), { k1: 'data:image/png;base64,AAAA' }));
    IDBObjectStore.prototype.put = realPut;
    const after2 = (await (await openStore()).load())?.state?.tattoos?.length;
    // 3. another window saved work: the copy of it kept on the list of earlier saves fails
    const B = await openStore(); await B.save(st(4), { k1: 'data:image/png;base64,AAAA' });
    failOn((k) => typeof k === 'string' && k.startsWith('rec:'));
    const r3 = await tryIt(() => A.save(st(5), { k1: 'data:image/png;base64,AAAA' }));
    IDBObjectStore.prototype.put = realPut;
    const after3 = (await (await openStore()).load())?.state?.tattoos?.length;
    // and with the disk working again, the next save goes through
    const r4 = await tryIt(() => A.save(st(6), { k1: 'data:image/png;base64,AAAA' }));
    const after4 = (await (await openStore()).load())?.state?.tattoos?.length;
    return { r1, after1, r2, after2, r3, after3, r4, after4 };
  });
  await new Promise((r) => setTimeout(r, 200));
  console.log(JSON.stringify(out), errs);
  assert.equal(out.r1, 'QuotaExceededError', 'a failed project write says why'); assert.equal(out.after1, 1, 'the project on disk is unchanged');
  assert.equal(out.r2, 'QuotaExceededError', 'a failed picture rewrite fails the save'); assert.equal(out.after2, 1, 'still unchanged');
  assert.equal(out.r3, 'QuotaExceededError', 'a failed earlier-save copy fails the save'); assert.equal(out.after3, 4, 'the other window\'s save stays');
  assert.equal(out.r4, 'saved', 'the next save works'); assert.ok(out.after4 === 6, 'and is on disk');
  assert.deepEqual(errs, [], 'no uncaught errors');
  console.log('PASS a save that fails part way fails whole, says why and leaves the disk as it was, with no uncaught error');
} finally { await b?.close(); server.close(); }
