// Merge in Layers' pick bar (2026-11-25 QA). With ink on my skin and planned pieces picked together, the
// Merge tile was filled as the main action, and a tap on it dropped every pick before the merge said no.
// Checks, at iPad landscape and portrait: Merge is plain while the picks can't be merged, a tap says why and
// keeps every pick, and two planned pieces make it the filled tile again; a merge refused for being too far apart
// keeps the picks too. (t156 checks the merge itself.)
import assert from 'node:assert/strict';
import base from '../big-project.mjs';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await base(p);
  for (const [w, h] of [[1180, 820], [820, 1180]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true }); await wait(900);
    const at = `${w}x${h}`;
    if (!(await p.$eval('#layersDock', (e) => e.classList.contains('open')))) { await p.click('#ldToggle'); await wait(600); }
    await p.click('#ldSelect'); await wait(500);
    // T0 is on my skin, T1 and T2 planned (big-project: every third one is on my skin)
    const pick = async (name) => { await p.evaluate((name) => { const r = [...document.querySelectorAll('#ldList .ld-tat')].find((e) => e.textContent.includes(name)); r.scrollIntoView({ block: 'center' }); }, name); await wait(200);
      await p.evaluate((name) => [...document.querySelectorAll('#ldList .ld-tat')].find((e) => e.querySelector('.ld-name, b, strong')?.textContent.trim() === name || e.textContent.trim().startsWith(name + '\n') || e.textContent.includes(name + 'On') || e.textContent.includes(name + 'Planned')).click(), name); await wait(400); };
    const merge = () => p.$eval('#ldPickBar', (b) => { const t = [...b.querySelectorAll('.ld-tiles button')].find((x) => x.textContent.trim() === 'Merge'); const r = t.getBoundingClientRect(); return { primary: t.classList.contains('primary'), disabled: t.disabled, w: r.width, h: r.height }; });
    const picked = () => p.$eval('#ldPickBar', (b) => b.querySelector('.ld-pbhead b').textContent.trim());
    await pick('T0'); await pick('T1');
    assert.equal(await picked(), '2 picked', `${at}: two picked`);
    let m = await merge();
    assert.equal(m.primary, false, `${at}: Merge is not the filled tile with on my skin and planned picked`);
    assert.ok(m.w >= 44 && m.h >= 44, `${at}: Merge is 44 pt`);
    const before = await p.evaluate(() => window.__ink.state().tattoos.length);
    await p.evaluate(() => [...document.querySelectorAll('#ldPickBar .ld-tiles button')].find((x) => x.textContent.trim() === 'Merge').click()); await wait(500);
    assert.match(await p.$eval('#toast', (e) => e.textContent.trim()), /one kind/, `${at}: the tap says why`);
    assert.equal(await picked(), '2 picked', `${at}: and both picks stay`);
    assert.equal(await p.evaluate(() => window.__ink.state().tattoos.length), before, `${at}: nothing merged`);
    // take T0 out, put T2 in: two planned pieces
    await pick('T0'); await pick('T2');
    assert.equal(await picked(), '2 picked', `${at}: two planned picked`);
    m = await merge();
    assert.equal(m.primary, true, `${at}: Merge is the filled tile for two planned pieces`);
    // T1 and T2 sit far apart on the body, so the merge itself says no: the picks still stay
    await p.evaluate(() => [...document.querySelectorAll('#ldPickBar .ld-tiles button')].find((x) => x.textContent.trim() === 'Merge').click()); await wait(2500);
    if (await p.evaluate((n) => window.__ink.state().tattoos.length === n, before)) {
      assert.match(await p.$eval('#toast', (e) => e.textContent.trim()), /Nothing was merged|not on this device|no ink/, `${at}: a refused merge says so`);
      assert.equal(await picked(), '2 picked', `${at}: and the picks stay after a refused merge`);
    } else { await p.click('#undo'); await p.waitForFunction((n) => window.__ink.state().tattoos.length === n, { timeout: 15000 }, before); await wait(800); }
    if (await p.$('#ldPickBar')) { const d = await p.$eval('#ldSelect', (e) => e.textContent.trim()); if (d === 'Done') { await p.click('#ldSelect'); await wait(400); } }
  }
}
