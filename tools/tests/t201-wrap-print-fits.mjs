// Measured wrap > Print on an iPad (QA batch 33). The five paper sizes shared the side column in
// five equal shares, so on an iPad on its side "8.5×16" and "Custom" were wider than their buttons
// and ran into each other. Now each size takes the width its name needs. Every choice button on
// the Print step fits its words and is 44 pt at every size, and a tap on each paper still picks it.
import assert from 'node:assert/strict';

export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
  const tattoos = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos));
  await p.evaluate(() => window.__ink.wrap().open()); await wait(500);
  await p.evaluate(() => document.getElementById('wsStart').click()); await wait(700);
  await p.$eval('#wsTabs [data-step="print"]', (b) => b.click()); await wait(700);
  const look = () => p.evaluate(() => [...document.querySelectorAll('#wsSide .seg .btn')].filter((b) => b.checkVisibility()).map((b) => {
    const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), over: b.scrollWidth > b.clientWidth + 1, w: r.width, h: r.height };
  }));
  for (const [w, h] of [[1180, 820], [820, 1180], [1133, 744], [744, 1133], [1366, 1024], [1024, 1366]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true, deviceScaleFactor: 1 }); await wait(500);
    const bs = await look();
    assert.ok(bs.some((b) => b.t === '8.5×16') && bs.some((b) => b.t === 'Custom'), `${w}x${h}: the paper sizes show`);
    for (const b of bs) {
      assert.ok(!b.over, `${w}x${h}: "${b.t}" fits inside its button`);
      assert.ok(b.w >= 44 && b.h >= 44, `${w}x${h}: "${b.t}" is 44 pt (${Math.round(b.w)}x${Math.round(b.h)})`);
    }
    // the five paper sizes stay on one row and fill it
    const row = await p.evaluate(() => { const seg = document.querySelector('#wsPaper').getBoundingClientRect(); const bs = [...document.querySelectorAll('#wsPaper .btn')].map((b) => b.getBoundingClientRect()); return { one: new Set(bs.map((r) => Math.round(r.top))).size === 1, left: bs[0].left - seg.left, right: seg.right - bs[bs.length - 1].right }; });
    assert.ok(row.one && row.left < 8 && row.right < 8, `${w}x${h}: the paper sizes are one full row (${JSON.stringify(row)})`);
  }
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 }); await wait(500);
  for (const k of ['a4', 'legal', '8.5x16', 'custom', 'letter']) {
    const b = await p.$(`#wsPaper [data-v="${k}"]`); await b.evaluate((e) => e.scrollIntoView({ block: 'center' })); await wait(150);
    const r = await b.boundingBox(); await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await wait(400);
    assert.equal(await p.$eval(`#wsPaper [data-v="${k}"]`, (e) => e.getAttribute('aria-pressed')), 'true', `${k} is picked`);
  }
  await p.$eval('#wsDone', (b) => b.click()); await wait(400);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), tattoos, 'the tattoos are untouched');
  console.log('PASS t201 Measured wrap Print: paper sizes fit their buttons at every iPad size');
}
