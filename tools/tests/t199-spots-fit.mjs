// Try other spots on an iPad (QA batch 32). A spot's note could be longer than its button ("High
// pain, always shows, wraps more than half way round" under Wrist) and ran on top of the button
// beside it, and the list stopped 190 px above the bottom of the screen, room kept for a tray of
// tattoos that is gone, so fewer spots showed at once. Now a long note wraps inside its own button
// and on an iPad the list reaches down to the bottom. Body > Match photos of me had the same gap.
import assert from 'node:assert/strict';

export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(400);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bSpots', (e) => e.click()); await wait(1500);
  assert.equal(await p.$eval('#spotPop', (e) => e.hidden), false, 'Try other spots opens');
  const look = () => p.evaluate(() => {
    const pop = document.querySelector('#spotPop'), pr = pop.getBoundingClientRect();
    const btns = [...document.querySelectorAll('#spotChoices [data-spot]')].filter((b) => b.checkVisibility());
    const boxes = btns.map((b) => { const r = b.getBoundingClientRect(), sub = b.querySelector('.spotsub'), sr = sub && !sub.hidden ? sub.getBoundingClientRect() : null;
      return { id: b.dataset.spot, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, over: b.scrollWidth > b.clientWidth + 1 || (sub && !sub.hidden && sub.scrollWidth > sub.clientWidth + 1), subIn: !sr || (sr.left >= r.left - 0.5 && sr.right <= r.right + 0.5 && sr.bottom <= r.bottom + 0.5), note: sub && !sub.hidden ? sub.textContent : '' }; });
    return { pop: { t: pr.top, b: pr.bottom }, H: innerHeight, scrolls: pop.scrollHeight > pop.clientHeight + 2, boxes };
  });
  for (const [w, h] of [[1180, 820], [820, 1180], [1133, 744], [744, 1133], [1366, 1024], [1024, 1366]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true, deviceScaleFactor: 1 }); await wait(900);
    const o = await look(), at = `${w}x${h}`;
    assert.ok(o.boxes.length >= 18, `${at}: the spots are listed (${o.boxes.length})`);
    assert.ok(o.boxes.some((b) => b.note.length > 34), `${at}: some notes are long enough to need two lines`);
    for (const b of o.boxes) {
      assert.ok(!b.over, `${at}: ${b.id} fits its words inside the button ("${b.note}")`);
      assert.ok(b.subIn, `${at}: ${b.id}'s note stays inside its own button`);
      assert.ok(b.w >= 44 && b.h >= 44, `${at}: ${b.id} is 44 pt`);
    }
    for (let i = 0; i < o.boxes.length; i++) for (let j = i + 1; j < o.boxes.length; j++) {
      const a = o.boxes[i], c = o.boxes[j];
      assert.ok(a.r <= c.l + 0.5 || c.r <= a.l + 0.5 || a.b <= c.t + 0.5 || c.b <= a.t + 0.5, `${at}: ${a.id} and ${c.id} do not overlap`);
    }
    if (o.scrolls) assert.ok(o.pop.b >= o.H - 40, `${at}: a long list reaches down to the bottom of the screen (ends at ${Math.round(o.pop.b)} of ${o.H})`);
    assert.ok(o.pop.b <= o.H, `${at}: the list stays on screen`);
    // every spot can be reached: scroll to the end and the last one shows whole
    await p.$eval('#spotPop', (e) => { e.scrollTop = e.scrollHeight; }); await wait(150);
    const last = await p.evaluate(() => { const bs = [...document.querySelectorAll('#spotChoices [data-spot]')].filter((b) => b.checkVisibility()), b = bs[bs.length - 1], r = b.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2, e = document.elementFromPoint(x, y); return !!e && b.contains(e); });
    assert.ok(last, `${at}: the last spot can be scrolled to and tapped`);
    await p.$eval('#spotPop', (e) => { e.scrollTop = 0; });
  }
  // a tap on a spot still moves the tattoo there, one undo step
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos.map((t) => t.pos)));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 }); await wait(700);
  const calf = await p.$('#spotChoices [data-spot^="calf"]'); const r = await calf.boundingBox();
  await p.$eval('#spotPop', (e, y) => { e.scrollTop += y; }, r.y - 300); await wait(150);
  const r2 = await calf.boundingBox(); await p.mouse.click(r2.x + r2.width / 2, r2.y + r2.height / 2); await wait(1200);
  assert.notEqual(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos.map((t) => t.pos))), before, 'a spot moves the tattoo');
  await p.evaluate(() => window.__ink.undo()); await wait(500);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos.map((t) => t.pos))), before, 'one undo puts it back');
  // a phone keeps the room for the edit sheet along the bottom
  await p.setViewport({ width: 390, height: 844, hasTouch: true, deviceScaleFactor: 1 }); await wait(800);
  assert.equal(await p.$eval('#spotPop', (e) => getComputedStyle(e).maxHeight), 'calc(100% - 190px)', 'phone: the list keeps the room it had above the edit sheet');
  console.log('PASS t199 Try other spots: notes wrap in their own button, the list reaches the bottom on an iPad');
}
