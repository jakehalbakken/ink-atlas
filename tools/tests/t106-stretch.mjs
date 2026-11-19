// How it stretches as you move (More controls): a line says how much the skin under the selected
// tattoo stretches and squeezes in the poses that move it most; each spot names the pose that moves it
// most; Show that pose puts the body in the worst one. Nothing else in the
// project changes.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  await (await p.$$('#ldList .ld-tat'))[1].click(); await wait(300);
  const id = await p.evaluate(() => window.__ink.selected());
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  const place = async (spot) => {
    await p.$eval('#bSpots', (e) => e.click()); await wait(200);
    await p.$eval('#spotSide [data-side="L"]', (e) => e.click());
    await p.$eval(`#spotChoices [data-spot="${spot}"]`, (e) => e.click()); await wait(200);
    await p.evaluate(() => { document.querySelector('#spotPop').hidden = true; });
    await p.evaluate(() => { const d = document.querySelector('#editorAdvanced'); d.open = false; d.open = true; });
    await p.waitForFunction((s) => { const r = window.__ink.stretchShown(); return r && !document.querySelector('#stretchRow').hidden && window.__ink.state().tattoos.length; }, { timeout: 30000 }, spot);
    await wait(400);
    return p.evaluate(() => ({ ...window.__ink.stretchShown(), line: document.querySelector('#stretchText').textContent }));
  };
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  const stomach = await place('stomach');
  const forearm = await place('forearm-front');
  console.log(JSON.stringify({ stomach, forearm }));
  for (const r of [stomach, forearm]) { assert.ok(r.line.length > 20 && r.line.length < 260, 'a plain line: ' + r.line); assert.doesNotMatch(r.line, /NaN|undefined/); }
  for (const r of [stomach, forearm]) assert.ok(r.top > 0.02 && r.top < 0.6, 'a believable amount: ' + r.top);
  assert.equal(stomach.key, 'twist', 'the stomach moves most in a turn'); assert.match(forearm.key, /^left/, 'the left forearm moves most with the left arm');
  assert.match(forearm.line, /\d+%/);
  assert.ok(await p.$eval('#stretchShow', (e) => !e.hidden && e.getBoundingClientRect().height >= 44), 'Show that pose, big enough');
  await p.$eval('#stretchShow', (e) => e.click()); await wait(800);
  const pose = await p.evaluate(() => window.__ink.pose());
  assert.equal(pose.active, true, 'posed'); assert.equal(pose.key, forearm.key, 'in the pose that moves it most');
  assert.equal(await p.evaluate(() => window.__ink.selected()), id, 'still selected');
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('stretch')), 'ticked');
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 60000 });
  await p.screenshot({ path: 'shots/t106-stretch.png' });
  // nothing changed but the tattoo that was moved to the two spots
  const after = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  const b = JSON.parse(before); b.tattoos = b.tattoos.map((t) => (t.id === id ? after.tattoos.find((q) => q.id === id) : t));
  assert.deepEqual(after.tattoos, b.tattoos, 'only the moved tattoo changed');
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(300);
}
