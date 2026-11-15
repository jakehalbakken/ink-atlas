// In a mirror (Share): this view beside the same view flipped left to right, the way it looks when
// you check it in a mirror. The right half is the left half turned over; nothing else changes.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const goal0 = await p.evaluate(() => JSON.stringify(window.__ink.goal)), before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  await p.click('#shareBtn'); await wait(300);
  assert.ok(await p.$eval('#cMirror', (e) => e.getBoundingClientRect().height >= 44), 'big enough');
  await p.click('#cMirror');
  await p.waitForFunction(() => document.querySelector('#pvTitle').textContent === 'In a mirror' && document.querySelector('#pvImg').complete && document.querySelector('#pvImg').naturalWidth > 0, { timeout: 60000 });
  const r = await p.evaluate(() => {
    const img = document.querySelector('#pvImg'), c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const { W, H, pad, head } = window.__ink.mirror();
    const a = g.getImageData(pad, head, W, H).data, b = g.getImageData(W + pad * 2, head, W, H).data;
    let same = 0, flip = 0, n = 0;
    for (let y = 0; y < H; y += 7) for (let x = 0; x < W; x += 7) {
      const i = (y * W + x) * 4, j = (y * W + (W - 1 - x)) * 4;
      flip += Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]);
      same += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n++;
    }
    return { w: c.width, W, pad, flip: flip / n, same: same / n };
  });
  const b64 = await p.evaluate(() => document.querySelector('#pvImg').src.split(',')[1]); (await import('node:fs')).writeFileSync('shots/t112-mirror.png', Buffer.from(b64, 'base64'));
  console.log(JSON.stringify(r));
  assert.equal(r.w, r.W * 2 + r.pad * 3, 'two panels');
  assert.ok(r.flip < 1, 'the right panel is the left one flipped: ' + r.flip);
  assert.ok(r.same > r.flip + 1.5, 'and not simply the same picture: ' + r.same);
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('mirror')), 'ticked');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.goal)), goal0, 'view unchanged');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'project unchanged');
}
