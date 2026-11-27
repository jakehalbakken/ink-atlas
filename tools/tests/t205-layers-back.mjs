// Back from Procreate with the 3D body sent with each tattoo separate (src/layered-back.js):
// the same file back changes nothing; drawing on one tattoo's texture set gives that tattoo the
// new artwork on the same skin at about the same size, with the earlier artwork kept as a
// version and the other tattoo left alone; drawing on the skin's set comes back as a new
// tattoo; all of it is one undo step.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const st = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state())));
  await p.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    window.saved = {}; const old = URL.createObjectURL;
    URL.createObjectURL = function (blob) { if (blob.name) window.saved[blob.askedAs || blob.name] = blob.arrayBuffer(); return old.call(this, blob); };
    window.toasts = []; new MutationObserver(() => { const t = document.querySelector('#toast').textContent; if (t) window.toasts.push(t); }).observe(document.querySelector('#toast'), { childList: true, subtree: true, characterData: true });
  });
  const s0 = await st(), shown = s0.tattoos.filter((t) => !t.hidden);
  assert.ok(shown.length >= 2, 'two tattoos to send');
  await p.click('#drawNew'); await wait(250); await p.click('#pm3dLayers');
  await p.waitForFunction(() => !!window.saved['ink-atlas-model-layers.usdz'], { timeout: 120000 });
  // the file's parts, and a way to send a changed copy of it back
  await p.evaluate(async () => {
    const b = new Uint8Array(await window.saved['ink-atlas-model-layers.usdz']), dv = new DataView(b.buffer), files = [];
    let i = 0;
    while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) { const len = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), x = dv.getUint16(i + 28, true), name = new TextDecoder().decode(b.subarray(i + 30, i + 30 + n)), s = i + 30 + n + x; files.push({ name, data: b.slice(s, s + len) }); i = s + len; }
    window.parts = files;
    // a stored zip, no alignment (Procreate's own file would not keep ours anyway)
    window.zipOf = (list) => {
      const enc = new TextEncoder(), crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
      const crc = (d) => { let c = 0xffffffff; for (let q = 0; q < d.length; q++) c = crcT[(c ^ d[q]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
      const out = [], cen = []; let off = 0;
      for (const f of list) { const nm = enc.encode(f.name), h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc(f.data), true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
        const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(6, 20, true); c.setUint32(16, crc(f.data), true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
        out.push(new Uint8Array(h.buffer), nm, f.data); cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + f.data.length; }
      const size = cen.reduce((a, x) => a + x.length, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, list.length, true); e.setUint16(10, list.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
      return new Blob([...out, ...cen, new Uint8Array(e.buffer)], { type: 'model/vnd.usdz+zip' });
    };
    window.sendBack = async (list, name = 'painted.usdz') => { const dt = new DataTransfer(); dt.items.add(new File([window.zipOf(list)], name, { type: 'model/vnd.usdz+zip' })); const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change')); };
    window.pictureOf = (usda, mat) => { const at = usda.indexOf(`def Material "${mat}"`), next = usda.indexOf('def Material', at + 10); const m = /@([^@]+\.png)@/.exec(usda.slice(at, next < 0 ? usda.length : next)); return m && m[1]; };
    // draw on one picture of the file: fn(g, w, h, pixels)
    window.drawOn = async (name, fn) => {
      const f = window.parts.find((q) => q.name === name || q.name.endsWith('/' + name) || name.endsWith(q.name));
      const bmp = await createImageBitmap(new Blob([f.data], { type: 'image/png' })), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
      fn(g, bmp.width, bmp.height, g.getImageData(0, 0, bmp.width, bmp.height).data);
      return { name: f.name, data: new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer()) };
    };
  });
  const usda = await p.evaluate(() => new TextDecoder().decode(window.parts.find((f) => /\.usda$/.test(f.name)).data));
  const label = (n) => n.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  const sun = shown[0], sprig = shown[1], sunPic = await p.evaluate((u, m) => window.pictureOf(u, m), usda, label(sun.name));
  assert.ok(sunPic, 'the file names a picture for ' + sun.name);
  // 1. the same file back: nothing changes and no undo step is left
  const undo0 = await p.evaluate(() => window.__ink.undoCount ? window.__ink.undoCount() : null);
  await p.evaluate(() => window.sendBack(window.parts));
  await p.waitForFunction(() => window.toasts.some((t) => /Nothing new on that model/.test(t)), { timeout: 60000 }).catch(async (e) => { console.log('toasts', JSON.stringify(await p.evaluate(() => window.toasts))); throw e; });
  const s1 = await st();
  assert.deepEqual(s1.tattoos.map((t) => t.img), s0.tattoos.map((t) => t.img), 'nothing replaced');
  assert.equal(s1.tattoos.length, s0.tattoos.length, 'nothing added');
  if (undo0 != null) assert.equal(await p.evaluate(() => window.__ink.undoCount()), undo0, 'no undo step left behind');
  // 2. a solid dot drawn in the middle of the sun's ink, and a blob on bare skin
  const ink0 = await p.evaluate((i) => window.__ink.inkOnSkin(i), sun.id), sprigInk0 = await p.evaluate((i) => window.__ink.inkOnSkin(i), sprig.id);
  const skinPic = await p.evaluate((u) => window.pictureOf(u, 'Skin'), usda);
  const changed = await p.evaluate(async (sunPic, skinPic) => {
    const a = await window.drawOn(sunPic, (g, w, h, d) => {
      // the middle of the dark ink, and the skin colour at the corner
      let sx = 0, sy = 0, n = 0; const e = [d[0], d[1], d[2]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (e[0] - d[o] > 60) { sx += x; sy += y; n++; } }
      g.fillStyle = '#000'; g.beginPath(); g.arc(sx / n, sy / n, Math.min(w, h) * 0.06, 0, 7); g.fill();
    });
    const b = await window.drawOn(skinPic, (g, w, h, d) => {
      // a spot well inside bare skin: a 24 px square all one colour, away from the edges
      const at = (x, y) => (y * w + x) * 4, same = (o, q) => Math.abs(d[o] - d[q]) + Math.abs(d[o + 1] - d[q + 1]) + Math.abs(d[o + 2] - d[q + 2]) < 6;
      for (let y = Math.round(h * 0.3); y < h * 0.7; y += 17) for (let x = Math.round(w * 0.2); x < w * 0.45; x += 17) {
        const o = at(x, y); if (d[o] < 120 || d[o + 3] < 255) continue; let ok = true;
        for (let dy = -40; dy <= 40 && ok; dy += 8) for (let dx = -40; dx <= 40 && ok; dx += 8) ok = same(o, at(x + dx, y + dy));
        if (ok) { g.fillStyle = '#101010'; g.beginPath(); g.arc(x, y, 18 * w / 4096 + 6, 0, 7); g.fill(); window.blobAt = [x / w, y / h]; return; }
      }
      throw new Error('no bare skin found');
    });
    return [a, b];
  }, sunPic, skinPic);
  const list = await p.evaluate((ch) => window.parts.map((f) => { const c = ch.find((x) => x.name === f.name); return c ? { name: f.name, data: new Uint8Array(Object.values(c.data)) } : f; }), changed);
  await p.evaluate((l) => window.sendBack(l.map((f) => ({ name: f.name, data: f.data instanceof Uint8Array ? f.data : new Uint8Array(Object.values(f.data)) }))), list);
  await p.waitForFunction(() => window.__lastLayeredBack && window.toasts.some((t) => /new artwork/.test(t)), { timeout: 90000 });
  await wait(800);
  const back = await p.evaluate(() => window.__lastLayeredBack), s2 = await st();
  console.log('back', JSON.stringify({ changed: back.changed, added: back.added.length, toasts: await p.evaluate(() => window.toasts.slice(-2)) }));
  assert.deepEqual(back.changed, [sun.id], 'only the sun has new artwork');
  assert.equal(back.added.length, 1, 'the blob on the skin is one new tattoo');
  const sun2 = s2.tattoos.find((t) => t.id === sun.id), sprig2 = s2.tattoos.find((t) => t.id === sprig.id);
  assert.notEqual(sun2.img, sun.img, 'the sun has a new picture');
  assert.ok((sun2.versions || []).some((v) => v.img === sun.img), 'the earlier artwork is kept as a version');
  assert.equal(sprig2.img, sprig.img, 'the sprig is left alone');
  await p.waitForFunction((i, img) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); return t.img !== img && window.__ink.inkOnSkin(i); }, { timeout: 10000 }, sun.id, sun.img); await wait(500);
  const ink1 = await p.evaluate((i) => window.__ink.inkOnSkin(i), sun.id), sprigInk1 = await p.evaluate((i) => window.__ink.inkOnSkin(i), sprig.id);
  const moved = Math.hypot(...ink1.c.map((v, k) => v - ink0.c[k]));
  console.log('sun ink', JSON.stringify({ moved: +(moved * 1000).toFixed(2), area: +(ink1.area / ink0.area).toFixed(3), width: +(sun2.width / sun.width).toFixed(3), aspect: [sun.aspect, sun2.aspect] }));
  assert.ok(moved < 0.004, `the ink stays on the same skin (moved ${(moved * 1000).toFixed(1)} mm)`);
  assert.ok(ink1.area > ink0.area * 1.02 && ink1.area < ink0.area * 1.6, 'the dot adds ink, the rest keeps its size: x' + (ink1.area / ink0.area).toFixed(3));
  assert.ok(sun2.width / sun.width > 0.75 && sun2.width / sun.width < 1.1, 'about the same size (cut to its ink)');
  assert.ok(Math.hypot(...sprigInk1.c.map((v, k) => v - sprigInk0.c[k])) < 1e-6, 'the sprig did not move');
  await p.screenshot({ path: 'shots/t205-back.png' });
  // 3. one undo step puts it all back
  await p.click('#undo'); await wait(600);
  const s3 = await st();
  assert.equal(s3.tattoos.find((t) => t.id === sun.id).img, sun.img, 'undo puts the sun back');
  assert.equal(s3.tattoos.length, s0.tattoos.length, 'undo takes the new tattoo off');
  console.log('PASS t205 layers back from the separate-tattoo model');
}
