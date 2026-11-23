// t177 Copy to other side of a tattoo already on you. The twin kept the original's On my skin mark,
// so it came out locked in place with no handles, as ink you do not have, carrying who did the
// original, its approval and its Procreate layer mark (a changed layer brought back took the twin
// away with the original). Now the twin is a planned piece: movable, with its own approval and no
// layer mark, and the original is left as it was, all in one undo step.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => {
    const I = window.__ink, P = I.positions(), s = structuredClone(I.state()), base = s.tattoos[0];
    const st = []; for (let v = 0; v < 13380; v++) { const pl = I.pain().at(v).place; if (pl && /forearm/i.test(pl) && P[v * 3] < 0) st.push(v); }
    const v = st[Math.floor(st.length / 2)], t = structuredClone(base);
    t.id = 'idWave'; t.name = 'Wave'; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; t.normal = [-0.3 / Math.hypot(0.3, 0.95), 0, 0.95 / Math.hypot(0.3, 0.95)];
    t.status = 'existing'; t.locked = true; t.made = { artist: 'Sam', studio: 'Ink Co', when: '2024-05' };
    t.review = { verdict: 'approved', by: 'Liv', note: '' }; t.fromLayer = 'layer-1:abc';
    s.tattoos = [t]; I.loadState(s);
  });
  await wait(1000);
  await ink(() => window.__ink.select('idWave')); await wait(500);
  const before = await ink(() => JSON.stringify(window.__ink.state())), u0 = await ink(() => window.__ink.undoLen());
  await ink(() => { document.querySelector('#editorAdvanced').open = true; document.querySelector('#bOtherSide').click(); }); await wait(800);
  const S = await ink(() => window.__ink.state());
  assert.equal(S.tattoos.length, 2, 'a twin was made');
  const orig = S.tattoos.find((t) => t.id === 'idWave'), twin = S.tattoos.find((t) => t.id !== 'idWave');
  assert.ok(twin.pos[0] > 0, 'on the other side');
  assert.equal(twin.status, 'planned', 'the twin is a plan, not ink already on you');
  assert.equal(twin.locked, false, 'and not locked');
  assert.equal(twin.made, undefined, 'who did the original is not the twin\'s');
  assert.equal(twin.review, undefined, 'the twin needs its own approval');
  assert.equal(twin.fromLayer, undefined, 'and is its own layer for Procreate\'s bring back');
  assert.equal(twin.img, orig.img, 'it still shares the artwork');
  assert.equal(orig.status, 'existing'); assert.equal(orig.locked, true); assert.deepEqual(orig.made, { artist: 'Sam', studio: 'Ink Co', when: '2024-05' });
  assert.equal(orig.fromLayer, 'layer-1:abc'); assert.equal(orig.review.by, 'Liv', 'the original is left as it was');
  assert.equal(await ink(() => window.__ink.undoLen()), u0 + 1, 'one undo step');
  // the twin is selected, reads Planned, and has its handles to move and size it
  assert.equal(await ink(() => window.__ink.selected()), twin.id);
  assert.equal(await ink(() => document.querySelector('#bPlanned').getAttribute('aria-pressed')), 'true', 'the switch reads Planned');
  await p.waitForFunction(() => { const h = document.querySelector('#hSize'); return h && !h.hidden && h.getBoundingClientRect().width > 0 && getComputedStyle(document.querySelector('#handles')).display !== 'none' && !document.querySelector('#handles').hidden; }, { timeout: 5000 }).catch(() => {});
  assert.ok(await ink(() => { const h = document.querySelector('#hSize'), w = document.querySelector('#handles'); return !w.hidden && !h.hidden && h.getBoundingClientRect().width > 0; }), 'the size handle shows on the twin');
  // copying a planned tattoo still keeps it planned and drops its approval and layer mark
  await ink(() => document.getElementById('undo').click()); await wait(700);
  assert.equal(await ink(() => JSON.stringify(window.__ink.state())), before, 'undo puts it back exactly');
  await ink(() => { const I = window.__ink, s = structuredClone(I.state()); Object.assign(s.tattoos[0], { status: 'planned', locked: false }); delete s.tattoos[0].made; I.loadState(s); }); await wait(800);
  await ink(() => window.__ink.select('idWave')); await wait(400);
  await ink(() => { document.querySelector('#editorAdvanced').open = true; document.querySelector('#bOtherSide').click(); }); await wait(800);
  const S2 = await ink(() => window.__ink.state()), twin2 = S2.tattoos.find((t) => t.id !== 'idWave'), orig2 = S2.tattoos.find((t) => t.id === 'idWave');
  assert.equal(twin2.status, 'planned'); assert.equal(twin2.review, undefined); assert.equal(twin2.fromLayer, undefined);
  assert.equal(orig2.review.by, 'Liv'); assert.equal(orig2.fromLayer, 'layer-1:abc');
  assert.ok(JSON.parse(await ink(() => localStorage.getItem('ia-tried') || '[]')).includes('otherSidePlan'), 'ticked in New to try');
  console.log('t177 other side plan ok');
}
