// Paint the 3D body in Procreate, again and again (tray > Procreate): send the 3D body, paint
// its skin picture as Procreate would, pack it back up, bring it back. The paint lands on the
// same skin as paint (light colours too), follows a pose, goes back out with the next send,
// comes back whole after more painting, clears when the model comes back clean, can be
// hidden or turned into movable tattoos, and is kept in the project.
import assert from 'node:assert/strict';
import { bodyCornerUVs } from '../../src/uv-bake.js';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const before = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  const setup = () => p.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    window.saved = {}; const old = URL.createObjectURL;
    URL.createObjectURL = function (blob) { if (blob.name) window.saved[blob.name] = blob.arrayBuffer(); return old.call(this, blob); };
    window.toasts = []; new MutationObserver(() => { const t = document.querySelector('#toast').textContent; if (t) window.toasts.push(t); }).observe(document.querySelector('#toast'), { childList: true, subtree: true, characterData: true });
  });
  await setup();

  // the tray button opens the Procreate menu
  const btn = await p.$eval('#drawNew', (e) => [e.textContent, e.getBoundingClientRect().height]);
  assert.ok(btn[0] === 'Procreate' && btn[1] >= 44, 'Procreate button in the tray');
  await p.click('#drawNew'); await wait(200);
  for (const id of ['#pm3dSend', '#pm3dBack', '#pmSpot']) assert.ok(await p.$eval(id, (e) => e.getBoundingClientRect().height >= 44 && !e.closest('[hidden]')), id + ' shown, big enough');
  assert.equal(await p.$eval('#pmPaint', (e) => e.hidden), true, 'no paint yet');
  await p.screenshot({ path: 'shots/t72-menu.png' });

  const send = async () => {
    await p.evaluate(() => { delete window.saved['ink-atlas-model.usdz']; });
    if (await p.$eval('#pcMenu', (e) => e.hidden)) { await p.click('#drawNew'); await wait(200); }
    await p.click('#pm3dSend');
    await p.waitForFunction(() => !!window.saved['ink-atlas-model.usdz'] || window.toasts.some((x) => x.includes('Could not make')), { timeout: 120000 });
    assert.ok(await p.evaluate(() => !!window.saved['ink-atlas-model.usdz']), 'model sent');
  };
  await send();

  // what Procreate needs: one stored (uncompressed) USDZ, files aligned to 64 bytes, a usda first,
  // one mesh with texture coordinates in 0..1 and a colour picture wired to it, in metres
  const file = await p.evaluate(async () => {
    const b = new Uint8Array(await window.saved['ink-atlas-model.usdz']), dv = new DataView(b.buffer), out = [];
    let i = 0;
    while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) {
      const method = dv.getUint16(i + 8, true), len = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), x = dv.getUint16(i + 28, true), name = new TextDecoder().decode(b.subarray(i + 30, i + 30 + n)), s = i + 30 + n + x;
      const e = { name, method, start: s, len };
      if (/\.usda$/.test(name)) e.text = new TextDecoder().decode(b.subarray(s, s + len));
      if (/\.png$/.test(name)) { const img = await createImageBitmap(new Blob([b.slice(s, s + len)], { type: 'image/png' })); e.w = img.width; e.h = img.height; }
      out.push(e); i = s + len;
    }
    return out;
  });
  assert.ok(/\.usda$/.test(file[0].name), 'scene description first');
  for (const e of file) { assert.equal(e.method, 0, e.name + ' stored, not compressed'); assert.equal(e.start % 64, 0, e.name + ' aligned to 64 bytes'); }
  const usda = file.filter((e) => e.text).map((e) => e.text).join('\n'), png = file.find((e) => e.w);
  assert.ok(png && png.w === png.h && png.w >= 2048, 'one square skin picture ' + (png && png.w));
  assert.match(usda, /primvars:st/, 'texture coordinates');
  assert.match(usda, /UsdPreviewSurface/); assert.match(usda, /diffuseColor\.connect/, 'colour picture wired to the surface');
  assert.match(usda, /metersPerUnit = 1/, 'in metres');
  assert.equal((usda.match(/def Mesh/g) || []).length, 1, 'one mesh');
  const st = usda.match(/texCoord2f\[\] primvars:st = \[([^\]]*)\]/);
  assert.ok(st, 'st values');
  const vals = st[1].match(/-?[\d.e-]+/g).map(Number);
  assert.ok(vals.every((v) => v >= 0 && v <= 1), 'every coordinate inside the picture');
  const pts = usda.match(/point3f\[\] points = \[([^\]]*)\]/)[1].match(/-?[\d.e-]+/g).map(Number);
  let y0 = Infinity, y1 = -Infinity; for (let k = 1; k < pts.length; k += 3) { y0 = Math.min(y0, pts[k]); y1 = Math.max(y1, pts[k]); }
  console.log('usdz', file.map((e) => e.name).join(', '), 'picture', png.w, 'height', (y1 - y0).toFixed(3), 'm', pts.length / 3, 'points');
  assert.ok(Math.abs((y1 - y0) - (before.heightCm || 175) / 100) < 0.05, 'real height in metres');

  // where to paint: the front of each thigh, clear of the sample tattoos
  const uv = bodyCornerUVs();
  const spot = async (target) => {
    const hit = await p.evaluate((t) => window.__ink.surfaceAt([t[0], t[1], 0.6], [0, 0, -1]), target);
    const face = await p.evaluate((h) => { const pt = window.__ink.projectPoint(h.pos); return { pt, f: window.__ink.hitBody(pt.x, pt.y) }; }, hit);
    const o = face.f.faceIndex * 6;
    return { hit, pt: face.pt, u: (uv[o] + uv[o + 2] + uv[o + 4]) / 3, v: (uv[o + 1] + uv[o + 3] + uv[o + 5]) / 3 };
  };
  const green = await spot([0.11, 0.62, 0.2]), white = await spot([-0.11, 0.62, 0.2]);
  await p.click('[data-close="pcMenu"]').catch(() => {}); await wait(200);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 });
  const skinPx = await p.evaluate((g) => window.__ink.pixelAt(g.pt.x, g.pt.y), green);
  const skinPx2 = await p.evaluate((g) => window.__ink.pixelAt(g.pt.x, g.pt.y), white);

  // paint on the sent model's skin picture as Procreate would, and pack it up again (deflated)
  await p.evaluate(() => {
    window.repaint = async (marks, name) => {
      const b = new Uint8Array(await window.saved['ink-atlas-model.usdz']), dv = new DataView(b.buffer), entries = []; let i = 0;
      while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) { const len = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), x = dv.getUint16(i + 28, true), nm = new TextDecoder().decode(b.subarray(i + 30, i + 30 + n)), s = i + 30 + n + x; entries.push({ name: nm, data: b.slice(s, s + len) }); i = s + len; }
      const tex = entries.find((e) => e.name.endsWith('.png')), img = await createImageBitmap(new Blob([tex.data], { type: 'image/png' }));
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const S = c.width;
      for (const m of marks) { g.fillStyle = m.colour; g.beginPath(); g.arc(m.u * S, m.v * S, S * m.r, 0, Math.PI * 2); g.fill(); } // upside down, as three.js writes it
      const png = new Uint8Array(await (await new Promise((res) => c.toBlob(res, 'image/png'))).arrayBuffer());
      const deflate = async (d) => new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
      const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }); const crc = (d) => { let c = ~0; for (const x of d) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
      const parts = [], central = []; let off = 0;
      for (const e of entries) {
        const data = e.name === tex.name ? png : e.data, packed = e.name === tex.name ? await deflate(data) : data, method = e.name === tex.name ? 8 : 0, nm = new TextEncoder().encode(e.name);
        const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, method, true); h.setUint32(14, crc(data), true); h.setUint32(18, packed.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
        const cd = new DataView(new ArrayBuffer(46)); cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(10, method, true); cd.setUint32(16, crc(data), true); cd.setUint32(20, packed.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, nm.length, true); cd.setUint32(42, off, true);
        parts.push(new Uint8Array(h.buffer), nm, packed); central.push(new Uint8Array(cd.buffer), nm); off += 30 + nm.length + packed.length;
      }
      const csize = central.reduce((a, x) => a + x.length, 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
      return new File([...parts, ...central, new Uint8Array(end.buffer)], name, { type: 'model/vnd.usdz+zip' });
    };
    // the colour of the sent picture at a body spot
    window.sentAt = async (m) => {
      const b = new Uint8Array(await window.saved['ink-atlas-model.usdz']), dv = new DataView(b.buffer); let i = 0, png = null;
      while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) { const len = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), x = dv.getUint16(i + 28, true), nm = new TextDecoder().decode(b.subarray(i + 30, i + 30 + n)), s = i + 30 + n + x; if (nm.endsWith('.png')) png = b.slice(s, s + len); i = s + len; }
      const img = await createImageBitmap(new Blob([png], { type: 'image/png' })), c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      return [...g.getImageData(Math.round(m.u * c.width), Math.round(m.v * c.height), 1, 1).data];
    };
  });
  const greenMark = { u: green.u, v: green.v, r: 0.012, colour: '#2fbf4a' };
  const r1 = await p.evaluate(async (m) => window.__ink.bringBackPainted(await window.repaint([m], 'painted.usdz')), greenMark);
  console.log('brought back', JSON.stringify(r1), (await p.evaluate(() => window.toasts.slice(-1)))[0]);
  assert.ok(r1 && r1.painted > 200, 'paint found');
  let s = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  assert.ok(s.paint && typeof s.paint.img === 'string' && !s.paint.hidden, 'paint kept in the project');
  assert.deepEqual(s.tattoos.map((t) => [t.id, t.pos, t.width]), before.tattoos.map((t) => [t.id, t.pos, t.width]), 'tattoos untouched');
  await p.waitForFunction(() => window.__ink.paintShown(), { timeout: 10000 });
  await wait(300);
  const painted = await p.evaluate((g) => window.__ink.pixelAt(g.pt.x, g.pt.y), green);
  console.log('thigh before', skinPx, 'after', painted);
  assert.ok(painted[1] > painted[0] + 25 && painted[1] > painted[2] + 25, 'green paint shows on the same spot');
  await p.screenshot({ path: 'shots/t72-painted.png' });

  // in a pose the paint stays on the skin
  await p.evaluate(() => window.__ink.setPoseRotations({ 'upperleg01.L': [0.3, 0, 0, 0.954], 'upperleg01.R': [-0.2, 0, 0, 0.98] }));
  await wait(400);
  const posed = await p.evaluate(() => { window.__ink.pixelAt(10, 10); const a = window.__ink.paintAt(), P = window.__ink.posedGeometry().attributes.position.array; return { drawn: a.drawn, body: [P[a.v * 3], P[a.v * 3 + 1], P[a.v * 3 + 2]] }; });
  assert.ok(Math.hypot(...posed.drawn.map((x, k) => x - posed.body[k])) < 1e-5, 'paint drawn on the posed body');
  await p.screenshot({ path: 'shots/t72-posed.png' });
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(300);

  // the next send carries the paint; paint more (a light colour) and bring it back: both come back
  await send();
  const sentGreen = await p.evaluate((m) => window.sentAt(m), greenMark);
  assert.ok(sentGreen[1] > sentGreen[0] + 40, 'the next 3D body carries the paint ' + sentGreen);
  const whiteMark = { u: white.u, v: white.v, r: 0.012, colour: '#f6f6f2' };
  const r2 = await p.evaluate(async (m) => window.__ink.bringBackPainted(await window.repaint([m], 'painted-again.usdz')), whiteMark);
  assert.ok(r2 && r2.painted > r1.painted * 1.6, 'earlier and new paint both come back ' + JSON.stringify([r1, r2]));
  await wait(400);
  const g2 = await p.evaluate((g) => window.__ink.pixelAt(g.pt.x, g.pt.y), green), w2 = await p.evaluate((g) => window.__ink.pixelAt(g.pt.x, g.pt.y), white);
  console.log('after second trip: green spot', g2, 'white spot', w2, 'was', skinPx2);
  assert.ok(g2[1] > g2[0] + 25, 'green still there');
  assert.ok(w2[2] > skinPx2[2] + 30, 'light paint shows lighter than the skin');
  await send();
  const both = await p.evaluate(async ([a, b]) => [await window.sentAt(a), await window.sentAt(b)], [greenMark, whiteMark]);
  assert.ok(both[0][1] > both[0][0] + 40 && both[1][2] > 220, 'both go back out ' + JSON.stringify(both));

  // hide, and the menu says so
  await p.click('#drawNew'); await wait(200);
  assert.equal(await p.$eval('#pmPaint', (e) => e.hidden), false, 'paint row shows');
  await p.click('#pmPaintHide'); await wait(300);
  assert.equal(await p.evaluate(() => window.__ink.paintShown()), false, 'hidden');
  assert.equal(await p.$eval('#pmPaintHide', (e) => e.textContent), 'Show paint');
  await p.click('#pmPaintHide'); await wait(300);
  assert.equal(await p.evaluate(() => window.__ink.paintShown()), true, 'shown again');
  await p.keyboard.press('Escape'); await wait(200);

  // kept after a reload
  await p.evaluate(() => window.__ink.flush()); await wait(500);
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  await p.waitForFunction(() => window.__ink.paintShown(), { timeout: 15000 });
  s = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  assert.ok(s.paint, 'paint kept after a reload');
  await setup();

  // a clean model (sent with the paint hidden) clears the paint, and Undo brings it back
  await p.click('#drawNew'); await wait(200); await p.click('#pmPaintHide'); await wait(200); await p.keyboard.press('Escape'); await wait(200);
  await send();
  const r3 = await p.evaluate(async () => window.__ink.bringBackPainted(new File([await window.saved['ink-atlas-model.usdz']], 'clean.usdz')));
  assert.equal(r3 && r3.painted, 0, 'nothing painted on a clean model');
  assert.equal(JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state()))).paint, undefined, 'paint cleared');
  await p.evaluate(() => window.__ink.undo()); await wait(300);
  s = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  assert.ok(s.paint && s.paint.hidden, 'Undo brings it back');
  await p.click('#drawNew'); await wait(200); await p.click('#pmPaintHide'); await wait(200); await p.keyboard.press('Escape'); await wait(200);
  // make movable tattoos from the paint: two separate drawings, paint gone, one undo step
  const ids = await p.evaluate(() => window.__ink.paintToTattoos());
  console.log('tattoos from paint', ids.length);
  s = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  assert.ok(ids.length >= 2 && !s.paint && s.tattoos.length === before.tattoos.length + ids.length, 'paint became movable tattoos');
  await p.evaluate(() => window.__ink.undo()); await wait(300);
  s = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  assert.ok(s.paint && s.tattoos.length === before.tattoos.length, 'one undo puts the paint back');
  console.log('PASS t72 paint the 3D body: valid USDZ for Procreate, paint comes back on the same skin, follows a pose, goes back out, comes back whole, hides, kept after reload, turns into tattoos');
}
