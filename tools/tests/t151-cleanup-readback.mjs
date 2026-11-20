// Clean up on a big picture (2026-11-20 QA): the end of each Erase or Restore stroke, each slider change
// and each undo step read three full-size pictures back off the graphics chip (no willReadFrequently),
// which stutters on an iPad. Now every picture Clean up reads back in full is kept in memory. Opens Clean up
// on a 1600 x 1200 drawing, slides Background, erases, restores, uses the wand and undoes, and checks that
// no full-size read comes from a graphics-chip canvas, and that the work still lands (erase clears, undo
// brings it back).
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  await p.evaluate(() => {
    window.__gid = []; const o = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...a) {
      if (!window.__gidTest && a[2] * a[3] >= 1600 * 1200 * 0.9 && !this.getContextAttributes?.().willReadFrequently) window.__gid.push(this.canvas.width + 'x' + this.canvas.height);
      return o.apply(this, a);
    };
  });
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const g = c.getContext('2d');
    g.fillStyle = '#ece6d6'; g.fillRect(0, 0, 1600, 1200); g.strokeStyle = '#111'; g.lineWidth = 40; g.beginPath(); g.arc(800, 600, 400, 0, 7); g.stroke();
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'big rose.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction(() => [...document.querySelectorAll('#toast button')].some((b) => b.textContent === 'Clean it up'), { timeout: 8000 });
  await p.evaluate(() => [...document.querySelectorAll('#toast button')].find((b) => b.textContent === 'Clean it up').click());
  await p.waitForSelector('#ink-cleanup canvas'); await wait(800);
  await p.evaluate(() => { window.__gid = []; });
  const alpha = (fx, fy) => p.evaluate((fx, fy) => { window.__gidTest = true; const c = document.querySelector('#ink-cleanup canvas'); const v = c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data[3]; window.__gidTest = false; return v; }, fx, fy);
  const slide = (v) => p.evaluate((v) => { const s = document.querySelector('#ic-threshold'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  for (const v of [200, 215, 230, 190]) { await slide(v); await wait(150); }
  await wait(500);
  const box = await p.$eval('#ink-cleanup canvas', (c) => { const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  const ring = [0.5, 200 / 1200];
  assert.equal(await alpha(...ring), 255, 'the ring is there');
  const stroke = async (key) => {
    await p.keyboard.press(key); await wait(200);
    await p.mouse.move(box[0] + box[2] * 0.42, box[1] + box[3] * ring[1]); await p.mouse.down();
    for (let i = 0; i <= 20; i++) { await p.mouse.move(box[0] + box[2] * (0.42 + i * 0.008), box[1] + box[3] * ring[1]); await wait(16); }
    await p.mouse.up(); await wait(500);
  };
  await stroke('KeyE');
  assert.ok(await alpha(...ring) < 128, 'Erase took the ring away under the stroke');
  await stroke('KeyR');
  assert.ok(await alpha(...ring) > 128, 'Restore brought it back');
  await p.keyboard.press('KeyW'); await wait(200); await p.mouse.click(box[0] + box[2] * 0.5, box[1] + box[3] * 0.5); await wait(600);
  for (let i = 0; i < 3; i++) { await p.click('[data-action=undo]'); await wait(200); }
  const slow = await p.evaluate(() => window.__gid);
  assert.deepEqual(slow, [], 'full-size reads from graphics-chip canvases: ' + slow.join(', '));
  console.log('PASS t151 cleanup readback: sliding, erasing, restoring, the wand and undo read no full-size picture off the graphics chip');
}
