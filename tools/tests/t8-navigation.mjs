import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (ms = 350) => new Promise(r => setTimeout(r, ms));
  let cdp;
  await p.setViewport({width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true});
  await wait();
  const initial = await p.evaluate(() => JSON.stringify(window.__ink.state()));
  async function visible(label) {
    const r = await p.evaluate(() => {
      const v = visualViewport, ids = ['#top','#full','#trayItems'];
      return ids.map(id => { const r = document.querySelector(id).getBoundingClientRect(); return {id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,v:{x:v.offsetLeft,y:v.offsetTop,w:v.width,h:v.height,scale:v.scale}}; });
    });
    for (const q of r) assert(q.x >= q.v.x-2 && q.y >= q.v.y-2 && q.right <= q.v.x+q.v.w+2 && q.bottom <= q.v.y+q.v.h+2, `${label} ${JSON.stringify(q)}`);
    console.log(label, 'controls within visual viewport', r[0].v);
  }
  await visible('portrait');
  // Chromium enforces maximum-scale=1, unlike iPad accessibility zoom.
  // Inject the same visualViewport geometry/events to cover recovery layout.
  await p.evaluate(() => {
    const vv=visualViewport;
    for (const [key,value] of Object.entries({scale:2.5,width:328,height:472,offsetLeft:120,offsetTop:180})) Object.defineProperty(vv,key,{configurable:true,value});
    vv.dispatchEvent(new Event('resize')); vv.dispatchEvent(new Event('scroll'));
  }); await wait();
  await visible('simulated page zoom 2.5x plus pan');
  await p.screenshot({path:'shots/t8-page-zoom.png'});
  await p.evaluate(() => { for(const k of ['scale','width','height','offsetLeft','offsetTop']) delete visualViewport[k]; visualViewport.dispatchEvent(new Event('resize')); });
  cdp=await p.createCDPSession();
  await cdp.send('Input.synthesizePinchGesture',{x:410,y:400,scaleFactor:2,relativeSpeed:400,gestureSourceType:'touch'});await wait();
  assert.equal(await p.evaluate(()=>visualViewport.scale),1,'canvas touch pinch does not page-zoom');
  await p.setViewport({width:1180,height:820,deviceScaleFactor:1,isMobile:true,hasTouch:true}); await wait();
  await visible('landscape');
  await p.evaluate(() => { Object.assign(window.__ink.goal,{r:0.22,tx:.7,ty:1.9,tz:.5}); });
  await p.click('#full'); await wait(1500);
  assert(await p.evaluate(() => window.__ink.cur.r > 3 && Math.abs(window.__ink.cur.tx)<.01), 'Full body resets camera');
  // Cancel a two-pointer gesture, then confirm fresh one-finger orbit is accepted.
  const recovered = await p.evaluate(() => {
    const c = document.querySelector('canvas'), fire = (type,id,x,y) => c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true}));
    fire('pointerdown',41,30,160);fire('pointerdown',42,100,160);fire('pointercancel',41,30,160);
    const before = window.__ink.goal.theta;
    fire('pointerdown',43,30,160);fire('pointermove',43,65,160);fire('pointerup',43,65,160);
    return window.__ink.goal.theta !== before;
  });
  assert(recovered,'fresh orbit works after interrupted two-pointer gesture');
  // A third pointer must not poison the next gesture after lost capture.
  assert(await p.evaluate(() => {
    const c=document.querySelector('canvas');const fire=(type,id,x)=>c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:160,bubbles:true}));
    fire('pointerdown',51,30);fire('pointerdown',52,80);fire('pointerdown',53,120);fire('lostpointercapture',51,30);
    const old=window.__ink.goal.theta;fire('pointerdown',54,30);fire('pointermove',54,65);fire('pointerup',54,65);return old!==window.__ink.goal.theta;
  }),'lost capture clears stale pointers');
  await p.click('#full'); await wait();
  assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.state())),initial,'navigation leaves project unchanged');
  await p.click('#trayItems .chip');await wait();await visible('editing selected ink');
  await p.click('#full'); await wait();
  assert(await p.$eval('#sheet',e=>e.hidden),'Full body exits edit mode');
  assert.equal(await p.$eval('#name',e=>getComputedStyle(e).fontSize),'16px','input avoids iOS focus zoom');
  await p.click('#bodyBtn');await wait();
  assert(await p.$eval('#full',e=>getComputedStyle(e).visibility==='visible'),'Full body remains available while body panel is open');
  await p.click('#full');await wait();
  assert(await p.$eval('#bodyPop',e=>e.hidden),'Full body closes obstructing body panel');
  console.log('PASS t8 navigation recovery');
}
