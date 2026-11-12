import assert from 'node:assert/strict';import {findLiveAlignment} from '../../src/live-alignment.js';
const ref={id:'r',name:'Fixed',pos:[0,1,0],normal:[0,0,1],width:.1,aspect:1,rot:0,locked:true,status:'existing'},moving={...ref,id:'m',pos:[.004,1.12,0],locked:false,status:'planned'},before=structuredClone([moving,ref]);
const plan=findLiveAlignment(moving,[ref]);assert.equal(plan.referenceId,'r');assert.ok(plan.lines.some(l=>l.axis==='x'&&l.kind==='Center'));assert.equal(plan.candidate[0],0);assert.deepEqual([moving,ref],before);
assert.equal(findLiveAlignment(moving,[{...ref,hidden:true}]),null);assert.equal(findLiveAlignment(moving,[{...ref,normal:[0,0,-1]}]),null);assert.equal(findLiveAlignment(moving,[{...ref,pos:[0,1,.1]}]),null);assert.equal(findLiveAlignment({...moving,status:'existing'},[ref]),null);
const edge=findLiveAlignment({...moving,width:.06,pos:[-.019,1.12,0]},[ref]);assert.equal(edge.lines[0].kind,'Left edge');assert.ok(Math.abs(edge.candidate[0]+.02)<1e-12);
console.log('PASS center/edge candidates, view-only immutability, existing refs allowed, hidden/curved/depth/locked guards');
