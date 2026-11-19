// How I see it (Preview): My eyes puts the camera behind the body's own eyes and holds it to how
// far a head and eyes turn; What I can't see darkens the skin you need a mirror for and says how
// much of a tattoo you can see; Mirror selfie holds a phone at the chest and flips the picture
// like the photo. Nothing is saved, Done puts back the pose, the lens and the view, every button
// is 44 pt, and each look ticks itself in New to try. The visibility maths is in self-view-unit.mjs.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const settled = () => p.waitForFunction(() => window.__ink.settled() && window.__ink.pose().settled, { timeout: 20000 });
  await settled(); await wait(600);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  const ids = await p.evaluate(() => window.__ink.state().tattoos.filter((t) => !t.hidden).map((t) => t.id));
  assert.ok(ids.length > 0, 'the sample project has tattoos');
  const cam0 = await p.evaluate(() => window.__ink.self().cam);
  await p.click('#lookBtn'); await p.waitForSelector('#selfBtn');
  assert.equal(await p.$eval('#selfBtn', (b) => b.textContent.trim()), 'How I see it');
  await p.click('#selfBtn'); await wait(500);
  let s = await p.evaluate(() => window.__ink.self());
  assert.equal(s.mode, 'eyes', 'opens on My eyes');
  assert.equal(await p.$eval('#selfBar', (n) => n.hidden), false, 'its bar shows');
  assert.equal(await p.$eval('#lookMenu', (n) => n.hidden), true, 'the Preview menu closes');
  assert.ok(Math.hypot(...s.cam.map((v, i) => v - s.eye[i])) < 0.15 && s.cam[1] > 1.4, 'the camera is at the eyes: ' + s.cam.map((v) => v.toFixed(2)));
  assert.ok(s.look[1] < -0.3, 'looking down at the body: ' + s.look.map((v) => v.toFixed(2)));
  assert.ok(Math.abs(s.fov - 80) < 1e-6, 'a wide human view');
  assert.equal(await p.$eval('#dock', (n) => getComputedStyle(n).display), 'none', 'the tray steps aside');
  await p.screenshot({ path: 'shots/t128-eyes.png' });
  // a finger drag turns the head; it stops where a head and eyes stop
  const box = await p.$eval('canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(box.x, box.y); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(box.x + i * 20, box.y); await p.mouse.up(); await wait(200);
  const s2 = await p.evaluate(() => window.__ink.self());
  assert.ok(s2.yaw > 0.1 && s2.mode === 'eyes', 'dragging right turns to the left: ' + s2.yaw);
  assert.equal(await p.evaluate(() => window.__ink.selected()), null, 'a drag in My eyes never picks or moves a tattoo');
  await p.evaluate(() => window.__ink.selfDrag(99999, 0)); s = await p.evaluate(() => window.__ink.self());
  assert.ok(Math.abs(s.yaw - 125 * Math.PI / 180) < 1e-6, 'held to how far you can look round: ' + s.yaw);
  assert.ok(s.look[2] > -0.95, 'never straight behind you: ' + s.look.map((v) => v.toFixed(2)));
  await p.evaluate(() => window.__ink.selfDrag(0, -99999)); s = await p.evaluate(() => window.__ink.self());
  assert.ok(Math.abs(s.pitch - 105 * Math.PI / 180) < 1e-6, 'and how far down');
  await p.evaluate(() => window.__ink.selfPinch(0.5)); s = await p.evaluate(() => window.__ink.self());
  assert.ok(Math.abs(s.fov - 40) < 1e-6, 'a pinch zooms, down to a 40 degree view');
  await p.evaluate(() => { window.__ink.selfPinch(2); window.__ink.selfDrag(-99999, 0); window.__ink.selfDrag(0, 99999); window.__ink.selfDrag(0, -400); }); await wait(300);
  await p.screenshot({ path: 'shots/t128-eyes-down.png' });
  // What I can't see: a wash, a line for the tattoos, the view back on the orbit camera
  await p.click('#selfModes [data-self=seen]'); await wait(800);
  s = await p.evaluate(() => window.__ink.self());
  assert.equal(s.mode, 'seen'); assert.equal(s.washOn, true, 'the darker skin shows');
  assert.ok(Math.abs(s.fov - 30) < 1e-6 && Math.hypot(...s.cam.map((v, i) => v - cam0[i])) < 1e-3, 'the usual view and lens');
  assert.match(s.text, /can see/i, 'says what you can see: ' + s.text);
  const shares = await p.evaluate((ids) => ids.map((id) => window.__ink.self().share(id)), ids);
  assert.ok(shares.every((v) => v == null || (v >= 0 && v <= 1)), 'shares are fractions: ' + shares);
  await p.screenshot({ path: 'shots/t128-cant-see.png' });
  // tap a tattoo to read it
  const spot = await p.evaluate((id) => window.__ink.viewSpot(id), ids[0]);
  const at = await p.evaluate((pos) => window.__ink.projectPoint(pos), spot.pos);
  await p.evaluate((x, y) => window.__ink.selfTap(x, y), at.x, at.y); await wait(200);
  const name = await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).name, ids[0]);
  s = await p.evaluate(() => window.__ink.self());
  if (name) assert.ok(s.text.includes(name), 'a tap reads that tattoo: ' + s.text);
  assert.equal(await p.evaluate(() => window.__ink.selected()), null, 'and does not select it');
  // the back of the body is dark: turn round and look
  // Mirror selfie: the phone pose, flipped, a 3:4 frame and a picture to save
  await p.click('#selfModes [data-self=mirror]'); await wait(700); await settled();
  s = await p.evaluate(() => window.__ink.self());
  assert.equal(s.mode, 'mirror'); assert.equal(s.flip, 'scaleX(-1)', 'flipped like a mirror photo'); assert.equal(s.phone, true, 'a phone in the hand');
  assert.equal(s.washOn, false);
  const pose = await p.evaluate(() => window.__ink.pose()); assert.equal(pose.active, true); assert.equal(pose.key, 'custom', 'the phone-in-hand pose');
  assert.ok(s.hand[0] < -0.1 && s.hand[1] > 1.2 && s.hand[1] < 1.4 && s.hand[2] > 0.25, 'right hand at the chest, in front: ' + s.hand.map((v) => v.toFixed(2)));
  assert.ok(s.cam[2] > 1, 'the camera is out in front, in the mirror: ' + s.cam.map((v) => v.toFixed(2)));
  assert.equal(await p.$eval('#selfieFrame', (n) => n.hidden), false, 'the photo frame shows');
  await p.screenshot({ path: 'shots/t128-mirror.png' });
  await p.click('#selfHand [data-hand=L]'); await p.click('#selfHigh [data-high="1"]'); await wait(400);
  s = await p.evaluate(() => window.__ink.self());
  assert.ok(s.hand[0] > 0.1 && s.hand[1] > 1.4, 'left hand at the face: ' + s.hand.map((v) => v.toFixed(2)));
  await p.evaluate(() => window.__ink.selfDrag(-60, 0)); await wait(200);
  await p.screenshot({ path: 'shots/t128-mirror-face.png' });
  const pic = await p.evaluate(async () => { const u = window.__ink.selfiePicture(); const i = new Image(); i.src = u; await i.decode(); return { w: i.width, h: i.height, n: u.length }; });
  assert.ok(Math.abs(pic.w / pic.h - 0.75) < 0.01 && pic.n > 5000, 'a 3:4 picture: ' + JSON.stringify(pic));
  await p.click('#selfSave'); await wait(400);
  assert.equal(await p.$eval('#preview', (n) => n.hidden), false, 'Save picture opens it to save or share');
  await p.evaluate(() => { const b = document.querySelector('#preview [data-close], #pvClose'); if (b) b.click(); else document.querySelector('#preview').hidden = true; }); await wait(300);
  // every button in the bar is 44 pt
  const small = await p.$$eval('#selfBar .btn', (bs) => bs.filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.99 || r.height < 43.99).length);
  assert.equal(small, 0, '44 pt');
  // Done puts it all back
  await p.click('#selfDone'); await wait(600); await settled();
  s = await p.evaluate(() => window.__ink.self());
  assert.equal(s.mode, null); assert.equal(s.flip, ''); assert.equal(s.phone, false); assert.ok(Math.abs(s.fov - 30) < 1e-6 && Math.abs(s.near - 0.05) < 1e-9);
  assert.equal((await p.evaluate(() => window.__ink.pose())).active, false, 'the pose goes back');
  assert.ok(Math.hypot(...s.cam.map((v, i) => v - cam0[i])) < 1e-3, 'and the view');
  assert.equal(await p.$eval('#selfBar', (n) => n.hidden), true);
  assert.notEqual(await p.$eval('#dock', (n) => getComputedStyle(n).display), 'none', 'the tray is back');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'nothing saved changed');
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  for (const k of ['selfEyes', 'selfSeen', 'selfMirror']) assert.ok(tried.includes(k), 'ticks ' + k);
  // New to try lists all three with a working Show me
  await p.evaluate(() => { document.querySelector('#newBtn').click(); }); await wait(300);
  for (const k of ['selfEyes', 'selfSeen', 'selfMirror']) assert.ok(await p.$(`#newList [data-feature=${k}] .btn`), 'listed: ' + k);
  await (await p.$('#newList [data-feature=selfMirror] .btn')).click(); await wait(600);
  assert.equal(await p.$eval('#lookMenu', (n) => n.hidden), false, 'Show me opens Preview');
  assert.equal(await p.$eval('#pointRing', (n) => n.hidden), false, 'and rings How I see it');
  console.log('t128 how I see it ok');
}
