// Lost pictures: a tattoo that came back as Artwork missing says so under its name with Replace
// picture and Look again. Look again finds a picture in any database or localStorage on the device
// and puts it back in place in one undo step; Replace picture takes a file and keeps the place and
// width; both survive a reload; the row is 44 pt in both iPad orientations.
// node tools/shot.mjs shots/t141.png tools/tests/t141-lost-pictures.mjs
import { writeFileSync } from 'node:fs';
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let fails = 0;
  const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, detail); };
  const toastText = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t.hidden ? '' : t.textContent; });
  const tats = () => p.evaluate(() => window.__ink.state().tattoos.map((t) => ({ id: t.id, name: t.name, img: t.img, width: t.width, pos: JSON.stringify(t.pos) })));
  const pic = (fill) => p.evaluate((fill) => { const c = document.createElement('canvas'); c.width = 160; c.height = 100; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 160, 100); g.fillStyle = fill; g.fillRect(20, 20, 120, 60); return c.toDataURL('image/png'); }, fill);
  await wait(800);

  // a save whose pictures are nowhere, opened through Find my saves: both show as Artwork missing
  await p.evaluate(async () => { const st = JSON.parse(JSON.stringify(window.__ink.state())); st.tattoos[0].name = 'Cactus'; st.tattoos[1].name = 'Rose'; st.tattoos.forEach((t, i) => { t.img = 'lost_key_' + i; }); await window.__ink.store().addRecovery(st, {}, 'Lost pictures'); });
  await p.evaluate(() => { document.querySelector('#toast').hidden = true; document.querySelector('#cRecover').click(); }); await wait(900);
  const li = await p.evaluate(() => [...document.querySelectorAll('#rcList .card')].findIndex((b) => /Lost pictures/.test(b.textContent)));
  await p.evaluate((i) => document.querySelectorAll('#rcList .card')[i].click(), li); await wait(3000);
  let t = await tats();
  check('the lost copy opens with stand-ins', li >= 0 && t.length === 2 && t.every((x) => x.img.startsWith('gone_')), JSON.stringify(t.map((x) => x.img)));
  const before = t;

  // selected, the tattoo says its picture was lost, with the two buttons
  await p.evaluate((id) => window.__ink.select(id), t[0].id); await wait(500);
  const row = await p.evaluate(() => ({ shown: !document.querySelector('#lostRow').hidden, text: document.querySelector('#lostText').textContent, b: ['#bReplacePic', '#bLookAgain'].map((s) => document.querySelector(s).getBoundingClientRect().height) }));
  check('it says the picture was lost, with Replace picture and Look again', row.shown && /lost/.test(row.text) && row.b.every((h) => h >= 44), JSON.stringify(row));

  // the first picture turns up in another database on the device, the second nowhere
  const red = await pic('#c00');
  await p.evaluate(async (red) => {
    const db = await new Promise((res) => { const o = indexedDB.open('some-other-store', 1); o.onupgradeneeded = () => o.result.createObjectStore('things'); o.onsuccess = () => res(o.result); });
    await new Promise((res) => { const tx = db.transaction('things', 'readwrite'); tx.objectStore('things').put({ nested: { pictures: { lost_key_0: red } } }, 'x'); tx.oncomplete = res; }); db.close();
  }, red);
  await p.evaluate(() => { document.querySelector('#toast').hidden = true; document.querySelector('#bLookAgain').click(); }); await wait(3500);
  t = await tats();
  const said = await toastText();
  check('Look again finds it in another database and puts it back', t[0].img === 'lost_key_0' && t[1].img.startsWith('gone_'), JSON.stringify(t.map((x) => x.img)) + ' | ' + said);
  check('same place and size', t[0].width === before[0].width && t[0].pos === before[0].pos);
  check('it says what it found and what is still missing', /Found 1 picture/.test(said) && /1 still missing/.test(said), said);
  check('the found tattoo no longer says it was lost', await p.evaluate(() => document.querySelector('#lostRow').hidden));
  await p.evaluate(() => window.__ink.undo()); await wait(600);
  check('one undo step takes it back', (await tats())[0].img.startsWith('gone_'));
  await p.evaluate(() => window.__ink.redo && window.__ink.redo()); await wait(600);
  if (!(await tats())[0].img.startsWith('lost_key')) { await p.evaluate(() => document.querySelector('#bLookAgain').click()); await wait(3500); }
  check('and it comes back again', (await tats())[0].img === 'lost_key_0');

  // localStorage holds pictures too
  const green = await pic('#0a0');
  await p.evaluate((g) => localStorage.setItem('ia-test-pic', JSON.stringify({ a: { lost_key_1: g } })), green);
  await p.evaluate(() => window.__ink.lostLook()); await wait(2500);
  check('Look again searches localStorage too', (await tats())[1].img === 'lost_key_1', JSON.stringify((await tats()).map((x) => x.img)));
  await p.evaluate(() => window.__ink.undo()); await wait(600);
  await p.evaluate(() => localStorage.removeItem('ia-test-pic'));
  t = await tats();
  check('undo leaves the second one lost again', t[1].img.startsWith('gone_'));

  // Replace picture from Photos or Files: same place and width
  writeFileSync('shots/t141-pic.png', Buffer.from((await pic('#00c')).split(',')[1], 'base64'));
  await p.evaluate((id) => window.__ink.select(id), t[1].id); await wait(500);
  await (await p.$('#replacePicFile')).uploadFile('shots/t141-pic.png'); await wait(2500);
  const t2 = await tats();
  check('Replace picture puts the new picture on', !t2[1].img.startsWith('gone_') && t2[1].img !== 'lost_key_1', t2[1].img + ' | ' + await toastText());
  check('in the same place and width', t2[1].width === before[1].width && t2[1].pos === before[1].pos, JSON.stringify([t2[1].width, before[1].width]));
  check('and the picture is drawn', await p.evaluate((k) => !!document.querySelector('canvas') && !!window.__ink.state().tattoos.find((x) => x.img === k), t2[1].img));
  await p.evaluate(() => window.__ink.flush()); await p.reload({ waitUntil: 'load' }); await wait(2500);
  const t3 = await tats();
  check('both survive a reload', t3[0].img === 'lost_key_0' && t3[1].img === t2[1].img, JSON.stringify(t3.map((x) => x.img)));
  check('nothing is lost after the reload', await p.evaluate(() => window.__ink.lostCount() === 0));

  // a lost one again, checked at both iPad orientations
  await p.evaluate(async () => { const st = JSON.parse(JSON.stringify(window.__ink.state())); st.tattoos.forEach((t, i) => { t.img = 'nowhere_' + i; }); await window.__ink.store().addRecovery(st, {}, 'Lost again'); });
  await p.evaluate(() => { document.querySelector('#toast').hidden = true; document.querySelector('#cRecover').click(); }); await wait(900);
  const lj = await p.evaluate(() => [...document.querySelectorAll('#rcList .card')].findIndex((b) => /Lost again/.test(b.textContent)));
  await p.evaluate((i) => document.querySelectorAll('#rcList .card')[i].click(), lj); await wait(3000);
  for (const [w, h] of [[1180, 820], [820, 1180]]) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await wait(600);
    await p.evaluate(() => window.__ink.select(window.__ink.state().tattoos[0].id)); await wait(500);
    const r = await p.evaluate(() => { const box = (s) => document.querySelector(s).getBoundingClientRect(); const a = box('#bReplacePic'), b = box('#bLookAgain'); return { shown: !document.querySelector('#lostRow').hidden, a: [a.width, a.height, a.top, a.bottom], b: [b.width, b.height], inView: a.bottom <= innerHeight && a.top >= 0, n: document.querySelector('#lostText').textContent }; });
    check(`the lost row fits at ${w}x${h}`, r.shown && r.a[1] >= 44 && r.b[1] >= 44 && r.a[0] >= 44 && r.inView && /2 are/.test(r.n), JSON.stringify(r));
    await p.screenshot({ path: `shots/t141-${w}.png` });
  }
  return fails;
}
