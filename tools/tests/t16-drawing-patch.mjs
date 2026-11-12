import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=500)=>new Promise(r=>setTimeout(r,n));
 await p.click('#projectsBtn');await p.click('#openBodyTools');await wait(900);await p.click('[data-mode=drawing]');
 const r=await p.$eval('.bt-stage',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
 await p.mouse.move(r.x+r.w*.49,r.y+r.h*.37);await p.mouse.down();await p.mouse.move(r.x+r.w*.51,r.y+r.h*.39,{steps:16});await p.mouse.up();await wait();
 assert((await p.evaluate(()=>document.querySelector('#ink-body-tools').__bodyToolsTest().drawings.length))>0);
 await p.click('#ink-body-tools [data-save]');await wait();await p.reload({waitUntil:'load'});await wait(1500);
 assert((await p.evaluate(()=>window.__ink.state().drawings.length))>0,'drawing survives reload');
 const before=await p.evaluate(()=>window.__ink.state().tattoos.length);
 await p.click('#shareBtn');await p.click('#cSketch');await wait(500);await p.click('.patch-chooser [data-area=view]');await wait(1000);await p.waitForSelector('.patch-exchange');
 const saved=await p.evaluate(()=>window.__ink.state().sketchPatch);assert(saved?.guide);
 await p.click('.patch-exchange [data-close]');await p.reload({waitUntil:'load'});await wait(1500);
 assert.equal(await p.evaluate(()=>window.__ink.state().sketchPatch.id),saved.id,'patch survives reload');
 await p.click('#shareBtn');await p.click('#cSketch');await wait(900);
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=768;const g=c.getContext('2d');g.fillStyle='#111';g.beginPath();g.arc(384,384,12,0,7);g.fill();const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'returned.png',{type:'image/png'}));const input=document.querySelector('.patch-exchange input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
 await wait(1000);assert(await p.$eval('.patch-exchange [data-apply]',e=>e.disabled));await p.click('.patch-exchange [data-confirm-alignment]');assert(!(await p.$eval('.patch-exchange [data-apply]',e=>e.disabled)));await p.click('.patch-exchange [data-apply]');await wait(1000);
 assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),before+1);assert.equal(await p.evaluate(()=>window.__ink.state().sketchPatch),undefined);
 const added=await p.evaluate(()=>window.__ink.state().tattoos.at(-1));assert.deepEqual(added.pos,saved.patch.pos);assert.equal(added.status,'planned');
 console.log('PASS t16 surface drawing persistence and saved Procreate PNG roundtrip to new planned tattoo');
}
