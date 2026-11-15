// Session estimate: a rough guess at how long a tattoo takes to do, from its real size, how
// much of that area is ink, and whether it is in colour. Built from the usual shop rules of
// thumb: a small line piece is about an hour with setup, a palm-sized shaded piece two to three
// hours, a full sleeve forty to sixty. Every artist works at their own pace, so it is a range.
// Pure maths.

// widthIn, heightIn: the piece's box in inches; fill: share of the box that is ink (0..1);
// colour: share of the ink that is coloured (0..1). Returns { lo, hi, sessions } in hours.
export function sessionHours({ widthIn, heightIn, fill, colour = 0 }) {
  const box = Math.max(0, widthIn * heightIn), f = Math.max(0, Math.min(1, fill));
  const work = box * (0.04 + 0.16 * f) * (1 + 0.3 * Math.max(0, Math.min(1, colour)));
  const mid = 0.5 + work, lo = Math.max(0.5, mid * 0.8), hi = mid * 1.25;
  // most artists stop at about five hours in one sitting
  const sessions = Math.max(1, Math.ceil(mid / 5));
  return { lo, hi, sessions };
}

// the range in half hours up to eight hours, whole hours past that
function span(lo, hi) {
  const step = hi > 8 ? 1 : 0.5, a = Math.max(1, Math.floor(lo / step) * step), b = Math.max(a + step, Math.ceil(hi / step) * step);
  return [a, b];
}

// "About 3 to 4 hours, one session." and, with an hourly rate, " About $450 to $600 at $150
// an hour."
export function sessionText({ lo, hi, sessions }, rate = 0) {
  let line;
  if (hi <= 1.1) line = 'About an hour or less, one session.';
  else {
    const [a, b] = span(lo, hi);
    line = `About ${a} to ${b} hours, ${sessions === 1 ? 'one session' : sessions === 2 ? 'two sessions' : `about ${sessions} sessions`}.`;
  }
  if (rate > 0) {
    const [a, b] = hi <= 1.1 ? [1, 1] : span(lo, hi);
    const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
    line += a === b ? ` About ${money(a * rate)} at ${money(rate)} an hour.` : ` About ${money(a * rate)} to ${money(b * rate)} at ${money(rate)} an hour.`;
  }
  return line;
}

// The whole plan: hours added up over every planned piece.
export function planHours(list) {
  let lo = 0, hi = 0, sessions = 0;
  for (const h of list) { lo += h.lo; hi += h.hi; sessions += h.sessions; }
  return { lo, hi, sessions };
}

// "All 4 planned tattoos: about 12 to 16 hours, about 6 sessions." with the price at a rate, as
// one line under a selected tattoo's own guess. Each piece counts its own sessions.
export function planText(list, rate = 0) {
  if (list.length < 2) return '';
  const t = sessionText(planHours(list), rate);
  return `All ${list.length} planned tattoos: ${t[0].toLowerCase()}${t.slice(1)}`;
}

