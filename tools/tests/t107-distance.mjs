// From a distance (Share): the selected tattoo in one view at four distances, each softer than
// the one before, with a line on how far its finest lines stay clear; Ink check says the same.
// The view, the project and the selection are left as they were.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const all = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
  const sun = all.find((t) => /Sunburst/.test(t.name)) || all[0];
  await (await p.$$('#trayItems .chip'))[all.indexOf(sun)].click(); await wait(400);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 });
  const goal0 = await p.evaluate(() => JSON.stringify(window.__ink.goal)), before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  await p.click('#shareBtn'); await wait(300);
  assert.ok(await p.$eval('#cDistance', (e) => e.getBoundingClientRect().height >= 44), 'big enough');
  await p.click('#cDistance');
  await p.waitForFunction(() => document.querySelector('#pvTitle').textContent === 'From a distance' && document.querySelector('#pvImg').complete && document.querySelector('#pvImg').naturalWidth > 0, { timeout: 60000 });
  const r = await p.evaluate(() => {
    const img = document.querySelector('#pvImg'), c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const L = window.__ink.distance(), { tile, pad, head, lab } = L;
    const detail = (i) => {
      const d = g.getImageData(pad + (i % 2) * (tile + pad), head + Math.floor(i / 2) * (tile + lab + pad), tile, tile).data; let s = 0;
      for (let y = 0; y < tile; y += 2) for (let x = 0; x < tile - 1; x++) { const o = (y * tile + x) * 4; s += Math.abs(d[o] - d[o + 4]) + Math.abs(d[o + 1] - d[o + 5]) + Math.abs(d[o + 2] - d[o + 6]); }
      return s / (tile * tile);
    };
    return { ...L, w: c.width, detail: [0, 1, 2, 3].map(detail) };
  });
  const b64 = await p.evaluate(() => document.querySelector('#pvImg').src.split(',')[1]); (await import('node:fs')).writeFileSync('shots/t107-distance.png', Buffer.from(b64, 'base64'));
  console.log(JSON.stringify({ detail: r.detail.map((v) => +v.toFixed(2)), shrinks: r.shrinks.map((v) => +v.toFixed(3)), line: r.line }));
  assert.equal(r.id, sun.id, 'the selected tattoo');
  assert.equal(r.w, r.tile * 2 + r.pad * 3, 'two tiles across');
  assert.equal(r.shrinks[0], 1, 'close up is sharp');
  for (let i = 1; i < 4; i++) assert.ok(r.shrinks[i] <= r.shrinks[i - 1], 'further is softer');
  assert.ok(r.shrinks[3] < 0.2, 'across the street loses a lot: ' + r.shrinks[3]);
  assert.ok(r.detail[3] < r.detail[0] * 0.7, 'the street tile has less detail than close up');
  assert.ok(r.detail[2] <= r.detail[1] + 0.01 && r.detail[3] <= r.detail[2] + 0.01, 'detail falls with distance');
  assert.ok(r.line && /^Its finest/.test(r.line) && !/NaN|undefined/.test(r.line), 'a plain line: ' + r.line);
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('distance')), 'ticked');
  // Ink check says it too
  await p.evaluate(() => { document.querySelector('#pvClose')?.click(); });
  await p.evaluate(() => { document.querySelector('#share').hidden = true; });
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bInkCheck', (e) => e.click());
  await p.waitForFunction(() => window.__ink.inkCheck() && window.__ink.inkCheck().items.length, { timeout: 30000 });
  const items = await p.evaluate(() => window.__ink.inkCheck().items);
  assert.ok(items.some((x) => /^Its finest/.test(x)), 'ink check has the distance line: ' + items.join(' | '));
  // nothing else changed
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.goal)), goal0, 'view unchanged');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'project unchanged');
  assert.equal(await p.evaluate(() => window.__ink.selected()), sun.id, 'still selected');
}
