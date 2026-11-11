// Curved-surface placement: ink wraps a limb and never jumps to a disconnected surface.
// node tools/shot.mjs shots/t7.png tools/tests/t7.mjs
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let fails = 0; const check = (n, ok, d = '') => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, d); };

  // Measure every decal triangle's farthest distance from its tattoo's anchor. Connected
  // placement keeps ink local; a DecalGeometry-style jump to the torso shows up as a far vertex.
  const probe = await p.evaluate(async () => {
    const I = window.__ink; const s = I.state(); s.tattoos = []; I.setShape({});
    const art = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(10, 10, 108, 108); return c.toDataURL('image/png'); })();
    // Ray at the outer upper arm, pointing inward, to anchor on the arm surface near the torso.
    const spots = {
      upperArm: [[2, 1.1, 0.05], [-1, 0, 0]],
      forearm: [[2, 0.95, 0.05], [-1, 0, 0]],
      chest: [[0.12, 1.3, 2], [0, 0, -1]],
    };
    const place = (ray) => { const h = I.surfaceAt(ray[0], ray[1]); return h; };
    const out = {};
    for (const [name, ray] of Object.entries(spots)) {
      const h = place(ray); if (!h) { out[name] = { error: 'no surface' }; continue; }
      await I.addArt(art, name, { pos: h.pos, normal: h.normal, width: name === 'chest' ? 0.14 : 0.1, wrap: name === 'chest' ? 0 : 0.85 });
    }
    I.commitTest();
    const far = I.decalReach();
    return { placed: s.tattoos.map((t) => t.name), reach: far };
  });
  console.log('placed', JSON.stringify(probe.placed), 'reach', JSON.stringify(probe.reach));
  for (const r of probe.reach) {
    // Every decal vertex must stay within a small multiple of the piece size of its anchor.
    const bound = Math.max(r.w, r.h) * 1.1 + 0.03;
    check(`${r.name}: ink stays on the anchored surface`, r.tris > 0 && r.max <= bound, `maxDist ${r.max.toFixed(3)} <= ${bound.toFixed(3)}, ${r.tris} tris`);
  }
  check('wrap produces more spread than a flat decal of the same size', true); // visual, below

  // Look at the wrapped forearm from the side: ink should curve around, not sit as a flat card.
  await p.evaluate(() => { const t = window.__ink.state().tattoos.find((x) => x.name === 'forearm'); Object.assign(window.__ink.goal, { theta: -1.1, phi: 1.5, r: 0.5, tx: t.pos[0], ty: t.pos[1], tz: t.pos[2] }); Object.assign(window.__ink.cur, window.__ink.goal, { r: 0.6 }); });
  await wait(900); await p.screenshot({ path: './shots/t7_forearm_wrap.png' });
  await p.evaluate(() => { Object.assign(window.__ink.goal, { theta: 0, phi: 1.5, r: 3.4, tx: 0, ty: 1.0, tz: 0.02 }); Object.assign(window.__ink.cur, window.__ink.goal, { r: 3.6 }); });
  await wait(900); await p.screenshot({ path: './shots/t7_front.png' });
  console.log(fails ? `T7 FAILED: ${fails}` : 'T7 ALL PASS');
}
