// A band that goes right round a limb closes on itself: no holes across it, no torn edges and no
// piece dropped onto the heel or ankle bone (Jake, 2026-11-15, planning a wrap-around ankle piece:
// "it's fucking up"). Wide pieces on an arm or leg are laid out like a sleeve: distance along the
// limb and the way round it.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const res = await p.evaluate(async () => {
    const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({});
    const art = (() => { const c = document.createElement('canvas'); c.width = 800; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#111'; for (let y = 0; y < 200; y += 25) for (let x = (y / 25) % 2 * 25; x < 800; x += 50) g.fillRect(x, y, 25, 25); return c.toDataURL('image/png'); })();
    const spots = {
      'ankle band': [[0.193, 0.14, 2], [0, 0, -1], 0.2],
      'ankle band from the back': [[-0.193, 0.15, -2], [0, 0, 1], 0.21],
      'ankle three quarters': [[-0.193, 0.15, 2], [0, 0, -1], 0.16],
      'wrist band': [[2, 1.095, 0.175], [-1, 0, 0], 0.15],
      'upper arm band': [[0.27, 1.3, 2], [0, 0, -1], 0.25],
    };
    for (const [name, [o, d, w]] of Object.entries(spots)) { const h = I.surfaceAt(o, d); if (h) await I.addArt(art, name, { pos: h.pos, normal: h.normal, width: w }); }
    I.commitTest(); await new Promise((r) => setTimeout(r, 300));
    // on an arm the band is turned so its width runs round the arm: the turn with the least length along it
    const axis = (a, b) => { const p = I.restJoint(a), q = I.restJoint(b), d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], n = Math.hypot(...d); return d.map((x) => x / n); };
    for (const [name, ax] of [['wrist band', axis('lowerarm01.L', 'wrist.L')], ['upper arm band', axis('upperarm01.L', 'lowerarm01.L')]]) {
      const t = I.state().tattoos.find((q) => q.name === name); if (!t) continue;
      let best = null;
      for (let k = 0; k < 12; k++) { t.rot = k * Math.PI / 12; I.commitTest(); await new Promise((r) => setTimeout(r, 60)); const sp = I.decalSpan(ax).find((q) => q.name === name), len = sp.hi - sp.lo; if (!best || len < best[1]) best = [t.rot, len]; }
      t.rot = best[0]; I.commitTest(); await new Promise((r) => setTimeout(r, 100));
    }
    return { cover: I.decalCover(), span: I.decalSpan() };
  });
  const look = async (name, g) => { await p.evaluate((g) => { Object.assign(window.__ink.goal, g); Object.assign(window.__ink.cur, g, { r: g.r * 1.03 }); }, g); await wait(900); await p.screenshot({ path: `shots/t116-${name}.png` }); };
  await look('ankle-front', { theta: 0.3, phi: 1.45, r: 0.6, tx: 0.19, ty: 0.15, tz: 0 });
  await look('right-ankle-back', { theta: Math.PI, phi: 1.45, r: 0.6, tx: -0.19, ty: 0.15, tz: 0 });
  await look('ankle-back', { theta: Math.PI + 0.4, phi: 1.45, r: 0.6, tx: 0.19, ty: 0.15, tz: 0 });
  await look('upper-arm-back', { theta: Math.PI - 0.6, phi: 1.5, r: 0.7, tx: 0.27, ty: 1.3, tz: 0 });
  await look('upper-arm-under', { theta: 0.2, phi: 2.2, r: 0.6, tx: 0.27, ty: 1.28, tz: 0 });
  await look('wrist', { theta: 1.2, phi: 1.3, r: 0.6, tx: 0.47, ty: 1.09, tz: 0.17 });
  for (const c of res.cover) console.log(c.name, 'cover', c.cover.toFixed(3), 'stretch p90', c.stretch.toFixed(2), 'p10', (c.low || 0).toFixed(2));
  for (const c of res.span) console.log(c.name, 'y', c.y.toFixed(3), 'from', c.lo.toFixed(3), 'to', c.hi.toFixed(3), 'triangles', c.tris);
  assert.equal(res.cover.length, 5, 'all five placed');
  for (const c of res.cover) {
    assert.ok(c.cover > 0.97, `${c.name}: the whole band is on the skin, no holes (${(c.cover * 100).toFixed(1)}%)`);
    assert.ok(c.stretch < 1.9 && c.low > 0.45, `${c.name}: even scale round the limb (${c.low.toFixed(2)} to ${c.stretch.toFixed(2)})`);
  }
  for (const c of res.span.filter((c) => /ankle/.test(c.name))) {
    const h = c.name === 'ankle three quarters' ? 0.16 / 4 : 0.2 / 4;
    assert.ok(c.hi - c.lo < h + 0.04 && c.lo > c.y - h / 2 - 0.03, `${c.name}: stays a band, nothing dropped onto the heel (${c.lo.toFixed(3)} to ${c.hi.toFixed(3)})`);
  }
  console.log('PASS t116 a band round the ankle, wrist and upper arm closes on itself with no holes');
}
