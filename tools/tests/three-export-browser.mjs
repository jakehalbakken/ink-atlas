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
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__glb-test`);
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {exportSceneGlb,whiteToAlphaPixels}=await import('/src/three-export.js');
  const bodyGeometry=new THREE.BoxGeometry(.6,1.75,.3);bodyGeometry.translate(0,.875,0);bodyGeometry.userData={secret:'DO_NOT_EXPORT_GEOMETRY'};
  const bodyMaterial=new THREE.MeshStandardMaterial({color:0xc59c83});bodyMaterial.userData={secret:'DO_NOT_EXPORT_MATERIAL'};
  const geometry=new THREE.PlaneGeometry(.2,.3);geometry.translate(0,1,.151);geometry.userData={secret:'DO_NOT_EXPORT_DECAL'};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=4;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,4,4);ctx.fillStyle='black';ctx.fillRect(1,1,2,2);
  const map=new THREE.CanvasTexture(canvas),material=new THREE.MeshBasicMaterial({map,blending:THREE.MultiplyBlending,transparent:true});const pixels=Array.from(ctx.getImageData(0,0,4,4).data),positions=Array.from(geometry.attributes.position.array);
  const state={projectName:'Export test',heightCm:190,notes:['DO_NOT_EXPORT_NOTE'],photos:{front:'DO_NOT_EXPORT_PHOTO'}};
  const original=JSON.stringify(state);let disposed=false;map.addEventListener('dispose',()=>disposed=true);
  const {blob,manifest}=await exportSceneGlb({THREE,bodyGeometry,bodyMaterial,decals:[{geometry,material}],state});const buffer=await blob.arrayBuffer();
  const gltf=await new GLTFLoader().parseAsync(buffer,'');const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
  const view=new DataView(buffer),jsonLength=view.getUint32(12,true),jsonText=new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength)),json=JSON.parse(jsonText);
  const tex=meshes.find(m=>m.material.map)?.material.map;const tc=document.createElement('canvas');tc.width=tc.height=4;tc.getContext('2d').drawImage(tex.image,0,0);const alpha=tc.getContext('2d').getImageData(0,0,4,4).data;
  return {bytes:buffer.byteLength,mime:blob.type,manifest,meshCount:meshes.length,height:size.y,images:json.images?.length,textures:json.textures?.length,materials:json.materials?.length,allEmbedded:json.images.every(i=>i.bufferView!==undefined&&!i.uri),privacy:!jsonText.includes('DO_NOT_EXPORT'),unchanged:JSON.stringify(state)===original&&JSON.stringify(pixels)===JSON.stringify(Array.from(ctx.getImageData(0,0,4,4).data))&&JSON.stringify(positions)===JSON.stringify(Array.from(geometry.attributes.position.array))&&!disposed,alphaCorner:alpha[3],alphaBlack:alpha[(1*4+1)*4+3],pixelConversion:Array.from(whiteToAlphaPixels(new Uint8ClampedArray([255,255,255,255,0,0,0,128])))};
 });
 assert.equal(result.meshCount,2);assert.ok(Math.abs(result.height-1.9)<1e-6);assert.equal(result.images,1);assert.equal(result.textures,1);assert.equal(result.materials,2);assert.ok(result.allEmbedded&&result.privacy&&result.unchanged);assert.equal(result.alphaCorner,0);assert.equal(result.alphaBlack,255);assert.deepEqual(result.pixelConversion,[0,0,0,0,0,0,0,128]);console.log('PASS GLB loader roundtrip',JSON.stringify(result));
}finally{await browser?.close();await server.close();}
