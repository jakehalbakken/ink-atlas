// Layers the Procreate way (2026-11-22, Jake: "Look at the way procreate handles layers being able to
// swipe or duplicate and merge. I want the same"), driven by touch: tap the selected line for its
// options (name, Zoom to it, Duplicate, Merge down, Delete...), swipe a line left for Lock, Duplicate
// and Delete, swipe right to pick lines and Merge them from the bar, pinch two lines together to merge
// them, Merge down, press and hold to drag a line to a new place. Duplicate keeps bend and place;
// merging keeps the ink looking the same on the body (compared pixel by pixel) and is one undo step.
// 44 pt at both iPad orientations. Run: node tools/shot.mjs shots/t156.png tools/tests/t156-layer-gestures.mjs
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id], i) => ({ x, y, id: id || i + 1, radiusX: 8, radiusY: 8, force: 1 })) });
  const S = () => p.evaluate(() => window.__ink.state());
  const ids = async () => (await S()).tattoos.map((t) => t.id);
  const listIds = () => p.$$eval('#ldList .ld-row[data-id]', (rs) => rs.map((r) => r.dataset.id));
  const lineBox = (id) => p.$eval(`#ldList .ld-row[data-id="${id}"] .ld-track`, (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const undoLen = () => p.evaluate(() => window.__ink.undoLen());
  async function swipe(id, dx) {
    const b = await lineBox(id), x = b.x + b.w * (dx < 0 ? 0.62 : 0.3), y = b.y + b.h / 2;
    const at = await p.evaluate(([x, y, id]) => { const e = document.elementFromPoint(x, y); return e && e.closest(`.ld-row[data-id="${id}"]`) ? '' : (e ? e.outerHTML.slice(0, 160) : 'nothing'); }, [x, y, id]);
    assert.equal(at, '', 'the line to swipe is in sight');
    await touch('touchStart', [[x, y]]); for (let i = 1; i <= 10; i++) { await touch('touchMove', [[x + dx * i / 10, y + i * 0.3]]); await wait(16); }
    await touch('touchEnd', []); await wait(450);
  }
  const big = (sel) => p.$$eval(sel, (es) => es.filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim() || e.getAttribute('aria-label'), Math.round(r.width), Math.round(r.height)]; }));
  const all44 = async (sel) => { const r = await big(sel); assert.ok(r.length, sel + ' shows'); for (const [n, w, h] of r) assert.ok(w >= 44 && h >= 44, `${sel} "${n}" is ${w}x${h}`); };
  if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }

  // the sample sun on the chest is the piece to work with
  const sun = (await S()).tattoos.find((t) => /Sunburst/.test(t.name)).id;
  await p.click(`#ldList .ld-tat[data-id="${sun}"]`); await wait(700);
  assert.equal(await p.evaluate(() => window.__ink.selected()), sun, 'the first tap selects');
  // tapping the selected line opens its options, and Zoom to it is among them
  await p.click(`#ldList .ld-tat[data-id="${sun}"]`); await wait(400);
  const acts = await p.$$eval(`#ldList .ld-row[data-id="${sun}"] .ld-acts .btn`, (bs) => bs.map((b) => b.textContent.trim()));
  for (const w of ['Zoom to it', 'Duplicate', 'Merge down', 'Blend and colour', 'Delete', 'Move earlier', 'Move later', 'On my skin', 'Planned']) assert.ok(acts.includes(w), 'options have ' + w + ': ' + acts);
  await all44(`#ldList .ld-row[data-id="${sun}"] .ld-acts .btn, #ldList .ld-row[data-id="${sun}"] .ld-acts .ld-name`);
  assert.ok(await p.$eval('#ldList .ld-acts .ld-name', (e) => parseFloat(getComputedStyle(e).fontSize) >= 16), 'the name box is 16 px or more, so the iPad does not zoom');
  // rename in place: one undo step
  const u0 = await undoLen();
  await p.$eval('#ldList .ld-acts .ld-name', (e) => { e.value = 'Big sun'; e.dispatchEvent(new Event('change')); }); await wait(300);
  assert.equal((await S()).tattoos.find((t) => t.id === sun).name, 'Big sun'); assert.equal(await undoLen(), u0 + 1, 'rename is one undo step');
  // Zoom to it brings the view to the tattoo and closes the options
  await p.evaluate(() => [...document.querySelectorAll('#ldList .ld-acts .btn')].find((b) => b.textContent === 'Zoom to it').click()); await wait(500);
  assert.equal(await p.$('#ldList .ld-acts'), null, 'the options close');
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 8000 }).catch(() => {});

  // swipe left: Lock, Duplicate and Delete behind the line, each 44 pt or more
  await swipe(sun, -170);
  // under a heavily loaded test machine the first move can land after the press-and-hold time, which
  // starts a drag instead: swipe again once in that case
  if (!(await p.$(`#ldList .ld-row[data-id="${sun}"] .ld-swipe`))) { await wait(600); await swipe(sun, -170); }
  assert.ok(await p.$(`#ldList .ld-row[data-id="${sun}"] .ld-swipe`), 'the actions show behind the line');
  const shift = await p.$eval(`#ldList .ld-row[data-id="${sun}"] .ld-line`, (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
  assert.ok(shift < -150, 'the line slid left: ' + shift);
  await all44(`#ldList .ld-row[data-id="${sun}"] .ld-swipe button`);
  assert.deepEqual((await big(`#ldList .ld-row[data-id="${sun}"] .ld-swipe button`)).map((x) => x[0]), ['Lock', 'Duplicate', 'Delete']);
  await p.screenshot({ path: 'shots/t156-swipe.png' });
  // Duplicate: an exact copy in the same place, listed right under it, selected
  await p.click(`#ldList .ld-row[data-id="${sun}"] .ld-swipe .sw-dup`); await wait(600);
  let st = await S(); assert.equal(st.tattoos.length, 3, 'one more tattoo');
  const iSun = st.tattoos.findIndex((t) => t.id === sun), copy = st.tattoos[iSun + 1];
  assert.equal(copy.name, 'Big sun copy'); assert.deepEqual(copy.pos, st.tattoos[iSun].pos, 'same place'); assert.equal(copy.width, st.tattoos[iSun].width);
  assert.equal(await p.evaluate(() => window.__ink.selected()), copy.id, 'the copy is selected');
  assert.equal(await p.$(`#ldList .ld-swipe`), null, 'the swipe closes after an action');
  // a tap on another line while one is swiped open only closes it
  await swipe(copy.id, -170); assert.ok(await p.$('#ldList .ld-swipe'));
  const ob = await lineBox(sun); // the line above, in sight above the edit sheet
  assert.ok(await p.evaluate(([x, y]) => !!document.elementFromPoint(x, y).closest('#ldList'), [ob.x + 60, ob.y + ob.h / 2]), 'that line is in sight');
  await touch('touchStart', [[ob.x + 60, ob.y + ob.h / 2]]); await touch('touchEnd', []); await wait(450);
  assert.equal(await p.$('#ldList .ld-swipe'), null, 'closed'); assert.equal(await p.evaluate(() => window.__ink.selected()), copy.id, 'and nothing else changed');
  // Delete from the swipe, then Undo brings it back
  await swipe(copy.id, -170); await p.click(`#ldList .ld-row[data-id="${copy.id}"] .ld-swipe .sw-del`); await wait(500);
  assert.equal((await S()).tattoos.length, 2, 'deleted'); await p.click('#undo'); await wait(600); assert.equal((await S()).tattoos.length, 3, 'undo brings it back');

  // make the copy different: moved 4 cm right on the skin, turned and bent, so merging has real work
  await p.evaluate(({ sun, cid }) => {
    const s = structuredClone(window.__ink.state()), a = s.tattoos.find((t) => t.id === sun), c = s.tattoos.find((t) => t.id === cid);
    const h = window.__ink.surfaceAt([a.pos[0] - 0.045, a.pos[1] - 0.02, a.pos[2] + 0.2], [0, 0, -1]); c.pos = h.pos; c.normal = h.normal; c.rot = 0.6; c.bend = 0.5; c.width = 0.08; c.opacity = 0.7;
    window.__ink.loadState(s);
  }, { sun, cid: copy.id }); await wait(800);
  await p.evaluate(() => window.__ink.select(null)); await wait(500);
  // a picture of the chest as it looks now, to compare after the merge
  const c0 = await p.evaluate((id) => window.__ink.screenOfPos(window.__ink.state().tattoos.find((t) => t.id === id).pos), sun);
  const clip = { x: Math.max(0, Math.round(c0.x - 150)), y: Math.max(0, Math.round(c0.y - 150)), width: 300, height: 300 };
  const grab = async () => { const b64 = await p.screenshot({ clip, encoding: 'base64' }); return p.evaluate(async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return [...g.getImageData(0, 0, c.width, c.height).data]; }, b64); };
  const before = await grab();

  // swipe right picks lines; the bar offers Merge, Group, Delete
  await swipe(sun, 140);
  let picked = await p.evaluate(() => window.__ink.layersDock().picked()); assert.deepEqual(picked, [sun], 'a swipe right picks it');
  await swipe(copy.id, 140);
  picked = await p.evaluate(() => window.__ink.layersDock().picked()); assert.deepEqual(picked.sort(), [sun, copy.id].sort());
  assert.match(await p.$eval('#ldPickBar b', (e) => e.textContent), /2 picked/);
  await all44('#ldPickBar .btn, #ldPickBar .ld-tiles button');
  await p.screenshot({ path: 'shots/t156-picked.png' });
  // swipe right again unpicks
  await swipe(copy.id, 140); assert.deepEqual(await p.evaluate(() => window.__ink.layersDock().picked()), [sun]); await swipe(copy.id, 140);
  const uM = await undoLen();
  await p.evaluate(() => document.querySelector('#ldPickBar .ld-tiles button[aria-label^="Merge"]').click());
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n, { timeout: 15000 }, 2); await wait(800);
  st = await S(); const merged = st.tattoos.find((t) => t.id === copy.id);
  assert.ok(merged, 'the lower line is the one kept'); assert.ok(!st.tattoos.some((t) => t.id === sun), 'the other is merged in');
  assert.equal(merged.bend, undefined, 'the bend is in the picture now'); assert.equal(merged.opacity, 1); assert.ok(merged.versions && merged.versions.length >= 1, 'the earlier picture is kept as a version');
  assert.equal(await undoLen(), uM + 1, 'one undo step');
  assert.equal(await p.$('#ldPickBar'), null, 'the bar goes once merged');
  await p.evaluate(() => window.__ink.select(null)); await wait(600);
  const after = await grab();
  let sum = 0, off = 0, n = 0; for (let i = 0; i < before.length; i += 4) { const d = (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2])) / 3; sum += d; if (d > 40) off++; n++; }
  console.log(`merge looks the same: mean difference ${(sum / n).toFixed(2)}, ${(100 * off / n).toFixed(2)}% of pixels off by more than 40`);
  assert.ok(sum / n < 3, 'the merged tattoo looks the same on the body: ' + (sum / n).toFixed(2));
  assert.ok(off / n < 0.02, 'hardly a pixel is off: ' + (100 * off / n).toFixed(2) + '%');
  await p.screenshot({ path: 'shots/t156-merged.png' });
  await p.click('#undo'); await wait(800); assert.equal((await S()).tattoos.length, 3, 'undo puts both back');
  assert.ok((await S()).tattoos.find((t) => t.id === copy.id).bend, 'with the bend');

  // pinch two lines together: they merge
  const order = await listIds(); const [r1, r2] = [order.indexOf(sun), order.indexOf(copy.id)];
  assert.ok(r1 >= 0 && r2 >= 0);
  const b1 = await lineBox(sun), b2 = await lineBox(copy.id), x = b1.x + b1.w * 0.4, y1 = b1.y + b1.h / 2, y2 = b2.y + b2.h / 2;
  await touch('touchStart', [[x, y1, 1]]); await touch('touchStart', [[x, y1, 1], [x, y2, 2]]);
  for (let i = 1; i <= 10; i++) { const k = i / 10 * 0.42; await touch('touchMove', [[x, y1 + (y2 - y1) * k, 1], [x, y2 - (y2 - y1) * k, 2]]); await wait(20); }
  assert.match(await p.$eval('#layersDock .ld-hint', (e) => e.textContent), /Let go to merge 2/);
  await touch('touchEnd', []);
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n, { timeout: 15000 }, 2); await wait(600);
  assert.ok((await S()).tattoos.some((t) => t.id === copy.id), 'pinched into the lower line');
  await p.click('#undo'); await wait(800); assert.equal((await S()).tattoos.length, 3);

  // a pinch that does not come together enough changes nothing
  await touch('touchStart', [[x, y1, 1]]); await touch('touchStart', [[x, y1, 1], [x, y2, 2]]);
  for (let i = 1; i <= 5; i++) { const k = i / 5 * 0.12; await touch('touchMove', [[x, y1 + (y2 - y1) * k, 1], [x, y2 - (y2 - y1) * k, 2]]); await wait(20); }
  await touch('touchEnd', []); await wait(700); assert.equal((await S()).tattoos.length, 3, 'a small pinch merges nothing');

  // Merge down from the options
  await p.click(`#ldList .ld-tat[data-id="${sun}"]`); await wait(500);
  if (await p.evaluate(() => window.__ink.selected()) !== sun) { await p.click(`#ldList .ld-tat[data-id="${sun}"]`); await wait(500); }
  if (!(await p.$(`#ldList .ld-row[data-id="${sun}"] .ld-acts`))) { await p.click(`#ldList .ld-tat[data-id="${sun}"]`); await wait(400); }
  const below = (await listIds())[(await listIds()).indexOf(sun) + 1];
  await p.evaluate((id) => [...document.querySelectorAll(`#ldList .ld-row[data-id="${id}"] .ld-acts .btn`)].find((b) => b.textContent === 'Merge down').click(), sun);
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n, { timeout: 15000 }, 2); await wait(600);
  assert.ok((await S()).tattoos.some((t) => t.id === below) && !(await S()).tattoos.some((t) => t.id === sun), 'merged down into the line below');
  await p.click('#undo'); await wait(800);

  // a planned tattoo and one on my skin are never merged
  const other = (await S()).tattoos.find((t) => /Sprig/.test(t.name)).id;
  await p.evaluate(({ a }) => { const s = structuredClone(window.__ink.state()); s.tattoos.find((t) => t.id === a).status = 'existing'; window.__ink.loadState(s); window.__ink.select(null); }, { a: other }); await wait(600);
  const nBefore = (await S()).tattoos.length;
  await swipe(sun, 140); await swipe(other, 140);
  await p.evaluate(() => document.querySelector('#ldPickBar .ld-tiles button[aria-label^="Merge"]').click()); await wait(800);
  assert.equal((await S()).tattoos.length, nBefore, 'refused');
  assert.match(await p.evaluate(() => document.querySelector('#toast')?.textContent || ''), /one kind/);

  // press and hold, then drag a line to a new place
  const o0 = await listIds(), first = o0[0], last = o0[o0.length - 1], fb = await lineBox(first), lb = await lineBox(last);
  await touch('touchStart', [[fb.x + 80, fb.y + fb.h / 2]]); await wait(560);
  assert.ok(await p.$eval(`#ldList .ld-row[data-id="${first}"]`, (e) => e.classList.contains('ld-drag')), 'the line lifts after a hold');
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [[fb.x + 80, fb.y + fb.h / 2 + (lb.y + lb.h * 0.8 - fb.y - fb.h / 2) * i / 12]]); await wait(20); }
  assert.ok(await p.$('#ldList .ld-drop:not([hidden])'), 'a line shows where it lands');
  const uD = await undoLen(); await touch('touchEnd', []); await wait(600);
  const o1 = await listIds(); assert.equal(o1[o1.length - 1], first, 'dragged to the end: ' + o1); assert.equal(await undoLen(), uD + 1, 'one undo step');
  await p.click('#undo'); await wait(600); assert.deepEqual(await listIds(), o0, 'undo puts it back');
  // a plain drag up or down still scrolls, it does not lift a line
  await touch('touchStart', [[fb.x + 80, fb.y + fb.h / 2]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[fb.x + 80, fb.y + fb.h / 2 + i * 8]]); await wait(16); } await touch('touchEnd', []); await wait(500);
  assert.deepEqual(await listIds(), o0, 'a quick drag moves nothing');

  // upright iPad: the same swipe, 44 pt
  await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, hasTouch: true }); await wait(900);
  if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }
  await swipe(sun, -170); await all44(`#ldList .ld-row[data-id="${sun}"] .ld-swipe button`);
  await p.screenshot({ path: 'shots/t156-portrait.png' });
  const errs = await p.evaluate(() => window.__errors || []); assert.deepEqual(errs.filter((e) => !/ResizeObserver/.test(e)), [], 'no page errors');
  console.log('t156 layer gestures: all good');
}
