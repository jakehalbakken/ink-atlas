// The whole plan's sittings: in date order, clashes while another piece is fresh, one calendar file.
import assert from 'node:assert/strict';
import { planSittings, planCalendar, planCalendarText, planCalendarFile } from '../../src/sittings.js';
const rose = planSittings({ lo: 6, hi: 8, sessions: 2 }, { start: '2026-12-05', gapWeeks: 3 });
const moth = planSittings({ lo: 2, hi: 3, sessions: 1 }, { start: '2026-12-12' });
const fern = planSittings({ lo: 2, hi: 3, sessions: 1 }, { start: '' });
const cal = planCalendar([{ name: 'Rose', plan: rose }, { name: 'Moth', plan: moth }, { name: 'Fern', plan: fern }]);
assert.deepEqual(cal.all.map((x) => `${x.date} ${x.name} ${x.n}/${x.of}`), ['2026-12-05 Rose 1/2', '2026-12-12 Moth 1/1', '2026-12-26 Rose 2/2'], 'date order, undated left out');
assert.equal(cal.fresh.length, 1); assert.equal(cal.fresh[0].name, 'Moth'); assert.equal(cal.fresh[0].during.name, 'Rose');
const txt = planCalendarText(cal, '2026-11-15');
assert.equal(txt.next, 'Coming up: Sat, Dec 5 Rose, outline. Sat, Dec 12 Moth. Sat, Dec 26 Rose, shading and finish.');
assert.deepEqual(txt.clash, ['Moth on Sat, Dec 12 is while Rose is still fresh from Sat, Dec 5.']);
// from a later day: only what is still to come
const later = planCalendarText(cal, '2026-12-20');
assert.equal(later.next, 'Coming up: Sat, Dec 26 Rose, shading and finish.'); assert.deepEqual(later.clash, []);
assert.equal(planCalendarText(cal, '2027-02-01').next, '');
assert.match(planCalendarText(cal, '', 2).next, /And 1 more\.$/);
// a piece two weeks or more after: no clash; same day: no clash
const far = planCalendar([{ name: 'A', plan: planSittings({ lo: 2, hi: 3, sessions: 1 }, { start: '2026-12-01' }) }, { name: 'B', plan: planSittings({ lo: 2, hi: 3, sessions: 1 }, { start: '2026-12-15' }) }, { name: 'C', plan: planSittings({ lo: 2, hi: 3, sessions: 1 }, { start: '2026-12-01' }) }]);
assert.equal(far.fresh.length, 0);
// one calendar file with every dated sitting
const ics = planCalendarFile([{ name: 'Rose', plan: rose, wear: 'Wear a tank top.' }, { name: 'Moth', plan: moth }, { name: 'Fern', plan: fern }], new Date('2026-11-15T10:00:00Z'));
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
assert.equal((ics.match(/BEGIN:VCALENDAR/g) || []).length, 1, 'one calendar');
assert.ok(/SUMMARY:Rose: sitting 2 of 2/.test(ics) && /SUMMARY:Moth: sitting 1 of 1/.test(ics));
assert.ok(ics.includes('Wear a tank top.'));
console.log('PASS plan-calendar-unit');
