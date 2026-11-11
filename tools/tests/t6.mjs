// Durable projects: reopen, leaving the app mid-edit, old storage format, damaged files,
// earlier saves, a failing disk, rapid repeats, an unreadable save, and touch target sizes.
// node tools/shot.mjs shots/t6.png tools/tests/t6.mjs
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let fails = 0;
  const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, detail); };
  const install = () => p.evaluate(() => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('ink-atlas-proto', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const run = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); let out; t.oncomplete = () => { db.close(); res(out); }; t.onerror = () => rej(t.error); const r = fn(t.objectStore('kv')); if (r) r.onsuccess = () => { out = r.result; }; }); };
    window.__idb = { get: (k) => run('readonly', (s) => s.get(k)), put: (k, v) => run('readwrite', (s) => { s.put(v, k); }), del: (k) => run('readwrite', (s) => { s.delete(k); }), keys: () => run('readonly', (s) => s.getAllKeys()) };
    window.__art = (text) => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const g = c.getContext('2d'); g.font = '40px Georgia'; g.fillText(text, 10, 60); return c.toDataURL('image/png'); };
  });
  const reload = async () => { await p.reload({ waitUntil: 'load' }); await wait(1800); await install(); };
  const st = () => p.evaluate(() => JSON.stringify(window.__ink.state()));
  const ids = () => p.evaluate(() => window.__ink.state().tattoos.map((t) => t.id).join(','));
  const toastText = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t.hidden ? '' : t.textContent; });
  const savedText = () => p.evaluate(() => document.querySelector('#saved').textContent + (document.querySelector('#saved').classList.contains('bad') ? ' [bad]' : ''));
  await install(); await wait(600);

  // 1. reopen
  const a0 = await ids(); await reload();
  const rec1 = await p.evaluate(() => window.__idb.get('project'));
  check('reopen keeps the project', (await ids()) === a0 && a0.split(',').length === 2, a0);
  check('stored in the new format, artwork kept apart', rec1.format === 2 && !rec1.images && rec1.imageKeys.length === 2 && (await p.evaluate(async (k) => typeof (await window.__idb.get('img:' + k)), rec1.imageKeys[0])) === 'string');

  // 2. leaving the app right after an edit
  await p.click('#trayItems .chip'); await wait(900);
  await p.click('#bFlip'); await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await wait(120); await reload();
  check('an edit made just before leaving is saved', await p.evaluate(() => window.__ink.state().tattoos[0].flip === true));

  // 3. a save in the old storage format (state v1, artwork embedded)
  const oldIds = await p.evaluate(async () => {
    const I = window.__ink, K = 8459, P = I.v1Positions('male', 0.4, 0.3);
    await window.__idb.put('project', { state: { app: 'ink-atlas-proto', v: 1, skin: 2, heightCm: 180, figure: 'male', muscle: 0.4, weight: 0.3, tattoos: [{ id: 'old1', name: 'Old save ink', img: 'oldk', aspect: 2, pos: [P[K * 3], P[K * 3 + 1], P[K * 3 + 2]], normal: [0, 0, 1], width: 0.09, rot: 0.2, opacity: 0.8, status: 'existing', locked: true }] }, images: { oldk: window.__art('old') } });
    return 'old1';
  });
  await reload();
  const mig = await p.evaluate(async () => { const s = window.__ink.state(), rec = await window.__idb.get('project'), list = window.__ink.store().listRecovery(); const copy = await window.__ink.store().loadRecovery(list[0].id); return { v: s.v, ids: s.tattoos.map((t) => t.id).join(','), status: s.tattoos[0] && s.tattoos[0].status, locked: s.tattoos[0] && s.tattoos[0].locked, skin: s.skin, h: s.heightCm, muscle: s.muscle, format: rec.format, embedded: !!rec.images, img: typeof (await window.__idb.get('img:oldk')), reason: list[0].reason, copyV: copy.state.v, copyArt: Object.keys(copy.images).join(',') }; });
  check('old-format save opens and upgrades', mig.v === 2 && mig.ids === oldIds && mig.status === 'existing' && mig.locked === true && mig.skin === 2 && mig.h === 180 && Math.abs(mig.muscle - 0.7) < 1e-9, JSON.stringify(mig));
  check('storage rewritten atomically to the new format', mig.format === 2 && !mig.embedded && mig.img === 'string');
  check('the save as it was is kept as an earlier save', mig.reason === 'When you opened the app' && mig.copyV === 1 && mig.copyArt === 'oldk');

  // 4. damaged and hostile files never change the project
  const base = await st();
  const bad = [
    ['not json at all', 'this is not json'],
    ['tattoos is not a list', JSON.stringify({ app: 'ink-atlas-proto', state: { tattoos: 'nope' }, images: {} })],
    ['state is null', JSON.stringify({ app: 'ink-atlas-proto', state: null })],
    ['a bare number', '42'], ['a bare list', '[1,2,3]'],
    ['every piece is missing its artwork', JSON.stringify({ app: 'ink-atlas-proto', state: { tattoos: [{ id: 'a', img: 'gone', pos: [0, 1, 0], normal: [0, 0, 1] }] }, images: {} })],
    ['artwork is not a picture', JSON.stringify({ app: 'ink-atlas-proto', state: { tattoos: [{ id: 'a', img: 'k', pos: [0, 1, 0], normal: [0, 0, 1] }] }, images: { k: 'data:image/png;base64,AAAA' } })],
    ['older backup with nothing usable', JSON.stringify({ format: 'ink-atlas-portable', project: { version: 1, tattoos: [null, { image: 'ink-atlas-image:7' }, { image: 5 }] }, assets: [] })],
  ];
  for (const [name, text] of bad) { await p.evaluate((t) => window.__ink.importBackup(t), text); await wait(150); check('rejected, nothing changed: ' + name, (await st()) === base, await toastText()); }

  // 4b. a partly damaged backup opens with the good parts, repaired and reported
  const part = await p.evaluate(async () => {
    const img = window.__art('good');
    const doc = { app: 'ink-atlas-proto', v: 2, state: { v: 2, figure: 'female', muscle: 9, weight: 'x', heightCm: 9999, skin: 77, fit: { cup: 5, bogus: 1, waist: 'x' }, tattoos: [
      { id: 'g1', name: 'Good', img: 'k1', aspect: 2, pos: [0.08, 1.3, 0.12], normal: [0, 0, 1], width: 0.1, rot: 0, opacity: 0.9 },
      { id: 'g1', name: 12, img: 'k1', aspect: 'x', pos: [1e99, 0, 0], normal: [0, 0, 0], width: -5, rot: null, opacity: 40 },
      { id: 'lost', img: 'missing', pos: [0, 1, 0], normal: [0, 0, 1] }, null, 'junk'] }, images: { k1: img } };
    await window.__ink.importBackup(JSON.stringify(doc)); const s = window.__ink.state();
    return { n: s.tattoos.length, uniq: new Set(s.tattoos.map((t) => t.id)).size, fig: s.figure, muscle: s.muscle, weight: s.weight, h: s.heightCm, skin: s.skin, fit: JSON.stringify(s.fit), t2: s.tattoos[1] && { name: s.tattoos[1].name, aspect: s.tattoos[1].aspect, width: s.tattoos[1].width, opacity: s.tattoos[1].opacity, onBody: Math.hypot(...s.tattoos[1].pos) < 3 } };
  });
  check('partly damaged backup: good parts kept, bad values repaired', part.n === 2 && part.uniq === 2 && part.fig === 'female' && part.muscle === 1 && part.weight === 0.5 && part.h === 205 && part.skin === 1 && part.fit === '{"cup":1}' && part.t2.name === 'Tattoo' && part.t2.aspect === 2 && part.t2.width === 0.012 && part.t2.opacity === 1 && part.t2.onBody, JSON.stringify(part) + ' | ' + await toastText());

  // 5. earlier saves: go back, then undo
  const afterImport = await ids();
  await wait(500); await p.click('#shareBtn'); await wait(200); await p.click('#cRecover'); await wait(300);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#rcList .card')].map((b) => b.textContent));
  await p.click('#rcList .card'); await wait(900);
  check('going back to an earlier save restores it', (await ids()) === oldIds && rows[0].includes('Before opening a backup'), rows.join(' / '));
  await p.click('#undo'); await wait(500);
  check('undo returns to where you were', (await ids()) === afterImport);
  await p.click('#redo'); await wait(500);

  // 6. a failing disk is reported, not hidden
  await p.click('#trayItems .chip'); await wait(900);
  await p.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
  await p.click('#bFlip'); await wait(900);
  const failText = await savedText(), failToast = await toastText();
  await p.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
  await p.click('#bFlip'); await wait(900);
  check('a failed save is shown as not saved, with a way out', failText.includes('Not saved') && failText.includes('[bad]') && failToast.includes('Back up now'), failText + ' | ' + failToast);
  check('saving recovers once the disk works again', (await savedText()) === 'Saved on this device');

  // 7. rapid repeats
  const flip0 = await p.evaluate(() => window.__ink.state().tattoos.find((t) => t.name === 'Old save ink').flip);
  for (let i = 0; i < 25; i++) await p.click('#bFlip');
  await wait(1200);
  const rep = await p.evaluate(async () => { const s = window.__ink.state(), rec = await window.__idb.get('project'); return { flip: s.tattoos.find((t) => t.name === 'Old save ink').flip, same: JSON.stringify(rec.state) === JSON.stringify(s), copies: window.__ink.store().listRecovery().length, saved: document.querySelector('#saved').textContent }; });
  check('25 rapid edits end in one coherent saved state', rep.flip === !flip0 && rep.same && rep.saved === 'Saved on this device' && rep.copies <= 8, JSON.stringify(rep));
  for (let i = 0; i < 25; i++) await p.click('#undo');
  check('25 undos walk all the way back', await p.evaluate((f) => window.__ink.state().tattoos.find((t) => t.name === 'Old save ink').flip === f, flip0));
  await wait(700);

  // 8. an unreadable save: fall back to the newest copy, keep the unreadable one
  const good = await ids();
  await p.evaluate(() => window.__ink.store().addRecovery(window.__ink.state(), Object.fromEntries(window.__ink.state().tattoos.map((t) => [t.img, document.querySelector('#trayItems img').src])), 'Test copy'));
  await p.evaluate(() => window.__idb.put('project', { format: 2, state: { tattoos: 'garbage' }, imageKeys: [] })); await reload();
  const fb = await p.evaluate(async () => ({ ids: window.__ink.state().tattoos.map((t) => t.id).join(','), q: (await window.__idb.keys()).filter((k) => String(k).startsWith('quarantine:')).length }));
  check('unreadable save: opens the newest copy and keeps the unreadable one', fb.ids === good && fb.q >= 1, JSON.stringify(fb) + ' | ' + await toastText());
  await p.evaluate(async () => { for (const k of await window.__idb.keys()) if (String(k).startsWith('rec:') || k === 'recovery') await window.__idb.del(k); await window.__idb.put('project', 'total garbage'); }); await reload();
  check('nothing readable at all: starts fresh without crashing', await p.evaluate(() => window.__ink.state().tattoos.length === 2 && window.__ink.state().tattoos[0].name.includes('sample')));

  // 9. touch targets
  const small = async (label) => (await p.evaluate(() => [...document.querySelectorAll('button, ink-slider, summary, input[type=text], .chip')].filter((n) => n.offsetParent !== null && !n.closest('[hidden]')).map((n) => { const r = n.getBoundingClientRect(); return { what: (n.id || n.textContent.trim().slice(0, 18) || n.tagName), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w < 44 || x.h < 44))).map((x) => `${label}:${x.what} ${x.w}x${x.h}`);
  let tiny = await small('main');
  await p.click('#trayItems .chip'); await wait(900); tiny = tiny.concat(await small('sheet'));
  await p.click('#bodyBtn'); await wait(300); await p.evaluate(() => document.querySelectorAll('#fitGroups details').forEach((d) => { d.open = true; })); await wait(200); tiny = tiny.concat(await small('body'));
  await p.click('[data-close="bodyPop"]'); await p.click('#shareBtn'); await wait(200); tiny = tiny.concat(await small('share'));
  await p.click('#cRecover'); await wait(300); tiny = tiny.concat(await small('earlier'));
  check('every control is at least 44 by 44', tiny.length === 0, tiny.join(', '));
  await p.screenshot({ path: './shots/r_earlier_saves.png' });
  console.log(fails ? `T6 FAILED: ${fails}` : 'T6 ALL PASS');
}
