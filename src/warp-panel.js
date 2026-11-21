// Bend and warp a tattoo on the body (2026-11-21, Jake: "I also want to be able to bend and warp and
// transform tattoos that are on the body ... I just wish that I could play with the shape of it a
// little bit more"). Like Procreate's Warp: a grid over the tattoo on the skin whose points you drag,
// Distort for the four corners only (perspective), and Arc to curve the whole piece. The shape is kept
// as t.warp (src/ink-warp.js), the artwork never changes, Reset takes it off, and each drag, slider
// pull or reset is one undo step. The maths is in ink-warp.js; this file is the bar and the handles.
import { identityWarp, warpOf, warpKey, cleanWarp, warpAt, movePoint, distortCorner, cornerIndexes, regrid, arcWarp, WARP_DEFAULT, describeWarp } from './ink-warp.js';

// a shape is kept as it is saved (rounded), and a flat one not at all
const put = (t, w) => { const c = cleanWarp(w); if (c) t.warp = c; else delete t.warp; };
const TIPS = {
  warp: 'Drag a dot to bend that part of the tattoo. Drag the tattoo itself to move it.',
  distort: 'Drag a corner to stretch it in perspective. Straight lines stay straight.',
  arc: 'Slide to curve it up or down. Drag a dot in Warp to fine-tune.',
};

// api: get() the selected tattoo or null, spot(t, x, y) a frame point on screen ({ x, y, ok } or
// null), jac(t, x, y) the frame-to-screen change there ([[dxdx, dxdy], [dydx, dydy]]), vp() the
// viewport's box, begin() before a change (one undo step), change(fn) with the tattoo while it moves,
// end() after, canChange(t), draft(on) small pictures while a finger moves, used(), onClose().
export function createWarpPanel(api) {
  const $ = (s) => document.querySelector(s);
  const bar = $('#warpBar'), host = $('#warpGrid'), svg = $('#warpLines'), pts = $('#warpPts');
  let open = false, mode = 'warp', n = WARP_DEFAULT, arcBase = null, arcKey = '', arcSnap = false, drag = null, dots = [], forId = null;

  const curWarp = (t) => warpOf(t) || identityWarp(n);
  const setMode = (m) => {
    mode = m; arcBase = null;
    for (const b of bar.querySelectorAll('[data-wmode]')) b.setAttribute('aria-pressed', String(b.dataset.wmode === m));
    $('#warpGridRow').hidden = m !== 'warp'; $('#warpArcRow').hidden = m !== 'arc';
    if (m === 'arc') $('#warpArc').value = 0;
    $('#warpTip').textContent = TIPS[m];
    build(); place();
  };
  const sync = () => {
    const t = api.get(); if (!t) return;
    const w = warpOf(t); if (w) n = w.n;
    for (const b of bar.querySelectorAll('[data-wn]')) b.setAttribute('aria-pressed', String(+b.dataset.wn === n));
    $('#warpReset').disabled = !w;
    $('#warpState').textContent = w ? describeWarp(w) : 'Not warped yet';
  };
  // the dots: every grid point in Warp, the four corners in Distort, none in Arc
  function build() {
    pts.textContent = ''; dots = [];
    if (!open || mode === 'arc') return;
    const ks = mode === 'distort' ? cornerIndexes(n) : [...Array(n * n).keys()];
    ks.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wpt' + (mode === 'distort' ? ' corner' : '');
      b.setAttribute('aria-label', mode === 'distort' ? ['Top left', 'Top right', 'Bottom right', 'Bottom left'][i] + ' corner' : 'Warp point ' + (k + 1));
      b.dataset.k = k; b.dataset.i = i;
      b.addEventListener('pointerdown', down); b.addEventListener('pointermove', move);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      pts.append(b); dots.push(b);
    });
  }
  function solve(J, dx, dy) { // the frame change that moves the screen point by (dx, dy)
    const [[a, b], [c, d]] = J, det = a * d - b * c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
    return [(d * dx - b * dy) / det, (-c * dx + a * dy) / det];
  }
  function down(e) {
    const t = api.get(); if (!t || drag || !api.canChange(t)) return;
    e.preventDefault(); e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const k = +e.currentTarget.dataset.k, w = curWarp(t);
    drag = { id: e.pointerId, el: e.currentTarget, k, i: +e.currentTarget.dataset.i, base: w, px: w.p[k * 2], py: w.p[k * 2 + 1], x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    e.currentTarget.classList.add('on');
  }
  function move(e) {
    const g = drag; if (!g || g.id !== e.pointerId) return;
    const t = api.get(); if (!t) return;
    if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 3) return;
    // follow the finger through the skin's own stretch where the dot is, so the dot stays under the
    // finger on a curved arm as well as on the flat of the back. Where the dot's own spot on the skin
    // is on screen, aim from there at the finger, so a small error on a curve never builds up over a
    // long drag; past the stencil's edge, follow the finger's own steps.
    const J = api.jac(t, g.px, g.py), at = api.spot(t, g.px, g.py);
    const fix = at && at.ok && Math.hypot(e.clientX - at.x, e.clientY - at.y) < 160;
    const dd = J && (fix ? solve(J, e.clientX - at.x, e.clientY - at.y) : solve(J, e.clientX - g.x, e.clientY - g.y));
    g.x = e.clientX; g.y = e.clientY;
    if (!dd) return;
    const nx = g.px + dd[0], ny = g.py + dd[1];
    let next = mode === 'distort' ? distortCorner(g.base, g.i, nx, ny) : movePoint(curWarp(t), g.k, nx, ny);
    if (mode === 'distort' && next.p[g.k * 2] === g.base.p[g.k * 2] && next.p[g.k * 2 + 1] === g.base.p[g.k * 2 + 1] && (nx !== g.base.p[g.k * 2] || ny !== g.base.p[g.k * 2 + 1])) return; // would fold over
    g.px = next.p[g.k * 2]; g.py = next.p[g.k * 2 + 1];
    if (!g.moved) { g.moved = true; api.begin(); api.draft(true); document.body.classList.add('warp-dragging'); }
    api.change((tt) => { put(tt, next); });
    place();
  }
  function up(e) {
    const g = drag; if (!g || g.id !== e.pointerId) return;
    drag = null; g.el.classList.remove('on'); document.body.classList.remove('warp-dragging');
    if (g.moved) { api.draft(false); api.end(); api.used(mode); sync(); }
    place();
  }
  // draw the grid on the skin and put the dots where its points are on screen
  function place() {
    if (!open) return;
    const t = api.get(); if (!t) { close(); return; }
    const w = curWarp(t), vp = api.vp(), N = w.n, S = 14;
    const lines = [];
    const run = (fn) => { let d = '', pen = false; for (let s = 0; s <= S; s++) { const [x, y] = fn(s / S), q = api.spot(t, x, y); if (!q || !q.ok) { pen = false; continue; } const X = ((q.x - vp.left) / vp.k).toFixed(1), Y = ((q.y - vp.top) / vp.k).toFixed(1); d += (pen ? 'L' : 'M') + X + ' ' + Y; pen = true; } return d; };
    if (mode === 'distort' || mode === 'arc') {
      // just the edges and a light middle cross: Distort and Arc act on the whole piece
      for (const v of [0, 1]) { lines.push([run((s) => warpAt(w, s, v)), 'edge']); lines.push([run((s) => warpAt(w, v, s)), 'edge']); }
      lines.push([run((s) => warpAt(w, s, 0.5)), 'mid']); lines.push([run((s) => warpAt(w, 0.5, s)), 'mid']);
    } else {
      for (let i = 0; i < N; i++) { const v = i / (N - 1), cls = i === 0 || i === N - 1 ? 'edge' : 'mid'; lines.push([run((s) => warpAt(w, s, v)), cls]); lines.push([run((s) => warpAt(w, v, s)), cls]); }
    }
    let html = '';
    for (const [d, cls] of lines) if (d) html += `<path class="${cls}" d="${d}"/>`;
    svg.innerHTML = html;
    // a dot on top of one already shown is left out (zoom in to pull them apart): two in one place
    // cannot be told apart by a finger
    const at = [];
    if (drag) at.push([drag.x, drag.y]);
    for (const b of dots) {
      const k = +b.dataset.k, mine = drag && drag.el === b, q = mine ? { x: drag.x, y: drag.y, ok: true } : api.spot(t, w.p[k * 2], w.p[k * 2 + 1]);
      if (!q || !q.ok || (!mine && at.some(([x, y]) => Math.hypot(q.x - x, q.y - y) < 20))) { b.hidden = true; continue; }
      if (!mine) at.push([q.x, q.y]);
      b.hidden = false; b.style.left = (q.x - vp.left) / vp.k + 'px'; b.style.top = (q.y - vp.top) / vp.k + 'px';
    }
    host.hidden = false;
  }
  function openPanel(m = 'warp') {
    const t = api.get(); if (!t) return false;
    open = true; forId = t.id; const w = warpOf(t); n = w ? w.n : WARP_DEFAULT;
    bar.hidden = false; document.body.classList.add('warping');
    sync(); setMode(m);
    return true;
  }
  function close() {
    if (!open) return;
    if (arcSnap) { arcSnap = false; api.draft(false); api.end(); }
    open = false; drag = null; bar.hidden = true; host.hidden = true; pts.textContent = ''; svg.innerHTML = ''; dots = [];
    document.body.classList.remove('warping', 'warp-dragging');
    api.onClose();
  }

  for (const b of bar.querySelectorAll('[data-wmode]')) b.addEventListener('click', () => setMode(b.dataset.wmode));
  for (const b of bar.querySelectorAll('[data-wn]')) b.addEventListener('click', () => {
    const t = api.get(), m = +b.dataset.wn; if (!t || m === n || !api.canChange(t)) return;
    n = m; const w = warpOf(t);
    if (w) { api.begin(); api.change((tt) => { put(tt, regrid(w, m)); }); api.end(); }
    sync(); build(); place();
  });
  $('#warpReset').addEventListener('click', () => {
    const t = api.get(); if (!t || !warpOf(t) || !api.canChange(t)) return;
    api.begin(); api.change((tt) => { delete tt.warp; }); api.end();
    $('#warpArc').value = 0; arcBase = null; arcKey = ''; sync(); place();
  });
  $('#warpDone').addEventListener('click', () => close());
  // Arc: a live slider over the shape it had when the slider was first pulled, one undo step a pull
  const arc = $('#warpArc');
  arc.addEventListener('input', () => {
    const t = api.get(); if (!t || !api.canChange(t)) return;
    if (!arcBase) arcBase = regrid(curWarp(t), 5);
    if (!arcSnap) { arcSnap = true; api.begin(); api.draft(true); }
    const v = +arc.value / 100;
    api.change((tt) => { put(tt, arcWarp(arcBase, v, tt.aspect)); arcKey = warpKey(warpOf(tt)); });
    place();
  });
  arc.addEventListener('change', () => { if (!arcSnap) return; arcSnap = false; api.draft(false); api.end(); api.used('arc'); sync(); place(); });

  return { open: openPanel, close, place, isOpen: () => open, refresh: () => {
    if (!open || drag) return;
    const t = api.get(); if (!t) { close(); return; }
    // the slider keeps its place only while the shape is still the one it made (an undo or another
    // tattoo starts it again from the middle)
    if (t.id !== forId || (arcBase && warpKey(warpOf(t)) !== arcKey)) { arcBase = null; arcKey = ''; $('#warpArc').value = 0; }
    forId = t.id; const w = warpOf(t); n = w ? w.n : n; sync(); build(); place();
  }, mode: () => mode };
}
