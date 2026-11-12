import assert from 'node:assert/strict';
import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const server=await createServer({configFile:false,root,server:{host:'127.0.0.1',port:0},plugins:[{name:'fixture',configureServer(s){s.middlewares.use('/__pose-fixture',(_q,r)=>{r.setHeader('content-type','text/html');r.end('<!doctype html><html><body><div id="viewport" style="position:fixed;inset:0"></div></body></html>');});}}]});await server.listen();let browser;
try{
 browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage();await page.setViewport({width:1024,height:768});await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__pose-fixture`);

 const result=await page.evaluate(async()=>{
 const THREE=await import('/node_modules/three/build/three.module.js'),{shapePositions,INDEX}=await import('/src/mesh.js'),{openLayoutCompare}=await import('/src/layout-compare.js');
 const state={figure:'female',muscle:.5,weight:.5},before=JSON.stringify(state),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(shapePositions(state),3));geometry.setIndex(new THREE.BufferAttribute(INDEX.slice(),1));geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({color:0xc59c83}),texture=new THREE.Texture(),inkMat=new THREE.MeshBasicMaterial({map:texture}),decal=new THREE.PlaneGeometry(.1,.1);const source=Array.from(geometry.attributes.position.array);let sourceDisposals=0;for(const x of [geometry,material,texture,inkMat,decal])x.addEventListener('dispose',()=>sourceDisposals++);
 let clonedGeo=0,clonedMat=0;const gd=THREE.BufferGeometry.prototype.dispose,md=THREE.Material.prototype.dispose;THREE.BufferGeometry.prototype.dispose=function(){clonedGeo++;return gd.call(this)};THREE.Material.prototype.dispose=function(){clonedMat++;return md.call(this)};
 const bundle={state,bodyGeometry:geometry,bodyMaterial:material,decals:[{geometry:decal,material:inkMat}]};const pending=openLayoutCompare({THREE,a:bundle,b:bundle});await new Promise(r=>setTimeout(r,100));document.querySelector('.layout-compare [data-close]').click();await pending;THREE.BufferGeometry.prototype.dispose=gd;THREE.Material.prototype.dispose=md;
 return {sourceDisposals,clonedGeo,clonedMat,stateSame:JSON.stringify(state)===before,geometrySame:source.every((v,i)=>v===geometry.attributes.position.array[i])};
 });assert.equal(result.sourceDisposals,0);assert.ok(result.clonedGeo>=4&&result.clonedMat>=2) /* Skin uses Vite's separately optimized Three module; count here covers all four cloned geometries and both ink materials. */;assert.ok(result.stateSame&&result.geometrySame);console.log('PASS comparison clone disposal, borrowed textures retained, source state/geometry unchanged',result);
}finally{await browser?.close();await server.close();}
