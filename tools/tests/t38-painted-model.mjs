// 3D model with the tattoos painted into the skin: USDZ for iPad apps and an OBJ ZIP.
// Both come from the real Share sheet; the OBJ is opened and its picture checked for ink.
import assert from 'node:assert/strict';
export default async function(p){
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.name)window.saved[blob.name]=blob.arrayBuffer();return old.call(this,blob);};window.toasts=[];new MutationObserver(()=>{const t=document.querySelector('#toast').textContent;if(t)window.toasts.push(t);}).observe(document.querySelector('#toast'),{childList:true,subtree:true,characterData:true});});
 const run=async(card,name)=>{await p.click('#shareBtn');await p.click(card);await p.waitForFunction(n=>!!window.saved[n]||window.toasts.some(x=>x.includes('Could not make')),{timeout:120000},name);assert.ok(await p.evaluate(n=>!!window.saved[n],name),await p.evaluate(()=>JSON.stringify(window.toasts)));};
 const unzip=(name)=>p.evaluate(async name=>{const b=await window.saved[name],v=new DataView(b),out={};let i=0;while(i+30<b.byteLength&&v.getUint32(i,true)===0x04034b50){const len=v.getUint32(i+18,true),n=v.getUint16(i+26,true),extra=v.getUint16(i+28,true),nm=new TextDecoder().decode(new Uint8Array(b,i+30,n)),start=i+30+n+extra;out[nm]={start,len};i=start+len;}return out;},name);
 // USDZ
 await run('#cUsdz','ink-atlas-model.usdz');
 const usdz=await unzip('ink-atlas-model.usdz');const names=Object.keys(usdz);
 assert.ok(names.some(n=>n.endsWith('.usda')),'usda scene inside: '+names);assert.ok(names.some(n=>n.endsWith('.png')),'texture inside');
 const usda=await p.evaluate(async list=>{const b=await window.saved['ink-atlas-model.usdz'];return list.map(e=>new TextDecoder().decode(new Uint8Array(b,e.start,e.len))).join('\n');},names.filter(n=>n.endsWith('.usda')).map(n=>usdz[n]));
 assert.match(usda,/texCoord2f\[\] primvars:st/,'mesh carries texture coordinates');
 // OBJ package
 await run('#cObjBaked','ink-atlas-model-obj.zip');
 const files=await unzip('ink-atlas-model-obj.zip');
 for(const n of ['model.obj','model.mtl','skin.png','manifest.json'])assert.ok(files[n],'has '+n);
 const check=await p.evaluate(async files=>{const b=await window.saved['ink-atlas-model-obj.zip'],text=n=>new TextDecoder().decode(new Uint8Array(b,files[n].start,files[n].len));
  const obj=text('model.obj'),lines=obj.split('\n'),v=lines.filter(l=>l.startsWith('v ')).length,vt=lines.filter(l=>l.startsWith('vt ')).length,f=lines.filter(l=>l.startsWith('f '));
  const bad=f.some(l=>l.split(' ').slice(1).some(c=>{const [a,t,n]=c.split('/').map(Number);return !(a>=1&&a<=v&&t>=1&&t<=vt&&n>=1);}));
  const img=await createImageBitmap(new Blob([new Uint8Array(b,files['skin.png'].start,files['skin.png'].len)],{type:'image/png'}));const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height).data;
  // skin colour = the most common pixel; ink = clearly darker than it
  const counts=new Map();for(let i=0;i<d.length;i+=4*97){const k=d[i]<<16|d[i+1]<<8|d[i+2];counts.set(k,(counts.get(k)||0)+1);}const skin=[...counts].sort((a,b)=>b[1]-a[1])[0][0],sr=skin>>16,sg=skin>>8&255,sb=skin&255;
  let ink=0,opaque=true;const eyesEnd=c.width*Math.ceil(c.height*.08)*4; // the eyes sit in the top strip of the texture
  for(let i=0;i<d.length;i+=4){if(d[i+3]!==255)opaque=false;if(i>=eyesEnd&&d[i]+d[i+1]+d[i+2]<(sr+sg+sb)*.6)ink++;}
  return {v,vt,f:f.length,bad,w:img.width,h:img.height,ink,opaque,mtl:text('model.mtl'),manifest:JSON.parse(text('manifest.json'))};},files);
 assert.equal(check.bad,false,'every face points at real vertices, UVs and normals');
 assert.ok(check.f>=27036,`faces ${check.f}`);assert.ok(check.vt>check.v*0.9,'texture coordinates present');
 assert.ok(check.w>=2048&&check.w===check.h,'square skin picture');assert.equal(check.opaque,true,'skin picture fully opaque');
 assert.match(check.mtl,/map_Kd skin\.png/);assert.equal(check.manifest.uvBaked,true);assert.equal(check.manifest.units,'meters');
 assert.ok(check.ink>500,`ink painted into the skin (${check.ink} dark pixels)`);
 // with every tattoo hidden there is no ink in the picture
 await p.evaluate(()=>{for(const t of window.__ink.state().tattoos)t.hidden=true;window.__ink.commitTest();delete window.saved['ink-atlas-model-obj.zip'];});
 await run('#cObjBaked','ink-atlas-model-obj.zip');
 const files2=await unzip('ink-atlas-model-obj.zip');
 const ink2=await p.evaluate(async files=>{const b=await window.saved['ink-atlas-model-obj.zip'];const img=await createImageBitmap(new Blob([new Uint8Array(b,files['skin.png'].start,files['skin.png'].len)],{type:'image/png'}));const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height).data;const counts=new Map();for(let i=0;i<d.length;i+=4*97){const k=d[i]<<16|d[i+1]<<8|d[i+2];counts.set(k,(counts.get(k)||0)+1);}const skin=[...counts].sort((a,b)=>b[1]-a[1])[0][0],s=(skin>>16)+(skin>>8&255)+(skin&255);let ink=0;for(let i=c.width*Math.ceil(c.height*.08)*4;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]<s*.6)ink++;return ink;},files2);
 assert.ok(ink2<check.ink*0.05,`hidden tattoos are left out (${ink2} vs ${check.ink})`);
 await p.evaluate(()=>{for(const t of window.__ink.state().tattoos)t.hidden=false;window.__ink.commitTest();});
 const after=JSON.parse(await p.evaluate(()=>JSON.stringify(window.__ink.state())));assert.deepEqual(after.tattoos.map(t=>[t.pos,t.width]),JSON.parse(before).tattoos.map(t=>[t.pos,t.width]));
 console.log(`PASS t38 painted 3D model: USDZ with UVs and texture, OBJ ${check.f} faces + ${check.w}px skin with ${check.ink} ink pixels, hidden ink left out, project unchanged`);
}
