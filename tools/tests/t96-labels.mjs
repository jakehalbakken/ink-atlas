// Picture with sizes (Share): this view with each tattoo facing the camera labelled with its
// name and size beside it, labels kept apart and in the picture; ones facing away get none.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  await p.evaluate(() => { const i = window.__ink, s = i.state(), art = structuredClone(s.tattoos[0]);
    const a = i.surfaceAt([0.06, 1.32, 2], [0, 0, -1]), b = i.surfaceAt([-0.05, 1.2, 2], [0, 0, -1]), c = i.surfaceAt([0, 1.3, -2], [0, 0, 1]);
    s.tattoos = [{ ...art, id: 'la', name: 'Chest left', ...a, width: 0.06, aspect: 1, rot: 0, hidden: false, status: 'planned' }, { ...art, id: 'lb', name: 'Chest right', ...b, width: 0.05, aspect: 1.5, rot: 0, hidden: false, status: 'planned' }, { ...art, id: 'lc', name: 'Upper back', ...c, width: 0.1, aspect: 1, rot: 0, hidden: false, status: 'planned' }];
    i.commitTest(); });
  await p.evaluate(() => document.querySelector('#full').click()); await wait(1500);
  await p.evaluate(() => { document.querySelector('#share').hidden = false; });
  assert.ok(await p.$eval('#cLabels', (e) => e.getBoundingClientRect().height >= 44), 'card big enough');
  await p.click('#cLabels'); await wait(800);
  assert.equal(await p.$eval('#preview', (e) => e.hidden), false, 'preview shows');
  assert.equal(await p.$eval('#pvTitle', (e) => e.textContent), 'Picture with sizes');
  const L = await p.evaluate(() => window.__ink.labels());
  assert.deepEqual(L.map((x) => x.id).sort(), ['la', 'lb'], 'the two on the front, not the back: ' + JSON.stringify(L.map((x) => x.id)));
  const h = await p.evaluate(() => window.__ink.heightCm ? window.__ink.heightCm() : (window.__ink.state().heightCm || 175));
  const inch = (u) => (u * h / 1.75 / 2.54).toFixed(1);
  const la = L.find((x) => x.id === 'la');
  assert.equal(la.lines[0], 'Chest left'); assert.ok(la.lines[1].startsWith(`${inch(0.06)} × ${inch(0.06)} in (`), la.lines[1]);
  const [x, y] = [L[0], L[1]];
  assert.ok(!(x.x < y.x + y.w && x.x + x.w > y.x && x.y < y.y + y.h && x.y + x.h > y.y), 'labels apart');
  const dims = await p.evaluate(() => { const c = document.querySelector('#stage canvas'); return [c.width, c.height]; });
  for (const l of L) assert.ok(l.x >= 0 && l.y >= 0 && l.x + l.w <= dims[0] && l.y + l.h <= dims[1], 'inside the picture');
  // a label pixel is the dark label colour
  const px = await p.evaluate((l) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); res([...g.getImageData(l.x + 3, l.y + Math.round(l.h / 2), 1, 1).data]); }; im.src = document.querySelector('#pvImg').src; }), la);
  assert.ok(px[0] < 70 && px[1] < 70 && px[2] < 80, 'label drawn: ' + px);
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert.ok(tried.includes('labels'), 'ticks it');
  if (process.env.SAVE_PIC) { const fs = await import('node:fs'); const src = await p.$eval('#pvImg', (e) => e.src); fs.writeFileSync(process.env.SAVE_PIC, Buffer.from(src.split(',')[1], 'base64')); }
  console.log('PASS t96-labels: ' + L.map((l) => l.lines.join(' ')).join(' | '));
}
