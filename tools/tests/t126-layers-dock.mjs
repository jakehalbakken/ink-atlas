// The Layers panel at the right (2026-11-19, Jake: "I almost think that the layers need to be
// fully on the left or the right side of the screen, maybe the right side, like Photoshop
// layers ... there's a button to expand the panel ... a quick button to hide planned tattoos and
// hide existing tattoos"). Checked: a slim rail by default with 44pt targets, one tap opens it
// the full height of the screen beside the tray and the edit panel, a line per tattoo that
// selects it, groups as folders with one eye, the lines scroll, the views All, On my skin and Planned
// only change what is shown (the project is untouched and they do not come back after a
// reload), open or folded is remembered, and it keeps out of the way of the measured wrap, in
// portrait and on a phone. Pictures in shots/t126-*.png.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ready = async () => { await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200); };
  await ready();
  const box = (sel) => p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
  const lw = () => p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--layers-w')));
  const json = () => p.evaluate(() => JSON.stringify(window.__ink.state()));
  const overlap = (a, b) => Math.min(a.r, b.r) > Math.max(a.x, b.x) && Math.min(a.b, b.b) > Math.max(a.y, b.y);

  // open by default on an iPad (2026-11-19, it is now the only list of tattoos); its arrow folds it
  assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('open')), true, 'starts open on an iPad');
  await p.click('#ldToggle'); await wait(500);
  // folded: a slim rail at the right edge, under the top bar, with big enough buttons
  assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('rail')), true, 'folds to a slim rail');
  const rail = await box('#layersDock'), below = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--below')));
  assert.ok(rail.w <= 64 && rail.r <= 1180 && rail.y >= below - 1, `rail at the right under the chrome: ${JSON.stringify(rail)}`);
  const small = await p.$$eval('#layersDock button', (a) => a.filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
  assert.equal(small, 0, '44pt targets on the rail');
  assert.ok((await box('#dock')).r <= rail.x + 1, 'the tray column stands left of the rail');
  await p.screenshot({ path: 'shots/t126-rail.png' });

  // open: the full height of the screen, a line per tattoo
  await p.click('#ldToggle'); await wait(500);
  const panel = await box('#layersDock');
  assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('open')), true, 'opens');
  assert.ok(panel.w >= 300 && panel.y <= below + 2 && panel.b >= 820 - 40, `full height at the right: ${JSON.stringify(panel)}`);
  assert.ok(Math.abs(await lw() - panel.w - 12) < 0.5, 'the rest of the screen makes room for it');
  for (const sel of ['#top .toolbar']) assert.equal(overlap(await box(sel), panel), false, `${sel} clear of the panel`);
  const n = await p.evaluate(() => window.__ink.state().tattoos.length);
  assert.ok(n >= 2, 'the sample tattoos');
  assert.equal(await p.$$eval('#ldList .ld-row[data-id]', (a) => a.length), n, 'a line per tattoo');
  assert.equal(await p.evaluate(() => localStorage.getItem('ia-layers-dock')), 'open', 'kept open on this device');
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('layersDock')), 'opening it ticks New to try');
  const small2 = await p.$$eval('#layersDock button', (a) => a.filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
  assert.equal(small2, 0, '44pt targets in the panel');

  // a line selects its tattoo, like the tray, and the edit panel stays beside the layers
  const [a, b] = await p.evaluate(() => window.__ink.state().tattoos.slice(0, 2).map((t) => t.id));
  await p.click(`#ldList .ld-row[data-id="${b}"] .ld-pick`); await wait(900);
  assert.equal(await p.$eval('#sheet', (e) => e.hidden), false, 'the edit panel opens');
  assert.equal(await p.$eval(`#ldList .ld-row[data-id="${b}"]`, (e) => e.classList.contains('on')), true, 'its line is marked');
  assert.equal(overlap(await box('#sheet'), await box('#layersDock')), false, 'edit panel clear of the layers');
  // make the second one ink already on me
  await p.$eval('#statusSeg .btn[aria-pressed=false]', (e) => e.click()); await wait(300);
  assert.equal(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).status, b), 'existing');
  assert.match(await p.$eval(`#ldList .ld-row[data-id="${b}"] small`, (e) => e.textContent), /On my skin/);
  await p.click('#bDone'); await wait(300);

  // the views at the top, All, On my skin and Planned: only the screen changes
  const saved = await json();
  const view = (v) => p.click(`#ldView button[data-view=${v}]`);
  assert.deepEqual(await p.$$eval('#ldView button', (bs) => bs.map((x) => x.dataset.view + ':' + x.getAttribute('aria-pressed'))), ['all:true', 'existing:false', 'planned:false'], 'All to start');
  for (const v of await p.$$('#ldView button')) { const r = await v.boundingBox(); assert.ok(r.width >= 44 && r.height >= 44, 'views 44pt'); }
  await view('existing'); await wait(300);
  assert.deepEqual(await p.evaluate(() => window.__ink.shownIds()), [b], 'On my skin leaves only the ink on me');
  assert.equal(await p.$eval('#ldView button[data-view=existing]', (e) => e.getAttribute('aria-pressed')), 'true');
  assert.equal(await p.$eval(`#ldList .ld-row[data-id="${a}"]`, (e) => e.classList.contains('dim')), true, 'its line dims');
  await p.screenshot({ path: 'shots/t126-hide-planned.png' });
  await view('planned'); await wait(300);
  assert.deepEqual(await p.evaluate(() => window.__ink.shownIds()), [a], 'Planned leaves only the plans');
  await view('all'); await wait(300);
  assert.deepEqual((await p.evaluate(() => window.__ink.shownIds())).sort(), [a, b].sort(), 'All shows both');
  await view('planned'); await wait(300);
  assert.equal(await json(), saved, 'the project is not changed by the views');
  assert.equal(await p.$eval('#undo', (e) => e.disabled), false);
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('layerViews')), 'using them ticks New to try');
  // tapping a line of a kind that is switched off brings that kind back, so you never edit unseen ink
  await p.click(`#ldList .ld-row[data-id="${b}"] .ld-pick`); await wait(700);
  assert.deepEqual(await p.evaluate(() => window.__ink.kinds()), { planned: false, existing: false });
  assert.deepEqual((await p.evaluate(() => window.__ink.shownIds())).sort(), [a, b].sort());
  await p.click('#bDone'); await wait(300);
  // the switches are not kept: after a reload everything shows, and the panel is still open
  await view('existing'); await wait(200);
  await p.reload(); await ready();
  assert.deepEqual(await p.evaluate(() => window.__ink.kinds()), { planned: false, existing: false }, 'not kept after a reload');
  assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('open')), true, 'still open after a reload');

  // a row's eye hides that one tattoo (saved, one undo step)
  await p.click(`#ldList .ld-row[data-id="${a}"] .ld-eye`); await wait(300);
  assert.equal(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).hidden, a), true);
  await p.click('#undo'); await wait(300);
  assert.equal(!!(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).hidden, a)), false, 'undo brings it back');

  // groups are folders with one eye; Select, Pick all, More opens the full Layers and groups sheet
  await p.click('#ldSelect'); await wait(300);
  await p.evaluate(() => [...document.querySelectorAll('#layersDock button')].find((x) => x.textContent === 'Pick all').click()); await wait(300);
  await p.click('#layersDock .ld-tiles button[aria-label^="More for"]'); await wait(400);
  assert.match(await p.$eval('#il-count', (e) => e.textContent), /2/, 'the sheet opens with the picked ones ticked');
  await p.type('#il-group-name', 'Left arm'); await p.click('#ink-layers [data-act="group"]'); await wait(300);
  await p.click('#ink-layers [data-act="close"]'); await wait(300);
  if ((await p.$eval('#ldSelect', (e) => e.textContent)) === 'Done') { await p.click('#ldSelect'); await wait(300); }
  assert.equal(await p.$$eval('#ldList .ld-ghead', (x) => x.length), 1, 'the group is a folder');
  assert.match(await p.$eval('#ldList .ld-ghead b', (e) => e.textContent), /Left arm/);
  await p.click('#ldList .ld-ghead .ld-eye'); await wait(300);
  assert.ok(await p.evaluate(() => window.__ink.state().tattoos.every((t) => t.hidden)), 'the group eye hides every tattoo in it');
  await p.click('#undo'); await wait(300);
  assert.ok(await p.evaluate(() => window.__ink.state().tattoos.every((t) => !t.hidden)), 'one undo step');
  await p.click('#ldList .ld-ghead .ld-fold'); await wait(200);
  assert.equal(await p.$$eval('#ldList .ld-row[data-id]', (x) => x.length), 0, 'folding the group hides its lines');
  await p.click('#ldList .ld-ghead .ld-fold'); await wait(200);
  // ⋯ moves a tattoo later in the order
  await p.click(`#ldList .ld-row[data-id="${a}"] .ld-more`); await wait(200);
  await p.evaluate((id) => [...document.querySelectorAll(`#ldList .ld-row[data-id="${id}"] .ld-acts .btn`)].find((x) => x.textContent === 'Move later').click(), a); await wait(300);
  assert.equal(await p.evaluate(() => window.__ink.state().tattoos[1].id), a, 'moved later');
  await p.click('#undo'); await wait(300);

  // many tattoos: the lines scroll inside the panel
  await p.click(`#ldList .ld-row[data-id="${a}"] .ld-pick`); await wait(600);
  for (let i = 0; i < 12; i++) { await p.evaluate(() => document.querySelector('#bDup').click()); await wait(120); }
  await wait(400);
  const sc = await p.$eval('#ldList', (e) => { const before = e.scrollTop; e.scrollTop = 200; return { over: e.scrollHeight > e.clientHeight + 40, moved: e.scrollTop > before, guard: !!e.closest('[data-scroll]') }; });
  assert.ok(sc.over && sc.moved && sc.guard, `the list scrolls: ${JSON.stringify(sc)}`);
  assert.ok((await box('#layersDock')).b <= 820, 'the panel stays on screen with many lines');
  await p.screenshot({ path: 'shots/t126-open.png' });
  await p.goto(p.url()); await ready();

  // the measured wrap gets the right side to itself
  await p.click('#projectsBtn'); await p.click('#openWrap'); await wait(900);
  assert.equal(await p.$eval('#layersDock', (e) => getComputedStyle(e).display), 'none', 'hidden while the measured wrap is open');
  assert.equal(await lw(), 0, 'and takes no room');
  await p.click('#wsDone'); await wait(500);
  assert.notEqual(await p.$eval('#layersDock', (e) => getComputedStyle(e).display), 'none', 'back after it closes');

  // fold it away again
  await p.click('#ldToggle'); await wait(300);
  assert.equal(await p.$eval('#layersDock', (e) => e.classList.contains('rail')), true, 'folds to the rail');
  assert.equal(await p.evaluate(() => localStorage.getItem('ia-layers-dock')), 'rail');

  // portrait: open beside the tray; phone: over the screen, and the rail leaves the tray its width
  await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1 }); await wait(700);
  await p.click('#ldToggle');
  await p.waitForFunction(() => { const e = document.querySelector('#layersDock'); const r = e.getBoundingClientRect(); return e.classList.contains('open') && r.bottom >= 1140 && r.right <= innerWidth - 11; }, { timeout: 8000 }).catch(() => {});
  await wait(300);
  const pp = { ...(await box('#layersDock')), iw: await p.evaluate(() => innerWidth) };
  assert.ok(pp.b >= 1180 - 40 && pp.r <= pp.iw, `full height in portrait: ${JSON.stringify(pp)}`);
  await p.screenshot({ path: 'shots/t126-portrait.png' });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 }); await wait(700);
  const ph = await box('#layersDock');
  assert.ok(ph.x <= 16 && ph.r <= 390, `phone: the panel spans the screen: ${JSON.stringify(ph)}`);
  await p.screenshot({ path: 'shots/t126-phone.png' });
  await p.click('#ldToggle'); await wait(300);
  assert.equal(await lw(), 0, 'on a phone the rail takes no room from the tray');
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(500);
  console.log('PASS t126 layers panel at the right, the All, On my skin and Planned views');
}
