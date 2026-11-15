// Keyboard shortcuts: with a tattoo selected, the arrows move it the way they point on screen
// (presses close together are one undo step), [ and ] turn it, - and = size it, Cmd+D duplicates,
// Delete removes it with Undo; nothing moves while typing in the name, or when it is locked;
// using one ticks it in New to try.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const t = (await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos))))[0];
  const get = () => p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); return q ? JSON.parse(JSON.stringify(q)) : null; }, t.id);
  const count = () => p.evaluate(() => window.__ink.state().tattoos.length);
  const screen = (q) => p.evaluate((pos) => window.__ink.projectPoint(pos), q.pos);
  await (await p.$$('#trayItems .chip'))[0].click(); await wait(800);
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.mouse.move(5, 5);
  // tap the chip again to zoom to it, so a step shows as more than a pixel
  await (await p.$$('#trayItems .chip'))[0].click(); await wait(400);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 10000 }).catch(() => {});
  const t0 = await get(), s0 = await screen(t0);
  // three quick presses to the right: it moves right on screen, one undo step
  for (let i = 0; i < 3; i++) { await p.keyboard.press('ArrowRight'); await wait(60); }
  await wait(300);
  const t1 = await get(), s1 = await screen(t1);
  assert.ok(s1.x > s0.x + 0.5 && Math.abs(s1.y - s0.y) < (s1.x - s0.x), 'moved right on screen: ' + JSON.stringify([s0, s1]));
  const tried = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('ia-tried') || '[]'); } catch { return []; } });
  assert.ok(tried.includes('keys'), 'using it ticks it');
  await p.click('#undo'); await wait(400);
  assert.deepEqual((await get()).pos, t0.pos, 'one undo puts all three back');
  // up moves it up on screen; Shift moves further
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  await p.keyboard.press('ArrowUp'); await wait(300); const u1 = await get(), sUp = await screen(u1);
  assert.ok(sUp.y < s0.y - 1, 'up is up: ' + JSON.stringify([s0, sUp]));
  await wait(900); await p.keyboard.down('Shift'); await p.keyboard.press('ArrowUp'); await p.keyboard.up('Shift'); await wait(300);
  const u2 = await get();
  assert.ok(dist(u2.pos, u1.pos) > 3 * dist(u1.pos, t0.pos), 'Shift steps further: ' + [dist(u1.pos, t0.pos), dist(u2.pos, u1.pos)].join(' '));
  // turn and size
  const r0 = (await get()).rot || 0, w0 = (await get()).width;
  await p.keyboard.press(']'); await wait(200);
  assert.ok(Math.abs(((await get()).rot - r0) - 5 * Math.PI / 180) < 1e-6, 'turned 5 degrees');
  await p.keyboard.press('['); await p.keyboard.press('['); await wait(200);
  assert.ok(Math.abs(((await get()).rot - r0) + 5 * Math.PI / 180) < 1e-6, 'turned back past it');
  await p.keyboard.press('='); await wait(200);
  assert.ok(Math.abs((await get()).width / w0 - 1.05) < 1e-6, 'a bit bigger');
  await p.keyboard.press('-'); await wait(200);
  assert.ok(Math.abs((await get()).width / w0 - 1) < 1e-6, 'and back');
  // typing in the name moves nothing
  const before = await get();
  await p.click('#name'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press(']'); await wait(200);
  const typed = await get();
  assert.deepEqual(typed.pos, before.pos, 'name field: no move');
  await p.keyboard.press('Backspace'); await wait(200);
  assert.equal(await count(), 2, 'Backspace in the name does not remove the tattoo');
  await p.$eval('#name', (e, name) => { e.value = name; e.dispatchEvent(new Event('change')); e.blur(); }, before.name); await wait(200);
  // locked: says so, does not move
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); q.locked = true; window.__ink.commitTest(); }, t.id); await wait(200);
  const lk = await get(); await p.keyboard.press('ArrowLeft'); await wait(300);
  assert.deepEqual((await get()).pos, lk.pos, 'locked: no move');
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); q.locked = false; window.__ink.commitTest(); }, t.id); await wait(200);
  // Cmd+D duplicates, Delete removes the selected one with Undo
  const n0 = await count();
  await p.keyboard.down('Meta'); await p.keyboard.press('d'); await p.keyboard.up('Meta'); await wait(400);
  assert.equal(await count(), n0 + 1, 'duplicated');
  await p.keyboard.press('Delete'); await wait(400);
  assert.equal(await count(), n0, 'removed the copy');
  assert.ok(await get(), 'the original is still there');
  await p.click('#undo'); await wait(400);
  assert.equal(await count(), n0 + 1, 'undo brings it back');
  // nothing selected: keys do nothing
  await p.keyboard.press('Escape'); await p.evaluate(() => window.__ink.select(null)); await wait(300);
  const n1 = await count(); await p.keyboard.press('Delete'); await wait(300);
  assert.equal(await count(), n1, 'nothing selected, nothing removed');
  // ? lists the keys, with or without a tattoo selected
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.type('?'); await wait(300);
  assert.match(await p.$eval('#toast', (e) => e.textContent), /^Keys for the selected tattoo: arrows move it/);
  console.log('PASS t93-keys: moved ' + (s1.x - s0.x).toFixed(1) + ' px right in three presses, turn, size, duplicate, delete, undo');
}
