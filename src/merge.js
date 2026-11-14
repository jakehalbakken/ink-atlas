// Putting two people's changes to one shared project together, so nobody's work is lost.
// base is the project as it was when this device last matched the account, local is what is
// on this screen now, remote is what the account holds now (someone else saved since).
//
// Lists of things with ids (tattoos, notes, layouts...) are merged item by item, and each
// item field by field: a field changed here wins, otherwise the account's value is taken.
// Something added on either side is kept. Something removed on one side goes, unless the
// other side changed it meanwhile (then it stays, so an edit is never thrown away).
// Any other setting: changed here wins, otherwise the account's.
// Without a base (this device does not know what was last in step) nothing is removed and
// this device's values win where both have one.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isIdList = (v) => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string' && x.id);

function mergeItem(b, l, r) {
  if (!b) return { ...r, ...l };
  const out = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r), ...Object.keys(b)])) {
    const v = same(l[k], b[k]) ? r[k] : l[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function mergeList(b, l, r) {
  const byId = (list) => new Map((list || []).map((x) => [x.id, x]));
  const B = byId(b), L = byId(l), R = byId(r), keep = new Map();
  for (const [id, lv] of L) {
    const bv = B.get(id), rv = R.get(id);
    if (rv) keep.set(id, mergeItem(bv, lv, rv));
    else if (!bv || !same(lv, bv)) keep.set(id, lv); // added here, or changed here after it was removed there
  }
  for (const [id, rv] of R) {
    if (L.has(id)) continue;
    const bv = B.get(id);
    if (!bv || !same(rv, bv)) keep.set(id, rv); // added there, or changed there after it was removed here
  }
  // this device's order, with things added elsewhere slotted in after what came before them there
  const order = (l || []).map((x) => x.id).filter((id) => keep.has(id));
  (r || []).forEach((x, i) => {
    if (!keep.has(x.id) || order.includes(x.id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) { const k = order.indexOf(r[j].id); if (k >= 0) { at = k + 1; break; } }
    order.splice(at, 0, x.id);
  });
  return order.map((id) => keep.get(id));
}

export function mergeStates(base, local, remote) {
  const b = base && typeof base === 'object' ? base : null;
  const out = {};
  for (const k of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    const lv = local[k], rv = remote[k], bv = b ? b[k] : undefined;
    let v;
    if (lv === undefined) v = b && same(rv, bv) && bv !== undefined ? undefined : rv; // removed here, unchanged there: stays removed
    else if (rv === undefined) v = b && same(lv, bv) ? undefined : lv; // removed there, unchanged here
    else if (isIdList(lv) && isIdList(rv) && (bv === undefined || isIdList(bv))) v = mergeList(b ? bv || [] : null, lv, rv);
    else v = !b ? lv : same(lv, bv) ? rv : lv;
    if (v !== undefined) out[k] = v;
  }
  return out;
}
