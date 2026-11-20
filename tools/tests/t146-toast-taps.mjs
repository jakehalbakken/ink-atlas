// A message never takes a tap meant for what is under it (2026-11-20 QA: after one Share file was saved,
// "Saved ... to your downloads" sat over the last Share card and ate the next tap). Only the message's
// own button takes taps.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  await p.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); window.saved = []; const old = URL.createObjectURL; URL.createObjectURL = function (b) { window.saved.push(b.name || ''); return old.call(this, b); }; });
  await p.click('#shareBtn'); await wait();
  await p.evaluate(() => { document.querySelector('#shMore').open = true; });
  // a real save shows its message at the bottom while Share is open
  await p.click('#cUsdz');
  await p.waitForFunction(() => window.saved.includes('ink-atlas-model.usdz'), { timeout: 120000 });
  await p.waitForFunction(() => !document.querySelector('#toast').hidden && /Saved/.test(document.querySelector('#toast').textContent), { timeout: 10000 });
  // Share closes once the file is handed off; open it again while the message still shows: the message drops to the bottom
  if (await p.evaluate(() => !document.querySelector('#cObjBaked').offsetParent)) await p.click('#shareBtn');
  await wait(); await p.evaluate(() => { document.querySelector('#shMore').open = true; });
  // the last card under it still takes the tap
  const hit = await p.evaluate(() => {
    const t = document.querySelector('#toast').getBoundingClientRect();
    const c = document.querySelector('#cObjBaked'); c.scrollIntoView({ block: 'end' });
    const r = c.getBoundingClientRect(); if (!(r.bottom > t.top && r.top < t.bottom)) return { miss: [r.top, r.bottom, t.top, t.bottom] };
    const x = Math.max(r.left + 2, Math.min(r.right - 2, t.left + t.width / 2)), y = (Math.max(r.top, t.top) + Math.min(r.bottom, t.bottom)) / 2;
    const e = document.elementFromPoint(x, y); return { card: c.id, under: e && e.closest('button') && e.closest('button').id };
    return null;
  });
  assert.ok(hit && !hit.miss, 'the last Share card sits under the message: ' + JSON.stringify(hit));
  assert.equal(hit.under, hit.card, 'a tap there reaches the card, not the message');
  await p.click('#cObjBaked');
  await p.waitForFunction(() => window.saved.includes('ink-atlas-model-obj.zip'), { timeout: 120000 });
  // a message's own button still takes its tap
  const btn = await p.evaluate(() => { const t = document.querySelector('#toast'); t.hidden = false; const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Act'; b.id = 'zzAct'; b.onclick = () => { window.acted = true; }; t.append(b); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return [e && e.id, r.width >= 44 && r.height >= 44]; });
  assert.equal(btn[0], 'zzAct', 'the message button is on top'); assert.ok(btn[1], 'and 44 pt');
  await p.click('#zzAct'); assert.equal(await p.evaluate(() => window.acted), true, 'and takes the tap');
  console.log('PASS t146 toast taps: a message lets taps through to the Share card under it, its own button still works');
}
