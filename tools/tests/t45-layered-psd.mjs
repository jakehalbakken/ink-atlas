// Layered PSD for Procreate: Share makes a PSD of this view with the body as one layer
// and each visible tattoo on its own multiply layer, named after the tattoo, sitting
// where the tattoo is on screen. Multiplying the layers over the body gives back the
// flattened picture. Clothes are left out, hidden tattoos get no layer, nothing changes.
import assert from 'node:assert/strict';
import { readPsd } from '../../src/psd.js';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.name)window.saved[blob.name]=blob.arrayBuffer();return old.call(this,blob);};});
 // a T-shirt over the chest tattoo: the file still shows it, clothes are not part of it
 await p.evaluate(()=>window.__ink.setClothes({top:'tee'}));await wait(200);
 const get=async()=>{await p.evaluate(()=>{delete window.saved['ink-atlas-layers.psd'];});await p.click('#shareBtn');await p.click('#cPsd');
  await p.waitForFunction(()=>!!window.saved['ink-atlas-layers.psd'],{timeout:120000});
  const b64=await p.evaluate(async()=>{const u=new Uint8Array(await window.saved['ink-atlas-layers.psd']);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(s);});
  return readPsd(Buffer.from(b64,'base64'));};
 const psd=await get();
 const view=await p.evaluate(()=>{const c=document.querySelector('#stage canvas');return {w:c.width,h:c.height,dpr:c.width/c.getBoundingClientRect().width};});
 assert.equal(psd.width,view.w);assert.equal(psd.height,view.h);assert.equal(psd.depth,8);assert.equal(psd.mode,3);
 // from the front: the body, then the chest sunburst (the sprig on the side of the hip is edge on)
 const all=JSON.parse(before).tattoos,sun=all.find(t=>/Sunburst/.test(t.name)),sprig=all.find(t=>/Sprig/.test(t.name));
 assert.deepEqual(psd.layers.slice(0,2).map(l=>l.name),['Body',sun.name],'body, then a layer for each tattoo seen from here');
 for(const L of psd.layers.slice(1))assert.ok(L.pixels[-1].some(v=>v>0),'no empty tattoo layers: '+L.name);
 const tattoos=[sun];
 assert.equal(psd.layers[0].blend,'norm');assert.deepEqual([psd.layers[0].right,psd.layers[0].bottom],[view.w,view.h],'body layer fills the picture');
 for(const [k,t] of tattoos.entries()){const L=psd.layers[k+1];assert.equal(L.blend,'mul ',t.name+' multiplies');
  const at=await p.evaluate(id=>{const s=window.__ink.viewSpot(id);return s&&window.__ink.projectPoint(s.pos);},t.id);
  const x=at.x*view.dpr,y=at.y*view.dpr;
  assert.ok(x>=L.left-4&&x<=L.right+4&&y>=L.top-4&&y<=L.bottom+4,`${t.name} layer sits on the tattoo (${Math.round(x)},${Math.round(y)} in ${L.left},${L.top}-${L.right},${L.bottom})`);
  const a=L.pixels[-1];let ink=0;for(const v of a)if(v>40)ink++;assert.ok(ink>50,t.name+' layer has ink: '+ink);}
 // body x each tattoo layer = the flattened picture, checked across every tattoo box
 const body=psd.layers[0].pixels;let n=0,err=0;
 for(const L of psd.layers.slice(1))for(let y=L.top;y<L.bottom;y+=2)for(let x=L.left;x<L.right;x+=2){const i=y*psd.width+x;
  for(let c=0;c<3;c++){let v=body[c][i]/255;for(const M of psd.layers.slice(1)){if(x<M.left||x>=M.right||y<M.top||y>=M.bottom)continue;const j=(y-M.top)*(M.right-M.left)+(x-M.left),al=M.pixels[-1][j]/255;v*=1-al+al*M.pixels[c][j]/255;}
   err+=Math.abs(v*255-psd.merged[c][i]);n++;}}
 assert.ok(err/n<4,`layers recombine to the flattened picture (mean error ${(err/n).toFixed(2)})`);
 assert.equal(await p.evaluate(()=>window.__ink.clothes().top),'tee','clothes choice kept');
 // from the left side the sprig gets its layer; hidden tattoos get none
 await p.click('#views [data-view="1"]');await p.waitForFunction(()=>window.__ink.settled(),{timeout:20000});await wait(300);
 const psd2=await get();assert.ok(psd2.layers.some(l=>l.name===sprig.name&&l.pixels[-1].some(v=>v>40)),'sprig layer from the side: '+psd2.layers.map(l=>l.name));
 await p.evaluate(id=>{window.__ink.state().tattoos.find(t=>t.id===id).hidden=true;window.__ink.commitTest();},sprig.id);
 const psd3=await get();assert.ok(!psd3.layers.some(l=>l.name===sprig.name),'hidden tattoo left out');
 await p.evaluate(id=>{window.__ink.state().tattoos.find(t=>t.id===id).hidden=false;window.__ink.commitTest();window.__ink.setClothes({top:'none'});},sprig.id);
 const after=JSON.parse(await p.evaluate(()=>JSON.stringify(window.__ink.state())));
 assert.deepEqual(after.tattoos.map(t=>[t.pos,t.width,t.hidden]),JSON.parse(before).tattoos.map(t=>[t.pos,t.width,t.hidden]),'tattoos unchanged');
 console.log(`PASS t45 layered PSD: ${psd.width}x${psd.height}, ${psd.layers.length} layers, recombines within ${(err/n).toFixed(2)} levels`);
}
