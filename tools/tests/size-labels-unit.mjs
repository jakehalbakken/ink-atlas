// Picture with sizes: labels under each tattoo, over it when there is no room, never overlapping.
import assert from 'node:assert/strict';
import { placeLabels, sizeLabel, leader } from '../../src/size-labels.js';
const W = 1000, H = 800, w = 200, h = 30;
const ov = (a, b) => a.x < b.x + w && a.x + w > b.x && a.y < b.y + h && a.y + h > b.y;
let [a] = placeLabels([{ box: [400, 100, 600, 300], w, h }], W, H);
assert.deepEqual(a, { x: 400, y: 306, side: 'near' }, 'centred just under its tattoo');
[a] = placeLabels([{ box: [400, 600, 600, 790], w, h }], W, H);
assert.equal(a.y, 600 - 6 - h, 'over it near the bottom');
[a] = placeLabels([{ box: [0, 100, 50, 150], w, h }], W, H);
assert.equal(a.x, 6, 'kept in the picture on the left');
[a] = placeLabels([{ box: [960, 100, 1000, 150], w, h }], W, H);
assert.equal(a.x, W - 6 - w, 'and on the right');
// three tattoos side by side close together: no labels on top of each other
const items = [0, 1, 2].map((k) => ({ box: [400 + k * 40, 200, 460 + k * 40, 260], w, h }));
const out = placeLabels(items, W, H);
for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(!ov(out[i], out[j]), `labels ${i} and ${j} apart: ${JSON.stringify(out)}`);
assert.ok(out.every((p) => p.y >= 0 && p.y + h <= H), 'all inside');
assert.equal(out.length, 3);
// beside the body: each in the column on its own side, level with its tattoo, stacked apart
const body = [380, 620];
const side = placeLabels([{ box: [420, 200, 460, 240], w: 150, h: 40 }, { box: [540, 210, 580, 250], w: 150, h: 40 }, { box: [430, 215, 470, 255], w: 150, h: 40 }], W, H, 6, body);
assert.equal(side[0].side, 'left'); assert.equal(side[1].side, 'right'); assert.equal(side[2].side, 'left');
assert.equal(side[0].x + 150, 380 - 18, 'left column ends beside the body');
assert.equal(side[1].x, 620 + 18, 'right column starts beside the body');
assert.equal(side[0].y, 200, 'level with its tattoo');
assert.ok(side[2].y >= side[0].y + 40 + 6, 'stacked under the first in its column');
assert.equal(side[1].y, 210);
// no room on its own side: the other side
const tight = placeLabels([{ box: [100, 300, 140, 340], w: 150, h: 40 }], W, H, 6, [60, 700]);
assert.equal(tight[0].side, 'right');
// no room either side: next to it
assert.equal(placeLabels([{ box: [100, 300, 140, 340], w: 150, h: 40 }], W, H, 6, [20, 980])[0].side, 'near');
// a long column slides back up inside the picture
const many = placeLabels(Array.from({ length: 6 }, (_, k) => ({ box: [420, 700 + k, 440, 720 + k], w: 150, h: 40 })), W, H, 6, body);
assert.ok(many.every((q) => q.y >= 0 && q.y + 40 <= H), 'all inside: ' + JSON.stringify(many.map((q) => q.y)));
for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) assert.ok(Math.abs(many[i].y - many[j].y) >= 46, 'apart');
// the line runs from the label's inner edge to the tattoo's near side
assert.deepEqual(leader([420, 200, 460, 240], side[0], 150, 40), [[362, 220], [420, 220]]);
assert.deepEqual(leader([540, 210, 580, 250], side[1], 150, 40), [[638, 230], [580, 230]]);
assert.equal(sizeLabel(3.15, 2.04), '3.1 × 2.0 in (8 × 5 cm)');
console.log('PASS size-labels-unit');
