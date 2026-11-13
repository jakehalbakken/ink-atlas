// New to try: a small button with a count of untried features opens a list with how to try each
// one and a Show me that opens the right panel and rings the exact control. Ticks are kept on
// this device, a feature ticks itself when it is used, and the button goes away once
// everything is tried (the Plan menu still opens the list).
import assert from 'node:assert/strict';
import { NEW_FEATURES } from '../../src/whats-new.js';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 const ready=async()=>{await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1000);};
 await ready();
 const N=NEW_FEATURES.length;
 const count=()=>p.$eval('#newCount',e=>+e.textContent);
 const btn=await p.$eval('#newBtn',e=>{const r=e.getBoundingClientRect();return {h:r.height,hidden:e.hidden};});
 assert.equal(btn.hidden,false,'button shows');assert.ok(btn.h>=44,'button big enough');assert.equal(await count(),N,'every feature untried at first');
 const open=async()=>{if(await p.$eval('#newPop',e=>e.hidden)){await p.$eval('#newBtn',e=>e.click());await wait(200);}};
 await open();
 assert.equal(await p.$$eval('#newList .newrow',a=>a.length),N,'one row each');
 const rowSizes=await p.$$eval('#newList .newrow button',a=>a.map(b=>b.getBoundingClientRect().height));assert.ok(rowSizes.every(h=>h>=44),'row buttons big enough');
 // manual tick and untick
 await p.$eval('#newList .newrow[data-feature="pan"] .tick',e=>e.click());await wait(100);
 assert.equal(await count(),N-1,'ticked');assert.equal(await p.$eval('#newList .newrow:last-child',e=>e.dataset.feature),'pan','tried ones go to the bottom');
 assert.equal(await p.$eval('#newList .newrow[data-feature="pan"]',e=>e.classList.contains('done')),true);
 await p.$eval('#newList .newrow[data-feature="pan"] .tick',e=>e.click());await wait(100);assert.equal(await count(),N,'unticked');
 // Show me for every feature rings the control that does it
 const expect={posesSheet:['#cPoses','#share'],agingSheet:['#cAging','#share'],hair:['#hairRow','#bodyPop'],compareShot:['#cCompare','#share'],gap:['#gap','#sheet'],skinDetail:['#faceBtn','#bodyPop'],face:['#faceBtn','#bodyPop'],bodyPhoto:['#bodyPhotoBtn','#bodyPop'],definition:['#rMuscle','#bodyPop'],spots:['#bSpots','#editorAdvanced'],tryOn:['#bTryOn','#editorAdvanced'],skinTone:['#skinOwnBtn','#bodyPop'],light:['#lightBtn','#lookMenu'],drawNew:['#drawNew'],otherSide:['#bOtherSide','#editorAdvanced'],realSize:['#bRealSize','#editorAdvanced'],handles:['#hSize'],palette:['#cSwatches','#share'],editProcreate:['#bProcreate'],pan:[null]};
 for(const f of NEW_FEATURES){
  await open();
  await p.$eval(`#newList .newrow[data-feature="${f.id}"] .btn:not(.tick)`,e=>e.click());await wait(900);
  assert.equal(await p.$eval('#newPop',e=>e.hidden),true,`${f.id}: list gets out of the way`);
  const tip=await p.$eval('#pointTip',e=>({hidden:e.hidden,text:e.textContent}));assert.equal(tip.hidden,false,`${f.id}: tip shows`);assert.ok(tip.text.length>10);
  const [target,panel]=expect[f.show];
  if(target){
   const m=await p.evaluate(sel=>{const n=document.querySelector(sel),c=document.querySelector('#pointRing');if(!n||c.hidden)return null;const a=n.getBoundingClientRect(),b=c.getBoundingClientRect();return {inside:a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom,onScreen:a.top>=0&&a.bottom<=innerHeight&&a.left>=0&&a.right<=innerWidth,w:a.width};},target);
   assert.ok(m&&m.inside&&m.onScreen&&m.w>0,`${f.id}: ring around ${target} on screen: ${JSON.stringify(m)}`);
   if(panel){const shown=await p.$eval(panel,e=>e.tagName==='DETAILS'?e.open:!e.hidden);assert.ok(shown,`${f.id}: ${panel} is open`);}
  } else assert.equal(await p.$eval('#pointRing',e=>e.hidden),true,`${f.id}: no ring, just the tip`);
  // a touch anywhere puts the pointer away
  await p.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));await wait(100);
  assert.equal(await p.$eval('#pointTip',e=>e.hidden),true,`${f.id}: touch dismisses`);
  await p.keyboard.press('Escape');await wait(200);
 }
 assert.equal(await count(),N,'Show me alone does not tick');
 // using a feature ticks it: the Light, and a two-finger pan
 await p.click('#lookBtn');await wait(100);await p.click('#lightBtn');await wait(100);await p.click('[data-light="warm"]');await wait(100);await p.click('[data-light="studio"]');await p.keyboard.press('Escape');await wait(150);
 assert.equal(await count(),N-1,'trying the Light ticks it');
 await p.evaluate(()=>{const c=document.querySelector('#stage canvas'),ev=(t,id,x,y)=>c.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,buttons:t==='pointerup'?0:1}));
  ev('pointerdown',1,60,700);ev('pointerdown',2,160,700);for(let i=1;i<=6;i++){ev('pointermove',1,60+i*12,700-i*4);ev('pointermove',2,160+i*12,700-i*4);}ev('pointerup',1,132,676);ev('pointerup',2,232,676);});await wait(200);
 assert.equal(await count(),N-2,'a two-finger move ticks pan');
 // kept on this device
 await p.reload();await ready();assert.equal(await count(),N-2,'ticks kept after reopening');
 await open();assert.deepEqual(await p.$$eval('#newList .newrow.done',a=>a.map(e=>e.dataset.feature).sort()),['light','pan']);
 // tick the rest: the button goes, the Plan menu still opens the list
 for(const f of NEW_FEATURES)await p.$eval(`#newList .newrow[data-feature="${f.id}"] .tick[aria-checked="false"]`,e=>e.click()).catch(()=>{});
 await wait(150);assert.equal(await p.$eval('#newBtn',e=>e.hidden),true,'button goes once all are tried');
 await p.keyboard.press('Escape');await wait(100);
 await p.click('#planBtn').catch(async()=>{await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Plan');b&&b.click();});});await wait(200);
 await p.$eval('#openNew',e=>e.click());await wait(200);assert.equal(await p.$eval('#newPop',e=>e.hidden),false,'Plan menu opens the list');assert.equal(await p.$eval('#planMenu',e=>e.hidden),true);
 console.log(`PASS t55 new to try: ${N} features, every Show me rings its control, ticks kept and auto-ticked`);
}
