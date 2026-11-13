// Copy to other side: a mirrored copy of the same artwork lands at the matching spot on the
// other side of the body, sharing the artwork, named left and right, one undo. A tattoo in the
// middle says so. Real size on screen: the artwork shows at its true size from the screen's
// pixels per inch, on the skin colour; a bank-card check adjusts and keeps the scale.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const sprig=all.find(t=>/Sprig/.test(t.name));
 await p.evaluate(id=>{const t=window.__ink.state().tattoos.find(t=>t.id===id);t.rot=0.5;t.flip=false;window.__ink.commitTest();},sprig.id);
 const chip=(await p.$$('#trayItems .chip'))[all.indexOf(sprig)];await chip.click();await wait(300);
 assert.equal(await p.evaluate(()=>window.__ink.selected()),sprig.id);
 const src=await p.evaluate(id=>window.__ink.state().tattoos.find(t=>t.id===id),sprig.id);
 const n0=all.length;
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 const b=await p.$eval('#bOtherSide',e=>{const r=e.getBoundingClientRect();return [r.width,r.height];});assert.ok(b[1]>=44,'button big enough');
 const middle=Math.abs(src.pos[0])<Math.max(.02,src.width*.3);
 await p.$eval('#bOtherSide',e=>e.click());await wait(400);
 let st=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 if(middle){
  assert.equal(st.tattoos.length,n0,'middle: nothing added');assert.match(await p.$eval('#toast',e=>e.textContent),/middle/);
  await p.evaluate(id=>{const t=window.__ink.state().tattoos.find(t=>t.id===id);const h=window.__ink.surfaceHit([.09,1.3,.5],[0,0,-1]);t.pos=h.pos;t.normal=h.normal;window.__ink.commitTest();},sprig.id);await wait(300);
  await p.$eval('#bOtherSide',e=>e.click());await wait(400);st=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 }
 assert.equal(st.tattoos.length,n0+1,'one copy added');
 const a=st.tattoos.find(t=>t.id===sprig.id),c=st.tattoos[st.tattoos.length-1];
 assert.ok(Math.abs(c.pos[0]+a.pos[0])<.01&&Math.abs(c.pos[1]-a.pos[1])<.01&&Math.abs(c.pos[2]-a.pos[2])<.01,`mirrored spot ${a.pos} / ${c.pos}`);
 assert.ok(Math.sign(c.normal[0])!==Math.sign(a.normal[0])||Math.abs(a.normal[0])<.05,'faces the other way');
 assert.equal(c.flip,!a.flip,'artwork mirrored');assert.ok(Math.abs(c.rot+a.rot)<1e-9,'turn mirrored');
 assert.equal(c.img,a.img);assert.equal(c.artworkId,a.artworkId,'shares the artwork');assert.equal(c.width,a.width);
 assert.match(a.name,/\((left|right)\)$/);assert.match(c.name,/\((left|right)\)$/);assert.notEqual(a.name.slice(-6),c.name.slice(-6),'one left, one right');
 assert.equal(await p.evaluate(()=>window.__ink.selected()),c.id,'the copy is selected');
 await p.click('#undo');await wait(300);
 assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),n0,'one undo removes it');
 await p.click('#redo');await wait(300);
 if(!await p.evaluate(()=>window.__ink.selected())){const chips=await p.$$('#trayItems .chip');await chips[chips.length-1].click();await wait(300);}
 // real size on screen: guessed 96 ppi on a desktop browser
 await p.evaluate(()=>{try{localStorage.setItem('ia-screen-ppi','');}catch(_){} document.querySelector('#editorAdvanced').open=true;});
 await p.$eval('#bRealSize',e=>e.click());await wait(300);
 assert.equal(await p.$eval('#realSize',e=>e.hidden),false,'opens');
 const t=await p.evaluate(()=>{const s=window.__ink.state();return s.tattoos.find(t=>t.id===window.__ink.selected());});
 const hcm=await p.evaluate(()=>window.__ink.state().heightCm);
 const wIn=t.width*hcm/175*100/2.54;
 let box=await p.$eval('#rsArt',e=>e.getBoundingClientRect().width);
 assert.ok(Math.abs(box-wIn*96)<1,`real size at 96 ppi: ${box} vs ${wIn*96}`);
 assert.match(await p.$eval('#rsText',e=>e.textContent),/in .*cm/);
 const bg=await p.$eval('#realSize',e=>getComputedStyle(e).backgroundColor);assert.notEqual(bg,'rgba(0, 0, 0, 0)','skin coloured');
 await p.$eval('#rsCheck',e=>e.click());const card=await p.$eval('#rsCard',e=>e.getBoundingClientRect().width);assert.ok(Math.abs(card-3.37*96)<1,'card outline at scale');
 for(let i=0;i<5;i++)await p.$eval('#rsBigger',e=>e.click());
 await p.$eval('#rsCalDone',e=>e.click());const kept=await p.evaluate(()=>+localStorage.getItem('ia-screen-ppi'));
 assert.ok(Math.abs(kept-96*1.01**5)<.2,'scale kept: '+kept);
 box=await p.$eval('#rsArt',e=>e.getBoundingClientRect().width);assert.ok(Math.abs(box-wIn*kept)<1.5,'art follows the new scale');
 await p.$eval('#rsClose',e=>e.click());assert.equal(await p.$eval('#realSize',e=>e.hidden),true,'Done closes');
 await p.$eval('#bRealSize',e=>e.click());await wait(200);box=await p.$eval('#rsArt',e=>e.getBoundingClientRect().width);assert.ok(Math.abs(box-wIn*kept)<1.5,'scale remembered');
 await p.$eval('#rsClose',e=>e.click());
 console.log(`PASS t51 other side and real size: mirrored linked copy (${c.name}), one undo; ${wIn.toFixed(2)} in at ${kept.toFixed(1)} ppi after card check`);
}
