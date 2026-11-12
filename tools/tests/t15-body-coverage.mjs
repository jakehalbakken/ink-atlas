import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=500)=>new Promise(r=>setTimeout(r,n));const open=async id=>{await p.click('#projectsBtn');await p.click(id);await wait(900);};
 await open('#openBodyTools');await p.click('[data-mode=pin]');
 const r=await p.$eval('.bt-stage',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
 await p.mouse.click(r.x+r.w*.5,r.y+r.h*.38);await wait();
 assert(!(await p.$eval('#bt-text',x=>x.disabled)),'body pin picked');await p.type('#bt-text','Leave breathing room here.');await p.click('[data-save]');await wait();
 assert.equal(await p.evaluate(()=>window.__ink.state().notes.filter(n=>n.anchor).length),1);
 await p.reload({waitUntil:'load'});await wait(1500);await open('#openBodyTools');
 assert.equal(await p.evaluate(()=>document.querySelector('#ink-body-tools').__bodyToolsTest().notes.filter(n=>n.anchor).length),1,'pin persists');
 await p.click('[data-mode=measure]');await p.mouse.click(r.x+r.w*.5,r.y+r.h*.38);await p.mouse.click(r.x+r.w*.5,r.y+r.h*.46);await wait();
 assert((await p.$eval('.bt-measure',e=>e.textContent)).includes('cm'),'ruler reports cm');
 await p.screenshot({path:'shots/body-ruler.png'});await p.click('#ink-body-tools [data-close]');
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));await open('#openClothing');
 let d=await p.evaluate(()=>document.querySelector('.clothing-preview').__clothingTest());assert.equal(d.enabled.length,0);
 for(const kind of ['short','long','collar','shorts','hair']){await p.click(`[data-coverage=${kind}]`);await wait(200);}
 d=await p.evaluate(()=>document.querySelector('.clothing-preview').__clothingTest());assert(d.inputsUnchanged);assert(d.coveredDecalTriangles>0,'clothing hides covered ink');assert(!d.enabled.includes('short'));assert(d.enabled.includes('long'));assert(Object.values(d.triangles).every(n=>n>0));
 await p.screenshot({path:'shots/coverage-all.png'});await p.click('.clothing-preview [data-close]');assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before);
 console.log('PASS t15 body pin save/reload, approximate ruler, isolated coverage toggles');
}
