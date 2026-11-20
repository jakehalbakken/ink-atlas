// On a phone the bars across the top (Tape measure, How I see it, Comments, Pain map...) take the full
// width. They sat over the top of the Layers rail, half covering its Add and Procreate buttons (2026-11-20
// QA). Now the rail steps aside while one is open and comes back after Done; on an iPad nothing changes.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 500) => new Promise((r) => setTimeout(r, n));
  const flows = [['Tape measure', '#tapeBtn', '#tapeBar', '#tapeDone'], ['How I see it', '#selfBtn', '#selfBar', '#selfDone'], ['Comments', '#pinsBtn', '#pinBar', '#pinsDone'], ['Pain map', '#painBtn', '#painBar', null]];
  const open = async (btn) => {
    await p.click('#lookBtn'); await wait(500);
    await p.evaluate((s) => { const e = document.querySelector(s); const d = e && e.closest('details'); if (d) d.open = true; e && e.scrollIntoView({ block: 'center' }); }, btn); await wait(200);
    await p.click(btn); await wait(1200);
  };
  const look = (bar) => p.evaluate((bar) => {
    const b = document.querySelector(bar), d = document.querySelector('#layersDock');
    const shown = (e) => !!e && !e.hidden && e.checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().height > 10;
    const bb = b.getBoundingClientRect(), db = d.getBoundingClientRect();
    const ix = Math.min(bb.right, db.right) - Math.max(bb.left, db.left), iy = Math.min(bb.bottom, db.bottom) - Math.max(bb.top, db.top);
    return { bar: shown(b), dock: shown(d), overlap: ix > 4 && iy > 4 };
  }, bar);
  const bad = [];
  for (const [w, h] of [[390, 844], [820, 1180], [1180, 820]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true, isMobile: w < 700 });
    for (const [name, btn, bar, done] of flows) {
      await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
      await open(btn);
      const r = await look(bar);
      if (!r.bar) { bad.push(`${w}x${h} ${name}: the bar did not open`); continue; }
      if (r.dock && r.overlap) bad.push(`${w}x${h} ${name}: the bar covers the Layers rail`);
      if (w >= 700 && !r.dock) bad.push(`${w}x${h} ${name}: Layers went away on an iPad`);
      if (done) {
        await p.click(done); await wait(900);
        const back = await p.evaluate(() => document.querySelector('#layersDock').checkVisibility({ visibilityProperty: true }));
        if (!back) bad.push(`${w}x${h} ${name}: the rail did not come back after Done`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  console.log('PASS t149 phone bars: on a phone the rail steps aside under the four top bars and comes back after Done; on an iPad Layers stays and nothing covers it');
}
