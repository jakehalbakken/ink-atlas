// Find a comment: with four or more comments, the list has a search box that keeps only the
// comments mentioning every word typed, in the text, replies, names or the tattoo it is on.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.evaluate(() => { const c = document.querySelector('#coachOk'); c && c.click(); });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const shown = (sel) => p.$eval(sel, (e) => !e.hidden && e.getClientRects().length > 0).catch(() => false);
  await p.evaluate(() => {
    const s = structuredClone(window.__ink.state()), t = s.tattoos[0], at = new Date().toISOString(), pin = { tri: 1200, w: [1 / 3, 1 / 3, 1 / 3] };
    s.notes = [
      { id: 'n1', text: 'Move this up an inch', by: 'Liv', at, pin },
      { id: 'n2', text: 'Darker shading please', by: 'Mara', at, pin, tattooId: t.id },
      { id: 'n3', text: 'Looks great', by: 'Liv', at, pin, replies: [{ id: 'r1', text: 'Agreed, café ready', by: 'José', at }] },
      { id: 'n4', text: 'Too close to the elbow', by: 'Mara', at, pin, done: { by: 'Jake', at } },
    ];
    window.__ink.loadState(s);
  });
  await wait(300);
  // the chip of the tattoo with an open comment carries its count
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#ldList .ld-tat')].map((c) => c.querySelector('b.cmts')?.textContent || '')), ['1', ''], 'one open comment on the first tattoo');
  assert.match(await p.$eval('#ldList .ld-tat', (e) => e.getAttribute('aria-label')), /1 open comment$/);
  await p.evaluate(() => window.__ink.pinsOn()); await wait(200);
  await p.click('#pinListBtn'); await wait(150);
  assert.equal(await shown('#pinListFind'), true, 'find box with four comments');
  assert.ok(await p.$eval('#pinListFind', (e) => e.getBoundingClientRect().height >= 44), 'big enough to tap');
  const clear = () => p.$eval('#pinListFind', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const items = () => p.evaluate(() => window.__ink.pins().listItems);
  assert.equal((await items()).length, 3, 'open ones');
  await p.type('#pinListFind', 'jose'); await wait(150);
  let it = await items(); assert.equal(it.length, 1, 'a reply by José, without the accent'); assert.match(it[0], /Looks great/);
  await clear(); await p.type('#pinListFind', 'mara'); await wait(150);
  assert.equal((await items()).length, 1, 'Mara has one open comment');
  await p.click('#pinListAll'); await wait(150);
  assert.equal((await items()).length, 2, 'and one resolved');
  const tname = await p.evaluate(() => window.__ink.state().tattoos[0].name.split(/\s+/)[0]);
  await clear(); await p.type('#pinListFind', tname); await wait(150);
  it = await items(); assert.ok(it.some((x) => /Darker shading/.test(x)), 'the tattoo it is on: ' + tname);
  await clear(); await p.type('#pinListFind', 'nothing here'); await wait(150);
  assert.equal((await items()).length, 0);
  assert.equal(await shown('#pinListEmpty'), true); assert.match(await p.$eval('#pinListEmpty', (e) => e.textContent), /No comments mention "nothing here"/);
  await p.screenshot({ path: 'shots/t113-find.png' });
  await clear(); await wait(150);
  assert.equal((await items()).length, 4, 'cleared shows them all');
  // three comments: no box
  await p.evaluate(() => { const s = structuredClone(window.__ink.state()); s.notes = s.notes.slice(0, 3); window.__ink.loadState(s); }); await wait(200);
  await p.evaluate(() => window.__ink.pinsOn()); await wait(100);
  if (!(await shown('#pinList'))) await p.click('#pinListBtn'); await wait(150);
  assert.equal(await shown('#pinListFind'), false, 'no box for three');
  console.log('PASS t113-find-comment');
}
