// Measured wrap to Procreate and back (Jake's spec, stage 2): a layered PSD at the measured size
// (300 PPI, locked reference layers, transparent canvas, alignment marks), an unchanged round trip
// putting the garden back within a pixel, a resized or cropped file put back by its marks, a
// stretched one refused, a review before anything is used, undo, and every tattoo left alone.
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { readPsd, writePsd } from '../../src/psd.js';
import { findMarks, MARKS } from '../../src/procreate-package.js';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const tattoosBefore = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos));

  // a wrap with the cactus registered, traced and locked, and two plants
  await p.evaluate(() => window.__ink.wrap().open()); await wait(400);
  await p.evaluate(() => document.getElementById('wsStart').click()); await wait(500);
  await p.evaluate(async () => {
    const W = window.__ink.wrap().api, c = document.createElement('canvas'); c.width = 600; c.height = 900; const g = c.getContext('2d');
    g.fillStyle = '#d9a989'; g.fillRect(0, 0, 600, 900); g.fillStyle = '#1b1b1b';
    for (const [y0, y1] of [[150, 330], [360, 520], [550, 720]]) g.fillRect(260, y0, 80, y1 - y0);
    g.fillRect(180, 400, 60, 30); g.fillRect(180, 300, 30, 110); g.fillRect(360, 470, 60, 30); g.fillRect(390, 360, 30, 120);
    g.beginPath(); g.arc(300, 115, 30, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(300, 770, 110, 30, 0, 0, Math.PI * 2); g.fill();
    await W.addPhotoData(c.toDataURL('image/jpeg', 0.92), 'Cactus photo');
    W.ui.step = 'existing'; W.setLandmark('top', [300, 85]); W.setLandmark('base', [300, 800]); W.setLandmark('left', [180, 300]); W.setLandmark('right', [420, 360]);
    W.reg().existing.knownHow = 'skin'; W.place(); W.ui.sub = 'trace'; await W.findInk(); await W.findGaps();
  });
  await wait(300);
  await p.evaluate(() => { const W = window.__ink.wrap().api; W.ui.sub = 'lock'; window.__ink.wrap().refresh(); document.getElementById('wsLock').click(); }); await wait(200);
  await p.evaluate(async () => {
    const W = window.__ink.wrap().api, mk = (col) => { const c = document.createElement('canvas'); c.width = 400; c.height = 600; const g = c.getContext('2d'); g.fillStyle = col; g.beginPath(); g.ellipse(200, 300, 150, 260, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e04a7a'; g.beginPath(); g.arc(200, 60, 40, 0, Math.PI * 2); g.fill(); return c.toDataURL('image/png'); };
    await W.addPieceData(mk('#2d6a3a'), 'Front arch', [0, 60], 50);
    await W.addPieceData(mk('#3b7d4a'), 'Barrel cluster', [60, 30], 28);
  });

  // the Procreate tab
  await p.evaluate(() => [...document.querySelectorAll('#wsTabs .btn')].find((b) => b.dataset.step === 'procreate').click()); await wait(300);
  let r = await p.evaluate(() => ({ size: document.getElementById('wsPkgSize').textContent, make: !!document.getElementById('wsMakePkg'), hi: window.__ink.wrap().api.highPpi() }));
  assert.ok(/5211 × 2044 pixels at 300 PPI/.test(r.size), 'canvas size readout: ' + r.size); assert.ok(r.make, 'Make the Procreate file button');
  assert.equal(r.hi, 350, 'higher choice fits an iPad canvas');
  await p.screenshot({ path: 'shots/t118-procreate.png' });

  r = await p.evaluate(async () => { const W = window.__ink.wrap().api; const res = await W.makePackage({ ppi: 300, format: 'psd' }); return { res, ready: !!document.getElementById('wsSendPkg'), sessions: W.reg().sessions }; });
  assert.ok(/\.psd$/.test(r.res.name) && r.ready, 'file made ahead and Send shown: ' + JSON.stringify(r.res.name));
  assert.equal(r.sessions.length, 1, 'trip recorded'); const s = r.sessions[0];
  assert.equal(s.w, 5211); assert.equal(s.h, 2044); assert.equal(s.ppi, 300);
  console.log('made', r.res.name, (r.res.size / 1048576).toFixed(1), 'MB');

  // read the PSD as Procreate would
  const b64 = await p.evaluate(() => window.__ink.wrap().api.packageBase64());
  const psd = readPsd(Buffer.from(b64, 'base64'));
  { // the flattened picture, a third of the size, for a look (shots/t118-psd.png)
    const W = psd.width, H = psd.height, k = 3, w = Math.floor(W / k), h = Math.floor(H / k), raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = psd.merged[c][(y * k) * W + x * k];
    const crcT = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
    const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
    writeFileSync('shots/t118-psd.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  }
  assert.equal(psd.width, 5211); assert.equal(psd.height, 2044); assert.equal(psd.ppi, 300, 'resolution written');
  const names = psd.layers.map((L) => L.name);
  assert.deepEqual(names, ['Optional background (Ink Atlas ' + s.id.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() + ')', 'Measurement grid', 'Seam and alignment marks', 'Anatomical landmarks', 'Negative-space protection', 'Existing ink mask', 'Existing cactus reference', 'Other end of the wrap', 'Proposed garden']);
  for (const L of psd.layers) assert.equal(L.locked, L.name !== 'Proposed garden', 'lock on ' + L.name);
  assert.ok(psd.layers[0].hidden, 'background hidden, so the canvas is transparent');
  const count = (L) => { let n = 0; const a = L.pixels[-1]; if (!a) return 0; for (let i = 0; i < a.length; i++) if (a[i] > 100) n++; return n; };
  const by = Object.fromEntries(psd.layers.map((L) => [L.name, L]));
  assert.ok(count(by['Proposed garden']) > 20000, 'garden has the plants');
  assert.ok(count(by['Existing ink mask']) > 50000, 'ink mask has the cactus: ' + count(by['Existing ink mask']));
  assert.ok(count(by['Negative-space protection']) > 2000, 'protected gaps');
  assert.ok(count(by['Existing cactus reference']) > 100000, 'cactus photo');
  const marksL = by[MARKS], ma = new Uint8Array(5211 * 2044); for (let i = 0; i < ma.length; i++) ma[i] = marksL.pixels[-1][i];
  const found = findMarks(ma, 5211, 2044, 5211 / s.wMm);
  assert.ok(found, 'the four alignment targets can be found in the marks layer');
  // the garden's own content lands where the plants are: transparent elsewhere
  const g0 = by['Proposed garden'], ga = g0.pixels[-1]; assert.equal(ga[0], 0, 'corner transparent');

  // 1. unchanged round trip: back within a pixel
  const before = await p.evaluate(() => window.__ink.wrap().api.artAlpha(4));
  r = await p.evaluate((b) => window.__ink.wrap().api.bringBackBase64(b, 'Ankle wrap.psd'), b64);
  assert.ok(r.ok && r.how === 'exact', 'unchanged file goes back exactly: ' + JSON.stringify(r));
  r = await p.evaluate(() => ({ rv: window.__ink.wrap().api.review(), box: !!document.getElementById('wsReview'), use: !!document.getElementById('wsUseReturn') }));
  assert.ok(r.box && r.use, 'shown for review with Use it');
  near(r.rv.piece.w, s.wMm, 1e-6, 'returned picture is the canvas width'); assert.equal(r.rv.piece.pw, 5211);
  const during = await p.evaluate(() => window.__ink.wrap().api.artAlpha(4));
  const diff = (A, B) => { const a = Buffer.from(A.b64, 'base64'), b = Buffer.from(B.b64, 'base64'); let big = 0, sum = 0, ink = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); sum += d; if (d > 128) big++; if (a[i] > 128) ink++; } return { big, mean: sum / a.length, ink }; };
  const d1 = diff(before, during);
  // at 4 px per mm a 1 px shift at 300 PPI (0.085 mm) moves an edge by a third of a cell at most
  assert.ok(d1.big < d1.ink * 0.01 && d1.mean < 1.5, 'the garden is back in the same place: ' + JSON.stringify(d1));
  await p.screenshot({ path: 'shots/t118-review.png' });
  // nothing is used until Use it
  assert.equal(await p.evaluate(() => window.__ink.wrap().api.reg().art.pieces.length), 2, 'review changes nothing');
  await p.evaluate(() => document.getElementById('wsUseReturn').click()); await wait(300);
  r = await p.evaluate(() => { const reg = window.__ink.wrap().api.reg(); return { n: reg.art.pieces.length, name: reg.art.pieces[0].name, saved: (reg.art.saved || []).map((v) => [v.name, v.pieces.length]), ret: reg.sessions[0].returned }; });
  assert.equal(r.n, 1); assert.equal(r.name, 'From Procreate'); assert.ok(r.saved.some(([n, k]) => /^Before Procreate/.test(n) && k === 2), 'plants before it kept as a version: ' + JSON.stringify(r.saved));
  assert.equal(r.ret.how, 'exact');
  const after = await p.evaluate(() => window.__ink.wrap().api.artAlpha(4));
  const d2 = diff(before, after); assert.ok(d2.big < d2.ink * 0.01, 'after Use it, the same garden: ' + JSON.stringify(d2));
  await p.evaluate(() => window.__ink.undo()); await wait(300);
  assert.equal(await p.evaluate(() => window.__ink.wrap().api.reg().art.pieces.length), 2, 'undo brings the plants back');

  // 2. resized to half: put back by the marks
  const half = (L, W, H) => { const w = Math.round(W / 2), h = Math.round(H / 2), out = new Uint8ClampedArray(w * h * 4), lw = L.right - L.left; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = x * 2 - L.left, Y = y * 2 - L.top; if (X < 0 || Y < 0 || X >= lw || Y >= L.bottom - L.top) continue; const i = Y * lw + X, o = (y * w + x) * 4; out[o] = L.pixels[0][i]; out[o + 1] = L.pixels[1][i]; out[o + 2] = L.pixels[2][i]; out[o + 3] = L.pixels[-1][i]; } return out; };
  {
    const W = 5211, H = 2044, w = Math.round(W / 2), h = Math.round(H / 2), gpx = half(g0, W, H), mpx = half(marksL, W, H);
    const blob = writePsd({ width: w, height: h, merged: gpx, layers: [{ name: 'Seam and alignment marks', rgba: mpx }, { name: 'Proposed garden', rgba: gpx }] });
    const hb = Buffer.from(await blob.arrayBuffer()).toString('base64');
    r = await p.evaluate((b) => window.__ink.wrap().api.bringBackBase64(b, 'half.psd'), hb);
    assert.ok(r.ok && r.how === 'registered', 'half-size file put back by its marks: ' + JSON.stringify(r));
    const rv = await p.evaluate(() => window.__ink.wrap().api.review());
    near(rv.piece.w, s.wMm * (w * 2 / W), 0.6, 'half-size picture placed at the measured size');
    const dh = diff(before, await p.evaluate(() => window.__ink.wrap().api.artAlpha(4)));
    assert.ok(dh.big < dh.ink * 0.03, 'half-size garden lands in the same place: ' + JSON.stringify(dh));
    console.log('half size:', r.why);
  }
  // 3. stretched taller: refused
  {
    const W = 5211, H = 2044, h2 = Math.round(H * 1.04), str = (L) => { const out = new Uint8ClampedArray(W * h2 * 4), lw = L.right - L.left; for (let y = 0; y < h2; y++) { const Y = Math.min(H - 1, Math.round(y / 1.04)) - L.top; if (Y < 0 || Y >= L.bottom - L.top) continue; for (let x = 0; x < W; x++) { const X = x - L.left; if (X < 0 || X >= lw) continue; const i = Y * lw + X, o = (y * W + x) * 4; out[o] = L.pixels[0][i]; out[o + 1] = L.pixels[1][i]; out[o + 2] = L.pixels[2][i]; out[o + 3] = L.pixels[-1][i]; } } return out; };
    const blob = writePsd({ width: W, height: h2, merged: str(g0), layers: [{ name: 'Seam and alignment marks', rgba: str(marksL) }, { name: 'Proposed garden', rgba: str(g0) }] });
    r = await p.evaluate((b) => window.__ink.wrap().api.bringBackBase64(b, 'tall.psd'), Buffer.from(await blob.arrayBuffer()).toString('base64'));
    assert.ok(!r.ok && /stretch/i.test(r.why), 'stretched file refused: ' + JSON.stringify(r));
    assert.equal(await p.evaluate(() => !!document.getElementById('wsUseReturn')), false, 'no Use it on a refused file');
    console.log('stretched:', r.why);
  }
  // 4. a cropped PNG with no marks: refused with the reason; an exact-size PNG of the garden: fine
  r = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 3000; c.height = 1500; const g = c.getContext('2d'); g.fillStyle = '#2d6a3a'; g.fillRect(100, 100, 300, 300); const b = c.toDataURL('image/png').split(',')[1]; return window.__ink.wrap().api.bringBackBase64(b, 'garden.png', 'image/png'); });
  assert.ok(!r.ok && /cropped or stretched/.test(r.why), 'cropped PNG refused: ' + JSON.stringify(r));
  r = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 5211; c.height = 2044; const g = c.getContext('2d'); g.fillStyle = '#2d6a3a'; g.fillRect(1800, 600, 300, 300); const b = c.toDataURL('image/png').split(',')[1]; return window.__ink.wrap().api.bringBackBase64(b, 'garden.png', 'image/png'); });
  assert.ok(r.ok && r.how === 'exact', 'garden PNG at the canvas size: ' + JSON.stringify(r));
  await p.evaluate(() => document.getElementById('wsCancelReturn').click()); await wait(200);
  assert.equal(await p.evaluate(() => window.__ink.wrap().api.reg().art.pieces.length), 2, 'Cancel leaves the design alone');

  // PNG layers with a manifest
  r = await p.evaluate(async () => { const W = window.__ink.wrap().api; const res = await W.makePackage({ ppi: 300, format: 'png' }); const b = await W.packageBase64(); return { name: res.name, b: b.slice(0, 8), len: b.length }; });
  assert.ok(/layers\.zip$/.test(r.name), 'PNG layers zip: ' + r.name);
  const zip = Buffer.from(await p.evaluate(() => window.__ink.wrap().api.packageBase64()), 'base64').toString('latin1');
  for (const f of ['01-garden.png', '02-wrapref.png', '07-marks.png', '09-background.png', 'manifest.json']) assert.ok(zip.includes(f), 'zip holds ' + f);
  const man = JSON.parse(zip.slice(zip.indexOf('{\n  "app"'), zip.indexOf('\n}', zip.indexOf('{\n  "app"')) + 2));
  assert.equal(man.canvas.widthPx, 5211); assert.equal(man.canvas.ppi, 300); assert.equal(man.layers[0].name, 'Proposed garden');

  // 44 pt targets, and tattoos never touched
  const small = await p.evaluate(() => [...document.querySelectorAll('#wrapStudio .btn')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43).map((b) => b.textContent));
  assert.deepEqual(small, [], 'no small buttons');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), tattoosBefore, 'tattoos untouched');
  // reload: the trip record survives
  await p.evaluate(async () => { await window.__ink.flush(); });
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  r = await p.evaluate(() => (window.__ink.state().regions[0].sessions || []).map((q) => [q.w, q.h, !!q.returned]));
  assert.ok(r.length === 2 && r[0][0] === 5211, 'trips kept after reload: ' + JSON.stringify(r));
  console.log('t118 wrap Procreate PASS');
}
