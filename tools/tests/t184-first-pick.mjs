// t184 the first pick in a big project worked out every tattoo's ink points at once, for the gap to
// the nearest tattoo under its size: about a third of a second with 60 tattoos (2026-11-24). Now they
// are worked out a few at a time once the ink has settled. This checks that they all get worked out
// on their own, that none is worked out while a body slider is moving, that the first pick then works
// out no ink points and still shows the gap line, and that New to try ticks.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => { const I = window.__ink, s = structuredClone(I.state()), b = s.tattoos[0], P = I.positions();
    const X = I.bodyIndex(); s.tattoos = []; for (let k = 0; k < 60; k++) { const t = structuredClone(b), f = 40 + k * 433, a = X[f * 3] * 3, c = X[f * 3 + 1] * 3, d = X[f * 3 + 2] * 3, e1 = [0, 1, 2].map((j) => P[c + j] - P[a + j]), e2 = [0, 1, 2].map((j) => P[d + j] - P[a + j]), n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(...n); t.id = 'id' + k; t.name = 'T' + k; t.pos = [0, 1, 2].map((j) => (P[a + j] + P[c + j] + P[d + j]) / 3); t.normal = n.map((x) => x / nl); t.status = k % 3 ? 'planned' : 'existing'; t.locked = false; delete t.group; s.tattoos.push(t); }
    s.groups = []; I.loadState(s); });
  const reads = () => ink(() => window.__ink.inkReads());
  const still = async () => { let last = -1; for (let k = 0; k < 40; k++) { const r = await reads(); if (r.warmed === last && r.pts === last2) return; last = r.warmed; last2 = r.pts; await wait(700); } }; let last2 = -1;
  // all 60 get worked out on their own, in slices
  await p.waitForFunction(() => window.__ink.inkReads().warmed >= 60, { timeout: 60000 }); await still();
  const r0 = await reads();
  // the first pick then reads no artwork and does no new point work
  const lines = await p.$$('#ldList .ld-tat');
  await lines[20].tap(); await wait(900);
  const r1 = await reads();
  assert.equal(r1.pts, r0.pts, 'the first pick works out no ink points');
  const gap = await ink(() => document.querySelector('#gap').textContent);
  assert.match(gap, /from T\d+/, `the gap line shows (${gap})`);
  // while a body slider moves, nothing is worked out; once it stops, it all is again
  await ink(() => document.querySelector('#bDone').click()); await wait(300);
  await ink(() => document.querySelector('#bodyBtn').click()); await wait(800);
  const w0 = (await reads()).warmed;
  for (let v = 55; v <= 75; v += 2) { await ink((v) => { const r = document.querySelector('#rWeight'); r.value = v; r.dispatchEvent(new Event('input')); }, v); await wait(120); }
  assert.equal((await reads()).warmed, w0, 'nothing worked out while the slider moves');
  await ink(() => document.querySelector('#rWeight').dispatchEvent(new Event('change')));
  await p.waitForFunction((w) => window.__ink.inkReads().warmed >= w + 60, { timeout: 60000 }, w0);
  await ink(() => document.querySelector('#undo').click()); await wait(300);
  await p.keyboard.press('Escape'); await wait(300);
  await p.waitForFunction((w) => window.__ink.inkReads().warmed >= w + 120, { timeout: 60000 }, w0); await still();
  const a0 = (await reads()).pts;
  await (await p.$$('#ldList .ld-tat'))[33].tap(); await wait(900);
  assert.equal((await reads()).pts, a0, 'after the slider and its undo the first pick still works out no ink points');
  assert.ok((await ink(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'))).includes('pickQuick'), 'New to try ticks');
  console.log('t184 ok');
}
