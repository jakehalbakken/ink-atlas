// t171 a line in Layers swiped open (Lock, Duplicate, Delete behind it): tapping the line to close it
// pressed whatever had slid under the finger, so a tap meant to close it hid the tattoo with its eye.
// Now a tap anywhere on the open line only slides it back, by finger or mouse, and its own buttons
// still work. iPad portrait and landscape.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 })) });
  const S = () => p.evaluate(() => window.__ink.state());
  const undoLen = () => p.evaluate(() => window.__ink.undoLen());
  for (const [w, h] of [[820, 1180], [1180, 820]]) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
    await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
    if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(500); }
    const id = (await S()).tattoos.find((t) => /Sunburst/.test(t.name)).id;
    const box = () => p.$eval(`#ldList .ld-row[data-id="${id}"] .ld-track`, (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const swipeOpen = async () => {
      const b = await box(), x = b.x + b.w * 0.62, y = b.y + b.h / 2;
      await touch('touchStart', [[x, y]]); for (let i = 1; i <= 10; i++) { await touch('touchMove', [[x - 17 * i, y]]); await wait(16); } await touch('touchEnd', []); await wait(500);
      assert.ok(await p.$(`#ldList .ld-row[data-id="${id}"] .ld-swipe`), `${w}: swiped open`);
    };
    const isOpen = () => p.$(`#ldList .ld-row[data-id="${id}"] .ld-swipe`).then((x) => !!x);
    // every spot on the part of the line still showing: the eye, the menu, its left edge
    const spots = await (async () => {
      await swipeOpen();
      const r = await p.evaluate((id) => { const row = document.querySelector(`#ldList .ld-row[data-id="${id}"]`), tr = row.querySelector('.ld-track').getBoundingClientRect(), acts = row.querySelector('.ld-swipe').getBoundingClientRect(); const out = []; for (const sel of ['.ld-eye', '.ld-more', '.ld-mode']) { const e = row.querySelector('.ld-line ' + sel); if (!e) continue; const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; if (x > tr.left + 2 && x < acts.left - 2) out.push([sel, x, y]); } out.push(['edge', tr.left + 8, tr.top + tr.height / 2]); return out; }, id);
      await p.evaluate(() => document.activeElement?.blur?.());
      return r;
    })();
    assert.ok(spots.length >= 2, `${w}: something of the line still shows: ${JSON.stringify(spots)}`);
    let first = true;
    for (const [what, x, y] of spots) {
      if (!first) await swipeOpen(); first = false;
      const u0 = await undoLen(), t0 = (await S()).tattoos.find((t) => t.id === id);
      await touch('touchStart', [[x, y]]); await wait(60); await touch('touchEnd', []); await wait(600);
      assert.equal(await isOpen(), false, `${w}: a tap on ${what} closes the swipe`);
      const t1 = (await S()).tattoos.find((t) => t.id === id);
      assert.equal(!!t1.hidden, !!t0.hidden, `${w}: a tap on ${what} does not hide it`);
      assert.equal(!!t1.locked, !!t0.locked, `${w}: nor lock it`);
      assert.equal(await undoLen(), u0, `${w}: and leaves nothing to undo`);
      assert.equal(await p.$('#ldList .ld-acts'), null, `${w}: and opens no menu`);
    }
    // a mouse click does the same
    await swipeOpen();
    const [, mx, my] = spots[0];
    await p.mouse.click(mx, my); await wait(600);
    assert.equal(await isOpen(), false, `${w}: a click closes it`);
    assert.ok(!(await S()).tattoos.find((t) => t.id === id).hidden, `${w}: and does not hide it`);
    // the buttons behind still work
    await swipeOpen();
    const u0 = await undoLen();
    await p.$eval(`#ldList .ld-row[data-id="${id}"] .ld-swipe .sw-lock`, (e) => e.click()); await wait(500);
    assert.equal((await S()).tattoos.find((t) => t.id === id).locked, true, `${w}: Lock still locks`);
    assert.equal(await undoLen(), u0 + 1);
    await p.click('#undo'); await wait(400);
  }
  assert.ok(JSON.parse(await p.evaluate(() => localStorage.getItem('ia-tried') || '[]')).includes('swipeTapClose'), 'ticked in New to try');
  console.log('PASS t171 a tap on a swiped line only closes it');
}
