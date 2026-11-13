// As you move picture (Share): the selected tattoo standing and in three poses chosen for the part
// of the body it is on, in a two by two grid. A torso tattoo gets torso poses; moved to the left
// forearm, it gets the left arm's poses. Each posed tile differs from the standing one, and the
// live pose, view and project are left as they were.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 const shot=async(file)=>{
  await p.click('#shareBtn');await wait(300);
  assert.ok(await p.$eval('#cPoses',e=>e.getBoundingClientRect().height>=44),'big enough');
  await p.evaluate(()=>{document.querySelector('#pvTitle').textContent='';});
  await p.click('#cPoses');
  await p.waitForFunction(()=>document.querySelector('#pvTitle').textContent==='As you move'&&document.querySelector('#pvImg').complete&&document.querySelector('#pvImg').naturalWidth>0,{timeout:90000});
  const r=await p.evaluate(()=>{
   const img=document.querySelector('#pvImg'),c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);
   const L=window.__ink.posesLast(),{tile,pad,head,lab}=L;
   const at=(i)=>g.getImageData(pad+(i%2)*(tile+pad),head+Math.floor(i/2)*(tile+lab+pad),tile,tile).data;
   const T=[0,1,2,3].map(at);
   const diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>24)n++;return n/(a.length/4);};
   // each tile shows body, not just background
   const body=(d)=>{let n=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>150)n++;return n/(d.length/4);};
   return {...L,w:c.width,d:[1,2,3].map(i=>diff(T[0],T[i])),body:T.map(body)};
  });
  const b64=await p.evaluate(()=>document.querySelector('#pvImg').src.split(',')[1]);(await import('node:fs')).writeFileSync(file,Buffer.from(b64,'base64'));
  console.log('poses',JSON.stringify({region:r.region,keys:r.keys,d:r.d.map(x=>+x.toFixed(3)),body:r.body.map(x=>+x.toFixed(2))}));
  assert.equal(r.keys[0],'neutral','standing first');
  assert.equal(r.w,r.tile*2+r.pad*3,'two tiles across');
  r.body.forEach((b,i)=>assert.ok(b>0.1,`tile ${i} shows the body (${(b*100).toFixed(0)}%)`));
  r.d.forEach((d,i)=>assert.ok(d>0.05,`pose ${r.keys[i+1]} looks different from standing (${(d*100).toFixed(1)}%)`));
  await p.keyboard.press('Escape');await wait(200);
  return r;
 };
 // Sprig sits on the side of the torso
 const sprig=all.find(t=>/Sprig/.test(t.name))||all[0];
 await (await p.$$('#trayItems .chip'))[all.indexOf(sprig)].click();await wait(400);
 await p.waitForFunction(()=>window.__ink.settled(),{timeout:30000});
 // a live pose to come back to
 await p.evaluate(()=>window.__ink.setPose('twist'));await wait(500);
 const goal0=await p.evaluate(()=>JSON.stringify(window.__ink.goal));
 const r=await shot('shots/t64-poses.png');
 assert.equal(r.id,sprig.id,'the selected tattoo');
 assert.equal(r.region,'torso','a torso tattoo gets torso poses');
 // the app is back as it was
 assert.equal((await p.evaluate(()=>window.__ink.pose())).key,'twist','live pose unchanged');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.goal)),goal0,'view unchanged');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project unchanged');
 // moved to the left forearm, it gets the left arm's poses
 await p.evaluate(()=>window.__ink.setPose('neutral'));await wait(400);
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});await p.$eval('#bSpots',e=>e.click());await wait(300);
 await p.$eval('#spotSide [data-side="L"]',e=>e.click());await p.$eval('#spotChoices [data-spot="forearm-front"]',e=>e.click());await wait(400);
 await p.keyboard.press('Escape');await wait(300);
 const a=await shot('shots/t64-poses-arm.png');
 assert.equal(a.region,'arm','an arm tattoo gets arm poses');
 assert.deepEqual(a.keys.slice(1),['leftBiceps','overheadLeft','leftForward']);
}
