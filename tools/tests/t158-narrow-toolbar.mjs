// On a narrow iPad (an iPad mini upright, 744 wide, or the app beside another) a preview that is on
// used to widen the Preview button ("Preview: Before / after") until Share and the account button
// went off the right edge, and a jump to one of them slid the whole app 60 px sideways and left it
// there (2026-11-21). Now the button says just Preview there (its spoken name still says what is on),
// every toolbar button stays on screen, and the app never slides.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const look = () => p.evaluate(() => {
    const btns = [...document.querySelectorAll('#top .toolbar button')].filter((e) => e.getBoundingClientRect().width > 0);
    const out = btns.filter((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).map((e) => e.id || e.textContent.trim());
    const v = document.getElementById('viewport');
    return { out, text: document.querySelector('#lookBtn').textContent, label: document.querySelector('#lookBtn').getAttribute('aria-label'), shift: [v.scrollLeft, v.scrollTop, document.scrollingElement.scrollLeft], tb: Math.round(document.querySelector('#top .toolbar').getBoundingClientRect().right), w: innerWidth };
  });
  const turn = async (on) => { await p.click('#lookBtn'); await wait(400); const pressed = await p.$eval('#baBtn', (b) => b.getAttribute('aria-pressed') === 'true'); if (pressed !== on) await p.click('#baBtn'); else await p.click('#lookBtn'); await wait(700); };
  const res = [];
  for (const [w, h, name] of [[744, 1133, 'mini'], [820, 1180, 'port'], [1024, 768, 'small'], [1180, 820, 'land'], [678, 1024, 'half'], [640, 900, 'narrow']]) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true }); await wait(800);
    const plain = await look();
    assert.deepEqual(plain.out, [], `every toolbar button on screen at ${name}: ${JSON.stringify(plain)}`);
    const small = await p.evaluate(() => [...document.querySelectorAll('#top .toolbar button')].filter((e) => e.offsetWidth && (e.offsetWidth < 44 || e.offsetHeight < 44)).map((e) => e.id));
    assert.deepEqual(small, [], `44 pt toolbar buttons at ${name}`);
    assert.ok(await p.$eval('#top .brand', (e) => e.getBoundingClientRect().width > 0), `Ink Atlas stays at ${name}`);
    await turn(true);
    const r = await look();
    assert.deepEqual(r.out, [], `every toolbar button on screen with Before/after on at ${name}: ${JSON.stringify(r)}`);
    assert.ok(r.text === 'Preview: Before / after' || r.text === 'Preview', `button says Preview at ${name}: ${r.text}`);
    if (r.text === 'Preview') assert.equal(r.label, 'Preview: Before / after', `its spoken name says what is on at ${name}`);
    assert.ok(await p.$eval('#lookBtn', (b) => b.classList.contains('active')), `filled in while on at ${name}`);
    // reach Share and the account area the way a jump to them would, and the app stays put
    await p.click('#shareBtn'); await wait(600);
    assert.equal(await p.$eval('#share', (e) => !e.hidden && e.getBoundingClientRect().width > 0), true, `Share opens at ${name}`);
    const after = await look();
    assert.deepEqual(after.shift, [0, 0, 0], `the app never slides sideways at ${name}`);
    await p.evaluate(() => document.querySelector('[data-close="share"]').click()); await wait(400);
    // a forced slide is put straight back
    await p.evaluate(() => { document.getElementById('viewport').scrollLeft = 80; }); await wait(150);
    assert.equal((await look()).shift[0], 0, `a slide is put back at ${name}`);
    res.push(`${name} "${r.text}"${await p.evaluate(() => document.body.classList.contains('tb-icons') ? ' icons' : document.body.classList.contains('tb-short') ? ' short' : '')}`);
    await turn(false);
    assert.equal(await p.$eval('#lookBtn', (b) => b.textContent), 'Preview', `plain again at ${name}`);
    assert.equal(await p.$eval('#lookBtn', (b) => b.getAttribute('aria-label')), null, `no extra spoken name when nothing is on at ${name}`);
  }
  // wide enough, the button still says what is on
  console.log(res.join(' | '));
  assert.ok(res.find((s) => s.startsWith('land')).includes('Before / after'), 'iPad landscape keeps the full words');
  console.log(JSON.stringify(res));
  console.log('PASS t158 narrow toolbar: ' + res.join(', '));
}
