// t180 two iPad layout fixes (2026-11-24, 11 inch iPad on its side, 1180 x 820, and Chrome's
// smaller window, 1133 x 744):
// 1. With a tattoo selected the edit panel took the column and Layers showed under two lines; now
//    Layers keeps at least three lines above it and the panel scrolls inside for the rest.
// 2. The line beside Ink Atlas grows a moment after start, which pushed the toolbar past the right
//    edge with Share cut off; nothing re-checked the fit, so it stayed that way. Now the toolbar
//    always ends inside the screen, and the view switcher moves to its own row instead.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  const ready = () => p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 });
  await p.setViewport({ width: 1180, height: 820, hasTouch: true }); await ready(); await wait(1200);

  // 1. Layers keeps room above the edit panel
  await ink(() => { const I = window.__ink, s = structuredClone(I.state()), b = s.tattoos[0], P = I.positions();
    s.tattoos = []; for (let k = 0; k < 24; k++) { const t = structuredClone(b), v = 200 + k * 431; t.id = 'id' + k; t.name = 'T' + k; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; t.status = 'planned'; t.locked = false; delete t.group; s.tattoos.push(t); }
    s.groups = []; I.loadState(s); });
  await wait(1000);
  for (const [w, h] of [[1180, 820], [1133, 744], [1080, 760], [1366, 1024], [820, 1180]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true }); await wait(700);
    if (w === 1180) { await ink(() => { const r = document.querySelector('#ldList .ld-tat[data-id="id3"]'); r.scrollIntoView({ block: 'center' }); }); await wait(300); const r = await p.$('#ldList .ld-tat[data-id="id3"]'); const bx = await r.boundingBox(); await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); }
    else await ink(() => window.__ink.select('id3'));
    await wait(900);
    assert.equal(await ink(() => window.__ink.selected()), 'id3', `${w}x${h}: selected`);
    const m = await ink(() => { const l = document.querySelector('#ldList'), row = l.querySelector('.ld-row'), sh = document.querySelector('#sheet');
      return { list: l.getBoundingClientRect().height, row: row.getBoundingClientRect().height, sheetBottom: sh.getBoundingClientRect().bottom, vh: innerHeight, scrolls: sh.scrollHeight > sh.clientHeight + 1 || [...sh.querySelectorAll('*')].some((e) => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY)), name: !!document.querySelector('#statusSeg') && document.querySelector('#statusSeg').getBoundingClientRect().bottom <= sh.getBoundingClientRect().bottom }; });
    assert.ok(m.list >= m.row * 3 - 2, `${w}x${h}: Layers shows at least three lines with a tattoo selected (${Math.round(m.list)} px, a line is ${Math.round(m.row)})`);
    assert.ok(m.sheetBottom <= m.vh, `${w}x${h}: the edit panel stays on screen`);
    assert.ok(m.name, `${w}x${h}: the On my skin or Planned switch is still in the panel's view`);
    await ink(() => window.__ink.select(null)); await wait(300);
  }

  // 2. the toolbar ends inside the screen after a size change right at the start
  const nav = p.reload(); await wait(150); await p.setViewport({ width: 1133, height: 744, hasTouch: true }); await nav;
  await ready(); await wait(2500);
  const bar = () => ink(() => { const r = document.querySelector('#top .toolbar').getBoundingClientRect(), s = document.querySelector('#shareBtn').getBoundingClientRect(); return { right: r.right, left: r.left, share: s.right, w: innerWidth }; });
  let b = await bar(); assert.ok(b.right <= b.w - 4 && b.left >= 0 && b.share <= b.w - 4, `the toolbar and Share are on screen after a start-up resize (${JSON.stringify(b)})`);
  // and when the line beside Ink Atlas grows on its own
  await ink(() => { document.querySelector('#saved').textContent = 'Saved on this device. Tap to put it in your account'; }); await wait(600);
  b = await bar(); assert.ok(b.right <= b.w - 4 && b.share <= b.w - 4, `the toolbar stays on screen when the save line grows (${JSON.stringify(b)})`);
  const below = await ink(() => { const v = document.querySelector('#views').getBoundingClientRect(), t = document.querySelector('#top .toolbar').getBoundingClientRect(); return v.right <= t.left - 4 || v.top >= t.bottom - 2; });
  assert.ok(below, 'the view switcher never sits under the toolbar');
  await ink(() => document.querySelector('#shareBtn').click()); await wait(400);
  const tried = await ink(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert.ok(tried.includes('barAlwaysFits') && tried.includes('layersRoom'), 'New to try ticks both');
}
