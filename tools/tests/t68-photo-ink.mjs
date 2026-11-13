// Your tattoos from a photo: photographs of the 3D body with ink on its chest (front) and upper
// back are used as the photos. Each tattoo is found, boxed and added back on the bare body as
// already on me, in the same place and at about the same size; tapping a box leaves it out; a
// back photo works; undo takes them off.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  // the chest sample stays; the arm one goes; a copy of the chest art goes on the upper back
  const setup = await p.evaluate(async () => {
    const I = window.__ink, s = I.state(), sun = s.tattoos.find((t) => /Sunburst/.test(t.name));
    I.loadState({ ...s, tattoos: [sun] });
    const spot = I.surfaceAt([-0.07, 1.22, -2], [0, 0, 1]);
    const back = await I.addArt(I.imageOf(sun.img), 'Back piece', { ...spot, width: 0.12 });
    I.commitTest();
    return { sun: { pos: sun.pos, width: sun.width }, back: { pos: back.pos, width: back.width } };
  });
  const snap = async (file, theta) => {
    await p.evaluate((th) => { const g = window.__ink.goal; Object.assign(g, { theta: th, phi: 1.55, roll: 0, tx: 0, ty: 1.12, tz: 0, r: 2.7 }); Object.assign(window.__ink.cur, g, { r: g.r + 0.05 }); }, theta);
    const style = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
    await wait(1500); await p.screenshot({ path: file }); await style.evaluate((s) => s.remove());
  };
  await snap('shots/t68-front.png', 0);
  await snap('shots/t68-back.png', Math.PI);
  // a bare body, the same shape
  await p.evaluate(() => { const I = window.__ink; I.loadState({ ...I.state(), tattoos: [] }); });
  const run = async (file) => {
    if (await p.$eval('#bodyMatch', (e) => e.hidden)) { await p.click('#bodyBtn'); await wait(200); }
    await (await p.$('#bodyPhotoFile')).uploadFile(file);
    await wait(300);
    await p.waitForFunction(() => { const b = window.__ink.bodyMatch(); return !b.busy && document.querySelector('#bmText').textContent.length > 20; }, { timeout: 120000 });
    return p.evaluate(() => window.__ink.bodyMatch());
  };
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // the front photo
  const f = await run('shots/t68-front.png');
  console.log('front ink', JSON.stringify(f.ink), await p.$eval('#bmText', (e) => e.textContent));
  assert.ok(f.ink && f.ink.pieces.length >= 1, 'a tattoo is found in the front photo');
  assert.equal(await p.$eval('#bmInk', (e) => e.hidden), false, 'the tattoo choices show');
  assert.ok((await p.$$eval('#bmInk button:not([hidden])', (a) => a.map((b) => b.getBoundingClientRect().height))).every((h) => h >= 44), 'buttons big enough');
  // tapping the box leaves it out, tapping again puts it back
  const tap = async (box) => p.evaluate(([x0, y0, x1, y1]) => { const c = document.querySelector('#bmPic'), r = c.getBoundingClientRect(); const x = r.left + ((x0 + x1) / 2) * r.width / c.width, y = r.top + ((y0 + y1) / 2) * r.height / c.height; c.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true })); }, box);
  await tap(f.ink.pieces[0]); assert.ok(!(await p.evaluate(() => window.__ink.bodyMatch().ink.on)).includes(0), 'left out');
  assert.match(await p.$eval('#bmInkAdd', (e) => e.textContent), f.ink.pieces.length > 1 ? /^Add (it|\d)/ : /Nothing picked/);
  await tap(f.ink.pieces[0]); assert.ok((await p.evaluate(() => window.__ink.bodyMatch().ink.on)).includes(0), 'back in');
  await p.screenshot({ path: 'shots/t68-found.png' });
  await p.click('#bmInkAdd');
  await p.waitForFunction(() => window.__ink.state().tattoos.length > 0 && document.querySelector('#bodyMatch').hidden, { timeout: 30000 });
  let ts = await p.evaluate(() => window.__ink.state().tattoos);
  console.log('added', JSON.stringify(ts.map((t) => [t.name, t.status, t.pos.map((v) => +v.toFixed(3)), +t.width.toFixed(3)])), 'want', JSON.stringify(setup.sun));
  const a = ts.find((t) => near(t.pos, setup.sun.pos) < 0.035);
  assert.ok(a, 'the chest tattoo lands where it was');
  assert.equal(a.status, 'existing'); assert.equal(a.locked, true); assert.match(a.name, /^From photo \d+$/);
  assert.ok(a.width > setup.sun.width * 0.7 && a.width < setup.sun.width * 1.4, `about the same size (${a.width.toFixed(3)} vs ${setup.sun.width})`);
  assert.match(await p.evaluate(() => document.querySelector('#toast')?.textContent || ''), /from your photo, as already on you/);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }); await wait(300);
  await p.screenshot({ path: 'shots/t68-added.png' });
  const count = ts.length;
  // the back photo
  const b = await run('shots/t68-back.png');
  console.log('back ink', JSON.stringify(b.ink));
  assert.ok(b.ink && b.ink.view === 'back' && b.ink.pieces.length >= 1, 'found in the back photo');
  assert.equal(await p.$eval('#bmMirror', (e) => e.hidden), true, 'no mirror choice for a back photo');
  await p.screenshot({ path: 'shots/t68-back-found.png' });
  await p.click('#bmInkAdd');
  await p.waitForFunction((n) => window.__ink.state().tattoos.length > n && document.querySelector('#bodyMatch').hidden, { timeout: 30000 }, count);
  ts = await p.evaluate(() => window.__ink.state().tattoos);
  console.log('added', JSON.stringify(ts.map((t) => [t.name, t.pos.map((v) => +v.toFixed(3)), +t.width.toFixed(3)])), 'want', JSON.stringify(setup.back));
  const bk = ts.find((t) => near(t.pos, setup.back.pos) < 0.035);
  assert.ok(bk, 'the back tattoo lands where it was');
  assert.ok(bk.width > setup.back.width * 0.7 && bk.width < setup.back.width * 1.4, `back about the same size (${bk.width.toFixed(3)} vs ${setup.back.width})`);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }); await wait(300);
  await p.screenshot({ path: 'shots/t68-back-added.png' });
  // one undo takes the back photo's tattoos off
  await p.click('#undo'); await wait(300);
  assert.equal(await p.evaluate(() => window.__ink.state().tattoos.length), count, 'undo takes them off');
  console.log('PASS t68 tattoos from a photo: found front and back, tap leaves one out, added as already on me in place, undo');
}
