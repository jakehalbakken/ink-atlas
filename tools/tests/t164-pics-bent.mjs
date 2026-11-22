// t164 a bent tattoo's size in two more Share pictures: If your body changes wrote the flat file's size under
// each body, and Arms and legs unrolled under the tattoo on the limb. Both now write the size the bent piece
// fills on the skin, the same as the size under its name.
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
  // only this one shows, 8 cm wide, on the outside of the forearm
  await p.evaluate((i, w) => { const s = window.__ink.state(); for (const t of s.tattoos) t.hidden = t.id !== i; const t = s.tattoos.find((q) => q.id === i); t.status = 'planned'; t.name = 'Block'; t.width = w; window.__ink.select(i); window.__ink.commitTest(); }, id, 8 / (k * 100)); await wait(500);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(200);
  await p.$eval('#bSpots', (e) => e.click()); await wait(800);
  await p.$eval('#spotChoices [data-spot="forearm-back"]', (e) => e.click()); await wait(1200);
  await p.keyboard.press('Escape'); await wait(400);
  // bend it to half its width
  await p.evaluate((i) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, id);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }).catch(() => {}); await wait(800);
  const t = (await st()).tattoos.find((q) => q.id === id), wcm = t.width * 0.5 * 100 * k, hcm = t.width / t.aspect * 100 * k;

  // If your body changes: the "now" tile gives the bent size
  await p.click('#shareBtn'); await wait(300); await p.click('#cBodyChange');
  await p.waitForFunction(() => document.querySelector('#pvTitle').textContent === 'If your body changes' && document.querySelector('#pvImg').complete && document.querySelector('#pvImg').naturalWidth > 0, { timeout: 90000 });
  const bc = await p.evaluate(() => window.__ink.bodyChange()), now = bc.results.find((r) => r.key === 'now');
  assert(Math.abs(now.size[0] - wcm) < 0.05 && Math.abs(now.size[1] - hcm) < 0.05, `If your body changes gives the bent size ${wcm.toFixed(1)} x ${hcm.toFixed(1)}: ${now.size.map((v) => v.toFixed(1))}`);
  const heavy = bc.results.find((r) => r.key === 'heavy');
  assert(heavy.size[0] > now.size[0], 'and the heavier body still grows it');
  await p.keyboard.press('Escape'); await wait(500);

  // Arms and legs unrolled: the label beside the tattoo gives the bent size
  await p.click('#shareBtn'); await wait(300); await p.click('#cSleeve');
  await p.waitForFunction(() => document.querySelector('#pvTitle').textContent === 'Arms and legs, unrolled' && document.querySelector('#pvImg').complete && document.querySelector('#pvImg').naturalWidth > 0, { timeout: 90000 });
  const texts = (await p.evaluate(() => window.__ink.sleeve())).maps.flatMap((m) => m.texts);
  assert(texts.some((x) => x === `Block  ${wcm.toFixed(0)} × ${hcm.toFixed(0)} cm`), `the unrolled label gives ${wcm.toFixed(0)} x ${hcm.toFixed(0)} cm: ${JSON.stringify(texts)}`);
  assert(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('picsBent')), 'ticked in New to try');
  console.log('PASS t164 If your body changes and Arms and legs unrolled give a bent tattoo its bent size');
}
