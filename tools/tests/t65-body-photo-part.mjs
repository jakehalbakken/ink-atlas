// Match a photo of me from part of the body: an upper-body photo of the 3D body (cut off at the
// thighs, like a mirror selfie) matches the chest, waist, hips and torso, says which parts it
// matched, and leaves weight and the legs as they were. Add another photo then builds on it: a
// photo of the back adds what it shows without undoing the first. Keep is one undo step.
import assert from 'node:assert/strict';
import { bodyMeasure } from '../../src/body-match.js';
import { relativeTo } from '../../src/body-photo.js';
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const std = { figure: 'male', muscle: 0.5, weight: 0.5, fit: {} };
  const truth = { figure: 'male', muscle: 0.5, weight: 0.5, fit: { shoulders: 0.4, chest: 0.5, waist: -0.6, hips: 0.3, torsoLen: 0.4 } };
  const snap = async (file, view) => {
    await p.evaluate((v) => { const g = window.__ink.goal; Object.assign(g, { roll: 0, tx: 0 }, v); Object.assign(window.__ink.cur, g, { r: g.r + 0.05 }); }, view);
    const style = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important} #bmPic,#toArt{visibility:hidden!important}' });
    await wait(1500); await p.screenshot({ path: file }); await style.evaluate((s) => s.remove());
  };
  // photograph the 3D body at the true shape: the upper body from the front, then the back
  await p.evaluate((s) => window.__ink.setShape(s), truth);
  await snap('shots/t65-upper.png', { theta: 0, phi: 1.55, ty: 1.28, tz: 0, r: 2.3 });
  await snap('shots/t65-back.png', { theta: Math.PI, phi: 1.55, ty: 1.2, tz: 0, r: 2.6 });
  await p.evaluate((s) => window.__ink.setShape(s), std); await wait(200);
  const shape = () => p.evaluate(() => { const s = window.__ink.state(); return { figure: s.figure, muscle: s.muscle, weight: s.weight, fit: { ...s.fit } }; });
  // the upper body photo
  await p.click('#bodyBtn'); await wait(200);
  await (await p.$('#bodyPhotoFile')).uploadFile('shots/t65-upper.png');
  await p.waitForFunction(() => { const b = window.__ink.bodyMatch(); return b.fitted || (!b.busy && document.querySelector('#bmText').textContent.length > 20); }, { timeout: 90000 });
  const text1 = await p.$eval('#bmText', (e) => e.textContent), read1 = await p.evaluate(() => window.__ink.bodyMatch().read);
  console.log('upper', JSON.stringify(read1), text1);
  assert.ok(await p.evaluate(() => window.__ink.bodyMatch().fitted), 'an upper body photo is used: ' + text1);
  assert.notEqual(read1.ref, 'height', 'read as part of the body');
  assert.ok(read1.parts.includes('waist') && read1.parts.includes('torso'), 'waist and torso read');
  assert.ok(!read1.parts.includes('legs') && !read1.parts.includes('thigh'), 'no legs read');
  assert.match(text1, /Matched your .*waist.*The rest is as it was/);
  const s1 = await shape();
  assert.equal(s1.weight, 0.5, 'weight left alone'); assert.ok(!s1.fit.thighSize && !s1.fit.thighLen && !s1.fit.shinLen && !s1.fit.legLen, 'legs left alone');
  const want = relativeTo(bodyMeasure(truth), read1.ref), got = relativeTo(bodyMeasure(s1), read1.ref), was = relativeTo(bodyMeasure(std), read1.ref);
  for (const k of read1.parts) {
    const err = Math.abs(got[k] / want[k] - 1), before = Math.abs(was[k] / want[k] - 1);
    console.log(k, 'was', (before * 100).toFixed(1) + '%', 'now', (err * 100).toFixed(1) + '%');
    assert.ok(err < 0.08, `${k} matches within 8% (${(err * 100).toFixed(1)}%)`);
    if (before > 0.04) assert.ok(err < before, `${k} moved towards the photo`);
  }
  // the panel's own picture only marks joints it saw, and the buttons are big enough
  assert.ok((await p.$$eval('#bodyMatch button:not([hidden])', (a) => a.map((b) => b.getBoundingClientRect().height))).every((h) => h >= 44), 'buttons big enough');
  assert.equal(await p.$eval('#bmAgain', (e) => e.textContent), 'Add another photo');
  // a second photo, of the back, builds on the first
  await (await p.$('#bodyPhotoFile')).uploadFile('shots/t65-back.png');
  await p.waitForFunction((t) => document.querySelector('#bmText').textContent !== t && !window.__ink.bodyMatch().busy && /Matched|could not|Face|Stand/.test(document.querySelector('#bmText').textContent), { timeout: 90000 }, text1);
  const text2 = await p.$eval('#bmText', (e) => e.textContent), read2 = await p.evaluate(() => window.__ink.bodyMatch().read);
  console.log('back', JSON.stringify(read2), text2);
  assert.match(text2, /^Matched/, 'the back photo is used: ' + text2);
  assert.equal(read2.view, 'back', 'seen as a back photo');
  assert.match(text2, /back/);
  const s2 = await shape();
  // nothing the back photo didn't read moves
  const moved = Object.keys({ ...s1.fit, ...s2.fit }).filter((k) => (s1.fit[k] || 0) !== (s2.fit[k] || 0));
  const allowed = { shoulders: 'shoulders', chest: 'chest', waist: 'waist', hips: 'hips', thighSize: 'thigh', torsoLen: 'torso', thighLen: 'legs', shinLen: 'legs' };
  for (const k of moved) assert.ok(read2.parts.includes(allowed[k]) || read2.ref === 'height', `${k} moved only because the back photo read it`);
  // Keep: one undo step back to the standard body
  await p.click('#bmKeep'); await wait(300);
  assert.equal(await p.$eval('#bodyMatch', (e) => e.hidden), true, 'Keep closes');
  await p.click('#undo'); await wait(300);
  assert.deepEqual((await shape()).fit, {}, 'undo puts the old body back');
  console.log('PASS t65 partial photos: upper body and back photos match what they show and build on each other');
}
