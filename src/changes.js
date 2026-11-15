// What changed in a shared project since this person last looked: the project as it was then
// (before) against the project now (after). Pure; the app turns each line into a tap that
// shows the tattoo or the comment. Comments and answers say who; other changes don't, since a
// save only knows who saved last, not who made each change.
//
// opts.me: this person's name, so their own comments and answers are left out.
// opts.inches(width): a tattoo's width in inches, for "made bigger (3.1 to 3.6 in)".

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const list = (s, k) => (s && Array.isArray(s[k]) ? s[k].filter((x) => x && typeof x === 'object' && typeof x.id === 'string') : []);
const byId = (xs) => new Map(xs.map((x) => [x.id, x]));
const quote = (s, n = 60) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const nameOf = (t) => '"' + quote(t.name || 'Tattoo', 40) + '"';
const BODY = ['figure', 'muscle', 'weight', 'fit', 'heightCm', 'genitals'];

export function changesBetween(before, after, opts = {}) {
  const out = [], me = opts.me || '', inch = opts.inches;
  if (!before || !after) return out;
  const B = byId(list(before, 'tattoos')), A = list(after, 'tattoos');
  for (const t of A) {
    const o = B.get(t.id);
    if (!o) { out.push({ kind: 'added', text: `Added ${nameOf(t)}`, tattooId: t.id }); continue; }
    const what = [];
    if ((o.name || '') !== (t.name || '')) out.push({ kind: 'renamed', text: `Renamed ${nameOf(o)} to ${nameOf(t)}`, tattooId: t.id });
    if (o.img !== t.img) what.push('changed the artwork');
    const moved = Array.isArray(o.pos) && Array.isArray(t.pos) ? Math.hypot(o.pos[0] - t.pos[0], o.pos[1] - t.pos[1], o.pos[2] - t.pos[2]) : 0;
    if (moved > 0.004) what.push('moved it');
    if (Math.abs((t.width || 0) - (o.width || 0)) > 0.02 * (o.width || 0.1)) {
      const big = t.width > o.width;
      what.push((big ? 'made it bigger' : 'made it smaller') + (inch ? ` (${inch(o.width).toFixed(1)} to ${inch(t.width).toFixed(1)} in)` : ''));
    }
    if (Math.abs((t.rot || 0) - (o.rot || 0)) > 0.035) what.push('turned it');
    if (['wrap', 'bend', 'taper'].some((k) => Math.abs((t[k] || 0) - (o[k] || 0)) > 0.02)) what.push('changed how it wraps');
    if (!!t.flip !== !!o.flip) what.push('mirrored it');
    if ((t.status === 'existing') !== (o.status === 'existing')) what.push(t.status === 'existing' ? 'marked it as already on you' : 'marked it as planned');
    if (!!t.hidden !== !!o.hidden) what.push(t.hidden ? 'hid it' : 'showed it again');
    if (what.length) out.push({ kind: 'edited', text: `${nameOf(t)}: ${what.join(', ')}`, tattooId: t.id });
    const r = t.review, ro = o.review;
    if (r && !same(r, ro) && (r.by || '') !== me) {
      out.push(r.verdict === 'approved'
        ? { kind: 'answer', text: `${r.by || 'Someone'} said yes to ${nameOf(t)}`, tattooId: t.id }
        : { kind: 'answer', text: `${r.by || 'Someone'} asked for a change on ${nameOf(t)}` + (r.note ? `: "${quote(r.note)}"` : ''), tattooId: t.id });
    }
  }
  const Aid = new Set(A.map((t) => t.id));
  for (const [id, o] of B) if (!Aid.has(id)) out.push({ kind: 'removed', text: `Removed ${nameOf(o)}` });

  const BN = byId(list(before, 'notes'));
  for (const n of list(after, 'notes')) {
    if (BN.has(n.id) || (n.by || '') === me) continue;
    out.push({ kind: 'comment', text: `${n.by || 'Someone'} commented: "${quote(n.text)}"`, noteId: n.id, pinned: !!n.pin });
  }
  for (const n of list(after, 'notes')) {
    const o = BN.get(n.id); if (!o) continue;
    const had = new Set((Array.isArray(o.replies) ? o.replies : []).map((r) => r && r.id));
    for (const r of Array.isArray(n.replies) ? n.replies : []) {
      if (!r || had.has(r.id) || (r.by || '') === me) continue;
      out.push({ kind: 'reply', text: `${r.by || 'Someone'} replied to "${quote(n.text, 30)}": "${quote(r.text)}"`, noteId: n.id, pinned: !!n.pin });
    }
    if (!!n.done !== !!o.done) {
      const who = n.done ? n.done.by : '';
      if (!n.done || who !== me) out.push({ kind: 'resolved', text: n.done ? `${who || 'Someone'} marked "${quote(n.text, 40)}" resolved` : `Reopened "${quote(n.text, 40)}"`, noteId: n.id, pinned: !!n.pin });
    }
  }
  const BR = byId(list(before, 'refs'));
  const newRefs = list(after, 'refs').filter((r) => !BR.has(r.id) && (r.by || '') !== me);
  if (newRefs.length) {
    const who = [...new Set(newRefs.map((r) => r.by || 'Someone'))].join(' and ');
    out.push({ kind: 'refs', text: `${who} added ${newRefs.length === 1 ? 'a reference picture' : newRefs.length + ' reference pictures'}`, refId: newRefs[0].id });
  }
  if (BODY.some((k) => !same(before[k], after[k]))) out.push({ kind: 'body', text: 'Changed the body shape' });
  if (before.skin !== after.skin || (before.skinHex || '') !== (after.skinHex || '')) out.push({ kind: 'skin', text: 'Changed the skin tone' });
  return out;
}
