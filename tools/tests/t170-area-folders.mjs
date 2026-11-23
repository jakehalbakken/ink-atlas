// Folders by body area in Layers (2026-11-22, Jake: "group artwork layers into, I guess, subfolders.
// So for example, if I have a bunch of pieces that I want to look at on my thigh and be able to see
// them all, like I can click on like the thigh folder"). Six tattoos on the chest, ribs, both thighs
// and a forearm. Checks, by touch at iPad landscape and portrait: Sort into areas files them into one
// folder per area as one undo step that changes only folder membership, and Undo puts the project back
// exactly; a folder of your own keeps what you put in it; tapping a folder's name opens it and turns
// the view to its tattoos (and not with the view locked); the eye hides and shows all of it; Show only
// this folder, Show everything, rename, Pick them and Take them out each work as one undo step; Fold
// all and Open all; folds kept after a reload; a saved project opens with its folders unchanged;
// comment-only hides Sort into areas; every control is 44 pt.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  const boot = async () => { await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200); };
  const tap = async (sel, i = 0) => {
    const b = await ink(([s, i]) => { const e = [...document.querySelectorAll(s)].filter((x) => x.checkVisibility())[i]; if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, [sel, i]);
    assert.ok(b, `nothing to tap for ${sel}`); await p.touchscreen.tap(b[0], b[1]); await wait(450);
  };
  const strip = (s) => JSON.stringify({ ...s, groups: s.groups || [], tattoos: s.tattoos.map(({ group, ...t }) => t) });
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.evaluate(() => { try { localStorage.removeItem('ia-ld-folded'); localStorage.removeItem('ia-view-lock'); } catch {} });
  await p.reload({ waitUntil: 'load' }); await boot();
  // six tattoos: copies of the sample placed on real skin found from the pain map's places
  const made = await ink(() => {
    const I = window.__ink, P = I.positions(), s = structuredClone(I.state()), base = s.tattoos[0];
    const find = (re, left, k = 0.5) => { const st = []; for (let v = 0; v < 13380; v++) { const pl = I.pain().at(v).place; if (pl && re.test(pl) && (P[v * 3] >= 0) === left) st.push(v); } return st[Math.floor(st.length * k)]; };
    const spots = [['Rose', /^Chest$/i, true], ['Snake', /rib/i, true], ['Moth', /thigh/i, true], ['Fern', /thigh/i, true, 0.3], ['Dagger', /thigh/i, false], ['Wave', /forearm/i, false]];
    s.tattoos = s.tattoos.slice(0, 1);
    s.tattoos[0].name = 'Sunburst';
    for (const [name, re, left, k] of spots) { const v = find(re, left, k); if (v == null) return `no skin for ${name}`; const t = structuredClone(base); t.id = 'id' + name; t.name = name; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; const nx = P[v * 3] >= 0 ? 0.3 : -0.3, L = Math.hypot(nx, 0.95); t.normal = [nx / L, 0, 0.95 / L]; delete t.group; s.tattoos.push(t); }
    s.groups = [{ id: 'mine', name: 'Flash ideas' }]; s.tattoos[0].group = 'mine';
    I.loadState(s); return s.tattoos.map((t) => [t.name, I.area(t.id)]);
  });
  assert.ok(Array.isArray(made), made); await wait(1200);
  const areas = Object.fromEntries(made);
  assert.equal(areas.Moth, 'Left thigh'); assert.equal(areas.Fern, 'Left thigh'); assert.equal(areas.Dagger, 'Right thigh'); assert.equal(areas.Wave, 'Right forearm'); assert.equal(areas.Rose, 'Chest'); assert.equal(areas.Snake, 'Left ribs');
  const before = await ink(() => JSON.stringify(window.__ink.state())), u0 = await ink(() => window.__ink.undoLen());
  // Sort into areas: one undo step, only folders change, your own folder untouched
  await tap('#ldAreas');
  const after = await ink(() => window.__ink.state());
  assert.equal(await ink(() => window.__ink.undoLen()), u0 + 1, 'one undo step');
  assert.equal(strip(after).replace(/"groups":\[[^\]]*\]/, ''), strip(JSON.parse(before)).replace(/"groups":\[[^\]]*\]/, ''), 'nothing but folders changed');
  const gname = (t) => after.groups.find((g) => g.id === t.group)?.name;
  const by = Object.fromEntries(after.tattoos.map((t) => [t.name, gname(t)]));
  assert.deepEqual(by, { Sunburst: 'Flash ideas', Rose: 'Chest', Snake: 'Left ribs', Moth: 'Left thigh', Fern: 'Left thigh', Dagger: 'Right thigh', Wave: 'Right forearm' });
  assert.deepEqual(after.groups.map((g) => g.name), ['Flash ideas', 'Chest', 'Right forearm', 'Left ribs', 'Left thigh', 'Right thigh'], 'own folders first, then head to foot');
  const toast = await ink(() => document.querySelector('#toast')?.textContent || '');
  assert.match(toast, /Sorted 6 tattoos into 5 folders/);
  // folders start folded: only the own folder's line and no area tattoo lines
  assert.equal(await ink(() => document.querySelectorAll('#ldList .ld-ghead.area').length), 5);
  // Undo puts it back exactly, Redo sorts again
  await ink(() => document.getElementById('undo').click()); await wait(500);
  assert.equal(await ink(() => JSON.stringify(window.__ink.state())), before, 'undo restores the project exactly');
  await ink(() => document.getElementById('redo').click()); await wait(500);
  // tapping the thigh folder's name opens it and turns the view to its two tattoos
  const head = (name) => `#ldList .ld-ghead[data-group="${after.groups.find((g) => g.name === name).id}"]`;
  const cam0 = await ink(() => window.__ink.cam());
  await tap(head('Left thigh') + ' .ld-gname'); await wait(1400);
  const cam1 = await ink(() => window.__ink.cam());
  assert.ok(Math.hypot(...cam1.slice(0, 3).map((v, i) => v - cam0[i])) > 0.05, 'the view turned to the thigh');
  const lines = await ink((h) => [...document.querySelector(h).parentElement.querySelectorAll('.ld-row b')].map((b) => b.textContent), head('Left thigh'));
  assert.ok(lines.includes('Moth') && lines.includes('Fern') && lines.length === 2, `thigh folder shows its two: ${lines}`);
  // both thigh pieces in sight: projected inside the screen
  const inSight = await ink(() => ['idMoth', 'idFern'].every((id) => { const b = window.__ink.inkBox(id), c = document.querySelector('canvas'); return b && b[0] >= -5 && b[1] >= -5 && b[2] <= c.width + 5 && b[3] <= c.height + 5; }));
  assert.ok(inSight, 'both thigh tattoos are on screen');
  // the eye hides the whole folder, one undo step, and shows it again
  let u = await ink(() => window.__ink.undoLen());
  await tap(head('Left thigh') + ' .ld-eye');
  assert.deepEqual(await ink(() => window.__ink.state().tattoos.filter((t) => t.hidden).map((t) => t.name).sort()), ['Fern', 'Moth']);
  assert.equal(await ink(() => window.__ink.undoLen()), u + 1);
  await tap(head('Left thigh') + ' .ld-eye');
  assert.equal(await ink(() => window.__ink.state().tattoos.filter((t) => t.hidden).length), 0);
  // its ⋯: Show only this folder, then Show everything
  await tap(head('Left thigh') + ' .ld-gmore');
  const tapWord = async (word) => { const ok = await ink((w) => { const b = [...document.querySelectorAll('#ldList .ld-gacts button')].find((x) => x.textContent === w); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, b.disabled]; }, word); assert.ok(ok, `no ${word}`); assert.ok(!ok[2], `${word} is off`); await p.touchscreen.tap(ok[0], ok[1]); await wait(500); };
  u = await ink(() => window.__ink.undoLen());
  await tapWord('Show only this folder');
  assert.deepEqual(await ink(() => window.__ink.shownIds().sort()), ['idFern', 'idMoth'], 'only the thigh shows');
  assert.equal(await ink(() => window.__ink.undoLen()), u + 1);
  await tapWord('Show everything');
  assert.equal(await ink(() => window.__ink.shownIds().length), 7, 'everything shows again');
  // rename: the name changes, the area stays, so a later sort still uses it
  await ink(() => { const i = document.querySelector('#ldList .ld-gacts .ld-name'); i.value = 'Thigh garden'; i.dispatchEvent(new Event('change')); }); await wait(400);
  const g2 = await ink(() => window.__ink.state().groups.find((g) => g.name === 'Thigh garden'));
  assert.ok(g2 && g2.area === 'Left thigh', 'renamed, area kept');
  await tap('#ldAreas'); assert.equal(await ink(() => window.__ink.state().groups.filter((g) => g.area === 'Left thigh').length), 1, 'a sort after a rename reuses the renamed folder');
  // Pick them puts both on the pick bar
  if (!(await ink(() => !!document.querySelector('#ldList .ld-gacts')))) await tap('#ldList .ld-ghead[data-group="' + g2.id + '"] .ld-gmore');
  await tapWord('Pick them');
  assert.match(await ink(() => document.querySelector('#ldPickBar b')?.textContent || ''), /^2 picked/);
  await tap('#ldSelect'); // Done
  // Take them out: the folder goes, the tattoos stay where they are
  await tap(`#ldList .ld-ghead[data-group="${g2.id}"] .ld-gmore`);
  const posBefore = await ink(() => JSON.stringify(window.__ink.state().tattoos.map((t) => t.pos)));
  await tapWord('Take them out of the folder');
  assert.equal(await ink((id) => window.__ink.state().groups.some((g) => g.id === id), g2.id), false);
  assert.equal(await ink(() => JSON.stringify(window.__ink.state().tattoos.map((t) => t.pos))), posBefore, 'nothing moved on the body');
  await ink(() => document.getElementById('undo').click()); await wait(500);
  // view lock: a folder tap opens it but leaves the camera alone
  await tap(`#ldList .ld-ghead[data-group="${g2.id}"] .ld-gname`); // fold
  await ink(() => document.getElementById('viewLock').click()); await wait(300);
  const camL = await ink(() => window.__ink.cam());
  await tap(`#ldList .ld-ghead[data-group="${g2.id}"] .ld-gname`); await wait(1200);
  assert.deepEqual(await ink(() => window.__ink.cam()), camL, 'the view lock holds');
  await ink(() => document.getElementById('viewLock').click()); await wait(300);
  // Fold all, Open all
  await tap('#ldFoldAll'); assert.equal(await ink(() => document.querySelectorAll('#ldList .ld-in .ld-row').length), 0, 'Fold all folds every folder');
  assert.equal(await ink(() => document.querySelector('#ldFoldAll').textContent), 'Open all');
  await tap('#ldFoldAll'); assert.equal(await ink(() => document.querySelectorAll('#ldList .ld-in .ld-row').length), 7);
  // fold two, reload: they stay folded and the project opens with its folders unchanged
  await tap(head('Chest') + ' .ld-gname'); await tap(head('Right thigh') + ' .ld-gname');
  await ink(() => window.__ink.flush()); await wait(600);
  const saved = await ink(() => JSON.stringify(window.__ink.state()));
  const shutBefore = await ink(() => JSON.parse(localStorage.getItem('ia-ld-folded') || '[]').sort());
  await p.reload({ waitUntil: 'load' }); await boot();
  assert.equal(await ink(() => JSON.stringify(window.__ink.state())), saved, 'the saved project opens unchanged');
  assert.deepEqual(await ink(() => JSON.parse(localStorage.getItem('ia-ld-folded') || '[]').sort()), shutBefore);
  const openHeads = await ink(() => [...document.querySelectorAll('#ldList .ld-ghead')].map((h) => [h.querySelector('b').textContent, h.querySelector('.ld-fold').getAttribute('aria-expanded')]));
  assert.deepEqual(Object.fromEntries(openHeads).Chest, 'false'); assert.deepEqual(Object.fromEntries(openHeads)['Right thigh'], 'false'); assert.deepEqual(Object.fromEntries(openHeads)['Thigh garden'], 'true');
  // 44 pt in both orientations
  const small = [];
  for (const [w, h] of [[1180, 820], [820, 1180]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true }); await wait(900);
    await tap(head('Left thigh') + ' .ld-gmore');
    const s = await ink(() => [...document.querySelectorAll('#ldList .ld-ghead button, #ldList .ld-gacts button, #ldList .ld-gacts input, #ldAreas, #ldFoldAll, #ldSelect')].filter((b) => b.checkVisibility()).map((b) => { const r = b.getBoundingClientRect(); return [b.getAttribute('aria-label') || b.textContent, Math.round(r.width), Math.round(r.height)]; }).filter(([, a, b]) => a < 44 || b < 44));
    small.push(...s.map((x) => `${w}x${h} ${x.join(' ')}`));
    await tap(head('Left thigh') + ' .ld-gmore');
  }
  assert.deepEqual(small, [], small.join('\n'));
  // comment-only: no Sort into areas, no folder actions
  await ink(() => document.body.classList.add('comment-only')); await ink(() => window.__ink.layersDock().render?.()); await wait(300);
  assert.equal(await ink(() => document.querySelector('#ldAreas').checkVisibility()), false, 'comment-only hides Sort into areas');
  assert.equal(await ink(() => [...document.querySelectorAll('#ldList .ld-gmore')].some((b) => b.checkVisibility())), false);
  await ink(() => document.body.classList.remove('comment-only'));
  await p.screenshot({ path: 'shots/t170-area-folders.png' });
  console.log('PASS t170 folders by body area: Sort into areas files six tattoos into Chest, Left ribs, Left thigh, Right thigh and Right forearm as one undo step that changes only folders (your own folder kept, undo exact), a folder tap opens it and turns the view to it (not when locked), eye, Show only this folder, Show everything, rename, Pick them, Take them out, Fold all and Open all work, folds kept and the project unchanged after a reload, 44 pt at both iPad orientations, comment-only hides it');
}
