// Eye colour (Body > Eyes): six colours, big enough to tap, brown to start with. Picking one turns
// the irises that colour on screen, changes nothing in the project, is kept on this device and
// comes back after a reload.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(800);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.click('#bodyBtn');await wait(200);
 const sw=await p.$$eval('#eyeCols .sw',(a)=>a.map((b)=>[b.dataset.eye,b.getBoundingClientRect().height,b.getAttribute('aria-pressed')]));
 assert.equal(sw.length,6,'six colours without a face photo');
 assert.ok(sw.every(([,h])=>h>=44),'big enough');
 assert.deepEqual(sw.filter(([,,on])=>on==='true').map(([k])=>k),['brown'],'brown to start with');
 // the eyes, close up
 const eye=await p.evaluate(()=>{const P=window.__ink.positions();let x=0,y=0,z=0,n=0;for(let v=13380;v<13452;v++){x+=P[v*3];y+=P[v*3+1];z+=P[v*3+2];n++;}return [x/n,y/n,z/n];});
 const look=async(name)=>{await p.evaluate((e)=>{Object.assign(window.__ink.goal,{theta:0.25,phi:Math.PI/2,roll:0,tx:e[0]*0.5,ty:e[1],tz:e[2],r:0.32});window.__ink.cur.r=0.33;},eye);
  await p.waitForFunction(()=>window.__ink.settled(),{timeout:30000});
  const style=await p.addStyleTag({content:'body *{visibility:hidden!important} canvas{visibility:visible!important}'});await wait(250);
  const buf=await p.screenshot({path:`shots/t66-${name}.png`});await style.evaluate((s)=>s.remove());return buf;};
 await p.keyboard.press('Escape');await wait(200);
 const brown=await look('brown');
 await p.click('#bodyBtn');await wait(200);
 await p.click('#eyeCols [data-eye="blue"]');await wait(200);
 assert.deepEqual(await p.evaluate(()=>window.__ink.eyes()),{pick:'blue',hex:'#4a6f96'});
 assert.equal(await p.$eval('#eyeCols [data-eye="blue"]',(b)=>b.getAttribute('aria-pressed')),'true');
 await p.keyboard.press('Escape');await wait(200);
 const blue=await look('blue');
 // the picture changes only a little: the irises
 const cmp=await p.evaluate(async(a64,b64)=>{const load=async(b)=>{const i=new Image();i.src='data:image/png;base64,'+b;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);return g.getImageData(0,0,c.width,c.height);};
  const a=await load(a64),b=await load(b64);let n=0,bluer=0;for(let i=0;i<a.data.length;i+=4){const d=Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2]);if(d>30){n++;if(b.data[i+2]-b.data[i]>a.data[i+2]-a.data[i])bluer++;}}
  return {share:n/(a.width*a.height),n,bluer};},brown.toString('base64'),blue.toString('base64'));
 console.log('changed',(cmp.share*100).toFixed(2)+'%','bluer',cmp.bluer,'of',cmp.n);
 assert.ok(cmp.share>0.0005&&cmp.share<0.08,`only the irises change (${(cmp.share*100).toFixed(2)}%)`);assert.ok(cmp.bluer>cmp.n*0.8,'and they turn bluer');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project not changed');
 await p.reload();await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(500);
 assert.equal((await p.evaluate(()=>window.__ink.eyes())).pick,'blue','kept on this device');
}
