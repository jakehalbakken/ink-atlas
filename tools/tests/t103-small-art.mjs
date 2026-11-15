// Small artwork warning: a small artwork file on a big piece makes Ink check and the stencil say
// it will print soft, with the width a sharp file needs; a big file says nothing.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const make=(px)=>p.evaluate(async(px)=>{const a=window.__ink,c=document.createElement('canvas');c.width=c.height=px;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,px,px);g.strokeStyle='black';g.lineWidth=px/20;g.strokeRect(px*.2,px*.2,px*.6,px*.6);
  const t=await a.addArt(c.toDataURL(),'Small file '+px,{...a.surfaceAt([0,1.25,2],[0,0,-1]),width:.16});a.commitTest();a.select(t.id);return t.id;},px);
 await make(240);await wait(300);
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 await p.$eval('#bInkCheck',e=>e.click());
 await p.waitForFunction(()=>document.querySelectorAll('#icList li').length>0,{timeout:30000});
 const items=await p.$$eval('#icList li',a=>a.map(e=>e.textContent));
 const soft=items.find(t=>/artwork file is 240 px wide/.test(t));
 assert.ok(soft,'warns: '+JSON.stringify(items));
 assert.match(soft,/about \d+ dots per inch/);assert.match(soft,/at least \d+ px wide/);
 assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('ia-tried')||'[]').includes('sharp')),'ticked when shown');
 await p.$eval('#icClose',e=>e.click());await wait(200);
 await p.$eval('#bStencil',e=>e.click());
 await p.waitForFunction(()=>!document.querySelector('#stPrint').disabled,{timeout:60000});
 assert.match(await p.$eval('#stText',e=>e.textContent),/artwork file is small for this size/,'stencil says it too');
 await p.$eval('#stClose',e=>e.click());await wait(200);
 // a big file is quiet
 await make(1400);await wait(300);
 await p.$eval('#bInkCheck',e=>e.click());
 await p.waitForFunction(()=>document.querySelectorAll('#icList li').length>0,{timeout:30000});
 const big=await p.$$eval('#icList li',a=>a.map(e=>e.textContent));
 assert.ok(!big.some(t=>/artwork file/.test(t)),'no warning for a big file: '+JSON.stringify(big));
 console.log(soft);
}
