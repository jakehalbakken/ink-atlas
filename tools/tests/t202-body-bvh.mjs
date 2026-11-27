// Faster picks: the body is searched through a bounding volume tree (three-mesh-bvh). Every ray
// must land on exactly the same triangle at the same distance as the plain search, on the
// standing body, after the shape changes, with the genital geometry shown, and in a pose; and a
// body slider step in a big project must get quicker.
import assert from 'node:assert/strict';
import big from '../big-project.mjs';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 60000 }); await wait(800);
  const rays = [];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 400; i++) { const a = rnd() * Math.PI * 2, y = 0.05 + rnd() * 1.7, o = [Math.cos(a) * 2, y, Math.sin(a) * 2], t = [(rnd() - 0.5) * 0.5, y + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3]; rays.push([o, [t[0] - o[0], t[1] - o[1], t[2] - o[2]]]); }
  const same = async (what) => {
    const r = await p.evaluate((rays) => { const I = window.__ink; I.bvh(false); const plain = rays.map(([o, d]) => I.rayBody(o, d)); I.bvh(true); const fast = rays.map(([o, d]) => I.rayBody(o, d)); return { plain, fast }; }, rays);
    let hits = 0; for (let i = 0; i < rays.length; i++) { assert.deepEqual(r.fast[i], r.plain[i], `${what}: ray ${i} lands the same`); if (r.plain[i].length) hits++; }
    assert.ok(hits > 150, `${what}: enough rays hit the body (${hits})`);
  };
  await same('standing');
  await p.evaluate(() => window.__ink.setShape({ weight: 0.85, muscle: 0.2 })); await wait(300);
  await same('heavier');
  await p.evaluate(() => window.__ink.setShape({ figure: 'male', genitals: true })); await wait(300);
  await same('male with genitals');
  // screen picks in a pose go through the posed copy of the body
  await p.evaluate(() => window.__ink.setPose('twist')); await wait(1500);
  const picks = await p.evaluate(() => { const I = window.__ink, out = []; for (let x = 200; x < innerWidth - 200; x += 37) for (let y = 120; y < innerHeight - 80; y += 41) out.push([x, y]); const run = () => out.map(([x, y]) => { const h = I.hitBody(x, y); return h ? [h.faceIndex, h.point.map((v) => +v.toFixed(5))] : null; }); I.bvh(false); const a = run(); I.bvh(true); const b = run(); return { a, b, posed: I.pose().active }; });
  assert.deepEqual(picks.b, picks.a, 'screen picks in a pose land the same');
  assert.ok(picks.a.filter(Boolean).length > 20, 'some picks hit the posed body');
  await p.evaluate(() => window.__ink.setPose('neutral')); await wait(500);
  // a body slider dragged in a big project: the ink rides on the skin while the finger moves
  // and is laid out afresh when it lifts
  await big(p); await wait(800);
  await p.evaluate(() => document.querySelector('#bodyBtn').click()); await wait(800);
  const drag = async (fast) => p.evaluate(async (fast) => {
    const I = window.__ink; I.bvh(fast); I.follow(fast);
    const r = document.querySelector('#rWeight'), ts = [];
    for (const v of [52, 55, 58, 61, 64, 67]) { const t = performance.now(); r.value = v; r.dispatchEvent(new Event('input')); ts.push(performance.now() - t); await new Promise((q) => setTimeout(q, 30)); }
    r.dispatchEvent(new Event('change')); await new Promise((q) => setTimeout(q, 200));
    const after = JSON.stringify(I.decalCover());
    r.value = 50; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); await new Promise((q) => setTimeout(q, 200));
    I.bvh(true); I.follow(true); return { ts, after };
  }, fast);
  const slow = await drag(false), fast = await drag(true);
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  console.log('slider step ms, before', slow.ts.map(Math.round), 'now', fast.ts.map(Math.round));
  assert.deepEqual(fast.after, slow.after, 'once the finger lifts the ink is laid out exactly as before');
  assert.ok(med(fast.ts) < med(slow.ts) * 0.5, `a slider step is at least twice as quick (${Math.round(med(fast.ts))} vs ${Math.round(med(slow.ts))} ms)`);
  console.log('t202 ok');
}
