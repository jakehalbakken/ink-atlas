// Design versions: bringing art back from Procreate keeps the earlier artwork as v1 and calls the
// new one v2; More controls lists both; tapping v1 shows it on the body without changing the
// project; Side by side makes a picture; Use this one brings v1 back as one undo step; versions
// are kept after reopening. Touch sizes are checked.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ready = async () => { await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200); };
  await ready();
  const all = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
  const sun = all.find((t) => /Sunburst/.test(t.name)); assert.ok(sun, 'sample has the sunburst');
  const get = () => p.evaluate((id) => JSON.parse(JSON.stringify(window.__ink.state().tattoos.find((q) => q.id === id))), sun.id);
  await p.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); window.saved = {}; const old = URL.createObjectURL; URL.createObjectURL = function (b) { if (b.name) window.saved[b.name] = b; return old.call(this, b); }; });
  await (await p.$$('#ldList .ld-tat'))[all.findIndex((t) => t.id === sun.id)].click(); await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.selected()), sun.id);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(400);
  assert.equal(await p.$eval('#verBox', (e) => e.hidden), true, 'one artwork: no versions box');
  // out to Procreate and back with a red ring
  await p.click('#bProcreate'); await p.waitForFunction(() => !!window.saved['Sunburst.png'], { timeout: 10000 });
  await p.evaluate(() => { window.__edited = (async () => { const c = new OffscreenCanvas(900, 600), g = c.getContext('2d'); g.strokeStyle = '#c00'; g.lineWidth = 40; g.beginPath(); g.arc(450, 300, 220, 0, 7); g.stroke(); return await c.convertToBlob({ type: 'image/png' }); })();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: async () => [{ types: ['image/png'], getType: async () => await window.__edited }] } }); });
  await p.click('#pcPaste'); await p.waitForFunction(() => document.querySelector('#procreateBar').hidden, { timeout: 10000 }); await wait(600);
  const t2 = await get();
  assert.notEqual(t2.img, sun.img, 'new artwork in use');
  assert.equal(t2.vName, 'v2'); assert.equal(t2.versions.length, 1); assert.equal(t2.versions[0].img, sun.img); assert.equal(t2.versions[0].name, 'v1');
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(500);
  assert.equal(await p.$eval('#verBox', (e) => e.hidden), false, 'versions box shows');
  const btns = await p.$$eval('#verList button', (b) => b.map((x) => ({ text: x.textContent, pressed: x.getAttribute('aria-pressed'), w: x.getBoundingClientRect().width, h: x.getBoundingClientRect().height })));
  assert.deepEqual(btns.map((b) => b.text), ['v1', 'v2 now']); assert.equal(btns[1].pressed, 'true');
  for (const b of btns) assert.ok(b.w >= 44 && b.h >= 44, 'version buttons big enough');
  // peek at v1: shown, nothing saved changes
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  await (await p.$$('#verList button'))[0].click(); await wait(600);
  assert.deepEqual(await p.evaluate(() => window.__ink.peek()), { id: sun.id, name: 'v1' });
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'peeking changes nothing');
  assert.equal(await p.$eval('#verActs', (e) => e.hidden), false, 'Use this one and Side by side show');
  for (const id of ['#verUse', '#verSide']) assert.ok(await p.$eval(id, (e) => e.getBoundingClientRect().height >= 44), id + ' big enough');
  const shot = await p.evaluate(() => window.__ink.versionsShot());
  assert.match(shot || '', /^data:image\/png/, 'side by side picture');
  assert.ok(shot.length > 20000, 'the picture has something in it');
  // use v1: one undo step
  await p.click('#verUse'); await wait(500);
  const t3 = await get();
  assert.equal(t3.img, sun.img, 'v1 is back'); assert.equal(t3.vName, 'v1'); assert.deepEqual(t3.versions.map((v) => v.name), ['v2']);
  assert.equal(await p.evaluate(() => window.__ink.peek()), null, 'not peeking any more');
  await p.click('#undo'); await wait(400);
  assert.equal((await get()).img, t2.img, 'undo goes back to v2');
  await p.click('#redo'); await wait(400);
  assert.equal((await get()).img, sun.img, 'redo brings v1 again');
  // closing More controls while peeking puts the one in use back
  await (await p.$$('#verList button'))[1].click(); await wait(400);
  assert.equal((await p.evaluate(() => window.__ink.peek())).name, 'v2', 'peeking at v2');
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = false; }); await wait(400);
  assert.equal(await p.evaluate(() => window.__ink.peek()), null, 'closing stops peeking');
  // kept after reopening
  await p.evaluate(() => window.__ink.flush && window.__ink.flush()); await wait(800);
  await p.reload(); await ready();
  const back = await get();
  assert.equal(back.img, sun.img); assert.equal(back.vName, 'v1'); assert.equal(back.versions.length, 1);
  assert.ok(await p.evaluate((k) => !!window.__ink.imageOf(k), back.versions[0].img), 'v2 picture kept');
  await p.screenshot({ path: 'shots/t84-versions.png' });
  console.log('PASS t84 design versions: kept on bring back, listed, peek changes nothing, side by side, use is one undo step, kept after reopening');
}
