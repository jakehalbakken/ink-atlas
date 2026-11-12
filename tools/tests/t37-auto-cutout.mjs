// Automatic cutout with the real on-device model: upload a photo-like picture with a
// tattoo and clutter, tap the tattoo in the cleanup editor, and only the tattoo stays.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 const initial=await p.evaluate(()=>window.__ink.state().tattoos.length);
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=480;c.height=360;const g=c.getContext('2d');const grad=g.createLinearGradient(0,0,480,360);grad.addColorStop(0,'#e8c2a4');grad.addColorStop(1,'#c99a7a');g.fillStyle=grad;g.fillRect(0,0,480,360);
  // tattoo: bold ring with a star inside
  g.strokeStyle='#1d1a1a';g.lineWidth=14;g.beginPath();g.arc(240,180,70,0,Math.PI*2);g.stroke();g.fillStyle='#1d1a1a';g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?18:44;g.lineTo(240+Math.cos(a)*r,180+Math.sin(a)*r);}g.closePath();g.fill();
  // clutter: a blue phone case in a corner
  g.fillStyle='#2456c8';g.fillRect(16,16,70,110);
  const blob=await new Promise(r=>c.toBlob(r));const dt=new DataTransfer();dt.items.add(new File([blob],'arm-photo.png',{type:'image/png'}));const f=document.querySelector('#file');f.files=dt.files;f.dispatchEvent(new Event('change'));});
 await wait(900);assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),initial+1);
 const imgBefore=await p.evaluate(()=>window.__ink.state().tattoos.at(-1).img);
 await p.click('#bCleanup');await p.waitForSelector('#ink-cleanup');
 const alphaAt=(fx,fy)=>p.$eval('#ink-cleanup canvas',(c,[fx,fy])=>c.getContext('2d').getImageData(Math.floor(c.width*fx),Math.floor(c.height*fy),1,1).data[3],[fx,fy]);
 assert.equal(await alphaAt(.1,.15),255,'clutter there before');
 await p.click('[data-mode=cutout]');
 const tap=async(fx,fy)=>{const b=await p.$eval('#ink-cleanup canvas',(c,[fx,fy])=>{const r=c.getBoundingClientRect();return {x:r.x+r.width*fx,y:r.y+r.height*fy};},[fx,fy]);await p.mouse.click(b.x,b.y);await settle();return status();};
 const settle=()=>p.waitForFunction(()=>!document.querySelector('#ink-cleanup').hasAttribute('aria-busy')&&!/Finding the tattoo/.test(document.querySelector('#ink-cleanup .ic-status').textContent),{timeout:90000});
 const status=()=>p.$eval('#ink-cleanup .ic-status',e=>e.textContent);
 const ring=[(240+70)/480,.5],star=[.5,.5],gap=[(240+55)/480,.5];
 let msg=await tap(...ring);
 assert.match(msg,/^Cut out/,'subject cutout ran: '+msg);
 assert.equal(await alphaAt(.1,.15),0,'clutter removed');
 assert.equal(await alphaAt(.98,.98),0,'far skin removed');
 assert.ok(await alphaAt(...ring)>200,'ring kept');
 await p.screenshot({path:'shots/t37-subject.png'});
 // a second tap adds the star in the middle
 msg=await tap(...star);assert.match(msg,/2 parts kept/,'second tap adds: '+msg);
 assert.ok(await alphaAt(...star)>200,'star kept');assert.ok(await alphaAt(...ring)>200,'ring still kept');assert.equal(await alphaAt(.1,.15),0,'clutter still removed');
 // switch to just the ink: same parts, skin between them dropped, solid star kept
 await p.select('#ic-cutout-keep','ink');await new Promise(r=>setTimeout(r,500));
 assert.match(await status(),/^Ink lifted/);
 assert.ok(await alphaAt(...ring)>200,'ring ink kept');assert.ok(await alphaAt(...star)>200,'solid star kept as ink');
 assert.equal(await alphaAt(...gap),0,'skin between ring and star dropped');assert.equal(await alphaAt(.1,.15),0,'clutter dropped');
 await p.screenshot({path:'shots/t37-ink.png'});
 // undo walks back: keep switch, then the second tap
 await p.click('[data-action=undo]');assert.ok(await alphaAt(...gap)>0,'undo restores the tapped look');
 await p.click('[data-action=undo]');assert.equal(await alphaAt(...ring)>200,true);
 await p.click('[data-action=undo]');assert.equal(await alphaAt(.1,.15),255,'undo all the way brings the clutter back');
 await p.select('#ic-cutout-keep','ink');msg=await tap(...ring);assert.match(msg,/^Ink lifted/,'fresh ink cutout: '+msg);
 await p.click('[data-action=apply]');await wait(800);
 const imgAfter=await p.evaluate(()=>window.__ink.state().tattoos.at(-1).img);assert.notEqual(imgAfter,imgBefore,'applied');
 const art=await p.evaluate(()=>{const s=window.__ink.state(),t=s.tattoos.at(-1);return s.artworks[t.artworkId];});assert.equal(art.source,imgBefore,'original picture kept');
 console.log('PASS t37 automatic cutout: on-device model loads, tap keeps the tattoo and drops clutter, two taps add up, switch to ink, undo steps, apply keeps the original');
}
