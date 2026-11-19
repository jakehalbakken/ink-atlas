// t132 select a piece and move it in Clean up: a mirrored design in two halves, tap one half to select just
// it, drag it further out (straight across), past the edge so the picture grows evenly and the tattoo's width
// grows with it (every piece keeps its real size on the body), one undo step a drag, two fingers size and
// turn it, flip and copy, Erase only inside the selection, a box and a lasso, Done saves a new version.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  const before = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(60, 50, 100, 100); g.fillRect(240, 50, 100, 100);
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'mirror pair.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, before);
  const t0 = (await st()).tattoos.at(-1);
  await p.evaluate(() => document.querySelector('#bCleanup').click());
  await p.waitForSelector('#ink-cleanup canvas'); await wait();
  await p.click('[data-mode=select]');
  assert.equal(await p.$eval('#ink-cleanup .ic-sec[data-for=select]', (s) => s.hidden), false, 'Select shows its settings');

  // pointer helpers in picture pixels
  await p.evaluate(() => {
    const stage = document.querySelector('#ink-cleanup .ic-work'); stage.setPointerCapture = () => {}; stage.releasePointerCapture = () => {}; stage.hasPointerCapture = () => false;
    window.__pic = (x, y) => { const c = document.querySelector('#ink-cleanup canvas'), r = c.getBoundingClientRect(); return [r.x + x * r.width / c.width, r.y + y * r.height / c.height]; };
    window.__fire = (type, id, [x, y], target = stage, extra = {}) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, clientX: x, clientY: y, isPrimary: id === 1, ...extra }));
    window.__drag = (id, from, to, steps = 8, target) => { const a = window.__pic(...from), b = window.__pic(...to); window.__fire('pointerdown', id, a, target); for (let i = 1; i <= steps; i++) window.__fire('pointermove', id, [a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps]); window.__fire('pointerup', id, b); };
  });
  const tap = (x, y) => p.evaluate((x, y) => { const q = window.__pic(x, y); window.__fire('pointerdown', 1, q); window.__fire('pointerup', 1, q); }, x, y);
  const canvas = () => p.$eval('#ink-cleanup canvas', (c) => [c.width, c.height]);
  const alpha = (x, y) => p.$eval('#ink-cleanup canvas', (c, x, y) => c.getContext('2d').getImageData(x, y, 1, 1).data[3], x, y);
  const info = () => p.$eval('[data-sel-info]', (n) => n.textContent);

  await tap(290, 100); await wait(100);
  assert.match(await info(), /Selected: /, 'a tap selects a piece');
  assert.equal(await p.$eval('canvas.ic-sel', (c) => c.style.display), 'block', 'the selection shows on the picture');
  // the right half only: 100 px of a 400 px picture
  const w = t0.width * (await p.evaluate(() => window.__ink.state().heightCm)) / 175 * 100 / 2.54;
  assert.match(await info(), new RegExp((w * 100 / 400).toFixed(2) + ' in'), 'its real size in inches: ' + await info());

  // Move it: drag 100 px right with a small wobble, which stays straight across
  await p.click('[data-action=tomove]'); await wait(100);
  assert.equal(await p.$eval('.ic-xbox', (n) => n.style.display), 'block', 'the transform box is round the selection');
  await p.evaluate(() => window.__drag(1, [290, 100], [390, 104]));
  await wait(100);
  assert.match(await p.$eval('[data-readout]', (n) => n.textContent), /^Moved [\d.]+ in right ·/, 'it says how far, in inches');
  assert.deepEqual(await canvas(), [400, 200], 'nothing grows until it is placed');
  const undoSteps = () => p.evaluate(() => !document.querySelector('[data-action=undo]').disabled);
  await p.click('[data-action=place]'); await wait(100);
  assert.deepEqual(await canvas(), [480, 200], 'past the edge: 40 px more on each side, the middle stays');
  assert.equal(await alpha(100 + 50, 100), 255, 'the left half has not moved on the picture');
  assert.equal(await alpha(40 + 240 + 50, 100), 0, 'where the right half was is clear');
  assert.equal(await alpha(40 + 340 + 50, 100), 255, 'the right half is 100 px further out');
  assert.equal(await alpha(40 + 340 + 50, 152), 0, 'and not lower (it kept straight)');

  // one undo step for the drag, and redo
  await p.click('[data-action=undo]'); await wait(100);
  assert.deepEqual(await canvas(), [400, 200], 'undo puts the picture back');
  assert.equal(await alpha(290, 100), 255);
  await p.click('[data-action=redo]'); await wait(100);
  assert.deepEqual(await canvas(), [480, 200], 'redo moves it again');
  assert.equal(await alpha(430, 100), 255);

  // two fingers on the piece size and turn it; Put it back undoes the lot in one go
  await p.click('[data-mode=move]'); await tap(430, 100); await wait(50);
  await p.evaluate(() => {
    const a = window.__pic(410, 100), b = window.__pic(450, 100);
    window.__fire('pointerdown', 1, a); window.__fire('pointerdown', 2, b);
    for (let i = 1; i <= 6; i++) { window.__fire('pointermove', 1, [a[0] - i * 3, a[1]]); window.__fire('pointermove', 2, [b[0] + i * 3, b[1]]); }
    window.__fire('pointerup', 1, [a[0] - 18, a[1]]); window.__fire('pointerup', 2, [b[0] + 18, b[1]]);
  });
  await wait(100);
  assert.match(await p.$eval('[data-readout]', (n) => n.textContent), /\(\d+%\)/, 'two fingers sized it: ' + await p.$eval('[data-readout]', (n) => n.textContent));
  assert.equal(await p.$eval('canvas.ic-float', (c) => c.style.display), 'block', 'the piece floats while it is being moved');
  await p.click('[data-action=putback]'); await wait(50);
  assert.match(await p.$eval('[data-readout]', (n) => n.textContent), /^Not moved/, 'Put it back');
  await p.click('[data-action=flipx]'); await wait(50);
  assert.match(await p.$eval('[data-readout]', (n) => n.textContent), /flipped across/, 'flip');
  await p.click('[data-action=flipx]'); await p.click('[data-action=place]'); await wait(50);
  assert.deepEqual(await canvas(), [480, 200], 'placing it where it was changes nothing');

  // with a selection, Erase only takes away what is selected
  await p.click('[data-mode=select]'); await tap(430, 100); await wait(50);
  await p.click('[data-mode=erase]'); await wait(50);
  assert.equal(await p.$eval('[data-hint-sel]', (n) => n.hidden), false, 'Erase says it keeps to the selection');
  await p.evaluate(() => window.__drag(1, [100, 100], [440, 100], 30));
  await wait(50);
  assert.equal(await alpha(150, 100), 255, 'the left half is untouched outside the selection');
  assert.equal(await alpha(430, 100), 0, 'the selected half is erased');
  await p.click('[data-action=undo]'); await wait(50);
  assert.equal(await alpha(430, 100), 255, 'one undo step');

  // a box adds, a lasso takes away, the keyboard selects everything and nudges
  await p.click('[data-mode=select]'); await p.keyboard.down('Control'); await p.keyboard.press('d'); await p.keyboard.up('Control');
  assert.match(await info(), /Nothing selected/, 'Cmd D clears');
  await p.evaluate(() => window.__drag(1, [90, 40], [220, 160]));
  assert.match(await info(), /Selected: /, 'a box selects');
  await p.evaluate(() => { const q = [[80, 30], [300, 30], [300, 175], [80, 175]].map((x) => window.__pic(...x)); document.querySelector('[data-value=lasso]').click(); document.querySelector('#ic-sel-op').value = 'subtract'; document.querySelector('#ic-sel-op').dispatchEvent(new Event('change')); window.__fire('pointerdown', 1, q[0]); for (const x of q.slice(1)) window.__fire('pointermove', 1, x); window.__fire('pointerup', 1, q[3]); });
  assert.match(await info(), /Nothing selected/, 'a lasso round it takes it away');
  await p.evaluate(() => { document.querySelector('#ic-sel-op').value = 'new'; document.querySelector('#ic-sel-op').dispatchEvent(new Event('change')); });
  await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control');
  await p.keyboard.press('v'); await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift'); await p.keyboard.press('ArrowLeft');
  assert.match(await p.$eval('[data-readout]', (n) => n.textContent), /right/, 'arrow keys nudge it');
  await p.keyboard.press('Enter'); await wait(50);
  await p.click('[data-action=undo]'); await wait(50);
  assert.equal(await alpha(100, 100), 255, 'nudges close together are one undo step');
  assert.equal(await alpha(99, 100), 0);

  // Done: a new version, the old artwork kept, the picture trimmed to its ink and the tattoo as wide as that
  // ink at the old scale (400 px of picture was t0.width), so each piece keeps its real size
  const box = await p.$eval('#ink-cleanup canvas', (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] >= 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x1 - x0 + 1, y1 - y0 + 1, c.width]; });
  assert(box[2] > 400, 'the picture grew past its edge: ' + box);
  await p.click('[data-action=apply]'); await wait(900);
  const t1 = (await st()).tattoos.find((t) => t.id === t0.id);
  assert.notEqual(t1.img, t0.img, 'new artwork');
  assert(Math.abs(t1.width / t0.width - box[0] / 400) < 1e-6, 'the width is the ink at the old scale: ' + t1.width / t0.width + ' vs ' + box[0] / 400);
  assert(Math.abs(t1.aspect - box[0] / box[1]) < 1e-6, 'aspect ' + t1.aspect);
  assert.equal(t1.anchor ? JSON.stringify(t1.anchor) : '', t0.anchor ? JSON.stringify(t0.anchor) : '', 'same spot on the body');
  assert((t1.versions || []).some((v) => v.img === t0.img), 'the earlier artwork is kept as a version');
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert(tried.includes('cleanupSelect') && tried.includes('cleanupMove'), 'New to try ticks both');
  await p.click('#undo'); await wait(300);
  const t2 = (await st()).tattoos.find((t) => t.id === t0.id);
  assert.equal(t2.img, t0.img); assert.equal(t2.width, t0.width, 'one undo on the body puts it all back');
  await p.screenshot({ path: 'shots/t132-select-move.png' });
  console.log('PASS t132 select and move in Clean up: tap a half, drag it out straight, the picture grows evenly and the tattoo with it, undo, two fingers, put back, flip, erase inside the selection, box and lasso, keys, Done keeps a version');
}
