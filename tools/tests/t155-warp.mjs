// Bend and warp a tattoo on the body (2026-11-21, Jake: "I also want to be able to bend and warp and
// transform tattoos that are on the body as plan designs ... I just wish that I could play with the
// shape of it a little bit more"). Checked by touch at both iPad orientations:
//  1. a Bend and warp tile in the edit sheet opens a bar and a grid of dots on the tattoo on the skin;
//     the sheet and Layers step aside and every dot and button is 44 pt
//  2. a finger on an edge dot bends the ink on the skin, the dot stays under the finger, one undo step
//  3. Reset takes it off and Undo brings it back; Distort has four corners; Arc curves it as one step
//  4. Mirror keeps the shape; Done closes and the tile shows it is warped; the size reads the new shape
//  5. it is kept through a reload, and the other tattoos have no warp added
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const c = await p.target().createCDPSession();
  const touchDrag = async (x, y, dx, dy, steps = 14) => {
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= steps; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] }); await wait(40); }
    const at = await dotsNow();
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(700);
    return at;
  };
  const rect = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, vis: cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 }; });
  const dotsNow = () => p.$$eval('#warpPts .wpt', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { k: +b.dataset.k, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, shown: !b.hidden, on: b.classList.contains('on') }; }));
  const tat = (id) => p.evaluate((id) => JSON.parse(JSON.stringify(window.__ink.state().tattoos.find((x) => x.id === id))), id);
  const ink = (id) => p.evaluate((id) => window.__ink.inkOnSkin(id), id);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);

  let id = null;
  for (const [W, H] of [[1180, 820], [820, 1180]]) {
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1, hasTouch: true }); await wait(900);
    if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }
    if (!id) { await p.click('#ldList .ld-tat'); await wait(700); id = await p.evaluate(() => window.__ink.selected()); }
    else if ((await p.evaluate(() => window.__ink.selected())) !== id) { await p.click(`#ldList .ld-tat[data-id="${id}"]`); await wait(700); }
    assert.ok(id, 'a tattoo is selected');
    if ((await tat(id)).status === 'existing') { await p.click('#bPlanned'); await wait(400); }
    if ((await tat(id)).warp) { await p.evaluate(() => { document.querySelector('#bWarp').click(); }); await wait(300); await p.click('#warpReset'); await wait(400); await p.click('#warpDone'); await wait(300); }
    // close up, so the grid is big enough to grab
    await p.click(`#ldList .ld-tat[data-id="${id}"]`); await wait(1400);
    const t0 = await tat(id), ink0 = await ink(id), size0 = await p.$eval('#size', (e) => e.textContent);
    assert.ok(ink0 && ink0.area > 0, 'the ink is on the skin');

    // 1. the tile, the bar and the grid
    const tile = await rect('#bWarp'); assert.ok(tile.vis && tile.w >= 44 && tile.h >= 44, 'Bend and warp tile 44pt: ' + tile.w + 'x' + tile.h);
    assert.equal(await p.$eval('#bWarp', (e) => e.textContent.trim()), 'Bend and warp');
    await p.click('#bWarp'); await wait(1600);
    assert.ok((await rect('#warpBar')).vis, 'the bar shows');
    assert.equal(await p.$eval('#dock', (e) => getComputedStyle(e).visibility), 'hidden', 'the sheet steps aside');
    assert.equal(await p.$eval('#layersDock', (e) => getComputedStyle(e).visibility), 'hidden', 'Layers steps aside');
    assert.equal(await p.$eval('#bWarp', (e) => e.getAttribute('aria-pressed')), 'true');
    const bar = await rect('#warpBar'); assert.ok(bar.l >= 0 && bar.r <= W && bar.t >= 0 && bar.b <= H, 'the bar is on screen');
    for (const b of await p.$$('#warpBar .btn')) { const r = await b.boundingBox(); if (r && r.width) assert.ok(r.width >= 44 && r.height >= 44, 'bar button 44pt: ' + r.width + 'x' + r.height); }
    let dots = await dotsNow();
    assert.equal(dots.length, 16, 'a 4 by 4 grid');
    const shown = dots.filter((d) => d.shown);
    assert.ok(shown.length >= 9, 'most dots show on the skin: ' + shown.length);
    for (const d of shown) assert.ok(d.w >= 44 && d.h >= 44, 'dot 44pt');
    assert.ok((await p.$$eval('#warpLines path', (ps) => ps.length)) >= 6, 'grid lines drawn on the skin');

    // 2. bend an inner dot outward by touch (the corners of a picture are mostly bare paper)
    const cx = shown.reduce((s, d) => s + d.x, 0) / shown.length, cy = shown.reduce((s, d) => s + d.y, 0) / shown.length;
    const edge = shown.filter((d) => [5, 6, 9, 10].includes(d.k)).sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy))[0];
    const ux = (edge.x - cx) / (Math.hypot(edge.x - cx, edge.y - cy) || 1), uy = (edge.y - cy) / (Math.hypot(edge.x - cx, edge.y - cy) || 1);
    const during = await touchDrag(edge.x, edge.y, ux * 60, uy * 60);
    const held = during.find((d) => d.k === edge.k);
    assert.ok(held.on && Math.hypot(held.x - (edge.x + ux * 60), held.y - (edge.y + uy * 60)) < 6, 'the dot stays under the finger');
    const t1 = await tat(id);
    assert.ok(t1.warp && t1.warp.n === 4 && t1.warp.p.length === 32, 'the shape is kept as a warp');
    assert.equal(t1.width, t0.width, 'the size is the same'); assert.deepEqual(t1.pos, t0.pos, 'the place is the same'); assert.equal(t1.img, t0.img, 'the artwork never changes');
    dots = await dotsNow(); const after = dots.find((d) => d.k === edge.k);
    assert.ok(Math.hypot(after.x - (edge.x + ux * 60), after.y - (edge.y + uy * 60)) < 22, 'the dot lands where the finger let go: ' + Math.hypot(after.x - (edge.x + ux * 60), after.y - (edge.y + uy * 60)).toFixed(1));
    const ink1 = await ink(id);
    assert.ok(ink1.area > ink0.area * 1.02 || dist(ink1.c, ink0.c) > 0.002, `the ink on the skin bends (area ${ink0.area.toFixed(5)} to ${ink1.area.toFixed(5)}, moved ${(dist(ink1.c, ink0.c) * 1000).toFixed(1)} mm)`);
    // one undo step
    await p.click('#undo'); await wait(800);
    assert.equal((await tat(id)).warp, undefined, 'one undo takes the drag back');
    const inkU = await ink(id); assert.ok(Math.abs(inkU.area - ink0.area) < ink0.area * 0.02, 'the ink is back as it was');
    await p.click('#redo'); await wait(800);
    assert.deepEqual((await tat(id)).warp, t1.warp, 'redo puts it back');
    assert.ok((await rect('#warpBar')).vis, 'the bar stays open through undo and redo');

    // 3. Reset, Distort, Arc
    await p.click('#warpReset'); await wait(700);
    assert.equal((await tat(id)).warp, undefined, 'Reset takes it off');
    await p.click('#undo'); await wait(700);
    assert.deepEqual((await tat(id)).warp, t1.warp, 'and Undo brings it back');
    await p.click('#warpBar [data-wmode=distort]'); await wait(500);
    dots = await dotsNow(); assert.equal(dots.length, 4, 'Distort has four corners');
    assert.ok(await p.$eval('#warpPts .wpt', (e) => e.classList.contains('corner')));
    assert.equal(await p.$eval('#warpGridRow', (e) => e.hidden), true, 'no grid size in Distort');
    const corner = dots.filter((d) => d.shown)[0]; assert.ok(corner, 'a corner shows');
    const before = (await tat(id)).warp;
    await touchDrag(corner.x, corner.y, (corner.x - cx) * 0.25, (corner.y - cy) * 0.25);
    const t2 = await tat(id); assert.ok(t2.warp && JSON.stringify(t2.warp) !== JSON.stringify(before), 'Distort changes the shape');
    assert.notEqual(await p.$eval('#size', (e) => e.textContent), size0, 'the size line reads the new shape');
    await p.click('#warpBar [data-wmode=arc]'); await wait(500);
    assert.equal((await dotsNow()).length, 0, 'Arc has a slider, no dots');
    const sl = await rect('#warpArc');
    await p.mouse.move(sl.l + sl.w / 2, sl.t + sl.h / 2); await p.mouse.down();
    for (let i = 1; i <= 8; i++) { await p.mouse.move(sl.l + sl.w / 2 + i * sl.w * 0.04, sl.t + sl.h / 2); await wait(40); }
    await p.mouse.up(); await wait(800);
    const t3 = await tat(id); assert.ok(t3.warp && t3.warp.n === 5 && JSON.stringify(t3.warp) !== JSON.stringify(t2.warp), 'Arc curves it (on a fine grid)');
    assert.ok(+(await p.$eval('#warpArc', (e) => e.value)) > 10, 'the slider stays where it was left');
    await p.click('#undo'); await wait(800);
    assert.deepEqual((await tat(id)).warp, t2.warp, 'the whole slider pull is one undo step');
    await p.click('#redo'); await wait(800);

    // 4. Mirror keeps the shape; Done closes
    await p.evaluate(() => document.querySelector('#bFlip').click()); await wait(800);
    const t4 = await tat(id); assert.ok(t4.flip !== t3.flip && JSON.stringify(t4.warp) === JSON.stringify(t3.warp), 'Mirror keeps the warp');
    const ink4 = await ink(id); assert.ok(ink4 && ink4.area > ink0.area * 0.6, 'a mirrored warp is still on the skin');
    await p.evaluate(() => document.querySelector('#bFlip').click()); await wait(600);
    await p.click('#warpDone'); await wait(600);
    assert.equal((await rect('#warpBar')).vis, false, 'Done closes the bar');
    assert.equal((await p.$$eval('#warpPts .wpt', (b) => b.length)), 0, 'and the dots');
    assert.notEqual(await p.$eval('#dock', (e) => getComputedStyle(e).visibility), 'hidden', 'the sheet is back');
    assert.equal(await p.$eval('#bWarp', (e) => e.classList.contains('has-warp') && e.getAttribute('aria-pressed') === 'false'), true, 'the tile shows it is warped');
  }

  // 5. through a reload, and nothing added to other tattoos
  const kept = (await tat(id)).warp;
  await wait(1500); await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(2000);
  assert.deepEqual((await tat(id)).warp, kept, 'the shape is kept after a reload');
  const others = await p.evaluate((id) => window.__ink.state().tattoos.filter((t) => t.id !== id && 'warp' in t).length, id);
  assert.equal(others, 0, 'no other tattoo got a warp');
  const shown = await p.evaluate((id) => window.__ink.inkOnSkin(id), id); assert.ok(shown && shown.area > 0, 'drawn warped after a reload');
  console.log('t155 warp ok');
}
