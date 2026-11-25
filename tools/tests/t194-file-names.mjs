// Saved files name themselves (2026-11-25, Jake: "I want it to be smart and remember when I last
// exported a file, and it like numbers it automatically so that I don't have to keep renaming it").
// The preview says the name before Save, each save counts up, a cancelled share sheet uses no
// number, other kinds count apart, the count survives a reload, and the project is untouched.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const ready = async () => { await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200); };
  const stub = () => p.evaluate(() => {
    window.names = []; window.cancelNext = false;
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { if (window.cancelNext) { window.cancelNext = false; const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } window.names.push(files[0].name); };
    window.__ink.state().projectName = 'Leg sleeve';
  });
  await ready(); await stub();
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos));
  const openView = async () => { await p.evaluate(() => { document.querySelector('#share').hidden = false; document.querySelector('#cView').click(); }); await p.waitForFunction(() => !document.querySelector('#preview').hidden); await wait(200); };
  const save = async (n) => { await p.click('#pvSave'); await p.waitForFunction((n) => window.names.length === n, {}, n); await wait(150); };
  const nameLine = () => p.$eval('#pvName', (e) => e.textContent);

  await openView();
  assert.equal(await nameLine(), 'Saves as Ink Atlas - Leg sleeve - View 1.png', 'the preview says the name first');
  await save(1);
  assert.equal(await nameLine(), 'Saves as Ink Atlas - Leg sleeve - View 2.png', 'and moves on once saved');
  await save(2);
  await p.evaluate(() => { window.cancelNext = true; }); await p.click('#pvSave'); await wait(500);
  assert.equal(await nameLine(), 'Saves as Ink Atlas - Leg sleeve - View 3.png', 'a cancelled share sheet uses no number');
  await save(3);
  assert.deepEqual(await p.evaluate(() => window.names), ['Ink Atlas - Leg sleeve - View 1.png', 'Ink Atlas - Leg sleeve - View 2.png', 'Ink Atlas - Leg sleeve - View 3.png']);
  const toast = await p.evaluate(() => (window.toasts || []).slice(-1)[0] || document.querySelector('#toast')?.textContent || '');
  assert.ok(/View 3\.png/.test(toast), 'the message names the saved file: ' + toast);
  await p.evaluate(() => document.querySelector('#preview [data-close]').click()); await wait(200);

  // another kind counts on its own
  await p.evaluate(() => { document.querySelector('#share').hidden = false; document.querySelector('#cSizes').click(); }); await p.waitForFunction(() => !document.querySelector('#preview').hidden); await wait(200);
  assert.equal(await nameLine(), 'Saves as Ink Atlas - Leg sleeve - Sizes 1.png');
  await p.evaluate(() => document.querySelector('#preview [data-close]').click()); await wait(200);

  // the project itself is the same, and the count is not in it
  const after = await p.evaluate(() => ({ t: JSON.stringify(window.__ink.state().tattoos), keys: JSON.stringify(window.__ink.state()).includes('View 3') }));
  assert.equal(after.t, before, 'tattoos untouched'); assert.equal(after.keys, false, 'the count is kept on the device, not in the project');

  // after a reload it carries on
  await p.reload(); await ready(); await stub();
  await openView();
  assert.equal(await nameLine(), 'Saves as Ink Atlas - Leg sleeve - View 4.png', 'the count survives a reload');
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '{}'));
  assert.ok(tried.fileNames || (Array.isArray(tried) && tried.includes('fileNames')), 'New to try ticks itself once a file is saved');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS t194 file names: View 1, 2, 3 (one cancelled), Sizes 1, View 4 after a reload');
}
