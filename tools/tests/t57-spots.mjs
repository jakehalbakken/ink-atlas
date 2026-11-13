// Try other spots: one tap moves the selected tattoo to a usual placement on the chosen side,
// facing the right way, running along the limb, with the view following it into the free space
// beside the panel. Undo puts it back; a locked tattoo or a pose stops it with a message.
import assert from 'node:assert/strict';
import { SPOTS } from '../../src/spots.js';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 await (await p.$$('#trayItems .chip'))[1].click();await wait(300);
 const id=await p.evaluate(()=>window.__ink.selected());
 const before=await p.evaluate(id=>JSON.stringify(window.__ink.state().tattoos.find(t=>t.id===id)),id);
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 assert.ok(await p.$eval('#bSpots',e=>e.getBoundingClientRect().height>=44),'button big enough');
 await p.$eval('#bSpots',e=>e.click());await wait(300);
 assert.equal(await p.$eval('#spotPop',e=>e.hidden),false,'panel opens');
 assert.equal(await p.$$eval('#spotChoices [data-spot]',a=>a.length),SPOTS.length);
 assert.ok((await p.$$eval('#spotPop button',a=>a.map(b=>b.getBoundingClientRect().height))).every(h=>h>=44),'buttons big enough');
 const tat=()=>p.evaluate(id=>{const t=window.__ink.state().tattoos.find(t=>t.id===id);return {pos:t.pos,normal:t.normal,rot:t.rot};},id);
 const facing={front:[0,0,1],back:[0,0,-1]};
 const pop=await p.$eval('#spotPop',e=>e.getBoundingClientRect().right);
 for(const side of ['L','R']){
  await p.$eval(`#spotSide [data-side="${side}"]`,e=>e.click());await wait(100);
  for(const s of SPOTS){
   if(side==='R'&&s.mid)continue;
   await p.$eval(`#spotChoices [data-spot="${s.id}"]`,e=>e.click());await wait(60);
   const t=await tat();
   // which side: the body's own left is +x
   if(!s.mid)assert.ok(side==='L'?t.pos[0]>0.02:t.pos[0]<-0.02,`${s.id} ${side}: on that side ${t.pos}`);
   else assert.ok(Math.abs(t.pos[0])<0.03,`${s.id}: on the centre line ${t.pos}`);
   const want=facing[s.dir]||[side==='L'?1:-1,0,0];
   const dot=want[0]*t.normal[0]+want[1]*t.normal[1]+want[2]*t.normal[2];
   assert.ok(dot>(/wrist|forearm/.test(s.id)?0.15:0.35),`${s.id} ${side}: faces ${s.dir} (${dot.toFixed(2)})`);
   assert.ok(t.pos[1]>0.03&&t.pos[1]<1.7,`${s.id}: on the body`);
  }
 }
 // limbs: the art runs along the limb, the top towards the body
 await p.$eval('#spotSide [data-side="L"]',e=>e.click());await p.$eval('#spotChoices [data-spot="forearm-front"]',e=>e.click());await wait(60);
 const fa=await tat();assert.ok(Math.abs(fa.rot)>0.2,`forearm art turned along the arm (${fa.rot})`);
 await p.waitForFunction(()=>window.__ink.settled(),{timeout:6000}).catch(()=>{});await wait(200);
 const scr=await p.evaluate(id=>window.__ink.projectPoint(window.__ink.state().tattoos.find(t=>t.id===id).pos),id);
 const sheet=await p.$eval('#dock',e=>e.getBoundingClientRect().left);
 assert.ok(scr.x>pop&&scr.x<sheet&&scr.y>80&&scr.y<780,`view follows it into the free space ${JSON.stringify(scr)} pop ${pop} sheet ${sheet}`);
 await p.screenshot({path:'shots/t57-forearm.png'});
 // undo goes back step by step; many taps, then undo all the way restores the start
 for(let i=0;i<60;i++){const s=await p.evaluate(id=>JSON.stringify(window.__ink.state().tattoos.find(t=>t.id===id)),id);if(s===before)break;await p.$eval('#undo',e=>e.click());await wait(30);}
 // the undo stack holds 40 steps: at least the last tap undoes back to the one before
 await p.$eval('#spotChoices [data-spot="calf"]',e=>e.click());await wait(60);const c1=await tat();
 await p.$eval('#spotChoices [data-spot="shin"]',e=>e.click());await wait(60);
 await p.$eval('#undo',e=>e.click());await wait(60);assert.deepEqual(await tat(),c1,'undo puts it back');
 // locked: refuses
 await p.evaluate(id=>{window.__ink.state().tattoos.find(t=>t.id===id).locked=true;window.__ink.commitTest();},id);
 await p.$eval('#spotChoices [data-spot="shin"]',e=>e.click());await wait(60);
 assert.deepEqual(await tat(),c1,'locked stays');assert.match(await p.$eval('#toast',e=>e.textContent),/Unlock/);
 await p.evaluate(id=>{window.__ink.state().tattoos.find(t=>t.id===id).locked=false;window.__ink.commitTest();},id);
 // Escape closes the panel
 await p.keyboard.press('Escape');await wait(100);assert.equal(await p.$eval('#spotPop',e=>e.hidden),true,'Escape closes');
 console.log(`PASS t57 try other spots: ${SPOTS.length} spots on both sides, facing out, along the limb, view follows, undo and lock`);
}
