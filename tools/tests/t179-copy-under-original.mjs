// t179 Duplicate in the edit sheet (and Cmd+D) and Copy to other side put the copy at the bottom
// of the list, so with many layers it landed far from the tattoo it came from; Layers' own
// Duplicate puts it right under the original. Now all three do: the copy is the line under the
// original in Layers and in the project's order, the other tattoos keep their order, and Undo
// puts the list back exactly.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => {
    const I = window.__ink, P = I.positions(), s = structuredClone(I.state()), base = s.tattoos[0];
    const find = (re, side) => { const st = []; for (let v = 0; v < 13380; v++) { const pl = I.pain().at(v).place; if (pl && re.test(pl) && side * P[v * 3] > 0) st.push(v); } return st[Math.floor(st.length / 2)]; };
    const make = (id, name, v) => { const t = structuredClone(base); t.id = id; t.name = name; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; t.status = 'planned'; t.locked = false; delete t.group; delete t.review; delete t.fromLayer; return t; };
    const a = make('idA', 'Anchor', find(/forearm/i, -1)), b = make('idB', 'Bird', find(/thigh/i, 1)), c = make('idC', 'Crown', find(/thigh/i, -1));
    a.normal = [-0.3 / Math.hypot(0.3, 0.95), 0, 0.95 / Math.hypot(0.3, 0.95)]; b.normal = [0, 0, 1]; c.normal = [0, 0, 1];
    s.tattoos = [a, b, c]; s.groups = []; I.loadState(s);
  });
  await wait(1000);
  const lines = () => ink(() => [...document.querySelectorAll('#ldList .ld-tat')].map((e) => e.dataset.id));
  const order = () => ink(() => window.__ink.state().tattoos.map((t) => t.id));

  // Duplicate from the edit sheet
  await ink(() => window.__ink.select('idA')); await wait(500);
  const before = await ink(() => JSON.stringify(window.__ink.state().tattoos));
  await ink(() => { document.querySelector('#editorAdvanced').open = true; document.querySelector('#bDup').click(); }); await wait(800);
  let ids = await order(); const dup = await ink(() => window.__ink.selected());
  assert.equal(ids.length, 4, 'a copy was made');
  assert.deepEqual(ids, ['idA', dup, 'idB', 'idC'], 'the copy is right under the original, the rest keep their order');
  await wait(300);
  let L = await lines(); assert.equal(L.indexOf(dup), L.indexOf('idA') + 1, 'and is the line under it in Layers');
  await ink(() => document.querySelector('#undo').click()); await wait(700);
  assert.equal(await ink(() => JSON.stringify(window.__ink.state().tattoos)), before, 'Undo puts the list back exactly');

  // Cmd+D
  await ink(() => window.__ink.select('idA')); await wait(500);
  await ink(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await p.keyboard.down('Meta'); await p.keyboard.press('KeyD'); await p.keyboard.up('Meta'); await wait(800);
  ids = await order(); const dup2 = await ink(() => window.__ink.selected());
  assert.deepEqual(ids, ['idA', dup2, 'idB', 'idC'], 'Cmd+D puts the copy under the original too');
  await ink(() => document.querySelector('#undo').click()); await wait(700);
  assert.deepEqual(await order(), ['idA', 'idB', 'idC']);

  // Copy to other side
  await ink(() => window.__ink.select('idB')); await wait(500);
  await ink(() => { document.querySelector('#editorAdvanced').open = true; document.querySelector('#bOtherSide').click(); }); await wait(900);
  ids = await order(); const twin = await ink(() => window.__ink.selected());
  assert.notEqual(twin, 'idB', 'a twin was made');
  assert.deepEqual(ids, ['idA', 'idB', twin, 'idC'], 'the twin is right under the original');
  assert.ok(await ink(() => (JSON.parse(localStorage.getItem('ia-tried') || '[]') || []).includes('copyUnder')), 'New to try ticks itself');
  await wait(300);
  L = await lines(); assert.equal(L.indexOf(twin), L.indexOf('idB') + 1, 'and is the line under it in Layers');
}
