// Find my saves and the guards that keep a blank project from replacing real work:
// a missing save shows where the tattoos still are and one tap opens them; a save that cannot be
// opened is set aside, listed with its tattoos and kept as a file; a damaged save is never written
// over by the samples; blank projects never push real earlier saves out; projects on the shelf are
// listed too; the sheet fits an iPad both ways with 44 pt rows.
// node tools/shot.mjs shots/t140.png tools/tests/t140-find-saves.mjs
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let fails = 0;
  const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, detail); };
  const install = () => p.evaluate(() => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('ink-atlas-proto', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const run = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); let out; t.oncomplete = () => { db.close(); res(out); }; t.onerror = () => rej(t.error); const r = fn(t.objectStore('kv')); if (r) r.onsuccess = () => { out = r.result; }; }); };
    window.__idb = { get: (k) => run('readonly', (s) => s.get(k)), put: (k, v) => run('readwrite', (s) => { s.put(v, k); }), del: (k) => run('readwrite', (s) => { s.delete(k); }), keys: () => run('readonly', (s) => s.getAllKeys()) };
  });
  const reload = async () => { await p.reload({ waitUntil: 'load' }); await wait(2200); await install(); };
  const names = () => p.evaluate(() => window.__ink.state().tattoos.map((t) => t.name).join(','));
  const toastText = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t.hidden ? '' : t.textContent; });
  const recIndex = () => p.evaluate(() => window.__idb.get('recovery'));
  await install(); await wait(600);

  // a real project: the two pieces renamed as if they were Jake's own
  await p.evaluate(async () => { const r = await window.__idb.get('project'); r.state.tattoos[0].name = 'Cactus'; r.state.tattoos[1].name = 'Rose'; await window.__idb.put('project', r); });
  await reload();
  check('a real project opens', (await names()) === 'Cactus,Rose', await names());
  check('it is not taken as blank', !(await p.evaluate(() => window.__ink.looksBlank())));
  const realRec = (await recIndex()).filter((r) => r.real > 0).length;
  check('opening it keeps an earlier save that counts its own tattoos', realRec >= 1, JSON.stringify((await recIndex()).map((r) => [r.reason, r.tattoos, r.real])));
  const good = await p.evaluate(() => window.__idb.get('project'));

  // 1. the save on this device is gone (cleared, or never written) while copies still exist
  await p.evaluate(() => window.__idb.del('project')); await reload();
  check('a missing save starts on the samples', /sample/.test(await names()), await names());
  check('it is taken as blank', await p.evaluate(() => window.__ink.looksBlank()));
  const said = await toastText();
  check('it says the tattoos are still saved, with Find my saves', /still saved on this device/.test(said) && /Find my saves/.test(said), said);
  // blank boots never push real copies out of the earlier saves
  for (let i = 0; i < 3; i++) { await p.evaluate(() => window.__ink.flush()); await reload(); }
  const idx = await recIndex();
  check('blank starts add no earlier saves', idx.filter((r) => r.real === 0).length === 0 && idx.filter((r) => r.real > 0).length === realRec, JSON.stringify(idx.map((r) => [r.reason, r.tattoos, r.real])));
  // open the sheet from the toast's button and bring them back
  await p.evaluate(() => document.querySelector('#toast button')?.click()); await wait(700);
  const sheet = await p.evaluate(() => ({ open: !document.querySelector('#recover').hidden, title: document.querySelector('#rcTitle').textContent, rows: [...document.querySelectorAll('#rcList .card')].map((b) => b.textContent) }));
  check('Find my saves opens from the toast', sheet.open && sheet.title === 'Find my saves', JSON.stringify(sheet).slice(0, 200));
  check('each earlier save says how many of your tattoos it holds', sheet.rows.some((t) => /2 tattoos/.test(t)), sheet.rows.join(' | '));
  const realRow = await p.evaluate(() => [...document.querySelectorAll('#rcList .card')].findIndex((b) => /2 tattoos/.test(b.textContent)));
  await p.evaluate((i) => document.querySelectorAll('#rcList .card')[i].click(), realRow); await wait(1500);
  check('one tap brings the tattoos back', (await names()) === 'Cactus,Rose', await names());
  await p.evaluate(() => window.__ink.flush()); await wait(400);
  const back = await p.evaluate(() => window.__idb.get('project'));
  check('and they are saved on this device again', back && back.state.tattoos.map((t) => t.name).join(',') === 'Cactus,Rose');
  await p.evaluate(() => window.__ink.undo()); await wait(800);
  check('Undo puts back what was on screen', /sample/.test(await names()), await names());
  await p.evaluate((r) => window.__idb.put('project', r), good); await reload();
  check('the real project reopens', (await names()) === 'Cactus,Rose', await names());

  // 2. a save that cannot be opened (its artwork is gone) and no copy that opens either
  await p.evaluate(async () => { for (const k of await window.__idb.keys()) if (String(k).startsWith('rec:') || k === 'recovery' || String(k).startsWith('img:')) await window.__idb.del(k); });
  await reload();
  const setAsideToast = await toastText();
  check('a save that cannot be opened says where it was kept', /Find my saves/.test(setAsideToast), setAsideToast);
  const q = await p.evaluate(async () => (await window.__idb.keys()).filter((k) => String(k).startsWith('quarantine:')).length);
  check('it is set aside on this device', q >= 1, String(q));
  await wait(1500); await p.evaluate(() => window.__ink.flush()); await wait(500);
  const still = await p.evaluate(() => window.__idb.get('project'));
  check('the samples are not saved over it', still && still.state && still.state.tattoos.map((t) => t.name).join(',') === 'Cactus,Rose', JSON.stringify(still && still.state && still.state.tattoos.map((t) => t.name)));
  check('the saved line says the save is kept', /kept/.test(await p.evaluate(() => document.querySelector('#saved').textContent)), await p.evaluate(() => document.querySelector('#saved').textContent));
  await p.click('#shareBtn').catch(() => p.evaluate(() => document.querySelector('[data-open=share], #shareBtn')?.click())); await wait(500);
  await p.evaluate(() => document.querySelector('#cRecover').click()); await wait(900);
  const qs = await p.evaluate(() => ({ heads: [...document.querySelectorAll('#rcList .shHead')].map((h) => h.textContent), rows: [...document.querySelectorAll('#rcList .card')].map((b) => b.textContent), file: !!document.querySelector('#rcList .btn.quiet') }));
  check('Find my saves lists the set-aside save with its tattoos by name', qs.heads.some((h) => /could not be opened/.test(h)) && qs.rows.some((t) => /2 tattoos.*Cactus, Rose/.test(t)), JSON.stringify(qs));
  check('with Save it as a file', qs.file);
  await p.screenshot({ path: 'shots/t140-landscape.png' });
  const tiny = await p.evaluate(() => [...document.querySelectorAll('#recover button')].filter((n) => n.offsetParent).map((n) => n.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 44).length);
  check('every row and button is at least 44 pt (landscape)', tiny === 0, String(tiny));
  await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1 }); await wait(700);
  const fit = await p.evaluate(() => { const m = document.querySelector('#recover .modal').getBoundingClientRect(); return m.left >= 0 && m.right <= innerWidth + 1 && [...document.querySelectorAll('#recover button')].filter((n) => n.offsetParent).every((n) => { const r = n.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; }); });
  check('fits and keeps 44 pt in portrait', fit);
  await p.screenshot({ path: 'shots/t140-portrait.png' });
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(500);
  await p.evaluate(() => document.querySelector('[data-close=recover]').click());

  // 3. a damaged save on disk: set aside and never overwritten by the samples
  await p.evaluate(() => window.__idb.put('project', 'total garbage')); await reload();
  await wait(1200); await p.evaluate(() => window.__ink.flush()); await wait(400);
  check('a damaged save is not written over at start', (await p.evaluate(() => window.__idb.get('project'))) === 'total garbage');
  const q2 = await p.evaluate(async () => (await window.__idb.keys()).filter((k) => String(k).startsWith('quarantine:')).length);
  check('and it is set aside too', q2 > q, `${q} -> ${q2}`);

  // 4. projects on the shelf are listed
  await p.evaluate(async (r) => {
    const db = await new Promise((res, rej) => { const o = indexedDB.open('ink-atlas-project-shelf', 1); o.onupgradeneeded = () => o.result.createObjectStore('projects', { keyPath: 'id' }); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
    await new Promise((res) => { const t = db.transaction('projects', 'readwrite'); t.objectStore('projects').put({ id: 'shelf1', name: 'Left leg ideas', createdAt: Date.now(), updatedAt: Date.now(), archived: false, state: r.state, images: {} }); t.oncomplete = res; }); db.close();
  }, good);
  await p.evaluate(() => document.querySelector('#cRecover').click()); await wait(900);
  const sh = await p.evaluate(() => [...document.querySelectorAll('#rcList .card')].map((b) => b.textContent));
  check('projects on this device are listed with their tattoos', sh.some((t) => /Left leg ideas.*2 tattoos/.test(t)), sh.join(' | '));
  // 5. earlier saves whose pictures were lost: found again elsewhere on the device, or stand-ins
  await p.evaluate(() => document.querySelector('[data-close=recover]').click());
  await p.evaluate((r) => window.__idb.put('project', r), good);
  await p.evaluate(async () => { for (const k of await window.__idb.keys()) if (String(k).startsWith('quarantine:')) await window.__idb.del(k); });
  await p.evaluate(async (r) => {
    const im = {}; for (const t of r.state.tattoos) { const c = document.createElement('canvas'); c.width = 120; c.height = 120; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 120, 120); g.fillStyle = '#000'; g.fillRect(30, 30, 60, 60); im[t.img] = c.toDataURL('image/png'); }
    const db = await new Promise((res) => { const o = indexedDB.open('ink-atlas-project-shelf', 1); o.onsuccess = () => res(o.result); });
    await new Promise((res) => { const t = db.transaction('projects', 'readwrite'); t.objectStore('projects').put({ id: 'shelf2', name: 'Older copy', createdAt: Date.now(), updatedAt: Date.now(), archived: true, state: r.state, images: im }); t.oncomplete = res; }); db.close();
    for (const k of await window.__idb.keys()) if (String(k).startsWith('img:') || String(k).startsWith('rec:') || k === 'recovery') await window.__idb.del(k);
  }, good);
  await reload(); // the project's own pictures are gone, but an archived project on the shelf has them
  check('a save whose pictures were deleted opens with them found on this device', (await names()) === 'Cactus,Rose', (await names()) + ' | ' + await toastText());
  const imgs = await p.evaluate(async () => (await window.__idb.keys()).filter((k) => String(k).startsWith('img:')).length);
  check('and the pictures are stored again', imgs >= 2, String(imgs));
  // nothing anywhere: an earlier save whose pictures are nowhere opens with stand-ins in the right place
  await p.evaluate(async () => { const st = JSON.parse(JSON.stringify(window.__ink.state())); st.tattoos.forEach((t, i) => { t.img = 'nowhere' + i; }); await window.__ink.store().addRecovery(st, {}, 'Lost pictures'); });
  const lostPos = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos.map((t) => [t.name, t.width])));
  await p.evaluate(() => { document.querySelector('#toast').hidden = true; document.querySelector('#cRecover').click(); }); await wait(900);
  const li = await p.evaluate(() => [...document.querySelectorAll('#rcList .card')].findIndex((b) => /Lost pictures/.test(b.textContent)));
  await p.evaluate((i) => document.querySelectorAll('#rcList .card')[i].click(), li); await wait(2500);
  const after = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos.map((t) => [t.name, t.width])));
  const said5 = await toastText();
  check('with the pictures gone everywhere, the tattoos still come back in place', li >= 0 && after === lostPos, after + ' vs ' + lostPos + ' | ' + said5);
  check('and it says which show as Artwork missing', /Artwork missing/.test(said5), said5);
  check('stand-ins never take the lost picture’s key', await p.evaluate(() => window.__ink.state().tattoos.every((t) => t.img.startsWith('gone_'))));
  return fails;
}
