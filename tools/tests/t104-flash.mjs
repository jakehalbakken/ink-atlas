// Split a flash sheet: uploading one picture with several separate designs offers Split them;
// splitting gives one tattoo per design (the first where the sheet was, the rest on free spots),
// each with only its own design, in one undo step; More controls offers the same; a picture of
// one design offers nothing.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 // a sheet: four different designs on white paper, two rows
 const url=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=800;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,1000,800);g.strokeStyle='#111';g.fillStyle='#111';g.lineWidth=14;
  g.beginPath();g.arc(250,200,130,0,Math.PI*2);g.stroke();g.beginPath();g.arc(250,200,20,0,Math.PI*2);g.fill();
  g.strokeRect(620,80,260,240);
  g.beginPath();g.moveTo(250,450);g.lineTo(380,700);g.lineTo(120,700);g.closePath();g.stroke();
  g.fillStyle='#b02020';g.beginPath();g.moveTo(750,440);g.lineTo(870,560);g.lineTo(750,700);g.lineTo(630,560);g.closePath();g.fill();
  return c.toDataURL('image/png');});
 const file=join(tmpdir(),'flash-sheet-test.png');writeFileSync(file,Buffer.from(url.split(',')[1],'base64'));
 const n0=await p.evaluate(()=>window.__ink.state().tattoos.length);
 const input=await p.$('#file');await input.uploadFile(file);
 await p.waitForFunction(n=>window.__ink.state().tattoos.length===n+1,{timeout:20000},n0);
 await p.waitForFunction(()=>/separate designs/.test(document.querySelector('#toast').textContent)&&!document.querySelector('#toast').hidden,{timeout:20000});
 assert.match(await p.$eval('#toast',e=>e.textContent),/This picture has 4 separate designs/);
 const sheet=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos.at(-1))));
 // More controls offers it too
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 await p.waitForFunction(()=>window.__ink.flashShown()===4,{timeout:10000});
 assert.equal(await p.$eval('#bSplit',e=>e.textContent),'Split into 4 designs');
 assert.ok(await p.$eval('#bSplit',e=>!e.hidden&&e.getBoundingClientRect().height>=44),'button shows, big enough');
 await p.$eval('#toast button',e=>e.click());
 // the split adds the designs one by one and takes the sheet off at the end
 await p.waitForFunction((n,id)=>{const ts=window.__ink.state().tattoos;return ts.length===n+4&&!ts.some(t=>t.id===id);},{timeout:20000},n0,sheet.id);
 const st=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const parts=st.slice(n0);
 assert.ok(!st.some(t=>t.id===sheet.id),'the sheet itself is gone');
 assert.deepEqual(parts.map(t=>t.name),[1,2,3,4].map(i=>`flash-sheet-test ${i}`),'named in reading order');
 assert.deepEqual(parts[0].pos,sheet.pos,'the first is where the sheet was');
 assert.ok(parts.slice(1).every(t=>JSON.stringify(t.pos)!==JSON.stringify(sheet.pos)),'the rest go elsewhere');
 // sizes keep their sizes next to each other (the circle and the square are about as wide), and
 // a small sheet is scaled up so the biggest is a usable size
 const ws=parts.map(t=>t.width);assert.ok(Math.max(...ws)>=0.079,'usable size: '+ws);
 assert.ok(ws[0]/ws[1]>0.85&&ws[0]/ws[1]<1.25,'sizes kept next to each other: '+ws);
 // each holds only its own design: the red diamond is the only coloured one
 const red=await p.evaluate(async(ids)=>{const out=[];for(const id of ids){const t=window.__ink.state().tattoos.find(q=>q.id===id),im=new Image();im.src=window.__ink.imageOf(t.img);await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data;let r=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>100&&d[i]>150&&d[i+1]<80)r++;out.push(r);}return out;},parts.map(t=>t.id));
 assert.ok(red[3]>1000&&red.slice(0,3).every(v=>v===0),'only the diamond is red: '+red);
 assert.equal(await p.evaluate(()=>window.__ink.selected()),parts[0].id,'the first is selected');
 assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('ia-tried')||'[]').includes('flash')),'ticked');
 // one undo puts the sheet back
 await p.$eval('#undo',e=>e.click());await wait(400);
 const back=await p.evaluate(()=>window.__ink.state().tattoos.map(t=>t.id));
 assert.equal(back.length,n0+1,'one undo step');assert.ok(back.includes(sheet.id),'sheet back');
 // a single design offers nothing
 await (await p.$$('#ldList .ld-tat'))[0].click();await wait(600);
 assert.equal(await p.evaluate(()=>window.__ink.flashShown()),0,'one design: nothing to split');
 assert.equal(await p.$eval('#bSplit',e=>e.hidden),true);
 await (await p.$$('#ldList .ld-tat'))[1].click();await wait(600);
 assert.equal(await p.evaluate(()=>window.__ink.flashShown()),0,'the sprig is one design too');
 await p.screenshot({path:'shots/t104-flash.png'});
}
