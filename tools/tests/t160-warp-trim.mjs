// t160 a bent or warped tattoo keeps its shape when its picture's frame changes: Trim to the ink and Clean up's
// Done cut a padded, warped picture to its ink, and the warp is moved into the new frame, so the ink stays on the
// same skin, the same size and bent the same way (plain, mirrored, upside down, and through Clean up).
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  const before = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(240, 15, 100, 100); g.fillStyle = '#fff'; g.fillRect(270, 45, 40, 20);
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'padded.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, before);
  const id = (await st()).tattoos.at(-1).id;
  const get = async () => (await st()).tattoos.find((t) => t.id === id);
  const ink = () => p.evaluate((i) => window.__ink.inkOnSkin(i), id);
  await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id); await wait(300);
  // bend the right of the picture, where the ink is, down and out
  const W = { n: 3, p: [0, 0, 0.5, 0, 1, 0.1, 0, 0.5, 0.5, 0.5, 1, 0.75, 0, 1, 0.5, 1, 1, 1.1] };
  const warp = async () => { await p.evaluate((i, w) => { window.__ink.state().tattoos.find((q) => q.id === i).warp = w; window.__ink.commitTest(); }, id, W); await wait(900); };
  const plain = await ink(); await warp(); const bent = await ink();
  assert(Math.abs(bent.area / plain.area - 1) > 0.05, 'the warp changes the ink: area x' + (bent.area / plain.area).toFixed(3));
  const same = (a, b, what) => {
    const d = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1], a.c[2] - b.c[2]);
    assert(d < 0.0012, `${what}: the bent ink stays where it was (moved ${(d * 1000).toFixed(1)} mm)`);
    assert(Math.abs(b.area / a.area - 1) < 0.035, `${what}: the bent ink keeps its size and shape (area x${(b.area / a.area).toFixed(3)})`);
  };
  const changed = async (img) => { await p.waitForFunction((i, im) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); return t.img !== im && window.__ink.inkOnSkin(i); }, { timeout: 8000 }, id, img); await wait(700); };
  const trim = async (what) => {
    const t0 = await get(), i0 = await ink();
    assert.equal(await p.$eval('#trimRow', (n) => n.hidden), false, what + ': offers Trim to the ink');
    await p.click('#bTrimInk'); await changed(t0.img);
    const t1 = await get();
    assert(t1.warp && t1.warp.n === 3, what + ': it is still bent');
    same(i0, await ink(), what);
    await p.click('#undo'); await wait(600);
    assert.deepEqual((await get()).warp, t0.warp, what + ': one undo puts the warp back');
  };
  await trim('plain');
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await wait(200);
  await p.click('#bFlip'); await wait(500); await trim('mirrored');
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await p.click('#bFlip'); await wait(400);
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await p.click('#bFlipVertical'); await wait(500); await trim('upside down');
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await p.click('#bFlipVertical'); await wait(500);

  // Clean up's Done trims a bent piece the same way
  const c0 = await get(), ci0 = await ink();
  await p.click('#bCleanup'); await p.waitForSelector('#ink-cleanup canvas'); await wait(300);
  await p.click('[data-mode=erase]').catch(() => {});
  await p.evaluate(() => {
    const stage = document.querySelector('#ink-cleanup .ic-work'); stage.setPointerCapture = () => {}; stage.releasePointerCapture = () => {};
    const c = document.querySelector('#ink-cleanup canvas'), r = c.getBoundingClientRect(), at = (x, y) => [r.x + x * r.width / c.width, r.y + y * r.height / c.height];
    const fire = (type, [x, y]) => stage.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1, clientX: x, clientY: y, isPrimary: true }));
    fire('pointerdown', at(60, 150)); fire('pointermove', at(62, 151)); fire('pointerup', at(62, 151)); // in the empty paper, so the ink itself is untouched
  });
  await wait(200); await p.click('[data-action=apply]'); await changed(c0.img);
  const c1 = await get();
  assert(Math.abs(c1.width / c0.width - 0.25) < 1e-6, 'Clean up trims the picture to the ink');
  assert(c1.warp, 'Clean up keeps it bent');
  same(ci0, await ink(), 'Clean up');
  await p.screenshot({ path: 'shots/t160-warp-trim.png' });
  console.log('PASS t160 a bent tattoo keeps its shape through Trim to the ink and Clean up (plain, mirrored, upside down), one undo step each');
}
