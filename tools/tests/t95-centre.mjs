// Centre line while you drag: a planned tattoo dragged near the middle of the chest shows a guide
// down the centre of the body; with Snap to guides on it lands exactly on the middle, one undo step.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const events = async (list) => p.evaluate((list) => { const c = document.querySelector('#stage canvas'); for (const [type, id, x, y] of list) c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 })); }, list);
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  await p.evaluate(() => { const i = window.__ink, s = i.state(), art = structuredClone(s.tattoos[0]), h = i.surfaceAt([0.04, 1.3, 2], [0, 0, -1]); s.tattoos = [{ ...art, id: 'mid', name: 'Chest piece', ...h, locked: false, status: 'planned', width: 0.05, rot: 0, hidden: false }]; i.commitTest(); });
  await p.click('#ldList .ld-tat'); await wait(300); await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }).catch(() => {}); await wait(500);
  const at = (x) => p.evaluate((x) => { const i = window.__ink, h = i.surfaceAt([x, 1.3, 2], [0, 0, -1]); return { screen: i.projectPoint(h.pos), pos: h.pos }; }, x);
  const start = await p.evaluate(() => window.__ink.projectPoint(window.__ink.state().tattoos[0].pos));
  await events([['pointerdown', 91, start.x, start.y]]);
  let plan, target;
  for (const x of [0.004, 0.003, 0.002, 0.005]) { target = await at(x); await events([['pointermove', 91, target.screen.x, target.screen.y]]); await wait(60); plan = await p.evaluate(() => window.__ink.liveGuides()); if (plan) break; }
  assert.ok(plan, 'centre guide shows');
  assert.equal(plan.lines[0].kind, 'Centre of the body'); assert.equal(plan.snapped, false);
  await p.waitForFunction(() => document.querySelector('#alignmentGuides').textContent.length > 0, { timeout: 5000 }).catch(() => {});
  assert.match(await p.$eval('#alignmentGuides', (e) => e.textContent), /^Centre of the body$/);
  const moved = await p.evaluate(() => window.__ink.state().tattoos[0].pos);
  assert.ok(Math.abs(moved[0]) > 0.0015, 'no snap while snapping is off: ' + moved[0]);
  // a little further out: no guide
  const off = await at(0.02); await events([['pointermove', 91, off.screen.x, off.screen.y]]); await wait(60);
  assert.equal(await p.evaluate(() => window.__ink.liveGuides()), null, 'gone away from the middle');
  await events([['pointerup', 91, off.screen.x, off.screen.y]]); await wait(200);
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert.ok(tried.includes('centre'), 'ticks it');
  // snapping on: lands on the middle
  await p.evaluate(() => { const b = document.querySelector('#snapGuides'); b.checked = true; b.dispatchEvent(new Event('change')); });
  await wait(1000);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos[0].pos));
  const s2 = await p.evaluate(() => window.__ink.projectPoint(window.__ink.state().tattoos[0].pos));
  await events([['pointerdown', 92, s2.x, s2.y]]);
  const away = await at(0.05); await events([['pointermove', 92, away.screen.x, away.screen.y]]); await wait(60);
  for (const x of [0.004, 0.003, 0.002, 0.005]) { target = await at(x); await events([['pointermove', 92, target.screen.x, target.screen.y]]); await wait(60); plan = await p.evaluate(() => window.__ink.liveGuides()); if (plan) break; }
  assert.ok(plan && plan.snapped, 'snapped');
  const snapped = await p.evaluate(() => window.__ink.state().tattoos[0].pos);
  assert.ok(Math.abs(snapped[0]) < 0.001, 'on the centre line: ' + snapped[0]);
  await p.waitForFunction(() => /Snap/.test(document.querySelector('#alignmentGuides').textContent), { timeout: 5000 }).catch(() => {});
  assert.match(await p.$eval('#alignmentGuides', (e) => e.textContent), /^Snap: Centre of the body$/);
  await events([['pointerup', 92, target.screen.x, target.screen.y]]); await wait(300);
  assert.equal(await p.evaluate(() => window.__ink.liveGuides()), null, 'cleared on lift');
  await p.click('#undo'); await wait(300);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos[0].pos)), before, 'one undo puts it back');
  console.log('PASS t95-centre: guide down the middle, snap on request, one undo step');
}
