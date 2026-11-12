// Before / after on the main view. A line splits the picture: on the left only
// the ink already on the body, on the right everything visible, planned pieces
// included. Same camera, same gestures, nothing saved and nothing in the project
// changes. Drag the line (or the round handle) to move the split.
export function createBeforeAfter({ after, onChange }) {
  let on = false, split = 0.5, drag = null;
  const root = document.createElement('div');
  root.id = 'beforeAfter'; root.hidden = true;
  root.innerHTML = '<span class="ba-label ba-left">Now</span><span class="ba-label ba-right">With plans</span>' +
    '<div class="ba-line" role="slider" tabindex="0" aria-label="Move the before and after line" aria-valuemin="0" aria-valuemax="100"><span class="ba-grip" aria-hidden="true"></span></div>';
  // Right after the 3D canvas, so the top bar, the tray and the edit sheet stay above the line.
  after.after(root);
  const line = root.querySelector('.ba-line'), left = root.querySelector('.ba-left'), right = root.querySelector('.ba-right');
  const place = () => {
    const pct = (split * 100).toFixed(2) + '%';
    line.style.left = pct; left.style.right = `calc(${100 - split * 100}% + 14px)`; right.style.left = `calc(${pct} + 14px)`;
    line.setAttribute('aria-valuenow', String(Math.round(split * 100)));
    left.hidden = split < 0.08; right.hidden = split > 0.92;
  };
  const setSplit = (v) => { split = Math.min(1, Math.max(0, v)); place(); onChange(); };
  const fromEvent = (e) => { const r = root.getBoundingClientRect(); return r.width ? (e.clientX - r.left) / r.width : split; };
  line.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); drag = e.pointerId; try { line.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ } });
  line.addEventListener('pointermove', (e) => { if (drag !== e.pointerId) return; e.preventDefault(); setSplit(fromEvent(e)); });
  const end = (e) => { if (drag === e.pointerId) drag = null; };
  line.addEventListener('pointerup', end); line.addEventListener('pointercancel', end);
  line.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  line.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') setSplit(split - step); else if (e.key === 'ArrowRight') setSplit(split + step); else return;
    e.preventDefault();
  });
  place();
  return {
    get on() { return on; },
    get split() { return split; },
    set(value) { on = !!value; root.hidden = !on; if (on) { split = 0.5; place(); } drag = null; onChange(); },
    setSplit,
    // Draws one frame: the right part as is, then the left part with `hideFuture`
    // applied (it hides the planned ink and returns a function that puts it back).
    render(renderer, scene, camera, hideFuture) {
      const el = renderer.domElement, w = el.clientWidth || 1, h = el.clientHeight || 1, x = Math.round(w * split);
      renderer.setScissorTest(true);
      if (x < w) { renderer.setScissor(x, 0, w - x, h); renderer.render(scene, camera); }
      if (x > 0) { const restore = hideFuture(); try { renderer.setScissor(0, 0, x, h); renderer.render(scene, camera); } finally { restore(); } }
      renderer.setScissorTest(false);
    },
  };
}
