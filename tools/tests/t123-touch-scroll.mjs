// Every part of the app that scrolls takes a finger on the iPad (2026-11-17 bug sweep).
// The page's touch guard blocks finger moves outside the panels it knows, so a list that
// scrolls but sits outside them never moved unless the finger began on a button: the
// comment list, a long comment and its replies, the Ink check bar and the text boxes.
// - no element that can scroll sits outside the guard's list;
// - a finger that starts on plain text in the Ink check bar scrolls it, and the page stays put.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(900);
  const outside = await p.evaluate(() => {
    const sel = '.pop,.modal,#trayItems,#sheet,[aria-modal=true],[data-scroll],textarea';
    const r = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (!/auto|scroll/.test(cs.overflowY)) continue;
      if (!el.closest(sel)) r.push(el.id || el.className || el.tagName);
    }
    return r;
  });
  assert.deepEqual(outside, [], 'parts that scroll but ignore a finger: ' + outside.join(', '));

  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 })) });
  const at = await p.evaluate(() => {
    document.getElementById('inkCheck').hidden = false;
    const bar = document.getElementById('icBar');
    for (let i = 0; i < 30; i++) { const d = document.createElement('p'); d.className = 't123'; d.textContent = 'Line ' + i + ' of a long Ink check list'; d.style.margin = '0'; bar.append(d); }
    bar.scrollTop = 0;
    const b = bar.getBoundingClientRect(), x = b.left + b.width / 2;
    for (let y = b.bottom - 12; y > b.top + 12; y -= 4) { const el = document.elementFromPoint(x, y); if (el && el.classList.contains('t123')) return { x, y, can: bar.scrollHeight - bar.clientHeight }; }
    return null;
  });
  assert.ok(at && at.can > 60, 'the Ink check bar has plain text to drag: ' + JSON.stringify(at));
  await touch('touchStart', [[at.x, at.y]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[at.x, at.y - i * 12]]); await wait(16); }
  await touch('touchEnd', []); await wait(400);
  const after = await p.evaluate(() => ({ top: document.getElementById('icBar').scrollTop, page: [window.scrollY, document.scrollingElement.scrollTop] }));
  assert.ok(after.top > 20, 'a finger scrolls the Ink check bar: ' + JSON.stringify(after));
  assert.deepEqual(after.page, [0, 0], 'the page itself never moves');
  await p.evaluate(() => { document.querySelectorAll('#icBar .t123').forEach((e) => e.remove()); document.getElementById('inkCheck').hidden = true; });
  console.log('PASS t123 touch scroll: every scrolling part takes a finger, the Ink check bar scrolls from plain text, the page stays put');
}
