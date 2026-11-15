// @mentions in comments and replies. Pure: which names a text mentions, whether it mentions
// this person, the half-typed @word at the caret, and which names to offer for it.
// A name is matched by its first word, so "@Liv" mentions "Liv Moreno". Case does not matter.

const WORD = /@([\p{L}\p{N}][\p{L}\p{N}'_-]*)/gu;
const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const norm = (s) => String(s || '').toLocaleLowerCase();

export function mentioned(text) {
  const out = [];
  for (const m of String(text || '').matchAll(WORD)) {
    // an email address is not a mention
    const before = m.index > 0 ? text[m.index - 1] : ' ';
    if (/[\p{L}\p{N}._-]/u.test(before)) continue;
    out.push(m[1]);
  }
  return out;
}

export function mentionsMe(text, me) {
  const f = norm(first(me)); if (!f) return false;
  return mentioned(text).some((w) => norm(w) === f);
}

// Pieces of the text for showing it: [{ text, me }] where me marks a mention of this person.
export function pieces(text, me) {
  const s = String(text || ''), f = norm(first(me)), out = [];
  let at = 0;
  if (f) for (const m of s.matchAll(WORD)) {
    const before = m.index > 0 ? s[m.index - 1] : ' ';
    if (/[\p{L}\p{N}._-]/u.test(before) || norm(m[1]) !== f) continue;
    if (m.index > at) out.push({ text: s.slice(at, m.index), me: false });
    out.push({ text: m[0], me: true }); at = m.index + m[0].length;
  }
  if (at < s.length || !out.length) out.push({ text: s.slice(at), me: false });
  return out;
}

// The @word being typed at the caret: { start, end, partial } or null.
export function typingMention(value, caret) {
  const s = String(value || ''), c = caret == null ? s.length : caret;
  const left = s.slice(0, c), m = /(^|[^\p{L}\p{N}._-])@([\p{L}\p{N}'_-]*)$/u.exec(left);
  if (!m) return null;
  const start = c - m[2].length - 1;
  let end = c; while (end < s.length && /[\p{L}\p{N}'_-]/u.test(s[end])) end++;
  return { start, end, partial: m[2] };
}

// Names to offer for a partial word: first words of the people on the project, without
// this person, starting with the partial, at most four, each once.
export function offer(partial, names, me) {
  const p = norm(partial), mine = norm(first(me)), seen = new Set(), out = [];
  for (const n of names) {
    const f = first(n), k = norm(f);
    if (!f || k === mine || seen.has(k) || !k.startsWith(p)) continue;
    seen.add(k); out.push(f);
    if (out.length >= 4) break;
  }
  return out;
}

// Put a name in place of the half-typed word; returns { value, caret }.
export function insertMention(value, at, name) {
  const s = String(value || ''), tail = s.slice(at.end);
  const add = '@' + name + (tail.startsWith(' ') ? '' : ' ');
  return { value: s.slice(0, at.start) + add + tail, caret: at.start + add.length };
}
