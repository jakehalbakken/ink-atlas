// How much memory Clean up's undo steps hold, and which to let go of. Each step keeps the pictures it
// needs to go back to; a picture that did not change between steps is the same object in both and is
// counted once. Pure: works on any { data } objects, so it runs under node too.
export const UNDO_BUDGET = 64 * 1024 * 1024;
const bytesOf = (d) => (d && d.data ? d.data.length : 0);
export function stepPictures(e) { return e && !e.selOnly ? [e.full, e.baseline, e.pixels, e.original] : []; }
// every picture and selection the stacks hold, each counted once
export function heldBytes(stacks) {
  const seen = new Set(); let n = 0;
  for (const stack of stacks) for (const e of stack) {
    for (const d of stepPictures(e)) if (d && !seen.has(d)) { seen.add(d); n += bytesOf(d); }
    if (e && e.float && e.float.w && e.float.h) n += e.float.w * e.float.h * 8;
    if (e && e.sel && !seen.has(e.sel)) { seen.add(e.sel); n += e.sel.length || 0; }
  }
  return n;
}
// drop the oldest steps of `stack` until everything held fits the budget, always keeping its newest
// step so the last change can be undone
export function trimStack(stack, others = [], budget = UNDO_BUDGET) {
  while (stack.length > 1 && heldBytes([stack, ...others]) > budget) stack.shift();
  return stack;
}
// A picture that has not been drawn on since it was last read back can be handed out again
// instead of copied: `read` gets the pixels, `version` says how often the canvas has changed.
export function reuseRead(cache, key, version, w, h, read) {
  const c = cache[key];
  if (c && c.v === version && c.d && c.d.width === w && c.d.height === h) return c.d;
  const d = read(); cache[key] = { v: version, d }; return d;
}
