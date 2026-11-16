// Measured wrap print (Jake's spec, stage 3): the stencil (new art only) and the placement guide as a
// PDF at 100% on any paper, Letter and A4 landscape on two pages that overlap 10 mm and Legal on one,
// the 1 in square at 72 pt, a moved join, mirror once, approval that notices a changed design but
// not a paper change, the fitting check, undo, reload, and every tattoo left alone.
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
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

  const tab = async () => { await p.evaluate(() => [...document.querySelectorAll('#wsTabs .btn')].find((b) => b.dataset.step === 'print').click()); await wait(300); };
  await tab();
  const panel = () => p.evaluate(() => ({ layout: document.getElementById('wsLayout').textContent, approved: document.getElementById('wsApproved').textContent, make: document.getElementById('wsMakePrint')?.textContent || '', cut: !!document.getElementById('wsCut0'), paper: [...document.querySelectorAll('#wsPaper .btn')].find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.v }));
  let r = await panel();
  assert.equal(r.paper, 'letter'); assert.ok(/2 landscape pages at 100%, overlapping 10 mm/.test(r.layout), 'Letter: ' + r.layout); assert.ok(r.cut, 'join slider');
  assert.ok(/Not approved yet/.test(r.approved), r.approved);
  await p.screenshot({ path: 'shots/t119-print.png' });
  // paper changes the pages, never the size
  const sum0 = await p.evaluate(() => JSON.stringify(window.__ink.wrap().api.summary()));
  await p.evaluate(() => document.querySelector('#wsPaper [data-v="legal"]').click()); await wait(250);
  r = await panel(); assert.ok(/Fits on one landscape page/.test(r.layout), 'Legal: ' + r.layout); assert.ok(!r.cut);
  await p.evaluate(() => document.querySelector('#wsPaper [data-v="a4"]').click()); await wait(250);
  r = await panel(); assert.ok(/2 landscape pages/.test(r.layout), 'A4: ' + r.layout);
  await p.evaluate(() => document.querySelector('#wsPaper [data-v="8.5x16"]').click()); await wait(250);
  r = await panel(); assert.ok(/Fits on one landscape page/.test(r.layout), '8.5x16: ' + r.layout);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.wrap().api.summary())), sum0, 'paper never changes the shape');

  // approve, then a paper change leaves it approved but a moved plant does not
  await p.evaluate(() => document.getElementById('wsApprove').click()); await wait(200);
  assert.equal((await p.evaluate(() => window.__ink.wrap().api.approval())).state, 'ok');
  await p.evaluate(() => document.querySelector('#wsPaper [data-v="letter"]').click()); await wait(250);
  assert.equal((await p.evaluate(() => window.__ink.wrap().api.approval())).state, 'ok', 'paper change keeps the approval');
  assert.ok(/Approved for the stencil/.test((await panel()).approved));
  await p.evaluate(() => { const W = window.__ink.wrap().api; window.__ink.commitTest && 0; W.reg().art.pieces[0].x += 4; window.__ink.wrap().refresh(); }); await wait(200);
  r = await p.evaluate(() => window.__ink.wrap().api.approval()); assert.equal(r.state, 'stale', 'a moved plant needs approving again'); assert.ok(/design changed/.test(r.why));
  assert.ok(/Approve it again/.test((await panel()).approved));
  await p.evaluate(() => { const W = window.__ink.wrap().api; W.reg().art.pieces[0].x -= 4; window.__ink.wrap().refresh(); }); await wait(200);
  assert.equal((await p.evaluate(() => window.__ink.wrap().api.approval())).state, 'ok', 'back where it was');

  // the stencil on Letter: two pages, each the right size, the square, the words, new lines only
  r = await p.evaluate(async () => window.__ink.wrap().api.makePrint('stencil'));
  assert.equal(r.pages, 2); assert.equal(r.dpi, 300);
  assert.ok(await p.evaluate(() => !!document.getElementById('wsSendPrint')), 'made ahead, Print or share shown');
  let pdf = Buffer.from(await p.evaluate(() => window.__ink.wrap().api.printBase64()), 'base64'), text = pdf.toString('latin1');
  writeFileSync('shots/t119-stencil.pdf', pdf);
  const boxes = [...text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [+m[1], +m[2]]);
  assert.deepEqual(boxes, [[792, 612], [792, 612]], 'Letter landscape pages: ' + JSON.stringify(boxes));
  assert.equal([...text.matchAll(/ 72 72 re S/g)].length, 2, '1 in square on each page');
  assert.ok(text.includes('(Print at 100% / Actual size.') && text.includes('Approved for the stencil'));
  const cm = [...text.matchAll(/q (-?[\d.]+) 0 0 ([\d.]+) (-?[\d.]+) (-?[\d.]+) cm \/Art Do Q/g)];
  assert.equal(cm.length, 2); for (const m of cm) { assert.ok(Math.abs(+m[1] - 307.47 / 25.4 * 72) < 0.2 && Math.abs(+m[2] - 126.21 / 25.4 * 72) < 0.2, 'art at real size ' + m[1] + ' ' + m[2]); }
  const img = (t, buf) => { const at = t.indexOf('/Subtype /Image'), w = +t.slice(at).match(/\/Width (\d+)/)[1], h = +t.slice(at).match(/\/Height (\d+)/)[1], len = +t.slice(at).match(/\/Length (\d+)/)[1], s = t.indexOf('stream\n', at) + 7; return { w, h, cs: t.slice(at).match(/\/ColorSpace \/(\w+)/)[1], data: inflateSync(buf.subarray(s, s + len)) }; };
  let im = img(text, pdf);
  assert.equal(im.cs, 'DeviceGray'); assert.equal(im.w, Math.round(307.47 / 25.4 * 300)); assert.equal(im.data.length, im.w * im.h);
  let black = 0, mid = 0; for (const v of im.data) { if (v === 0) black++; else if (v !== 255) mid++; }
  assert.ok(black > 2000 && mid === 0, `clean black lines only (${black} black, ${mid} grey)`);
  // the old cactus is not on the stencil: nothing black where its ink sits (the back of the leg)
  const inkAt = await p.evaluate(() => { const W = window.__ink.wrap().api, t = W.tpl(), b = t.bounds, q = W.landmarkAt('base'); return [(q[0] - b.minX) / b.w, (b.maxY - q[1] - 15) / b.h]; });
  { const cx = Math.round(inkAt[0] * im.w), cy = Math.round(inkAt[1] * im.h); let k = 0; for (let y = cy - 30; y < cy + 30; y++) for (let x = cx - 30; x < cx + 30; x++) if (im.data[y * im.w + x] === 0) k++; assert.equal(k, 0, 'no old ink on the stencil'); }
  // a moved join
  await p.evaluate(() => window.__ink.wrap().api.setPrint({ cuts: [{ axis: 'x', at: 120 }] })); await wait(200);
  r = await p.evaluate(() => window.__ink.wrap().api.printLayout());
  assert.ok(Math.abs(r.cuts.x[0] - 120) < 1e-6 && Math.abs(r.tiles[0].x1 - 125) < 1e-6 && Math.abs(r.tiles[1].x0 - 115) < 1e-6, 'join moved, still 10 mm overlap');
  assert.ok(await p.evaluate(() => !!document.getElementById('wsCutsReset')), 'Even joins');
  // mirror once
  await p.evaluate(() => window.__ink.wrap().api.setPrint({ mirror: true })); await wait(200);
  await p.evaluate(async () => window.__ink.wrap().api.makePrint('stencil'));
  text = Buffer.from(await p.evaluate(() => window.__ink.wrap().api.printBase64()), 'base64').toString('latin1');
  assert.ok(+text.match(/q (-?[\d.]+) 0 0 [\d.]+ [\d.-]+ [\d.-]+ cm \/Art Do Q/)[1] < 0 && text.includes('Mirrored here once'), 'mirrored once');
  await p.evaluate(() => window.__ink.wrap().api.setPrint({ mirror: false })); await wait(200);

  // the placement guide on Legal: one page, in colour, with the outline
  await p.evaluate(() => document.querySelector('#wsPaper [data-v="legal"]').click()); await wait(250);
  r = await p.evaluate(async () => window.__ink.wrap().api.makePrint('guide'));
  assert.equal(r.pages, 1);
  pdf = Buffer.from(await p.evaluate(() => window.__ink.wrap().api.printBase64()), 'base64'); text = pdf.toString('latin1');
  writeFileSync('shots/t119-guide.pdf', pdf);
  assert.deepEqual([...text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [+m[1], +m[2]]), [[1008, 612]], 'Legal landscape');
  im = img(text, pdf); assert.equal(im.cs, 'DeviceRGB');
  assert.ok(text.includes('placement guide, not a stencil') && !text.includes('Mirrored'));
  { // the old ink is on the guide
    const cx = Math.round(inkAt[0] * im.w), cy = Math.round(inkAt[1] * im.h); let k = 0; for (let y = cy - 30; y < cy + 30; y++) for (let x = cx - 30; x < cx + 30; x++) { const o = (y * im.w + x) * 3; if (im.data[o] < 120 && im.data[o + 2] < 120) k++; } assert.ok(k > 50, 'old ink on the guide ' + k);
  }
  await p.screenshot({ path: 'shots/t119-guide-panel.png' });

  // fitting check, and undo
  await p.evaluate(() => { document.getElementById('wsFitNote').value = 'Top ring 5 mm short'; document.getElementById('wsFitNo').click(); }); await wait(200);
  r = await p.evaluate(() => window.__ink.wrap().api.reg().fitted); assert.ok(r && r.ok === false && r.note === 'Top ring 5 mm short');
  assert.ok(/Did not fit/.test(await p.evaluate(() => document.getElementById('wsFitText').textContent)));
  await p.evaluate(() => document.getElementById('wsFitYes').click()); await wait(200);
  assert.equal(await p.evaluate(() => window.__ink.wrap().api.reg().fitted.ok), true);
  await p.evaluate(() => window.__ink.undo()); await wait(300);
  assert.equal(await p.evaluate(() => window.__ink.wrap().api.reg().fitted.ok), false, 'undo the fit');

  // 44 pt targets, tattoos untouched, and everything kept after reload
  const small = await p.evaluate(() => [...document.querySelectorAll('#wrapStudio .btn, #wrapStudio ink-slider')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43).map((b) => b.textContent || b.tagName));
  assert.deepEqual(small, [], 'no small targets');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), tattoosBefore, 'tattoos untouched');
  await p.evaluate(async () => { await window.__ink.flush(); });
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  r = await p.evaluate(() => { const g = window.__ink.state().regions[0]; return { print: g.print, approved: !!g.approved && !!g.approved.sig, fitted: g.fitted }; });
  assert.equal(r.print.paper, 'legal'); assert.deepEqual(r.print.cuts, [{ axis: 'x', at: 120 }]); assert.ok(r.approved, 'approval kept with its design check'); assert.equal(r.fitted.ok, false);
  console.log('t119 wrap print PASS');
}
