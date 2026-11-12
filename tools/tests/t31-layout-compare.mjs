import assert from 'node:assert/strict';
export default async function(p){
 const wait=()=>new Promise(r=>setTimeout(r,650));
 await p.evaluate(()=>{const a=window.__ink,s=a.state(),snap=JSON.parse(JSON.stringify(s));delete snap.layouts;delete snap.checkpoints;delete snap.views;const b=JSON.parse(JSON.stringify(snap));b.tattoos[0].hidden=true;s.layouts=[{id:'compare-a',name:'Original',state:snap},{id:'compare-b',name:'Alternate',state:b}];a.commitTest();});
 const before=await p.evaluate(()=>({state:JSON.stringify(window.__ink.state()),goal:JSON.stringify(window.__ink.goal)}));
 await p.click('#projectsBtn');await p.click('#openPlanning');await p.waitForSelector('[data-compare-3d]');await wait();await p.click('[data-compare-3d]');await p.waitForSelector('.layout-compare');await wait();
 const diag=()=>p.evaluate(()=>document.querySelector('.layout-compare').__compareTest());const first=await diag();assert.equal(first.cameraCount,1);assert.equal(first.synchronized,true);
 const box=await p.$eval('.layout-compare [data-stage]',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5}});await p.mouse.move(box.x,box.y);await p.mouse.down();await p.mouse.move(box.x+80,box.y+20,{steps:5});await p.mouse.up();await wait();assert.notEqual((await diag()).yaw,first.yaw);
 for(const value of [0,25,100]){await p.$eval('[data-wipe]',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input'));},value);await wait();assert.equal((await diag()).wipe,value/100);}
 await p.$eval('[data-wipe]',e=>{e.value=50;e.dispatchEvent(new Event('input'));});await wait();await p.screenshot({path:'/tmp/ink-layout-compare.png'});
 assert.deepEqual(await p.evaluate(()=>({state:JSON.stringify(window.__ink.state()),goal:JSON.stringify(window.__ink.goal)})),before);
 await p.evaluate(()=>window.compareHost=document.querySelector('.layout-compare'));await p.click('.layout-compare [data-close]');await wait();assert.equal(await p.$('.layout-compare'),null);assert.equal(await p.evaluate(()=>window.compareHost.__compareTest().closed),true);assert.deepEqual(await p.evaluate(()=>({state:JSON.stringify(window.__ink.state()),goal:JSON.stringify(window.__ink.goal)})),before);
 await p.evaluate(()=>window.__ink.state().layouts[1].state.weight=.01);await p.click('[data-compare-3d]');await wait();assert.equal(await p.$('.layout-compare'),null);assert.match(await p.$eval('.ip-status',e=>e.textContent),/body|shape|match/i);
 await p.evaluate(()=>{const s=window.__ink.state();s.layouts[1].state.weight=s.weight;s.layouts[1].state.tattoos[0].img='missing-fixture';});await p.click('[data-compare-3d]');await wait();assert.equal(await p.$('.layout-compare'),null);assert.match(await p.$eval('.ip-status',e=>e.textContent),/missing|unavailable|image|restored|incomplete/i);
 console.log('PASS live compare actual planning integration, shared camera orbit/wipe, state/view unchanged, close and body/image rejection');
}
