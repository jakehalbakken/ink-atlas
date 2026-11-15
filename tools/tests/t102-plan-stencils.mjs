// Every stencil in one PDF: with two or more planned pieces, Stencil for your artist offers All
// planned pieces, which saves one PDF with each planned stencil at real size. Hidden pieces and
// ink already on are left out, and the project never changes. Saves shots/t102-stencils.pdf.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const planned=all.filter(t=>t.status!=='existing'&&!t.hidden);
 assert.ok(planned.length>=2,'sample has two planned pieces: '+planned.length);
 await (await p.$$('#trayItems .chip'))[0].click();await wait(300);
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.name)window.saved[blob.name]=blob.arrayBuffer();return old.call(this,blob);};});
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 await p.$eval('#bStencil',e=>e.click());
 await p.waitForFunction(()=>!document.querySelector('#stPrint').disabled,{timeout:60000});
 assert.equal(await p.$eval('#stAll',e=>e.hidden),false,'All planned pieces shows');
 assert.match(await p.$eval('#stAll',e=>e.textContent),new RegExp(`All ${planned.length} planned pieces`));
 const r=await p.$eval('#stAll',e=>{const b=e.getBoundingClientRect();return {h:b.height,bottom:b.bottom};});
 assert.ok(r.h>=44&&r.bottom<=await p.evaluate(()=>innerHeight),'big enough and on screen');
 // the stencil itself is not covered by the bar
 const ov=await p.evaluate(()=>{const a=document.querySelector('#stCanvas').getBoundingClientRect(),b=document.querySelector('#stBar').getBoundingClientRect();return a.bottom<=b.top+1;});
 assert.ok(ov,'bar clear of the stencil');
 await p.$eval('#stAll',e=>e.click());
 await p.waitForFunction(()=>Object.keys(window.saved).includes('tattoo-plan-stencils.pdf'),{timeout:90000});
 const info=await p.evaluate(()=>window.__lastPlanStencils);
 assert.equal(info.count,planned.length,'every planned piece: '+JSON.stringify(info));
 const pdf=Buffer.from(await p.evaluate(async()=>Array.from(new Uint8Array(await window.saved['tattoo-plan-stencils.pdf']))));
 assert.equal(pdf.toString('ascii',0,5),'%PDF-');
 const txt=pdf.toString('latin1');
 assert.equal((txt.match(/\/Subtype\s*\/Image/g)||[]).length,planned.length,'one picture per piece');
 for(const t of planned)assert.ok(txt.includes((t.name||'Tattoo').split(' ')[0]),'named: '+t.name);
 writeFileSync('shots/t102-stencils.pdf',pdf);
 assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('ia-tried')||'[]').includes('planStencils')),'ticked when used');
 await p.$eval('#stClose',e=>e.click());await wait(200);
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project unchanged');
 console.log(JSON.stringify(info));
}
