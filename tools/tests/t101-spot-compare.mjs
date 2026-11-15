// Compare spots: Try other spots says, under each spot, how much it usually hurts and the
// lightest everyday clothes that hide a piece this size there.
import assert from 'node:assert/strict';
import { SPOTS } from '../../src/spots.js';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 await (await p.$$('#trayItems .chip'))[1].click();await wait(300);
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 await p.$eval('#bSpots',e=>e.click());await wait(400);
 const notes=await p.evaluate(()=>window.__ink.spotNotes());
 assert.ok(notes,'notes worked out');
 for(const s of SPOTS)assert.ok(notes[s.id]&&/pain/.test(notes[s.id]),`${s.id} has a note: ${notes[s.id]}`);
 const shown=await p.$$eval('#spotChoices .spotsub',a=>a.filter(e=>!e.hidden&&e.textContent).length);assert.equal(shown,SPOTS.length,'each spot shows its note');
 assert.ok((await p.$$eval('#spotChoices .btn',a=>a.map(b=>b.getBoundingClientRect().height))).every(h=>h>=44),'buttons big enough');
 // sensible: the outer upper arm hurts less than the ribs; a T-shirt hides the chest and upper
 // back, long pants hide the calf, the wrist always shows or only long sleeves hide it
 const lvl=(n)=>['Low','Some','High','Very high'].findIndex(w=>n.startsWith(w+' pain'));
 assert.ok(lvl(notes['upperarm-out'])<lvl(notes.ribs),`upper arm ${notes['upperarm-out']} vs ribs ${notes.ribs}`);
 assert.ok(/T-shirt|tank top/.test(notes.chest),`chest: ${notes.chest}`);
 assert.ok(/T-shirt|tank top/.test(notes['upper-back']),`upper back: ${notes['upper-back']}`);
 assert.ok(/long pants/.test(notes.calf),`calf: ${notes.calf}`);
 assert.ok(/always shows|long sleeves/.test(notes.wrist),`wrist: ${notes.wrist}`);
 // the other side gives notes too
 await p.$eval('#spotSide [data-side="R"]',e=>e.click());await wait(300);
 const r=await p.evaluate(()=>window.__ink.spotNotes());assert.ok(r&&/pain/.test(r.calf),'right side notes');
 await p.$eval('#spotSide [data-side="L"]',e=>e.click());await wait(300);
 // tapping a spot ticks Compare spots in New to try
 await p.$eval('#spotChoices [data-spot="calf"]',e=>e.click());await wait(300);
 assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('ia-tried')||'[]').includes('spotCompare')),'ticked when used');
 await p.screenshot({path:'shots/t101-spots.png'});
 console.log(JSON.stringify(notes));
}
