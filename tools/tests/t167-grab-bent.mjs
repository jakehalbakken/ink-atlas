// t167 a bent tattoo is grabbed only where it is. A touch inside the flat file's square counted as on the
// tattoo, so with a piece bent to half its width, a finger on the bare skin beside it moved the tattoo
// instead of turning the view. Now only the box the bent piece fills (and the ink itself) takes hold.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  const n0 = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 300, 300);
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'block.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, n0);
  const id = (await st()).tattoos.at(-1).id;
  await p.evaluate((i) => { const ink = window.__ink, s = ink.state(), a = ink.surfaceAt([0, 1.25, 2], [0, 0, -1]); for (const t of s.tattoos) t.hidden = t.id !== i; const t = s.tattoos.find((q) => q.id === i); Object.assign(t, a, { status: 'planned', name: 'Block', width: 0.08, aspect: 1, rot: 0, locked: false }); ink.select(i); ink.commitTest(); }, id);
  await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id);
  const t0 = (await st()).tattoos.find((q) => q.id === id);
  await p.evaluate((t) => window.__ink.aim(t.pos, 0.4, Math.atan2(t.normal[0], t.normal[2]), Math.acos(t.normal[1])), t0);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }).catch(() => {}); await wait(1500);
  // the ink's box on screen, in page points
  const box = () => p.evaluate((i) => { const b = window.__ink.inkBox(i), c = document.querySelector('#stage canvas'), r = c.getBoundingClientRect(), kx = r.width / c.width, ky = r.height / c.height; return b && [r.left + b[0] * kx, r.top + b[1] * ky, r.left + b[2] * kx, r.top + b[3] * ky]; }, id);
  const grabs = (x, y) => p.evaluate((x, y) => window.__ink.grabsAt(x, y, 10), x, y);
  const flat = await box(), fy = (flat[1] + flat[3]) / 2, at = (b, f) => b[0] + (b[2] - b[0]) * f;
  assert(flat[2] - flat[0] > 120, 'close enough to see it: ' + flat);
  assert(await grabs(at(flat, 0.15), fy) && await grabs(at(flat, 0.85), fy), 'the flat piece is grabbed across its width');
  for (const flip of [false, true]) {
    await p.evaluate((i, fl) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.flip = fl; t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, id, flip);
    await p.waitForFunction((w) => { const b = window.__ink.inkBox(window.__ink.state().tattoos.at(-1).id); return b && b[2] - b[0] < w; }, { timeout: 20000 }, 0.7 * (await p.evaluate((i) => { const b = window.__ink.inkBox(i); return b[2] - b[0]; }, id))).catch(() => {});
    await wait(500);
    const bent = await box(), left = (bent[0] + bent[2]) / 2 < (flat[0] + flat[2]) / 2;
    assert(bent[2] - bent[0] < (flat[2] - flat[0]) * 0.7, 'the bend shows: ' + bent + ' vs ' + flat);
    const on = (bent[0] + bent[2]) / 2, off = left ? at(flat, 0.88) : at(flat, 0.12);
    assert(await grabs(on, fy), `bent${flip ? ' and mirrored' : ''}: still grabbed on its ink`);
    assert(!(await grabs(off, fy)), `bent${flip ? ' and mirrored' : ''}: bare skin where the flat square was turns the view ${off} ${bent}`);
  }
  assert(await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]').includes('grabBent')), 'ticked in New to try');
  console.log('PASS t167 a bent tattoo is grabbed only where it sits, plain and mirrored');
}
