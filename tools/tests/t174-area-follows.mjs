// t174 area folders keep up with the body. After Sort by area, Copy to other side put the twin of a
// right forearm piece into the Right forearm folder although it sat on the left forearm; a tattoo
// moved with Try other spots stayed in its old area's folder; deleting the last tattoo of an area
// left an "Empty folder" line; and Show only this folder hid the selected tattoo but kept it
// selected, with its edit sheet and handles on ink that was not drawn. Now each tattoo filed by
// place follows itself into the folder for where it sits (one made when needed), in the same undo
// step as the move, a tattoo put in a folder by hand stays there, an emptied area folder goes, and
// a tattoo hidden by Show only this folder is let go.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.evaluate(() => { try { localStorage.removeItem('ia-ld-folded'); } catch {} });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => {
    const I = window.__ink, P = I.positions(), s = structuredClone(I.state()), base = s.tattoos[0];
    const find = (re, left, k = 0.5) => { const st = []; for (let v = 0; v < 13380; v++) { const pl = I.pain().at(v).place; if (pl && re.test(pl) && (P[v * 3] >= 0) === left) st.push(v); } return st[Math.floor(st.length * k)]; };
    const spots = [['Rose', /^Chest$/i, true], ['Snake', /rib/i, true], ['Moth', /thigh/i, true], ['Fern', /thigh/i, true, 0.3], ['Wave', /forearm/i, false]];
    s.tattoos = s.tattoos.slice(0, 1); s.tattoos[0].name = 'Sunburst'; s.groups = [{ id: 'mine', name: 'Flash ideas' }]; s.tattoos[0].group = 'mine';
    for (const [name, re, left, k] of spots) { const v = find(re, left, k); const t = structuredClone(base); t.id = 'id' + name; t.name = name; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; const nx = P[v * 3] >= 0 ? 0.3 : -0.3, L = Math.hypot(nx, 0.95); t.normal = [nx / L, 0, 0.95 / L]; delete t.group; s.tattoos.push(t); }
    I.loadState(s);
  });
  await wait(1000);
  if (!(await ink(() => document.querySelector('#layersDock').classList.contains('open')))) { await ink(() => document.querySelector('#ldToggle').click()); await wait(500); }
  await ink(() => document.querySelector('#ldAreas').click()); await wait(700);
  const S = () => ink(() => window.__ink.state());
  const folderOf = async (name) => { const s = await S(), t = s.tattoos.find((x) => x.name === name); return t && (s.groups.find((g) => g.id === t.group) || {}).name; };
  const names = async () => (await S()).groups.map((g) => g.name);
  assert.deepEqual(await names(), ['Flash ideas', 'Chest', 'Right forearm', 'Left ribs', 'Left thigh']);

  // 1. Copy to other side: the twin goes into a new Left forearm folder, in the same undo step
  await ink(() => window.__ink.select('idWave')); await wait(400);
  const before = await ink(() => JSON.stringify(window.__ink.state())), u0 = await ink(() => window.__ink.undoLen());
  await ink(() => { document.querySelector('#editorAdvanced').open = true; document.querySelector('#bOtherSide').click(); }); await wait(700);
  assert.equal(await folderOf('Wave (left)'), 'Left forearm', 'the twin is filed by where it sits');
  assert.equal(await folderOf('Wave (right)'), 'Right forearm');
  assert.deepEqual(await names(), ['Flash ideas', 'Chest', 'Left forearm', 'Right forearm', 'Left ribs', 'Left thigh'], 'the new folder is placed head to foot');
  assert.equal(await ink(() => window.__ink.undoLen()), u0 + 1, 'one undo step');
  const twin = (await S()).tattoos.find((t) => t.name === 'Wave (left)');
  assert.equal(await ink(() => window.__ink.selected()), twin.id, 'the twin is selected');
  assert.ok(await ink((id) => !!document.querySelector(`#ldList .ld-row[data-id="${id}"]`), twin.id), 'and its line shows in the panel');
  await ink(() => document.getElementById('undo').click()); await wait(600);
  assert.equal(await ink(() => JSON.stringify(window.__ink.state())), before, 'undo puts the folders back exactly');
  await ink(() => document.getElementById('redo').click()); await wait(600);

  // 2. Try other spots: Moth moved from the left thigh to the left forearm follows into that folder
  await ink(() => window.__ink.select('idMoth')); await wait(400);
  await ink(() => { if (document.querySelector('#spotPop').hidden) document.querySelector('#bSpots').click(); }); await wait(500);
  await ink(() => document.querySelector('#spotSide [data-side="L"]').click()); await wait(150);
  await ink(() => document.querySelector('#spotChoices [data-spot="forearm-front"]').click()); await wait(700);
  assert.equal(await ink(() => window.__ink.area('idMoth')), 'Left forearm');
  assert.equal(await folderOf('Moth'), 'Left forearm', 'a moved tattoo follows into the folder for its new area');
  assert.equal(await folderOf('Fern'), 'Left thigh', 'the one left behind stays');
  await ink(() => { const b = document.querySelector('#spotPop .done,#spotDone'); if (b) b.click(); else document.querySelector('#spotPop').hidden = true; }); await wait(300);

  // 3. a tattoo put in a folder by hand stays there when it moves: Rose (chest) dragged into Left thigh
  const lt = (await S()).groups.find((g) => g.name === 'Left thigh').id;
  await ink((g) => { window.__ink.state().tattoos.find((t) => t.id === 'idRose').group = g; window.__ink.commitTest(); }, lt);
  await wait(400);
  await ink(() => window.__ink.select('idRose')); await wait(300);
  await ink(() => { document.querySelector('#bSpots').click(); }); await wait(400);
  await ink(() => document.querySelector('#spotChoices [data-spot="forearm-front"]').click()); await wait(700);
  assert.equal(await folderOf('Rose'), 'Left thigh', 'put there by hand, so it stays');
  await ink(() => { document.querySelector('#spotPop').hidden = true; }); await wait(200);

  // 4. deleting the last tattoo of an area drops its folder; your own empty folder stays
  await ink(() => window.__ink.select('idSnake')); await wait(400);
  await ink(() => document.querySelector('#bDelTop').click()); await wait(700);
  assert.ok(!(await S()).tattoos.some((t) => t.id === 'idSnake'));
  assert.ok(!(await names()).includes('Left ribs'), 'the emptied area folder goes');
  assert.ok(!(await ink(() => [...document.querySelectorAll('#ldList .ld-ghead')].some((h) => /Empty folder/.test(h.textContent)))), 'no Empty folder line');
  await ink(() => { const t = window.__ink.state().tattoos.find((x) => x.name === 'Sunburst'); delete t.group; window.__ink.commitTest(); }); await wait(400);
  assert.ok((await names()).includes('Flash ideas'), 'a folder of your own stays even when empty');

  // 5. Show only this folder lets go of a selected tattoo it hides
  await ink(() => window.__ink.select('idWave')); await wait(400);
  const ltId = (await S()).groups.find((g) => g.name === 'Left thigh').id;
  await ink((id) => document.querySelector(`#ldList .ld-ghead[data-group="${id}"] .ld-gmore`).click(), ltId); await wait(400);
  await ink(() => [...document.querySelectorAll('#ldList button')].find((b) => /Show only this folder/.test(b.textContent)).click()); await wait(700);
  assert.ok((await S()).tattoos.find((t) => t.id === 'idWave').hidden, 'Wave is hidden');
  assert.equal(await ink(() => window.__ink.selected()), null, 'and no longer selected');
  // a selected tattoo inside the folder stays selected
  await ink(() => document.getElementById('undo').click()); await wait(500);
  await ink(() => window.__ink.select('idFern')); await wait(400);
  await ink((id) => { if (![...document.querySelectorAll('#ldList button')].some((b) => /Show only this folder/.test(b.textContent))) document.querySelector(`#ldList .ld-ghead[data-group="${id}"] .ld-gmore`).click(); }, ltId); await wait(400);
  await ink(() => [...document.querySelectorAll('#ldList button')].find((b) => /Show only this folder/.test(b.textContent)).click()); await wait(700);
  assert.equal(await ink(() => window.__ink.selected()), 'idFern', 'one in the folder stays selected');

  assert.ok(JSON.parse(await ink(() => localStorage.getItem('ia-tried') || '[]')).includes('areaFollows'), 'ticked in New to try');
  console.log('PASS t174 area folders follow a moved or copied tattoo, empty area folders go, solo lets go of a hidden selection');
}
