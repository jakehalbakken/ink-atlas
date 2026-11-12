// Print at real size from the real Share sheet: a PDF with each visible tattoo at its
// true size, the project unchanged. Saves shots/t40-real-size.pdf for a visual check.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
export default async function(p){
 const before=await p.evaluate(()=>JSON.stringify(window.__ink.state()));
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});window.saved={};const old=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.name)window.saved[blob.name]=blob.arrayBuffer();return old.call(this,blob);};});
 await p.click('#shareBtn');await p.click('#cPrint');
 await p.waitForFunction(()=>!!window.saved['ink-atlas-real-size.pdf'],{timeout:60000});
 const info=await p.evaluate(async()=>{const b=new Uint8Array(await window.saved['ink-atlas-real-size.pdf']);let s='';for(const c of b)s+=String.fromCharCode(c);
  const st=window.__ink.state(),vis=st.tattoos.filter(t=>!t.hidden);
  const expect=vis.map(t=>{const w=t.width*100*st.heightCm/175/2.54*72;return [w,w/t.aspect];});
  // every image in the file decodes
  const imgs=[];const re=/\/Width (\d+) \/Height (\d+) [^>]*\/Length (\d+) >>\nstream\n/g;let m;while((m=re.exec(s))){const start=m.index+m[0].length,len=+m[3];imgs.push(await createImageBitmap(new Blob([b.slice(start,start+len)],{type:'image/jpeg'})).then(i=>[i.width,i.height]));}
  return {text:s,expect,imgs,count:vis.length,bytes:Array.from(b)};});
 assert.ok(info.text.startsWith('%PDF-'));assert.equal(info.imgs.length,info.count,'one picture per visible tattoo');
 for(const [w,h] of info.expect){const r=n=>(Math.round(n*100)/100).toString();assert.ok(info.text.includes(`${r(w)} 0 0 ${r(h)} `),`drawn at true size ${r(w)} x ${r(h)} pt`);}
 writeFileSync('shots/t40-real-size.pdf',Buffer.from(info.bytes));
 assert.equal(await p.evaluate(()=>JSON.stringify(window.__ink.state())),before,'printing changes nothing saved');
 console.log('PASS t40 print at real size: PDF from Share, every visible tattoo at its true size, pictures decode, project unchanged');
}
