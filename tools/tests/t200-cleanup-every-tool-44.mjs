// Clean up, every tool at every iPad size (QA batch 33). The Adjust card's chips (Darker lines,
// Light, Levels, Curves, Threshold, Sharpen, Blur) were 38 px tall, under the 44 pt a finger needs.
// This walks all ten tools, turning the iPad with each one open, and checks every control is
// 44 pt, on screen or inside something that scrolls, and not under anything else. A chip still
// opens its own settings.
import assert from 'node:assert/strict';

export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(400);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.click('#bCleanup'); await p.waitForSelector('#ink-cleanup canvas'); await wait(600);
  const probe = () => p.evaluate(() => {
    const host = document.querySelector('#ink-cleanup'), W = innerWidth, H = innerHeight, bad = [];
    for (const b of host.querySelectorAll('button')) {
      if (!b.checkVisibility()) continue; const r = b.getBoundingClientRect(); if (!r.width) continue;
      if (b.closest('.ic-history')) continue; // History is its own list, closed here
      const n = b.dataset.mode || b.dataset.adj || b.dataset.action || b.id || b.textContent.trim().slice(0, 16);
      if (r.width < 43.9 || r.height < 43.9) bad.push(`${n} is ${Math.round(r.width)}x${Math.round(r.height)}`);
      const off = r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1;
      let s = b.parentElement, scrolls = false;
      while (s && s !== host.parentElement) { const cs = getComputedStyle(s); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (s.scrollHeight > s.clientHeight + 2 || s.scrollWidth > s.clientWidth + 2)) { scrolls = true; break; } s = s.parentElement; }
      if (off && !scrolls) bad.push(`${n} is off the screen`);
      if (!off && !scrolls) { const e = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); if (e && !b.contains(e) && !e.contains(b)) bad.push(`${n} is under ${e.id || e.className}`); }
    }
    return bad;
  });
  const modes = await p.$$eval('#ink-cleanup .ic-tools [data-mode]', (n) => n.map((b) => b.dataset.mode));
  assert.equal(modes.length, 10, 'ten tools in the rail');
  const sizes = [[1180, 820], [820, 1180], [1133, 744], [744, 1133], [1366, 1024], [1024, 1366]];
  for (const m of modes) {
    await p.$eval(`#ink-cleanup .ic-tools [data-mode="${m}"]`, (b) => b.click()); await wait(350);
    for (const [w, h] of sizes) {
      await p.setViewport({ width: w, height: h, hasTouch: true, deviceScaleFactor: 1 }); await wait(400);
      const bad = await probe();
      assert.deepEqual(bad, [], `${m} at ${w}x${h}: every control is 44 pt and in reach`);
    }
    await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 }); await wait(300);
  }
  // every Adjust chip still opens its own settings
  await p.$eval('#ink-cleanup .ic-tools [data-mode="adjust"]', (b) => b.click()); await wait(300);
  for (const k of ['lines', 'light', 'levels', 'curves', 'threshold', 'sharpen', 'blur']) {
    const b = await p.$(`#ink-cleanup [data-adj="${k}"]`); const r = await b.boundingBox();
    await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await wait(250);
    assert.equal(await p.$eval(`#ink-cleanup [data-adj="${k}"]`, (e) => e.getAttribute('aria-pressed')), 'true', `${k} is picked`);
    assert.equal(await p.$eval(`#ink-cleanup [data-adj-for="${k}"]`, (e) => e.hidden), false, `${k} shows its settings`);
  }
  await p.click('[data-action=cancel]'); await wait(300);
  if (await p.$('#ink-cleanup [data-action=discard]')) { await p.click('#ink-cleanup [data-action=discard]'); await wait(300); }
  assert.equal(await p.$('#ink-cleanup'), null, 'Cancel closes Clean up');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'looking through the tools changes nothing');
  console.log('PASS t200 Clean up: every tool is 44 pt and in reach at every iPad size');
}
