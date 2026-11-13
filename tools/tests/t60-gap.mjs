// Gap to the nearest tattoo: the edit panel says how much bare skin lies between the selected
// tattoo's ink and the nearest other tattoo's ink, in inches (or that they touch). It is no more
// than the distance between their centres, updates when a tattoo moves, ignores hidden tattoos,
// and says nothing when there is no other tattoo to measure to.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 assert.ok(all.length>=2,'sample project has several tattoos');
 const sprig=all.find(t=>/Sprig/.test(t.name))||all[0];
 const chip=(await p.$$('#trayItems .chip'))[all.indexOf(sprig)];await chip.click();await wait(700);
 const txt=await p.$eval('#gap',e=>e.hidden?'':e.textContent);
 const g=await p.evaluate(()=>window.__ink.gap());
 assert.ok(g&&g.inches>=0,'measured');
 assert.ok(txt.includes(g.name),`names the nearest tattoo: "${txt}"`);
 assert.ok(/\d in from |Touches /.test(txt),`plain words: "${txt}"`);
 // never more than the distance between centres
 const hcm=await p.evaluate(()=>window.__ink.state().heightCm);
 const other=all.find(t=>t.name===g.name);
 const cd=Math.hypot(...other.pos.map((v,i)=>v-sprig.pos[i]))*100*hcm/175/2.54;
 assert.ok(g.inches<=cd+0.05,`gap ${g.inches.toFixed(2)} in within centre distance ${cd.toFixed(2)} in`);
 assert.ok(await p.$eval('#gap',e=>e.scrollWidth<=e.clientWidth+1),'words fit');
 await p.screenshot({path:'shots/t60-gap-line.png'});console.log('gap line:',txt);
 // move the nearest one onto the selected tattoo: they touch
 await p.evaluate(([a,b])=>{const s=window.__ink.state(),A=s.tattoos.find(t=>t.id===a),B=s.tattoos.find(t=>t.id===b);B.pos=[...A.pos];B.normal=[...A.normal];window.__ink.commitTest();},[sprig.id,other.id]);
 await wait(800);
 assert.match(await p.$eval('#gap',e=>e.textContent),/^Touches /,'overlapping tattoos touch');
 // hide every other tattoo: nothing to measure, so the line goes away
 await p.evaluate(id=>{for(const t of window.__ink.state().tattoos)if(t.id!==id)t.hidden=true;window.__ink.commitTest();},sprig.id);
 await wait(100);
 if(!await p.evaluate(()=>window.__ink.selected())){await chip.click();}
 await wait(700);
 assert.equal(await p.$eval('#gap',e=>e.hidden),true,'no line when no other tattoo shows');
 await p.screenshot({path:'shots/t60-gap.png'});
}
