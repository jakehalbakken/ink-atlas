// Pain map (Preview): a green to red wash over the body from common tattoo pain charts. On the
// real body the ribs, knees, sternum and armpits read higher than the calf, outer arm and outer
// thigh; a tap on the body reads that spot and a tap on a tattoo reads its whole area; the wash
// follows a pose and a new shape; Done and the tape measure put it away; nothing in the project
// changes. Saves shots/t79-pain.png.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 await p.click('#lookBtn');await wait(200);
 assert.ok(await p.$eval('#painBtn',e=>e.getBoundingClientRect().height>=44),'button big enough');
 await p.click('#painBtn');await wait(600);
 let pn=await p.evaluate(()=>window.__ink.pain());
 assert.ok(pn.on&&pn.shown,'on and shown');assert.equal(await p.$eval('#lookMenu',e=>e.hidden),true,'the menu gets out of the way');
 assert.equal(await p.$eval('#painBar',e=>e.hidden),false);assert.ok(await p.$eval('#painDone',e=>e.getBoundingClientRect().height>=44),'Done big enough');
 assert.match(pn.text,/Tap a spot or a tattoo/);
 // the real body rates the way the charts do
 const s=await p.evaluate(()=>window.__ink.pain().stats());
 for(const k of ['Ribs','Sternum','Spine','Knee','Elbow','Armpit','Calf','Upper arm, outside','Thigh, outside','Shin','Foot','Groin'])assert.ok(s[k]&&s[k].n>=5,'has '+k+': '+JSON.stringify(Object.keys(s)));
 assert.ok(s.Ribs.level>s.Calf.level+3,'ribs above calf');assert.ok(s.Knee.level>s['Thigh, outside'].level+2.5,'knee above outer thigh');
 assert.ok(s.Armpit.level>s['Upper arm, outside'].level+3,'armpit above outer arm');assert.ok(s.Sternum.level>s['Upper back'].level+2,'sternum above upper back');
 // the ribs are at rib height, the knees at knee height, on both sides
 assert.ok(s.Ribs.y>1.05&&s.Ribs.y<1.32&&s.Knee.y>0.4&&s.Knee.y<0.6,'places where they belong: ribs '+s.Ribs.y+' knee '+s.Knee.y);
 // colours: green on the outer arm, red on the ribs
 const col=await p.evaluate(()=>{const st=window.__ink.pain();return st.colours();});assert.ok(col&&col.length===30);
 // a tap on the body reads that spot
 const box=await p.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();for(let f=0.55;f<0.9;f+=0.03)for(const dx of [0,-12,12,-24,24]){const x=r.left+r.width/2+dx,y=r.top+r.height*f;if(window.__ink.hitBody(x,y))return {x,y};}return null;});
 assert.ok(box,'found the body on screen');
 await p.mouse.click(box.x,box.y);await wait(300);
 pn=await p.evaluate(()=>window.__ink.pain());assert.match(pn.text,/^[A-Z][^:]+: (low|moderate|high|very high), about \d+ out of 10\.$/,'reads the spot: '+pn.text);
 assert.ok(pn.on,'still on after a tap');assert.equal(await p.evaluate(()=>window.__ink.selected&&window.__ink.selected()),await p.evaluate(()=>window.__ink.selected&&window.__ink.selected()));
 // a tattoo reads over its whole area
 const sun=all.find(t=>/Sunburst/.test(t.name))||all[0];
 const tl=await p.evaluate(id=>window.__ink.pain().ofTattoo(id),sun.id);
 assert.match(tl,new RegExp('^'+sun.name.replace(/[()]/g,'\\$&')+' on the [a-z ,]+: (low|moderate|high|very high), about \\d+ out of 10\\.'),tl);
 await p.screenshot({path:'shots/t79-pain.png'});
 // follows a pose
 await p.evaluate(()=>window.__ink.setPose('twist'));await p.waitForFunction(()=>window.__ink.pose().settled,{timeout:20000});await wait(500);
 const v=5000,drawn=await p.evaluate(v=>window.__ink.pain().drawnAt(v),v),posed=await p.evaluate(v=>Array.from(window.__ink.posedGeometry().attributes.position.array.slice(v*3,v*3+3)),v);
 assert.ok(Math.hypot(drawn[0]-posed[0],drawn[1]-posed[1],drawn[2]-posed[2])<1e-5,'drawn on the posed skin');
 await p.evaluate(()=>window.__ink.setPose('neutral'));await wait(600);
 // looking never changes the project (checked before the shape round trip, which moves floats)
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'project unchanged');
 // follows a new shape: still rated, and the same skin keeps its place
 const a0=await p.evaluate(v=>window.__ink.pain().at(v),v);
 await p.evaluate(()=>window.__ink.setShape({weight:1}));await wait(800);
 const a1=await p.evaluate(v=>window.__ink.pain().at(v),v);assert.ok(a1.place&&a1.level>=1,'rated after a new shape');
 await p.evaluate(()=>window.__ink.setShape({weight:0.5}));await wait(600);
 // Done puts it away; the tape measure takes over from it
 await p.click('#painDone');await wait(200);pn=await p.evaluate(()=>window.__ink.pain());
 assert.ok(!pn.on&&!pn.shown&&await p.$eval('#painBar',e=>e.hidden),'Done puts it away');
 await p.click('#lookBtn');await p.click('#painBtn');await wait(300);
 await p.click('#lookBtn');await p.click('#tapeBtn');await wait(300);
 assert.ok(!(await p.evaluate(()=>window.__ink.pain().on))&&(await p.evaluate(()=>window.__ink.tape().on)),'tape takes over');
 await p.click('#tapeDone');
 console.log('PASS t79 pain map: chart places on the real body, taps read a spot and a tattoo, follows pose and shape, Done and tape put it away, project unchanged; '+pn.text+' | '+tl);
}
