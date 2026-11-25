// What to wear to the sitting: moved to usual spots with Try other spots, a planned tattoo's
// sittings show a line on what to wear so the spot is open (a T-shirt for a forearm, shorts for a
// calf, a top you can take off for the chest) and which way to sleep for the first nights, each sitting's cost shows with an hourly rate, the same words go in the calendar entries, ink
// already on shows none, and seeing it ticks it in New to try.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const openMore = async () => { if (!(await p.$eval('#editorAdvanced', (e) => e.open))) await p.click('#editorAdvanced summary'); await wait(600); };
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  await p.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); window.saved = {}; const old = URL.createObjectURL; URL.createObjectURL = function (b) { if (b.name) window.saved[b.askedAs||b.name] = b; return old.call(this, b); }; });
  const t = (await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos))))[0];
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(500);
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); q.width = 0.05; q.locked = false; q.status = 'planned'; window.__ink.commitTest(); }, t.id);
  await openMore();
  await p.click('#bSpots'); await wait(500);
  const at = async (spot) => {
    await p.$eval(`#spotChoices [data-spot="${spot}"]`, (b) => b.click()); await wait(900);
    await openMore();
    const r = await p.evaluate((id) => window.__ink.sitWear(id), t.id);
    assert.ok(r.shown, spot + ': the line shows');
    assert.equal(r.line, r.text, spot + ': the line shows the same words');
    assert.equal(r.sleepLine, r.sleep, spot + ': the sleep line shows the same words');
    sleeps[spot] = r.sleep;
    return r.text;
  };
  const seen = {}, sleeps = {};
  for (const [spot, want] of [
    ['forearm-back', /^For the sitting: wear a T-shirt, so the spot is open\.$/],
    ['calf', /^For the sitting: wear shorts, so the spot is open\.$/],
    ['shoulder', /^For the sitting: wear a tank top, so the spot is open\.$/],
    ['chest', /^For the sitting: wear a top you can take off or open, like a button-up, so the spot is open\.$/],
  ]) {
    if (spot !== 'forearm-back') await p.click('#bSpots'), await wait(500);
    seen[spot] = await at(spot);
    assert.match(seen[spot], want, spot + ': ' + seen[spot]);
  }
  assert.match(sleeps.chest, /sleep on your back /, 'chest: on your back'); assert.match(sleeps.calf, /sleep on your (front|left side|right side|front or your (left|right) side) /, 'calf: ' + sleeps.calf);
  assert.match(sleeps['forearm-back'], /sleep on your (left|right) side|on your back|on your front/, sleeps['forearm-back']);
  await p.screenshot({ path: 'shots/t91-sit-wear.png' });
  const tried = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('ia-tried') || '[]'); } catch { return []; } });
  assert.ok(tried.includes('sitWear'), 'seeing it ticks it');
  // with an hourly rate, each sitting shows its cost too
  await p.$eval('#estRate', (e) => { e.value = '150'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
  const items = await p.$$eval('#sitList li', (l) => l.map((x) => x.textContent));
  assert.ok(items.length && items.every((x) => /, about \$[\d,]+( to \$[\d,]+)?$/.test(x)), 'cost on each sitting: ' + JSON.stringify(items));
  await p.$eval('#estRate', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(300);
  assert.ok((await p.$$eval('#sitList li', (l) => l.map((x) => x.textContent))).every((x) => !/\$/.test(x)), 'no rate, no cost');
  // the calendar entries carry it
  await p.$eval('#sitStart', (e) => { e.value = '2026-12-05'; e.dispatchEvent(new Event('change')); }); await wait(400);
  await p.click('#sitCal'); await wait(600);
  const ics = await p.evaluate(async () => { const k = Object.keys(window.saved).find((n) => /\.ics$/.test(n)); return k ? (await window.saved[k].text()).replace(/\r\n /g, '') : ''; });
  assert.ok(ics.includes('For the sitting: wear a top you can take off or open\\, like a button-up\\, so the spot is open. For the first few nights after each sitting\\, sleep on your back so the fresh ink isn\'t pressed.'), 'in the calendar: ' + ics.slice(0, 900));
  // ink already on: no sittings, so no line
  await p.click('#statusSeg .btn[aria-pressed=false]'); await wait(500);
  assert.equal(await p.$eval('#sitBox', (e) => e.hidden), true, 'no planner for ink already on');
  console.log('PASS t91-sit-wear: ' + Object.entries(seen).map(([k, v]) => k + ': ' + v + ' ' + sleeps[k]).join(' | '));
}
