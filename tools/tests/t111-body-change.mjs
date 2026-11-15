// If your body changes (Share): the selected tattoo on the body as it is, slimmer, heavier and more
// muscular, each tile at the same distance, the tattoo grown or shrunk with the skin under it, and
// one line on how much. The body, the tattoos and the view are put back exactly.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const all = await p.evaluate(() => window.__ink.state().tattoos.map((t) => t.name));
  await (await p.$$('#trayItems .chip'))[Math.max(0, all.findIndex((n) => /Sunburst/.test(n)))].click(); await wait(400);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }).catch(() => {});
  const id = await p.evaluate(() => window.__ink.selected());
  const goal0 = await p.evaluate(() => JSON.stringify(window.__ink.goal)), before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  await p.click('#shareBtn'); await wait(300);
  assert.ok(await p.$eval('#cBodyChange', (e) => e.getBoundingClientRect().height >= 44), 'big enough');
  await p.click('#cBodyChange');
  await p.waitForFunction(() => document.querySelector('#pvTitle').textContent === 'If your body changes' && document.querySelector('#pvImg').complete && document.querySelector('#pvImg').naturalWidth > 0, { timeout: 60000 });
  const r = await p.evaluate(() => window.__ink.bodyChange());
  const b64 = await p.evaluate(() => document.querySelector('#pvImg').src.split(',')[1]); (await import('node:fs')).writeFileSync('shots/t111-body-change.png', Buffer.from(b64, 'base64'));
  console.log(JSON.stringify(r.results.map((x) => [x.key, +x.growth.toFixed(3), x.size.map((v) => +v.toFixed(1))])), r.line);
  assert.equal(r.id, id, 'the selected tattoo');
  const g = Object.fromEntries(r.results.map((x) => [x.key, x.growth]));
  assert.equal(g.now, 1, 'now is as it is');
  assert.ok(g.heavy > 1.005 && g.heavy < 1.3, 'heavier grows it: ' + g.heavy);
  assert.ok(g.slim < 0.997 && g.slim > 0.75, 'slimmer shrinks it: ' + g.slim);
  assert.ok(g.muscle > 0.9 && g.muscle < 1.25, 'muscle changes it a little: ' + g.muscle);
  assert.ok(r.results[2].size[0] > r.results[0].size[0] && r.results[1].size[0] < r.results[0].size[0], 'sizes follow');
  assert.ok(/^It grows and shrinks with the skin: /.test(r.line) && !/NaN|undefined/.test(r.line), r.line);
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('bodyChange')), 'ticked');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.goal)), goal0, 'view unchanged');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'project unchanged');
}
