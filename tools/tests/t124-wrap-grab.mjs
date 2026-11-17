// Placing a wrap: a piece that goes round an arm or leg takes hold wherever it is touched (front,
// side, round the back), a drag turns it round the limb and slides it along with the skin under the
// finger staying under the finger, every drag is one undo step, it stays selected, a drag right
// round carries it across the back and it can still be grabbed after, Wrap it round lays a long
// piece round the limb with its ends meeting, and a mouse drags it too.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(800);
  const drag = (id, x, y, dx, dy, kind = 'touch', n = 8) => p.evaluate(({ id, x, y, dx, dy, kind, n }) => {
    const I = window.__ink, t = () => I.state().tattoos.find((q) => q.id === id), cv = document.querySelector('#stage canvas');
    const before = t().pos.slice(), u0 = I.undoLen();
    const ev = (k, X, Y) => cv.dispatchEvent(new PointerEvent(k, { pointerId: 7, pointerType: kind, clientX: X, clientY: Y, bubbles: true, button: 0, buttons: k === 'pointerup' ? 0 : 1 }));
    ev('pointerdown', x, y); const mode = I.gestMode(); for (let i = 1; i <= n; i++) ev('pointermove', x + dx * i / n, y + dy * i / n); ev('pointerup', x + dx, y + dy);
    return { mode, moved: Math.hypot(...t().pos.map((v, i) => v - before[i])), steps: I.undoLen() - u0, u0, sel: I.selected() };
  }, { id, x, y, dx, dy, kind, n });
  const inkPoints = (id, step = 12) => p.evaluate(({ id, step }) => { const I = window.__ink, b = document.querySelector('#stage canvas').getBoundingClientRect(), o = []; for (let y = b.top + 10; y < b.bottom; y += step) for (let x = b.left + 10; x < b.right - 400; x += step) if (I.inkIdsAt(x, y)[0] === id) o.push([x, y]); return o; }, { id, step });
  // a solid band with darker stripes, put on each limb at a few widths
  const spots = {
    ankle: [[0.193, 0.14, 2], [0, 0, -1], { theta: 1.0, phi: 1.45, r: 0.6, tx: 0.19, ty: 0.15, tz: 0 }],
    calf: [[0.15, 0.4, 2], [0, 0, -1], { theta: 0.6, phi: 1.5, r: 0.8, tx: 0.15, ty: 0.4, tz: 0 }],
    upperarm: [[0.27, 1.3, 2], [0, 0, -1], { theta: 0.5, phi: 1.5, r: 0.7, tx: 0.27, ty: 1.3, tz: 0 }],
    forearm: [[2, 1.095, 0.175], [-1, 0, 0], { theta: 1.4, phi: 1.4, r: 0.6, tx: 0.45, ty: 1.1, tz: 0.12 }],
  };
  for (const [name, [o, d, cam]] of Object.entries(spots)) {
    const id = await p.evaluate(async ({ o, d }) => {
      const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({});
      const c = document.createElement('canvas'); c.width = 800; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#556'; g.fillRect(0, 30, 800, 140); g.fillStyle = '#111'; for (let x = 0; x < 800; x += 60) g.fillRect(x, 40, 30, 120);
      const h = I.surfaceAt(o, d); if (!h) return null;
      const t = await I.addArt(c.toDataURL('image/png'), 'band', { pos: h.pos, normal: h.normal, width: 0.1 });
      I.commitTest(); I.select(t.id); return t.id;
    }, { o, d });
    assert.ok(id, `${name}: placed`);
    // Wrap it round shows under the name for a long piece on a limb, and fits it round
    await wait(200);
    const row = await p.evaluate(() => ({ row: !document.querySelector('#wrapRow').hidden, fit: !document.querySelector('#wrapFit').hidden, text: document.querySelector('#wrapText').textContent }));
    assert.ok(row.row && row.fit, `${name}: Wrap it round offered ${JSON.stringify(row)}`);
    const u0 = await p.evaluate(() => window.__ink.undoLen());
    await p.$eval('#wrapFit', (e) => e.click()); await wait(300);
    const info = await p.evaluate((id) => ({ share: window.__ink.wrapShare(id), girth: window.__ink.girthHere(id), steps: window.__ink.undoLen(), t: window.__ink.state().tattoos.find((q) => q.id === id) }), id);
    if (u0 < 39) assert.equal(info.steps - u0, 1, `${name}: Wrap it round is one undo step`);
    assert.ok(Math.abs(info.t.width - info.girth) / info.girth < 0.02, `${name}: width is the way round (${info.t.width} vs ${info.girth})`);
    assert.ok(info.share && info.share.share > 0.8, `${name}: goes round ${JSON.stringify(info.share)}`);
    const row2 = await p.evaluate(() => ({ fit: !document.querySelector('#wrapFit').hidden, text: document.querySelector('#wrapText').textContent }));
    assert.ok(!row2.fit && /all the way round/.test(row2.text), `${name}: says it goes all the way round ${JSON.stringify(row2)}`);
    await p.evaluate((g) => { Object.assign(window.__ink.goal, g); Object.assign(window.__ink.cur, g); }, cam); await wait(900);
    // every visible bit of ink takes hold, with and without a finger's slop (wait for the view and the ink to settle)
    const innerOf = (pts) => p.evaluate(({ id, pts }) => { const I = window.__ink, on = (x, y) => I.inkIdsAt(x, y)[0] === id; return pts.filter(([x, y]) => on(x + 26, y) && on(x - 26, y) && on(x, y + 20) && on(x + 26, y + 20) && on(x - 26, y + 20)); }, { id, pts });
    let all = [], inner = [];
    for (let k = 0; k < 20 && inner.length < 3; k++) { if (k) await wait(500); all = await inkPoints(id, 10); inner = await innerOf(all); }
    assert.ok(all.length > 20, `${name}: ink on screen (${all.length})`);
    const grabs = await p.evaluate(({ pts }) => pts.filter(([x, y]) => window.__ink.grabsAt(x, y) && window.__ink.grabsAt(x, y, 10)).length, { pts: all });
    assert.equal(grabs, all.length, `${name}: every visible bit grabs (${grabs} of ${all.length})`);
    // drags from points across the visible band, sideways and along, keep the skin under the finger
    // from points well inside the band on screen, so the finger ends on ink too (a point at the
    // limb's outline dragged sideways ends off the body)
    assert.ok(inner.length >= 3, `${name}: band wide enough on screen to drag across (${inner.length})`);
    const pts = inner.filter((_, i) => i % Math.max(1, Math.floor(inner.length / 6)) === 0);
    let worst = 0;
    for (const [x, y] of pts) for (const [dx, dy] of [[24, 0], [-24, 0], [0, 18]]) {
      const uv0 = await p.evaluate(({ x, y }) => window.__ink.uvAt(x, y), { x, y });
      const r = await drag(id, x, y, dx, dy); await wait(60);
      assert.equal(r.mode, 'wrap', `${name}: a touch on the band moves the band at ${x},${y}`);
      assert.ok(r.moved > 1e-4, `${name}: it moved from ${x},${y} by ${dx},${dy}`);
      if (r.u0 < 39) assert.equal(r.steps, 1, `${name}: one drag is one undo step`); // the list keeps the last 40
      assert.equal(r.sel, id, `${name}: stays selected`);
      const uv1 = await p.evaluate(({ x, y }) => window.__ink.uvAt(x, y), { x: x + dx, y: y + dy });
      assert.ok(uv0 && uv1, `${name}: ink still under the finger after dragging from ${x},${y} by ${dx},${dy}`);
      worst = Math.max(worst, Math.abs(uv1[0] - uv0[0]), Math.abs(uv1[1] - uv0[1]));
      await drag(id, x + dx, y + dy, -dx, -dy);
    }
    assert.ok(worst < 0.12, `${name}: the skin under the finger stays under it (worst ${worst.toFixed(3)})`);
    // right round the back and back again: still a wrap, still grabs, ends up where it started
    const start = await p.evaluate((id) => window.__ink.state().tattoos.find((q) => q.id === id).pos.slice(), id);
    const [cx, cy] = inner[Math.floor(inner.length / 2)];
    // the way round on screen: the band's long direction (an arm slopes, so straight sideways also slides it along)
    const mx = all.reduce((a, q) => a + q[0], 0) / all.length, my = all.reduce((a, q) => a + q[1], 0) / all.length;
    let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of all) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), rx = Math.round(24 * Math.cos(ang)), ry = Math.round(24 * Math.sin(ang));
    for (let k = 0; k < 12; k++) { const r = await drag(id, cx, cy, rx, ry, 'touch', 10); assert.equal(r.mode, 'wrap', `${name}: round the back, pass ${k}`); }
    const round = await p.evaluate((id) => window.__ink.wrapShare(id), id);
    assert.ok(round && round.share > 0.8, `${name}: still goes round after crossing the back ${JSON.stringify(round)}`);
    const back = await inkPoints(id, 14);
    assert.ok(back.length > 10, `${name}: still visible after crossing the back`);
    const backGrabs = await p.evaluate(({ pts }) => pts.filter(([x, y]) => window.__ink.grabsAt(x, y, 10)).length, { pts: back });
    assert.equal(backGrabs, back.length, `${name}: grabs everywhere after crossing the back`);
    for (let k = 0; k < 12; k++) await drag(id, cx + rx, cy + ry, -rx, -ry, 'touch', 10);
    const end = await p.evaluate((id) => window.__ink.state().tattoos.find((q) => q.id === id).pos.slice(), id);
    const girth = info.girth;
    assert.ok(Math.hypot(...end.map((v, i) => v - start[i])) < girth * 0.15, `${name}: comes back to where it was`);
    // a mouse drags it too
    const m = await drag(id, cx, cy, 24, 0, 'mouse');
    assert.equal(m.mode, 'wrap', `${name}: a mouse grabs it`); assert.ok(m.moved > 1e-4, `${name}: a mouse moves it`);
    // a fingertip just past the band's edge (taken hold of by the finger's slop) turns it like the
    // rest of it: no fall back to the flat drag, which jumped it about a centimetre or stuck
    await wait(600); // the ink rebuilds a frame after the last drag
    const edge = await p.evaluate(() => { const I = window.__ink, b = document.querySelector('#stage canvas').getBoundingClientRect(), o = []; for (let y = b.top + 10; y < b.bottom; y += 12) for (let x = b.left + 10; x < b.right; x += 12) if (I.grabsAt(x, y, 10) && !I.grabsAt(x, y, 0)) o.push([x, y]); return o; });
    for (const [x, y] of edge.filter((_, i) => i % Math.max(1, Math.floor(edge.length / 6)) === 0)) {
      const r = await drag(id, x, y, 0, 18, 'touch', 6);
      assert.equal(r.mode, 'wrap', `${name}: a touch at the edge ${x},${y} turns the band like the rest`);
      if (r.moved > 1e-6) await p.evaluate(() => window.__ink.undo()); await wait(60); // the list is full here, so undo whenever it moved
    }
    // and a tap there, where a drag would have taken hold, keeps it selected
    if (edge.length) { const [x, y] = edge[0]; await p.evaluate(({ x, y }) => { const cv = document.querySelector('#stage canvas'); for (const k of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(k, { pointerId: 8, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, button: 0, buttons: k === 'pointerup' ? 0 : 1 })); }, { x, y }); await wait(100); assert.equal(await p.evaluate(() => window.__ink.selected()), id, `${name}: a tap just off the edge keeps it selected`); }
    // the handles sit on the part facing the camera
    const hs = await p.evaluate(() => [...document.querySelectorAll('#handles:not([hidden]) .hnd')].filter((e) => !e.hidden).map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
    const vb = await p.evaluate(() => [innerWidth, innerHeight]);
    for (const [hx, hy] of hs) assert.ok(hx > 0 && hy > 0 && hx < vb[0] && hy < vb[1], `${name}: handle on screen ${hx},${hy}`);
    console.log(name, 'girth', girth.toFixed(3), 'ink points', all.length, 'edge', edge.length, 'worst uv', worst.toFixed(3), 'handles', hs.length);
  }
  // a small piece on a limb still moves with its middle under the finger, as before
  const small = await p.evaluate(async () => {
    const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({});
    const c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(40, 40, 120, 120);
    const h = I.surfaceAt([0.15, 0.4, 2], [0, 0, -1]);
    const t = await I.addArt(c.toDataURL('image/png'), 'dot', { pos: h.pos, normal: h.normal, width: 0.04 });
    I.commitTest(); I.select(t.id); return { id: t.id, wrap: I.wrapShare(t.id) };
  });
  await p.evaluate((g) => { Object.assign(window.__ink.goal, g); Object.assign(window.__ink.cur, g); }, spots.calf[2]); await wait(900);
  const sp = await inkPoints(small.id, 6);
  const [sx, sy] = sp[Math.floor(sp.length / 2)];
  const sm = await drag(small.id, sx, sy, 20, 10);
  assert.equal(sm.mode, 'ink', 'a small piece moves the plain way'); assert.ok(sm.moved > 1e-4, 'a small piece moves');
  const row = await p.evaluate(() => document.querySelector('#wrapRow').hidden);
  assert.ok(row, 'no Wrap it round for a small square piece');
  await p.screenshot({ path: 'shots/t124-wrap-grab.png' });
}
