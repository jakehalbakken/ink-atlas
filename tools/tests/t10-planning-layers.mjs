import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=500)=>new Promise(r=>setTimeout(r,n));
 const open=async id=>{await p.click('#projectsBtn');await p.click(id);await wait();};
 await open('#openPlanning');await p.type('.ink-planning [data-name]','First layout');await p.click('.ink-planning [data-save]');await wait();
 assert.equal(await p.evaluate(()=>window.__ink.state().layouts.length),1);
 await p.click('.ink-planning [data-size-study]');await wait();assert.equal(await p.evaluate(()=>window.__ink.state().layouts.length),4);
 await p.click('[data-tab="checkpoints"]');await p.click('.ink-planning [data-save]');await wait();assert.equal(await p.evaluate(()=>window.__ink.state().checkpoints.length),1);
 await p.click('[data-tab="views"]');await p.click('.ink-planning [data-save]');await wait();assert.equal(await p.evaluate(()=>window.__ink.state().views.length),1);
 await p.screenshot({path:'shots/planning-panel.png'});await p.click('.ink-planning [data-close]');await p.reload({waitUntil:'load'});await wait(1600);
 assert.equal(await p.evaluate(()=>window.__ink.state().layouts.length),4,'layouts survive reload');
 await open('#openLayers');await p.click('#ink-layers [data-act="all"]');await p.type('#il-group-name','Arm ideas');await p.click('#ink-layers [data-act="group"]');await wait();
 assert.equal(await p.evaluate(()=>window.__ink.state().groups.length),1);
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));await p.click('[data-act="solo"]');await wait();assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'solo never changes saved state');
 await p.screenshot({path:'shots/layers-panel.png'});await p.click('[data-act="close"]');await wait();assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before);
 console.log('PASS t10 planning persistence, size studies, checkpoints, views, grouping and nonpersistent solo');
}
