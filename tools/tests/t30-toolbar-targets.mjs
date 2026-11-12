import assert from 'node:assert/strict';
export default async function(p){
 const results=[];
 for(const width of [768,1024,1366]){
  await p.setViewport({width,height:768,deviceScaleFactor:1});await new Promise(r=>setTimeout(r,500));
  const report=await p.evaluate(()=>{
   const els=[...document.querySelectorAll('#top button,#views button,#full')].filter(e=>e.getBoundingClientRect().width);
   const rects=els.map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,hit:[.2,.5,.8].every(f=>{const h=document.elementFromPoint(r.x+r.width*f,r.y+r.height*.5);return h===e||e.contains(h)})}});
   const overlap=[];for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y))overlap.push([a.id,b.id]);}
   return {rects,overlap};
  });
  assert.deepEqual(report.overlap,[],`overlap at ${width}`);
  for(const r of report.rects){assert.ok(r.w>=44&&r.h>=44,`44px ${r.id}`);assert.ok(r.hit,`occluded ${r.id} at ${width}`);assert.ok(r.x>=0&&r.x+r.w<=width,`in bounds ${r.id}`)}
  await p.click('[data-view="1"]');await p.click('[data-view="0"]');await p.click('#bodyBtn');assert.equal(await p.$eval('#bodyPop',e=>e.hidden),false);await p.click('[data-close="bodyPop"]');
  results.push({width,targets:report.rects.length});
  if(width===1024)await p.screenshot({path:'/tmp/ink-toolbar-1024.png'});
 }
 console.log('PASS toolbar targets',JSON.stringify(results));
}
