// Layer actions for the Layers panel, the way Procreate does them (2026-11-22, Jake: "Look at the
// way procreate handles layers being able to swipe or duplicate and merge. I want the same"):
// duplicate in place, merge several into one, move a line to another place in the list. Pure
// maths and state changes only; the panel's gestures are in layers-dock.js and the picture work
// (flattening several tattoos into one picture on the skin) is in app.js.
import { dockSections } from './layers-dock.js';

// The tattoo ids in the order the panel lists them (groups first, each in the project's order).
export function displayOrder(state) {
  const out = []; for (const sec of dockSections(state)) for (const t of sec.items) out.push(t.id); return out;
}
// Every line from one finger's line to the other's, both included, in list order (a pinch).
export function rangeBetween(order, a, b) {
  const i = order.indexOf(a), j = order.indexOf(b); if (i < 0 || j < 0) return [];
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
}
// The line under this one in the list (what Merge down merges into), or null at the bottom.
export function lineBelow(state, id) {
  const order = displayOrder(state), i = order.indexOf(id); return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

// Duplicate: an exact copy on the same skin, everything carried over (bend, warp, blend, colour,
// size, turn, place, notes for the artist), listed right under the original. A copy is its own
// layer for Procreate's bring back and needs its own approval, so those two marks stay behind.
export function duplicateTattoo(state, id, newId) {
  const i = state.tattoos.findIndex((t) => t.id === id); if (i < 0) return null;
  const src = state.tattoos[i], c = structuredClone(src);
  c.id = newId; c.name = copyName(state, src.name || 'Tattoo');
  delete c.fromLayer; delete c.review;
  state.tattoos.splice(i + 1, 0, c); return c;
}
export function copyName(state, name) {
  const base = String(name).replace(/ copy( \d+)?$/, ''), used = new Set(state.tattoos.map((t) => t.name));
  if (!used.has(base + ' copy')) return base + ' copy';
  for (let n = 2; n < 999; n++) if (!used.has(`${base} copy ${n}`)) return `${base} copy ${n}`;
  return base + ' copy';
}

// Move a line to another place in the list: dropped above `before` (an id), or at the end of a
// group's lines (`group`, or null for the lines not in a group). It joins the group it lands in.
// Only the moved tattoo changes place in the project's order, so the others keep theirs.
export function moveLine(state, id, { before = null, group = null } = {}) {
  const i = state.tattoos.findIndex((t) => t.id === id); if (i < 0 || id === before) return false;
  const t = state.tattoos[i], groups = new Set((state.groups || []).map((g) => g && g.id));
  const target = before ? state.tattoos.find((x) => x.id === before) : null;
  const want = target ? (target.group && groups.has(target.group) ? target.group : null) : (group && groups.has(group) ? group : null);
  const was = JSON.stringify([displayOrder(state), t.group || null]);
  state.tattoos.splice(i, 1);
  if (want) t.group = want; else delete t.group;
  let at;
  if (target) at = state.tattoos.indexOf(target);
  else {
    // after the last line of that section, or at the very end
    let last = -1; state.tattoos.forEach((x, k) => { const g = x.group && groups.has(x.group) ? x.group : null; if (g === want) last = k; });
    at = last >= 0 ? last + 1 : state.tattoos.length;
  }
  state.tattoos.splice(at, 0, t);
  return JSON.stringify([displayOrder(state), t.group || null]) !== was; // a change the list shows
}

// Whether these tattoos can be merged into one, and which one they merge into: the lowest of
// them in the list keeps its name, notes and place (Procreate's Merge down keeps the lower layer).
export function mergePlan(state, ids) {
  const set = new Set(ids), list = state.tattoos.filter((t) => set.has(t.id));
  if (list.length < 2) return { ok: false, why: 'Pick two or more tattoos to merge.' };
  const kinds = new Set(list.map((t) => (t.status === 'existing' ? 'existing' : 'planned')));
  if (kinds.size > 1) return { ok: false, why: 'Merge tattoos of one kind: all planned, or all on your skin.' };
  const locked = list.find((t) => t.locked && t.status !== 'existing');
  if (locked) return { ok: false, why: `${locked.name || 'A tattoo'} is locked. Unlock it to merge it.` };
  const order = displayOrder(state), target = [...list].sort((a, b) => order.indexOf(b.id) - order.indexOf(a.id))[0];
  return { ok: true, target: target.id, ids: list.map((t) => t.id), existing: kinds.has('existing') };
}
// After the merged picture is made: one tattoo in the place of the lowest one, the others gone,
// and comments and reference pictures that were on the others moved onto it.
export function applyMerge(state, ids, targetId, merged) {
  const gone = new Set(ids.filter((x) => x !== targetId));
  const at = state.tattoos.findIndex((t) => t.id === targetId); if (at < 0) return false;
  state.tattoos[at] = merged;
  state.tattoos = state.tattoos.filter((t) => !gone.has(t.id));
  for (const n of state.notes || []) { if (n && gone.has(n.tattooId)) n.tattooId = targetId; if (n && n.suggest && gone.has(n.suggest.tattooId)) delete n.suggest; }
  for (const r of state.refs || []) if (r && gone.has(r.tattooId)) r.tattooId = targetId;
  return true;
}

// The affine map that takes triangle s (three [x, y]) onto triangle d, as canvas setTransform's
// a, b, c, d, e, f; null for a triangle with no area.
export function affineFor(s, d) {
  const [[x0, y0], [x1, y1], [x2, y2]] = s, [[u0, v0], [u1, v1], [u2, v2]] = d;
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (!(Math.abs(det) > 1e-9)) return null;
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det, c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
  const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det, dd = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
  return [a, b, c, dd, u0 - a * x0 - c * y0, v0 - b * x0 - dd * y0];
}
// A triangle pushed out by px from its middle, so neighbouring triangles overlap and leave no hairline.
export function grow(tri, px) {
  const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  return tri.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + dx / l * px, y + dy / l * px]; });
}
// Ink is drawn by darkening the skin (multiply). A picture of how much each spot darkens, white
// where there is no ink, becomes artwork again: each pixel the lightest ink colour and the least
// coverage that darken white by exactly that much, so the merged tattoo looks the same on the body.
export function inkFromDarkening(px) {
  for (let o = 0; o < px.length; o += 4) {
    const r = px[o] / 255, g = px[o + 1] / 255, b = px[o + 2] / 255, a = 1 - Math.min(r, g, b);
    if (a < 1.5 / 255) { px[o] = px[o + 1] = px[o + 2] = 255; px[o + 3] = 0; continue; }
    px[o] = Math.round(255 * (1 - (1 - r) / a)); px[o + 1] = Math.round(255 * (1 - (1 - g) / a)); px[o + 2] = Math.round(255 * (1 - (1 - b) / a)); px[o + 3] = Math.round(255 * a);
  }
  return px;
}
// A texture whose blend lightens is stored at half strength and doubled on the body; flattened,
// it can only darken, so it is doubled and held at white.
export function doubled(px) { for (let o = 0; o < px.length; o += 4) for (let k = 0; k < 3; k++) px[o + k] = Math.min(255, px[o + k] * 2); return px; }
// The darkest part of a darkening picture, as a box in its pixels (null when it is all white).
export function darkBox(px, w, h, min = 6) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (255 - Math.min(px[o], px[o + 1], px[o + 2]) >= min) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// How a horizontal finger move on a line reads: open the actions (left), pick it (right), or nothing yet.
export const SWIPE = { slop: 10, open: 56, pick: 56, actions: 3 * 72 };
export function swipeKind(dx, dy) {
  if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop) return null;
  if (Math.abs(dy) > Math.abs(dx) * 0.9) return 'scroll';
  return dx < 0 ? 'left' : 'right';
}
// A pinch merges once the fingers have come together by this share of where they started.
export function pinchMerges(startGap, gap) { return startGap > 30 && gap < startGap * 0.55; }
