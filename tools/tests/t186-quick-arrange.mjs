// Mirror, Flip vertical, Duplicate and Hide one tap away (2026-11-24, Jake: "Those are really important
// controls to have easily accessible", then "show/hide should be on that top panel too"). A second
// row of tiles right under the quick actions, with More controls shut, on screen at every iPad size
// and in split-window widths, 44 pt each (Draw on it, 2026-11-25, makes five, in one row like the quick actions), gone from More controls, and each one undo step.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const rect = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, vis: cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 }; });
  const ids = ['#bFlip', '#bFlipVertical', '#bDup', '#bHide', '#bDrawOn']; // Draw on it joined the row 2026-11-25 (draw right on the skin)
  assert.deepEqual(await p.$$eval('#sheet .editor-arrange .btn', (bs) => bs.map((b) => '#' + b.id)), ids, 'the five, in order, in one row');
  for (const s of ids) assert.equal(await p.$eval(s, (e) => !!e.closest('#editorAdvanced')), false, s + ' is no longer in More controls');
  const sizes = [[1194, 834], [834, 1194], [1366, 1024], [1024, 1366], [1180, 820], [820, 1180], [744, 1133], [678, 1024], [507, 1024], [390, 844]];
  for (const [W, H] of sizes) {
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 }); await wait(900);
    if (W < 700) await p.evaluate(() => { const d = document.querySelector('#layersDock'); if (d && d.classList.contains('open')) document.querySelector('#ldToggle')?.click(); }); if (W < 700) await wait(500);
    if (!(await p.evaluate(() => window.__ink.selected()))) { await p.evaluate(() => { const d = document.querySelector('#layersDock'); if (d && !d.classList.contains('open')) document.querySelector('#ldToggle')?.click(); }); await wait(400); await p.click('#ldList .ld-tat'); await wait(700); }
    assert.ok(await p.evaluate(() => window.__ink.selected()), `${W}x${H}: a tattoo is selected`);
    if (await p.$eval('#sheet', (e) => e.classList.contains('min') || document.querySelector('#bSheetMin').getAttribute('aria-expanded') === 'false')) { await p.click('#bSheetMin'); await wait(400); }
    await p.$eval('#editorAdvanced', (d) => (d.open = false)); await p.$eval('#sheet', (e) => (e.scrollTop = 0)); await wait(200);
    const top = await rect('#sheet .editor-quick:not(.editor-arrange)'), row = await rect('#sheet .editor-arrange'), sheet = await rect('#sheet');
    assert.ok(row.vis, `${W}x${H}: the row shows`);
    assert.ok(row.t >= top.b - 1 && row.t - top.b < 20, `${W}x${H}: right under the quick actions: ${row.t - top.b}`);
    for (const s of ids) {
      const r = await rect(s);
      assert.ok(r.w >= 44 && r.h >= 44, `${W}x${H}: ${s} 44pt: ${r.w}x${r.h}`);
      assert.ok(r.l >= 0 && r.r <= W && r.t >= 0 && r.b <= H, `${W}x${H}: ${s} on screen ${JSON.stringify(r)}`);
      assert.ok(r.t >= sheet.t - 1 && r.b <= sheet.b + 1, `${W}x${H}: ${s} inside the panel without scrolling`);
      // and nothing (Layers, a popover) lies over it: a finger there reaches the tile
      const onTop = await p.$eval(s, (e) => { const b = e.getBoundingClientRect(), h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!h && (h === e || e.contains(h)); });
      assert.ok(onTop, `${W}x${H}: ${s} is not covered`);
    }
    { const tops = await p.$$eval('#sheet .editor-arrange .btn', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().top))); assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, `${W}x${H}: the five sit in one row: ${tops}`); }
    const label = await p.$$eval('#sheet .editor-arrange .btn', (bs) => bs.every((b) => b.scrollWidth <= b.clientWidth + 1));
    assert.ok(label, `${W}x${H}: every word fits its tile`);
    // on an iPad Layers still shows lines above the panel
    if (W >= 700 && await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open'))) {
      const list = await rect('#ldList'); assert.ok(list.vis && list.h >= 100, `${W}x${H}: Layers keeps room: ${list.h}`);
    }
  }
  await p.setViewport({ width: 1194, height: 834, deviceScaleFactor: 1 }); await wait(900);
  const id = await p.evaluate(() => window.__ink.selected());
  const get = () => p.evaluate((id) => { const t = window.__ink.state().tattoos.find((x) => x.id === id); return { flip: !!t.flip, down: !!t.imageTopDown, hidden: !!t.hidden, n: window.__ink.state().tattoos.length }; }, id);
  const start = await get();
  await p.click('#bFlip'); await wait(500);
  assert.equal((await get()).flip, !start.flip, 'Mirror flips it');
  assert.equal(await p.$eval('#bFlip', (e) => e.getAttribute('aria-pressed')), String(!start.flip), 'Mirror shows when it is on');
  await p.click('#undo'); await wait(600); assert.deepEqual(await get(), start, 'one undo step');
  if (!(await p.evaluate(() => window.__ink.selected()))) { await p.click(`#ldList .ld-tat[data-id="${id}"]`); await wait(600); }
  await p.click('#bFlipVertical'); await wait(500); assert.equal((await get()).down, !start.down, 'Flip vertical flips it');
  await p.click('#undo'); await wait(300); assert.match(await p.$eval('#toast', (e) => e.textContent.trim()), /^Undid flipping /, 'Undo says it flipped it'); await wait(300); assert.deepEqual(await get(), start, 'one undo step');
  if (!(await p.evaluate(() => window.__ink.selected()))) { await p.click(`#ldList .ld-tat[data-id="${id}"]`); await wait(600); }
  await p.click('#bHide'); await wait(500);
  assert.equal((await get()).hidden, true, 'Hide hides it');
  assert.equal(await p.$eval('#bHide', (e) => e.textContent.trim() + ':' + e.getAttribute('aria-pressed')), 'Show:true', 'and the tile says Show');
  assert.equal(await p.$eval('#bHide', (e) => e.classList.contains('i-eye-off') && !e.classList.contains('i-eye')), true, 'with the crossed-out eye its Layers line has');
  await p.click('#bHide'); await wait(500);
  assert.equal(await p.$eval('#bHide', (e) => e.textContent.trim() + ':' + e.getAttribute('aria-pressed')), 'Hide:false', 'Show brings it back');
  assert.equal((await get()).hidden, false);
  assert.equal(await p.$eval('#bHide', (e) => e.classList.contains('i-eye') && !e.classList.contains('i-eye-off')), true, 'and the open eye again');
  await p.click('#bDup'); await wait(900);
  assert.equal(await p.evaluate(() => window.__ink.state().tattoos.length), start.n + 1, 'Duplicate makes one copy');
  assert.equal(await p.$eval('#editorAdvanced', (e) => e.open), false, 'More controls stayed shut throughout');
}
