// Before and after picture (Share): this view without the planned tattoos and with them, side by
// side, in one PNG. The two halves are the same body and view, so they differ only where planned
// ink is. Tattoos already on you show in both. With nothing planned it says so in plain words.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const st=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 // the chest piece planned (in this front view), the other already on the skin
 await p.evaluate(()=>{const s=window.__ink.state();for(const t of s.tattoos)t.status=/Sunburst/.test(t.name)?'planned':'existing';window.__ink.commitTest();});
 await wait(300);
 await p.click('#shareBtn');await wait(300);
 assert.ok(await p.$eval('#cCompare',e=>e.getBoundingClientRect().height>=44),'big enough');
 await p.click('#cCompare');
 await p.waitForFunction(()=>{const i=document.querySelector('#pvImg');return i&&/before-after/.test(document.querySelector('#pvTitle').textContent.toLowerCase().replace(/ and /,'-'))&&i.complete&&i.naturalWidth>0;},{timeout:20000});
 const r=await p.evaluate(async()=>{
  const img=document.querySelector('#pvImg'),c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);
  const {W,H}=window.__ink.compareLast();const pad=Math.round(H*0.02),head=Math.round(H*0.075);
  const L=g.getImageData(pad,head,W,H).data,R=g.getImageData(W+pad*2,head,W,H).data;
  let diff=0,big=0;for(let i=0;i<L.length;i+=4){const d=Math.abs(L[i]-R[i])+Math.abs(L[i+1]-R[i+1])+Math.abs(L[i+2]-R[i+2]);if(d>30)big++;diff+=d;}
  return {w:c.width,h:c.height,W,H,big,frac:big/(W*H)};
 });
 const b64=await p.evaluate(()=>document.querySelector('#pvImg').src.split(',')[1]);(await import('node:fs')).writeFileSync('shots/t61-compare.png',Buffer.from(b64,'base64'));
 assert.ok(Math.abs(r.w-(r.W*2+Math.round(r.H*0.02)*3))<=1,`two views side by side (${r.w} wide for ${r.W} wide halves)`);
 assert.ok(r.big>50,`the planned ink shows on the right only (${r.big} pixels differ)`);
 assert.ok(r.frac<0.2,`everything else matches (${(r.frac*100).toFixed(1)}% differs)`);
 await p.screenshot({path:'shots/t61-compare-preview.png'});
 // the app view is back to normal and nothing in the project changed
 const after=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 assert.equal(after.tattoos.length,st.tattoos.length,'project not changed');
 await p.keyboard.press('Escape');await wait(300);
 // nothing planned: plain words, no picture
 await p.evaluate(()=>{for(const t of window.__ink.state().tattoos)t.status='existing';window.__ink.commitTest();});
 await p.keyboard.press('Escape');await wait(200);
 await p.click('#shareBtn');await wait(300);await p.click('#cCompare');await wait(300);
 assert.match(await p.$eval('#toast',e=>e.textContent),/planned/,'says to mark one as planned');
}
