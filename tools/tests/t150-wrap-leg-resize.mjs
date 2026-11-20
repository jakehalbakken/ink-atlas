// The measured wrap's picture on the 3D leg (2026-11-20 QA): when a tape number changed the size of the
// flat template, the leg kept a texture of the old size and every redraw after it failed in WebGL
// ("Offset overflows texture dimensions"), so the leg could go on showing the old picture. Now a resize
// makes a texture of the new size. Types numbers that grow and shrink the template and checks that no
// upload fails.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  const gl = [];
  p.on('console', (m) => { if (/GL_INVALID|overflows texture/i.test(m.text())) gl.push(m.text()); });
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  await p.evaluate(() => window.__ink.wrap().open()); await wait(400);
  await p.evaluate(() => document.getElementById('wsStart').click()); await wait(500);
  const type = (id, v) => p.evaluate((id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change')); }, id, v);
  await type('wqBottom', '9'); await wait(300); await type('wqTop', '12.5'); await wait(300); await type('wqLen', '4'); await wait(1500);
  const sizes = [];
  for (const [top, len] of [['16', '7'], ['10', '2.5'], ['14', '5']]) {
    const before = gl.length;
    await type('wqTop', top); await wait(400); await type('wqLen', len); await wait(1800);
    sizes.push(await p.evaluate(() => { const r = window.__ink.wrap().api.reg(); return r.levels.map((l) => Math.round(l.circ)).join('/'); }));
    assert.equal(gl.length, before, `top ${top} in, ${len} in long: the leg's picture upload failed: ${gl.slice(before).join(' | ')}`);
  }
  assert.equal(new Set(sizes).size, 3, 'three different templates: ' + sizes.join(', '));
  assert.deepEqual(gl, [], gl.join('\n'));
  console.log('PASS t150 wrap leg resize: the leg picture redraws cleanly as the template grows and shrinks (' + sizes.join(', ') + ' mm round)');
}
