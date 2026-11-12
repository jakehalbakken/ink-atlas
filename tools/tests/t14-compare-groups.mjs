import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=500)=>new Promise(r=>setTimeout(r,n));const open=async id=>{await p.click('#projectsBtn');await p.click(id);await wait();};
 await open('#openPlanning');await p.type('[data-name]','Before');await p.click('[data-save]');await wait();
 await p.$eval('[data-name]',x=>x.value='After');await p.click('[data-save]');await wait();
 const records=await p.evaluate(()=>window.__ink.state().layouts);assert(records.every(x=>x.preview?.startsWith('data:image/jpeg')));
 await p.select('[data-compare-a]',records[0].id);await p.select('[data-compare-b]',records[1].id);await p.click('[data-compare]');await wait();
 assert.equal(await p.$$eval('.ip-visual img',x=>x.length),2);await p.screenshot({path:'shots/visual-comparison.png'});
 await p.click('.ink-planning [data-close]');
 await p.evaluate(()=>{const s=window.__ink.state();s.tattoos=s.tattoos.filter(t=>t.name.includes('Sunburst'));window.__ink.commitTest();});await p.click('#trayItems .chip');await p.click('#bDup');await p.click('#full');await wait();
 await open('#openLayers');await p.click('[data-act=all]');await p.click('#il-transform summary');
 const before=await p.evaluate(()=>window.__ink.state().tattoos.map(t=>({id:t.id,pos:t.pos,width:t.width})));
 await p.click('[data-transform=Larger]');await wait();
 console.log('group result',await p.$eval('#il-status',x=>x.textContent)); const after=await p.evaluate(()=>window.__ink.state().tattoos.map(t=>({id:t.id,pos:t.pos,width:t.width})));
 assert(after.some((t,i)=>t.width>before[i].width),'group scale applied');assert(after.some((t,i)=>JSON.stringify(t.pos)!==JSON.stringify(before[i].pos)),'group spacing changed');
 await p.click('[data-act=close]');await p.click('#undo');await wait();
 assert.deepEqual(await p.evaluate(()=>window.__ink.state().tattoos.map(t=>({id:t.id,pos:t.pos,width:t.width}))),before,'group transform one undo');
 console.log('PASS t14 saved visual comparison and spatial group scale/undo');
}
