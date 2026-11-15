// Go back several steps: pressing and holding Undo lists the last steps newest first in plain
// words; tapping one goes back to just before it in one go, and Redo brings the steps back one
// by one. A plain tap on Undo still undoes one step and opens no list.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  await (await p.$$('#trayItems .chip'))[0].click(); await wait(300);
  const start = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos));
  const width = (cm) => p.evaluate((v) => { const e = document.querySelector('#exactWidth'); e.value = (v / 2.54).toFixed(2); e.dispatchEvent(new Event('change')); }, cm);
  await width(6); await wait(200); await width(7); await wait(200); await width(8); await wait(200);
  const after3 = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos));
  // hold Undo
  const b = await p.$('#undo'), box = await b.boundingBox();
  assert.ok(box.height >= 44 || box.height >= 40, 'undo button');
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await wait(700); await p.mouse.up(); await wait(300);
  assert.equal(await p.$eval('#historyPop', (e) => e.hidden), false, 'the list opens');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), after3, 'holding undid nothing');
  const rows = await p.$$eval('#historyList [data-steps]', (a) => a.map((e) => ({ steps: +e.dataset.steps, text: e.textContent, h: e.getBoundingClientRect().height })));
  console.log(JSON.stringify(rows.slice(0, 4)));
  assert.ok(rows.length >= 3, 'three steps listed');
  assert.deepEqual(rows.slice(0, 3).map((r) => r.steps), [1, 2, 3], 'newest first');
  for (const r of rows.slice(0, 3)) assert.match(r.text, /^Resizing /, 'plain words: ' + r.text);
  assert.ok(rows.every((r) => r.h >= 44), 'rows big enough');
  await p.screenshot({ path: 'shots/t109-history.png' });
  // tap the third: back to before all three
  await p.$eval('#historyList [data-steps="3"]', (e) => e.click()); await wait(400);
  assert.equal(await p.$eval('#historyPop', (e) => e.hidden), true, 'the list closes');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), start, 'back to before the three steps');
  assert.equal(await p.$eval('#redo', (e) => e.disabled), false, 'redo is on');
  // redo brings them back one by one
  for (let i = 0; i < 3; i++) { await p.$eval('#redo', (e) => e.click()); await wait(200); }
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), after3, 'redo brings all three back');
  // a plain tap still undoes one step and opens no list
  await p.click('#undo'); await wait(300);
  assert.equal(await p.$eval('#historyPop', (e) => e.hidden), true, 'no list on a tap');
  assert.equal(await p.evaluate(() => window.__ink.history().length), 2, 'one step undone');
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('history')), 'ticked');
}
