// Your own skin tone (Body panel): the + swatch opens lighter/deeper and cooler/warmer
// sliders that recolour the body live with one undo per drag; a preset closes it again; Match
// a photo of your skin opens the photo, refuses a tap on the background and takes the skin
// colour from a tap on skin. The tone is saved with the project and survives a reload.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 const ready=async()=>{await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1000);};
 await ready();
 await p.click('#views [data-view="0"]');await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});await wait(300);
 const belly=await p.evaluate(()=>window.__ink.surfaceHit([0.05,1.05,0.5],[0,0,-1]));
 const lum=async()=>{const q=await p.evaluate(pos=>window.__ink.projectPoint(pos),belly.pos);const c=await p.evaluate(q=>window.__ink.pixelAt(q.x,q.y),q);return .299*c[0]+.587*c[1]+.114*c[2];};
 const L0=await lum();
 await p.click('#bodyBtn');await wait(300);
 const own=await p.$eval('#skinOwnBtn',e=>{const r=e.getBoundingClientRect();return [r.width,r.height];});assert.ok(own[0]>=44&&own[1]>=44,'own tone button big enough');
 assert.equal(await p.$eval('#skinOwn',e=>e.hidden),true,'closed at first');
 const preset=await p.evaluate(()=>window.__ink.state().skinHex??null);assert.equal(preset,null);
 await p.$eval('#skinOwnBtn',e=>e.click());await wait(200);
 assert.equal(await p.$eval('#skinOwn',e=>e.hidden),false,'sliders open');
 const start=await p.evaluate(()=>window.__ink.state().skinHex);assert.match(start,/^#[0-9a-f]{6}$/,'starts from the current tone');
 assert.ok(Math.abs(await lum()-L0)<3,'opening it does not change the colour');
 // drag deeper: the body darkens, one undo step
 const slide=(id,v)=>p.evaluate((id,v)=>{const s=document.querySelector(id);for(const k of [0.3,0.6,1]){s.value=+s.value+(v-s.value)*k;s.dispatchEvent(new Event('input',{bubbles:true}));}s.dispatchEvent(new Event('change',{bubbles:true}));},id,v);
 await slide('#rSkinDepth',85);await wait(300);
 const deep=await p.evaluate(()=>window.__ink.state().skinHex);const Ld=await lum();
 assert.ok(Ld<L0-35,`deeper skin is darker: ${L0.toFixed(0)} -> ${Ld.toFixed(0)}`);
 assert.equal(await p.$eval('#skinOwnBtn',e=>e.style.background.length>0),true,'the + swatch shows the tone');
 await slide('#rSkinWarm',80);await wait(200);
 const warm=await p.evaluate(()=>window.__ink.state().skinHex);assert.notEqual(warm,deep,'warmer changes it');
 const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));assert.ok(hx(warm)[0]-hx(warm)[2]>hx(deep)[0]-hx(deep)[2],'warmer is redder');
 await p.click('#undo');await wait(200);assert.equal(await p.evaluate(()=>window.__ink.state().skinHex),deep,'one undo per drag');
 // a preset swatch goes back to the presets and closes the sliders
 await p.$eval('#skins .sw:not(.own)',e=>e.click());await wait(200);
 assert.equal(await p.evaluate(()=>window.__ink.state().skinHex??null),null,'preset chosen');assert.equal(await p.$eval('#skinOwn',e=>e.hidden),true,'sliders closed');
 await p.$eval('#skinOwnBtn',e=>e.click());await wait(200);
 // match a photo: blue background on the left, skin on the right
 await p.evaluate(async()=>{const c=new OffscreenCanvas(800,600),g=c.getContext('2d');g.fillStyle='#3a6fd8';g.fillRect(0,0,400,600);g.fillStyle='#b97a5a';g.fillRect(400,0,400,600);g.fillStyle='#4a2a1a';for(let i=0;i<40;i++){g.fillRect(420+((i*53)%360),20+((i*97)%560),3,3);}
  const b=await c.convertToBlob({type:'image/jpeg',quality:.95}),f=new File([b],'arm.jpg',{type:'image/jpeg'}),dt=new DataTransfer();dt.items.add(f);const inp=document.querySelector('#skinPhotoFile');inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.waitForFunction(()=>!document.querySelector('#skinPick').hidden,{timeout:5000});await wait(400);
 const box=await p.$eval('#spImg',e=>{const r=e.getBoundingClientRect(),k=Math.min(r.width/800,r.height/600);return {x0:r.left+(r.width-800*k)/2,y0:r.top+(r.height-600*k)/2,k};});
 const tap=(x,y)=>p.evaluate((x,y)=>document.querySelector('#skinPick').dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,bubbles:true,pointerType:'touch'})),x,y);
 assert.equal(await p.$eval('#spUse',e=>e.disabled),true,'nothing picked yet');
 await tap(box.x0+200*box.k,box.y0+300*box.k);await wait(100);
 assert.equal(await p.$eval('#spUse',e=>e.disabled),true,'background refused');assert.match(await p.$eval('#spMsg',e=>e.textContent),/not look like skin/);
 await tap(box.x0+600*box.k,box.y0+300*box.k);await wait(100);
 assert.equal(await p.$eval('#spUse',e=>e.disabled),false,'skin accepted');
 await p.click('#spUse');await wait(300);
 assert.equal(await p.$eval('#skinPick',e=>e.hidden),true,'picker closed');
 const got=await p.evaluate(()=>window.__ink.state().skinHex);const d=hx(got).map((v,i)=>Math.abs(v-hx('#b97a5a')[i]));
 assert.ok(Math.max(...d)<=6,`matched the skin, not the freckles: ${got}`);
 // saved with the project
 await wait(800);await p.reload();await ready();
 assert.equal(await p.evaluate(()=>window.__ink.state().skinHex),got,'kept after reopening');
 console.log(`PASS t53 skin tone: preset ${start}, deeper ${deep}, warmer ${warm}, photo ${got}`);
}
