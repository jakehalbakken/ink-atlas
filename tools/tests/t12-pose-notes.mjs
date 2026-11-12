import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 const open=async id=>{await p.click('#projectsBtn');await p.click(id);await wait(1000);};
 await open('#openNotes');await p.type('#ibn-text','Keep generous space around the elbow.');await p.click('[data-act=save]');await wait();
 assert.equal(await p.evaluate(()=>window.__ink.state().notes[0].text),'Keep generous space around the elbow.');
 await p.click('#ink-body-notes [data-act=close]');await p.reload({waitUntil:'load'});await wait(1500);
 assert.equal(await p.evaluate(()=>window.__ink.state().notes.length),1,'notes survive reload');
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await open('#openPose');await p.waitForSelector('.pose-preview');
 for(const pose of ['elbow','raised','twist','neutral']){
  await p.click(`[data-pose=${pose}]`);await wait();
  const x=await p.evaluate(()=>document.querySelector('.pose-preview').__poseTest());
  assert(x.decals>0);assert(x.maxSupportError<1e-6);assert(x.uvUnchanged);assert(x.inputsUnchanged);if(pose==='neutral')assert(x.neutralExact);
  await p.screenshot({path:`shots/pose-${pose}.png`});
 }
 await p.click('.pose-preview [data-close]');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'pose leaves saved plan unchanged');
 console.log('PASS t12 notes persisted, four pose previews fixed-UV supports, immutable input and state');
}
