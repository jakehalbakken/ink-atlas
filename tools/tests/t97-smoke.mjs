// Smoke sweep: every Share picture and file, every Preview tool, and More controls on a selected
// tattoo, with no page error anywhere. Share and downloads are stubbed so nothing leaves the page.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  await p.evaluate(() => { navigator.share = async () => {}; navigator.canShare = () => true; HTMLAnchorElement.prototype.click = function () {}; window.print = () => {}; const st = window.__ink.state(); st.tattoos.forEach((t, i) => { t.status = i ? 'existing' : 'planned'; }); window.__ink.commitTest(); });
  await wait(400);
  const close = async () => { await p.keyboard.press('Escape'); await wait(150); await p.evaluate(() => { for (const id of ['#preview', '#share']) { const e = document.querySelector(id); if (e && !e.hidden) { const b = e.querySelector('[id$="Close"], .close, [data-close]'); if (b) b.click(); else e.hidden = true; } } }); await wait(150); };
  const cards = ['cView', 'cLabels', 'cCompare', 'cPoses', 'cSizes', 'cAging', 'cSheet', 'cPacket', 'cMessage', 'cApprove', 'cPrint', 'cSketch', 'cBlank', 'cPsd', 'cSwatches', 'cBackup'];
  const done = [];
  for (const id of cards) {
    const there = await p.evaluate((id) => { const b = document.getElementById(id); if (!b || b.hidden || getComputedStyle(b).display === 'none') return false; document.querySelector('#share').hidden = false; return true; }, id);
    if (!there) continue;
    const before = errors.length;
    await p.evaluate((id) => document.getElementById(id).click(), id); await wait(1500);
    if (errors.length > before) errors[errors.length - 1] += ` (after ${id})`;
    done.push(id); await close();
  }
  const tools = ['baBtn', 'poseBtn', 'clothesBtn', 'ageBtn', 'lightBtn', 'tapeBtn', 'painBtn', 'roomBtn'];
  for (const id of tools) {
    const before = errors.length;
    await p.evaluate(() => { const m = document.querySelector('#lookMenu'); if (m.hidden) document.querySelector('#lookBtn').click(); }); await wait(200);
    await p.evaluate((id) => document.getElementById(id).click(), id); await wait(900);
    if (errors.length > before) errors[errors.length - 1] += ` (after ${id})`;
    await close(); await p.evaluate((id) => { const b = document.getElementById(id); if (b && b.getAttribute('aria-pressed') === 'true') b.click(); }, id); await wait(200);
    for (const d of ['#roomDone', '#painDone', '#tapeDone']) await p.evaluate((d) => { const b = document.querySelector(d); if (b && b.offsetParent) b.click(); }, d);
    done.push(id);
  }
  // a selected tattoo with everything in More controls open
  await p.evaluate(() => window.__ink.select(window.__ink.state().tattoos[0].id)); await wait(800);
  await p.evaluate(() => { for (const d of document.querySelectorAll('#sheet details')) d.open = true; }); await wait(1500);
  await p.evaluate(() => window.__ink.select(window.__ink.state().tattoos.at(-1).id)); await wait(1500);
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS t97-smoke: ' + done.length + ' steps, no page errors: ' + done.join(' '));
}
