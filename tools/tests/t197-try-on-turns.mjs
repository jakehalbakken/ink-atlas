// Try on with camera when the iPad turns (QA batch 31). The artwork was placed in screen pixels, so
// turning the iPad left it over different skin on the photo, or off the side of the screen. Now on a
// photo it stays on the same spot of the photo at the same size against it, and over the live camera
// it keeps its place on the screen in proportion; its middle is always on screen.
import assert from 'node:assert/strict';
import fs from 'node:fs';

export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d');
    const draw = () => { g.fillStyle = '#d9a888'; g.fillRect(0, 0, 1280, 720); }; draw(); setInterval(draw, 100);
    navigator.mediaDevices.getUserMedia = async () => c.captureStream(15);
  });
  // a photo, 1600 x 1200
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const g = c.getContext('2d'); g.fillStyle = '#d9a888'; g.fillRect(0, 0, 1600, 1200); g.fillStyle = '#c08060'; for (let i = 0; i < 16; i++) g.fillRect(i * 100, 0, 4, 1200); return c.toDataURL('image/png').split(',')[1]; });
  fs.writeFileSync('shots/t197-photo.png', Buffer.from(png, 'base64'));
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(300);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bTryOn', (e) => e.click()); await wait(1200);
  assert.equal(await p.$eval('#tryOn', (e) => e.hidden), false, 'Try on opens');
  await (await p.$('#toFile')).uploadFile('shots/t197-photo.png'); await wait(900);
  assert.equal(await p.$eval('#toPhoto', (e) => e.hidden), false, 'the photo shows');
  const art = () => p.evaluate(() => {
    const a = document.querySelector('#toArt').getBoundingClientRect(), ph = document.querySelector('#toPhoto'), W = innerWidth, H = innerHeight;
    const bw = ph.naturalWidth, bh = ph.naturalHeight, s = Math.max(W / bw, H / bh), ox = (W - bw * s) / 2, oy = (H - bh * s) / 2;
    const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
    return { x, y, w: a.width, W, H, src: [(x - ox) / s, (y - oy) / s], srcW: parseFloat(document.querySelector('#toArt').style.width) / s };
  });
  // move it towards the right of the photo with one finger
  const a0 = await art();
  const fire = (t, x, y) => p.evaluate(([t, x, y]) => document.querySelector('#toPhoto').dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, buttons: t === 'pointerup' ? 0 : 1 })), [t, x, y]);
  await fire('pointerdown', a0.x, a0.y); for (let i = 1; i <= 8; i++) await fire('pointermove', a0.x + 380 * i / 8, a0.y - 60 * i / 8); await fire('pointerup', a0.x + 380, a0.y - 60); await wait(200);
  const a1 = await art();
  assert.ok(a1.x > a0.x + 300, 'a finger moves it');
  for (const [w, h] of [[820, 1180], [1133, 744], [744, 1133], [1180, 820]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true, deviceScaleFactor: 1 }); await wait(600);
    const a = await art();
    assert.ok(a.x > 0 && a.x < w && a.y > 0 && a.y < h, `${w}x${h}: its middle is on screen (${a.x.toFixed(0)}, ${a.y.toFixed(0)})`);
    const visible = a.src[0] >= 0 && a.src[0] <= 1600;
    if (visible && Math.abs(a1.src[0] - 800) * Math.max(w / 1600, h / 1200) < w / 2 - 30) {
      assert.ok(Math.hypot(a.src[0] - a1.src[0], a.src[1] - a1.src[1]) < 3, `${w}x${h}: it stays on the same spot of the photo (${a.src.map((v) => v.toFixed(1))} vs ${a1.src.map((v) => v.toFixed(1))})`);
      assert.ok(Math.abs(a.srcW / a1.srcW - 1) < 0.01, `${w}x${h}: the same size against the photo`);
    }
  }
  const back = await art();
  assert.ok(Math.hypot(back.x - a1.x, back.y - a1.y) < 3, `back on its side, it is where it was (${back.x.toFixed(0)},${back.y.toFixed(0)} vs ${a1.x.toFixed(0)},${a1.y.toFixed(0)})`);
  // over the live camera: the same place on the screen in proportion, never off it
  await p.$eval('#toRetake', (e) => e.click()).catch(() => {}); await wait(600);
  if (!(await p.$eval('#toLive', (e) => e.hidden))) {
    const c0 = await art();
    await p.setViewport({ width: 820, height: 1180, hasTouch: true, deviceScaleFactor: 1 }); await wait(600);
    const c1 = await art();
    assert.ok(Math.abs(c1.x / 820 - c0.x / 1180) < 0.02 && Math.abs(c1.y / 1180 - c0.y / 820) < 0.02, `over the camera it keeps its place in proportion (${(c0.x / 1180).toFixed(2)} then ${(c1.x / 820).toFixed(2)})`);
  }
  await p.keyboard.press('Escape'); await wait(200);
  assert.equal(await p.$eval('#tryOn', (e) => e.hidden), true, 'Escape closes');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'project untouched');
  console.log('PASS t197 try on keeps the artwork on the same spot when the iPad turns');
}
