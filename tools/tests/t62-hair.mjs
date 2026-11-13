// Very short hair (Body > Hair): Bald, Shaved or Buzz cut, in five colours. It darkens the scalp only
// (the top and back of the head, not the face, the ears or the neck below the nape), changes
// nothing in the project, is kept on this device and comes back after a reload.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(800);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 // head centre from the eyes
 const head=await p.evaluate(()=>{const P=window.__ink.positions();let x=0,y=0,z=0;for(let v=13380;v<13524;v++){x+=P[v*3];y+=P[v*3+1];z+=P[v*3+2];}return [x/144,y/144,z/144];});
 const look=async(theta,name)=>{await p.evaluate(([h,t])=>{Object.assign(window.__ink.goal,{theta:t,phi:Math.PI/2-0.15,roll:0,tx:0,ty:h[1]+0.01,tz:h[2]-0.03,r:0.7});window.__ink.cur.r=0.71;},[head,theta]);
  await p.waitForFunction(()=>window.__ink.settled(),{timeout:30000});
  const style=await p.addStyleTag({content:'body *{visibility:hidden!important} canvas{visibility:visible!important}'});await wait(250);
  const buf=await p.screenshot({path:`shots/t62-${name}.png`});await style.evaluate((s)=>s.remove());return buf;};
 await p.click('#bodyBtn');await wait(200);
 const hb=await p.$$eval('#hairRow [data-hair]',(a)=>a.map((b)=>[b.getBoundingClientRect().height,b.scrollWidth,b.clientWidth]));assert.ok(hb.length===4&&hb.every(([h,s,c])=>h>=44&&s<=c+1),'four choices, big enough, words fit '+JSON.stringify(hb));
 assert.equal(await p.$eval('#hairCols',(e)=>e.hidden),true,'no colours without hair');
 const plain=await look(0.6,'plain');
 await p.click('#hairRow [data-hair="short"]');await wait(300);
 assert.equal(await p.$eval('#hairCols',(e)=>e.hidden),false,'colours show');
 assert.equal(await p.$$eval('#hairCols .sw',(a)=>a.filter((b)=>b.getBoundingClientRect().height>=44).length),5,'five colours, big enough');
 await p.keyboard.press('Escape');await wait(200);
 // where the paint lands, read from the canvas: dark on the crown and back, skin on the forehead and cheek
 const sample=async()=>p.evaluate(()=>window.__ink.hairProbe());
 const r=await sample();
 console.log('probe',JSON.stringify(Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Math.round(v)]))));
 assert.ok(r.crown<r.crownPlain*0.6,`crown has hair (${r.crown.toFixed(0)} vs ${r.crownPlain.toFixed(0)} bare)`);
 assert.ok(r.back<r.backPlain*0.6,`back of the head has hair (${r.back.toFixed(0)} vs ${r.backPlain.toFixed(0)} bare)`);
 for(const k of ['forehead','cheek','ear','neck'])assert.ok(Math.abs(r[k]-r[k+'Plain'])<10,`${k} untouched (${r[k].toFixed(0)} vs ${r[k+'Plain'].toFixed(0)})`);
 await look(0.6,'short-3q');await look(Math.PI/2,'short-side');await look(Math.PI,'short-back');await look(0,'short-front');
 await p.click('#bodyBtn');await wait(200);
 await p.click('[data-hair-colour="blond"]');await p.click('#hairRow [data-hair="buzz"]');await wait(200);await p.keyboard.press('Escape');
 await look(0.6,'buzz-blond');
 assert.deepEqual(await p.evaluate(()=>window.__ink.hair()),{style:'buzz',colour:'blond'});
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project not changed');
 await p.reload();await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(500);
 assert.deepEqual(await p.evaluate(()=>window.__ink.hair()),{style:'buzz',colour:'blond'},'kept on this device');
 await p.click('#bodyBtn');await wait(200);await p.click('#hairRow [data-hair="none"]');await wait(200);
 assert.equal(await p.$eval('#hairCols',(e)=>e.hidden),true);
 assert.ok(plain.length>0);
}
