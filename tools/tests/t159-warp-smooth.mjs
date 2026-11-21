// Moving a tattoo stays light (batch 11 audit): the "in from the nearest tattoo" line under the size
// reads the tattoo's picture to find its ink, and it read the whole picture back off the graphics chip
// again after every move or resize. Now each picture's ink is read once and kept, so moving a tattoo
// reads none at all, and bending one reads its picture once. Checked at both iPad orientations:
//  1. no pixel reads and no gap work while a warp dot is dragged, with pauses in the drag
//  2. once the finger lifts, the line is worked out again and reads the bent shape
//  3. a plain move of the tattoo reads no pixels, and the line still follows the move
//  4. a Blend and colour slider pull does no gap work while it moves either (a guard)
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const c = await p.target().createCDPSession();
  // pixel reads counted at the canvas itself, so the same check runs on a build without the change
  await p.evaluateOnNewDocument(() => { const g = CanvasRenderingContext2D.prototype.getImageData; window.__px = 0; CanvasRenderingContext2D.prototype.getImageData = function (...a) { window.__px++; return g.apply(this, a); }; });
  await p.reload({ waitUntil: 'load' });
  const reads = () => p.evaluate(() => ({ art: window.__px, gap: window.__ink.inkReads ? window.__ink.inkReads().gap : 0 }));
  const gapNow = () => p.$eval('#gap', (e) => (e.hidden ? '' : e.textContent));
  const touchDrag = async (x, y, dx, dy, steps = 14, during) => {
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= steps; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] }); await wait(i % 4 ? 40 : 320); }
    const mid = during ? await during() : null;
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(900);
    return mid;
  };
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const ids = await p.evaluate(() => window.__ink.state().tattoos.filter((t) => !t.hidden).map((t) => t.id));
  assert.ok(ids.length >= 2, 'two tattoos, so there is a gap to read');
  const id = ids[0];
  for (const [W, H] of [[1180, 820], [820, 1180]]) {
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1, hasTouch: true }); await wait(900);
    await p.evaluate((id) => window.__ink.select(id), id); await wait(1200);
    if (await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).status === 'existing', id)) { await p.click('#bPlanned'); await wait(400); }
    await wait(500);
    const gap0 = await gapNow();
    assert.match(gap0, /in from|Touches/, 'the gap line shows: ' + gap0);
    // 1. a warp drag
    await p.evaluate(() => document.querySelector('#bWarp').click()); await wait(1500);
    const dots = await p.$$eval('#warpPts .wpt', (bs) => bs.filter((b) => !b.hidden).map((b) => { const r = b.getBoundingClientRect(); return { k: +b.dataset.k, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
    const q = dots.find((d) => d.k === 5) || dots[0]; assert.ok(q, 'a warp dot shows');
    const r0 = await reads(), w0 = JSON.stringify(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).warp || null, id));
    const mid = await touchDrag(q.x, q.y, -40, -30, 16, async () => ({ r: await reads(), gap: await gapNow() }));
    assert.ok(mid.r.art - r0.art <= 1, `at most one read of the picture while the dot moves, for the warp itself (${mid.r.art - r0.art} reads)`);
    assert.equal(mid.r.gap - r0.gap, 0, 'no gap work while the dot moves');
    assert.equal(mid.gap, gap0, 'the line keeps its last words while the finger is down');
    const w1 = JSON.stringify(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).warp || null, id));
    assert.notEqual(w1, w0, 'the drag bent the tattoo');
    // 2. after the lift
    await wait(600);
    const r1 = await reads();
    assert.ok(r1.gap > mid.r.gap, 'the gap is worked out again once the finger lifts');
    assert.ok(r1.art - mid.r.art <= 2, 'and the bent picture is read once: ' + (r1.art - mid.r.art));
    assert.match(await gapNow(), /in from|Touches/, 'the line still reads');
    await p.click('#warpDone'); await wait(700);
    // 3. a plain move of the tattoo
    const r2 = await reads(), g2 = await gapNow();
    const ctr = { x: dots.reduce((s, d) => s + d.x, 0) / dots.length, y: dots.reduce((s, d) => s + d.y, 0) / dots.length };
    const pos0 = await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).pos, id);
    const other = await p.evaluate((ids) => window.__ink.state().tattoos.find((t) => t.id === ids[1]).pos, ids);
    const towards = await p.evaluate((pt) => window.__ink.projectPoint(pt), other);
    const dx = towards && Number.isFinite(towards.x) ? Math.max(-120, Math.min(120, towards.x - ctr.x)) : 60, dy = towards && Number.isFinite(towards.y) ? Math.max(-120, Math.min(120, towards.y - ctr.y)) * 0.3 : 0;
    await touchDrag(ctr.x, ctr.y, dx * 0.5, dy, 12);
    const pos1 = await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).pos, id);
    assert.notDeepEqual(pos1, pos0, 'the tattoo moved');
    await wait(500);
    const r3 = await reads();
    assert.equal(r3.art - r2.art, 0, `a plain move reads no pixels (${r3.art - r2.art})`);
    assert.ok(r3.gap > r2.gap, 'the gap line is worked out after the move');
    const g3 = await gapNow(); assert.match(g3, /in from|Touches/, 'the line still reads after the move: ' + g3);
    // 4. a Blend and colour slider pull
    await p.evaluate(() => document.querySelector('#bLook').click()); await wait(900);
    const sl = await p.$('#inkLook ink-slider');
    if (sl) {
      const b = await sl.boundingBox(), r4 = await reads();
      await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
      for (let i = 1; i <= 8; i++) { await p.mouse.move(b.x + b.width / 2 + i * b.width * 0.03, b.y + b.height / 2); await wait(i % 3 ? 40 : 300); }
      const r5 = await reads();
      await p.mouse.up(); await wait(900);
      assert.equal(r5.gap - r4.gap, 0, 'no gap work while a Blend and colour slider moves');
      await p.evaluate(() => { const u = document.querySelector('#undo'); u.click(); }); await wait(600);
    }
    await p.evaluate(() => { const d = document.querySelector('#inkLook .done, #inkLookDone, #lookDone'); if (d) d.click(); }); await wait(400);
    await p.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('#undo').click(); }); await wait(800);
  }
  console.log('t159 warp smooth ok');
}
