// 1. An old (v1) save opens with its ink still pinned to the same spot on the body.
// 2. Dragging a slider by touch changes the value and never moves the page.
// 3. A vertical touch drag that starts on a slider scrolls the panel and leaves the value alone.
// node tools/shot.mjs shots/t5.png tools/tests/t5.mjs
export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mig = await p.evaluate(() => {
    const K = 8459, I = window.__ink; // left nipple vertex: an easy, front-facing landmark
    const old = I.v1Positions('male', 0.8, 0.6), at = (P) => [P[K * 3], P[K * 3 + 1], P[K * 3 + 2]];
    I.loadState({ app: 'ink-atlas-proto', v: 1, skin: 1, heightCm: 175, figure: 'male', muscle: 0.8, weight: 0.6,
      tattoos: [{ id: 'x', name: 'Old ink', img: 'none', aspect: 1, pos: at(old), normal: [0, 0, 1], width: 0.1, rot: 0, opacity: 0.9 }] });
    const s = I.state(), now = at(I.positions()), t = s.tattoos[0];
    return { v: s.v, muscle: s.muscle, weight: s.weight, fit: JSON.stringify(s.fit), movedWithBodyMm: +(Math.hypot(t.pos[0] - now[0], t.pos[1] - now[1], t.pos[2] - now[2]) * 1000).toFixed(2), shapeChangedMm: +(Math.hypot(old[K * 3] - now[0], old[K * 3 + 1] - now[1], old[K * 3 + 2] - now[2]) * 1000).toFixed(2) };
  });
  console.log('MIGRATION', JSON.stringify(mig), mig.v === 2 && mig.muscle === 0.9 && mig.weight === 0.8 && mig.shapeChangedMm > 0.5 && mig.movedWithBodyMm < 1 ? 'PASS' : 'FAIL');

  await p.click('#bodyBtn'); await wait(400);
  const page = () => p.evaluate(() => JSON.stringify({ sx: window.scrollX, sy: window.scrollY, dl: document.documentElement.scrollLeft, dt: document.documentElement.scrollTop, bl: document.body.scrollLeft, bt: document.body.scrollTop, vv: [window.visualViewport.pageLeft, window.visualViewport.pageTop, window.visualViewport.scale] }));
  const box = async (sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  const before = await page(); const m0 = await p.evaluate(() => window.__ink.state().muscle);
  let b = await box('#rMuscle'); const y = b.y + b.h / 2, x0 = b.x + b.w * 0.6;
  await p.touchscreen.touchStart(x0, y);
  for (let i = 1; i <= 10; i++) { await p.touchscreen.touchMove(x0 + i * 8, y + (i % 2 ? 3 : -3)); await wait(16); }
  await p.touchscreen.touchEnd(); await wait(300);
  const m1 = await p.evaluate(() => window.__ink.state().muscle);
  const after = await page();
  console.log('SLIDER DRAG muscle', m0, '->', m1, '| page before', before, 'after', after, m1 > m0 && before === after ? 'PASS' : 'FAIL');

  await p.evaluate(() => { document.querySelectorAll('#fitGroups details').forEach((d) => { d.open = true; }); });
  await wait(200);
  b = await box('#rWeight'); const w0 = await p.evaluate(() => window.__ink.state().weight);
  const st0 = await p.evaluate(() => document.querySelector('#bodyPop').scrollTop);
  await p.touchscreen.touchStart(b.x + b.w / 2 + 40, b.y + b.h / 2);
  for (let i = 1; i <= 12; i++) { await p.touchscreen.touchMove(b.x + b.w / 2 + 40, b.y + b.h / 2 - i * 12); await wait(16); }
  await p.touchscreen.touchEnd(); await wait(400);
  const st1 = await p.evaluate(() => document.querySelector('#bodyPop').scrollTop); const w1 = await p.evaluate(() => window.__ink.state().weight);
  console.log('PANEL SCROLL from a slider: scrollTop', st0, '->', st1, '| weight', w0, '->', w1, st1 > st0 && w1 === w0 ? 'PASS' : 'CHECK');
  await p.screenshot({ path: './shots/b_panel_scrolled.png' });
}
