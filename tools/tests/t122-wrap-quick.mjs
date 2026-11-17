// Jake's ankle wrap as he described it (2026-11-17): type 9 in round at the bottom, 12.5 in at the
// top, 4 in along the skin; add a see-through picture of the cactus already there; get one
// Procreate file with the cactus in the middle and room to draw round it, past the cut too; paint
// on it (here in a script: a band all the way round, a blob drawn straight across the cut, a dot
// beside the cactus); bring it back; and the art lands on the measured shape at exactly the place
// it was drawn, the part past the cut moved round to the other end, and shows on every side of
// the 3D leg. All on the Quick screen, one undo step per change, tattoos untouched.
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { readPsd, writePsd } from '../../src/psd.js';
import { develop, invert, point, circAt } from '../../src/wrap-geometry.js';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const tattoosBefore = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos));

  // start: straight onto the Quick screen
  await p.evaluate(() => window.__ink.wrap().open()); await wait(400);
  await p.evaluate(() => document.getElementById('wsStart').click()); await wait(500);
  let r = await p.evaluate(() => ({ step: window.__ink.wrap().api.ui.step, tab: document.querySelector('#wsTabs .btn[aria-selected=true]')?.textContent, ins: ['wqBottom', 'wqTop', 'wqLen', 'wqPhotoFile', 'wqMake', 'wqBack'].map((id) => !!document.getElementById(id)) }));
  assert.equal(r.step, 'quick'); assert.equal(r.tab, 'Quick'); assert.deepEqual(r.ins, [true, true, true, true, true, true], 'one screen: three numbers, the picture, the file, bring it back');

  // the three numbers, typed as he says them
  const type = (id, v) => p.evaluate((id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change')); }, id, v);
  await type('wqBottom', '8'); await wait(200); await type('wqBottom', '9'); await wait(200); await type('wqTop', '12.5'); await wait(200); await type('wqLen', '4'); await wait(200);
  await p.evaluate(() => [...document.querySelectorAll('#wsSide .seg .btn')].find((b) => b.dataset.v === 'skin').click()); await wait(200);
  r = await p.evaluate(() => { const g = window.__ink.wrap().api.reg(); return { levels: g.levels.map((l) => [l.circ, l.gap || 0]), method: g.method, ok: g.methodConfirmed, how: !!document.getElementById('wqHow') }; });
  near(r.levels[0][0], 228.6, 1e-6, 'bottom 9 in'); near(r.levels[1][0], 317.5, 1e-6, 'top 12.5 in'); near(r.levels[1][1], 101.6, 1e-6, '4 in between');
  assert.ok(r.method === 'skin' && r.ok && !r.how, 'along the skin, confirmed by the tap');

  // the cactus: a see-through PNG with room round it
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#1b1b1b';
    for (const [y0, y1] of [[150, 330], [360, 520], [550, 720]]) g.fillRect(260, y0, 80, y1 - y0);
    g.fillRect(180, 400, 60, 30); g.fillRect(180, 300, 30, 110); g.fillRect(360, 470, 60, 30); g.fillRect(390, 360, 30, 120);
    g.beginPath(); g.arc(300, 115, 30, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(300, 770, 110, 30, 0, 0, Math.PI * 2); g.fill();
    await window.__ink.wrap().api.quickPictureData(c.toDataURL('image/png'), 'Cactus.png');
  });
  await wait(500);
  r = await p.evaluate(() => { const W = window.__ink.wrap().api, g = W.reg(), e = g.existing; return { seam: g.seam, side: e.side, ink: !!e.ink, gap: !!e.gap, top: W.landmarkAt('top'), base: W.landmarkAt('base'), placed: document.getElementById('wqPlaced')?.textContent, warn: W.warnings() }; });
  assert.equal(r.side, 270, 'on the back of the leg'); assert.equal(r.seam, 90, 'cut opposite it, so it is in the middle of the file');
  assert.ok(r.ink && r.gap, 'its ink and gaps traced without a step');
  near(r.base[0], 0, 0.3, 'base in the middle across'); near(r.base[1], 0, 0.3, 'base on the bottom ring');
  near(r.top[0], 0, 0.5, 'top in the middle across'); near(r.top[1], 101.6, 2, 'top 4 in up the skin');
  assert.ok(/Back of the leg, 4 in tall/.test(r.placed) && /middle of the file/.test(r.placed), 'says where it went: ' + r.placed);
  assert.ok(!r.warn.some((w) => /focal|through the existing/.test(w)), 'no warning about the cut: ' + JSON.stringify(r.warn));
  await p.screenshot({ path: 'shots/t122-quick.png' });
  // one undo step took it all back, and redo puts it all back
  await p.evaluate(() => window.__ink.undo()); await wait(300);
  assert.equal(await p.evaluate(() => !!window.__ink.wrap().api.reg().existing?.photos), false, 'one undo removes the picture and its tracing');
  await p.evaluate(() => document.getElementById('redo').click()); await wait(500);
  assert.equal(await p.evaluate(() => !!window.__ink.wrap().api.reg().existing?.ink), true, 'redo brings it back');
  // a changed tape number carries the cactus with it, in one step
  await type('wqLen', '4.5'); await wait(900);
  r = await p.evaluate(() => { const W = window.__ink.wrap().api, g = W.reg(); return { top: W.landmarkAt('top'), known: g.existing.knownMm, calib: g.calib, mc: g.existing.maskCalib }; });
  near(r.known, 114.3, 1e-6, 'its height follows the length it was set from'); near(r.top[1], 114.3, 2.2, 'top follows'); assert.equal(r.mc, r.calib, 'traced again on the new numbers');
  await p.evaluate(() => window.__ink.undo()); await wait(500);
  near(await p.evaluate(() => window.__ink.wrap().api.reg().levels[1].gap), 101.6, 1e-6, 'undo puts 4 in back');

  // the Procreate file, from the Quick screen
  await p.evaluate(() => document.getElementById('wqMake').click());
  await p.waitForFunction(() => !!document.getElementById('wqSend'), { timeout: 120000 });
  const s = await p.evaluate(() => window.__ink.wrap().api.reg().sessions.slice(-1)[0]);
  near(s.runOn, 0.2, 1e-9, 'a fifth of a turn of run-on past each cut');
  const t = develop(s.levels, s.method), kx = s.w / s.wMm, ky = s.h / s.hMm;
  const toTpl = (px, py) => [(px + 0.5) / kx - s.originMm[0], s.originMm[1] - (py + 0.5) / ky];
  const b64 = await p.evaluate(() => window.__ink.wrap().api.packageBase64());
  const psd = readPsd(Buffer.from(b64, 'base64')), W = psd.width, H = psd.height;
  assert.equal(W, s.w); assert.equal(H, s.h); assert.equal(psd.ppi, 300);
  console.log('file', W, 'x', H, 'px,', s.wMm.toFixed(1), 'x', s.hMm.toFixed(1), 'mm');
  { // the file as Procreate shows it, a third of the size, for a look (shots/t122-psd.png)
    const k = 3, w = Math.floor(W / k), h = Math.floor(H / k), raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = psd.merged[c][(y * k) * W + x * k];
    const crcT = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
    const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
    writeFileSync('shots/t122-psd.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  }
  const by = Object.fromEntries(psd.layers.map((L) => [L.name, L]));
  assert.ok(by['Other end of the wrap'] && by['Other end of the wrap'].locked, 'a locked layer repeats the other end');
  // the cactus in the middle of the file: its ink's middle at the canvas middle
  {
    const L = by['Existing ink mask'], a = L.pixels[-1], lw = L.right - L.left; let n = 0, sx = 0;
    for (let i = 0; i < a.length; i++) if (a[i] > 100) { n++; sx += L.left + (i % lw); }
    assert.ok(n > 20000, 'ink mask there'); near(sx / n, W / 2, W * 0.01, 'cactus in the middle across');
  }
  // the grid carries on past each cut (the run-on strip is drawn), and the drawing layer is empty
  {
    const L = by['Measurement grid'], a = L.pixels[-1], lw = L.right - L.left; let past = 0;
    for (let i = 0; i < a.length; i += 3) if (a[i] > 60) { const q = invert(t, ...toTpl(L.left + (i % lw), L.top + Math.floor(i / lw))); if (q && Math.abs(q.f) > 0.53 && Math.abs(q.f) < 0.67 && q.u > 2 && q.u < t.slant - 2) past++; }
    assert.ok(past > 300, 'grid lines in the run-on strips: ' + past);
  }

  // paint on Proposed garden as Procreate would, then share the whole document back
  const rgbaOf = (L) => { const out = new Uint8ClampedArray(W * H * 4), lw = L.right - L.left, lh = L.bottom - L.top, px = L.pixels; for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) { const X = L.left + x, Y = L.top + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const i = y * lw + x, o = (Y * W + X) * 4; out[o] = px[0]?.[i] ?? 0; out[o + 1] = px[1]?.[i] ?? 0; out[o + 2] = px[2]?.[i] ?? 0; out[o + 3] = px[-1] ? px[-1][i] : 255; } return out; };
  const garden = new Uint8ClampedArray(W * H * 4), set = (o, c) => { garden[o] = c[0]; garden[o + 1] = c[1]; garden[o + 2] = c[2]; garden[o + 3] = 255; };
  const RING = [255, 0, 255], BLOB = [0, 200, 0], DOT = [0, 60, 255];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = invert(t, ...toTpl(x, y)); if (!q) continue; const o = (y * W + x) * 4;
    if (q.u >= 45 && q.u <= 55 && Math.abs(q.f) <= 0.5) set(o, RING); // all the way round, cut edge to cut edge
    if (q.u >= 70 && q.u <= 90 && q.f >= 0.45 && q.f <= 0.62) set(o, BLOB); // straight across the right cut
    const c = point(t, 0.15, 20), mm = toTpl(x, y); if (Math.hypot(mm[0] - c[0], mm[1] - c[1]) <= 3) set(o, DOT);
  }
  const layers = psd.layers.map((L) => ({ name: L.name, rgba: L.name === 'Proposed garden' ? garden : rgbaOf(L), locked: L.locked, hidden: L.hidden, opacity: L.opacity }));
  const back = writePsd({ width: W, height: H, ppi: 300, merged: garden, layers });
  r = await p.evaluate((b) => window.__ink.wrap().api.bringBackBase64(b, 'Ankle wrap edited.psd'), Buffer.from(await back.arrayBuffer()).toString('base64'));
  assert.ok(r.ok && r.how === 'exact', 'comes back exactly: ' + JSON.stringify(r));
  r = await p.evaluate(() => ({ folded: window.__ink.wrap().api.review().folded, text: document.getElementById('wsReview')?.textContent, use: !!document.getElementById('wsUseReturn') }));
  assert.ok(/moved round to the other end/.test(r.text) && r.use, 'review says the part past the cut was moved: ' + r.text);
  await p.evaluate(() => document.getElementById('wsUseReturn').click()); await wait(800);
  assert.ok(await p.evaluate(() => !!document.getElementById('wqOnLeg')), 'says it is on the leg, with sides to turn to');

  // where it landed on the measured shape
  const art = await p.evaluate(() => window.__ink.wrap().api.artAlpha(4)), A = Buffer.from(art.b64, 'base64'), tb = t.bounds;
  const alphaAt = (x, y) => { const i = Math.round((x + 15 - tb.minX) * 4 - 0.5), j = Math.round((tb.maxY + 15 - y) * 4 - 0.5); return i < 0 || j < 0 || i >= art.w || j >= art.h ? 0 : A[j * art.w + i]; };
  const on = (f, u) => alphaAt(...point(t, f, u)) > 128;
  const missing = []; for (let f = -0.49; f <= 0.49; f += 0.01) if (!on(f, 50)) missing.push(f.toFixed(2));
  assert.deepEqual(missing, [], 'the band goes all the way round at 50 mm up');
  // its lower edge where it was drawn (45 mm along the skin), across the middle and near both cuts
  for (const f of [-0.45, -0.2, 0, 0.3, 0.48]) { let u = 40; while (u < 50 && !on(f, u)) u += 0.1; near(u, 45, 0.5, `band edge at f ${f}`); }
  // the blob drawn across the right cut: the part inside stays, the part past it is now at the left end
  assert.ok(on(0.47, 80), 'blob inside the right cut stays');
  for (const f of [-0.49, -0.45, -0.4]) assert.ok(on(f, 80), `blob past the cut moved round to f ${f}`);
  assert.ok(!on(-0.36, 80) && !on(-0.3, 80), 'and no further than it was drawn');
  // the moved part is the same size on the skin: 0.12 of a turn at 80 mm up
  { let f = -0.5; while (f < 0 && on(f + 0.001, 80)) f += 0.001; near((f + 0.5) * circAt(t, 80), 0.12 * circAt(t, 80), 1, 'width moved round'); }
  assert.ok(on(0.15, 20), 'dot beside the cactus');
  // nothing left outside the measured shape
  { let out = 0; for (let j = 0; j < art.h; j += 2) for (let i = 0; i < art.w; i += 2) { if (A[j * art.w + i] < 129) continue; const q = invert(t, (i + 0.5) / 4 - 15 + tb.minX, tb.maxY + 15 - (j + 0.5) / 4); if (!q || Math.abs(q.f) > 0.5 + 1 / 228 || q.u < -1 || q.u > t.slant + 1) out++; } assert.equal(out, 0, 'nothing outside the measured shape'); }

  // on the 3D leg, from every side: the band shows all round, the moved blob only by the cut (front)
  const count = async (deg) => {
    await p.evaluate((d) => window.__ink.wrap().api.aimAt(d), deg); await p.waitForFunction(() => window.__ink.settled(), { timeout: 8000 }).catch(() => {}); await wait(700);
    await p.screenshot({ path: `shots/t122-leg-${deg}.png` });
    return p.evaluate(() => {
      window.__ink.pixelAt(0, 0);
      for (const c of document.querySelectorAll('canvas')) {
        const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl || !c.width) continue;
        const w = c.width, h = c.height, d = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, d);
        let ring = 0, blob = 0; for (let i = 0; i < d.length; i += 4) { const R = d[i], G = d[i + 1], B = d[i + 2]; if (R > G + 50 && B > G + 50) ring++; if (G > R + 40 && G > B + 40) blob++; }
        return { ring, blob };
      }
      return null;
    });
  };
  const sides = {}; for (const d of [270, 180, 90, 0]) sides[d] = await count(d);
  console.log('on the leg', JSON.stringify(sides));
  for (const d of [270, 180, 90, 0]) assert.ok(sides[d].ring > 200, `band shows from ${d}°: ${sides[d].ring}`);
  assert.ok(sides[90].blob > 100, 'blob by the cut shows from the front');
  assert.ok(sides[270].blob < sides[90].blob / 10, 'and not from the back');

  // 44 pt targets, tattoos untouched, reload keeps it
  const small = await p.evaluate(() => [...document.querySelectorAll('#wrapStudio .btn')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43).map((b) => b.textContent));
  assert.deepEqual(small, [], 'no small buttons');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), tattoosBefore, 'tattoos untouched');
  await p.evaluate(async () => { await window.__ink.flush(); });
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  r = await p.evaluate(() => { const g = window.__ink.state().regions[0]; return { side: g.existing.side, seam: g.seam, run: g.sessions.slice(-1)[0].runOn, n: g.art.pieces.length }; });
  assert.deepEqual(r, { side: 270, seam: 90, run: 0.2, n: 1 }, 'kept after reload');
  console.log('t122 wrap quick PASS');
}
