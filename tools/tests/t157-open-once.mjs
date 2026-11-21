// A screen that takes a moment to open opens once (2026-11-21 QA). Two quick taps on Clean up opened two
// workspaces, one over the other; Projects,
// Body tools, Fit to a photo, Artwork library, Placement tools and Planning stacked the same way. Checks,
// at iPad landscape and portrait: two taps 90 ms apart open one screen, it closes with its own button,
// and a tap after that opens it again (the guard lets go once the screen is shut).
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const screens = [
    ['Clean up', 'bCleanup', '#ink-cleanup', true],
    ['Projects', 'openProjects', '.is-panel'],
    ['Body tools', 'openBodyTools', '#ink-body-tools'],
    ['Fit to a photo', 'openPhotoFit', '#ink-photo-fit'],
    ['Artwork library', 'openArtworkLibrary', '#ink-artwork-library'],
    ['Placement tools', 'openPlacement', '#ink-placement-tools'],
    ['Planning', 'openPlanning', '.ip-panel'],
  ];
  const count = (q) => p.evaluate((q) => [...document.querySelectorAll(q)].filter((e) => e.isConnected && !e.hidden && e.checkVisibility()).length, q);
  // its own close: Cancel in Clean up, else the Done or close button inside it
  const shut = (q) => p.evaluate((q) => {
    const host = [...document.querySelectorAll(q)].find((e) => e.checkVisibility()); if (!host) return 'none';
    const root = host.closest('[role=dialog],.ink-shelf,[aria-modal=true]')?.parentElement?.contains(host) ? host.closest('[role=dialog],[aria-modal=true]') || host : host;
    const b = root.querySelector('[data-action=cancel]') || [...root.querySelectorAll('button')].find((x) => /^(done|close|cancel)$/i.test((x.textContent || x.getAttribute('aria-label') || '').trim()) && x.checkVisibility()) || root.querySelector('[data-close]');
    if (!b) return 'no close button';
    b.click(); return 'ok';
  }, q);
  const bad = [];
  for (const [w, h] of [[1180, 820], [820, 1180]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true });
    await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
    for (const [name, id, q, needsSel] of screens) {
      const at = `${name} at ${w}x${h}`;
      if (needsSel) { await p.evaluate(() => window.__ink.select(window.__ink.state().tattoos[0].id)); await wait(400); }
      await p.evaluate((id) => { const b = document.getElementById(id); const d = b.closest('details'); if (d) d.open = true; b.click(); setTimeout(() => b.click(), 90); }, id);
      await wait(2200);
      const n = await count(q);
      if (n !== 1) { bad.push(`${at}: two quick taps opened ${n}`); }
      for (let i = 0; i < 3 && (await count(q)); i++) { const r = await shut(q); if (r !== 'ok') { bad.push(`${at}: ${r}`); break; } await wait(900); }
      if (await count(q)) { bad.push(`${at}: did not close`); continue; }
      if (needsSel) { await p.evaluate(() => window.__ink.select(window.__ink.state().tattoos[0].id)); await wait(400); }
      await p.evaluate((id) => { const b = document.getElementById(id); const d = b.closest('details'); if (d) d.open = true; b.click(); }, id);
      await wait(2000);
      if ((await count(q)) !== 1) bad.push(`${at}: a tap after closing did not open it again`);
      for (let i = 0; i < 3 && (await count(q)); i++) { await shut(q); await wait(900); }
    }
  }
  // and once more with a 60 ms double tap
  await p.evaluate(() => window.__ink.select(window.__ink.state().tattoos[0].id)); await wait(400);
  await p.evaluate(() => { const b = document.getElementById('bCleanup'); b.click(); setTimeout(() => b.click(), 60); }); await wait(2200);
  assert.deepEqual(bad, [], bad.join('\n'));
  assert.equal(await count('#ink-cleanup'), 1, 'one Clean up workspace');
  console.log('PASS t157 open once: Clean up, Projects, Body tools, Fit to a photo, Artwork library, Placement tools and Planning open once for two quick taps, close with their own button and open again, at both iPad orientations');
}
