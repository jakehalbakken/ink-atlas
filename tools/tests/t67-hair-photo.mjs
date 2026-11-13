// Match my hair from a photo (Body > Hair): a reading puts the photo's colour on the head with the
// nearest length the app shows (long hair as Long), adds a swatch for that colour, goes bald when no
// hair is seen, changes nothing in the project and is kept on this device.
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
 await p.screenshot({path:'shots/t67-hair.png'});
 const pr=await p.evaluate(()=>window.__ink.hairProbe());console.log('probe crown',Math.round(pr.crown),'bare',Math.round(pr.crownPlain));
 assert.ok(pr.crown<pr.crownPlain*0.8,'the crown shows the hair colour');
 // a longer-haired reading: Long, in the photo's colour, and it says how long it shows
 await p.evaluate(()=>window.__ink.hairReading({found:true,colour:'#2a1d16',style:'long',volume:0.2,reach:1.1,cover:0.95}));await wait(200);
 assert.deepEqual(await p.evaluate(()=>window.__ink.hair()),{style:'long',colour:'photo',hex:'#2a1d16'});
 assert.match(await toastText(),/long, in your colour.*just below the shoulders/);
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
