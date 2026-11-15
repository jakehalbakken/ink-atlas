// Plan as a message (src/plan-text.js): every planned piece on a numbered line with its size,
// where it sits, time, first sitting and note; ink already on in one line at the end; plain text.
import assert from 'node:assert/strict';
import { planMessage } from '../../src/plan-text.js';

const two = planMessage([
  { name: 'Sunburst', size: '3.0 × 3.0 in (8 × 8 cm)', where: 'Chest, left side: centre 3.0 in (8 cm) left of centre.', time: 'About 1 to 2 hours, one session.', first: 'Sat, Dec 5', note: 'Keep the lines thin' },
  { name: 'Sprig', size: '2.0 × 4.0 in (5 × 10 cm)', where: '', time: '' },
], [{ name: 'Rose', where: 'Forearm, outside' }]);
assert.equal(two, [
  'My tattoo plan, 2 pieces:', '',
  '1. Sunburst: 3.0 × 3.0 in (8 × 8 cm), chest, left side: centre 3.0 in (8 cm) left of centre. About 1 to 2 hours, one session. First sitting Sat, Dec 5. Note: Keep the lines thin.',
  '2. Sprig: 2.0 × 4.0 in (5 × 10 cm).', '',
  'Already on me: Rose (forearm, outside).',
].join('\n'));
assert.equal(planMessage([{ name: '', size: '1.0 × 1.0 in' }]), 'My tattoo plan:\n\nTattoo: 1.0 × 1.0 in.', 'one piece, no number, no name');
assert.equal(planMessage([], [{ name: 'Rose' }]), '', 'nothing planned: nothing to send');
assert.equal(planMessage([{ name: 'A', note: 'Line one\n  line two...' }]), 'My tattoo plan:\n\nA. Note: Line one line two.', 'a note on one line');
assert.ok(!/—/.test(two), 'no em-dashes');
console.log('PASS plan-text-unit');
