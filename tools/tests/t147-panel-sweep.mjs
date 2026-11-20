// Sweep of 30 panels and tools at both iPad orientations (2026-11-20 QA): every control that shows is on the
// screen, not covered by something else at its middle, at least 44 pt (checkboxes, ranges and file pickers
// aside), and no text box, list or field is under 16px, because the iPad zooms the whole page in on those.
import assert from 'node:assert/strict';
export default async function(p){
 const wait=(n=500)=>new Promise(r=>setTimeout(r,n));
 const sizes=[[820,1180],[1180,820]];let bad=[],checked=0,controls=0;
 const flows=[['Spots',['@sel','#bSpots']],['InkCheck',['@sel','#bInkCheck']],['Stencil',['@sel','#bStencil']],['Look',['@sel','#bLook']],['TryOn',['@sel','#bTryOn']],['Body',['#bodyBtn']],['Share',['#shareBtn']],['Plan',['#projectsBtn']],['New',['#newBtn']],['Wrap',['#projectsBtn','#openWrap']],['Library',['#projectsBtn','#openArtworkLibrary']],['BodyTools',['#projectsBtn','#openBodyTools']],['PhotoFit',['#projectsBtn','#openPhotoFit']],['Cleanup',['@sel','#bCleanup']],['FindSaves',['#shareBtn','#cRecover']],['Layers',['#projectsBtn','#openLayers']],['Planning',['#projectsBtn','#openPlanning']],['Projects',['#projectsBtn','#openProjects']],['Notes',['#projectsBtn','#openNotes']],['Refs',['#projectsBtn','#openRefs']],['Placement',['#projectsBtn','#openPlacement']],['Pose',['#lookBtn','#poseBtn']],['Clothes',['#lookBtn','#clothesBtn']],['Age',['#lookBtn','#ageBtn']],['Light',['#lookBtn','#lightBtn']],['MeasureMe',['#bodyBtn','#measureMeBtn']],['Sketch',['#shareBtn','#cSizes']]];
 for(const [w,h] of sizes){
  await p.setViewport({width:w,height:h,hasTouch:true});await wait(1000);
  for(const [name,seq] of flows){
   await p.reload({waitUntil:'load'});await p.waitForFunction(()=>window.__ink&&window.__ink.ready(),{timeout:30000});await wait(1200);
   let ok=true;
   for(const s of seq){try{if(s==='@sel'){await p.click('#ldList .ld-tat');await wait(400);await p.evaluate(()=>{const d=document.querySelector('#editorAdvanced');if(d)d.open=true;});}else{await p.evaluate(s=>{const e=document.querySelector(s);const d=e&&e.closest('details');if(d)d.open=true;e&&e.scrollIntoView({block:'center'});},s);await wait(150);await p.click(s);}await wait(900);}catch(e){throw new Error('could not open '+name+' with '+s+' at '+w+'x'+h+': '+e.message.slice(0,80));}}
   if(!ok)continue;
   await wait(1200);
   const r=await p.evaluate(()=>{
    const cands=[...document.querySelectorAll('[aria-modal=true],[role=dialog],.pop,.modal,#lookMenu,#planMenu,#newPop,.cleanup,section')].filter(m=>!m.hidden&&m.offsetParent!==null||getComputedStyle(m).position==='fixed'&&!m.hidden).filter(m=>{const b=m.getBoundingClientRect();return b.height>60&&b.width>100&&getComputedStyle(m).visibility!=='hidden'&&getComputedStyle(m).display!=='none';});
    const z=m=>{let v=0,e=m;while(e&&e!==document.body){const zz=parseInt(getComputedStyle(e).zIndex);if(!isNaN(zz))v=Math.max(v,zz);e=e.parentElement;}return v;};
    cands.sort((a,b)=>z(b)-z(a)||(a.compareDocumentPosition(b)&4?1:-1));const root=cands[0];if(!root)return {none:true};
    const out={root:(root.id||root.className||'').toString().slice(0,30),covered:[],small:[],off:[],tiny:[]};
    const els=[...root.querySelectorAll('button,summary,input,select,ink-slider,a[href],textarea')].filter(e=>e.offsetParent&&getComputedStyle(e).visibility!=='hidden'&&e.checkVisibility()&&!(()=>{let d=e.parentElement;while(d){if(d.tagName==='DETAILS'&&!d.open&&!(e.tagName==='SUMMARY'&&e.parentElement===d))return true;d=d.parentElement;}return false;})());
    const W=innerWidth,H=innerHeight;
    for(const e of els){e.scrollIntoView({block:'center',inline:'nearest'});const b=e.getBoundingClientRect();if(b.width<1||b.height<1)continue;
     const lab=(e.id||'')+':'+(e.getAttribute('aria-label')||e.textContent||e.value||e.placeholder||'').trim().slice(0,22);
     if(b.left<-1||b.right>W+1)out.off.push(lab+' '+Math.round(b.left)+'-'+Math.round(b.right));
     const isBox=e.type==='checkbox'||e.type==='radio'||e.type==='range'||e.type==='file'||e.type==='color';
     if(!isBox&&(b.height<43.5||b.width<43.5))out.small.push(lab+' '+Math.round(b.width)+'x'+Math.round(b.height));
     if((e.tagName==='INPUT'&&!isBox||e.tagName==='TEXTAREA'||e.tagName==='SELECT')&&parseFloat(getComputedStyle(e).fontSize)<16)out.tiny.push(lab+' '+getComputedStyle(e).fontSize);
     const x=Math.min(W-1,Math.max(0,b.left+b.width/2)),y=Math.min(H-1,Math.max(0,b.top+b.height/2));const t=document.elementFromPoint(x,y);
     if(t&&t!==e&&!e.contains(t)&&!t.contains(e)&&!(e.labels&&[...e.labels].some(l=>l.contains(t))))out.covered.push(lab+' by '+(t.id||t.className||t.tagName).toString().slice(0,30));}
    return {n:els.length,...out};});
   assert.ok(!r.none,name+' opens a panel at '+w+'x'+h);bad.push(...['covered','small','off','tiny'].flatMap(k=>r[k].map(x=>name+' '+w+'x'+h+' '+k+': '+x)));checked++;
   controls+=r.n;
  }
 }
 assert.deepEqual(bad,[],bad.slice(0,20).join('\n'));
 console.log('PASS t147 panel sweep: '+checked+' panels and '+controls+' controls at both iPad orientations, none covered, off screen or under 44 pt, no text box under 16px');
}
