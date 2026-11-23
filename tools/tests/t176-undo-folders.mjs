// t176 undo says what it put back for folders. Undoing Sort by area said "Undid changes to 6
// tattoos.", undoing a tattoo taken out of a folder said "Undid the change to Rose." and a renamed
// folder "Undid the last change.", so the words never said folders. Now: "Undid the folders.",
// "Undid renaming Chest.", "Undid taking Rose out of Chest piece.", and Go back to the same words.
// The pick bar's Hide said "changes to 2 tattoos" and a merge "removing Fern"; now "hiding 2
// tattoos" and "merging 2 tattoos into Moth".
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => {
    const I = window.__ink, P = I.positions(), s = structuredClone(I.state()), base = s.tattoos[0];
    const find = (re, left, k = 0.5) => { const st = []; for (let v = 0; v < 13380; v++) { const pl = I.pain().at(v).place; if (pl && re.test(pl) && (P[v * 3] >= 0) === left) st.push(v); } return st[Math.floor(st.length * k)]; };
    s.tattoos = []; s.groups = [];
    for (const [name, re, left, k] of [['Rose', /^Chest$/i, true], ['Moth', /thigh/i, true], ['Fern', /thigh/i, true, 0.53], ['Wave', /forearm/i, false]]) { const v = find(re, left, k), t = structuredClone(base); t.id = 'id' + name; t.name = name; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; t.normal = [0, 0, 1]; delete t.group; s.tattoos.push(t); }
    I.loadState(s);
  });
  await wait(1000);
  if (!(await ink(() => document.querySelector('#layersDock').classList.contains('open')))) { await ink(() => document.querySelector('#ldToggle').click()); await wait(500); }
  const toast = () => ink(() => document.querySelector('#toast').textContent.trim());
  const undo = async () => { await ink(() => document.getElementById('undo').click()); await wait(400); return toast(); };
  const redo = async () => { await ink(() => document.getElementById('redo').click()); await wait(400); return toast(); };

  await ink(() => document.querySelector('#ldAreas').click()); await wait(700);
  assert.equal((await ink(() => window.__ink.state().groups.length)), 3, 'three area folders');
  assert.equal(await undo(), 'Undid the folders.', 'undoing Sort by area');
  assert.equal(await redo(), 'Redid the folders.');

  const chest = await ink(() => window.__ink.state().groups.find((g) => g.name === 'Chest').id);
  // rename the folder in its menu
  await ink((id) => document.querySelector(`#ldList .ld-ghead[data-group="${id}"] .ld-gmore`).click(), chest); await wait(400);
  const named = await ink(() => { const i = [...document.querySelectorAll('#ldList input.ld-name')].find((x) => x.getAttribute('aria-label') === 'Folder name'); if (!i) return false; i.value = 'Chest piece'; i.dispatchEvent(new Event('change')); return true; });
  assert.ok(named, 'the folder menu has its name box'); await wait(500);
  assert.equal(await ink((id) => window.__ink.state().groups.find((g) => g.id === id).name, chest), 'Chest piece');
  assert.equal(await undo(), 'Undid renaming Chest.', 'by the name it had, as a tattoo rename is');
  await redo();

  // take Rose out of its folder with the folder's own menu (Chest goes with it, being empty)
  await ink((id) => { if (![...document.querySelectorAll('#ldList button')].some((b) => /Take them out of the folder/.test(b.textContent))) document.querySelector(`#ldList .ld-ghead[data-group="${id}"] .ld-gmore`).click(); }, chest); await wait(400);
  await ink(() => [...document.querySelectorAll('#ldList button')].find((b) => /Take them out of the folder/.test(b.textContent)).click()); await wait(600);
  assert.ok(!(await ink(() => window.__ink.state().tattoos.find((t) => t.id === 'idRose').group)), 'Rose is out');
  assert.equal(await undo(), 'Undid taking Rose out of Chest piece.');
  await redo();

  // Go back to lists the same words
  const b = await p.$('#undo'), box = await b.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await wait(700); await p.mouse.up(); await wait(300);
  const list = await p.$$eval('#historyList [data-steps]', (a) => a.map((e) => e.textContent.trim()));
  assert.ok(list.some((x) => /folders/i.test(x)), 'Go back to names the folders: ' + JSON.stringify(list.slice(0, 6)));
  await p.keyboard.press('Escape'); await wait(300);
  if (!(await ink(() => document.querySelector('#historyPop').hidden))) { await ink(() => { document.querySelector('#historyPop').hidden = true; }); }

  // the pick bar's Hide and Merge on two lines, named as such
  await ink(() => { const b = document.querySelector('#ldFoldAll'); if (b && b.textContent === 'Open all') b.click(); }); await wait(400);
  await p.click('#ldSelect'); await wait(300);
  await p.click('#ldList .ld-tat[data-id="idMoth"]'); await wait(250); await p.click('#ldList .ld-tat[data-id="idFern"]'); await wait(250);
  await p.click('#ldPickBar .ld-tiles button[aria-label="Hide the 2"]'); await wait(400);
  assert.equal(await undo(), 'Undid hiding 2 tattoos.');
  await redo(); await p.click('#ldPickBar .ld-tiles button[aria-label="Show the 2"]'); await wait(400);
  const merge = await p.$$eval('#ldPickBar .ld-tiles button', (a) => { const b = a.find((x) => /^Merge/.test(x.getAttribute('aria-label') || x.textContent)); if (b) b.click(); return !!b; });
  assert.ok(merge, 'a Merge tile'); await wait(2500);
  assert.equal((await ink(() => window.__ink.state().tattoos.length)), 3, 'merged into one');
  const kept = await ink(() => window.__ink.state().tattoos.find((t) => t.id === 'idMoth' || t.id === 'idFern').name);
  assert.equal(await undo(), `Undid merging 2 tattoos into ${kept}.`);
  assert.ok(JSON.parse(await ink(() => localStorage.getItem('ia-tried') || '[]')).includes('undoFolders'), 'ticked in New to try');
  console.log('PASS t176 undo and redo name folder changes (Sort by area, out of a folder, a rename, Go back to), hiding several and a merge');
}
