// Size as an everyday thing: the first line in More controls says a tattoo's size as something
// everyday, follows the size slider as it moves, and opening More
// controls by hand ticks it in New to try.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const t = (await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos))))[0];
  await (await p.$$('#trayItems .chip'))[0].click(); await wait(500);
  // 3.37 x 2.13 in at the standard height: a credit card
  const setIn = (w, h) => p.evaluate(([id, w, h]) => { const st = window.__ink.state(), q = st.tattoos.find((x) => x.id === id); const k = (st.heightCm || 175) / 175; q.width = w * 2.54 / 100 / k; q.aspect = w / h; q.locked = false; window.__ink.commitTest(); }, [t.id, w, h]);
  await setIn(3.37, 2.13); await wait(300);
  await p.click('#editorAdvanced summary'); await wait(700);
  let r = await p.evaluate((id) => window.__ink.like(id), t.id);
  assert.equal(r.text, 'About the size of a credit card.'); assert.equal(r.line, r.text, 'the line shows it');
  const tried = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('ia-tried') || '[]'); } catch { return []; } });
  assert.ok(tried.includes('like'), 'opening More controls by hand ticks it');
  // the size slider moves it along
  const before = r.line;
  await p.evaluate((id) => { const el = document.querySelector('#rSize'); el.value = '700'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, t.id);
  await wait(400);
  r = await p.evaluate((id) => window.__ink.like(id), t.id);
  assert.notEqual(r.line, before, 'follows the slider: ' + r.line);
  assert.equal(r.line, r.text);
  // tiny
  await setIn(0.3, 0.3); await wait(300); await p.evaluate(() => { document.querySelector('#editorAdvanced').open = false; }); await wait(100); await p.click('#editorAdvanced summary'); await wait(700);
  r = await p.evaluate((id) => window.__ink.like(id), t.id);
  assert.equal(r.line, 'Tiny: smaller than a fingernail.');
  await p.screenshot({ path: 'shots/t92-like.png' });
  console.log('PASS t92-like: ' + before + ' | ' + r.line);
}
