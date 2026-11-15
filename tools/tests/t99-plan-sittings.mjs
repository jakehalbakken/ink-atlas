// Every sitting in one list: with two or more planned pieces dated, More controls lists what is
// coming up across the plan, warns of a sitting while another piece is fresh, and saves one
// calendar file with every sitting.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const d = (k) => { const x = new Date(Date.now() + k * 86400000); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const [a, b] = [d(10), d(17)];
  const ids = await p.evaluate(([a, b]) => { const st = window.__ink.state(), art = structuredClone(st.tattoos[0]), i = window.__ink;
    const h1 = i.surfaceAt([0.06, 1.32, 2], [0, 0, -1]), h2 = i.surfaceAt([0, 1.3, -2], [0, 0, 1]);
    st.tattoos = [{ ...art, id: 'ra', name: 'Rose', ...h1, width: 0.06, status: 'planned', hidden: false, sittings: { start: a } }, { ...art, id: 'mb', name: 'Moth', ...h2, width: 0.08, status: 'planned', hidden: false, sittings: { start: b } }, { ...art, id: 'ex', name: 'Old one', ...h2, width: 0.03, status: 'existing', hidden: false }];
    i.commitTest(); return ['ra', 'mb']; }, [a, b]);
  await wait(800);
  await p.evaluate(() => window.__ink.select('ra')); await wait(400);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(500);
  // the guess needs the artwork read: nudge the panel until it has it
  await p.waitForFunction(() => { if (window.__ink.planSits()) return true; window.__ink.select('mb'); window.__ink.select('ra'); return false; }, { timeout: 20000, polling: 800 }).catch(() => {});
  const s = await p.evaluate(() => window.__ink.planSits());
  assert.ok(s, 'shown with two dated pieces');
  assert.match(s.next, /^Coming up: .+ Rose(, outline)?\. .+ Moth/, s.next);
  assert.equal(s.clash.length, 1, 'Moth lands while Rose is fresh: ' + JSON.stringify(s.clash));
  assert.match(s.clash[0], /^Moth on .+ is while Rose is still fresh from /);
  assert.equal(await p.$eval('#planSits', (e) => e.hidden), false);
  assert.ok(await p.$eval('#planCal', (e) => e.getBoundingClientRect().height >= 44), 'button big enough');
  // the calendar file
  await p.evaluate(() => { window.saved = null; window.__savedBlobs = []; const real = URL.createObjectURL; URL.createObjectURL = (bl) => { window.__savedBlobs.push(bl); return real.call(URL, bl); }; HTMLAnchorElement.prototype.click = function () {}; navigator.canShare = () => false; });
  await p.$eval('#planCal', (e) => { e.scrollIntoView(); e.click(); }); await wait(600);
  const ics = await p.evaluate(async () => { const bl = window.__savedBlobs.at(-1); return bl ? await bl.text() : ''; });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'), 'a calendar: ' + ics.slice(0, 40));
  assert.ok((ics.match(/BEGIN:VEVENT/g) || []).length >= 2, 'every sitting');
  assert.ok(/SUMMARY:Rose/.test(ics) && /SUMMARY:Moth/.test(ics));
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert.ok(tried.includes('planCal'), 'ticks it');
  // move Moth well after every Rose sitting: no clash; undate it: the list goes
  await p.evaluate(() => { const st = window.__ink.state(); st.tattoos.find((q) => q.id === 'mb').sittings = { start: (() => { const x = new Date(Date.now() + 200 * 86400000); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; })() }; window.__ink.commitTest(); window.__ink.select('mb'); }); await wait(1500);
  await p.waitForFunction(() => { const x = window.__ink.planSits(); return x && x.clash.length === 0; }, { timeout: 10000, polling: 500 }).catch(() => {});
  { const x = await p.evaluate(() => [window.__ink.planSits(), window.__ink.state().tattoos.map((q) => [q.id, q.sittings])]); assert.equal(x[0].clash.length, 0, 'clear after moving ' + JSON.stringify(x)); }
  assert.equal(await p.$eval('#planClash', (e) => e.hidden), true);
  await p.evaluate(() => { const st = window.__ink.state(); delete st.tattoos.find((q) => q.id === 'mb').sittings; window.__ink.commitTest(); window.__ink.select('ra'); }); await wait(1500);
  await p.waitForFunction(() => window.__ink.planSits() === null, { timeout: 10000, polling: 500 }).catch(() => {});
  { const x = await p.evaluate(() => [window.__ink.planSits(), window.__ink.state().tattoos.map((q) => [q.id, q.sittings, q.status, q.hidden]), window.__ink.selected()]); assert.equal(x[0], null, 'one dated piece: no list ' + JSON.stringify(x)); }
  assert.equal(await p.$eval('#planSits', (e) => e.hidden), true);
  console.log('PASS t99-plan-sittings: ' + s.next + ' ' + s.clash.join(' '));
}
