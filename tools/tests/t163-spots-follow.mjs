// t163 Try other spots follows the tattoo while it stays open: a size change (a pinch on the body, the keys,
// undo) or a bend, on or off, updates the notes under each spot, and picking another tattoo updates the title. Before,
// both kept what they said when the panel opened until it was closed and opened again.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  const add = async (name) => {
    const n0 = (await st()).tattoos.length;
    await p.evaluate(async (nm) => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 400, 200);
      const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], nm + '.png', { type: 'image/png' }));
      const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
    }, name);
    await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, n0);
    const id = (await st()).tattoos.at(-1).id;
    await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id); await wait(300);
    return id;
  };
  const a = await add('Block'), b = await add('Other');
  await p.evaluate((i) => { const s = window.__ink.state(); s.tattoos.find((t) => t.id === i).name = 'Second'; window.__ink.commitTest(); }, b);
  const k = (await st()).heightCm / 175, cm = (v) => v / (k * 100);
  // a small piece: fits the forearm
  await p.evaluate((i, w) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.width = w; t.name = 'First'; window.__ink.select(i); window.__ink.commitTest(); }, a, cm(5)); await wait(500);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; }); await wait(200);
  await p.$eval('#bSpots', (e) => e.click()); await wait(800);
  assert.equal(await p.$eval('#spotPop', (e) => e.hidden), false, 'Try other spots opens');
  const small = await p.evaluate(() => window.__ink.spotNotes());
  assert.doesNotMatch(small['forearm-front'] || '', /wraps|too wide/, 'a 5 cm piece fits the forearm: ' + small['forearm-front']);
  assert.match(await p.$eval('#spotTitle', (e) => e.textContent), /First/);
  // grow it to 15 cm with the panel still open: the forearm now says it wraps
  await p.evaluate((i, w) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.width = w; window.__ink.commitTest(); }, a, cm(15));
  await p.waitForFunction(() => /wraps|too wide/.test((window.__ink.spotNotes() || {})['forearm-front'] || ''), { timeout: 20000 }).catch(() => {});
  const big = await p.evaluate(() => window.__ink.spotNotes());
  assert.match(big['forearm-front'] || '', /wraps|too wide/, 'the notes follow a size change while open: ' + big['forearm-front']);
  // bend it to half its width, still open: it fits again
  await p.evaluate((i) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, a);
  await p.waitForFunction(() => !/wraps|too wide/.test((window.__ink.spotNotes() || {})['forearm-front'] || 'x'), { timeout: 20000 }).catch(() => {});
  const bent = await p.evaluate(() => window.__ink.spotNotes());
  assert.doesNotMatch(bent['forearm-front'] || '', /wraps|too wide/, 'the notes follow a bend while open: ' + bent['forearm-front']);
  // taking the bend off: it wraps again
  await p.evaluate((i) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); delete t.warp; window.__ink.commitTest(); }, a);
  await p.waitForFunction(() => /wraps|too wide/.test((window.__ink.spotNotes() || {})['forearm-front'] || ''), { timeout: 20000 }).catch(() => {});
  assert.match((await p.evaluate(() => window.__ink.spotNotes()))['forearm-front'] || '', /wraps|too wide/, 'the notes follow the bend coming off while open');
  // picking the other tattoo changes the title at once
  await p.evaluate((i) => window.__ink.select(i), b); await wait(100);
  assert.match(await p.$eval('#spotTitle', (e) => e.textContent), /Second/, 'the title follows the selected tattoo');
  assert.equal(await p.$eval('#spotPop', (e) => e.hidden), false, 'the panel stays open');
  console.log('PASS t163 Try other spots follows a size change, a bend on and off, and another tattoo while it stays open');
}
