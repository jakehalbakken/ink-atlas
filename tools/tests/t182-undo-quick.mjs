// t182 every Undo and Redo reshaped the body, and a new shape rebuilds every tattoo's ink, so in a
// project with 60 tattoos undoing a rename or Sort by area cost a quarter of a second or more
// (2026-11-24). Now the shape is refreshed only when the step changed it. This checks undo and redo
// of Sort by area and of a move rebuild no ink and put the state back exactly, that undoing a body
// slider still reshapes the body and moves the ink with it, and that New to try ticks.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => { const I = window.__ink, s = structuredClone(I.state()), b = s.tattoos[0], P = I.positions();
    s.tattoos = []; for (let k = 0; k < 60; k++) { const t = structuredClone(b), v = 100 + k * 211; t.id = 'id' + k; t.name = 'T' + k; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; t.status = k % 3 ? 'planned' : 'existing'; t.locked = false; delete t.group; s.tattoos.push(t); }
    s.groups = []; I.loadState(s); });
  await wait(2500);
  const geo = () => ink(() => window.__ink.inkReads().geo);
  const snap = () => ink(() => JSON.stringify(window.__ink.state()));
  const before = await snap(), g0 = await geo();
  await ink(() => document.querySelector('#ldAreas').click()); await wait(800);
  const sorted = await snap();
  assert.notEqual(sorted, before, 'Sort by area made folders');
  const gSort = await geo();
  await ink(() => document.querySelector('#undo').click()); await wait(800);
  assert.equal(await snap(), before, 'undo of Sort by area puts the project back exactly');
  assert.equal(await geo(), gSort, 'undo of Sort by area rebuilds no ink');
  await ink(() => document.querySelector('#redo').click()); await wait(800);
  assert.equal(await snap(), sorted, 'redo puts the folders back exactly');
  assert.equal(await geo(), gSort, 'redo of Sort by area rebuilds no ink');
  // a move: only the moved tattoo's ink is rebuilt, on the way and back
  const P0 = await ink(() => window.__ink.state().tattoos.find((t) => t.id === 'id5').pos);
  await ink(() => window.__ink.select('id5')); await wait(400);
  await p.keyboard.press('ArrowRight'); await wait(900);
  const moved = await ink(() => window.__ink.state().tattoos.find((t) => t.id === 'id5').pos);
  assert.notDeepEqual(moved, P0, 'the arrow key moved it');
  const gMove = await geo();
  await ink(() => document.querySelector('#undo').click()); await wait(800);
  assert.deepEqual(await ink(() => window.__ink.state().tattoos.find((t) => t.id === 'id5').pos), P0, 'undo put it back');
  assert.ok((await geo()) - gMove <= 2, `undo of a move rebuilds only that tattoo, not all 60 (${(await geo()) - gMove})`);
  // undo is quick: time a burst of undo and redo of the folders
  const ms = await ink(async () => { const t0 = performance.now(); for (let i = 0; i < 4; i++) { document.querySelector('#redo').click(); document.querySelector('#undo').click(); } return performance.now() - t0; });
  console.log('8 undo/redo steps', Math.round(ms), 'ms');
  // a body slider still reshapes, and undo puts the shape and the ink back
  const pos0 = await ink(() => Array.from(window.__ink.positions().slice(0, 3000)));
  const ink0 = await ink(() => Array.from(window.__ink.inkPts('id9') || []).slice(0, 30));
  await ink(() => { const r = document.querySelector('#rWeight'); r.value = 90; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
  await wait(1200);
  const pos1 = await ink(() => Array.from(window.__ink.positions().slice(0, 3000)));
  assert.ok(pos1.some((v, i) => Math.abs(v - pos0[i]) > 1e-4), 'the weight slider reshaped the body');
  const gW = await geo();
  await ink(() => document.querySelector('#undo').click()); await wait(1200);
  assert.ok((await geo()) - gW >= 50, 'undo of the body shape rebuilds the ink');
  const pos2 = await ink(() => Array.from(window.__ink.positions().slice(0, 3000)));
  assert.ok(pos2.every((v, i) => Math.abs(v - pos0[i]) < 1e-5), 'undo of the body shape puts the body back');
  const ink2 = await ink(() => Array.from(window.__ink.inkPts('id9') || []).slice(0, 30));
  assert.ok(ink0.length && ink2.every((v, i) => Math.abs(v - ink0[i]) < 1e-4), 'and the ink back on it');
  const tried = await ink(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert.ok(tried.includes('undoQuick'), 'New to try ticks Undo is quick');
  // Duplicate in a big project ticks too
  await ink(() => window.__ink.select('id12')); await wait(400);
  await p.keyboard.down('Meta'); await p.keyboard.press('KeyD'); await p.keyboard.up('Meta'); await wait(1200);
  assert.equal(await ink(() => window.__ink.state().tattoos.length), 61, 'Cmd+D made a copy');
  assert.ok((await ink(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'))).includes('dupQuick'), 'New to try ticks Duplicate is quick');
  console.log('t182 ok');
}
