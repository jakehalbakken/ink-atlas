// Back from Procreate: export the painted 3D model, draw a new mark on its skin picture
// (as Procreate would), pack it back up (deflated, like a re-saved ZIP), open it, and
// check a new tattoo lands where the mark was drawn, the existing tattoos are untouched,
// and baking again puts the ink back on the same patch of skin.
import assert from 'node:assert/strict';
import { bodyCornerUVs } from '../../src/uv-bake.js';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const before=JSON.parse(await p.evaluate(()=>JSON.stringify(window.__ink.state())));
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.name)window.saved[blob.name]=blob.arrayBuffer();return old.call(this,blob);};window.toasts=[];new MutationObserver(()=>{const t=document.querySelector('#toast').textContent;if(t)window.toasts.push(t);}).observe(document.querySelector('#toast'),{childList:true,subtree:true,characterData:true});});
 const exportUsdz=async()=>{await p.evaluate(()=>{delete window.saved['ink-atlas-model.usdz'];});await p.click('#shareBtn');await p.click('#cUsdz');await p.waitForFunction(()=>!!window.saved['ink-atlas-model.usdz']||window.toasts.some(x=>x.includes('Could not make')),{timeout:120000});assert.ok(await p.evaluate(()=>!!window.saved['ink-atlas-model.usdz']),'model exported');};
 await exportUsdz();
 // where to draw: the front of the left thigh, clear of the sample tattoos
 const target=[0.11,0.62,0.2];
 const hit=await p.evaluate(t=>window.__ink.surfaceAt([t[0],t[1],0.6],[0,0,-1]),target);assert.ok(hit,'thigh found');
 const face=await p.evaluate(h=>{const pt=window.__ink.projectPoint(h.pos);return window.__ink.hitBody(pt.x,pt.y);},hit);assert.ok(face&&face.faceIndex<26756,'thigh triangle');
 const uv=bodyCornerUVs(),o=face.faceIndex*6,u=(uv[o]+uv[o+2]+uv[o+4])/3,v=(uv[o+1]+uv[o+3]+uv[o+5])/3;
 // draw on the skin picture: a dark star of two strokes, then re-pack the USDZ with the picture deflated
 const result=await p.evaluate(async({u,v})=>{
  const b=new Uint8Array(await window.saved['ink-atlas-model.usdz']),dv=new DataView(b.buffer),entries=[];let i=0;
  while(i+30<b.length&&dv.getUint32(i,true)===0x04034b50){const len=dv.getUint32(i+18,true),n=dv.getUint16(i+26,true),x=dv.getUint16(i+28,true),name=new TextDecoder().decode(b.subarray(i+30,i+30+n)),s=i+30+n+x;entries.push({name,data:b.slice(s,s+len)});i=s+len;}
  const tex=entries.find(e=>e.name.endsWith('.png'));const img=await createImageBitmap(new Blob([tex.data],{type:'image/png'}));
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);
  // the USDZ keeps its picture upside down (row 0 is the bottom of the texture), as three.js writes it
  const S=c.width,cx=u*S,cy=v*S,r=S*0.012;g.strokeStyle='#1d2a5a';g.lineWidth=S*0.004;g.lineCap='round';g.beginPath();g.moveTo(cx-r,cy);g.lineTo(cx+r,cy);g.moveTo(cx,cy-r);g.lineTo(cx,cy+r);g.stroke();
  const drawn=g.getImageData(0,0,S,S).data;let mark=[];for(let y=Math.floor(cy-r-8);y<cy+r+8;y++)for(let x=Math.floor(cx-r-8);x<cx+r+8;x++){const q=(y*S+x)*4;if(drawn[q+2]>drawn[q]+40)mark.push(y*S+x);}window.markPx={S,mark};
  const png=new Uint8Array(await (await new Promise(res=>c.toBlob(res,'image/png'))).arrayBuffer());
  const deflate=async d=>new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  const crcT=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});const crc=d=>{let c=~0;for(const x of d)c=crcT[(c^x)&255]^(c>>>8);return (~c)>>>0;};
  const parts=[],central=[];let off=0;
  for(const e of entries){const data=e.name===tex.name?png:e.data,packed=e.name===tex.name?await deflate(data):data,method=e.name===tex.name?8:0,nm=new TextEncoder().encode(e.name);
   const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(8,method,true);h.setUint32(14,crc(data),true);h.setUint32(18,packed.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nm.length,true);
   const cd=new DataView(new ArrayBuffer(46));cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);cd.setUint16(10,method,true);cd.setUint32(16,crc(data),true);cd.setUint32(20,packed.length,true);cd.setUint32(24,data.length,true);cd.setUint16(28,nm.length,true);cd.setUint32(42,off,true);
   parts.push(new Uint8Array(h.buffer),nm,packed);central.push(new Uint8Array(cd.buffer),nm);off+=30+nm.length+packed.length;}
  const csize=central.reduce((a,x)=>a+x.length,0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);end.setUint32(12,csize,true);end.setUint32(16,off,true);
  const file=new File([...parts,...central,new Uint8Array(end.buffer)],'painted.usdz',{type:'model/vnd.usdz+zip'});
  const ids=await window.__ink.importPainted(file);return {ids,marks:window.markPx.mark.length,toasts:window.toasts.slice(-2)};
 },{u,v});
 assert.ok(result.marks>200,'mark drawn: '+result.marks);
 assert.equal(result.ids.length,1,'one new tattoo from one mark: '+JSON.stringify(result));
 const s=JSON.parse(await p.evaluate(()=>JSON.stringify(window.__ink.state())));
 assert.deepEqual(s.tattoos.slice(0,before.tattoos.length).map(t=>[t.pos,t.width,t.img]),before.tattoos.map(t=>[t.pos,t.width,t.img]),'existing tattoos untouched');
 const t=s.tattoos.find(x=>x.id===result.ids[0]);
 const d=Math.hypot(t.pos[0]-hit.pos[0],t.pos[1]-hit.pos[1],t.pos[2]-hit.pos[2]);
 assert.ok(d<0.025,`new tattoo sits on the mark (${(d*100).toFixed(1)} cm away)`);
 assert.ok(t.width>0.01&&t.width<0.12,'sensible size '+t.width);assert.ok(Math.abs(t.aspect-1)<0.35,'a plus sign stays about square: '+t.aspect);
 assert.equal(await p.evaluate(()=>window.__ink.selected()),t.id,'new tattoo selected');
 // baking again puts that ink on the same patch of skin
 await exportUsdz();
 const overlap=await p.evaluate(async()=>{
  const b=new Uint8Array(await window.saved['ink-atlas-model.usdz']),dv=new DataView(b.buffer);let i=0,png=null;
  while(i+30<b.length&&dv.getUint32(i,true)===0x04034b50){const len=dv.getUint32(i+18,true),n=dv.getUint16(i+26,true),x=dv.getUint16(i+28,true),name=new TextDecoder().decode(b.subarray(i+30,i+30+n)),s=i+30+n+x;if(name.endsWith('.png'))png=b.slice(s,s+len);i=s+len;}
  const img=await createImageBitmap(new Blob([png],{type:'image/png'})),c=document.createElement('canvas');c.width=c.height=window.markPx.S;const g=c.getContext('2d');g.drawImage(img,0,0,c.width,c.height);const d=g.getImageData(0,0,c.width,c.height).data;
  let inked=0;for(const q of window.markPx.mark){const k=q*4;if(d[k]+d[k+1]+d[k+2]<500)inked++;}return inked/window.markPx.mark.length;
 });
 assert.ok(overlap>0.6,`re-exported ink covers the drawn mark (${(overlap*100).toFixed(0)}%)`);
 // nothing new drawn adds nothing: the same USDZ again, and the OBJ ZIP whose picture is the right way up
 const none=await p.evaluate(async()=>{const f=new File([await window.saved['ink-atlas-model.usdz']],'again.usdz');return (await window.__ink.importPainted(f)).length;});
 assert.equal(none,0,'nothing new in the USDZ, nothing added');
 await p.click('#shareBtn');await p.evaluate(()=>{document.querySelector('#shMore').open=true;});await p.click('#cObjBaked');await p.waitForFunction(()=>!!window.saved['ink-atlas-model-obj.zip'],{timeout:120000});
 const none2=await p.evaluate(async()=>{const f=new File([await window.saved['ink-atlas-model-obj.zip']],'model.zip',{type:'application/zip'});return (await window.__ink.importPainted(f)).length;});
 assert.equal(none2,0,'nothing new in the OBJ ZIP, nothing added');
 assert.equal(JSON.parse(await p.evaluate(()=>JSON.stringify(window.__ink.state()))).tattoos.length,before.tattoos.length+1,'only the one new tattoo');
 console.log(`PASS t44 Procreate round trip: mark became a tattoo ${(d*100).toFixed(1)} cm from where it was drawn, ${(overlap*100).toFixed(0)}% of it baked back on the same skin`);
}
