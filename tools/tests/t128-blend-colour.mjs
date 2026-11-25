// Blend and colour: the edit sheet's Blend and colour opens a panel for the selected tattoo, a
// blend mode or a colour change shows on the body at once and is one undo step with its own
// words, it is saved and comes back after a reload, the Layers panel shows the mode's letter and
// opens the same panel, the layered PSD keeps the blend mode, New to try lists both features,
// and every control is at least 44 pt. The maths is in ink-look-unit.mjs.
import assert from 'node:assert/strict';
import { readPsd } from '../../src/psd.js';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const settled = () => p.waitForFunction(() => window.__ink && window.__ink.ready() && window.__ink.settled(), { timeout: 20000 });
  await settled(); await wait(800);
  const all = await p.evaluate(() => window.__ink.state().tattoos);
  const sun = all.find((t) => /Sunburst/.test(t.name)) || all[0];
  await p.evaluate((id) => window.__ink.select(id), sun.id); await wait(500); await settled();
  // ink darkness over a small grid round the tattoo's centre
  const ink = async () => p.evaluate((id) => {
    const s = window.__ink.viewSpot(id), c = window.__ink.projectPoint(s.pos); let sum = 0, n = 0;
    for (let dx = -12; dx <= 12; dx += 6) for (let dy = -12; dy <= 12; dy += 6) { const px = window.__ink.pixelAt(c.x + dx, c.y + dy); sum += px[0] + px[1] + px[2]; n++; }
    return sum / n;
  }, sun.id);
  const plain = await ink();
  await p.click('#bLook'); await p.waitForSelector('#inkLook:not([hidden])');
  assert.equal(await p.$eval('#lkName', (n) => n.textContent), sun.name, 'the panel is for the selected tattoo');
  const small = await p.$$eval('#inkLook button, #inkLook ink-slider, #inkLook .lk-switch, #inkLook .lk-pick', (els) => els.filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.dataset.blend || e.className, Math.min(r.width, r.height)]; }).filter(([, m]) => m < 44 - 0.01));
  assert.deepEqual(small, [], '44pt in the panel');
  const modes = await p.$$eval('#lkModes [data-blend]', (b) => b.map((x) => x.dataset.blend));
  for (const m of ['multiply', 'colorBurn', 'linearBurn', 'screen', 'overlay', 'softLight', 'hue', 'saturation', 'color', 'luminosity', 'difference']) assert.ok(modes.includes(m), 'offers ' + m);
  assert.equal(await p.$eval('#lkModes [data-blend=multiply]', (b) => b.getAttribute('aria-pressed')), 'true', 'multiply to start');
  await p.screenshot({ path: 'shots/t128-panel.png' });
  // a blend mode: live on the body, one undo step, its own words
  const undoBefore = await p.evaluate(() => window.__ink.undoLen());
  await p.click('#lkModes [data-blend=screen]'); await wait(500);
  let t = await p.evaluate((id) => window.__ink.state().tattoos.find((x) => x.id === id), sun.id);
  assert.equal(t.blend, 'screen');
  assert.equal(await p.evaluate(() => window.__ink.undoLen()), undoBefore + 1, 'one undo step');
  const screened = await ink(); assert.ok(screened > plain + 15, `screen lightens the ink: ${plain.toFixed(0)} to ${screened.toFixed(0)}`);
  await p.screenshot({ path: 'shots/t128-screen.png' });
  await p.click('#lkModes [data-blend=linearBurn]'); await wait(500);
  const burnt = await ink(); assert.ok(burnt < screened - 15, `linear burn darkens it again: ${burnt.toFixed(0)}`);
  await p.screenshot({ path: 'shots/t128-burn.png' });
  await p.click('#undo'); await wait(500);
  assert.match(await p.$eval('#toast', (n) => n.textContent), /blend mode of/, 'undo says what it put back');
  t = await p.evaluate((id) => window.__ink.state().tattoos.find((x) => x.id === id), sun.id); assert.equal(t.blend, 'screen', 'undo goes back one step');
  await p.click('#undo'); await wait(500);
  t = await p.evaluate((id) => window.__ink.state().tattoos.find((x) => x.id === id), sun.id); assert.equal(t.blend, undefined, 'back to multiply');
  assert.ok(Math.abs((await ink()) - plain) < 3, 'and the ink is as it was');
  // colours: a hue slider moves the colour live, invert is one tap; both are one undo step each
  const len = await p.evaluate(() => window.__ink.undoLen());
  await p.evaluate(() => { const s = document.querySelector('#lk-hue'); s.value = 90; s.dispatchEvent(new Event('input', { bubbles: true })); s.value = 120; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait(500);
  t = await p.evaluate((id) => window.__ink.state().tattoos.find((x) => x.id === id), sun.id);
  assert.equal(t.adjust && t.adjust.hue, 120, 'hue kept');
  assert.equal(await p.evaluate(() => window.__ink.undoLen()), len + 1, 'a slide is one undo step');
  await p.click('#lkInvert'); await wait(500);
  t = await p.evaluate((id) => window.__ink.state().tattoos.find((x) => x.id === id), sun.id); assert.equal(t.adjust.invert, true);
  const inverted = await ink(); assert.ok(inverted > plain + 15, `inverted dark ink is light: ${inverted.toFixed(0)}`);
  await p.screenshot({ path: 'shots/t128-invert.png' });
  await p.click('#undo'); await wait(400);
  assert.match(await p.$eval('#toast', (n) => n.textContent), /colours of/, 'undo names the colours');
  await p.click('#lkModes [data-blend=colorBurn]'); await wait(400);
  assert.equal(await p.$eval('#bLookMode', (n) => n.textContent), await p.evaluate((id) => { const t = window.__ink.state().tattoos.find((x) => x.id === id); return t ? 'Colour burn, hue +120°' : ''; }, sun.id), 'the edit sheet says what is set');
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert.ok(tried.includes('blendModes') && tried.includes('inkColours'), 'both tick themselves in New to try: ' + tried);
  // the Layers panel shows the letter and opens the panel
  await p.click('#lkDone'); await wait(300); assert.equal(await p.$eval('#inkLook', (n) => n.hidden), true, 'Done closes it');
  await p.evaluate(() => window.__ink.layersDock().setOpen(true)); await wait(400);
  const mode = await p.$eval(`#layersDock .ld-row[data-id="${sun.id}"] .ld-mode`, (b) => ({ text: b.textContent, label: b.getAttribute('aria-label'), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }));
  assert.equal(mode.text, 'CB'); assert.match(mode.label, /Colour burn/); assert.ok(mode.w >= 44 && mode.h >= 44, '44pt mode button');
  await p.click(`#layersDock .ld-row[data-id="${sun.id}"] .ld-mode`); await wait(400);
  assert.equal(await p.$eval('#inkLook', (n) => n.hidden), false, 'the letter opens Blend and colour');
  assert.equal(await p.$eval('#lkModes [data-blend=colorBurn]', (b) => b.getAttribute('aria-pressed')), 'true');
  await p.screenshot({ path: 'shots/t128-dock.png' });
  await p.click('#lkDone'); await wait(200);
  // the PSD keeps the blend mode on the tattoo's layer
  await p.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); window.saved = {}; const old = URL.createObjectURL; URL.createObjectURL = function (blob) { if (blob.name) window.saved[blob.askedAs||blob.name] = blob.arrayBuffer(); return old.call(this, blob); }; });
  await p.evaluate(() => window.__ink.select(null)); await wait(400); await settled();
  await p.click('#shareBtn'); await p.click('#cPsd');
  await p.waitForFunction(() => !!window.saved['ink-atlas-layers.psd'], { timeout: 120000 });
  const b64 = await p.evaluate(async () => { const u = new Uint8Array(await window.saved['ink-atlas-layers.psd']); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); });
  const psd = readPsd(Buffer.from(b64, 'base64'));
  const L = psd.layers.find((l) => l.name === sun.name); assert.ok(L, 'a layer for the tattoo: ' + psd.layers.map((l) => l.name));
  assert.equal(L.blend, 'idiv', 'the layer is Colour burn'); assert.ok(L.pixels[-1].some((v) => v > 0), 'with ink on it');
  await p.evaluate(() => document.querySelector('#share [data-close]')?.click()); await wait(200);
  // saved and back after a reload
  await p.evaluate(() => window.__ink.flush()); await wait(600);
  await p.reload(); await settled(); await wait(800);
  t = await p.evaluate((id) => window.__ink.state().tattoos.find((x) => x.id === id), sun.id);
  assert.equal(t.blend, 'colorBurn', 'blend kept after a reload'); assert.equal(t.adjust.hue, 120, 'colours kept after a reload');
  // New to try lists both with a working Show me
  await p.evaluate(() => document.querySelector('#newBtn').click()); await wait(300);
  for (const id of ['blendModes', 'inkColours']) assert.ok(await p.$(`#newList [data-feature=${id}] .btn`), id + ' listed');
  await p.click('#newList [data-feature=inkColours] .btn'); await wait(700);
  assert.equal(await p.$eval('#inkLook', (n) => n.hidden), false, 'Show me opens Blend and colour');
  assert.equal(await p.$eval('#pointRing', (n) => n.hidden), false, 'and rings the control');
  console.log('t128 blend and colour ok', { plain: Math.round(plain), screened: Math.round(screened), burnt: Math.round(burnt), inverted: Math.round(inverted) });
}
