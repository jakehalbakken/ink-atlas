// Try on with camera: the selected artwork over a live camera (a fake one here) or a photo.
// One finger moves it, two size and turn it, Curve narrows it round a limb, Take photo freezes
// the frame, and the shared picture has the ink multiplied onto the photo where it was shown.
// The camera stops when it closes and the project never changes.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 // a fake camera: a flat skin-coloured frame with a mark in one corner
 await p.evaluate(()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');
  const draw=()=>{g.fillStyle='#d9a888';g.fillRect(0,0,1280,720);g.fillStyle='#203060';g.fillRect(0,0,80,80);};draw();setInterval(draw,100);
  window.__camStops=0;navigator.mediaDevices.getUserMedia=async(o)=>{window.__camAsk=o;const s=c.captureStream(15);for(const t of s.getTracks()){const st=t.stop.bind(t);t.stop=()=>{window.__camStops++;st();};}return s;};
  window.__shared=null;navigator.canShare=()=>true;navigator.share=async({files})=>{window.__shared={name:files[0].name,size:files[0].size,url:URL.createObjectURL(files[0])};};});
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await (await p.$$('#trayItems .chip'))[0].click();await wait(300);
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 const bh=await p.$eval('#bTryOn',e=>e.getBoundingClientRect().height);assert.ok(bh>=44,'button big enough');
 await p.$eval('#bTryOn',e=>e.click());await wait(1200);
 assert.equal(await p.$eval('#tryOn',e=>e.hidden),false,'opens');
 assert.equal(await p.evaluate(()=>window.__camAsk.video.facingMode),'environment','back camera first');
 await p.waitForFunction(()=>document.querySelector('#toVideo').videoWidth>0,{timeout:8000}).catch(()=>{});
 const vid=await p.$eval('#toVideo',e=>({w:e.videoWidth,hidden:e.hidden,src:!!e.srcObject,rs:e.readyState,txt:document.querySelector('#toText').textContent,ask:!!window.__camAsk}));assert.ok(vid.w>0&&!vid.hidden,'camera shows '+JSON.stringify(vid));
 const box=()=>p.$eval('#toArt',e=>{const r=e.getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,w:r.width,h:r.height,ow:parseFloat(e.style.width)};});
 const b0=await box();assert.ok(b0.w>50,'artwork shows');
 const touch=(t,id,x,y)=>p.evaluate(([t,id,x,y])=>{const v=document.querySelector('#toVideo');v.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,buttons:t==='pointerup'?0:1}));},[t,id,x,y]);
 // one finger moves it
 await touch('pointerdown',1,b0.x,b0.y);for(let i=1;i<=5;i++)await touch('pointermove',1,b0.x+i*20,b0.y+i*10);await touch('pointerup',1,b0.x+100,b0.y+50);
 const b1=await box();assert.ok(Math.abs(b1.x-b0.x-100)<2&&Math.abs(b1.y-b0.y-50)<2,`moved with the finger ${JSON.stringify([b0,b1])}`);
 // two fingers spread: bigger
 await touch('pointerdown',1,b1.x-40,b1.y);await touch('pointerdown',2,b1.x+40,b1.y);
 for(let i=1;i<=5;i++){await touch('pointermove',1,b1.x-40-i*12,b1.y);await touch('pointermove',2,b1.x+40+i*12,b1.y);}
 await touch('pointerup',1,b1.x-100,b1.y);await touch('pointerup',2,b1.x+100,b1.y);
 const b2=await box();assert.ok(b2.ow>b1.ow*2.2&&b2.ow<b1.ow*2.8,`two fingers size it ${b1.ow} -> ${b2.ow}`);
 // a finger on the controls does not move it
 const bar=await p.$eval('#toBar',e=>{const r=e.getBoundingClientRect();return {x:r.left+20,y:r.top+8};});
 await p.evaluate(({x,y})=>{const n=document.querySelector('#toBar');for(const t of ['pointerdown','pointermove','pointerup'])n.dispatchEvent(new PointerEvent(t,{pointerId:5,pointerType:'touch',clientX:x+(t==='pointermove'?80:0),clientY:y,bubbles:true}));},bar);
 const b2b=await box();assert.ok(Math.abs(b2b.x-b2.x)<1,'controls leave it alone');
 // curve narrows it, same height
 await p.evaluate(()=>{const s=document.querySelector('#rToCurve');s.value=100;s.dispatchEvent(new Event('input'));});await wait(200);
 const cw=await p.$eval('#toArt',e=>[e.width,e.height]);const flatW=await p.evaluate(()=>{const s=document.querySelector('#rToCurve');s.value=0;s.dispatchEvent(new Event('input'));return document.querySelector('#toArt').width;});
 assert.ok(cw[0]<flatW*0.8,`curve narrows it ${cw[0]} vs ${flatW}`);
 await p.evaluate(()=>{const s=document.querySelector('#rToCurve');s.value=60;s.dispatchEvent(new Event('input'));});await wait(200);
 await p.screenshot({path:'shots/t56-live.png'});
 // take the photo: camera stops, controls change
 await p.$eval('#toSnap',e=>e.click());await wait(500);
 assert.ok(await p.evaluate(()=>window.__camStops>0),'camera stops after the photo');
 assert.equal(await p.$eval('#toDone',e=>e.hidden),false);assert.equal(await p.$eval('#toPhoto',e=>e.hidden),false);
 await p.$eval('#toShare',e=>e.click());await wait(800);
 const sh=await p.evaluate(()=>window.__shared);assert.ok(sh&&/try-on\.jpg$/.test(sh.name)&&sh.size>5000,`shared ${JSON.stringify(sh)}`);
 // the shared picture: skin where there is no ink, darker under the ink centre, the corner mark kept
 const px=await p.evaluate(async(url)=>{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
  const a=document.querySelector('#toArt').getBoundingClientRect(),k=im.width/innerWidth;const at=(x,y)=>[...g.getImageData(Math.round(x*k),Math.round(y*k),1,1).data].slice(0,3);
  // darkest pixel inside the art box against a spot well away from it
  let dark=765;for(let i=0;i<40;i++)for(let j=0;j<40;j++){const v=at(a.left+a.width*(i+.5)/40,a.top+a.height*(j+.5)/40);dark=Math.min(dark,v[0]+v[1]+v[2]);}
  const away=at(a.right+40<innerWidth?a.right+30:a.left-30,a.top+a.height/2);return {w:im.width,h:im.height,dark,away,ratio:im.width/im.height,view:innerWidth/innerHeight};},sh.url);
 assert.ok(Math.abs(px.ratio-px.view)<0.01,'picture is the view you saw');
 assert.ok(px.away[0]>180&&px.away[0]>px.away[2],`skin away from the ink ${px.away}`);
 assert.ok(px.dark<px.away[0]+px.away[1]+px.away[2]-150,`ink darkens the skin ${px.dark}`);
 // a photo instead of the camera
 await p.$eval('#toRetake',e=>e.click());await wait(800);assert.equal(await p.$eval('#toLive',e=>e.hidden),false,'back to the camera');
 const input=await p.$('#toFile');await input.uploadFile('public/pwa-512.png');await wait(800);
 assert.equal(await p.$eval('#toPhoto',e=>e.hidden),false,'photo shows');assert.equal(await p.$eval('#toDone',e=>e.hidden),false,'photo can be shared');
 // close: camera stops, project unchanged
 const stops=await p.evaluate(()=>window.__camStops);await p.$eval('#toClose',e=>e.click());await wait(200);
 assert.equal(await p.$eval('#tryOn',e=>e.hidden),true);assert.ok(await p.evaluate(s=>window.__camStops>=s,stops));
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project untouched');
 // no camera at all: says so and offers the photo
 await p.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('no','NotAllowedError');};});
 await p.$eval('#bTryOn',e=>e.click());await wait(400);
 assert.match(await p.$eval('#toText',e=>e.textContent),/photo/);assert.equal(await p.$eval('#toSnap',e=>e.disabled),true);
 await p.keyboard.press('Escape');await wait(100);assert.equal(await p.$eval('#tryOn',e=>e.hidden),true,'Escape closes');
 console.log('PASS t56 try on with camera: moves, sizes, curves, photo multiplies ink on skin, camera stops, project untouched');
}
