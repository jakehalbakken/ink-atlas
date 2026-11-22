// On my skin or Planned (2026-11-20, Jake: "The button for already on me versus planned is really
// confusing. It needs a clearer toggle."). A two-way switch right under the tattoo's name, the filled
// side is what it is now; one tap on the other side changes it, one undo step, and On my skin locks
// it as before. Layers shows the same words and marks on each line, its ⋯ has the same switch, and
// the quick buttons read Hide planned and Hide on my skin. Checked at both iPad orientations.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const rect = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, vis: cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0, bg: cs.backgroundColor }; });
  const get = (id) => p.evaluate((id) => { const t = window.__ink.state().tattoos.find((x) => x.id === id); return { status: t.status === 'existing' ? 'existing' : 'planned', locked: !!t.locked }; }, id);
  const pressed = () => p.$$eval('#statusSeg .btn', (bs) => bs.map((b) => b.dataset.status + ':' + b.getAttribute('aria-pressed')).join(','));
  for (const [W, H] of [[1180, 820], [820, 1180]]) {
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 }); await wait(900);
    if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }
    // a tap on the line already selected opens its options, so only tap when none is selected
    if (!(await p.evaluate(() => window.__ink.selected()))) { await p.click('#ldList .ld-tat'); await wait(700); }
    const id = await p.evaluate(() => window.__ink.selected()); assert.ok(id, 'a tattoo is selected');
    // the switch sits just under the name line, without opening More controls
    const seg = await rect('#statusSeg'), nm = await rect('#name');
    assert.ok(seg.vis, 'the switch shows');
    assert.ok(seg.t >= nm.b - 1 && seg.t - nm.b < 70, 'right under the name: ' + (seg.t - nm.b));
    assert.equal(await p.$eval('#editorAdvanced', (e) => e.open), false, 'More controls stays shut');
    assert.equal(await p.$('#bStatus'), null, 'the old one-word button is gone');
    for (const s of ['#bOnSkin', '#bPlanned']) { const r = await rect(s); assert.ok(r.w >= 44 && r.h >= 44, s + ' 44pt: ' + r.w + 'x' + r.h); }
    assert.equal(await p.$eval('#bOnSkin', (e) => e.textContent.trim()), 'On my skin');
    assert.equal(await p.$eval('#bPlanned', (e) => e.textContent.trim()), 'Planned');
    // start planned, so both directions are tried
    if ((await get(id)).status === 'existing') { await p.click('#bPlanned'); await wait(400); }
    assert.equal(await pressed(), 'existing:false,planned:true', 'Planned is the filled side');
    const fillOn = (await rect('#bPlanned')).bg, fillOff = (await rect('#bOnSkin')).bg;
    assert.notEqual(fillOn, fillOff, 'the chosen side looks different at a glance');
    // tapping the side that is already chosen changes nothing
    const before = JSON.stringify(await p.evaluate(() => window.__ink.state().tattoos));
    await p.click('#bPlanned'); await wait(300);
    assert.equal(JSON.stringify(await p.evaluate(() => window.__ink.state().tattoos)), before, 'a tap on the chosen side changes nothing');
    // On my skin: marks it and locks it, one undo step
    await p.click('#bOnSkin'); await wait(400);
    assert.deepEqual(await get(id), { status: 'existing', locked: true }, 'on my skin, locked in place');
    assert.equal(await pressed(), 'existing:true,planned:false');
    const line = await p.$eval(`#ldList .ld-tat[data-id="${id}"] small`, (e) => e.textContent);
    assert.match(line, /^On my skin/, 'Layers says On my skin: ' + line);
    assert.equal(await p.$eval(`#ldList .ld-tat[data-id="${id}"] .ld-st`, (e) => e.classList.contains('skin')), true, 'with the same mark');
    await p.click('#undo'); await wait(600);
    assert.equal((await get(id)).status, 'planned', 'undo puts it back to planned in one step');
    if (!(await p.evaluate(() => window.__ink.selected()))) { await p.click(`#ldList .ld-tat[data-id="${id}"]`); await wait(600); }
    assert.equal(await pressed(), 'existing:false,planned:true');
    // the same switch in the line's ⋯
    await p.click(`#ldList .ld-row[data-id="${id}"] .ld-more`); await wait(400);
    const segB = `#ldList .ld-row[data-id="${id}"] .ld-stseg`;
    assert.equal(await p.$$eval(segB + ' .btn', (bs) => bs.map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')).join(',')), 'On my skin:false,Planned:true');
    for (const b of await p.$$(segB + ' .btn')) { const r = await b.boundingBox(); assert.ok(r.width >= 44 && r.height >= 44, 'Layers switch 44pt'); }
    await p.click(segB + ' .btn[data-status=existing]'); await wait(500);
    assert.deepEqual(await get(id), { status: 'existing', locked: true }, 'switched from Layers too');
    assert.equal(await pressed(), 'existing:true,planned:false', 'the panel follows');
    await p.click(`#ldList .ld-row[data-id="${id}"] .ld-stseg .btn[data-status=planned]`); await wait(500);
    assert.deepEqual(await get(id), { status: 'planned', locked: false }, 'and back to planned');
    // the views at the top of Layers say the same words
    assert.deepEqual(await p.$$eval('#ldView button', (bs) => bs.map((b) => b.textContent.replace(/\s*\d+$/, '').trim())), ['All', 'On my skin', 'Planned']);
    // the rail's quick buttons keep their words
    assert.match(await p.$eval('#ldExisting', (e) => e.getAttribute('aria-label')), /^Hide on my skin tattoos/);
    await p.screenshot({ path: `shots/t135_${W}x${H}.png` });
    await p.click(`#ldList .ld-row[data-id="${id}"] .ld-more`); await wait(300);
  }
  // the slim rail shows On my skin on its button without spilling out
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(700);
  await p.click('#bDone').catch(() => {}); await wait(400);
  await p.click('#ldToggle'); await wait(500);
  const cap = await p.$eval('#ldExisting', (e) => { const c = e.querySelector('.ld-cap'), r = e.getBoundingClientRect(), q = c.getBoundingClientRect(); return { text: c.textContent, inside: q.left >= r.left - 1 && q.right <= r.right + 1 && q.bottom <= r.bottom + 1, w: r.width, h: r.height }; });
  assert.equal(cap.text, 'On my skin'); assert.ok(cap.inside, 'the rail word fits its button'); assert.ok(cap.w >= 44 && cap.h >= 44);
  await p.screenshot({ path: 'shots/t135_rail.png' });
  await p.click('#ldToggle'); await wait(400);
  console.log('PASS t135 On my skin or Planned switch');
}
