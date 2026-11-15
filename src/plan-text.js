// The plan as a message: every planned tattoo in a few plain lines, to paste into a text or an
// email to the artist. Pure: the app hands over each piece's words already worked out.

// planned: [{ name, size, where, time, first, note }] (any of the words may be ''); onMe: names of
// the ones already on the body with where they are ([{ name, where }]). Returns the message.
export function planMessage(planned, onMe = []) {
  if (!planned.length) return '';
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  const head = planned.length === 1 ? 'My tattoo plan:' : `My tattoo plan, ${planned.length} pieces:`;
  const lines = planned.map((p, i) => {
    const bits = [clean(p.size), clean(p.where) && lowerFirst(clean(p.where))].filter(Boolean).join(', ');
    let line = `${planned.length > 1 ? i + 1 + '. ' : ''}${clean(p.name) || 'Tattoo'}${bits ? ': ' + bits : ''}.`;
    if (clean(p.time)) line += ` ${clean(p.time)}.`;
    if (clean(p.first)) line += ` First sitting ${clean(p.first)}.`;
    if (clean(p.note)) line += ` Note: ${clean(p.note)}.`;
    return line;
  });
  const out = [head, '', ...lines];
  if (onMe.length) out.push('', 'Already on me: ' + onMe.map((o) => clean(o.where) ? `${clean(o.name) || 'a tattoo'} (${lowerFirst(clean(o.where))})` : clean(o.name) || 'a tattoo').join(', ') + '.');
  return out.join('\n');
}
function lowerFirst(s) { return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; }
