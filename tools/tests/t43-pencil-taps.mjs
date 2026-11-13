// Apple Pencil taps on buttons: a short pen press that starts and ends on a button
// clicks it exactly once, whether or not the browser sends its own click, a pen drag
// does not, a finger is left to the browser, and a one-touch move on a button is not
// blocked (that blocking is what cancels a Pencil tap on iPad).
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 // press: a pen (or finger) press on a selector, with drift, optionally followed by the browser's own click
 const press=(sel,{type='pen',drift=3,browserClick=false}={})=>p.evaluate(({sel,type,drift,browserClick})=>{
  const el=document.querySelector(sel);if(!el)throw new Error('missing '+sel);
  // Before/after, Pose, Clothes and Aging sit behind the Preview button
  const menu=el.closest('#lookMenu');if(menu&&menu.hidden)menu.hidden=false;
  let n=0;const count=()=>{n++;};el.addEventListener('click',count);
  const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  const ev=(name,dx)=>el.dispatchEvent(new PointerEvent(name,{bubbles:true,cancelable:true,composed:true,pointerId:7,pointerType:type,isPrimary:true,clientX:x+dx,clientY:y+dx,button:0,buttons:name==='pointerup'?0:1}));
  ev('pointerdown',0);ev('pointermove',drift/2);ev('pointerup',drift);
  if(browserClick)el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x+drift,clientY:y+drift}));
  el.removeEventListener('click',count);return n;
 },{sel,type,drift,browserClick});
 // the buttons Jake taps most, outside and inside panels
 for(const sel of ['#views [data-view="2"]','#full','#poseBtn','#poseBtn']){
  assert.equal(await press(sel),1,'pen tap clicks once: '+sel);
  assert.equal(await press(sel,{browserClick:true}),1,'browser click is not a second one: '+sel);await wait(100);
 }
 assert.ok(await p.$eval('#posePop',e=>e.hidden),'Pose toggled an even number of times');
 await press('#clothesBtn');assert.ok(await p.$eval('#clothesPop',e=>!e.hidden),'pen opens the Clothes panel');
 assert.equal(await press('#clothesTop [data-top=long]',{browserClick:true}),1);assert.equal(await p.evaluate(()=>window.__ink.clothes().top),'long','pen picks a top');
 await press('#clothesTop [data-top=none]');await press('#clothesPop [data-close=clothesPop]');assert.ok(await p.$eval('#clothesPop',e=>e.hidden),'pen closes it');
 // the buttons Jake named: Plan, Body and the purple Upload tattoo
 await press('#projectsBtn',{browserClick:true});assert.ok(await p.$eval('#planMenu',e=>!e.hidden),'pen opens Plan');
 await p.evaluate(()=>{document.querySelector('#planMenu').hidden=true;});
 await press('#bodyBtn');assert.ok(await p.$eval('#bodyPop',e=>!e.hidden),'pen opens Body');
 await press('#bodyBtn',{browserClick:true});assert.ok(await p.$eval('#bodyPop',e=>e.hidden),'pen closes Body, once');
 const picks=await p.evaluate(()=>{window.__picks=0;const f=document.querySelector('#file'),o=f.click;f.click=()=>{window.__picks++;};window.__restorePick=()=>{f.click=o;};return 0;});
 assert.equal(await press('#add',{browserClick:true}),1,'pen taps Upload tattoo once');
 assert.equal(await p.evaluate(()=>{const n=window.__picks;window.__restorePick();return n;}),1+picks,'Upload opens the photo picker once');
 // tray chip selects the tattoo with the pen
 const id=await p.evaluate(()=>window.__ink.state().tattoos[0].id);
 assert.equal(await press('#trayItems button.chip'),1);await wait(200);
 assert.equal(await p.evaluate(()=>window.__ink.selected()),id,'pen selects from the tray');
 // a pen drag that leaves the button is not a tap; a finger is left to the browser
 assert.equal(await press('#poseBtn',{drift:40}),0,'pen drag does not click');
 assert.equal(await press('#poseBtn',{type:'touch'}),0,'finger press without a browser click: nothing added');
 assert.equal(await press('#poseBtn',{type:'touch',browserClick:true}),1,'finger click untouched');
 assert.ok(await p.$eval('#posePop',e=>!e.hidden),'that finger click opened Pose');await press('#posePop [data-close=posePop]');
 // a one-touch move on a button is not blocked, a move on the body still is
 const blocked=await p.evaluate(()=>{const out={};for(const [k,sel] of [['button','#full'],['body','#stage canvas']]){const el=document.querySelector(sel),r=el.getBoundingClientRect();
  const t=new Touch({identifier:3,target:el,clientX:r.x+r.width/2,clientY:r.y+r.height/2,touchType:'stylus'});
  const ev=new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t],targetTouches:[t],changedTouches:[t]});el.dispatchEvent(ev);out[k]=ev.defaultPrevented;}return out;});
 assert.equal(blocked.button,false,'a touch moving on a button is not cancelled');assert.equal(blocked.body,true,'the page still does not scroll');
 // a pen press on the 3D body is the body's own business: no synthetic click
 assert.equal(await press('#stage canvas',{drift:2}),0,'no click made on the 3D view');
 const s=JSON.parse(await p.evaluate(()=>JSON.stringify(window.__ink.state())));const b=JSON.parse(before);
 assert.deepEqual(s.tattoos,b.tattoos,'tattoos unchanged by taps');
 console.log('PASS t43 pencil taps click once on buttons, drags and fingers left alone, button touch moves not blocked');
}
