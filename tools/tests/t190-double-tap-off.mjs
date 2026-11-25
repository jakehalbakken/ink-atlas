// Double-tap for the full body is off unless turned on (2026-11-25, Jake: "I want to be able to turn off the double tap
// to full screen feature... I never use it, and I just get pissed every time I accidentally use it").
// Checks, at iPad landscape and portrait: a new device starts with it off, a double tap on empty space leaves a
// zoomed-in view alone and the hint does not offer it, Full body still goes to the whole body, Plan > On this device
// turns it on (44 pt, a switch, kept after a reload) and then a double tap goes to the whole body, and turning it off
// again sticks. Two-finger tap undo is checked in t157-quick-undo-pick.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const ready = () => p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 });
  await ready(); await p.evaluate(() => localStorage.removeItem('ia-dbl-full'));
  const send = (list) => p.evaluate((list) => { const c = document.querySelector('#stage canvas'); for (const [type, id, x, y] of list) c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 })); }, list);
  const cam = () => p.evaluate(() => { const g = window.__ink.goal; return ['r', 'theta', 'phi', 'roll'].map((k) => (+g[k]).toFixed(4)).join(); });
  // the goal the camera glides to changes at once; let the glide finish where it can (slow under a loaded headless run)
  const settle = async () => { await wait(600); await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }).catch(() => {}); await wait(300); };
  // a double tap on empty space, far from the body
  const dbl = async (w, h) => { const x = Math.round(w * 0.12), y = Math.round(h * 0.55); await send([['pointerdown', 7, x, y], ['pointerup', 7, x, y]]); await wait(140); await send([['pointerdown', 8, x, y], ['pointerup', 8, x, y]]); await settle(); };
  const zoomIn = async (w, h) => { const cx = w * 0.4, cy = h * 0.45; await send([['pointerdown', 1, cx - 60, cy], ['pointerdown', 2, cx + 60, cy], ['pointermove', 1, cx - 160, cy], ['pointermove', 2, cx + 160, cy], ['pointerup', 1, cx - 160, cy], ['pointerup', 2, cx + 160, cy]]); await settle(); };
  const fullCam = async () => { await p.click('#full'); await settle(); return cam(); };
  for (const [w, h] of [[1180, 820], [820, 1180]]) {
    const at = `${w}x${h}`;
    await p.setViewport({ width: w, height: h, hasTouch: true }); await p.reload({ waitUntil: 'load' }); await ready(); await wait(1200);
    if (w === 1180) {
      assert.equal(await p.evaluate(() => localStorage.getItem('ia-dbl-full')), null, `${at}: nothing stored on a new device`);
      assert.doesNotMatch(await p.$eval('#hint', (e) => e.textContent), /Double-tap/, `${at}: the hint does not offer it`);
    }
    const whole = await fullCam();
    await zoomIn(w, h); const close = await cam();
    assert.notEqual(close, whole, `${at}: the pinch zoomed in`);
    await dbl(w, h);
    assert.equal(await cam(), close, `${at}: a double tap leaves the view alone while it is off`);
    assert.equal(await fullCam(), whole, `${at}: Full body still goes to the whole body`);
    // turn it on in Plan > On this device
    await p.click('#projectsBtn'); await wait(500);
    const b = await p.$eval('#dblFull', (e) => { const r = e.getBoundingClientRect(); return { on: e.getAttribute('aria-checked'), role: e.getAttribute('role'), w: r.width, h: r.height, vis: e.checkVisibility() }; });
    assert.deepEqual([b.on, b.role, b.vis], ['false', 'switch', true], `${at}: an off switch in Plan`);
    assert.ok(b.w >= 44 && b.h >= 44, `${at}: 44 pt`);
    await p.click('#dblFull'); await wait(300);
    assert.equal(await p.$eval('#dblFull', (e) => e.getAttribute('aria-checked')), 'true', `${at}: it turns on`);
    assert.match(await p.$eval('#dblFullWord', (e) => e.textContent), /^On\./, `${at}: and says so`);
    assert.equal(await p.evaluate(() => localStorage.getItem('ia-dbl-full')), 'on', `${at}: kept on this device`);
    await p.click('#planMenu [data-close="planMenu"]'); await wait(500);
    assert.match(await p.$eval('#hint', (e) => e.textContent), /Double-tap empty space/, `${at}: the hint offers it once it is on`);
    // kept after a reload, and a double tap now goes to the whole body
    await p.reload({ waitUntil: 'load' }); await ready(); await wait(1200);
    await fullCam(); await zoomIn(w, h);
    assert.notEqual(await cam(), whole, `${at}: zoomed in again`);
    await dbl(w, h);
    assert.equal(await cam(), whole, `${at}: with it on, a double tap goes to the whole body`);
    // off again, and that sticks too
    await p.click('#projectsBtn'); await wait(500);
    assert.equal(await p.$eval('#dblFull', (e) => e.getAttribute('aria-checked')), 'true', `${at}: still on after the reload`);
    await p.click('#dblFull'); await wait(300);
    assert.equal(await p.evaluate(() => localStorage.getItem('ia-dbl-full')), 'off', `${at}: turned off`);
    await p.click('#planMenu [data-close="planMenu"]'); await wait(400);
  }
  // nothing about it in the project
  assert.ok(!/dbl/i.test(await p.evaluate(() => JSON.stringify(window.__ink.state()))), 'not saved in the project');
}
