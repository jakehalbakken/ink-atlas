// Add an image in Clean up: a picture picked from the iPad (the rail button, through the real file chooser),
// pasted, or dropped comes in as a floating piece where the view is looking, moves under the finger, takes
// Opacity and Blend, goes into the picture with Place it, is one undo step, and a picture placed past the
// edge grows the picture so Done hands back a wider tattoo. Inside a #viewport moved and scaled the way the
// iPad's visual viewport moves it, at iPad portrait and landscape.
// Run: node tools/tests/cleanup-image.test.mjs (set CHROME to a Chrome or headless shell)
import assert from 'node:assert/strict'; import { createServer } from 'node:http'; import { readFile, writeFile, mkdtemp } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import { join } from 'node:path'; import puppeteer from 'puppeteer-core';
const server = createServer(async (q, r) => { try { r.setHeader('Content-Type', q.url === '/' ? 'text/html' : 'text/javascript'); r.end(q.url === '/' ? '<style>html,body{margin:0}</style><div id="viewport" style="position:fixed;inset:0;transform-origin:0 0"></div>' : await readFile(new URL('../../src' + q.url, import.meta.url))); } catch { r.statusCode = 404; r.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r)); let b;
const wait = (n = 60) => new Promise(r => setTimeout(r, n));
try {
  b = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => { if (m.text().startsWith('ERR')) console.log(m.text()); });
  // a 200 x 100 yellow picture on disk, to pick through the file chooser
  await p.goto(`http://127.0.0.1:${server.address().port}`);
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const g = c.getContext('2d'); g.fillStyle = 'rgb(255,255,0)'; g.fillRect(0, 0, 200, 100); return c.toDataURL('image/png').split(',')[1]; });
  const file = join(await mkdtemp(join(tmpdir(), 'ink-img-')), 'yellow.png'); await writeFile(file, Buffer.from(png, 'base64'));
  for (const [name, W, H] of [['portrait', 820, 1180], ['landscape', 1180, 820]]) {
    await p.setViewport({ width: W, height: H, hasTouch: true, isMobile: false });
    await p.goto(`http://127.0.0.1:${server.address().port}`);
    await p.evaluate(async () => {
      document.querySelector('#viewport').style.transform = 'translate(36px, 24px) scale(0.86)';
      window.m = await import('/cleanup.js');
      // 400 x 300: a green border round a red left half and a blue right half
      const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d');
      g.fillStyle = 'rgb(0,160,0)'; g.fillRect(0, 0, 400, 300); g.fillStyle = 'rgb(220,20,20)'; g.fillRect(24, 24, 176, 252); g.fillStyle = 'rgb(20,40,220)'; g.fillRect(200, 24, 176, 252);
      window.result = undefined; window.edit = m.editArtwork(c.toDataURL(), undefined, undefined, { tool: 'erase' }); window.edit.then(r => { window.result = r; }, e => console.log('ERR ' + e.message));
    });
    await p.waitForSelector('#ink-cleanup .ic-work canvas'); await wait(300);
    const view = '#ink-cleanup .ic-work canvas';
    const screenOf = (x, y) => p.$eval(view, (c, x, y) => { const r = c.getBoundingClientRect(); return { x: r.left + x * r.width / c.width, y: r.top + y * r.height / c.height }; }, x, y);
    const px = (x, y) => p.$eval(view, (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data], x, y);
    const size = () => p.$eval(view, c => [c.width, c.height]);
    const floatBox = () => p.$eval('canvas.ic-float', n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, shown: s.display !== 'none', opacity: +s.opacity, blend: s.mixBlendMode }; });
    const setSlider = (id, v) => p.$eval(id, (n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, v).then(() => wait(120));
    const near = (a, b, tol, what) => assert(Math.abs(a - b) <= tol, `${name}: ${what} (${a.toFixed?.(2) ?? a} vs ${b.toFixed?.(2) ?? b})`);
    const nearRGB = (got, want, tol, what) => want.forEach((v, i) => near(got[i], v, tol, `${what} channel ${i}`));
    const pick = async (sel = '.ic-tools [data-action=addimage]') => { const [chooser] = await Promise.all([p.waitForFileChooser({ timeout: 3000 }), p.click(sel)]); await chooser.accept([file]); await p.waitForFunction(() => getComputedStyle(document.querySelector('canvas.ic-float')).display !== 'none'); await wait(120); };

    // the rail has Add image under Move, 44 pt or more
    const rail = await p.$eval('.ic-tools [data-action=addimage]', n => { const r = n.getBoundingClientRect(), k = r.width / n.offsetWidth; return { text: n.textContent.trim(), h: r.height / k, prev: n.previousElementSibling?.dataset.mode }; });
    assert.equal(rail.text, 'Add image', name + ': rail button'); assert.equal(rail.prev, 'move', name + ': just under Move'); assert(rail.h >= 44, name + ': rail button is 44 pt');

    // pick it through the real file chooser: it comes up as a floating piece in Move, in the middle, at 60%
    await pick();
    assert.equal(await p.$eval('[data-mode=move]', n => n.getAttribute('aria-pressed')), 'true', name + ': Move is on');
    const f0 = await floatBox(), mid = await screenOf(200, 150), one = (await screenOf(1, 0)).x - (await screenOf(0, 0)).x;
    near(f0.x, mid.x, 2, 'the picture comes in where the view is looking, across'); near(f0.y, mid.y, 2, 'and down');
    near(f0.w, 240 * one, 2, 'at 60% of the picture (240 px wide)'); near(f0.h, 120 * one, 2, 'and 120 px high');
    assert.equal(await p.$eval('[data-layer]', n => n.hidden), false, name + ': Opacity and Blend show');
    assert.match(await p.$eval('[data-readout]', n => n.textContent), /added picture/, name + ': the readout names it');
    // the box handles sit on it: its top left corner handle at the picture's corner
    const tl = await p.$eval('.ic-xbox .h-tl', n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }), c0 = await screenOf(80, 90);
    near(tl.x, c0.x, 3, 'top left handle across'); near(tl.y, c0.y, 3, 'top left handle down');
    // a finger drag moves it the same distance on screen
    const a = { x: f0.x, y: f0.y }, z = { x: f0.x - 40, y: f0.y + 30 };
    await p.touchscreen.touchStart(a.x, a.y); for (let i = 1; i <= 8; i++) await p.touchscreen.touchMove(a.x + (z.x - a.x) * i / 8, a.y + (z.y - a.y) * i / 8); await p.touchscreen.touchEnd(); await wait();
    const f1 = await floatBox(); near(f1.x, z.x, 2.5, 'dragged across under the finger'); near(f1.y, z.y, 2.5, 'dragged down under the finger');
    await p.click('[data-action=putback]'); await wait();
    near((await floatBox()).x, mid.x, 2, 'Put it back returns it to where it came in');
    // Place it: yellow in the middle, red at the far left untouched
    await p.click('[data-action=place]'); await wait();
    assert.equal((await floatBox()).shown, false, name + ': placed, no longer floating');
    assert.deepEqual((await px(100, 150)).slice(0, 3), [255, 255, 0], name + ': yellow placed over red'); assert.deepEqual((await px(300, 150)).slice(0, 3), [255, 255, 0], name + ': and over blue');
    assert.deepEqual((await px(40, 150)).slice(0, 3), [220, 20, 20], name + ': red outside it kept');
    // each drag is its own undo step, as in Move; three undos (Put it back, the drag, Add image) take it all away
    await p.click('[data-action=undo]'); await wait(); assert((await floatBox()).shown, name + ': the first undo goes back to it floating where it was');
    await p.click('[data-action=undo]'); await wait(); await p.click('[data-action=undo]'); await wait();
    assert.deepEqual((await px(100, 150)).slice(0, 3), [220, 20, 20], name + ': undo takes the added picture out');
    assert.equal((await floatBox()).shown, false, name + ': and nothing is floating');

    // Blend: Multiply shows on screen and goes in that way (yellow times blue keeps the blue's dark, loses its blue)
    await p.click('[data-mode=erase]'); await wait(); await pick();
    await p.$eval('#ic-layer-blend', n => { n.value = 'multiply'; n.dispatchEvent(new Event('change', { bubbles: true })); }); await wait();
    assert.equal((await floatBox()).blend, 'multiply', name + ': multiply shows on screen');
    await p.click('[data-action=place]'); await wait();
    nearRGB(await px(300, 150), [20, 40, 0], 2, name + ': multiply over blue'); nearRGB(await px(100, 150), [220, 20, 0], 2, name + ': multiply over red');
    await p.click('[data-action=undo]'); await wait(); assert.equal((await floatBox()).blend, 'normal', name + ': undo goes back to before Blend, still floating');
    await p.click('[data-action=undo]'); await wait(); assert.equal((await floatBox()).shown, false, name + ': and the next undo before Add image');

    // Opacity: 50% shows on screen and goes in half way (one undo step for the slider go)
    await pick('.ic-sec [data-action=addimage]');
    const before = (await p.$$eval('[data-history-list] button', n => n.length).catch(() => 0));
    await setSlider('#ic-layer-opacity', 50);
    near((await floatBox()).opacity, 0.5, 0.01, 'half see-through on screen');
    assert.match(await p.$eval('[data-readout]', n => n.textContent), /50% opacity/, name + ': readout says 50% opacity');
    await p.click('[data-action=place]'); await wait();
    nearRGB(await px(100, 150), [237.5, 137.5, 10], 3, name + ': 50% yellow over red');
    await p.click('[data-action=history]'); await wait();
    const rows = await p.$$eval('[data-history-list] button', n => n.map(x => x.textContent));
    assert(rows.some(r => r.includes('Add image')) && rows.some(r => r.includes('Opacity')), name + ': history in words ' + rows.join(' | ')); void before;
    await p.click('[data-history-list] [data-go="0"]'); await wait(150); if (await p.$eval('.ic-history', n => !n.hidden)) await p.click('[data-action=history]'); await wait();
    assert.deepEqual((await px(100, 150)).slice(0, 3), [220, 20, 20], name + ': back to the start');

    // Paste (Command V on a keyboard): a copied picture comes in the same way, and the app's own paste does not see it
    const pasted = await p.evaluate(async () => {
      let appSaw = false; const spy = () => { appSaw = true; }; document.addEventListener('paste', spy);
      const c = document.createElement('canvas'); c.width = 50; c.height = 50; c.getContext('2d').fillRect(0, 0, 50, 50);
      const blob = await new Promise(r => c.toBlob(r, 'image/png')), dt = new DataTransfer(); dt.items.add(new File([blob], 'copied.png', { type: 'image/png' }));
      document.querySelector('#ink-cleanup').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 300)); document.removeEventListener('paste', spy);
      return { appSaw, shown: getComputedStyle(document.querySelector('canvas.ic-float')).display !== 'none' };
    });
    assert(pasted.shown, name + ': a pasted picture comes in'); assert.equal(pasted.appSaw, false, name + ': the app behind does not also take the paste');
    await p.click('[data-float-only][data-action=seldelete]'); await wait();
    assert.equal((await floatBox()).shown, false, name + ': Delete it throws the pasted picture away');

    // past the edge: dragged off the right side and placed, the picture grows and Done gives a wider tattoo
    await pick('.ic-sec [data-action=addimage]');
    const g0 = await floatBox(), right = (await screenOf(400, 150)).x;
    const to = { x: g0.x + (right - g0.x) + 20 * one, y: g0.y };
    await p.touchscreen.touchStart(g0.x, g0.y); for (let i = 1; i <= 10; i++) await p.touchscreen.touchMove(g0.x + (to.x - g0.x) * i / 10, g0.y); await p.touchscreen.touchEnd(); await wait();
    await p.click('[data-action=place]'); await wait(150);
    const [gw] = await size(); assert(gw > 400, name + ': the picture grew to fit it (' + gw + ')');
    await p.click('[data-action=apply]'); await p.waitForFunction(() => window.result !== undefined, { timeout: 5000 });
    const res = await p.evaluate(() => ({ widthScale: window.result?.widthScale, used: window.result?.used }));
    assert(res.widthScale > 1, name + ': Done hands back a wider tattoo (' + res.widthScale + ')'); assert(res.used.includes('image'), name + ': used says image');
  }
  console.log('PASS add an image in Clean up (file chooser from the rail, comes in at the middle, drag under the finger, handles on it, Place it, undo, Multiply, Opacity, history words, paste kept from the app, delete, past the edge grows and widens the tattoo), portrait and landscape inside a scaled viewport');
} finally { await b?.close(); server.close(); }
