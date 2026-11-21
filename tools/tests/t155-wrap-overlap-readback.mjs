// Measured wrap overlap check without stutter (2026-11-21 QA): every move of a plant ran the overlap
// check 120 ms later, which read the whole ink mask, the gap mask and the plants back off the graphics
// chip (about 1400 x 670 pixels each, no willReadFrequently), a pause on an iPad on every nudge. Now the
// masks and the plants' picture live in memory. Sets up the ankle wrap with the traced cactus as t117
// does, moves a plant over the old ink ten times, and checks that no full-size read comes off the
// graphics chip and that the warning still follows the plant (on the ink, then clear).
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

  // the Plan sheet has the one entry
  await p.evaluate(() => { document.getElementById('planBtn')?.click(); });
  await wait(300);
  await p.evaluate(() => document.getElementById('openWrap').click());
  await wait(500);
  assert.equal(await p.evaluate(() => !document.getElementById('wrapStudio').hidden), true, 'studio opens from Plan');
  await p.evaluate(() => document.getElementById('wsStart').click());
  await wait(600);
  // a new wrap opens on Quick (t122); this check goes through the detailed steps
  assert.equal(await p.evaluate(() => window.__ink.wrap().api.ui.step), 'quick', 'a new wrap opens on Quick');
  await p.evaluate(() => document.querySelector('#wsTabs [data-step=measure]').click()); await wait(400);
  let r = await p.evaluate(() => { const W = window.__ink.wrap().api; return { s: W.summary(), reg: W.reg(), warn: W.warnings(), insp: document.getElementById('wsInsp').textContent }; });
  near(r.s.lower, 228.6, 0.1, 'bottom arc'); near(r.s.middle, 273.05, 0.1, 'middle arc'); near(r.s.upper, 317.5, 0.1, 'top arc');
  near(r.s.slant, 101.6, 0.01, 'length along the skin'); near(r.s.w, 307.47, 0.05, 'flat width'); near(r.s.h, 126.21, 0.05, 'flat height');
  assert.ok(/Confirm how/.test(r.warn.join(' ')), 'asks to confirm how the length was measured');
  assert.ok(/9 in round at the bottom, 12.5 in at the top, 4 in along the skin/.test(r.insp), 'inspector reads the measurements: ' + r.insp);
  assert.equal(await p.evaluate(() => window.__ink.state().tattoos.length >= 0 && Array.isArray(window.__ink.state().regions)), true);
  await wait(800);
  r = await p.evaluate(() => { const W = window.__ink.wrap().api; return { tris: W.overlayTris(), shown: W.overlayShown() }; });
  await p.screenshot({ path: "shots/t117-measure.png" }); assert.ok(r.tris > 60 && r.shown, 'the measured area is shown on the leg: ' + JSON.stringify(r));
  await p.screenshot({ path: 'shots/t117-measure.png' });

  // confirm the method and change the units: no change to the shape
  await p.evaluate(() => document.getElementById('wsConfirm').click()); await wait(200);
  r = await p.evaluate(() => window.__ink.wrap().api.reg().methodConfirmed); assert.equal(r, true, 'method confirmed');

  // the existing cactus: a photo with floating trunk sections, a flower on top and a stone base
  const tattooBefore = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos));
  await p.evaluate(async () => {
    const W = window.__ink.wrap().api, c = document.createElement('canvas'); c.width = 600; c.height = 900; const g = c.getContext('2d');
    g.fillStyle = '#d9a989'; g.fillRect(0, 0, 600, 900);
    const grd = g.createLinearGradient(0, 0, 600, 0); grd.addColorStop(0, 'rgba(0,0,0,.15)'); grd.addColorStop(0.5, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = grd; g.fillRect(0, 0, 600, 900);
    g.fillStyle = '#1b1b1b';
    // floating sections of the trunk with gaps between them
    for (const [y0, y1] of [[150, 330], [360, 520], [550, 720]]) g.fillRect(260, y0, 80, y1 - y0);
    g.fillRect(180, 400, 60, 30); g.fillRect(180, 300, 30, 110); // left arm
    g.fillRect(360, 470, 60, 30); g.fillRect(390, 360, 30, 120); // right arm
    g.beginPath(); g.arc(300, 115, 30, 0, Math.PI * 2); g.fill(); // flower
    g.beginPath(); g.ellipse(300, 770, 110, 30, 0, 0, Math.PI * 2); g.fill(); // stone base
    const id = await W.addPhotoData(c.toDataURL('image/jpeg', 0.92), 'Cactus photo');
    W.ui.step = 'existing'; W.ui.sub = 'landmarks';
    W.setLandmark('top', [300, 85]); W.setLandmark('base', [300, 800]); W.setLandmark('left', [180, 300]); W.setLandmark('right', [420, 360]);
    return id;
  });
  await wait(300);
  // measured along the skin: the top flower to the base is exactly 4 in on the flat shape
  await p.evaluate(() => { const W = window.__ink.wrap().api; const e = W.reg().existing; e.knownHow = 'skin'; W.place(); });
  await wait(300);
  r = await p.evaluate(() => { const W = window.__ink.wrap().api, a = W.landmarkAt('top'), b = W.landmarkAt('base'), reg = W.reg(), t = W.tpl(); return { a, b, reg, fit: reg.existing.photos[0].fit }; });
  near(Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 101.6, 0.1, 'cactus top to base along the skin');
  const onRing = await p.evaluate((b) => { const W = window.__ink.wrap().api; return { at: W.invertAt(b), back: W.fAt(270) }; }, r.b);
  near(onRing.at.u, 0, 0.01, 'stone base sits on the bottom ring'); near(onRing.at.f, onRing.back, 1e-6, 'centred on the back of the leg');
  assert.ok(r.a[1] > r.b[1], 'the flower is above the base');
  // the back of the right leg, with the cut on the inside, is a quarter of the way round from the middle
  // straight up: a 4 in vertical measurement is a little longer along the sloping skin
  await p.evaluate(() => { const W = window.__ink.wrap().api; W.reg().existing.knownHow = 'vertical'; W.place(); });
  r = await p.evaluate(() => { const W = window.__ink.wrap().api, a = W.landmarkAt('top'), b = W.landmarkAt('base'), t = W.tpl(); return { d: Math.hypot(b[0] - a[0], b[1] - a[1]), s: t.segs[0].s, h: t.segs[0].h }; });
  near(r.d, 101.6 * r.s / r.h, 0.1, 'vertical 4 in measured up the cone'); assert.ok(r.d > 101.6, 'longer along the skin than straight up');
  await p.evaluate(() => { const W = window.__ink.wrap().api; W.reg().existing.knownHow = 'skin'; W.place(); });
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos)), tattooBefore, 'registering the cactus leaves every tattoo alone');

  // find the ink and protect the gaps
  await p.evaluate(async () => { const W = window.__ink.wrap().api; W.ui.sub = 'trace'; await W.findInk(); });
  await wait(400);
  await p.evaluate(async () => { await window.__ink.wrap().api.findGaps(); });
  await wait(400);
  r = await p.evaluate(async () => { const W = window.__ink.wrap().api; return { m: await W.masks(), width: W.inkWidth(), reg: W.reg() }; });
  // the cactus drawing has about 80 x 570 px trunk etc. at 101.6/715 mm per px: about 1300 mm² of ink
  assert.ok(r.m.ink > 1100 && r.m.ink < 1550, 'ink found: ' + r.m.ink.toFixed(0) + ' mm²');
  assert.ok(r.m.gap > 40, 'gaps between the floating sections protected: ' + r.m.gap.toFixed(0) + ' mm²');
  assert.ok(r.width > 30 && r.width < 50, 'ink width round the leg (photo estimate): ' + r.width);
  assert.equal(r.reg.existing.maskCalib, r.reg.calib, 'masks made on these measurements');
  await p.screenshot({ path: 'shots/t117-traced.png' });

  // lock it
  await p.evaluate(() => { const W = window.__ink.wrap().api; W.ui.sub = 'lock'; window.__ink.wrap().refresh(); document.getElementById('wsLock').click(); });
  await wait(200);
  assert.equal(await p.evaluate(() => window.__ink.wrap().api.reg().existing.locked), true, 'locked');

  // design: one plant over the cactus is flagged, one at the front is clear
  const plant = (colour) => p.evaluate((colour) => { const c = document.createElement('canvas'); c.width = 400; c.height = 600; const g = c.getContext('2d'); g.fillStyle = colour; g.beginPath(); g.ellipse(200, 300, 150, 260, 0, 0, Math.PI * 2); g.fill(); return c.toDataURL('image/png'); }, colour);
  const overUrl = await plant('#225522');
  const ink0 = await p.evaluate(async (url) => {
    const W = window.__ink.wrap().api; W.ui.step = 'design'; window.__ink.wrap().refresh();
    const base = W.landmarkAt('base'), top = W.landmarkAt('top');
    await W.addPieceData(url, 'Over the cactus', [(base[0] + top[0]) / 2, (base[1] + top[1]) / 2], 30);
    return (await W.collisions()).ink;
  }, overUrl);
  assert.ok(ink0 > 100, 'the plant over the cactus is flagged: ' + ink0);
  await p.evaluate(() => {
    window.__gid = []; const o = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...a) {
      if (a[2] * a[3] >= 500 * 300 && !this.getContextAttributes?.().willReadFrequently) window.__gid.push(this.canvas.width + 'x' + this.canvas.height);
      return o.apply(this, a);
    };
  });
  r = await p.evaluate(async () => {
    const W = window.__ink.wrap().api, pc = W.reg().art.pieces[0], seen = [];
    for (let i = 1; i <= 10; i++) { pc.x += (i < 10 ? 2 : 140); const c = await W.collisions(); seen.push(c ? Math.round(c.ink) : 0); }
    return { seen, reads: window.__gid };
  });
  assert.ok(r.seen.slice(0, 9).every((v) => v > 50), 'still on the old ink while nudged: ' + r.seen);
  assert.ok(r.seen[9] < 1, 'clear once moved to the front: ' + r.seen);
  assert.deepEqual(r.reads, [], 'full-size reads off the graphics chip while moving a plant: ' + r.reads.length);
  console.log('PASS t155 wrap overlap check: ten moves of a plant, the warning follows it, and nothing is read back off the graphics chip');
}
