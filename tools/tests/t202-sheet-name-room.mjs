// The tattoo's name at the top of the edit sheet (QA batch 34). On an iPad the box was 122 px and
// a name like "Sunburst (sample)" was cut off mid-letter. The bin beside it is now as wide as the
// fold arrow (44 pt, was 50), so the name has more room, and a name still too long ends in … until
// the box is tapped to type. The row stays one line at every iPad size, every button 44 pt, and a
// rename still works as one undo step.
import assert from 'node:assert/strict';

export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
  await (await p.$$('#ldList .ld-tat'))[0].click(); await wait(500);
  const look = () => p.evaluate(() => {
    const n = document.querySelector('#name'), box = (id) => document.getElementById(id).getBoundingClientRect();
    const parts = ['name', 'bDelTop', 'bSheetMin', 'bDone'].map((id) => { const r = box(id); return { id, w: r.width, h: r.height, mid: r.top + r.height / 2, right: r.right }; });
    return { parts, sheet: box('sheet').right, ellipsis: getComputedStyle(n).textOverflow };
  });
  for (const [w, h] of [[1180, 820], [820, 1180], [1133, 744], [744, 1133], [1366, 1024], [1024, 1366]]) {
    await p.setViewport({ width: w, height: h, hasTouch: true, deviceScaleFactor: 1 }); await wait(500);
    const o = await look(), [name, bin, fold, done] = o.parts;
    assert.ok(name.w >= 126, `${w}x${h}: the name box has room (${Math.round(name.w)} px)`);
    assert.equal(Math.round(bin.w), 44, `${w}x${h}: the bin is 44 pt wide, like the fold arrow`);
    for (const x of o.parts) assert.ok(x.h >= 44 && x.w >= 44, `${w}x${h}: ${x.id} is 44 pt`);
    assert.ok(o.parts.every((x) => Math.abs(x.mid - name.mid) < 2), `${w}x${h}: name, bin, fold and Done share one line`);
    assert.ok(done.right <= o.sheet + 1, `${w}x${h}: Done stays inside the sheet`);
    assert.equal(o.ellipsis, 'ellipsis', `${w}x${h}: a long name ends in …`);
  }
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, deviceScaleFactor: 1 }); await wait(400);
  // tapped to type, the whole name shows as it scrolls; a rename is one undo step
  await p.focus('#name'); await wait(150);
  assert.equal(await p.$eval('#name', (n) => getComputedStyle(n).textOverflow), 'clip', 'typing shows the name as it is');
  const id = await p.evaluate(() => window.__ink.state().tattoos[0].id), was = await p.evaluate(() => window.__ink.state().tattoos[0].name);
  await p.$eval('#name', (n) => { n.select(); }); await p.keyboard.type('Rose');
  await p.$eval('#name', (n) => n.blur()); await wait(400);
  const named = await p.evaluate((i) => window.__ink.state().tattoos.find((t) => t.id === i).name, id);
  assert.equal(named, 'Rose', 'the rename lands');
  await p.evaluate(() => document.getElementById('undo').click()); await wait(400);
  assert.equal(await p.evaluate((i) => window.__ink.state().tattoos.find((t) => t.id === i).name, id), was, 'one undo puts the old name back');
  console.log('PASS t202 the tattoo name has room in the edit sheet at every iPad size');
}
