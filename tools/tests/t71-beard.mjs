// Beard (Body > Hair): No beard, Stubble, Short beard or Full beard, painted on the skin, with real
// strands for Full. Kept on this device, nothing in the project changes; it takes the hair colour,
// stays on the face in a pose and grows again on a new shape.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  const head = await p.evaluate(() => { const P = window.__ink.positions(); let y = 0, z = 0; for (let v = 13380; v < 13524; v++) { y += P[v * 3 + 1]; z += P[v * 3 + 2]; } return [y / 144, z / 144]; });
  const look = async (theta, name) => {
    await p.evaluate(([h, t]) => { Object.assign(window.__ink.goal, { theta: t, phi: Math.PI / 2 - 0.05, roll: 0, tx: 0, ty: h[0] - 0.09, tz: h[1] + 0.02, r: 0.62 }); window.__ink.cur.r = 0.63; }, [head, theta]);
    await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 });
    const style = await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' }); await wait(250);
    await p.screenshot({ path: `shots/t71-${name}.png` }); await style.evaluate((s) => s.remove());
  };
  // the deepest beard on the skin, and a spot on the nape
  const spots = () => p.evaluate(() => {
    const B = window.__ink.beardField(), P = window.__ink.positions(); let best = -1, bv = -1, count = 0;
    for (let v = 0; v < 13380; v++) { if (B[v] > 0) count++; if (B[v] > bv) { bv = B[v]; best = v; } }
    let nape = 0, nz = Infinity;
    for (let v = 0; v < 13380; v++) { const y = P[v * 3 + 1]; if (y > 1.45 && y < 1.5 && Math.abs(P[v * 3]) < 0.02 && P[v * 3 + 2] < nz) { nz = P[v * 3 + 2]; nape = v; } }
    const at = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    return { chin: at(best), most: bv, nape: at(nape), count };
  });
  const hidden = (sel) => p.$eval(sel, (e) => e.hidden || getComputedStyle(e).display === 'none');

  assert.equal(await p.evaluate(() => window.__ink.beard()), 'none', 'no beard to start with');
  assert.equal((await p.evaluate(() => window.__ink.beardStrands())).visible, false, 'no strands to start with');
  await p.click('#bodyBtn'); await wait(200);
  const btns = await p.$$eval('#beardRow [data-beard]', (es) => es.map((e) => { const r = e.getBoundingClientRect(), pr = e.closest('#bodyPop').getBoundingClientRect(); return [e.textContent, r.height, r.left >= pr.left - 1 && r.right <= pr.right + 1]; }));
  assert.deepEqual(btns.map((b) => b[0]), ['No beard', 'Stubble', 'Short beard', 'Full beard']);
  for (const [t, hgt, fits] of btns) assert.ok(hgt >= 44 && fits, `${t}: big enough and inside the panel (${hgt})`);
  // bald, so the colour row is hidden until there is a beard
  await p.click('#hairRow [data-hair="none"]'); await wait(200);
  assert.equal(await hidden('#hairCols'), true, 'no colours for no hair and no beard');

  await p.click('#beardRow [data-beard="stubble"]'); await wait(300);
  assert.equal(await hidden('#hairCols'), false, 'colours show for a beard');
  assert.equal(await p.$eval('#beardRow [data-beard="stubble"]', (e) => e.getAttribute('aria-pressed')), 'true');
  let s = await spots();
  console.log('beard on', s.count, 'vertices, deepest', s.most.toFixed(4));
  assert.ok(s.count > 300 && s.most > 0.005, 'a beard on the face');
  assert.equal((await p.evaluate(() => window.__ink.beardStrands())).visible, false, 'stubble is painted, no strands');
  await p.keyboard.press('Escape'); await wait(200);
  await look(0, 'stubble-front'); await look(0.9, 'stubble-side');
  await p.click('#bodyBtn'); await wait(200);
  await p.click('#beardRow [data-beard="short"]'); await wait(300);
  assert.equal((await p.evaluate(() => window.__ink.beardStrands())).visible, false, 'short is painted, no strands');
  await p.keyboard.press('Escape'); await wait(200);
  await look(0.5, 'short');

  await p.click('#bodyBtn'); await wait(200);
  const t0 = Date.now(); await p.click('#beardRow [data-beard="full"]'); await wait(300);
  const bs = await p.evaluate(() => window.__ink.beardStrands());
  console.log('full beard strands', bs.strands, 'shown after', Date.now() - t0, 'ms');
  assert.ok(bs.visible && bs.strands > 10000, 'full beard strands show');
  const was = await p.evaluate(() => window.__ink.hair());
  await p.click('[data-hair-colour="blond"]'); await wait(200);
  assert.notDeepEqual(await p.evaluate(() => window.__ink.hair()), was, 'colour picked');
  await p.click('#hairRow [data-hair="short"]'); await wait(200);
  await p.keyboard.press('Escape'); await wait(200);
  await look(0, 'full-front'); await look(0.9, 'full-side');
  assert.equal(await p.evaluate((q) => window.__ink.beardCovers(q), s.chin), true, 'over the chin');
  assert.equal(await p.evaluate((q) => window.__ink.beardCovers(q), s.nape), false, 'not over the nape');

  // the head turns and bows: the beard keeps its place on the face
  await p.evaluate(() => window.__ink.setPoseRotations({ neck01: [0.15, 0.3, 0, 0.94], head: [0.1, 0.2, 0, 0.97] }));
  await wait(300); await look(0.7, 'full-posed');
  const pr = (await p.evaluate(() => window.__ink.beardStrands())).probe;
  for (const [rest, drawn] of pr) assert.ok(Math.abs(rest - drawn) < 0.004, `stays on the face in a pose (${rest.toFixed(4)} vs ${drawn.toFixed(4)})`);
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(300);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'project not changed');

  // a new shape: the beard is worked out again and the strands grow on it
  const probeA = (await p.evaluate(() => window.__ink.beardStrands())).probe[0][0];
  await p.evaluate(() => window.__ink.setShape({ figure: 'female', muscle: 0.5, weight: 0.7, fit: {} })); await wait(1200);
  const after = await p.evaluate(() => window.__ink.beardStrands());
  assert.ok(after.visible && after.strands > 10000 && Math.abs(after.probe[0][0] - probeA) > 1e-6, 'grown again on the new shape');
  assert.ok((await spots()).count > 300, 'beard worked out on the new shape');

  await p.evaluate(() => window.__ink.setBeard('none')); await wait(200);
  assert.equal((await p.evaluate(() => window.__ink.beardStrands())).visible, false, 'No beard hides it');
  await p.evaluate(() => window.__ink.setBeard('full')); await wait(300);
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(600);
  assert.equal(await p.evaluate(() => window.__ink.beard()), 'full', 'kept on this device');
  assert.ok((await p.evaluate(() => window.__ink.beardStrands())).visible, 'strands back after a reload');
  console.log('PASS t71 beard: three styles, buttons big enough, takes the hair colour, strands for Full, stays on the face in a pose, grows again on a new shape, kept on this device');
}
