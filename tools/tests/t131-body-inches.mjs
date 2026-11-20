// Your body in inches (Body > Fine-tune each part): measured sliders show inches that follow the
// finger, tapping one and typing a number changes the body until it measures that, the typed
// number is kept and shown in colour, a tattoo on that arm stays on the same skin at the same
// real size, it is one undo step, a number past the slider's reach says how far it goes, and
// the height can be typed too (keeping each tattoo's real size). Old projects open unchanged.
// node tools/shot.mjs shots/t130.png tools/tests/t131-body-inches.mjs
import assert from 'node:assert/strict';
import { parseInches } from '../../src/body-measure.js';
import { cleanState } from '../../src/project.js';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  // a tattoo on the left upper arm
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(300);
  const id = await p.evaluate(() => window.__ink.selected());
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bSpots', (e) => e.click()); await wait(300);
  await p.$eval('#spotSide [data-side="L"]', (e) => e.click());
  await p.$eval('#spotChoices [data-spot="upperarm-out"]', (e) => e.click()); await wait(200);
  await p.$eval('#spotPop [data-close=spotPop]', (e) => e.click());
  await p.evaluate(() => window.__ink.select(null)); await wait(300);
  const t0 = await p.evaluate((id) => JSON.parse(JSON.stringify(window.__ink.state().tattoos.find((t) => t.id === id))), id);
  const old = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  assert.ok(!('measured' in JSON.parse(old)), 'nothing is measured until you type');

  await p.click('#bodyBtn'); await wait(400);
  await p.evaluate(() => { for (const d of document.querySelectorAll('#fitGroups details')) d.open = d.querySelector('summary').textContent.startsWith('Arms') || d.querySelector('summary').textContent.startsWith('Legs'); });
  await wait(600);
  const read = (k) => p.$eval(`.mval[data-m=${k}]`, (e) => e.textContent);
  const inch = async (k) => parseInches(await read(k));
  for (const k of ['upperArmSize', 'foreArmSize', 'wristSize', 'upperArmLen', 'thighSize', 'calfSize', 'ankleSize']) assert.match(await read(k), /^\d+\.\d in$/, `${k} shows inches`);
  const sizes = await p.$$eval('#fitGroups .mval', (a) => a.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }));
  assert.ok(sizes.length >= 7 && sizes.every(([w, h]) => w >= 44 && h >= 44), '44pt: ' + JSON.stringify(sizes));
  const arm0 = await inch('upperArmSize');

  // the number follows the finger while the slider moves
  const box = await p.$eval('#fitGroups ink-slider[aria-label="Upper arm size"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const y = box.y + box.h / 2, x0 = box.x + box.w / 2;
  const ev = (t, x) => p.evaluate((t, x, y) => { const e = document.querySelector('#fitGroups ink-slider[aria-label="Upper arm size"]'); e.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, buttons: t === 'pointerup' ? 0 : 1 })); }, t, x, y);
  await ev('pointerdown', x0); const seen = [];
  for (let i = 1; i <= 12; i++) { await ev('pointermove', x0 + i * 6); await wait(60); seen.push(await read('upperArmSize')); }
  assert.ok(new Set(seen).size >= 3, 'the inches change during the drag: ' + seen.join(', '));
  await ev('pointerup', x0 + 72); await wait(500);
  assert.ok(await inch('upperArmSize') > arm0 + 0.1, 'bigger after sliding right');
  await p.click('#undo'); await wait(700);
  assert.ok(Math.abs(await inch('upperArmSize') - arm0) < 0.06, 'undo puts the number back');

  // tap and type a number: the body measures that
  // (since 2026-11-20 our own number pad, so the iPad keyboard never comes up; t133 checks the pad)
  const padKeys = async (keys) => { for (const k of keys) await p.$eval(`#measurePad [data-key="${k}"]`, (b) => b.click()); };
  const padDone = () => p.$eval('#measurePad .np-done', (b) => b.click());
  await p.click('.mval[data-m=upperArmSize]'); await p.waitForSelector('#measurePad'); await wait(300);
  assert.equal(await p.$$eval('#bodyPop input:not([type=file])', (a) => a.length), 0, 'no text box, so no keyboard');
  const want = Math.round((arm0 + 1.25) * 4) / 4 + 0.0001;
  const q = Math.round((want % 1) * 4);
  await padKeys([...String(Math.floor(want)), ...(q ? [['', '¼', '½', '¾'][q]] : [])]); await padDone();
  await p.waitForFunction(() => !/Matching/.test(document.querySelector('.mval[data-m=upperArmSize]').textContent) && window.__ink.state().measured, { timeout: 30000 });
  await wait(500);
  const typed = parseInches(`${Math.floor(want)} ${Math.round((want % 1) * 4)}/4`);
  const s1 = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state())));
  assert.equal(s1.measured.upperArmSize, Math.round(typed * 100) / 100, 'the typed number is kept');
  assert.ok(Math.abs(await inch('upperArmSize') - typed) < 0.11, `the arm now measures ${await read('upperArmSize')}, typed ${typed}`);
  assert.ok(s1.fit.upperArmSize > 0, 'by moving the Upper arm size slider');
  const shown = `${Math.abs(typed * 10 - Math.round(typed * 10)) > 0.01 ? +typed.toFixed(2) : typed.toFixed(1)} in`;
  assert.equal(await read('upperArmSize'), shown, 'the number reads as typed');
  assert.ok(await p.$eval('.mval[data-m=upperArmSize]', (e) => e.classList.contains('set')), 'shown in colour');
  const toast1 = await p.$eval('#toast', (e) => e.textContent).catch(() => '');
  assert.match(toast1, /Upper arm now measures \d+\.\d+ in/);
  // the tattoo is still on the same skin, at the same real size
  const t1 = s1.tattoos.find((t) => t.id === id);
  assert.equal(t1.width, t0.width, 'same real size');
  const moved = Math.hypot(...t1.pos.map((v, i) => v - t0.pos[i]));
  assert.ok(moved > 0.0005 && moved < 0.03, 'it moved out with the skin, not off it: ' + moved.toFixed(4));
  await p.screenshot({ path: 'shots/t131-typed.png' });

  // a second measurement keeps the first one matched
  const wrist = Math.round(((await inch('wristSize')) + 0.4) * 10) / 10;
  await p.click('.mval[data-m=wristSize]'); await p.waitForSelector('#measurePad'); await wait(200);
  await p.$eval('#measurePad [data-unit=cm]', (b) => b.click()); await padKeys([...(wrist * 2.54).toFixed(1)]); await padDone();
  await p.waitForFunction(() => window.__ink.state().measured && window.__ink.state().measured.wristSize, { timeout: 30000 }); await wait(600);
  assert.ok(Math.abs(await inch('wristSize') - wrist) < 0.11, 'cm typed: ' + (await read('wristSize')) + ' vs ' + wrist);
  assert.ok(Math.abs(await inch('upperArmSize') - typed) < 0.11, 'the upper arm still measures what was typed');

  // one step back each
  await p.click('#undo'); await wait(700);
  const s2 = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state())));
  assert.deepEqual(Object.keys(s2.measured), ['upperArmSize'], 'undo takes back the wrist only');
  await p.click('#undo'); await wait(700);
  const s3 = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  assert.equal(s3, old, 'and then the arm: exactly the project before');

  // past the slider's reach
  await p.click('.mval[data-m=wristSize]'); await p.waitForSelector('#measurePad'); await wait(200);
  await padKeys(['1', '5']); await padDone();
  await p.waitForFunction(() => /goes up to/.test(document.querySelector('#toast').textContent), { timeout: 30000 });
  assert.match(await p.$eval('#toast', (e) => e.textContent), /Wrist goes up to \d+\.\d in on this body\. More Muscle or Weight/);
  await p.click('#undo'); await wait(700);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), old, 'undo again');

  // nonsense is refused without changing anything
  await p.click('.mval[data-m=calfSize]'); await p.waitForSelector('#measurePad'); await wait(200);
  await padKeys(['.', '2']); await padDone(); await wait(300);
  assert.match(await p.$eval('#toast', (e) => e.textContent), /Type a number of inches/);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), old, 'nothing changed');
  // Escape leaves it as it was
  await p.$eval('#measurePad .np-cancel', (b) => b.click()); await wait(200);
  await p.click('.mval[data-m=calfSize]'); await p.waitForSelector('#measurePad'); await wait(200); await p.keyboard.type('20'); await p.keyboard.press('Escape'); await wait(300);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), old, 'Escape changes nothing');

  // type the height: the tattoo keeps its real size in inches
  const realW = (s) => { const t = s.tattoos.find((x) => x.id === id); return t.width * s.heightCm / 175; };
  const before = JSON.parse(old);
  await p.evaluate(() => document.querySelector('#hText').scrollIntoView({ block: 'center' }));
  await p.click('#hText'); await p.waitForSelector('#measurePad'); await wait(200);
  await p.keyboard.type(`6'1"`); await p.keyboard.press('Enter'); await wait(800);
  const s4 = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state())));
  assert.ok(Math.abs(s4.heightCm - 185.4) < 0.11, 'height typed: ' + s4.heightCm);
  assert.ok(Math.abs(realW(s4) - realW(before)) < 1e-6, 'the tattoo is the same real size');
  assert.match(await p.$eval('#hText', (e) => e.textContent), /6 ft 1/);
  await p.click('#undo'); await wait(700);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), old, 'undo the height');
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  for (const k of ['bodyInches', 'bodyTypeIn', 'heightExact']) assert.ok(tried.includes(k), `${k} ticks itself`);

  // a saved project with typed numbers opens with them, and one from before opens unchanged
  const dirty = { ...JSON.parse(old), measured: { calfSize: 16.25, bogus: 4, wristSize: 'x', chest: 900 } };
  assert.deepEqual(cleanState(dirty, () => true).state.measured, { calfSize: 16.25 }, 'only real measurements are kept');
  assert.equal('measured' in cleanState(JSON.parse(old), () => true).state, false, 'none added to a project without them');
  await p.evaluate((o) => window.__ink.loadState(JSON.parse(o)), old); await wait(500);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), old, 'an old project opens as it was');
  await p.screenshot({ path: 'shots/t131-body-inches.png' });
  console.log(`PASS t131 body in inches: live readout, typed ${typed} in and ${wrist} in matched, tattoo kept its skin and size, undo, past reach, nonsense, height typed, old projects unchanged`);
}
