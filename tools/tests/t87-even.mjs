// Even placement: a tattoo a little off the centre line says how far and Centre it puts it on the
// line (one undo step); a twin made with Copy to other side matches its pair, and once moved says
// how it differs, and Match the other side mirrors it again (one undo step); a turned tattoo says
// how far off straight it is and Straighten lines it up. Touch sizes checked.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  // More controls opened with a tap, the way a person does
  const openMore = async () => { if (!(await p.$eval('#editorAdvanced', (e) => e.open))) await p.click('#editorAdvanced summary'); await wait(600); };
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const all = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
  const t = all[0];
  const get = (id = t.id) => p.evaluate((id) => JSON.parse(JSON.stringify(window.__ink.state().tattoos.find((q) => q.id === id))), id);
  // the More controls lines fill in a moment after a change (the first time takes longest)
  const line = async () => { await wait(500); await p.waitForFunction(() => !document.querySelector('#evenRow').hidden, { timeout: 15000 }); return p.evaluate(() => window.__ink.even()); };
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(500);
  // put it on the chest, a little left of the middle
  const spot = await p.evaluate((id) => { const h = window.__ink.surfaceAt([0.012, 1.3, 0.6], [0, 0, -1]); const q = window.__ink.state().tattoos.find((x) => x.id === id); q.pos = h.pos; q.normal = h.normal; q.width = 0.07; q.locked = false; window.__ink.commitTest(); return h.pos; }, t.id);
  await openMore();
  let l = await line();
  assert.match(l, /^0\.\d in left of the centre line\. \| Centre it$/, l);
  assert.ok(await p.$eval('#evenFix', (e) => e.getBoundingClientRect().height >= 44), 'button big enough');
  await p.click('#evenFix'); await wait(500);
  const c = await get();
  assert.ok(Math.abs(c.pos[0]) < 1e-9, 'on the centre line'); assert.ok(Math.abs(c.pos[1] - spot[1]) < 0.005, 'same height');
  assert.equal(await line(), 'On the centre line.');
  await p.click('#undo'); await wait(400);
  assert.ok(Math.abs((await get()).pos[0] - spot[0]) < 1e-6, 'undo puts it back');
  // straighten: turned off upright on the chest
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); q.rot = 0.25; window.__ink.commitTest(); }, t.id); await line();
  const ln = await p.evaluate(() => window.__ink.line());
  assert.match(ln, /^Turned 1[45]° off straight upright on the body\. \| Straighten$/, ln);
  assert.ok(await p.$eval('#lineFix', (e) => e.getBoundingClientRect().height >= 44), 'Straighten big enough');
  await p.click('#lineFix'); await wait(500);
  assert.ok(Math.abs(Math.sin((await get()).rot)) < 0.03, 'straight now');
  assert.match(await p.evaluate(() => window.__ink.line()), /^Straight upright on the body\.$/);
  await p.click('#undo'); await wait(400);
  assert.ok(Math.abs((await get()).rot - 0.25) < 1e-9, 'undo turns it back');
  // a twin: out to the side, then Copy to other side
  await p.evaluate((id) => { const h = window.__ink.surfaceAt([0.1, 1.3, 0.6], [0, 0, -1]); const q = window.__ink.state().tattoos.find((x) => x.id === id); q.pos = h.pos; q.normal = h.normal; window.__ink.commitTest(); }, t.id);
  await p.click('#bOtherSide'); await wait(600);
  const twinId = await p.evaluate(() => window.__ink.selected());
  assert.notEqual(twinId, t.id, 'the twin is selected');
  assert.match(await line(), /^Matches .* on the other side\.$/);
  // nudge the twin up and make it bigger
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); const h = window.__ink.surfaceAt([q.pos[0], q.pos[1] + 0.02, 0.6], [0, 0, -1]); q.pos = h.pos; q.normal = h.normal; q.width *= 1.1; window.__ink.commitTest(); }, twinId);
  l = await line();
  assert.match(l, /in higher.*in wider than .* on the other side\. \| Match the other side$/, l);
  await p.click('#evenFix'); await wait(500);
  const a = await get(), b = await get(twinId);
  assert.ok(Math.abs(a.pos[0] + b.pos[0]) < 0.003 && Math.abs(a.pos[1] - b.pos[1]) < 0.003, 'mirrored again');
  assert.ok(Math.abs(a.width - b.width) < 1e-9, 'same size');
  assert.match(await line(), /^Matches /);
  await p.click('#undo'); await wait(400);
  assert.match(await line(), /higher/, 'undo brings the nudge back');
  await p.screenshot({ path: 'shots/t87-even.png' });
  console.log('PASS t87 even placement: off centre and Centre it, twin matches, nudged twin says how and Match the other side, undo | ' + l);
}
