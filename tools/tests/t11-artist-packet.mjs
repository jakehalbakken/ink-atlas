import assert from 'node:assert/strict';
export default async function(p){
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}); const old=URL.createObjectURL;URL.createObjectURL=function(blob){window.packetPromise=blob.text();return old.call(this,blob);};});
 await p.click('#shareBtn');await p.click('#cPacket');
 await new Promise(r=>setTimeout(r,500)); const html=await p.evaluate(()=>window.packetPromise);  
 assert(html && html.includes('<!doctype html>'));
 for(const x of ['Front','Right','Back','Left'])assert(html.includes(x),x+' body view');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'export must not mutate project');
 assert(!html.includes('<script'),'no external/executable script');
 console.log('PASS t11 four-view artist packet export, state preserved');
}
