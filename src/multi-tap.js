// Procreate's quick undo (2026-11-22, Jake: "I want to be able to double tap to undo like in
// procreate"): tap with two fingers to undo, with three to redo, and hold two fingers still to keep
// undoing. Only touches count (a mouse or the Pencil never does), and only a real tap: every finger
// down and up again quickly, none of them moved, so a pinch, a pan or a turn is never taken for one.
// Pure state; the caller feeds it pointer events and gets back what to do.
export const TAP = { slop: 14, quick: 320, hold: 650, every: 260 };

export function createMultiTap({ onUndo, onRedo, now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let g = null; // { t0, start: Map(id -> [x, y]), down: Set, most, moved, held, timer }
  const stopHold = () => { if (g && g.timer) { clearTimer(g.timer); g.timer = null; } };
  const spoil = () => { if (g) { g.moved = true; stopHold(); } };
  function holdStep() {
    if (!g || g.moved || g.down.size !== 2 || g.most !== 2) { stopHold(); return; }
    g.held++; onUndo?.(g.held); g.timer = setTimer(holdStep, TAP.every);
  }
  return {
    down(e) {
      if (e.pointerType !== 'touch') { spoil(); return; }
      if (!g || !g.down.size || now() - g.t0 > 4000) g = { t0: now(), start: new Map(), down: new Set(), most: 0, moved: false, held: 0, timer: null };
      g.start.set(e.pointerId, [e.clientX, e.clientY]); g.down.add(e.pointerId); g.most = Math.max(g.most, g.down.size);
      // a finger that lands late is a new gesture, not part of the tap
      if (now() - g.t0 > TAP.quick) spoil();
      stopHold();
      if (!g.moved && g.down.size === 2 && g.most === 2) g.timer = setTimer(holdStep, TAP.hold);
    },
    move(e) {
      const s = g && g.start.get(e.pointerId); if (!s || g.moved) return;
      if (Math.hypot(e.clientX - s[0], e.clientY - s[1]) > TAP.slop) spoil();
    },
    // once the last finger is up: calls onUndo or onRedo for a tap, and says which ('undo', 'redo' or null)
    up(e, cancelled) {
      if (!g || !g.down.has(e.pointerId)) return null;
      g.down.delete(e.pointerId); stopHold();
      if (cancelled) g.moved = true;
      if (g.down.size) return null;
      const done = g; g = null;
      if (done.moved || done.held || now() - done.t0 > TAP.quick + 120) return null;
      if (done.most === 2) { onUndo?.(0); return 'undo'; }
      if (done.most === 3) { onRedo?.(); return 'redo'; }
      return null;
    },
    // whether the fingers now on the glass may still be a tap (so other handlers can hold back)
    pending: () => !!(g && g.down.size >= 2 && !g.moved),
    reset() { stopHold(); g = null; },
  };
}
