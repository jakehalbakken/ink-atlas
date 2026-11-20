// Session planner: a planned tattoo shows its sittings in More controls (one per session from
// Time to tattoo, outline first); a first date gives each sitting its day and when it is healed;
// weeks between moves them; each change is one undo step and kept after reopening; Add to
// calendar saves an .ics with one event a sitting; ink already on shows no planner; a damaged
// value is cleaned on open. Touch sizes are checked.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ready = async () => { await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200); };
  await ready();
  await p.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); window.saved = {}; const old = URL.createObjectURL; URL.createObjectURL = function (b) { if (b.name) window.saved[b.name] = b; return old.call(this, b); }; });
  const all = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
  const t = all[0];
  const get = () => p.evaluate((id) => JSON.parse(JSON.stringify(window.__ink.state().tattoos.find((q) => q.id === id))), t.id);
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(500);
  if ((await get()).status === 'existing') { await p.click('#statusSeg .btn[aria-pressed=false]'); await wait(300); }
  // make it big enough for more than one sitting
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); q.width *= 3.2; window.__ink.commitTest(); }, t.id); await wait(300);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(600);
  assert.equal(await p.$eval('#sitBox', (e) => e.hidden), false, 'planner shows for a planned tattoo');
  const est = await p.evaluate((id) => window.__ink.estimate(id), t.id);
  let shown = await p.evaluate(() => window.__ink.sitShown());
  assert.equal(shown.length, est.sessions, 'one sitting per session: ' + JSON.stringify(shown));
  assert.ok(est.sessions >= 2, 'big enough for two sittings, ' + est.sessions);
  assert.match(shown[0], /^Outline, about /); assert.match(shown.at(-1), /finish, about /);
  assert.match(await p.$eval('#sitHealed', (e) => e.textContent), /Pick the first date/);
  assert.equal(await p.$eval('#sitCal', (e) => e.hidden), true, 'no calendar without a date');
  for (const id of ['#sitStart', '#sitGap']) assert.ok(await p.$eval(id, (e) => e.getBoundingClientRect().height >= 44), id + ' big enough');
  // pick the first date: one undo step
  await p.$eval('#sitStart', (e) => { e.value = '2026-12-05'; e.dispatchEvent(new Event('change')); }); await wait(400);
  assert.deepEqual((await get()).sittings, { start: '2026-12-05' });
  shown = await p.evaluate(() => window.__ink.sitShown());
  assert.match(shown[0], /Sat, Dec 5$/); assert.match(shown[1], /Sat, Dec 26$/, 'three weeks later by default');
  assert.match(await p.$eval('#sitHealed', (e) => e.textContent), /^Healed by about /);
  assert.equal(await p.$eval('#sitCal', (e) => e.hidden), false);
  assert.ok(await p.$eval('#sitCal', (e) => e.getBoundingClientRect().height >= 44), 'calendar button big enough');
  await p.select('#sitGap', '6'); await wait(400);
  assert.deepEqual((await get()).sittings, { start: '2026-12-05', gap: 6 });
  assert.match((await p.evaluate(() => window.__ink.sitShown()))[1], /Sat, Jan 16$/, 'six weeks later');
  await p.click('#undo'); await wait(400);
  assert.deepEqual((await get()).sittings, { start: '2026-12-05' }, 'undo takes the weeks back');
  assert.equal(await p.$eval('#sitGap', (e) => e.value), '3', 'the choice follows undo');
  await p.click('#undo'); await wait(400);
  assert.equal((await get()).sittings, undefined, 'undo takes the date off');
  await p.click('#redo'); await wait(300); await p.click('#redo'); await wait(400);
  assert.deepEqual((await get()).sittings, { start: '2026-12-05', gap: 6 });
  // calendar file
  await p.click('#sitCal'); await p.waitForFunction(() => Object.keys(window.saved).some((k) => k.endsWith('-sittings.ics')), { timeout: 8000 });
  const ics = await p.evaluate(async () => { const k = Object.keys(window.saved).find((x) => x.endsWith('-sittings.ics')); return { name: k, type: window.saved[k].type, text: await window.saved[k].text() }; });
  assert.equal((ics.text.match(/BEGIN:VEVENT/g) || []).length, est.sessions, 'one event a sitting');
  assert.ok(ics.text.includes('DTSTART;VALUE=DATE:20261205'), 'first sitting on the day picked');
  assert.match(ics.type, /calendar/);
  // ink already on: no planner
  await p.click('#statusSeg .btn[aria-pressed=false]'); await wait(500);
  assert.equal(await p.$eval('#sitBox', (e) => e.hidden), true, 'already on me: no planner');
  await p.click('#statusSeg .btn[aria-pressed=false]'); await wait(500);
  // kept after reopening
  await p.evaluate(() => window.__ink.flush && window.__ink.flush()); await wait(800);
  await p.reload(); await ready();
  assert.deepEqual((await get()).sittings, { start: '2026-12-05', gap: 6 }, 'kept after reopening');
  const cleaned = await p.evaluate(() => [window.__ink.cleanCheck({ sittings: { start: '2026-13-40', gap: 5 } }), window.__ink.cleanCheck({ sittings: { start: '2027-01-09', gap: 4, x: 1 } }), window.__ink.cleanCheck({ sittings: 'soon' }), window.__ink.cleanCheck({ sittings: { away: '2027-02-31x' } }), window.__ink.cleanCheck({ sittings: { away: '2027-02-14' } })]);
  assert.deepEqual(cleaned, [{}, { sittings: { start: '2027-01-09', gap: 4 } }, {}, {}, { sittings: { away: '2027-02-14' } }], JSON.stringify(cleaned));
  // a trip that lands while sitting 2 is fresh: said, and Start after it moves the sittings
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(500);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(800);
  assert.match(await p.$eval('#sitDry', (e) => e.hidden ? '' : e.textContent), /^Keep it out of pools, the sea, baths and strong sun for two weeks after each sitting: after the last one, until /);
  assert.ok(await p.$eval('#sitAway', (e) => e.getBoundingClientRect().height >= 44), 'trip date big enough');
  assert.equal(await p.$eval('#sitClash', (e) => e.hidden), true, 'no trip, no warning');
  await p.$eval('#sitAway', (e) => { e.value = '2027-01-20'; e.dispatchEvent(new Event('change')); }); await wait(400);
  assert.deepEqual((await get()).sittings, { start: '2026-12-05', gap: 6, away: '2027-01-20' });
  assert.equal(await p.$eval('#sitClash', (e) => e.hidden), false, 'the trip clashes');
  assert.match(await p.$eval('#sitClashText', (e) => e.textContent), /^Your trip on Wed, Jan 20 is 4 days after sitting 2, while the ink is still fresh/);
  assert.ok(await p.$eval('#sitLater', (e) => e.getBoundingClientRect().height >= 44), 'button big enough');
  await p.click('#sitLater'); await wait(400);
  assert.equal((await get()).sittings.start, '2027-01-21', 'starts after the trip');
  assert.equal(await p.$eval('#sitClash', (e) => e.hidden), true, 'clear now');
  await p.click('#undo'); await wait(400);
  assert.equal((await get()).sittings.start, '2026-12-05', 'undo moves it back');
  assert.equal(await p.$eval('#sitClash', (e) => e.hidden), false);
  await p.screenshot({ path: 'shots/t85-sittings.png' });
  console.log('PASS t85 session planner: ' + est.sessions + ' sittings, dates and healed day, weeks between, undo, calendar file, hidden for ink already on, kept and cleaned, trip check and Start after it | ' + shown.join(' / '));
}
