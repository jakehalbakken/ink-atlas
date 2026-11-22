// t168 a bent tattoo on a limb: how far round it goes and Wrap it round read the flat file, so a long
// piece bent to half its width still said it went most of the way round, and Wrap it round made the
// flat file meet at the back, leaving the bent piece only half way round. Both now read the bent box.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const id = await p.evaluate(async () => {
    const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({});
    const c = document.createElement('canvas'); c.width = 800; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#556'; g.fillRect(0, 30, 800, 140); g.fillStyle = '#111'; for (let x = 0; x < 800; x += 60) g.fillRect(x, 40, 30, 120);
    const h = I.surfaceAt([2, 1.095, 0.175], [-1, 0, 0]); if (!h) return null;
    const t = await I.addArt(c.toDataURL('image/png'), 'band', { pos: h.pos, normal: h.normal, width: 0.1 });
    I.commitTest(); I.select(t.id); return t.id;
  });
  assert.ok(id, 'placed on the forearm');
  await wait(300);
  const tried = () => p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  const s0 = (await p.evaluate((i) => window.__ink.wrapShare(i), id)).share;
  const text0 = await p.$eval('#wrapText', (e) => e.textContent);
  assert.ok(s0 > 0.2, 'the flat piece reaches round: ' + s0);
  // bend it to half its width
  await p.evaluate((i) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, id);
  await wait(500);
  const s1 = (await p.evaluate((i) => window.__ink.wrapShare(i), id)).share;
  assert.ok(s1 < s0 * 0.8, `half the width reaches less far round: ${s0} then ${s1}`);
  const text1 = await p.$eval('#wrapText', (e) => e.textContent);
  assert.notEqual(text1, text0, 'the line under the name follows the bend: ' + text1);
  assert.ok(!(await tried()).includes('wrapBent'), 'not ticked before Wrap it round');
  // Wrap it round: the bent piece now meets itself at the back
  const u0 = await p.evaluate(() => window.__ink.undoLen());
  await p.$eval('#wrapFit', (e) => e.click()); await wait(400);
  const info = await p.evaluate((i) => ({ share: window.__ink.wrapShare(i).share, girth: window.__ink.girthHere(i), steps: window.__ink.undoLen(), t: window.__ink.state().tattoos.find((q) => q.id === i) }), id);
  assert.equal(info.steps - u0, 1, 'one undo step');
  assert.ok(Math.abs(info.t.width * 0.5 - info.girth) / info.girth < 0.03, `the bent width is the way round (${info.t.width * 0.5} vs ${info.girth})`);
  assert.ok(info.share > 0.85 && info.share < 1.15, 'the bent piece goes round: ' + info.share);
  assert.ok(/all the way round/.test(await p.$eval('#wrapText', (e) => e.textContent)), 'says it goes all the way round');
  assert.ok((await tried()).includes('wrapBent'), 'ticked in New to try');
  console.log('PASS t168 a bent tattoo wraps by its bent size: ' + s0.toFixed(2) + ' / ' + s1.toFixed(2) + ' / ' + info.share.toFixed(2));
}
