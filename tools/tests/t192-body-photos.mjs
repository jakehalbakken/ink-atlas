// Match photos of me with several photos at once, one of them side on (Jake, 2026-11-25: "upload
// photos of myself and it would just start looking like me from different angles"). Photos of
// the 3D body made deeper front to back, straight on and from the side, are picked together:
// the side one moves the depth sliders towards the truth, the panel says it read both, and See
// my tattoos on these photos keeps the body and opens the same photos with the tattoos on them.
import assert from 'node:assert/strict';
import { bodyMeasure } from '../../src/body-match.js';
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const std = { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} };
  const truth = { figure: 'male', muscle: 0.5, weight: 0.5, fit: { depth: 0.7, belly: 0.6 } };
  await p.evaluate(async (s) => {
    const I = window.__ink; I.state().tattoos = []; I.setShape(s); I.setPose('relaxedSides');
    const c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 200); g.fillStyle = '#000'; g.beginPath(); g.arc(100, 100, 80, 0, 7); g.fill();
    const h = I.surfaceAt([0.1, 1.3, 2], [0, 0, -1]); if (h) await I.addArt(c.toDataURL(), 'Chest', { pos: h.pos, normal: h.normal, width: 0.1 });
    I.commitTest();
  }, truth);
  const hide = 'body *{visibility:hidden!important} canvas{visibility:visible!important} #bmPic,#toArt,#onPhoto canvas{visibility:hidden!important}';
  const snap = async (name, theta) => {
    await p.evaluate((t) => { const g = window.__ink.goal; Object.assign(g, { theta: t, phi: 1.5, roll: 0, tx: 0, ty: 0.87, tz: 0, r: 4.3 }); Object.assign(window.__ink.cur, g); }, theta);
    const st = await p.addStyleTag({ content: hide }); await wait(1500); await p.screenshot({ path: `shots/t192-${name}.png` }); await st.evaluate((s) => s.remove());
  };
  await snap('front', 0); await snap('side', Math.PI / 2);
  await p.evaluate((s) => { window.__ink.setShape(s); window.__ink.setPose('neutral'); }, std); await wait(300);
  const undo0 = await p.evaluate(() => window.__ink.undoLen());
  await p.click('#bodyBtn'); await wait(200);
  assert.match(await p.$eval('#bodyPhotoBtn', (e) => e.textContent), /Match photos of me/);
  assert.equal(await p.$eval('#bodyPhotoFile', (e) => e.multiple), true, 'several photos at once');
  await (await p.$('#bodyPhotoFile')).uploadFile('shots/t192-front.png', 'shots/t192-side.png');
  await p.waitForFunction(() => /Read 2 photos/.test(document.querySelector('#bmText').textContent) && !window.__ink.bodyMatch().busy, { timeout: 180000 });
  const text = await p.$eval('#bmText', (e) => e.textContent); console.log(text);
  assert.match(text, /from the side/, 'the side photo was read side on');
  const fitted = await p.evaluate(() => { const s = window.__ink.state(); return { figure: s.figure, muscle: s.muscle, weight: s.weight, fit: { ...s.fit } }; });
  console.log('fitted', JSON.stringify(fitted));
  const want = bodyMeasure(truth), got = bodyMeasure(fitted), was = bodyMeasure(std);
  for (const k of ['chestD', 'waistD']) {
    const err = Math.abs(got[k] / want[k] - 1), before = Math.abs(was[k] / want[k] - 1);
    console.log(k, 'was off', (before * 100).toFixed(1) + '%', 'now', (err * 100).toFixed(1) + '%');
    assert.ok(err < 0.08 && err < before, `${k} moved towards the photo (${(err * 100).toFixed(1)}%)`);
  }
  assert.ok(fitted.fit.depth > 0.2, 'deeper front to back');
  // See my tattoos on these photos keeps the body and opens both photos with the ink on them
  assert.equal(await p.$eval('#bmOnPhoto', (e) => e.hidden), false, 'offered');
  assert.match(await p.$eval('#bmOnPhoto', (e) => e.textContent), /these photos/);
  assert.ok((await p.$$eval('#bodyMatch button', (a) => a.filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect().height))).every((h) => h >= 44), 'buttons big enough');
  await p.click('#bmOnPhoto');
  await p.waitForFunction(() => { const s = window.__ink.onPhoto(); return s.photos.length === 2 && s.photos.every((x) => x.fit || x.error) && document.querySelector('#opBusy').hidden; }, { timeout: 120000 });
  assert.equal(await p.$eval('#bodyMatch', (e) => e.hidden), true, 'the match panel closes');
  assert.equal(await p.evaluate(() => window.__ink.undoLen()), undo0 + 1, 'the body is kept as one undo step');
  const st = await p.evaluate(() => window.__ink.onPhoto());
  console.log('on the photos', st.photos.map((x) => x.fit ? x.fit.error.toFixed(1) + ' px ' + x.fit.view : x.error).join(', '));
  assert.ok(st.photos[0].fit, 'the front photo shows the tattoos');
  assert.match(st.text, /1 planned tattoo on your photo/);
  await p.screenshot({ path: 'shots/t192-on-photo.png' });
  await p.keyboard.press('Escape'); await wait(300);
  assert.equal(await p.$eval('#onPhoto', (e) => e.hidden), true);
  await p.click('#undo'); await wait(300);
  assert.equal(await p.evaluate(() => (window.__ink.state().fit || {}).depth || 0), 0, 'undo puts the old body back');
  console.log('PASS t192 several photos at once: a side photo sets how deep the body is, then the tattoos on the same photos, one undo step');
}
