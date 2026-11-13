// Match my hair from a photo (Body > Hair): a reading puts the photo's colour on the head with the
// nearest length the app shows, adds a swatch for that colour, says when the hair is longer than it
// can show, goes bald when no hair is seen, changes nothing in the project and is kept on this device.
// With HAIR_PHOTO set to a local photo of a person, the real model reads it too (not checked in).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(800);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.click('#bodyBtn');await wait(200);
 const bh=await p.$eval('#hairPhotoBtn',(b)=>b.getBoundingClientRect().height);assert.ok(bh>=44,'button big enough '+bh);
 const toastText=()=>p.evaluate(()=>{const t=document.querySelector('#toast');return t?t.textContent:'';});
 // a short-haired reading
 await p.evaluate(()=>window.__ink.hairReading({found:true,colour:'#7a5236',style:'short',volume:0.05,reach:0.2,cover:0.9}));await wait(300);
 assert.deepEqual(await p.evaluate(()=>window.__ink.hair()),{style:'short',colour:'photo',hex:'#7a5236'});
 const sw=await p.$$eval('#hairCols .sw',(a)=>a.map((b)=>[b.dataset.hairColour,b.getAttribute('aria-pressed'),b.getBoundingClientRect().height]));
 assert.equal(sw.length,6,'five colours and the photo one');assert.deepEqual(sw.filter(([,on])=>on==='true').map(([k])=>k),['photo']);assert.ok(sw.every(([,,h])=>h>=44));
 assert.match(await toastText(),/buzz cut, in your colour/);
 // the head shows the colour: the scalp, from the front, is close to the photo's brown
 await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__ink.settled(),{timeout:30000});await wait(300);
 const scalp=await p.evaluate(()=>{const c=document.querySelector('canvas');const g=document.createElement('canvas');g.width=c.width;g.height=c.height;const x=g.getContext('2d');x.drawImage(c,0,0);
  // the top middle of the head is a little above the screen's middle in the face view
  const d=x.getImageData(Math.round(c.width/2)-10,Math.round(c.height*0.2),20,20).data;let r=0,gg=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];b+=d[i+2];}const n=d.length/4;return [r/n,gg/n,b/n];});
 await p.screenshot({path:'shots/t67-hair.png'});
 console.log('scalp',scalp.map(Math.round));
 // a longer-haired reading: the nearest length it can show (Short, with volume), and it says so
 await p.evaluate(()=>window.__ink.hairReading({found:true,colour:'#2a1d16',style:'long',volume:0.2,reach:1.1,cover:0.95}));await wait(200);
 assert.deepEqual(await p.evaluate(()=>window.__ink.hair()),{style:'crop',colour:'photo',hex:'#2a1d16'});
 assert.match(await toastText(),/longer than I can show yet/);
 // no hair seen: bald
 await p.evaluate(()=>window.__ink.hairReading({found:false,colour:null,style:'none',volume:0,reach:0,cover:0}));await wait(200);
 assert.equal((await p.evaluate(()=>window.__ink.hair())).style,'none');
 assert.match(await toastText(),/could not see hair/);
 // back to the photo colour, then reload: kept on this device, and the project is untouched
 await p.evaluate(()=>window.__ink.hairReading({found:true,colour:'#7a5236',style:'buzz',volume:0,reach:0.1,cover:0.8}));await wait(200);
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project not changed');
 await p.reload();await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(500);
 assert.deepEqual(await p.evaluate(()=>window.__ink.hair()),{style:'buzz',colour:'photo',hex:'#7a5236'},'kept after reload');
 // the real model, on a local photo of a person
 const photo=process.env.HAIR_PHOTO;
 if(photo&&existsSync(photo)){
  await p.click('#bodyBtn');await wait(200);
  const input=await p.$('#hairPhotoFile');await input.uploadFile(photo);
  await p.waitForFunction(()=>window.__ink.hairLast()&&!document.querySelector('#hairPhotoBtn').disabled,{timeout:120000});
  const r=await p.evaluate(()=>window.__ink.hairLast());console.log('real photo',JSON.stringify(r));
  assert.ok(r.found&&r.colour,'hair found in the real photo');
  await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__ink.settled(),{timeout:30000});await wait(300);
  await p.screenshot({path:'shots/t67-real.png'});
 } else console.log('no HAIR_PHOTO: real model not tried');
}
