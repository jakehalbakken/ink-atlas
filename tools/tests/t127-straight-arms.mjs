// Straight arms (Preview > Pose): the three Straight arms poses sit right under Standing, carry a
// forearm tattoo with the skin as the elbow straightens (it can still be picked under the finger),
// save nothing, tick themselves in New to try, and Standing puts the ink back exactly.
// The exact straightness of the elbows, for every body shape, is checked on the skeleton in
// straight-arms-unit.mjs.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const settled = () => p.waitForFunction(() => window.__ink.settled() && window.__ink.pose().settled, { timeout: 20000 });
  await settled(); await wait(600);
  // put the sunburst on the left forearm first, where straightening the elbow moves it most
  await (await p.$$('#trayItems .chip'))[0].click(); await wait(300);
  const id = await p.evaluate(() => window.__ink.selected());
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bSpots', (e) => e.click()); await wait(300);
  await p.$eval('#spotSide [data-side="L"]', (e) => e.click());
  await p.$eval('#spotChoices [data-spot="forearm-front"]', (e) => e.click()); await wait(200);
  await p.$eval('#spotPop [data-close=spotPop]', (e) => e.click());
  await p.evaluate(() => window.__ink.select(null)); await wait(300); await settled();
  const restSpot = await p.evaluate((id) => window.__ink.viewSpot(id), id);
  assert.ok(restSpot.pos[0] > 0.2, 'the tattoo is on the left forearm: ' + restSpot.pos);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  await p.click('#lookBtn'); await p.click('#poseBtn'); await p.waitForSelector('#posePop:not([hidden])');
  const order = await p.$$eval('#poseList [data-pose]', (b) => b.slice(0, 4).map((x) => x.dataset.pose));
  assert.deepEqual(order, ['neutral', 'straightDown', 'straightOut', 'straightPalms'], 'straight arms right under Standing');
  const heads = await p.$$eval('#poseList h4', (h) => h.map((x) => x.textContent)); assert.equal(heads[0], 'Straight arms');
  const min = await p.$$eval('#poseList [data-pose^=straight]', (b) => Math.min(...b.map((x) => Math.min(x.getBoundingClientRect().width, x.getBoundingClientRect().height))));
  assert.ok(min >= 44 - 0.01, '44pt: ' + min);
  for (const k of ['straightDown', 'straightOut', 'straightPalms']) {
    await p.click(`#poseList [data-pose=${k}]`); await wait(500); await settled();
    const s = await p.evaluate(() => window.__ink.pose()); assert.equal(s.active, true); assert.equal(s.key, k);
    assert.equal(await p.$eval(`#poseList [data-pose=${k}]`, (b) => b.getAttribute('aria-pressed')), 'true');
    // the standing elbow holds the forearm in front of the body; straight brings it back to the arm's line
    const sp = await p.evaluate((id) => window.__ink.viewSpot(id), id);
    if (k !== 'straightOut') assert.ok(restSpot.pos[2] - sp.pos[2] > 0.03, `${k}: forearm ink swings back with the straight elbow: ${(restSpot.pos[2] - sp.pos[2]).toFixed(3)}`);
    else assert.ok(sp.pos[1] - restSpot.pos[1] > 0.2, 'arms out lifts the forearm ink to shoulder height: ' + (sp.pos[1] - restSpot.pos[1]).toFixed(3));
    await p.screenshot({ path: `shots/t127-${k}.png` });
  }
  assert.ok((await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'))).includes('straightArms'), 'ticks itself in New to try');
  // in the straight pose, a finger on the forearm ink lands on that tattoo's own skin
  await p.evaluate(() => window.__ink.setPose('straightDown')); await wait(500); await settled();
  await p.click('#posePop [data-close=posePop]'); await wait(300);
  const t = await p.evaluate((id) => window.__ink.state().tattoos.find((x) => x.id === id), id);
  const spot = await p.evaluate((id) => window.__ink.viewSpot(id), id);
  const a = await p.evaluate((pos) => window.__ink.projectPoint(pos), spot.pos);
  const under = await p.evaluate((x, y) => window.__ink.hitBody(x, y), a.x, a.y);
  assert.ok(under && Math.hypot(...under.point.map((v, i) => v - t.pos[i])) < 0.02, "a finger on the posed forearm ink is on that tattoo's own skin");
  await p.screenshot({ path: 'shots/t127-forearm.png' });
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'straight arms change nothing saved');
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(500); await settled();
  assert.equal((await p.evaluate(() => window.__ink.pose())).active, false, 'Standing puts the arms back');
  const backSpot = await p.evaluate((id) => window.__ink.viewSpot(id), id);
  assert.ok(Math.hypot(...backSpot.pos.map((v, i) => v - restSpot.pos[i])) < 1e-6, 'the ink is back exactly where it was');
  // New to try lists it with a working Show me, and says which copy this is
  await p.evaluate(() => { document.querySelector('#newBtn').click(); }); await wait(300);
  const row = await p.$('#newList [data-feature=straightArms] .btn'); assert.ok(row, 'listed in New to try');
  assert.match(await p.$eval('#buildStamp', (n) => n.textContent), /This copy is from/);
  await row.click(); await wait(600);
  assert.equal(await p.$eval('#posePop', (n) => n.hidden), false, 'Show me opens Pose');
  assert.equal(await p.$eval('#pointRing', (n) => n.hidden), false, 'and rings the control');
  console.log('t127 straight arms ok');
}
