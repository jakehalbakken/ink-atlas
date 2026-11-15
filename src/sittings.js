// Session planner: a big piece split into sittings with healing time between them, from Time to
// tattoo's guess (estimate.js). Shop rule of thumb: outline first, shading next, colour last,
// about five hours a sitting at most, two to four weeks between sittings for the skin to settle,
// and about four weeks after the last one to heal. Pure maths.

const DAY = 86400000;

// hours: { lo, hi, sessions } from sessionHours; colour: share of the ink in colour (0..1);
// start: 'YYYY-MM-DD' of the first sitting or ''; gapWeeks: weeks between sittings.
// Returns { sittings: [{ n, lo, hi, what, date }], healed } with dates as 'YYYY-MM-DD' or ''.
export function planSittings(hours, { colour = 0, start = '', gapWeeks = 3 } = {}) {
  const n = Math.max(1, hours.sessions | 0), gap = Math.min(12, Math.max(1, Math.round(gapWeeks) || 3));
  const coloured = colour > 0.2;
  const what = (i) => {
    if (n === 1) return 'The whole piece';
    if (i === 0) return 'Outline';
    if (i === n - 1) return coloured ? 'Colour and finish' : 'Shading and finish';
    if (coloured && n >= 4 && i >= Math.ceil((n - 1) / 2)) return 'Colour';
    return 'Shading';
  };
  const t0 = parse(start);
  const sittings = Array.from({ length: n }, (_, i) => ({ n: i + 1, lo: hours.lo / n, hi: hours.hi / n, what: what(i), date: t0 == null ? '' : iso(t0 + i * gap * 7 * DAY) }));
  const healed = t0 == null ? '' : iso(t0 + ((n - 1) * gap + 4) * 7 * DAY);
  return { sittings, healed, gapWeeks: gap };
}

// Fresh ink stays out of pools, the sea, baths and strong sun for about two weeks.
export const KEEP_DRY_DAYS = 14;
export function clearOn(date) { const t = parse(date); return t == null ? '' : iso(t + KEEP_DRY_DAYS * DAY); }

// A trip or beach day ('YYYY-MM-DD') that lands while a sitting is still fresh. Returns null when
// it is clear, else { n, days } (the sitting it follows and how many days after) with the start
// dates that keep it clear: later (every sitting after the trip) and earlier (the last sitting
// two weeks before it, or '' when that would be before today).
export function tripClash(plan, away, today = '') {
  const a = parse(away); if (a == null || !plan.sittings.length || !plan.sittings[0].date) return null;
  const hit = plan.sittings.find((x) => { const d = parse(x.date); return a >= d && a < d + KEEP_DRY_DAYS * DAY; });
  if (!hit) return null;
  const span = (plan.sittings.length - 1) * plan.gapWeeks * 7 * DAY;
  const earlier = a - KEEP_DRY_DAYS * DAY - span, t0 = parse(today);
  return { n: hit.n, days: Math.round((a - parse(hit.date)) / DAY), later: iso(a + DAY), earlier: t0 != null && earlier < t0 ? '' : iso(earlier) };
}

function parse(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return Number.isFinite(t) && iso(t) === s ? t : null; }
function iso(t) { return new Date(t).toISOString().slice(0, 10); }

// "Sat, Dec 6" from 'YYYY-MM-DD'
export function dayWords(s) { const t = parse(s); return t == null ? '' : new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); }

// "About 2 to 3 hours" for one sitting, in half hours
export function sittingHours({ lo, hi }) {
  const a = Math.max(0.5, Math.floor(lo * 2) / 2), b = Math.max(a + 0.5, Math.ceil(hi * 2) / 2);
  const f = (x) => (x === 1 ? '1' : String(x));
  return hi <= 1.1 ? 'About an hour' : `About ${f(a)} to ${f(b)} hours`;
}

// An .ics calendar file with one all-day event per sitting, to add to the phone's calendar.
export function sittingsCalendar(name, plan, stamp = new Date(), wear = '') {
  const esc = (x) => String(x).replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const ymd = (s) => s.replace(/-/g, ''), next = (s) => iso(parse(s) + DAY).replace(/-/g, '');
  const now = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = plan.sittings.filter((x) => x.date).map((x) => [
    'BEGIN:VEVENT', `UID:${ymd(x.date)}-${x.n}-${esc(name).replace(/[^A-Za-z0-9]/g, '').slice(0, 20)}@ink-atlas`, `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${ymd(x.date)}`, `DTEND;VALUE=DATE:${next(x.date)}`,
    `SUMMARY:${esc(`${name}: sitting ${x.n} of ${plan.sittings.length} (${x.what})`)}`,
    `DESCRIPTION:${esc(`${sittingHours(x)}. Keep it out of pools, the sea, baths and strong sun until ${dayWords(clearOn(x.date))}.${wear ? ' ' + wear : ''} Planned in Ink Atlas.`)}`, 'END:VEVENT'].join('\r\n'));
  // calendar lines fold at 75 characters, the rest going on after a space
  const fold = (l) => { let out = l.slice(0, 75); for (let i = 75; i < l.length; i += 74) out += '\r\n ' + l.slice(i, i + 74); return out; };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ink Atlas//Sittings//EN', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n').split('\r\n').map(fold).join('\r\n') + '\r\n';
}

// How to sleep for the first nights after a sitting, so the fresh ink isn't pressed or rubbed:
// from which way the skin under it faces on the standing body (+z front, +x the body's own left).
export function sleepLine(pos, normal) {
  if (!pos || !normal) return '';
  const [nx, , nz] = normal, side = pos[0] > 0.05 ? 'left' : pos[0] < -0.05 ? 'right' : '', other = side === 'left' ? 'right' : side === 'right' ? 'left' : '';
  const say = (how) => `For the first few nights after each sitting, sleep ${how} so the fresh ink isn't pressed.`;
  if (nz > 0.55) return say('on your back');
  if (nz < -0.55) return say(other ? `on your front or your ${other} side` : 'on your front');
  if (Math.abs(nx) > 0.5) return say(`on your ${nx > 0 ? 'right' : 'left'} side`);
  return other ? say(`on your ${other} side`) : '';
}
