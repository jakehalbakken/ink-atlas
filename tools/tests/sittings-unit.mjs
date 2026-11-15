// Session planner maths (src/sittings.js): a piece splits into the sessions Time to tattoo gave,
// outline first and finish last, colour late in a coloured piece; dates step by the weeks
// between, healed four weeks after the last; the calendar file has one all-day event a sitting.
// Run: node tools/tests/sittings-unit.mjs
import assert from 'node:assert/strict';
import { planSittings, dayWords, sittingHours, sittingsCalendar } from '../../src/sittings.js';

const one = planSittings({ lo: 2, hi: 3, sessions: 1 });
assert.equal(one.sittings.length, 1); assert.equal(one.sittings[0].what, 'The whole piece'); assert.equal(one.healed, '', 'no date, no healed date');
const grey = planSittings({ lo: 12, hi: 18, sessions: 3 }, { start: '2026-12-05', gapWeeks: 3 });
assert.deepEqual(grey.sittings.map((x) => x.what), ['Outline', 'Shading', 'Shading and finish']);
assert.deepEqual(grey.sittings.map((x) => x.date), ['2026-12-05', '2026-12-26', '2027-01-16'], 'three weeks apart, over the new year');
assert.equal(grey.healed, '2027-02-13', 'healed four weeks after the last');
assert.ok(Math.abs(grey.sittings[0].lo - 4) < 1e-9 && Math.abs(grey.sittings[0].hi - 6) < 1e-9, 'hours shared out');
const col = planSittings({ lo: 20, hi: 30, sessions: 5 }, { colour: 0.6, start: '2026-11-20', gapWeeks: 4 });
assert.deepEqual(col.sittings.map((x) => x.what), ['Outline', 'Shading', 'Colour', 'Colour', 'Colour and finish']);
assert.equal(planSittings({ lo: 8, hi: 10, sessions: 2 }, { gapWeeks: 99 }).gapWeeks, 12, 'weeks between capped');
assert.equal(planSittings({ lo: 8, hi: 10, sessions: 2 }, { start: '2026-02-30' }).healed, '', 'a date that is not real gives no dates');
assert.equal(dayWords('2026-12-05'), 'Sat, Dec 5');
assert.equal(sittingHours({ lo: 4, hi: 6 }), 'About 4 to 6 hours');
assert.equal(sittingHours({ lo: 0.6, hi: 0.9 }), 'About an hour');
const ics = sittingsCalendar('Rose, back; big', grey, new Date('2026-11-15T10:00:00Z'));
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
assert.ok(ics.includes('DTSTART;VALUE=DATE:20261205') && ics.includes('DTEND;VALUE=DATE:20261206'), 'all-day events');
assert.ok(ics.includes('SUMMARY:Rose\\, back\\; big: sitting 1 of 3 (Outline)'), 'commas and semicolons escaped');
assert.ok(ics.split('\r\n').every((l) => l.length <= 75), 'lines short enough for calendars');
assert.equal(sittingsCalendar('X', planSittings({ lo: 2, hi: 3, sessions: 2 })).includes('VEVENT'), false, 'no dates, no events');
console.log('sittings-unit: ok');
