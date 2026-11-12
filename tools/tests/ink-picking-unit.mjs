import assert from 'node:assert/strict';
import {visibleInkAt,rankedInkHits,cycleInkHit} from '../../src/ink-picking.js';
const image={width:2,height:2,data:new Uint8ClampedArray([0,0,0,255,255,255,255,255,0,0,0,0,255,0,0,255])};
assert(visibleInkAt(image,.1,.1,false));assert(!visibleInkAt(image,.8,.1,false));assert(!visibleInkAt(image,.1,.9,false));assert(visibleInkAt(image,.8,.9,false));assert(visibleInkAt(image,.1,.9,true));assert(!visibleInkAt(image,2,.1));
const hits=[{id:'bottom',order:0,distance:1},{id:'top',order:2,distance:.998},{id:'far',order:5,distance:1.1},{id:'top',order:2,distance:1},{id:'clear',order:8,distance:1}];
assert.deepEqual(rankedInkHits(hits,1,h=>h.id!=='clear'),['top','bottom']);assert.deepEqual(rankedInkHits(hits,Infinity,()=>true),[]);
const old={ids:['top','bottom'],id:'top',time:100,x:50,y:50};assert.equal(cycleInkHit(old.ids,old,{time:500,x:51,y:51}),'bottom');assert.equal(cycleInkHit(old.ids,old,{time:900,x:51,y:51}),'top');assert.equal(cycleInkHit(['new'],old,{time:500,x:51,y:51}),'new');
console.log('PASS visible multiply-ink pixels, transparency, UV flip, body-depth/stack ordering, duplicate triangles and overlap cycling');
