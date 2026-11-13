// Light in Preview: Studio, Daylight, Warm room and Midday sun change how the body is lit, show
// in the Preview button, stay on this device after a reload, and never touch the project or
// the undo history.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 const ready=async()=>{await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1000);await p.click('#views [data-view="0"]');await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});await wait(300);};
 await ready();
 const spots=await p.evaluate(()=>[[0.05,1.05,0.5],[0,1.35,0.5],[0.08,0.6,0.5]].map(o=>window.__ink.surfaceHit(o,[0,0,-1]).pos));
 const look=async()=>{const out=[];for(const s of spots){const q=await p.evaluate(pos=>window.__ink.projectPoint(pos),s);out.push(await p.evaluate(q=>window.__ink.pixelAt(q.x,q.y),q));}return out;};
 const avg=(px)=>[0,1,2].map(k=>px.reduce((a,c)=>a+c[k],0)/px.length);
 const proj0=await p.evaluate(()=>JSON.stringify(window.__ink.state()));const undo0=await p.$eval('#undo',e=>e.disabled);
 const studio=avg(await look());
 await p.click('#lookBtn');await wait(150);
 const b=await p.$eval('#lightBtn',e=>{const r=e.getBoundingClientRect();return [r.height,e.textContent];});assert.ok(b[0]>=44,'Light button big enough');assert.equal(b[1],'Light');
 await p.click('#lightBtn');await wait(200);
 assert.equal(await p.$eval('#lookMenu',e=>e.hidden),true,'menu closes');assert.equal(await p.$eval('#lightPop',e=>e.hidden),false,'Light panel opens');
 assert.deepEqual(await p.$$eval('#lightChoices [data-light]',a=>a.map(e=>e.textContent)),['Studio','Daylight','Warm room','Midday sun']);
 assert.equal(await p.$eval('[data-light="studio"]',e=>e.getAttribute('aria-pressed')),'true');
 const pick=async(id)=>{await p.click(`[data-light="${id}"]`);await wait(250);return avg(await look());};
 const warm=await pick('warm');
 assert.ok((warm[0]-warm[2])-(studio[0]-studio[2])>12,`warm room is warmer: ${studio.map(Math.round)} -> ${warm.map(Math.round)}`);
 const day=await pick('day');assert.ok((day[0]-day[2])<(warm[0]-warm[2])-12,'daylight is cooler than the warm room');
 const sun=await pick('sun');assert.notDeepEqual(sun.map(Math.round),studio.map(Math.round),'midday sun is different');
 assert.equal(await p.$eval('[data-light="sun"]',e=>e.getAttribute('aria-pressed')),'true');
 assert.match(await p.$eval('#lookBtn',e=>e.textContent),/Midday sun/,'Preview button says so');
 // the project and its undo history are untouched
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),proj0,'project unchanged');assert.equal(await p.$eval('#undo',e=>e.disabled),undo0,'no undo step');
 // kept on this device
 await p.reload();await ready();
 assert.equal(await p.$eval('#lookBtn',e=>e.textContent),'Preview: Midday sun','still midday sun after reopening');
 const again=avg(await look());assert.ok(again.every((v,k)=>Math.abs(v-sun[k])<4),'same light after reopening');
 await p.click('#lookBtn');await wait(150);await p.click('#lightBtn');await wait(150);
 const back=await pick('studio');assert.ok(back.every((v,k)=>Math.abs(v-studio[k])<3),'studio is the original light');
 assert.equal(await p.$eval('#lookBtn',e=>e.textContent),'Preview','Preview button plain again');
 await p.keyboard.press('Escape');await wait(100);assert.equal(await p.$eval('#lightPop',e=>e.hidden),true,'Escape closes it');
 console.log(`PASS t54 light: studio ${studio.map(Math.round)}, warm ${warm.map(Math.round)}, day ${day.map(Math.round)}, sun ${sun.map(Math.round)}`);
}
