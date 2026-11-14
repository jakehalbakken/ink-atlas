// Ink check (More controls): the selected design on the skin tone with its findings marked.
// At its own size the sample reads well; shrunk to an inch its lines are too fine, the check
// says the width that fixes them, and Make it bigger does that as one undo step. Looking alone
// never changes the project. Saves shots/t77-ink-check.png.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const sun=all.find(t=>/Sunburst/.test(t.name))||all[0];
 await (await p.$$('#trayItems .chip'))[all.indexOf(sun)].click();await wait(400);
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 assert.ok(await p.$eval('#bInkCheck',e=>e.getBoundingClientRect().height>=44),'button big enough');
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.$eval('#bInkCheck',e=>e.click());
 await p.waitForFunction(id=>{const r=window.__ink.inkCheck();return r&&r.id===id&&r.items.length;},{timeout:60000},sun.id);
 let r=await p.evaluate(()=>window.__ink.inkCheck());
 assert.equal(await p.$eval('#inkCheck',e=>e.hidden),false,'sheet open');
 for(const id of ['#icClose']){const h=await p.$eval(id,e=>e.getBoundingClientRect().height);assert.ok(h>=44,id+' big enough');}
 assert.ok(r.colours.length>=1&&r.colours.every(c=>c.level==='ok'),'the dark ink shows on the skin: '+JSON.stringify(r.colours.map(c=>[c.name,c.level,+c.dE.toFixed(1)])));
 assert.match(await p.$eval('#icText',e=>e.textContent),/in wide, on your skin\.$/);
 const lis=await p.$$eval('#icList li',l=>l.map(e=>e.textContent));assert.ok(lis.length>=2,'findings listed: '+lis.join(' | '));
 // the canvas shows the design on skin, not on white
 const px=await p.evaluate(()=>{const c=document.querySelector('#icCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let white=0,skin=0;for(let i=0;i<d.length;i+=4){if(d[i]>245&&d[i+1]>245&&d[i+2]>245)white++;else if(d[i]>d[i+2]+20)skin++;}return {white,skin,n:d.length/4};});
 assert.ok(px.skin>px.n*0.5&&px.white<px.n*0.01,'on skin: '+JSON.stringify(px));
 await p.screenshot({path:'shots/t77-ink-check.png'});
 await p.click('#icClose');await wait(200);assert.equal(await p.$eval('#inkCheck',e=>e.hidden),true,'Done closes it');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'looking changes nothing');
 // shrink it to an inch: the lines get too fine
 await p.evaluate(id=>{const s=window.__ink.state(),t=s.tattoos.find(t=>t.id===id);t.width=1*2.54/100*175/s.heightCm;window.__ink.commitTest();},sun.id);await wait(300);
 await p.$eval('#bInkCheck',e=>e.click());
 await p.waitForFunction(id=>{const r=window.__ink.inkCheck();return r&&r.id===id&&r.items.length&&!document.querySelector('#icText').textContent.includes('Checking');},{timeout:60000},sun.id);
 r=await p.evaluate(()=>window.__ink.inkCheck());
 assert.ok(r.thinShare>0.02,'at an inch some lines are too fine: '+r.thinShare);
 assert.ok(r.items.some(t=>/under 0\.5 mm/.test(t)),'says so');
 assert.ok(r.wantIn>1,'a size that fixes it: '+r.wantIn);
 assert.equal(await p.$eval('#icResize',e=>e.hidden),false);
 assert.ok(await p.$eval('#icResize',e=>e.getBoundingClientRect().height>=44),'resize button big enough');
 const thin1=r.thinShare,want=r.wantIn;
 await p.click('#icResize');
 await p.waitForFunction(w=>{const r=window.__ink.inkCheck();return r&&!document.querySelector('#icText').textContent.includes('Checking')&&document.querySelector('#icText').textContent.startsWith('Sunburst')&&document.querySelector('#icText').textContent.includes(String(w));},{timeout:60000},want);
 const t1=await p.evaluate(id=>JSON.parse(JSON.stringify(window.__ink.state().tattoos.find(t=>t.id===id))),sun.id),H=JSON.parse(before).heightCm;
 assert.ok(Math.abs(t1.width*100*H/175/2.54-want)<0.01,'made it '+want+' in');
 r=await p.evaluate(()=>window.__ink.inkCheck());assert.ok(r.thinShare<thin1,'fewer fine lines: '+thin1+' to '+r.thinShare);
 // one undo step back to an inch
 await p.evaluate(()=>window.__ink.undo?window.__ink.undo():document.querySelector('#undo').click());await wait(300);
 const t2=await p.evaluate(id=>window.__ink.state().tattoos.find(t=>t.id===id).width,sun.id);
 assert.ok(Math.abs(t2*100*H/175/2.54-1)<0.01,'undo puts it back');
 await p.click('#icClose');
 console.log('PASS t77 ink check: on skin, colours show, fine lines at an inch, the size that fixes them, one undo step, looking changes nothing');
}
