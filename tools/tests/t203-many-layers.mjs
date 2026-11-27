// A project of 87 layers, most of them hidden, like Jake's (2026-11-27: the page "crashing so much" and
// "Not saved: storage problem"). Every layer used to keep its ink picture in memory whether it showed or
// not, about 9 MB each with its copy on the graphics chip, so 87 layers held close to 800 MB and the iPad
// closed the page. Now a hidden layer holds none: showing it draws its picture again, hiding it gives it
// back. Also: a save after the page's database connection is lost lands (it is opened again), the
// warning shows once rather than on every failed save, and nothing in the project changes.
import assert from 'node:assert/strict';

export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
  const before = await p.evaluate(() => window.__ink.inkTex());
  // 87 layers: 10 on my skin, 77 planned, 70 of the planned hidden
  await p.evaluate(() => {
    const s = JSON.parse(JSON.stringify(window.__ink.state())), base = s.tattoos[0];
    s.tattoos = Array.from({ length: 87 }, (_, i) => ({ ...JSON.parse(JSON.stringify(base)), id: 'many' + i, name: 'Layer ' + i, status: i < 10 ? 'existing' : 'planned', hidden: i >= 17, width: base.width * 0.5, pos: base.pos }));
    window.__ink.loadState(s);
  });
  await wait(2500);
  const many = await p.evaluate(() => ({ tex: window.__ink.inkTex(), gpu: window.__ink.gpu(), n: window.__ink.state().tattoos.length, hidden: window.__ink.state().tattoos.filter((t) => t.hidden).length }));
  console.log('before', before, 'with 87 layers', many);
  assert.equal(many.n, 87); assert.equal(many.hidden, 70);
  assert.equal(many.tex.count, 17, 'only the 17 layers that show keep an ink picture');
  assert.ok(many.tex.mb < 250, `ink pictures held stay small (${many.tex.mb} MB)`);
  // showing a hidden one from its Layers eye draws it again, hiding it gives it back, one undo step each
  const eyeOf = (name) => p.evaluate((nm) => { const line = [...document.querySelectorAll('#ldList .ld-tat')].find((l) => l.textContent.includes(nm)); if (!line) return false; line.scrollIntoView({ block: 'center' }); line.querySelector('.ld-eye').click(); return true; }, name);
  if (!(await p.evaluate(() => !!document.querySelector('#ldList .ld-tat')))) { await p.click('#layersRail, #layersDock .ld-rail'); await wait(400); }
  assert.ok(await eyeOf('Layer 40'), 'Layer 40 has its line');
  await wait(800);
  const shown = await p.evaluate(() => ({ tex: window.__ink.inkTex().count, vis: !window.__ink.state().tattoos.find((t) => t.name === 'Layer 40').hidden }));
  assert.ok(shown.vis && shown.tex === 18, 'a layer shown again draws its picture: ' + JSON.stringify(shown));
  await eyeOf('Layer 40'); await wait(800);
  assert.equal(await p.evaluate(() => window.__ink.inkTex().count), 17, 'hidden again, its picture is given back');
  // the saved project is the whole project, hidden layers included
  await p.evaluate(() => window.__ink.flush()); await wait(1200);
  const disk = await p.evaluate(async () => { const r = await window.__idbGet('project'); return { n: r.state.tattoos.length, hidden: r.state.tattoos.filter((t) => t.hidden).length, keys: r.imageKeys.length }; });
  assert.equal(disk.n, 87, 'all 87 layers are saved'); assert.equal(disk.hidden, 70, 'hidden ones too'); assert.ok(disk.keys >= 1, 'with their pictures');
  // the database connection is lost under the page, as WebKit does: the next save still lands
  await p.evaluate(() => window.__ink.store().dropConnection());
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__ink.state())); s.tattoos.find((q) => q.name === 'Layer 3').name = 'Layer 3 renamed'; window.__ink.loadState(s); });
  await p.evaluate(() => window.__ink.flush()); await wait(1500);
  const after = await p.evaluate(async () => ({ saved: window.__ink.saved(), names: (await window.__idbGet('project')).state.tattoos.map((t) => t.name), reopened: window.__ink.store().reopened, toast: document.querySelector('#toast') && !document.querySelector('#toast').hidden ? document.querySelector('#toast').textContent : '' }));
  console.log('after a lost connection', after.saved, 'reopened', after.reopened);
  assert.ok(after.reopened >= 1, 'the connection was opened again');
  assert.ok(after.names.includes('Layer 3 renamed') && after.names.length === 87, 'the save after it landed, whole');
  assert.ok(/^Saved on this device/.test(after.saved.text), 'it says saved: ' + after.saved.text);
  assert.ok(!/not being saved/.test(after.toast), 'no warning for a save that recovered');
  assert.ok(await p.evaluate(() => window.__ink.backupSame()), 'Back up now writes the same file as before, built in pieces');
  console.log('PASS t203 87 layers keep memory small and saves survive a lost connection');
}
