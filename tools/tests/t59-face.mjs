// Your face on the body: a front photo of the 3D head itself, used as the selfie, lines up with
// the head (the face points found in it match the stored ones, so the head barely changes shape),
// the face shows on the skin, it stays on this device only (not in the project), it comes back
// after a reload, Hide and Remove take it off, and a photo with no face says so in plain words.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  // photograph the 3D head straight on, with nothing else on screen
  await p.evaluate(() => {
    const P = window.__ink.positions(); let x = 0, y = 0, z = 0;
    for (let v = 13380; v < 13524; v++) { x += P[v * 3]; y += P[v * 3 + 1]; z += P[v * 3 + 2]; }
    Object.assign(window.__ink.goal, { theta: 0, phi: Math.PI / 2, roll: 0, tx: 0, ty: y / 144 - 0.035, tz: z / 144, r: 0.62 }); window.__ink.cur.r = 0.64;
  });
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 });
  const style = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
  await wait(300); await p.screenshot({ path: 'shots/t59-selfie.png' }); await style.evaluate((s) => s.remove());
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  const plain = await p.evaluate(() => Array.from(window.__ink.positions().slice(13380 * 3 - 3000, 13380 * 3)));
  // the controls sit in Body and are big enough
  await p.click('#bodyBtn'); await wait(200);
  assert.ok(await p.$eval('#faceBtn', (e) => e.getBoundingClientRect().height >= 44), 'button big enough');
  assert.equal(await p.$eval('#faceRow', (e) => e.hidden), true, 'no Hide or Remove before a face');
  await (await p.$('#faceFile')).uploadFile('shots/t59-selfie.png');
  await p.waitForFunction(() => window.__ink.face().saved && !window.__ink.face().busy, { timeout: 90000 });
  let f = await p.evaluate(() => window.__ink.face());
  assert.ok(f.on && f.stored, 'face on and kept on this device');
  assert.ok(f.alpha > 300, `face shows on the head (${f.alpha} vertices)`);
  // the head photographed is the head itself, so it should hardly change shape: the stored face
  // points and the ones found in the photo agree
  assert.ok(f.morph < 0.004, `head keeps its shape for its own photo (moved ${f.morph.toFixed(4)})`);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'the project is not changed: the face is not in it');
  assert.ok(await p.$$eval('#faceBtn, #faceRow button', (a) => a.length === 3 && a.every((b) => b.getBoundingClientRect().height >= 44 && b.scrollWidth <= b.clientWidth + 1)), 'Use another face photo, Hide and Remove: big enough, words fit');
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }); await wait(300);
  await p.screenshot({ path: 'shots/t59-face.png' });
  // Hide takes it off the skin and the shape goes back exactly
  await p.click('#faceShow'); await wait(200);
  f = await p.evaluate(() => window.__ink.face());
  assert.ok(f.saved && !f.on, 'hidden');
  assert.deepEqual(await p.evaluate(() => Array.from(window.__ink.positions().slice(13380 * 3 - 3000, 13380 * 3))), plain, 'hidden face leaves the standard head');
  assert.equal(await p.$eval('#faceShow', (e) => e.textContent), 'Show my face');
  await p.click('#faceShow'); await wait(200);
  assert.ok((await p.evaluate(() => window.__ink.face())).on, 'shown again');
  // a reload brings it back from this device
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready());
  await p.waitForFunction(() => window.__ink.face().saved && window.__ink.face().alpha > 300, { timeout: 30000 });
  // a photo with no face says so and keeps the face that was there
  await p.click('#bodyBtn'); await wait(200);
  await (await p.$('#faceFile')).uploadFile('public/pwa-512.png');
  await p.waitForFunction(() => /could not find a face/.test(document.querySelector('#toast')?.textContent || ''), { timeout: 60000 });
  assert.ok((await p.evaluate(() => window.__ink.face())).saved, 'earlier face kept');
  // Remove takes it off this device
  await p.click('#faceRemove'); await wait(200);
  f = await p.evaluate(() => window.__ink.face());
  assert.ok(!f.saved && !f.stored && f.alpha === 0, 'removed from the body and the device');
  assert.deepEqual(await p.evaluate(() => Array.from(window.__ink.positions().slice(13380 * 3 - 3000, 13380 * 3))), plain, 'standard head again');
  assert.equal(await p.$eval('#faceBtn', (e) => e.textContent), 'Add my face');
}
