// Paint in Procreate, get each layer back as a tattoo (tray > Procreate > Bring back your
// drawing as tattoos). A Procreate file made on the sent 3D body: each visible layer becomes
// its own planned tattoo named after the layer (separate drawings on one layer give one each),
// a hidden layer stays out, paint straight on the base layer comes back too, bringing the same
// file back adds nothing, a changed layer replaces its tattoos, all in one undo step. A USDZ
// (flattened) is split by separate areas, and the tattoos already brought back (which went out
// on the next body) do not come back again.
import assert from 'node:assert/strict';
import { bodyCornerUVs } from '../../src/uv-bake.js';
import { procreateFile } from '../procreate-fixture.mjs';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const state = async () => JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  const before = await state();
  await p.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    window.saved = {}; const old = URL.createObjectURL;
    URL.createObjectURL = function (blob) { if (blob.name) window.saved[blob.name] = blob.arrayBuffer(); return old.call(this, blob); };
    window.toasts = []; new MutationObserver(() => { const t = document.querySelector('#toast').textContent; if (t) window.toasts.push(t); }).observe(document.querySelector('#toast'), { childList: true, subtree: true, characterData: true });
  });
  const send = async () => {
    await p.evaluate(() => { delete window.saved['ink-atlas-model.usdz']; });
    if (await p.$eval('#pcMenu', (e) => e.hidden)) { await p.click('#drawNew'); await wait(200); }
    await p.click('#pm3dSend');
    await p.waitForFunction(() => !!window.saved['ink-atlas-model.usdz'], { timeout: 120000 });
    await p.click('[data-close="pcMenu"]').catch(() => {}); await wait(200);
  };

  // the menu card says how to keep layers apart
  await p.click('#drawNew'); await wait(200);
  const card = await p.$eval('#pm3dBack', (e) => [e.textContent, e.getBoundingClientRect().height]);
  assert.ok(/as tattoos/.test(card[0]) && /Procreate/.test(card[0]) && card[1] >= 44, 'bring back card: ' + card[0]);
  await p.click('[data-close="pcMenu"]'); await wait(200);
  await send();

  // spots on the body: three on the front of each thigh, clear of the sample tattoos
  const uv = bodyCornerUVs();
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }).catch(() => {});
  const spot = async (t) => {
    const hit = await p.evaluate((t) => window.__ink.surfaceAt([t[0], t[1], 0.6], [0, 0, -1]), t);
    const f = await p.evaluate((h) => { const pt = window.__ink.projectPoint(h.pos); return window.__ink.hitBody(pt.x, pt.y); }, hit);
    const o = f.faceIndex * 6;
    return { pos: hit.pos, u: (uv[o] + uv[o + 2] + uv[o + 4]) / 3, v: (uv[o + 1] + uv[o + 3] + uv[o + 5]) / 3 };
  };
  const thighL = await spot([0.11, 0.62]), thighR = await spot([-0.11, 0.62]), shinL = await spot([0.11, 0.53]), shinR = await spot([-0.1, 0.53]), upL = await spot([0.1, 0.75]), upR = await spot([-0.1, 0.75]);

  // the sent skin picture, at the Procreate document's size, rows as the picture has them
  const W = 1024;
  const skinB64 = await p.evaluate(async (W) => {
    const b = new Uint8Array(await window.saved['ink-atlas-model.usdz']), dv = new DataView(b.buffer); let i = 0, png = null;
    while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) { const len = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), x = dv.getUint16(i + 28, true), nm = new TextDecoder().decode(b.subarray(i + 30, i + 30 + n)), s = i + 30 + n + x; if (nm.endsWith('.png')) png = b.slice(s, s + len); i = s + len; }
    const img = await createImageBitmap(new Blob([png], { type: 'image/png' })), c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, W, W);
    const d = g.getImageData(0, 0, W, W).data; let s = ''; for (let k = 0; k < d.length; k += 32768) s += String.fromCharCode(...d.subarray(k, k + 32768)); return btoa(s);
  }, W);
  const skin = new Uint8ClampedArray(Buffer.from(skinB64, 'base64'));
  const blank = () => new Uint8ClampedArray(W * W * 4);
  // marks drawn where the picture has them (as t72 does: u across, v down the picture)
  const disc = (px, m, rgba, r = 0.012) => { const cx = m.u * W, cy = m.v * W, R = r * W; for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) if (Math.hypot(x - cx, y - cy) <= R) px.set(rgba, (y * W + x) * 4); };
  const over = (dst, src) => { for (let o = 0; o < dst.length; o += 4) { const a = src[o + 3] / 255; if (a) for (let k = 0; k < 3; k++) dst[o + k] = Math.round(dst[o + k] * (1 - a) + src[o + k] * a); } };
  const make = (roseAt) => {
    const rose = blank(); disc(rose, roseAt, [200, 20, 40, 255]);
    const script = blank(); disc(script, thighR, [25, 25, 30, 255], 0.01); disc(script, shinL, [25, 25, 30, 255], 0.01);
    const ghost = blank(); disc(ghost, shinR, [0, 0, 255, 255], 0.02);
    const base = new Uint8ClampedArray(skin); disc(base, shinR, [30, 140, 60, 255], 0.009); // painted straight on the skin
    const comp = new Uint8ClampedArray(base); over(comp, script); over(comp, rose);
    return procreateFile({ width: W, height: W, layers: [
      { uuid: 'R0SE0000-1111', name: 'Rose', pixels: rose }, { uuid: 'SCR1PT00-2222', name: 'Script', pixels: script },
      { uuid: 'GH0ST000-3333', name: 'Ghost', hidden: true, pixels: ghost }, { uuid: 'BASE0000-4444', name: 'Layer 1', pixels: base },
    ], composite: { uuid: 'C0MP0000-5555', pixels: comp } });
  };
  const bringBack = (bytes, name) => p.evaluate(async (b64, name) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return window.__ink.bringBack(new File([u], name)); }, Buffer.from(bytes).toString('base64'), name);

  const file1 = make(thighL);
  const ids = await bringBack(file1, 'my tattoos.procreate');
  console.log('from layers', ids.length, (await p.evaluate(() => window.toasts.slice(-1)))[0]);
  let s = await state();
  const fresh = s.tattoos.filter((t) => ids.includes(t.id));
  console.log(fresh.map((t) => t.name + ' ' + t.fromLayer).join(', '));
  const names = fresh.map((t) => t.name).sort();
  assert.deepEqual(names, ['From Procreate 1', 'Rose', 'Script 1', 'Script 2'], 'one tattoo per layer, named by the layer, separate drawings apart, base paint too, hidden layer out');
  assert.ok(fresh.every((t) => t.status === 'planned' && t.fromLayer), 'planned, and knows its layer');
  const near = (t, at) => Math.hypot(...t.pos.map((x, k) => x - at.pos[k]));
  const rose = fresh.find((t) => t.name === 'Rose');
  assert.ok(near(rose, thighL) < 0.04, 'Rose sits where it was painted ' + near(rose, thighL).toFixed(3));
  assert.ok(rose.width > 0.03 && rose.width < 0.12, 'Rose about its painted size ' + rose.width.toFixed(3));
  const scripts = fresh.filter((t) => t.name.startsWith('Script'));
  assert.ok(scripts.some((t) => near(t, thighR) < 0.04) && scripts.some((t) => near(t, shinL) < 0.04), 'both Script drawings in place');
  assert.ok(near(fresh.find((t) => t.name === 'From Procreate 1'), shinR) < 0.04, 'paint on the base layer in place');
  assert.deepEqual(s.tattoos.filter((t) => !ids.includes(t.id)).map((t) => [t.id, t.pos]), before.tattoos.map((t) => [t.id, t.pos]), 'tattoos already here untouched');
  await p.evaluate((id) => window.__ink.focus && window.__ink.focus(id), rose.id).catch(() => {});
  await wait(600); await p.screenshot({ path: 'shots/t73-layers.png' });

  // the same file again adds nothing
  const again = await bringBack(file1, 'my tattoos.procreate');
  assert.equal(again.length, 0, 'nothing new the second time');
  assert.equal((await state()).tattoos.length, s.tattoos.length, 'no doubles');
  assert.match((await p.evaluate(() => window.toasts.slice(-1)))[0], /No new layers/);

  // Rose moved to the other thigh's side in Procreate: its tattoo is replaced, the rest stay
  const moved = { u: thighL.u + 0.012, v: thighL.v + 0.02 };
  const n0 = (await state()).tattoos.length;
  const ids2 = await bringBack(make(moved), 'my tattoos v2.procreate');
  s = await state();
  assert.equal(ids2.length, 1, 'only the changed layer comes back');
  assert.equal(s.tattoos.length, n0, 'it takes the old Rose\'s place');
  assert.ok(!s.tattoos.some((t) => t.id === rose.id) && s.tattoos.find((t) => t.id === ids2[0]).name === 'Rose', 'Rose replaced');
  await p.evaluate(() => window.__ink.undo()); await wait(300);
  s = await state();
  assert.ok(s.tattoos.some((t) => t.id === rose.id) && !s.tattoos.some((t) => t.id === ids2[0]), 'one undo puts the old Rose back');

  // a USDZ is flat: separate areas become tattoos, and the layer tattoos (now on the sent skin) stay out
  await send();
  const usdz = await p.evaluate(async (marks) => {
    const b = new Uint8Array(await window.saved['ink-atlas-model.usdz']), dv = new DataView(b.buffer), entries = []; let i = 0;
    while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) { const len = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), x = dv.getUint16(i + 28, true), nm = new TextDecoder().decode(b.subarray(i + 30, i + 30 + n)), s = i + 30 + n + x; entries.push({ name: nm, data: b.slice(s, s + len) }); i = s + len; }
    const tex = entries.find((e) => e.name.endsWith('.png')), img = await createImageBitmap(new Blob([tex.data], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    for (const m of marks) { g.fillStyle = m.colour; g.beginPath(); g.arc(m.u * c.width, m.v * c.width, c.width * 0.01, 0, Math.PI * 2); g.fill(); }
    const png = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
    // stored zip, the picture swapped
    const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }); const crc = (d) => { let c = ~0; for (const x of d) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
    const parts = [], central = []; let off = 0;
    for (const e of entries) {
      const data = e === tex ? png : e.data, nm = new TextEncoder().encode(e.name);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc(data), true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
      const cd = new DataView(new ArrayBuffer(46)); cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint32(16, crc(data), true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, nm.length, true); cd.setUint32(42, off, true);
      parts.push(new Uint8Array(h.buffer), nm, data); central.push(new Uint8Array(cd.buffer), nm); off += 30 + nm.length + data.length;
    }
    const cs = central.reduce((a, x) => a + x.length, 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
    const f = new File([...parts, ...central, new Uint8Array(end.buffer)], 'painted.usdz');
    return window.__ink.bringBack(f);
  }, [{ u: upL.u, v: upL.v, colour: '#7a2bbf' }, { u: upR.u, v: upR.v, colour: '#1a1a1a' }]);
  s = await state();
  console.log('from USDZ', usdz.length, s.tattoos.filter((t) => usdz.includes(t.id)).map((t) => t.name).join(', '), (await p.evaluate(() => window.toasts.slice(-1)))[0]);
  assert.equal(usdz.length, 2, 'two separate areas, two tattoos, nothing from ink already here');
  assert.ok(s.tattoos.filter((t) => usdz.includes(t.id)).every((t) => t.status === 'planned' && !t.fromLayer), 'planned, from a flat file');

  // kept after a reload, with the layer each came from
  await p.evaluate(() => window.__ink.flush()); await wait(500);
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  s = await state();
  assert.ok(s.tattoos.some((t) => t.id === rose.id && t.fromLayer && t.fromLayer.startsWith('R0SE0000-1111:')), 'layer kept after a reload');
  console.log('PASS t73 paint layers: each Procreate layer comes back as its own planned tattoo named after it, hidden layers out, base paint in, same file adds nothing, a changed layer replaces its tattoos in one undo, USDZ split by areas without slivers, kept after reload');
}
