// t185 opening Body measured every tape on the body again each time, about a tenth of a second, though
// the body had not changed (2026-11-24). Now the measurements are kept for the shape they were taken
// on. This checks a second open measures nothing and shows the same inches, that a slider change still
// measures again and moves the inches, that undo brings back the first numbers, that a new height
// changes them, and that New to try ticks.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  const runs = () => ink(() => window.__ink.inkReads().measures);
  const inches = () => ink(() => Object.fromEntries([...document.querySelectorAll('.mval[data-m]')].map((e) => [e.dataset.m, e.textContent])));
  const open = async () => { await ink(() => document.querySelector('#bodyBtn').click()); await wait(700); };
  const close = async () => { await p.keyboard.press('Escape'); await wait(400); };
  await open();
  const m0 = await inches(), r0 = await runs();
  assert.ok(Object.keys(m0).length >= 10 && Object.values(m0).every((v) => /in$/.test(v)), 'every tape shows inches ' + JSON.stringify(m0).slice(0, 200));
  await close(); await open();
  assert.equal(await runs(), r0, 'opening again measures nothing');
  assert.deepEqual(await inches(), m0, 'and shows the same numbers');
  // a slider: measured again, numbers move
  await ink(() => { const r = document.querySelector('#rWeight'); r.value = 85; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }); await wait(1200);
  const m1 = await inches();
  assert.ok((await runs()) > r0, 'a new shape is measured again');
  assert.notDeepEqual(m1, m0, 'the inches follow the slider');
  await close(); await open();
  assert.deepEqual(await inches(), m1, 'reopened after the slider, the new numbers');
  // undo: the first numbers back
  await close(); await ink(() => document.querySelector('#undo').click()); await wait(800); await open();
  assert.deepEqual(await inches(), m0, 'undo brings back the first numbers');
  // a new height changes the inches
  await close(); await ink(() => { const s = structuredClone(window.__ink.state()); s.heightCm = 190; window.__ink.loadState(s); }); await wait(1200); await open();
  assert.notDeepEqual(await inches(), m0, 'a new height changes the inches'); await close();
  assert.ok((await ink(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'))).includes('bodyQuick'), 'New to try ticks');
  console.log('t185 ok');
}
