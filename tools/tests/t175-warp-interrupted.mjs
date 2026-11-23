// t175 a Bend and warp drag that the bar interrupts. With one finger holding a dot, a tap with
// another finger on Distort, Arc, a grid size or Done rebuilt the dots under the first finger: the
// drag never ended, so every dot stayed dead until the panel was closed, the piece kept its small
// draft picture, and Done left the change unsaved with no undo step of its own. Now the drag ends
// there as one undo step, kept, and the next dot moves at once.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const c = await p.target().createCDPSession();
  const ink = (f, ...a) => p.evaluate(f, ...a);
  const touch = (type, pts) => c.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const dots = () => p.$$eval('#warpPts .wpt', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { k: +b.dataset.k, x: r.left + r.width / 2, y: r.top + r.height / 2, shown: !b.hidden }; }).filter((d) => d.shown));
  const still = async () => { let prev = ''; for (let i = 0; i < 40; i++) { const now = JSON.stringify(await ink(() => window.__ink.cam())); if (now === prev) return; prev = now; await wait(250); } };
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  if (!(await ink(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }
  await p.click('#ldList .ld-tat'); await wait(700);
  const id = await ink(() => window.__ink.selected());
  if ((await ink((id) => window.__ink.state().tattoos.find((t) => t.id === id).status, id)) === 'existing') { await p.click('#bPlanned'); await wait(400); }
  await p.click(`#ldList .ld-tat[data-id="${id}"]`); await wait(1400);
  const warpOf = () => ink((id) => JSON.stringify(window.__ink.state().tattoos.find((t) => t.id === id).warp || null), id);

  // hold a dot, move it, and tap a bar button with another finger before lifting
  const holdAndTap = async (button) => {
    const ds = await dots(), mx = ds.reduce((a, d) => a + d.x, 0) / ds.length, my = ds.reduce((a, d) => a + d.y, 0) / ds.length, d = ds.sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
    await touch('touchStart', [{ x: d.x, y: d.y, id: 1 }]);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: d.x + 4 * i, y: d.y + 2 * i, id: 1 }]); await wait(40); }
    assert.ok(await ink(() => document.body.classList.contains('warp-dragging')), 'a drag is under way');
    await ink((s) => document.querySelector(s).click(), button); await wait(300);
    assert.ok(!(await ink(() => document.body.classList.contains('warp-dragging'))), button + ' ends the drag');
    await touch('touchEnd', []); await wait(600);
  };
  const dragOne = async () => {
    const ds = await dots(), d = ds.sort((a, b) => a.y - b.y)[0];
    await touch('touchStart', [{ x: d.x, y: d.y, id: 2 }]);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: d.x - 3 * i, y: d.y - 3 * i, id: 2 }]); await wait(40); }
    await touch('touchEnd', []); await wait(600);
  };

  await p.click('#bWarp'); await wait(600); await still();
  for (const [button, next] of [['[data-wmode="distort"]', true], ['[data-wn="5"]', true], ['[data-wmode="warp"]', true]]) {
    const u0 = await ink(() => window.__ink.undoLen()), w0 = await warpOf();
    await holdAndTap(button);
    assert.notEqual(await warpOf(), w0, 'the drag before ' + button + ' is kept');
    const u1 = await ink(() => window.__ink.undoLen());
    assert.ok(u1 >= u0 + 1, 'as an undo step of its own');
    if (next) {
      const w1 = await warpOf(); await dragOne();
      assert.notEqual(await warpOf(), w1, 'the next dot moves at once after ' + button);
      assert.equal(await ink(() => window.__ink.undoLen()), u1 + 1, 'one undo step for that drag');
    }
  }
  // Done with a finger still on a dot: kept, saved, closed
  const u0 = await ink(() => window.__ink.undoLen()), w0 = await warpOf();
  await holdAndTap('#warpDone');
  assert.ok(await ink(() => document.querySelector('#warpBar').hidden), 'the bar closes');
  const w1 = await warpOf(); assert.notEqual(w1, w0, 'the last drag is kept');
  assert.equal(await ink(() => window.__ink.undoLen()), u0 + 1, 'one undo step');
  await ink(() => document.getElementById('undo').click()); await wait(500);
  assert.equal(await warpOf(), w0, 'undo takes back just that drag');
  await ink(() => document.getElementById('redo').click()); await wait(600);
  await ink(() => window.__ink.flush()); await wait(300);
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  assert.equal(await warpOf(), w1, 'and it was saved');
  assert.ok(JSON.parse(await ink(() => localStorage.getItem('ia-tried') || '[]')).includes('warpHeld'), 'ticked in New to try');
  console.log('PASS t175 a warp drag interrupted by the bar is kept as one undo step and the dots stay live');
}
