// Always show my ink healed (Preview > Aging): a tick makes Healed the everyday look, kept on
// this device after a reload, with no "Aging:" label on the button; another age still previews;
// files for Procreate get the ink as drawn, the same bytes as with the tick off.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ready = async () => { await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 60000 }); await wait(1200); };
  await ready();
  const hook = () => p.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    window.saved = {}; const old = URL.createObjectURL;
    URL.createObjectURL = function (blob) { if (blob.name) window.saved[blob.askedAs || blob.name] = blob.arrayBuffer(); return old.call(this, blob); };
  });
  const pictures = async () => { // the tattoo pictures inside the separate-tattoo model
    await p.evaluate(() => { delete window.saved['ink-atlas-model-layers.usdz']; });
    await p.click('#drawNew'); await wait(250); await p.click('#pm3dLayers');
    await p.waitForFunction(() => !!window.saved['ink-atlas-model-layers.usdz'], { timeout: 120000 });
    return p.evaluate(async () => {
      const b = new Uint8Array(await window.saved['ink-atlas-model-layers.usdz']), dv = new DataView(b.buffer), out = {}; let i = 0;
      while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) { const len = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), x = dv.getUint16(i + 28, true), name = new TextDecoder().decode(b.subarray(i + 30, i + 30 + n)), s = i + 30 + n + x; if (/\.png$/.test(name)) { let h = 0; for (let k = s; k < s + len; k += 7) h = (h * 31 + b[k]) >>> 0; out[name] = len + ':' + h; } i = s + len; }
      return out;
    });
  };
  await hook();
  const fresh = await pictures();
  await p.click('#lookBtn'); await wait(200); await p.click('#ageBtn'); await wait(300);
  const row = await p.$eval('#healedRow', (e) => { const r = e.getBoundingClientRect(); return { h: r.height, w: r.width, on: e.querySelector('input').checked }; });
  assert.ok(row.h >= 44 && row.w > 150 && !row.on, 'the tick is there, big enough, off: ' + JSON.stringify(row));
  await p.click('#healedLook'); await wait(600);
  assert.equal(await p.evaluate(() => window.__ink.aging()), 1, 'the ink shows healed');
  assert.equal(await p.evaluate(() => localStorage.getItem('ia-healed')), '1', 'kept on this device');
  assert.equal(await p.$eval('#ageBtn', (e) => e.textContent), 'Aging', 'healed is the everyday look, not a preview');
  await p.screenshot({ path: 'shots/t206-healed.png' });
  await p.click('#ageChoices [data-years="10"]'); await wait(400);
  assert.equal(await p.$eval('#ageBtn', (e) => e.textContent), 'Aging: 10 years', 'another age still previews');
  await p.click('#ageChoices [data-years="1"]'); await wait(400);
  await p.click('[data-close="agePop"]'); await wait(200);
  // files for Procreate: the ink as drawn
  const sent = await pictures();
  assert.deepEqual(Object.values(sent).sort(), Object.values(fresh).sort(), 'the separate-tattoo model is the same with the ink shown healed');
  assert.equal(await p.evaluate(() => window.__ink.aging()), 1, 'and the healed look comes back after');
  // after a reload it is still on
  await p.reload({ waitUntil: 'load' }); await ready();
  assert.equal(await p.evaluate(() => window.__ink.aging()), 1, 'still healed after a reload');
  await p.click('#lookBtn'); await wait(200); await p.click('#ageBtn'); await wait(300);
  assert.equal(await p.$eval('#healedLook', (e) => e.checked), true, 'the tick is kept');
  await p.click('#healedLook'); await wait(500);
  assert.equal(await p.evaluate(() => window.__ink.aging()), 0, 'off again: fresh');
  console.log('PASS t206 healed look');
}
