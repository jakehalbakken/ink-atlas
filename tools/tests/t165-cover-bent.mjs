// t165 a bent tattoo in Open skin: the share of the skin under ink and How covered each area is
// counted the flat file's box, so a tattoo squeezed to half its width still counted at its full size.
// Both now count the box the bent piece fills on the skin, and the line follows a bend at once.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  const n0 = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 400, 200);
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'block.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, n0);
  const id = (await st()).tattoos.at(-1).id;
  await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id); await wait(300);
  const k = (await st()).heightCm / 175;
  // only this one shows, 28 cm wide, planned, where it was added
  await p.evaluate((i, w) => { const s = window.__ink.state(); for (const t of s.tattoos) t.hidden = t.id !== i; const t = s.tattoos.find((q) => q.id === i); t.status = 'planned'; t.name = 'Block'; t.width = w; window.__ink.select(i); window.__ink.commitTest(); }, id, 28 / (k * 100)); await wait(800);
  await p.click('#lookBtn'); await wait(200); await p.click('#roomBtn'); await wait(1200);
  const s0 = (await p.evaluate(() => window.__ink.room().shares())).planShare;
  const c0 = await p.evaluate(() => window.__ink.covered());
  assert(s0 > 0 && c0.list && c0.list.length, 'the flat piece is counted: ' + s0 + ' ' + c0.text);
  const tried = () => p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert(!(await tried()).includes('coverBent'), 'not ticked before a bend');
  // bend it to half its width, Open skin still open
  await p.evaluate((i) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, id);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }).catch(() => {});
  // the bend shows a few seconds later headless; wait until the share has moved
  await p.waitForFunction((a) => { const s = window.__ink.room().shares().planShare; return s < a * 0.7; }, { timeout: 20000 }, s0).catch(() => {});
  const s1 = (await p.evaluate(() => window.__ink.room().shares())).planShare;
  assert(Math.abs(s1 / s0 - 0.5) < 0.08, `half the width covers about half the skin: ${s0} then ${s1}`);
  await p.waitForFunction((t0) => { const c = window.__ink.covered(); return c.text && c.text !== t0; }, { timeout: 20000 }, c0.text).catch(() => {});
  const c1 = await p.evaluate(() => window.__ink.covered());
  const sum = (c) => c.list.reduce((a, r) => a + r.plan, 0);
  assert(sum(c1) < sum(c0) * 0.7, `the area line counts the bent piece: ${c0.text} then ${c1.text}`);
  assert.notEqual(await p.$eval('#roomCover', (e) => e.textContent), c0.text, 'the line on screen follows the bend');
  assert((await tried()).includes('coverBent'), 'ticked in New to try');
  console.log('PASS t165 Open skin counts a bent tattoo at the size it fills: ' + c0.text + ' / ' + c1.text);
}
