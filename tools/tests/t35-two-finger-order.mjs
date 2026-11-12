// "Two fingers starting on the tattoo resize and turn it" must not depend on which finger
// the browser reports first. Fingers that land together with only the second on the ink
// still edit the ink; two fingers off the ink, or a late second finger, still move the view.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 await p.setViewport({width:820,height:1180,deviceScaleFactor:1,hasTouch:true});await wait(600);
 await p.click('#trayItems .chip');await wait(300);await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});
 const send=(list)=>p.evaluate(list=>{const c=document.querySelector('#stage canvas');for(const [type,id,x,y] of list)c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,button:0,buttons:type==='pointerup'?0:1}));},list);
 const read=()=>p.evaluate(()=>{const a=window.__ink,t=a.state().tattoos.find(t=>t.id===a.selected());return {w:t.width,rot:t.rot,r:a.goal.r,roll:a.goal.roll,pt:a.projectPoint(t.pos),half:Math.abs(a.projectPoint(t.pos).x-a.projectPoint(t.pos).x)};});
 const b=await read();const {x,y}=b.pt;
 // find a point clearly off the ink to the left
 const off=x-170; // the framed sample is about 140 px wide
 assert.equal((await p.evaluate(([x,y])=>window.__ink.inkIdsAt(x,y).length,[off,y]))===0,true,'first finger is off the ink');
 // 1. first finger off, second on: spread the fingers -> ink grows, view unchanged
 await send([['pointerdown',71,off,y],['pointerdown',72,x,y],['pointermove',71,off-30,y],['pointermove',72,x+30,y],['pointerup',71,off-30,y],['pointerup',72,x+30,y]]);await wait();
 let a=await read();assert.ok(a.w>b.w*1.05,`ink width grew ${b.w} -> ${a.w}`);assert.equal(a.r,b.r,'view zoom untouched');assert.equal(a.roll,b.roll,'view roll untouched');
 await p.click('#undo');await wait();a=await read();assert.equal(a.w,b.w,'undo restores width');
 // 2. both fingers off the ink: view gesture, ink untouched
 await send([['pointerdown',73,off,y],['pointerdown',74,off,y+80],['pointermove',73,off,y-40],['pointermove',74,off,y+120],['pointerup',73,off,y-40],['pointerup',74,off,y+120]]);await wait();
 a=await read();assert.equal(a.w,b.w,'ink untouched');assert.ok(a.r<b.r,'view zoomed');
 await p.click('#trayItems .chip');await wait(300);await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});
 const c=await read();
 // 3. first finger off and already moving (a view drag), then a second finger on the ink: stays a view gesture
 await send([['pointerdown',75,off,c.pt.y],['pointermove',75,off+20,c.pt.y+20]]);await send([['pointerdown',76,c.pt.x,c.pt.y],['pointermove',76,c.pt.x+30,c.pt.y],['pointerup',75,off+20,c.pt.y+20],['pointerup',76,c.pt.x+30,c.pt.y]]);await wait();
 a=await read();assert.equal(a.w,c.w,'a view drag already under way is not hijacked by a second finger');
 console.log('PASS t35 two-finger order: second finger on ink edits it, off-ink pinch moves the view, a moving view drag is never hijacked');
}
