// Undo and Redo say what they put back, in a toast.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  const t = await p.evaluate(() => { const s = window.__ink.state().tattoos[0]; return { id: s.id, name: s.name }; });
  await p.evaluate((id) => window.__ink.select(id), t.id); await wait(500);
  await p.evaluate(() => document.querySelector('#editorAdvanced').open = true); await wait(200);
  // resize with a keyboard shortcut (one undo step), then undo and redo it
  await p.keyboard.press('='); await wait(1000);
  await p.click('#undo'); await wait(300);
  assert.equal(await p.$eval('#toast', (e) => e.textContent.trim()), `Undid resizing ${t.name}.`);
  await p.click('#redo'); await wait(300);
  assert.equal(await p.$eval('#toast', (e) => e.textContent.trim()), `Redid resizing ${t.name}.`);
  // hide it, then undo
  await p.evaluate(() => document.querySelector('#bHide') ? document.querySelector('#bHide').click() : null); await wait(400);
  const hid = await p.evaluate((id) => window.__ink.state().tattoos.find((q) => q.id === id).hidden, t.id);
  if (hid) { await p.click('#undo'); await wait(300); assert.equal(await p.$eval('#toast', (e) => e.textContent.trim()), `Undid hiding ${t.name}.`); }
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert.ok(tried.includes('undoWords'), 'ticks it');
  console.log('PASS t98-undo-words' + (hid ? ' (with hide)' : ''));
}
