// Before / after: left of the line shows only ink already on the body, right shows the
// planned ink too. Same camera, nothing in the project changes, the line drags, and the
// edit sheet and tray stay above it.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 await p.setViewport({width:1180,height:820,deviceScaleFactor:1,hasTouch:true});await wait(600);
 await p.click('#trayItems .chip');await wait(300);await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});
 const id=await p.evaluate(()=>window.__ink.selected());
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 // grid of pixels around the selected tattoo's centre, rendered through the real frame path
 const grid=()=>p.evaluate(id=>{const a=window.__ink,t=a.state().tattoos.find(t=>t.id===id),c=a.projectPoint(t.pos),out=[];for(let dx=-24;dx<=24;dx+=8)for(let dy=-24;dy<=24;dy+=8)out.push(...a.pixelAt(c.x+dx,c.y+dy).slice(0,3));return out;},id);
 const diff=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/a.length;
 const plain=await grid();
 await p.click('#lookBtn');await p.click('#baBtn');await wait();
 assert.equal((await p.evaluate(()=>window.__ink.beforeAfter())).on,true,'turned on');
 assert.equal(await p.$eval('#baBtn',e=>e.getAttribute('aria-pressed')),'true');
 assert.equal(await p.$eval('#beforeAfter',e=>e.hidden),false);
 await p.evaluate(()=>window.__ink.setBeforeAfterSplit(1));const now=await grid();
 await p.evaluate(()=>window.__ink.setBeforeAfterSplit(0));const plans=await grid();
 assert.ok(diff(plans,plain)<1,`right side matches the normal view (${diff(plans,plain)})`);
 assert.ok(diff(now,plans)>4,`planned ink hidden on the Now side (${diff(now,plans)})`);
 // ink already on the body shows on both sides
 await p.evaluate(id=>{const a=window.__ink,t=a.state().tattoos.find(t=>t.id===id);t.status='existing';a.commitTest();},id);await wait();
 await p.evaluate(()=>window.__ink.setBeforeAfterSplit(1));const nowExisting=await grid();
 assert.ok(diff(nowExisting,plans)<1,`existing ink shows on the Now side (${diff(nowExisting,plans)})`);
 await p.evaluate(id=>{const a=window.__ink,t=a.state().tattoos.find(t=>t.id===id);t.status='planned';t.locked=false;a.commitTest();},id);await wait();
 // drag the line with a finger
 await p.evaluate(()=>window.__ink.setBeforeAfterSplit(.5));
 const box=await p.$eval('#beforeAfter .ba-line',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*.45,w:r.width,h:r.height};});
 assert.ok(box.w>=44,'line is a 44 pt target');
 const cam=await p.evaluate(()=>JSON.stringify(window.__ink.goal));
 await p.evaluate(b=>{const l=document.querySelector('#beforeAfter .ba-line');const ev=(type,x)=>l.dispatchEvent(new PointerEvent(type,{pointerId:41,pointerType:'touch',clientX:x,clientY:b.y,bubbles:true,button:0,buttons:type==='pointerup'?0:1}));ev('pointerdown',b.x);ev('pointermove',b.x-120);ev('pointermove',b.x-236);ev('pointerup',b.x-236);},box);await wait();
 const s=(await p.evaluate(()=>window.__ink.beforeAfter())).split;
 assert.ok(Math.abs(s-(box.x-236)/1180)<.01,`line follows the finger (${s})`);
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.goal)),cam,'dragging the line does not move the view');
 // the edit sheet sits above the line
 await p.evaluate(()=>{const r=document.querySelector('#sheet').getBoundingClientRect();window.__ink.setBeforeAfterSplit((r.x+r.width/2)/window.innerWidth);});await wait(100);
 const sheetHit=await p.evaluate(()=>{const r=document.querySelector('#sheet').getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!(e&&e.closest('#sheet'));});
 assert.ok(sheetHit,'edit sheet is above the line');
 await p.screenshot({path:'shots/t36-before-after.png'});
 // off again; project untouched
 await p.click('#lookBtn');await p.click('#baBtn');await wait();
 assert.equal((await p.evaluate(()=>window.__ink.beforeAfter())).on,false);
 assert.equal(await p.$eval('#beforeAfter',e=>e.hidden),true);
 const after=JSON.parse(await p.evaluate(()=>JSON.stringify(window.__ink.state())));const b0=JSON.parse(before);
 assert.deepEqual(after.tattoos.map(t=>[t.id,t.status||'planned',t.pos,t.width]),b0.tattoos.map(t=>[t.id,t.status||'planned',t.pos,t.width]),'tattoos unchanged');
 // nothing planned: it says so and stays off
 await p.evaluate(()=>{const a=window.__ink;for(const t of a.state().tattoos){t.status='existing';t.locked=true;}a.commitTest();});await wait();
 await p.click('#lookBtn');await p.click('#baBtn');await wait();
 assert.equal((await p.evaluate(()=>window.__ink.beforeAfter())).on,false,'stays off with nothing planned');
 assert.match(await p.evaluate(()=>document.body.innerText),/Nothing planned to compare/);
 console.log('PASS t36 before/after: planned ink only on the right, existing on both, line drags without moving the view, sheet above, project unchanged');
}
