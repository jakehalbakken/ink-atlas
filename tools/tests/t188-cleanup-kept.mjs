// t188 Clean up keeps its work if the page closes (2026-11-25, Jake: "the whole entire web page will like suddenly
// reload or crash ... in the cleanup mode ... sometimes it saves progress and sometimes it doesn't"):
// a new version never reloads the page or offers Reload while Clean up is open, not even when the app leaves the
// screen; the work is kept on the device as it goes; after the page is closed and opened again, Open it brings
// Clean up back with every edit; Done puts it on the tattoo and throws the kept copy away; Cancel does too.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  const kept = () => p.evaluate(() => new Promise((res) => { const r = indexedDB.open('ink-atlas-cleanup-draft', 1); r.onupgradeneeded = () => r.result.createObjectStore('draft'); r.onsuccess = () => { const q = r.result.transaction('draft').objectStore('draft').get('current'); q.onsuccess = () => { const d = q.result; res(d ? { tattooId: d.tattooId, img: d.img, fw: d.fw, fh: d.fh, rect: d.rect, steps: d.steps } : null); r.result.close(); }; q.onerror = () => res(null); }; r.onerror = () => res(null); }));
  const before = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(60, 50, 100, 100); g.fillRect(240, 50, 100, 100);
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'two squares.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, before);
  const t0 = (await st()).tattoos.at(-1);
  await p.evaluate(() => window.__ink.flushSave ? window.__ink.flushSave() : 0); await wait(800);
  const helpers = () => p.evaluate(() => {
    const stage = document.querySelector('#ink-cleanup .ic-work'); stage.setPointerCapture = () => {}; stage.releasePointerCapture = () => {}; stage.hasPointerCapture = () => false;
    window.__pic = (x, y) => { const c = document.querySelector('#ink-cleanup canvas'), r = c.getBoundingClientRect(); return [r.x + x * r.width / c.width, r.y + y * r.height / c.height]; };
    window.__fire = (type, id, [x, y]) => stage.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, clientX: x, clientY: y, isPrimary: id === 1 }));
  });
  const tap = (x, y) => p.evaluate((x, y) => { const q = window.__pic(x, y); window.__fire('pointerdown', 1, q); window.__fire('pointerup', 1, q); }, x, y);
  const alpha = (x, y) => p.$eval('#ink-cleanup canvas', (c, x, y) => c.getContext('2d').getImageData(x, y, 1, 1).data[3], x, y);
  const hide = (on) => p.evaluate((on) => { if (on) Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); else delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); }, on);

  // 1. open Clean up and take the right square away
  await p.evaluate(() => document.querySelector('#bCleanup').click());
  await p.waitForSelector('#ink-cleanup canvas'); await wait(); await helpers();
  await p.click('[data-mode=select]'); await tap(290, 100); await wait(100);
  await p.evaluate(() => document.querySelector('#ink-cleanup [data-action=seldelete]').click()); await wait(100);
  assert.equal(await alpha(290, 100), 0, 'the right square is gone'); assert.equal(await alpha(110, 100), 255, 'the left one stays');
  // kept on the device a moment later
  await p.waitForFunction(() => new Promise((res) => { const r = indexedDB.open('ink-atlas-cleanup-draft', 1); r.onupgradeneeded = () => r.result.createObjectStore('draft'); r.onsuccess = () => { const q = r.result.transaction('draft').objectStore('draft').get('current'); q.onsuccess = () => { res(!!q.result); r.result.close(); }; }; }), { timeout: 8000, polling: 500 });
  const d = await kept(); assert.equal(d.tattooId, t0.id); assert.equal(d.img, t0.img, 'kept for this tattoo and this picture');

  // 2. a new version arrives while Clean up is open: no Reload offer, and leaving the screen does not reload it
  await p.evaluate(() => { window.__marker = 'still here'; window.__ink.updateReady(); }); await wait(600);
  assert.ok(!(await p.$eval('#toast', (t) => !t.hidden && /new version/i.test(t.textContent))), 'no Reload offer over Clean up');
  await hide(true); await wait(1500); await hide(false); await wait(300);
  assert.equal(await p.evaluate(() => window.__marker), 'still here', 'leaving the screen in Clean up does not reload the page');
  assert.ok(await p.$('#ink-cleanup canvas'), 'Clean up is still open with its work');
  assert.equal(await alpha(290, 100), 0);

  // 3. the iPad closes the page anyway: everything comes back
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink?.ready(), { timeout: 20000 });
  await p.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && /closed part way/.test(t.textContent); }, { timeout: 70000, polling: 300 });
  assert.match(await p.$eval('#toast', (t) => t.textContent), /two squares|this tattoo/i, 'the note names the tattoo');
  await p.evaluate(() => [...document.querySelectorAll('#toast button')].find((b) => b.textContent === 'Open it').click());
  await p.waitForSelector('#ink-cleanup canvas'); await wait(500); await helpers();
  assert.equal(await alpha(290, 100), 0, 'the edit came back'); assert.equal(await alpha(110, 100), 255);
  assert.match(await p.$eval('#ink-cleanup .ic-status', (s) => s.textContent), /edits from before are back/);
  // Cancel asks first: the kept work counts as changes
  await p.evaluate(() => document.querySelector('#ink-cleanup [data-action=cancel]').click()); await wait(100);
  assert.equal(await p.$eval('#ink-cleanup .ic-confirm', (c) => c.hidden), false, 'Cancel asks before throwing kept work away');
  await p.evaluate(() => document.querySelector('#ink-cleanup [data-action=keep]').click()); await wait(100);

  // 4. Done puts it on the tattoo and the kept copy goes
  await p.evaluate(() => document.querySelector('#ink-cleanup [data-action=apply]').click());
  await p.waitForFunction(() => !document.querySelector('#ink-cleanup'), { timeout: 8000 });
  await p.waitForFunction((id, img) => { const t = window.__ink.state().tattoos.find((q) => q.id === id); return t && t.img !== img; }, { timeout: 8000 }, t0.id, t0.img);
  await wait(1500); assert.equal(await kept(), null, 'the kept copy is thrown away once the result is saved');
  const t1 = (await st()).tattoos.find((q) => q.id === t0.id);
  assert.ok(t1.width < t0.width * 0.7, 'the tattoo is trimmed to the one square left');

  // 5. Cancel and Throw away also throw the kept copy away
  await p.evaluate(() => document.querySelector('#bCleanup').click());
  await p.waitForSelector('#ink-cleanup canvas'); await wait(); await helpers();
  await p.click('[data-mode=erase]'); await p.evaluate(() => { const a = window.__pic(20, 20), b = window.__pic(120, 120); window.__fire('pointerdown', 1, a); for (let i = 1; i <= 8; i++) window.__fire('pointermove', 1, [a[0] + (b[0] - a[0]) * i / 8, a[1] + (b[1] - a[1]) * i / 8]); window.__fire('pointerup', 1, b); });
  await p.waitForFunction(() => new Promise((res) => { const r = indexedDB.open('ink-atlas-cleanup-draft', 1); r.onsuccess = () => { const q = r.result.transaction('draft').objectStore('draft').get('current'); q.onsuccess = () => { res(!!q.result); r.result.close(); }; }; }), { timeout: 8000, polling: 500 });
  await p.evaluate(() => document.querySelector('#ink-cleanup [data-action=cancel]').click()); await wait(100);
  await p.evaluate(() => document.querySelector('#ink-cleanup [data-action=discard]').click());
  await p.waitForFunction(() => !document.querySelector('#ink-cleanup'), { timeout: 5000 }); await wait(500);
  assert.equal(await kept(), null, 'Throw away leaves nothing kept');
  // 6. the Reload offer comes once Clean up is closed (the update from step 3 was applied by the reload, so ask again)
  await p.evaluate(() => { window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' })); window.__ink.updateReady(); }); await wait(500);
  assert.ok(await p.$eval('#toast', (t) => !t.hidden && /new version/i.test(t.textContent)), 'Reload offered once nothing is open');
  console.log('PASS t188 Clean up kept: no update reload or offer while open, kept on the device, back after the page closes, Done and Throw away clear it');
}
