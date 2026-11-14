// Ask for approval (Share): the page it makes holds each planned tattoo with pictures, opens on
// its own with nothing loaded from anywhere, and its Send my answers text comes back through
// Bring in answers: each tattoo shows who said yes or what to change, in the tray and the edit
// panel. One undo step, the record of the page survives undo, a reply that is not answers
// changes nothing, and the answers are still there after reopening. Saves shots/t78-page.png.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.name)window.saved[blob.name]=blob.text();return old.call(this,blob);};});
 // both samples planned
 await p.evaluate(()=>{for(const t of window.__ink.state().tattoos){t.status='planned';t.hidden=false;}window.__ink.commitTest();});await wait(300);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 await p.click('#shareBtn');await wait(300);
 for(const id of ['#cApprove','#cAnswers'])assert.ok(await p.$eval(id,e=>e.getBoundingClientRect().height>=44),id+' big enough');
 const goal0=await p.evaluate(()=>JSON.stringify(window.__ink.goal));
 await p.click('#cApprove');
 await p.waitForFunction(()=>Object.keys(window.saved).some(k=>/-approval\.html$/.test(k)),{timeout:60000});
 const html=await p.evaluate(async()=>{const k=Object.keys(window.saved).find(k=>/-approval\.html$/.test(k));return await window.saved[k];});
 const ap=await p.evaluate(()=>({ref:window.__ink.approval().ref,ids:window.__ink.approval().ids,asks:JSON.parse(JSON.stringify(window.__ink.state().asks))}));
 assert.deepEqual(ap.ids,all.map(t=>t.id),'every planned tattoo, in tray order');
 assert.equal(ap.asks[ap.asks.length-1].ref,ap.ref,'the page is recorded with the project');
 assert.equal((html.match(/<section class="card"/g)||[]).length,all.length);
 assert.ok((html.match(/data:image\/jpeg;base64,/g)||[]).length>=all.length*2,'a close-up and the artwork for each');
 assert.ok(html.length<3e6,'small enough to send: '+html.length);
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.goal)),goal0,'the view is left as it was');
 // the page on its own, as the client sees it
 const q=await p.browser().newPage();await q.setViewport({width:390,height:844,deviceScaleFactor:2});
 const asked=[];q.on('request',r=>{if(!r.url().startsWith('data:')&&r.url()!=='about:blank')asked.push(r.url());});
 await q.setContent(html,{waitUntil:'load'});
 await q.evaluate(()=>{window.__sent=null;navigator.share=(d)=>{window.__sent=d.text;return Promise.resolve();};});
 await q.click('input[name="v1"][value="yes"] + span');
 await q.click('input[name="v2"][value="change"] + span');
 await q.type('textarea[name="t2"]','a little smaller please');
 await q.type('#by','Sam');await q.type('#also','Love the layout');
 for(const s of ['#send','.choice span']){const h=await q.$eval(s,e=>e.getBoundingClientRect().height);assert.ok(h>=44,s+' big enough on a phone');}
 await q.screenshot({path:'shots/t78-page.png',fullPage:true});
 await q.click('#send');await new Promise(r=>setTimeout(r,200));
 const reply=await q.evaluate(()=>window.__sent);await q.close();
 assert.equal(asked.length,0,'the page loads nothing from anywhere: '+asked.join(' '));
 assert.ok(reply&&reply.includes('ref '+ap.ref),'answers text: '+reply);
 // a reply that is not answers changes nothing
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state().tattoos));
 await p.click('#shareBtn');await wait(200);await p.click('#cAnswers');await wait(200);
 assert.equal(await p.$eval('#answers',e=>e.hidden),false);
 for(const id of ['#ansPaste','#ansRead'])assert.ok(await p.$eval(id,e=>e.getBoundingClientRect().height>=44),id+' big enough');
 await p.type('#ansText','See you Thursday!');await p.click('#ansRead');await wait(200);
 assert.match(await p.$eval('#ansNote',e=>e.textContent),/No answers found/);
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state().tattoos)),before,'nothing changed');
 // the real reply
 await p.$eval('#ansText',e=>{e.value='';});await p.type('#ansText',reply);await p.click('#ansRead');await wait(400);
 assert.equal(await p.$eval('#answers',e=>e.hidden),true,'closes once read');
 let st=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 const r1=st.tattoos.find(t=>t.id===ap.ids[0]).review,r2=st.tattoos.find(t=>t.id===ap.ids[1]).review;
 assert.equal(r1.verdict,'approved');assert.equal(r1.by,'Sam');assert.match(r1.at,/^\d{4}-\d\d-\d\d$/);
 assert.equal(r2.verdict,'changes');assert.equal(r2.note,'a little smaller please');
 assert.equal(st.asks.find(a=>a.ref===ap.ref).reply.note,'Love the layout');
 assert.match(await p.$eval('#toast',e=>e.textContent),/Sam said yes to 1 and asked for changes to 1/);
 const chips=await p.$$eval('#trayItems .chip',l=>l.map(e=>e.textContent));
 assert.ok(chips.some(c=>/Approved/.test(c))&&chips.some(c=>/Change asked/.test(c)),'tray shows the answers: '+chips);
 await (await p.$$('#trayItems .chip'))[all.findIndex(t=>t.id===ap.ids[1])].click();await wait(300);
 assert.match(await p.$eval('#review',e=>e.hidden?'':e.textContent),/^Sam asked for a change on .*: "a little smaller please"$/);
 // one undo step takes the answers off; the page record stays
 await p.evaluate(()=>document.querySelector('#undo').click());await wait(300);
 st=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 assert.ok(st.tattoos.every(t=>!t.review),'undo takes them off');assert.ok(st.asks.some(a=>a.ref===ap.ref),'the page record survives undo');
 await p.evaluate(()=>document.querySelector('#redo').click());await wait(300);
 // still there after reopening
 await p.waitForFunction(()=>document.querySelector('#saved').textContent==='Saved on this device',{timeout:30000});await p.reload();await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 st=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 assert.equal(st.tattoos.find(t=>t.id===ap.ids[1]).review.note,'a little smaller please','answers kept');
 assert.ok(st.asks.some(a=>a.ref===ap.ref),'page record kept');
 // a quick typed reply works too
 assert.ok(await p.evaluate(()=>window.__ink.bringInAnswers('1 change: darker\n2 yes')));
 st=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state())));
 assert.equal(st.tattoos.find(t=>t.id===ap.ids[0]).review.verdict,'changes');assert.equal(st.tattoos.find(t=>t.id===ap.ids[1]).review.verdict,'approved');
 console.log('PASS t78 approval: page with pictures, nothing loaded, its answers come back, tray and panel show them, undo, kept on reopen, typed replies');
}
