// t187 in a big project Hide, Show and picking a tattoo again worked out the gap to the nearest
// tattoo from scratch on every tap, up to a fifth of a second with 60 tattoos (2026-11-24). Now the
// line is kept for what it was worked out from. This checks that Hide and Show of the selected
// tattoo keep the same line without working it out again, that the line still changes when the
// nearest tattoo is hidden, renamed or moved, that undo brings the first line back, that two
// overlapping pieces still read Touches, and that New to try ticks.
import assert from 'node:assert/strict';
import setup from '../big-project.mjs';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await setup(p);
  const runs = () => ink(() => window.__ink.inkReads().gaps);
  const gap = () => ink(() => document.querySelector('#gap').textContent);
  const lines = await p.$$('#ldList .ld-tat');
  await lines[20].tap(); await wait(900);
  const g0 = await gap(), r0 = await runs(), id = await ink(() => window.__ink.selected());
  assert.match(g0, /in from T\d+|Touches T\d+/, 'the gap line shows: ' + g0);
  const near = g0.match(/(T\d+)$/)[1];
  // the quicker search finds the same nearest gap as comparing every point with every point
  const chk = await ink((id) => { const I = window.__ink, S = I.state(), a = new Float32Array(I.inkPts(id)); let best = Infinity, name = null;
    for (const o of S.tattoos) { if (o.id === id || o.hidden) continue; const bl = I.inkPts(o.id); if (!bl) continue; const b = new Float32Array(bl);
      for (let i = 0; i < a.length; i += 3) for (let j = 0; j < b.length; j += 3) { const d = (a[i] - b[j]) ** 2 + (a[i + 1] - b[j + 1]) ** 2 + (a[i + 2] - b[j + 2]) ** 2; if (d < best) { best = d; name = o.name; } } }
    const r = I.gapNow(id); return { brute: Math.sqrt(best) * 100 * (S.heightCm / 175) / 2.54, name, fast: r.g && r.g.inches, fname: r.g && r.g.name, ms: r.ms }; }, id);
  console.log('gap check', JSON.stringify(chk));
  if (chk.brute < 0.15) assert.ok(chk.fast < 0.15, 'touching either way');
  else { assert.ok(Math.abs(chk.fast - chk.brute) < 1e-4, 'the same gap as the full comparison'); assert.equal(chk.fname, chk.name, 'to the same tattoo'); }
  // the same for a tattoo far from the others (the last one placed)
  const far = await ink(() => { const I = window.__ink, S = I.state(), id = S.tattoos[59].id, a = new Float32Array(I.inkPts(id)); let best = Infinity;
    for (const o of S.tattoos) { if (o.id === id || o.hidden) continue; const bl = I.inkPts(o.id); if (!bl) continue; const b = new Float32Array(bl);
      for (let i = 0; i < a.length; i += 3) for (let j = 0; j < b.length; j += 3) { const d = (a[i] - b[j]) ** 2 + (a[i + 1] - b[j + 1]) ** 2 + (a[i + 2] - b[j + 2]) ** 2; if (d < best) best = d; } }
    const r = I.gapNow(id); return { brute: Math.sqrt(best) * 100 * (S.heightCm / 175) / 2.54, fast: r.g && r.g.inches, ms: r.ms }; });
  console.log('gap check far', JSON.stringify(far));
  if (far.brute >= 0.15) assert.ok(Math.abs(far.fast - far.brute) < 1e-4, 'the same gap for a far piece');
  // Hide and Show the selected one: same line, nothing worked out again
  await ink(() => document.querySelector('#bHide').click()); await wait(700);
  await ink(() => document.querySelector('#bHide').click()); await wait(700);
  assert.equal(await gap(), g0, 'the same line after Hide and Show');
  assert.equal(await runs(), r0, 'nothing worked out again for Hide and Show');
  // rename the nearest: the line names it
  await ink((n) => { const t = window.__ink.state().tattoos.find((q) => q.name === n); t.name = n + ' renamed'; window.__ink.commitTest(); }, near); await wait(900);
  assert.match(await gap(), new RegExp(near + ' renamed$'), 'the line follows a rename: ' + await gap());
  // hide the nearest: another one is nearest now
  await ink((n) => { const t = window.__ink.state().tattoos.find((q) => q.name === n + ' renamed'); t.hidden = true; window.__ink.commitTest(); }, near); await wait(900);
  const g1 = await gap();
  assert.ok(!g1.includes(near + ' renamed') && /T\d+$/.test(g1), 'a hidden neighbour is skipped: ' + g1);
  // undo twice: the first line again
  await ink(() => document.querySelector('#undo').click()); await wait(600);
  await ink(() => document.querySelector('#undo').click()); await wait(900);
  assert.equal(await gap(), g0, 'undo brings the first line back');
  // move the selected one onto its neighbour: it touches
  await ink((n) => { const S = window.__ink.state(), o = S.tattoos.find((q) => q.name === n), t = S.tattoos.find((q) => q.id === window.__ink.selected()); t.pos = o.pos.slice(); t.normal = o.normal.slice(); window.__ink.commitTest(); }, near); await wait(1200);
  assert.match(await gap(), /^Touches T\d+/, 'on top of another it touches: ' + await gap());
  assert.ok((await runs()) > r0, 'a move works it out again');
  assert.equal(await ink(() => window.__ink.selected()), id, 'still the same tattoo');
  assert.ok((await ink(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'))).includes('hideQuick'), 'New to try ticks');
  console.log('t187 ok');
}
