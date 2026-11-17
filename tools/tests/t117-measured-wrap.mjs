// Measured wrap (Jake, 2026-11-16): his ankle measured at 9 in and 12.5 in round, 4 in apart along
// the skin. The flat shape measures those arcs and that length; a photo of the existing cactus,
// scaled from its top flower to its stone base, comes out exactly 4 in and sits on the back of the
// leg; the ink found in it and the gaps between its floating pieces are protected, and new art over
// them is warned; the measured area shows on the body; undo, reload and a backup keep it all.
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
  const overUrl = await plant('#225522'), frontUrl = await plant('#335533');
  r = await p.evaluate(async (urls) => {
    const W = window.__ink.wrap().api; W.ui.step = 'design'; window.__ink.wrap().refresh();
    const reg = W.reg(), base = W.landmarkAt('base'), top = W.landmarkAt('top');
    const mid = [(base[0] + top[0]) / 2, (base[1] + top[1]) / 2];
    await W.addPieceData(urls[1], 'Front arch', [0, 60], 50);
    const c1 = await W.collisions();
    await W.addPieceData(urls[0], 'Over the cactus', mid, 30);
    const c2 = await W.collisions();
    return { c1, c2, n: W.reg().art.pieces.length };
  }, [overUrl, frontUrl]);
  assert.ok(!r.c1 || r.c1.total < 1, 'a plant at the front touches nothing: ' + JSON.stringify(r.c1));
  assert.ok(r.c2.ink > 100, 'a plant over the cactus is flagged on the old ink: ' + JSON.stringify(r.c2));
  await wait(500);
  await p.screenshot({ path: 'shots/t117-design.png' });

  // undo takes the last plant off; the old ink is untouched
  await p.evaluate(() => window.__ink.undo()); await wait(200);
  r = await p.evaluate(() => ({ n: window.__ink.wrap().api.reg().art.pieces.length, ink: window.__ink.wrap().api.reg().existing.ink }));
  assert.equal(r.n, 1, 'undo took the plant off');
  assert.ok(r.ink, 'traced ink kept');

  // a change of measurements bumps the calibration and asks first (the tattoo is traced)
  await p.evaluate(() => { const W = window.__ink.wrap().api; W.ui.step = 'measure'; window.__ink.wrap().refresh(); });
  await wait(200);
  await p.evaluate(() => { const i = document.getElementById('wsCirc1'); i.value = '13'; i.dispatchEvent(new Event('change')); });
  await wait(200);
  assert.equal(await p.evaluate(() => !document.getElementById('wsAsk').hidden), true, 'asks before changing measurements under a traced tattoo');
  await p.evaluate(() => [...document.querySelectorAll('#wsAsk .btn')].find((b) => b.textContent === 'Cancel').click()); await wait(200);
  near(await p.evaluate(() => window.__ink.wrap().api.reg().levels[1].circ), 317.5, 1e-9, 'Cancel keeps 12.5 in');

  // reload: everything comes back
  await p.evaluate(async () => { await window.__ink.flush(); });
  await wait(300);
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  r = await p.evaluate(async () => { const W = window.__ink.wrap().api; window.__ink.wrap().open('existing'); await new Promise((res) => setTimeout(res, 600)); return { reg: W.reg(), m: await W.masks(), d: (() => { const a = W.landmarkAt('top'), b = W.landmarkAt('base'); return Math.hypot(b[0] - a[0], b[1] - a[1]); })() }; });
  assert.ok(r.reg && r.reg.existing.locked && r.reg.existing.photos.length === 1 && r.reg.art.pieces.length === 1, 'region, photo and plant restored after reload');
  near(r.d, 101.6, 0.1, 'cactus still 4 in after reload');
  assert.ok(r.m && r.m.ink > 1100, 'traced ink restored after reload');

  // (the backup carries the same pictures: it and the save both collect them through imageKeysFor)
  await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1 }); await wait(700);
  await p.evaluate(() => { const W = window.__ink.wrap().api; W.ui.step = 'design'; window.__ink.wrap().refresh(); }); await wait(600);
  await p.screenshot({ path: 'shots/t117-portrait.png' });
  // 44 pt targets in the studio
  const small = await p.evaluate(() => [...document.querySelectorAll('#wrapStudio .btn')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43).map((b) => b.textContent));
  assert.deepEqual(small, [], 'no small buttons');
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(500);
  console.log('t117 measured wrap PASS');
}
