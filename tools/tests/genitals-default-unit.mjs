// Genitals are off for anything new, and a save keeps whatever it was made with.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanState } from '../../src/project.js';

const base = { app: 'ink-atlas-proto', v: 2, figure: 'male', muscle: 0.5, weight: 0.5, fit: {}, tattoos: [] };
const ok = () => true;
assert.equal(cleanState({ ...base }, ok).state.genitals, true, 'a save from before the choice existed keeps them shown');
assert.equal(cleanState({ ...base, genitals: true }, ok).state.genitals, true, 'turned on stays on');
assert.equal(cleanState({ ...base, genitals: false }, ok).state.genitals, false, 'off stays off');
const app = readFileSync(new URL('../../src/app.js', import.meta.url), 'utf8');
assert.match(app.match(/const freshState = [^\n]*/)[0], /genitals: false/, 'a new project starts with them off');
assert.match(readFileSync(new URL('../../src/v47-import.js', import.meta.url), 'utf8'), /genitals:false/, 'an imported v47 backup starts with them off');
console.log('genitals-default-unit: ok');
