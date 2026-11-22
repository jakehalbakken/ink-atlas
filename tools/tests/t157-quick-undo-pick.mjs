// Procreate's quick undo and picking several layers (2026-11-22, Jake: "I want to be able to double
// tap to undo like in procreate" and "on layers I want to be able to select multiple on them and the
// either delete hide duplicate Group, etc. and I want layer views of what's already on me versus
// planned and all view"). Driven by touch: a two-finger tap on the body undoes, a three-finger tap
// redoes, holding two fingers still keeps undoing, and a pinch or a pan never undoes; the same taps
// work in Clean up. In Layers, Select picks lines with a tap, Pick all, and the bar hides, shows,
// duplicates, groups and ungroups, locks, opens the full sheet with them ticked, and deletes, asking
// first when any is on my skin, each one undo step. All, On my skin and Planned change only the
// screen. 44 pt at both iPad orientations.
// Run: node tools/shot.mjs shots/t157.png tools/tests/t157-quick-undo-pick.mjs
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id], i) => ({ x, y, id: id || i + 1, radiusX: 8, radiusY: 8, force: 1 })) });
  const S = () => p.evaluate(() => window.__ink.state());
  const undoLen = () => p.evaluate(() => window.__ink.undoLen());
  const redoOn = () => p.$eval('#redo', (e) => !e.disabled);
  const big = (sel) => p.$$eval(sel, (es) => es.filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim() || e.getAttribute('aria-label'), Math.round(r.width), Math.round(r.height)]; }));
  const all44 = async (sel) => { const r = await big(sel); assert.ok(r.length, sel + ' shows'); for (const [n, w, h] of r) assert.ok(w >= 44 && h >= 44, `${sel} "${n}" is ${w}x${h}`); };
  const tapWith = async (pts, hold = 0) => { await touch('touchStart', pts); if (hold) await wait(hold); await touch('touchEnd', []); await wait(350); };
  const tried = () => p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }

  const st0 = await S(), sun = st0.tattoos.find((t) => /Sunburst/.test(t.name)).id, other = st0.tattoos.find((t) => t.id !== sun).id;
  // an empty spot on the canvas, clear of the body and the panels
  const spot = await p.evaluate(() => { for (const [x, y] of [[140, 420], [180, 560], [120, 300], [220, 680]]) { const e = document.elementFromPoint(x, y), e2 = document.elementFromPoint(x + 70, y); if (e && e.tagName === 'CANVAS' && e2 && e2.tagName === 'CANVAS') return [x, y]; } return null; });
  assert.ok(spot, 'found canvas to tap on');
  const [x, y] = spot;

  // three undo steps from the Layers eye
  const u0 = await undoLen();
  for (let i = 0; i < 3; i++) { await p.click(`#ldList .ld-row[data-id="${sun}"] .ld-eye`); await wait(300); }
  assert.equal(await undoLen(), u0 + 3, 'three steps to undo');
  assert.equal((await S()).tattoos.find((t) => t.id === sun).hidden, true);

  // a two-finger tap undoes one step
  await tapWith([[x, y, 1], [x + 70, y, 2]]);
  assert.equal(await undoLen(), u0 + 2, 'two-finger tap undoes one step');
  assert.equal(!!(await S()).tattoos.find((t) => t.id === sun).hidden, false);
  assert.ok(await redoOn(), 'and it can be redone');
  // a three-finger tap redoes it
  await tapWith([[x, y, 1], [x + 50, y, 2], [x + 25, y + 50, 3]]);
  assert.equal(await undoLen(), u0 + 3, 'three-finger tap redoes');
  assert.equal(await redoOn(), false);
  assert.ok((await tried()).includes('tapUndo'), 'ticks New to try');

  // a pinch and a two-finger pan never undo, and leave no step behind
  const cam0 = await p.evaluate(() => window.__ink.cam());
  await touch('touchStart', [[x, y, 1], [x + 70, y, 2]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[x - 10 - i * 6, y, 1], [x + 80 + i * 6, y, 2]]); await wait(16); }
  await touch('touchEnd', []); await wait(400);
  assert.equal(await undoLen(), u0 + 3, 'a pinch does not undo');
  await touch('touchStart', [[x, y, 1], [x + 70, y, 2]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[x, y + 15 + i * 5, 1], [x + 70, y + 15 + i * 5, 2]]); await wait(16); }
  await touch('touchEnd', []); await wait(400);
  assert.equal(await undoLen(), u0 + 3, 'a pan does not undo');
  assert.notDeepEqual(await p.evaluate(() => window.__ink.cam()), cam0, 'the view did move');
  // a slow two-finger touch that lifts late is not a tap
  await tapWith([[x, y, 1], [x + 70, y, 2]], 520);
  assert.equal(await undoLen(), u0 + 3, 'a long touch that is let go before the hold is not a tap');

  // holding two fingers still keeps undoing
  await touch('touchStart', [[x, y, 1], [x + 70, y, 2]]); await wait(1450); await touch('touchEnd', []); await wait(400);
  assert.ok(await undoLen() <= u0 + 1, 'holding undid two or more steps: ' + (await undoLen() - u0));
  assert.equal(!!(await S()).tattoos.find((t) => t.id === sun).hidden, false);
  // the sheet and Layers are never touched by these taps: a two-finger tap on Layers does nothing
  const lb = await p.$eval('#ldList', (e) => { const r = e.getBoundingClientRect(); return [r.left + 40, r.top + 20]; });
  const uh = await undoLen();
  await tapWith([[lb[0], lb[1], 1], [lb[0] + 40, lb[1], 2]]);
  assert.equal(await undoLen(), uh, 'a two-finger tap on the Layers panel does not undo');

  // the same in Clean up
  await p.evaluate((id) => window.__ink.select(id), sun); await wait(500);
  await p.click('#bCleanup'); await p.waitForSelector('#ink-cleanup canvas'); await wait(500);
  await p.click('#ink-cleanup [data-mode=color]'); await wait(200); await p.click('#ink-cleanup [data-action=paper]'); await wait(900);
  const icUndo = () => p.$eval('#ink-cleanup [data-action=undo]', (e) => !e.disabled), icRedo = () => p.$eval('#ink-cleanup [data-action=redo]', (e) => !e.disabled);
  assert.ok(await icUndo(), 'Clean up has a step to undo');
  await p.evaluate(() => { const s = document.querySelector('#ink-cleanup .ic-work'); s.setPointerCapture = () => {}; s.hasPointerCapture = () => false; });
  const cs = await p.$eval('#ink-cleanup .ic-work', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width * 0.4, r.top + r.height * 0.5]; });
  await tapWith([[cs[0], cs[1], 1], [cs[0] + 70, cs[1], 2]]);
  assert.equal(await icUndo(), false, 'two-finger tap undoes in Clean up');
  assert.ok(await icRedo());
  await tapWith([[cs[0], cs[1], 1], [cs[0] + 50, cs[1], 2], [cs[0] + 25, cs[1] + 50, 3]]);
  assert.ok(await icUndo(), 'three-finger tap redoes in Clean up');
  await p.click('#ink-cleanup [data-action=cancel]'); await wait(200);
  if (await p.$('#ink-cleanup [data-action=discard]')) { await p.click('#ink-cleanup [data-action=discard]'); await wait(300); }
  assert.equal(await p.$('#ink-cleanup'), null, 'Clean up closed');
  await p.evaluate(() => window.__ink.select(null)); await wait(400);

  // make the sun ink on my skin, so a delete has to ask
  await p.evaluate((id) => window.__ink.select(id), sun); await wait(500);
  await p.click('#bOnSkin'); await wait(400);
  assert.equal((await S()).tattoos.find((t) => t.id === sun).status, 'existing');
  await p.evaluate(() => window.__ink.select(null)); await wait(400);

  for (const [W, H] of [[1180, 820], [820, 1180]]) {
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1, hasTouch: true }); await wait(800);
    if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }
    // the views
    await all44('#ldView button');
    // Select mode: tap lines to pick them
    await p.click('#ldSelect'); await wait(300);
    assert.equal(await p.$eval('#ldSelect', (e) => e.textContent), 'Done');
    assert.match(await p.$eval('#ldPickBar', (e) => e.textContent), /Tap lines to pick them/);
    assert.equal(await p.$$eval('#ldList .ld-pk.off', (x) => x.length), 2, 'every line shows an empty ring to pick');
    await p.click(`#ldList .ld-tat[data-id="${sun}"]`); await wait(300);
    assert.equal(await p.evaluate(() => window.__ink.selected()), null, 'picking does not select on the body');
    assert.match(await p.$eval('#ldPickBar', (e) => e.textContent), /1 picked/);
    await p.click(`#ldList .ld-tat[data-id="${other}"]`); await wait(300);
    assert.match(await p.$eval('#ldPickBar', (e) => e.textContent), /2 picked/);
    await all44('#ldPickBar .ld-tiles button, #ldPickBar .ld-pbhead .btn, #ldSelect');
    assert.deepEqual((await big('#ldPickBar .ld-tiles button')).map((x) => x[0]), ['Hide', 'Duplicate', 'Group', 'Lock', 'Merge', 'More', 'Delete']);
    await p.screenshot({ path: `shots/t157_pick_${W}x${H}.png` });
    let u = await undoLen();
    // Hide and Show
    await p.click('#ldPickBar .ld-tiles button[aria-label="Hide the 2"]'); await wait(400);
    assert.ok((await S()).tattoos.every((t) => t.hidden), 'both hidden'); assert.equal(await undoLen(), u + 1, 'one undo step');
    await p.click('#ldPickBar .ld-tiles button[aria-label="Show the 2"]'); await wait(400);
    assert.ok((await S()).tattoos.every((t) => !t.hidden), 'both shown again');
    // Group, then Ungroup
    u = await undoLen();
    await p.click('#ldPickBar .ld-tiles button[aria-label="Group the 2"]'); await wait(400);
    let st = await S(); assert.equal(st.groups.length, 1); assert.ok(st.tattoos.every((t) => t.group === st.groups[0].id), 'both in the group');
    assert.equal(await undoLen(), u + 1);
    assert.equal(await p.$$eval('#ldList .ld-ghead', (x) => x.length), 1, 'the group shows as a folder');
    await p.click('#ldPickBar .ld-tiles button[aria-label^="Take the 2 out"]'); await wait(400);
    st = await S(); assert.ok(st.tattoos.every((t) => !t.group), 'both out of it'); assert.equal((st.groups || []).length, 0, 'the empty group goes');
    // Lock acts on the planned one only (on my skin is always locked)
    await p.click('#ldPickBar .ld-tiles button[aria-label="Lock the 2"]'); await wait(400);
    assert.equal((await S()).tattoos.find((t) => t.id === other).locked, true);
    await p.click('#ldPickBar .ld-tiles button[aria-label="Unlock the 2"]'); await wait(400);
    assert.equal(!!(await S()).tattoos.find((t) => t.id === other).locked, false);
    // More opens the full sheet with them ticked
    await p.click('#ldPickBar .ld-tiles button[aria-label^="More for the 2"]'); await wait(500);
    assert.match(await p.$eval('#il-count', (e) => e.textContent), /2/, 'the sheet opens with both ticked');
    await p.click('#ink-layers [data-act="close"]'); await wait(300);
    // Duplicate both: one undo step, two new tattoos
    u = await undoLen();
    await p.click('#ldPickBar .ld-tiles button[aria-label="Duplicate the 2"]'); await wait(700);
    assert.equal((await S()).tattoos.length, 4, 'two copies'); assert.equal(await undoLen(), u + 1, 'one undo step');
    await p.click('#undo'); await wait(500);
    assert.equal((await S()).tattoos.length, 2, 'undo takes both copies away');
    // Delete asks first when one is on my skin
    if (!(await p.$('#ldPickBar .ld-tiles'))) { await p.evaluate(() => [...document.querySelectorAll('#ldPickBar button')].find((b) => b.textContent === 'Pick all').click()); await wait(300); }
    assert.match(await p.$eval('#ldPickBar', (e) => e.textContent), /2 picked/);
    await p.click('#ldPickBar .ld-tiles button[aria-label="Delete the 2"]'); await wait(300);
    assert.equal((await S()).tattoos.length, 2, 'nothing deleted yet');
    assert.match(await p.$eval('#ldPickBar .ld-ask', (e) => e.textContent), /1 of them is on your skin/);
    await all44('#ldPickBar .btn');
    await p.screenshot({ path: `shots/t157_ask_${W}x${H}.png` });
    await p.evaluate(() => [...document.querySelectorAll('#ldPickBar button')].find((b) => b.textContent === 'Cancel').click()); await wait(300);
    assert.equal((await S()).tattoos.length, 2, 'Cancel keeps them');
    await p.click('#ldPickBar .ld-tiles button[aria-label="Delete the 2"]'); await wait(300);
    u = await undoLen();
    await p.evaluate(() => [...document.querySelectorAll('#ldPickBar button')].find((b) => b.textContent === 'Delete 2').click()); await wait(600);
    assert.equal((await S()).tattoos.length, 0, 'both deleted'); assert.equal(await undoLen(), u + 1, 'one undo step');
    await p.click('#undo'); await wait(700);
    assert.equal((await S()).tattoos.length, 2, 'undo brings both back');
    // Done leaves Select
    if ((await p.$eval('#ldSelect', (e) => e.textContent)) === 'Done') { await p.click('#ldSelect'); await wait(300); }
    assert.equal(await p.$('#ldPickBar'), null, 'Done closes the bar');
  }
  const t = await tried();
  for (const k of ['tapUndo', 'layerSelect']) assert.ok(t.includes(k), 'New to try ticks ' + k);
  console.log('PASS t157 two-finger undo, three-finger redo, hold to keep undoing, in Clean up too; pick several in Layers to hide, group, lock, duplicate and delete; views');
}
