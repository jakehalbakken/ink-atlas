import assert from 'node:assert/strict';
import {startPlacementDraft,editPlacementDraft,stepPlacementDraft,applyPlacementDraft} from '../../src/placement-draft.js';
const state={tattoos:[{id:'a',img:'i',width:.1,rot:0,opacity:.9,wrap:0,bend:0,taper:0}]};
const d=startPlacementDraft(state,'a');editPlacementDraft(d,'rot',1);assert.equal(state.tattoos[0].rot,0);
const restored=JSON.parse(JSON.stringify(d));assert.ok(stepPlacementDraft(restored,'undo'));assert.equal(restored.working.rot,0);assert.ok(stepPlacementDraft(restored,'redo'));assert.equal(applyPlacementDraft(state,restored).tattoos[0].rot,1);
stepPlacementDraft(restored,'undo');editPlacementDraft(restored,'rot',2);assert.equal(restored.future.length,0);
for(let i=0;i<80;i++)editPlacementDraft(restored,'rot',i);assert.equal(restored.history.length,50);
assert.throws(()=>editPlacementDraft(restored,'img',1));assert.throws(()=>editPlacementDraft(restored,'rot',NaN));
console.log('PASS bounded durable draft history, reload undo/redo, branch clearing and committed-state exclusion');
