// Open skin (Preview): the body shaded by how big a piece still fits, a summary of how much is
// inked and where the most room is; a tap reads a spot; a tap on a planned tattoo shows in green
// where it fits, and a tap on green moves it there as one undo step; too tight and off-limits
// spots say so; Find room for it in More controls starts from the selected tattoo; Where it
// sits and Time to tattoo read in More controls, with the artist's rate kept on this device;
// the wash follows a pose; Done, the tape measure and selecting put it away.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const sun=all.find(t=>/Sunburst/.test(t.name)),spr=all.find(t=>/Sprig/.test(t.name));
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.click('#lookBtn');await wait(200);
 assert.ok(await p.$eval('#roomBtn',e=>e.getBoundingClientRect().height>=44),'button big enough');
 await p.click('#roomBtn');await wait(900);
 let r=await p.evaluate(()=>window.__ink.room());
 assert.ok(r.on&&r.shown&&!r.fitId,'on and shown');assert.equal(await p.$eval('#lookMenu',e=>e.hidden),true);
 assert.ok(await p.$eval('#roomDone',e=>e.getBoundingClientRect().height>=44),'Done big enough');
 assert.match(r.text,/^(About \d+%|Under 1%|No ink on you yet)[^.]*\.( Your plans cover [^.]+\.)? Most room: [a-z ]+ \(up to \d+(\.\d)? in across\), [a-z ]+ \(\d+(\.\d)? in\), [a-z ]+ \(\d+(\.\d)? in\)\. Tap a planned tattoo to see where it fits\.$/,r.text);
 // the torso has more room across than a forearm, a forearm more than a hand
 const reg=Object.fromEntries((await p.evaluate(()=>window.__ink.room().regions())).map(x=>[x.region,x.across]));
 for(const k of ['Back','Chest','Thighs','Forearms','Upper arms','Lower legs'])assert.ok(reg[k]>0,'has '+k+': '+JSON.stringify(reg));
 assert.ok(reg.Back>reg.Forearms+4&&reg.Forearms>reg.Hands,'torso, forearm, hand: '+JSON.stringify(reg));
 assert.ok(reg.Forearms>3&&reg.Forearms<8&&reg.Back>9&&reg.Back<20,'real sizes: forearm '+reg.Forearms+' back '+reg.Back);
 // samples are planned and small: under 1% of the skin
 const sh=await p.evaluate(()=>window.__ink.room().shares());assert.ok(sh.inkShare===0&&sh.planShare>0&&sh.planShare<0.01,JSON.stringify(sh));
 // a tap on bare skin reads that spot
 const box=await p.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();for(let f=0.35;f<0.9;f+=0.03)for(const dx of [0,-20,20,-40,40,-60,60]){const x=r.left+r.width/2+dx,y=r.top+r.height*f;const u=window.__ink.room().under(x,y);if(u&&!u.off&&!window.__ink.inkIdsAt(x,y).length)return {x,y};}return null;});
 assert.ok(box,'found open skin on screen');
 await p.mouse.click(box.x,box.y);await wait(300);r=await p.evaluate(()=>window.__ink.room());
 assert.match(r.text,/^[A-Z][^:]+: room for a piece about \d+(\.\d)? in across\.$/,r.text);assert.ok(r.on&&!r.fitId,'still on');
 // a tap on the planned Sunburst: where it fits
 const sc=await p.evaluate(id=>{const t=window.__ink.state().tattoos.find(q=>q.id===id);return window.__ink.projectPoint(t.pos);},sun.id);
 await p.mouse.click(sc.x,sc.y);await wait(500);r=await p.evaluate(()=>window.__ink.room());
 assert.equal(r.fitId,sun.id,'picked the tattoo');assert.match(r.text,/^Green is where Sunburst \(sample\) fits with half an inch to spare\./);
 assert.equal(await p.$eval('#roomAll',e=>e.hidden),false);assert.equal(await p.$eval('#roomKeyFit',e=>e.hidden),false);
 const n=await p.evaluate(()=>window.__ink.room().fitsCount());assert.ok(n>1000,'fits in many places: '+n);
 await p.screenshot({path:'shots/t82-room.png'});
 // a green spot on the stomach or thigh: tap it and it moves there, one undo step
 const green=await p.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();for(let f=0.38;f<0.92;f+=0.02)for(const dx of [0,-20,20,-40,40,-60,60]){const x=r.left+r.width/2+dx,y=r.top+r.height*f;const u=window.__ink.room().under(x,y);if(u&&u.fits&&!window.__ink.inkIdsAt(x,y).length)return {x,y,point:u.point,place:u.place};}return null;});
 assert.ok(green,'found a green spot');
 await p.mouse.click(green.x,green.y);await wait(500);
 let moved=await p.evaluate(id=>window.__ink.state().tattoos.find(q=>q.id===id).pos,sun.id);
 assert.ok(Math.hypot(moved[0]-green.point[0],moved[1]-green.point[1],moved[2]-green.point[2])<0.02,'moved to the spot');
 r=await p.evaluate(()=>window.__ink.room());assert.match(r.text,/^Moved Sunburst \(sample\) to the [a-z ,]+\.$/,r.text);assert.ok(r.on&&r.fitId===sun.id,'still finding room');
 await p.click('#undo');await wait(400);
 moved=await p.evaluate(id=>window.__ink.state().tattoos.find(q=>q.id===id).pos,sun.id);assert.deepEqual(moved,sun.pos,'undo puts it back');
 // too tight: the hand
 const tight=await p.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();for(let y=r.top+r.height*0.25;y<r.bottom;y+=4)for(let x=r.left+20;x<r.left+r.width*0.4;x+=4){const u=window.__ink.room().under(x,y);if(u&&!u.off&&u.fits===false&&!window.__ink.inkIdsAt(x,y).length)return {x,y};}return null;});
 assert.ok(tight,'found a tight spot');
 await p.mouse.click(tight.x,tight.y);await wait(300);r=await p.evaluate(()=>window.__ink.room());
 assert.match(r.text,/^Too tight here: room for about \d+(\.\d)? in across, and Sunburst \(sample\) needs about \d+(\.\d)? in\.$/,r.text);
 assert.deepEqual(await p.evaluate(id=>window.__ink.state().tattoos.find(q=>q.id===id).pos,sun.id),sun.pos,'a tight spot moves nothing');
 // All room goes back to the summary
 await p.click('#roomAll');await wait(300);r=await p.evaluate(()=>window.__ink.room());assert.ok(!r.fitId&&/Most room/.test(r.text));
 // follows a pose
 await p.evaluate(()=>window.__ink.setPose('twist'));await p.waitForFunction(()=>window.__ink.pose().settled,{timeout:20000});await wait(500);
 const v=5000,drawn=await p.evaluate(v=>window.__ink.room().drawnAt(v),v),posed=await p.evaluate(v=>Array.from(window.__ink.posedGeometry().attributes.position.array.slice(v*3,v*3+3)),v);
 assert.ok(Math.hypot(drawn[0]-posed[0],drawn[1]-posed[1],drawn[2]-posed[2])<1e-5,'drawn on the posed skin');
 await p.evaluate(()=>window.__ink.setPose('neutral'));await wait(600);
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'looking and undo leave the project as it was');
 // Done puts it away; tape takes over; selecting a tattoo puts it away
 await p.click('#roomDone');await wait(200);r=await p.evaluate(()=>window.__ink.room());assert.ok(!r.on&&!r.shown&&await p.$eval('#roomBar',e=>e.hidden),'Done');
 await p.click('#lookBtn');await p.click('#roomBtn');await wait(300);await p.click('#lookBtn');await p.click('#tapeBtn');await wait(300);
 assert.ok(!(await p.evaluate(()=>window.__ink.room().on))&&await p.evaluate(()=>window.__ink.tape().on),'tape takes over');await p.click('#tapeDone');
 // More controls: Where it sits, Time to tattoo, Find room for it
 await (await p.$$('#trayItems .chip'))[all.findIndex(t=>t.id===sun.id)].click();await wait(600);
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});await wait(500);
 const where=await p.$eval('#whereLine',e=>e.hidden?'':e.textContent),est=await p.$eval('#estLine',e=>e.textContent);
 assert.match(where,/^Chest, left side: centre \d+(\.\d)? in \(\d+ cm\) left of centre, \d+(\.\d)? in \(\d+ cm\) below the base of the neck\.$/,where);
 assert.match(est,/^About (an hour or less|[\d.]+ to [\d.]+ hours), one session\.$/,est);
 assert.ok(await p.$eval('#estRate',e=>e.getBoundingClientRect().height>=44),'rate box big enough');
 await p.type('#estRate','150');await wait(300);
 const priced=await p.$eval('#estLine',e=>e.textContent);assert.match(priced,/ About \$\d+( to \$\d+)? at \$150 an hour\.$/,priced);
 assert.equal(await p.evaluate(()=>localStorage.getItem('ia-rate')),'150','rate kept on this device');
 // the whole plan under it, when there is more than one planned tattoo
 const nPlan=all.filter(t=>t.status!=='existing'&&!t.hidden).length,planLine=await p.evaluate(()=>window.__ink.planLine());
 if(nPlan>1)assert.match(planLine,new RegExp('^All '+nPlan+' planned tattoos: about .* at \\$150 an hour\\.$'),planLine);else assert.equal(planLine,'');
 const sprWhere=await p.evaluate(id=>window.__ink.where(id),spr.id);assert.match(sprWhere.line,/^Ribs, left side: /,sprWhere.line);
 // an arm: put the Sprig on the forearm through Try other spots and read it
 const sprEst=await p.evaluate(id=>window.__ink.estimate(id),spr.id);assert.ok(sprEst.lo>0.4&&sprEst.hi<3,JSON.stringify(sprEst));
 assert.equal(await p.evaluate(()=>{const s=window.__ink.state();return JSON.stringify(s).includes('ia-rate')||'rate' in s;}),false,'the rate is not in the project');
 await p.click('#bRoom');await wait(600);r=await p.evaluate(()=>window.__ink.room());
 assert.ok(r.on&&r.fitId===sun.id&&/Green is where Sunburst/.test(r.text),'Find room for it starts from the selected tattoo');
 assert.equal(await p.evaluate(()=>window.__ink.selected()),null,'the editor gets out of the way');
 await (await p.$$('#trayItems .chip'))[0].click();await wait(400);assert.ok(!(await p.evaluate(()=>window.__ink.room().on)),'selecting puts it away');
 await p.evaluate(()=>localStorage.removeItem('ia-rate'));
 // on a phone the bar sits at the bottom in the tray's place
 await p.setViewport({width:390,height:844,deviceScaleFactor:1});await wait(500);
 await p.click('#lookBtn');await p.click('#roomBtn');await wait(600);
 const ph=await p.evaluate(()=>{const r=document.querySelector('#roomBar').getBoundingClientRect();return{top:r.top,bottom:r.bottom,h:innerHeight,dock:getComputedStyle(document.querySelector('#dock')).display};});
 assert.ok(ph.top>ph.h*0.55&&ph.bottom<=ph.h&&ph.dock==='none','phone: open skin bar at the bottom '+JSON.stringify(ph));
 await p.click('#roomDone');await wait(300);
 assert.notEqual(await p.$eval('#dock',e=>getComputedStyle(e).display),'none','phone: the tray comes back');
 await p.setViewport({width:1180,height:820,deviceScaleFactor:1});await wait(300);
 console.log('PASS t82 open skin: '+reg.Back.toFixed(1)+' in on the back, '+reg.Forearms.toFixed(1)+' on a forearm; tap reads, green fits, tap moves and undo puts back, too tight says so, pose, Done, tape | '+where+' | '+priced+' | '+planLine);
}
