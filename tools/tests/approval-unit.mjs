// Ask for approval maths: the page holds every tattoo safely escaped with its pictures and a
// plain-reply fallback; the answers text it makes reads back exactly; loose typed replies
// ("1 yes, 2 change: smaller", "Sprig: no", thumbs) read back too; answers only go to the
// tattoos that were asked about; stored answers and asks are checked when a project opens.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeRef, approvalHtml, parseAnswers, cleanReview, cleanAsks } from '../../src/approval.js';
import { cleanState } from '../../src/project.js';

const ref = makeRef(() => 0.5); assert.match(ref, /^[A-Z2-9]{5}$/);
const px = 'data:image/png;base64,iVBORw0KGgo=';
const items = [
  { n: 1, name: 'Sunburst', size: '4.5 in wide (11 cm)', status: 'planned', closeUp: px, art: px },
  { n: 2, name: 'Sprig <b>"x"</b>', size: '3 in wide (7.6 cm)', status: 'planned', closeUp: 'javascript:alert(1)', art: px },
];
const html = approvalHtml({ title: 'My plan & <ideas>', ref, items, date: '14 Nov' });
assert.ok(html.startsWith('<!doctype html>'));
assert.ok(html.includes('My plan &amp; &lt;ideas&gt;') && !html.includes('<ideas>'), 'title escaped');
assert.ok(html.includes('Sprig &lt;b&gt;&quot;x&quot;&lt;/b&gt;') && !html.includes('<b>"x"'), 'names escaped');
assert.ok(!html.includes('javascript:alert'), 'only picture data goes in an img');
assert.equal((html.match(/<section class="card"/g) || []).length, 2);
assert.ok(html.includes('Reference ' + ref), 'the plain reply fallback carries the reference');
assert.ok(!/https?:\/\//.test(html), 'nothing loads from anywhere: no web addresses');
assert.ok(html.includes('name="v1"') && html.includes('name="v2"') && html.includes('name="t2"'));

// run the page's own script on a pretend page: its answers text reads back exactly
const field = (v) => ({ value: v });
const checked = { v1: 'yes', v2: 'change' }, notes = { t1: '', t2: 'a  little\nsmaller' };
let shared = null; const listeners = {};
const doc = {
  querySelector: (q) => { let m = q.match(/name="(v\d)"\]:checked/); if (m) return checked[m[1]] ? field(checked[m[1]]) : null; m = q.match(/name="(t\d)"/); if (m) return field(notes[m[1]] || ''); return null; },
  getElementById: (id) => ({ by: field('Sam'), also: field('Love the layout'), send: { addEventListener: (e, f) => { listeners.send = f; } }, out: { style: {}, textContent: '' }, done: { textContent: '' } })[id],
};
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
vm.runInNewContext(script, { document: doc, navigator: { share: (d) => { shared = d.text; return { then: (a) => a() }; } } });
listeners.send();
assert.ok(shared, 'Send my answers shares text');
assert.equal(shared.split('\n')[0], `Tattoo plan answers (ref ${ref})`);
assert.equal(shared.split('\n')[2], '2 Sprig <b>"x"</b>: change: a little smaller');
const tattoos = [{ id: 'a', name: 'Sunburst' }, { id: 'b', name: 'Sprig <b>"x"</b>' }, { id: 'c', name: 'Rose' }];
const asks = [{ ref: 'OLDAA', ids: ['c'] }, { ref, ids: ['a', 'b'] }];
let r = parseAnswers(shared, asks, tattoos);
assert.equal(r.ask, ref); assert.ok(r.refMatched); assert.equal(r.by, 'Sam'); assert.equal(r.note, 'Love the layout');
assert.deepEqual(r.answers, [{ id: 'a', verdict: 'approved', note: '' }, { id: 'b', verdict: 'changes', note: 'a little smaller' }]);

// loose typed replies, against the newest ask when no reference is given
r = parseAnswers('1 yes, 2 change: smaller please', asks, tattoos);
assert.equal(r.refMatched, false); assert.equal(r.ask, ref);
assert.deepEqual(r.answers, [{ id: 'a', verdict: 'approved', note: '' }, { id: 'b', verdict: 'changes', note: 'smaller please' }]);
r = parseAnswers('1. Love it!\n2) no - move it up a bit', asks, tattoos);
assert.deepEqual(r.answers.map((a) => [a.id, a.verdict, a.note]), [['a', 'approved', ''], ['b', 'changes', 'move it up a bit']]);
r = parseAnswers('#1 \u{1F44D}\n#2 make it thinner', asks, tattoos);
assert.deepEqual(r.answers.map((a) => [a.verdict, a.note]), [['approved', ''], ['changes', 'make it thinner']]);
r = parseAnswers('Sunburst: yes\nRose: change it: darker', asks, tattoos);
assert.deepEqual(r.answers.map((a) => [a.id, a.verdict, a.note]), [['a', 'approved', ''], ['c', 'changes', 'darker']], 'by name, any tattoo');
// an older ask by its reference; numbers past the ask are not read; no answer is skipped
r = parseAnswers('ref OLDAA\n1 yes\n2 yes', asks, tattoos);
assert.equal(r.ask, 'OLDAA'); assert.deepEqual(r.answers.map((a) => a.id), ['c']); assert.equal(r.unread.length, 1);
r = parseAnswers(`ref ${ref}\n1 Sunburst: no answer\n2 yes`, asks, tattoos);
assert.deepEqual(r.answers.map((a) => a.id), ['b']);
// a word that only starts like yes is not a yes
r = parseAnswers('1 nothing to change\n2 okayish but smaller', asks, tattoos);
assert.equal(r.answers[0].verdict, 'changes'); assert.equal(r.answers[1].verdict, 'changes');
// nothing asked: names still work, numbers do not
r = parseAnswers('1 yes\nSunburst: yes', [], tattoos); assert.deepEqual(r.answers.map((a) => a.id), ['a']);
assert.deepEqual(parseAnswers('', asks, tattoos).answers, []);

// stored answers and asks are checked on open, and older projects have neither
assert.deepEqual(cleanReview({ verdict: 'approved', note: 'x', by: 'Sam', at: '2026-11-14', extra: 1 }), { verdict: 'approved', note: 'x', by: 'Sam', at: '2026-11-14' });
assert.equal(cleanReview({ verdict: 'maybe' }), null); assert.equal(cleanReview('yes'), null);
assert.deepEqual(cleanAsks([{ ref: 'ABCDE', ids: ['a', 3], at: 5 }, { ref: 'bad', ids: [] }]), [{ ref: 'ABCDE', ids: ['a'], at: 5 }]);
assert.equal(cleanAsks([]), null); assert.equal(cleanAsks('x'), null);
const img = () => true;
const base = { v: 2, tattoos: [{ id: 'a', img: 'k', name: 'A', width: 0.1, aspect: 1, pos: [0, 1, 0.1], normal: [0, 0, 1] }] };
let s = cleanState(base, img).state; assert.equal(s.tattoos[0].review, undefined); assert.equal(s.asks, undefined, 'an older project opens as it was');
s = cleanState({ ...base, asks: [{ ref: 'ABCDE', ids: ['a'], at: 1 }], tattoos: [{ ...base.tattoos[0], review: { verdict: 'changes', note: 'smaller', by: 'Sam', at: '2026-11-14' } }] }, img).state;
assert.equal(s.tattoos[0].review.verdict, 'changes'); assert.equal(s.asks[0].ref, 'ABCDE');
s = cleanState({ ...base, asks: 'nope', tattoos: [{ ...base.tattoos[0], review: { verdict: 'hmm' } }] }, img).state;
assert.equal(s.tattoos[0].review, undefined); assert.equal(s.asks, undefined, 'damaged answers are dropped, the tattoo kept');
console.log('PASS approval-unit: safe page, its answers read back, loose replies, refs, stored answers checked');
