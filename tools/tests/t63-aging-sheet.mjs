// How it ages picture (Share): the selected tattoo close up at each age (fresh, healed, 10 and
// 20 years) in a two by two grid. The tiles are the same view, so they differ only in the ink, and
// the 20 year tile differs from the fresh one. The app's view and Aging setting are left as they were.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const sun=all.find(t=>/Sunburst/.test(t.name))||all[0];
 await (await p.$$('#trayItems .chip'))[all.indexOf(sun)].click();await wait(400);
 await p.waitForFunction(()=>window.__ink.settled(),{timeout:30000});
 const goal0=await p.evaluate(()=>JSON.stringify(window.__ink.goal));
 await p.click('#shareBtn');await wait(300);
 assert.ok(await p.$eval('#cAging',e=>e.getBoundingClientRect().height>=44),'big enough');
 await p.click('#cAging');
 await p.waitForFunction(()=>document.querySelector('#pvTitle').textContent==='How it may age'&&document.querySelector('#pvImg').complete&&document.querySelector('#pvImg').naturalWidth>0,{timeout:60000});
 const r=await p.evaluate(()=>{
  const img=document.querySelector('#pvImg'),c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);
  const {tile,pad,head,lab,id}=window.__ink.agingLast();
  const at=(i)=>g.getImageData(pad+(i%2)*(tile+pad),head+Math.floor(i/2)*(tile+lab+pad),tile,tile).data;
  const T=[0,1,2,3].map(at);
  const diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>24)n++;return n/(a.length/4);};
  return {w:c.width,h:c.height,tile,pad,id,d03:diff(T[0],T[3]),d01:diff(T[0],T[1])};
 });
 const b64=await p.evaluate(()=>document.querySelector('#pvImg').src.split(',')[1]);(await import('node:fs')).writeFileSync('shots/t63-aging.png',Buffer.from(b64,'base64'));
 assert.equal(r.id,sun.id,'the selected tattoo');
 assert.equal(r.w,r.tile*2+r.pad*3,'two tiles across');
 assert.ok(r.d03>0.003,`20 years looks different from fresh (${(r.d03*100).toFixed(2)}% of the tile)`);
 assert.ok(r.d03<0.35,`only the ink changes (${(r.d03*100).toFixed(1)}%)`);
 // the app is back as it was
 assert.equal(await p.evaluate(()=>window.__ink.aging()),0,'Aging setting unchanged');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.goal)),goal0,'view unchanged');
 assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),all.length,'project unchanged');
}
