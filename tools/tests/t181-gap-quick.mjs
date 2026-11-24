// t181 the line under a tattoo's size ("1.2 in from Rose") compared every ink point of the selected
// tattoo with every ink point of every other tattoo, after each pick and each drag. With 60 tattoos
// that was about a second's pause on lifting a finger (2026-11-24). Now far tattoos are skipped by
// their boxes, nearest first. This checks the line reads exactly what the full comparison gives,
// for tattoos close together and far apart, that far ones are skipped, and that a drag lifts quickly.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => { const I = window.__ink, s = structuredClone(I.state()), b = s.tattoos[0], P = I.positions();
    s.tattoos = []; for (let k = 0; k < 60; k++) { const t = structuredClone(b), v = 100 + k * 211; t.id = 'id' + k; t.name = 'T' + k; t.pos = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; t.status = k % 3 ? 'planned' : 'existing'; t.locked = false; t.width = 0.03 + (k % 5) * 0.01; delete t.group; s.tattoos.push(t); }
    s.groups = []; I.loadState(s); });
  await wait(2500);
  const brute = (id) => ink((id) => { const I = window.__ink, s = I.state(), a = I.inkPts(id); if (!a || !a.length) return null; let best = null;
    for (const o of s.tattoos) { if (o.id === id || o.hidden) continue; const b = I.inkPts(o.id); if (!b || !b.length) continue; let m = Infinity;
      for (let i = 0; i < a.length; i += 3) for (let j = 0; j < b.length; j += 3) { const dx = a[i] - b[j], dy = a[i + 1] - b[j + 1], dz = a[i + 2] - b[j + 2], dd = dx * dx + dy * dy + dz * dz; if (dd < m) m = dd; }
      const inches = Math.sqrt(m) * 100 * (s.heightCm / 175) / 2.54; if (!best || inches < best.inches) best = { name: o.name, inches }; }
    if (!best) return ''; if (best.inches < 0.15) return `Touches ${best.name}`; return `${best.inches < 10 ? best.inches.toFixed(1) : Math.round(best.inches)} in from ${best.name}`; }, id);
  let total = 0, all = 0, checked = 0;
  for (const id of ['id1', 'id7', 'id20', 'id33', 'id44', 'id58']) {
    const p0 = await ink(() => window.__ink.inkReads().pairs);
    await ink((id) => window.__ink.select(id), id); await wait(900);
    const shown = await ink(() => { const g = document.querySelector('#gap'); return g.hidden ? '' : g.textContent; });
    const p1 = await ink(() => window.__ink.inkReads().pairs);
    const want = await brute(id);
    // a cover-up line takes the place of the gap for a planned piece over ink on the skin
    if (/cover/i.test(shown)) continue;
    assert.equal(shown, want, `${id}: the line reads what comparing every point gives`);
    const n = await ink((id) => { const I = window.__ink, a = I.inkPts(id).length / 3; let s = 0; for (const o of I.state().tattoos) if (o.id !== id && !o.hidden) { const b = I.inkPts(o.id); if (b) s += a * b.length / 3; } return s; }, id);
    total += p1 - p0; all += n; checked++;
  }
  assert.ok(checked >= 4, 'enough tattoos checked');
  assert.ok(await ink(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('gapQuick')), 'New to try ticks itself in a big project');
  assert.ok(total < all * 0.25, `far tattoos are skipped (${Math.round(total)} of ${Math.round(all)} point pairs compared)`);
  // a duplicate has the same picture as its original, so its ink is not read again
  await ink(() => window.__ink.select('id7')); await wait(900);
  const art0 = await ink(() => window.__ink.inkReads().art);
  await ink(() => { document.querySelector('#editorAdvanced').open = true; document.querySelector('#bDup').click(); }); await wait(1500);
  const dupId = await ink(() => window.__ink.selected());
  assert.notEqual(dupId, 'id7', 'a copy was made');
  assert.equal(await ink(() => window.__ink.inkReads().art), art0, 'the copy shares its original\'s reading of the picture');
  assert.equal(await ink(() => document.querySelector('#gap').textContent), await brute(dupId), 'and its line reads right');
  await ink(() => document.querySelector('#undo').click()); await wait(900);
  // two tattoos touching
  await ink(() => { const I = window.__ink, s = structuredClone(I.state()); s.tattoos[1].pos = s.tattoos[2].pos.slice(); s.tattoos[1].normal = s.tattoos[2].normal.slice(); I.loadState(s); }); await wait(1500);
  await ink(() => window.__ink.select('id1')); await wait(900);
  assert.equal(await ink(() => document.querySelector('#gap').textContent), await brute('id1'), 'touching tattoos read the same too');
  assert.match(await ink(() => document.querySelector('#gap').textContent), /^Touches/, 'and they touch');
}
