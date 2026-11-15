// Reduce Motion: with the device set to reduce motion, Full body puts the view there at once.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.reload({ waitUntil: 'load' }); await wait(2500);
  await p.evaluate(() => { const c = document.querySelector('#coachOk'); c && c.click(); });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const id = await p.evaluate(() => window.__ink.state().tattoos[0].id);
  await p.evaluate(() => document.querySelector('#trayItems .chip').click()); await wait(150);
  await p.evaluate(() => document.querySelector('#trayItems .chip').click()); await wait(1200); // a second tap zooms to it
  const near = await p.evaluate(() => window.__ink.cur.r);
  await p.click('#full');
  await new Promise((r) => setTimeout(r, 120)); // a frame or two, far less than a glide
  const after = await p.evaluate(() => [window.__ink.cur.r, window.__ink.goal.r]);
  assert.ok(Math.abs(after[1] - near) > 0.1, 'a real move: ' + near + ' to ' + after[1]);
  assert.ok(Math.abs(after[0] - after[1]) < 1e-3, `at the goal straight away: ${after} (was ${near}, ${id})`);
  console.log('PASS t100-reduce-motion');
}
