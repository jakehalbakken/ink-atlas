// Measure me on an iPad on its side (QA batch 32). The number pad, the feet key on a row of its own
// and the tip ran the screen past the bottom, so Skip and Next sat half under the edge on an 11 inch
// iPad on its side and wholly under it on a smaller one: every one of the 17 screens needed a scroll
// first, and the line saying what the model measures now was cut off under them. Now the feet key shares the fractions' row, the pad is a little tighter on a short screen,
// and Back, Skip and Next stay in reach at the bottom whatever the size. Typed numbers still land.
import assert from 'node:assert/strict';

export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  const foot = () => p.evaluate(() => {
    const modal = document.querySelector('#measureMe .modal').getBoundingClientRect();
    const btns = [...document.querySelectorAll('#measureMe .np-foot .btn')].filter((b) => b.checkVisibility());
    return btns.map((b) => { const r = b.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2, top = document.elementFromPoint(x, y);
      return { t: b.textContent.trim(), x, y, w: r.width, h: r.height, inside: r.top >= modal.top - 1 && r.bottom <= modal.bottom + 1 && r.bottom <= innerHeight + 1, hit: !!top && b.contains(top) }; });
  });
  const open = async () => { await p.$eval('#bodyBtn', (e) => e.click()); await wait(300); await p.$eval('#measureMeBtn', (e) => e.click()); await wait(900); };
  for (const [w, h] of [[1180, 820], [1133, 744], [1366, 1024], [820, 1180], [744, 1133]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true, deviceScaleFactor: 1 }); await wait(600);
    await open();
    assert.equal(await p.$eval('#measureMe', (e) => e.hidden), false, `${w}x${h}: Measure me opens`);
    // the height screen: the feet key sits beside the fractions
    const rows = await p.evaluate(() => [...document.querySelectorAll('#measureMe .np-extra .btn')].filter((b) => b.checkVisibility()).map((b) => Math.round(b.getBoundingClientRect().top)));
    assert.ok(rows.length === 4 && new Set(rows).size === 1, `${w}x${h}: ¼ ½ ¾ and ft are one row (${rows})`);
    // what the model measures now shows without a scroll, above the pad
    assert.ok(await p.evaluate(() => { const m = document.querySelector('#measureMe .mm-model').getBoundingClientRect(), box = document.querySelector('#measureMe .mm-right').getBoundingClientRect(); return m.height > 10 && m.top >= box.top - 1 && m.bottom <= box.bottom + 1 && m.bottom <= innerHeight; }), `${w}x${h}: "The model now measures" shows`);
    // three screens in, each Next tapped where it shows, with no scroll first
    for (let s = 0; s < 3; s++) {
      const f = await foot();
      for (const b of f) {
        assert.ok(b.inside && b.hit, `${w}x${h} screen ${s + 1}: ${b.t} is in reach (${JSON.stringify(b)})`);
        assert.ok(b.w >= 44 && b.h >= 44, `${w}x${h}: ${b.t} is 44 pt`);
      }
      if (s === 1) { for (const k of ['4', '2']) { const kb = await p.$(`#measureMe .np-k[data-key="${k}"]`); const r = await kb.boundingBox(); await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await wait(80); } }
      const next = f.find((b) => b.t === 'Next');
      await p.mouse.click(next.x, next.y); await wait(400);
      assert.equal(await p.$eval('#measureMe .mm-count', (e) => parseInt(e.textContent)), s + 2, `${w}x${h}: Next goes to screen ${s + 2}`);
    }
    // turning the iPad mid-way keeps them in reach too
    await p.setViewport({ width: h, height: w, hasTouch: true, deviceScaleFactor: 1 }); await wait(600);
    for (const b of await foot()) assert.ok(b.inside && b.hit, `${h}x${w} after turning: ${b.t} is in reach`);
    // Back keeps the typed number
    for (let k = 0; k < 2; k++) { const back = (await foot()).find((b) => b.t === 'Back'); await p.mouse.click(back.x, back.y); await wait(400); }
    assert.match(await p.$eval('#measureMe .np-num', (e) => e.textContent), /42/, `${w}x${h}: the typed 42 is still there after Back`);
    await p.$eval('#mmClose', (e) => e.click()); await wait(400);
    assert.equal(await p.$eval('#measureMe', (e) => e.hidden), true, 'Close closes it');
  }
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'closing without Fit my body leaves the project as it was');
  console.log('PASS t198 Measure me keeps Back, Skip and Next in reach');
}
