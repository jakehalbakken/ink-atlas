// Isolated Chromium/Vite roundtrip; never opens the user's profile or live app.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const server=await createServer({configFile:false,root,server:{host:'127.0.0.1',port:0},plugins:[{name:'test-page',configureServer(s){s.middlewares.use('/__glb-test',(_q,r)=>{r.setHeader('content-type','text/html');r.end('<!doctype html><html><body>Local export test</body></html>');});}}]});
await server.listen();let browser;
try{
 browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__glb-test${process.env.PADDED?'#padded':''}`);
 const result=await page.evaluate(async()=>{
 const THREE=await import('/node_modules/three/build/three.module.js'),{OBJLoader}=await import('/node_modules/three/examples/jsm/loaders/OBJLoader.js'),{exportSceneObj,zipStored}=await import('/src/obj-export.js');
 const bodyGeometry=new THREE.BoxGeometry(.6,1.75,.3),bodyMaterial=new THREE.MeshStandardMaterial({color:0xc59c83});bodyGeometry.userData={secret:'PRIVATE'};
 const geometry=new THREE.PlaneGeometry(.2,.3),canvas=document.createElement('canvas');canvas.width=canvas.height=2;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,2,2);ctx.fillStyle='red';ctx.fillRect(0,0,1,1);const map=new THREE.CanvasTexture(canvas);map.flipY=false;const material=new THREE.MeshBasicMaterial({map,blending:THREE.MultiplyBlending});if(location.hash==='#padded'){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*2-.5,uv.getY(i)*2-.5);}const prior=JSON.stringify({p:[...geometry.attributes.position.array],uv:[...geometry.attributes.uv.array],matrix:map.matrix.elements,pixels:[...ctx.getImageData(0,0,2,2).data]});let disposed=false;map.addEventListener('dispose',()=>disposed=true);
 const {blob,manifest}=await exportSceneObj({THREE,bodyGeometry,bodyMaterial,decals:[{geometry,material}],state:{heightCm:190,notes:['PRIVATE'],projectName:'PRIVATE'}});const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),files={};let off=0;while(view.getUint32(off,true)===0x04034b50){const size=view.getUint32(off+18,true),len=view.getUint16(off+26,true),extra=view.getUint16(off+28,true),name=new TextDecoder().decode(bytes.slice(off+30,off+30+len)),start=off+30+len+extra;files[name]=bytes.slice(start,start+size);off=start+size;}
 const obj=new TextDecoder().decode(files['model.obj']),mtl=new TextDecoder().decode(files['materials.mtl']),parsed=new OBJLoader().parse(obj),height=new THREE.Box3().setFromObject(parsed).getSize(new THREE.Vector3()).y;
 const image=await createImageBitmap(new Blob([files['tattoo-1.png']],{type:'image/png'})),c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);const pix=[...c.getContext('2d').getImageData(0,0,2,2).data];let bad=false;try{zipStored([{name:'../private',data:new Uint8Array()}]);}catch{bad=true;}
 const unchanged=prior===JSON.stringify({p:[...geometry.attributes.position.array],uv:[...geometry.attributes.uv.array],matrix:map.matrix.elements,pixels:[...ctx.getImageData(0,0,2,2).data]})&&!disposed;
 return {imageSize:[image.width,image.height],manifest,height,names:Object.keys(files),alpha:[pix[3],pix[7]],firstDecalUv:obj.split('o tattoo_1')[1].split('\n').find(l=>l.startsWith('vt ')),privacy:![obj,mtl,new TextDecoder().decode(files['manifest.json'])].some(x=>x.includes('PRIVATE')),unchanged,bad,bytes:[...bytes]};
 });
 assert.ok(Math.abs(result.height-1.9)<1e-6);assert.deepEqual(result.alpha,process.env.PADDED?[255,255]:[255,0]);assert.deepEqual(result.imageSize,process.env.PADDED?[4,4]:[2,2]);assert.equal(result.firstDecalUv,'vt 0 0');assert.ok(result.privacy&&result.unchanged&&result.bad);assert.equal(result.manifest.tattooMeshes,1);assert.equal(result.names.length,5);
 const {writeFile,unlink}=await import('node:fs/promises'),{execFileSync}=await import('node:child_process');const path='/tmp/ink-atlas-obj-test.zip';await writeFile(path,new Uint8Array(result.bytes));try{const check=execFileSync('/usr/bin/unzip',['-t',path],{encoding:'utf8'});assert.match(check,/No errors detected/);}finally{await unlink(path);}console.log('PASS OBJ loader meter scale, PNG alpha/orientation, source immutability, privacy whitelist, path safety and ZIP CRC validation');
}finally{await browser?.close();await server.close();}
