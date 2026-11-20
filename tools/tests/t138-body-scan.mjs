// Bring in a 3D scan of me. A GLB like a phone app saves (another person's shape, lying with Z
// up, turned, in metres at 1.83 m, on a patch of floor) is picked from Files: the body moves onto
// it, standing and facing front, the height comes from the file, the sliders move towards it, the
// measurements are shown, in one undo step. The tattoos stay on the skin and pickable, a pose
// bends the scanned body, the 3D export carries it, a reload keeps it (it lives on this device,
// not in the project), a slider change pauses it and Back to my scan brings it back, Turn it round
// refits it turned, Hide and Remove work, and How to scan yourself names the two free apps.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { personScan, glb } from './scan-fixture.mjs';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const settled = () => p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 });
  const scan = () => p.evaluate(() => { const s = window.__ink.scan(); delete s.off; return s; });
  const min44 = async (sel) => { const m = await p.$$eval(sel, (bs) => Math.min(...bs.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }))); assert.ok(m >= 44 - 0.01, `${sel} 44pt: ${m}`); };
  writeFileSync('shots/t138-me.glb', glb(personScan()));
  await settled(); await wait(400);
  const st0 = JSON.parse(await p.evaluate(() => JSON.stringify(window.__ink.state())));
  assert.ok(st0.tattoos.length >= 1, 'tattoos to keep on the skin');
  const plain = await p.evaluate(() => Array.from(window.__ink.positions()));
  await p.evaluate(() => { window.toasts = []; new MutationObserver(() => { const t = document.querySelector('#toast').textContent; if (t) window.toasts.push(t); }).observe(document.querySelector('#toast'), { childList: true, subtree: true, characterData: true }); });

  // How to scan yourself
  await p.click('#bodyBtn'); await p.waitForSelector('#bodyPop:not([hidden])');
  assert.ok(await p.$eval('#scanBtn', (b) => !!b.offsetParent && /3D scan/.test(b.textContent)), 'Body has Bring in a 3D scan');
  await p.click('#scanHowBtn'); await p.waitForSelector('#scanHow:not([hidden])'); await wait(300);
  const how = await p.$eval('#scanHow', (n) => n.textContent);
  for (const w of ['Scaniverse', 'Polycam', 'tight clothes', 'arms slightly out', 'walks round you', 'GLB']) assert.ok(how.includes(w), `help says ${w}`);
  assert.ok(!/—/.test(how), 'no em-dashes');
  await min44('#scanHow .btn');
  await p.screenshot({ path: 'shots/t138-how.png' });
  await p.$eval('#scanHow [data-close]', (b) => b.click()); await wait(200);

  // pick the file
  const t0 = Date.now();
  await (await p.$('#scanFile')).uploadFile('shots/t138-me.glb');
  await p.waitForSelector('#scanSheet:not([hidden])', { timeout: 10000 });
  await wait(2500); await p.screenshot({ path: 'shots/t138-fitting.png' });
  await p.waitForSelector('#scanBar:not([hidden])', { timeout: 240000 });
  const ms = Date.now() - t0;
  await wait(800); await settled();
  await p.screenshot({ path: 'shots/t138-on.png' });
  const s1 = await scan(), st1 = await p.evaluate(() => window.__ink.state());
  assert.ok(s1.saved && s1.active, 'the scan is on the body');
  assert.equal(await p.$eval('#scanSheet', (n) => n.hidden), true, 'the fitting sheet goes away');
  assert.ok(Math.abs(st1.heightCm - 183) < 0.6, 'height from the file: ' + st1.heightCm);
  assert.ok((st1.fit.hips || 0) > 0.05, 'the sliders moved towards the scan: ' + JSON.stringify(st1.fit));
  assert.ok(s1.coverage > 0.85 && s1.quality.median < 0.006, 'it fits: ' + JSON.stringify({ c: s1.coverage, q: s1.quality }));
  const R = s1.align.R, R0 = [1, 0, 0, 0, 0, -1, 0, 1, 0]; // the file's Z up goes to Y up
  assert.ok(R[3] * R0[1] + R[4] * R0[4] + R[5] * R0[7] > 0.98 || Math.abs(R[5]) > 0.98, 'stood up: ' + R.map((x) => x.toFixed(2)));
  const text = await p.$eval('#scanBar', (n) => n.textContent);
  assert.match(text, /Your scan is on the body/); assert.match(text, /Chest \d+\.\d in/); assert.match(text, /Height 6′ 0″/);
  await min44('#scanBar .btn');
  // on a phone the bar fits, its buttons whole
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 }); await wait(700);
  await p.screenshot({ path: 'shots/t138-phone.png' });
  const fits = await p.evaluate(() => { const b = document.querySelector('#scanBar').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && [...document.querySelectorAll('#scanBar .btn')].every((x) => x.scrollWidth <= x.clientWidth + 1); });
  assert.ok(fits, 'the scan bar fits a phone');
  await min44('#scanBar .btn');
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(700);
  const moved = await p.evaluate((a) => { const P = window.__ink.positions(); let m = 0; for (let i = 0; i < 13380 * 3; i++) m = Math.max(m, Math.abs(P[i] - a[i])); return m; }, plain);
  assert.ok(moved > 0.01, 'the body moved onto the scan: ' + moved);
  // the tattoos are on the skin: their middle lies on the body's surface
  const onSkin = await p.evaluate(() => window.__ink.state().tattoos.map((t) => { const P = window.__ink.positions(); let d = Infinity; for (let v = 0; v < 13380; v++) d = Math.min(d, Math.hypot(P[v * 3] - t.pos[0], P[v * 3 + 1] - t.pos[1], P[v * 3 + 2] - t.pos[2])); return d; }));
  assert.ok(Math.max(...onSkin) < 0.015, 'every tattoo sits on the scanned skin: ' + onSkin.map((d) => (d * 1000).toFixed(1)));
  assert.equal((await p.evaluate(() => window.__ink.shownIds())).length, st1.tattoos.filter((t) => !t.hidden).length, 'every tattoo is drawn');
  await p.click('#scanDone'); await wait(300);
  await p.click('#ldList .ld-tat'); await wait(700);
  assert.ok(await p.evaluate(() => !!document.querySelector('#sheet:not([hidden])')), 'a tattoo is still picked and edited');
  // the Body readouts measure the scan
  await p.click('#bodyBtn'); await p.waitForSelector('#bodyPop:not([hidden])'); await wait(600);
  assert.equal(await p.$eval('#scanRow', (n) => n.hidden), false, 'Hide and Remove show');
  await p.evaluate(() => { for (const d of document.querySelectorAll('#fitGroups details')) d.open = true; }); await wait(400);
  const chestReads = parseFloat(await p.$eval('.mval[data-m=chest]', (b) => b.textContent));
  const chestScan = s1.measures.chest * st1.heightCm / 175;
  assert.ok(Math.abs(chestReads - chestScan) < 0.15, `the chest number is the scan's: ${chestReads} vs ${chestScan}`);
  await p.click('#bodyPop [data-close]'); await wait(300);

  // a pose bends the scanned body: a belly point stays where the scan put it while the arms move
  const belly = await p.evaluate(() => { const s = window.__ink.scan(), P = window.__ink.positions(); let best = -1, m = 0; for (let v = 0; v < 13380; v++) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; if (Math.abs(x) < 0.07 && y > 0.95 && y < 1.1 && z > 0.05) { const o = Math.hypot(s.off[v * 3], s.off[v * 3 + 1], s.off[v * 3 + 2]); if (o > m) { m = o; best = v; } } } return { v: best, off: m, at: [P[best * 3], P[best * 3 + 1], P[best * 3 + 2]] }; });
  assert.ok(belly.v >= 0 && belly.off > 0.003, 'the scan moved the belly: ' + JSON.stringify(belly));
  await p.evaluate(() => window.__ink.setPose('straightOut')); await p.waitForFunction(() => window.__ink.pose().settled, { timeout: 30000 }); await wait(500);
  const posed = await p.evaluate((v) => { const g = window.__ink.posedGeometry(), P = g.attributes.position.array; return [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; }, belly.v);
  assert.ok(Math.hypot(posed[0] - belly.at[0], posed[1] - belly.at[1], posed[2] - belly.at[2]) < 0.004, 'posed, the belly keeps the scan shape: ' + posed + ' vs ' + belly.at);
  await p.screenshot({ path: 'shots/t138-pose.png' });
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(800);

  // the 3D export carries the scan
  await p.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); window.saved = {}; const old = URL.createObjectURL; URL.createObjectURL = function (b) { if (b.name) window.saved[b.name] = b.arrayBuffer(); return old.call(this, b); }; });
  await p.click('#drawNew'); await wait(300); await p.click('#pm3dSend');
  await p.waitForFunction(() => !!window.saved['ink-atlas-model.usdz'] || window.toasts.some((x) => x.includes('Could not make')), { timeout: 150000 });
  const usdOk = await p.evaluate(async () => { const b = new Uint8Array(await window.saved['ink-atlas-model.usdz']); const t = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 4e6))); const m = /point3f\[\] points = \[([^\]]*)\]/.exec(t); if (!m) return null; const n = m[1].split('),').length; return n; });
  assert.ok(usdOk && usdOk >= 13380, 'the 3D body file has the scanned body: ' + usdOk);
  await p.keyboard.press('Escape'); await wait(300);

  // one undo takes the scan off, redo puts it back
  const undoLen = s1.undoLen;
  await p.evaluate(() => { for (const id of ['#pcMenu', '#sheet']) { const n = document.querySelector(id); if (n && !n.hidden) { const c = n.querySelector('[data-close]'); if (c) c.click(); } } });
  await p.evaluate(() => { const n = document.querySelector('#pcMenu'); if (!n.hidden) n.hidden = true; });
  while ((await p.evaluate(() => window.__ink.scan().undoLen)) > undoLen - 1) { await p.click('#undo'); await wait(500); }
  await settled();
  assert.equal((await scan()).active, false, 'undo leaves the plain body');
  const back = await p.evaluate((a) => { const P = window.__ink.positions(); let m = 0; for (let i = 0; i < 13380 * 3; i++) m = Math.max(m, Math.abs(P[i] - a[i])); return m; }, plain);
  assert.ok(back < 1e-5, 'exactly the body before: ' + back);
  const stU = await p.evaluate(() => window.__ink.state());
  assert.deepEqual(stU.fit, st0.fit); assert.equal(stU.heightCm, st0.heightCm);
  await p.click('#redo'); await wait(600); await settled();
  assert.equal((await scan()).active, true, 'redo puts the scan back');

  // only the shape and height changed in the project (tattoo positions follow the skin)
  const strip = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.fit; delete c.heightCm; delete c.measured; for (const t of c.tattoos) { delete t.pos; delete t.normal; delete t.width; } return c; };
  assert.deepEqual(strip(await p.evaluate(() => window.__ink.state())), strip(st0), 'nothing else in the project changed');
  assert.equal(JSON.stringify(await p.evaluate(() => window.__ink.state())).includes('"off"'), false, 'the scan is not in the project');

  // a reload keeps it, from this device
  await p.waitForFunction(() => document.querySelector('#saved') == null || !/Saving/.test(document.querySelector('#saved').textContent), { timeout: 10000 }).catch(() => {});
  await wait(1200);
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 60000 }); await settled(); await wait(500);
  assert.equal((await scan()).active, true, 'a reload brings the scan back');
  const onSkin2 = await p.evaluate(() => window.__ink.state().tattoos.map((t) => { const P = window.__ink.positions(); let d = Infinity; for (let v = 0; v < 13380; v++) d = Math.min(d, Math.hypot(P[v * 3] - t.pos[0], P[v * 3 + 1] - t.pos[1], P[v * 3 + 2] - t.pos[2])); return d; }));
  assert.ok(Math.max(...onSkin2) < 0.015, 'tattoos still on the skin after a reload');

  // a slider change pauses it; Back to my scan brings it back in one step
  await p.evaluate(() => window.__ink.setShape({ weight: 0.6 })); await wait(500);
  await p.click('#bodyBtn'); await p.waitForSelector('#bodyPop:not([hidden])'); await wait(300);
  assert.equal((await scan()).active, false, 'a different shape leaves the scan off');
  assert.equal(await p.$eval('#scanBack', (b) => b.hidden), false, 'Back to my scan shows');
  await p.click('#scanBack'); await wait(700); await settled();
  assert.equal((await scan()).active, true, 'back on the scan');
  // Hide and Show
  await p.click('#scanShow'); await wait(500);
  assert.equal((await scan()).active, false, 'hidden'); assert.equal(await p.$eval('#scanShow', (b) => b.textContent), 'Show my scan');
  await p.click('#scanShow'); await wait(500);
  assert.equal((await scan()).active, true, 'shown again');
  await p.click('#bodyPop [data-close]'); await wait(300);
  await p.screenshot({ path: 'shots/t138-back.png' });

  // Turn it round (right after bringing one in): fitted again with the scan turned, still one step
  await (await p.$('#scanFile')).uploadFile('shots/t138-me.glb');
  await p.waitForSelector('#scanBar:not([hidden])', { timeout: 240000 }); await wait(500);
  const before = await scan();
  await p.click('#scanTurn');
  await p.waitForSelector('#scanSheet:not([hidden])', { timeout: 10000 });
  await p.waitForSelector('#scanBar:not([hidden])', { timeout: 240000 }); await wait(500);
  const turned = await scan();
  // the rows for across and front to back flip, the one for up stays
  const dot = [0, 1, 2, 6, 7, 8].reduce((a, i) => a + before.align.R[i] * turned.align.R[i], 0), up = [3, 4, 5].reduce((a, i) => a + before.align.R[i] * turned.align.R[i], 0);
  assert.ok(up > 0.99, 'still standing up');
  assert.ok(dot < -1.5, 'turned half way round: ' + dot);
  assert.equal(turned.undoLen, before.undoLen, 'turning replaces the step, it does not add one');
  assert.match(await p.$eval('#scanText', (n) => n.textContent), /Turned round/);
  // Remove
  await p.click('#scanDone'); await wait(200);
  await p.click('#bodyBtn'); await p.waitForSelector('#bodyPop:not([hidden])'); await wait(200);
  await p.click('#scanRemove'); await wait(600);
  assert.equal((await scan()).saved, false, 'removed');
  await p.reload(); await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 60000 }); await wait(500);
  assert.equal((await scan()).saved, false, 'gone after a reload too');

  // not a scan: says so in plain words
  writeFileSync('shots/t138-notes.txt', 'hello');
  await p.evaluate(() => document.querySelector('#bodyBtn').click()); await wait(300);
  await (await p.$('#scanFile')).uploadFile('shots/t138-notes.txt');
  await p.waitForFunction(() => /not a 3D scan/.test(document.querySelector('#scanMsg').textContent), { timeout: 20000 });
  assert.equal(await p.$eval('#scanCancel', (b) => b.textContent), 'Close');
  await p.click('#scanCancel'); await wait(200);
  console.log(`t138 body scan ok: fitted in ${(ms / 1000).toFixed(1)} s, median ${(s1.quality.median * 1000).toFixed(1)} mm, chest ${chestReads} in, fit ${JSON.stringify(st1.fit)}`);
}
