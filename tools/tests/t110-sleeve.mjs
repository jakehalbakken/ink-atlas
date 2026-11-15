// Arms and legs, unrolled (Share): each limb's skin laid flat side by side, about as long and as
// wide round as the limb really is, with a tattoo placed on the left forearm showing on the left
// arm's map and on no other. The view and the project are left as they were.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  // hide every tattoo but one, and put that one on the outside of the left forearm
  const all = await p.evaluate(() => window.__ink.state().tattoos.map((t) => t.name));
  await (await p.$$('#trayItems .chip'))[Math.max(0, all.findIndex((n) => /Sunburst/.test(n)))].click(); await wait(300);
  const id = await p.evaluate(() => window.__ink.selected());
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bSpots', (e) => e.click()); await wait(400);
  await p.$eval('#spotSide [data-side="L"]', (e) => e.click()); await wait(200);
  await p.$eval('#spotChoices [data-spot="forearm-back"]', (e) => e.click()); await wait(800);
  await p.evaluate(() => { document.querySelector('#spotPop').hidden = true; });
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 });
  await p.evaluate((keep) => { for (const t of window.__ink.state().tattoos) if (t.id !== keep) t.hidden = true; }, id);
  await wait(400);
  const goal0 = await p.evaluate(() => JSON.stringify(window.__ink.goal)), before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  await p.click('#shareBtn'); await wait(300);
  assert.ok(await p.$eval('#cSleeve', (e) => e.getBoundingClientRect().height >= 44), 'big enough');
  await p.click('#cSleeve');
  await p.waitForFunction(() => document.querySelector('#pvTitle').textContent === 'Arms and legs, unrolled' && document.querySelector('#pvImg').complete && document.querySelector('#pvImg').naturalWidth > 0, { timeout: 60000 });
  const r = await p.evaluate(() => {
    const img = document.querySelector('#pvImg'), c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const L = window.__ink.sleeve();
    // how much of each map is skin, and how much of the skin is dark (ink)
    let x0 = L.pad; const per = [];
    for (const m of L.maps) {
      const d = g.getImageData(x0, L.head, m.W, m.H).data; let skin = 0, dark = 0;
      for (let i = 0; i < d.length; i += 16) { const v = d[i] + d[i + 1] + d[i + 2]; if (v > 200) skin++; else if (v > 30 && v < 200 && !(Math.abs(d[i] - 22) < 4 && Math.abs(d[i + 2] - 28) < 4)) dark++; }
      per.push({ key: m.key, skin, dark }); x0 += m.W + L.gap;
    }
    return { ...L, per, w: c.width, h: c.height };
  });
  const b64 = await p.evaluate(() => document.querySelector('#pvImg').src.split(',')[1]); (await import('node:fs')).writeFileSync('shots/t110-sleeve.png', Buffer.from(b64, 'base64'));
  console.log(JSON.stringify({ maps: r.maps.map((m) => ({ key: m.key, inked: m.inked, len: +m.lengthCm.toFixed(1), round: +m.roundCm.toFixed(1) })), per: r.per }));
  assert.equal(r.maps.length, 4, 'four limbs');
  const by = Object.fromEntries(r.maps.map((m) => [m.key, m]));
  // believable sizes on a 175 cm body: shoulder to wrist about 50 to 65 cm, hip to ankle 75 to 95
  assert.ok(by.armL.lengthCm > 45 && by.armL.lengthCm < 70, 'arm length: ' + by.armL.lengthCm);
  assert.ok(by.legL.lengthCm > 70 && by.legL.lengthCm < 100, 'leg length: ' + by.legL.lengthCm);
  assert.ok(by.legL.roundCm > by.armL.roundCm * 1.3, 'a leg is wider round than an arm');
  assert.ok(Math.abs(by.armL.lengthCm - by.armR.lengthCm) < 1 && Math.abs(by.legL.roundCm - by.legR.roundCm) < 3, 'left and right match');
  assert.equal(by.armL.inked, 1, 'the forearm tattoo is on the left arm map');
  assert.equal(by.armR.inked + by.legL.inked + by.legR.inked, 0, 'and on no other');
  for (const x of r.per) assert.ok(x.skin > 500, 'skin drawn for ' + x.key);
  const pl = Object.fromEntries(r.per.map((x) => [x.key, x]));
  assert.ok(pl.armL.dark > pl.armR.dark + 20, 'ink shows on the left arm map');
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('sleeve')), 'ticked');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.goal)), goal0, 'view unchanged');
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'project unchanged');
}
