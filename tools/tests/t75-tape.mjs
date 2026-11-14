// Tape measure: Preview > Tape measure, tap two points on the body for the length along the
// skin, Around for the way round the waist or a thigh; sensible real-world lengths, the tape
// drawn on the body with a label, a tattoo's share of the way round, points follow a shape
// change, a pose goes back to standing, Done clears it, and nothing is saved.
// Saves shots/t75-tape-along.png and shots/t75-tape-around.png.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 // a point on the front of the body at height y (body units, 1.75 tall) and side x
 const front=(x,y)=>p.evaluate(([x,y])=>{const h=window.__ink.surfaceHit([x,y,2],[0,0,-1]);if(!h)return null;const s=window.__ink.projectPoint(h.pos);return {x:s.x,y:s.y};},[x,y]);
 await p.click('#lookBtn');await wait(200);
 const tb=await p.$eval('#tapeBtn',e=>e.getBoundingClientRect().height);assert.ok(tb>=44,'button big enough');
 await p.click('#tapeBtn');await wait(300);
 let s=await p.evaluate(()=>window.__ink.tape());
 assert.ok(s.on&&s.mode==='along','tape on, along the skin');
 assert.equal(await p.$eval('#lookMenu',e=>e.hidden),true,'the menu closes');
 for(const id of ['#tapeAlong','#tapeAround','#tapeDone']){const h=await p.$eval(id,e=>e.getBoundingClientRect().height);assert.ok(h>=44,id+' big enough');}
 assert.match(s.text,/Tap two points/);
 // across the chest: two taps
 const a=await front(0.09,1.33),b=await front(-0.09,1.33);assert.ok(a&&b,'chest points on screen');
 await p.mouse.click(a.x,a.y);await wait(250);
 s=await p.evaluate(()=>window.__ink.tape());assert.equal(s.pts,1);assert.match(s.text,/second point/);
 await p.mouse.click(b.x,b.y);await wait(400);
 s=await p.evaluate(()=>window.__ink.tape());
 assert.ok(s.result&&s.result.len>0,'measured: '+s.text);
 const H=await p.evaluate(()=>window.__ink.state().heightCm),cm=l=>l*H/1.75;
 assert.ok(cm(s.result.len)>=cm(s.result.straight)-0.01,'along the skin is at least the straight line');
 assert.ok(cm(s.result.len)>12&&cm(s.result.len)<45,'across the chest '+cm(s.result.len).toFixed(1)+' cm');
 assert.match(s.text,/^Along the skin: [\d.]+ in \([\d.]+ cm\)/);
 assert.ok(s.meshes>=3&&s.visible,'tape and both ends drawn');
 assert.match(s.label,/in \(/,'label on the body');
 assert.equal(await p.evaluate(()=>window.__ink.selected()),null,'nothing selected while measuring');
 await p.screenshot({path:'shots/t75-tape-along.png'});
 // a third tap starts again
 await p.mouse.click(a.x,a.y);await wait(250);
 s=await p.evaluate(()=>window.__ink.tape());assert.equal(s.pts,1,'third tap starts a new measure');
 // around the waist
 await p.click('#tapeAround');await wait(300);
 const w=await front(0,1.02);await p.mouse.click(w.x,w.y);await wait(800);
 s=await p.evaluate(()=>window.__ink.tape());
 assert.ok(s.result&&s.result.around,'around: '+s.text);
 const waist=cm(s.result.len);assert.ok(waist>60&&waist<115,'round the waist '+waist.toFixed(1)+' cm');
 assert.match(s.text,/^Around: /);
 await p.screenshot({path:'shots/t75-tape-around.png'});
 // around a thigh is less than round the waist
 const th=await front(0.1,0.72);await p.mouse.click(th.x,th.y);await wait(800);
 s=await p.evaluate(()=>window.__ink.tape());
 const thigh=cm(s.result.len);assert.ok(thigh>35&&thigh<75&&thigh<waist,'round a thigh '+thigh.toFixed(1)+' cm');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'measuring changes nothing saved');
 // more weight, a bigger thigh, on the same spot
 await p.evaluate(()=>window.__ink.setShape({weight:1}));await wait(800);
 s=await p.evaluate(()=>window.__ink.tape());assert.ok(cm(s.result.len)>thigh*1.05,'the tape follows the shape: '+thigh.toFixed(1)+' to '+cm(s.result.len).toFixed(1));
 await p.evaluate(()=>window.__ink.setShape({weight:0.5}));await wait(500);
 // a tattoo there: its share of the way round
 const t0=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos.find(t=>!t.hidden)||null)));
 if(t0){
  const sp=await p.evaluate(pos=>window.__ink.projectPoint(pos),t0.pos);
  if(sp&&sp.x>0&&sp.y>0){await p.mouse.click(sp.x,sp.y);await wait(800);s=await p.evaluate(()=>window.__ink.tape());if(s.result&&s.result.around&&s.result.ink)assert.match(s.text,/of the way round|all of the way round/,'tattoo share: '+s.text);}
 }
 // Done clears it
 await p.click('#tapeDone');await wait(300);
 s=await p.evaluate(()=>window.__ink.tape());assert.ok(!s.on&&s.meshes===0,'Done clears the tape');
 assert.equal(await p.$eval('#tapeBar',e=>e.hidden),true);assert.equal(await p.$eval('#tapeLabel',e=>e.hidden),true);
 // a pose goes back to standing
 await p.evaluate(()=>{document.querySelector('#poseBtn').click();});await wait(200);
 const pb=await p.$('#poseList [data-pose]:not([data-pose="neutral"])');if(pb){await pb.click();await wait(600);await p.evaluate(()=>{for(const id of ['#posePop'])document.querySelector(id).hidden=true;});
  await p.click('#lookBtn');await wait(150);await p.click('#tapeBtn');await wait(600);
  s=await p.evaluate(()=>window.__ink.tape());assert.ok(s.on);assert.equal(await p.evaluate(()=>document.querySelector('#poseBtn').textContent),'Pose','back to standing');
  await p.click('#tapeDone');}
 console.log('PASS t75 tape: along the skin, around the waist and a thigh, follows the shape, tattoo share, Done, standing only, project untouched');
}
