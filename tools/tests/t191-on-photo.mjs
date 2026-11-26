// On a photo of me (Jake, 2026-11-25: "if I uploaded a photo of myself, it would apply the
// tattoos that we've already been working on onto the photo of myself"). Photos of the 3D body,
// with the lens written in the file the way a phone does, are read back: the body's pose and the
// camera are found from the picture alone, and the planned ink lands where the body's own render
// shows it, straight on and turned with the arms up. Two photos at once give Previous and Next;
// On my skin shows nothing for a planned piece; the project, the pose and the view are untouched;
// every button is 44 pt; Escape closes and the photos are dropped.
import assert from 'node:assert/strict';
import fs from 'node:fs';

// a JPEG with its 35 mm focal length in EXIF, the way a phone camera writes it
function withLens(jpeg, f35) {
  const le = true, t = new DataView(new ArrayBuffer(44));
  t.setUint16(0, 0x4949); t.setUint16(2, 42, le); t.setUint32(4, 8, le);
  t.setUint16(8, 1, le); t.setUint16(10, 0x8769, le); t.setUint16(12, 4, le); t.setUint32(14, 1, le); t.setUint32(18, 26, le); t.setUint32(22, 0, le);
  t.setUint16(26, 1, le); t.setUint16(28, 0xa405, le); t.setUint16(30, 3, le); t.setUint32(32, 1, le); t.setUint16(36, f35, le); t.setUint32(40, 0, le);
  const tiff = new Uint8Array(t.buffer), seg = Buffer.alloc(4 + 6 + tiff.length);
  seg.writeUInt16BE(0xffe1, 0); seg.writeUInt16BE(2 + 6 + tiff.length, 2); Buffer.from('Exif\0\0', 'binary').copy(seg, 4); Buffer.from(tiff).copy(seg, 10);
  return Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]);
}

export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  // the app's camera is 30 degrees top to bottom: as a 35 mm focal length on this screen
  const f35 = await p.evaluate(() => { const w = innerWidth, h = innerHeight, f = (h / 2) / Math.tan(15 * Math.PI / 180); return Math.round(f * 43.27 / Math.hypot(w, h)); });
  const hide = 'body *{visibility:hidden!important} canvas{visibility:visible!important} #onPhoto canvas{visibility:hidden!important}';
  const snap = async (name) => { const st = await p.addStyleTag({ content: hide }); await p.waitForFunction(() => window.__ink.settled() && window.__ink.pose().settled, { timeout: 10000 }); await p.evaluate(() => window.__ink.redraw()); await wait(600); const b = await p.screenshot({ type: 'jpeg', quality: 95 }); await st.evaluate((s) => s.remove()); fs.writeFileSync(`shots/t191-${name}.jpg`, withLens(Buffer.from(b), f35)); };
  const aim = (g) => p.evaluate((g) => { Object.assign(window.__ink.goal, g); Object.assign(window.__ink.cur, g); window.__ink.redraw(); }, g);
  await p.evaluate(() => { const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({ figure: 'male', muscle: 0.5, weight: 0.5, fit: {} }); I.commitTest(); });
  await wait(300);
  const shots = [
    { name: 'front', pose: null, view: { theta: 0, phi: 1.52, roll: 0, tx: 0, ty: 0.9, tz: 0, r: 4.6 } },
    { name: 'turned', pose: 'raisedBoth', view: { theta: 0.6, phi: 1.45, roll: 0, tx: 0, ty: 1.0, tz: 0, r: 5.2 } },
  ];
  // the plain body first, then the same with the ink, for where the ink truly is
  for (const s of shots) { await p.evaluate((k) => (k ? window.__ink.setPose(k) : window.__ink.setPose('neutral')), s.pose); await aim(s.view); await snap(s.name + '-plain'); }
  await p.evaluate(async () => {
    const I = window.__ink, c = document.createElement('canvas'); c.width = 240; c.height = 240; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 240, 240); g.fillStyle = '#000'; g.fillRect(20, 20, 200, 200); g.fillStyle = '#fff'; g.fillRect(80, 80, 80, 80);
    const url = c.toDataURL();
    for (const [o, d, w, n] of [[[0.1, 1.3, 2], [0, 0, -1], 0.13, 'Chest'], [[0.12, 0.72, 2], [0, 0, -1], 0.1, 'Thigh']]) { const h = I.surfaceAt(o, d); if (h) await I.addArt(url, n, { pos: h.pos, normal: h.normal, width: w }); }
    I.commitTest();
  });
  await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.state().tattoos.length), 2, 'two planned tattoos placed');
  for (const s of shots) { await p.evaluate((k) => window.__ink.setPose(k || 'neutral'), s.pose); await aim(s.view); await snap(s.name + '-ink'); }
  await p.evaluate(() => window.__ink.setPose('neutral')); await aim(shots[0].view); await wait(400);
  const before = await p.evaluate(() => ({ t: JSON.stringify(window.__ink.state().tattoos), pose: window.__ink.pose().key, cam: window.__ink.cam(), undo: window.__ink.undoLen() }));

  // it opens from Preview
  await p.click('#lookBtn'); await wait(250);
  assert.ok(await p.$eval('#onPhotoBtn', (e) => e.getBoundingClientRect().height >= 44), 'Preview line big enough');
  const [chooser] = await Promise.all([p.waitForFileChooser({ timeout: 5000 }).catch(() => null), p.click('#onPhotoBtn')]);
  if (chooser) await chooser.cancel();
  assert.equal(await p.$eval('#onPhoto', (e) => e.hidden), false, 'the photo screen opens');
  await (await p.$('#opFile')).uploadFile('shots/t191-front-plain.jpg', 'shots/t191-turned-plain.jpg');
  await p.waitForFunction(() => { const s = window.__ink.onPhoto(); return s.photos.length === 2 && s.photos.every((x) => x.fit || x.error) && document.querySelector('#opBusy').hidden; }, { timeout: 120000 });
  const st = await p.evaluate(() => window.__ink.onPhoto());
  for (const [i, s] of st.photos.entries()) { assert.ok(s.fit, `${shots[i].name}: read (${s.error || ''})`); console.log(shots[i].name, 'fit error', s.fit.error.toFixed(1), 'px', s.fit.view, 'fov', s.fit.camera.fov.toFixed(1)); }
  assert.match(st.text, /2 planned tattoos on your photo/);
  assert.ok(await p.$eval('#opNext', (e) => !e.hidden && !e.disabled), 'Next shows for two photos');
  assert.ok((await p.$$eval('#onPhoto button', (a) => a.filter((b) => b.getClientRects().length).map((b) => [b.id || b.textContent, b.getBoundingClientRect().height, b.getBoundingClientRect().width]))).every(([, h, w]) => h >= 44 && w >= 44), 'every button 44 pt');

  // where the ink lands, against where the body's own render shows it
  const measure = async (name, over) => {
    if (over !== (await p.$eval('#opClothes', (e) => e.getAttribute('aria-pressed') === 'true'))) { await p.click('#opClothes'); await wait(200); }
    const plain = fs.readFileSync(`shots/t191-${name}-plain.jpg`).toString('base64'), inked = fs.readFileSync(`shots/t191-${name}-ink.jpg`).toString('base64');
    return p.evaluate(async (a, b) => {
      const read = async (u) => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
      const A = await read(a), B = await read(b), L = window.__ink.onPhotoLayer(), w = L.w, h = L.h;
      if (A.width !== w || A.height !== h) return { size: [A.width, A.height, w, h] };
      const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const truth = new Uint8Array(w * h), pred = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) { truth[i] = lum(A.data, i * 4) - lum(B.data, i * 4) > 40 ? 1 : 0; pred[i] = lum(L.data, i * 4) < 150 ? 1 : 0; }
      const grow = (m, r) => { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) o[yy * w + xx] = 1; } return o; };
      const r = Math.round(Math.hypot(w, h) * 0.012), T = grow(truth, r), P = grow(pred, r);
      let nt = 0, np = 0, pin = 0, tin = 0, cx = [0, 0], px = [0, 0];
      for (let i = 0; i < w * h; i++) { if (truth[i]) { nt++; tin += P[i]; cx[0] += i % w; cx[1] += (i / w) | 0; } if (pred[i]) { np++; pin += T[i]; px[0] += i % w; px[1] += (i / w) | 0; } }
      return { nt, np, precision: np ? pin / np : 0, recall: nt ? tin / nt : 0, shift: np && nt ? Math.hypot(cx[0] / nt - px[0] / np, cx[1] / nt - px[1] / np) / Math.hypot(w, h) : 1 };
    }, plain, inked);
  };
  for (const [i, s] of shots.entries()) {
    if (i) { await p.click('#opNext'); await wait(500); }
    const m = await measure(s.name, true);
    console.log(s.name, 'ink pixels', m.nt, 'drawn', m.np, 'on target', m.precision?.toFixed(2), 'covered', m.recall?.toFixed(2), 'centre off', (m.shift * 100).toFixed(1) + '%');
    assert.ok(!m.size, 'the layer is the photo\'s size');
    assert.ok(m.nt > 500, `${s.name}: the ink shows in the photo`);
    assert.ok(m.precision > 0.6, `${s.name}: drawn ink lands on the real ink (${m.precision.toFixed(2)})`);
    assert.ok(m.recall > 0.6, `${s.name}: the real ink is covered (${m.recall.toFixed(2)})`);
    assert.ok(m.shift < 0.02, `${s.name}: the ink's middle is within 2% of the photo (${(m.shift * 100).toFixed(1)}%)`);
    const skin = await measure(s.name, false);
    console.log(s.name, 'bare skin only: drawn', skin.np, 'on target', skin.precision?.toFixed(2));
    await p.screenshot({ path: `shots/t191-${s.name}-screen.png` });
  }
  // On my skin: nothing, as both are planned; All brings them back
  await p.click('#opWhich [data-which="existing"]'); await wait(300);
  assert.match(await p.$eval('#opText', (e) => e.textContent), /No tattoos marked On my skin/);
  await p.click('#opWhich [data-which="all"]'); await wait(300);
  assert.match(await p.$eval('#opText', (e) => e.textContent), /2 tattoos on your photo/);
  // each tattoo is its own layer (Jake, 2026-11-25: "address each individual tattoo as a layer")
  const ph = () => p.evaluate(() => { const s = window.__ink.onPhoto(); return { L: s.photos[s.at].layers, sel: s.sel, view: s.view, text: s.text }; });
  let o = await ph();
  assert.deepEqual(o.L.map((L) => L.name).sort(), ['Chest', 'Thigh'], 'one layer a tattoo');
  assert.equal(await p.$$eval('#opLayersList .op-line', (a) => a.length), 2, 'a line a tattoo in the list');
  const scr = (L, fx = 0.5, fy = 0.5) => [o.view.L + (L.x + L.w * fx) * o.view.k, o.view.T + (L.y + L.h * fy) * o.view.k];
  const chest = () => o.L.find((L) => L.name === 'Chest'), thigh = () => o.L.find((L) => L.name === 'Thigh');
  // a drag that starts on the chest piece's ink picks it and moves it alone
  let [x, y] = scr(chest(), 0.2, 0.2);
  const under = await p.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) + (e.closest('#opStage') ? ' (on the photo)' : ' (NOT on the photo)') : 'nothing'; }, x, y);
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 30, y + 12, { steps: 6 }); await p.mouse.up(); await wait(250);
  o = await ph();
  const down = await p.evaluate(() => window.__ink.onPhoto().down);
  assert.equal(o.sel, chest().id, `the touched tattoo is picked (pressed at ${x.toFixed(0)},${y.toFixed(0)} over ${under}; chest box ${JSON.stringify([chest().x, chest().y, chest().w, chest().h])}, view ${JSON.stringify(o.view)}, pointer down ${JSON.stringify(down)})`);
  assert.ok(chest().nudge.x > 10 && Math.abs(thigh().nudge.x) < 1e-6, 'only the picked one moved');
  assert.match(o.text, /Chest picked/);
  assert.equal(await p.$eval('#opPicked', (e) => e.hidden), false, 'its own controls show');
  assert.equal(await p.$eval(`#opLayersList [data-layer="${chest().id}"]`, (e) => e.getAttribute('aria-pressed')), 'true', 'its line is marked');
  // keys size and turn the picked one only
  await p.keyboard.press('='); await p.keyboard.press(']'); await wait(150); o = await ph();
  assert.ok(chest().nudge.s > 1.04 && chest().nudge.r > 0.04 && thigh().nudge.s === 1, 'keys size and turn the picked one');
  // the eye hides one tattoo and the drawn ink drops it
  const dark = () => p.evaluate(() => { const L = window.__ink.onPhotoLayer(); let n = 0; for (let i = 0; i < L.w * L.h; i++) if (L.data[i * 4] < 150) n++; return n; });
  const both = await dark();
  await p.click(`#opLayersList [data-eye="${thigh().id}"]`); await wait(200); o = await ph();
  assert.ok(thigh().hidden, 'hidden from the list');
  assert.ok((await dark()) < both * 0.9, 'its ink is gone from the photo');
  assert.match(o.text, /1 planned tattoo on your photo|1 tattoo on your photo/);
  await p.click(`#opLayersList [data-eye="${thigh().id}"]`); await wait(200);
  // a tap away from every tattoo puts them back together, and a drag there moves both alike
  const ex = o.view.L + 8, ey = await p.evaluate(() => innerHeight / 2);
  await p.mouse.click(ex, ey); await wait(200); o = await ph();
  assert.equal(o.sel, null, 'a tap away unpicks');
  const before2 = o.L.map((L) => [L.nudge.x, L.nudge.y]);
  await p.mouse.move(ex, ey); await p.mouse.down(); await p.mouse.move(ex + 20, ey + 20, { steps: 5 }); await p.mouse.up(); await wait(200); o = await ph();
  const dx = o.L.map((L, i) => L.nudge.x - before2[i][0]);
  assert.ok(dx[0] > 5 && Math.abs(dx[0] - dx[1]) < 1e-6, 'with none picked, both move together');
  // a line in the list picks it; Hide it and Move all
  await p.click(`#opLayersList [data-layer="${thigh().id}"]`); await wait(150);
  assert.equal((await ph()).sel, thigh().id, 'a line picks its tattoo');
  assert.ok((await p.$$eval('#onPhoto button', (a) => a.filter((b) => b.getClientRects().length).map((b) => [b.id || b.className, b.getBoundingClientRect().height, b.getBoundingClientRect().width]))).every(([, h, w]) => h >= 44 && w >= 44), 'every button 44 pt with one picked');
  await p.click('#opUnpick'); await wait(150);
  assert.equal((await ph()).sel, null, 'Move all unpicks');
  // Line them up again puts every layer back
  assert.equal(await p.$eval('#opReset', (e) => e.hidden), false);
  await p.click('#opReset'); await wait(200); o = await ph();
  assert.ok(o.L.every((L) => L.nudge.x === 0 && L.nudge.y === 0 && L.nudge.s === 1 && L.nudge.r === 0), 'reset');
  await p.screenshot({ path: 'shots/t191-layers.png' });
  // a picture with no one in it says so in plain words
  await (await p.$('#opFile')).uploadFile('public/pwa-512.png');
  await p.waitForFunction(() => { const s = window.__ink.onPhoto(); return s.photos.length === 3 && (s.photos[2].fit || s.photos[2].error) && document.querySelector('#opBusy').hidden; }, { timeout: 60000 });
  assert.match(await p.$eval('#opText', (e) => e.textContent), /could not find you|shoulders and hips/i);
  // Escape closes, the photos go, and nothing in the project, the pose or the view changed
  await p.keyboard.press('Escape'); await wait(400);
  assert.equal(await p.$eval('#onPhoto', (e) => e.hidden), true, 'Escape closes');
  assert.deepEqual(await p.$$eval('#onPhoto canvas', (a) => a.map((c) => c.width)), [1, 1, 1, 1], 'the photos are dropped');
  assert.equal(await p.evaluate(() => window.__ink.onPhoto().photos.length), 0);
  const after = await p.evaluate(() => ({ t: JSON.stringify(window.__ink.state().tattoos), pose: window.__ink.pose().key, cam: window.__ink.cam(), undo: window.__ink.undoLen() }));
  assert.equal(after.t, before.t, 'tattoos untouched');
  assert.equal(after.pose, before.pose, 'pose put back');
  assert.equal(after.undo, before.undo, 'no undo step');
  assert.ok(after.cam.every((v, i) => Math.abs(v - before.cam[i]) < 1e-3), 'view put back');
  console.log('PASS t191 on a photo of me: pose and camera read from the photo, ink lands on the real ink straight on and turned, two photos, kinds, a layer a tattoo (pick, move alone, keys, hide, move all, list), no person, Escape, nothing changed');
}
