// Spin video from the real Share sheet: an MP4 of the body turning once, frames that
// actually change, the view put back afterwards and the project unchanged.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
export default async function(p){
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.waitForFunction(()=>window.__ink.settled(),{timeout:20000});const view=await p.evaluate(()=>({...window.__ink.cur}));
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.name)window.saved[blob.name]=blob.arrayBuffer();return old.call(this,blob);};});
 await p.evaluate(()=>window.__ink.setPose('raised'));await p.waitForFunction(()=>window.__ink.pose().settled);
 await p.click('#shareBtn');await p.click('#cSpin');
 await p.waitForFunction(()=>Object.keys(window.saved).some(n=>/ink-atlas-spin\.(mp4|webm)$/.test(n)),{timeout:240000});
 const info=await p.evaluate(async()=>{const name=Object.keys(window.saved).find(n=>/ink-atlas-spin/.test(n));const b=new Uint8Array(await window.saved[name]);
  // play it back and grab two frames a quarter turn apart
  const v=document.createElement('video');v.muted=true;v.playsInline=true;v.src=URL.createObjectURL(new Blob([b],{type:name.endsWith('mp4')?'video/mp4':'video/webm'}));
  await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=()=>j(new Error('video does not load'));});
  const grab=async t=>{v.currentTime=t;await new Promise(r=>v.onseeked=r);const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const g=c.getContext('2d');g.drawImage(v,0,0);return g.getImageData(0,0,c.width,c.height).data;};
  const a=await grab(0.05),q=await grab(1.5);let diff=0;for(let i=0;i<a.length;i+=4*13)diff+=Math.abs(a[i]-q[i]);
  return {name,bytes:b.length,head:String.fromCharCode(...b.slice(4,8)),w:v.videoWidth,h:v.videoHeight,dur:v.duration,diff:diff/(a.length/52),spin:window.__lastSpin,all:Array.from(b)};});
 console.log('spin',info.name,info.spin.codec,info.bytes,'bytes',info.w+'x'+info.h,info.dur.toFixed(2)+'s');
 assert.equal(info.w,720);assert.equal(info.h,960);
 if(info.name.endsWith('mp4'))assert.equal(info.head,'ftyp','an MP4 file');
 assert.ok(Math.abs(info.dur-6)<0.3,'six seconds: '+info.dur);
 assert.ok(info.diff>3,'the body turns between frames: '+info.diff);
 writeFileSync('shots/t41-spin.'+info.name.split('.').pop(),Buffer.from(info.all));
 const after=await p.evaluate(()=>({...window.__ink.cur}));for(const k of ['theta','phi','r'])assert.ok(Math.abs(after[k]-view[k])<1e-3,'view put back: '+k+' '+after[k]+' '+view[k]);
 assert.equal((await p.evaluate(()=>window.__ink.pose())).key,'raised','pose kept');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project unchanged');
 console.log('PASS t41 spin video: six second 720x960 clip of the body turning, view and pose put back, project unchanged');
}
