// Clothes: a top, a bottom and hair over the body to see which tattoos show. They hide
// the ink they cover, say which tattoos are covered, follow a pose, and save nothing.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 const settled=()=>p.waitForFunction(()=>window.__ink.settled()&&window.__ink.pose().settled,{timeout:20000});
 await settled();await wait(600);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 const t=await p.evaluate(()=>window.__ink.state().tattoos.find(x=>!x.hidden));
 await p.click('#clothesBtn');await p.waitForSelector('#clothesPop:not([hidden])');
 const minSize=await p.$$eval('#clothesPop button',b=>Math.min(...b.map(x=>Math.min(x.getBoundingClientRect().width,x.getBoundingClientRect().height))));
 assert.ok(minSize>=44,'clothes buttons are 44pt: '+minSize);
 assert.equal(await p.$eval('#clothesShow',e=>e.textContent),'','nothing to report with no clothes');
 const spot=await p.evaluate(id=>{const s=window.__ink.viewSpot(id);return window.__ink.projectPoint(s.pos);},t.id);
 const bare=await p.evaluate(s=>window.__ink.pixelAt(s.x,s.y),spot);
 // a long sleeve top covers this sample's skin: the pixel turns to cloth and the panel says so
 await p.click('#clothesTop [data-top=long]');await wait(300);
 let c=await p.evaluate(()=>window.__ink.clothes());
 assert.equal(c.top,'long');assert.ok(c.meshes[0].visible&&c.meshes[0].tris>1000,'top drawn');
 const name=t.name;
 const report=c.report;const where=report.covered.includes(name)?'covered':report.partly.includes(name)?'partly':'showing';
 const cloth=await p.evaluate(s=>window.__ink.pixelAt(s.x,s.y),spot);
 const diff=Math.hypot(cloth[0]-bare[0],cloth[1]-bare[1],cloth[2]-bare[2]);
 if(where==='covered'){assert.ok(diff>20,'covered ink is hidden: '+diff);assert.ok(Math.abs(cloth[0]-cloth[2])<40,'cloth is grey: '+cloth);}
 assert.ok((await p.$eval('#clothesShow',e=>e.textContent)).includes(name),'the panel names the tattoo');
 assert.match(await p.$eval('#clothesBtn',e=>e.textContent),/Clothes: Long sleeve/);
 await p.screenshot({path:'shots/t42-long.png'});
 // a tank top leaves the arms bare
 await p.click('#clothesTop [data-top=tank]');await p.click('#clothesBottom [data-bottom=shorts]');await p.click('#clothesHair [data-hair=short]');await wait(300);
 c=await p.evaluate(()=>window.__ink.clothes());assert.deepEqual([c.top,c.bottom,c.hair],['tank','shorts','short']);
 assert.ok(c.meshes.every(m=>m.visible&&m.tris>0),'all three drawn');
 await p.screenshot({path:'shots/t42-tank.png'});
 // a pose: the clothes bend with the body
 const rest=await p.evaluate(()=>window.__ink.clothesBounds());
 await p.evaluate(()=>window.__ink.setPose('raised'));await wait(500);await settled();await p.evaluate(()=>window.__ink.pixelAt(5,5));
 const posed=await p.evaluate(()=>window.__ink.clothesBounds());
 assert.ok(posed.top.max[1]>rest.top.max[1]+0.02||Math.abs(posed.top.max[0]-rest.top.max[0])>0.02,'the top follows the raised arm');
 await p.click('#clothesTop [data-top=tee]');await wait(300);await p.screenshot({path:'shots/t42-posed.png'});
 await p.evaluate(()=>window.__ink.setPose('neutral'));await wait(400);await settled();
 // Escape closes; None takes everything off; the project never changed
 await p.keyboard.press('Escape');assert.ok(await p.$eval('#clothesPop',e=>e.hidden),'Escape closes the panel');
 await p.click('#clothesBtn');
 for(const [row,k] of [['clothesTop','top'],['clothesBottom','bottom'],['clothesHair','hair']])await p.click(`#${row} [data-${k}=none]`);
 c=await p.evaluate(()=>window.__ink.clothes());assert.ok(c.meshes.every(m=>!m.visible)&&c.report===null,'all off: '+JSON.stringify(c));
 assert.equal(await p.$eval('#clothesBtn',e=>e.textContent),'Clothes');
 const back=await p.evaluate(s=>window.__ink.pixelAt(s.x,s.y),spot);
 assert.ok(Math.hypot(back[0]-bare[0],back[1]-bare[1],back[2]-bare[2])<6,'the ink shows again');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'clothes change nothing saved');
 console.log('PASS t42 clothes: covers ink, names covered tattoos, follows a pose, saves nothing ('+name+' '+where+')');
}
