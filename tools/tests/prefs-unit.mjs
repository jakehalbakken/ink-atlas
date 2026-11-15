// Settings that follow you (src/prefs.js).
import assert from 'node:assert/strict';
import { cleanPrefs, readPrefs, writePrefs, decide, samePrefs, PREF_NAMES } from '../../src/prefs.js';

const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

assert.deepEqual(PREF_NAMES, ['light', 'hair', 'beard', 'bodyHair', 'eyes', 'rate']);
assert.deepEqual(cleanPrefs({ light: 'warm', beard: 'beardy', eyes: 'blue', rate: 150, extra: 1 }), { light: 'warm', eyes: 'blue', rate: 150 }, 'unknown values and keys dropped');
assert.deepEqual(cleanPrefs({ hair: { style: 'long', colour: 'photo', hex: '#AABBCC', x: 1 } }), { hair: { style: 'long', colour: 'photo', hex: '#aabbcc' } });
assert.deepEqual(cleanPrefs({ hair: { style: 'long', colour: 'photo' } }), {}, 'photo colour needs its colour');
assert.deepEqual(cleanPrefs({ rate: 9000 }), {}, 'rate out of range');
assert.deepEqual(cleanPrefs(null), {});

const a = mem({ 'ia-light': 'sun', 'ia-hair': JSON.stringify({ style: 'buzz', colour: 'black', hex: null }), 'ia-rate': '120', 'ia-face': 'big photo', 'ia-beard': 'nonsense' });
const p = readPrefs(a);
assert.deepEqual(p, { light: 'sun', hair: { style: 'buzz', colour: 'black', hex: null }, rate: 120 }, 'bad values are not read, the face photo never');

const b = mem({ 'ia-eyes': 'green', 'ia-rate': '90' });
assert.deepEqual(writePrefs(p, b).sort(), ['eyes', 'hair', 'light', 'rate'], 'what changed');
assert.deepEqual(readPrefs(b), p, 'the device now matches, eyes cleared');
assert.equal(b.getItem('ia-eyes'), null);
assert.deepEqual(writePrefs(p, b), [], 'nothing left to change');
assert.equal(readPrefs({ getItem() { throw new Error('blocked'); } }).light, undefined, 'blocked storage reads as nothing');

// which way they go
assert.equal(decide({}, 0, null), 'none', 'nothing set anywhere');
assert.equal(decide(p, 5, null), 'send', 'first device sends');
assert.equal(decide({}, 0, { at: 10, s: p }), 'take', 'a fresh device takes the account\'s');
assert.equal(decide({ light: 'warm' }, 0, { at: 10, s: p }), 'take', 'never changed here: take');
assert.equal(decide({ light: 'warm' }, 20, { at: 10, s: p }), 'send', 'changed here since');
assert.equal(decide({ light: 'warm' }, 5, { at: 10, s: p }), 'take', 'changed there since');
assert.equal(decide(p, 99, { at: 10, s: p }), 'none', 'already the same');
assert.equal(decide(p, 5, { at: 'x', s: {} }), 'send', 'a broken account copy is replaced');
assert.ok(samePrefs({ rate: 100, junk: 1 }, { rate: 100 }));
assert.ok(JSON.stringify({ at: Date.now(), s: cleanPrefs({ light: 'studio', hair: { style: 'long', colour: 'photo', hex: '#123456' }, beard: 'full', bodyHair: 'light', eyes: 'hazel', rate: 4999 }) }).length < 260, 'small enough to ride along with sign-in');
console.log('prefs-unit: ok');
