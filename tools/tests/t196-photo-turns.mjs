// On a photo of me at iPad sizes (QA batch 31). Turning the iPad used to leave the photo laid out
// for the old shape of the screen, cut off at the side and empty below, and on an iPad on its side
// picking a tattoo grew the controls along the bottom over most of the photo. Now the photo is laid
// out again whenever the screen changes, on its side the controls stand as a column at the left with
// the photo beside them, the photo never moves when a tattoo is picked, and the list of tattoos
// starts under the line at the top even when that line wraps on a phone.
import assert from 'node:assert/strict';
import fs from 'node:fs';

export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(800);
  // a photo of the plain body, front on
  await p.evaluate(() => { const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({ figure: 'male', muscle: 0.5, weight: 0.5, fit: {} }); I.commitTest();
    Object.assign(I.goal, { theta: 0, phi: 1.52, roll: 0, tx: 0, ty: 0.9, tz: 0, r: 4.6 }); Object.assign(I.cur, I.goal); I.redraw(); });
  const st = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important} #onPhoto canvas{visibility:hidden!important}' });
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 10000 }); await p.evaluate(() => window.__ink.redraw()); await wait(600);
  fs.writeFileSync('shots/t196-front.jpg', Buffer.from(await p.screenshot({ type: 'jpeg', quality: 92 })));
  await st.evaluate((s) => s.remove());
  await p.evaluate(async () => {
    const I = window.__ink, c = document.createElement('canvas'); c.width = 240; c.height = 240; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 240, 240); g.fillStyle = '#000'; g.fillRect(20, 20, 200, 200);
    for (const [o, n] of [[[0.1, 1.3, 2], 'Chest'], [[0.12, 0.72, 2], 'Thigh']]) { const h = I.surfaceAt(o, [0, 0, -1]); if (h) await I.addArt(c.toDataURL(), n, { pos: h.pos, normal: h.normal, width: 0.11 }); }
    I.commitTest();
  });
  await wait(400);
  await p.click('#lookBtn'); await wait(250);
  const [chooser] = await Promise.all([p.waitForFileChooser({ timeout: 5000 }).catch(() => null), p.click('#onPhotoBtn')]);
  if (chooser) await chooser.cancel();
  await (await p.$('#opFile')).uploadFile('shots/t196-front.jpg');
  await p.waitForFunction(() => { const s = window.__ink.onPhoto(); return s.photos.length === 1 && (s.photos[0].fit || s.photos[0].error) && document.querySelector('#opBusy').hidden && s.photos[0].layers; }, { timeout: 120000 });
  assert.ok(await p.evaluate(() => !!window.__ink.onPhoto().photos[0].fit), 'the photo is read');

  const look = () => p.evaluate(() => {
    const box = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const s = window.__ink.onPhoto(), v = s.view, ph = s.photos[0];
    const pic = box('#opPic'), bar = box('#opBar'), top = box('#opTop'), list = box('#opLayers');
    const picked = document.querySelector('#opPicked'), plainBarTop = bar.t + (picked.hidden ? 0 : picked.offsetHeight + 8);
    const inks = ph.layers.map((L) => { const x = v.L + (L.x + L.w / 2) * v.k, y = v.T + (L.y + L.h / 2) * v.k, e = document.elementFromPoint(x, y); return { name: L.name, x, y, onPhoto: !!(e && e.closest('#opStage')) }; });
    return { W: innerWidth, H: innerHeight, pic, bar, top, list, plainBarTop, inks, sel: s.sel, folded: document.querySelector('#opLayers').classList.contains('folded') };
  });
  const near = (a, b) => ['l', 't', 'r', 'b'].every((k) => Math.abs(a[k] - b[k]) < 1.5);
  const sizes = [[1180, 820], [820, 1180], [1133, 744], [744, 1133], [1366, 1024], [1180, 820]];
  for (const [w, h] of sizes) {
    await p.setViewport({ width: w, height: h, hasTouch: true, deviceScaleFactor: 1 }); await wait(700);
    const at = `${w}x${h}`, side = w > h && w >= 1000;
    let o = await look();
    assert.ok(o.pic.l >= -1 && o.pic.r <= w + 1 && o.pic.t >= -1 && o.pic.b <= h + 1, `${at}: the photo fits the screen after it turns (${JSON.stringify(o.pic)})`);
    assert.ok(Math.max(o.pic.r - o.pic.l, o.pic.b - o.pic.t) > Math.min(w, h) * 0.6, `${at}: the photo fills the room it has`);
    if (side) {
      assert.ok(o.bar.r <= o.pic.l + 1, `${at}: on its side the controls stand beside the photo (bar ${JSON.stringify(o.bar)}, photo ${JSON.stringify(o.pic)})`);
      assert.ok(o.bar.b <= h - 8, `${at}: the controls column is on screen`);
    } else assert.ok(o.plainBarTop >= o.pic.b - 1, `${at}: upright, the photo sits above the controls (bar top ${o.plainBarTop}, photo bottom ${o.pic.b})`);
    assert.ok(o.list.t >= o.top.b, `${at}: the list of tattoos starts under the line at the top`);
    if (o.folded) for (const k of o.inks) assert.ok(k.onPhoto, `${at}: ${k.name} is not under a panel (${k.x.toFixed(0)},${k.y.toFixed(0)})`);
    // picking a tattoo shows its controls and leaves the photo where it was
    const chest = o.inks.find((k) => k.name === 'Chest');
    await p.mouse.click(chest.x, chest.y); await wait(400);
    const o2 = await look();
    assert.ok(o2.sel, `${at}: a tap on the chest piece picks it`);
    assert.ok(near(o2.pic, o.pic), `${at}: the photo does not move when a tattoo is picked (${JSON.stringify(o.pic)} then ${JSON.stringify(o2.pic)})`);
    if (side) { const c2 = o2.inks.find((k) => k.name === 'Chest'); assert.ok(c2.onPhoto, `${at}: the picked piece is not under its own controls`); }
    assert.ok((await p.$$eval('#onPhoto button', (a) => a.filter((b) => b.checkVisibility()).map((b) => { const r = b.getBoundingClientRect(); return [b.id || b.textContent.trim(), r.width, r.height, r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1]; }))).every(([, bw, bh, on]) => bw >= 44 && bh >= 44 && on), `${at}: every button 44 pt and on screen`);
    await p.click('#opUnpick'); await wait(300);
    console.log(at, 'photo', JSON.stringify(o.pic), 'bar', JSON.stringify(o.bar));
    await p.screenshot({ path: `shots/t196-${at}.png` });
  }
  // a phone: the list opens folded and starts under the line at the top, which wraps there
  await p.setViewport({ width: 390, height: 844, hasTouch: true, deviceScaleFactor: 1 }); await wait(700);
  const ph = await look();
  assert.ok(ph.pic.r <= 391 && ph.pic.l >= -1, 'phone: the photo fits across');
  assert.ok(ph.list.t >= ph.top.b, `phone: the list starts under the line at the top (${ph.list.t} under ${ph.top.b})`);
  await p.keyboard.press('Escape'); await wait(400);
  assert.equal(await p.$eval('#onPhoto', (e) => e.hidden), true, 'Escape closes it');
}
