// Pain map maths: the places common tattoo pain charts agree on rate the way they say (ribs,
// sternum, knees, elbows, hands, feet, armpits and groin high; outer arm, outer thigh, calf
// and buttock low), facing is read from the normal and the body's side, joints win over the
// limb, the colours run green to red, smoothing softens edges without moving the extremes,
// and a tattoo's area gives its usual level, its place and its worst part.
import assert from 'node:assert/strict';
import { painFor, facing, painMap, smoothLevels, painColour, painWords, painLine, vertexNeighbours, painUnder } from '../../src/pain.js';

const far = { knee: 1, elbow: 1, wrist: 1, ankle: 1, shoulder: 1 };
const L = (bone, face, centre = false, near = far, down = false) => painFor(bone, face, centre, near, down);
// what the charts agree on
assert.equal(L('spine03', 'out').place, 'Ribs'); assert.ok(L('spine03', 'out').level >= 8);
assert.equal(L('spine02', 'front', true).place, 'Sternum'); assert.ok(L('spine02', 'front', true).level >= 8);
assert.equal(L('spine04', 'back', true).place, 'Spine');
assert.equal(L('upperarm02.L', 'out').place, 'Upper arm, outside'); assert.ok(L('upperarm02.L', 'out').level <= 3);
assert.equal(L('upperleg02.R', 'out').place, 'Thigh, outside'); assert.ok(L('upperleg02.R', 'out').level <= 3);
assert.equal(L('lowerleg01.L', 'back').place, 'Calf'); assert.ok(L('lowerleg01.L', 'back').level <= 3);
assert.equal(L('pelvis.L', 'back').place, 'Buttock');
assert.equal(L('lowerleg01.L', 'front').place, 'Shin'); assert.ok(L('lowerleg01.L', 'front').level >= 7);
assert.equal(L('upperleg01.L', 'in').place, 'Inner thigh');
assert.equal(L('foot.R', 'front').place, 'Foot'); assert.equal(L('finger2-2.L', 'out').place, 'Fingers');
assert.equal(L('genital', 'front').place, 'Groin'); assert.equal(L('genital', 'front').level, 9);
assert.equal(L('neck01', 'front').place, 'Throat'); assert.equal(L('neck01', 'back').place, 'Back of neck');
assert.equal(L('head', 'front').place, 'Face'); assert.equal(L('jaw', 'back').place, 'Head');
// joints win over the limb
assert.equal(L('upperleg02.L', 'front', false, { ...far, knee: 0.03 }).place, 'Knee');
assert.equal(L('lowerleg01.L', 'back', false, { ...far, knee: 0.03 }).place, 'Back of knee');
assert.equal(L('lowerarm01.R', 'back', false, { ...far, elbow: 0.02 }).place, 'Elbow');
assert.equal(L('lowerarm01.R', 'front', false, { ...far, elbow: 0.02 }).place, 'Inner elbow');
assert.equal(L('lowerarm02.R', 'front', false, { ...far, wrist: 0.02 }).place, 'Wrist');
assert.equal(L('lowerleg02.R', 'out', false, { ...far, ankle: 0.02 }).place, 'Ankle');
assert.equal(L('upperarm01.L', 'out', false, { ...far, shoulder: 0.05 }, true).place, 'Armpit');
assert.equal(L('upperarm01.L', 'out', false, { ...far, shoulder: 0.05 }, false).place, 'Shoulder', 'only the skin facing down');
// every rated place reads in plain words, 1..10
for (const b of ['root', 'spine05', 'spine01', 'breast.L', 'clavicle.R', 'shoulder01.L', 'lowerarm02.L', 'wrist.R', 'toe1-1.L', 'mystery'])
  for (const f of ['front', 'back', 'out', 'in']) { const r = L(b, f); assert.ok(r.level >= 1 && r.level <= 10 && r.place && !/[A-Z]{2}|_/.test(r.place), b + f); }

// facing: front and back by depth, then out or in by the side of the body
assert.equal(facing([0, 0, 1], 0.1), 'front'); assert.equal(facing([0, 0, -1], -0.1), 'back');
assert.equal(facing([1, 0, 0], 0.2), 'out'); assert.equal(facing([1, 0, 0], -0.2), 'in');
assert.equal(facing([-1, 0, 0], -0.2), 'out'); assert.equal(facing([-0.9, 0, 0.3], 0.2), 'in');

// the whole map on a tiny body: one triangle strip, a rib vertex, a calf vertex, an eye
const pos = [0.15, 1.2, 0, 0.1, 0.4, -0.1, 0, 1.6, 0.1], nor = [1, 0, 0, 0, 0, -1, 0, 0, 1];
const bones = ['spine03', 'lowerleg01.L', 'eye.L'];
const m = painMap({ pos, nor, count: 3, boneOf: (v) => bones[v], joints: { knee: [[0.1, 0.5, 0]], elbow: [[9, 9, 9]], wrist: [[9, 9, 9]], ankle: [[9, 9, 9]], shoulder: [[9, 9, 9]] }, skip: (v) => v === 2 });
assert.deepEqual([...m.place], ['Ribs', 'Calf', '']); assert.ok(m.level[0] > m.level[1]); assert.equal(m.level[2], 0);

// neighbours and smoothing: a line of five, low to high
const nb = vertexNeighbours([0, 1, 2, 1, 2, 3, 2, 3, 4], 5);
assert.deepEqual(nb[0].sort(), [1, 2]); assert.deepEqual(nb[2].sort(), [0, 1, 3, 4]);
const lv = Float32Array.from([2, 2, 5, 9, 9]), sm = smoothLevels(lv, nb, 2);
assert.ok(sm[2] > 2 && sm[2] < 9, 'edges soften'); assert.ok(sm[0] < sm[4], 'low stays lower than high');
for (let i = 0; i < 5; i++) assert.ok(sm[i] >= 2 && sm[i] <= 9, 'never past the extremes');
const kept = smoothLevels(lv, nb, 3, (v) => v === 4); assert.equal(kept[4], 9, 'skipped vertices keep theirs');

// colours: green, then amber, then red, always in range
const g = painColour(1), y = painColour(6), r = painColour(10);
assert.ok(g[1] > g[0] && g[1] > g[2], 'low is green'); assert.ok(y[0] > 0.9 && y[1] > 0.7, 'middle is amber'); assert.ok(r[0] > r[1] * 3, 'high is red');
for (let l = -2; l <= 12; l += 0.5) for (const c of painColour(l)) assert.ok(c >= 0 && c <= 1);
assert.deepEqual(painColour(0), painColour(1)); assert.deepEqual(painColour(14), painColour(10));
assert.equal(painWords(2), 'low'); assert.equal(painWords(4.6), 'moderate'); assert.equal(painWords(7), 'high'); assert.equal(painWords(9), 'very high');
assert.equal(painLine(8.6, 'Ribs'), 'Ribs: very high, about 9 out of 10.');

// a tattoo over the strip: its usual level, the place most of it sits on, its worst part
const P2 = [0, 0, 0, 0.01, 0, 0, 0.02, 0, 0, 0.03, 0, 0, 0.5, 0, 0];
const under = painUnder({ pos: P2, count: 5, level: [3, 3, 3, 8, 9], place: ['Calf', 'Calf', 'Calf', 'Knee', 'Knee'], centre: [0.01, 0, 0], radius: 0.025 });
assert.equal(under.place, 'Calf'); assert.ok(Math.abs(under.level - 4.25) < 1e-6); assert.equal(under.max, 8); assert.equal(under.maxPlace, 'Knee');
const tiny = painUnder({ pos: P2, count: 5, level: [3, 3, 3, 8, 9], place: ['Calf', 'Calf', 'Calf', 'Knee', 'Knee'], centre: [0.49, 0, 0], radius: 0.001 });
assert.equal(tiny.place, 'Knee', 'a tiny tattoo takes the nearest skin');
console.log('PASS pain-unit: chart places, joints, facing, map, smoothing, colours, words, under a tattoo');
