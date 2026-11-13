// Medium hair (Body > Hair > Medium): strands over a thin base, kept on this device, nothing in the
// project changes, and in a pose the hair stays on the head as it turns and bends.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  const head = await p.evaluate(() => { const P = window.__ink.positions(); let y = 0, z = 0; for (let v = 13380; v < 13524; v++) { y += P[v * 3 + 1]; z += P[v * 3 + 2]; } return [y / 144, z / 144]; });
  const look = async (theta, name) => {
    await p.evaluate(([h, t]) => { Object.assign(window.__ink.goal, { theta: t, phi: Math.PI / 2 - 0.12, roll: 0, tx: 0, ty: h[0] + 0.02, tz: h[1] - 0.04, r: 0.75 }); window.__ink.cur.r = 0.76; }, [head, theta]);
    await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 });
    const style = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' }); await wait(250);
    await p.screenshot({ path: `shots/t69-${name}.png` }); await style.evaluate((s) => s.remove());
  };
  assert.equal((await p.evaluate(() => window.__ink.hairStrands())).visible, false, 'no strands until Medium is picked');
  await p.click('#bodyBtn'); await wait(200);
  const b = await p.$eval('#hairRow [data-hair="medium"]', (e) => [e.textContent, e.getBoundingClientRect().height]);
  assert.ok(b[0] === 'Medium' && b[1] >= 44, 'Medium button, big enough');
  const t0 = Date.now(); await p.click('#hairRow [data-hair="medium"]'); await wait(300);
  const hs = await p.evaluate(() => window.__ink.hairStrands());
  console.log('strands', hs.strands, 'shown after', Date.now() - t0, 'ms');
  assert.ok(hs.visible && hs.strands > 10000, 'strands show ' + JSON.stringify({ v: hs.visible, n: hs.strands }));
  await p.click('[data-hair-colour="chestnut"]'); await wait(200);
  await p.keyboard.press('Escape'); await wait(200);
  await look(0.7, 'medium-3q'); await look(Math.PI / 2, 'medium-side');
  // the head turns and bows in a pose: every strand root keeps its distance to the skull points
  await p.evaluate(() => window.__ink.setPoseRotations({ neck01: [0.15, 0.3, 0, 0.94], head: [0.1, 0.2, 0, 0.97] }));
  await wait(300); await look(0.7, 'medium-posed');
  const pr = (await p.evaluate(() => window.__ink.hairStrands())).probe;
  console.log('probe', JSON.stringify(pr.map(([a, c]) => [+a.toFixed(4), +c.toFixed(4)])));
  for (const [rest, drawn] of pr) assert.ok(Math.abs(rest - drawn) < 0.004, `stays on the head in a pose (${rest.toFixed(4)} vs ${drawn.toFixed(4)})`);
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(300);
  assert.deepEqual(await p.evaluate(() => window.__ink.hair()), { style: 'medium', colour: 'chestnut', hex: null });
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'project not changed');
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(600);
  assert.deepEqual(await p.evaluate(() => window.__ink.hair()), { style: 'medium', colour: 'chestnut', hex: null }, 'kept on this device');
  assert.ok((await p.evaluate(() => window.__ink.hairStrands())).visible, 'strands back after a reload');
  await p.click('#bodyBtn'); await wait(200); await p.click('#hairRow [data-hair="none"]'); await wait(200);
  assert.equal((await p.evaluate(() => window.__ink.hairStrands())).visible, false, 'gone with Bald');
  console.log('PASS t69 medium hair: strands show, follow the head in a pose, kept on this device, project unchanged');
}
