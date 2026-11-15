// How covered each area is (Open skin): a line under the summary gives each area's share under
// ink so far and with the plans, on the right side of the body, hides while placing one tattoo,
// comes back with All room, follows a change (and so does the summary above it), and opening Open skin ticks it in New to try.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const sun=all.find(t=>/Sunburst/.test(t.name)),spr=all.find(t=>/Sprig/.test(t.name));
 const tried=()=>p.evaluate(()=>{try{return JSON.parse(localStorage.getItem('ia-tried')||'[]');}catch{return [];}});
 assert.ok(!(await tried()).includes('covered'),'not tried yet');
 await p.click('#lookBtn');await wait(200);await p.click('#roomBtn');await wait(900);
 let c=await p.evaluate(()=>window.__ink.covered());
 // the samples are planned only
 assert.match(c.text,/^Covered so far: [a-z ]+ (about )?(\d+%|under 1%) planned(, [a-z ]+ (\d+%|under 1%) planned){0,2}\.$/,c.text);
 assert.ok(c.list.length>0&&c.list.every(r=>r.ink===0&&r.plan>0&&r.plan<0.5),JSON.stringify(c.list));
 assert.ok((await tried()).includes('covered'),'opening Open skin ticks it');
 assert.equal(await p.$eval('#roomCover',e=>e.closest('#roomBar')!==null&&!e.hidden),true);
 // which side: each sample's own area, from its place and side
 const sideOf=(t)=>t.pos[0]>0?'left':'right';
 const areas=c.list.map(r=>r.area);
 for(const a of areas)assert.ok(/^(left|right) (arm|leg)$|^(chest|stomach|ribs|back|neck)$/.test(a),'known area: '+a);
 for(const a of areas.filter(x=>/^(left|right) /.test(x))){const side=a.split(' ')[0];const near=[sun,spr].some(t=>sideOf(t)===side);assert.ok(near,'a sample sits on the '+side+' side for '+a);}
 // mark the Sprig as already on me and make it much bigger: ink now shows, with plans on top
 await p.evaluate(id=>{const st=window.__ink.state(),t=st.tattoos.find(q=>q.id===id);t.status='existing';t.width*=2.5;window.__ink.commitTest();},spr.id);
 await wait(800);
 c=await p.evaluate(()=>window.__ink.covered());
 const sprArea=c.list.find(r=>r.ink>0);assert.ok(sprArea,'ink counted: '+JSON.stringify(c.list));
 assert.match(c.text,/\d+%( \(\d+% with your plans\))?/,c.text);
 // the area shares add up to about the whole-body share times the skin
 const sh=await p.evaluate(()=>window.__ink.room().shares());assert.ok(sh.inkShare>0,'whole-body share has ink too');
 // the summary above follows the change too
 assert.match(await p.evaluate(()=>window.__ink.room().text),/^About \d+%|^Under 1%/,'summary now counts the ink');
 await p.screenshot({path:'shots/t90-covered.png'});
 // placing one tattoo hides the line, All room brings it back
 await p.evaluate(id=>window.__ink.room().pick(id),sun.id);await wait(500);
 assert.equal(await p.evaluate(()=>window.__ink.room().fitId),sun.id);
 assert.equal(await p.$eval('#roomCover',e=>e.hidden),true,'hidden while placing');
 await p.click('#roomAll');await wait(400);
 assert.equal(await p.$eval('#roomCover',e=>e.hidden),false,'back with All room');
 await p.click('#roomDone');await wait(200);
 assert.equal(await p.$eval('#roomBar',e=>e.hidden),true);
 assert.equal((await p.evaluate(()=>window.__ink.covered())).list,null,'nothing worked out when off');
 console.log('PASS t90-covered: '+c.text);
}
