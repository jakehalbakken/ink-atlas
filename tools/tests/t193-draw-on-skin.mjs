// Draw right on the skin, in a layer (2026-11-25, Jake: "select an area of skin like with a brush and then
// have that part be something I can edit and draw on in a layer if I want to like add to a tattoo or like
// sketch something in shape without having to like do it in Procreate"). Driven by touch and the Pencil at
// iPad landscape, with the bar checked at portrait too:
// - the brush in Layers paints an area of skin; Draw here makes a new planned layer there, one undo step
// - the Pencil draws on it, the view stays put, a finger then moves the view instead of drawing
// - a two-finger tap undoes a stroke, a three-finger tap redoes it; the Undo and Redo buttons do the same
// - Stay inside keeps the ink in the area; off, it runs past the edge; the Eraser takes ink away
// - Done cuts the layer to what was drawn and is one undo step; nothing drawn adds nothing
// - Draw on it from a tattoo: a new layer just above it, or On the tattoo itself (a version kept)
// - Cancel after drawing asks first; Throw away puts everything back exactly; a page close keeps it
// - every control in the bar is 44 pt or more in both orientations
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id], i) => ({ x, y, id: id || i + 1, radiusX: 8, radiusY: 8, force: 1 })) });
  const tapWith = async (pts) => { await touch('touchStart', pts); await touch('touchEnd', []); await wait(400); };
  const pen = (pts) => p.evaluate((pts) => {
    const c = document.querySelector('#stage canvas'), ev = (type, [x, y], pr) => c.dispatchEvent(new PointerEvent(type, { pointerId: 41, pointerType: 'pen', pressure: pr, clientX: x, clientY: y, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    ev('pointerdown', pts[0], 0.5); for (let i = 1; i < pts.length; i++) ev('pointermove', pts[i], 0.3 + 0.6 * i / pts.length); ev('pointerup', pts[pts.length - 1], 0);
  }, pts);
  const finger = async (pts) => { await touch('touchStart', [pts[0]]); for (const q of pts.slice(1)) { await touch('touchMove', [q]); await wait(16); } await touch('touchEnd', []); await wait(300); };
  const line = (a, b, n = 14) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  const S = () => p.evaluate(() => window.__ink.state());
  const D = () => p.evaluate(() => { const d = window.__ink.drawing(); return d && { ...d, maskAt: undefined, artAt: undefined, inked: d.inked(12), maskBox: d.maskBox() }; });
  const cam = () => p.evaluate(() => ({ ...window.__ink.goal }));
  const front = async () => { await p.click('#views [data-view="0"]'); await p.waitForFunction(() => window.__ink.settled(), { timeout: 10000 }); await wait(300); };
  const all44 = async (sel) => { const r = await p.$$eval(sel, (es) => es.filter((e) => e.checkVisibility() && e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.textContent.trim() || e.getAttribute('aria-label'), Math.round(r.width), Math.round(r.height)]; })); assert.ok(r.length, sel + ' shows'); for (const [n, w, h] of r) assert.ok(w >= 44 && h >= 44, `${sel} "${n}" is ${w}x${h}`); };
  const shown = (sel) => p.$eval(sel, (e) => !e.hidden && e.checkVisibility());
  if (!(await p.evaluate(() => document.querySelector('#layersDock').classList.contains('open')))) { await p.click('#ldToggle'); await wait(400); }
  await front();
  const st0 = await S(), n0 = st0.tattoos.length;
  // the belly, clear of the sample tattoos
  const belly = await p.evaluate(() => window.__ink.surfaceHit([0.03, 1.06, 0.5], [0, 0, -1]));
  const s = await p.evaluate((pos) => window.__ink.projectPoint(pos), belly.pos);

  // 1. the brush paints an area, Draw here makes a layer
  assert.ok(await shown('#drawSkin'), 'the brush is in Layers');
  await p.click('#drawSkin'); await wait(300);
  assert.ok(await shown('#paintBar'), 'paint bar shows');
  assert.equal(await p.$eval('#paintHere', (e) => e.disabled), true, 'Draw here waits for paint');
  await finger(line([s.x - 40, s.y - 10], [s.x + 40, s.y + 10], 16));
  await finger(line([s.x - 40, s.y + 25], [s.x + 40, s.y + 30], 16));
  assert.ok(await p.evaluate(() => window.__ink.painting()) > 3, 'painted some skin');
  assert.equal(await p.$eval('#paintHere', (e) => e.disabled), false);
  const u0 = await p.evaluate(() => window.__ink.undoLen());
  await p.click('#paintHere');
  await p.waitForFunction(() => !!window.__ink.drawing(), { timeout: 10000 }); await wait(400);
  let d = await D();
  assert.equal(d.fresh, true); assert.equal(d.hasArea, true); assert.equal(d.clip, true, 'Stay inside is on for an area');
  assert.ok(d.inked.inside > 100, 'the area is in the layer: ' + d.inked.inside);
  { const m = d.maskBox; assert.ok(m && m.x > 0 && m.y > 0 && m.x + m.w < d.W && m.y + m.h < d.H, `the layer reaches past the area (layer ${d.W}x${d.H}, area ${JSON.stringify(m)})`); }
  assert.equal((await S()).tattoos.length, n0 + 1, 'a new layer'); assert.equal(await p.evaluate(() => window.__ink.undoLen()), u0 + 1, 'one undo step so far');
  const layer = (await S()).tattoos.find((t) => t.id === d.id); assert.equal(layer.status, 'planned'); assert.match(layer.name, /^Sketch/);
  assert.ok(await shown('#drawBar'), 'the drawing bar shows'); assert.equal(await p.$eval('#paintBar', (e) => e.hidden), true);
  assert.equal(await p.$eval('#layersDock', (e) => getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden'), true, 'Layers steps aside');
  await all44('#drawBar button:not([hidden]), #drawBar input[type=color]');

  // 2. the Pencil draws, the view stays put, fingers then move the view
  const c0 = await cam();
  await pen(line([s.x - 25, s.y], [s.x + 25, s.y + 15], 20));
  await wait(300);
  d = await D(); assert.equal(d.steps, 1, 'one stroke'); assert.ok(d.inked.n > 20, 'ink on the layer: ' + d.inked.n);
  const c1 = await cam(); assert.equal(c1.theta, c0.theta, 'drawing does not turn the view'); assert.equal(c1.phi, c0.phi);
  assert.equal(d.fingers, false, 'after the Pencil, fingers move the view');
  await finger(line([s.x - 10, s.y + 5], [s.x + 30, s.y + 5], 8));
  d = await D(); assert.equal(d.steps, 1, 'a finger did not draw');
  await front();

  // 3. two-finger tap undoes a stroke, three-finger tap redoes it, the buttons too
  const spot = await p.evaluate(() => { for (const [x, y] of [[140, 420], [180, 560], [120, 300], [220, 680]]) { const e = document.elementFromPoint(x, y), e2 = document.elementFromPoint(x + 70, y); if (e && e.tagName === 'CANVAS' && e2 && e2.tagName === 'CANVAS') return [x, y]; } return null; });
  assert.ok(spot, 'canvas to tap on');
  const n1 = d.inked.n;
  await tapWith([[spot[0], spot[1], 1], [spot[0] + 70, spot[1], 2]]);
  d = await D(); assert.equal(d.steps, 0, 'two-finger tap undid the stroke'); assert.equal(d.inked.n, 0); assert.equal(d.canRedo, true);
  assert.equal((await S()).tattoos.length, n0 + 1, 'and left the layer');
  await tapWith([[spot[0], spot[1], 1], [spot[0] + 50, spot[1], 2], [spot[0] + 25, spot[1] + 50, 3]]);
  d = await D(); assert.equal(d.steps, 1, 'three-finger tap redid it'); assert.equal(d.inked.n, n1);
  await p.click('#undo'); await wait(200); assert.equal((await D()).steps, 0, 'Undo button');
  await p.click('#redo'); await wait(200); assert.equal((await D()).steps, 1, 'Redo button');
  await front();

  // 4. Stay inside, then not; the Eraser
  const wide = line([s.x - 160, s.y + 10], [s.x + 160, s.y + 10], 60);
  await p.click('#dbTools [data-tool="brush"]'); await wait(100);
  await p.evaluate(() => { const e = document.querySelector('#dbSize'); e.value = 70; e.dispatchEvent(new Event('input', { bubbles: true })); });
  // a stroke from inside the area straight down past its lower edge, well into the room round it
  const cross = line([s.x, s.y + 10], [s.x + 30, s.y + 330], 70);
  await pen(cross); await wait(300);
  d = await D(); assert.equal(d.tool, 'brush'); assert.ok(d.inked.n > n1, 'the brush drew'); assert.ok(d.inked.out <= d.inked.n * 0.01, `kept inside the area (${d.inked.out} of ${d.inked.n} outside)`);
  assert.ok(d.inked.atEdge > 50, `the stroke reached the area's own edge (${d.inked.atEdge} inked pixels within 12 px of it; area box ${JSON.stringify(d.maskBox)}, ink ${JSON.stringify(d.ink)})`);
  await p.click('#dbClip'); await wait(100); assert.equal((await D()).clip, false);
  await pen(cross.map(([x, y]) => [x + 8, y])); await wait(300);
  d = await D(); assert.ok(d.inked.out > 0, `with Stay inside off the ink runs past the edge (layer ${d.W}x${d.H}, area ${JSON.stringify(d.maskBox)}, ink ${JSON.stringify(d.ink)}, ${d.steps} strokes)`);
  await p.click('#dbClip'); await wait(100);
  const before = d.inked.n;
  await p.click('#dbTools [data-tool="eraser"]'); await wait(100);
  await pen(wide); await wait(300);
  d = await D(); assert.ok(d.inked.n < before, `the eraser took ink away (${before} to ${d.inked.n})`);
  assert.equal(await shown('#dbColorRow'), false, 'no colour for the eraser');
  await p.click('#dbTools [data-tool="pencil"]'); await wait(100);
  await p.click('#dbSwatches [data-c]:nth-child(3)'); await wait(100);
  await pen(line([s.x - 20, s.y + 20], [s.x + 20, s.y + 20], 10)); await wait(300);
  const steps = (await D()).steps;

  // 5. Done: cut to the ink, one undo step for the whole layer
  await p.click('#dbDone'); await p.waitForFunction(() => !window.__ink.drawing(), { timeout: 10000 }); await wait(500);
  let st = await S(); assert.equal(st.tattoos.length, n0 + 1);
  const kept = st.tattoos.find((t) => t.id === layer.id); assert.notEqual(kept.img, layer.img, 'the drawing is the layer picture');
  assert.ok(kept.width < layer.width, `cut to what was drawn (${(kept.width * 100).toFixed(1)} of ${(layer.width * 100).toFixed(1)} cm)`);
  assert.ok(await p.evaluate((id) => window.__ink.shownIds().includes(id), kept.id), 'shows on the body');
  assert.equal(await p.evaluate(() => window.__ink.undoLen()), u0 + 1, 'the whole drawing is one undo step');
  assert.equal(await p.$eval('#drawBar', (e) => e.hidden), true);
  await p.click('#undo'); await wait(400); assert.equal((await S()).tattoos.length, n0, 'Undo takes the layer away');
  await p.click('#redo'); await wait(400); assert.equal((await S()).tattoos.length, n0 + 1, 'Redo brings it back');
  // a layer with nothing drawn adds nothing
  await p.click('#drawSkin'); await wait(300); await finger(line([s.x - 30, s.y + 40], [s.x + 30, s.y + 40], 10));
  await p.click('#paintHere'); await p.waitForFunction(() => !!window.__ink.drawing(), { timeout: 10000 }); await wait(300);
  await p.click('#dbDone'); await p.waitForFunction(() => !window.__ink.drawing(), { timeout: 10000 }); await wait(300);
  assert.equal((await S()).tattoos.length, n0 + 1, 'nothing drawn, no layer');

  // 6. Draw on it from a tattoo: a new layer just above it, or on the tattoo itself
  st = await S();
  const sun = st.tattoos.find((t) => /Sunburst/.test(t.name));
  await p.evaluate((id) => window.__ink.select(id), sun.id); await wait(500);
  assert.ok(await shown('#bDrawOn'), 'Draw on it in the sheet'); await all44('#bDrawOn');
  await p.click('#bDrawOn'); await p.waitForFunction(() => !!window.__ink.drawing(), { timeout: 10000 }); await wait(300);
  d = await D(); assert.equal(d.fresh, true); assert.equal(d.from, sun.id); assert.equal(d.hasArea, false);
  st = await S(); const at = st.tattoos.findIndex((t) => t.id === sun.id); assert.equal(st.tattoos[at + 1].id, d.id, 'the new layer sits just above it');
  assert.ok(await shown('#dbWhereRow'), 'New layer or On the tattoo');
  await p.click('#dbWhere [data-where="on"]'); await p.waitForFunction((id) => window.__ink.drawing() && window.__ink.drawing().id === id, { timeout: 10000 }, sun.id); await wait(300);
  assert.equal((await S()).tattoos.length, n0 + 1, 'switching took the empty layer away');
  d = await D(); assert.equal(d.fresh, false); assert.ok(d.inked.n > 100, 'the tattoo artwork is there to draw on');
  const sp = await p.evaluate((pos) => window.__ink.projectPoint(pos), sun.pos);
  await pen(line([sp.x - 15, sp.y - 15], [sp.x + 15, sp.y + 15], 12)); await wait(300);
  assert.equal((await D()).changed, true);
  const u1 = await p.evaluate(() => window.__ink.undoLen());
  await p.click('#dbDone'); await p.waitForFunction(() => !window.__ink.drawing(), { timeout: 10000 }); await wait(500);
  let sun2 = (await S()).tattoos.find((t) => t.id === sun.id);
  assert.notEqual(sun2.img, sun.img, 'the drawing is on the tattoo'); assert.ok((sun2.versions || []).some((v) => v.img === sun.img), 'its earlier artwork is a version');
  assert.equal(await p.evaluate(() => window.__ink.undoLen()), u1, 'one undo step');
  await p.click('#undo'); await wait(400); sun2 = (await S()).tattoos.find((t) => t.id === sun.id); assert.equal(sun2.img, sun.img, 'Undo puts the artwork back');

  // 7. Cancel asks once something is drawn; Throw away puts everything back; a page close keeps it
  const before7 = JSON.stringify((await S()).tattoos);
  await p.evaluate((id) => window.__ink.select(id), sun.id); await wait(400);
  await p.click('#bDrawOn'); await p.waitForFunction(() => !!window.__ink.drawing(), { timeout: 10000 }); await wait(300);
  await pen(line([sp.x - 15, sp.y + 15], [sp.x + 15, sp.y - 15], 12)); await wait(300);
  await p.evaluate(() => window.__ink.autosaveDrawing());
  d = await D(); assert.ok(d.autoKey, 'saved on the device as it goes');
  assert.equal((await S()).tattoos.find((t) => t.id === d.id).img, d.autoKey, 'the layer points at the saved drawing');
  await p.click('#dbCancel'); await wait(200);
  assert.ok(await shown('#dbAsk'), 'Cancel asks first'); await all44('#dbAsk button');
  await p.click('#dbKeep'); await wait(200); assert.ok(await p.evaluate(() => !!window.__ink.drawing()), 'Keep drawing goes back to it');
  await p.click('#dbCancel'); await wait(200); await p.click('#dbDiscard'); await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.drawing()), null);
  assert.equal(JSON.stringify((await S()).tattoos), before7, 'Throw away puts every tattoo back exactly');

  // 8. the bar at portrait
  await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, hasTouch: true }); await wait(800);
  await p.evaluate((id) => window.__ink.select(id), sun.id); await wait(400);
  await p.click('#bDrawOn'); await p.waitForFunction(() => !!window.__ink.drawing(), { timeout: 10000 }); await wait(400);
  await all44('#drawBar button:not([hidden]), #drawBar input[type=color]');
  const bar = await p.$eval('#drawBar', (e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.bottom, innerWidth, innerHeight]; });
  assert.ok(bar[0] >= 0 && bar[1] <= bar[3] && bar[2] <= bar[4] + 1, 'the bar fits the screen: ' + bar);
  await p.click('#dbCancel'); await wait(300); assert.equal(await p.evaluate(() => window.__ink.drawing()), null, 'Cancel with nothing drawn just closes');
  assert.ok(JSON.parse(await p.evaluate(() => localStorage.getItem('ia-tried') || '[]')).includes('drawSkin'), 'New to try ticks it');
  console.log(`PASS t193 draw on the skin: area to a new layer, Pencil strokes (${steps} kept), tap undo and redo, Stay inside, eraser, Done cut to the ink as one step, draw on a tattoo or just above it, Cancel asks, both orientations`);
}
