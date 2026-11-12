import assert from 'node:assert/strict';
export default async function(p){
 const wait=()=>new Promise(r=>setTimeout(r,500));
 const clean=async button=>{await p.click(button);await wait();await p.click('[data-action=paper]');await p.click('[data-action=apply]');await wait();};
 await p.click('#trayItems .chip');await clean('#bCleanup');await p.click('#bDup');await wait();
 const before=await p.evaluate(()=>window.__ink.state().tattoos.filter(t=>t.name.includes("Sunburst")).map(t=>t.img));assert.equal(before.length,2);assert.equal(before[0],before[1]);
 await clean('#bCleanupLinked');
 const after=await p.evaluate(()=>window.__ink.state().tattoos.filter(t=>t.name.includes("Sunburst")).map(t=>t.img));assert.equal(after[0],after[1]);assert.notEqual(before[0],after[0]);
 await clean('#bCleanup');
 const independent=await p.evaluate(()=>window.__ink.state().tattoos.filter(t=>t.name.includes("Sunburst")).map(t=>t.img));assert.notEqual(independent[0],independent[1]);
 console.log('PASS t13 explicit linked cleanup then independent fork');
}
