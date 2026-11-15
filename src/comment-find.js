// Find a comment by what it says. Pure: a comment matches when every word of the search
// appears somewhere in its text, its replies, who wrote them, or the tattoo it is on.
// Case and accents do not matter, so "jose" finds "José".

const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

export function words(query) {
  return fold(query).split(/\s+/).filter(Boolean);
}

export function commentHaystack(n, tattooName) {
  const parts = [n && n.text, n && n.by, tattooName];
  for (const r of (n && Array.isArray(n.replies) ? n.replies : [])) parts.push(r && r.text, r && r.by);
  return fold(parts.filter(Boolean).join('\n'));
}

export function matchesComment(n, query, tattooName) {
  const w = words(query); if (!w.length) return true;
  const hay = commentHaystack(n, tattooName);
  return w.every((x) => hay.includes(x));
}
