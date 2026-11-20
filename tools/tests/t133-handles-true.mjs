// Placement controls the right way round (2026-11-19, Jake: "I try to extend it and it makes it
// smaller... everything's upside down or backwards"). At iPad size, from the front, the sides, the
// back and close up: the corner handle sits on the tattoo's own ink corner, dragging it away from the
// tattoo grows it and towards it shrinks it, the turn handle turns it the way the finger goes round,
// a one-finger drag keeps the ink under the finger even when the middle of a big piece is off the
// screen, and two fingers spreading on it grow it. Layers starts under the top bar.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  for (const [W, H] of [[1376, 1032], [1032, 1376]]) {
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(900);
    // Layers is under the top bar, its header in full view
    const dock = await p.evaluate(() => { const d = document.querySelector('#layersDock'), tb = document.querySelector('#top .toolbar'), v = document.querySelector('#views'); const hd = d.querySelector('.ld-head') || d.firstElementChild; return { dock: d.getBoundingClientRect().top, head: hd.getBoundingClientRect().top, tb: tb.getBoundingClientRect().bottom, views: getComputedStyle(v).position === 'fixed' ? v.getBoundingClientRect().bottom : 0 }; });
    assert.ok(dock.dock >= Math.max(dock.tb, dock.views) && dock.head >= dock.dock - 1, `${W}: Layers under the top bar ${JSON.stringify(dock)}`);
    // spot: where on the body, which way it faces, the piece's width, and the view
    const cases = [
      { name: 'big chest close', o: [0.1, 1.38, 2], d: [0, 0, -1], w: 0.3, cam: { theta: 0.3, phi: 1.5, r: 0.9, tx: 0.12, ty: 1.3, tz: 0.1 } },
      { name: 'big chest very close', o: [0.1, 1.38, 2], d: [0, 0, -1], w: 0.3, cam: { theta: 0.1, phi: 1.55, r: 0.5, tx: 0.08, ty: 1.33, tz: 0.12 } },
      { name: 'chest front', o: [0.1, 1.35, 2], d: [0, 0, -1], w: 0.08, cam: { theta: 0, phi: 1.5, r: 1.1, tx: 0.08, ty: 1.3, tz: 0.1 } },
      { name: 'back', o: [-0.08, 1.3, -2], d: [0, 0, 1], w: 0.1, cam: { theta: Math.PI, phi: 1.5, r: 1.1, tx: -0.05, ty: 1.3, tz: -0.1 } },
      { name: 'side of ribs, Left view', o: [2, 1.15, 0.0], d: [-1, 0, 0], w: 0.09, cam: { theta: Math.PI / 2, phi: 1.5, r: 1.0, tx: 0.12, ty: 1.15, tz: 0 } },
      { name: 'upper arm, Right view', o: [-2, 1.32, 0.02], d: [1, 0, 0], w: 0.06, cam: { theta: -Math.PI / 2, phi: 1.5, r: 0.9, tx: -0.25, ty: 1.3, tz: 0 } },
      { name: 'thigh, from below', o: [0.1, 0.7, 2], d: [0, 0, -1], w: 0.08, cam: { theta: 0.2, phi: 1.9, r: 1.0, tx: 0.1, ty: 0.75, tz: 0.1 } },
    ];
    for (const c of cases) {
      const id = await p.evaluate(async (c) => {
        const I = window.__ink, s = I.state(); s.tattoos = []; I.setShape({});
        const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 400); g.fillStyle = '#111'; g.fillRect(16, 16, 368, 368); g.fillStyle = '#fff'; g.fillRect(60, 60, 280, 280); g.fillStyle = '#111'; g.fillRect(150, 150, 100, 100);
        const h = I.surfaceAt(c.o, c.d); if (!h) return null;
        const t = await I.addArt(cv.toDataURL('image/png'), 'box', { pos: h.pos, normal: h.normal, width: c.w });
        I.commitTest(); I.select(t.id); return t.id;
      }, c);
      assert.ok(id, `${c.name}: placed`);
      await wait(400);
      await p.evaluate((g) => { const I = window.__ink; Object.assign(I.goal, g); Object.assign(I.cur, g); I.cur.r += 0.01; }, c.cam); await wait(1000);
      const tat = () => p.evaluate((id) => { const t = window.__ink.state().tattoos.find((q) => q.id === id); return { w: t.width, rot: t.rot || 0, pos: t.pos.slice() }; }, id);
      const handles = () => p.evaluate(() => { const g = (s) => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return document.querySelector('#handles').hidden || e.hidden ? null : { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }; return { size: g('#hSize'), turn: g('#hTurn') }; });
      const centre = () => p.evaluate((id) => window.__ink.screenOfPos(window.__ink.state().tattoos.find((q) => q.id === id).pos), id);
      const dragEl = (sel, x, y, dx, dy) => p.evaluate(({ sel, x, y, dx, dy }) => { const b = document.querySelector(sel), ev = (k, X, Y) => b.dispatchEvent(new PointerEvent(k, { pointerId: 9, pointerType: 'touch', clientX: X, clientY: Y, bubbles: true, buttons: k === 'pointerup' ? 0 : 1 })); ev('pointerdown', x, y); for (let i = 1; i <= 8; i++) ev('pointermove', x + dx * i / 8, y + dy * i / 8); ev('pointerup', x + dx, y + dy); }, { sel, x, y, dx, dy });
      let hs = await handles();
      assert.ok(hs.size, `${c.name}: corner handle shown`);
      // the corner handle is on the stencil (its own ink or just past its edge), not in the air
      const on = await p.evaluate(({ x, y }) => window.__ink.grabsAt(x, y, 24), hs.size);
      assert.ok(on, `${c.name}: corner handle sits on the tattoo ${JSON.stringify(hs.size)}`);
      // away from the middle grows it, back towards the middle shrinks it
      let ctr = await centre(), t0 = await tat();
      let ux = hs.size.x - ctr.x, uy = hs.size.y - ctr.y, ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      await dragEl('#hSize', hs.size.x, hs.size.y, ux * 40, uy * 40); await wait(300);
      const t1 = await tat();
      assert.ok(t1.w > t0.w * 1.02, `${c.name}: dragging the corner out grows it (${t0.w.toFixed(3)} -> ${t1.w.toFixed(3)})`);
      hs = await handles(); ctr = await centre();
      if (hs.size) {
        ux = hs.size.x - ctr.x; uy = hs.size.y - ctr.y; ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
        await dragEl('#hSize', hs.size.x, hs.size.y, -ux * Math.min(50, ul * 0.5), -uy * Math.min(50, ul * 0.5)); await wait(300);
        const t2 = await tat();
        assert.ok(t2.w < t1.w * 0.98, `${c.name}: dragging the corner in shrinks it (${t1.w.toFixed(3)} -> ${t2.w.toFixed(3)})`);
      }
      // the turn handle: a drag clockwise round the middle on screen turns it clockwise (rot goes down)
      hs = await handles(); ctr = await centre();
      if (hs.turn) {
        const r0 = (await tat()).rot, vx = hs.turn.x - ctr.x, vy = hs.turn.y - ctr.y;
        await dragEl('#hTurn', hs.turn.x, hs.turn.y, -vy * 0.3, vx * 0.3); await wait(300); // screen y is down: (-vy, vx) is clockwise
        const r1 = (await tat()).rot; let dr = r1 - r0; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        assert.ok(dr < -0.05, `${c.name}: the turn handle turns it the way the finger goes (${dr.toFixed(3)})`);
      }
      // a one-finger drag on its ink keeps that bit of ink under the finger
      await wait(300);
      const pts = await p.evaluate((id) => { const I = window.__ink, b = document.querySelector('#stage canvas').getBoundingClientRect(), o = []; for (let y = b.top + 120; y < b.bottom - 120; y += 14) for (let x = b.left + 120; x < b.right - 460; x += 14) if (I.inkIdsAt(x, y)[0] === id && I.grabsAt(x, y)) o.push([x, y]); return o; }, id);
      assert.ok(pts.length > 3, `${c.name}: ink to grab (${pts.length})`);
      const [gx, gy] = pts[Math.floor(pts.length / 2)];
      for (const [dx, dy] of [[30, 0], [0, 30], [-30, 0], [0, -30]]) {
        const r = await p.evaluate(({ x, y, dx, dy }) => {
          const I = window.__ink, cv = document.querySelector('#stage canvas'), uv0 = I.uvAt(x, y);
          const ev = (k, X, Y) => cv.dispatchEvent(new PointerEvent(k, { pointerId: 7, pointerType: 'touch', clientX: X, clientY: Y, bubbles: true, button: 0, buttons: k === 'pointerup' ? 0 : 1 }));
          ev('pointerdown', x, y); const mode = I.gestMode(); for (let i = 1; i <= 6; i++) ev('pointermove', x + dx * i / 6, y + dy * i / 6); ev('pointerup', x + dx, y + dy);
          return { uv0, mode };
        }, { x: gx, y: gy, dx, dy });
        await wait(250);
        const uv1 = await p.evaluate(({ x, y }) => window.__ink.uvAt(x, y), { x: gx + dx, y: gy + dy });
        assert.ok(r.mode === 'ink' || r.mode === 'wrap', `${c.name}: grabbed (${r.mode})`);
        assert.ok(r.uv0 && uv1, `${c.name}: still on the ink after a drag of ${dx},${dy}`);
        const drift = Math.hypot(r.uv0[0] - uv1[0], r.uv0[1] - uv1[1]) * (await tat()).w * 100;
        assert.ok(drift < 1.0, `${c.name}: ink stays under the finger dragging ${dx},${dy} (${drift.toFixed(2)} cm)`);
        // and back
        await p.evaluate(({ x, y, dx, dy }) => { const cv = document.querySelector('#stage canvas'), ev = (k, X, Y) => cv.dispatchEvent(new PointerEvent(k, { pointerId: 7, pointerType: 'touch', clientX: X, clientY: Y, bubbles: true, button: 0, buttons: k === 'pointerup' ? 0 : 1 })); ev('pointerdown', x + dx, y + dy); for (let i = 1; i <= 6; i++) ev('pointermove', x + dx - dx * i / 6, y + dy - dy * i / 6); ev('pointerup', x, y); }, { x: gx, y: gy, dx, dy });
        await wait(250);
      }
      // two fingers spreading on it grow it, pinching shrinks it
      const w0 = (await tat()).w;
      await p.evaluate(({ x, y }) => { const cv = document.querySelector('#stage canvas'), ev = (k, id, X, Y) => cv.dispatchEvent(new PointerEvent(k, { pointerId: id, pointerType: 'touch', clientX: X, clientY: Y, bubbles: true, button: 0, buttons: k === 'pointerup' ? 0 : 1 }));
        ev('pointerdown', 21, x - 10, y); ev('pointerdown', 22, x + 10, y); for (let i = 1; i <= 6; i++) { ev('pointermove', 21, x - 10 - i * 5, y); ev('pointermove', 22, x + 10 + i * 5, y); } ev('pointerup', 21, x - 40, y); ev('pointerup', 22, x + 40, y); }, { x: gx, y: gy });
      await wait(250);
      assert.ok((await tat()).w > w0 * 1.5, `${c.name}: spreading two fingers grows it`);
    }
  }
}
