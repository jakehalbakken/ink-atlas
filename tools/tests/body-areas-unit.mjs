// Folders by body area (body-areas.js): place names to areas, Sort into areas keeps your own
// folders and the drawing order, reuses and renames, drops emptied area folders, and the helpers.
// Run: node tools/tests/body-areas-unit.mjs
import assert from 'node:assert/strict';
import { areaFor, AREA_ORDER, sortPlan, sortIntoAreas, soloFolder, unfolder, renameFolder, frameFor } from '../../src/body-areas.js';
import { dockSections } from '../../src/layers-dock.js';

// every place the pain map can name has an area, and every area is in the order list
const PLACES = ['Groin', 'Face', 'Head', 'Throat', 'Back of neck', 'Side of neck', 'Fingers', 'Hand', 'Foot', 'Armpit', 'Ankle', 'Back of knee', 'Knee', 'Inner elbow', 'Elbow', 'Wrist', 'Shoulder', 'Upper arm, outside', 'Back of arm', 'Inner arm', 'Bicep', 'Forearm, outside', 'Forearm, inside', 'Collarbone', 'Upper back', 'Chest', 'Sternum', 'Spine', 'Ribs', 'Stomach', 'Lower back', 'Hip', 'Buttock', 'Thigh, outside', 'Inner thigh', 'Back of thigh', 'Thigh, front', 'Calf', 'Shin', 'Calf, outside', 'Shin, inside'];
for (const p of PLACES) for (const side of ['left', 'right']) { const a = areaFor(p, side); assert.ok(a && AREA_ORDER.includes(a), `${p} ${side} -> ${a}`); }
assert.equal(areaFor('Thigh, outside', 'left'), 'Left thigh');
assert.equal(areaFor('Inner thigh', 'right'), 'Right thigh');
assert.equal(areaFor('Back of thigh', 'left'), 'Left thigh', 'the back of the thigh is the thigh, not the back');
assert.equal(areaFor('Upper back', 'left'), 'Back'); assert.equal(areaFor('Lower back', 'right'), 'Back');
assert.equal(areaFor('Back of arm', 'right'), 'Right upper arm'); assert.equal(areaFor('Back of knee', 'left'), 'Left lower leg');
assert.equal(areaFor('Back of neck', 'left'), 'Neck');
assert.equal(areaFor('Forearm, inside', 'right'), 'Right forearm'); assert.equal(areaFor('Inner elbow', 'left'), 'Left forearm');
assert.equal(areaFor('Ribs', 'right'), 'Right ribs'); assert.equal(areaFor('Sternum', 'left'), 'Chest');
assert.equal(areaFor('', 'left'), null); assert.equal(areaFor(undefined, 'left'), null); assert.equal(areaFor('Body', 'left'), null);
assert.equal(new Set(AREA_ORDER).size, AREA_ORDER.length, 'no area twice');

const mk = () => ({ groups: [{ id: 'mine', name: 'Sleeve ideas' }], tattoos: [
  { id: 'a', name: 'Rose', place: 'Left thigh' }, { id: 'b', name: 'Snake', place: 'Chest', group: 'mine' },
  { id: 'c', name: 'Moth', place: 'Left thigh' }, { id: 'd', name: 'Dagger', place: 'Right forearm' },
  { id: 'e', name: 'Odd', place: null }, { id: 'f', name: 'Swallow', place: 'Chest' }] });
const areaOf = (t) => t.place;

let s = mk(); const order0 = s.tattoos.map((t) => t.id);
assert.deepEqual(sortPlan(s, areaOf), { move: 4, folders: 3 });
const r = sortIntoAreas(s, areaOf);
assert.equal(r.moved, 4); assert.equal(r.folders, 3);
assert.deepEqual(s.tattoos.map((t) => t.id), order0, 'the drawing order never changes');
assert.equal(s.tattoos.find((t) => t.id === 'b').group, 'mine', 'a folder of your own keeps what you put in it');
assert.equal(s.tattoos.find((t) => t.id === 'e').group, undefined, 'a tattoo with no area stays loose');
assert.deepEqual(s.groups.map((g) => g.name), ['Sleeve ideas', 'Chest', 'Right forearm', 'Left thigh'], 'your own folders first, then head to foot');
const thigh = s.groups.find((g) => g.area === 'Left thigh');
assert.equal(s.tattoos.find((t) => t.id === 'a').group, thigh.id); assert.equal(s.tattoos.find((t) => t.id === 'c').group, thigh.id);
assert.deepEqual(r.ids, s.groups.filter((g) => g.area).map((g) => g.id));
// what the panel shows: the folders in order, the loose one last
assert.deepEqual(dockSections(s).map((x) => (x.group ? x.group.name : null) + ':' + x.items.map((t) => t.id).join('')), ['Sleeve ideas:b', 'Chest:f', 'Right forearm:d', 'Left thigh:ac', 'null:e']);
// again: nothing to move
assert.deepEqual(sortPlan(s, areaOf), { move: 0, folders: 3 });
const groupsBefore = JSON.stringify(s.groups); assert.equal(sortIntoAreas(s, areaOf).moved, 0); assert.equal(JSON.stringify(s.groups), groupsBefore, 'a second sort is a no-op');
// a renamed area folder is still used, and keeps its new name
assert.equal(renameFolder(s, thigh.id, 'My thigh'), true); assert.equal(renameFolder(s, thigh.id, '  '), false); assert.equal(renameFolder(s, 'nope', 'x'), false);
s.tattoos.push({ id: 'g', name: 'Lily', place: 'Left thigh' });
assert.equal(sortIntoAreas(s, areaOf).moved, 1);
assert.equal(s.tattoos.find((t) => t.id === 'g').group, thigh.id); assert.equal(s.groups.find((g) => g.id === thigh.id).name, 'My thigh');
// a tattoo moved to another area changes folder, and an emptied area folder goes
s.tattoos.find((t) => t.id === 'd').place = 'Chest';
const fore = s.groups.find((g) => g.area === 'Right forearm').id;
sortIntoAreas(s, areaOf);
assert.ok(!s.groups.some((g) => g.id === fore), 'the emptied area folder is dropped');
assert.equal(s.tattoos.find((t) => t.id === 'd').group, s.groups.find((g) => g.area === 'Chest').id);
// a project with no groups at all, and one with a broken entry kept as it is
s = { tattoos: [{ id: 'a', place: 'Chest' }] }; sortIntoAreas(s, areaOf); assert.equal(s.groups.length, 1);
s = { groups: [null, { id: 3 }], tattoos: [{ id: 'a', place: 'Chest' }] }; sortIntoAreas(s, areaOf); assert.equal(s.groups.length, 3); assert.equal(s.groups[0].area, 'Chest');
// a tattoo in a group that no longer exists is treated as loose
s = { groups: [], tattoos: [{ id: 'a', place: 'Chest', group: 'gone' }] }; assert.equal(sortIntoAreas(s, areaOf).moved, 1); assert.equal(s.tattoos[0].group, s.groups[0].id);
// it survives a save: plain JSON with only known kinds of value
s = mk(); sortIntoAreas(s, areaOf); assert.deepEqual(JSON.parse(JSON.stringify(s)), s);

// show only this folder, take them out
s = mk(); sortIntoAreas(s, areaOf); const th = s.groups.find((g) => g.area === 'Left thigh').id;
assert.equal(soloFolder(s, th), 4);
assert.deepEqual(s.tattoos.filter((t) => !t.hidden).map((t) => t.id), ['a', 'c']);
assert.equal(soloFolder(s, th), 0, 'a second time changes nothing');
unfolder(s, th); assert.ok(!s.groups.some((g) => g.id === th)); assert.equal(s.tattoos.find((t) => t.id === 'a').group, undefined);

// framing several pieces: their middle, the way they face, enough room round them
const f = frameFor([{ pos: [0, 1, 0.1], normal: [0, 0, 1], ext: 0.05 }, { pos: [0.2, 1, 0.1], normal: [0, 0, 1], ext: 0.05 }]);
assert.deepEqual(f.pos.map((x) => +x.toFixed(6)), [0.1, 1, 0.1]); assert.deepEqual(f.normal, [0, 0, 1]); assert.ok(Math.abs(f.ext - 0.25) < 1e-9);
const g2 = frameFor([{ pos: [0, 0.5, 0.1], normal: [0, 0, 1], ext: 0.05 }, { pos: [0, 0.5, -0.1], normal: [0, 0, -1], ext: 0.05 }]);
assert.deepEqual(g2.normal, [0, 0, 1], 'front and back cancel: face the first one');
assert.equal(frameFor([]), null);
console.log('body-areas-unit: ok');
// a save with area folders opens with them kept as they are, and an older save without them is untouched
{
  const { cleanState } = await import('../../src/project.js');
  const raw = { v: 2, groups: [{ id: 'g1', name: 'My thigh', area: 'Left thigh' }, { id: 'g2', name: 'Mine' }], tattoos: [
    { id: 'a', img: 'k', name: 'Rose', pos: [0.1, 0.5, 0.1], normal: [0, 0, 1], group: 'g1' }, { id: 'b', img: 'k', name: 'Snake', pos: [0, 1.3, 0.1], normal: [0, 0, 1], group: 'g2' }] };
  const { state } = cleanState(raw, () => true);
  assert.deepEqual(state.groups, raw.groups, 'folders kept exactly');
  assert.deepEqual(state.tattoos.map((t) => t.group), ['g1', 'g2']);
  const old = { v: 2, tattoos: [{ id: 'a', img: 'k', name: 'Rose', pos: [0.1, 0.5, 0.1], normal: [0, 0, 1] }] };
  const c = cleanState(old, () => true).state; assert.equal(c.groups, undefined, 'an older save gets no folders by itself'); assert.equal(c.tattoos[0].group, undefined);
}
console.log('body-areas-unit: save ok');
