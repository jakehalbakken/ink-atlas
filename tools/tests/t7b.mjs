// Visual: a wide band on the thigh with wrap, seen from the side, should curve around it.
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await p.evaluate(async () => {
    const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({ figure: 'male', muscle: 0.6, weight: 0.5, fit: {} });
    const art = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#111'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(24 + i * 42, 48, 16, 0, 7); g.fill(); } return c.toDataURL('image/png'); })();
    const h = I.surfaceAt([0.14, 0.62, 2], [0, 0, -1]); // front of the subject's right thigh
    await I.addArt(art, 'Thigh band flat', { pos: h.pos, normal: h.normal, width: 0.19 });
    const h2 = I.surfaceAt([-0.14, 0.62, 2], [0, 0, -1]);
    await I.addArt(art, 'Thigh band wrap', { pos: h2.pos, normal: h2.normal, width: 0.19, wrap: 1 });
    I.commitTest();
  });
  const view = async (name, g) => { await p.evaluate((g) => { Object.assign(window.__ink.goal, g); Object.assign(window.__ink.cur, g, { r: g.r * 1.04 }); }, g); await wait(900); await p.screenshot({ path: `./shots/${name}.png` }); };
  await view('t7b_front', { theta: 0, phi: 1.5, r: 1.6, tx: 0, ty: 0.62, tz: 0.1 });
  await view('t7b_rightside', { theta: -1.35, phi: 1.5, r: 1.0, tx: -0.14, ty: 0.62, tz: 0 });
  await view('t7b_leftside', { theta: 1.35, phi: 1.5, r: 1.0, tx: 0.14, ty: 0.62, tz: 0 });
  console.log('reach', JSON.stringify(await p.evaluate(() => window.__ink.decalReach())));
}
