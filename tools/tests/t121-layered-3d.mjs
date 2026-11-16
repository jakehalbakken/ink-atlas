// The 3D body for Procreate with each tattoo separate (tray > Procreate, Send it with each
// tattoo separate): one USDZ, stored and 64-byte aligned, whose skin and every visible tattoo
// are separate meshes with separate materials named after them (Procreate makes one texture
// set per material, each listed by name in Layers). Each tattoo lies just over the skin it
// covers, its texture fills 0..1 with the ink on skin colour, and the skin picture has no ink.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const st = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  const shown = st.tattoos.filter((t) => !t.hidden);
  assert.ok(shown.length >= 2, 'sample tattoos to send ' + shown.length);
  await p.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    window.saved = {}; const old = URL.createObjectURL;
    URL.createObjectURL = function (blob) { if (blob.name) window.saved[blob.name] = blob.arrayBuffer(); return old.call(this, blob); };
    window.toasts = []; new MutationObserver(() => { const t = document.querySelector('#toast').textContent; if (t) window.toasts.push(t); }).observe(document.querySelector('#toast'), { childList: true, subtree: true, characterData: true });
  });
  await p.click('#drawNew'); await wait(250);
  const card = await p.$eval('#pm3dLayers', (e) => { const r = e.getBoundingClientRect(); return { h: r.height, w: r.width, text: e.textContent, shown: !e.closest('[hidden]') }; });
  assert.ok(card.shown && card.h >= 44, 'card in the Procreate menu, big enough');
  assert.match(card.text, /each tattoo separate/);
  await p.screenshot({ path: 'shots/t121-menu.png' });
  await p.click('#pm3dLayers');
  await p.waitForFunction(() => !!window.saved['ink-atlas-model-layers.usdz'] || window.toasts.some((x) => x.includes('Could not make')), { timeout: 120000 });
  assert.ok(await p.evaluate(() => !!window.saved['ink-atlas-model-layers.usdz']), 'model made: ' + (await p.evaluate(() => window.toasts.join(' | '))));
  assert.equal(await p.$eval('#pcMenu', (e) => e.closest('.scrim').hidden), true, 'menu closed');

  const file = await p.evaluate(async () => {
    const b = new Uint8Array(await window.saved['ink-atlas-model-layers.usdz']), dv = new DataView(b.buffer), out = [];
    let i = 0;
    while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) {
      const method = dv.getUint16(i + 8, true), len = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), x = dv.getUint16(i + 28, true), name = new TextDecoder().decode(b.subarray(i + 30, i + 30 + n)), s = i + 30 + n + x;
      const e = { name, method, start: s, len };
      if (/\.usda$/.test(name)) e.text = new TextDecoder().decode(b.subarray(s, s + len));
      if (/\.png$/.test(name)) {
        const img = await createImageBitmap(new Blob([b.slice(s, s + len)], { type: 'image/png' }));
        const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, img.width, img.height).data;
        let dark = 0, edge = [0, 0, 0], en = 0; const W = img.width, H = img.height;
        const lum = (q) => 0.3 * d[q] + 0.59 * d[q + 1] + 0.11 * d[q + 2];
        for (let q = 0; q < d.length; q += 16) if (lum(q) < 70) dark++;
        for (let k = 0; k < W; k++) for (const y of [0, H - 1]) { const q = (y * W + k) * 4; edge[0] += d[q]; edge[1] += d[q + 1]; edge[2] += d[q + 2]; en++; }
        Object.assign(e, { w: W, h: H, dark: dark / (d.length / 16), edge: edge.map((v) => Math.round(v / en)) });
      }
      out.push(e); i = s + len;
    }
    return out;
  });
  assert.ok(/\.usda$/.test(file[0].name), 'scene description first');
  for (const e of file) { assert.equal(e.method, 0, e.name + ' stored'); assert.equal(e.start % 64, 0, e.name + ' aligned to 64 bytes'); }
  const usda = file[0].text, pngs = file.filter((e) => e.w), geo = (n) => (file.find((e) => e.name === n.replace(/^\.\//, '')) || {}).text || '';
  const meshes = file.filter((e) => e.text).map((e) => (e.text.match(/def Mesh/g) || []).length).reduce((a, b) => a + b, 0), mats = [...usda.matchAll(/def Material "([^"]+)"/g)].map((m) => m[1]);
  const parts = await p.evaluate(() => window.__lastLayered.parts);
  assert.equal(parts.length, shown.length, 'one part per visible tattoo');
  assert.equal(meshes, 1 + parts.length, 'skin plus one mesh per tattoo');
  assert.equal(pngs.length, 1 + parts.length, 'one picture per material');
  assert.equal(mats[0] === 'Skin' || mats.includes('Skin'), true, 'skin material named Skin ' + mats);
  assert.equal(new Set(mats).size, mats.length, 'material names unique');
  for (const pt of parts) assert.ok(mats.includes(pt.name), pt.name + ' has its own material');
  assert.ok(!/Material_\d/.test(usda), 'no numbered material names left');
  for (const t of shown) assert.ok(parts.some((pt) => pt.name.toLowerCase().startsWith(String(t.name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 12))), 'named after ' + t.name);
  // every binding resolves to a material that exists
  for (const m of usda.matchAll(/material:binding = <\/Materials\/([^>]+)>/g)) assert.ok(mats.includes(m[1]), 'binding to ' + m[1]);
  assert.match(usda, /metersPerUnit = 1/);

  // meshes: texture coordinates 0..1 and points; a tattoo lies just over the skin
  const blocks = [...usda.matchAll(/def Xform "([^"]+)" \(\s*prepend references = @([^@]+)@/g)].map((m) => m[1] + '"' + geo(m[2]));
  assert.equal(blocks.length, 1 + parts.length, 'every mesh found ' + blocks.length);
  const nums = (b, re) => { const m = b.match(re); return m ? m[1].match(/-?[\d.e+-]+/g).map(Number) : []; };
  const skin = blocks.find((b) => b.startsWith('Skin"'));
  assert.ok(skin, 'skin mesh named Skin');
  const sp = nums(skin, /point3f\[\] points = \[([^\]]*)\]/);
  const grid = new Map(), cell = 0.02, key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < sp.length; i += 3) { const k = key(sp[i], sp[i + 1], sp[i + 2]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
  const nearest = (x, y, z) => { let best = Infinity; const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const i of grid.get(`${cx + a},${cy + b},${cz + c}`) || []) best = Math.min(best, Math.hypot(sp[i] - x, sp[i + 1] - y, sp[i + 2] - z)); return best; };
  for (const b of blocks.filter((x) => x !== skin)) {
    const name = b.slice(0, b.indexOf('"')), uv = nums(b, /texCoord2f\[\] primvars:st = \[([^\]]*)\]/), pts = nums(b, /point3f\[\] points = \[([^\]]*)\]/);
    assert.ok(uv.length > 6 && uv.every((v) => v >= -1e-4 && v <= 1 + 1e-4), name + ' texture coordinates in 0..1');
    let far = 0, near = Infinity;
    for (let i = 0; i < pts.length; i += 3) { const d = nearest(pts[i], pts[i + 1], pts[i + 2]); far = Math.max(far, d); near = Math.min(near, d); }
    assert.ok(far < 0.003 && near > 0.0002, `${name} lies just over the skin (${near.toFixed(5)}..${far.toFixed(5)} m)`);
  }
  // pictures: skin without ink, each tattoo's with ink on skin colour round the edge
  const skinPng = pngs.find((e) => e.w === e.h && e.w >= 2048);
  assert.ok(skinPng, 'square skin picture');
  assert.ok(skinPng.dark < 0.002, 'skin picture has no ink in it ' + skinPng.dark);
  for (const e of pngs.filter((x) => x !== skinPng)) {
    assert.ok(e.dark > 0.002, e.name + ' has ink ' + e.dark);
    const sk = skinPng.edge; assert.ok(e.edge.every((v, i) => Math.abs(v - sk[i]) < 40), `${e.name} edge is skin coloured ${e.edge} vs ${sk}`);
  }
  console.log('layered model', parts.map((x) => `${x.name}:${x.triangles}`).join(' '), file.map((e) => e.name).join(' '));
}
