// Who it reads for: moved to usual spots with Try other spots (which run the art along the limb,
// top towards the body), a forearm piece reads for others while the arm hangs; Turn it to face
// me turns it round (one undo step) so it reads for you looking down at it. The chest reads for
// others, the upper back only for others or in a mirror (nothing to turn), a sideways piece says
// so. Touch size checked.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const openMore = async () => { if (!(await p.$eval('#editorAdvanced', (e) => e.open))) await p.click('#editorAdvanced summary'); await wait(600); };
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const t = (await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos))))[0];
  const get = () => p.evaluate((id) => JSON.parse(JSON.stringify(window.__ink.state().tattoos.find((q) => q.id === id))), t.id);
  const line = async () => { await wait(400); await p.waitForFunction(() => !document.querySelector('#readRow').hidden, { timeout: 15000 }); return p.evaluate(() => window.__ink.reads()); };
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(500);
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); q.width = 0.05; q.locked = false; window.__ink.commitTest(); }, t.id);
  await openMore();
  await p.click('#bSpots'); await wait(500);
  const go = async (spot) => { await p.$eval(`#spotChoices [data-spot="${spot}"]`, (b) => b.click()); await wait(900); await openMore(); return line(); };
  let l = await go('forearm-back');
  assert.match(l, /^Reads the right way up for others while your arm hangs\. Looking down at it, it is upside down for you\. \| Turn it to face me$/, l);
  assert.ok(await p.$eval('#readFix', (e) => e.getBoundingClientRect().height >= 44), 'button big enough');
  const before = (await get()).rot;
  await p.click('#readFix'); await wait(500);
  const after = (await get()).rot;
  assert.ok(Math.abs(Math.cos(after - before) + 1) < 1e-6, 'turned half way round');
  l = await line(); assert.match(l, /^Reads the right way up for you, looking down at it\. Upside down for others while your arm hangs\. \| Turn it to face others$/, l);
  await p.click('#undo'); await wait(400);
  assert.ok(Math.abs((await get()).rot - before) < 1e-9, 'undo turns it back');
  // sideways on the forearm
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); q.rot += Math.PI / 2; window.__ink.commitTest(); }, t.id);
  assert.match(await line(), /^Runs across the arm: it reads sideways for everyone\.$/);
  l = await go('chest'); assert.match(l, /^Reads the right way up for others\. Looking down at it, it is upside down for you\. \| Turn it to face me$/, l);
  l = await go('upper-back'); assert.equal(l, 'Reads the right way up for others. You see it only in a mirror.');
  await p.screenshot({ path: 'shots/t89-reads.png' });
  console.log('PASS t89 who it reads for: forearm for others, turned for you, undo, sideways, chest, upper back');
}
