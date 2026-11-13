// Share > Colour palette: a Procreate .swatches file whose first colour is the body's skin tone
// exactly, then its shade and highlight, then the ink colours of the tattoos (the sample art is
// black line work, so black ink, and no white paper).
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(b){if(b.name)window.saved[b.name]=b;return old.call(this,b);};});
 await p.click('#shareBtn');await wait(400);
 const card=await p.$eval('#cSwatches',e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,text:e.textContent};});
 assert.ok(card.h>=44,'big enough');assert.match(card.text,/Colour palette/);
 await p.click('#cSwatches');await p.waitForFunction(()=>Object.keys(window.saved).some(n=>/\.swatches$/.test(n)),{timeout:10000});
 const out=await p.evaluate(async()=>{const name=Object.keys(window.saved).find(n=>/\.swatches$/.test(n)),b=new Uint8Array(await window.saved[name].arrayBuffer()),v=new DataView(b.buffer);
  const n=v.getUint16(26,true),e=v.getUint16(28,true),size=v.getUint32(18,true);return {name,entry:new TextDecoder().decode(b.slice(30,30+n)),json:JSON.parse(new TextDecoder().decode(b.slice(30+n+e,30+n+e+size)))};});
 assert.equal(out.entry,'Swatches.json');
 const pal=out.json[0];assert.match(pal.name,/^Ink Atlas/);
 const skin=await p.evaluate(()=>{const s=window.__ink.state();return s.skinHex||['#f1d3bd','#e0b394','#c6916c','#9a6644','#6a422a'][s.skin??1];});
 const rgb=[1,3,5].map(i=>parseInt(skin.slice(i,i+2),16)),mx=Math.max(...rgb)/255;
 assert.ok(Math.abs(pal.swatches[0].brightness-mx)<1e-6,'first swatch is the skin tone');
 assert.ok(pal.swatches[1].brightness<pal.swatches[0].brightness&&pal.swatches[2].brightness>pal.swatches[0].brightness,'then shade and highlight');
 const inks=pal.swatches.slice(3);assert.ok(inks.length>=1&&inks.length<=12,'ink colours: '+inks.length);
 assert.ok(inks.some(s=>s.brightness<.25),'black ink found');assert.ok(!inks.some(s=>s.brightness>.92&&s.saturation<.08),'no white paper');
 assert.equal(await p.$eval('#share',e=>e.hidden),true,'sheet closes');
 console.log(`PASS t50 palette: ${out.name} with skin, shade, highlight and ${inks.length} ink colour(s)`);
}
