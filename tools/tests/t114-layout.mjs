// The calm main screen: one toolbar at the top right, the view switcher in the top row when it
// fits (its own row when it doesn't), nothing floating at the left, and every panel opening just
// under the chrome. Checked on iPad portrait and landscape, a small iPad and a phone; pictures in
// shots/t114-*.png. INK_THEME=light runs it in the light look.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const theme = process.env.INK_THEME === 'light' ? 'light' : 'dark';
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const sizes = [[1180, 820, 'land'], [820, 1180, 'port'], [1024, 768, 'small'], [390, 844, 'phone'], [1366, 1024, 'pro']];
  for (const [w, h, name] of sizes) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await wait(700);
    const r = await p.evaluate(() => {
      const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
      const btns = [...document.querySelectorAll('#top button, #views button')].filter((e) => e.getBoundingClientRect().width > 0);
      const rects = btns.map((e) => ({ id: e.id || e.textContent.trim(), ...box(e), hit: document.elementFromPoint(e.getBoundingClientRect().x + e.getBoundingClientRect().width / 2, e.getBoundingClientRect().y + e.getBoundingClientRect().height / 2) }));
      const hits = rects.map((q) => ({ id: q.id, ok: q.hit && (q.hit.id === q.id || btns.find((b) => (b.id || b.textContent.trim()) === q.id).contains(q.hit)) }));
      const over = []; for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (Math.min(a.r, b.r) > Math.max(a.x, b.x) && Math.min(a.b, b.b) > Math.max(a.y, b.y)) over.push(a.id + '/' + b.id); }
      const below = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--below'));
      const chrome = Math.max(document.querySelector('#top .toolbar').getBoundingClientRect().bottom, document.querySelector('#views').getBoundingClientRect().bottom);
      return { over, hits: hits.filter((q) => !q.ok).map((q) => q.id), small: rects.filter((q) => q.w < 44 || q.h < 44).map((q) => q.id), out: rects.filter((q) => q.x < 0 || q.r > innerWidth).map((q) => q.id), below, chrome, low: document.body.classList.contains('views-low') };
    });
    console.log(name, JSON.stringify(r));
    assert.deepEqual(r.over, [], `nothing overlaps at ${name}`);
    assert.deepEqual(r.small, [], `44pt targets at ${name}`);
    assert.deepEqual(r.out, [], `all on screen at ${name}`);
    assert.deepEqual(r.hits, [], `nothing covers a button at ${name}`);
    assert.ok(r.below >= r.chrome - 1 && r.below <= r.chrome + 12, `panels open just under the chrome at ${name}: ${r.below} vs ${r.chrome}`);
    await p.screenshot({ path: `shots/t114-${theme}-${name}.png` });
    // Preview drops from its button, and its panels open under the chrome
    await p.click('#lookBtn'); await wait(250);
    const m = await p.evaluate(() => { const a = document.querySelector('#lookMenu').getBoundingClientRect(), b = document.querySelector('#lookBtn').getBoundingClientRect(); return { top: a.top, left: a.left, right: a.right, btnB: b.bottom, btnL: b.left, w: innerWidth }; });
    assert.ok(m.top >= m.btnB - 1 && m.left >= 0 && m.right <= m.w, `Preview menu under its button at ${name}: ${JSON.stringify(m)}`);
    await p.screenshot({ path: `shots/t114-${theme}-${name}-preview.png` });
    await p.click('#lightBtn'); await wait(250);
    const pop = await p.evaluate(() => document.querySelector('#lightPop').getBoundingClientRect().top);
    assert.ok(pop >= r.below - 1, `Light panel under the chrome at ${name}`);
    await p.click('[data-close="lightPop"]'); await wait(150);
  }
  // a tattoo selected with More controls open, and Share, at iPad landscape
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(600);
  await p.click('#trayItems .chip'); await wait(1300);
  await p.screenshot({ path: `shots/t114-${theme}-sheet.png` });
  await p.click('#editorAdvanced > summary'); await wait(700);
  const secs = await p.$$eval('#editorAdvanced .sec > h5', (a) => a.map((e) => e.textContent));
  assert.deepEqual(secs, ['Size and shape', 'About this spot', 'Check it', 'Plan it', 'Copy and arrange', 'This tattoo']);
  await p.screenshot({ path: `shots/t114-${theme}-more.png` });
  await p.click('#editorAdvanced > summary'); await wait(300);
  await p.click('#shareBtn'); await wait(400);
  const heads = await p.$$eval('#share .shHead', (a) => a.map((e) => e.textContent));
  assert.deepEqual(heads.slice(0, 3), ['Ask and agree', 'For your artist', 'Pictures']);
  await p.screenshot({ path: `shots/t114-${theme}-share.png` });
  await p.click('[data-close="share"]'); await wait(200);
  await p.click('#projectsBtn'); await wait(400);
  assert.equal(await p.$('#openPose'), null, 'no second way into Pose');
  await p.screenshot({ path: `shots/t114-${theme}-plan.png` });
  await p.click('[data-close="planMenu"]');
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 });
  console.log('PASS t114 calm layout', theme);
}
