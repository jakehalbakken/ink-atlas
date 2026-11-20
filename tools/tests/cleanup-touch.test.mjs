// Every Clean up tool lands on the pixel under the finger: zoomed in, panned, inside a #viewport that is
// moved and scaled the way the iPad's visual viewport moves it, in portrait and landscape. Real touches
// (CDP), not synthetic events. Also checks each tool does its job: erase, magic wand + delete, crop box and
// crop, clone, remove background, an adjustment, and History going back to the start.
// Run: node tools/tests/cleanup-touch.test.mjs (set CHROME to a Chrome or headless shell)
import assert from 'node:assert/strict'; import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import puppeteer from 'puppeteer-core';
const server = createServer(async (q, r) => { try { r.setHeader('Content-Type', q.url === '/' ? 'text/html' : 'text/javascript'); r.end(q.url === '/' ? '<style>html,body{margin:0}</style><div id="viewport" style="position:fixed;inset:0;transform-origin:0 0"></div>' : await readFile(new URL('../../src' + q.url, import.meta.url))); } catch { r.statusCode = 404; r.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r)); let b;
const wait = (n = 60) => new Promise(r => setTimeout(r, n));
try {
  b = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => { if (m.text().startsWith('ERR')) console.log(m.text()); });
  for (const [name, W, H] of [['portrait', 820, 1180], ['landscape', 1180, 820]]) {
    await p.setViewport({ width: W, height: H, hasTouch: true, isMobile: false });
    await p.goto(`http://127.0.0.1:${server.address().port}`);
    // the iPad zoomed in a little: #viewport is moved and scaled to fit what is on screen
    await p.evaluate(async () => {
      const vp = document.querySelector('#viewport'); vp.style.transform = 'translate(36px, 24px) scale(0.86)';
      window.m = await import('/cleanup.js');
      // 400 x 300: a green border 24 px wide round a red left half and a blue right half
      const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d');
      g.fillStyle = 'rgb(0,160,0)'; g.fillRect(0, 0, 400, 300); g.fillStyle = 'rgb(220,20,20)'; g.fillRect(24, 24, 176, 252); g.fillStyle = 'rgb(20,40,220)'; g.fillRect(200, 24, 176, 252);
      window.edit = m.editArtwork(c.toDataURL(), undefined, undefined, { tool: 'erase' }); window.edit.catch(e => console.log('ERR ' + e.message));
    });
    await p.waitForSelector('#ink-cleanup .ic-work canvas'); await wait(300);
    const view = '#ink-cleanup .ic-work canvas';
    const screenOf = (x, y) => p.$eval(view, (c, x, y) => { const r = c.getBoundingClientRect(); return { x: r.left + x * r.width / c.width, y: r.top + y * r.height / c.height }; }, x, y);
    const px = (x, y) => p.$eval(view, (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data], x, y);
    const size = () => p.$eval(view, c => [c.width, c.height]);
    const tool = async m => { await p.click(`[data-mode=${m}]`); await wait(); };
    const setSlider = (id, v) => p.$eval(id, (n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v).then(() => wait(120));
    const tap = async q => { await p.touchscreen.tap(q.x, q.y); await wait(); };
    const drag = async (a, z, steps = 8) => { await p.touchscreen.touchStart(a.x, a.y); for (let i = 1; i <= steps; i++) { await p.touchscreen.touchMove(a.x + (z.x - a.x) * i / steps, a.y + (z.y - a.y) * i / steps); } await p.touchscreen.touchEnd(); await wait(); };
    const near = (a, b, tol, what) => assert(Math.abs(a - b) <= tol, `${name}: ${what} (${a.toFixed(2)} vs ${b.toFixed(2)})`);

    // zoom in and pan, so the picture is neither at 100% nor centred
    await p.click('[data-action=zoomin]'); await p.click('[data-action=zoomin]'); await wait(100);
    await tool('adjust'); const mid = await screenOf(200, 150); await drag(mid, { x: mid.x - 30, y: mid.y - 20 });
    assert.notEqual(await p.$eval(view, c => c.style.transform), 'translate(0px, 0px) scale(2.25)', name + ': panned');
    // every point the test touches is on screen inside the workspace
    const stageBox = await p.$eval('.ic-work', n => { const r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
    for (const [x, y] of [[60, 50], [260, 210], [300, 150], [100, 150], [110, 120]]) { const q = await screenOf(x, y); assert(q.x > stageBox.l && q.x < stageBox.r && q.y > stageBox.t && q.y < stageBox.b, `${name}: (${x}, ${y}) is on screen`); }

    // Erase: a small hard brush tapped on one pixel clears it and nothing a few brush widths away
    await tool('erase'); await setSlider('#ic-brush', 8); await setSlider('#ic-feather', 0); await setSlider('#ic-opacity', 100);
    const e = await screenOf(110.5, 120.5);
    await p.touchscreen.touchStart(e.x, e.y); await wait();
    const ring = await p.$eval('.ic-ring', n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
    await p.touchscreen.touchEnd(); await wait();
    near(ring.x, e.x, 1.5, 'the brush ring is centred under the finger across'); near(ring.y, e.y, 1.5, 'the brush ring is centred under the finger down');
    near(ring.w, 8, 1, 'the ring is the brush size on screen');
    assert.equal((await px(110, 120))[3], 0, name + ': erase cleared the pixel under the finger');
    const k = await p.$eval(view, c => c.width / c.getBoundingClientRect().width);
    assert.equal((await px(110 + Math.ceil(16 * k), 120))[3], 255, name + ': pixels beside the brush are kept');
    await p.click('[data-action=undo]'); await wait(); assert.equal((await px(110, 120))[3], 255, name + ': undo brings it back');

    // Magic wand: a tap on the blue half selects only blue, Delete clears it
    await tool('wand'); await tap(await screenOf(300, 150));
    assert.match(await p.$eval('[data-sel-info]', n => n.textContent), /Selected/, name + ': the wand selected something: ' + await p.$eval('.ic-status', n => n.textContent));
    await p.click('[data-action=seldelete]'); await wait();
    assert.equal((await px(300, 150))[3], 0, name + ': blue under the finger deleted'); assert.equal((await px(250, 60))[3], 0, name + ': all the touching blue');
    assert.equal((await px(100, 150))[3], 255, name + ': red kept'); assert.equal((await px(10, 10))[3], 255, name + ': green kept');
    await p.click('[data-action=undo]'); await wait(); await p.click('[data-action=selnone]'); await wait();

    // Crop: the box drawn sits exactly between the two fingers' points, and Crop keeps that piece
    await tool('crop'); const c0 = await screenOf(60, 50), c1 = await screenOf(260, 210);
    await p.touchscreen.touchStart(c0.x, c0.y); for (let i = 1; i <= 8; i++) await p.touchscreen.touchMove(c0.x + (c1.x - c0.x) * i / 8, c0.y + (c1.y - c0.y) * i / 8);
    await wait(); // Chrome hands a move on at the next frame, so let the last one land before reading the box
    const box = await p.$eval('.ic-cropbox', n => { const r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
    await p.touchscreen.touchEnd(); await wait();
    near(box.l, c0.x, 1.5, 'crop box left edge at the first finger point'); near(box.t, c0.y, 1.5, 'crop box top at the first finger point');
    near(box.r, c1.x, 1.5, 'crop box right edge where the finger let go'); near(box.b, c1.y, 1.5, 'crop box bottom where the finger let go');
    await p.click('[data-action=crop]'); await wait(150);
    const [cw, ch] = await size(); near(cw, 200, 2, 'cropped width'); near(ch, 160, 2, 'cropped height');
    assert.deepEqual((await px(1, 1)).slice(0, 3), [220, 20, 20], name + ': the crop starts on red where the finger started');
    await p.click('[data-action=undo]'); await wait(150); assert.deepEqual(await size(), [400, 300], name + ': undo puts the crop back');

    // Clone: pick red as the source, paint on blue: the pixel under the finger turns red
    await tool('clone'); await setSlider('#ic-brush', 10); await setSlider('#ic-feather', 0);
    await tap(await screenOf(100, 150)); // first tap picks where to copy from
    const src = await p.$eval('.ic-src', n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }), s0 = await screenOf(100, 150);
    near(src.x, s0.x, 2, 'the copy-from cross sits where it was tapped'); near(src.y, s0.y, 2, 'the copy-from cross sits where it was tapped');
    await tap(await screenOf(300, 150));
    assert.deepEqual((await px(300, 150)).slice(0, 3), [220, 20, 20], name + ': cloned red onto blue under the finger');
    assert.deepEqual((await px(340, 150)).slice(0, 3), [20, 40, 220], name + ': blue beside it kept');
    await p.click('[data-action=undo]'); await wait();

    // Remove background: the green border goes, the design stays
    await tool('color'); await p.click('[data-action=bgremove]'); await wait(150);
    assert.equal((await px(5, 5))[3], 0, name + ': background removed'); assert.equal((await px(100, 150))[3], 255, name + ': red kept'); assert.equal((await px(300, 150))[3], 255, name + ': blue kept');

    // Adjust: brightness down darkens what is left, as one step
    await tool('adjust'); await p.click('[data-adj=light]'); await setSlider('#ic-bright', -50);
    assert((await px(100, 150))[0] < 200, name + ': brightness went down');

    // History lists the steps in words, and a tap on Opened goes all the way back
    await p.click('[data-action=history]'); await wait();
    const rows = await p.$$eval('[data-history-list] button', n => n.map(x => x.textContent));
    assert(rows[0].includes('Opened') && rows.some(r => r.includes('Background')) && rows.some(r => r.includes('Brightness')), name + ': history in words ' + rows.join(' | '));
    await p.click('[data-history-list] [data-go="0"]'); await wait(150);
    assert.equal((await px(5, 5))[3], 255, name + ': back to the start'); assert.deepEqual((await px(100, 150)).slice(0, 3), [220, 20, 20], name + ': colours as they opened');
    await p.keyboard.press('Escape'); await wait(); if (await p.$('.ic-confirm:not([hidden])')) await p.click('[data-action=discard]');
    assert.equal(await p.evaluate(() => edit), null, name + ': Cancel gives nothing back');
  }
  console.log('PASS touch lands on the pixel under the finger (zoomed, panned, scaled #viewport, portrait and landscape): erase and its ring, magic wand + delete, crop box and crop, clone source and paint, remove background, brightness, history back to the start');
} finally { await b?.close(); server.close(); }
