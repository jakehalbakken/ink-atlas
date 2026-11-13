// Long hair (Body > Hair > Long): strands to just below the shoulders, kept on this device, nothing
// in the project changes; in a pose the top stays on the head, and after a shape change it grows
// again on the new shape. Over a selected tattoo it moves aside.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  const head = await p.evaluate(() => { const P = window.__ink.positions(); let y = 0, z = 0; for (let v = 13380; v < 13524; v++) { y += P[v * 3 + 1]; z += P[v * 3 + 2]; } return [y / 144, z / 144]; });
  const look = async (theta, name) => {
    await p.evaluate(([h, t]) => { Object.assign(window.__ink.goal, { theta: t, phi: Math.PI / 2 - 0.08, roll: 0, tx: 0, ty: h[0] - 0.08, tz: h[1] - 0.04, r: 1.0 }); window.__ink.cur.r = 1.01; }, [head, theta]);
    await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 });
    const style = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' }); await wait(250);
    await p.screenshot({ path: `shots/t70-${name}.png` }); await style.evaluate((s) => s.remove());
  };
  await p.click('#bodyBtn'); await wait(200);
  const b = await p.$eval('#hairRow [data-hair="long"]', (e) => [e.textContent, e.getBoundingClientRect().height]);
  assert.ok(b[0] === 'Long' && b[1] >= 44, 'Long button, big enough');
  const t0 = Date.now(); await p.click('#hairRow [data-hair="long"]'); await wait(300);
  const hs = await p.evaluate(() => window.__ink.hairStrands());
  console.log('strands', hs.strands, 'shown after', Date.now() - t0, 'ms');
  assert.ok(hs.visible && hs.strands > 14000, 'strands show ' + JSON.stringify({ v: hs.visible, n: hs.strands }));
  await p.click('[data-hair-colour="blond"]'); await wait(200);
  await p.keyboard.press('Escape'); await wait(200);
  await look(0, 'long-front'); await look(Math.PI, 'long-back');
  // the head turns and bows: the roots keep their place on the skull
  await p.evaluate(() => window.__ink.setPoseRotations({ neck01: [0.15, 0.3, 0, 0.94], head: [0.1, 0.2, 0, 0.97] }));
  await wait(300); await look(0.7, 'long-posed');
  const pr = (await p.evaluate(() => window.__ink.hairStrands())).probe;
  for (const [rest, drawn] of pr) assert.ok(Math.abs(rest - drawn) < 0.004, `stays on the head in a pose (${rest.toFixed(4)} vs ${drawn.toFixed(4)})`);
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(300);
  // Medium and back: each style is its own hair
  await p.click('#bodyBtn'); await wait(200);
  await p.click('#hairRow [data-hair="medium"]'); await wait(300);
  assert.equal((await p.evaluate(() => window.__ink.hairStrands())).strands, 14000, 'Medium is its own hair');
  await p.click('#hairRow [data-hair="long"]'); await wait(300);
  assert.ok((await p.evaluate(() => window.__ink.hairStrands())).strands > 14000, 'back to Long');
  await p.keyboard.press('Escape'); await wait(200);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'project not changed');
  // a new shape: it grows again once the shape settles
  const probeA = (await p.evaluate(() => window.__ink.hairStrands())).probe[0][0];
  await p.evaluate(() => window.__ink.setShape({ figure: 'female', muscle: 0.5, weight: 0.7, fit: {} })); await wait(1200);
  const after = await p.evaluate(() => window.__ink.hairStrands());
  assert.ok(after.visible && after.strands > 14000 && Math.abs(after.probe[0][0] - probeA) > 1e-6, 'grown again on the new shape');
  assert.deepEqual(await p.evaluate(() => window.__ink.hair()), { style: 'long', colour: 'blond', hex: null });
  // a tattoo on the nape: the hair moves aside while it is selected, and comes back after
  await (await p.$$('#trayItems .chip'))[1].click(); await wait(300);
  assert.equal((await p.evaluate(() => window.__ink.hairStrands())).tucked, false, 'not over the chest');
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bSpots', (e) => e.click()); await wait(300);
  await p.$eval('#spotChoices [data-spot="nape"]', (e) => e.click()); await wait(400);
  await p.keyboard.press('Escape'); await wait(300);
  let h = await p.evaluate(() => window.__ink.hairStrands());
  assert.ok(h.tucked && !h.visible, 'moved aside over a nape tattoo');
  assert.match(await p.$eval('#toast', (e) => e.textContent), /hair is moved aside/);
  await look(Math.PI, 'long-nape');
  await p.$eval('#bDone', (e) => e.click()); await wait(300);
  h = await p.evaluate(() => window.__ink.hairStrands());
  assert.ok(!h.tucked && h.visible, 'back when the tattoo is let go');
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(600);
  assert.deepEqual(await p.evaluate(() => window.__ink.hair()), { style: 'long', colour: 'blond', hex: null }, 'kept on this device');
  assert.ok((await p.evaluate(() => window.__ink.hairStrands())).visible, 'strands back after a reload');
  console.log('PASS t70 long hair: strands to the shoulders, stay on the head in a pose, grow again on a new shape, move aside over a selected tattoo, kept on this device');
}
