// Stencil for your artist: the selected tattoo as black lines on white at its real size. The
// PNG carries its print size, the PDF draws the stencil at true size, Detail changes the lines,
// a mirrored tattoo gives a mirrored stencil, and the project never changes. Saves
// shots/t74-stencil.png and shots/t74-stencil.pdf for a visual check.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
export default async function(p){
 const wait=(n=300)=>new Promise(r=>setTimeout(r,n));
 await p.waitForFunction(()=>window.__ink&&window.__ink.ready());await wait(1200);
 const all=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
 const pick=all.find(t=>!t.hidden)||all[0];
 const chip=(await p.$$('#trayItems .chip'))[all.indexOf(pick)];await chip.click();await wait(300);
 assert.equal(await p.evaluate(()=>window.__ink.selected()),pick.id);
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.name)window.saved[blob.name]=blob.arrayBuffer();return old.call(this,blob);};});
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.evaluate(()=>{document.querySelector('#editorAdvanced').open=true;});
 const bs=await p.$eval('#bStencil',e=>{const r=e.getBoundingClientRect();return [r.width,r.height];});assert.ok(bs[1]>=44,'button big enough');
 await p.$eval('#bStencil',e=>e.click());
 await p.waitForFunction(()=>!document.querySelector('#stPrint').disabled,{timeout:60000});
 assert.equal(await p.$eval('#stencil',e=>e.hidden),false,'sheet open');
 for(const id of ['#stShare','#stPrint','#stClose']){const h=await p.$eval(id,e=>e.getBoundingClientRect().height);assert.ok(h>=44,id+' big enough');}
 const s1=await p.evaluate(()=>window.__lastStencil);
 const st0=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__ink.state()))),t0=st0.tattoos.find(t=>t.id===pick.id);
 const wCm=t0.width*100*st0.heightCm/175;
 assert.ok(Math.abs(s1.wCm-wCm)<1e-6,'real width '+s1.wCm+' cm');
 assert.ok(Math.abs(s1.w/s1.dpi*2.54-wCm)<0.05,'picture is the real width at its dpi');
 assert.ok(s1.linePixels>50&&s1.linePixels<s1.w*s1.h*0.6,'lines drawn: '+s1.linePixels);
 assert.match(await p.$eval('#stText',e=>e.textContent),/in \(.*cm\) at real size/);
 // the on-screen stencil is black lines on white
 const px=await p.evaluate(()=>{const c=document.querySelector('#stCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let black=0,white=0,other=0;for(let i=0;i<d.length;i+=4){const v=d[i];if(v<60&&d[i+1]<60&&d[i+2]<60)black++;else if(v>200&&d[i+1]>200&&d[i+2]>200)white++;else other++;}return {black,white,other};});
 assert.ok(px.black>0&&px.white>px.black,'black on white: '+JSON.stringify(px));
 assert.ok(px.other<(px.black+px.white)*0.15,'no colour left: '+JSON.stringify(px));
 // share the picture: a PNG with its print size
 await p.click('#stShare');
 await p.waitForFunction(()=>Object.keys(window.saved).some(k=>/-stencil\.png$/.test(k)),{timeout:20000});
 const png=await p.evaluate(async()=>{const k=Object.keys(window.saved).find(k=>/-stencil\.png$/.test(k));return Array.from(new Uint8Array(await window.saved[k]));});
 const pb=Buffer.from(png);assert.equal(pb.toString('ascii',12,16),'IHDR');assert.equal(pb.readUInt32BE(16),s1.w);
 assert.equal(pb.toString('ascii',37,41),'pHYs','print size right after the header');
 assert.ok(Math.abs(pb.readUInt32BE(41)*0.0254-s1.dpi)<1,'dpi '+pb.readUInt32BE(41)*0.0254);
 writeFileSync('shots/t74-stencil.png',pb);
 // print: the PDF draws it at true size
 await p.click('#stPrint');
 await p.waitForFunction(()=>Object.keys(window.saved).some(k=>/-stencil\.pdf$/.test(k)),{timeout:20000});
 const pdf=await p.evaluate(async()=>{const k=Object.keys(window.saved).find(k=>/-stencil\.pdf$/.test(k));const b=new Uint8Array(await window.saved[k]);let s='';for(const c of b)s+=String.fromCharCode(c);return {s,bytes:Array.from(b)};});
 assert.ok(pdf.s.startsWith('%PDF-'));
 const pt=wCm/2.54*72,r=n=>(Math.round(n*100)/100).toString();
 assert.ok(pdf.s.includes(`${r(pt)} 0 0 ${r(pt/t0.aspect)} `),'drawn at true size '+r(pt)+' pt');
 assert.match(pdf.s,/stencil/);
 writeFileSync('shots/t74-stencil.pdf',Buffer.from(pdf.bytes));
 // detail: more detail keeps at least as much ink
 await p.evaluate(()=>{const s=document.querySelector('#rStDetail');s.value=100;s.dispatchEvent(new Event('input'));});
 await p.waitForFunction(()=>window.__lastStencil&&window.__lastStencil.detail===1&&!document.querySelector('#stPrint').disabled,{timeout:60000});
 const s2=await p.evaluate(()=>window.__lastStencil);assert.ok(s2.inkPixels>=s1.inkPixels,'more detail keeps more ink: '+s1.inkPixels+' to '+s2.inkPixels);
 // mirrored on the body: the stencil is mirrored too
 const shot=async()=>p.evaluate(()=>{const c=document.querySelector('#stCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let l=0,rr=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4]<60){if(x<c.width/2)l++;else rr++;}return [l,rr,c.width];});
 const plain=await shot();
 await p.click('#stClose');await wait(200);assert.equal(await p.$eval('#stencil',e=>e.hidden),true,'Done closes it');
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'the stencil changes nothing saved');
 await p.evaluate(id=>{const t=window.__ink.state().tattoos.find(t=>t.id===id);t.flip=!t.flip;window.__ink.commitTest();},pick.id);await wait(300);
 await p.$eval('#bStencil',e=>e.click());
 await p.waitForFunction(()=>!document.querySelector('#stPrint').disabled&&window.__lastStencil,{timeout:60000});
 const flipped=await shot();
 if(Math.abs(plain[0]-plain[1])>0.1*(plain[0]+plain[1]))assert.ok(Math.sign(flipped[0]-flipped[1])!==Math.sign(plain[0]-plain[1]),'mirrored: '+plain+' / '+flipped);
 assert.match(await p.$eval('#stText',e=>e.textContent),pick.flip?/^((?!Mirrored).)*$/:/Mirrored/);
 await p.click('#stClose');
 console.log('PASS t74 stencil: real-size lines, black on white, PNG with print size, PDF at true size, detail, mirrored, project unchanged');
}
