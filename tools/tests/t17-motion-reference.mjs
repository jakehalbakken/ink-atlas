import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=500)=>new Promise(r=>setTimeout(r,n));
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.click('#projectsBtn');await p.click('#openPose');await p.waitForSelector('#posePop:not([hidden])');await p.click('#motionPlay');await wait(800);
 let d=await p.evaluate(()=>window.__ink.pose());assert(d.playing);assert(d.active);assert(d.phase>0);
 await p.click('#motionPlay');d=await p.evaluate(()=>window.__ink.pose());assert(!d.playing);
 await p.click('#poseList [data-pose=neutral]');await wait(500);assert.equal((await p.evaluate(()=>window.__ink.pose())).active,false);
 await p.click('#posePop [data-close=posePop]');assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before);
 await p.evaluate(()=>{window.__ink.state().tattoos[0].status='existing';window.__ink.commitTest();});await p.click('#trayItems .chip');await p.click('#shareBtn');await p.click('#cSketch');await wait(600);await p.click('.patch-chooser [data-area=selected]');await wait(1000);
 assert(await p.$('.patch-exchange [data-save-existing]'));
 const stats=await p.evaluate(async()=>{const u=window.__ink.state().sketchPatch.existingInk;const im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=u;});const c=document.createElement('canvas');c.width=c.height=768;const g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,768,768).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return {n};});assert(stats.n>0&&stats.n<768*768,'reference is transparent existing ink');
 await p.screenshot({path:'shots/procreate-reference.png'});await p.click('.patch-exchange [data-close]');
 console.log('PASS t17 bounded motion/reset and transparent existing-ink reference from selected patch');
}
