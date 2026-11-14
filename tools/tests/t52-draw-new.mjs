// Draw a new tattoo in Procreate on a painted area: Draw in Procreate in the tray starts a
// highlight brush; one finger on the body paints, one finger off it still turns the view, two
// fingers still move it. Draw in Procreate sends an upright square guide of that skin; the
// drawing that comes back (Copy All, Paste) lands as a new planned tattoo where it was drawn,
// the right way up, trimmed to the drawing. A guide that comes back with the drawing is refused
// with a plain hint; one undo removes the new tattoo.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(b){if(b.name)window.saved[b.name]=b;return old.call(this,b);};});
 await p.click('#views [data-view="0"]');await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});await wait(300);
 const n0=await p.evaluate(()=>window.__ink.state().tattoos.length);
 const btn=await p.$eval('#drawNew',e=>{const r=e.getBoundingClientRect();return [r.width,r.height,e.textContent];});assert.ok(btn[1]>=44,'tray button big enough');assert.equal(btn[2],'Procreate');
 await p.click('#drawNew');await wait(200);await p.click('#pmSpot');await wait(200);
 assert.equal(await p.$eval('#paintBar',e=>e.hidden),false,'paint bar shows');assert.equal(await p.$eval('#paintGo',e=>e.disabled),true,'nothing painted yet');
 assert.equal(await p.$eval('#dock',e=>getComputedStyle(e).display),'none','tray out of the way while painting');
 const send=(list)=>p.evaluate(list=>{const c=document.querySelector('#stage canvas');for(const [type,id,x,y] of list)c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:type==='pen'?'pen':'touch',clientX:x,clientY:y,bubbles:true,button:0,buttons:type==='pointerup'?0:1}));},list);
 const cam=()=>p.evaluate(()=>({...window.__ink.goal}));
 // one finger off the body still turns the view
 let c0=await cam();await send([['pointerdown',1,40,600],['pointermove',1,70,600],['pointermove',1,110,600],['pointerup',1,110,600]]);await wait(200);
 let c1=await cam();assert.notEqual(c1.theta,c0.theta,'off the body: turns the view');assert.equal(await p.evaluate(()=>window.__ink.painting()),0,'and paints nothing');
 await p.click('#views [data-view="0"]');await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});await wait(300);
 // paint a short stroke on the belly
 const belly=await p.evaluate(()=>window.__ink.surfaceHit([0.03,1.08,0.5],[0,0,-1]));
 const s=await p.evaluate(pos=>window.__ink.projectPoint(pos),belly.pos);
 // two fingers that land on the body move the view and leave no paint
 c0=await cam();await send([['pointerdown',5,s.x,s.y],['pointerdown',6,s.x+80,s.y],['pointermove',5,s.x+30,s.y+30],['pointermove',6,s.x+110,s.y+30],['pointermove',5,s.x+60,s.y+60],['pointermove',6,s.x+140,s.y+60],['pointerup',5,s.x+60,s.y+60],['pointerup',6,s.x+140,s.y+60]]);await wait(200);
 c1=await cam();assert.ok(Math.abs(c1.tx-c0.tx)+Math.abs(c1.ty-c0.ty)+Math.abs(c1.tz-c0.tz)>1e-4,'two fingers pan');assert.equal(await p.evaluate(()=>window.__ink.painting()),0,'two fingers leave no paint');
 await p.click('#views [data-view="0"]');await p.waitForFunction(()=>window.__ink.settled(),{timeout:10000});await wait(300);
 c0=await cam();
 const stroke=[['pointerdown',2,s.x-20,s.y-10]];for(let i=1;i<=8;i++)stroke.push(['pointermove',2,s.x-20+i*5,s.y-10+i*2.5]);stroke.push(['pointerup',2,s.x+20,s.y+10]);
 await send(stroke);await wait(200);
 c1=await cam();assert.equal(c1.theta,c0.theta,'painting does not turn the view');assert.equal(c1.phi,c0.phi);
 const painted=await p.evaluate(()=>window.__ink.painting());assert.ok(painted>3,'painted some skin: '+painted);
 assert.equal(await p.$eval('#paintGo',e=>e.disabled),false);
 // Clear empties it; paint again
 await p.click('#paintClear');assert.equal(await p.evaluate(()=>window.__ink.painting()),0,'Clear');
 await send(stroke);await wait(200);
 // Draw in Procreate: the guide goes out, the bar waits for the drawing
 await p.click('#paintGo');await p.waitForFunction(()=>!!window.saved['New tattoo guide.png'],{timeout:10000});
 assert.equal(await p.$eval('#paintBar',e=>e.hidden),true,'paint bar gone');
 assert.equal(await p.$eval('#procreateBar',e=>e.hidden),false,'bar waits for the drawing');assert.equal(await p.$eval('#pcSend',e=>e.hidden),false,'can send the guide again');
 assert.match(await p.$eval('#pcHead',e=>e.textContent),/new tattoo/i);
 const pend=await p.evaluate(()=>JSON.parse(localStorage.getItem('ia-procreate-edit')));assert.equal(pend.kind,'new');
 const guide=await p.evaluate(async()=>{const b=await createImageBitmap(window.saved['New tattoo guide.png']);const c=new OffscreenCanvas(b.width,b.height),g=c.getContext('2d');g.drawImage(b,0,0);const d=g.getImageData(b.width/2,b.height/2,1,1).data;return {w:b.width,h:b.height,mid:[...d]};});
 assert.deepEqual([guide.w,guide.h],[2048,2048],'square guide');assert.ok(guide.mid[0]>150&&guide.mid[3]===255,'skin in the middle: '+guide.mid);
 // the guide comes back with the drawing: refused, nothing added
 const clip=(make)=>p.evaluate(src=>{window.__make=new Function('return ('+src+')')();Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read:async()=>[{types:['image/png'],getType:async()=>await window.__make()}]}});},make.toString());
 await clip(async()=>{const c=new OffscreenCanvas(2048,2048),g=c.getContext('2d');g.fillStyle='#ddb';g.fillRect(0,0,2048,2048);return c.convertToBlob({type:'image/png'});});
 await p.click('#pcPaste');await wait(600);
 assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),n0,'opaque picture refused');assert.match(await p.$eval('#toast',e=>e.textContent),/hide the guide/i);
 // the drawing: red up and to the left, black down and to the right, on a clear canvas
 await clip(async()=>{const c=new OffscreenCanvas(2048,2048),g=c.getContext('2d');g.fillStyle='#d00';g.beginPath();g.arc(717,717,60,0,7);g.fill();g.fillStyle='#000';g.beginPath();g.arc(1229,1229,60,0,7);g.fill();return c.convertToBlob({type:'image/png'});});
 await p.click('#pcPaste');await p.waitForFunction(n=>window.__ink.state().tattoos.length===n+1,{timeout:10000},n0);await wait(400);
 const t=await p.evaluate(()=>{const s=window.__ink.state();return s.tattoos[s.tattoos.length-1];});
 assert.equal(t.status,'planned');assert.equal(await p.$eval('#procreateBar',e=>e.hidden),true,'bar done');
 assert.equal(await p.evaluate(()=>localStorage.getItem('ia-procreate-edit')),null,'nothing pending');
 const W=pend.patch.width,box=(1229+60-(717-60))/2048;
 assert.ok(Math.abs(t.width-W*box)<W*.01,`trimmed to the drawing: ${t.width} vs ${W*box}`);assert.ok(Math.abs(t.aspect-1)<.02,'aspect '+t.aspect);
 // where: the drawing's middle (the guide's middle here), the right way up on the body
 await p.click('#bDone').catch(()=>{});await wait(300);
 const n=pend.patch.normal,ref=Math.abs(n[1])>.93?[0,0,-1]:[0,1,0];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
 const right=norm(cross(ref,n)),up=cross(n,right);
 const at=(dx,dy)=>pend.patch.pos.map((v,i)=>v+right[i]*(dx-.5)*W-up[i]*(dy-.5)*W);
 const off=t.pos.map((v,i)=>v-pend.patch.pos[i]);
 const mid=973/2048-.5,gx=off[0]*right[0]+off[1]*right[1]+off[2]*right[2],gy=off[0]*up[0]+off[1]*up[1]+off[2]*up[2];
 assert.ok(Math.hypot(gx-mid*W,gy+mid*W)<.004,`middle of the drawing where it was drawn: ${gx.toFixed(4)},${gy.toFixed(4)} vs ${(mid*W).toFixed(4)},${(-mid*W).toFixed(4)}`);
 const px=async(pt)=>{const q=await p.evaluate(pt=>window.__ink.projectPoint(pt),pt);return p.evaluate(q=>window.__ink.pixelAt(q.x,q.y),q);};
 const red=await px(at(717/2048,717/2048)),black=await px(at(1229/2048,1229/2048));
 assert.ok(red[0]>red[1]+40,'red up and to the left: '+red);assert.ok(Math.max(...black.slice(0,3))<90,'black down and to the right: '+black);
 await p.click('#undo');await wait(300);assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),n0,'one undo');
 console.log(`PASS t52 draw new: painted ${painted} triangles, 2048 guide, drawing lands upright at ${(t.width*100).toFixed(1)} cm wide where it was drawn`);
}
