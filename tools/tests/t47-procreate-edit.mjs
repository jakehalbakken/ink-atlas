// Edit in Procreate and bring it back: the edit panel sends the selected tattoo's artwork
// as a PNG (as it looks on the body, mirror included), a bar remembers which tattoo is out
// (also after a reload), and Paste puts the edited picture back on that same tattoo:
// same place, size and turn, earlier artwork kept, one undo. Cancel and other tattoos are
// untouched.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const sun=all.find(t=>/Sunburst/.test(t.name)),other=all.find(t=>t.id!==sun.id);
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(b){if(b.name)window.saved[b.name]=b;return old.call(this,b);};});
 // mirror it first, so the picture that goes out must be mirrored too
 await p.evaluate(id=>{window.__ink.state().tattoos.find(t=>t.id===id).flip=true;window.__ink.commitTest();},sun.id);
 await p.click('#trayItems .chip:first-child');await wait(400);
 assert.equal(await p.evaluate(()=>window.__ink.selected()),sun.id);
 const btn=await p.$eval('#bProcreate',b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height,text:b.textContent};});
 assert.equal(btn.text,'Edit in Procreate');assert.ok(btn.w>=44&&btn.h>=44,'button big enough');
 assert.equal(await p.$eval('#procreateBar',e=>e.hidden),true,'no bar before');
 await p.click('#bProcreate');await p.waitForFunction(()=>!!window.saved['Sunburst.png'],{timeout:10000});
 // what went out: a PNG the size of the stored artwork, mirrored like the tattoo
 const out=await p.evaluate(async id=>{const t=window.__ink.state().tattoos.find(t=>t.id===id),blob=window.saved['Sunburst.png'];
  const a=await createImageBitmap(blob),src=new Image();src.src=window.__ink.imageOf(t.img);await src.decode();
  const c=new OffscreenCanvas(a.width,a.height),g=c.getContext('2d');g.drawImage(a,0,0);const A=g.getImageData(0,0,a.width,a.height).data;
  g.clearRect(0,0,a.width,a.height);g.translate(a.width,0);g.scale(-1,1);g.drawImage(src,0,0);const B=g.getImageData(0,0,a.width,a.height).data;
  let d=0;for(let i=0;i<A.length;i++)d+=Math.abs(A[i]-B[i]);return {type:blob.type,w:a.width,h:a.height,sw:src.naturalWidth,sh:src.naturalHeight,diff:d/A.length};},sun.id);
 assert.equal(out.type,'image/png');assert.deepEqual([out.w,out.h],[out.sw,out.sh],'full stored size');assert.ok(out.diff<1,'mirrored like on the body: '+out.diff);
 // the bar names the tattoo and survives a reload (iPadOS may close the app while you draw)
 await p.waitForFunction(()=>!document.querySelector('#procreateBar').hidden);
 assert.match(await p.$eval('#pcHead',e=>e.textContent),/Sunburst/);
 await p.evaluate(()=>window.__ink.flush&&window.__ink.flush());await wait(500);
 await p.reload();await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 assert.equal(await p.$eval('#procreateBar',e=>e.hidden),false,'bar back after reload');
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});});
 // Paste with nothing on the clipboard: a plain hint, nothing changes
 await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read:async()=>[]}});});
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.click('#pcPaste');await wait(400);
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'empty clipboard changes nothing');
 assert.match(await p.$eval('#toast',e=>e.textContent),/Copy All/,'tells how to copy in Procreate');
 // the edited picture: a red ring, wider than the original, on a clear background
 await p.evaluate(()=>{window.__edited=(async()=>{const c=new OffscreenCanvas(900,600),g=c.getContext('2d');g.strokeStyle='#c00';g.lineWidth=40;g.beginPath();g.arc(450,300,220,0,7);g.stroke();return await c.convertToBlob({type:'image/png'});})();
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read:async()=>[{types:['text/plain','image/png'],getType:async()=>await window.__edited}]}});});
 await p.click('#pcPaste');await p.waitForFunction(()=>document.querySelector('#procreateBar').hidden,{timeout:10000});await wait(500);
 const after=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 const s1=JSON.parse(before).tattoos.find(t=>t.id===sun.id),s2=after.tattoos.find(t=>t.id===sun.id);
 assert.notEqual(s2.img,s1.img,'new artwork on the tattoo');
 assert.deepEqual([s2.pos,s2.normal,s2.width,s2.rot,s2.opacity],[s1.pos,s1.normal,s1.width,s1.rot,s1.opacity],'same place, size, turn and ink strength');
 assert.ok(Math.abs(s2.aspect-1.5)<.01,'new shape taken: '+s2.aspect);assert.equal(s2.flip,false,'mirror is in the picture now');
 assert.equal(after.artworks[s2.artworkId].source,JSON.parse(before).artworks[s1.artworkId].source||s1.img,'original kept');
 assert.deepEqual(after.tattoos.find(t=>t.id===other.id),JSON.parse(before).tattoos.find(t=>t.id===other.id),'other tattoo untouched');
 assert.equal(await p.evaluate(()=>window.__ink.selected()),sun.id,'that tattoo is selected');
 const red=await p.evaluate(id=>{const s=window.__ink.viewSpot(id);return window.__ink.projectPoint(s.pos);},sun.id);
 assert.ok(red,'still on screen');
 // one undo puts the old artwork back
 await p.click('#undo');await wait(400);
 const undone=await p.evaluate(id=>window.__ink.state().tattoos.find(t=>t.id===id),sun.id);
 assert.equal(undone.img,s1.img,'undo restores the artwork');assert.equal(undone.flip,true);
 // Cancel clears the bar and changes nothing
 await p.click('#bProcreate');await p.waitForFunction(()=>!document.querySelector('#procreateBar').hidden);
 const mid=await p.evaluate(()=>JSON.stringify(window.__ink.state().tattoos));
 await p.click('#pcCancel');assert.equal(await p.$eval('#procreateBar',e=>e.hidden),true,'cancel hides the bar');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state().tattoos)),mid,'cancel changes nothing');
 console.log(`PASS t47 edit in Procreate: sent ${out.w}x${out.h} mirrored PNG, bar survives reload, paste swaps the art in place, undo and cancel safe`);
}
