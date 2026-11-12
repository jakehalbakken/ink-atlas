import {createSkin,updateSkin} from './skin.js';
// Isolated, ephemeral coverage study. No project mutation, garment fitting or persistence.
export const COVERAGE_OPTIONS=Object.freeze({short:'Short sleeve',long:'Long sleeve',collar:'High collar',shorts:'Shorts',hair:'Hair silhouette'});
/** Surface-only masks in normalized body coordinates. These are approximate regions,
 * not garment patterns. Front is +Z; rest body is upright with relaxed arms. */
export function coversRegion(kind,x,y,z){
 const ax=Math.abs(x);
 switch(kind){
 case 'short':return y>=.52&&y<=.845&&(ax<.135||y>=.695&&ax<.265);
 case 'long':return y>=.52&&y<=.845&&ax<.135||y>=.43&&y<=.845&&ax>=.135&&ax<.31;
 case 'collar':return y>=.815&&y<=.866&&ax<.075;
 case 'shorts':return y>=.30&&y<=.545&&ax<.16;
 case 'hair':return ax<.10&&(y>.953||y>.915&&z<-.02);
 default:return false;
 }
}
export function coverageGeometry(THREE,source,kind,offset=.0025){
 if(!Object.hasOwn(COVERAGE_OPTIONS,kind))throw new Error('Unknown coverage region');
 if(!Number.isFinite(offset)||offset<0||offset>.02)throw new Error('Invalid coverage offset');
 const geometry=source.clone();geometry.computeBoundingBox();
 if(!geometry.attributes.normal)geometry.computeVertexNormals();
 const p=geometry.attributes.position,n=geometry.attributes.normal,box=geometry.boundingBox;
 const height=box.max.y-box.min.y;if(!(height>0)) {geometry.dispose();throw new Error('Body has no height');}
 const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
 const index=geometry.index,indices=[];
 for(let i=0;i<(index?index.count:p.count);i+=3){
 const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
 // Whole triangles retained only when all three vertices are in region: honest hard boundaries.
 if(ids.every(j=>coversRegion(kind,(p.getX(j)-cx)/height,(p.getY(j)-box.min.y)/height,(p.getZ(j)-cz)/height)))indices.push(...ids);
 }
 for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)+n.getX(i)*offset,p.getY(i)+n.getY(i)*offset,p.getZ(i)+n.getZ(i)*offset);
 geometry.setIndex(indices);geometry.clearGroups();geometry.setDrawRange(0,indices.length);p.needsUpdate=true;geometry.computeBoundingSphere();return geometry;
}
/** Returns a fresh index list; never alters source attributes, UVs or indices. */
export function uncoveredDecalIndices(geometry,bodyBox,enabled){
 const p=geometry.attributes.position,index=geometry.index,indices=[],height=bodyBox.max.y-bodyBox.min.y;
 if(!(height>0))throw new Error('Body has no height');
 const cx=(bodyBox.min.x+bodyBox.max.x)/2,cz=(bodyBox.min.z+bodyBox.max.z)/2;
 for(let i=0;i<(index?index.count:p.count);i+=3){
  const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
  const covered=enabled.some(kind=>ids.every(j=>coversRegion(kind,(p.getX(j)-cx)/height,(p.getY(j)-bodyBox.min.y)/height,(p.getZ(j)-cz)/height)));
  if(!covered)indices.push(...ids);
 }return indices;
}
export function openClothingPreview({THREE,state,bodyGeometry,bodyMaterial,decals=[]}){
 return new Promise((resolve,reject)=>{
 let renderer,root,observer,frame,closed=false;const geos=[],mats=[],listeners=[],previous=document.activeElement;
 const stateBefore=JSON.stringify(state),sourceArrays=[bodyGeometry,...decals.map(d=>d.geometry)].map(g=>({g,attrs:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,a.array.slice()])),index:g.index?.array.slice()}));
 const listen=(el,type,fn,opts)=>{el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));};
 const close=error=>{if(closed)return;closed=true;cancelAnimationFrame(frame);observer?.disconnect();listeners.forEach(f=>f());geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer?.dispose();renderer?.forceContextLoss();root?.remove();previous?.focus?.();error?reject(error):resolve();};
 try{
 const ownGeo=g=>{const c=g.clone();geos.push(c);return c;};const ownMat=m=>{if(Array.isArray(m))return m.map(ownMat);const c=m.clone();mats.push(c);return c;};
 root=document.createElement('div');root.className='clothing-preview';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Clothing coverage study');
 root.innerHTML=`<style>.clothing-preview{position:absolute;inset:0;z-index:9600;background:#20232b;color:#f6f3ef;display:flex;flex-direction:column;font:14px system-ui;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}.clothing-preview *{box-sizing:border-box}.clothing-preview header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;gap:12px}.clothing-preview h2{margin:0;font-size:17px}.clothing-preview p{margin:4px 0;font-size:12px;color:#d9cbb2}.clothing-preview button{min-height:44px;min-width:44px;padding:8px 12px;border:1px solid #646a77;border-radius:9px;background:#343946;color:inherit;font:inherit;touch-action:manipulation}.clothing-preview button[aria-pressed=true]{background:#e8cf9e;color:#222}.clothing-preview button:focus-visible{outline:3px solid #a6c9ff}.clothing-stage{flex:1;min-height:80px;position:relative;touch-action:none;overflow:hidden}.clothing-stage canvas{width:100%;height:100%;display:block;touch-action:none}.clothing-toolbar{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;max-height:35%;overflow:auto}.clothing-preview .clothing-hint{padding:0 14px 8px;color:#ccc}</style><header><div><h2>Clothing coverage study</h2><p>Approximate painted-on coverage, NOT fitted clothing or realistic hair.</p><p>Neutral body only. Preview is not saved; your project stays unchanged.</p></div><button data-close>Close</button></header><div class="clothing-stage"></div><div class="clothing-toolbar"></div><p class="clothing-hint">Drag to orbit · Pinch to zoom · All overlays start off</p>`;
 (document.querySelector('#viewport')||document.body).append(root);
 const stage=root.querySelector('.clothing-stage'),toolbar=root.querySelector('.clothing-toolbar');
 const scene=new THREE.Scene();scene.background=new THREE.Color('#20232b');const camera=new THREE.PerspectiveCamera(38,1,.01,40);
 scene.add(new THREE.HemisphereLight(0xffffff,0x49424a,2));const light=new THREE.DirectionalLight(0xfff3e4,2.5);light.position.set(-2,3,4);scene.add(light);
 const body=ownGeo(bodyGeometry);body.computeBoundingBox();const {mat:baseMat,uniforms:skinUniforms}=createSkin(body,bodyMaterial.color?.clone()||new THREE.Color(0xc7a68d));mats.push(baseMat);const fem=state.figure==='female'?1:state.figure==='male'?0:.5;updateSkin(body,skinUniforms,(.0155+.006*fem)*(1+.35*(state.fit?.nippleSize||0)));scene.add(new THREE.Mesh(body,baseMat));
 const ink=decals.map(d=>{const mesh=new THREE.Mesh(ownGeo(d.geometry),ownMat(d.material));mesh.visible=d.visible!==false;mesh.renderOrder=d.renderOrder||0;scene.add(mesh);return {mesh,source:d.geometry};});
 let coveredDecalTriangles=0;const updateCoverage=()=>{const enabled=Object.keys(overlays).filter(k=>overlays[k].visible);coveredDecalTriangles=0;for(const {mesh,source}of ink){const indices=uncoveredDecalIndices(source,body.boundingBox,enabled);coveredDecalTriangles+=((source.index?.count||source.attributes.position.count)-indices.length)/3;mesh.geometry.setIndex(indices);mesh.geometry.setDrawRange(0,indices.length);}};
 const overlays={},buttons={};for(const [key,label]of Object.entries(COVERAGE_OPTIONS)){
 const geometry=coverageGeometry(THREE,body,key);geos.push(geometry);const material=new THREE.MeshStandardMaterial({color:key==='hair'?0x3a302b:key==='shorts'?0x56616e:0x405c69,roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});mats.push(material);const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;mesh.renderOrder=10;scene.add(mesh);overlays[key]=mesh;
 const b=document.createElement('button');b.textContent=label;b.dataset.coverage=key;b.setAttribute('aria-pressed','false');toolbar.append(b);buttons[key]=b;
 listen(b,'click',()=>{mesh.visible=!mesh.visible;if(mesh.visible&&(key==='short'||key==='long')){const other=key==='short'?'long':'short';overlays[other].visible=false;buttons[other].setAttribute('aria-pressed','false');}b.setAttribute('aria-pressed',String(mesh.visible));updateCoverage();draw();});
 }
 const reset=document.createElement('button');reset.textContent='Reset view';reset.dataset.reset='';toolbar.append(reset);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.setAttribute('aria-label','Approximate coverage on neutral body');stage.append(renderer.domElement);
 const target=new THREE.Vector3();body.boundingBox.getCenter(target);const size=new THREE.Vector3();body.boundingBox.getSize(size);let yaw=0,pitch=.03,distance=3;
 function draw(){if(closed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);renderer.render(scene,camera);});}
 const fit=()=>{const v=camera.fov*Math.PI/360,h=Math.atan(Math.tan(v)*camera.aspect);distance=Math.max(size.y/(2*Math.tan(v)),size.x/(2*Math.tan(h)))*1.18+size.z*.5;draw();};
 const resize=()=>{if(!stage.clientWidth||!stage.clientHeight)return;renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();fit();};
 listen(reset,'click',()=>{yaw=0;pitch=.03;fit();});listen(root.querySelector('[data-close]'),'click',()=>close());
 const points=new Map();let last;const metric=()=>{const p=[...points.values()];return p.length>1?{gap:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:p[0];};
 listen(stage,'pointerdown',e=>{e.preventDefault();stage.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});last=metric();});
 listen(stage,'pointermove',e=>{if(!points.has(e.pointerId))return;e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=metric();if(last){if(next.gap&&last.gap)distance=Math.max(.5,Math.min(10,distance*last.gap/Math.max(1,next.gap)));else if(points.size===1&&last.x!==undefined){yaw-=(next.x-last.x)*.008;pitch=Math.max(-1.2,Math.min(1.2,pitch+(next.y-last.y)*.006));}}last=next;draw();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stage,type,e=>{points.delete(e.pointerId);last=metric();});
 listen(stage,'wheel',e=>{e.preventDefault();distance=Math.max(.5,Math.min(10,distance*Math.exp(e.deltaY*.001)));draw();},{passive:false});
 listen(root,'keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const b=[...root.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===b[0]){e.preventDefault();b.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===b.at(-1)){e.preventDefault();b[0].focus();}}});
 root.__clothingTest=()=>({coveredDecalTriangles,inputsUnchanged:JSON.stringify(state)===stateBefore&&sourceArrays.every(({g,attrs,index})=>Object.entries(attrs).every(([k,a])=>a.every((v,i)=>v===g.attributes[k].array[i]))&&(!index||index.every((v,i)=>v===g.index.array[i]))),enabled:Object.keys(overlays).filter(k=>overlays[k].visible),triangles:Object.fromEntries(Object.entries(overlays).map(([k,m])=>[k,m.geometry.index.count/3]))});
 observer=new ResizeObserver(resize);observer.observe(stage);resize();root.querySelector('[data-close]').focus();
 }catch(e){close(e);}
 });
}
