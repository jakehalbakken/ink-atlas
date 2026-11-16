// Tattoos on the arms are laid on the skin like a stencil: a wide piece on the forearm or the
// side of the upper arm carries on round the limb instead of being cut off where the arm turns
// away (Jake, 2026-11-15: "The arms are having a weird thing where tattoos cutoff"), and the
// picture keeps an even scale over the skin instead of smearing near the edges.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const res = await p.evaluate(async () => {
    const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({});
    const art = (() => { const c = document.createElement('canvas'); c.width = 200; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#111'; for (let y = 0; y < 300; y += 20) for (let x = (y / 20) % 2 * 20; x < 200; x += 40) g.fillRect(x, y, 20, 20); return c.toDataURL('image/png'); })();
    const spots = {
      'arm front wide': [[0.46, 1.1, 2], [0, 0, -1], 0.08],
      'forearm side wide': [[2, 0.95, 0.03], [-1, 0, 0], 0.08],
      'upper arm side': [[2, 1.18, 0.02], [-1, 0, 0], 0.09],
      'calf wide': [[0.12, 0.35, -2], [0, 0, 1], 0.1],
      'chest': [[0.1, 1.3, 2], [0, 0, -1], 0.12],
    };
    for (const [name, [o, d, w]] of Object.entries(spots)) { const h = I.surfaceAt(o, d); if (h) await I.addArt(art, name, { pos: h.pos, normal: h.normal, width: w }); }
    I.commitTest(); await new Promise((r) => setTimeout(r, 300));
    return { cover: I.decalCover(), reach: I.decalReach() };
  });
  for (const c of res.cover) console.log(c.name, 'cover', c.cover.toFixed(3), 'stretch p90', c.stretch.toFixed(2), 'p10', (c.low || 0).toFixed(2));
  assert.equal(res.cover.length, 5, 'all five placed');
  for (const c of res.cover) {
    assert.ok(c.cover > 0.97, `${c.name}: the whole picture is on the skin (${(c.cover * 100).toFixed(1)}%)`);
    // the front piece goes right round the narrow forearm by the wrist, so it is laid out as a sleeve
    assert.ok(c.stretch < (c.name === 'arm front wide' ? 1.4 : 1.25) && c.low > 0.8, `${c.name}: even scale over the skin (${c.low.toFixed(2)} to ${c.stretch.toFixed(2)})`);
  }
  const look = async (name, g) => { await p.evaluate((g) => { Object.assign(window.__ink.goal, g); Object.assign(window.__ink.cur, g, { r: g.r * 1.03 }); }, g); await wait(900); await p.screenshot({ path: `shots/t115-${name}.png` }); };
  await look('forearm', { theta: 0.5, phi: 1.5, r: 0.7, tx: 0.55, ty: 0.95, tz: 0.02 });
  await look('arm-side', { theta: 1.4, phi: 1.5, r: 0.8, tx: 0.5, ty: 1.05, tz: 0 });
  await look('calf', { theta: Math.PI, phi: 1.5, r: 0.9, tx: 0.12, ty: 0.35, tz: 0 });
  for (const r of res.reach) { console.log(r.name, 'reach', r.max.toFixed(3), 'w', r.w, 'h', r.h.toFixed(3)); assert.ok(r.max <= Math.max(r.w, r.h) * 1.1 + 0.03, `${r.name}: stays on its own skin (${r.max.toFixed(3)})`); }
  console.log('PASS t115 arm ink wraps the limb, nothing cut off');
}
