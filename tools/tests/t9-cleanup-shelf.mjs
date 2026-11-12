import assert from 'node:assert/strict';
export default async function(p) {
 const wait=(n=500)=>new Promise(r=>setTimeout(r,n));
 await p.click('#trayItems .chip');await wait();
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.click('#bCleanup');await wait();await p.click('[data-action="paper"]');await p.click('[data-action="cancel"]');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'cancel preserves project');
 await p.click('#bCleanup');await wait();await p.click('[data-action="paper"]');await p.click('[data-action="apply"]');await wait(800);
 const art=await p.evaluate(()=>{const s=window.__ink.state(),t=s.tattoos[0];return {id:t.id,img:t.img,art:s.artworks[t.artworkId]};});
 assert(art.art.source!==art.img,'immutable original retained separately');assert.equal(art.art.output,art.img);
 await p.reload({waitUntil:'load'});await wait(1600);
 assert.equal(await p.evaluate(()=>window.__ink.state().tattoos[0].img),art.img,'cleanup survives reload');
 await p.click('#trayItems .chip');await wait();await p.click('#bCleanup');await wait();
 assert(await p.$('[data-action="reset"]'),'source available after reload');await p.click('[data-action="cancel"]');
 await p.click('#preciseBox summary');await p.click('[data-inch="3"]');await wait();
 assert(Math.abs(await p.evaluate(()=>{const s=window.__ink.state();return s.tattoos[0].width*100*s.heightCm/175/2.54;})-3)<.001);
 await p.click('#bLock');assert(await p.$eval('#bCleanup',b=>b.disabled),'locked art protected');
 await p.click('#full');await p.click('#projectsBtn');await p.click('#openProjects');await wait();
 await p.click('[data-save]');await wait();assert(await p.$('article strong'),'project copy listed');
 await p.click('[data-new]');await wait();assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),0,'new blank project');
 await p.click('#projectsBtn');await p.click('#openProjects');await wait();
 await p.evaluate(()=>{[...document.querySelectorAll('article button')].find(b=>b.textContent==='Open').click();});await wait(1000);
 assert.equal(await p.evaluate(()=>window.__ink.state().tattoos.length),2,'shelf restores artwork');
 console.log('PASS t9 cleanup, immutable original, reload, precise width, locking and project shelf');
}
