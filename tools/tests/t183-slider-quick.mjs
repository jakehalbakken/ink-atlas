// t183 a body slider rebuilt every tattoo's ink on each step, and each rebuild searched the whole
// body for the tattoo's spot and measured its whole arm or leg again. With 60 tattoos a step of
// Weight took over half a second (2026-11-24). Now each tattoo remembers its triangle while its point
// stays on it, and a limb is measured once per shape. This checks the ink after a slide is exactly
// what a fresh rebuild with nothing remembered gives, that steps after the first send no rays, that a
// limb is measured once per step however many pieces sit on it, and that New to try ticks.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => { const I = window.__ink, s = structuredClone(I.state()), b = s.tattoos[0], P = I.positions();
    const X = I.bodyIndex(); s.tattoos = []; for (let k = 0; k < 60; k++) { const t = structuredClone(b), f = 40 + k * 433, a = X[f * 3] * 3, c = X[f * 3 + 1] * 3, d = X[f * 3 + 2] * 3, e1 = [0, 1, 2].map((j) => P[c + j] - P[a + j]), e2 = [0, 1, 2].map((j) => P[d + j] - P[a + j]), n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(...n); t.id = 'id' + k; t.name = 'T' + k; t.pos = [0, 1, 2].map((j) => (P[a + j] + P[c + j] + P[d + j]) / 3); t.normal = n.map((x) => x / nl); t.status = k % 3 ? 'planned' : 'existing'; t.locked = false; delete t.group; s.tattoos.push(t); }
    // a few wide pieces round the forearm and calf, laid as sleeves, so the limb path runs too
    for (const [k, w] of [[3, 0.2], [17, 0.22], [41, 0.25]]) s.tattoos[k].width = w;
    s.groups = []; I.loadState(s); });
  await wait(2500);
  await ink(() => document.querySelector('#bodyBtn').click()); await wait(800);
  const reads = () => ink(() => window.__ink.inkReads());
  const step = (v) => ink((v) => { const r = document.querySelector('#rWeight'); r.value = v; r.dispatchEvent(new Event('input')); }, v);
  await step(60); await wait(200);
  const r1 = await reads();
  let r = r1;
  for (const v of [65, 70, 75, 80]) { await step(v); await wait(150); const n = await reads();
    assert.equal(n.rays, r.rays, `step to ${v} sends no ray through the body (${n.rays - r.rays})`);
    assert.equal(n.geo - r.geo, 0, 'while the finger is down the ink rides the skin, nothing is laid again (2026-11-27)');
    assert.ok(n.limbs - r.limbs <= 4, `each limb is measured at most once a step (${n.limbs - r.limbs})`);
    r = n; }
  const g0 = (await reads()).geo;
  await ink(() => document.querySelector('#rWeight').dispatchEvent(new Event('change'))); await wait(1200);
  assert.equal((await reads()).geo - g0, 60, 'every tattoo is laid afresh once the finger lifts');
  // the ink is exactly what a fresh rebuild gives with nothing remembered
  const ids = await ink(() => window.__ink.state().tattoos.map((t) => t.id));
  const before = await ink((ids) => ids.map((id) => window.__ink.decalGeo(id)), ids);
  await ink(() => window.__ink.rebuildFresh()); await wait(400);
  const after = await ink((ids) => ids.map((id) => window.__ink.decalGeo(id)), ids);
  for (let i = 0; i < ids.length; i++) {
    const a = before[i], b = after[i];
    assert.equal(!!a, !!b, `${ids[i]} has ink both ways`); if (!a) continue;
    assert.equal(a.p.length, b.p.length, `${ids[i]} has the same triangles`);
    let d = 0; for (let k = 0; k < a.p.length; k++) d = Math.max(d, Math.abs(a.p[k] - b.p[k])); for (let k = 0; k < a.uv.length; k++) d = Math.max(d, Math.abs(a.uv[k] - b.uv[k]));
    assert.ok(d < 1e-6, `${ids[i]} ink matches a fresh rebuild (${d})`);
  }
  const limbBuilds = (await reads()).limbs;
  assert.ok(limbBuilds > 0, 'some pieces sit on a limb, so the limb path was checked');
  // undo of the slide puts the body and ink back, and is the same as a fresh rebuild there too
  await ink(() => document.querySelector('#undo').click()); await wait(1200);
  const u1 = await ink((ids) => ids.map((id) => window.__ink.decalGeo(id)), ids);
  await ink(() => window.__ink.rebuildFresh()); await wait(400);
  const u2 = await ink((ids) => ids.map((id) => window.__ink.decalGeo(id)), ids);
  for (let i = 0; i < ids.length; i++) { const a = u1[i], b = u2[i]; if (!a) continue; assert.equal(a.p.length, b.p.length); let d = 0; for (let k = 0; k < a.p.length; k++) d = Math.max(d, Math.abs(a.p[k] - b.p[k])); assert.ok(d < 1e-6, `${ids[i]} after undo matches a fresh rebuild (${d})`); }
  assert.ok((await ink(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'))).includes('sliderQuick'), 'New to try ticks itself in a big project');
  console.log('t183 ok', limbBuilds);
}
