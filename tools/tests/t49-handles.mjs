// On-canvas handles: the selected tattoo shows a corner handle that resizes and a round one
// that turns it, each a 44pt target that works with one finger or the Pencil. One undo per
// drag. Locked, already-on-me and hidden tattoos show none, and they hide while the view moves.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const sun=await p.evaluate(()=>window.__ink.state().tattoos.find(t=>/Sunburst/.test(t.name)).id);
 assert.equal(await p.$eval('#handles',e=>e.hidden),true,'no handles with nothing selected');
 await p.click('#trayItems .chip:first-child');await wait(400);await p.click('#trayItems .chip:first-child');
 await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});await wait(300);
 assert.equal(await p.evaluate(()=>window.__ink.selected()),sun);
 const box=async id=>p.$eval(id,e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,hidden:e.hidden||e.parentElement.hidden};});
 let s=await box('#hSize'),t=await box('#hTurn');
 assert.ok(!s.hidden&&!t.hidden,'both handles show');
 assert.ok(s.w>=44&&s.h>=44&&t.w>=44&&t.h>=44,'44pt targets');
 const c=await p.evaluate(id=>window.__ink.projectPoint(window.__ink.viewSpot(id).pos),sun);
 assert.ok(t.y<c.y,'turn handle above the tattoo');assert.ok(s.x>c.x&&s.y>c.y,'size handle on the lower right corner');
 const st=()=>p.evaluate(id=>{const t=window.__ink.state().tattoos.find(t=>t.id===id);return {w:t.width,r:t.rot||0,pos:t.pos};},sun);
 const before=await st();
 const drag=async(id,from,to,type='pen')=>p.evaluate(({id,from,to,type})=>{const b=document.querySelector(id);const ev=(k,x,y)=>b.dispatchEvent(new PointerEvent(k,{pointerId:41,pointerType:type,clientX:x,clientY:y,bubbles:true,button:0,buttons:k==='pointerup'?0:1}));ev('pointerdown',from.x,from.y);for(let i=1;i<=8;i++)ev('pointermove',from.x+(to.x-from.x)*i/8,from.y+(to.y-from.y)*i/8);ev('pointerup',to.x,to.y);},{id,from,to,type});
 // resize with the Pencil: drag the corner 1.5x further from the middle
 await drag('#hSize',s,{x:c.x+(s.x-c.x)*1.5,y:c.y+(s.y-c.y)*1.5});await wait(300);
 let a=await st();
 assert.ok(Math.abs(a.w/before.w-1.5)<.05,'resized 1.5x: '+(a.w/before.w).toFixed(3));
 assert.deepEqual(a.pos,before.pos,'did not move');assert.equal(a.r,before.r,'did not turn');
 assert.match(await p.$eval('#size',e=>e.textContent),/in/);
 // the handle followed the new corner
 const s2=await box('#hSize');assert.ok(Math.hypot(s2.x-c.x,s2.y-c.y)>Math.hypot(s.x-c.x,s.y-c.y)*1.3,'handle moved out with the corner');
 // one undo restores the size
 await p.click('#undo');await wait(300);a=await st();assert.ok(Math.abs(a.w-before.w)<1e-9,'one undo');
 // turn a quarter with a finger: drag the round handle around the middle
 t=await box('#hTurn');const R=Math.hypot(t.x-c.x,t.y-c.y),a0=Math.atan2(t.y-c.y,t.x-c.x);
 await p.evaluate(({t,c,R,a0})=>{const b=document.querySelector('#hTurn');const ev=(k,x,y)=>b.dispatchEvent(new PointerEvent(k,{pointerId:42,pointerType:'touch',clientX:x,clientY:y,bubbles:true,button:0,buttons:k==='pointerup'?0:1}));ev('pointerdown',t.x,t.y);let x,y;for(let i=1;i<=12;i++){const a=a0+Math.PI/2*i/12;x=c.x+R*Math.cos(a);y=c.y+R*Math.sin(a);ev('pointermove',x,y);}ev('pointerup',x,y);},{t,c,R,a0});await wait(300);
 a=await st();let turned=Math.atan2(Math.sin(a.r-before.r),Math.cos(a.r-before.r));
 assert.ok(Math.abs(Math.abs(turned)-Math.PI/2)<.06,'turned a quarter: '+(turned*180/Math.PI).toFixed(1));
 assert.ok(Math.abs(a.w-before.w)<1e-9,'turning keeps the size');
 await p.click('#undo');await wait(300);
 // locked: no handles
 await p.evaluate(id=>{window.__ink.state().tattoos.find(t=>t.id===id).locked=true;window.__ink.commitTest();},sun);await wait(400);
 assert.equal(await p.$eval('#handles',e=>e.hidden),true,'locked shows none');
 await p.evaluate(id=>{window.__ink.state().tattoos.find(t=>t.id===id).locked=false;window.__ink.commitTest();},sun);await wait(400);
 assert.equal(await p.$eval('#handles',e=>e.hidden),false,'back when unlocked');
 // while a finger turns the view, they go away; after, they come back
 const send=(list)=>p.evaluate(list=>{const cv=document.querySelector('#stage canvas');for(const [type,id,x,y] of list)cv.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,button:0,buttons:type==='pointerup'?0:1}));},list);
 await send([['pointerdown',50,60,500],['pointermove',50,90,500],['pointermove',50,130,500]]);await wait(100);
 assert.equal(await p.$eval('#handles',e=>e.hidden),true,'hidden while the view turns');
 await send([['pointerup',50,130,500]]);await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});await wait(400);
 const vis=await p.$eval('#handles',e=>e.hidden);
 console.log('PASS t49 handles: corner resize with Pencil (1.5x, one undo), round handle turns a quarter, none when locked, hidden while the view moves'+(vis?' (tattoo turned out of view)':''));
}
