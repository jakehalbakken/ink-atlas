import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=700)=>new Promise(r=>setTimeout(r,n));
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});const old=URL.createObjectURL;window.savedJson={};URL.createObjectURL=function(blob){if(blob.name?.endsWith('.json'))window.savedJson[blob.name]=blob.text();return old.call(this,blob);};});
 await p.click('#shareBtn');await p.click('#cV47');await p.waitForSelector('#v47Export');await p.evaluate(()=>[...document.querySelectorAll('#v47Export button')].find(x=>x.textContent==='Save v47 compatibility copy').click());await wait();
 const portable=await p.evaluate(async()=>JSON.parse(await window.savedJson['ink-atlas-v47-compatibility.ink.json']));assert.equal(portable.format,'ink-atlas-portable');await p.evaluate(()=>[...document.querySelectorAll('#v47Export button')].find(x=>x.textContent==='Close').click());
 portable.project.tattoos.push({...portable.project.tattoos[0],id:'unplaced-test',artworkId:'unplaced-art',name:'Saved unplaced',position:null,normal:null,status:'planned'});
 await p.evaluate(async doc=>{window.__ink.state().notes=[{id:'old',text:'OLD PROJECT MUST NOT LEAK'}];window.__ink.state().projectName='Old project';await window.__ink.importBackup(JSON.stringify(doc));},portable);await wait();
 let s=await p.evaluate(()=>window.__ink.state());assert(!JSON.stringify(s.notes).includes('OLD PROJECT'));assert.equal(s.unplacedTattoos.length,1);assert.equal(s.tattoos.length,portable.project.tattoos.length-1);assert.deepEqual(s.v47Source.project,portable.project);
 await p.evaluate(()=>window.__ink.flush());await p.reload({waitUntil:'load'});await wait(1500);s=await p.evaluate(()=>window.__ink.state());assert.equal(s.unplacedTattoos.length,1);assert.deepEqual(s.v47Source.project,portable.project);
 await p.click('#projectsBtn');await p.click('#openUnplaced');await p.evaluate(()=>[...document.querySelectorAll('.scrim button')].find(x=>x.textContent.startsWith('Place Saved unplaced')).click());await wait();s=await p.evaluate(()=>window.__ink.state());assert.equal(s.unplacedTattoos.length,0);assert(s.tattoos.find(t=>t.id==='unplaced-test').pos);assert.equal(s.v47Source.project.tattoos.at(-1).position,null);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));portable.project.tattoos[0].image='ink-atlas-image:9999';await p.evaluate(doc=>window.__ink.importBackup(JSON.stringify(doc)),portable);assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'bad import leaves current untouched');
 console.log('PASS t21 v47 export/import isolation, untouched source, unplaced retention/reload/explicit placement, failed import safety');
}
