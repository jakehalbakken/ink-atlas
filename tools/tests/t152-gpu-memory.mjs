// Graphics memory stays flat (2026-11-20 QA, a regression check, nothing was leaking): bringing in six
// pictures and undoing them, three times over, puts the textures and shapes back to where they started;
// five body shape changes add nothing; opening and closing Tape measure, Pain map and Open skin three
// times each keeps at most one shape each (their overlays are kept for next time), never one per open.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1500);
  const m = async () => { await p.evaluate(() => window.__ink.aim([0, 1, 0], 3.2)); await wait(700); return p.evaluate(() => window.__ink.gpu()); };
  const art = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(100, 100, 200, 200); return c.toDataURL(); });
  const start = await m(); const n0 = await p.evaluate(() => window.__ink.state().tattoos.length);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 6; i++) {
      await p.evaluate(async (a) => { const b = await (await fetch(a)).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'square.png', { type: 'image/png' })); const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change')); }, art);
      await wait(700);
    }
    const added = await m();
    assert.equal(await p.evaluate(() => window.__ink.state().tattoos.length), n0 + 6, 'six in');
    assert.ok(added.textures > start.textures, 'their textures are counted: ' + JSON.stringify(added));
    for (let i = 0; i < 6; i++) { await p.evaluate(() => document.querySelector('#undo').click()); await wait(300); }
    const back = await m();
    assert.equal(await p.evaluate(() => window.__ink.state().tattoos.length), n0, 'six out');
    assert.equal(back.textures, start.textures, `round ${r + 1}: textures back to the start`); assert.equal(back.geometries, start.geometries, `round ${r + 1}: shapes back to the start`);
  }
  for (let i = 0; i < 5; i++) { await p.evaluate((i) => window.__ink.setShape({ weight: 0.3 + i * 0.1 }), i); await wait(400); }
  const shaped = await m();
  assert.equal(shaped.textures, start.textures, 'shape changes add no textures'); assert.equal(shaped.geometries, start.geometries, 'shape changes add no shapes');
  let last = shaped;
  for (const [btn, done] of [['#tapeBtn', '#tapeDone'], ['#painBtn', '#painDone'], ['#roomBtn', '#roomDone']]) {
    const seen = [];
    for (let k = 0; k < 3; k++) {
      await p.click('#lookBtn'); await wait(300);
      await p.evaluate((b) => { const e = document.querySelector(b); const d = e.closest('details'); if (d) d.open = true; e.click(); }, btn); await wait(900);
      await p.evaluate((d) => { const e = document.querySelector(d); if (e && e.checkVisibility()) e.click(); }, done); await wait(500);
      seen.push((await m()).geometries);
    }
    assert.ok(seen[2] === seen[0] && seen[0] - last.geometries <= 1, `${btn}: ${last.geometries} then ${seen.join(', ')} shapes`);
    last = await m();
  }
  console.log(`PASS t152 gpu memory: ${start.textures} textures and ${start.geometries} shapes after three rounds of six pictures in and out, five shape changes, and nine tool opens (${last.geometries} with the tools' kept overlays)`);
}
