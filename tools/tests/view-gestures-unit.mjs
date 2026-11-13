import assert from 'node:assert/strict';
import {wrapAngle,twoPointerMetrics,twoPointerDelta,planTapPlacement} from '../../src/view-gestures.js';
const a=twoPointerMetrics([{x:-50,y:0},{x:50,y:0}]),b=twoPointerMetrics([{x:0,y:-50},{x:0,y:50}]);
assert.equal(twoPointerDelta(a,b).rollDelta,Math.PI/2);assert.equal(twoPointerDelta(a,b).zoomRatio,1);
const edge=twoPointerDelta({...a,angle:179*Math.PI/180},{...b,angle:-179*Math.PI/180});assert.ok(Math.abs(edge.rollDelta-2*Math.PI/180)<1e-12);
const crossed=twoPointerDelta(a,{...b,distance:1});assert.equal(crossed.rollDelta,0);assert.equal(crossed.zoomRatio,1);assert.equal(crossed.stable,false);
const doubled=twoPointerDelta(a,{...a,distance:200,cx:10,cy:20});assert.deepEqual(doubled,{zoomRatio:.5,rollDelta:0,dx:10,dy:20,stable:true});
const tattoo={id:'a',pos:[0,0,0],normal:[0,0,1],width:.1,rot:.3,aspect:2,artworkId:'art',status:'planned'},before=structuredClone(tattoo),hit={pos:[.1,.8,.2],normal:[0,0,2]},placed=planTapPlacement(tattoo,hit);
assert.deepEqual(placed.normal,[0,0,1]);assert.equal(placed.artworkId,'art');assert.equal(placed.rot,.3);assert.deepEqual(tattoo,before);assert.deepEqual(hit.normal,[0,0,2]);assert.throws(()=>planTapPlacement({...tattoo,locked:true},hit));assert.throws(()=>planTapPlacement({...tattoo,status:'existing'},hit));assert.throws(()=>planTapPlacement(tattoo,null));assert.ok(Math.abs(wrapAngle(2*Math.PI))<1e-12);
console.log('PASS clockwise roll, seam wrapping, near-coincident guard, zoom/pan independence, tap placement immutability and protections');
// two-finger intent: a wobbly pan stays a pan, a clear twist or pinch still turns and zooms
{
 const {twoFingerIntent}=await import('../../src/view-gestures.js');
 const f=twoFingerIntent();let roll=0,zoom=1,pan=0;
 for(let i=0;i<40;i++){const o=f.step({zoomRatio:i%2?1.01:0.99,rollDelta:i%2?0.02:-0.015,dx:6,dy:2,stable:true});roll+=o.rollDelta;zoom*=o.zoomRatio;pan+=o.dx;}
 assert.equal(roll,0,'a two-finger pan with a little wobble does not turn the view');assert.equal(zoom,1,'nor zoom it');assert.equal(pan,240,'the pan follows the fingers fully');
 const g=twoFingerIntent();let r2=0;for(let i=0;i<20;i++)r2+=g.step({zoomRatio:1,rollDelta:0.05,dx:0,dy:0,stable:true}).rollDelta;
 assert.ok(Math.abs(r2-(1-0.3))<1e-9,'a deliberate twist turns, minus the small start: '+r2);assert.ok(g.turning);
 const h=twoFingerIntent();let z2=1;for(let i=0;i<10;i++)z2*=h.step({zoomRatio:0.95,rollDelta:0,dx:0,dy:0,stable:true}).zoomRatio;
 assert.ok(Math.abs(Math.log(z2)-(10*Math.log(0.95)+0.06))<1e-9,'a pinch zooms, minus the small start');
 const k=twoFingerIntent();k.step({zoomRatio:1,rollDelta:0,dx:100,dy:0,stable:true});let r3=0;for(let i=0;i<8;i++)r3+=k.step({zoomRatio:1,rollDelta:0.05,dx:0,dy:0,stable:true}).rollDelta;
 assert.equal(r3,0,'while panning, a 23 degree twist is still not a turn');
 console.log('PASS two-finger intent: pan without turning or zooming, deliberate twist and pinch still work');
}
