// Jake's navigation fixes:
// 1. Tapping a tattoo keeps the view you set up: same zoom and angle. If the edit panel
//    would cover the tattoo you tapped, the picture slides just enough, nothing else.
// 2. A two-finger drag pans without turning or zooming, even with the usual wobble.
// 3. The finger left on the glass after a two-finger move does not swing the view.
// 4. While a finger moves the body, the panels and buttons fade, and come back after.
// 5. Before/after, Pose, Clothes and Aging sit behind one Preview button.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 await p.setViewport({width:820,height:1180,deviceScaleFactor:1,hasTouch:true});await wait(700);
 const send=(list)=>p.evaluate(list=>{const c=document.querySelector('#stage canvas');for(const [type,id,x,y] of list)c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,button:0,buttons:type==='pointerup'?0:1}));},list);
 const cam=()=>p.evaluate(()=>({...window.__ink.goal}));
 const sun=await p.evaluate(()=>window.__ink.state().tattoos.find(t=>/Sunburst/.test(t.name)).id);
 // set up a close view of the chest by hand: zoom in with a pinch
 await send([['pointerdown',1,300,500],['pointerdown',2,500,500],['pointermove',1,200,500],['pointermove',2,600,500],['pointerup',1,200,500],['pointerup',2,600,500]]);await wait(900);
 await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});
 const set=await cam();
 // 1. tap the tattoo: selected, and the zoom and angle stay exactly as they were
 let at=await p.evaluate(id=>window.__ink.projectPoint(window.__ink.viewSpot(id).pos),sun);
 await send([['pointerdown',3,at.x,at.y],['pointerup',3,at.x,at.y]]);await wait(900);
 assert.equal(await p.evaluate(()=>window.__ink.selected()),sun,'tap selects');
 let now=await cam();
 for(const k of ['r','theta','phi','roll'])assert.equal(now[k],set[k],'tap keeps '+k);
 // it is not hidden by the panel that opened
 at=await p.evaluate(id=>window.__ink.projectPoint(window.__ink.viewSpot(id).pos),sun);
 const sheetTop=await p.$eval('#sheet',e=>e.getBoundingClientRect().top);assert.ok(at.y<sheetTop,`tattoo above the panel (${at.y} < ${sheetTop})`);
 // the tattoo low on screen: a tap slides the picture up just enough, same zoom and angle
 await p.click('#bDone');await wait(300);
 const DY=Math.round(1000-at.y);
 await send([['pointerdown',4,330,300],['pointerdown',5,490,300],['pointermove',4,330,300+DY],['pointermove',5,490,300+DY],['pointerup',4,330,300+DY],['pointerup',5,490,300+DY]]);await wait(900);
 await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});
 at=await p.evaluate(id=>window.__ink.projectPoint(window.__ink.viewSpot(id).pos),sun);
 const low=await cam();
 if(at.y>900&&at.y<1150){
  await send([['pointerdown',6,at.x,at.y],['pointerup',6,at.x,at.y]]);await wait(300);await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});await wait(300);
  now=await cam();for(const k of ['r','theta','phi','roll'])assert.equal(now[k],low[k],'slide keeps '+k);
  const at2=await p.evaluate(id=>window.__ink.projectPoint(window.__ink.viewSpot(id).pos),sun),top2=await p.$eval('#sheet',e=>e.getBoundingClientRect().top);
  assert.ok(at2.y<top2&&at2.y>top2-120,`slid just above the panel (${Math.round(at.y)} to ${Math.round(at2.y)}, panel at ${Math.round(top2)})`);
 } else console.log('  (tattoo not low enough to test the slide: '+Math.round(at.y)+')');
 await p.click('#bDone');await wait(300);
 // 2. a wobbly two-finger pan: the view moves, but does not turn or zoom
 const b=await cam();
 const steps=[];let ax=300,ay=600,bx=480,by=600;steps.push(['pointerdown',7,ax,ay],['pointerdown',8,bx,by]);
 for(let i=1;i<=12;i++){const w=(i%2?1:-1)*3;steps.push(['pointermove',7,ax+i*6,ay-i*8+w],['pointermove',8,bx+i*6-w,by-i*8]);}
 steps.push(['pointerup',7,ax+72,ay-96],['pointerup',8,bx+72,by-96]);
 await send(steps);await wait(900);
 const a=await cam();
 assert.equal(a.roll,b.roll,'pan does not turn the view');assert.equal(a.r,b.r,'pan does not zoom');
 assert.ok(Math.hypot(a.tx-b.tx,a.ty-b.ty,a.tz-b.tz)>0.02,'the view panned');
 // 3. lift one finger, keep moving the other: nothing more happens
 const c0=await cam();
 await send([['pointerdown',9,300,600],['pointerdown',10,480,600],['pointermove',9,310,590],['pointermove',10,490,590],['pointerup',10,490,590],['pointermove',9,420,700],['pointermove',9,520,760],['pointerup',9,520,760]]);await wait(600);
 const c1=await cam();assert.equal(c1.theta,c0.theta,'leftover finger does not orbit');assert.equal(c1.phi,c0.phi);
 // 4. panels fade while a finger moves the body, and come back when it lifts
 await send([['pointerdown',11,600,300],['pointermove',11,640,300]]);
 const faded=await p.evaluate(()=>document.body.classList.contains('hands-on'));
 await send([['pointerup',11,640,300]]);await wait(500);
 assert.ok(faded,'faded while moving');assert.equal(await p.evaluate(()=>document.body.classList.contains('hands-on')),false,'back after lifting');
 // a plain tap does not flash the panels
 await send([['pointerdown',12,600,300]]);const tapFade=await p.evaluate(()=>document.body.classList.contains('hands-on'));await send([['pointerup',12,600,300]]);
 assert.equal(tapFade,false,'a tap does not fade anything');
 // 5. one Preview button; its menu holds the four, and says what is on
 for(const id of ['#baBtn','#poseBtn','#clothesBtn','#ageBtn'])assert.equal(await p.$eval(id,e=>e.getBoundingClientRect().width),0,id+' tucked away');
 await p.click('#lookBtn');assert.equal(await p.$eval('#lookMenu',e=>e.hidden),false,'Preview opens its menu');
 for(const id of ['#baBtn','#poseBtn','#clothesBtn','#ageBtn']){const r=await p.$eval(id,e=>{const r=e.getBoundingClientRect();return [r.width,r.height];});assert.ok(r[0]>=44&&r[1]>=44,id+' big enough');}
 await send([['pointerdown',13,600,300],['pointerup',13,600,300]]);await wait(200);
 assert.equal(await p.$eval('#lookMenu',e=>e.hidden),true,'touching the body closes it');
 await p.evaluate(()=>window.__ink.setAging(10));await wait(200);
 assert.equal(await p.$eval('#lookBtn',e=>e.textContent),'Preview: 10 years','Preview says what is on');
 await p.evaluate(()=>window.__ink.setAging(0));
 console.log('PASS t48 keep view: tap keeps zoom and angle, panel never hides the tapped tattoo, wobbly pan stays a pan, leftover finger ignored, panels fade while moving, one Preview button');
}
