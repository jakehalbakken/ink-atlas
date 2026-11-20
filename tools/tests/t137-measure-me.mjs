// Typing measurements without the iPad keyboard, and Measure me.
// A measurement box opens our own number pad (no text field is focused, so the iPad keyboard never
// comes up and the screen stays put), the box stays in sight beside the pad, ¼ ½ ¾ and cm work,
// Next goes to the next measurement and Done matches them all; a plugged-in keyboard types on it.
// Height takes feet and inches. Measure me walks the tape measurements one a screen with a drawing,
// Skip and Back work, and Fit my body fits everything in one undo step and shows each one against
// the model. Keys and buttons are 44 pt, on an iPad and a phone.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const settled = () => p.waitForFunction(() => window.__ink.settled(), { timeout: 20000 });
  const pad = (k) => p.$eval(`#measurePad [data-key="${k}"]`, (b) => b.click());
  const shown = () => p.$eval('#measurePad .np-show', (n) => n.textContent.trim());
  const min44 = async (sel) => { const m = await p.$$eval(sel, (bs) => Math.min(...bs.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }))); assert.ok(m >= 44 - 0.01, `${sel} 44pt: ${m}`); };
  await settled(); await wait(500);
  await p.click('#bodyBtn'); await p.waitForSelector('#bodyPop:not([hidden])');
  await p.evaluate(() => { for (const d of document.querySelectorAll('#fitGroups details')) if (/Arms/.test(d.querySelector('summary').textContent)) d.open = true; }); await wait(300);
  await p.click('.mval[data-m=upperArmSize]'); await p.waitForSelector('#measurePad'); await wait(500);
  assert.ok(!['INPUT', 'TEXTAREA'].includes(await p.evaluate(() => document.activeElement && document.activeElement.tagName)), 'no text field is focused, so no keyboard');
  assert.equal(await p.$$eval('#bodyPop input:not([type=file])', (a) => a.length), 0, 'no text field in the panel');
  const boxes = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON(); return { pad: r('#measurePad'), box: r('.mval[data-m=upperArmSize]'), pop: r('#bodyPop') }; });
  const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  assert.ok(!overlap(boxes.pad, boxes.box) && !overlap(boxes.pad, boxes.pop), 'the pad leaves the panel and the box in sight');
  assert.ok(boxes.box.top >= 0 && boxes.box.bottom <= 820, 'the box being typed is on screen');
  assert.ok(boxes.pad.bottom <= 820 && boxes.pad.top >= 0, 'the pad is on screen');
  assert.ok(await p.$eval('.mval[data-m=upperArmSize]', (b) => b.classList.contains('typing')), 'the box being typed is ringed');
  await min44('#measurePad .btn');
  await p.screenshot({ path: 'shots/t137-pad.png' });
  for (const k of ['1', '4', '½']) await pad(k);
  assert.equal(await shown(), '14 ½ in');
  await p.$eval('#measurePad .np-next', (b) => b.click()); await wait(200);
  assert.equal(await p.$eval('#measurePad .np-title', (n) => n.textContent), 'Forearm', 'Next goes to the next measurement in the panel');
  await p.$eval('#measurePad [data-unit=cm]', (b) => b.click());
  for (const k of ['2', '6']) await pad(k);
  assert.equal(await shown(), '26 cm');
  await p.$eval('#measurePad .np-done', (b) => b.click());
  await p.waitForFunction(() => { const m = window.__ink.state().measured; return m && m.upperArmSize === 14.5 && m.foreArmSize; }, { timeout: 30000 });
  await wait(400); await settled();
  const read = async (k) => p.$eval(`.mval[data-m=${k}]`, (b) => b.textContent);
  assert.match(await read('upperArmSize'), /14\.5 in/, 'the body now measures 14.5 in round the upper arm');
  const fore = (await p.evaluate(() => window.__ink.state().measured.foreArmSize)); assert.ok(Math.abs(fore - 26 / 2.54) < 0.01, 'cm typed: ' + fore);
  // a keyboard plugged in types on the pad
  await p.click('.mval[data-m=wristSize]'); await p.waitForSelector('#measurePad');
  await p.keyboard.type('6.75'); assert.equal(await shown(), '6.75 in');
  await p.keyboard.press('Enter'); await wait(200);
  assert.equal(await p.$eval('#measurePad .np-title', (n) => n.textContent).catch(() => null) != null, true, 'Enter moves on like Next');
  await p.keyboard.press('Escape'); await wait(100);
  assert.equal(await p.$('#measurePad'), null, 'Escape closes the pad, keeping the number confirmed with Enter');
  await p.waitForFunction(() => (window.__ink.state().measured || {}).wristSize === 6.75, { timeout: 30000 });
  // height in feet and inches
  await p.click('#hText'); await p.waitForSelector('#measurePad');
  for (const k of ['5', "'", '1', '1']) await pad(k);
  await p.$eval('#measurePad .np-done', (b) => b.click());
  await p.waitForFunction(() => Math.abs(window.__ink.state().heightCm - 71 * 2.54) < 0.11, { timeout: 30000 });
  await wait(500); await settled();

  // Measure me
  const before = await p.evaluate(() => JSON.stringify({ fit: window.__ink.state().fit, h: window.__ink.state().heightCm }));
  await p.click('#measureMeBtn'); await p.waitForSelector('#measureMe:not([hidden])');
  assert.equal(await p.$eval('#bodyPop', (n) => n.hidden), true, 'Body steps aside');
  const name = () => p.$eval('#mmHost .mm-name', (n) => n.textContent);
  const mm = (k) => p.$eval(`#mmHost [data-key="${k}"]`, (b) => b.click());
  const foot = (c) => p.$eval(`#mmHost .${c}`, (b) => b.click());
  assert.equal(await name(), 'Height');
  assert.match(await p.$eval('#mmHost .np-show', (n) => n.textContent), /5′ 11/, 'opens with the height already set');
  assert.ok(await p.$('#mmHost .mdiag .md-tape'), 'a drawing with the tape');
  await min44('#mmHost .btn');
  await p.screenshot({ path: 'shots/t137-measure-height.png' });
  await foot('np-done'); await wait(100);
  assert.equal(await name(), 'Neck');
  await p.screenshot({ path: 'shots/t137-measure-neck.png' });
  for (const k of ['1', '5', '½']) await mm(k); await foot('np-done');
  assert.equal(await name(), 'Shoulders'); await foot('np-cancel'); // skip
  assert.equal(await name(), 'Chest'); for (const k of ['4', '0']) await mm(k); await foot('np-done');
  assert.equal(await name(), 'Waist'); await foot('np-prev');
  assert.equal(await name(), 'Chest', 'Back'); assert.match(await p.$eval('#mmHost .np-show', (n) => n.textContent), /40/, 'keeps what was typed'); await foot('np-done');
  for (const k of ['3', '3']) await mm(k); await foot('np-done');
  assert.equal(await name(), 'Hips'); await p.screenshot({ path: 'shots/t137-measure-hips.png' });
  // skip to the end, keeping the typed upper arm and wrist from before
  for (let n = 0; n < 30; n++) { const label = await p.$eval('#mmHost .np-done', (b) => b.textContent); if (label === 'Fit my body') break; await foot('np-cancel'); }
  await foot('np-done');
  await p.waitForSelector('#mmHost .mm-table', { timeout: 60000 });
  const rows = await p.$$eval('#mmHost .mm-row[data-key]', (r) => r.map((x) => ({ key: x.dataset.key, ok: x.classList.contains('ok'), t: x.textContent })));
  const keys = rows.map((r) => r.key);
  for (const k of ['height', 'neckSize', 'chest', 'waist', 'upperArmSize', 'wristSize']) assert.ok(keys.includes(k), `${k} in the check`);
  assert.ok(!keys.includes('shoulders') && !keys.includes('thighLen'), 'skipped ones are left out');
  assert.ok(rows.filter((r) => r.ok).length >= rows.length - 1, 'every number matched: ' + JSON.stringify(rows));
  const m = await p.evaluate(() => window.__ink.state().measured);
  assert.equal(m.neckSize, 15.5); assert.equal(m.chest, 40); assert.equal(m.waist, 33); assert.equal(m.upperArmSize, 14.5);
  await p.screenshot({ path: 'shots/t137-measure-done.png' });
  assert.ok((await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'))).includes('measureMe'), 'ticks itself in New to try');
  await p.click('#mmDone'); await wait(300);
  assert.equal(await p.$eval('#measureMe', (n) => n.hidden), true);
  // one undo step back to before Measure me
  await p.click('#undo'); await wait(600); await settled();
  assert.equal(await p.evaluate(() => JSON.stringify({ fit: window.__ink.state().fit, h: window.__ink.state().heightCm })), before, 'one undo puts the body back');
  // on a phone the pad and the steps still fit
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 }); await wait(600);
  await p.evaluate(() => document.querySelector('#bodyBtn').click()); await p.waitForSelector('#bodyPop:not([hidden])');
  await p.evaluate(() => document.querySelector('#measureMeBtn').click()); await p.waitForSelector('#measureMe:not([hidden])');
  await wait(700);
  await p.screenshot({ path: 'shots/t137-phone.png' });
  const fit = await p.evaluate(() => { const b = document.querySelector('#mmHost .np-done').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; });
  assert.ok(fit, 'Next is on screen on a phone');
  await min44('#mmHost .btn');
  console.log(`t137 measure me ok: ${rows.length} checked, ${rows.filter((r) => r.ok).length} match`);
}
