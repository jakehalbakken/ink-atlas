import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=600)=>new Promise(r=>setTimeout(r,n));const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.click('#projectsBtn');await p.click('#openPhotoFit');await wait(900);
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=64;c.getContext('2d').fillRect(10,10,20,40);const blob=await new Promise(r=>c.toBlob(r));const dt=new DataTransfer();dt.items.add(new File([blob],'temporary-reference.png',{type:'image/png'}));const input=document.querySelector('[data-file=front]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));});await wait();
 assert.equal(await p.evaluate(()=>document.querySelector('#ink-photo-fit').__photoFitTest().photoCount),1);
 await p.$eval('[data-param=heightCm]',e=>{e.value='190';e.dispatchEvent(new Event('input',{bubbles:true}));});await p.click('[data-before]');assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'preview does not change project');
 await p.screenshot({path:'shots/photo-fit.png'});await p.click('#ink-photo-fit [data-apply]');await wait(1200);
 assert.equal(await p.evaluate(()=>window.__ink.state().heightCm),190);assert((await p.evaluate(()=>window.__ink.state().projectName)).includes('fitted copy'));
 assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),JSON.parse(before).tattoos.length);
 await p.click('#projectsBtn');await p.click('#openProjects');await wait();assert((await p.$eval('.is-list',x=>x.textContent)).includes('before fitting'));
 await p.evaluate(()=>[...document.querySelectorAll('.is-list button')].find(x=>x.textContent==='Open').click());await wait(1000);
 assert.equal(await p.evaluate(()=>window.__ink.state().heightCm),JSON.parse(before).heightCm,'original copy preserved');
 console.log('PASS t18 local photo reference preview, separate fitted copy and original restore');
}
