// Visual check of the body model: anatomy detail, body types, extreme proportions, the Body panel.
// node tools/shot.mjs shots/t4.png tools/tests/t4.mjs  ->  shots/b_*.png
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const look = async (name, g, shape) => {
    if (shape) await p.evaluate((s) => window.__ink.setShape(s), shape);
    // cur starts a hair off goal so the render loop sees motion and redraws
    await p.evaluate((g) => { Object.assign(window.__ink.goal, g); Object.assign(window.__ink.cur, g, { r: g.r * 1.03 }); }, g);
    await wait(900); await p.screenshot({ path: `./shots/b_${name}.png` });
  };
  const full = { theta: 0, phi: 1.5, r: 5.0, tx: 0, ty: 0.86, tz: 0.02 };
  await p.evaluate(() => { const s = window.__ink.state(); s.tattoos = []; window.__ink.setShape({}); });
  await look('male_full', full, { figure: 'male', muscle: 0.6, weight: 0.5, fit: {}, genitals: true });
  await look('male_face', { theta: 0.25, phi: 1.5, r: 0.62, tx: 0, ty: 1.63, tz: 0.08 });
  await look('male_chest', { theta: 0.3, phi: 1.45, r: 1.15, tx: 0, ty: 1.22, tz: 0.05 });
  await look('male_pelvis', { theta: 0.45, phi: 1.5, r: 0.8, tx: 0, ty: 0.9, tz: 0.05 });
  await look('male_back', { theta: Math.PI, phi: 1.5, r: 2.2, tx: 0, ty: 1.15, tz: 0 });
  await look('male_muscle', { ...full, r: 3.2, ty: 1.1 }, { muscle: 1, weight: 0.35, fit: { abs: 0.8, back: 0.6, pecs: 0.5 } });
  await look('male_heavy', { ...full, r: 3.2, ty: 1.1 }, { muscle: 0.2, weight: 1, fit: { belly: 0.5 } });
  await look('long_limbs', full, { muscle: 0.5, weight: 0.5, fit: { thighLen: 1, shinLen: 1, upperArmLen: 1, foreArmLen: 1 } });
  await look('short_limbs', full, { fit: { thighLen: -1, shinLen: -1, upperArmLen: -1, foreArmLen: -1, shoulders: 1, neckLen: 1 } });
  await look('female_full', full, { figure: 'female', muscle: 0.5, weight: 0.5, fit: {} });
  await look('female_chest', { theta: 0.5, phi: 1.45, r: 1.15, tx: 0, ty: 1.22, tz: 0.05 });
  await look('female_cup', { theta: 0.5, phi: 1.45, r: 1.15, tx: 0, ty: 1.22, tz: 0.05 }, { fit: { cup: 1, firm: -0.5, hips: 0.6, butt: 0.6 } });
  await look('female_pelvis', { theta: 0.3, phi: 1.5, r: 0.8, tx: 0, ty: 0.9, tz: 0.05 }, { fit: {} });
  await look('neutral_full', full, { figure: 'neutral', fit: {} });
  // the panel itself
  await p.evaluate(() => window.__ink.setShape({ figure: 'male', muscle: 0.6, weight: 0.5, fit: { shoulders: 0.4 } }));
  await p.click('#bodyBtn'); await wait(300);
  await p.evaluate(() => { document.querySelectorAll('#fitGroups details')[0].open = true; });
  await look('panel', full);
  console.log('fit groups', await p.evaluate(() => [...document.querySelectorAll('#fitGroups details')].map((d) => d.querySelector('summary').textContent + (d.hidden ? ' (hidden)' : '')).join(' | ')));
}
