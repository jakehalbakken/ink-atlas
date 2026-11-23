// t173 a two-finger tap (undo) where one finger lands on the selected tattoo's size or turn handle.
// The handle kept that finger to itself, so the body saw a one-finger tap from the other finger:
// nothing was undone and the tap dropped the selection (or picked something else). Fingers are
// put down and lifted a few hundredths of a second apart, as real ones are.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
  const stag = async (a, b) => { await touch('touchStart', [a]); await wait(40); await touch('touchStart', [a, b]); await wait(70); await touch('touchEnd', [b]); await wait(30); await touch('touchEnd', []); await wait(500); };
  const undoLen = () => p.evaluate(() => window.__ink.undoLen());
  const S = () => p.evaluate(() => window.__ink.state());
  const sun = (await S()).tattoos.find((t) => /Sunburst/.test(t.name)).id;
  await p.evaluate((id) => window.__ink.select(id), sun); await p.waitForFunction(() => window.__ink.settled(), { timeout: 20000 }); await wait(500);
  let id = 20;
  for (const h of ['#hSize', '#hTurn']) {
    // one undo step: size it up a notch with the keyboard (handles stay)
    await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    const w0 = (await S()).tattoos.find((t) => t.id === sun).width;
    await p.keyboard.press('='); await wait(1200);
    assert.ok((await S()).tattoos.find((t) => t.id === sun).width > w0, 'the key sized it');
    await p.waitForFunction((h) => { const e = document.querySelector(h); return e && !e.parentElement.hidden && e.getBoundingClientRect().width > 0; }, { timeout: 5000 }, h);
    await wait(400);
    const b = await p.$eval(h, (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const other = await p.evaluate((b) => { for (const [dx, dy] of [[120, 40], [-120, 40], [120, -40], [-120, -40], [0, 120]]) { const x = b[0] + dx, y = b[1] + dy, e = document.elementFromPoint(x, y); if (e && e.tagName === 'CANVAS') return [x, y]; } return null; }, b);
    assert.ok(other, 'room for the second finger on the canvas');
    const u0 = await undoLen(), t0 = (await S()).tattoos.find((t) => t.id === sun);
    assert.ok(u0 > 0, 'something to undo');
    await stag([b[0], b[1], ++id], [other[0], other[1], ++id]);
    assert.equal(await undoLen(), u0 - 1, `${h}: a two-finger tap with one finger on the handle undoes one step`);
    assert.equal(await p.evaluate(() => window.__ink.selected()), sun, `${h}: the tattoo stays selected`);
    const t1 = (await S()).tattoos.find((t) => t.id === sun);
    assert.deepEqual(t1.pos, t0.pos, `${h}: the tattoo did not move`);
    assert.equal(t1.rot || 0, t0.rot || 0, `${h}: nor turn`);
    assert.ok(Math.abs(t1.width - w0) < 1e-9, `${h}: the size step was undone`);
  }
  // one finger held on a handle while another taps the body is still not a tap on the body
  const b = await p.$eval('#hSize', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const other = await p.evaluate((b) => { for (const [dx, dy] of [[120, 40], [-120, 40], [120, -40], [-120, -40], [0, 120]]) { const x = b[0] + dx, y = b[1] + dy, e = document.elementFromPoint(x, y); if (e && e.tagName === 'CANVAS') return [x, y]; } return null; }, b);
  await touch('touchStart', [[b[0], b[1], 40]]); await wait(500); await touch('touchStart', [[b[0], b[1], 40], [other[0], other[1], 41]]); await wait(60); await touch('touchEnd', [[b[0], b[1], 40]]); await wait(100); await touch('touchEnd', []); await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.selected()), sun, 'a tap beside a held handle does not drop the tattoo');
  // a plain one-finger tap on the handle keeps it too
  await touch('touchStart', [[b[0], b[1], 42]]); await wait(60); await touch('touchEnd', []); await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.selected()), sun, 'a tap on the handle keeps it selected');
  assert.ok(JSON.parse(await p.evaluate(() => localStorage.getItem('ia-tried') || '[]')).includes('tapOnHandle'), 'ticked in New to try');
  console.log('PASS t173 a two-finger tap with a finger on a handle undoes and keeps the tattoo');
}
