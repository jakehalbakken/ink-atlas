// Match a photo of me: a front photo of the 3D body at a known shape, read back from a standard
// body, gives the same proportions (shoulders, chest, waist, hips, thighs, torso and legs) within
// a few per cent. Keep makes it one undo step, Put back restores, a photo with no one in it says
// so in plain words and changes nothing, Escape closes, and the photo is dropped on close.
import assert from 'node:assert/strict';
import { bodyMeasure } from '../../src/body-match.js';
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const std = { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} };
  const truth = { figure: 'male', muscle: 0.5, weight: 0.25, fit: { shoulders: 0.6, waist: -0.4, hips: 0.2, thighSize: -0.3, torsoLen: 0.3 } };
  // photograph the 3D body at the true shape, straight on, with nothing else on screen
  await p.evaluate((s) => window.__ink.setShape(s), truth);
  await p.evaluate(() => { const g = window.__ink.goal; Object.assign(g, { theta: 0, phi: 1.5, roll: 0, tx: 0, ty: 0.87, tz: 0, r: 4.3 }); Object.assign(window.__ink.cur, g, { r: 4.4 }); });
  const style = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important} #bmPic,#toArt{visibility:hidden!important}' });
  await wait(1500); await p.screenshot({ path: 'shots/t58-photo.png' }); await style.evaluate((s) => s.remove());
  await p.evaluate((s) => window.__ink.setShape(s), std); await wait(200);
  const tat = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos.map((t) => t.id)));
  // the button sits in Body and is big enough
  await p.click('#bodyBtn'); await wait(200);
  assert.ok(await p.$eval('#bodyPhotoBtn', (e) => e.getBoundingClientRect().height >= 44), 'button big enough');
  await (await p.$('#bodyPhotoFile')).uploadFile('shots/t58-photo.png');
  await p.waitForFunction(() => window.__ink.bodyMatch().fitted, { timeout: 90000 });
  assert.equal(await p.$eval('#bodyPop', (e) => e.hidden), true, 'Body panel steps aside');
  assert.ok((await p.$$eval('#bodyMatch button:not([hidden])', (a) => a.map((b) => b.getBoundingClientRect().height))).every((h) => h >= 44), 'buttons big enough');
  const fitted = await p.evaluate(() => { const s = window.__ink.state(); return { figure: s.figure, muscle: s.muscle, weight: s.weight, fit: { ...s.fit } }; });
  const want = bodyMeasure(truth), got = bodyMeasure(fitted), start = bodyMeasure(std);
  for (const k of Object.keys(want)) {
    const err = Math.abs(got[k] / want[k] - 1), was = Math.abs(start[k] / want[k] - 1);
    assert.ok(err < 0.07, `${k} matches the photo within 7% (${(err * 100).toFixed(1)}%)`);
    if (was > 0.04) assert.ok(err < was, `${k} moved towards the photo`);
  }
  await p.screenshot({ path: 'shots/t58-matched.png' });
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos.map((t) => t.id))), tat, 'tattoos kept');
  // Put back restores, then Done closes with nothing changed
  await p.click('#bmBack'); await wait(200);
  assert.equal(await p.evaluate(() => window.__ink.state().weight), 0.5, 'Put back restores');
  assert.equal(await p.$eval('#bmKeep', (e) => e.hidden), true);
  // a picture with no one in it: a plain sentence, nothing changes
  await (await p.$('#bodyPhotoFile')).uploadFile('public/pwa-512.png');
  await p.waitForFunction(() => !window.__ink.bodyMatch().busy && document.querySelector('#bmText').textContent.length > 20, { timeout: 60000 });
  assert.match(await p.$eval('#bmText', (e) => e.textContent), /could not find a person|whole body|top of your head/i);
  assert.equal(await p.evaluate(() => window.__ink.state().weight), 0.5, 'nothing changed');
  // fit again and Keep: one undo step puts the old body back
  await (await p.$('#bodyPhotoFile')).uploadFile('shots/t58-photo.png');
  await p.waitForFunction(() => window.__ink.bodyMatch().fitted, { timeout: 90000 });
  await p.click('#bmKeep'); await wait(300);
  assert.equal(await p.$eval('#bodyMatch', (e) => e.hidden), true, 'Keep closes');
  assert.equal(await p.$eval('#bmPic', (e) => e.width), 1, 'the photo is dropped');
  const kept = await p.evaluate(() => window.__ink.state().weight); assert.ok(kept < 0.45, 'kept the matched body ' + kept);
  await p.click('#undo'); await wait(300);
  assert.equal(await p.evaluate(() => window.__ink.state().weight), 0.5, 'undo puts the old body back');
  // Escape closes without keeping a fresh match
  await p.click('#bodyBtn'); await (await p.$('#bodyPhotoFile')).uploadFile('shots/t58-photo.png');
  await p.waitForFunction(() => window.__ink.bodyMatch().fitted, { timeout: 90000 });
  await p.keyboard.press('Escape'); await wait(200);
  assert.equal(await p.$eval('#bodyMatch', (e) => e.hidden), true, 'Escape closes');
  assert.equal(await p.evaluate(() => window.__ink.state().weight), 0.5, 'Escape keeps the old body');
  console.log('PASS t58 match a photo: proportions read back within 7%, put back, no person, keep and undo, Escape');
}
