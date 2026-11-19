// The calm column (2026-11-19, Jake: "there's two places now to access the existing tattoos, and it
// just needs to be in the layer panel", the top toolbar "covering some of like the layer stuff",
// "half your screen is like toolbars", lock a tattoo but "still like edit it", "lock the view in
// place", and "when I select a tattoo on the body, I want that to be opened up in the layer panel").
// No strip of tattoos along the bottom; Add tattoo and Procreate at the top of Layers (rail too);
// on an iPad the edit panel stands under Layers in one column, and a panel from the top bar takes
// that column while Layers and the edit panel step aside without moving; a locked tattoo ignores
// the body but its panel still works; the view lock keeps the camera still through drags, pinches,
// the wheel, double-tap and the view buttons, survives a reload, and a tap still picks; a tattoo
// tapped on the body opens Layers at its line.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const rect = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, vis: cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 }; });
  const overlap = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;
  // no tray, one list
  assert.equal(await p.$('#tray'), null, 'the strip along the bottom is gone');
  assert.equal(await p.$('#trayItems'), null);
  assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('open')), true, 'Layers opens by default on an iPad');
  assert.equal(await p.$eval('#add', (e) => !!e.closest('#layersDock')), true, 'Add tattoo sits in Layers');
  assert.equal(await p.$eval('#drawNew', (e) => !!e.closest('#layersDock')), true, 'Procreate sits in Layers');
  for (const s of ['#add', '#drawNew']) { const r = await rect(s); assert.ok(r.vis && r.w >= 44 && r.h >= 44, s + ' is a 44pt target'); }
  const n = await p.evaluate(() => window.__ink.state().tattoos.length);
  assert.equal(await p.$$eval('#ldList .ld-tat', (e) => e.length), n, 'a line per tattoo');
  // Add tattoo opens the file picker
  assert.equal(await p.evaluate(() => { let hit = false; const f = document.querySelector('#file'); const c = f.click; f.click = () => { hit = true; }; document.querySelector('#add').click(); f.click = c; return hit; }), true, 'the + adds a tattoo');

  // the edit panel stacks under Layers in one column
  await p.click('#ldList .ld-tat'); await wait(700);
  const sun = await p.evaluate(() => window.__ink.selected()); assert.ok(sun, 'picked from Layers');
  let ld = await rect('#layersDock'), sh = await rect('#sheet');
  assert.ok(sh.vis && ld.vis, 'both show');
  assert.ok(!overlap(ld, sh), 'Layers and the edit panel do not overlap');
  assert.ok(ld.b <= sh.t + 1, 'Layers stands above the edit panel');
  assert.ok(Math.abs(ld.l - sh.l) < 2 && Math.abs(ld.r - sh.r) < 2, 'one column, same edges');
  assert.ok(ld.h >= 180, 'Layers keeps room for its lines: ' + ld.h);
  assert.ok(sh.l > 1180 * 0.6, 'the column is at the right, the middle stays clear');
  // the name line keeps Done next to the name
  const nm = await rect('#name'), dn = await rect('#bDone'); assert.ok(Math.abs(nm.t - dn.t) < 6, 'Done sits on the name line');
  // folding the panel down leaves the name line
  const h0 = sh.h; await p.click('#bSheetMin'); await wait(400);
  sh = await rect('#sheet'); ld = await rect('#layersDock');
  assert.ok(sh.h < Math.min(h0, 110), 'folded to its name line: ' + sh.h);
  assert.ok(ld.b <= sh.t + 1, 'Layers grows into the room');
  await p.click('#bSheetMin'); await wait(400);
  assert.ok((await rect('#sheet')).h > 200, 'opens again');

  // a panel from the top bar takes the column; Layers and the edit panel step aside without moving
  const before = await rect('#layersDock');
  await p.click('#bodyBtn'); await wait(500);
  const pop = await rect('#bodyPop'); assert.ok(pop.vis, 'Body opens');
  assert.equal((await rect('#layersDock')).vis, false, 'Layers steps aside');
  assert.equal((await rect('#sheet')).vis, false, 'the edit panel steps aside');
  assert.ok(Math.abs(pop.r - before.r) < 2, 'Body lines up with the column: ' + pop.r + ' vs ' + before.r);
  await p.click('#bodyBtn'); await wait(400);
  const after = await rect('#layersDock'); assert.ok(after.vis && Math.abs(after.t - before.t) < 1 && Math.abs(after.l - before.l) < 1, 'Layers back exactly where it was');

  // folded to the rail, the edit panel stands beside it and clear of it
  await p.click('#ldToggle'); await wait(500);
  ld = await rect('#layersDock'); sh = await rect('#sheet');
  assert.ok(ld.w <= 72 && sh.vis && !overlap(ld, sh) && sh.r <= ld.l, 'edit panel beside the rail');
  for (const s of ['#add', '#drawNew']) assert.ok((await rect(s)).vis, s + ' stays on the rail');

  // locked: the body cannot move it, the panel still can
  await p.click('#bLock'); await wait(300);
  assert.equal(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).locked, sun), true);
  for (const s of ['#rSize', '#rTurn', '#bFlip', '#exactWidth']) assert.equal(await p.$eval(s, (e) => e.disabled || e.hasAttribute('disabled')), false, s + ' still works when locked');
  const pos0 = await p.evaluate((id) => JSON.stringify(window.__ink.state().tattoos.find((t) => t.id === id).pos), sun);
  const c = await p.evaluate((id) => window.__ink.projectPoint(window.__ink.viewSpot(id).pos), sun);
  await p.mouse.move(c.x, c.y); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(c.x + i * 8, c.y + i * 4); await wait(16); } await p.mouse.up(); await wait(400);
  assert.equal(await p.evaluate((id) => JSON.stringify(window.__ink.state().tattoos.find((t) => t.id === id).pos), sun), pos0, 'a drag on the body does not move a locked tattoo');
  const w0 = await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, sun);
  const nudge = await p.$('[data-nudge]');
  if (nudge) { await p.evaluate(() => { const d = document.querySelector('#editorAdvanced'); if (d) d.open = true; }); await wait(200); await p.evaluate(() => document.querySelector('[data-nudge]').click()); await wait(300); assert.notEqual(await p.evaluate((id) => JSON.stringify(window.__ink.state().tattoos.find((t) => t.id === id).pos), sun), pos0, 'a nudge still moves it'); }
  await p.evaluate(() => { const r = document.querySelector('#rSize'); r.value = String(+r.value + 0.05 * (+r.max - +r.min || 1)); r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
  assert.notEqual(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, sun), w0, 'the size slider still sizes it');
  await p.click('#bLock'); await wait(200);

  // the view lock
  await p.click('#bDone'); await wait(300);
  await p.click('#viewLock'); await wait(300);
  assert.equal(await p.$eval('#viewLock', (e) => e.getAttribute('aria-pressed')), 'true');
  const cam0 = await p.evaluate(() => window.__ink.cam().map((v) => v.toFixed(4)).join());
  const b = await rect('canvas');
  const x0 = b.l + b.w * 0.25, y0 = b.t + b.h * 0.5;
  await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(x0 + i * 12, y0 + i * 3); await wait(16); } await p.mouse.up(); await wait(500);
  await p.mouse.wheel({ deltaY: -400 }); await wait(400);
  await p.mouse.click(x0, y0 - 150); await wait(60); await p.mouse.click(x0, y0 - 150); await wait(500);
  await p.click('#views [data-view="2"]'); await wait(500); await p.click('#full'); await wait(600);
  assert.equal(await p.evaluate(() => window.__ink.cam().map((v) => v.toFixed(4)).join()), cam0, 'drag, wheel, double-tap and the view buttons leave a locked view alone');
  // a tap still picks a tattoo, and Layers opens at its line without moving the camera
  const t2 = await p.evaluate(() => window.__ink.state().tattoos.at(-1).id);
  await p.evaluate(() => { const d = window.__ink.layersDock(); d.setOpen(false, true); });
  const c2 = await p.evaluate((id) => window.__ink.projectPoint(window.__ink.viewSpot(id).pos), t2);
  if (c2.x > b.l && c2.x < b.r - 420 && c2.y > b.t + 120 && c2.y < b.b - 20) {
    await p.mouse.click(c2.x, c2.y); await wait(700);
    assert.equal(await p.evaluate(() => window.__ink.selected()), t2, 'a tap on the body still picks');
    assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('open')), true, 'Layers opens');
    assert.equal(await p.$eval(`#ldList .ld-row[data-id="${t2}"]`, (e) => e.classList.contains('on')), true, 'its line is marked');
    assert.equal(await p.evaluate(() => window.__ink.cam().map((v) => v.toFixed(4)).join()), cam0, 'picking does not move a locked view');
    await p.click('#bDone'); await wait(300);
  } else console.log('note: the last tattoo is off screen in this view, tap check skipped');
  // kept after a reload, same view
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1800);
  assert.equal(await p.$eval('#viewLock', (e) => e.getAttribute('aria-pressed')), 'true', 'still locked after a reload');
  const cam1 = (await p.evaluate(() => window.__ink.cam())), want = cam0.split(',').map(Number);
  assert.ok(cam1.every((v, i) => Math.abs(v - want[i]) < 2e-3), 'the same view comes back: ' + cam1 + ' vs ' + want);
  await p.click('#viewLock'); await wait(300);
  assert.equal(await p.$eval('#viewLock', (e) => e.getAttribute('aria-pressed')), 'false');
  await p.click('#views [data-view="2"]'); await wait(900);
  assert.notEqual(await p.evaluate(() => window.__ink.cam().map((v) => v.toFixed(4)).join()), cam0, 'unlocked, the view buttons move it again');

  // a tattoo tapped on the body (view unlocked) opens Layers at its line
  await p.click('#full'); await wait(900);
  await p.evaluate(() => window.__ink.layersDock().setOpen(false, true)); await wait(300);
  const id = await p.evaluate(() => window.__ink.state().tattoos[0].id);
  const c3 = await p.evaluate((id) => window.__ink.projectPoint(window.__ink.viewSpot(id).pos), id);
  await p.mouse.click(c3.x, c3.y); await wait(800);
  if (await p.evaluate(() => window.__ink.selected()) === id) {
    assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('open')), true, 'Layers opens at the tapped tattoo');
    assert.equal(await p.$eval(`#ldList .ld-row[data-id="${id}"]`, (e) => e.classList.contains('on')), true, 'its line is marked');
  } else console.log('note: the first tattoo was not under the tap in this view');

  // a phone: the rail holds Add and Procreate, and steps aside while the edit panel is open
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 }); await wait(900);
  await p.evaluate(() => window.__ink.layersDock().setOpen(false, true)); await wait(300);
  assert.ok((await rect('#add')).vis, 'Add tattoo on the phone rail');
  const v = await rect('#views'); assert.ok(v.l >= 0 && v.r <= 390, 'the view buttons and the lock fit a phone: ' + v.l + '..' + v.r);
  assert.ok((await rect('#viewLock')).w >= 44, 'the view lock is a 44pt target');
  await p.evaluate(() => window.__ink.layersDock().setOpen(true, true)); await wait(300);
  await p.click('#ldList .ld-tat'); await wait(700);
  assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('open')), false, 'picking a line on a phone folds Layers away');
  assert.equal((await rect('#layersDock')).vis, false, 'and the rail steps aside for the edit panel');
  await p.click('#bDone'); await wait(400);
  assert.ok((await rect('#layersDock')).vis, 'the rail comes back');
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(600);
}
