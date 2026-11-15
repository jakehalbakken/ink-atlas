// Body hair (Body > Hair): No body hair, Light or Full, painted on the skin in the hair colour. Kept on
// this device, nothing in the project changes; it comes back after a reload, follows a new shape and
// stays on the same skin in a pose.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  const dens = () => p.evaluate(() => { const B = window.__ink.bodyHairField(); let s = 0, c = 0; for (let v = 0; v < 13380; v++) { s += B[v * 4 + 3]; if (B[v * 4 + 3] > 0.3) c++; } return { sum: s, count: c }; });
  assert.equal(await p.evaluate(() => window.__ink.bodyHair()), 'none', 'none to start with');
  await p.click('#bodyBtn'); await wait(200);
  const btns = await p.$$eval('#bodyHairRow [data-bhair]', (es) => es.map((e) => { const r = e.getBoundingClientRect(), pr = e.closest('#bodyPop').getBoundingClientRect(); return [e.textContent, r.height, r.left >= pr.left - 1 && r.right <= pr.right + 1]; }));
  assert.deepEqual(btns.map((b) => b[0]), ['No body hair', 'Light', 'Full']);
  for (const [t, h, fits] of btns) assert.ok(h >= 44 && fits, `${t}: big enough and inside the panel (${h})`);
  assert.equal(await p.$eval('#bodyHairRow [data-bhair="none"]', (e) => e.getAttribute('aria-pressed')), 'true');
  // bald and no beard: no colours until there is body hair
  await p.click('#hairRow [data-hair="none"]'); await p.click('#beardRow [data-beard="none"]'); await wait(200);
  assert.equal(await p.$eval('#hairCols', (e) => e.hidden), true);

  await p.click('#bodyHairRow [data-bhair="full"]'); await wait(400);
  assert.equal(await p.evaluate(() => window.__ink.bodyHair()), 'full');
  assert.equal(await p.$eval('#bodyHairRow [data-bhair="full"]', (e) => e.getAttribute('aria-pressed')), 'true');
  assert.equal(await p.$eval('#hairCols', (e) => e.hidden), false, 'colours show for body hair');
  assert.equal(await p.evaluate(() => localStorage.getItem('ia-body-hair')), 'full', 'kept on this device');
  assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('bodyHair')), 'ticked in New to try');
  const d1 = await dens();
  assert.ok(d1.count > 800, 'hair over a good part of the skin: ' + d1.count);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'the project is unchanged');

  // a picture: the forearm with hair is darker than without
  const fa = await p.evaluate(() => { const B = window.__ink.bodyHairField(), P = window.__ink.positions(); let best = 0, bv = -1; for (let v = 0; v < 13380; v++) if (P[v * 3] > 0.3 && B[v * 4 + 3] > bv) { bv = B[v * 4 + 3]; best = v; } return [P[best * 3], P[best * 3 + 1], P[best * 3 + 2]]; });
  const shade = async () => {
    await p.evaluate((f) => { Object.assign(window.__ink.goal, { theta: 2.6, phi: Math.PI / 2, roll: 0, tx: f[0], ty: f[1], tz: f[2] - 0.04, r: 0.5 }); }, fa);
    await p.waitForFunction(() => window.__ink.settled(), { timeout: 60000 }); await wait(300);
    const style = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' }); await wait(250);
    const png = await p.screenshot({ encoding: 'base64', clip: { x: 0, y: 0, width: 1180, height: 820 } }); await style.evaluate((s) => s.remove());
    return p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const cx = im.width / 2, cy = im.height / 2, d = g.getImageData(cx - 40, cy - 40, 80, 80).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4); }, png);
  };
  const withHair = await shade();
  await p.screenshot({ path: 'shots/t105-forearm.png' });
  await p.evaluate(() => window.__ink.setBodyHair('none')); await wait(300);
  const bare = await shade();
  assert.ok(withHair < bare - 4, `hair darkens the forearm: ${withHair} vs ${bare}`);
  await p.evaluate(() => window.__ink.setBodyHair('light')); await wait(300);
  const light = await shade();
  assert.ok(light < bare - 1 && light > withHair, `light is between: ${light}`);

  // reload: still on, same field
  await p.evaluate(() => window.__ink.setBodyHair('full'));
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  assert.equal(await p.evaluate(() => window.__ink.bodyHair()), 'full', 'comes back after a reload');
  const d2 = await dens(); assert.ok(Math.abs(d2.sum - d1.sum) < d1.sum * 0.05, `same field after a reload ${d2.sum} ${d1.sum}`);
  // a new shape: the field follows it, a female body has far less
  await p.evaluate(() => window.__ink.setShape({ figure: 'female' })); await wait(600);
  const d3 = await dens(); assert.ok(d3.sum < d1.sum * 0.25 && d3.sum > 0, `female body: far less ${d3.sum}`);
  // a pose: the posed body gets the same field
  if (await p.evaluate(() => !!window.__ink.setPose)) {
    await p.evaluate(() => window.__ink.setShape({ figure: 'male' })); await wait(400);
    await p.evaluate(() => window.__ink.setPose('twist')); await wait(1200);
    const posed = await p.evaluate(() => { const g = window.__ink.posedGeometry(); if (!g || !g.attributes.bhair) return null; const B = g.attributes.bhair.array; let s = 0; for (let v = 0; v < 13380; v++) s += B[v * 4 + 3]; return s; });
    if (posed != null) assert.ok(Math.abs(posed - d1.sum) < d1.sum * 0.05, `posed body carries the same hair ${posed}`);
  }
}
