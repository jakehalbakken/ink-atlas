// Polish round 1 of the continuous pass (2026-11-20 audit at iPad sizes):
// - the edit panel's name line (name, bin, fold, Done) stays at the top while the panel scrolls,
//   so Done is reachable in landscape with More controls open
// - in the right-hand column the Size, Turn and Ink strength sliders each get the whole width
// - Light shows its four choices two to a row, each name whole
// - How I see it's mode names are never cut off on an iPad mini
// - Clean up's opening hint points to the tool rail at the left and goes once another tool is picked,
//   and in tall portrait the settings card is tall enough for Move's controls without scrolling (it was 268 px)
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const box = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
  const hitIs = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === e || e.contains(h)); });

  // landscape, More controls open, panel scrolled: Done still at the top and tappable
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, hasTouch: true }); await wait(900);
  if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }
  await p.click('#ldList .ld-tat'); await wait(800);
  await p.$eval('#editorAdvanced', (d) => { d.open = true; }); await wait(400);
  const sc = await p.$eval('#sheet', (s) => { s.scrollTop = 600; return { top: s.scrollTop, room: s.scrollHeight - s.clientHeight }; });
  assert.ok(sc.room > 200 && sc.top > 200, 'the panel scrolls with More controls open: ' + JSON.stringify(sc));
  await wait(200);
  const sheet = await box('#sheet'), done = await box('#bDone');
  assert.ok(done.t >= sheet.t - 1 && done.b <= sheet.t + 80, 'Done stays at the top of the scrolled panel: ' + (done.t - sheet.t));
  assert.ok(await hitIs('#bDone'), 'nothing covers Done');
  assert.ok(await hitIs('#bDelTop'), 'nothing covers the bin');
  await p.$eval('#sheet', (s) => { s.scrollTop = 0; });

  // the sliders in the column: one to a row, each long enough for a finger
  const sl = await p.$$eval('#sheet .sliders ink-slider', (n) => n.filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().width)));
  assert.ok(sl.length >= 2, 'sliders found: ' + sl);
  assert.ok(Math.min(...sl) >= 240, 'each slider is wide: ' + sl);
  await p.click('#bDone'); await wait(500);

  // Light: two to a row, each name fits
  await p.click('#lookBtn'); await wait(600); await p.click('#lightBtn'); await wait(700);
  const lights = await p.$$eval('#lightPop .posegrid .btn', (n) => n.map((b) => ({ t: Math.round(b.getBoundingClientRect().top), w: b.getBoundingClientRect().width, clip: b.scrollWidth > b.clientWidth + 1 })));
  assert.equal(lights.length, 4, 'four lights');
  assert.equal(new Set(lights.map((l) => l.t)).size, 2, 'in two rows');
  assert.ok(lights.every((l) => !l.clip && l.w >= 100), 'every name whole: ' + JSON.stringify(lights));
  await p.keyboard.press('Escape'); await wait(400);
  await p.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'Done' && b.getBoundingClientRect().width && !b.closest('#sheet')) { b.click(); break; } }); await wait(500);

  // iPad mini portrait: How I see it's modes are whole
  await p.setViewport({ width: 744, height: 1133, deviceScaleFactor: 1, hasTouch: true }); await wait(900);
  await p.click('#lookBtn'); await wait(600); await p.click('#selfBtn'); await wait(1500);
  const modes = await p.$$eval('#selfBar .seg .btn', (n) => n.filter((b) => b.getBoundingClientRect().width).map((b) => ({ t: b.textContent.trim(), clip: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1, h: b.getBoundingClientRect().height })));
  assert.ok(modes.length >= 3, 'modes shown: ' + JSON.stringify(modes));
  assert.ok(modes.every((m) => !m.clip && m.h >= 43.5), 'mode names whole, 44pt: ' + JSON.stringify(modes));
  await p.evaluate(() => { const b = [...document.querySelectorAll('#selfBar button')].find((x) => x.textContent.trim() === 'Done'); b && b.click(); }); await wait(800);

  // Clean up in tall portrait
  await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, hasTouch: true }); await wait(900);
  await p.click('#ldList .ld-tat'); await wait(800);
  await p.click('#bCleanup'); await p.waitForSelector('#ink-cleanup .ic-work canvas'); await wait(1200);
  const hint = await p.$eval('#ink-cleanup .ic-status', (n) => ({ on: n.classList.contains('on'), t: n.textContent }));
  assert.ok(hint.on && !/below/.test(hint.t), 'the opening hint shows and does not say below: ' + hint.t);
  await p.click('#ink-cleanup [data-mode=move]'); await wait(400);
  assert.equal(await p.$eval('#ink-cleanup .ic-status', (n) => n.classList.contains('on')), false, 'the opening hint goes once another tool is picked');
  const card = await p.$eval('#ink-cleanup .ic-opts', (c) => ({ h: c.getBoundingClientRect().height, over: c.scrollHeight - c.clientHeight }));
  assert.ok(card.h > 300, 'the settings card has room in tall portrait: ' + card.h);
  assert.ok(card.over <= 12, 'Move fits in the card without scrolling: ' + card.over);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#ink-cleanup button')].find((x) => x.textContent.trim() === 'Cancel'); b && b.click(); }); await wait(600);
  console.log('PASS polish round 1: Done stays reachable, sliders full width, Light in two rows, How I see it names whole, Clean up hint and card');
}
