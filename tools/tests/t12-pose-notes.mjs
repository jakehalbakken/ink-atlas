import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 const open=async id=>{await p.click('#projectsBtn');await p.click(id);await wait(1000);};
 await open('#openNotes');await p.type('#ibn-text','Keep generous space around the elbow.');await p.click('[data-act=save]');await wait();
 assert.equal(await p.evaluate(()=>window.__ink.state().notes[0].text),'Keep generous space around the elbow.');
 await p.click('#ink-body-notes [data-act=close]');await p.reload({waitUntil:'load'});await wait(1500);
 assert.equal(await p.evaluate(()=>window.__ink.state().notes.length),1,'notes survive reload');
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await open('#openPose');await p.waitForSelector('#posePop:not([hidden])');
 for(const pose of ['elbow','raised','twist','neutral']){
  await p.click(`#poseList [data-pose=${pose}]`);await wait(600);
  const x=await p.evaluate(()=>window.__ink.pose());assert.equal(x.key,pose);assert.equal(x.active,pose!=='neutral');
  assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'pose leaves saved plan unchanged');
  await p.screenshot({path:`shots/pose-${pose}.png`});
 }
 await p.click('#posePop [data-close=posePop]');
 console.log('PASS t12 notes persisted, four poses in the main view, saved plan unchanged');
}
