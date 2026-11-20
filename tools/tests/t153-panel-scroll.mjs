// Every panel scrolls under a finger (2026-11-20, Jake: "On the Blend in Color toolbar panel, I'm not
// actually able to scroll down on that panel. It scrolls the entire screen and glitches."). On the iPad a
// list that scrolls inside a blurred glass box does not take the finger, so the drag went to the screen.
// The Body, Pose and Preview panels, which scroll fine there, are themselves the thing that scrolls. Now
// Blend and colour is built the same way, and the Layers list and the comments bar keep their blur on a
// layer behind them. Checks, at iPad portrait, iPad landscape and a phone:
//  1. no list that overflows sits inside a blurred box (the shape that fails on the iPad), in Blend and
//     colour, Layers with a long list, Body, Preview, Plan, Share and New to try
//  2. a finger dragged up over a slider, a button or a gap in each overflowing panel scrolls that panel,
//     and neither the page nor the 3D view moves.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const c = await p.target().createCDPSession();
  const drag = async (x, y, dy) => {
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * i / 12 }] }); await wait(16); }
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400);
  };
  // overflowing lists inside a blurred box, in what is on screen now
  const blurredLists = () => p.evaluate(() => {
    const blur = (s) => (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none');
    const out = [];
    for (const e of document.querySelectorAll('*')) {
      if (/^(TEXTAREA|INPUT|SELECT)$/.test(e.tagName) || !e.checkVisibility({ visibilityProperty: true })) continue;
      const cs = getComputedStyle(e);
      if (!/auto|scroll/.test(cs.overflowY) || e.scrollHeight <= e.clientHeight + 4) continue;
      for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) if (blur(getComputedStyle(a))) { out.push(`${e.id || e.className} inside ${a.id || a.className}`); break; }
    }
    return out;
  });
  const still = () => p.evaluate(() => ({ cam: JSON.stringify(window.__ink.cam()), page: [scrollX, scrollY, document.documentElement.scrollTop, document.body.scrollTop, Math.round(visualViewport.offsetTop), Math.round(visualViewport.pageTop)].join(',') }));
  // drag up over a control in the panel (aim: a selector) or a point of its box (aim: [fx, fy]), and
  // say how far the thing that scrolls there moved
  const tryDrag = async (sel, aim, label, bad) => {
    const at = await p.evaluate((sel, aim) => {
      const host = document.querySelector(sel); let x, y;
      if (typeof aim === 'string') {
        const el = host.querySelector(aim), sc = host.scrollHeight > host.clientHeight ? host : el.closest('[data-scroll]');
        sc.scrollTop = 0; const hb = host.getBoundingClientRect(); let r = el.getBoundingClientRect();
        sc.scrollTop = Math.max(0, r.top - hb.top - hb.height * 0.3); r = el.getBoundingClientRect();
        x = Math.round(r.left + r.width / 2); y = Math.round(r.top + r.height / 2);
      } else { const b = host.getBoundingClientRect(); x = Math.round(b.left + b.width * aim[0]); y = Math.round(b.top + b.height * aim[1]); }
      let e = document.elementFromPoint(x, y), s = e;
      while (s && s !== document.documentElement && !(/auto|scroll/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight + 4)) s = s.parentElement;
      if (!s || s === document.documentElement) return null;
      if (typeof aim !== 'string') s.scrollTop = 0;
      window.__t153 = s;
      return { x, y, what: (e.tagName + '#' + e.id + '.' + e.className).slice(0, 50), mine: host.contains(e), from: s.scrollTop, room: s.scrollHeight - s.clientHeight - s.scrollTop };
    }, sel, aim);
    if (!at) { bad.push(`${label}: nothing scrolls under the finger`); return; }
    if (!at.mine) { bad.push(`${label}: the finger lands on ${at.what}, not the panel`); return; }
    const before = await still();
    await drag(at.x, at.y, -260); await wait(300);
    const moved = (await p.evaluate(() => window.__t153.scrollTop)) - at.from;
    const after = await still();
    if (moved < Math.min(80, at.room - 2)) bad.push(`${label}: dragging up on ${at.what} scrolled the panel only ${moved} px of ${at.room}`);
    if (after.cam !== before.cam) bad.push(`${label}: dragging on ${at.what} moved the 3D view`);
    if (after.page !== before.page) bad.push(`${label}: dragging on ${at.what} moved the page (${before.page} -> ${after.page})`);
  };
  const ready = async (w, h) => {
    await p.setViewport({ width: w, height: h, hasTouch: true, isMobile: true });
    await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  };
  const closeAll = () => p.evaluate(() => { for (const b of document.querySelectorAll('[data-close]')) if (b.checkVisibility()) b.click(); document.getElementById('lkDone')?.click(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  const bad = [];
  for (const [w, h] of [[820, 1180], [1180, 820], [390, 844]]) {
    const at = `${w}x${h}`;
    // Blend and colour
    await ready(w, h);
    await p.evaluate(() => window.__ink.select(window.__ink.state().tattoos[0].id)); await wait(600);
    await p.evaluate(() => document.getElementById('bLook').click()); await wait(800);
    for (const x of await blurredLists()) bad.push(`${at} Blend and colour: ${x}`);
    await tryDrag('#inkLook', '.lk-mode:nth-child(3)', `${at} Blend and colour, a blend mode`, bad);
    await tryDrag('#inkLook', '#lkStrength', `${at} Blend and colour, the ink strength slider`, bad);
    await tryDrag('#inkLook', '#lk-sat', `${at} Blend and colour, the saturation slider`, bad);
    await tryDrag('#inkLook', [0.5, 0.55], `${at} Blend and colour, the middle`, bad);
    // Layers with a long list (iPad sizes, where it opens beside the body)
    if (w >= 700) {
      await p.evaluate(() => document.getElementById('lkDone').click()); await wait(300);
      for (let i = 0; i < 22; i++) { await p.keyboard.down('Meta'); await p.keyboard.press('d'); await p.keyboard.up('Meta'); await wait(60); }
      await wait(800);
      await p.evaluate(() => { window.__ink.select(null); }); await wait(600);
      const open = await p.evaluate(() => document.getElementById('layersDock').classList.contains('open'));
      if (!open) bad.push(`${at}: Layers is not open`);
      else {
        for (const x of await blurredLists()) bad.push(`${at} Layers: ${x}`);
        await tryDrag('#ldList', [0.5, 0.6], `${at} Layers, a tattoo's line`, bad);
      }
    }
    // the other panels and sheets
    for (const [name, btn] of [['Body', '#bodyBtn'], ['Preview', '#lookBtn'], ['Plan', '#projectsBtn'], ['Share', '#shareBtn'], ['New to try', '#newBtn']]) {
      await ready(w, h);
      const shown = await p.evaluate((s) => { const b = document.querySelector(s); if (!b || !b.checkVisibility()) return false; b.click(); return true; }, btn);
      if (!shown) continue;
      await wait(900);
      for (const x of await blurredLists()) bad.push(`${at} ${name}: ${x}`);
      const host = await p.evaluate(() => { const e = [...document.querySelectorAll('.pop:not([hidden]),.scrim:not([hidden]) .modal,#lookMenu:not([hidden])')].find((x) => x.checkVisibility() && x.scrollHeight > x.clientHeight + 4); if (!e) return null; e.id = e.id || 't153host'; return '#' + e.id; });
      if (host) await tryDrag(host, [0.5, 0.6], `${at} ${name}`, bad);
      await closeAll();
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  console.log('PASS t153 panel scroll: Blend and colour, Layers, Body, Preview, Plan, Share and New to try scroll under a finger at iPad portrait, landscape and a phone, with no list inside a blurred box, and the page and the 3D view stay still');
}
