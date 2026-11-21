// No hover look that sticks after a tap (2026-11-21 QA): on an iPad a tapped control keeps :hover until
// the next tap somewhere else, so a segment (Hard or Soft, Replaces or Adds), a Preview row or a Share
// card kept a highlight after the finger lifted and looked picked when another one was. Every :hover
// rule now sits inside @media (hover:hover), which a touch screen does not match. Checks every style
// rule on the page, with Blend and colour, Clean up, Share, Preview and the measured wrap opened so
// their own styles are in, at iPad size with touch, and that a touch screen does not match hover:hover.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, isMobile: true });
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
  const loose = () => p.evaluate(() => {
    const out = [];
    const walk = (rules, guarded) => { for (const r of rules) {
      if (r instanceof CSSMediaRule) walk(r.cssRules, guarded || /hover\s*:\s*hover/.test(r.conditionText || r.media.mediaText));
      else if (r.cssRules && r.cssRules.length && !(r instanceof CSSStyleRule)) walk(r.cssRules, guarded);
      else if (r instanceof CSSStyleRule) { if (/:hover/.test(r.selectorText) && !guarded) out.push(r.selectorText); if (r.cssRules && r.cssRules.length) walk(r.cssRules, guarded); }
    } };
    for (const s of document.styleSheets) { try { walk(s.cssRules, false); } catch (e) { /* another origin */ } }
    return out;
  });
  const bad = new Set(await loose());
  await p.evaluate(() => window.__ink.select(window.__ink.state().tattoos[0].id)); await wait(500);
  await p.evaluate(() => document.getElementById('bLook').click()); await wait(700);
  for (const x of await loose()) bad.add(x);
  await p.evaluate(() => document.getElementById('lkDone').click()); await wait(300);
  await p.evaluate(() => document.getElementById('bCleanup')?.click()); await wait(1500);
  for (const x of await loose()) bad.add(x);
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(800);
  for (const b of ['#shareBtn', '#lookBtn']) { await p.evaluate((b) => document.querySelector(b).click(), b); await wait(600); for (const x of await loose()) bad.add(x); await p.keyboard.press('Escape'); await wait(300); }
  await p.evaluate(() => { document.getElementById('projectsBtn').click(); }); await wait(400);
  await p.evaluate(() => document.getElementById('openWrap')?.click()); await wait(800);
  for (const x of await loose()) bad.add(x);
  assert.deepEqual([...bad], [], 'hover looks a tap would leave behind: ' + [...bad].join(', '));
  assert.equal(await p.evaluate(() => matchMedia('(hover: hover)').matches), false, 'a touch screen does not match hover:hover');
  console.log('PASS t156 no sticky hover: every :hover look is for a mouse or trackpad only, across the main page, Blend and colour, Clean up, Share, Preview and the measured wrap');
}
