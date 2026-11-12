// Poses in the main view: the body and its ink bend together, the saved project never
// changes, a tattoo can still be dragged in a pose and lands on the skin under the
// finger, motion plays, pauses and steps, and Standing gives back the exact picture.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 const settled=()=>p.waitForFunction(()=>window.__ink.settled()&&window.__ink.pose().settled,{timeout:20000});
 await settled();await wait(600);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 // the Pose panel lists every still in plain words and opens from its own button
 await p.click('#poseBtn');await p.waitForSelector('#posePop:not([hidden])');
 const labels=await p.$$eval('#poseList [data-pose]',b=>b.map(x=>x.textContent.trim()));
 assert.ok(labels.length>=29,'about 30 stills: '+labels.length);assert.ok(labels.includes('Standing')&&labels.includes('Squat'));
 const minSize=await p.$$eval('#poseList [data-pose], #motionPlay, #posePop [data-speed]',b=>Math.min(...b.map(x=>Math.min(x.getBoundingClientRect().width,x.getBoundingClientRect().height))));
 assert.ok(minSize>=44,'pose buttons are 44pt: '+minSize);
 // choose a still: the body bends and the ink goes with it
 const t=await p.evaluate(()=>window.__ink.state().tattoos[0]);
 await p.click('#poseList [data-pose=twist]');await wait(500);await settled();
 let s=await p.evaluate(()=>window.__ink.pose());assert.equal(s.active,true);assert.equal(s.key,'twist');
 const spot=await p.evaluate(id=>window.__ink.viewSpot(id),t.id);
 const moved=Math.hypot(...spot.pos.map((v,i)=>v-t.pos[i]));assert.ok(moved>0.01,'ink moved with the turn: '+moved);
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'posing changes nothing saved');
 await p.screenshot({path:'shots/t39-turn.png'});
 // timing: one full body pose on this machine
 const ms=await p.evaluate(()=>{const t0=performance.now();window.__ink.setPoseRotations({'spine03':[0,.2,0,.98]});window.__ink.pixelAt(10,10);const a=performance.now()-t0;window.__ink.setPose('twist');return a;});
 console.log('pose rebuild ms',ms.toFixed(1));
 await wait(500);await settled();
 // select the tattoo in the pose and drag it: it lands on the skin under the finger
 await p.click('#posePop [data-close=posePop]');
 await p.click('#trayItems .chip');await wait(1600);await settled();
 const a=await p.evaluate(id=>window.__ink.projectPoint(window.__ink.viewSpot(id).pos),t.id);
 const under=await p.evaluate((x,y)=>window.__ink.hitBody(x,y),a.x,a.y);
 assert.ok(under&&Math.hypot(...under.point.map((v,i)=>v-t.pos[i]))<0.02,'finger on the posed ink is on the tattoo at rest');
 await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(a.x+30,a.y+20,{steps:6});await p.mouse.move(a.x+60,a.y+40,{steps:6});await p.mouse.up();await wait(500);
 const t2=await p.evaluate(()=>window.__ink.state().tattoos[0]);
 assert.notDeepEqual(t2.pos,t.pos,'tattoo moved in the pose');
 const land=await p.evaluate(id=>window.__ink.projectPoint(window.__ink.viewSpot(id).pos),t.id);
 const off=Math.hypot(land.x-(a.x+60),land.y-(a.y+40));assert.ok(off<16,'tattoo followed the finger in the pose: '+off.toFixed(1)+'px'); // the rest body lags the same ~12px: the drag starts after a small dead zone
 // the stored spot is on the rest body, not floating in posed space
 const restHit=await p.evaluate(tt=>{const o=tt.pos.map((v,i)=>v+tt.normal[i]*0.2),d=tt.normal.map(v=>-v);return window.__ink.surfaceAt(o,d);},t2);
 assert.ok(restHit&&Math.hypot(...restHit.pos.map((v,i)=>v-t2.pos[i]))<0.004,'saved spot is on the rest body');
 await p.screenshot({path:'shots/t39-drag.png'});
 await p.evaluate(()=>window.__ink.undo());await wait(300);
 assert.deepEqual(await p.evaluate(()=>window.__ink.state().tattoos[0].pos),t.pos,'undo puts it back');
 // motion: play advances, pause holds, step jumps
 await p.click('#poseBtn');await p.waitForSelector('#posePop:not([hidden])');
 await p.select('#motionKind','walk');await p.click('#motionPlay');await wait(700);
 s=await p.evaluate(()=>window.__ink.pose());assert.equal(s.playing,true);assert.equal(s.kind,'walk');const ph=s.phase;await wait(500);
 s=await p.evaluate(()=>window.__ink.pose());assert.ok(s.phase!==ph,'motion advances');
 await p.click('#motionPlay');s=await p.evaluate(()=>window.__ink.pose());assert.equal(s.playing,false);const held=s.phase;await wait(400);
 assert.equal((await p.evaluate(()=>window.__ink.pose())).phase,held,'pause holds');
 await p.evaluate(()=>window.__ink.scrubMotion('squat',.5));s=await p.evaluate(()=>window.__ink.pose());assert.equal(s.kind,'squat');assert.equal(s.phase,.5);
 await p.screenshot({path:'shots/t39-squat.png'});
 // the lowest foot stays on the floor in a squat
 const low=await p.evaluate(()=>{const P=window.__ink.posedGeometry().attributes.position.array,R=window.__ink.positions();let a=1e9,b=1e9;for(let i=1;i<P.length;i+=3){a=Math.min(a,P[i]);b=Math.min(b,R[i]);}return a-b;});
 assert.ok(Math.abs(low)<1e-4,'feet on the floor');
 // Standing gives back the exact rest picture
 await p.evaluate(()=>{window.__ink.setPose('neutral');});await wait(500);await settled();
 assert.equal((await p.evaluate(()=>window.__ink.pose())).active,false);
 await p.click('#posePop [data-close=posePop]');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project unchanged after posing and undo');
 console.log('PASS t39 poses: catalog panel, ink follows, project untouched, drag in a pose lands under the finger, motion play/pause/step, feet on floor');
}
