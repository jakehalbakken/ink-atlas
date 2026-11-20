// t133 the box round a tattoo hugs its ink: a picture with lots of empty space round an off-centre design
// says so under its size and Trim to the ink cuts the picture to the ink in one undo step, with the ink
// staying exactly where it was on the skin and at the same size (plain, mirrored, upside down, turned, and on a linked
// copy on the other side); Clean up's Done trims the same way; an earlier version comes back at its own
// size and place.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  const before = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(240, 15, 100, 100); g.fillStyle = '#fff'; g.fillRect(270, 45, 40, 20); // off to the right and up, with a gap so it is not a plain box
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'padded.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, before);
  const id = (await st()).tattoos.at(-1).id;
  const get = async () => (await st()).tattoos.find((t) => t.id === id);
  const ink = (who = id) => p.evaluate((i) => window.__ink.inkOnSkin(i), who);
  await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id); await wait(300);
  // the ink must stay on the same skin at the same size, to within a couple of millimetres
  const same = (a, b, what) => {
    const d = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1], a.c[2] - b.c[2]);
    assert(d < 0.0025, `${what}: the ink stays where it was (moved ${(d * 1000).toFixed(1)} mm)`);
    assert(Math.abs(b.area / a.area - 1) < 0.08, `${what}: the ink keeps its size (area x${(b.area / a.area).toFixed(3)})`);
  };
  const trim = async (what) => {
    const t0 = await get(), i0 = await ink();
    assert.equal(await p.$eval('#trimRow', (n) => n.hidden), false, what + ': the panel says there is empty space');
    assert.match(await p.$eval('#trimText', (n) => n.textContent), /makes it read [\d.]+ × [\d.]+ in\. The ink is [\d.]+ × [\d.]+ in\./);
    await p.click('#bTrimInk').catch(async (e) => { console.log(what, await p.evaluate(() => JSON.stringify(document.querySelector('#bTrimInk').getBoundingClientRect()))); await p.screenshot({ path: 'shots/t133-fail.png' }); throw e; });
    await p.waitForFunction((i, img) => window.__ink.state().tattoos.find((t) => t.id === i).img !== img, { timeout: 8000 }, id, t0.img);
    await p.waitForFunction((i, img) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); return window.__ink.inkOnSkin(i) && t.img !== img; }, {}, id, t0.img); await wait(400);
    const t1 = await get(), i1 = await ink();
    assert(Math.abs(t1.width / t0.width - 0.25) < 1e-6, what + ': the width is the ink\'s width, a quarter of the picture: ' + t1.width / t0.width);
    assert(Math.abs(t1.aspect - 1) < 1e-6, what + ': the box is the ink\'s own shape: ' + t1.aspect);
    same(i0, i1, what);
    assert.equal(await p.$eval('#trimRow', (n) => n.hidden), true, what + ': nothing left to trim');
    assert((t1.versions || []).some((v) => v.img === t0.img && v.w === t0.width), what + ': the earlier picture is kept with its size');
    await p.click('#undo'); await wait(500);
    const t2 = await get(); assert.equal(t2.img, t0.img); assert.equal(t2.width, t0.width, what + ': one undo puts it back');
    assert.deepEqual(t2.pos, t0.pos);
    return { t0, i0 };
  };

  await trim('plain');
  // mirrored
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await wait(200);
  await p.click('#bFlip'); await wait(400); assert.equal((await get()).flip, true);
  await trim('mirrored');
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await p.click('#bFlip'); await wait(400);
  // upside down
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await p.click('#bFlipVertical'); await wait(400); assert.equal((await get()).imageTopDown, false);
  await trim('upside down');
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await p.click('#bFlipVertical'); await wait(400);
  // turned a good way round with the keyboard
  await p.evaluate(() => document.activeElement?.blur?.());
  for (let i = 0; i < 6; i++) await p.keyboard.press(']');
  await wait(400); assert.notEqual((await get()).rot || 0, 0, 'it turned');
  await trim('turned');

  // a mirrored, linked copy on the other side keeps its own ink in place too
  // off the middle of the body first, with the keyboard
  await p.evaluate(() => document.activeElement?.blur?.());
  for (let i = 0; i < 40 && Math.abs((await get()).pos[0]) < 0.07; i++) { await p.keyboard.down('Shift'); await p.keyboard.press('ArrowLeft'); await p.keyboard.up('Shift'); await wait(60); }
  assert(Math.abs((await get()).pos[0]) >= 0.07, 'moved off the middle: ' + (await get()).pos[0]);
  await wait(700);
  await p.$eval('#editorAdvanced', (d) => (d.open = true));
  const n0 = (await st()).tattoos.length;
  await p.click('#bOtherSide');
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, n0);
  const twin = (await st()).tattoos.at(-1).id;
  await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, twin); await wait(300);
  const twin0 = await ink(twin);
  // back to the first one and trim it: both share the artwork
  await p.click(`#ldList .ld-tat[data-id="${id}"]`); await wait(400);
  const before2 = await get();
  await p.waitForFunction(() => !document.querySelector('#trimRow').hidden, { timeout: 4000 });
  await p.click('#bTrimInk');
  await p.waitForFunction((i, img) => window.__ink.state().tattoos.find((t) => t.id === i).img !== img, { timeout: 8000 }, twin, before2.img); await wait(600);
  const tw = (await st()).tattoos.find((t) => t.id === twin);
  assert.equal(tw.img, (await get()).img, 'the linked copy takes the trimmed picture');
  same(twin0, await ink(twin), 'linked copy');
  await p.click('#undo'); await wait(500);

  // Clean up's Done trims to the ink, with the ink staying put; then bring the earlier version back
  const c0 = await get(), ci0 = await ink();
  await p.click('#bCleanup'); await p.waitForSelector('#ink-cleanup canvas'); await wait(300);
  await p.click('[data-mode=erase]').catch(() => {});
  // one small dab of erase so Done has something to keep
  await p.evaluate(() => {
    const stage = document.querySelector('#ink-cleanup .ic-work'); stage.setPointerCapture = () => {}; stage.releasePointerCapture = () => {};
    const c = document.querySelector('#ink-cleanup canvas'), r = c.getBoundingClientRect(), at = (x, y) => [r.x + x * r.width / c.width, r.y + y * r.height / c.height];
    const fire = (type, [x, y]) => stage.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1, clientX: x, clientY: y, isPrimary: true }));
    fire('pointerdown', at(290, 85)); fire('pointermove', at(292, 86)); fire('pointerup', at(292, 86));
  });
  await wait(200);
  await p.click('[data-action=apply]');
  await p.waitForFunction((i, img) => window.__ink.state().tattoos.find((t) => t.id === i).img !== img, { timeout: 8000 }, id, c0.img); await wait(600);
  const c1 = await get();
  assert(Math.abs(c1.width / c0.width - 0.25) < 1e-6, 'Done in Clean up trims the picture to the ink: ' + c1.width / c0.width);
  same(ci0, await ink(), 'Clean up');
  assert.equal(await p.$eval('#trimRow', (n) => n.hidden), true, 'nothing left to trim after Clean up');
  // the earlier, padded version comes back at its own width and place
  const k = (c1.versions || []).findIndex((v) => v.img === c0.img); assert(k >= 0, 'the padded picture is a version');
  assert.equal(c1.versions[k].w, c0.width); assert.deepEqual(c1.versions[k].pos, c0.pos);
  console.log('PASS t133 trim to the ink: padded art says so, Trim to the ink and Clean up Done cut the picture to the ink with the ink staying on the same skin at the same size (plain, mirrored, upside down, turned, linked copy on the other side), one undo step, the earlier picture kept with its size');
}
