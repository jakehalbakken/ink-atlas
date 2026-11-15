// Does it fit there: in Try other spots, each arm and leg spot measures the loop of skin round the
// limb and the length of limb a piece can use, and says when the selected tattoo is too long or
// wraps far round at its size. A small piece gets no such words; a big one does.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  // the Sunburst: about square, so its width goes round the limb and as much runs up it
  const all = await p.evaluate(() => window.__ink.state().tattoos.map((t) => t.name));
  await (await p.$$('#trayItems .chip'))[Math.max(0, all.findIndex((n) => /Sunburst/.test(n)))].click(); await wait(300);
  const id = await p.evaluate(() => window.__ink.selected());
  const widthCm = (c) => p.evaluate((v) => { const e = document.querySelector('#exactWidth'); e.value = (v / 2.54).toFixed(2); e.dispatchEvent(new Event('change')); }, c);
  await widthCm(5); await wait(300);
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bSpots', (e) => e.click()); await wait(400);
  const small = await p.evaluate(() => window.__ink.spotNotes());
  const fit = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.spotFit())));
  const k = await p.evaluate(() => window.__ink.state().heightCm / 175 * 100); // cm per unit
  const cm = (v) => +(v * k).toFixed(1);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(fit).map(([s, v]) => [s, { round: cm(v.girth || 0), up: cm(v.room) }]))));
  // believable limbs on a 175 cm body: forearm about 24 to 32 cm round, thigh about 45 to 65, calf about 32 to 42
  assert.ok(cm(fit['forearm-front'].girth) > 20 && cm(fit['forearm-front'].girth) < 34, 'forearm round');
  assert.ok(cm(fit['thigh-front'].girth) > 42 && cm(fit['thigh-front'].girth) < 70, 'thigh round');
  assert.ok(cm(fit.calf.girth) > 28 && cm(fit.calf.girth) < 45, 'calf round');
  assert.ok(cm(fit['forearm-front'].room) > 15 && cm(fit['forearm-front'].room) < 25, 'forearm length to use');
  const words = /too long|too wide|wraps/;
  const sizeNow = await p.evaluate(() => { const t = window.__ink.state().tattoos.find((x) => x.id === window.__ink.selected()); return [t.width, t.aspect]; });
  console.log('small', cm(sizeNow[0]), 'cm wide', JSON.stringify(small));
  assert.ok(!words.test(small['forearm-front']), 'a small piece fits the forearm: ' + small['forearm-front']);
  // make it big: about 20 cm square
  await widthCm(20);
  await wait(400);
  let big = null;
  await p.$eval('#spotSide [data-side="R"]', (e) => e.click()); await wait(300);
  await p.$eval('#spotSide [data-side="L"]', (e) => e.click()); await wait(400);
  big = await p.evaluate(() => window.__ink.spotNotes());
  console.log('big', JSON.stringify(big));
  assert.ok(words.test(big['forearm-front']), 'a 20 cm piece is too much for the forearm: ' + big['forearm-front']);
  assert.ok(!/too long|too wide/.test(big['thigh-out']), 'a 20 cm square fits the thigh: ' + big['thigh-out']);
  assert.ok(!words.test(big.chest), 'torso spots say nothing about fitting: ' + big.chest);
  for (const v of Object.values(big)) assert.doesNotMatch(v, /NaN|undefined|null/);
  assert.equal(await p.evaluate(() => window.__ink.selected()), id, 'still selected');
}
