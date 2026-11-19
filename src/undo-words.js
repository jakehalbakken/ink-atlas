// What an undo or redo step changed, in a few plain words for a toast: "moving Rose",
// "adding 2 tattoos", "the body shape". Pure: compares two saved states (before and after the
// step). Returns '' when nothing it can name changed.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// one tattoo's change, the most telling field first
const FIELDS = [
  ['pos', 'moving'], ['width', 'resizing'], ['rot', 'turning'], ['img', 'the artwork of'], ['versions', 'the artwork of'],
  ['wrap', 'the wrap on'], ['bend', 'the wrap on'], ['taper', 'the wrap on'], ['flip', 'mirroring'], ['opacity', 'the ink strength of'], ['blend', 'the blend mode of'], ['adjust', 'the colours of'],
  ['status', null], ['hidden', null], ['locked', null], ['name', 'renaming'], ['note', 'the note on'], ['sittings', 'the sittings for'],
  ['made', 'the artist details of'], ['review', 'the answer on'],
];
function oneTattoo(a, b) {
  const name = b.name || a.name || 'the tattoo';
  for (const [k, word] of FIELDS) {
    if (same(a[k], b[k])) continue;
    if (k === 'status') return b.status === 'existing' ? `marking ${name} as already on you` : `marking ${name} as planned`;
    if (k === 'hidden') return `${b.hidden ? 'hiding' : 'showing'} ${name}`;
    if (k === 'locked') return `${b.locked ? 'locking' : 'unlocking'} ${name}`;
    if (k === 'name') return `renaming ${a.name || 'the tattoo'}`;
    return `${word} ${name}`;
  }
  return same(a, b) ? '' : `the change to ${name}`;
}
export function changeWords(before, after) {
  if (!before || !after) return '';
  const A = new Map((before.tattoos || []).map((t) => [t.id, t])), B = new Map((after.tattoos || []).map((t) => [t.id, t]));
  const added = [...B.keys()].filter((id) => !A.has(id)), removed = [...A.keys()].filter((id) => !B.has(id));
  const changed = [...B.keys()].filter((id) => A.has(id) && !same(A.get(id), B.get(id)));
  if (added.length && !removed.length) return added.length === 1 ? `adding ${B.get(added[0]).name || 'a tattoo'}` : `adding ${added.length} tattoos`;
  if (removed.length && !added.length) return removed.length === 1 ? `removing ${A.get(removed[0]).name || 'a tattoo'}` : `removing ${removed.length} tattoos`;
  if (added.length || removed.length) return 'the change to the tattoos';
  if (changed.length === 1) return oneTattoo(A.get(changed[0]), B.get(changed[0]));
  if (changed.length > 1) {
    // all of them moved or changed the same way, like a layout switch or a group move
    const kinds = new Set(changed.map((id) => oneTattoo(A.get(id), B.get(id)).split(' ')[0]));
    const k = kinds.size === 1 ? [...kinds][0] : '';
    return k === 'moving' ? `moving ${changed.length} tattoos` : k === 'resizing' ? `resizing ${changed.length} tattoos` : `changes to ${changed.length} tattoos`;
  }
  if (!same([...A.keys()], [...B.keys()])) return 'reordering the tattoos';
  const diff = (k) => !same(before[k], after[k]);
  if (['fit', 'muscle', 'weight', 'figure', 'genitals', 'measured'].some(diff)) return 'the body shape';
  if (diff('heightCm')) return 'the height';
  if (['skin', 'skinHex'].some(diff)) return 'the skin tone';
  if (diff('paint')) return 'the paint';
  if (diff('notes')) return 'the comments';
  if (diff('refs')) return 'the reference pictures';
  if (['drawings', 'sketchPatch'].some(diff)) return 'the drawing';
  if (diff('unplacedTattoos')) return 'the unplaced tattoos';
  if (diff('artworks')) return 'the artwork library';
  if (diff('projectName')) return 'renaming the project';
  return same(before, after) ? '' : 'the last change';
}
// The toast for an undo (or a redo) of that step.
export function undoToast(words, redo = false) {
  return words ? `${redo ? 'Redid' : 'Undid'} ${words}.` : redo ? 'Redone.' : 'Undone.';
}

// The steps Undo can go back through, newest first: [{ steps, words }] where steps is how many
// undos reach the state before that change. stack: saved states oldest first (JSON strings);
// now: the current state. At most `max` rows; a step whose change has no name says 'A change'.
export function historyList(stack, now, max = 15) {
  const out = [];
  let after = typeof now === 'string' ? JSON.parse(now) : now;
  for (let i = stack.length - 1, steps = 1; i >= 0 && out.length < max; i--, steps++) {
    let before; try { before = JSON.parse(stack[i]); } catch { break; }
    let w = ''; try { w = changeWords(before, after); } catch { w = ''; }
    out.push({ steps, words: w ? w[0].toUpperCase() + w.slice(1) : 'A change' });
    after = before;
  }
  return out;
}
