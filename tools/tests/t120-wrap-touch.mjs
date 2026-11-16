// Measured wrap under fingers and the Pencil on an iPad (Jake, 2026-11-16: "Lots of glitches with
// that. Touch screen scrolls weird."). In an iPad-sized portrait window with touch:
// - the side panel scrolls with a finger that starts on plain text, not only on a button (the page's
//   touch guard used to block it), and the page itself never moves;
// - the studio lives inside the part of the page that follows the keyboard;
// - switching steps keeps the flat view, its zoom and the canvas;
// - a pinch zooms the flat view and never the page; a size change keeps a hand-set view;
// - the Pencil draws while a palm rests on the screen, and the palm moves nothing;
// - a finger stroke turned into a pinch by a second finger is taken back, not left half drawn;
// - lifting one of two fingers off a plant keeps moving the plant, not the view.
// His tattoos are never touched.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(900);
  const cdp = await p.target().createCDPSession();
  const tattoosBefore = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos));
  // points [x, y, id?]; a touchEnd lists the points that lift (none: all of them)
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id], i) => ({ x, y, id: id || i + 1, radiusX: 8, radiusY: 8, force: 1 })) });
  const pen = (type, x, y) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'pen' });

  await p.evaluate(() => { document.getElementById('planBtn')?.click(); }); await wait(300);
  await p.evaluate(() => document.getElementById('openWrap').click()); await wait(500);
  await p.evaluate(() => document.getElementById('wsStart').click()); await wait(800);
  assert.equal(await p.evaluate(() => document.getElementById('wrapStudio').parentElement.id), 'viewport', 'the studio follows the visible screen with the rest of the app');

  // the Print step has the longest panel
  await p.evaluate(() => document.querySelector('#wsTabs [data-step=print]').click()); await wait(600);
  const sideInfo = await p.evaluate(() => {
    const s = document.getElementById('wsSide'), b = s.getBoundingClientRect();
    // a point on plain text or a box: not a button, a slider or a field
    let at = null;
    for (let y = b.bottom - 16; y > b.top + 16 && !at; y -= 6) for (const x of [b.left + 20, b.left + b.width / 2, b.right - 30]) {
      const el = document.elementFromPoint(x, y);
      if (el && s.contains(el) && !el.closest('button,ink-slider,input,select,label,a')) { at = { x, y, tag: el.tagName }; break; }
    }
    return { can: s.scrollHeight - s.clientHeight, top: s.scrollTop, ...(at || {}) };
  });
  assert.ok(sideInfo.can > 80, 'the Print panel is long enough to scroll: ' + JSON.stringify(sideInfo));
  assert.ok(sideInfo.tag, 'found plain text to start on');
  const vpBefore = await p.evaluate(() => [document.getElementById('viewport').style.transform, document.scrollingElement.scrollTop, window.visualViewport.scale]);
  await touch('touchStart', [[sideInfo.x, sideInfo.y]]);
  for (let i = 1; i <= 15; i++) { await touch('touchMove', [[sideInfo.x, sideInfo.y - i * 12]]); await wait(16); }
  await touch('touchEnd', []); await wait(500);
  const after = await p.evaluate(() => document.getElementById('wsSide').scrollTop);
  assert.ok(after - sideInfo.top > 60, `a finger on ${sideInfo.tag} scrolls the panel (${sideInfo.top} to ${after})`);
  assert.deepEqual(await p.evaluate(() => [document.getElementById('viewport').style.transform, document.scrollingElement.scrollTop, window.visualViewport.scale]), vpBefore, 'the page itself does not move');
  // a two-finger pinch over the panel never zooms the page
  await touch('touchStart', [[sideInfo.x, sideInfo.y - 40], [sideInfo.x + 30, sideInfo.y - 10]]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[sideInfo.x - i * 6, sideInfo.y - 40 - i * 6], [sideInfo.x + 30 + i * 6, sideInfo.y - 10 + i * 6]]); await wait(16); }
  await touch('touchEnd', []); await wait(200);
  assert.equal(await p.evaluate(() => window.visualViewport.scale), 1, 'no page zoom');

  // the flat view: pinch to zoom, then switch steps and keep it
  const cvBox = await p.evaluate(() => { const r = document.getElementById('wsCanvas').getBoundingClientRect(); window.__wsCv = document.getElementById('wsCanvas'); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cx = cvBox.x + cvBox.w / 2, cy = cvBox.y + cvBox.h / 2 + 10;
  const s0 = await p.evaluate(() => window.__ink.wrap().api.view.s);
  await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[cx - 30 - i * 8, cy], [cx + 30 + i * 8, cy]]); await wait(20); }
  await touch('touchEnd', []); await wait(300);
  const s1 = await p.evaluate(() => window.__ink.wrap().api.view.s);
  assert.ok(s1 > s0 * 1.6, `pinch zooms the flat view (${s0} to ${s1})`);
  assert.equal(await p.evaluate(() => window.visualViewport.scale), 1, 'no page zoom from the flat view');
  await p.evaluate(() => document.querySelector('#wsTabs [data-step=measure]').click()); await wait(400);
  let st = await p.evaluate(() => ({ s: window.__ink.wrap().api.view.s, same: document.getElementById('wsCanvas') === window.__wsCv, top: document.getElementById('wsSide').scrollTop }));
  assert.ok(st.same, 'switching steps keeps the canvas');
  assert.ok(Math.abs(st.s - s1) < 1e-9, 'switching steps keeps the zoom');
  assert.equal(st.top, 0, 'a new step opens at the top of its panel');
  // a change of the canvas size (a warning line above it, the keyboard) keeps a hand-set view
  await p.evaluate(() => { document.getElementById('wsInsp').style.minHeight = '140px'; document.querySelector('#wsViews .btn').click(); }); await wait(400);
  st = await p.evaluate(() => window.__ink.wrap().api.view.s);
  assert.ok(Math.abs(st - s1) < 1e-9, 'a smaller canvas keeps the zoom');
  await p.evaluate(() => { document.getElementById('wsInsp').style.minHeight = ''; });
  // a double tap fits it again
  for (let k = 0; k < 2; k++) { await touch('touchStart', [[cx, cy]]); await touch('touchEnd', []); await wait(120); }
  await wait(300);
  assert.ok(Math.abs(await p.evaluate(() => window.__ink.wrap().api.view.s) - s0) < 1e-6, 'double tap fits the shape again');

  // tracing the old ink: the Pencil draws with a palm resting on the glass
  const centre = async () => p.evaluate(() => { const W = window.__ink.wrap().api, b = W.tpl().bounds, s = W.toScreen((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2), r = document.getElementById('wsCanvas').getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; });
  await p.evaluate(() => { const w = window.__ink.wrap(); w.api.ui.step = 'existing'; w.api.ui.sub = 'trace'; w.api.ui.mode = 'brush:ink+'; w.refresh(); }); await wait(500);
  let [px, py] = await centre();
  const viewBefore = await p.evaluate(() => { const v = window.__ink.wrap().api.view; return [v.s, v.cx, v.cy]; });
  await touch('touchStart', [[px + 60, py + 50]]); // the palm lands first
  await pen('mousePressed', px - 40, py);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[px + 60 + i * 6, py + 50 + i * 3]]); await pen('mouseMoved', px - 40 + i * 8, py); await wait(16); }
  await pen('mouseReleased', px + 40, py); await wait(50);
  await touch('touchEnd', []); await wait(700);
  let m = await p.evaluate(() => window.__ink.wrap().api.masks());
  assert.ok(m && m.ink > 5, 'the Pencil stroke is kept: ' + JSON.stringify(m));
  assert.deepEqual(await p.evaluate(() => { const v = window.__ink.wrap().api.view; return [v.s, v.cx, v.cy]; }), viewBefore, 'the palm moved nothing');
  const inkKey = await p.evaluate(() => window.__ink.wrap().api.reg().existing.ink);
  // the Pencil landing on a palm that is already moving takes over and the palm is dropped
  await touch('touchStart', [[px + 60, py - 40]]);
  for (let i = 1; i <= 4; i++) { await touch('touchMove', [[px + 60 + i * 10, py - 40]]); await wait(16); }
  await pen('mousePressed', px - 40, py + 20);
  for (let i = 1; i <= 8; i++) { await pen('mouseMoved', px - 40 + i * 8, py + 20); await touch('touchMove', [[px + 100 + i * 10, py - 40]]); await wait(16); }
  await pen('mouseReleased', px + 24, py + 20); await touch('touchEnd', []); await wait(700);
  const m2 = await p.evaluate(() => window.__ink.wrap().api.masks());
  assert.ok(m2.ink > m.ink + 2, `the second Pencil stroke is kept too (${m.ink} to ${m2.ink})`);
  m = m2;
  const inkKey2 = await p.evaluate(() => window.__ink.wrap().api.reg().existing.ink);
  assert.notEqual(inkKey2, inkKey, 'each stroke saves');

  // a finger stroke that becomes a two-finger move is taken back
  [px, py] = await centre();
  await touch('touchStart', [[px - 60, py + 30]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[px - 60 + i * 10, py + 30]]); await wait(16); }
  await touch('touchStart', [[px + 20, py + 30], [px + 80, py - 40]]);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', [[px + 20 - i * 6, py + 30], [px + 80 + i * 6, py - 40]]); await wait(16); }
  await touch('touchEnd', []); await wait(800);
  const m3 = await p.evaluate(() => window.__ink.wrap().api.masks());
  assert.ok(Math.abs(m3.ink - m.ink) < 0.5, `the half stroke is taken back (${m.ink} then ${m3.ink})`);
  assert.equal(await p.evaluate(() => window.__ink.wrap().api.reg().existing.ink), inkKey2, 'nothing saved for it');
  await p.evaluate(() => { const w = window.__ink.wrap(); w.api.ui.mode = null; w.refresh(); });

  // a plant: two fingers size it, lift one, the other keeps moving it
  const dot = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#1a6b3a'; g.beginPath(); g.arc(100, 100, 90, 0, 7); g.fill(); return c.toDataURL('image/png'); });
  const id = await p.evaluate(async (d) => { const W = window.__ink.wrap().api, b = W.tpl().bounds; return W.addPieceData(d, 'Round cactus', [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2], 40); }, dot);
  await p.evaluate(() => document.querySelector('#wsTabs [data-step=design]').click()); await wait(600);
  [px, py] = await centre();
  const pc0 = await p.evaluate((id) => { const x = window.__ink.wrap().api.reg().art.pieces.find((q) => q.id === id); return { x: x.x, y: x.y, w: x.w }; }, id);
  const v0 = await p.evaluate(() => { const v = window.__ink.wrap().api.view; return [v.s, v.cx, v.cy]; });
  await touch('touchStart', [[px, py]]);
  await touch('touchMove', [[px + 2, py]]);
  await touch('touchStart', [[px + 2, py], [px + 40, py]]);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', [[px + 2, py], [px + 40 + i * 8, py]]); await wait(16); }
  await touch('touchEnd', [[px + 80, py, 2]]); await wait(100); // the second finger lifts
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[px + 2 + i * 10, py, 1]]); await wait(16); }
  await touch('touchEnd', []); await wait(600);
  const pc1 = await p.evaluate((id) => { const x = window.__ink.wrap().api.reg().art.pieces.find((q) => q.id === id); return { x: x.x, y: x.y, w: x.w }; }, id);
  const v1 = await p.evaluate(() => { const v = window.__ink.wrap().api.view; return [v.s, v.cx, v.cy]; });
  assert.ok(pc1.w > pc0.w * 1.3, `two fingers size the plant (${pc0.w} to ${pc1.w})`);
  assert.ok(pc1.x - pc0.x > 60 / v0[0] * 0.8, `the finger left keeps moving the plant (${pc0.x} to ${pc1.x})`);
  assert.deepEqual(v1, v0, 'the view stays put while the plant moves');

  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), tattoosBefore, 'tattoos untouched');
  await p.screenshot({ path: 'shots/t120-wrap-touch.png' });
  console.log('PASS measured wrap touch');
}
