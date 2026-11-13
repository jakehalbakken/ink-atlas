// Apple Pencil taps on buttons. On iPad, a Pencil tap almost always slides a pixel or
// two, and Safari then often drops the click (the page blocks touch scrolling, which
// counts a moving touch as a gesture, not a tap). A finger tap is not affected. So for
// the pen only: a short press that starts and ends on the same control clicks it, and
// the browser's own click for that press, if it does come, is swallowed so nothing
// happens twice. Sliders, the 3D view and text fields handle the pen themselves.
const CONTROL = 'button, a[href], label, summary, [role=button], [role=tab], [role=menuitem], input[type=checkbox], input[type=radio], input[type=button], input[type=submit], input[type=file], .chip, .card';
const OWN = 'ink-slider, canvas, select, textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]), [contenteditable], .ba-line';
export const PEN_SLOP = 16, PEN_MAX_MS = 900, SWALLOW_MS = 800;

export function controlAt(el) {
  if (!(el instanceof Element) || el.closest(OWN)) return null;
  const c = el.closest(CONTROL);
  if (!c || c.disabled || c.getAttribute('aria-disabled') === 'true' || c.closest('[inert]')) return null;
  return c;
}

export function installPenTap(root = document) {
  let down = null, swallow = null, own = false;
  root.addEventListener('pointerdown', (e) => {
    swallow = null; // a new press: any click still owed is for this one
    down = e.pointerType === 'pen' && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), control: controlAt(e.target) } : null;
  }, { capture: true, passive: true });
  root.addEventListener('pointercancel', (e) => { if (down && e.pointerId === down.id) down = null; }, { capture: true, passive: true });
  root.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || e.pointerId !== d.id || !d.control) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > PEN_SLOP || performance.now() - d.t > PEN_MAX_MS) return;
    const at = root.elementFromPoint ? controlAt(root.elementFromPoint(e.clientX, e.clientY)) : d.control;
    if (at !== d.control || !d.control.isConnected) return;
    swallow = { control: d.control, until: performance.now() + SWALLOW_MS };
    own = true; try { d.control.click(); } finally { own = false; }
  }, { capture: true });
  // the browser's own click for the same press, if it arrives, would be a second one
  root.addEventListener('click', (e) => {
    if (own || !swallow) return;
    if (performance.now() > swallow.until) { swallow = null; return; }
    if (e.target instanceof Node && swallow.control.contains(e.target)) { swallow = null; e.preventDefault(); e.stopImmediatePropagation(); }
  }, { capture: true });
}
