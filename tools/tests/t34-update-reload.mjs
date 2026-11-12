// A new service-worker version must never reload the app under Jake's hands or before
// the save has been written. Before any touch it reloads at once; after a touch it
// offers Reload and otherwise waits until the app leaves the screen.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=400)=>new Promise(r=>setTimeout(r,n));
 // 1. Untouched fresh launch: reloads straight away.
 await p.reload({waitUntil:'load'});await p.waitForFunction(()=>window.__ink?.ready(),{timeout:15000});
 await p.evaluate(()=>{window.__marker=1;});
 await Promise.all([p.waitForNavigation({waitUntil:'load',timeout:15000}),p.evaluate(()=>window.__ink.updateReady())]);
 await p.waitForFunction(()=>window.__ink?.ready(),{timeout:15000});assert.equal(await p.evaluate(()=>window.__marker),undefined,'untouched app reloads for the update');
 // 2. After a touch and a fresh edit: no reload, a Reload offer instead.
 await p.evaluate(()=>{window.__marker=2;window.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch'}));const s=window.__ink.state();s.tattoos[0].name='Edited just before the update';window.__ink.commitTest();window.__ink.updateReady();});
 await wait(1200);
 assert.equal(await p.evaluate(()=>window.__marker),2,'touched app is not reloaded under the user');
 assert.ok(await p.$eval('#toast',t=>!t.hidden&&/new version/i.test(t.textContent)&&!!t.querySelector('button')),'Reload offer shown');
 // 3. Leaving the screen applies it, after the save is on disk.
 await p.evaluate(()=>{const s=window.__ink.state();s.tattoos[0].name='Edited a moment before leaving';window.__ink.commitTest();});
 await Promise.all([p.waitForNavigation({waitUntil:'load',timeout:15000}),p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));})]);
 await p.waitForFunction(()=>window.__ink?.ready(),{timeout:15000});
 assert.equal(await p.evaluate(()=>window.__marker),undefined,'hidden app reloads for the update');
 assert.equal(await p.evaluate(()=>window.__ink.state().tattoos[0].name),'Edited a moment before leaving','pending edit was saved before the reload');
 console.log('PASS t34 update reload: immediate when untouched, offered after touch, applied on leaving the screen with the save flushed first');
}
