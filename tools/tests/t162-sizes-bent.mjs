// t162 a bent tattoo's size reads the same everywhere: the size under its name already gives the box the bent
// piece fills on the skin, and now Picture with sizes, Three sizes, the plan as a message, the page for approval,
// the everyday size and Time to tattoo give that size too (they gave the flat file's), and Try on with camera
// shows the bent picture at that size (it showed the flat file).
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  // a fake camera, so Try on opens as it would on the iPad
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d'); g.fillStyle = '#d9a888'; g.fillRect(0, 0, 640, 480); navigator.mediaDevices.getUserMedia = async () => c.captureStream(10); });
  const n0 = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 400, 200);
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'block.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, n0);
  const id = (await st()).tattoos.at(-1).id;
  await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id); await wait(300);
  // only this one shows, planned, so every list holds just it
  await p.evaluate((i) => { const s = window.__ink.state(); for (const t of s.tattoos) { t.hidden = t.id !== i; } s.tattoos.find((t) => t.id === i).status = 'planned'; window.__ink.select(i); window.__ink.commitTest(); }, id); await wait(500);
  const plain = await p.evaluate((i) => ({ like: window.__ink.like(i).text, est: window.__ink.estimate(i) }), id);
  // bend it into half its width, as Bend and warp does
  await p.evaluate((i) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, id); await wait(900);
  const t = (await st()).tattoos.find((q) => q.id === id), k = (await st()).heightCm / 175;
  const wIn = t.width * 0.5 * 100 * k / 2.54, hIn = t.width / t.aspect * 100 * k / 2.54, W = wIn.toFixed(1), H = hIn.toFixed(1);
  assert.match(await p.$eval('#size', (e) => e.textContent), new RegExp(`${W} × ${H} in`), 'the size under the name is the bent size');

  // the plan as a message
  const msg = await p.evaluate(() => window.__ink.planMessage());
  assert.match(msg, new RegExp(`${W} × ${H} in`), 'the plan as a message gives the bent size: ' + msg);

  // Picture with sizes
  await p.click('#shareBtn'); await wait(300); await p.click('#cLabels'); await wait(1500);
  const L = await p.evaluate(() => window.__ink.labels());
  assert(L && L.length === 1, 'one label: ' + JSON.stringify(L));
  assert.match(L[0].lines[1], new RegExp(`^${W} × ${H} in`), 'the label gives the bent size: ' + L[0].lines[1]);
  await p.keyboard.press('Escape'); await wait(400);

  // Three sizes: the middle one is the bent width as it is
  await p.click('#shareBtn'); await wait(300); await p.click('#cSizes'); await wait(1500);
  const S = await p.evaluate(() => window.__ink.sizes());
  assert(S && S.sizes.some((v) => Math.abs(v - wIn) < 0.02), `three sizes start from the bent width ${W}: ${JSON.stringify(S && S.sizes)}`);
  assert.equal((await st()).tattoos.find((q) => q.id === id).width, t.width, 'the tattoo is put back exactly');
  await p.keyboard.press('Escape'); await wait(400);

  // the page for approval
  await p.click('#shareBtn'); await wait(300); await p.click('#cApprove');
  await p.waitForFunction(() => window.__ink.approval() && window.__ink.approval().html, { timeout: 30000 });
  const html = await p.evaluate(() => window.__ink.approval().html);
  const f = (v) => (v < 10 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString());
  assert(html.includes(`${f(wIn)} x ${f(hIn)} in`), `the approval page gives the bent size ${f(wIn)} x ${f(hIn)}`);
  await p.keyboard.press('Escape'); await wait(400);

  // the everyday size and the time to tattoo follow the smaller piece
  const bent = await p.evaluate((i) => ({ like: window.__ink.like(i).text, est: window.__ink.estimate(i) }), id);
  assert.notEqual(bent.like, plain.like, `the everyday size changes with the bend: ${plain.like} -> ${bent.like}`);
  assert(bent.est.hi < plain.est.hi, `half the size takes less time: ${plain.est.hi} -> ${bent.est.hi}`);

  // Width (inches) shows the bent width, and 2 in makes the bent piece 2 inches wide on the skin
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(300);
  assert.equal(await p.$eval('#exactWidth', (e) => e.value), wIn.toFixed(2), 'the width box gives the bent width');
  await p.$eval('[data-inch="2"]', (e) => e.click()); await wait(500);
  assert.match(await p.$eval('#size', (e) => e.textContent), /^≈ 2\.0 × /, 'the 2 in button makes the bent piece 2 in wide');
  assert.equal(await p.$eval('#exactWidth', (e) => e.value), '2.00');
  await p.click('#undo'); await wait(500);
  assert.equal((await st()).tattoos.find((q) => q.id === id).width, t.width, 'one undo puts it back');

  // Try other spots: a piece that wraps more than half way round a forearm flat fits there once bent to half its width
  const wide = (await st()).heightCm, w15 = 15 / (wide / 175 * 100); // 15 cm flat, 7.5 cm bent, on a forearm about 25 cm round
  await p.evaluate((i, w) => { const q = window.__ink.state().tattoos.find((x) => x.id === i); q.width = w; window.__ink.commitTest(); }, id, w15); await wait(400);
  await p.$eval('#bSpots', (e) => e.click()); await wait(600);
  const bentNotes = await p.evaluate(() => window.__ink.spotNotes());
  await p.evaluate((i) => { const q = window.__ink.state().tattoos.find((x) => x.id === i); q.warp0 = q.warp; delete q.warp; window.__ink.commitTest(); }, id); await wait(600);
  await p.keyboard.press('Escape'); await wait(300); await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await p.$eval('#bSpots', (e) => e.click()); await wait(600);
  const flatNotes = await p.evaluate(() => window.__ink.spotNotes());
  await p.evaluate((i) => { const q = window.__ink.state().tattoos.find((x) => x.id === i); q.warp = q.warp0; delete q.warp0; window.__ink.commitTest(); }, id); await wait(400);
  assert.match(flatNotes['forearm-front'], /wraps|too wide/, 'the flat 15 cm piece wraps the forearm: ' + flatNotes['forearm-front']);
  assert.doesNotMatch(bentNotes['forearm-front'], /wraps|too wide/, 'bent to 7.5 cm it fits: ' + bentNotes['forearm-front']);
  await p.keyboard.press('Escape'); await wait(300);
  await p.evaluate((i, w) => { const q = window.__ink.state().tattoos.find((x) => x.id === i); q.width = w; window.__ink.commitTest(); }, id, t.width); await wait(400);

  // Try on with camera: the bent picture, at the bent size
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(200);
  await p.$eval('#bTryOn', (e) => e.click()); await wait(1200);
  assert.equal(await p.$eval('#tryOn', (e) => e.hidden), false, 'Try on opens');
  const to = await p.evaluate(() => { const c = document.querySelector('#toArt'); return { w: c.width, h: c.height, text: document.querySelector('#toText').textContent }; });
  assert(Math.abs(to.w / to.h - wIn / hIn) < 0.06, `Try on shows the bent shape (${(to.w / to.h).toFixed(2)} for ${(wIn / hIn).toFixed(2)})`);
  assert(to.text.includes(`${W} × ${H} in`), 'Try on gives the bent size: ' + to.text);
  await p.$eval('#toClose', (e) => e.click()); await wait(300);
  console.log('PASS t162 a bent tattoo reads its bent size in Picture with sizes, Three sizes, the plan as a message, the approval page, the everyday size, Time to tattoo, the width box and 2 in button, Try other spots, and Try on with camera');
}
