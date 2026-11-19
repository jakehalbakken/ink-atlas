// Arms relaxed at sides (Preview > Pose > Straight arms) and the clearer elbow. The pose sits in the
// Straight arms group, is 44 pt, carries forearm and elbow ink with the skin (each still picked
// under the finger), keeps an elbow tattoo whole and at its real size, saves nothing, ticks itself
// in New to try, and Standing puts the ink back exactly. Both New to try rows open Pose and ring
// the control. The angles, the gap to the thigh and the typed measurements in this pose are checked
// on the skeleton in relaxed-arms-unit.mjs; the elbow's painted detail in definition-unit.mjs.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const settled = () => p.waitForFunction(() => window.__ink.settled() && window.__ink.pose().settled, { timeout: 20000 });
  await settled(); await wait(600);
  // the sunburst on the left forearm, and a small piece on the point of the left elbow
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(300);
  const fid = await p.evaluate(() => window.__ink.selected());
  await p.evaluate(() => { document.querySelector('#editorAdvanced').open = true; });
  await p.$eval('#bSpots', (e) => e.click()); await wait(300);
  await p.$eval('#spotSide [data-side="L"]', (e) => e.click());
  await p.$eval('#spotChoices [data-spot="forearm-front"]', (e) => e.click()); await wait(200);
  await p.$eval('#spotPop [data-close=spotPop]', (e) => e.click());
  const eid = await p.evaluate(async () => {
    const I = window.__ink, e = I.restJoint('lowerarm01.L'), c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#111'; g.lineWidth = 14;
    g.beginPath(); g.arc(128, 128, 90, 0, 7); g.stroke(); g.beginPath(); g.moveTo(40, 128); g.lineTo(216, 128); g.stroke();
    const hit = I.surfaceAt([e[0], e[1], e[2] - 0.5], [0, 0, 1]);
    const t = await I.addArt(c.toDataURL('image/png'), 'Elbow ring', { ...hit, width: 0.05 }); I.commitTest(); I.select(null); return t.id;
  });
  await wait(400); await settled();
  const cover = async () => Object.fromEntries((await p.evaluate(() => window.__ink.decalCover())).map((c) => [c.name, c]));
  const restCover = (await cover())['Elbow ring'];
  assert.ok(restCover.cover > 0.97, 'the elbow ring is whole on the standing arm: ' + JSON.stringify(restCover));
  const spots = async () => ({ f: await p.evaluate((id) => window.__ink.viewSpot(id), fid), e: await p.evaluate((id) => window.__ink.viewSpot(id), eid) });
  const rest = await spots();
  assert.ok(rest.e.pos[2] < rest.f.pos[2] - 0.03 && rest.e.pos[0] > 0.12, 'the ring sits on the back of the left elbow: ' + rest.e.pos);
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state()));

  await p.click('#lookBtn'); await p.click('#poseBtn'); await p.waitForSelector('#posePop:not([hidden])');
  const group = await p.$$eval('#poseList [data-pose]', (b) => b.slice(0, 5).map((x) => x.dataset.pose));
  assert.deepEqual(group, ['neutral', 'straightDown', 'straightOut', 'straightPalms', 'relaxedSides'], 'relaxed sits with the straight arms');
  const btn = await p.$('#poseList [data-pose=relaxedSides]');
  assert.equal(await btn.evaluate((b) => b.textContent.trim()), 'Arms relaxed at sides');
  const r = await btn.boundingBox(); assert.ok(Math.min(r.width, r.height) >= 44 - 0.01, '44pt: ' + JSON.stringify(r));
  await btn.click(); await wait(600); await settled();
  const s = await p.evaluate(() => window.__ink.pose()); assert.equal(s.active, true); assert.equal(s.key, 'relaxedSides');
  assert.equal(await btn.evaluate((b) => b.getAttribute('aria-pressed')), 'true');
  assert.ok((await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'))).includes('relaxedArms'), 'ticks itself in New to try');
  await p.screenshot({ path: 'shots/t136-relaxed.png' });
  const posed = await spots();
  // the standing body holds the forearm well in front; relaxed brings it back towards the arm's line, still a little forward, and down
  assert.ok(rest.f.pos[2] - posed.f.pos[2] > 0.02, 'forearm ink comes back with the hanging arm: ' + (rest.f.pos[2] - posed.f.pos[2]).toFixed(3));
  assert.ok(posed.f.pos[1] < rest.f.pos[1] - 0.01, 'and lower, as the arm comes down');
  assert.ok(posed.f.pos[2] > posed.e.pos[2] + 0.03, 'the forearm still angles forward of the elbow');
  const posedCover = (await cover())['Elbow ring'];
  assert.ok(Math.abs(posedCover.cover - restCover.cover) < 0.01, `the elbow ring stays whole: ${restCover.cover} -> ${posedCover.cover}`);
  const real = await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, eid);
  assert.ok(Math.abs(real - 0.05) < 1e-9, 'its real size is unchanged');
  // a finger on each posed piece lands on its own skin
  await p.click('#posePop [data-close=posePop]'); await wait(300);
  for (const [id, sp] of [[fid, posed.f], [eid, posed.e]]) {
    const t = await p.evaluate((id) => window.__ink.state().tattoos.find((x) => x.id === id), id);
    if (id === eid) await p.evaluate((pos) => window.__ink.aim(pos, 0.45, Math.PI * 0.85, Math.PI / 2), sp.pos);
    await wait(500); await settled();
    const a = await p.evaluate((pos) => window.__ink.projectPoint(pos), sp.pos);
    const under = await p.evaluate((x, y) => window.__ink.hitBody(x, y), a.x, a.y);
    assert.ok(under && Math.hypot(...under.point.map((v, i) => v - t.pos[i])) < 0.02, `a finger on the posed ${t.name} is on its own skin`);
  }
  await p.screenshot({ path: 'shots/t136-elbow.png' });
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())), before, 'the pose changes nothing saved');
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(500); await settled();
  const back = await spots();
  for (const k of ['f', 'e']) assert.ok(Math.hypot(...back[k].pos.map((v, i) => v - rest[k].pos[i])) < 1e-6, 'Standing puts the ink back exactly');
  // both New to try rows work
  for (const f of ['relaxedArms', 'elbowDetail']) {
    await p.evaluate(() => { document.querySelectorAll('[data-close]').forEach((b) => { if (b.offsetParent) b.click(); }); }); await wait(300);
    await p.evaluate(() => { document.querySelector('#newBtn').click(); }); await wait(300);
    const row = await p.$(`#newList [data-feature=${f}] .btn`); assert.ok(row, f + ' listed in New to try');
    await row.click(); await wait(600);
    assert.equal(await p.$eval('#posePop', (n) => n.hidden), false, f + ': Show me opens Pose');
    assert.equal(await p.$eval('#pointRing', (n) => n.hidden), false, f + ': and rings the control');
  }
  console.log(`t136 relaxed arms ok: elbow ring cover ${restCover.cover.toFixed(3)} standing, ${posedCover.cover.toFixed(3)} relaxed`);
}
