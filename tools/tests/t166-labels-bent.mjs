// t166 Picture with sizes draws its dashed box round a bent tattoo as it sits on the skin. The box went
// round the flat file's square, so a piece bent to half its width had a box twice as wide as its ink,
// hanging off one side. Now it goes round the box the bent piece fills, plain or mirrored.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  const n0 = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 300, 300);
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'block.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, n0);
  const id = (await st()).tattoos.at(-1).id;
  // only this one, 8 cm square, on the middle of the chest, facing the front view
  await p.evaluate((i) => { const ink = window.__ink, s = ink.state(), a = ink.surfaceAt([0, 1.25, 2], [0, 0, -1]); for (const t of s.tattoos) t.hidden = t.id !== i; const t = s.tattoos.find((q) => q.id === i); Object.assign(t, a, { status: 'planned', name: 'Block', width: 0.08, aspect: 1, rot: 0 }); ink.commitTest(); }, id);
  await p.evaluate(() => document.querySelector('#full').click()); await wait(1200);
  await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id); await wait(500);
  const shot = async () => {
    await p.evaluate(() => { document.querySelector('#share').hidden = false; });
    await p.click('#cLabels');
    await p.waitForFunction(() => document.querySelector('#pvTitle').textContent === 'Picture with sizes' && window.__ink.labels(), { timeout: 30000 });
    const L = (await p.evaluate(() => window.__ink.labels())).find((x) => x.lines[0] === 'Block'), ink = await p.evaluate((i) => window.__ink.inkBox(i), id);
    await p.keyboard.press('Escape'); await wait(500);
    return { box: L.box, ink };
  };
  const wid = (b) => b[2] - b[0], mid = (b) => (b[0] + b[2]) / 2;
  const flat = await shot();
  assert(Math.abs(wid(flat.box) / wid(flat.ink) - 1) < 0.25, `flat: the box fits the ink ${flat.box} ${flat.ink}`);
  // bent to its left half, then mirrored: the box follows the ink each time
  for (const flip of [false, true]) {
    await p.evaluate((i, fl) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.flip = fl; t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, id, flip);
    await p.waitForFunction((i, w) => { const b = window.__ink.inkBox(i); return b && b[2] - b[0] < w * 0.7; }, { timeout: 20000 }, id, wid(flat.ink)).catch(() => {});
    const bent = await shot();
    assert(wid(bent.ink) < wid(flat.ink) * 0.7, `the bend shows: ${bent.ink} vs ${flat.ink}`);
    assert(Math.abs(wid(bent.box) / wid(bent.ink) - 1) < 0.25, `bent${flip ? ' and mirrored' : ''}: the box is as wide as the ink ${bent.box} ${bent.ink}`);
    assert(Math.abs(mid(bent.box) - mid(bent.ink)) < wid(bent.ink) * 0.2, `bent${flip ? ' and mirrored' : ''}: and round it, not off to one side ${bent.box} ${bent.ink}`);
  }
  console.log('PASS t166 Picture with sizes draws its box round a bent tattoo, plain and mirrored');
}
