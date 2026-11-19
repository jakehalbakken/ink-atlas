// Notes for your artist and who did it (More controls): a note typed on a planned tattoo is one
// undo step and is kept after reopening; ink already on gets Artist, Studio and month fields
// that read back as "By ... at ..., Month Year"; planned tattoos hide those fields; the whole plan's
// time shows under Time to tattoo with two or more planned pieces; a damaged note or made in a
// save is cleaned on open. The field heights are checked for touch.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ready = async () => { await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000); };
  await ready();
  const all = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
  assert.ok(all.length >= 2, 'the sample has tattoos');
  const tA = all[0], tB = all[1];
  const chip = async (id) => { await (await p.$$('#ldList .ld-tat'))[all.findIndex((t) => t.id === id)].click(); await wait(600); };
  const get = (id) => p.evaluate((id) => window.__ink.state().tattoos.find((q) => q.id === id), id);
  // make sure A is planned
  await chip(tA.id);
  if ((await get(tA.id)).status === 'existing') { await p.click('#bStatus'); await wait(300); }
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(400);
  assert.equal(await p.$eval('#madeBox', (e) => e.hidden), true, 'planned: no who-did-it fields');
  assert.ok(await p.$eval('#tNote', (e) => e.getBoundingClientRect().height >= 44), 'note box big enough');
  // a note: one undo step
  await p.click('#tNote'); await p.type('#tNote', 'Fine lines only, black and grey'); await p.$eval('#tNote', (e) => e.blur()); await wait(300);
  assert.equal((await get(tA.id)).note, 'Fine lines only, black and grey', 'note saved on the tattoo');
  await p.click('#undo'); await wait(300);
  assert.equal((await get(tA.id)).note, undefined, 'undo takes the note off');
  assert.equal(await p.$eval('#tNote', (e) => e.value), '', 'the box follows undo');
  await p.click('#redo'); await wait(300);
  assert.equal((await get(tA.id)).note, 'Fine lines only, black and grey', 'redo puts it back');
  // ink already on: who did it and when
  await p.click('#bStatus'); await wait(300);
  assert.equal((await get(tA.id)).status, 'existing');
  assert.equal(await p.$eval('#madeBox', (e) => e.hidden), false, 'already on me: who-did-it fields show');
  for (const id of ['#madeArtist', '#madeStudio', '#madeWhen']) assert.ok(await p.$eval(id, (e) => e.getBoundingClientRect().height >= 44), id + ' big enough');
  await p.type('#madeArtist', 'Mia Lopez'); await p.$eval('#madeArtist', (e) => e.blur()); await wait(200);
  await p.type('#madeStudio', 'Black Rose'); await p.$eval('#madeStudio', (e) => e.blur()); await wait(200);
  await p.$eval('#madeWhen', (e) => { e.value = '2023-03'; e.dispatchEvent(new Event('change')); }); await wait(300);
  assert.deepEqual((await get(tA.id)).made, { artist: 'Mia Lopez', studio: 'Black Rose', when: '2023-03' });
  const made = await p.evaluate((id) => window.__ink.madeText(id), tA.id);
  assert.equal(made, 'By Mia Lopez at Black Rose, March 2023');
  await p.click('#undo'); await wait(300);
  assert.equal((await get(tA.id)).made.when, undefined, 'each field is its own undo step');
  await p.click('#redo'); await wait(300);
  // the plan line: two planned pieces needed
  await chip(tB.id);
  if ((await get(tB.id)).status === 'existing') { await p.click('#bStatus'); await wait(300); }
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(500);
  const planned = (await p.evaluate(() => window.__ink.state().tattoos)).filter((t) => t.status !== 'existing' && !t.hidden).length;
  const plan = await p.evaluate(() => window.__ink.planLine());
  if (planned > 1) assert.match(plan, new RegExp('^All ' + planned + ' planned tattoos: about '), plan); else assert.equal(plan, '');
  // kept after reopening
  await wait(800); await p.reload(); await ready();
  const back = await get(tA.id);
  assert.equal(back.note, 'Fine lines only, black and grey', 'note kept after reopening');
  assert.deepEqual(back.made, { artist: 'Mia Lopez', studio: 'Black Rose', when: '2023-03' }, 'who did it kept after reopening');
  // a damaged save: bad values are cleaned, good ones kept
  const cleaned = await p.evaluate(() => window.__ink.cleanCheck({ note: 7, made: { artist: '  ', studio: 'X'.repeat(90), when: '2023-13' } }));
  assert.deepEqual(cleaned, { made: { studio: 'X'.repeat(60) } }, JSON.stringify(cleaned));
  await p.screenshot({ path: 'shots/t86-notes.png' });
  console.log('PASS t86 notes and who did it: note is one undo step and kept, who/studio/month on ink already on, plan line, damaged values cleaned | ' + made + ' | ' + plan);
}
