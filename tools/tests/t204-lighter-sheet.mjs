// A lighter edit sheet (shot: real folds). With a tattoo selected the sheet is shorter than before
// (under 600 px at iPad portrait), Blend and colour sits beside References, the trim line sits beside
// its button, and More controls opens to short headed sections: Size and shape open, the rest folded
// to a line each with what is inside, every heading 44 pt. Which are open is kept on this device;
// Show me and Find a tool open the fold round the control they point at.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 60000 });
  for (const [w, h] of [[820, 1180], [1180, 820]]) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await wait(800);
    await p.evaluate(() => { window.__ink.select && window.__ink.select(null); });
    await p.click('#ldList .ld-tat'); await wait(900);
    const r = await p.evaluate(() => { const s = document.querySelector('#sheet'), rr = (q) => { const b = document.querySelector(q).getBoundingClientRect(); return { top: b.top, height: b.height }; }; return { h: s.scrollHeight, look: rr('#bLook'), refs: rr('#bRefs') }; });
    if (w === 820) assert.ok(r.h < 600, 'sheet under 600 px at iPad portrait: ' + r.h);
    assert.ok(Math.abs(r.look.top - r.refs.top) < 2 && r.look.height >= 44 && r.refs.height >= 44, 'Blend and colour beside References, 44 pt: ' + JSON.stringify(r));
    if (!(await p.$eval('#editorAdvanced', (d) => d.open))) await p.click('#editorAdvanced > summary'); await wait(500);
    const f = await p.evaluate(() => [...document.querySelectorAll('#editorAdvanced details.fold')].filter((d) => d.getClientRects().length).map((d) => ({ k: d.dataset.fold, open: d.open, h: d.querySelector('summary').getBoundingClientRect().height, sub: d.querySelector('summary span').textContent })));
    assert.deepEqual(f.map((x) => x.k + (x.open ? '+' : '')), w === 820 ? ['size+', 'spot', 'check', 'plan', 'copy'] : f.map((x) => x.k + (x.open ? '+' : '')));
    assert.ok(f.every((x) => x.h >= 44 && x.sub.length > 5), 'headings 44 pt with what is inside: ' + JSON.stringify(f));
    const total = await p.$eval('#editorAdvanced .editor-advanced-content', (c) => c.scrollHeight);
    assert.ok(total < 1000, 'More controls under 1000 px folded (was 2323): ' + total);
    await p.screenshot({ path: `shots/t204-${w}.png` });
    await p.click('#editorAdvanced > summary'); await wait(300);
  }
  // open Check it, reload: kept
  await p.click('#ldList .ld-tat'); await wait(600);
  await p.click('#editorAdvanced > summary'); await wait(300);
  await p.click('#editorAdvanced details[data-fold=check] > summary'); await wait(300);
  assert.equal(await p.$eval('#bSpots', (e) => !!e.getClientRects().length), true, 'Check it opens');
  await p.reload({ waitUntil: 'load' }); await wait(2500);
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 60000 });
  assert.deepEqual(await p.$$eval('#editorAdvanced details.fold', (a) => a.filter((d) => d.open).map((d) => d.dataset.fold)), ['size', 'check'], 'kept after a reload');
  // Show me rings a control inside a folded section, opening it
  await p.$eval('#editorAdvanced details[data-fold=plan]', (d) => { d.open = false; });
  await p.evaluate(() => window.__ink.showMe && window.__ink.showMe('note'));
  await wait(1200);
  const shown = await p.evaluate(() => ({ open: document.querySelector('#editorAdvanced details[data-fold=plan]').open, ring: !document.querySelector('#pointRing').hidden }));
  assert.ok(shown.open && shown.ring, 'Show me opens the fold: ' + JSON.stringify(shown));
  // Find a tool opens it too
  await p.$eval('#editorAdvanced details[data-fold=check]', (d) => { d.open = false; });
  await p.keyboard.press('Escape'); await wait(300);
  await p.click('#findBtn'); await wait(300); await p.type('#findQ', 'ink check'); await wait(300); await p.keyboard.press('Enter'); await wait(1200);
  const found = await p.evaluate(() => ({ open: document.querySelector('#editorAdvanced details[data-fold=check]').open, vis: !!document.querySelector('#bInkCheck').getClientRects().length }));
  assert.ok(found.open && found.vis, 'Find a tool opens the fold: ' + JSON.stringify(found));
  console.log('t204 ok');
}
