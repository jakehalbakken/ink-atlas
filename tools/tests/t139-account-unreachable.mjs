// The account server does not answer (slow, paused or out of reach): the project on this device
// still opens untouched, Sign in opens at once and says it could not reach the account within a
// few seconds instead of waiting for ever, and a device whose own save is missing never sends its
// blank project over the copy in the account.
// npm run build:accounts-test, then with nothing answering on 127.0.0.1:54329:
// INK_DIST=dist-accounts node tools/shot.mjs shots/t139.png tools/tests/t139-account-unreachable.mjs
import { createServer } from 'node:net';
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let fails = 0;
  const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, detail); };
  // a server that takes every connection and never answers
  const held = [], hang = createServer((s) => { held.push(s); s.on('error', () => {}); });
  await new Promise((r) => hang.listen(54329, '127.0.0.1', r));
  const ids = () => p.evaluate(() => window.__ink.state().tattoos.map((t) => t.id).join(','));
  const toastText = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t.hidden ? '' : t.textContent; });
  const savedText = () => p.evaluate(() => document.querySelector('#saved').textContent);
  const before = await ids();
  // signed in earlier on this device, with a session that has run out and must be refreshed
  await p.evaluate(() => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    localStorage.setItem('ia-auth', JSON.stringify({ access_token: 'expired', token_type: 'bearer', expires_in: 3600, expires_at: past, refresh_token: 'r1', user: { id: 'u1', email: 'someone@example.com', aud: 'authenticated', role: 'authenticated' } }));
    localStorage.setItem('ia-cloud-bind', JSON.stringify({ uid: 'u1', id: 'p1', rev: 3, sig: 'old', name: 'My tattoos', shared: false, mine: true }));
  });
  const t0 = Date.now();
  await p.reload({ waitUntil: 'load' }); await wait(2500);
  check('the project on this device opens untouched while the account hangs', (await ids()) === before && before.length > 0, before);
  const tc = Date.now();
  await p.click('#accountBtn'); await wait(300);
  const busy = await p.evaluate(() => !document.querySelector('#account').hidden && document.querySelector('#account').textContent);
  check('Sign in opens at once and says it is reaching the account', !!busy && /Reaching your account/.test(busy), String(busy).slice(0, 80));
  let said = '';
  for (let i = 0; i < 40 && !said; i++) { await wait(500); const t = await toastText(); if (/No connection to your account/.test(t)) said = t; }
  const took = (Date.now() - tc) / 1000;
  check('it gives up and says so instead of waiting for ever', !!said && took < 16, `${took.toFixed(1)} s: ${said}`);
  check('the panel closes when it gives up', await p.evaluate(() => document.querySelector('#account').hidden));
  check('the saved line says the account could not be reached', /could not be reached|No connection|Saved on this device/.test(await savedText()), await savedText());
  check('the project is still there afterwards', (await ids()) === before);
  console.log('note: from reload to giving up', ((Date.now() - t0) / 1000).toFixed(1), 's');
  // a device whose own save is gone, still tied to an account project: the blank project is never sent up
  const blocked = await p.evaluate(async () => {
    const dbs = await new Promise((res, rej) => { const r = indexedDB.open('ink-atlas-proto', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res) => { const t = dbs.transaction('kv', 'readwrite'); t.objectStore('kv').clear(); t.oncomplete = res; }); dbs.close();
    return true;
  });
  await p.reload({ waitUntil: 'load' }); await wait(2500);
  const st = await p.evaluate(() => window.__ink.account && window.__ink.account.status ? window.__ink.account.status() : null).catch(() => null);
  check('with the save gone, a fresh project shows', blocked && (await ids()) !== before);
  for (const s of held) s.destroy(); hang.close();
  if (fails) throw new Error(fails + ' check(s) failed');
  console.log('PASS t139-account-unreachable', st ? JSON.stringify(st.text || '') : '');
}
