// Cover-up check: with one sample marked already on me and the other planned over it, the line
// under the planned one's size says how much of the old ink it covers; bigger covers more,
// moved away it goes back to the space between them, and the old one itself never says it.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const sun=all.find(t=>/Sunburst/.test(t.name)),spr=all.find(t=>/Sprig/.test(t.name));
 const gapOf=async(id)=>{await (await p.$$('#ldList .ld-tat'))[all.findIndex(t=>t.id===id)].click();await wait(700);return p.$eval('#gap',e=>e.hidden?'':e.textContent);};
 // old Sprig, new Sunburst laid over it at a few sizes
 const lay=(w)=>p.evaluate(([s,o,w])=>{const st=window.__ink.state(),a=st.tattoos.find(t=>t.id===s),b=st.tattoos.find(t=>t.id===o);b.status='existing';a.status='planned';a.pos=b.pos.slice();a.normal=b.normal.slice();a.width=b.width*w;window.__ink.commitTest();},[sun.id,spr.id,w]);
 await lay(3);await wait(600);
 const big=await gapOf(sun.id);assert.match(big,/^Covers (all|\d+%) of Sprig \(sample\)’s ink$/,'says it covers: '+big);
 const cBig=await p.evaluate(()=>window.__ink.cover());
 await lay(1.2);await wait(600);
 const small=await gapOf(sun.id);const cSmall=await p.evaluate(()=>window.__ink.cover());
 assert.ok(cSmall&&cBig&&cBig.share>cSmall.share,'bigger covers more: '+cSmall.share+' to '+cBig.share);
 assert.match(small,/^Covers \d+% of Sprig/,small);
 await p.screenshot({path:'shots/t80-cover.png'});
 // the old one never says it covers
 const old=await gapOf(spr.id);assert.ok(!/Covers/.test(old),'the old one: '+old);
 // moved away: back to the space between them
 await p.evaluate(([s,o])=>{const st=window.__ink.state(),a=st.tattoos.find(t=>t.id===s);Object.assign(a,o);window.__ink.commitTest();},[sun.id,{pos:sun.pos,normal:sun.normal,width:sun.width}]);await wait(600);
 const apart=await gapOf(sun.id);assert.match(apart,/in from Sprig/,'apart: '+apart);
 console.log('PASS t80 cover-up check: '+big+' | '+small+' | bigger covers more | '+apart);
}
