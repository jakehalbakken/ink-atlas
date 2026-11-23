// t178 Duplicate in the edit sheet (and Cmd+D). The copy beside the original carried the original's
// approval and Procreate layer mark (a changed layer brought back took the copy away with the
// original), and a copy of ink already on you came out marked On my skin but unlocked. Now the copy
// is its own piece: no approval, no layer mark, a plan when the original is on your skin, with its
// own handles, and the original is left exactly as it was, all in one undo step. On an arm or leg
// the copy also landed exactly on top of the original (the ray past the side missed the limb); it
// now sits beside it on the same skin.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  const setup = (status) => ink((status) => {
    const I = window.__ink, P = I.positions(), s = structuredClone(I.state()), base = s.tattoos[0];
    const st = []; for (let v = 0; v < 13380; v++) { const pl = I.pain().at(v).place; if (pl && /forearm/i.test(pl) && P[v * 3] < 0) st.push(v); }
    const v = st[Math.floor(st.length / 2)], t = structuredClone(base);
    t.id = 'idWave'; t.name = 'Wave'; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; t.normal = [-0.3 / Math.hypot(0.3, 0.95), 0, 0.95 / Math.hypot(0.3, 0.95)];
    t.status = status; t.locked = status === 'existing'; if (status === 'existing') t.made = { artist: 'Sam', studio: 'Ink Co', when: '2024-05' }; else delete t.made;
    t.review = { verdict: 'approved', by: 'Liv', note: '' }; t.fromLayer = 'layer-1:abc'; t.note = 'Fine lines';
    s.tattoos = [t]; I.loadState(s);
  }, status);
  await setup('existing'); await wait(1000);
  await ink(() => window.__ink.select('idWave')); await wait(500);
  const before = await ink(() => JSON.stringify(window.__ink.state())), u0 = await ink(() => window.__ink.undoLen());
  await ink(() => { document.querySelector('#editorAdvanced').open = true; document.querySelector('#bDup').click(); }); await wait(800);
  const S = await ink(() => window.__ink.state());
  assert.equal(S.tattoos.length, 2, 'a copy was made');
  const orig = S.tattoos.find((t) => t.id === 'idWave'), dup = S.tattoos.find((t) => t.id !== 'idWave');
  assert.equal(dup.name, 'Wave copy');
  assert.equal(dup.status, 'planned', 'a copy of ink you have is a plan');
  assert.equal(dup.locked, false);
  assert.equal(dup.made, undefined, 'who did the original is not the copy\'s');
  assert.equal(dup.review, undefined, 'the copy needs its own approval');
  assert.equal(dup.fromLayer, undefined, 'and is its own layer for Procreate\'s bring back');
  assert.equal(dup.note, 'Fine lines', 'the note for the artist comes along');
  assert.equal(dup.img, orig.img, 'it shares the artwork');
  assert.ok(Math.hypot(...dup.pos.map((x, i) => x - orig.pos[i])) > orig.width * 0.2, 'beside the original on the forearm, not on top of it');
  assert.ok(dup.pos[0] < 0 && dup.normal.reduce((a, x, i) => a + x * orig.normal[i], 0) > 0.5, 'and on the same skin, facing the same way');
  assert.equal(orig.status, 'existing'); assert.equal(orig.locked, true); assert.equal(orig.made.artist, 'Sam');
  assert.equal(orig.review.by, 'Liv'); assert.equal(orig.fromLayer, 'layer-1:abc', 'the original is left as it was');
  assert.equal(await ink(() => window.__ink.undoLen()), u0 + 1, 'one undo step');
  assert.equal(await ink(() => window.__ink.selected()), dup.id);
  assert.equal(await ink(() => document.querySelector('#bPlanned').getAttribute('aria-pressed')), 'true', 'the switch reads Planned');
  await ink(() => document.getElementById('undo').click()); await wait(700);
  assert.equal(await ink(() => JSON.stringify(window.__ink.state())), before, 'undo puts it back exactly');
  // a planned original: the copy stays planned and drops the approval and layer mark; Cmd+D does the same
  await setup('planned'); await wait(800);
  await ink(() => window.__ink.select('idWave')); await wait(400);
  await ink(() => document.querySelector('#view, canvas')?.focus?.());
  await p.keyboard.down('Meta'); await p.keyboard.press('d'); await p.keyboard.up('Meta'); await wait(800);
  const S2 = await ink(() => window.__ink.state());
  assert.equal(S2.tattoos.length, 2, 'Cmd+D made a copy');
  const dup2 = S2.tattoos.find((t) => t.id !== 'idWave'), orig2 = S2.tattoos.find((t) => t.id === 'idWave');
  assert.equal(dup2.status, 'planned'); assert.equal(dup2.review, undefined); assert.equal(dup2.fromLayer, undefined);
  assert.equal(orig2.review.by, 'Liv'); assert.equal(orig2.fromLayer, 'layer-1:abc');
  // a second copy is named Wave copy 2, not Wave copy copy
  await ink(() => window.__ink.select('idWave')); await wait(300);
  await ink(() => document.querySelector('#bDup').click()); await wait(600);
  const names = (await ink(() => window.__ink.state())).tattoos.map((t) => t.name).sort();
  assert.deepEqual(names, ['Wave', 'Wave copy', 'Wave copy 2']);
  assert.ok(JSON.parse(await ink(() => localStorage.getItem('ia-tried') || '[]')).includes('dupPlan'), 'ticked in New to try');
  console.log('t178 duplicate plan ok');
}
