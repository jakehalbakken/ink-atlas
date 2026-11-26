// The paint bar for Draw on the skin keeps the chest and belly clear (2026-11-26 audit: on an iPad on
// its side the bar sat at the top over the middle of the body, so the belly could not be painted).
// At iPad landscape and portrait, an 11 inch iPad on its side and a phone:
// - the bar sits along the bottom, below the chest and the belly, and stays on screen
// - a finger on the belly paints it, so Draw here turns on
// - Paint and Rub out fill their row, with no empty third column; the drawing bar's rows do too
// - a message shown while painting is not under the bar
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 8, radiusY: 8, force: 1 })) });
  const finger = async (pts) => { await touch('touchStart', [pts[0]]); for (const q of pts.slice(1)) { await touch('touchMove', [q]); await wait(16); } await touch('touchEnd', []); await wait(300); };
  const line = (a, b, n = 12) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  const fills = (sel) => p.$$eval(sel, (ss) => ss.filter((s) => s.checkVisibility()).map((s) => { const w = s.getBoundingClientRect().width; const kids = [...s.children].filter((c) => c.checkVisibility()); const sum = kids.reduce((a, c) => a + c.getBoundingClientRect().width, 0); return [s.id, Math.round(w), Math.round(sum), kids.length]; }));
  for (const [w, h] of [[1180, 820], [820, 1180], [1133, 744], [744, 1133], [390, 844]]) {
    const at = `${w}x${h}`;
    await p.setViewport({ width: w, height: h, hasTouch: true, deviceScaleFactor: 1 }); await wait(1200);
    if (w >= 700 && !(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(500); }
    await p.click('#views [data-view="0"]'); await p.waitForFunction(() => window.__ink.settled(), { timeout: 10000 }); await wait(300);
    await p.click('#drawSkin'); await wait(500);
    const pts = await p.evaluate(() => { const I = window.__ink; const q = (o) => { const hit = I.surfaceHit(o, [0, 0, -1]); return hit && I.projectPoint(hit.pos); }; return { chest: q([0.06, 1.3, 0.5]), belly: q([0.03, 1.06, 0.5]) }; });
    const bar = await p.$eval('#paintBar', (b) => { const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
    assert.ok(bar.bottom <= h + 1 && bar.top >= 0, `${at}: the paint bar is on screen ${JSON.stringify(bar)}`);
    for (const k of ['chest', 'belly']) assert.ok(pts[k].y < bar.top - 8, `${at}: the ${k} (y ${Math.round(pts[k].y)}) is clear of the paint bar (top ${Math.round(bar.top)})`);
    for (const [id, sw, sum, n] of await fills('#paintBar .seg')) assert.ok(sum >= sw - 6 * n - 8, `${at}: ${id} fills its row (${sum} of ${sw})`);
    const s = pts.belly;
    await finger(line([s.x - 30, s.y], [s.x + 30, s.y + 10]));
    assert.equal(await p.$eval('#paintHere', (e) => e.disabled), false, `${at}: painting the belly turns Draw here on`);
    await p.evaluate(() => window.__ink.toast && window.__ink.toast('A message while painting'));
    const tb = await p.evaluate(() => { const t = document.querySelector('#toast'); if (t.hidden) return null; const a = t.getBoundingClientRect(), b = document.querySelector('#paintBar').getBoundingClientRect(); return a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right; });
    if (tb !== null) assert.equal(tb, false, `${at}: a message is not under the paint bar`);
    await p.click('#paintHere'); await p.waitForFunction(() => !!window.__ink.drawing(), { timeout: 10000 }); await wait(500);
    for (const [id, sw, sum, n] of await fills('#drawBar .seg')) assert.ok(sum >= sw - 6 * n - 8, `${at}: ${id} fills its row (${sum} of ${sw})`);
    await p.click('#dbCancel'); await wait(400);
    if (await p.evaluate(() => { const a = document.querySelector('#dbAsk'); return a && !a.hidden && a.checkVisibility(); })) { await p.click('#dbDiscard'); await wait(400); }
    assert.equal(await p.evaluate(() => !!window.__ink.drawing()), false, `${at}: Cancel leaves drawing`);
  }
  console.log('PASS t195 paint bar keeps the chest and belly clear: along the bottom at five screen sizes, the belly paints, rows filled, messages clear');
}
