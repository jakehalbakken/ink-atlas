// t172 Layers' All / On my skin / Planned views and the selected tattoo. A picture added while only
// On my skin showed became a planned tattoo that was selected, with its handles and edit sheet, but
// drew nothing on the body. Now a selected tattoo always shows: adding, picking a dimmed line or
// switching it between On my skin and Planned brings its kind back into view, with a message.
import assert from 'node:assert/strict';
import fs from 'node:fs';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(500); }
  const S = () => p.evaluate(() => window.__ink.state());
  const view = () => p.$eval('#ldView [aria-pressed="true"]', (e) => e.dataset.view).catch(() => 'none');
  const shown = () => p.evaluate(() => window.__ink.shownIds());
  const toastText = () => p.evaluate(() => document.querySelector('#toast')?.textContent || '');
  const sun = (await S()).tattoos.find((t) => /Sunburst/.test(t.name)).id;
  await p.evaluate((id) => { const t = window.__ink.state().tattoos.find((q) => q.id === id); t.status = 'existing'; t.locked = true; window.__ink.commitTest(); window.__ink.select(null); }, sun); await wait(400);

  // 1. add a picture while only On my skin shows
  await p.click('#ldView [data-view="existing"]'); await wait(500);
  assert.equal(await view(), 'existing');
  const url = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#222'; g.fillRect(40, 40, 120, 120); return c.toDataURL(); });
  const path = '/tmp/t172-square.png'; fs.writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'));
  const n0 = (await S()).tattoos.length;
  await (await p.$('#file')).uploadFile(path); await p.waitForFunction((n) => window.__ink.state().tattoos.length > n, { timeout: 15000 }, n0); await wait(1200);
  const added = (await S()).tattoos.at(-1);
  assert.equal(await p.evaluate(() => window.__ink.selected()), added.id, 'the new tattoo is selected');
  assert.ok((await shown()).includes(added.id), 'and it shows on the body');
  assert.equal(await view(), 'all', 'the view went back to All');
  assert.match(await toastText(), /Showing all tattoos/, 'with a message');
  assert.ok((await shown()).includes(sun), 'the ink on my skin still shows');

  // 2. pick a dimmed line while only Planned shows
  await p.click('#ldView [data-view="planned"]'); await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.selected()), added.id, 'a planned tattoo stays selected under Planned');
  assert.ok(!(await shown()).includes(sun), 'on my skin is off');
  await p.click(`#ldList .ld-row[data-id="${sun}"] .ld-pick`); await wait(700);
  assert.equal(await p.evaluate(() => window.__ink.selected()), sun, 'the dimmed line is selected');
  assert.ok((await shown()).includes(sun), 'and now shows on the body');
  assert.equal(await view(), 'all');

  // 3. switch a tattoo's kind while the view shows only its old kind
  await p.evaluate((id) => window.__ink.select(id), added.id); await wait(300);
  await p.click('#ldView [data-view="planned"]'); await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.selected()), added.id);
  const u0 = await p.evaluate(() => window.__ink.undoLen());
  await p.click('#bOnSkin'); await wait(700);
  assert.equal((await S()).tattoos.find((t) => t.id === added.id).status, 'existing', 'switched to On my skin');
  assert.equal(await p.evaluate(() => window.__ink.selected()), added.id, 'still selected');
  assert.ok((await shown()).includes(added.id), 'still shows on the body');
  assert.equal(await view(), 'all');
  assert.equal(await p.evaluate(() => window.__ink.undoLen()), u0 + 1, 'one undo step, the view is not a step');

  // 4. choosing a view that leaves the selected one out still lets it go, as before
  await p.evaluate((id) => window.__ink.select(id), sun); await wait(300);
  await p.click('#ldView [data-view="planned"]'); await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.selected()), null, 'choosing Planned lets the tattoo on my skin go');
  assert.equal(await view(), 'planned', 'and the view stays as chosen');

  assert.ok(JSON.parse(await p.evaluate(() => localStorage.getItem('ia-tried') || '[]')).includes('viewFollows'), 'ticked in New to try');
  console.log('PASS t172 a selected tattoo always shows under the Layers views');
}
