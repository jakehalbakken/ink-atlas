// The page's connection to its database dropped while the page lived on (WebKit does this when the
// iPad runs short of memory and after time in the background) and every save after it failed with
// "Not saved: storage problem" until a reload (2026-11-27, Jake, a project of 87 layers). The store now
// opens the connection again and tries the same write once more. Checks: a save after the connection
// is lost lands, the project read back is the new one, earlier saves and pictures are still there,
// a failure that is not a lost connection (a full disk) is still reported, and nothing is written twice.
// Run: node tools/tests/store-reconnect.test.mjs (uses the browser's IndexedDB through puppeteer when
// CHROME is set, otherwise fake-indexeddb if it is installed: FAKE_IDB=<path to its auto.js>)
import assert from 'node:assert/strict';
const run = async (openStore) => {
  const st = (n) => ({ v: 2, tattoos: Array.from({ length: n }, (_, i) => ({ id: 't' + i, name: 'Rose ' + i, img: 'k' + (i % 3) })) });
  const imgs = { k0: 'data:image/png;base64,AAAA', k1: 'data:image/png;base64,BBBB', k2: 'data:image/png;base64,CCCC' };
  const A = await openStore();
  await A.save(st(5), imgs); await A.addRecovery(st(4), imgs, 'test');
  const out = {};
  A.dropConnection();
  try { await A.save(st(87), imgs); out.first = 'saved'; } catch (e) { out.first = e.name || e.message; }
  out.reopened = A.reopened;
  A.dropConnection(); A.dropConnection();
  try { await A.save(st(88), imgs); out.second = 'saved'; } catch (e) { out.second = e.name || e.message; }
  const B = await openStore(); const back = await B.load();
  out.count = back && back.state.tattoos.length; out.pics = back && Object.keys(back.images).sort().join(',');
  out.recovery = B.listRecovery().length;
  const realPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (v, k) { if (k === 'project') throw new DOMException('full', 'QuotaExceededError'); return realPut.call(this, v, k); };
  try { await B.save(st(90), imgs); out.full = 'saved'; } catch (e) { out.full = e.name; }
  IDBObjectStore.prototype.put = realPut;
  out.afterFull = (await (await openStore()).load()).state.tattoos.length;
  return out;
};
let out;
if (process.env.CHROME) {
  const { createServer } = await import('node:http'); const { readFile } = await import('node:fs/promises'); const puppeteer = (await import('puppeteer-core')).default;
  const server = createServer(async (q, r) => { try { r.setHeader('Content-Type', q.url === '/' ? 'text/html' : 'text/javascript'); r.end(q.url === '/' ? '<!doctype html><title>store</title>' : await readFile(new URL('../../src' + q.url, import.meta.url))); } catch { r.statusCode = 404; r.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const b = await puppeteer.launch({ executablePath: process.env.CHROME, headless: true, args: ['--no-sandbox'] });
  try { const p = await b.newPage(); await p.goto(`http://127.0.0.1:${server.address().port}/`); out = await p.evaluate(`(${run.toString()})((await import('/store.js')).openStore)`); }
  finally { await b.close(); server.close(); }
} else {
  await import(process.env.FAKE_IDB || 'fake-indexeddb/auto');
  out = await run((await import('../../src/store.js')).openStore);
}
console.log(out);
assert.equal(out.first, 'saved', 'a save after the connection is lost lands');
assert.ok(out.reopened >= 1, 'the connection was opened again');
assert.equal(out.second, 'saved', 'and again after a second loss');
assert.equal(out.count, 88, 'the newest project is the one on disk');
assert.equal(out.pics, 'k0,k1,k2', 'every picture is still there');
assert.ok(out.recovery >= 1, 'earlier saves are still listed');
assert.equal(out.full, 'QuotaExceededError', 'a full disk is still reported, not retried away');
assert.equal(out.afterFull, 88, 'a failed save leaves the project on disk as it was');
console.log('store reconnect: ok');
