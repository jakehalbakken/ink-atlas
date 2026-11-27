// At the shop (Share > For your artist): every planned piece full screen, one at a time, with a close
// look on the body, the whole body from the same side, the artwork, size, where it sits, the note and
// its references; Next, a swipe and the arrow keys go through them; Real size and the stencil open
// for that piece on top and Done comes back; nothing in the project, view or selection changes.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const info = await p.evaluate(() => {
    const s = window.__ink.state(), planned = s.tattoos.filter((t) => t.status !== 'existing' && !t.hidden);
    planned[0].note = 'Fine lines please, no colour.';
    s.refs = [{ id: 'rf1', img: planned[0].img, tattooId: planned[0].id, note: 'like this' }];
    return { n: planned.length, first: planned[0].id };
  });
  assert.ok(info.n >= 2, 'the samples have two or more planned pieces: ' + info.n);
  const before = await p.evaluate(() => JSON.stringify([window.__ink.cam().map((v) => v.toFixed(4)), window.__ink.state().tattoos.map((t) => [t.id, t.pos, t.width])]));
  for (const [w, h, name] of [[1180, 820, 'land'], [820, 1180, 'port']]) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await wait(700);
    await p.click('#shareBtn'); await wait(400);
    await p.click('#cShop');
    await p.waitForFunction(() => window.__shop && window.__shop.pics, { timeout: 30000 }); await wait(500);
    const s = await p.evaluate(() => window.__shop);
    assert.equal(s.n, info.n, 'every planned piece');
    const look = await p.evaluate(() => {
      const box = (q) => { const e = document.querySelector(q), r = e.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y, r: r.right, b: r.bottom, nw: e.naturalWidth || 0 }; };
      const btns = [...document.querySelectorAll('#shop button')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('#spRefs') && e.id !== 'spBig');
      return { near: box('#spNear'), whole: box('#spWhole'), art: box('#spArtImg'), small: btns.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.id), out: btns.filter((e) => { const r = e.getBoundingClientRect(); return r.x < 0 || r.right > innerWidth || r.bottom > innerHeight; }).map((e) => e.id), name: document.querySelector('#spName').textContent, size: document.querySelector('#spSize').textContent, count: document.querySelector('#spCount').textContent, nav: !document.querySelector('#spNav').hidden };
    });
    console.log(name, JSON.stringify(look));
    assert.ok(look.near.nw > 300 && look.whole.nw > 200 && look.near.w > 150, 'both pictures made and shown');
    assert.ok(look.art.nw > 0, 'the artwork shows');
    assert.ok(/ in .* cm/.test(look.size), 'size in inches and cm');
    assert.deepEqual(look.small, [], '44 pt buttons at ' + name);
    assert.deepEqual(look.out, [], 'every button on screen at ' + name);
    assert.ok(look.nav && /1 of|2 of|of /.test(look.count), 'Previous and Next with a count');
    await p.screenshot({ path: `shots/t207-${name}.png` });
    // Next, then a swipe back, then the arrow key
    const i0 = s.i;
    if (i0 < s.n - 1) { await p.click('#spNext'); await p.waitForFunction((i) => window.__shop && window.__shop.i === i + 1 && window.__shop.pics, {}, i0); }
    const i1 = await p.evaluate(() => window.__shop.i);
    const c = await p.$eval('#spCard', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x + 90, c.y + 6, { steps: 4 }); await p.mouse.move(c.x + 180, c.y + 8, { steps: 4 }); await p.mouse.up();
    await p.waitForFunction((i) => window.__shop && window.__shop.i === i - 1, {}, i1);
    await p.keyboard.press('ArrowRight');
    await p.waitForFunction((i) => window.__shop && window.__shop.i === i, {}, i1);
    // the first piece: its note and reference
    while (await p.evaluate(() => window.__shop.i) > 0) { await p.click('#spPrev'); await wait(150); }
    await p.waitForFunction((id) => window.__shop && window.__shop.id === id && window.__shop.pics && window.__shop.refs === 1, { timeout: 20000 }, info.first);
    assert.match(await p.$eval('#spNote', (e) => e.textContent), /Fine lines please/);
    await p.click('#spRefs button'); await wait(200);
    assert.equal(await p.$eval('#spBig', (e) => e.hidden), false, 'a reference opens big');
    await p.keyboard.press('Escape'); await wait(150);
    assert.equal(await p.$eval('#spBig', (e) => e.hidden), true, 'Escape closes the big picture first');
    assert.equal(await p.$eval('#shop', (e) => e.hidden), false, 'and leaves the screen open');
    // Real size and Stencil open for that piece on top, Done comes back
    await p.click('#spReal'); await wait(400);
    assert.equal(await p.$eval('#realSize', (e) => e.hidden), false, 'Real size on screen opens');
    { const nm = await p.$eval('#spName', (e) => e.textContent); assert.ok((await p.$eval('#rsText', (e) => e.textContent)).startsWith(nm + ':'), 'for this piece'); }
    await p.click('#rsClose'); await wait(200);
    await p.click('#spStencil'); await p.waitForFunction(() => window.__lastStencil && !document.querySelector('#stPrint').disabled, { timeout: 30000 });
    await p.click('#stClose'); await wait(200);
    assert.equal(await p.$eval('#shop', (e) => e.hidden), false, 'back at the shop');
    await p.keyboard.press('Escape'); await wait(300);
    assert.equal(await p.$eval('#shop', (e) => e.hidden), true, 'Escape closes it');
  }
  await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(700);
  const after = await p.evaluate(() => JSON.stringify([window.__ink.cam().map((v) => v.toFixed(4)), window.__ink.state().tattoos.map((t) => [t.id, t.pos, t.width])]));
  assert.equal(after, before, 'view and tattoos unchanged');
  console.log('PASS t207 at the shop');
}
