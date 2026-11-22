// Two-finger tap to undo, three to redo, hold two to keep undoing (src/multi-tap.js), with a fake clock.
// Run: node tools/tests/multi-tap-unit.mjs
import assert from 'node:assert/strict';
import { createMultiTap, TAP } from '../../src/multi-tap.js';
let t = 0; const timers = [];
const clock = { now: () => t, setTimer: (f, ms) => { const h = { f, at: t + ms }; timers.push(h); return h; }, clearTimer: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); } };
const advance = (ms) => { const end = t + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const n = timers[0]; if (!n || n.at > end) break; timers.shift(); t = n.at; n.f(); } t = end; };
const log = []; const m = createMultiTap({ onUndo: (k) => log.push('u' + k), onRedo: () => log.push('r'), ...clock });
const ev = (id, x, y, type = 'touch') => ({ pointerId: id, clientX: x, clientY: y, pointerType: type });
const fresh = () => { log.length = 0; m.reset(); timers.length = 0; };

// two fingers down and up together: one undo
fresh(); m.down(ev(1, 100, 100)); advance(20); m.down(ev(2, 200, 100)); advance(90); m.up(ev(1)); advance(10); assert.equal(m.up(ev(2)), 'undo'); assert.deepEqual(log, ['u0']);
// three fingers: redo
fresh(); m.down(ev(1, 100, 100)); m.down(ev(2, 150, 100)); advance(15); m.down(ev(3, 200, 100)); advance(100); m.up(ev(2)); m.up(ev(1)); assert.equal(m.up(ev(3)), 'redo'); assert.deepEqual(log, ['r']);
// a pinch or pan is not a tap
fresh(); m.down(ev(1, 100, 100)); m.down(ev(2, 200, 100)); m.move(ev(2, 240, 100)); advance(100); m.up(ev(1)); assert.equal(m.up(ev(2)), null); assert.deepEqual(log, []);
// small jitter still is
fresh(); m.down(ev(1, 100, 100)); m.down(ev(2, 200, 100)); m.move(ev(2, 206, 104)); advance(100); m.up(ev(1)); assert.equal(m.up(ev(2)), 'undo');
// too slow is not a tap
fresh(); m.down(ev(1, 100, 100)); m.down(ev(2, 200, 100)); advance(TAP.quick + 200); m.up(ev(1)); assert.equal(m.up(ev(2)), null);
// one finger is not; a second finger that lands late is not
fresh(); m.down(ev(1, 100, 100)); advance(50); assert.equal(m.up(ev(1)), null);
fresh(); m.down(ev(1, 100, 100)); advance(TAP.quick + 40); m.down(ev(2, 200, 100)); advance(40); m.up(ev(1)); assert.equal(m.up(ev(2)), null); assert.deepEqual(log, []);
// the Pencil or a mouse never counts, even with a finger
fresh(); m.down(ev(1, 100, 100)); m.down(ev(2, 200, 100, 'pen')); advance(50); m.up(ev(2)); assert.equal(m.up(ev(1)), null);
// hold two still: undo again and again until they lift, and no extra undo on the lift
fresh(); m.down(ev(1, 100, 100)); m.down(ev(2, 200, 100)); advance(TAP.hold + TAP.every * 3 + 10); m.up(ev(1)); assert.equal(m.up(ev(2)), null); assert.deepEqual(log, ['u1', 'u2', 'u3', 'u4']);
// a cancelled touch is not a tap
fresh(); m.down(ev(1, 100, 100)); m.down(ev(2, 200, 100)); m.up(ev(1), true); assert.equal(m.up(ev(2)), null);
// a two-finger tap right after another works on its own
fresh(); for (let k = 0; k < 2; k++) { m.down(ev(1, 100, 100)); m.down(ev(2, 200, 100)); advance(60); m.up(ev(1)); m.up(ev(2)); advance(40); } assert.deepEqual(log, ['u0', 'u0']);
console.log('multi-tap-unit: all good');
