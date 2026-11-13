// Aging: the Aging button shows the ink softened and lighter at 20 years, back to crisp at
// Fresh; the project is not changed or saved by it; the button meets the touch size.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 const sun=JSON.parse(before).tattoos.find(t=>/Sunburst/.test(t.name));
 await p.click('#trayItems .chip:first-child');await p.click('#trayItems .chip:first-child');await p.waitForFunction(()=>window.__ink.settled(),{timeout:20000});await wait(400);
 // the darkest pixels and how many dark pixels there are around the tattoo
 const ink=async()=>{await wait(500);const at=await p.evaluate(id=>{const s=window.__ink.viewSpot(id);return window.__ink.projectPoint(s.pos);},sun.id);
  // the Aging panel can sit over the edge of the picture: keep it out of the measurement
  await p.evaluate(()=>{document.querySelector('#agePop').style.visibility='hidden';});
  const shot=await p.screenshot({clip:{x:at.x-130,y:at.y-130,width:260,height:260},encoding:'base64'});
  await p.evaluate(()=>{document.querySelector('#agePop').style.visibility='';});
  return p.evaluate(async b64=>{const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());const c=new OffscreenCanvas(img.width,img.height),g=c.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height).data;
   let min=255,dark=0;const px=[];for(let i=0;i<d.length;i+=4){const l=(d[i]+d[i+1]+d[i+2])/3;if(l<min)min=l;if(l<90)dark++;px.push([l,(d[i+2]-d[i])/Math.max(l,1)]);}
   // hue of the darkest ink: blue minus red, relative to how dark it is (skin under it is warm)
   px.sort((a,b)=>a[0]-b[0]);const k=Math.min(300,px.length);let blue=0;for(let i=0;i<k;i++)blue+=px[i][1];return {min,dark,blue:blue/k*100};},shot);};
 const fresh=await ink();
 await p.click('#lookBtn');const size=await p.$eval('#ageBtn',b=>{const r=b.getBoundingClientRect();return [r.width,r.height];});assert.ok(size[0]>=44&&size[1]>=44,'Aging button big enough: '+size);
 await p.click('#ageBtn');assert.equal(await p.$eval('#lookMenu',e=>e.hidden),true,'the Preview menu closes');assert.equal(await p.$eval('#agePop',e=>e.hidden),false,'Aging panel opens');
 const labels=await p.$$eval('#ageChoices [data-years]',b=>b.map(x=>x.textContent));assert.deepEqual(labels,['Fresh','Healed','10 years','20 years']);
 await p.click('#ageChoices [data-years="20"]');assert.equal(await p.evaluate(()=>window.__ink.aging()),20);
 assert.match(await p.$eval('#ageBtn',b=>b.textContent),/20 years/,'button says which age is showing');assert.match(await p.$eval('#lookBtn',b=>b.textContent),/Preview: 20 years/,'Preview says it too');
 const old=await ink();
 assert.ok(old.min>fresh.min+8,`black lightens with age (${fresh.min.toFixed(0)} to ${old.min.toFixed(0)})`);
 assert.ok(old.blue>fresh.blue,`black drifts toward blue-green (${fresh.blue.toFixed(1)} to ${old.blue.toFixed(1)})`);
 await p.click('#ageChoices [data-years="0"]');const back=await ink();
 assert.ok(Math.abs(back.min-fresh.min)<4&&Math.abs(back.dark-fresh.dark)<fresh.dark*.1+20,'Fresh puts the crisp ink back: '+JSON.stringify([fresh,back]));
 await p.click('#agePop [data-close]');assert.equal(await p.$eval('#agePop',e=>e.hidden),true);
 const after=await p.evaluate(()=>JSON.stringify(window.__ink.state()));assert.equal(after,before,'project unchanged');
 console.log(`PASS t46 aging: darkest ink ${fresh.min.toFixed(0)} fresh, ${old.min.toFixed(0)} at 20 years, back to ${back.min.toFixed(0)} at Fresh; project unchanged`);
}
